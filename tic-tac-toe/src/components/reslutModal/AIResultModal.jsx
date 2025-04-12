/**
 * AIResultModal.jsx
 *
 * Displays game results for AI matches. Includes play again and home buttons.
 *
 * Props:
 *   @param {boolean} isGameOver - Whether the game has ended.
 *   @param {string} winner - The winner of the game ("X", "O", or "D" for draw).
 *   @param {function} onNewGameClicked - Callback to trigger a new game.
 *
 * Internal Behavior:
 * - Displays a modal with the result (win/loss/draw).
 * - Shows "Play Again" and "Home" buttons for user interaction.
 */

import "./ResultModal.css";
import classNames from "classnames";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export const AIResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate();

  // Dynamically assign modal-open class only if game is over
  const resultModalClasses = classNames({
    "modal-open": isGameOver,
  });

  // Determine the result message to display
  const resultMessage = winner === "D" ? "It's a draw!" : `${winner} Wins`;

  return (
    // Main overlay that dims the background when modal is open
    <div id="modal-overlay" className={resultModalClasses}>
      {/* Modal content container */}
      <div id="game-result-modal">
        {/* Winner message display */}
        <div id="result-container">
          <div id="winner-container">
            <span>{resultMessage}</span>
          </div>
        </div>

        {/* Container for interaction buttons */}
        <div id="new-game-container">
          {/* Button to start a new game against AI */}
          <button
            className="modal-button play-again-button"
            onClick={onNewGameClicked}
          >
            Play Again
          </button>

          {/* Button to return to the homepage */}
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
