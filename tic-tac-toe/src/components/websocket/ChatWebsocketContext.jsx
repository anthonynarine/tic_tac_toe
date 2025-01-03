import { createContext, useContext } from "react";


// Create the Websocket context
export const ChatWebsocketContext = createContext(undefined);

// Hook for consuming the WebSocket context
export function useChatWebSocketContext() {
    const context = useContext(ChatWebsocketContext);

    if (context === undefined) {
        throw new Error("useWebSocketContest must be used within a WebSocketProvider");
    }
    return context;
};