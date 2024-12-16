import { Board } from "../board/Board";

/**
 * GameBoard Component
 * 
 * Encapsulates the game board rendering and interaction logic.
 * 
 * Props:
 * - cellValues (array): Current state of the game board.
 * - winningCombination (array): Indices of the winning combination (if any).
 * - handleCellClick (function): Function to handle a cell click event.
 * - isDisabled (boolean): Indicates if the board is disabled.
 */
const GameBoard = ({ cellValues, winningCombination, handleCellClick, isDisabled }) => {

    console.log("GameBoard Props:", { handleCellClick, isDisabled });
    
    return (
        <Board
        cellValues={cellValues}
        winningCombination={winningCombination}
        cellClicked={handleCellClick}
        isDisabled={isDisabled}
        />
    );
};

export default GameBoard;
