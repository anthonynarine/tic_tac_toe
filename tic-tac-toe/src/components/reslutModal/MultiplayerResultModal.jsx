import React, { useEffect } from "react";
import "./ResultModal.css";
import classNames from "classnames";
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
        rematchRequestBy,
        playerRole,
        rematchPending,
        game,
        rawRematchOffer,
    } = state;

    // Dynamically assign modal-open class based on modal visibility triggers
    const resultModalClasses = classNames({
        "modal-open": isGameOver || isRematchOfferVisible,
    });

    // Use countdown for the requesting player
    const countdown = useCountdown(10, rematchPending, () => {
        dispatch({ type: "HIDE_REMATCH_MODAL" });
    });

    /**
     * Initiate rematch request via WebSocket.
     */
    const handleRematchRequest = () => {
        sendMessage({ type: "rematch_request" });
        dispatch({
        type: "SHOW_REMATCH_MODAL",
        payload: {
            message: "Waiting for opponent...",
            rematchRequestBy: playerRole,
            isRematchOfferVisible: true,
            rematchPending: true,
        },
        });
    };

    /** Accept the rematch offer. */
    const handleAccept = () => sendMessage({ type: "rematch_accept" });

    /** Decline rematch offer and reset state. */
    const handleDecline = () => {
        dispatch({ type: "HIDE_REMATCH_MODAL" });
        sendMessage({ type: "rematch_decline" });
    };

    /** Reset state and return to homepage. */
    const handleGoHome = () => {
        dispatch({ type: "RESET_GAME_STATE" });
        navigate("/");
    };

    /**
     * Compute result title based on winner and player names.
     */
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

    // useEffect to handle rawRematchOffer when playerRole is available
    useEffect(() => {

        const offer = state.rawRematchOffer;
        const playerRole = state.playerRole;
        
        if (offer && playerRole) {
            const isRequester = offer.rematchRequestedBy === playerRole;
        
            dispatch({
                type: "SHOW_REMATCH_MODAL",
                payload: {
                message: offer.message ?? "",
                rematchRequestedBy: offer.rematchRequestedBy ?? null,
                isRematchOfferVisible: true,
                rematchPending: isRequester,  // <- this is what's not working correctly
                },
            });
        
            dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: null });
            }
    }, [state.rawRematchOffer, state.playerRole]);
    
    

    return (
        // Main overlay shown when modal is active
        <div id="modal-overlay" className={resultModalClasses}>
        {/* Container for modal content */}
        <div id="game-result-modal">
            {/* Display winner/draw message */}
            <div id="result-container">
            <div id="winner-container">
                <span>{resultMessage}</span>
            </div>
            </div>

            {/* Button area for actions */}
            <div id="new-game-container">
            {/* If a rematch offer is visible */}
            {isRematchOfferVisible ? (
                rematchRequestBy && rematchRequestBy !== playerRole ? (
                // 👤 Opponent sees message + Accept/Decline
                <>
                    <p className="rematch-text">{rematchMessage}</p>
                    <button className="modal-button play-again-button" onClick={handleAccept}>
                    Accept
                    </button>
                    <button
                    className="modal-button home-button"
                    onClick={handleDecline}
                    >
                    Decline
                    </button>
                </>
                ) : (
                // ✅ Requesting player sees countdown only
                <p className="rematch-text">{`${rematchMessage} Waiting... ${countdown}s`}</p>
                )
            ) : (
                // 🕹 No rematch yet - show rematch request button
                <button
                className="modal-button play-again-button"
                onClick={handleRematchRequest}
                >
                Rematch
                </button>
            )}

            {/* 🏠 Always show Home button */}
            <button className="modal-button home-button" onClick={handleGoHome}>
                <AiFillHome className="home-icon" />
                Home
            </button>
            </div>
        </div>
        </div>
    );
};
