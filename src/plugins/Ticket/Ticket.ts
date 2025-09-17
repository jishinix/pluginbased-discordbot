
import { PermissionsBitField, ChannelType, ButtonBuilder, ButtonStyle, ModalBuilder, ActionRowBuilder, TextInputStyle, TextInputBuilder, ButtonInteraction, ModalSubmitInteraction, GuildMember, BaseGuildTextChannel, Message, GuildChannelCloneOptions, GuildChannelCreateOptions } from 'discord.js';
import short from 'short-uuid';
import { DiscordBot } from '../../DiscordBot';

interface permissionObject {
    id: string,
    allow?: bigint[],
    deny?: bigint[]
}

export default class Ticket {
    discordBot: DiscordBot
    adminAllows: bigint[];
    defaultPermission: permissionObject[];
    transcriptChannelId: string | undefined;
    parentCategoryId: string | undefined;
    initEmbedTitle: string | undefined;
    initEmbedDesc: string | undefined;

    constructor(discordBot: DiscordBot) {
        this.discordBot = discordBot;

        this.transcriptChannelId = this.discordBot.settings.plugins.Ticket.pluginSettings.transcriptChannelId;
        this.parentCategoryId = this.discordBot.settings.plugins.Ticket.pluginSettings.parentCategoryId;
        this.initEmbedTitle = this.discordBot.settings.plugins.Ticket.pluginSettings.initEmbedTitle;
        this.initEmbedDesc = this.discordBot.settings.plugins.Ticket.pluginSettings.initEmbedDesc;


        this.adminAllows = [
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ViewChannel
        ]

        this.defaultPermission = [];

        if (this.discordBot.settings.roles.supporter) this.defaultPermission.push(
            {
                id: this.discordBot.settings.roles.supporter,
                allow: this.adminAllows,
            }
        )
        if (this.discordBot.settings.roles.mod) this.defaultPermission.push(
            {
                id: this.discordBot.settings.roles.mod,
                allow: this.adminAllows,
            }
        )
        if (this.discordBot.settings.roles.admin) this.defaultPermission.push(
            {
                id: this.discordBot.settings.roles.admin,
                allow: this.adminAllows,
            }
        )
        if (this.discordBot.settings.roles.owner) this.defaultPermission.push(
            {
                id: this.discordBot.settings.roles.owner,
                allow: this.adminAllows,
            }
        )
        if (this.discordBot.settings.guildId) this.defaultPermission.push(
            {
                id: this.discordBot.settings.guildId,
                deny: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.ReadMessageHistory
                ],
            }
        )

        this.discordBot.botUtils.generateInteractionCb('buttons', 'ticket_create', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {

            const modal = new ModalBuilder()
                .setCustomId(`ticket_create`)
                .setTitle('Ticket erstellen')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('title')
                            .setLabel(`Titel`)
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(1)
                            .setMaxLength(50)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('desc')
                            .setLabel(`Beschreibung des Anliegens`)
                            .setStyle(TextInputStyle.Paragraph)
                            .setMinLength(1)
                            .setMaxLength(2000)
                            .setRequired(true)
                    ),
                );


            await interaction.showModal(modal);

        })

        this.discordBot.botUtils.generateInteractionCb('modal', 'ticket_create', async (discordBot: DiscordBot, interaction: ModalSubmitInteraction, options: string[]) => {
            if (!this.discordBot.guild || !(interaction.member instanceof GuildMember)) return;


            const title = interaction.fields.getTextInputValue('title');
            const desc = interaction.fields.getTextInputValue('desc');

            const guildChannelCreateOptions: GuildChannelCreateOptions = {
                name: `ticket-${this.discordBot.botUtils.getnick(interaction.member).toLowerCase().slice(0, 40)}-${title}`,
                type: ChannelType.GuildText,
                permissionOverwrites: new Array(
                    ...this.defaultPermission,
                    {
                        id: interaction.user.id,
                        allow: this.adminAllows,
                    }
                )
            }
            if (this.parentCategoryId) {
                guildChannelCreateOptions.parent = this.parentCategoryId;
            }

            const createdChannel = await this.discordBot.guild.channels.create(guildChannelCreateOptions);

            const ticketInitEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            ticketInitEmbed.setTitle(title);
            ticketInitEmbed.setDescription(desc);

            const ticketCloseButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_close`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel(`Ticket Schließen`)
            );

            await createdChannel.send({
                embeds: [ticketInitEmbed],
                content: `<@${interaction.member.id}>, dein Ticket wurde erstellt. Bitte habe einen augenblick Geduld bis ein Mod oder Admin sich um dein Anliegen kümmert.`,
                allowedMentions: { users: [interaction.member.id], repliedUser: true },
                components: [ticketCloseButton]
            })

            const replyEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');
            replyEmbed.setTitle('Ferig!');
            replyEmbed.setDescription(`Dein Ticket wurde erfolgreich erstellt: <#${createdChannel.id}>`);

            interaction.reply({
                embeds: [replyEmbed],
                ephemeral: true
            })
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'ticket_close', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            if (!(interaction.channel instanceof BaseGuildTextChannel)) return
            interaction.channel.permissionOverwrites.set(new Array(
                ...this.defaultPermission
            ));

            const replyEmbed = this.discordBot.defaultEmbeds.getDefaultEmbed('ready');
            replyEmbed.setTitle('Ticket geschlossen!');
            replyEmbed.setDescription(`von: <@${interaction.user.id}>`);

            const ticketDeleteButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_trans`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`Transkript Erstellen`),
                new ButtonBuilder()
                    .setCustomId(`ticket_delete`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel(`Ticket Löschen`),
            );

            interaction.reply({
                embeds: [replyEmbed],
                components: [ticketDeleteButton]
            })
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'ticket_trans', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            if (this.transcriptChannelId) {
                console.log(1);
                await this.discordBot.botUtils.createTranscript(interaction, { startMsgId: interaction.message.id, ignoreMaxMsgs: true, sendIn: this.transcriptChannelId });
            }
            else {
                console.log(2);
                await this.discordBot.botUtils.createTranscript(interaction, { startMsgId: interaction.message.id, ignoreMaxMsgs: true, ephemeral: true });
            }
        })
        this.discordBot.botUtils.generateInteractionCb('buttons', 'ticket_delete', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {

            if (await this.discordBot.botUtils.isMod(interaction.user.id)) {
                if (interaction.channel && 'delete' in interaction.channel) await interaction.channel.delete();
            } else {
                console.log('nö')
            }
        })

        this.discordBot.addEventListener('event-messageCreate', async (message: Message) => {
            if (!message.channel || !('send' in message.channel)) return
            if (message.content == "ticket!init") {

                if (this.discordBot.botUtils.isDev(message.author.id)) {

                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle(this.initEmbedTitle ? this.initEmbedTitle : 'Support/Bewerbung -Ticket')
                    embed.setDescription(this.initEmbedDesc ? this.initEmbedDesc : `Klicke auf den Button um ein Support Ticket zu Öffnen`);


                    let button = new ActionRowBuilder<ButtonBuilder>();
                    button.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket_create`)
                            .setStyle(ButtonStyle.Success)
                            .setLabel(`Ticket erstellen`)
                    );

                    message.channel.send({ embeds: [embed], components: [button] })
                }
            }
        })
    }
}