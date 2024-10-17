import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"
import useGameServices from "../hooks/useGameServices";
import { useGameContext } from "../context/gameContext";




export const Game = () => {
  const { id } = useParams(); // Extract the game ID from the URL (React Router)
  const { state, dispatch } = useGameContext();
  const { fetchGame, makeMove, resetGame } = useGameServices(); // Destructure backend service calls from hook
  
  // Local loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


      // Helper function to start loading
  const initializeRequest = () => {
    setLoading(true);
    setError(null);
    };

    // Helper function to stop loading
  const stopLoading = () => setLoading(false);

  useEffect(() => {
    const loadGame = async () => {

      initializeRequest();
      try {
        const fetchedGame = await fetchGame(id);
        if (fetchedGame) {
          dispatch({ type: "SET_GAME", payload: fetchedGame});
        }    
      } catch (error) {
        setError("Failed to load game");
        console.error("Error fetching game", error);
      } finally {
        stopLoading();
      }
    };

    loadGame();
  }, [id, fetchGame, dispatch])

  const handleCellClick = async (cellIndex) => {
    if (state.isGameOver || state.cellValues[cellIndex] !== "") return;

    initializeRequest();
    try {
      const updatedGame = await makeMove(id, cellIndex);
      if (updatedGame) {
        dispatch({ type: "MAKE_MOVE", payload: updatedGame })
      } 
    } catch (error) {
      setError(e)
      
    }     

  };

  const restartGame = async () => {
    const resetGameState = await resetGame(id);

    if(resetGameState) {
      dispatch({ type: "RESET_GAME", payload: resetGameState})
    }
  };


  return (
    <>
      <div id="game">
        <h1>Tic Tac Toe</h1>
        <Board
          cellValues={cellValues}
          winningCombination={winningCombination}
          cellClicked={handleCellClick} 
        />
      </div>
      <ResultModal isGameOver={isGameOver} winner={winner} onNewGameClicked={restartGame}/>
    </>
  );
};
