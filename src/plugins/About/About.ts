import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";

interface roleProperties {
    bez: string;
    roles: [
        {
            "anzeige": string,
            "id": string
        }
    ]
}

export default class About extends CommandPlugin {
    introduceChannelId: string | undefined;
    roleProperties: roleProperties[] | undefined;

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.About);

        this.introduceChannelId = discordBot.settings.plugins.About.pluginSettings.introduceChannelId;
        this.roleProperties = discordBot.settings.plugins.About.pluginSettings.roleProperties;

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('about')
                .setDescription('gibt die aktivität des Servers zurück')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Von welchem User willst du die Aktivität wissen?')
                        .setRequired(false)
                ),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const interactionMsg = await interaction.reply({ embeds: [this.discordBot.defaultEmbeds.getWaitEmbed()] })
                const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                const userId = interactionOptions.user ? interactionOptions.user : interaction.user.id;

                const member = await this.discordBot.botUtils.fetchMember(userId);
                if (!member) {
                    const errorEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                    errorEmbed.setTitle(`${this.discordBot.botUtils.getIcon('error')} Member nicht gefunden`);
                    interactionMsg.edit({ embeds: [errorEmbed] });
                    return;
                }
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');

                const msgIds = await this.getLastMessageFromIntroduceChannel(userId);
                const msgs = await this.fetchMessages(msgIds, (content: string) => {
                    return (
                        content.toLowerCase().includes('hobby') ||
                        content.toLowerCase().includes('jahre') ||
                        content.toLowerCase().includes('heiße') ||
                        content.toLowerCase().includes('name:') ||
                        content.toLowerCase().includes('arbeite')
                    )
                }, 1);

                const nick = this.discordBot.botUtils.getnick(member);

                const description: string[] = [];

                description.push(`**Clickable**: ${member.user.toString()}`);
                if (member.joinedAt) {
                    embed.addFields(
                        { name: 'Beigetreten', value: `${this.discordBot.botUtils.toDiscordDate(member.joinedAt)}`, inline: true },
                    )
                }
                embed.addFields(
                    { name: 'Discord member', value: `${this.discordBot.botUtils.toDiscordDate(member.user.createdAt)}`, inline: true },
                )



                if (this.roleProperties) {
                    for (let i = 0; i < this.roleProperties.length; i++) {
                        const val = this.roleProperties[i];
                        let values = [];
                        for (let j = 0; j < val.roles.length; j++) {
                            if (await this.discordBot.botUtils.hasRole(member.user.id, val.roles[j].id)) {
                                values.push(`${val.roles[j].anzeige}`);
                            }
                        }
                        if (values.length) {
                            embed.addFields(
                                { name: val.bez, value: `${values.join(', ')}`, inline: true },
                            )
                        }
                    }
                }

                if (this.discordBot.plugins.birthday) {
                    const bday = await this.discordBot.plugins.birthday.getBirthDay(member.user.id);
                    if (bday) {
                        embed.addFields(
                            { name: 'Geburtstag', value: `${this.discordBot.botUtils.toDiscordDate(bday)}`, inline: true },
                        )
                    }
                }

                if (msgs?.length) {
                    description.push('')
                    description.push('### Vorstellung: ')
                    for (let i = 0; i < msgs.length; i++) {
                        description.push(msgs[i].content);
                    }
                }

                embed.setDescription(new Array(`## ${this.discordBot.botUtils.getIcon('check')} About ${nick}`, '', '', ...description).join('\n'));

                await interactionMsg.edit({ embeds: [embed] })
            },
        })

    }

    async fetchMessages(messageIds: string[], contentFilter = (content: string) => { return true }, limit: number | null = null) {
        if (messageIds.length <= 0) return
        if (!this.introduceChannelId) return;
        const channel = await this.discordBot.guild?.channels.fetch(this.introduceChannelId);
        if (!channel || !(channel instanceof TextChannel)) return;

        const msgs = [];
        for (let i = 0; i < messageIds.length; i++) {
            const msg = await channel?.messages.fetch(messageIds[i]);
            if (msg && contentFilter(msg.content)) msgs.push(msg);
            if (limit && msgs.length >= limit) {
                break;
            };
        }
        return msgs;
    }

    async getLastMessageFromIntroduceChannel(userId: string): Promise<string[]> {
        if (!this.discordBot.plugins.analytics) return [];

        const sql = `
            SELECT UM_MSG_ID FROM st_um_user_messages WHERE UM_CH_ID = ? AND UM_US_ID = ? ORDER BY UM_JS_TIMESTAMP DESC;
        `;

        const result = (await this.discordBot.db.query(sql, [this.introduceChannelId, userId]))[0];

        return result.map((msg: any) => msg.UM_MSG_ID);
    }


}