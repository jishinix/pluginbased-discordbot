import { CommandInteraction, MessageFlags, MessageReaction, ModalSubmitInteraction, SlashCommandBuilder, User } from "discord.js";
import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";


export default class AnonymMessage extends CommandPlugin {
    allowedChannels: undefined | string[];
    sendInChannel: string;

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.AnonymMessage);

        this.allowedChannels = this.discordBot.settings.plugins.AnonymMessage.pluginSettings.allowedChannels;
        this.sendInChannel = this.discordBot.settings.plugins.AnonymMessage.pluginSettings.sendInChannel;



        this.discordBot.addEventListener('event-messageReactionAdd', async (reaction: MessageReaction, user: User) => {

            if (reaction.emoji.name !== '❓') {
                return;
            }

            if (
                await this.discordBot.botUtils.hasRole(user.id, this.discordBot.settings.roles.mod) ||
                await this.discordBot.botUtils.hasRole(user.id, this.discordBot.settings.roles.admin) ||
                await this.discordBot.botUtils.hasRole(user.id, this.discordBot.settings.roles.owner) ||
                this.discordBot.botUtils.isDev(user.id)
            ) {
                const sql = `
                    SELECT * FROM st_am_anonym_messages WHERE AM_MSG_ID = ?
                `;
                const rtn = (await this.discordBot.db.query(sql, [reaction.message.id]))[0];

                console.log(rtn);

                if (rtn.length > 0) {
                    reaction.remove();
                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle('Author von Anonymer Nachricht:');

                    const anonymUser = await this.discordBot.botUtils.fetchUser(rtn[0].AM_US_ID);
                    if (!anonymUser) {
                        embed.setDescription('User nicht gefunden')
                    } else {
                        embed.setDescription(`${reaction.message.url}\n${anonymUser.username}`);
                    }

                    const channel = await this.discordBot.guild?.channels.fetch(this.sendInChannel);

                    if (channel && 'send' in channel) {
                        const sendetMessage = await channel.send({ embeds: [embed] }).catch(() => { });
                        setTimeout(() => {
                            if (sendetMessage) {
                                sendetMessage.delete().catch(() => { });
                            }
                        }, 1000 * 60)
                    }
                }

            }
        })


        this.discordBot.botUtils.generateInteractionCb('modal', 'anonym_message', async (discordBot: DiscordBot, interaction: ModalSubmitInteraction, options: string[]) => {
            if (!interaction.channel || !('send' in interaction.channel)) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Es ist ein fehler aufgetreten');
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = discordBot.defaultEmbeds.getDefaultEmbed('none');
            embed.setTitle('Anonyme Nachricht')
            embed.setDescription(interaction.fields.getTextInputValue('value'));

            const msg = await interaction.channel.send({ embeds: [embed] });

            const sql = `
                INSERT INTO st_am_anonym_messages (
                    AM_MSG_ID,
                    AM_US_ID
                ) VALUES (
                    ?,
                    ?
                )
            `;
            await this.discordBot.db.query(sql, [msg.id, interaction.user.id]);

            const confirmationEmbed = discordBot.defaultEmbeds.getDefaultEmbed('none');
            confirmationEmbed.setTitle('erfolgreich gesendet')
            await interaction.reply({ embeds: [confirmationEmbed], flags: MessageFlags.Ephemeral });
        })


        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('anonym-message')
                .setDescription('Schreibe eine Nachricht ohne das jemand weiß das sie von dir kommt.'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                if (!interaction.channel || (this.allowedChannels !== undefined && !this.allowedChannels.includes(interaction.channel?.id))) {
                    let description = ['Du kannst diesen Command hier leider nicht ausführen sondern nur in: '];
                    description.push('');
                    if (this.allowedChannels) {
                        for (let i = 0; i < this.allowedChannels.length; i++) {
                            description.push(`<#${this.allowedChannels[i]}>`);
                        }
                    }
                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle('Hier nicht ausführbar');
                    embed.setDescription(description.join('\n'));
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }

                this.discordBot.botUtils.showSingleNameModal(interaction, 'Nachricht eingeben', 3000, 'Paragraph', 'anonym_message', 'Gib deine Anonyme Nachricht ein.');


            }
        })
    }
}