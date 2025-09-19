import { createCanvas, loadImage, Image } from 'canvas';
import fs from 'fs';
import request from 'request';
import sharp from 'sharp';
import short from 'short-uuid';
import puppeteer from 'puppeteer';
import { AttachmentBuilder, GuildChannel, GuildMember } from 'discord.js';
import { DiscordBot } from '../../DiscordBot';
import path from 'path';
import Plugin from '../../Plugin';

export default class JoiningImageManager extends Plugin {
    page: any;
    bannerPath?: string;
    sendBannerChannelId: string;
    text: string;
    sendWelcomeByMemberJoin: boolean;
    backgroundImageSrc: string;
    tempBannerFolderPath: string;
    tempUserFolderPath: string;

    constructor(discordBot: DiscordBot) {
        super(discordBot);

        this.page = null;

        this.bannerPath = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.bannerPath;
        this.sendBannerChannelId = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.sendBannerChannelId;
        this.text = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.text;
        this.sendWelcomeByMemberJoin = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.sendWelcomeByMemberJoin;
        this.backgroundImageSrc = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.backgroundImageSrc;
        this.tempBannerFolderPath = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.tempBannerFolderPath;
        this.tempUserFolderPath = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.tempUserFolderPath;


        this.init();

        this.discordBot.addEventListener('event-guildMemberAdd', (member: GuildMember) => {
            if (this.sendWelcomeByMemberJoin) {
                this.sendWelcomme(member);
            }
        })

        console.log('JoiningBanner Manager Initialisiert.');
    }

    async init() {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        this.page = await browser.newPage();
    }

    async sendWelcomme(member: GuildMember) {

        const channel = await this.discordBot.guild?.channels.fetch(this.sendBannerChannelId);
        if (!(channel instanceof GuildChannel) || !('send' in channel) || typeof channel.send !== 'function') return;
        try {
            const bannerPath = await this.genBanner(member);


            channel.send({
                allowedMentions: { users: [member.id], repliedUser: true },
                content: this.text,
                files: [{ attachment: bannerPath }]
            }).then(() => {
                try {
                    fs.unlinkSync(this.tempBannerFolderPath);
                } catch (err) {

                }
            })
        } catch (err) {
            console.log(err);
            channel.send({
                content: this.text.replace(/{username}/g, this.discordBot.botUtils.getnick(member)).replace(/{userId}/g, member.user.id).replace(/{guildname}/g, member.guild.name),
            })
        }
    }

    async genBanner(member: GuildMember) {

        const tempUserPath = path.join(this.tempUserFolderPath, `${short.generate()}.png`);
        this.discordBot.botUtils.downloadImage(this.discordBot.botUtils.getAvatar(member).replace(/\.webp$/g, '.png'), tempUserPath)

        const imageData = fs.readFileSync(tempUserPath).toString('base64');
        const imageSrc = `data:image/jpeg;base64,${imageData}`;

        const html = `
            <html>
                <head>
                    <style>
                        #content {
                            width: 1600px;
                            position: relative;
                            height: 900px;
                        }
                        #content > img {
                            width: 100%;
                        }

                        .profilePic{
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            position: absolute; /* Positionierung auf dem Banner */
                            top: 60%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                        }

                        #profielImg {
                            width: 200px;
                            height: 200px;
                            border-radius: 50%;
                        }

                        .profilePic span{
                            font-size: 75px;
                            margin-top: 20px;
                            color: red;
                            font-family: sans-serif;
                            font-weight: bolder;
                            color: #207d99;
                            text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;
                        }
                    </style>
                </head>
                <body>
                    <div id="content">
                        <img id="bannerImage" src="${this.backgroundImageSrc}">
                        <div class="profilePic"><img id="profielImg" src="${imageSrc}"><span>${this.discordBot.botUtils.getnick(member)}</span></div>
                    </div>
                </body>
            </html>
        `;

        await this.page.setContent(html, { waitUntil: 'networkidle0' });

        await Promise.all([
            this.page.waitForSelector('#bannerImage', { visible: true }),
            this.page.waitForSelector('#profielImg', { visible: true })
        ]);
        await this.page.evaluate(() => {
            return Promise.all([
                new Promise((resolve, reject) => {
                    const bannerImage: any = document.getElementById('bannerImage');
                    if (bannerImage.complete) {
                        resolve(undefined);
                    } else {
                        bannerImage.onload = resolve;
                        bannerImage.onerror = reject;
                    }
                }),
                new Promise((resolve, reject) => {
                    const profileImage: any = document.getElementById('profielImg');
                    if (profileImage.complete) {
                        resolve(undefined);
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
        const bannepath = path.join(this.tempBannerFolderPath, `${id}.png`);
        await element.screenshot({ path: bannepath });

        return bannepath;
    }
}