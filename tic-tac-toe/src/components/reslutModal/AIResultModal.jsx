// File: src/components/AIResultModal.jsx

import "./AIResultModal.css";
import classNames from "classnames";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

/**
 * AIResultModal
 *
 * Displays game results for AI matches. Includes play again and home buttons.
 *
 * Props:
 * @param {boolean} isGameOver - Whether the game has ended.
 * @param {string} winner - The winner of the game ("X", "O", or "D" for draw).
 * @param {function} onNewGameClicked - Callback to trigger a new game.
 */
export const AIResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate();

  // Step 1: Determine the modal open class
  const resultModalClasses = classNames({
    "modal-open": isGameOver,
  });

  // Step 2: Determine the result message
  const resultMessage = winner === "D" ? "It's a Draw!" : `${winner} Wins`;

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        {/* Step 3: Winner text */}
        <div id="winner-container">
          <span>{resultMessage}</span>
        </div>

        {/* Step 4: Buttons */}
        <div className="ai-buttons-container">
          <button
            className="modal-button play-again-button"
            onClick={onNewGameClicked}
          >
            Play Again
          </button>

          <button
            className="modal-button home-button"
            onClick={() => navigate("/")}
          >
            <AiFillHome className="home-icon" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
