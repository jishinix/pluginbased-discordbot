import ChessPiece from "../ChessPiece.js";
import { boardType, Position } from "../TicTacChess.js";


export default class Pferd extends ChessPiece{

    constructor(position: Position, board: boardType, color: string){
        super(position, board, color);
    }

    getAllValidMovesAsStringArray(): string[] {

        const rtn: string[] = [];
        const directions = [
            [0, -1], // Oben links
            [1, 0],  // Oben rechts
            [0, 1],   // Unten rechts
            [-1, 0]   // Unten links
        ];
        
        for (const [dx, dy] of directions) {

            for(let i = 0; i < 2; i++){
                const x = this.position.x + (dx === 0 ? (i === 0 ? -1 : 1) : dx * 2)
                const y = this.position.y + (dy === 0 ? (i === 0 ? -1 : 1) : dy * 2)
                if (x >= 0 && y >= 0 && x <= 3 && y <= 3) {
                    if(this.board[y][x] !== null){
                        if(!this.board[y][x].endsWith(this.color)){
                            rtn.push(`${y}${x}`);
                        }
                    }else{
                        rtn.push(`${y}${x}`);
                    }
                }
            }
        }

        return rtn;
    }
}