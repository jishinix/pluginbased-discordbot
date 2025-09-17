import { MessageFlags, ChatInputCommandInteraction, CommandInteraction, CommandInteractionOptionResolver, ImageFormat, Interaction, InviteGuild, SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandSubcommandBuilder } from "discord.js";
import { DiscordBot } from "../../DiscordBot.js";
import { CommandPlugin } from "../../CommandPlugin.js";


export default class Wiki extends CommandPlugin{
    discordBot: DiscordBot;
    
    constructor(discordBot: DiscordBot){
        super(discordBot.settings.plugins.Wiki);
        this.discordBot = discordBot;

        const commands: {name: string, display: string, description: string, desc?: string | string[], options?: {[key: string]:{name: string, desc: string | string[]}}, subcommands?: {[key: string]: {name: string, display: string, description: string, desc?: string | string[], options?: {[key: string]:{name: string, desc: string | string[]}}}}}[] = Object.values(this.discordBot.settings.plugins.Wiki.pluginSettings.commands);

        for(let i = 0; i < commands.length; i++){
            const command = commands[i];
            const commandBBuilder = new SlashCommandBuilder();
            commandBBuilder.setName(command.name.toLowerCase());
            commandBBuilder.setDescription(command.description)

            if(command.subcommands){
                const subCommandValues: {name: string, display: string, description: string, desc?: string | string[], options?: {[key: string]:{name: string, desc: string | string[]}}}[] = Object.values(command.subcommands);
                
                commandBBuilder.addSubcommand(subcommand => {
                    subcommand.setName('alles');
                    subcommand.setDescription('Alles darüber ausgeben.')

                    return subcommand;
                })

                for(let j = 0; j < subCommandValues.length; j++){
                    commandBBuilder.addSubcommand(subcommand => {
                        subcommand.setName(subCommandValues[j].name);
                        subcommand.setDescription(subCommandValues[j].description)
                        this.addOptionsToParent(subCommandValues[j].options, subcommand)

                        return subcommand;
                    })
                }
            }else if(command.options){
                this.addOptionsToParent(command.options, commandBBuilder)
            }

            this.addCommand({
                data: commandBBuilder,
                execute: async (discordBot: DiscordBot, interaction: ChatInputCommandInteraction)=>{
                    const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)
                    
                    let desc: string[] = [];

                    if(command.subcommands){
                        const subcommand = interaction.options.getSubcommand();
                        if(subcommand && command.subcommands[subcommand]){
                            const subcommandObject = command.subcommands[subcommand];
                            if(subcommandObject.options){
                                desc = this.addOptionsToDescriptionArray(desc, subcommandObject.options, `${command.display} - ${subcommandObject.display}`, interaction);
                            }else if(subcommandObject.desc){
                                desc.push(`# ${command.display} - ${subcommandObject.display}`);
                                
                                if(Array.isArray(subcommandObject.desc)){
                                    desc = new Array(...desc, ...subcommandObject.desc)
                                }else{
                                    desc.push(subcommandObject.desc)
                                }
                            }
                        }else if(subcommand === 'alles'){
                            const subCommandsValues = Object.values(command.subcommands);
                                desc.push(`# ${command.display}`);
                            for(let j = 0; j < subCommandsValues.length; j++){

                                const subcommandObject = subCommandsValues[j];
                                if(subcommandObject.options){
                                    desc = this.addOptionsToDescriptionArray(desc, subcommandObject.options, `${subcommandObject.display}`, interaction);
                                }else if(subcommandObject.desc){
                                    desc.push(`## ${subcommandObject.display}`);
                                    
                                    if(Array.isArray(subcommandObject.desc)){
                                        desc = new Array(...desc, ...subcommandObject.desc)
                                    }else{
                                        desc.push(subcommandObject.desc)
                                    }
                                }
                            }
                        }
                    }

                    if(command.options){
                        desc = this.addOptionsToDescriptionArray(desc, command.options, command.display, interaction);
                    }else if(command.desc){
                        desc.push(`# ${command.display}`);
                        if(Array.isArray(command.desc)){
                            desc = new Array(...desc, ...command.desc)
                        }else{
                            desc.push(command.desc)
                        }
                    }


                    let tileDesc = ``;
                    
                    await interaction.reply({content: 'kommt', flags: MessageFlags.Ephemeral});
                    for(let j = 0; j < desc.length; j++){
                        if((tileDesc + desc[j]).length < 1990){
                            tileDesc += desc[j] + '\n';
                        }else{
                            if(tileDesc.length > 0){
                                if(interaction.channel && 'send' in interaction.channel){
                                    if(tileDesc.trim().endsWith('>')) tileDesc = tileDesc.trim() + ' \u200B'
                                    await interaction.channel.send(tileDesc);
                                }
                            }
                            tileDesc = desc[j] + '\n';
                        }
                    }
                    if(tileDesc.length > 0){
                        if(interaction.channel && 'send' in interaction.channel){
                            await interaction.channel.send(tileDesc);
                        }
                    }
                }
            })
        }
    }

    addOptionsToDescriptionArray(desc: string[], options: {[key: string]:{name: string, desc: string | string[]}}, header: string, interaction: ChatInputCommandInteraction){
        if(!options) return desc;
        const theme = interaction.options.getString('theme');
        if(theme && options[theme]){
            const option = options[theme];
            desc.push(`# ${header} - ${option.name}`);
            
            if(Array.isArray(option.desc)){
                desc = new Array(...desc, ...option.desc)
            }else{
                desc.push(option.desc)
            }
        }else{
            const optionValus: {name: string, desc: string | string[]}[] = Object.values(options);
            desc.push(`# ${header}`);
            
            for(let i = 0; i < optionValus.length; i++){
                const option = optionValus[i];
                desc.push(`## ${option.name}`);
                if(Array.isArray(option.desc)){
                    desc = new Array(...desc, ...option.desc)
                }else{
                    desc.push(option.desc)
                }
            }
        }

        return desc;
    }
    
    addOptionsToParent(options: {[key: string]:{name: string, desc: string | string[]}} | undefined,parent: SlashCommandBuilder | SlashCommandSubcommandBuilder){
        if(!options) return;
        const choices: {name: string, value: string}[] = []; 

        const optionsValues = Object.values(options);
        
        for(let i = 0; i < optionsValues.length; i++){
            const option = optionsValues[i];
            choices.push({
                name: option.name,
                value: option.name
            })
        }

        if(choices.length){
            parent.addStringOption(option =>
                option.setName('theme')
                    .setDescription('welches unterthema?')
                    .setRequired(false)
                    .addChoices(choices)
            )
        }
    }
}