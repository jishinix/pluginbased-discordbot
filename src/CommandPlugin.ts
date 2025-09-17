import { CommandDataObject, PlugginSetting } from "./DiscordBot.js"

export class CommandPlugin{
    commands: CommandDataObject[];
    #pluginSettings: PlugginSetting;

    constructor(pluginSettings: PlugginSetting){
        this.#pluginSettings = pluginSettings;
        this.commands = [];
    }

    addCommand(commandDataObject: CommandDataObject){
        if(this.#pluginSettings.deactivateCommand && this.#pluginSettings.deactivateCommand.includes(commandDataObject.data.name)) {
            return;
        }
        this.commands.push(commandDataObject)
    }
}