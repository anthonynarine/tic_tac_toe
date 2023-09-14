
import "./Game.css";
import { Board } from "../boad/Board";
import { useState } from "react";

export const Game = () => {
  const [cellValues, setCellValues] = useState(["", "", "", "", "", "", "", "", ""]);
  const winningCombination = [];

  const onCellClicked = (cellIndex) => {
    const newCellValues = [...cellValues];
    newCellValues[cellIndex] = "X";
    setCellValues(newCellValues);
};

  return (
    <>
      <div id="game">
        <h1>Tic Tac Toe</h1>
        <Board cellValues={cellValues} winningCombination={winningCombination} cellClicked={onCellClicked} />
      </div>

      <div id="modal-overlay">
        <div id="game-result-modal">
          <div id="result-container">
            <div id="winner-container">
              <span></span>
            </div>
          </div>
          <div id="new-game-container">
            <button id="new-game-button">Start New Game</button>
          </div>
        </div>
      </div>
    </>
  );
}

