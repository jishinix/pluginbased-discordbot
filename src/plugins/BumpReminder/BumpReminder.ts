import { GuildBasedChannel, GuildChannel, Message } from "discord.js";
import { DiscordBot } from "../../DiscordBot";
import fs from 'fs';
import { homePath } from "../../dirname.js";



export default class BumpReminder {
    discordBot: DiscordBot;
    bumpBotId: string;
    channel: GuildBasedChannel | null;
    bumpRoleId: string | undefined;
    lastBump: number | null;
    jsonPath: string;
    allowOtherMessages: boolean;
    bumpChannelId : string;


    constructor(discordBot: DiscordBot) {
        this.discordBot = discordBot;
        
        this.bumpBotId = '302050872383242240';
        this.channel = null;
        this.lastBump = null;

        this.jsonPath = this.discordBot.settings.plugins.BumpReminder.pluginSettings.jsonPath;

        this.bumpRoleId = discordBot.settings.plugins.BumpReminder.pluginSettings.bumpRoleId;
        this.allowOtherMessages = discordBot.settings.plugins.BumpReminder.pluginSettings.allowOtherMessages;

        this.bumpChannelId = discordBot.settings.plugins.BumpReminder.pluginSettings.bumpChannelId;

        

        const lastBump = this.getLastBump();
        if(lastBump){
            console.log('lastBump:', new Date(lastBump))
            const dif = (lastBump + (1000 * 60 * 60 * 2)) - new Date().getTime();
            console.log('diff::', dif)
            if(dif > 0){
                this.discordBot.botUtils.scheduleFunctionIn(()=>{this.sendReminder()}, dif)
            }
        }

        this.discordBot.addEventListener('event-ready',async ()=>{
            this.channel = this.discordBot.guild ? await this.discordBot.guild?.channels.fetch(this.bumpChannelId) : null;
        })
        
        this.discordBot.addEventListener('event-messageCreate', async (message: Message)=>{
            if(this.allowOtherMessages == false){
                if(message.channel.id == this.bumpChannelId && message.author.id !== this.bumpBotId && message.author.id !== this.discordBot.instance?.user!.id){
                    message.delete();
                    return;
                }
            }
            if(message.author.id === this.bumpBotId){
                if(message.interaction){
                    if(message.interaction.commandName === 'bump'){

                        this.discordBot.dispatchEvent('bump', [message.interaction.user.id])

                        this.lastBump = new Date().getTime();
                        this.setLastBump();
                        this.discordBot.botUtils.scheduleFunctionIn(()=>{this.sendReminder()}, 1000 * 60 * 60 * 2)

                        if(this.channel && 'send' in this.channel){

                            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none')
                            embed.setTitle('Danke fürs Bumpen <3')
                            embed.setDescription(`Danke für deinen Bump! ^^ Wir erinnern dich in 2h wieder zu bumpen <3 <@${message.interaction.user.id}>`)
                            
                            this.channel.send(
                                {
                                    embeds: [embed]
                                }
                            )
                        }

                    }
                }
            }
        })
    }

    sendReminder(){
        if(this.channel && ('send' in this.channel)){

            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none')
            embed.setTitle('Zeit zum Bumpen <3')
            embed.setDescription('Bump unseren Server indem du /bump eintippst!')
            
            this.channel.send(
                {
                    allowedMentions: { roles: this.bumpRoleId ? ['1300837277676601387'] : [], repliedUser: true },
                    embeds: [embed],
                    content: this.bumpRoleId ? `<@&${this.bumpRoleId}>` : ''
                }
            )
        }
    }

    getLastBump(){
        if(this.lastBump) return this.lastBump;
        this.lastBump = JSON.parse(fs.readFileSync(this.jsonPath).toString()).lastBump;
        return this.lastBump;
    }

    setLastBump(){
        this.lastBump = new Date().getTime();
        fs.writeFileSync(this.jsonPath, JSON.stringify({lastBump: this.lastBump}));
    }


}