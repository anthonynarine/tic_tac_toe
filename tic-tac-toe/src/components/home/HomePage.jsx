import React from "react";
import useGameServices from "../hooks/useGameServices";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast/Toast";
import "./HomePage.css";

const Home = () => {
  const { createNewGame } = useGameServices();
  const navigate = useNavigate();

  /**
   * Handles creating a new game.
   * 
   * @param {boolean} isAIGame - Determines whether the new game is against AI or multiplayer.
   */
  const handleCreateGame = async (isAIGame) => {
    try {
      const newGame = await createNewGame(null, isAIGame);

      if (newGame) {
        if (isAIGame) {
          // Navigate to the game directly for AI games
          navigate(`/games/${newGame.id}`);
        } else {
          // Navigate to the lobby for multiplayer games
          navigate(`/lobbypage/${newGame.id}`);
        }
      }
    } catch (error) {
      console.error("Error creating game:", error);
      showToast("error", "Failed to create a new game. Please try again.");
    }
  };

  return (
    <div className="homepage-container">
      <h1 className="homepage-title">Tic Tac Anto</h1>
      <p className="homepage-tagline">Play with friends or challenge AI. Anytime, anywhere.</p>

      <div className="game-modes">
        <button className="game-mode-button" onClick={() => handleCreateGame(false)}>
          Create Multiplayer Game
        </button>
        <button className="game-mode-button" onClick={() => handleCreateGame(true)}>
          Play vs AI
        </button>
      </div>
    </div>
  );
};

export default Home;
