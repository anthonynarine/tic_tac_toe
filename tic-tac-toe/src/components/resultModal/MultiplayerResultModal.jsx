// File: MultiplayerResultModal.jsx

import React, { useEffect, useMemo } from "react";
import  styles from "./MultiplayerResultModal.module.css";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import { useCountdown } from "../hooks/useCountdown";

export const MultiplayerResultModal = ({ isGameOver, winner }) => {
  const navigate = useNavigate();
  const { dispatch, sendMessage, state } = useGameWebSocketContext();

  const {
    isRematchOfferVisible,
    rematchMessage,
    playerRole,
    rematchPending,
    game,
    rawRematchOffer,
  } = state;

  const currentPlayerRole = useMemo(() => {
    if (playerRole) return playerRole;
    if (state.user?.first_name === game?.player_x?.first_name) return "X";
    if (state.user?.first_name === game?.player_o?.first_name) return "O";
    return null;
  }, [playerRole, game, state.user]);

  useEffect(() => {
    if (!rawRematchOffer || !currentPlayerRole) return;

    const { message, rematchRequestedBy } = rawRematchOffer;

    console.log("🔥 Rematch Offer Received:");
    console.log("Current Player Role:", currentPlayerRole);
    console.log("Requested By:", rematchRequestedBy);

    dispatch({
      type: "SHOW_REMATCH_MODAL",
      payload: {
        message,
        rematchRequestedBy,
        isRematchOfferVisible: true,
        rematchPending: currentPlayerRole !== rematchRequestedBy,
      },
    });

    dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: null });
  }, [rawRematchOffer, currentPlayerRole, dispatch]);


  useEffect(() => {
    if (!state.isCompleted) {
      dispatch({ type: "HIDE_REMATCH_MODAL" });
    }
  }, [state.isCompleted, dispatch]);

  const isRequester = useMemo(() => {
    return currentPlayerRole === state.rematchRequestedBy;
  }, [currentPlayerRole, state.rematchRequestedBy]);

  const countdown = useCountdown(10, isRequester, () => {
    dispatch({ type: "HIDE_REMATCH_MODAL" });
  });

  const handleRematchRequest = () => sendMessage({ type: "rematch_request" });
  const handleAccept = () => sendMessage({ type: "rematch_accept" });
  const handleDecline = () => {
    dispatch({ type: "HIDE_REMATCH_MODAL" });
    sendMessage({ type: "rematch_decline" });
  };
  const handleGoHome = () => {
    dispatch({ type: "RESET_GAME_STATE" });
    navigate("/");
  };

  const resultMessage = (() => {
    if (winner === "D") return "It's a draw!";
    const winningPlayer =
      winner === "X"
        ? game?.player_x?.first_name || "Player X"
        : winner === "O"
        ? game?.player_o?.first_name || "Player O"
        : null;
    return winningPlayer ? `${winningPlayer} Wins` : `${winner} Wins`;
  })();

  const resultModalClasses =
    isGameOver || isRematchOfferVisible ? styles.modalOpen : "";

  console.log("🏁 isRematchOfferVisible:", isRematchOfferVisible);
  console.log("🏁 rematchPending:", rematchPending);
  console.log("🏁 Current Role:", currentPlayerRole);
  console.log("🏁 Requested By:", state.rematchRequestedBy);


  return (
    <div className={`${styles.modalOverlay} ${resultModalClasses}`}>
      <div className={styles.modalBox}>
        <div className={styles.winnerText}>{resultMessage}</div>

        <div className={styles.buttonGroup}>

          {isRematchOfferVisible ? (
            rematchPending ? (
              <>
                <p className={styles.rematchText}>{rematchMessage}</p>
                <div className={styles.rematchButtons}>
                  <button className={styles.modalButton} onClick={handleAccept}>
                    Accept
                  </button>
                  <button
                    className={`${styles.modalButton} ${styles.danger}`}
                    onClick={handleDecline}
                  >
                    Decline
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.rematchText}>
                {`${rematchMessage} Waiting... ${countdown}s`}
              </p>
            )
          ) : (
            <button className={styles.modalButton} onClick={handleRematchRequest}>
              Rematch
            </button>
          )}


          <button className={styles.modalButton} onClick={handleGoHome}>
            <AiFillHome style={{ marginRight: 8 }} /> Home
          </button>
        </div>
      </div>
    </div>
  );
};
