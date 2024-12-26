import "./ResultModal.css";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";
import { AiFillHome } from "react-icons/ai"; // Import the home icon
import { useGameContext } from "../context/gameContext";

export const ResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate(); // Hook for navigation
  const { dispatch } = useGameContext();

  const resultModalClasses = classNames({
    "modal-open": isGameOver,
  });

  // Debug logs
  // console.log("Modal Props:", { isGameOver, winner, game });
  // console.log("onNewGameClicked in ResultModal:", onNewGameClicked);


  // Determine the result message
  const resultMessage =
    winner === "D" ? "It's a draw!" : `${winner} Wins`; // Display result message

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        <div id="result-container">
          <div id="winner-container">
            <span>{resultMessage}</span>
          </div>
        </div>
        <div id="new-game-container">
          {/* Play Again Button */}
          <button
            className="modal-button play-again-button"
            onClick={() => {
              console.log("Play Again button clicked");
              if (onNewGameClicked) {
                onNewGameClicked(); // Ensure the function is called if it's defined
              } else {
                console.warn("onNewGameClicked is not defined");
              }
            }}
          >
            Play Again
          </button>
          {/* Home Button */}
          <button
            className="modal-button home-button"
            onClick={() => {
              dispatch({ type: "RESET_GAME_STATE" }); // Reset the game state
              navigate("/"); // Navigate to the homepage
            }}
          >
            <AiFillHome className="home-icon" /> {/* Add the home icon */}
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
