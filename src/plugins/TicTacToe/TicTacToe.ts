import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, DefaultWebSocketManagerOptions, EmbedBuilder, InteractionResponse, Message, MessageFlags, SlashCommandBuilder } from "discord.js";
import short from 'short-uuid';
import { DiscordBot } from "../../DiscordBot.js";
import { CommandPlugin } from "../../CommandPlugin.js";

interface TicTacToeGame {
    id: string;
    playGround: (string | null)[][];
    playerCircle: string | null;
    playerCross: string | null;
    nextMove: 'x' | 'o';
    timer: NodeJS.Timeout | null;
    message: InteractionResponse | null;
}

type RtnMessageComponentsResponseType = {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
};


export default class TicTacToe extends CommandPlugin {
    games: { [key: string]: TicTacToeGame };

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.TicTacToe);
        this.games = {};

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('tictactoe')
                .setDescription('spiele TicTacToe')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Wenn du einen bestimmten nutzer einladen willst. Ansonsten kann jeder beitreten.')
                        .setRequired(false)),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);

                if (options.user === interaction.user.id) {
                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                    embed.setTitle('Du kannst aktuell noch nicht Alleine Spielen.');
                    interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }

                const id = short.generate().replace(/-/g, '|');

                this.games[id] = {
                    id: id,
                    playGround: [],
                    playerCircle: interaction.user.id,
                    playerCross: options.user ? options.user : null,
                    nextMove: (Math.floor(Math.random() * 2) % 2 ? 'o' : 'x'),
                    timer: null,
                    message: null,
                }
                this.resetCooldown(this.games[id]);
                for (let y = 0; y < 3; y++) {
                    this.games[id].playGround.push([]);
                    for (let x = 0; x < 3; x++) {
                        this.games[id].playGround[y].push(null);
                    }
                }

                const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

                const message = await interaction.reply({ embeds: embeds, components: components });
                this.games[id].message = message;
            },
        })

        this.discordBot.botUtils.generateInteractionCb('buttons', 'tictactoe', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const y: number = Number(options[1]);
            const x: number = Number(options[2]);
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse) || isNaN(y) || isNaN(x) || game.playGround[y][x] !== null) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }
            if (this.checkWin(game) !== false) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const nichtAmZugRtn = () => {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Du bist nicht am Zug');
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (game.nextMove === 'o') {
                if (game.playerCircle !== interaction.user.id) {
                    nichtAmZugRtn();
                    return;
                }
            } else {
                if (game.playerCross !== interaction.user.id) {
                    nichtAmZugRtn();
                    return;
                }
            }

            game.playGround[y][x] = game.nextMove;
            game.nextMove = game.nextMove == 'o' ? 'x' : 'o';

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);

        })

        this.discordBot.botUtils.generateInteractionCb('buttons', 'tttjoinGame', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }
            if (interaction.user.id === game.playerCircle) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Du kannst aktuell noch nicht Alleine Spielen.');
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }
            if (game.playerCross !== null) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Das spiel ist bereits voll');
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            game.playerCross = interaction.user.id;

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })


    }

    getGameAsDescriptionArray(game: TicTacToeGame): string[] {
        const description: string[] = [];
        description.push('```');
        for (let y = 0; y < game.playGround.length; y++) {
            const rowStringOptimized: string[] = [];
            for (let x = 0; x < game.playGround[y].length; x++) {
                const val = game.playGround[y][x];
                if (val) {
                    rowStringOptimized.push(val);
                } else {
                    rowStringOptimized.push('-');
                }
            }
            description.push(rowStringOptimized.join(' | '));
            if (y + 1 !== game.playGround.length) {
                description.push('---------');
            }
        }
        description.push('```');

        return description;
    }

    async generateRtnMessageComponents(game: TicTacToeGame): Promise<RtnMessageComponentsResponseType> {
        const memberCircle = game.playerCircle ? await this.discordBot.botUtils.fetchMember(game.playerCircle) : null;
        const memberCross = game.playerCross ? await this.discordBot.botUtils.fetchMember(game.playerCross) : null;

        const winner = this.checkWin(game);

        if (!memberCircle) {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Member Kreis wurde nicht gefunden');
            return { embeds: [embed], components: [] }
        }
        if (!memberCross && game.playerCross) {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Member X wurde nicht gefunden');
            return { embeds: [embed], components: [] }
        }

        const description: string[] = [];
        description.push(`Spieler o: ${this.discordBot.botUtils.getnick(memberCircle)}`);
        description.push(`Spieler x: ${memberCross ? this.discordBot.botUtils.getnick(memberCross) : '???'}`);
        if (memberCross && winner === false) description.push(`Am zug: ${game.nextMove === 'o' ? this.discordBot.botUtils.getnick(memberCircle) : this.discordBot.botUtils.getnick(memberCross)}`);
        description.push(``);

        const components: ActionRowBuilder<ButtonBuilder>[] = [];

        if (memberCross && winner !== false) {
            if (winner === 'o') {
                description.push(`gewinner: ${this.discordBot.botUtils.getnick(memberCircle)}`)
            } else if (winner === 'x') {
                description.push(`gewinner: ${this.discordBot.botUtils.getnick(memberCross)}`)
            } else {
                description.push(`unentschieden!`)
            }
            description.push(...this.getGameAsDescriptionArray(game))
        } else {
            if (memberCross) {
                for (let y = 0; y < 3; y++) {
                    components.push(new ActionRowBuilder<ButtonBuilder>());
                    for (let x = 0; x < 3; x++) {
                        components[y].addComponents(
                            new ButtonBuilder()
                                .setCustomId(`tictactoe-${game.id}-${y}-${x}`)
                                .setStyle(ButtonStyle.Primary)
                                .setLabel(game.playGround[y][x] ?? '-')
                                .setDisabled(!!game.playGround[y][x])
                        );
                    }
                }
            } else {
                components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tttjoinGame-${game.id}`)
                        .setStyle(ButtonStyle.Primary)
                        .setLabel('Spiel beitreten')
                ))
            }
        }

        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none', [winner === false ? 'dieses Spiel wird nach 10 Minuten ohne Interaction automatisch beendet.' : '']);

        embed.setTitle('TicTacToe');
        embed.setDescription(description.join('\n'))

        return { embeds: [embed], components: components };
    }

    resetCooldown(game: TicTacToeGame) {
        if (game.timer) {
            clearTimeout(game.timer);
        }
        game.timer = setTimeout(() => {
            if (this.games[game.id].message) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                embed.setTitle('Abgelaufen');
                embed.setDescription(`Das spiel ist nach 10 Minuten nicht interagieren abgelaufen.\n\nErgebniss:\n${this.getGameAsDescriptionArray(this.games[game.id]).join('\n')}`);

                this.games[game.id].message?.edit({ embeds: [embed], components: [] });
            }
            delete this.games[game.id];
        }, 1000 * 60 * 10)
    }

    checkWin(game: TicTacToeGame) {

        for (let y = 0; y < 3; y++) {
            if (game.playGround[y][0] !== null && game.playGround[y][0] === game.playGround[y][1] && game.playGround[y][1] == game.playGround[y][2]) {
                return game.playGround[y][0];
            }
        }
        for (let x = 0; x < 3; x++) {
            if (game.playGround[0][x] !== null && game.playGround[0][x] === game.playGround[1][x] && game.playGround[1][x] == game.playGround[2][x]) {
                return game.playGround[0][x];
            }
        }
        if (game.playGround[1][1] !== null) {
            if (game.playGround[0][0] == game.playGround[1][1] && game.playGround[1][1] == game.playGround[2][2]) {
                return game.playGround[0][0];
            }
            if (game.playGround[0][2] == game.playGround[1][1] && game.playGround[1][1] == game.playGround[2][0]) {
                return game.playGround[0][2];
            }
        }

        for (let y = 0; y < game.playGround.length; y++) {
            for (let x = 0; x < game.playGround[y].length; x++) {
                if (game.playGround[y][x] === null) {
                    return false;
                }
            }
        }

        return '-';

    }


}