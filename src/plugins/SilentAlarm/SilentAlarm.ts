import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message } from "discord.js";
import { DiscordBot } from "../../DiscordBot.js";


export default class SilentAlarm{
    discordBot: DiscordBot;
    badWordsRegex: RegExp;
    sendAlarmChannelId: string
    

    constructor (discordBot: DiscordBot){
        this.discordBot = discordBot;
        this.sendAlarmChannelId = discordBot.settings.plugins.SilentAlarm.pluginSettings.sendAlarmChannelId
        
        const badWordStems = [
            "fick", "fuck", "scheiß", "shit", "hurensohn", "wichs", "nutte", "arschloch", "spasti", 
            "missgeburt", "penner", "hure", "drecksack", "depp", "versager", "dummkopf", "hinterwäldler",
            "schlampe", "fotze", "pimmel", "schwanz", "pussy", "titten", "brüste", "busen", "nippel", 
            "vagina", "penis", "anal", "sex", "porno", "masturb", "orgasm", "cum", "squirt", "ejakulat", 
            "blowjob", "bj", "hooker", "nudes", "sexy", "schmusen",
            "nigger", "neger", "kanake", "mongo", "spast", "zigeuner", "behindert", "schwuchtel", 
            "transe", "judenfresse", "chink", "polack", "türkenpack"
        ];
        
        const suffixes = ["en", "t", "st", "e", "er", "ing", "te", "end", "ed", "es", "est", "ten", "em"];
        
        // Funktion zum Erstellen einer Regex aus der Wortliste
        function createBadWordsRegex(words: string[], suffixes: string[]) {
            const pattern = words.map(word => {
                let basePattern = word
                    .split("").join("[\\W_]*") // Erlaubt Sonderzeichen zwischen Buchstaben
                    .replace(/a/g, "[aàáâãäåæ]") 
                    .replace(/e/g, "[eèéêë]") 
                    .replace(/i/g, "[iìíîï]") 
                    .replace(/o/g, "[oòóôõöø]") 
                    .replace(/u/g, "[uùúûü]");
        
                // Erlaubt das Wort mit beliebigen Endungen ODER als Teil eines anderen Wortes
                return `([\\w]*)?${basePattern}([\\W_]*(${suffixes.join("|")}))?([\\w]*)?`;
            }).join("|");
        
            return new RegExp(pattern, "i"); // Keine \b-Grenzen mehr -> findet auch Teilwörter!
        }
        
        this.badWordsRegex = createBadWordsRegex(badWordStems, suffixes);


        this.discordBot.botUtils.generateInteractionCb('buttons', 'checked', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: {[key: string]: string})=>{
            interaction.message.delete();
        })
        
        this.discordBot.addEventListener('event-messageCreate', async (message: Message)=>{
            console.log('msg');
            if(this.containsBadWords(message.content)){
                const channel = await this.discordBot.guild?.channels.fetch(this.sendAlarmChannelId);
                if(channel && 'send' in channel){
                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle('badword detected')
                    const member = await discordBot.botUtils.fetchMember(message.author.id);
                    embed.setDescription(`von: ${member ? this.discordBot.botUtils.getnick(member) : ''} (<@${message.author.id}>)\nurl: ${message.url}`);
                    
                                        
                    let button = new ActionRowBuilder<ButtonBuilder>();
                    button.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`checked`)
                            .setStyle(ButtonStyle.Success)
                            .setLabel(`Geprüft!`)
                    );

                    channel.send({embeds: [embed], components: [button]})
                }
            }
        })
        
    }

    containsBadWords(message: string) {
        return this.badWordsRegex.test(message);
    }
}