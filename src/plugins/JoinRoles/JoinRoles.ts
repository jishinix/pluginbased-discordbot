import { ButtonBuilder, ButtonStyle, ModalBuilder, ActionRowBuilder, TextInputStyle, TextInputBuilder, GuildMember, Role, ButtonInteraction, ModalSubmitInteraction, Message } from 'discord.js';
import { DiscordBot } from '../../DiscordBot';


export default class JoinRoles{
    discordBot: DiscordBot;
    roles: string[];

    constructor(discordBot: DiscordBot){
        this.discordBot = discordBot;

        this.roles = this.discordBot.settings.plugins.JoinRoles.pluginSettings.roles;

        this.initEvents();
    }
    initEvents(){
        this.discordBot.addEventListener('event-guildMemberAdd',async (member: GuildMember)=>{
            for(let i = 0; i < this.roles.length; i++){
                const role = await this.discordBot.guild?.roles.fetch(this.roles[i]);
                if(role instanceof Role) member.roles.add(role).catch(()=>{}); 
            }
        })
    }
}