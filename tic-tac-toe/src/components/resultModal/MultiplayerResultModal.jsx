// # Filename: src/components/modals/MultiplayerResultModal.jsx
// (keep your existing path if different)

import React, { useEffect, useMemo } from "react";
import styles from "./MultiplayerResultModal.module.css";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import { useCountdown } from "../hooks/ui/useCountdown";

export const MultiplayerResultModal = ({ isGameOver, winner }) => {
  const navigate = useNavigate();
  const { dispatch, sendMessage, state } = useGameWebSocketContext();

  const {
    isRematchOfferVisible,
    rematchMessage,
    rematchPending,
    game,

    // (server-authoritative fields from reducer)
    rematchShowActions,
    rematchUiMode,
    rematchRequesterUserId,
    rematchReceiverUserId,
    rematchCreatedAtMs,
    rematchGameId,
    rematchButtonLocked,
  } = state;


  // Step 1: Determine whether THIS client should see Accept/Decline
  // Server now controls this via showActions, so we do not infer roles anymore.
  const shouldShowAcceptDecline = Boolean(rematchShowActions);


  // Step 2: Requester view = sees waiting/countdown (never action buttons)
  // If uiMode exists, use it. Otherwise fallback to "not receiver".
  const isRequesterView = useMemo(() => {
    if (!isRematchOfferVisible) return false;
    if (rematchUiMode) return rematchUiMode === "requester";
    return !shouldShowAcceptDecline;
  }, [isRematchOfferVisible, rematchUiMode, shouldShowAcceptDecline]);

  // Step 3: If game becomes active again (new game), ensure modal is closed
  useEffect(() => {
    if (!state.isCompleted) {
      dispatch({ type: "HIDE_REMATCH_MODAL" });
    }
  }, [state.isCompleted, dispatch]);


  // Step 4: Debug instrumentation at the UI decision point
  useEffect(() => {
    if (!isRematchOfferVisible) return;

    console.log("[REMATCH][UI_DECISION]", {
      ts: Date.now(),
      gameIdFromState: game?.id,
      rematchGameId,
      rematchCreatedAtMs,
      shouldShowAcceptDecline,
      isRequesterView,
      rematchRequesterUserId,
      rematchReceiverUserId,
      rematchPending,
      rematchMessage,
    });
  }, [
    isRematchOfferVisible,
    game?.id,
    rematchGameId,
    rematchCreatedAtMs,
    shouldShowAcceptDecline,
    isRequesterView,
    rematchRequesterUserId,
    rematchReceiverUserId,
    rematchPending,
    rematchMessage,
  ]);

  // Step 5: Countdown only for requester view
  const countdown = useCountdown(10, isRequesterView, () => {
    dispatch({ type: "HIDE_REMATCH_MODAL" });
  });

  // Step 6: Actions
  const handleRematchRequest = () => {
    dispatch({ type: "LOCK_REMATCH_BUTTON" });
    sendMessage({ type: "rematch_request" });
  };

  const handleAccept = () => {
    dispatch({ type: "LOCK_REMATCH_BUTTON" });
    dispatch({ type: "HIDE_REMATCH_MODAL" });
    sendMessage({ type: "rematch_accept" });
  };

  const handleDecline = () => {
    // Step 1: Close UI immediately
    dispatch({ type: "HIDE_REMATCH_MODAL" });

    // Step 2: Notify server
    sendMessage({ type: "rematch_decline" });
  };

  const handleGoHome = () => {
    dispatch({ type: "RESET_GAME_STATE" });
    navigate("/");
  };

  // Step 7: Winner text
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

  // Step 8: Modal open logic
  const resultModalClasses =
    isGameOver || isRematchOfferVisible ? styles.modalOpen : "";

  return (
    <div className={`${styles.modalOverlay} ${resultModalClasses}`}>
      <div className={styles.modalBox}>
        <div className={styles.winnerText}>{resultMessage}</div>

        <div className={styles.buttonGroup}>
          {isRematchOfferVisible ? (
            shouldShowAcceptDecline ? (
              <>
                <p className={styles.rematchText}>{rematchMessage}</p>

                <div className={styles.rematchButtons}>
                  <button
                    className={styles.modalButton}
                    onClick={handleAccept}
                    disabled={rematchButtonLocked}
                  >
                    Accept
                  </button>

                  <button
                    className={`${styles.modalButton} ${styles.danger}`}
                    onClick={handleDecline}
                    disabled={rematchButtonLocked}
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
            <button
              className={styles.modalButton}
              onClick={handleRematchRequest}
              disabled={rematchButtonLocked}
            >
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
