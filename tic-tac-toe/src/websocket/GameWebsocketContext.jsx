// # Filename: src/components/websocket/GameWebsocketContext.jsx


import { createContext, useContext } from "react";

// Step 1: Create the WebSocket context
export const GameWebSocketContext = createContext(undefined);

// Step 2: Hook for consuming the WebSocket context
export function useGameWebSocketContext() {
  const context = useContext(GameWebSocketContext);

  if (context === undefined) {
    throw new Error("useGameWebSocketContext must be used within a GameWebSocketProvider");
  }

  return context;
}
