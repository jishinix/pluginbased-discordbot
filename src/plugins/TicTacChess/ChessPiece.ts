import { boardType, Position } from "./TicTacChess";

type ChessBoard = string[][];

export default abstract class ChessPiece{
    position: Position;
    board: boardType;
    color: string;

    constructor(position: Position, board: boardType, color: string){
        this.position = position;
        this.board = board;
        this.color = color;
    }

    abstract getAllValidMovesAsStringArray(): string[];
}