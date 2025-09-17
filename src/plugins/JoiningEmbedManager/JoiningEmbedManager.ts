
import { createCanvas, loadImage, Image } from 'canvas';
import {AttachmentBuilder, GuildChannel, GuildMember} from 'discord.js';
import fs from'fs';
import request from 'request';
import sharp from 'sharp';
import short from 'short-uuid';
import puppeteer from 'puppeteer';
import { DiscordBot } from '../../DiscordBot';
import { homePath } from '../../dirname';

export default class JoiningEmbedManager{
    discordBot: DiscordBot;
    page: any;
    bannerPath?: string;
    sendBannerChannelId: string;
    title: string;
    text: string;
    sendWelcomeByMemberJoin: boolean;

    constructor(discordBot: DiscordBot){
        this.discordBot = discordBot;
        this.page = null;

        this.bannerPath = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.bannerPath;
        this.sendBannerChannelId = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.sendBannerChannelId;
        this.title = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.title;
        this.text = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.text;
        this.sendWelcomeByMemberJoin = this.discordBot.settings.plugins.JoiningEmbedManager.pluginSettings.sendWelcomeByMemberJoin;


        this.init();
        
        this.discordBot.addEventListener('event-guildMemberAdd',(member: GuildMember)=>{
            if(this.sendWelcomeByMemberJoin){
                this.sendWelcomme(member);
            }
        })
        
        console.log('JoiningBanner Manager Initialisiert.');
    }

    async init(){
        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        this.page = await browser.newPage();
    }

    async sendWelcomme(member: GuildMember){
        
        const channel = await this.discordBot.guild?.channels.fetch(this.sendBannerChannelId);
        if(!(channel instanceof GuildChannel) || !('send' in channel) || typeof channel.send !== 'function') return;
        try{
            
            const joinembed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            joinembed.setTitle(this.title);
            joinembed.setDescription([
                this.text.replace(/{username}/g, this.discordBot.botUtils.getnick(member)).replace(/{userId}/g, member.user.id).replace(/{guildname}/g, member.guild.name),
            ].join('\n'))

            if(this.bannerPath){

                const file = new AttachmentBuilder(this.bannerPath, { name: 'lel.gif' });

                joinembed.setImage(`attachment://lel.gif`);
    
                channel.send({
                    embeds: [joinembed], files: [file]
                });
            }else{
                channel.send({
                    embeds: [joinembed]
                });
            }

        }catch(err){
            console.log(err);
            channel.send({
                content: `Willkommen <@${member.user.id}> auf Backyard!`, 
            })
        }
    }
}