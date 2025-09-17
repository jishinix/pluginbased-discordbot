import { GuildAuditLogsEntry, AuditLogEvent, EmbedBuilder, Guild, GuildChannel, TextChannel, User, GuildMember, VoiceState, Message } from "discord.js";
import { DiscordBot } from "../../DiscordBot";
import short from 'short-uuid';
import fs from 'fs';


export default class Logger{
    discordBot: DiscordBot;
    logChannelId: string;

    constructor(discordBot: DiscordBot){
        this.discordBot = discordBot;

        this.logChannelId = this.discordBot.settings.plugins.Logger.pluginSettings.logChannelId;

        
        this.discordBot.addEventListener('event-messageUpdate',(oldMsg: Message, msg: Message)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.msgUpdate === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.msgUpdate
            ) this.changeMsg(oldMsg, msg);
        })
        this.discordBot.addEventListener('event-messageDelete',(msg: Message)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.msgDelete === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.msgDelete
            ) this.deleteMsg(msg);
        })
        this.discordBot.addEventListener('event-guildMemberAdd',(member: GuildMember)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.memberAdd === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.memberAdd
            ) this.addMember(member);
        })
        this.discordBot.addEventListener('event-guildMemberRemove',(member: GuildMember)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.memberRemove === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.memberRemove
            ) {
                this.removeMember(member)
                this.kick(member);
            }
        })
        this.discordBot.addEventListener('event-guildBanAdd',(ban: any)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.memberBan === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.memberBan
            ) {
                this.ban(ban);
            }
        })
        this.discordBot.addEventListener('event-guildBanRemove',(ban: any)=>{
            if(
                this.discordBot.settings.plugins.Logger.pluginSettings.memberUnban === undefined ||
                this.discordBot.settings.plugins.Logger.pluginSettings.memberUnban
            ) {
                this.unban(ban);
            }
        })
        this.discordBot.addEventListener('event-guildMemberUpdate',(oldMember: GuildMember, newMember: GuildMember)=>{
            if(!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()){

                
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.memberTimeout === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.memberTimeout
                ) {
                    this.timeOuted(oldMember, newMember);
                }
            }
            if(oldMember.nickname !== newMember.nickname){
                
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.changeNick === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.changeNick
                ) {
                    this.rename(oldMember, newMember);
                }
            }
        })
        
        
        this.discordBot.addEventListener('event-voiceStateUpdate',async (oldState: VoiceState, newState: VoiceState)=>{
            const oldChannel = oldState.channel
            const newChannel = newState.channel
        
            if(oldChannel === null && newChannel !== undefined) {
                
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.joinVoice === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.joinVoice
                ) {
                    this.joinVoiceChannel(newState);
                }
        
            } else if(newChannel === null){
                
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.leaveVoice === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.leaveVoice
                ) {
                    this.leaveVoiceChannel(oldState);
                }
        
            }else if(
                oldChannel &&
                newChannel && 
                oldChannel.id !== newChannel.id
            ){

                
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.leaveVoice === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.leaveVoice
                ) {
                    this.leaveVoiceChannel(oldState);
                }
                if(
                    this.discordBot.settings.plugins.Logger.pluginSettings.joinVoice === undefined ||
                    this.discordBot.settings.plugins.Logger.pluginSettings.joinVoice
                ) {
                    this.joinVoiceChannel(newState);
                }
            }
        })

    }

    dAddUser(desc: string[],user: User){desc.push(`**User:** <@${user.id}>`)};
    dAddVon(desc: string[],user: User){desc.push(`**Von:** <@${user.id}>`)};
    dAddChannel(desc: string[],channel: GuildChannel, string: string){desc.push(`**${string}:** ${channel.toString()}`)};
    dAddStringContent(desc: string[],content: string, string: string){desc.push(`**${string}:** ${content}`)};
    dAddDate(desc: string[], now: Date, string?: string){desc.push(`**${string || 'Datum'}:** ${('00' + now.getDate()).slice(-2)}.${('00' + (now.getMonth()+1)).slice(-2)}.${now.getFullYear()} um ${('00' + now.getHours()).slice(-2)}:${('00'+ now.getMinutes()).slice(-2)}`)};
    
    sendMsg(channel: GuildChannel, embed: EmbedBuilder, desc: string[] = [], files: any[] = []){
        if(!('send' in channel) || typeof channel.send !== 'function') return;
        const now = new Date();
        if(desc.length> 0){
            this.dAddDate(desc,now)
        }
        const descStr = desc.join('\n\n');
        if(desc.length < 4000){
            if(descStr !== ''){
                embed.setDescription(descStr);
            }
            if(files) channel.send({embeds: [embed], files: files})
            else channel.send({embeds: [embed]})
        }else{
            const path = __dirname+'/out/temp-' + short.generate() + '.txt';
            fs.writeFileSync(path, descStr);

            channel.send({
                embeds: [embed],
                files: [path]
            }).then(()=>{
                if(!('send' in channel) || typeof channel.send !== 'function') return;
                fs.unlinkSync(path);
                if(files.length) channel.send({files: files})
            })
        }
    }

    private async AuditLogRequestLog(guild: Guild, type: keyof typeof AuditLogEvent): Promise<GuildAuditLogsEntry | false> {
        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent[type] });
        const log = fetchedLogs.entries.first();
        if (!log || new Date().getTime() - log.createdAt.getTime() >= 20000) {
            return false;
        }
        return log;
    }

    private async AuditLogRequest(user: User, guild: Guild, type: keyof typeof AuditLogEvent): Promise<User | false> {
        const log = await this.AuditLogRequestLog(guild, type);
        if (!log) return false;
        const { executor, target } = log;
        if (target instanceof User && target.id === user.id) {
            if (executor instanceof User) return executor;
            else return false;
        }
        return false;
    }

    private millisToMinutesAndSeconds(millis: number): string {
        const minutes = Math.floor(millis / 60000);
        const seconds = ((millis % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds.padStart(2, '0')}`;
    }

    async sendExternalLog(embed: EmbedBuilder, desc: string[]) {
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId) as TextChannel;
        this.sendMsg(channel, embed, desc);
    }

    async rename(oldMember: GuildMember, newMember: GuildMember){
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('edit');

        embed.setTitle('📥 Nick Geändert!');

        const desc: string[] = [];
        this.dAddUser(desc, newMember.user);
        this.dAddStringContent(desc, oldMember.user.username, 'Profilname');
        this.dAddStringContent(desc, oldMember.nickname ? oldMember.nickname : 'Kein Nickname', 'Alter Nick');
        this.dAddStringContent(desc, newMember.nickname ? newMember.nickname : 'Kein Nickname', 'Neuer Nick');

        this.sendMsg(channel, embed, desc);
    }

    async timeOuted(oldMember: GuildMember, newMember: GuildMember){
        const log = await this.AuditLogRequestLog(newMember.guild, 'MemberUpdate')
        if(!log) return false;

        if(!log.changes) return false;

        if(log.changes.length === 0) return false;

        if(!log.changes[0]) return false;
        if(log.changes[0].key !== 'communication_disabled_until') return false;
        if(typeof log.changes[0].new !== 'string') return false;


        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
    
        const ms = new Date(log.changes[0].new).getTime() - new Date().getTime();

        embed.setTitle('Timeout!');

        const desc: string[] = [];
        if(log.executor instanceof User) this.dAddVon(desc, log.executor);
        this.dAddUser(desc, newMember.user);
        this.dAddStringContent(desc, this.millisToMinutesAndSeconds(ms) +' Minuten', 'Minuten im Timeout')
        this.dAddDate(desc, new Date(new Date().getTime() + ms), 'Timeout bis')
        if(log.executor && log.executor.id === this.discordBot.instance?.user?.id){
            this.dAddStringContent(desc, 'Spam', 'Grund')
        }

        this.sendMsg(channel, embed, desc);
    }

    async unban(ban: any){
        const auditRtn = await this.AuditLogRequest(ban.user, ban.guild, 'MemberBanRemove');
        if(auditRtn){
            const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
            if(!(channel instanceof GuildChannel)) return;
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');
        

            embed.setTitle('Unban!');

            const desc: string[] = [];
            this.dAddVon(desc,auditRtn);
            this.dAddUser(desc,ban.user);

            this.sendMsg(channel, embed, desc);
        }
    }
    async ban(ban: any){
        const auditRtn = await this.AuditLogRequest(ban.user, ban.guild, 'MemberBanAdd');
        if(auditRtn){
            const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
            if(!(channel instanceof GuildChannel)) return;
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
        

            embed.setTitle('Gebannt!');

            const desc: string[] = [];
            this.dAddVon(desc,auditRtn);
            this.dAddUser(desc,ban.user);

            this.sendMsg(channel, embed, desc);
        }
    }
    async kick(member: GuildMember){
        const auditRtn = await this.AuditLogRequest(member.user, member.guild, 'MemberKick');
        if(auditRtn){
            const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
            if(!(channel instanceof GuildChannel)) return;
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
        
            const avatar = this.discordBot.botUtils.getAvatar(member);

            embed.setTitle('Gekickt!');
            embed.setAuthor({ name: this.discordBot.botUtils.getnick(member), iconURL: avatar })

            const desc: string[] = [];
            this.dAddVon(desc,auditRtn);
            this.dAddUser(desc,member.user);

            this.sendMsg(channel, embed, desc);
        }
    }

    async leaveVoiceChannel(state: VoiceState){
        if(!state.member) return
        if(!state.channel) return
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
    
        const avatar = this.discordBot.botUtils.getAvatar(state.member);

        embed.setTitle('Channel Verlassen!');
        embed.setAuthor({ name: this.discordBot.botUtils.getnick(state.member), iconURL: avatar })

        const desc: string[] = [];
        this.dAddUser(desc,state.member.user);
        this.dAddChannel(desc, state.channel, 'Verlassen')

        this.sendMsg(channel, embed, desc);
    }
    async joinVoiceChannel(state: VoiceState){
        if(!state.member) return
        if(!state.channel) return
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');
        
        const avatar = this.discordBot.botUtils.getAvatar(state.member);

        embed.setTitle('Channel Beigetreten!');
        embed.setAuthor({ name: this.discordBot.botUtils.getnick(state.member), iconURL: avatar })

        const desc: string[] = [];
        this.dAddUser(desc,state.member.user);
        this.dAddChannel(desc, state.channel, 'Beigetreten in')

        this.sendMsg(channel, embed, desc);
    }
    
    async removeMember(member: GuildMember){
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');

        const avatar = this.discordBot.botUtils.getAvatar(member);

        embed.setTitle('User Verlassen!');
        embed.setAuthor({ name: this.discordBot.botUtils.getnick(member), iconURL: avatar })
        embed.setThumbnail(avatar)

        const desc: string[] = [];
        this.dAddUser(desc,member.user);

        this.sendMsg(channel, embed, desc);
    }
    async addMember(member: GuildMember){
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');

        const avatar = this.discordBot.botUtils.getAvatar(member);
        
        embed.setTitle('User Beigetreten!');
        embed.setAuthor({ name: this.discordBot.botUtils.getnick(member), iconURL: avatar })
        embed.setThumbnail(avatar)
        
        const desc: string[] = [];
        this.dAddUser(desc,member.user);

        this.sendMsg(channel, embed, desc);
    }
    
    async changeMsg(oldMsg: Message, msg: Message){
        if(!msg.member) return
        if(!(msg.channel instanceof GuildChannel)) return
        if(msg.author.id === this.discordBot.instance?.user?.id) return;
        if(msg.content === '' || oldMsg.content === '') return;
        if(msg.author.id === '368521195940741122') return; // leviet bot;
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('edit');

        const avatar = this.discordBot.botUtils.getAvatar(msg.member, msg.author);

        if(oldMsg.attachments.size !== msg.attachments.size){
            embed.setTitle('Bild Entfernt!');
            embed.setAuthor({ name: this.discordBot.botUtils.getnick(msg.member), iconURL: avatar })
            
            const desc: string[] = [];
            this.dAddUser(desc,msg.author);
            this.dAddChannel(desc, msg.channel, 'Channel')
            this.dAddStringContent(desc, msg.url, 'Link')
            this.dAddStringContent(desc, `im anhang`, 'gelöschter Anhng')

            let deleted: any[] = [];
            oldMsg.attachments.forEach((value, key)=>{
                if(msg.attachments.get(key) === undefined){
                    deleted.push({attachment: value.url, name: value.name});
                }
            })
    
            if(deleted.length !== 0){
                this.sendMsg(channel, embed, desc, deleted);
            }
        }else if(oldMsg.content !== msg.content){
            embed.setTitle('Nachricht geändert!');
            embed.setAuthor({ name: this.discordBot.botUtils.getnick(msg.member), iconURL: avatar })
            
            const desc: string[] = [];
            this.dAddUser(desc,msg.author);
            this.dAddChannel(desc, msg.channel, 'Channel')
            this.dAddStringContent(desc, msg.url, 'Link')
            this.dAddStringContent(desc, `\n${oldMsg.content}`, 'Alte Nachricht')
            this.dAddStringContent(desc, `\n${msg.content}`, 'Neue Nachricht')
    
            this.sendMsg(channel, embed, desc);
        }
    }
    async deleteMsg(msg: Message){
        if(!msg.member) return
        if(!(msg.channel instanceof GuildChannel)) return
        if(msg.author.id === this.discordBot.instance?.user?.id) return;
        if(msg.author?.id === '368521195940741122') return; // leviet bot;
        const channel = await this.discordBot.instance?.channels.fetch(this.logChannelId);
        if(!(channel instanceof GuildChannel)) return;
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');

        const avatar = this.discordBot.botUtils.getAvatar(msg.member, msg.author);

        embed.setTitle('Nachricht Gelöscht!');
        embed.setAuthor({ name: this.discordBot.botUtils.getnick(msg.member, msg.author), iconURL: avatar })
        
        const desc: string[] = [];
        this.dAddUser(desc,msg.author);
        this.dAddChannel(desc, msg.channel, 'Channel')
        this.dAddStringContent(desc, `\n${msg.content}`, 'Inhalt der Nachricht')

        const files: any[] = [];
        if(msg.attachments.size !== 0){
            msg.attachments.forEach((value, key)=>{
                files.push({attachment: value.url, name: value.name})
            })
        }
        
        this.sendMsg(channel, embed, desc, files);
    }
}