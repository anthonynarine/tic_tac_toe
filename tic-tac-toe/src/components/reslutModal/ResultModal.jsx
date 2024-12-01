import "./ResultModal.css";
import classNames from "classnames";

export const ResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const resultModalClasses = classNames({
    "modal-open": isGameOver,
  });

  console.log("Modal Props:", { isGameOver, winner });

  // Determine the result message
  const resultMessage = winner === "D" 
    ? "It's a draw!" // Display "It's a draw!" for a tie
    : `${winner} Wins`; // Display the winner (X or O)

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        <div id="result-container">
          <div id="winner-container">
            <span>{resultMessage}</span>
          </div>
        </div>
        <div id="new-game-container">
          <button id="new-game-button" onClick={onNewGameClicked}>
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

