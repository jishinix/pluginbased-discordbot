import { EventDispatcher } from "./EventDispatcher.js";
import { Partials, REST, Routes, ActivityType, Client, IntentsBitField, GatewayIntentBits, Guild, SlashCommandBuilder, InteractionType, Interaction, CDN } from "discord.js";
import fs from "fs";
import { BotUtils } from "./BotUtils.js";
import { DefaultEmbeds } from './DefaultEmbeds.js'
import { PageModulManager } from './PageModulManager.js';
import createDB from './DB.js';
import { homePath } from "./dirname.js";

const eventNames = [
    'guildBanAdd',
    'guildBanRemove',
    'guildMemberAdd',
    'guildMemberRemove',
    'guildMemberUpdate',
    'inviteCreate',
    'inviteDelete',
    'messageCreate',
    'messageDelete',
    'messageReactionAdd',
    'messageReactionRemove',
    'messageUpdate',
    'voiceStateUpdate',
];

// interaction
// ready

interface EmbedSettingsOptions {
    colorDefault: string;
    colorError: string;
    colorReady: string;
    colorEdit: string;
    colorInfo: string;
    labelFooter: string;
}
export interface DatabaseSettingsOptions {
    url: string;
    port: number;
    user: string;
    pw: string;
    database: string;
}
interface RolesSettingsOptions {
    supporter?: string;
    mod?: string;
    admin?: string;
    owner?: string;
}
interface ChannelSettingsOptions {

}

export interface PlugginSetting {
    deactivateCommand?: string[];
    pluginSettings: { [key: string]: any };
}

export interface SettingsOptions {
    guildId: string;
    devIds: string[];
    embed: EmbedSettingsOptions;
    emojis: { [key: string]: string };
    roles: RolesSettingsOptions;
    user: { [key: string]: string };
    channel: ChannelSettingsOptions
    plugins: { [key: string]: PlugginSetting };
    labelActivity: string;
    labelPlaying: string;
    zeilenumbruch: `
`
}

export interface CommandDataObject {
    data: any; // eig SlashCommandBuilder
    execute: Function;
    autocomplete?: Function;
}

export class DiscordBot extends EventDispatcher {
    token: string;

    guild: Guild | null;
    instance: Client | null;
    settings: SettingsOptions;
    botUtils: BotUtils;
    defaultEmbeds: DefaultEmbeds;
    pageModulManager: PageModulManager;
    plugins: { [key: string]: any };
    commands: Map<string, CommandDataObject>;
    db: any;

    constructor(token: string, databaseOptions: DatabaseSettingsOptions, settings: SettingsOptions) {
        super();

        if (!settings.devIds) settings.devIds = [];

        this.token = token;

        this.guild = null;
        this.instance = null;
        this.settings = settings;
        this.settings.zeilenumbruch = `
`;
        this.db = createDB(databaseOptions);

        this.botUtils = new BotUtils(this);
        this.defaultEmbeds = new DefaultEmbeds(this);
        this.pageModulManager = new PageModulManager(this);

        this.commands = new Map();

        this.plugins = {};

        this.initPluginModules().then(() => {
            this.initInstace();
        });


        this.addEventListener('event-ready', async () => {
            this.guild = this.instance ? await this.instance.guilds.fetch(this.settings.guildId) : null;
            await this.botUtils.clearWebhooks();
        })
    }

    async initPluginModules() {
        const plugins = Object.keys(this.settings.plugins);

        for (let i = 0; i < plugins.length; i++) {
            const pluginFolderPath = `${homePath}/plugins/${plugins[i]}`;
            if (fs.existsSync(pluginFolderPath)) {
                const pluginPath = `${pluginFolderPath}/${plugins[i]}.js`;
                if (fs.existsSync(pluginPath)) {
                    const pluginName = plugins[i].slice(0, 1).toLowerCase() + plugins[i].slice(1, plugins[i].length);
                    const moduleClass = (await import(pluginPath)).default;
                    if (moduleClass) {
                        if ('preloadData' in moduleClass) {
                            const preloadData = await moduleClass.preloadData(this);
                            this.plugins[pluginName] = new moduleClass(this, preloadData);
                        } else {
                            this.plugins[pluginName] = new moduleClass(this);
                        }


                        if (this.plugins[pluginName].commands) {
                            for (const command of this.plugins[pluginName].commands) {
                                this.commands.set(command.data.name, command);
                            }
                        }
                    }
                }
            }
        }
    }

