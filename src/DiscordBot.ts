import { EventDispatcher } from "./EventDispatcher.js";
import { Partials, REST, Routes, ActivityType, Client, IntentsBitField, GatewayIntentBits, Guild, SlashCommandBuilder, InteractionType, Interaction, CDN, AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import fs from "fs";
import { BotUtils } from "./BotUtils.js";
import { DefaultEmbeds } from './DefaultEmbeds.js'
import { PageModulManager } from './PageModulManager.js';
import createDB from './DB.js';
import { homePath } from "./dirname.js";
import path from "path";
import DiscordAPIClient from './clients/DiscordAPIClient.js';

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

        this.commands = new Map();  // Plugins can register commands in the PluginConstructor

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
            const pluginPath = path.join(homePath, 'plugins', plugins[i], `${plugins[i]}.js`);
            const pluginName = plugins[i].slice(0, 1).toLowerCase() + plugins[i].slice(1, plugins[i].length);
            if (!fs.existsSync(pluginPath)) continue;

            const moduleClass = (await import(pluginPath)).default;
            if (!moduleClass) continue;

            await this.loadPlugin(pluginName, moduleClass)
        }
    }

    async loadPlugin(pluginName: string, moduleClass: any) {
        if ('preloadData' in moduleClass) {
            const preloadData = await moduleClass.preloadData(this);
            this.plugins[pluginName] = new moduleClass(this, preloadData);
        } else {
            this.plugins[pluginName] = new moduleClass(this);
        }
        if (!this.plugins[pluginName].commands) return;

        this.registerPluginCommandsLocaly(this.plugins[pluginName].commands)
    }

    registerPluginCommandsLocaly(commands: CommandDataObject[]) {
        for (const command of commands) {
            this.commands.set(command.data.name, command);
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
        this.initCoreEvents();
        this.initInteractionHandler();
    }

    initCoreEvents() {

        for (let i = 0; i < eventNames.length; i++) {
            this.instance?.on(eventNames[i], (...args: any[]) => { this.dispatchEvent(`event-${eventNames[i]}`, new Array(...args)) });
        }
        this.instance?.once('ready', async () => {
            await DiscordAPIClient.registerInstanceAttributes(this);
        });
    }

    initInteractionHandler() {
        this.instance?.on('interactionCreate', async (interaction: Interaction) => {
            try {
                this.processInteraction(interaction);
            } catch (err) {
                console.log(err);

                const errorEmbed = this.defaultEmbeds.getErrorEmbed()
                if ('reply' in interaction) interaction.reply({ embeds: [errorEmbed], ephemeral: true })
            }
        });
    }

    processInteraction(interaction: Interaction) {
        if (!interaction.guild) {
            if ('reply' in interaction) interaction.reply('Das geht nur auf Servern.');
            return;
        }

        if (interaction.isAutocomplete()) {
            this.handleInteractionAutocomplete(interaction);
        } else if (interaction.isChatInputCommand()) {
            this.handleInteracitionChatinputCommand(interaction);
        } else {
            this.handleComponentInteraction(interaction);
        }

    }

    handleInteractionAutocomplete(interaction: AutocompleteInteraction) {

        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        if (command.autocomplete) command.autocomplete(this, interaction);
    }

    handleInteracitionChatinputCommand(interaction: ChatInputCommandInteraction) {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        command.execute(this, interaction);
    }

    handleComponentInteraction(interaction: Interaction) {
        const interactionType = this.getInteractionType(interaction);

        const options = ('customId' in interaction) ? interaction.customId.split('-') : [];
        const name = options.splice(0, 1);
        this.dispatchEvent(`interaction-${interactionType}-${name}`, [this, interaction, options]);
    }

    getInteractionType(interaction: Interaction) {
        if (interaction.type === InteractionType.ModalSubmit) {
            return 'modal';
        } else if (interaction.isButton()) {
            return 'buttons';
        } else if (interaction.isStringSelectMenu()) {
            return 'selects';
        } else if (interaction.isUserContextMenuCommand()) {
            return 'userContext';
        }
        else {
            throw new Error('kein interaction type greift.')
        }
    }
}