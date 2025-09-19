import { VoiceState, PermissionsBitField, ChannelType } from "discord.js";
import { DiscordBot } from "../../DiscordBot";
import Plugin from "../../Plugin";


export default class JoinVoiceChat extends Plugin {
    private joinChannelIds: string[];

    constructor(discordBot: DiscordBot) {
        super(discordBot);

        this.joinChannelIds = this.discordBot.settings.plugins.JoinVoiceChat.pluginSettings.joinChannelIds;

        this.discordBot.addEventListener('voice-joinVoiceChannel', async (state: VoiceState) => {
            if (!state.channel || !state.member || !state.channel.parent) return;
            if (this.joinChannelIds.includes(state.channel.id)) {
                const channel = await this.discordBot.guild!.channels.create({
                    name: this.discordBot.botUtils.getnick(state.member),
                    type: ChannelType.GuildVoice,
                    permissionOverwrites: new Array(
                        {
                            id: state.member.user.id,
                            allow: [
                                PermissionsBitField.Flags.ManageChannels
                            ]
                        }
                    ),
                    parent: state.channel.parent.id
                })

                const sql = `
                    INSERT INTO st_dv_dynamic_voices (
                        DV_CHANNEL_ID
                    ) VALUES (
                        ? 
                    )
                `;

                await this.discordBot.db.query(sql, [channel.id]);

                state.setChannel(channel);
            }
        })

        this.discordBot.addEventListener('voice-leaveVoiceChannel', async (state: VoiceState) => {
            if (!state.channel) return;
            const sql = `
                SELECT * FROM st_dv_dynamic_voices WHERE DV_CHANNEL_ID = ?
            `

            const rtn = (await this.discordBot.db.query(sql, [state.channel.id]))[0];
            if (rtn.length == 0) return;

            if (state.channel.members.size <= 0) {
                const sqlDel = `
                    DELETE FROM st_dv_dynamic_voices WHERE DV_CHANNEL_ID = ?
                `;
                await this.discordBot.db.query(sql, [state.channel.id]);
                await state.channel.delete().catch(er => { });
            }
        })
    }


}