import fs from "fs";
import { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Message, MessageCreateOptions, MessageEditOptions } from 'discord.js';
import { DiscordBot } from "../../DiscordBot";

export default class Embedtexter {
    discordBot: DiscordBot;
    baseEmbedPath: string;

    constructor(discordBot: DiscordBot) {
        this.discordBot = discordBot;

        this.baseEmbedPath = this.discordBot.settings.plugins.Embedtexter.pluginSettings.baseEmbedPath;

        discordBot.addEventListener('event-messageCreate', async (message: Message) => {
            if (this.discordBot.botUtils.isDev(message.author.id)) {
                if (message.content.startsWith('!embed')) {
                    const aContent = message.content.split(' ');
                    if (aContent[1] === "create") {
                        if (aContent[2] !== undefined) {
                            const path = `${this.baseEmbedPath}/${aContent[2]}.json`
                            if (fs.existsSync(path)) {
                                const { embed, file, buttonRow } = this.createEmbed(path);

                                const obj: MessageCreateOptions = { embeds: [embed] }

                                if (file !== null) {
                                    obj.files = [file];
                                }
                                if (buttonRow !== null) {
                                    obj.components = [buttonRow];
                                }
                                if ('send' in message.channel) message.channel.send(obj);
                                message.delete();
                            }
                        }
                    }
                    if (aContent[1] === "edit") {
                        if (aContent[2] !== undefined && aContent[3] !== undefined) {
                            const id = aContent[2];
                            message.channel.messages.fetch(id)
                                .then((msg) => {

                                    if (msg !== null) {

                                        const path = `${this.baseEmbedPath}/${aContent[3]}.json`
                                        if (fs.existsSync(path)) {
                                            const { embed, file, buttonRow } = this.createEmbed(path);

                                            const obj: MessageEditOptions = { embeds: [embed] }

                                            if (file !== null) {
                                                obj.files = [file];
                                            }
                                            if (buttonRow !== null) {
                                                obj.components = [buttonRow];
                                            }
                                            msg.edit(obj);
                                            message.delete();
                                        }
                                    }
                                })
                                .catch((err) => {
                                    console.log(err)
                                });
                        }
                    }
                }
            }
        })

        console.log('Embed Manager Initialisiert.');
    }

    createEmbed(path: string) {

        const embedData = JSON.parse(fs.readFileSync(path).toString());

        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed(embedData.type);
        embed.setTitle(embedData.title)
        if (typeof embedData.content === 'string') {
            embed.setDescription(embedData.content)
        } else if (Array.isArray(embedData.content)) {
            embed.setDescription(embedData.content.join('\n'))
        }

        let file = null;
        let buttons = [];
        let buttonRow = null;

        if (embedData.image !== undefined) {
            file = new AttachmentBuilder(`${this.baseEmbedPath}/assets/${embedData.image}`);
            embed.setImage(`attachment://${embedData.image}`);
        }

        if (embedData.buttonLinks !== undefined) {
            for (let i = 0; i < embedData.buttonLinks.length && i < 5; i++) {
                buttons.push(
                    new ButtonBuilder()
                        .setURL(embedData.buttonLinks[i].link)
                        .setLabel(embedData.buttonLinks[i].label)
                        .setEmoji(embedData.buttonLinks[i].emogie)
                        .setStyle(ButtonStyle[embedData.buttonLinks[i].buttonStyle as keyof typeof ButtonStyle])
                )
            }

            buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(...buttons);
        }

        return { embed: embed, file: file, buttonRow: buttonRow }
    }
}