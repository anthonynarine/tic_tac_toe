import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useGameServices from "../hooks/useGameServices";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import { useWebSocketContext } from "../websocket/WebsocketContext";

export const GameComponent = () => {
  const { id: gameId } = useParams(); // Extract the game ID from the URL (React Router)
  const { state, dispatch } = useGameWebSocketContext(); // Get current game state and dispatch function from context
  const { fetchGame, makeMove, playAgainAI, completeGame } = useGameServices(); // Destructure backend service calls from custom hook
  const { sendMessage, isConnected } = useWebSocketContext(); // Access WebSocket functions from WebSocketContext

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
      if (!state.game || state.game.id !== gameId) {
        initializeRequest();
        try {
          const fetchedGame = await fetchGame(gameId); // Call the fetchGame service to get game data
          if (fetchedGame) {
            console.log("Fetched game data:", fetchedGame);
            dispatch({ type: "SET_GAME", payload: fetchedGame }); // Dispatch action to set game state
          }
        } catch (error) {
          setError("Failed to load game"); // Set error message if fetching fails
          console.error("Error fetching game", error);
        } finally {
          stopLoading(); // Stop loading state
        }
      };
    };
    loadGame();
  }, [gameId, dispatch]);

  /**
   * Handle click on a cell in the Tic Tac Toe board.
   *
   * @param {number} cellIndex - The index of the cell that was clicked (0 to 8 in a 3x3 grid).
   */
  const handleCellClick = async (cellIndex) => {
    console.log("Cell clicked:", cellIndex);

    if (state.isGameOver || state.cellValues[cellIndex] !== "") return;

    const isCurrentPlayerTurn = (state.xIsNext && state.game.current_turn === "X") || 
                                (!state.xIsNext && state.game.current_turn === "O");

    if (!isCurrentPlayerTurn) {
      alert("It's not your turn!");
      return;
    }

    if (state.isAI) {
      try {
        const updatedGame = await makeMove(gameId, cellIndex); // Call backend service to make a move
        if (updatedGame) {
          dispatch({ type: "MAKE_MOVE", payload: updatedGame }); // Dispatch action to update the state with the new game data
        }
      } catch (error) {
        console.error("Error making move:", error); // Log any errors that occur during the move
      }
    } else {
      try {
        if (isConnected) {
          sendMessage({
            type: "move",
            position: cellIndex,
          });
        } else {
          console.error("Cannot send move: WebSocket is not connected");
        }
      } catch (error) {
        console.error("Error sending move via WebSocket:", error);
      }
    }
  };

  /**
   * Automatically trigger the completeGame function when the game ends.
   */
  useEffect(() => {
    const finalizeGame = async () => {
      if (state.isGameOver && state.winner) {
        try {
          await completeGame(gameId, state.winner); // Complete the game
        } catch (error) {
          console.error("Error completing game:", error);
        }
      }
    };

    finalizeGame();
  }, [state.isGameOver, state.winner, gameId, completeGame]);

  return (
    <div id="game">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h1>Tic Tac Toe</h1>
          <Board
            cellValues={state.cellValues}
            winningCombination={state.winningCombination}
            cellClicked={handleCellClick}
            isDisabled={(state.xIsNext && state.game.current_turn !== "X") || (!state.xIsNext && state.game.current_turn !== "O")}
          />
          <ResultModal
            isGameOver={state.isGameOver}
            winner={state.winner}
            onNewGameClicked={playAgainAI}
            onCompleteGame={() => completeGame(gameId, state.winner)}
          />
        </>
      )}
    </div>
  );
};

export default GameComponent