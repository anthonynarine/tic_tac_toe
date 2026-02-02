// # Filename: src/components/context/lobbyContext.jsx
import { createContext, useContext, useReducer } from "react";
import { lobbyReducer, INITIAL_LOBBY_STATE } from "../reducers/lobbyReducer";

// Create a context to manage lobby state
export const LobbyContext = createContext(undefined);

/**
 * Hook to easily access the LobbyContext within components.
 * This hook ensures that it is used only within the LobbyProvider.
 *
 * @returns {{ state: object, dispatch: function }} - The current lobby state and the dispatch function.
 */
export function useLobbyContext() {
  const context = useContext(LobbyContext);

  if (context === undefined) {
    throw new Error("useLobbyContext must be used within a LobbyProvider");
  }
  return context;
}

/**
 * Provides the LobbyContext to child components.
 * This provider initializes and manages the lobby state using a reducer.
 *
 * @param {object} props - React component props.
 * @param {React.ReactNode} props.children - The child components wrapped by the provider.
 * @returns {JSX.Element} - The provider component for the lobby context.
 */
export const LobbyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(lobbyReducer, INITIAL_LOBBY_STATE);

  // Step 1: Dev-only debug to confirm initialization (avoid render spam in prod)
  if (process.env.NODE_ENV !== "production") {
    // This will still log on every render; keep it lightweight.
    console.debug("LobbyProvider render:", {
      players: state.players?.length || 0,
      messages: state.messages?.length || 0,
    });
  }

  return (
    <LobbyContext.Provider value={{ state, dispatch }}>
      {children}
    </LobbyContext.Provider>
  );
};
