import { createContext, useContext } from "react";


// Create the Websocket context
export const WebSocketContext = createContext(undefined);

// Hook for consuming the WebSocket context
export function useWebSocketContext() {
    const context = useContext(WebSocketContext);

    if (context === undefined) {
        throw new Error("useWebSocketContest must be used within a WebSocketProvider");
    }
    return context;
};

