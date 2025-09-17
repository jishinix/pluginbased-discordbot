import { AttachmentBuilder, BaseInteraction, Collection, CommandInteraction, EmbedBuilder, FetchMessagesOptions, GuildMember, Interaction, Message, MessageFlags, MessagePayload, SlashCommandBuilder, SlashCommandStringOption, Sticker, TextChannel, WebhookMessageCreateOptions } from "discord.js";
import { CommandDataObject, DiscordBot } from "../../DiscordBot.js";
import { CommandPlugin } from "../../CommandPlugin.js";


export default class Utils extends CommandPlugin {
    discordBot: DiscordBot;
    embeds: { [key: string]: EmbedBuilder };

    constructor(discordBot: DiscordBot) {
        super(discordBot.settings.plugins.Utils);
        this.discordBot = discordBot;

        this.embeds = {
            get bulkDelNotExist() {
                return discordBot.defaultEmbeds.getDefaultEmbed('error')
                    .setTitle('bulkDelete not Exist')
                    .setDescription('In diesem Channel ist es nicht möglich nachrichten zu löschen')
            },
            get fetchMsgNotPossible() {
                return discordBot.defaultEmbeds.getDefaultEmbed('error')
                    .setTitle('Fetchen der Nachrichten umöglich')
                    .setDescription('Es ist nicht Möglich nachrichten zum löschen zu Laden')
            },
        }

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Letzten Nachrichten Löschen.')
                .addStringOption(option =>
                    option.setName('number_of_messages')
                        .setDescription('Number of messages to delete.')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('last messages of user.')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('userid')
                        .setDescription('last messages of userId.')
                        .setRequired(false)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.clear(interaction)
            },
        });

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('clearto')
                .setDescription('Nachrichten bis zu gewisser Nachrichten id Löschen')
                .addStringOption(option =>
                    option
                        .setName('messageid')
                        .setDescription('messageid bis zu der gelöscht wird (maximal 2000)')
                        .setRequired(true)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.clearTo(interaction)
            },
        });

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('transcript-max')
                .setDescription('erstelle ein Transkript der letzten x Nachrichten')
                .addStringOption(option =>
                    option.setName('nachrichtenanzahl')
                        .setDescription('Nachrichtenanzahl')
                        .setRequired(true)),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)
                options.nachrichtenanzahl = Number(options.nachrichtenanzahl);

                if (!(await discordBot.botUtils.isMod(interaction.user.id))) {
                    const embed = this.discordBot.defaultEmbeds.getNoAccessEmbed();
                    interaction.reply({ embeds: [embed], ephemeral: true })
                    return;
                }

                if (isNaN(options.nachrichtenanzahl)) {
                    const embed = discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle('Nachrichtenanzahl invalide')
                    embed.setDescription('Deine Nachrichtenanzahl ist keine valide Zahl')
                    interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    })
                    return;
                }

                await discordBot.botUtils.createTranscript(interaction, {
                    maxMsgs: options.nachrichtenanzahl,
                    sendInInteraction: true,
                    ephemeral: true
                })
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('transcript-span')
                .setDescription('erstelle ein Transkript von Nachricht x bis Nachricht y')
                .addStringOption(option =>
                    option.setName('startnachrichtid')
                        .setDescription('Die ID der NEUSTE nachricht die mit Transkripiert werden soll.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('endnachrichtid')
                        .setDescription('Die ID der ÄLTESTE nachricht die mit Transkripiert werden soll.')
                        .setRequired(true)),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)
                options.startnachrichtid = options.startnachrichtid;
                options.endnachrichtid = options.endnachrichtid;

                if (!(await discordBot.botUtils.isMod(interaction.user.id))) {
                    const embed = this.discordBot.defaultEmbeds.getNoAccessEmbed();
                    interaction.reply({ embeds: [embed], ephemeral: true })
                    return;
                }

                await discordBot.botUtils.createTranscript(interaction, {
                    sendInInteraction: true,
                    ephemeral: true,
                    startMsgId: options.startnachrichtid,
                    endMsgId: options.endnachrichtid
                })
            },
        });

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('role-multiple')
                .setDescription('multi')
                .addStringOption(option =>
                    option.setName('give_or_remove')
                        .setDescription('give or remove')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Give', value: 'give' },
                            { name: 'Remove', value: 'remove' },
                        ))
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to give / remove')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('pick_type')
                        .setDescription('Pick a type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Bots', value: 'bots' },
                            { name: 'Humans', value: 'humans' },
                            { name: 'All With Role', value: 'role' },
                        )
                )
                .addRoleOption(option =>
                    option
                        .setName('required_role')
                        .setDescription('Give / Remove multiple users from a role')
                        .setRequired(false)
                ),
            execute: (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.roleMultiple(interaction)
            },
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('transfer-messagespan')
                .setDescription('überträgt alle nachrichten zwichen zwei nachrichten aus dem aktuellen channel in einen Anderen.')
                .addChannelOption(option =>
                    option
                        .setName('targetchannel')
                        .setDescription('target channel')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('latestmessages')
                        .setDescription('die älteste message die übertragen werden soll')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('newestmessages')
                        .setDescription('die neuste message die übertragen werden soll')
                        .setRequired(true)
                )
            ,
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                if (!(await this.discordBot.botUtils.isMod(interaction.user.id))) {
                    interaction.reply({ content: "no mod permissions", flags: [MessageFlags.Ephemeral] });
                    return
                }
                if (interaction.channel === null) {
                    interaction.reply({ content: "not posible", flags: [MessageFlags.Ephemeral] });
                    return;
                }

                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);
                let latestMessage = null;
                let newestMessage = null;

                try {
                    latestMessage = await interaction.channel.messages.fetch(options.latestmessages)
                    newestMessage = await interaction.channel.messages.fetch(options.newestmessages)
                } catch (e) { };

                if (!latestMessage || !newestMessage) {
                    interaction.reply({ content: "newest or latest messages not exist in this channel", flags: [MessageFlags.Ephemeral] });
                    return;
                }

                if (latestMessage.createdTimestamp > newestMessage.createdTimestamp && latestMessage.id !== newestMessage.id) {
                    interaction.reply({ content: "newest Message ist older than the latest msg", flags: [MessageFlags.Ephemeral] });
                    return;
                }

                const targetchannel = await this.discordBot.guild?.channels.fetch(options.targetchannel);
                console.log(options.targetchannel, targetchannel);

                if (targetchannel === null || !targetchannel!.isTextBased()) {
                    interaction.reply({ content: "Channel does not exist on this server or is not text based.", flags: [MessageFlags.Ephemeral] });
                    return;
                }

                const returnEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('edit');
                returnEmbed.setTitle('Nachrichten Transferieren');
                returnEmbed.setDescription('Scanne Nachrichten...');

                const interactionMessage = await interaction.reply({ embeds: [returnEmbed], flags: [MessageFlags.Ephemeral] });


                let messages: Message[] = [];
                messages.push(newestMessage);
                let lastMessageId = newestMessage.id;
                console.log(lastMessageId);

                while (messages.length < 300 && latestMessage.id !== newestMessage.id) {
                    const fetchMessagesOptions: FetchMessagesOptions = {
                        limit: 100,
                        before: lastMessageId
                    }
                    const fetchedMessages = await interaction.channel.messages.fetch(fetchMessagesOptions);
                    //console.log(fetchedMessages);

                    if (fetchedMessages.size === 0) break;
                    let fetchedMessagesArray = Array.from(fetchedMessages.values())
                    let br = false;
                    for (let i = 0; i < fetchedMessagesArray.length; i++) {
                        const msg = fetchedMessagesArray[i];
                        if (msg.id == latestMessage.id) {
                            fetchedMessagesArray = fetchedMessagesArray.slice(0, i + 1);
                            br = true;
                        }
                    }
                    messages = messages.concat(fetchedMessagesArray);
                    const lastMsg = fetchedMessages.last()?.id;
                    if (lastMsg) lastMessageId = lastMsg;
                    if (br) break;
                }

                messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                returnEmbed.setDescription('Neue Nachrichten Senden...')
                await interactionMessage.edit({ embeds: [returnEmbed] });


                const infoMsg = this.discordBot.defaultEmbeds.getDefaultEmbed('info');
                infoMsg.setTitle('Nachrichten transferred.')
                infoMsg.setDescription([
                    `anzahl: ${messages.length}`,
                    `ursprungschannel: <#${interaction.channel?.id}>`,
                    `zielchannel: <#${targetchannel?.id}>`,
                    `von: <@${interaction.user.id}>`
                ].join('\n'))
                targetchannel.send({ embeds: [infoMsg] });

                const oldNewMessageMap: Record<string, string> = {};
                for (let i = 0; i < messages.length; i++) {
                    const message = messages[i];
                    const webhook = await this.discordBot.botUtils.getWebhook((targetchannel as TextChannel), message.author.avatarURL());

                    const textChannel: any = message.channel;
                    const { webhookChannel, threadId } = this.discordBot.botUtils.getWebhookChannel(textChannel);

                    const messagePayload: WebhookMessageCreateOptions = {
                        content: message.content,
                        username: this.discordBot.botUtils.getnick(message.member, message.author),
                    }

                    if (message.reference && message.reference.messageId && oldNewMessageMap[message.reference.messageId]) {
                        messagePayload.content = `${oldNewMessageMap[message.reference.messageId]}${this.discordBot.settings.zeilenumbruch}${message.content}`;
                    }

                    // Überprüfen, ob die Originalnachricht Anhänge hat
                    if (message.attachments.size > 0) {
                        const attachments = [];
                        for (const attachment of message.attachments.values()) {
                            try {
                                // Lade die Datei herunter und erstelle ein AttachmentBuilder-Objekt
                                const response = await fetch(attachment.url);
                                const buffer = await response.arrayBuffer();

                                attachments.push(new AttachmentBuilder(Buffer.from(buffer), { name: attachment.name }));
                            } catch (e) {
                                console.error('Fehler beim Herunterladen des Anhangs:', e);
                                // Du kannst entscheiden, wie du mit Fehlern umgehst, z. B. den Anhang überspringen
                            }
                        }
                        // Füge die Anhänge zum Payload hinzu
                        messagePayload.files = attachments;
                    }

                    if (webhook) {
                        const sendetMessage = await webhook.send(messagePayload);
                        oldNewMessageMap[message.id] = sendetMessage.url;
                    }

                }

                returnEmbed.setDescription('Lösche alte Nachrichten...')
                await interactionMessage.edit({ embeds: [returnEmbed] });

                await (interaction.channel as TextChannel).bulkDelete(messages, true);


                await interactionMessage.edit({ embeds: [returnEmbed] });

            }
        })
    }

    async delMessages(interaction: CommandInteraction, messagesToDel: Message[]) {
        const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)
        if (!interaction.channel || !('bulkDelete' in interaction.channel)) {

            interaction.reply({
                embeds: [this.embeds.bulkDelNotExist],
                ephemeral: true
            })
            return
        }


        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
        embed.setTitle('Erledigt');
        if (messagesToDel.length > 0) {
            await interaction.channel?.bulkDelete(messagesToDel, true);
            embed.setDescription(`Successfully deleted ${messagesToDel.length} messages ${interactionOptions.user | interactionOptions.userid ? `from user <@${interactionOptions.user || interactionOptions.userid}>` : ''}`);
        } else {
            embed.setDescription(`No messages found to delete.`);
        }

        interaction.reply({ embeds: [embed] });

    }

    async clearTo(interaction: CommandInteraction) {
        if (await this.discordBot.botUtils.isMod(interaction.user.id)) {
            const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);
            const messageId = interactionOptions.messageid;
            const amount = 2000;

            let lastMessageId;
            let messagesToDel = [];
            let found = false;

            while (messagesToDel.length < amount) {
                const options: FetchMessagesOptions = { limit: 100 };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                let fetched = await interaction.channel?.messages.fetch(options);
                if (!fetched) {
                    interaction.reply({
                        embeds: [this.embeds.fetchMsgNotPossible],
                        ephemeral: true
                    })
                    return;
                }

                for (let [id, msg] of fetched) {
                    if (msg.id === messageId) {
                        found = true;
                        break;
                    }
                    messagesToDel.push(msg);
                }

                if (found || fetched.size < 100) {
                    break;
                }

                lastMessageId = fetched.last()?.id;
            }

            messagesToDel = messagesToDel.slice(0, amount);

            this.delMessages(interaction, messagesToDel);
        } else {
            const embed = this.discordBot.defaultEmbeds.getNoAccessEmbed();

            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    async clear(interaction: CommandInteraction) {
        if (await this.discordBot.botUtils.isMod(interaction.user.id)) {
            const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);

            const amount = Number(interactionOptions.number_of_messages.split('.')[0]);

            if (isNaN(amount)) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Fehler');
                embed.setTitle('number_of_messages muss eine ganze zahl sein.');

                interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            let lastMessageId;
            let messagesToDel: Message[] = [];

            while (messagesToDel.length < amount) {
                const options: FetchMessagesOptions = { limit: 100 };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                let fetched = await interaction.channel?.messages.fetch(options);
                if (!fetched) {
                    interaction.reply({
                        embeds: [this.embeds.bulkDelNotExist],
                        ephemeral: true
                    })
                    return;
                }

                let userMessages: any = fetched
                if (interactionOptions.user) {
                    userMessages = fetched.filter(msg => msg.author.id === interactionOptions.user);
                }
                else if (interactionOptions.userid) {
                    userMessages = fetched.filter(msg => msg.author.id === interactionOptions.userid);
                }
                userMessages = Array.from(userMessages);
                userMessages.forEach((value: any, index: number, array: any[]) => {
                    array[index] = value[1]
                })
                messagesToDel = messagesToDel.concat(userMessages);

                if (fetched.size < 100) {
                    break;
                }

                lastMessageId = fetched.last()?.id;
            }

            messagesToDel = messagesToDel.slice(0, amount);

            this.delMessages(interaction, messagesToDel);

        } else {
            const embed = this.discordBot.defaultEmbeds.getNoAccessEmbed();

            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    async roleMultiple(interaction: CommandInteraction) {
        if (await this.discordBot.botUtils.isMod(interaction.user.id)) {

            const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);

            const member: GuildMember | Collection<string, GuildMember> | undefined = await this.discordBot.guild?.members.fetch('');

            if (!member) { return }

            const user: GuildMember[] = [];
            const promisses: Promise<void>[] = [];

            if (interactionOptions.pick_type === 'role' && !interactionOptions.required_role) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Fehler');
                embed.setTitle('Wenn du type role nummst musst du required_role ausfüllen.');

                interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            const plsWaitEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            plsWaitEmbed.setTitle('Bitte warten');
            plsWaitEmbed.setDescription

            const interactionReplyMsg = await interaction.reply({ embeds: [plsWaitEmbed] })

            if (member instanceof Collection) member.forEach((m) => {
                switch (interactionOptions.pick_type) {
                    case 'all':
                        user.push(m);
                        break;
                    case 'bots':
                        if (m.user.bot) {
                            user.push(m);
                        }
                        break;
                    case 'humans':
                        if (!m.user.bot) {
                            user.push(m);
                        }
                        break;
                    case 'role':
                        promisses.push(new Promise(async (res) => {
                            if (await this.discordBot.botUtils.hasRole(m.id, interactionOptions.required_role)) {
                                user.push(m)
                            }
                        }))
                        break;

                }
            })

            await Promise.all(promisses);

            const rolePromisses = [];

            switch (interactionOptions.give_or_remove) {
                case 'give':
                    for (let i = 0; i < user.length; i++) {
                        rolePromisses.push(user[i].roles.add(interactionOptions.role).catch(() => { }));
                    }
                    break;
                case 'remove':
                    for (let i = 0; i < user.length; i++) {
                        rolePromisses.push(user[i].roles.remove(interactionOptions.role).catch(() => { }));
                    }
                    break;
            }

            await Promise.all(rolePromisses);

            const readyEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            readyEmbed.setTitle('Fertig');
            readyEmbed.setDescription('was im titel steht');

            interactionReplyMsg.edit({ embeds: [readyEmbed] }).catch(() => { });

        } else {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Keine Berechtigungen');
            embed.setTitle('Du hast keine Rechte....');

            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
}