    initInstace() {
        this.instance = new Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildModeration
            ],
            partials: [
                Partials.Message, // Ermöglicht den Zugriff auf Nachrichten, die nicht gecached sind
                Partials.Channel, // (Optional) Ermöglicht den Zugriff auf Kanäle, die nicht im Cache sind
                Partials.Reaction, // Ermöglicht den Zugriff auf Reaktionen, die nicht gecached sind
                Partials.GuildMember
            ],
            allowedMentions: {
                parse: ["everyone"],
                repliedUser: true
            }
        })
        this.initEvents();

        this.instance.login(this.token);

    }

    initEvents() {

        for (let i = 0; i < eventNames.length; i++) {
            this.instance?.on(eventNames[i], (...args: any[]) => { this.dispatchEvent(`event-${eventNames[i]}`, new Array(...args)) });
        }
        this.instance?.once('ready', async () => {
            if (!this.instance || !this.instance.user) return;

            console.log(`bot wurde eingeloggt als ${this.instance.user.tag}`);

            this.instance.user.setActivity({
                name: this.settings.labelActivity,
                type: ActivityType.Playing
            });

            const rest = new REST().setToken(this.token);

            const commands: SlashCommandBuilder[] = [];

            this.commands.forEach(cmd => {
                commands.push(cmd.data);
            });

            try {
                await rest.put(Routes.applicationCommands(this.instance.user.id), { body: commands }).catch(err => console.error(err));

                console.log('alle befehle registriert');
            } catch (err) {
                console.log(err);
            }
            this.dispatchEvent(`event-ready`, new Array(this))
        });

        this.instance?.on('interactionCreate', async (interaction: Interaction) => {
            try {
                if (interaction.channel && interaction.channel.type === 1) {
                    if ('reply' in interaction) interaction.reply('Das geht nur auf Servern.');
                    return;
                }

                if (interaction.isAutocomplete()) {
                    const command = this.commands.get(interaction.commandName);

                    if (!command) {
                        console.error(`No command matching ${interaction.commandName} was found.`);
                        return;
                    }

                    if (command.autocomplete) command.autocomplete(this, interaction);

                    return;
                }

                if (interaction.isChatInputCommand()) {
                    const command = this.commands.get(interaction.commandName);

                    if (!command) {
                        console.error(`No command matching ${interaction.commandName} was found.`);
                        return;
                    }

                    command.execute(this, interaction);

                    return;
                }

                let dirName;
                if (interaction.type === InteractionType.ModalSubmit) {
                    dirName = 'modal';
                } else if (interaction.isButton()) {
                    dirName = 'buttons';
                } else if (interaction.isStringSelectMenu()) {
                    dirName = 'selects';
                } else if (interaction.isUserContextMenuCommand()) {
                    dirName = 'userContext';
                }
                else {
                    throw new Error('kein interaction type greift.')
                }
                const options = ('customId' in interaction) ? interaction.customId.split('-') : [];
                const name = options.splice(0, 1);
                const path = `../${dirName}/${name}.js`;
                if (fs.existsSync(`${homePath}/${path}`)) {
                    const interactionExecuteFunc = await import(path);
                    interactionExecuteFunc(this, interaction, options);
                } else {
                    this.dispatchEvent(`interaction-${dirName}-${name}`, [this, interaction, options]);
                }

            } catch (err) {
                console.log(err);

                const errorEmbed = this.defaultEmbeds.getErrorEmbed()
                if ('reply' in interaction) interaction.reply({ embeds: [errorEmbed], ephemeral: true })
            }
        });

    }
}