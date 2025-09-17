import { ColorResolvable, EmbedBuilder } from 'discord.js';
import { DiscordBot } from './DiscordBot';

export class DefaultEmbeds{
    discordBot: DiscordBot;

    constructor(discordBot: DiscordBot){
        this.discordBot = discordBot;
    }
    
    getAbgelaufenEmbed(){
        const embed = this.getDefaultEmbed("error");
            embed.setTitle('Abgelaufen');
            embed.setDescription('dieser Inhalt ist leider Abgelaufen und kann nicht mehr verwendet werden.')

        return embed;
    }

    getErrorEmbed(){
        const embed = this.getDefaultEmbed("error");
            embed.setTitle('ERROR');
            embed.setDescription('Bitte entschuldige. Es scheint ein fehler aufgetreten zu sein.')

        return embed;
    }

    getNoAccessEmbed(){
        const embed = this.getDefaultEmbed("error");
            embed.setTitle('Kein Zugriff');
            embed.setDescription('Bitte entschuldige. Das du keinen Zugriff auf diese Funktion hast.');

        return embed;
    }

    getEmbedNichtAusfuehren(){
        const embed = this.getDefaultEmbed("none");
            embed.setTitle('Du Kannst das Hier nicht asuführen!');
            embed.setDescription(`Diese Aktion kannst du nur im botchannel ausführen`);

        return embed;
    }

    getWaitEmbed(){
        const embed = this.getDefaultEmbed("info");
            embed.setTitle('Bitte warten');
            embed.setDescription('Die Anwendung braucht etwas bitte lehne dich zurück und warte ein- zwei Sekunden.');

        return embed;
    }

    getDefaultEmbed(style: string | null = null, footerLines: string[] = []){
        let color: string = this.discordBot.settings.embed.colorDefault;
        switch(style){
            case "error":
                color = this.discordBot.settings.embed.colorError
                break;
            case "edit":
                color = this.discordBot.settings.embed.colorEdit
                break;
            case "ready":
                color = this.discordBot.settings.embed.colorReady
                break;
            case "info":
                color = this.discordBot.settings.embed.colorInfo
                break;
        }
        const embed = new EmbedBuilder()
            .setColor(parseInt(color, 16))
            .setFooter({ text: footerLines.join('\n') + '\n' + this.discordBot.settings.embed.labelFooter});

        return embed;
    }
}