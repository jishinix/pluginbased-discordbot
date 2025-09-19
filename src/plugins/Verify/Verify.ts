import { ButtonBuilder, ButtonStyle, ModalBuilder, ActionRowBuilder, TextInputStyle, TextInputBuilder, GuildMember, Role, ButtonInteraction, ModalSubmitInteraction, Message } from 'discord.js';
import { DiscordBot } from '../../DiscordBot';
import Plugin from '../../Plugin';


export default class Verify extends Plugin {
    unverifiedRoleId: string | undefined;
    verifiedRoleId: string | undefined;
    tosAndPp: string;
    welcomeModule: string | undefined;

    constructor(discordBot: DiscordBot) {
        super(discordBot);

        this.unverifiedRoleId = this.discordBot.settings.plugins.Verify.pluginSettings.unverifiedRoleId;
        this.verifiedRoleId = this.discordBot.settings.plugins.Verify.pluginSettings.verifiedRoleId;
        this.tosAndPp = this.discordBot.settings.plugins.Verify.pluginSettings.tosAndPp;
        this.welcomeModule = this.discordBot.settings.plugins.Verify.pluginSettings.welcomeModule;

        this.initEvents();
    }
    initEvents() {
        this.discordBot.addEventListener('event-guildMemberAdd', async (member: GuildMember) => {
            if (!this.unverifiedRoleId) return;
            const role = await this.discordBot.guild?.roles.fetch(this.unverifiedRoleId);
            if (role instanceof Role) member.roles.add(role).catch(() => { });
        }),
            this.discordBot.botUtils.generateInteractionCb('buttons', 'verify', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: { [key: string]: string }) => {
                const num1 = this.discordBot.botUtils.getRandomNumber(1, 20);
                const num2 = this.discordBot.botUtils.getRandomNumber(1, 20);
                const modal = new ModalBuilder()
                    .setCustomId(`verify-${num1}-${num2}`)
                    .setTitle('Verifizieren')
                    .addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('result')
                                .setLabel(`Beantworte: ${num1} + ${num2}`)
                                .setStyle(TextInputStyle.Short)
                                .setMinLength(1)
                                .setMaxLength(3)
                                .setRequired(true),
                        )
                    );


                await interaction.showModal(modal);
            })
        this.discordBot.botUtils.generateInteractionCb('modal', 'verify', async (discordBot: DiscordBot, interaction: ModalSubmitInteraction, options: { [key: string]: string }) => {
            const awnser = interaction.fields.getTextInputValue('result');

            if (Number(awnser) === Number(options[0]) + Number(options[1])) {

                const member = interaction.member

                if (member instanceof GuildMember) {
                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle('Verification Erfolgreich!')

                    interaction.reply({ embeds: [embed], ephemeral: true })

                    if (this.unverifiedRoleId) {
                        const role = await this.discordBot.guild?.roles.fetch(this.unverifiedRoleId);
                        if (role instanceof Role) member.roles.remove(role);


                    }
                    if (this.verifiedRoleId) {
                        const role = await this.discordBot.guild?.roles.fetch(this.verifiedRoleId);
                        if (role instanceof Role) member.roles.add(role);
                    }

                    if (this.welcomeModule) {
                        this.discordBot.plugins[this.welcomeModule].sendWelcomme(member);
                    }
                    return
                }
            }

            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Verification Fehlgeschlagen!')
            embed.setDescription('Die Verification ist leider Fehlgeschlagen bitte versuche es erneut!')

            interaction.reply({ embeds: [embed], ephemeral: true })
        })

        this.discordBot.addEventListener('event-messageCreate', async (message: Message) => {
            if (message.content == "verify!init") {
                if (this.discordBot.botUtils.isDev(message.author.id)) {

                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle('Verifizieren!')
                    embed.setDescription(`Bitte klicke auf den Button und beantworte anschließend das Captcha.\n\nMit dem Verifizieren Stimmst du denn Serverregeln und Tos sowie der Privacy Policy von ${this.discordBot.instance && this.discordBot.instance.user ? this.discordBot.instance.user.username : 'diesem Bot'} zu.\n\n [ToS und Privacy Policy](${this.tosAndPp})`);


                    let button = new ActionRowBuilder<ButtonBuilder>();
                    button.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`verify`)
                            .setStyle(ButtonStyle.Success)
                            .setLabel(`Verifizieren`)
                    );

                    if ('send' in message.channel) message.channel.send({ embeds: [embed], components: [button] })
                }
            }
        })
    }
}