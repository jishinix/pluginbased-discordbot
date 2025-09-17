import { SlashCommandBuilder, Collection, CommandInteraction, GuildMember, Message, VoiceState, Role } from "discord.js";
import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";
import { threadId } from "worker_threads";

import puppeteer from 'puppeteer';
import fs from 'fs';
import short from 'short-uuid';
import request from 'request';
import { homePath } from "../../dirname.js";

interface roleSettings {
    level: number;
    roleId: string;
    color: string;
}


export default class XpManager extends CommandPlugin {
    discordBot: DiscordBot;
    xpCheat: number;
    levelUpChannal: string;
    dontTracVoices: string[];
    dontTracChat: string[];
    ua_voice_name: string; // userattribute datenbankname;
    ua_msg_name: string; // userattribute datenbankname;
    memberIds: any;
    lastMemberRefresh: number | null;
    roles: roleSettings[];
    noPingRoleId?: string;

    page: any;

    pageModulFuncStorageId_TOP: string;

    startXpRole?: string;


    constructor(discordBot: DiscordBot) {
        super(discordBot.settings.plugins.XpManager);
        this.discordBot = discordBot;

        this.xpCheat = discordBot.settings.plugins.XpManager.pluginSettings.xpCheat;
        this.levelUpChannal = discordBot.settings.plugins.XpManager.pluginSettings.levelUpChannal;
        this.dontTracVoices = discordBot.settings.plugins.XpManager.pluginSettings.dontTracVoices;
        this.dontTracChat = discordBot.settings.plugins.XpManager.pluginSettings.dontTracChat
        this.roles = discordBot.settings.plugins.XpManager.pluginSettings.roles;
        this.startXpRole = discordBot.settings.plugins.XpManager.pluginSettings.startXpRole;
        this.noPingRoleId = discordBot.settings.plugins.XpManager.pluginSettings.noPingRoleId;

        this.ua_voice_name = 'voice_track';
        this.ua_msg_name = 'lastMsgCd';
        this.init();
        this.memberIds = null;
        this.lastMemberRefresh = null;

        this.page = null;

        this.discordBot.addEventListener('event-guildMemberAdd', async (member: GuildMember) => {
            if (!this.startXpRole) return;
            const role = await this.discordBot.guild?.roles.fetch(this.startXpRole);
            if (role instanceof Role) member.roles.add(role).catch(() => { });
        }),

            this.addCommand({
                data: new SlashCommandBuilder()
                    .setName('xp-help')
                    .setDescription('Zeigt alle XP Befehle an.')

                    .setDMPermission(false),
                execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle('XP Help')
                    embed.setDescription('**/xp-top**: Zeigt die Top XP User an.\n**/xp-rewards**: Zeigt die Rewards für Level an.\n**/xp-rank**: Zeige deinen XP Rank an.')

                    interaction.reply({ embeds: [embed] });
                },
            })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('xp-rank')
                .setDescription('Zeige deinen XP Rank an.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Von wem Möchtest du denn rank wissen?')
                        .setRequired(false))

                .setDMPermission(false),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.interactionRank(interaction);
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('xp-rewards')
                .setDescription('Zeigt die Rewards für Level an.')

                .setDMPermission(false),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const embed = discordBot.defaultEmbeds.getDefaultEmbed('none');
                embed.setTitle('Level Rollen');
                const rollen = [];
                for (let i = 0; i < this.roles.length; i++) {
                    const current = this.roles[i];

                    rollen.push(`Level: ${current.level}: <@&${current.roleId}>`);
                }
                embed.setDescription(rollen.join('\n'))
                interaction.reply({ embeds: [embed] })

            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('xp-top')
                .setDescription('Zeigt die Top XP User an.')

                .setDMPermission(false),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {

                this.interactionTop(interaction);

            },
        })



        this.pageModulFuncStorageId_TOP = discordBot.pageModulManager.createFunctionStorage(
            async (page: number, max: number) => {
                const sql = `
                    SELECT *, ROW_NUMBER() OVER (ORDER BY XP_LEVEL DESC, XP_POINTS DESC) AS Position
                    FROM st_xp_experience_point WHERE XP_US_ID IN (?) LIMIT ?, ?
                `;


                const rtn = (await this.discordBot.db.query(sql, [await this.getMemberIds(), page * max, max]))[0];
                let desc = ``;


                for (let i = 0; i < rtn.length; i++) {
                    desc += `**#${rtn[i].Position}** <@${rtn[i].XP_US_ID}>: ${this.discordBot.botUtils.convertIntToMil(this.calcIngLvl(rtn[i].XP_LEVEL, rtn[i].XP_POINTS))} / Level: ${rtn[i].XP_LEVEL}\n`;
                }

                return desc;
            },
            () => { },
            async (max: number) => {
                const sql = `
                    SELECT COUNT(*) as anz FROM st_xp_experience_point WHERE XP_US_ID IN (?) LIMIT 1;
                `;
                const rtn = (await this.discordBot.db.query(sql, [await this.getMemberIds()]))[0];

                const page = Math.floor(rtn[0].anz / max);
                if (page == rtn[0].anz / max) return page - 1;
                return page;
            },
            'XP - TOP'
        )


        this.discordBot.addEventListener('event-ready', async () => {
            this.checkVoiceChannels();
            setInterval(() => {
                this.doVoiceXPAdd();
            }, 1000 * 60)
            setInterval(() => {
                this.checkVoiceChannels();
            }, 1000 * 60 * 15);
        })


        this.discordBot.addEventListener('voice-deactivateDetect', async (newState: VoiceState) => { await this.setUntrackVoice(newState); })
        this.discordBot.addEventListener('voice-activateDetect', async (oldState: VoiceState) => { await this.setTrackVoice(oldState); })
        this.discordBot.addEventListener('voice-leaveVoiceChannel', async (oldState: VoiceState) => { await this.setUntrackVoice(oldState); })
        this.discordBot.addEventListener('voice-joinVoiceChannel', async (newState: VoiceState) => { await this.setTrackVoice(newState); })
        this.discordBot.addEventListener('event-messageCreate', async (message: Message) => { await this.checkMessageCooldown(message); })
    }

    async getMemberIds() {
        const now = new Date().getTime();
        if (this.memberIds === null || this.lastMemberRefresh === null || now - this.lastMemberRefresh > 1000 * 60 * 5) {
            const members = await this.discordBot.guild?.members.fetch();
            if (members instanceof Collection) {
                this.memberIds = members.map(member => member.id);
                this.lastMemberRefresh = now;
            } else {
                this.memberIds = [];
                this.lastMemberRefresh = null;
            }
        }
        return this.memberIds;
    }

    async init() {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        this.page = await browser.newPage();
    }
    download(uri: string, filename: string, callback: any) {
        request.head(uri, function (err: Error, res: any, body: any) {
            request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
        });
    };

    async interactionTop(interaction: CommandInteraction) {
        this.discordBot.pageModulManager.interactionSend(interaction, this.pageModulFuncStorageId_TOP);
    }

    async getUserStats(id: string) {


        const sql = `
            SELECT
                xp.XP_POINTS as XP_POINTS, 
                xp.XP_LEVEL as XP_LEVEL, 
                xp.XP_LEVEL_UP_REQUIREMENTS as XP_LEVEL_UP_REQUIREMENTS,
                posjoin.Position as Position
            FROM st_xp_experience_point as xp 
            INNER JOIN (
                SELECT pos.Position as Position, pos.XP_US_ID as XP_US_ID FROM (
                    SELECT *, ROW_NUMBER() OVER (ORDER BY XP_LEVEL DESC, XP_POINTS DESC) AS Position
                    FROM st_xp_experience_point WHERE XP_US_ID IN (?)
                ) as pos
            ) as posjoin ON posjoin.XP_US_ID = xp.XP_US_ID
            WHERE xp.XP_US_ID = ? AND xp.XP_SR_ID = ? LIMIT 1;
        `;

        const rtn = (await this.discordBot.db.query(sql, [await this.getMemberIds(), id, this.discordBot.guild?.id]))[0];

        const cXp = rtn[0] ? rtn[0].XP_POINTS : 0;
        const cLv = rtn[0] ? rtn[0].XP_LEVEL : 0;
        const nXp = rtn[0] ? rtn[0].XP_LEVEL_UP_REQUIREMENTS : 75;
        const pos = rtn[0] ? rtn[0].Position : 'unbekannt';

        return { cXp, cLv, nXp, pos };
    }

    async interactionRank(interaction: CommandInteraction) {
        const interactionMsg = await interaction.reply({ embeds: [this.discordBot.defaultEmbeds.getWaitEmbed()] })

        const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)

        let id = '';
        let member = interaction.member
        if (options.user) {
            id = options.user;
            const fetchMemberRtn = await this.discordBot.guild?.members.fetch(id);
            if (fetchMemberRtn instanceof GuildMember) {
                member = fetchMemberRtn;
            }
        } else {
            id = interaction.user.id;
        }

        if (!(member instanceof GuildMember)) {
            return
        }

        const { cXp, cLv, nXp, pos } = await this.getUserStats(id);

        const percent = cXp * 100 / nXp;


        const avatar = this.discordBot.botUtils.getAvatar(member);


        const path: any = await this.genBanner(member, cXp, nXp, pos, cLv);


        interactionMsg.edit({ embeds: [], files: [{ attachment: fs.readFileSync(path) }] });
    }

    calcIngLvl(lvl: number, cXp: number) {

        let gesamtXP = 0;
        for (let i = 0; i < lvl; i++) {
            gesamtXP += this.calcXpForLevel(i);
        }

        return gesamtXP + cXp;
    }

    async checkMessageCooldown(msg: Message) {
        const sql = `
            SELECT * FROM st_ua_user_attribute
            WHERE UA_US_ID = ? AND UA_SR_ID = ? AND UA_NAME = ? AND CAST(UA_VALUE AS UNSIGNED) > ?;
        `;
        const rtn = (await this.discordBot.db.query(sql, [msg.author.id, this.discordBot.guild?.id, this.ua_msg_name, new Date().getTime() - 1000 * 60]))[0];

        if (rtn.length === 0) {
            this.doMessageXPAdd(msg);
        }
    }

    async doMessageXPAdd(msg: Message) {
        if (msg.author.bot) return
        if (this.dontTracVoices.length > 0 && this.dontTracVoices.includes(msg.channel.id)) return;
        const sql = `
            INSERT INTO st_xp_experience_point (
                XP_US_ID,
                XP_SR_ID,
                XP_POINTS,
                XP_LEVEL,
                XP_LEVEL_UP_REQUIREMENTS
            ) SELECT ?, ?, 0, 0, 75 
            WHERE ? NOT IN (
                SELECT XP_US_ID FROM st_xp_experience_point
            );
            UPDATE st_xp_experience_point SET XP_POINTS = XP_POINTS + ? WHERE XP_SR_ID = ? AND XP_US_ID = ?;

            DELETE FROM st_ua_user_attribute where UA_NAME = ? AND UA_SR_ID = ? AND UA_US_ID = ?;
            INSERT INTO st_ua_user_attribute (
                UA_US_ID,
                UA_NAME,
                UA_VALUE,
                UA_SR_ID
            ) VALUES (
                ?,
                ?,
                ?,
                ?
            );
        `;

        let randVal = this.discordBot.botUtils.getRandomNumber(15, 40);
        if (this.discordBot.botUtils.isDev(msg.author.id)) {
            randVal = randVal * this.xpCheat;
        }
        await this.discordBot.db.query(sql, [msg.author.id, this.discordBot.guild?.id, msg.author.id, randVal, this.discordBot.guild?.id, msg.author.id, this.ua_msg_name, this.discordBot.guild?.id, msg.author.id, msg.author.id, this.ua_msg_name, new Date().getTime(), this.discordBot.guild?.id]);
        this.checkForLevelUp();
    }

    async addXP(guildId: string, usId: string, xp: number) {

        const sql = `
            INSERT INTO st_xp_experience_point (
                XP_US_ID,
                XP_SR_ID,
                XP_POINTS,
                XP_LEVEL,
                XP_LEVEL_UP_REQUIREMENTS
            ) SELECT ?, ?, 0, 0, 75 
            WHERE ? NOT IN (
                SELECT XP_US_ID FROM st_xp_experience_point
            );
            UPDATE st_xp_experience_point SET XP_POINTS = XP_POINTS + ? WHERE XP_SR_ID = ? AND XP_US_ID = ?;
        `;

        await this.discordBot.db.query(sql, [usId, guildId, usId, xp, guildId, usId]);
        this.checkForLevelUp();
    }

    async doVoiceXPAdd() {
        const sql = `
            INSERT INTO st_xp_experience_point (
                XP_US_ID,
                XP_SR_ID,
                XP_POINTS,
                XP_LEVEL,
                XP_LEVEL_UP_REQUIREMENTS
            ) SELECT UA_US_ID, UA_SR_ID, 0, 0, 100 FROM st_ua_user_attribute
            WHERE UA_NAME = ? 
            AND UA_US_ID NOT IN (
                SELECT XP_US_ID FROM st_xp_experience_point
            );

            UPDATE st_xp_experience_point SET XP_POINTS = XP_POINTS + ? WHERE XP_SR_ID = ? AND XP_US_ID IN (
                SELECT UA_US_ID FROM st_ua_user_attribute WHERE UA_NAME = ? AND XP_SR_ID = ?
            );
        `;

        const randVal = this.discordBot.botUtils.getRandomNumber(2, 5);

        await this.discordBot.db.query(sql, [this.ua_voice_name, randVal, this.discordBot.guild?.id, this.ua_voice_name, this.discordBot.guild?.id]);

        this.checkForLevelUp()
    }

    async checkForLevelUp() {
        const sqlSelect = `
            SELECT * FROM st_xp_experience_point WHERE XP_POINTS >= XP_LEVEL_UP_REQUIREMENTS;
        `;

        const rtn = (await this.discordBot.db.query(sqlSelect))[0];

        const channel = await this.discordBot.guild?.channels.fetch(this.levelUpChannal);

        const preperedInstet = [];
        const sqlInstert = [];
        for (let i = 0; i < rtn.length; i++) {
            const current = rtn[i];
            let needetXP = current.XP_LEVEL_UP_REQUIREMENTS;
            let level = current.XP_LEVEL
            let points = current.XP_POINTS
            while (points >= needetXP) {
                points -= needetXP;
                level++;
                needetXP = this.calcXpForLevel(level)
                let member = null;
                try {
                    member = await this.discordBot.guild?.members.fetch(current.XP_US_ID);
                } catch (er) { }
                if (member) {
                    let msg = `Let's goo <@${current.XP_US_ID}>! Du bist aufgelevelt: ${level}. GG!`;
                    let mention = true;
                    let role;

                    for (let roleId = 0; roleId < this.roles.length; roleId++) {
                        if (level === this.roles[roleId].level) {
                            role = await member.guild.roles.fetch(this.roles[roleId].roleId);
                            if (!role) return;
                            msg += ` Du steigst somit zum Rang <@&${role.id}> auf!`;
                            mention = true;
                            await member.roles.add(role);
                            if (roleId !== 0) {
                                try {
                                    const previusRole = await member.guild.roles.fetch(this.roles[roleId - 1].roleId);
                                    if (previusRole) await member.roles.remove(previusRole);
                                } catch (err) { }
                            }
                            break;
                        }
                    }

                    if (this.noPingRoleId) {
                        if (await this.discordBot.botUtils.hasRole(member.user.id, this.noPingRoleId)) {
                            mention = false;
                        }
                    }

                    if (channel && 'send' in channel) {
                        if (mention) {
                            channel.send({
                                allowedMentions: { users: [current.XP_US_ID], repliedUser: true },
                                content: msg
                            });
                        } else {
                            channel.send({
                                content: msg
                            });
                        }
                    }
                }
            }

            preperedInstet.push(...[
                points,
                level,
                needetXP,
                current.XP_US_ID,
                current.XP_SR_ID,
            ]);
            preperedInstet.push(points);
            preperedInstet.push(level);
            preperedInstet.push(needetXP);
            preperedInstet.push(current.XP_US_ID);
            preperedInstet.push(current.XP_SR_ID);
            sqlInstert.push(`UPDATE st_xp_experience_point SET XP_POINTS = ?, XP_LEVEL = ?, XP_LEVEL_UP_REQUIREMENTS= ? WHERE XP_US_ID = ? AND XP_SR_ID = ?`)

        }


        if (preperedInstet.length > 0) {

            await this.discordBot.db.query(sqlInstert.join(';'), preperedInstet)
        }
    }

    async setTrackVoice(state: VoiceState) {
        if (!state.channel) return;
        if (this.dontTracVoices.includes(state.channel.id)) return
        if (state.member?.user.bot) return
        const sql = `
            DELETE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ? AND UA_SR_ID = ?;
            INSERT INTO st_ua_user_attribute (
                UA_US_ID,
                UA_NAME,
                UA_VALUE,
                UA_SR_ID
            ) VALUES (
                ?,
                ?,
                ?,
                ?
            )
        `;

        await this.discordBot.db.query(sql, [state.member?.id, this.ua_voice_name, state.guild.id, state.member?.id, this.ua_voice_name, state.channel.id, state.guild.id]);
    }

    async setUntrackVoice(state: VoiceState) {
        if (state.member?.user.bot) return
        const sql = `
            DELETE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ? AND UA_SR_ID = ?;
        `
        await this.discordBot.db.query(sql, [state.member?.id, this.ua_voice_name, state.guild.id]);
    }

    async checkVoiceChannels() {

        const messageFetchRtn = await this.discordBot.guild?.members.fetch();
        if (!(messageFetchRtn instanceof Collection)) return;
        const members = (Array.from(messageFetchRtn)).filter((member) => member[1].voice.channel && !this.discordBot.botUtils.isVoiceMemberInactive(member[1].voice));

        const sqlDel = `
            DELETE FROM st_ua_user_attribute WHERE UA_NAME = ? AND UA_SR_ID = ?;
        `;
        const sqlInertInto = `
            INSERT INTO st_ua_user_attribute (
                UA_US_ID,
                UA_NAME,
                UA_VALUE,
                UA_SR_ID
            ) VALUES ?
        `;

        const preperedMember = [];
        for (let i = 0; i < members.length; i++) {
            preperedMember.push([
                members[i][1].id,
                this.ua_voice_name,
                '1',
                this.discordBot.guild?.id
            ])
        }

        if (preperedMember.length > 0) {
            await this.discordBot.db.query(sqlDel + sqlInertInto, [this.ua_voice_name, this.discordBot.guild?.id, preperedMember]);
        } else {
            await this.discordBot.db.query(sqlDel, [this.ua_voice_name, this.discordBot.guild?.id]);
        }

    }

    calcXpForLevel(level: number) {

        return level * 100 + 75;
        // made by pepper ;) ^^
        //return (5* Math.pow(level,2) + 50*level + 100)
    }



    async genBanner(member: GuildMember, xp: number, maxXp: number, rank: number, level: number) {

        return await new Promise((res) => {

            const path = `${homePath}/plugins/XpManager/user.temp/${short.generate()}.png`;
            this.download(this.discordBot.botUtils.getAvatar(member).replace(/\.webp/g, '.png'), path, async () => {

                const imageData = fs.readFileSync(path).toString('base64');
                const imageSrc = `data:image/jpeg;base64,${imageData}`;

                let color = `#d4af37`;
                const revRoles = new Array(...this.roles).reverse();

                for (let i = 0; i < revRoles.length; i++) {
                    if (level >= revRoles[i].level) {
                        color = revRoles[i].color;
                        break;
                    }
                }


                const html = `
            <html>
                <head>
                    <style>
                        .bar::before {
                        content: "";
                        position: absolute;
                        left: 0;
                        width: ${1060 * (xp * 100 / maxXp) / 100}px;
                        height: 100%;
                        background: ${color};
                        }
                    </style>
                </head>
                <body style="
                    background: gray;
                    margin: 0;
                    padding: 0;
                    ">
                    <div id="content" style="
                        background-color: #24242b;
                        padding: 0;
                        position: relative;
                        width: 1400px;
                        height: 319px;
                        ">
                        <div style="
                            background: linear-gradient(90deg, ${color} 0%, rgba(36, 36, 43, 1) 100%);
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            filter: brightness(0.4);
                            "></div>
                        <svg id="visual" viewBox="0 0 1400 319" width="1400" height="319" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" style="
                            position: absolute;
                            fill: ${color};
                            filter: brightness(0.7);
                            ">
                            <path d="M1156 319L1146.7 301.3C1137.3 283.7 1118.7 248.3 1104 212.8C1089.3 177.3 1078.7 141.7 1077.7 106.2C1076.7 70.7 1085.3 35.3 1089.7 17.7L1094 0L1400 0L1400 17.7C1400 35.3 1400 70.7 1400 106.2C1400 141.7 1400 177.3 1400 212.8C1400 248.3 1400 283.7 1400 301.3L1400 319Z" stroke-linecap="round" stroke-linejoin="miter"></path>
                        </svg>
                        <div class="userContent" style="
                            position: absolute;
                            left: 1.5em;
                            top: 1.5em;
                            display: flex;
                            color: ${color};
                            gap: 2em;
                            ">
                            <div class="avagtarDotetContainer" style="
                            border-radius: 50%;
                            overflow: hidden;
                            border: dotted 3px #fff;
                            ">
                            <div class="avatarContainer" style="
                                border: solid 3px #FFF;
                                border-radius: 50%;
                                margin: 0.2em;
                                overflow: hidden;
                                display: flex;
                                width: 195px;
                                height: 195px;
                                justify-content: center;
                                align-items: center;
                                ">
                                <img id="userimag" src="${imageSrc}" style="
                                    width: 100%;
                                    ">
                            </div>
                            </div>
                            <div class="userName" style="margin-top: 1em;">
                            <span style="
                                font-family: sans-serif;
                                font-size: 70px;
                                max-width: 11.4em;
                                overflow: hidden;
                                display: block;
                                white-space: nowrap;
                                text-overflow: ellipsis;
                                ">${this.discordBot.botUtils.getnick(member)}</span>
                            </div>
                        </div>
                        <div style="
                            position: absolute;
                            bottom: 1em;
                            left: 1.5em;
                            " class="barcontainer">
                            <span class="Rankangabe" style="
                            position: absolute;
                            color: #fff;
                            left: 6.1em;
                            font-size: 40px;
                            bottom: 54px;
                            font-family: sans-serif;
                            ">Rank: <b>#${rank}</b></span>
                            <span class="levelangabe" style="
                            position: absolute;
                            color: #fff;
                            right: 0.75em;
                            font-size: 40px;
                            bottom: 54px;
                            font-family: sans-serif;
                            ">Level <b>${level}</b></span>
                            <div class="bar" style="
                            width: 1060px;
                            height: 50px;
                            background: #fff;
                            border-radius: 30px;
                            position: relative;
                            overflow: hidden;
                            ">
                            <span style="
                                position: absolute;
                                right: 0.75em;
                                font-size: 25px;
                                font-family: sans-serif;
                                top: 50%;
                                transform: translateY(-50%);
                                ">${xp} / ${maxXp} experience</span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
        `;

                await this.page.setContent(html, { waitUntil: 'networkidle0' });

                await Promise.all([
                    this.page.waitForSelector('#userimag', { visible: true })
                ]);
                await this.page.evaluate(() => {
                    return Promise.all([
                        new Promise((resolve, reject) => {
                            const profileImage: any = document.getElementById('userimag');
                            if (profileImage.complete) {
                                resolve(null);
                            } else {
                                profileImage.onload = resolve;
                                profileImage.onerror = reject;
                            }
                        })
                    ]);
                });

                const element = await this.page.$('#content');
                if (!element) {
                    throw new Error('Element not found!');
                }

                const id = short.generate();
                const bannepath = `${homePath}/plugins/XpManager/banner.temp/${id}.png`;
                await element.screenshot({ path: bannepath });

                res(bannepath);
            })
        })
    }
}