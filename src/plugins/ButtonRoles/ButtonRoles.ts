import fs from 'fs';
import { DiscordBot } from '../../DiscordBot.js';
import { GuildChannel, Message, MessageReaction, User } from 'discord.js';
import Plugin from '../../Plugin.js';

interface ConfigStructure {
    type: "multible" | "clearly";
    title: string;
    description: string[];
    options: {
        icon: string;
        roles: string[];
    }[];
    msgIds?: string[];
}

export default class ButtonRoles extends Plugin {
    config: { [key: string]: ConfigStructure };

    constructor(discordBot: DiscordBot) {
        super(discordBot);

        this.config = JSON.parse(fs.readFileSync(this.discordBot.settings.plugins.ButtonRoles.pluginSettings.configPath).toString());



        this.discordBot.addEventListener('event-messageReactionRemove', async (reaction: MessageReaction, user: User) => {
            if (user.bot) return;
            const questIds = Object.keys(this.config)
            for (let i = 0; i < questIds.length; i++) {
                const cQ = this.config[questIds[i]];
                if (cQ.msgIds) {
                    if (cQ.msgIds.includes(reaction.message.id)) {
                        switch (cQ.type) {
                            case "clearly":
                                await (async () => {
                                    let found = false;
                                    for (let optionIndex = 0; optionIndex < cQ.options.length; optionIndex++) {
                                        let foundInThisOption = false;
                                        if ((cQ.options[optionIndex].icon.startsWith('<') && reaction.emoji.name === cQ.options[optionIndex].icon.split(':')[1]) || reaction.emoji.name === cQ.options[optionIndex].icon) {
                                            found = true;
                                            foundInThisOption = true;
                                            for (let roleIndex = 0; roleIndex < cQ.options[optionIndex].roles.length; roleIndex++) {
                                                const cRole = await this.discordBot.guild?.roles.fetch(cQ.options[optionIndex].roles[roleIndex]);
                                                const member = await this.discordBot.botUtils.fetchMember(user.id);
                                                if (member && cRole) try { await member.roles.remove(cRole) } catch (e) { console.log(e) }
                                            }
                                        }
                                    }
                                })()
                                break;
                            case "multible":
                                await (async () => {
                                    let found = false;
                                    for (let optionIndex = 0; optionIndex < cQ.options.length; optionIndex++) {
                                        let foundInThisOption = false;
                                        if ((cQ.options[optionIndex].icon.startsWith('<') && reaction.emoji.name === cQ.options[optionIndex].icon.split(':')[1]) || reaction.emoji.name === cQ.options[optionIndex].icon) {
                                            found = true;
                                            foundInThisOption = true;
                                            for (let roleIndex = 0; roleIndex < cQ.options[optionIndex].roles.length; roleIndex++) {
                                                const cRole = await this.discordBot.guild?.roles.fetch(cQ.options[optionIndex].roles[roleIndex]);
                                                const member = await this.discordBot.botUtils.fetchMember(user.id);
                                                if (member && cRole) try { await member.roles.remove(cRole) } catch (e) { console.log(e) }
                                            }
                                        }
                                    }
                                })()
                                break;
                        }
                        break;
                    }
                }
            }

        })


        this.discordBot.addEventListener('event-messageReactionAdd', async (reaction: MessageReaction, user: User) => {
            if (user.bot) return;
            const questIds = Object.keys(this.config)
            for (let i = 0; i < questIds.length; i++) {
                const cQ = this.config[questIds[i]];
                if (cQ.msgIds) {
                    if (cQ.msgIds.includes(reaction.message.id)) {
                        switch (cQ.type) {
                            case "clearly":
                                await (async () => {
                                    let found = false;
                                    for (let optionIndex = 0; optionIndex < cQ.options.length; optionIndex++) {
                                        let foundInThisOption = false;
                                        if ((cQ.options[optionIndex].icon.startsWith('<') && reaction.emoji.name === cQ.options[optionIndex].icon.split(':')[1]) || reaction.emoji.name === cQ.options[optionIndex].icon) {
                                            found = true;
                                            foundInThisOption = true;
                                            for (let roleIndex = 0; roleIndex < cQ.options[optionIndex].roles.length; roleIndex++) {
                                                const cRole = await this.discordBot.guild?.roles.fetch(cQ.options[optionIndex].roles[roleIndex]);
                                                const member = await this.discordBot.botUtils.fetchMember(user.id);
                                                if (member && cRole) try { await member.roles.add(cRole) } catch (e) { console.log(e) }
                                            }
                                        }
                                        if (foundInThisOption) {
                                            const reactions = reaction.message.reactions.cache;
                                            if (reactions.size > 0) {
                                                reactions.forEach(async rct => {
                                                    if (rct.emoji.name !== reaction.emoji.name) {
                                                        rct.users.remove(user.id);
                                                    }
                                                });
                                            }
                                        } else {
                                            for (let roleIndex = 0; roleIndex < cQ.options[optionIndex].roles.length; roleIndex++) {
                                                const cRole = await this.discordBot.guild?.roles.fetch(cQ.options[optionIndex].roles[roleIndex]);
                                                const member = await this.discordBot.botUtils.fetchMember(user.id);
                                                if (member && cRole) try { await member.roles.remove(cRole) } catch (e) { }
                                            }
                                        }
                                    }
                                    if (!found) {
                                        reaction.users.remove(user.id)
                                    }
                                })()
                                break;
                            case "multible":
                                await (async () => {
                                    let found = false;
                                    for (let optionIndex = 0; optionIndex < cQ.options.length; optionIndex++) {
                                        let foundInThisOption = false;
                                        if ((cQ.options[optionIndex].icon.startsWith('<') && reaction.emoji.name === cQ.options[optionIndex].icon.split(':')[1]) || reaction.emoji.name === cQ.options[optionIndex].icon) {
                                            found = true;
                                            foundInThisOption = true;
                                            for (let roleIndex = 0; roleIndex < cQ.options[optionIndex].roles.length; roleIndex++) {
                                                const cRole = await this.discordBot.guild?.roles.fetch(cQ.options[optionIndex].roles[roleIndex]);
                                                const member = await this.discordBot.botUtils.fetchMember(user.id);
                                                if (member && cRole) try { await member.roles.add(cRole) } catch (e) { console.log(e) }
                                            }
                                        }
                                    }
                                    if (!found) {
                                        reaction.users.remove(user.id)
                                    }
                                })()
                                break;
                        }
                        break;
                    }
                }
            }

        })

        this.discordBot.addEventListener('event-messageCreate', async (message: Message) => {
            if (message.content.startsWith("!reactionRole")) {
                if (message.channel instanceof GuildChannel) await this.createReactionMessgage(message.channel, message.content.split(' ')[1]);
                message.delete();
            }
        })

    }

    async createReactionMessgage(channel: GuildChannel, questionId: string) {
        if (!('send' in channel) || typeof channel.send != 'function') return
        const cQ = this.config[questionId];
        if (cQ) {
            if (!cQ.msgIds) {
                cQ.msgIds = [];
            }

            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            embed.setTitle(cQ.title);
            embed.setDescription(cQ.description.join('\n'));

            const message = await channel.send({
                embeds: [embed]
            });

            cQ.msgIds.push(message.id);
            this.safeConfig();

            for (let i = 0; i < cQ.options.length; i++) {
                console.log(cQ.options[i]);
                message.react(cQ.options[i].icon);
            }

        }
    }

    safeConfig() {
        fs.writeFileSync(this.discordBot.settings.plugins.ButtonRoles.pluginSettings.configPath, JSON.stringify(this.config, null, 2));
    }

    draw() {

    }
}