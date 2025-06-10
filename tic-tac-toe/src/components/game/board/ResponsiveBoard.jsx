// File: components/board/ResponsiveBoard.jsx

import React from "react";
import classNames from "classnames";
import "./ResponsiveBoard.css";

/**
 * ResponsiveBoard Component
 * -------------------------------------
 * All-in-one game UI:
 * - Glowing container
 * - Title + turn indicator
 * - 3×3 board grid with dynamic cell content
 */
const ResponsiveBoard = ({
  cellValues,
  winningCombination = [],
  handleCellClick,
  isDisabled = false,
  playerRole,
  currentTurn,
  winner,
  isGameOver,
}) => {
  const renderStatus = () => {
    if (isGameOver) {
      if (winner === null) return "🤝 It's a draw!";
      return winner === playerRole ? "🏆 You won!" : "😢 You lost.";
    }

    if (currentTurn === playerRole) return "Your turn";
    return "🕒 Opponent's turn";
  };

  return (
    <div className="responsive-game-container">
      <h1 className="game-title">Tic Tac Toe</h1>

      <div
        className={classNames("turn-indicator", {
          "your-turn": !isGameOver && currentTurn === playerRole,
          "opponent-turn": !isGameOver && currentTurn !== playerRole,
          "game-over": isGameOver,
        })}
      >
        {renderStatus()}
      </div>

      <div className="board-wrapper">
        {cellValues.map((value, index) => {
          const isWinner = winningCombination.includes(index);

          const cellClass = classNames("cell", {
            winner: isWinner,
            populated: value,
          });

          return (
          <button
            key={index}
            className={cellClass}
            onClick={() => handleCellClick(index)}
            disabled={!!value || isDisabled}
            aria-label={`Cell ${index + 1}`}
          >
            <span
              className="cell-content"
              data-value={value || ""}
              aria-hidden="true"
            />
          </button>
          );
        })}
      </div>
    </div>
  );
};

export default ResponsiveBoard;
