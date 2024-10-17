// Initial State for the game
export const INITIAL_STATE = {
    cellValues: ["", "", "", "", "", "", "", "", ""],  // The current state of the board
    xIsNext: true,  // Boolean to determine whose turn it is (X or O)
    isGameOver: false, // Boolean to track if the game has ended
    numOfTurnsLeft: 9, // Tracks the number of remaining turns
    winner: null, // Holds the winner (if the game is over)
    winningCombination: [], // Holds the winning combination of cells
    game: null, // Stores the complete game object fetched from the backend
    isAI: false, // Tracks if the game is against AI
};

// Reducer function to handle the game state transitions
export const gameReducer = (state, action) => {
    switch (action.type) {
        // Handles setting the initial game state when a game is loaded
        case "SET_GAME":
            return {
                ...state,  // Spread the current state to preserve other state properties
                game: action.payload,  // The full game object from the backend
                cellValues: action.payload.board_state.split(""),  // Convert the board_state string into an array
                xIsNext: action.payload.current_turn === "X",  // Determine if it's X's turn based on the current_turn value
                isGameOver: !!action.payload.winner,  // If there's a winner, set the game as over
                winner: action.payload.winner,  // Set the winner if the game has ended
                winningCombination: action.payload.winning_combination || [],  // Set the winning combination, if any
                numOfTurnsLeft: action.payload.board_state.split("").filter(cell => cell === "").length,  // Count the remaining empty cells
                isAI: action.payload.player_o === "ai@tictactoe.com",  // Check if the opponent is the AI
            };

        // Case to handle when a player or AI makes a move
        case "MAKE_MOVE":
            return {
                ...state,  // Keep the current state but update the board and game progression
                cellValues: action.payload.board_state.split(""),  // Update the board state after a move
                xIsNext: action.payload.current_turn === "X",  // Set the current player's turn based on the updated game data
                isGameOver: !!action.payload.winner,  // Set isGameOver to true if the game has ended with a winner
                winner: action.payload.winner,  // Update the winner if there is one after this move
                winningCombination: action.payload.winning_combination || [],  // Update the winning combination of cells (if any)
                numOfTurnsLeft: action.payload.board_state.split("").filter(cell => cell === "").length,  // Calculate how many turns are left
            };
        
        // Case to handle when the game is reset to the initial state
        case "RESET_GAME":
            return {
                ...state, // Keep the current state but reset relevant properties for a new game
                cellValues: action.payload.board_state.split(""),  // Reset the board to an empty state
                xIsNext: true,  // Set the game to start with Player X
                isGameOver: false,  // Reset the game over state
                winner: null,  // Clear the winner
                winningCombination: [],  // Clear the winning combination
                numOfTurnsLeft: 9,  // Reset the number of turns to the initial state
            };

        // The default case that returns the current state if no action type matches
        default:
            return state;
    }
};
