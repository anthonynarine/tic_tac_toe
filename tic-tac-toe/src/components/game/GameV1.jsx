import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useState } from "react";
import { calculateWinner } from "../../utils/WinnerCalculator";

const INITIAL_CELL_VALUES = ["", "", "", "", "", "", "", "", ""];

export const GameV1 = () => {
  // State variables to maintain the game's status, moves, and results.
  const [cellValues, setCellValues] = useState(INITIAL_CELL_VALUES);
  const [xIsNext, setXisNext] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [numOfTurnsLeft, setNumOfTurnsLeft] = useState(9);
  const [winner, setWinner] = useState();
  const [winningCombination, setWinningCombination] = useState([]);

  // Checks if a specific cell is empty.
  const isCellEmpty = (cellIndex) => cellValues[cellIndex] === "";

  // Rstart game
  const restartGame = () => {
    setCellValues(INITIAL_CELL_VALUES);
    setXisNext(true);
    setIsGameOver(false);
    setNumOfTurnsLeft(9);
    setWinner(undefined);
    setWinningCombination([]);
  };

  // Handle a cell click event, update game state and check for winner.
  const handleCellClick = (cellIndex) => {
    if (!isCellEmpty(cellIndex)) return;

    const updatedCellValues = [...cellValues];
    updatedCellValues[cellIndex] = xIsNext ? "X" : "O";

    const newNumberOfTurnsLeft = numOfTurnsLeft - 1;

    const gameResults = calculateWinner(updatedCellValues, newNumberOfTurnsLeft, cellIndex);

    setCellValues(updatedCellValues);
    setXisNext(!xIsNext);
    setIsGameOver(gameResults.hasResult);
    setNumOfTurnsLeft(newNumberOfTurnsLeft);
    setWinner(gameResults.winner);
    setWinningCombination(gameResults.winningCombination);
  };

  return (
    <>
      <div id="game">
        <h1>Tic Tac Toe</h1>
        <Board
          cellValues={cellValues}
          winningCombination={winningCombination}
          cellClicked={handleCellClick} 
        />
      </div>
      <ResultModal isGameOver={isGameOver} winner={winner} onNewGameClicked={restartGame}/>
    </>
  );
};
