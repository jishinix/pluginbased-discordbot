import { DiscordBot } from "../../DiscordBot";


export default class BanKickManager {
    private discordBot: DiscordBot;


    constructor(discordBot: DiscordBot){
        this.discordBot = discordBot;
    }
}