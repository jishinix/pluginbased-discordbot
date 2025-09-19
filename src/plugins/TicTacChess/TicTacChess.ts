import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Colors, CommandInteraction, GuildMember, InteractionResponse, MessageFlags, SlashCommandBuilder } from "discord.js";
import short from 'short-uuid';
import { CommandPlugin } from "../../CommandPlugin.js";
import { DiscordBot } from "../../DiscordBot.js";
import Bauer from "./Pieces/Bauer.js";
import Laufer from "./Pieces/Laufer.js";
import Turm from "./Pieces/Turm.js";
import Pferd from "./Pieces/Pferd.js";
import ChessPiece from "./ChessPiece.js";

export interface Position {
    x: number;
    y: number;
};
type pieceTypes = 'bb' | 'bw' | 'pb' | 'pw' | 'tb' | 'tw' | 'lb' | 'lw' | null;
export type boardType = (pieceTypes)[][];

interface TicTacChessGame {
    id: string;
    playGround: boardType;
    players: string[];
    playerCooldownPieces: (string | null)[];
    nextMove: number;
    timer: NodeJS.Timeout | null;
    message: InteractionResponse | null;
    piecePointSelect: Position | null;
    pieceSelected: pieceTypes;
    mode: 'drop' | 'selectPiece' | 'selectTravel' | 'selectPiece'
}

export default class TicTacChess extends CommandPlugin {
    games: { [key: string]: TicTacChessGame };
    stringToEmojiMap: { [key: string]: string };

