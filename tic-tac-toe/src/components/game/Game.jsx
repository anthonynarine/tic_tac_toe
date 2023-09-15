import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../boad/Board";
import { useState } from "react";

const INITIAL_CELL_VALUES = ["", "", "", "", "", "", "", "", ""];

export const Game = () => {
  // State definitions
  const [cellValues, setCellValues] = useState(INITIAL_CELL_VALUES);
  const [xIsNext, setXisNext] = useState(true);

  // Helper functions
  const isCellEmpty = (cellIndex) => cellValues[cellIndex] === "";

  const onCellClicked = (cellIndex) => {
    if (isCellEmpty(cellIndex)) {
      updateCell(cellIndex);
    }
  };

  const updateCell = (cellIndex) => {
    const newCellValues = [...cellValues];
    newCellValues[cellIndex] = xIsNext ? "X" : "O";
    setCellValues(newCellValues);
    setXisNext(!xIsNext);
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
      <ResultModal />
    </>
  );
};
