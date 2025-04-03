/**
 * ResultModal.jsx
 *
 * This component displays the game result modal when the game ends.
 * It supports both AI and multiplayer games. In multiplayer mode, it
 * also handles the rematch request/response flow using WebSocket.
 *
 * Props:
 *   @param {boolean} isGameOver - Whether the game has ended.
 *   @param {string} winner - The winner of the game ("X", "O", or "D" for draw).
 *   @param {function} onNewGameClicked - Callback to trigger a new game (used for AI).
 *   @param {boolean} isAI - Whether the game is against an AI.
 *
 * Internal Behavior:
 * - If playing vs AI, shows "Play Again" and "Home" buttons.
 * - If multiplayer:
 *   - Shows "Rematch" button to requester.
 *   - If rematch request is sent, the requester sees a countdown.
 *   - The second player sees Accept/Decline and Home buttons.
 */

import "./ResultModal.css";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import { useEffect, useState } from "react";

export const ResultModal = ({ isGameOver, winner, onNewGameClicked, isAI }) => {
  const navigate = useNavigate();
  const { dispatch, sendMessage, state } = useGameWebSocketContext();

  const {
    isRematchOfferVisible,
    rematchMessage,
    rematchRequestBy,
    playerRole,
    rematchPending,
  } = state;

  const resultModalClasses = classNames({
    "modal-open": isGameOver || isRematchOfferVisible,
  });

  const [countdown, setCountdown] = useState(10);

  /**
   * Side effect: countdown timer for the player who sent the rematch request.
   * If time runs out, hides the rematch modal.
   */
  useEffect(() => {
    if (rematchPending) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            dispatch({ type: "HIDE_REMATCH_MODAL" });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setCountdown(10); // reset timer when rematchPending becomes false
    }
  }, [rematchPending]);

  /**
   * Handle rematch request by sending a WebSocket message
   * and showing a countdown modal while waiting for opponent's response.
   */
  const handleRematchRequest = () => {
    sendMessage({ type: "rematch_request" });
    dispatch({ type: "SHOW_REMATCH_MODAL", payload: "Waiting for opponent..." });
    dispatch({ type: "SET_REMATCH_PENDING", payload: true });
  };

  /** Send rematch_accept WebSocket message */
  const handleAccept = () => sendMessage({ type: "rematch_accept" });

  /** Send decline (optional) and reset state */
  const handleDecline = () => {
    dispatch({ type: "HIDE_REMATCH_MODAL" });
    sendMessage({ type: "rematch_decline" }); // Optional, based on backend support
  };

  /** Reset state and return to homepage */
  const handleGoHome = () => {
    dispatch({ type: "RESET_GAME_STATE" });
    navigate("/");
  };

  /** Compute result display message */
  const resultMessage = winner === "D" ? "It's a draw!" : `${winner} Wins`;

  return (
    <div id="modal-overlay" className={resultModalClasses}>
      <div id="game-result-modal">
        <div id="result-container">
          <div id="winner-container">
            <span>{resultMessage}</span>
          </div>
        </div>

        <div id="new-game-container">
          {/* Step 1: If AI, show play again immediately */}
          {isAI ? (
            <button
              className="modal-button play-again-button"
              onClick={onNewGameClicked}
            >
              Play Again
            </button>
          ) : isRematchOfferVisible ? (
            /**
             * Step 2: If multiplayer and rematch modal is open,
             * show different views based on requester vs recipient.
             */
            rematchRequestBy && rematchRequestBy !== playerRole ? (
              <>
                <p>{rematchMessage}</p>
                <button className="modal-button play-again-button" onClick={handleAccept}>
                  Accept
                </button>
                <button className="modal-button home-button" onClick={handleDecline}>
                  Decline
                </button>
              </>
            ) : (
              <>
                <p>{rematchMessage}</p>
                <p>Waiting... {countdown}s</p>
              </>
            )
          ) : (
            // Step 3: Normal state - show "Rematch" button
            <button className="modal-button play-again-button" onClick={handleRematchRequest}>
              Rematch
            </button>
          )}

          <button className="modal-button home-button" onClick={handleGoHome}>
            <AiFillHome className="home-icon" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
