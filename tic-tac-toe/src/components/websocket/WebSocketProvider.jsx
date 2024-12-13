import React, { useState, useEffect, useRef } from "react";
import { WebSocketContext } from "./WebsocketContext";
import { useGameContext } from "../context/gameContext";

/**
 * WebsocketProvider
 * 
 * This component sets up a Websocket connection for real time communication with the backend.
 * It provides "sendessage and isConnected through a context for child components"
 * @param {Objec} props - The component's props
 * @param {React.ReactNode} props.children - The child components that need access to the Websocket context.
 * @param {string} props.gameId - The game ID for establishing a Websocket connection specific to a game 
 * @returns 
 */

export const WebSocketProvider = ({ children, gameId }) => {
    // Refrence to hold the Websocket instance
    const socketRef = useRef(null);

    // State to track if the Websocket is connected
    const [isConnected, setIsConnected] = useState(false);

    // Access the game context to update the state
    const { state, dispatch } = useGameContext(); 

    // Effect to handle the Websocket Connectin lifecycle. 
    useEffect(() => {

        if(!gameId)  return;

        // Construct websocket URL with the game ID and user token for auth
        const token = localStorage.getItem("acces_token");
        const webSocketUrl = `ws://localhost:8000/ws/lobby/${gameId}/?token=${token}`;

        const webSocket = new WebSocket(webSocketUrl);
        socketRef.current = webSocket;

        // When the Websocket connection opens
        webSocket.onopen = () => {
            console.log(`Websocket connected for game: ${gameId}`);
            setIsConnected(true);
        };

        // When a message is received via Websocket
        webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Websocket message recieved:", data);
        
            // Handle specific message types (e.g game updates)
            if (data.type === "game_update") {
                dispatch({
                    type: "UPDATE_GAME_STATE",
                    pyaload: data, // Dispatch the updated game state to  the reducer
                })
            }
        };

        // When the Websocket connection is closed
        webSocket.onclose = () => {
            console.log("Websocket disconnected");
            setIsConnected(false);
        };

        // When there's an error in the Websocket connection
        webSocket.onerror = (error) => {
            console.error("Websocket error:", error);
        };

        // Clean up Websocket connection when the component or gameId changes
        return () => {
            if (socketRef.current) {
                socketRef.current.close()
            }
        };
    }, [gameId]);

    /**
     * SendMessage
     * 
     * Send a JSON-formatted message over the WebSocket connection.
     * 
     * @param {Object} message - The message payload to send
     */

    const sendMessage = (message) => {
        if (socketRef.current && isConnected) {
            socketRef.current.send(JSON.stringify(message)); // Send the message as JSON string
            console.log("Message sent:", message);
        } else {
            console.error("Cannot send message: Websocket is not connected");
        }
    };

    // Context vaue to provied WebSocket functinality to child components
    const contextValue = {
        sendMessage, // Function to send message over WebSocket
        isConnected, // State to indicate if the WebSocket is connected
    };

    // Render the context provider with the given children
    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    )
};