import React, { useState, useEffect, useRef } from "react";
import { ChatWebsocketContext } from "./ChatWebsocketContext";
import { useLobbyContext } from "../context/lobbyContext";

/**
 * ChatWebsocketProvider
 * 
 * Manages WebSocket functionality for chat in a specific lobby. Establishes a single WebSocket
 * connection per lobby, handles incoming messages, and provides methods for sending messages.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - Child components that need access to the WebSocket context.
 * @param {string} props.lobbyName - The unique name of the lobby used to establish the WebSocket connection.
 * @returns {JSX.Element} - A context provider for the chat WebSocket.
 */
export const ChatWebsocketProvider = ({ children, lobbyName }) => {
    // STEP 1: Setup references and state
    const socketRef = useRef(null); // Singleton reference to the WebSocket instance
    const [isConnected, setIsConnected] = useState(false); // Tracks WebSocket connection status
    const { dispatch } = useLobbyContext(); // Access the lobby reducer's dispatch function

    /**
     * Establish a WebSocket connection to the server when the `lobbyName` changes.
     * Ensures only one WebSocket connection is active at any time for the current lobby.
     */
    useEffect(() => {
        console.log("ChatWebsocketProvider mounted for lobby:", lobbyName);

        return () => {
            console.log("ChatWebsocketProvider unmounted for lobby:", lobbyName);
        };
    }, []);

    useEffect(() => {
        console.log("Initializing WebSocket for lobby:", lobbyName);

        if (!lobbyName) return; // Exit if no lobbyName is provided

        const token = localStorage.getItem("access_token"); // Retrieve token for authentication
        if (!token) {
            console.error("Access token not found. Cannot initialize WebSocket.");
            return;
        }

        // Prevent duplicate WebSocket connections
        if (socketRef.current) {
            console.warn("WebSocket connection already exists. Skipping new connection.");
            return;
        }

        // STEP 2: Construct and initialize the WebSocket connection
        const webSocketUrl = `ws://localhost:8000/ws/chat/${lobbyName}/?token=${token}`;
        const chatWebSocket = new WebSocket(webSocketUrl);
        socketRef.current = chatWebSocket;

        // STEP 3: WebSocket event handlers
        chatWebSocket.onopen = () => {
            console.log(`WebSocket connected for lobby: ${lobbyName}`);
            setIsConnected(true); // Update connection state
        };

        chatWebSocket.onmessage = (event) => {
            try {
                // Parse and handle incoming WebSocket messages
                const data = JSON.parse(event.data);
                console.log("WebSocket message received:", data);

                if (data.type === "chat_message") {
                    console.log("New chat message received:", data.message);
                    dispatch({ type: "ADD_MESSAGE", payload: data.message }); // Update chat messages
                } else if (data.type === "update_user_list") {
                    console.log("Updated player list received:", data.players);
                    dispatch({ type: "PLAYER_LIST", payload: data.players }); // Update player list
                } else if (data.type === "connection_success") {
                    console.log(data.message); 
                } else {
                    console.warn(`Unhandled Websocket message type: ${data.type}`)
                }   
                
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        chatWebSocket.onclose = (event) => {
            console.log("WebSocket disconnected:", event);
            setIsConnected(false);
            socketRef.current = null; // Clear WebSocket reference on disconnect
        };

        chatWebSocket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        // STEP 4: Cleanup WebSocket connection on unmount or lobbyName change
        // STEP 4: Cleanup WebSocket connection on unmount or lobbyName change
        return () => {
            if (socketRef.current) {
                console.log("Cleaning up WebSocket for lobby:", lobbyName);
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.close();
                }
                socketRef.current = null; // Ensure the reference is cleared
            }
        };
    }, [lobbyName, dispatch]); // Re-run effect only if `lobbyName` changes

    // STEP 5: Method to send a chat message over the WebSocket
    /**
     * Sends a chat message through the WebSocket connection.
     *
     * @param {string} content - The chat message content to send.
     */
    const sendChatMessage = (content) => {
        if (typeof content !== "string") {
            console.error("Invalid message content: Expected a string.");
            return; // Exit if the content is not a string
        }

        if (socketRef.current && isConnected) {
            const payload = {
                type: "chat_message",
                message: content.trim(), // Trim whitespace
            };

            socketRef.current.send(JSON.stringify(payload)); // Send message as JSON
            console.log("Chat message sent:", payload);
        } else {
            console.error("Cannot send message: WebSocket is not connected.");
        }
    };

    // STEP 6: Define context value and render the provider
    const contextValue = {
        sendChatMessage, // Function for sending chat messages
        isConnected, // Connection status
    };

    return (
        <ChatWebsocketContext.Provider value={contextValue}>
            {children}
        </ChatWebsocketContext.Provider>
    );
};
