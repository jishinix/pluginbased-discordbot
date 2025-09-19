import { BaseInteraction, CommandInteraction, Embed, EmbedBuilder, GuildMember, Interaction, Message, SlashCommandBuilder, SlashCommandStringOption, User, Webhook } from "discord.js";
import { DiscordBot } from "../../DiscordBot.js";
import { CommandPlugin } from "../../CommandPlugin.js";
import { channel } from "diagnostics_channel";


export default class DevTools extends CommandPlugin {
    currentMute: string[] = [];

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.DevTools);

        this.discordBot.addEventListener('event-messageCreate', (msg: Message) => {
            if (this.currentMute.includes(msg.author.id)) {
                msg.delete();
            }
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('exec')
                .setDescription('exec')
                .addStringOption(option =>
                    option.setName('cmd')
                        .setDescription('cmd')
                        .setRequired(true)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.devCommand(interaction, () => {
                    const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                    try {
                        eval(interactionOptions.cmd)
                        interaction.reply({ content: 'Done ig.', ephemeral: true })
                    } catch (e) {
                        interaction.reply({ content: 'Js Error:```' + e + '```', ephemeral: true })
                    }
                })
            }
        })
        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('mute')
                .setDescription('mute')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('user')
                        .setRequired(true)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.devCommand(interaction, () => {
                    const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                    if (this.discordBot.botUtils.isDev(interaction.user.id)) {
                        if (!this.currentMute.includes(interactionOptions.user)) {
                            this.currentMute.push(interactionOptions.user);
                            interaction.reply({ content: 'Done ig.', ephemeral: true });
                        }
                    }
                })
            }
        })
        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('unmute')
                .setDescription('mute')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('user')
                        .setRequired(true)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.devCommand(interaction, () => {
                    const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                    if (this.discordBot.botUtils.isDev(interaction.user.id)) {
                        if (this.currentMute.includes(interactionOptions.user)) {
                            const index = this.currentMute.indexOf(interactionOptions.user);
                            if (index > -1) {
                                this.currentMute.splice(index, 1);
                                interaction.reply({ content: 'Done ig.', ephemeral: true });
                            }
                        }
                    }
                })
            }
        })
    }

    devCommand(interaction: BaseInteraction, callback: Function) {
        if (this.discordBot.botUtils.isDev(interaction.user.id)) {
            callback();
        } else {
            if (!interaction.isChatInputCommand()) return;
            interaction.reply({ embeds: [this.discordBot.defaultEmbeds.getNoAccessEmbed()], ephemeral: true })
        }
    }
}