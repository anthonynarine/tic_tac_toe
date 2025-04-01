import "./ResultModal.css";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";

export const ResultModal = ({ isGameOver, winner, onNewGameClicked, isAI }) => {
  const navigate = useNavigate();
  const { dispatch, sendMessage, state } = useGameWebSocketContext();
  const { isRematchOfferVisible, rematchMessage } = state;

  const resultModalClasses = classNames({
    "modal-open": isGameOver,
  });

  const resultMessage =
    winner === "D" ? "It's a draw!" : `${winner} Wins`;

  const handleRematchRequest = () => {
    console.log("Requesting a rematch via WebSocket");
    sendMessage({ type: "rematch_request" });
  };

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        <div id="result-container">
          <div id="winner-container">
            <span>{resultMessage}</span>
          </div>
        </div>
        <div id="new-game-container">
          {/* Play Again or Rematch Button */}
          {isAI ? (
            <button
              className="modal-button play-again-button"
              onClick={() => {
                console.log("Play Again button clicked");
                if (onNewGameClicked) {
                  onNewGameClicked();
                } else {
                  console.warn("onNewGameClicked is not defined");
                }
              }}
            >
              Play Again
            </button>
          ) : (
            <button
              className="modal-button play-again-button"
              onClick={handleRematchRequest}
            >
              Rematch
            </button>
          )}

          {/* Home Button */}
          <button
            className="modal-button home-button"
            onClick={() => {
              dispatch({ type: "RESET_GAME_STATE" });
              navigate("/");
            }}
          >
            <AiFillHome className="home-icon" />
            Home
          </button>

          {isRematchOfferVisible && (
            <div className="rematch-offer-container">
              <p>{rematchMessage}</p>
              <div className="rematch-buttons">
                <button
                  className="modal-button play-again-button"
                  onClick={() => sendMessage({ type: "rematch_accept" })}
                >
                  Accept
                </button>
                <button
                  className="modal-button"
                  onClick={() => {
                    dispatch({ type: "RESET_GAME_STATE" });
                    navigate("/");
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
