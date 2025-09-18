import { ActionRowBuilder, Base, BaseInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, GuildMember, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";


export default class BoosterColorRoles extends CommandPlugin {
    discordBot: DiscordBot;
    boosterRoleId: string;
    boostChannelId: string;
    text: string[];


    constructor(discordBot: DiscordBot) {
        super(discordBot.settings.plugins.BoosterColorRoles);
        this.discordBot = discordBot;

        this.boosterRoleId = this.discordBot.settings.plugins.BoosterColorRoles.pluginSettings.boosterRoleId;
        this.boostChannelId = this.discordBot.settings.plugins.BoosterColorRoles.pluginSettings.boostChannelId;
        this.text = this.discordBot.settings.plugins.BoosterColorRoles.pluginSettings.text;

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('boostrolle')
                .setDescription('Erstelle oder ändere deine Boostrolle!'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                this.createModal(interaction);

            },
        })

        this.discordBot.botUtils.generateInteractionCb('buttons', 'boosterRole', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: { [key: string]: string }) => {
            const authorId = options[0]
            await this.createModal(interaction, authorId)
        })
        this.discordBot.botUtils.generateInteractionCb('modal', 'boostRole', async (discordBot: DiscordBot, interaction: ModalSubmitInteraction, options: { [key: string]: string }) => {
            if (!(interaction.member instanceof GuildMember)) return;
            const authorId = options[0];
            const messageId = options[1];
            if (!(await this.isBooster(interaction.member))) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('kein Booster!')
                embed.setDescription(`Leider bist du kein Booster und kannst dir daher auch keine Costume rolle erstellen.`)

                interaction.reply({ embeds: [embed], ephemeral: true })
                return;
            }


            const name = interaction.fields.getTextInputValue('name');
            let hex = interaction.fields.getTextInputValue('hex');

            if (hex.startsWith('#')) hex = hex.split('#')[1];

            if (!this.isValidHexCode(hex)) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Hexcode Invalide!')
                embed.setDescription(`Dein angegebener (#${hex}) hexcode ist leider Invalide. Bitte beachte das hexcodes keine Alphawerte unterstützt und daher nur 3 oder 6 Ziffer und/oder Buchstaben haben darf.`)

                interaction.reply({ embeds: [embed], ephemeral: true })
                return;
            }

            if (hex.length === 3) {
                hex = this.expandShortHexCode(hex);
            }

            let roleId = null;

            const getRoleIdSql = `
                SELECT UA_VALUE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ?
            `;

            const rtn = (await this.discordBot.db.query(getRoleIdSql, [interaction.member?.id, 'boosterRoleId']))[0];

            for (let i = 0; i < rtn.length; i++) {
                roleId = rtn[i].UA_VALUE;
            }

            let msg = '';

            if (roleId) {
                const role = await this.discordBot.guild?.roles.fetch(roleId);
                if (!role) {
                    const getRoleIdSql = `
                        DELETE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ?
                    `;
                    await this.discordBot.db.query(getRoleIdSql, [interaction.member.id, 'boosterRoleId'])
                    this.discordBot.dispatchEvent(`interaction-modal-boostRole`, [discordBot, interaction, options]);
                    return;
                }

                await role.setName(name);
                await role.setColor(Number(`0x${hex}`));

                msg = 'Deine Boosterrole wurde geupdatet.';
            } else {
                const boosterRole = await this.discordBot.guild?.roles.fetch(this.boosterRoleId); // booster rolle
                if (!boosterRole) return;
                const postition = boosterRole.position + 2;

                const role = await this.discordBot.guild?.roles.create({
                    name: name,
                    color: Number(`0x${hex}`),
                    reason: 'booster Costume role.',
                })
                if (!role) return;

                await this.discordBot.guild?.roles.setPositions([{ role: role.id, position: postition }])

                await interaction.member.roles.add(role);

                const sql = `INSERT INTO st_ua_user_attribute (
                    UA_US_ID,
                    UA_SR_ID,
                    UA_NAME,
                    UA_VALUE
                ) VALUES (
                    ?,
                    ?,
                    'boosterRoleId',
                    ?
                )`;
                await this.discordBot.db.query(sql, [interaction.member.user.id, this.discordBot.guild?.id, role.id]);


                msg = 'Boosterrole wurde erstellt.';
            }
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
            embed.setTitle('Fertig!')
            embed.setDescription(msg)

            interaction.reply({ embeds: [embed], ephemeral: true })

            if (messageId) {
                if (authorId == interaction.member.id) {
                    const message = await interaction.channel?.messages.fetch(messageId);
                    if (message) await message.delete();
                }
            }

        })

        this.discordBot.addEventListener('event-guildMemberUpdate', async (oldMember: GuildMember, newMember: GuildMember) => {
            if (oldMember.premiumSince !== newMember.premiumSince && oldMember.premiumSince === null && newMember.premiumSince !== null) {


                await this.runSend(newMember);
            } else if (oldMember.premiumSince !== newMember.premiumSince && oldMember.premiumSince !== null && newMember.premiumSince === null) {

                let roleId = null;
                let role = null;

                const getRoleIdSql = `
                    SELECT UA_VALUE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ?
                `;

                const rtn = (await this.discordBot.db.query(getRoleIdSql, [newMember.user.id, 'boosterRoleId']))[0];

                for (let i = 0; i < rtn.length; i++) {
                    roleId = rtn[i].UA_VALUE;
                }

                if (roleId) {
                    role = await this.discordBot.guild?.roles.fetch(roleId);
                }

                if (role) {
                    await newMember.roles.remove(role);
                    return;
                }
            }
        })
    }

    async runSend(newMember: GuildMember) {

        let roleId = null;
        let role = null;

        const getRoleIdSql = `
            SELECT UA_VALUE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ?
        `;


        const rtn = (await this.discordBot.db.query(getRoleIdSql, [newMember.user.id, 'boosterRoleId']))[0];

        for (let i = 0; i < rtn.length; i++) {
            roleId = rtn[i].UA_VALUE;
        }

        if (roleId) {
            role = await this.discordBot.guild?.roles.fetch(roleId);
        }

        if (role) {
            await newMember.roles.add(role)
        }


        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
        embed.setTitle('Vielen dank!')
        embed.setDescription(this.text.join('\n').replace(/{username}/g, this.discordBot.botUtils.getnick(newMember)).replace(/{userId}/g, newMember.user.id).replace(/{guildname}/g, newMember.guild.name));



        const channel = await this.discordBot.guild?.channels.fetch(this.boostChannelId);
        if (channel && 'send' in channel && typeof channel.send == 'function') channel.send({
            content: `<@${newMember.user.id}>`,
            allowedMentions: {
                users: [newMember.user.id],
                repliedUser: true
            },
            embeds: [embed]
        })
    }

    async createModal(interaction: BaseInteraction, authorId: string | null = null) {

        if (!(interaction.member instanceof GuildMember) || !(await this.isBooster(interaction.member))) {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Kein Booster!')
            embed.setDescription(`Leider bist du kein Booster und kannst dir daher auch keine custom-color-role erstellen.`)

            if ('reply' in interaction && typeof interaction.reply == 'function') interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
            return;
        }

        let roleId = null;
        let role = null;

        const getRoleIdSql = `
            SELECT UA_VALUE FROM st_ua_user_attribute WHERE UA_US_ID = ? AND UA_NAME = ?
        `;

        const rtn = (await this.discordBot.db.query(getRoleIdSql, [interaction.user.id, 'boosterRoleId']))[0];

        for (let i = 0; i < rtn.length; i++) {
            roleId = rtn[i].UA_VALUE;
        }

        if (roleId) {
            role = await this.discordBot.guild?.roles.fetch(roleId);
        }

        const nameTextInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel(`Name (Wie soll deine Rolle heißen?)`)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(90)
            .setRequired(true)

        const colorTextInput = new TextInputBuilder()
            .setCustomId('hex')
            .setLabel(`Color`)
            .setPlaceholder(`Hex`)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(7)
            .setRequired(true)

        if (role) {
            nameTextInput.setValue(role.name);
            colorTextInput.setValue(this.discordBot.botUtils.decimalToHex(role.color, 6));
        }

        const modal = new ModalBuilder()
            .setCustomId(`boostRole${'message' in interaction && interaction.message instanceof Message ? `-${authorId}-${interaction.message.id}` : ''}`)
            .setTitle('Erstelle dir eine costume Rolle!')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    nameTextInput
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    colorTextInput
                ),
            );


        if ('showModal' in interaction && typeof interaction.showModal == 'function') await interaction.showModal(modal);
    }

    async isBooster(member: GuildMember) {
        //return await this.discordBot.botUtils.hasRole(member.id, this.boosterRoleId)
        return await this.discordBot.botUtils.hasRole(member.id, this.boosterRoleId);
    }

    isValidHexCode(hex: string) {
        const regex = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        return regex.test(hex);
    }

    expandShortHexCode(shortHex: string) {
        if (/^[0-9a-fA-F]{3}$/.test(shortHex)) {
            return `${shortHex[0]}${shortHex[0]}${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}`;
        }
        return shortHex; // Wenn es keine Kurzform ist, wird der Input zurückgegeben
    }
}