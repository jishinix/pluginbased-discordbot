import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";


export default class Achievements extends CommandPlugin {
    discordBot: DiscordBot;
    imagePath: string;

    constructor(discordBot: DiscordBot){
        super(discordBot.settings.plugins.Achievements);
        this.discordBot = discordBot;

        this.imagePath = this.discordBot.settings.plugins.Achievements.pluginSettings.imagePath;

    }
}