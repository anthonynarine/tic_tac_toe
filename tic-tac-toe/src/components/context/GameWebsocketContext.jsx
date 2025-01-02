import { createContext, useContext } from "react";


// Create the Websocket context
export const GameWebSocketContext = createContext(undefined);

// Hook for consuming the WebSocket context
export function useGameWebSocketContext() {
    const context = useContext(GameWebSocketContext);

    if (context === undefined) {
        throw new Error("useWebSocketContest must be used within a WebSocketProvider");
    }
    return context;
};

