import React, { useState, useEffect, useRef } from "react";
import { ChatWebsocketContext } from "./ChatWebsocketContext";
import { useLobbyContext } from "../context/lobbyContext";

export const ChatWebsocketProvider = ({ children, lobbyName }) => {
<<<<<<< HEAD
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const { dispatch } = useLobbyContext();
    let retryTimeout = null;
    let retryAttempts = 0;
    const MAX_RETRIES = 5;
=======
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
    },[lobbyName]);
>>>>>>> 903d9d044f4f97693c3bcf81d042369cde8ddd8b

    useEffect(() => {
        console.log(`ChatWebsocketProvider mounted for lobby: ${lobbyName}`);
        let pendingCleanup = false;

        const initializeWebSocket = () => {
            const token = localStorage.getItem("access_token");
            if (!token) {
                console.error("Access token not found. Cannot initialize WebSocket.");
                return;
            }

            if (socketRef.current) {
                const state = socketRef.current.readyState;
                if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
                    console.warn("WebSocket already exists and is active. Skipping initialization.");
                    return;
                }
            }

            const webSocketUrl = `ws://localhost:8000/ws/chat/${lobbyName}/?token=${token}`;
            const chatWebSocket = new WebSocket(webSocketUrl);
            socketRef.current = chatWebSocket;

            chatWebSocket.onopen = () => {
                console.log(`WebSocket connected for lobby: ${lobbyName}`);
                setIsConnected(true);
                pendingCleanup = false;
                retryAttempts = 0; // Reset retry attempts on successful connection
            };

            chatWebSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log("WebSocket message received:", data);

                switch (data.type) {
                    case "chat_message":
                        dispatch({ type: "ADD_MESSAGE", payload: data.message });
                        break;
                    case "update_user_list":
                        dispatch({ type: "PLAYER_LIST", payload: data.players });
                        break;
                    case "connection_success":
                        console.log(data.message);
                        break;
                    default:
                        console.warn(`Unhandled WebSocket message type: ${data.type}`);
                }
            };

            chatWebSocket.onclose = (event) => {
                console.log(`WebSocket disconnected:`, event);
                setIsConnected(false);

                if (!pendingCleanup && retryAttempts < MAX_RETRIES) {
                    console.warn(`WebSocket closed unexpectedly. Retrying connection... (${retryAttempts + 1}/${MAX_RETRIES})`);
                    retryTimeout = setTimeout(() => {
                        retryAttempts++;
                        initializeWebSocket();
                    }, 3000);
                } else if (retryAttempts >= MAX_RETRIES) {
                    console.error("Max retries reached. Giving up on WebSocket connection.");
                }

                socketRef.current = null;
            };

            chatWebSocket.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
        };

        initializeWebSocket();

        return () => {
            console.log(`Cleaning up WebSocket for lobby: ${lobbyName}`);
            pendingCleanup = true;

            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }

            if (socketRef.current) {
                const state = socketRef.current.readyState;
                if (state === WebSocket.CONNECTING) {
                    console.log("WebSocket still connecting. Skipping immediate cleanup.");
                } else if (state === WebSocket.OPEN || state === WebSocket.CLOSING) {
                    console.log("Closing WebSocket for cleanup.");

                console.log("Cleaning up WebSocket for lobby:", lobbyName);
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    console.log("Closing open Websocket")

                    socketRef.current.close();
                } else {
                    console.log("Websocket was not open during cleanup")
                }
                socketRef.current = null;
            }
        };
    }, [lobbyName, dispatch]);

    const sendChatMessage = (content) => {
        if (!content.trim()) {
            console.error("Cannot send an empty message.");
            return;
        }

        if (socketRef.current && isConnected) {
            const payload = { type: "chat_message", message: content.trim() };
            socketRef.current.send(JSON.stringify(payload));
            console.log("Chat message sent:", payload);
        } else {
            console.error("Cannot send message: WebSocket is not connected.");
        }
    };

    const contextValue = { sendChatMessage, isConnected };

    return (
        <ChatWebsocketContext.Provider value={contextValue}>
            {children}
        </ChatWebsocketContext.Provider>
    );
};
