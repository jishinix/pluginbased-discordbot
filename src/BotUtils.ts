import { ActionRowBuilder, ModalBuilder, TextInputStyle, TextInputBuilder, VoiceState, GuildMember, User, ImageURLOptions, Interaction, ActionRowData, AnyComponentBuilder, ModalSubmitInteraction, FetchMessagesOptions, CommandInteraction, BaseInteraction, Base, Message, GuildChannel, Channel, Webhook, ThreadChannel, ChannelWebhookCreateOptions } from 'discord.js';
import https from 'https';
import fs from 'fs-extra';
import { DiscordBot } from './DiscordBot';
import { IncomingMessage } from 'http';
import short from 'short-uuid';
import path from 'path';
import archiver from 'archiver';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { threadId } from 'worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TranscriptOptions {
    startMsgId?: string;
    maxMsgs?: number;
    ignoreMaxMsgs?: boolean;
    endMsgId?: string;
    sendIn?: string;
    sendInInteraction?: boolean;
    ephemeral?: boolean
}

export class BotUtils {
    discordBot: DiscordBot;
    afkVoiceId: string;
    modRoleId: string | undefined;
    adminRoleId: string | undefined;
    ownerRoleId: string | undefined;
    avatarWebhook: Record<string, Webhook>;

    constructor(discordBot: DiscordBot) {
        this.discordBot = discordBot;

        this.afkVoiceId = '1086784553051496498';

        this.modRoleId = this.discordBot.settings.roles.mod;
        this.adminRoleId = this.discordBot.settings.roles.admin;
        this.ownerRoleId = this.discordBot.settings.roles.owner;

        this.avatarWebhook = {};

        this.discordBot.addEventListener('event-voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
            const oldChannel = oldState.channel;
            const newChannel = newState.channel;

            const notDetectOld = this.isVoiceMemberInactive(oldState);
            const notDetectNew = this.isVoiceMemberInactive(newState);

            if ((!oldChannel || oldChannel.id !== this.afkVoiceId) && (!newChannel || newChannel.id !== this.afkVoiceId)) {
                if (!notDetectOld && notDetectNew) {
                    this.discordBot.dispatchEvent('voice-deactivateDetect', [newState])

                } else if (notDetectOld && !notDetectNew) {
                    this.discordBot.dispatchEvent('voice-activateDetect', [oldState])
                }
            }


            if (oldChannel === null && newChannel !== undefined) {
                if (newChannel && newChannel.id !== this.afkVoiceId) {
                    await this.discordBot.dispatchEvent('voice-joinVoiceChannel', [newState])
                    if (notDetectNew) {
                        this.discordBot.dispatchEvent('voice-deactivateDetect', [newState])
                    }
                }

            } else if (newChannel === null) {
                if (oldChannel && oldChannel.id !== this.afkVoiceId) {
                    this.discordBot.dispatchEvent('voice-leaveVoiceChannel', [oldState])
                }

            } else if (
                oldChannel !== undefined &&
                newChannel !== undefined &&
                oldChannel?.id !== newChannel.id
            ) {
                if (oldChannel && oldChannel.id !== this.afkVoiceId) {
                    await this.discordBot.dispatchEvent('voice-leaveVoiceChannel', [oldState])
                }
                if (newChannel && newChannel.id !== this.afkVoiceId) {
                    await this.discordBot.dispatchEvent('voice-joinVoiceChannel', [newState])
                    if (notDetectNew) {
                        this.discordBot.dispatchEvent('voice-deactivateDetect', [newState])
                    }
                }
            }
        })
    }

    isDev(userId: string) {
        return this.discordBot.devIds.includes(userId);
    }

    prittyDate(date: Date, inclusiveTime: boolean = true) {
        return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${inclusiveTime ? `um ${date.getHours()}:${date.getMinutes()}` : ''}`;
    }

    toDiscordDate(date: Date, extension = 'd') {
        return `<t:${Math.floor(date.getTime() / 1000)}:${extension}>`;
    }

    async haveMemberRole(member: GuildMember, id: string) {
        let role = undefined;
        role = member.roles.cache.get(id);
        return role !== undefined;
    }

    async fetchMember(id: string) {

        let member = undefined;
        member = this.discordBot.guild?.members.cache.get(id);
        if (!member) {
            member = await this.discordBot.guild?.members.fetch(id);
        }
        return member;
    }

    async fetchUser(id: string) {
        let user = undefined;
        user = this.discordBot.instance?.users.cache.get(id);
        if (!user) {
            user = await this.discordBot.instance?.users.fetch(id);
        }
        return user;
    }

    convertIntToMil(int: number) {
        if (int > 1000000) {
            return `${Math.floor(int / 1000000)}M`;
        }
        if (int > 1000) {
            return `${Math.floor(int / 1000)}K`;
        }
        return `${int}`;
    }

    isVoiceMemberInactive(state: VoiceState) {
        return (state.serverDeaf || state.selfDeaf || state.selfMute)
    }

    getRandomNumber(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    uppercaseFirst(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getnick(member: GuildMember | null, user: User | null = null) {
        if (member) {
            return this.uppercaseFirst(member.nickname !== null ? member.nickname : member.user.username);
        } else if (user) {
            return this.uppercaseFirst(user.username);
        } else {
            return 'unbekannt';
        }
    }

    getAvatar(member: GuildMember, user: User | null = null) {
        let avatarUrloptions: ImageURLOptions = { extension: 'png', size: 512 };
        if (member) {
            let avatar = member.avatarURL(avatarUrloptions);
            if (!avatar) avatar = member.user.avatarURL(avatarUrloptions);
            if (!avatar) avatar = 'https://discord.com/assets/529459de1dc4c2424a03.png';
            return avatar;
        } else if (user) {
            let avatar = user.avatarURL(avatarUrloptions);
            if (!avatar) avatar = 'https://discord.com/assets/529459de1dc4c2424a03.png';
            return avatar;
        } else {
            return 'https://discord.com/assets/529459de1dc4c2424a03.png';
        }
    }

    getHowLongMomentIsOver(date: Date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const diffDays = diff / 1000 / 60 / 60 / 24;
        if (diffDays < 30) {
            return `vor ${Math.floor(diffDays)} tagen`;
        } else if (diffDays < 365) {
            return `vor ${Math.floor(diffDays / 30)} Monaten`;
        } else {
            return `vor ${Math.floor(diffDays / 365)} Jahren`;
        }
    }

    generateInteractionCb(eventType: string, costumKey: string, cb: Function) {
        this.discordBot.addEventListener(`interaction-${eventType}-${costumKey}`, cb)
    }

    showSingleNameModal(interaction: BaseInteraction, name: string, length: number, textinputStyle: string, costumId: string, title: string = "Ticket erstellen") {
        const components: ActionRowBuilder<TextInputBuilder>[] = [
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel(name)
                    .setStyle(textinputStyle === "Paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(length)
                    .setRequired(true)
            )
        ];
        const modal = new ModalBuilder()
            .setCustomId(costumId)
            .setTitle(title)
            .addComponents(components);

        if (!interaction.isChatInputCommand()) return;

        interaction.showModal(modal);
    }

    showDoubleNameModal(interaction: Interaction, name: string, length: number, textinputStyle: string[], costumId: string, title: string) {
        const components: ActionRowBuilder<TextInputBuilder>[] = [
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel(name)
                    .setStyle(textinputStyle[0] === "Paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(length)
                    .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel(name)
                    .setStyle(textinputStyle[1] === "Paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(length)
                    .setRequired(true)
            )
        ];
        const modal = new ModalBuilder()
            .setCustomId(costumId)
            .setTitle(title)
            .addComponents(components);

        if (!interaction.isChatInputCommand()) return;

        interaction.showModal(modal);
    }

    async downloadImage(url: string, filepath: string) {
        await new Promise((resolve, reject) => {
            https.get(url, (res: IncomingMessage) => {
                if (res.statusCode === 200) {
                    res.pipe(fs.createWriteStream(filepath))
                        .on('error', reject)
                        .once('close', () => resolve(filepath));
                } else {
                    // Consume response data to free up memory
                    res.resume();
                    reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));

                }
            });
        });
    }

    getBar(percent: number) {
        const needetParts = Math.round(percent * 40 / 100)

        let xpBar = ``;
        for (let i = 0; i < 10; i++) {
            let part = 'm';
            if (i === 0) part = 'l';
            if (i === 9) part = 'r';

            const beforeSet = i * 4;
            let partlength = needetParts - beforeSet;
            if (partlength < 0) partlength = 0;
            if (partlength > 4) partlength = 4;

            xpBar += Math.ceil(partlength) ? '#' : '-';
        }

        return xpBar;
    }
    async transcript_replaceDiscordEmojis(text: string, folderPath: string) {
        const emojiPath = path.join(folderPath, 'emojis');
        const regex = /&lt;(a?):\w+:(\d+)&gt;/g;
        const matches = [...text.matchAll(regex)];

        for (const match of matches) {
            const [fullMatch, animated, id] = match;


            const ext = animated === 'a' ? "gif" : "png";
            const filepath = `${emojiPath}/${id}.${ext}`;

            if (!fs.existsSync(filepath)) {
                const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;

                const response = await fetch(url);
                if (!response.ok) continue;
                const buffer = await response.buffer();
                fs.writeFileSync(filepath, buffer);
            }

            text = text.replace(fullMatch, `<img class="emoji" src="emojis/${id}.${ext}">`);

        }

        return text;
    }

    async transcript_replaceDiscordMessageLinks(text: string, folderPath: string) {
        const regex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
        const matches = [...text.matchAll(regex)];

        for (const match of matches) {
            const [fullMatch, guildId, channelId, messageId] = match;


            const channel = await this.discordBot.guild?.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) continue;

            let message: Message | null = null;
            try {
                message = await channel.messages.fetch(messageId);
            } catch (err) { }

            if (!message) continue;

            const messageHtml = await this.transcript_getMessageHtmlString(message, folderPath);


            text = text.replace(fullMatch, `
                <div class="messageLink">
                    <span>
                        Nachrichtlink #${channel.name} &gt; <svg class="icon_b75563" aria-label="Nachricht" aria-hidden="false" role="img" xmlns="http://www.w3.org/2000/svg" height="1em" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z" class=""></path></svg> :
                    </span>
                    ${messageHtml}
                </div>`);
        }

        return text;
    }

    async transcript_prepareMessageContent(text: string, folderPath: string) {

        text = text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        text = await this.transcript_replaceDiscordMessageLinks(text, folderPath);
        text = await this.transcript_replaceDiscordEmojis(text, folderPath);

        return text
    }

    async transcript_getMessageHtmlString(message: Message, folderPath: string) {
        const avatarPath = path.join(folderPath, 'avatars');
        const attachmentPath = path.join(folderPath, 'attachments');
        let rtn = '';

        const mesageAvatarPath = `${avatarPath}/${message.author.username}.png`;
        const dateTime = new Date(message.createdTimestamp);

        if (!fs.existsSync(mesageAvatarPath)) await this.downloadUserAvatar(message.author, mesageAvatarPath)
        rtn += `
            <div class="message">
                <div class="avatar">
                    <img src="avatars/${message.author.username}.png">
                </div>
                <div class="content">    
                    <div class="userName">${message.author.username}<span class="time">${this.prittyDate(dateTime)}</span><a target="_blank" href="${message.url}"><img src="tab.svg"></a></div>
                    ${(message.content ? `<div class="messageContent">${await this.transcript_prepareMessageContent(message.content, folderPath)}</div>` : '')}
        `;

        if (message.embeds.length > 0 && message.author.bot) {
            for (const embed of message.embeds) {
                if (embed.data?.type !== 'rich') {
                    continue;
                }
                rtn += `
                    <div style="--color: ${this.decimalToHex(typeof embed.data.color == 'number' ? embed.data.color : 0)}" class="embed">
                        ${(embed.data.title ? `<span class="title">${embed.data.title}</span>` : '')}
                        <span class="desc">${embed.data.description}</span>
                `;
                if (embed.data && embed.data.image) {
                    const imageUrl = embed.data.image.url;
                    const imageFileName = path.basename(imageUrl);
                    const name = `${short.generate()}.${imageFileName.split('.').slice(-1)[0]}`;
                    const imagePath = path.join(attachmentPath, name);

                    const response = await fetch(imageUrl);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    await fs.writeFile(imagePath, buffer);

                    rtn += `<img class="thumbnail" src="attachments/${name}">`;
                }
                rtn += `
                        ${(embed.data.footer ? `<span class="footer">${embed.data.footer.text}</span>` : '')}
                    </div>    
                `;
            }
        }


        if (message.attachments.size > 0) {
            rtn += `
                <div class="attachments">
            `;
            for (const attachment of message.attachments.values()) {
                const name = `${short.generate()}.${attachment.name.split('.').slice(-1)[0]}`;
                const totalAttachmentPath = path.join(attachmentPath, name);
                const response = await fetch(attachment.url);
                const buffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(totalAttachmentPath, buffer);

                if (
                    name.toLocaleLowerCase().endsWith('.jpg') ||
                    name.toLocaleLowerCase().endsWith('.jpeg') ||
                    name.toLocaleLowerCase().endsWith('.png') ||
                    name.toLocaleLowerCase().endsWith('.gif') ||
                    name.toLocaleLowerCase().endsWith('.webp') ||
                    name.toLocaleLowerCase().endsWith('.svg')
                ) {
                    rtn += `
                            <img src="attachments/${name}" title="${name}" class="attachment">
                        `;
                } else {
                    rtn += `
                            <a target="_blank" href="attachments/${name}" title="${name}" class="attachment">
                                <div class="attachmentName">${name}</div>
                                <img src="tab.svg">
                            </a>
                        `;
                }
            }
            rtn += `
                </div>
            `;
        }

        rtn += `
                </div>
            </div>    
        `;

        return rtn;
    }

    async createTranscript(interaction: BaseInteraction, options: TranscriptOptions = {}) {

        if (!('reply' in interaction) || typeof interaction.reply !== 'function') return;
        if (!interaction.channel) return;
        const interactionMsg = await interaction.reply({ content: 'Bitte warte einen augenblick dein transkipt wird erstellt', ephemeral: !!options.ephemeral });

        const channel = interaction.channel;
        if (!channel?.isTextBased()) {
            interactionMsg.edit({ content: "Channel ist kein Text-Channel." });
            return;
        }

        let messages = [];
        let lastMessageId = options.startMsgId;
        console.log(lastMessageId);
        let maxMsgs = options.maxMsgs && options.maxMsgs < 5000 ? options.maxMsgs : (options.ignoreMaxMsgs ? Infinity : 5000);

        if (lastMessageId) {
            const message = await interaction.channel.messages.fetch(lastMessageId);
            if (!message) {
                interactionMsg.edit({ content: "StartMsg ist nicht in Channel in welchem ein Transkript erstellt werden soll." });
                return;
            }
            messages.push(message);
        }

        while (messages.length < maxMsgs) {
            let limit: any = maxMsgs - messages.length;
            if (limit > 100) limit = 100;
            const fetchMessagesOptions: FetchMessagesOptions = {
                limit: limit,
                before: lastMessageId
            }
            const fetchedMessages = await channel.messages.fetch(fetchMessagesOptions);

            if (fetchedMessages.size === 0) break;

            let fetchedMessagesArray = Array.from(fetchedMessages.values())
            let br = false;
            if (options.endMsgId) {
                for (let i = 0; i < fetchedMessagesArray.length; i++) {
                    const msg = fetchedMessagesArray[i];
                    if (msg.id == options.endMsgId) {
                        fetchedMessagesArray = fetchedMessagesArray.slice(0, i + 1);
                        br = true;
                    }
                }
            }

            messages = messages.concat(fetchedMessagesArray);
            lastMessageId = fetchedMessages.last()?.id;
            if (br) break;
        }

        messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        const folderName = `transcript_${short.generate()}`;
        const folderPath = path.join(__dirname, folderName);
        const avatarPath = path.join(folderPath, 'avatars');
        const attachmentPath = path.join(folderPath, 'attachments');
        const emojiPath = path.join(folderPath, 'emojis');

        await fs.ensureDir(folderPath);
        await fs.ensureDir(avatarPath);
        await fs.ensureDir(attachmentPath);
        await fs.ensureDir(emojiPath);
        fs.writeFileSync(`${folderPath}/tab.svg`, '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffff"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/></svg>')

        const htmlFilePath = path.join(folderPath, "transcript.html");
        const htmlStream = fs.createWriteStream(htmlFilePath);

        htmlStream.write(`
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Transcript von Jishinix</title>
                <link href="https://fonts.googleapis.com/css2?family=Play:wght@400;700&amp;display=swap" rel="stylesheet">
                <style>
                    * {
                        font-family: Play;
                        padding: 0;
                        margin: 0;
                        color: #fff;
                    }

                    body {
                        background-color: #313338;
                    }

                    .channelName {
                        border-bottom: solid 1px #282a2e;
                        display: flex;
                        gap: 0.75em;
                        align-items: center;
                        padding: 1.25em;
                    }

                    .chat {
                        display: flex;
                        flex-direction: column;
                        gap: 0.5em;
                        padding: 0.5em;
                    }

                    .message{
                        display: grid;
                        grid-template-columns: 2.75em auto;
                        gap: 1em;
                    }
                    .messageLink > .message {
                        padding: 0.5em;
                        border: solid 1px #a6a6a6;
                        border-radius: 6px;
                    }
                    .messageLink > span {
                        font-weight: 700;
                        font-size: 1.1em;
                    } 

                    .message .avatar {
                        display: flex;
                        width: 2.75em;
                        height: 2.75em;
                        border-radius: 50%;
                        overflow: hidden;
                    }

                    .message .content{
                        display: flex;
                        flex-direction: column;
                        gap: 0.5em;
                    }

                    .message .content .userName {
                        font-weight: 600;
                        color: #fab;
                        position: relative;
                    }

                    .message .content .userName a {
                        display: inline-flex;
                        align-items: center;
                        position: absolute;
                        top: 50%;
                        transform: translateY(-50%);
                        margin-left: 3px;
                    }

                    .message .content .userName a img{
                        width: 14px; 
                    }

                    .embed{
                        background-color: #2b2d31;
                        overflow: hidden;
                        border-radius: 4px;
                        display: inline-block;
                        padding: 1.25em;
                        width: fit-content;
                        min-width: 10em;
                        position: relative;
                    }

                    .embed::before {
                        content: "";
                        position: absolute;
                        height: 100%;
                        width: 5px;
                        background-color: var(--color);
                        left: 0;
                        top: 0;
                    }

                    .embed .title {
                        font-weight: 600;
                        margin-bottom: 0.75em;
                        display: block;
                    }

                    .embed .desc {
                        display: block;
                    }

                    .embed .thumbnail {
                        width: 15em;
                    }

                    .embed .footer {
                        margin-top: 1em;
                        display: block;
                        font-size: 0.75em;
                    }

                    .attachments{
                        display: flex;
                        flex-direction: column;
                        gap: 0.2em;
                    }

                    .attachment {
                        display: grid;
                        grid-template-columns: 15em auto;
                        background-color: #2b2d31;
                        width: fit-content;
                        padding: 0.5em;
                        align-items: center;
                        border-radius: 4px;
                        max-width: 280px;
                        box-sizing: border-box;
                    }

                    .emoji {
                        width: 2em;
                    }

                    .attachmentName {
                        white-space: none;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
        
                    .userName .time {
                        font-size: 12px;
                        margin-left: 10px;
                        font-weight: lighter;
                        color: #a0a0a0;
                    }
                </style>
            </head>
            <body>
        `);
        htmlStream.write(`
            <div class="channelName">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#fff"><path d="m240-160 40-160H120l20-80h160l40-160H180l20-80h160l40-160h80l-40 160h160l40-160h80l-40 160h160l-20 80H660l-40 160h160l-20 80H600l-40 160h-80l40-160H360l-40 160h-80Zm140-240h160l40-160H420l-40 160Z"/></svg>
                ${'name' in channel ? channel.name : 'unbekannter Channel'}
            </div>
            <div class="chat">
        `);


        for (const message of messages) {


            const messageHtml = await this.transcript_getMessageHtmlString(message, folderPath);
            htmlStream.write(messageHtml);

        }

        htmlStream.write(`
                </div>
            </body>
            </html>    
        `);
        htmlStream.end();

        const zipFilePath = path.join(__dirname, `${folderName}.zip`);
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on('error', (err: Error) => {
            console.error('Fehler beim Erstellen des ZIP-Archivs:', err);
            throw err;
        });
        output.on('close', () => {
            console.log(`ZIP-Datei erfolgreich erstellt (${zipFilePath}): ${archive.pointer()} Bytes`);
        });

        archive.pipe(output);
        archive.directory(folderPath, false);
        await archive.finalize();

        const zipStats = fs.statSync(zipFilePath);
        if (zipStats.size > 24.5 * 1000 * 1000) { // 24.5 MB in Bytes
            const name = zipFilePath.split('/').slice(-1)[0];
            await interactionMsg.edit({
                content: `Das erstellte transkript ist zu groß für discord Bitte wende dich an deinen Developer des vertrauens und gib ihn den Name "${name}" um dein transkript zu bekommen.`
            });

            fs.copyFileSync(zipFilePath, `${__dirname}/transcripts/${name}`);
        } else {
            if (options.sendIn) {
                const outputChannel = await this.discordBot.guild?.channels.fetch(options.sendIn);
                if (outputChannel && ('send' in outputChannel)) {
                    const msg = await outputChannel.send({
                        content: `Hier ist das Transkript von #${'name' in channel ? channel.name : 'unbekannter Channel'}:`,
                        files: [zipFilePath],
                    });
                    await interactionMsg.edit({
                        content: `transcript wurde erstellt: ${msg.url}`,
                    });
                }
            }

            if (options.sendInInteraction) {
                await interactionMsg.edit({
                    content: `transcript wurde erstellt:`,
                    files: [zipFilePath],
                });
            }
        }

        await fs.remove(folderPath);
        await fs.remove(zipFilePath);
    }

    decimalToHex(decimal: number, padding: number = 2): string {
        if (!Number.isInteger(decimal) || decimal < 0) {
            throw new Error("Input must be a non-negative integer.");
        }
        return `#${decimal.toString(16).toUpperCase().padStart(padding, "0")}`;
    }

    async downloadUserAvatar(user: User, filePath: string) {
        try {
            const avatarURL = user.displayAvatarURL({ extension: 'png', size: 1024 }); // PNG-Format mit 1024x1024 Auflösung
            const response = await fetch(avatarURL);

            if (!response.ok) {
                throw new Error(`Fehler beim Abrufen des Avatars: ${response.statusText}`);
            }

            const avatarBuffer = await response.buffer();
            fs.writeFileSync(filePath, avatarBuffer);

        } catch (error) {
            console.log(error)
        }
    }

    async isMod(memberId: string) {
        return (
            this.isDev(memberId) ||
            await this.hasRole(memberId, this.modRoleId) ||
            await this.hasRole(memberId, this.adminRoleId) ||
            await this.hasRole(memberId, this.ownerRoleId)
        )
    }

    async hasRole(memberId: string, roleId: string | null | undefined) {
        if (!roleId) return false
        const member = await this.discordBot.guild?.members.fetch(memberId);

        return member?.roles?.cache.has(roleId);
    }

    getOptionsObjectFromInteraction(interaction: BaseInteraction): { [key: string]: any } {
        if (!('options' in interaction) || !interaction.options) return {};

        const options = interaction.options as any; // Falls der Typ nicht sicher ist
        const rtn: { [key: string]: any } = {};

        if (Array.isArray(options.data)) {
            for (const option of options.data) {
                rtn[option.name] = option.value;
            }
        }

        return rtn;
    }

    regenerateCommand(interaction: BaseInteraction) {

        let str = `/${(interaction as CommandInteraction).commandName} `;

        const interactionOptions = this.getOptionsObjectFromInteraction(interaction);
        const keys = Object.keys(interactionOptions);
        for (let i = 0; i < keys.length; i++) {
            str += `${keys[i]}:${interactionOptions[keys[i]]} `;
        }

        return str;
    }

    scheduleFunctionAtTime(callback: () => void, hour: number, minute: number, second: number = 0) {
        function setNextExecution() {
            const now = new Date();
            const targetTime = new Date();
            targetTime.setHours(hour, minute, second, 0);

            let delay = targetTime.getTime() - now.getTime();

            if (delay < 0) {
                // Falls die Zeit schon vorbei ist, auf den nächsten Tag setzen
                targetTime.setDate(targetTime.getDate() + 1);
                delay = targetTime.getTime() - now.getTime();
            }

            setTimeout(() => {
                callback();
                setNextExecution(); // Wiederholen für den nächsten Tag
            }, delay);
        }

        setNextExecution();
    }


    scheduleFunctionIn(callback: () => void, milliseconds: number) {
        setTimeout(() => {
            callback();
        }, milliseconds);
    }

    getIcon(iconName: string) {
        if (this.discordBot.settings.emojis[iconName]) {
            return `<:${iconName}:${this.discordBot.settings.emojis[iconName]}>`;
        } else {
            return '';
        }
    }

    getAvatarWebhookKey(channel: GuildChannel, avatarUrl: string | null) {
        return `${channel.id}|${avatarUrl}`;
    }

    async getWebhook(channel: GuildChannel, avatarUrl: string | null) {

        const savedWebhook = this.avatarWebhook[this.getAvatarWebhookKey(channel, avatarUrl)];
        if (savedWebhook) return savedWebhook;

        const { webhookChannel } = this.getWebhookChannel(channel);

        if (!webhookChannel.isTextBased()) {
            return;
        }

        let currentWebhooks: Webhook[] = await this.getChannelWebhooks(webhookChannel.id);

        let c = 0;
        while (currentWebhooks.length >= 10 && c < currentWebhooks.length) {
            c++;
            for (let i = 0; i < currentWebhooks.length; i++) {
                const cw = currentWebhooks[i];
                if (cw.owner?.id === this.discordBot.instance!.user!.id) {
                    await cw.delete()
                    currentWebhooks.splice(i, 1);
                }
            }
        }
        if (!fs.existsSync('./userAvatars')) {
            fs.mkdirSync('./userAvatars');
        }

        const path = `./userAvatars/${short.generate()}.webp`;
        const options: ChannelWebhookCreateOptions = {
            name: "some-name",
        }
        if (avatarUrl) {
            await this.downloadImage(avatarUrl, path);
            options.avatar = path;
        }

        const webhook = await webhookChannel.createWebhook(options)
        this.avatarWebhook[this.getAvatarWebhookKey(channel, avatarUrl)] = webhook;

        if (avatarUrl) {
            fs.unlinkSync(path);
        }

        return webhook;
    }

    getWebhookChannel(channel: GuildChannel) {
        let webhookChannel: GuildChannel = channel;
        let threadId = undefined;

        if (channel.isThread()) {
            const threadChannel = channel as ThreadChannel; // Type Casting
            webhookChannel = threadChannel.parent!;
            threadId = threadChannel.id
        }

        return {
            webhookChannel: webhookChannel,
            threadId: threadId
        }
    }

    async getChannelWebhooks(channelId: string) {
        const webhooks = Array.from((await this.discordBot.guild!.fetchWebhooks()).values());
        webhooks.filter((webhook) => {
            return (webhook.owner && webhook.channelId === channelId)
        })

        return webhooks.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    }

    async clearWebhooks() {

        const webhooks = Array.from((await this.discordBot.guild!.fetchWebhooks()).values());

        for (let i = 0; i < webhooks.length; i++) {
            const webhook = webhooks[i];
            if (webhook.owner?.id === this.discordBot.instance!.user!.id) {
                await webhook.delete()
            }
        }
    }

}