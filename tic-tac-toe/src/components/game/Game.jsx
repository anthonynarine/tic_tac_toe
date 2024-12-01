import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import "./Game.css";
import { Board } from "../board/Board";
import { ResultModal } from "../reslutModal/ResultModal";
// import ToastTester from "../../utils/toast/ToastInComponentTester";

import useGameServices from "../hooks/useGameServices";
import { useGameContext } from "../context/gameContext";

export const Game = () => {
  const { id } = useParams(); // Extract the game ID from the URL (React Router)
  const navigate = useNavigate();

  const { state, dispatch } = useGameContext(); // Get current game state and dispatch function from context
  const { fetchGame, makeMove, resetGame, completeGame } = useGameServices(); // Destructure backend service calls from custom hook

  // Component loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper functions to manage loading state
  const initializeRequest = () => {
    setLoading(true);
    setError(null);
  };

  const stopLoading = () => setLoading(false);

  // Fetch game data when the component mounts or when the game ID changes
  useEffect(() => {
    const loadGame = async () => {
      initializeRequest();
      try {
        const fetchedGame = await fetchGame(id);
        if (fetchedGame) {
          console.log("Fetched game:", fetchedGame);
          dispatch({ type: "SET_GAME", payload: fetchedGame });
        }
      } catch (error) {
        setError("Failed to load game");
        console.error("Error fetching game:", error);
      } finally {
        stopLoading();
      }
    };

    loadGame();
  }, [id, fetchGame, dispatch]);

  // Log game state updates
  useEffect(() => {
    console.log("Game state updated:", state);
  }, [state]);

  // Handle cell click during gameplay
  const handleCellClick = async (cellIndex) => {
    console.log("Cell clicked:", cellIndex);

    if (state.isGameOver || state.cellValues[cellIndex] !== "") return;

    initializeRequest();
    try {
      const updatedGame = await makeMove(id, cellIndex);
      if (updatedGame) {
        dispatch({ type: "MAKE_MOVE", payload: updatedGame });
      }
    } catch (error) {
      console.error("Error making move:", error);
    } finally {
      stopLoading();
    }
  };

  // Restart the current game
  const restartGame = async () => {
    initializeRequest();
    try {
      const resetGameState = await resetGame(id);
      if (resetGameState) {
        dispatch({ type: "RESET_GAME", payload: resetGameState });
      }
    } catch (error) {
      console.error("Error resetting game:", error);
      setError("Failed to reset game");
    } finally {
      stopLoading();
    }
  };

  // Finalize game on completion
  useEffect(() => {
    const finalizeGame = async () => {
      if (state.isGameOver && state.winner) {
        await completeGame(id, state.winner);
        navigate("/");
      }
    };

    finalizeGame();
  }, [state.isGameOver, state.winner, id, completeGame, navigate]);

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
          />
          <ResultModal
            isGameOver={state.isGameOver}
            winner={state.winner}
            onNewGameClicked={restartGame}
            onCompleteGame={() => completeGame(id, state.winner)}
          />
        </>
      )}
      {/* <ToastTester /> */}
    </div>
  );
};
