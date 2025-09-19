import { CommandDataObject, DiscordBot, PlugginSetting } from "./DiscordBot.js"
import Plugin from "./Plugin.js";

export class CommandPlugin extends Plugin {
    commands: CommandDataObject[];
    #pluginSettings: PlugginSetting;

    constructor(discordBot: DiscordBot, pluginSettings: PlugginSetting) {
        super(discordBot);

        this.#pluginSettings = pluginSettings;
        this.commands = [];
    }

    addCommand(commandDataObject: CommandDataObject) {
        if (this.#pluginSettings.deactivateCommand && this.#pluginSettings.deactivateCommand.includes(commandDataObject.data.name)) {
            return;
        }
        this.commands.push(commandDataObject)
    }
}