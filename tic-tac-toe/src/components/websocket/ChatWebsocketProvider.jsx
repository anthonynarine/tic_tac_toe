import React, { useState, useEffect, useRef } from "react";
import { ChatWebsocketContext } from "./ChatWebsocketContext";
import { useLobbyContext } from "../context/lobbyContext";

/**
 * ChatWebsocketProvider
 * 
 * Provides WebSocket functionality for chat in a specific lobby. It establishes a WebSocket
 * connection, listens for incoming messages, and provides methods to send messages.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that need access to the WebSocket.
 * @param {string} props.lobbyName - The lobby name used to establish the WebSocket connection.
 * @returns {JSX.Element} - A context provider for the chat WebSocket.
 */
export const ChatWebsocketProvider = ({ children, lobbyName }) => {
    // STEP 1: Setup references and state
    const socketRef = useRef(null); // Reference to hold the WebSocket instance
    const [isConnected, setIsConnected] = useState(false); // State to track WebSocket connection status
    const { dispatch } = useLobbyContext(); // Access the lobby reducer's dispatch function

    // STEP 2: Establish WebSocket connection on lobbyName change
    useEffect(() => {
        if (!lobbyName) return; // Exit if no lobbyName is provided

        const token = localStorage.getItem("access_token"); // Retrieve token for authentication
        if (!token) {
            console.error("Access token not found. Cannot initialize WebSocket.");
            return;
        }

        // Construct WebSocket URL using the lobby name and token
        const webSocketUrl = `ws://localhost:8000/ws/chat/${lobbyName}/?token=${token}`;
        const chatWebSocket = new WebSocket(webSocketUrl);

        // Store the WebSocket instance in a ref for cleanup later
        socketRef.current = chatWebSocket;

        // WebSocket 'onopen' handler: Called when the connection is established
        chatWebSocket.onopen = () => {
            console.log(`Chat WebSocket connected for lobby: ${lobbyName}`);
            setIsConnected(true); // Update connection state
        };

        // WebSocket 'onmessage' handler: Processes incoming messages
        chatWebSocket.onmessage = (event) => {
            try {
                // STEP 3: Parse and handle incoming WebSocket messages
                const data = JSON.parse(event.data);
                console.log("Chat WebSocket message received:", data);

                // Handle messages based on their type
                if (data.type === "chat_message") {
                    console.log("New chat message received:", data.message);
                    dispatch({ type: "ADD_MESSAGE", payload: data.message }); // Store received message for UI
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        // WebSocket 'onclose' handler: Called when the connection is closed
        chatWebSocket.onclose = (event) => {
            console.log("Chat WebSocket disconnected.", event);
            setIsConnected(false);
        };

        // WebSocket 'onerror' handler: Called when an error occurs
        chatWebSocket.onerror = (error) => {
            console.error("Chat WebSocket error:", error);
        };

        // STEP 4: Cleanup WebSocket on component unmount or lobbyName change
        return () => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                console.log("Closing WebSocket connection for lobby:", lobbyName);
                socketRef.current.close();
            }
        };
        
    }, [lobbyName, dispatch]); // Rerun effect when lobbyName changes

    // STEP 5: Method to send a chat message over the WebSocket
    /**
     * Sends a chat message through the WebSocket connection.
     *
     * @param {string} content - The chat message content to send.
     */
    const sendChatMessage = (content) => {
        console.log("Received content:", content); // Add this to see what is being passed
        console.log("Type of content:", typeof content);
    
        if (typeof content !== "string") {
            console.error("Invalid message content: Expected a string.");
            return; // Exit early if the content is not a string
        }
    
        if (socketRef.current && isConnected) {
            const payload = {
                type: "chat_message", // Fixed message type
                message: content.trim(), // Ensure the message is a trimmed string
            };
    
            socketRef.current.send(JSON.stringify(payload)); // Send message as JSON
            console.log("Chat message sent:", payload);
        } else {
            console.error("Cannot send chat message: WebSocket is not connected.");
        }
    };
    
    


    // STEP 6: Define context value and render the provider
    const contextValue = {
        sendChatMessage, // Function to send messages
        isConnected, // Connection status
    };

    return (
        <ChatWebsocketContext.Provider value={contextValue}>
            {children}
        </ChatWebsocketContext.Provider>
    );
};
