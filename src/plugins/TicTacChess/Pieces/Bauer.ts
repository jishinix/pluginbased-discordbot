import ChessPiece from "../ChessPiece.js";
import { boardType, Position } from "../TicTacChess.js";


export default class bauer extends ChessPiece{

    constructor(position: Position, board: boardType, color: string){
        super(position, board, color);
    }

    getAllValidMovesAsStringArray(): string[] {

        const rtn: string[] = [];
        const directions = [
            [-1, -1],
            [1, -1], 
        ];
        
        for (const [dx, dy] of directions) {
            const x = this.position.x + dx;
            const y = this.position.y + dy;
            if (x >= 0 && y >= 0 && x <= 3 && y <= 3) {
                if(this.board[y][x] && 
                    (
                        (this.board[this.position.y][this.position.x]?.endsWith('w') && this.board[y][x].endsWith('b')) ||
                        (this.board[this.position.y][this.position.x]?.endsWith('b') && this.board[y][x].endsWith('w'))
                    )
                ){
                    
                        rtn.push(`${y}${x}`);
                }
            }
        }
        if (this.position.x >= 0 && this.position.y-1 >= 0 && this.position.x <= 3 && this.position.y-1 <= 3) {
            if(!this.board[this.position.y-1][this.position.x]){
                
                rtn.push(`${this.position.y-1}${this.position.x}`);
            }
        }

        return rtn;
    }
}