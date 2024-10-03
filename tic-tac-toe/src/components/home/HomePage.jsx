import "./HomePage.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useState } from "react";
import useGameServices from "../hooks/useGameServices";
import { useUserContext } from "../context/userContext"; // Import UserContext

const HomePage = () => {
  const { user, isLoggedIn } = useUserContext(); // Access user and isLoggedIn from UserContext
  console.log("User:", user);

  const { createNewGame, gameData, makeMove, loading, error } = useGameServices();
  const [isAIGame, setIsAIGame] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);

  const startMultiplayerGame = () => {
    createNewGame(user.first_name, false); // Use user data from context
    setIsAIGame(true);
  };

  const startAIGame = () => {
    createNewGame(user.first_name, true); // Use user data from context
    setIsGameStarted(true);
  };

  const handleCellClick = (position) => {
    if (
      !loading &&
      !gameData.winner &&
      gameData.board_state[position] === "_"
    ) {
      makeMove(position); // Send the move to the backend
    }
  };

  if (!isLoggedIn) {
    return <div>Please log in to start a new game.</div>;
  }

  return (
    <div className="homepage-container">
      <h1>Welcome to Tic-Tac-Toe</h1>
      <h2>Start a New Game</h2>

      {/* Game creation buttons */}
      <div className="game-options">
        <button
          className="game-btn multiplayer-btn"
          onClick={startMultiplayerGame}
        >
          Play Multiplayer
        </button>
        <button className="game-btn ai-btn" onClick={startAIGame}>
          Play vs AI
        </button>
      </div>
    </div>
  );
};

export default HomePage;
