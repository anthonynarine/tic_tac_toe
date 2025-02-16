import React, { useState, useEffect, useRef, useReducer } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GameWebSocketContext } from "./GameWebsocketContext";
import { showToast } from "../../utils/toast/Toast";
import gameWebsocketActions from "./gameWebsocketActions";
import { gameReducer, INITIAL_STATE } from "../reducers/gameReducer";

/**
 * GameWebSocketProvider
 * 
 * Manages the WebSocket connection and game state for a specific game ID.
 * Provides game state, dispatch, and WebSocket communication to child components.
 * 
 * @param {Object} props - The component's props.
 * @param {React.ReactNode} props.children - Child components requiring game context.
 * @param {string} [props.gameId] - Optional game ID. Extracted from route if not provided.
 * 
 * @returns {JSX.Element} The GameWebSocketProvider component.
 */
export const GameWebSocketProvider = ({ children, gameId }) => {
    const { id: routeGameId } = useParams(); // Get game ID from the route
    const effectiveGameId = gameId || routeGameId; // Use the prop if available, fallback to route
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!effectiveGameId){
            console.error("Effective game ID is undefiend")
            return;
        }
        console.log("Attempting game WebSocket connection with gameId:", effectiveGameId);

        const token = localStorage.getItem("access_token");
        if (!token) {
            console.error("Access token not found. Cannot initialize WebSocket.");
            return;
        }

        const gameWebSocketUrl = `ws://localhost:8000/ws/game/${effectiveGameId}/?token=${token}`;
        const gameWebSocket = new WebSocket(gameWebSocketUrl);
        socketRef.current = gameWebSocket;

        gameWebSocket.onopen = () => {
            console.log(`WebSocket connected for game: ${effectiveGameId}`);
            setIsConnected(true);
            showToast("success", "Successfully connected to the game WebSocket.");
        };

        gameWebSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WebSocket message received:", data);

            const actions = gameWebsocketActions(dispatch, navigate);
            if (actions[data.type]) {
                actions[data.type](data);
            } else {
                console.warn(`Unhandled WebSocket message type: ${data.type}`);
            }
        };

        gameWebSocket.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
            socketRef.current = null; // Clear the reference
        };

        gameWebSocket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null; // Ensure cleanup
            }
        };
    }, [effectiveGameId, navigate]);

    const sendMessage = (message) => {
        if (socketRef.current && isConnected) {
            socketRef.current.send(JSON.stringify(message));
            console.log("Message sent:", message);
        } else {
            console.error("Cannot send message: WebSocket is not connected");
        }
    };

    const contextValue = {
        state,        // Game state managed by useReducer
        dispatch,     // Dispatch function to update state
        sendMessage,  // Function to send WebSocket messages
        isConnected,  // WebSocket connection status
    };

    return (
        <GameWebSocketContext.Provider value={contextValue}>
            {children}
        </GameWebSocketContext.Provider>
    );
};
