
import { ChannelType, CommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordBot } from "../../DiscordBot.js";
import { CommandPlugin } from "../../CommandPlugin.js";

export default class Birthday extends CommandPlugin {

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.Birthday);


        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('birthday')
                .setDescription('Zeige deinen oder den Geburtstag von einem anderen Crewmitgli an.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Von wem Möchtest du denn Geburtstag wissen?')
                        .setRequired(false))

                .setDMPermission(false),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                let id = '';
                if (options.user) {
                    id = options.user;
                } else {
                    id = interaction.user.id;
                }

                const bday = await this.getBirthDay(id);
                if (!bday) {
                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle(`Kein Geburtstag bekannt.`);
                    embed.setDescription(`Leider ist mir kein Geburtstag über diesen User bekannt.\nVerwende den Befehl **/remember-birthday** um deinen Geburtstag zu setzen.`);
                    interaction.reply({ embeds: [embed], ephemeral: true });
                    return
                }


                const bdayStr = this.convertDateToStr(bday)
                const embed = discordBot.defaultEmbeds.getDefaultEmbed('info');
                embed.setTitle(`Geburtstag`);
                const tage = Math.floor(this.differenzZumNaechstenGeburtstag(bday) / 1000 / 60 / 60 / 24);
                embed.setDescription(`**Von:**<@${id}>\n**Alter:** ${this.calcAge(bday)}\n**Geburtstag:** ${bdayStr}\n${tage == 365 ? '**HEUTE!**' : `**In: ** ${tage > 1 ? `${tage} Tagen` : 'Einem Tag'}`}`);
                interaction.reply({ embeds: [embed], ephemeral: true });
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('birthday-help')
                .setDescription('Zeigt alle Birthday Befehle an.'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                const embed = discordBot.defaultEmbeds.getDefaultEmbed('none');
                embed.setTitle('Birthday Help')
                embed.setDescription('**/birthday-remember**: Fügt euren Geburtstag hinzu.\n**/birthday-forget**: Entfernt euren Geburtstagseintrag.\n**/birthdays-next**: Zeigt euch die nächsten 10 Geburtstage an.\n**/birthday**: Zeigt dir deinen Geburstag oder den eines anderen Crewmitglieds an.')

                interaction.reply({ embeds: [embed] });
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('birthday-remember')
                .setDescription('Füge deinen Geburtstag hinzu.')
                .addStringOption(option =>
                    option.setName('datum')
                        .setDescription('Dein Datum (format: 27.12.1999)')
                        .setRequired(true)),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

                const aDate = options.datum.split('.');
                if (aDate.length !== 3) {
                    sendInvalidDate();
                    return;
                }
                const day = aDate[0];
                const month = aDate[1];
                const year = aDate[2];

                const date = new Date(`${year}-${month}-${day}`);
                if (!isDateValid(date)) {
                    sendInvalidDate();
                    return;
                }

                const sql = `
                        DELETE FROM st_bd_birthdays WHERE BD_US_ID = ? AND BD_SR_ID = ?;
                        INSERT INTO st_bd_birthdays (
                            BD_ID,
                            BD_US_ID,
                            BD_DATE_STRING,
                            BD_SR_ID
                        ) VALUES (
                            NULL,
                            ?,
                            '${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}',
                            ?
                        )
                    `;

                discordBot.db.query(sql, [interaction.user.id, discordBot.guild?.id, interaction.user.id, discordBot.guild?.id]);

                const embed = discordBot.defaultEmbeds.getDefaultEmbed('ready');
                embed.setTitle('Geburtstag gesetzt!');
                embed.setDescription(`Dein Geburtstag wurde für denn ${this.convertDateToStr(date)} eingetragen`);
                interaction.reply({ embeds: [embed], ephemeral: true });

                function isDateValid(date: Date) {
                    return !isNaN(date.getTime());
                }

                function sendInvalidDate() {
                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle('Invalides Datum!');
                    embed.setDescription(`Dieses Datum ist invalide. Bitte gib dein Geburtsdatum im folgendem Format an: dd.mm.yyyy also z.B.: 27.12.1999`);
                    interaction.reply({ embeds: [embed], ephemeral: true });
                }
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('birthday-remove')
                .setDescription('Entferne deinen Geburtstag.'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const sql = `
                        DELETE FROM st_bd_birthdays WHERE BD_US_ID = ? AND BD_SR_ID = ?;
                    `;

                discordBot.db.query(sql, [interaction.user.id, discordBot.guild?.id]);

                const embed = discordBot.defaultEmbeds.getDefaultEmbed('ready');
                embed.setTitle('Geburtstag gelöscht!');
                embed.setDescription(`Dein Geburtstag wurde entfernt.`);
                interaction.reply({ embeds: [embed], ephemeral: true });

            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('birthdays-next')
                .setDescription('Listet die nächsten 10 Geburtstage auf.'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                const sql = `
                        SELECT * FROM st_bd_birthdays WHERE BD_SR_ID = ?;
                    `;

                const rtn = (await discordBot.db.query(sql, [discordBot.guild?.id]))[0];

                const geburtstage = [];

                for (let i = 0; i < rtn.length; i++) {
                    geburtstage.push({ day: new Date(rtn[i].BD_DATE_STRING), user: rtn[i].BD_US_ID });
                }

                geburtstage.sort((a, b) => {
                    return this.differenzZumNaechstenGeburtstag(a.day) - this.differenzZumNaechstenGeburtstag(b.day);
                });

                let cValue = ``;
                let last = ``;
                let fields = [];
                for (let i = 0; i < 10 && i < geburtstage.length; i++) {
                    const string = this.convertDateToStr(geburtstage[i].day)
                    if (last !== string) {
                        if (last !== '') {
                            fields.push({ name: last, value: cValue })
                        }
                        cValue = ``;
                        last = string;
                    }
                    cValue += `<@${geburtstage[i].user}> (${this.calcAge(geburtstage[i].day)})\n`
                }
                if (last !== '') {
                    fields.push({ name: last, value: cValue })
                }


                const embed = discordBot.defaultEmbeds.getDefaultEmbed('info');
                embed.setTitle('Geburtstagsliste!');
                embed.addFields(fields);
                interaction.reply({ embeds: [embed], ephemeral: true });

            },
        })


        const guildId = this.discordBot.guild?.id;
        const bChannelId = this.discordBot.settings.plugins.Birthday.pluginSettings.birthdayChannelId;
        const bRoleId = this.discordBot.settings.plugins.Birthday.pluginSettings.birthdayRoleId;
        const giveRoleTime = this.discordBot.settings.plugins.Birthday.pluginSettings.giveRoleTime;
        const removeRoleTime = this.discordBot.settings.plugins.Birthday.pluginSettings.removeRoleTime;
        const sendBirthdayMessageTime = this.discordBot.settings.plugins.Birthday.pluginSettings.sendBirthdayMessageTime;

        if (bChannelId && sendBirthdayMessageTime) {
            const aSendBirthdayMessageTime: string[] = sendBirthdayMessageTime.split(':');

            this.discordBot.botUtils.scheduleFunctionAtTime(async () => {
                const now = new Date();

                const sql = `
                    SELECT * FROM st_bd_birthdays where BD_DATE_STRING like '%-${now.getMonth() + 1}-${now.getDate()}' AND BD_SR_ID = ?;
                `;

                const rtn = (await discordBot.db.query(sql, [guildId]))[0];

                const channel = await this.discordBot.guild?.channels.fetch(bChannelId);

                if (!channel || channel.type !== ChannelType.GuildText) {
                    console.error('Birthday log | Channel nicht gefunden.');
                    return;
                }

                for (let i = 0; i < rtn.length; i++) {
                    const bday = new Date(rtn[i].BD_DATE_STRING);
                    await channel.send({
                        content: `Herzlichen Glückwunsch <@${rtn[i].BD_US_ID}> du bist heute ${this.calcAge(bday)} geworden, alles Gute zum Geburtstag 🎂`,
                        allowedMentions: { repliedUser: true },
                    })
                }

            }, Number(aSendBirthdayMessageTime[0]), Number(aSendBirthdayMessageTime[1]), Number(aSendBirthdayMessageTime[2]))
        }

        if (giveRoleTime && removeRoleTime && bRoleId) {
            const aGiveRoleTime: string[] = giveRoleTime.split(':');
            const aRemoveRoleTime: string[] = giveRoleTime.split(':');

            this.discordBot.botUtils.scheduleFunctionAtTime(async () => {

                const now = new Date();

                const sql = `
                    SELECT * FROM st_bd_birthdays where BD_DATE_STRING like '%-${now.getMonth() + 1}-${now.getDate()}' AND BD_SR_ID = ?;
                `;

                const rtn = (await discordBot.db.query(sql, [guildId]))[0];

                const role = await this.discordBot.guild?.roles.fetch(bRoleId);
                if (!role) {
                    console.error('Birthday log | Rolle nicht gefunden.');
                    return;
                }
                for (let i = 0; i < rtn.length; i++) {
                    const member = await this.discordBot.guild?.members.fetch(rtn[i].BD_US_ID)
                    if (!member) continue;
                    await member.roles.add(role);
                }
            }, Number(aGiveRoleTime[0]), Number(aGiveRoleTime[1]), Number(aGiveRoleTime[2]))

            this.discordBot.botUtils.scheduleFunctionAtTime(async () => {
                const now = new Date();


                const sql = `
                    SELECT * FROM st_bd_birthdays where BD_DATE_STRING like '%-${now.getMonth() + 1}-${now.getDate()}' AND BD_SR_ID = ?;
                `;

                const rtn = (await discordBot.db.query(sql, [guildId]))[0];

                const role = await this.discordBot.guild?.roles.fetch(bRoleId);
                if (!role) {
                    console.error('Birthday log | Rolle nicht gefunden.');
                    return;
                }
                for (let i = 0; i < rtn.length; i++) {
                    const member = await this.discordBot.guild?.members.fetch(rtn[i].BD_US_ID)
                    if (!member) continue;
                    await member.roles.remove(role);
                }
            }, Number(aRemoveRoleTime[0]), Number(aRemoveRoleTime[1]), Number(aRemoveRoleTime[2]))
        }




        discordBot.addEventListener('event-guildMemberRemove', (member: GuildMember) => {
            const sql = `
                DELETE FROM st_bd_birthdays WHERE BD_US_ID = ? AND BD_SR_ID = ?;
            `;

            this.discordBot.db.query(sql, [member.user.id, member.guild.id]);
        })
    }

    async getBirthDay(userId: string) {


        const sql = `
            SELECT * FROM st_bd_birthdays where BD_US_ID = ? AND BD_SR_ID = ? LIMIT 1;
        `;

        const rtn = (await this.discordBot.db.query(sql, [userId, this.discordBot.guild?.id]))[0];

        if (rtn.length == 0) {
            return null;
        }


        const bday = new Date(rtn[0].BD_DATE_STRING);
        return bday;
    }

    convertDateToStr(date: Date) {

        let month = '';
        switch (date.getMonth() + 1) {
            case 1:
                month = "Januar";
                break;
            case 2:
                month = "Februar";
                break;
            case 3:
                month = "März";
                break;
            case 4:
                month = "April";
                break;
            case 5:
                month = "Mai";
                break;
            case 6:
                month = "Juni";
                break;
            case 7:
                month = "Juli";
                break;
            case 8:
                month = "August";
                break;
            case 9:
                month = "September";
                break;
            case 10:
                month = "Oktober";
                break;
            case 11:
                month = "November";
                break;
            case 12:
                month = "Dezember";
                break;
        }
        const string = `${('00' + date.getDate()).slice(-2)} ${month} ${date.getFullYear()}`

        return string;
    }

    calcAge(geburtstag: Date) {
        const geburtsdatum = new Date(geburtstag);
        const heute = new Date();

        let alter = heute.getFullYear() - geburtsdatum.getFullYear();

        const hatGeburtstagBereitsErfolgt =
            heute.getMonth() > geburtsdatum.getMonth() ||
            (heute.getMonth() === geburtsdatum.getMonth() && heute.getDate() >= geburtsdatum.getDate());

        if (!hatGeburtstagBereitsErfolgt) {
            alter--;
        }

        return alter;
    }

    differenzZumNaechstenGeburtstag(geburtstag: Date) {
        const heute = new Date();
        const geburtstagDatum = new Date(geburtstag.getTime());;
        geburtstagDatum.setFullYear(heute.getFullYear());

        // Wenn der Geburtstag dieses Jahr bereits vergangen ist, setze ihn auf nächstes Jahr
        if (geburtstagDatum < heute) {
            geburtstagDatum.setFullYear(heute.getFullYear() + 1);
        }

        // Berechne die Differenz in Millisekunden
        const differenz = geburtstagDatum.getTime() - heute.getTime();
        return differenz;
    }
}