import { DiscordBot } from "./DiscordBot.js";


export default class Plugin {
    protected discordBot: DiscordBot;

    constructor(discordBot: DiscordBot) {
        this.discordBot = discordBot;
    }
}