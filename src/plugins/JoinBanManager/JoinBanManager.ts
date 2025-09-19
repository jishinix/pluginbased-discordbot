import fs from "fs";
import { GuildMember, ImageURLOptions } from 'discord.js';
import { DiscordBot } from "../../DiscordBot";
import Plugin from "../../Plugin";

export default class JoinBanManager extends Plugin {
    private accountExistingDays: number;
    private avatarRequired: boolean;


    constructor(discordBot: DiscordBot) {
        super(discordBot);

        this.accountExistingDays = this.discordBot.settings.plugins.JoinBanManager.pluginSettings.accountExistingDays;
        this.avatarRequired = this.discordBot.settings.plugins.JoinBanManager.pluginSettings.avatarRequired;

        this.discordBot.addEventListener('event-guildMemberAdd', (member: GuildMember) => {
            const monthInMilli = 1000 * 60 * 60 * 24 * this.accountExistingDays;
            const existSince = new Date().getTime() - member.user.createdAt.getTime();
            if (existSince < monthInMilli) {
                this.ban(member, 'Dein Account ist zu Jung. Er muss Mindestens 30 Tage alt sein.', null, `${Math.ceil((monthInMilli - existSince) / 1000 / 60 / 60 / 24)}d`);
            } else if (this.avatarRequired) {
                const imageUrlOptions: ImageURLOptions = { extension: 'jpg', size: 512 }
                let avatar = member.user.avatarURL(imageUrlOptions);
                if (!avatar) {
                    this.kickOrBan(member, 'Dein Account hat kein Profilbild.');
                }
            }
        })
    }

    async kickOrBan(member: GuildMember, banMsg: string, banningMember: null | GuildMember = null, duration: null | string = null) {
        const sql = `
            SELECT * FROM st_ua_user_attribute 
            WHERE UA_SR_ID = ?
            AND UA_US_ID = ?
            AND UA_NAME = 'autokicked'
        `;

        const rtn = (await this.discordBot.db.query(sql, [member.id, this.discordBot.guild!.id]))[0];

        if (rtn.length > 0) {
            this.ban(member, banMsg, banningMember, duration);
        } else {
            this.kick(member, banMsg);
        }
    }

    async kick(member: GuildMember, banMsg: string, banningMember: null | GuildMember = null) {
        const embed = this.getKickOrBanEmbed(false, member, banMsg, banningMember)
        try { await member.user.send({ embeds: [embed] }) } catch (err) { }
        await member.kick();

        const sql = `
            INSERT INTO st_ua_user_attribute (
                UA_US_ID,
                UA_SR_ID,
                UA_NAME,
                UA_VALUE
            ) VALUES (
                ?,
                ?,
                'autokicked',
                'true'
            )
        `;
        await this.discordBot.db.query(sql, [this.discordBot.guild!.id, member.id]);

        return { error: false };
    }

    async ban(member: GuildMember, banMsg: string, banningMember: null | GuildMember = null, duration: null | string = null) {

        let timeDate = null;

        if (duration) {

            timeDate = this.convertToFutureDate(duration);

            if (timeDate == false) {
                return { error: true, return: { content: '❌ Bitte gib die zeit in einer der follgenden Formate an: "10h", "25d", "13m", "2y".', ephemeral: true } };
            }

            const sql = `
                INSERT INTO st_ub_unbans(
                    UB_US_ID,
                    UB_TS
                ) VALUES (
                    ?,
                    ?
                )
            `;

            this.discordBot.db.query(sql, [member.id, timeDate.getTime()]);
        }

        const embed = this.getKickOrBanEmbed(true, member, banMsg, banningMember, timeDate)

        try {
            if (!duration) {
                await member.user.send({
                    embeds: [embed],
                    files: [{ attachment: `${__dirname}/banned.mp4` }]
                });
            } else {
                await member.user.send({
                    embeds: [embed]
                });
            }
        } catch (err) { };

        await member.ban();

        return { error: false };
    }



    convertToFutureDate(timeString: string): Date | false {
        const regex = /^\d+[hdmy]$/;

        if (!regex.test(timeString)) {
            return false;
        }

        const timeValue = parseInt(timeString.slice(0, -1), 10);
        const timeUnit = timeString.slice(-1);
        const currentDate = new Date();

        switch (timeUnit) {
            case 'h':
                currentDate.setHours(currentDate.getHours() + timeValue);
                break;
            case 'd':
                currentDate.setDate(currentDate.getDate() + timeValue);
                break;
            case 'm':
                currentDate.setMonth(currentDate.getMonth() + timeValue);
                break;
            case 'y':
                currentDate.setFullYear(currentDate.getFullYear() + timeValue);
                break;
            default:
                throw new Error("Unknown time unit.");
        }

        return currentDate;
    }


    getKickOrBanEmbed(isBan: boolean, member: GuildMember, banMsg: string, banningMember: null | GuildMember = null, timeDate: null | Date = null) {

        let embed;
        if (banningMember) embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error', [`von: ${this.discordBot.botUtils.getnick(banningMember)}`]);
        else embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error', [`von: ${this.discordBot.botUtils.getnick(null, this.discordBot.instance!.user)}`]);
        if (isBan) embed.setTitle('Gebannt');
        else embed.setTitle('Gekickt')
        const now = new Date();
        embed.setDescription([
            member.user ? `User: ${this.discordBot.botUtils.getnick(member)}` : `User: ${this.discordBot.botUtils.getnick(member)}`,
            `Id: ${member.id}`,
            'Grund: ' + banMsg,
            `Createt:  ${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()} ${`00${now.getHours()}`.slice(-2)}:${`00${now.getMinutes()}`.slice(-2)}`,
            timeDate && isBan ? `Bis: ${timeDate.getDate()}.${timeDate.getMonth() + 1}.${timeDate.getFullYear()} ${`00${timeDate.getHours()}`.slice(-2)}:${`00${timeDate.getMinutes()}`.slice(-2)}` : '',

        ].join('\n'))
        embed.setThumbnail(this.discordBot.botUtils.getAvatar(member))

        return embed;
    }
}