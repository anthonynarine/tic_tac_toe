// File: src/components/MultiplayerResultModal.jsx

import React, { useEffect, useMemo } from "react";
import "./MultiplayerResultModal.css";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import { useCountdown } from "../hooks/useCountdown";

/**
 * MultiplayerResultModal
 *
 * Displays the game result and manages the rematch UI flow:
 * - Shows winner or draw result.
 * - Allows sending/accepting/declining rematch offers.
 * - Automatically handles new game starts and modal resets.
 *
 * Props:
 * @param {boolean} isGameOver - Whether the game has ended.
 * @param {string} winner - The winner ("X", "O", or "D" for draw).
 */
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

    // -----------------------
    // Step 1: Determine Player Role
    // -----------------------
    const currentPlayerRole = useMemo(() => {
        if (playerRole) return playerRole;
        if (state.user?.first_name === game?.player_x?.first_name) return "X";
        if (state.user?.first_name === game?.player_o?.first_name) return "O";
        return null;
    }, [playerRole, game, state.user]);

    // -----------------------
    // Step 2: Handle Raw Rematch Offer
    // -----------------------
    useEffect(() => {
        if (!rawRematchOffer || !currentPlayerRole) return;

        const { message, rematchRequestedBy } = rawRematchOffer;

        dispatch({
        type: "SHOW_REMATCH_MODAL",
        payload: {
            message,
            rematchRequestedBy,
            isRematchOfferVisible: true,
            rematchPending: rematchRequestedBy === currentPlayerRole,
        },
        });

        dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: null });
    }, [rawRematchOffer, currentPlayerRole, dispatch]);

    // -----------------------
    // Step 3: Auto-Hide Modal When New Game Starts
    // -----------------------
    useEffect(() => {
        if (!state.isCompleted) {
        dispatch({ type: "HIDE_REMATCH_MODAL" });
        }
    }, [state.isCompleted, dispatch]);

    // -----------------------
    // Step 4: Determine If Current User is the Rematch Requester
    // -----------------------
    const isRequester = useMemo(() => {
        return currentPlayerRole === state.rematchRequestedBy;
    }, [currentPlayerRole, state.rematchRequestedBy]);

    // -----------------------
    // Step 5: Countdown for Rematch Requester
    // -----------------------
    const countdown = useCountdown(10, isRequester, () => {
        dispatch({ type: "HIDE_REMATCH_MODAL" });
    });

    // -----------------------
    // Step 6: Button Handlers
    // -----------------------
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

    // -----------------------
    // Step 7: Prepare Result Message
    // -----------------------
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

    // -----------------------
    // Step 8: Determine Modal Visibility
    // -----------------------
    const resultModalClasses =
        isGameOver || isRematchOfferVisible ? "modal-open" : "";

    // -----------------------
    // Step 9: Render Modal UI
    // -----------------------
    return (
        <div id="modal-overlay" className={resultModalClasses}>
        <div id="game-result-modal">
            {/* Winner / Draw Message */}
            <div id="winner-container">
            <span>{resultMessage}</span>
            </div>

            {/* Rematch Offer UI */}
            <div id="new-game-container">
            {isRematchOfferVisible ? (
                isRequester ? (
                // Requester sees countdown
                <p className="rematch-text">{`${rematchMessage} Waiting... ${countdown}s`}</p>
                ) : (
                // Receiver sees Accept/Decline buttons
                <>
                    <p className="rematch-text">{rematchMessage}</p>
                    <div className="rematch-buttons">
                    <button
                        className="modal-button play-again-button"
                        onClick={handleAccept}
                    >
                        Accept
                    </button>
                    <button
                        className="modal-button decline-button"
                        onClick={handleDecline}
                    >
                        Decline
                    </button>
                    </div>
                </>
                )
            ) : (
                // No offer yet: show "Request Rematch" button
                <button
                className="modal-button play-again-button"
                onClick={handleRematchRequest}
                >
                Rematch
                </button>
            )}

            {/* Home Button */}
            <button className="modal-button home-button" onClick={handleGoHome}>
                <AiFillHome className="home-icon" />
                Home
            </button>
            </div>
        </div>
        </div>
    );
};