    constructor(discordBot: DiscordBot) {
        super(discordBot, discordBot.settings.plugins.TicTacChess)
        this.games = {};

        this.stringToEmojiMap = {
            'none': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejnone,
            'bb': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejbb,
            'bbl': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejbbl,
            'bw': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejbw,
            'pb': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejpb,
            'pbl': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejpbl,
            'pw': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejpw,
            'tb': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejtb,
            'tbl': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejtbl,
            'tw': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejtw,
            'lb': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejlb,
            'lbl': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejlbl,
            'lw': this.discordBot.settings.plugins.TicTacChess.pluginSettings.ejlw,
        }


        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('tictacchess-rules')
                .setDescription('lasse dir die regeln zu TicTacChess erklären!'),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                embed.setTitle('TicTacChess Rules');
                const desc = [
                    'Seien Sie der Erste, der seine vier gleichfarbigen Figuren horizontal, vertikal oder diagonal ausrichtet. Das Spiel beginnt auf einem leeren Brett, die Spieler platzieren abwechselnd eine Figur auf einem leeren Feld. Nach der ersten Figur auf dem Brett, können Sie wie beim normalen Schach ziehen und schlagen. Geschlagene Figuren werden an ihren Besitzer zurückgegeben und können nach einer Runde cooldown wieder aufs spielfeld gedropt werden.',
                    '',
                    '',
                    `B: ${this.stringToEmojiMap['bb']} | ${this.stringToEmojiMap['bw']}`,
                    '',
                    `P: ${this.stringToEmojiMap['pb']} | ${this.stringToEmojiMap['pw']}`,
                    '',
                    `L: ${this.stringToEmojiMap['lb']} | ${this.stringToEmojiMap['lw']}`,
                    '',
                    `T: ${this.stringToEmojiMap['tb']} | ${this.stringToEmojiMap['tw']}`,
                ]
                embed.setDescription(desc.join('\n'));
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        })

        this.addCommand({
            data: new SlashCommandBuilder()
                .setName('tictacchess')
                .setDescription('spiele TicTacChess')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Wenn du einen bestimmten nutzer einladen willst. Ansonsten kann jeder beitreten.')
                        .setRequired(false)),
            execute: async (discordBot: DiscordBot, interaction: CommandInteraction) => {
                const options = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction);

                const id = short.generate().replace(/-/g, '|');

                this.games[id] = {
                    id: id,
                    playGround: [],
                    players: [interaction.user.id],
                    playerCooldownPieces: [null, null],
                    nextMove: Math.floor(Math.random() * 2),
                    timer: null,
                    message: null,
                    piecePointSelect: null,
                    pieceSelected: null,
                    mode: 'selectPiece'
                }
                if (options.user) this.games[id].players.push(options.user);
                this.resetCooldown(this.games[id]);
                for (let y = 0; y < 4; y++) {
                    this.games[id].playGround.push([]);
                    for (let x = 0; x < 4; x++) {
                        this.games[id].playGround[y].push(null);
                    }
                }

                const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

                const message = await interaction.reply({ embeds: embeds, components: components });
                this.games[id].message = message;
            },
        })

        const nichtAmZugRtn = (interaction: ButtonInteraction) => {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Du bist nicht am Zug');
            interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        this.discordBot.botUtils.generateInteractionCb('buttons', 'selectBenchPiece', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const piece: any = options[1];
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== game.players[game.nextMove]) {
                nichtAmZugRtn(interaction);
                return;
            }

            game.mode = 'drop';
            game.pieceSelected = piece;

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            await interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'droppiece', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const y: number = Number(options[1]);
            const x: number = Number(options[2]);
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse) || isNaN(y) || isNaN(x)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== game.players[game.nextMove]) {
                nichtAmZugRtn(interaction);
                return;
            }


            if (game.playGround[y][x] !== null) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('dort kann deine Figut nicht hin');
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            game.playGround[y][x] = game.pieceSelected;
            game.mode = 'selectPiece';
            game.playerCooldownPieces[game.nextMove === 0 ? 1 : 0] = null;
            game.pieceSelected = null;
            game.nextMove++;
            if (game.nextMove > 1) game.nextMove = 0;

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            await interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'selectPiece', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const y: number = Number(options[1]);
            const x: number = Number(options[2]);
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse) || isNaN(y) || isNaN(x)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== game.players[game.nextMove]) {
                nichtAmZugRtn(interaction);
                return;
            }

            game.mode = 'selectTravel';
            game.pieceSelected = game.playGround[y][x];
            game.piecePointSelect = { x: x, y: y };

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            await interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'travel', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const y: number = Number(options[1]);
            const x: number = Number(options[2]);
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse) || isNaN(y) || isNaN(x) || !game.piecePointSelect || !game.pieceSelected || !this.getPosiblePositions(game.piecePointSelect, game.pieceSelected, game.playGround, this.getColor(game)).includes(`${y}${x}`)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== game.players[game.nextMove]) {
                nichtAmZugRtn(interaction);
                return;
            }

            game.mode = 'selectPiece';
            game.playGround[game.piecePointSelect.y][game.piecePointSelect.x] = null;
            if (game.playGround[y][x] !== null) {
                game.playerCooldownPieces[game.nextMove === 0 ? 1 : 0] = game.playGround[y][x];
            } else {
                game.playerCooldownPieces[game.nextMove === 0 ? 1 : 0] = null;
            }
            game.playGround[y][x] = game.pieceSelected;
            game.pieceSelected = null;
            game.piecePointSelect = null;
            game.nextMove++;
            if (game.nextMove > 1) game.nextMove = 0;

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            await interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })


        this.discordBot.botUtils.generateInteractionCb('buttons', 'default', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== game.players[game.nextMove]) {
                nichtAmZugRtn(interaction);
                return;
            }

            game.mode = 'selectPiece';
            game.pieceSelected = null;
            game.piecePointSelect = null;

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            await interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);
        })



        this.discordBot.botUtils.generateInteractionCb('buttons', 'ttcjoinGame', async (discordBot: DiscordBot, interaction: ButtonInteraction, options: string[]) => {
            const id: string = options[0];
            const game = this.games[id];
            if (!game || !(game.message instanceof InteractionResponse)) {
                const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }
            if (game.players.length >= 2) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Das spiel ist bereits voll');
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            game.players.push(interaction.user.id);

            const { embeds, components } = await this.generateRtnMessageComponents(this.games[id]);

            interaction.update({ embeds: embeds, components: components });
            this.resetCooldown(game);

            const channel = interaction.channel;
            if (channel && 'send' in channel) {
                const msg = await channel.send({
                    allowedMentions: { users: [game.players[0]], repliedUser: true },
                    content: `<@${game.players[0]}> Jemand ist deinem Spiel Beigetreten.`
                });

                setTimeout(() => {
                    if (msg) {
                        msg.delete().catch((e) => { })
                    }
                }, 1000 * 5)
            }
        })



    }

    async generateRtnMessageComponents(game: TicTacChessGame) {
        const members: GuildMember[] = [];
        for (let i = 0; i < game.players.length; i++) {
            const member = await this.discordBot.botUtils.fetchMember(game.players[i]);
            if (!member) {
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('Spieler nicht gefunden');
                return { embeds: [embed], components: [] }
            }
            members.push(member);
        }

        const winner = this.getWinningLine(game);


        const description: string[] = [];
        for (let i = 0; i < 2; i++) {
            description.push(`Spieler ${i + 1} (${i === 0 ? 'Weiß' : 'Schwarz'}): ${members[i] ? this.discordBot.botUtils.getnick(members[i]) : '???'}`);
        }
        if (game.players.length == 2 && winner === null) description.push(`Am zug: ${this.discordBot.botUtils.getnick(members[game.nextMove])}`);
        description.push(``);

        if (winner) description.push(`# Gewinner: ${winner === 'w' ? this.discordBot.botUtils.getnick(members[0]) : this.discordBot.botUtils.getnick(members[1])}`);

        const components: ActionRowBuilder<ButtonBuilder>[] = [];

        const color = this.getColor(game);
        const unusedPieces: string[] = [
            `b${color}`,
            `p${color}`,
            `l${color}`,
            `t${color}`,
        ];

        if (winner === null) {
            if (game.players.length === 2) {

                let travelPositions: string[] = [];
                if (game.mode == 'selectTravel') {
                    const figPos = game.piecePointSelect;
                    if (!figPos || !game.pieceSelected) {
                        const embed = this.discordBot.defaultEmbeds.getErrorEmbed();
                        return { embeds: [embed], components: [] }
                    };
                    travelPositions = this.getPosiblePositions(figPos, game.pieceSelected, game.playGround, color);
                }

                for (let y = 0; y < game.playGround.length; y++) {
                    components.push(new ActionRowBuilder<ButtonBuilder>());
                    for (let x = 0; x < game.playGround[y].length; x++) {
                        const piece = game.playGround[y][x];
                        if (piece !== null && piece?.endsWith(color)) {
                            const index = unusedPieces.indexOf(piece);
                            unusedPieces.splice(index, 1);
                        }

                        let buttonStyle;
                        let costumId = '';
                        let disabled;
                        let emojiName = 'none';

                        if (game.mode == 'selectPiece') {
                            if (piece !== null && piece.endsWith(color)) {
                                buttonStyle = ButtonStyle.Success
                                disabled = false;
                                costumId = `selectPiece-${game.id}-${y}-${x}`;
                            } else {
                                buttonStyle = ButtonStyle.Secondary
                                disabled = true;
                                costumId = `nothing-${game.id}-${y}-${x}`;
                            }
                        }

                        if (game.mode == 'drop') {
                            if (piece === null) {
                                buttonStyle = ButtonStyle.Success
                                disabled = false;
                                costumId = `droppiece-${game.id}-${y}-${x}`;
                            } else {
                                buttonStyle = ButtonStyle.Secondary
                                disabled = true;
                                costumId = `nothing-${game.id}-${y}-${x}`;
                            }
                        }

                        if (game.mode == 'selectTravel') {
                            if (!game.piecePointSelect) return { embeds: [], components: [] };
                            if (travelPositions.includes(`${y}${x}`)) {
                                buttonStyle = ButtonStyle.Success;
                                costumId = `travel-${game.id}-${y}-${x}`;
                                disabled = false;
                            } else if (x === game.piecePointSelect.x && y === game.piecePointSelect?.y) {
                                buttonStyle = ButtonStyle.Primary;
                                costumId = `default-${game.id}`;
                                disabled = false;
                            } else {
                                buttonStyle = ButtonStyle.Secondary;
                                disabled = true;
                                costumId = `nothing-${game.id}-${y}-${x}`;
                            }
                        }

                        if (piece) {
                            emojiName = piece;
                            if (disabled && emojiName.endsWith('b')) {
                                emojiName += 'l'
                            }
                        }


                        components[y].addComponents(
                            new ButtonBuilder()
                                .setCustomId(costumId)
                                .setStyle(buttonStyle ?? ButtonStyle.Primary)
                                .setEmoji(this.stringToEmojiMap[emojiName])
                                .setDisabled(disabled)
                        );
                    }
                }

                for (let i = 0; i < unusedPieces.length; i++) {
                    if (i == 0) components.push(new ActionRowBuilder<ButtonBuilder>);

                    let buttonStyle = ButtonStyle.Danger;
                    let disabled = false;
                    let costumId = ''
                    if (game.mode == 'selectPiece') {
                        costumId = `selectBenchPiece-${game.id}-${unusedPieces[i]}`
                    }
                    if (game.mode == 'drop') {
                        if (game.pieceSelected == unusedPieces[i]) {
                            buttonStyle = ButtonStyle.Primary;
                            disabled = false;
                            costumId = `default-${game.id}-${i}`
                        } else {
                            costumId = `selectBenchPiece-${game.id}-${unusedPieces[i]}`
                        }
                    } else if (game.mode == 'selectTravel') {
                        disabled = true;
                        costumId = `nothing-bench-${game.id}-${i}`
                    }
                    let emojiName = 'none';
                    if (unusedPieces[i]) {
                        emojiName = unusedPieces[i];
                        if (disabled && emojiName.endsWith('b')) {
                            emojiName += 'l'
                        }
                    }

                    if (!disabled) {
                        if (game.playerCooldownPieces[game.nextMove] === unusedPieces[i]) {
                            disabled = true;
                        }
                    }

                    components[4].addComponents(
                        new ButtonBuilder()
                            .setCustomId(costumId)
                            .setStyle(buttonStyle)
                            .setEmoji(this.stringToEmojiMap[emojiName])
                            .setDisabled(disabled)
                    );
                }
            } else {
                components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ttcjoinGame-${game.id}`)
                        .setStyle(ButtonStyle.Primary)
                        .setLabel('Spiel beitreten')
                ))
            }
        } else {

            const table: string[] = [];
            for (let y = 0; y < game.playGround.length; y++) {
                let row: string[] = [];
                for (let x = 0; x < game.playGround[y].length; x++) {
                    const piece = game.playGround[y][x];
                    if (!piece) row.push(this.stringToEmojiMap['none']);
                    else row.push(this.stringToEmojiMap[piece])
                }
                table.push(row.join(' | '));
            }
            description.push(table.join('\n------------------\n'))

            const message = game.message;
            setTimeout(() => {
                if (message) {
                    message.delete().catch(e => { });
                } else {
                    console.log(message)
                }
            }, 1000 * 20)
            delete this.games[game.id];
        }
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none', [winner === null ? 'dieses Spiel wird nach 10 Minuten ohne Interaction automatisch beendet.' : '']);

        embed.setTitle('TicTacChess');
        embed.setDescription(description.join('\n'))

        return { embeds: [embed], components: components };
    }

    getColor(game: TicTacChessGame) {
        return game.nextMove === 0 ? 'w' : 'b';
    }

    getPosiblePositions(point: Position, name: string, board: boardType, color: string) {
        const thirstLetter = name.slice(0, 1);
        let piece: ChessPiece | null = null;
        switch (thirstLetter) {
            case 'b':
                piece = new Bauer(point, board, color)
                break;
            case 'p':
                piece = new Pferd(point, board, color);
                break;
            case 'l':
                piece = new Laufer(point, board, color);
                break;
            case 't':
                piece = new Turm(point, board, color);
                break;
        }

        if (piece) {
            return piece.getAllValidMovesAsStringArray();
        }
        return [];
    }

    getWinningLine(game: TicTacChessGame): string | null {
        const board = game.playGround;
        const rows = board.length;
        const cols = board[0].length;

        // Hilfsfunktion, um das Endzeichen eines Strings zu bekommen
        const getLastChar = (cell: string | null): string | null =>
            cell ? cell.slice(-1) : null;

        // Prüfe Zeilen
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x <= cols - 4; x++) {
                const char = getLastChar(board[y][x]);
                if (char && board[y].slice(x, x + 4).every(cell => getLastChar(cell) === char)) {
                    return char;
                }
            }
        }

        // Prüfe Spalten
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y <= rows - 4; y++) {
                const char = getLastChar(board[y][x]);
                if (char && [...Array(4)].every((_, i) => getLastChar(board[y + i][x]) === char)) {
                    return char;
                }
            }
        }

        // Prüfe diagonale (\ Richtung)
        for (let y = 0; y <= rows - 4; y++) {
            for (let x = 0; x <= cols - 4; x++) {
                const char = getLastChar(board[y][x]);
                if (char && [...Array(4)].every((_, i) => getLastChar(board[y + i][x + i]) === char)) {
                    return char;
                }
            }
        }

        // Prüfe diagonale (/ Richtung)
        for (let y = 3; y < rows; y++) {
            for (let x = 0; x <= cols - 4; x++) {
                const char = getLastChar(board[y][x]);
                if (char && [...Array(4)].every((_, i) => getLastChar(board[y - i][x + i]) === char)) {
                    return char;
                }
            }
        }


        return null; // Kein Gewinn gefunden
    }


    resetCooldown(game: TicTacChessGame) {
        if (game.timer) {
            clearTimeout(game.timer);
        }
        game.timer = setTimeout(() => {
            if (this.games[game.id]) {
                const message = this.games[game.id].message;
                if (message) {
                    const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none');
                    embed.setTitle('Abgelaufen');
                    embed.setDescription(`Das spiel ist nach 10 Minuten nicht interagieren abgelaufen.`);

                    message.edit({ embeds: [embed], components: [] });
                }
                setTimeout(() => {
                    if (message) {
                        message.delete();
                    }
                }, 1000 * 20)
                delete this.games[game.id];
            }
        }, 1000 * 60 * 10)
    }
}