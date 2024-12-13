import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useGameServices from "../hooks/useGameServices";
import { useGameContext } from "../context/gameContext";
import { WebSocketProvider } from "../websocket/WebSocketProvider";
// import ToastTester from "../../utils/toast/ToastInComponentTester";

export const Game = () => {
  const { id: gameId } = useParams(); // Extract the game ID from the URL (React Router)
  const { state, dispatch } = useGameContext(); // Get current game state and dispatch function from context
  const { fetchGame, makeMove, playAgainAI, completeGame } = useGameServices(); // Destructure backend service calls from custom hook


  useEffect(() => {
    console.log("Game state updated:", state);
  }, [state]);

  // Component loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to start loading (used to set loading state)
  const initializeRequest = () => {
    setLoading(true);
    setError(null);
  };

  // Helper function to stop loading (used when API calls are completed)
  const stopLoading = () => setLoading(false);

  // Fetch game data when the component mounts or when the game ID changes
  useEffect(() => {
    const loadGame = async () => {
      initializeRequest();
      try {
        const fetchedGame = await fetchGame(gameId); // Call the fetchGame service to get game data
        if (fetchedGame) {
          console.log("fetched game Data:", fetchedGame)
          dispatch({ type: "SET_GAME", payload: fetchedGame }); // Dispatch action to set game state
        }
      } catch (error) {
        setError("Failed to load game"); // Set error message if fetching fails
        console.error("Error fetching game", error);
      } finally {
        stopLoading(); // Stop loading state
      }
    };

    loadGame(); // Invoke loadGame to fetch data when the component mounts
  }, [gameId, dispatch]); // Dependencies: run the effect when 'id' changes or if fetchGame or dispatch functions change

  /**
   * Handle click on a cell in the Tic Tac Toe board.
   * 
   * @param {number} cellIndex - The index of the cell that was clicked (0 to 8 in a 3x3 grid).
   * 
   * This function ensures that only valid moves are processed. A move is considered valid if:
   * - The game is not over (`state.isGameOver` is false).
   * - The clicked cell is empty (i.e., the value of `state.cellValues[cellIndex]` is an empty string).
   * 
   * If the move is valid, it calls the `makeMove` function (which communicates with the backend),
   * updates the game state using the updated game data, and stops the loading state when the operation is complete.
   */
  const handleCellClick = async (cellIndex) => {
    // Prevent invalid moves: if the game is over or the cell is already filled, do nothing
    console.log("cell clicked:", cellIndex);

    if (state.isGameOver || state.cellValues[cellIndex] !== "") return;


    try {
      const updatedGame = await makeMove(gameId, cellIndex); // Call backend service to make a move
      if (updatedGame) {
        dispatch({ type: "MAKE_MOVE", payload: updatedGame }); // Dispatch action to update the state with the new game data
      }
    } catch (error) {
      console.error("Error making move:", error); // Log any errors that occur during the move
    } finally {
      stopLoading(); // Stop loading state after the request finishes
    }
  };

  /**
   * Automatically trigger the completeGame function when the game ends navigate to the homepage
   */
  useEffect(() => {
    const finalizeGame = async () => {
      if (state.isGameOver && state.winner) {
        await completeGame(gameId, state.winner); // Complete the game
      }
    };

    finalizeGame(); 
  }, [state.isGameOver, state.winner, gameId,])

  return (
    <WebSocketProvider gameId={gameId}>
      <div id="game">
        {loading ? (
          <p>Loading...</p> // Display loading state
        ) : (
          <>
            <h1>Tic Tac Toe</h1>
            {/* Render the Board component, passing necessary props */}
            <Board
              cellValues={state.cellValues}
              winningCombination={state.winningCombination}
              cellClicked={handleCellClick} // Pass the handleCellClick function to handle user interactions
            />
            {/* Render ResultModal to show game result */}
            {console.log("Modal Props:", { isGameOver: state.isGameOver, winner: state.winner })}
            <ResultModal 
              isGameOver={state.isGameOver} 
              winner={state.winner} 
              onNewGameClicked={playAgainAI} // Pass the restartGame function to handle new game action
              onCompleteGame={() => completeGame(gameId, state.winner)}
            />
          </>
        )}
        {/* <ToastTester/> */}
      </div>
    </WebSocketProvider>
  );
};
