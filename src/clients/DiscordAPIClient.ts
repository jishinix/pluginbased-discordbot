import { ActivityType, REST, Routes, SlashCommandBuilder } from "discord.js";
import { CommandDataObject, DiscordBot } from '../DiscordBot.js'



export default class DiscordAPIClient {
    constructor(){

    }

    static async registerInstanceAttributes(discordBot: DiscordBot) {
        if (!discordBot.instance?.user) return;

        discordBot.instance.user.setActivity({
            name: discordBot.settings.labelActivity,
            type: ActivityType.Playing
        });

        const rest = new REST().setToken(discordBot.token);
        const commands: SlashCommandBuilder[] = [];

        console.log(discordBot.commands);
        discordBot.commands.forEach((cmd: CommandDataObject) => {
            commands.push(cmd.data);
        });

        try {
            await rest.put(Routes.applicationCommands(discordBot.instance.user.id), { body: commands }).catch(err => console.error(err));
        } catch (err) {
            console.error(err);
        }
        discordBot.dispatchEvent(`event-ready`, new Array(this))
    }
}