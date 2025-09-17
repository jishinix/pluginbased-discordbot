import ChessPiece from "../ChessPiece.js";
import { boardType, Position } from "../TicTacChess.js";


export default class Laufer extends ChessPiece{
    constructor(position: Position, board: boardType, color: string){
        super(position, board, color);
    }

    getAllValidMovesAsStringArray(): string[] {

        const rtn: string[] = [];
        const directions = [
            [-1, -1], // Oben links
            [1, -1],  // Oben rechts
            [1, 1],   // Unten rechts
            [-1, 1]   // Unten links
        ];
        
        for (const [dx, dy] of directions) {
            let i = 1;
            while (true) {
                const x = this.position.x + dx * i;
                const y = this.position.y + dy * i;
                if (x >= 0 && y >= 0 && x <= 3 && y <= 3) {
                    if(this.board[y][x] !== null){
                        if(!this.board[y][x].endsWith(this.color)){
                            rtn.push(`${y}${x}`);
                        }
                        break;
                    }
                    rtn.push(`${y}${x}`);
                } else {
                    break;
                }
                i++;
            }
        }

        return rtn;
    }
}