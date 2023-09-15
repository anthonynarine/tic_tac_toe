import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../boad/Board";
import { useState } from "react";
import { calculateWinner } from "../../utils/WinnerCalculator";

const INITIAL_CELL_VALUES = ["", "", "", "", "", "", "", "", ""];

export const Game = () => {
  // State definitions
  const [cellValues, setCellValues] = useState(INITIAL_CELL_VALUES);
  const [xIsNext, setXisNext] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [numOfTurnsLeft, setNumOfTurnsLeft] = useState(9);

  // Helper functions
  const isCellEmpty = (cellIndex) => cellValues[cellIndex] === "";

  const onCellClicked = (cellIndex) => {
    if (isCellEmpty(cellIndex)) {
      const newCellValues = [...cellValues];
      newCellValues[cellIndex] = xIsNext ? "X" : "O";

      const newNumberOfTurnsLeft = numOfTurnsLeft - 1;

      const calResults = calculateWinner(
        newCellValues,
        newNumberOfTurnsLeft,
        cellIndex
      );

      setCellValues(newCellValues);
      setXisNext(!xIsNext);
      setIsGameOver(calResults.hasResult);
      setNumOfTurnsLeft(newNumberOfTurnsLeft);
    }
  };

  return (
    <>
      <div id="game">
        <h1>Tic Tac Toe</h1>
        <Board
          cellValues={cellValues}
          winningCombination={[]}
          cellClicked={onCellClicked}
        />
      </div>
      <ResultModal isGameOver={isGameOver} />
    </>
  );
};
