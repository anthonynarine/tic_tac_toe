import "./ResultModal.css";
import classNames from "classnames";

export const ResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  
  const resultModalClasses = classNames({
    "modal-open": isGameOver
  });

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        <div id="result-container">
          <div id="winner-container">
            <span>{winner ? `Winner is ${winner}.` : `It's a tie.`}</span>
          </div>
        </div>
        <div id="new-game-container">
          <button id="new-game-button" onClick={onNewGameClicked}>
            Start New Game
          </button>
        </div>
      </div>
    </div>
  );
};

