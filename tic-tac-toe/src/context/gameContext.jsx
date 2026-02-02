import { createContext, useContext, useReducer } from "react";
import { gameReducer, INITIAL_STATE } from "../reducers/gameReducer";

// Create a context to hold user data and login status
export const GameContext = createContext(undefined);

// Hook to easily access the UserContext within components
export function useGameContext() {
    const context = useContext(GameContext);

    if (context === undefined) {
        throw new Error("useUserContext must be used within a GameProvider");
    }
    return context;
};

export const GameProvider = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE)

    return (
        <GameContext.Provider value={{ state, dispatch}}>
            {children}
        </GameContext.Provider>
    )
}