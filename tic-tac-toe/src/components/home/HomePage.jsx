import React from "react";
import useGameCreation from "../hooks/useGameCreation";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast/Toast";
import { useUserContext } from "../context/userContext";
import "./HomePage.css";


const Home = () => {
  const { createNewGame } = useGameCreation();
  const navigate = useNavigate();
  const { isLoggedIn } = useUserContext(); 

  const handleCreateGame = async (isAIGame) => {
    try {
      const newGame = await createNewGame(isAIGame);

      if (newGame) {
        if (isAIGame) {
          navigate(`/games/${newGame.id}`);
        } else {
          navigate(`/lobby/${newGame.id}`);
        }
      }
    } catch (error) {
      console.error("Error creating game:", error);
      showToast("error", "Failed to create a new game. Please try again.");
    }
  };

  const handleLoginRedirect = () => {
    navigate("/login"); 
  };

  return (
    <div className="homepage-container">
      <h1 className="homepage-title">Tic Tac Toe</h1>
      <p className="homepage-tagline">Challenge friends or beat the AI.</p>

      <div className="game-modes">
        {isLoggedIn ? (
          <>
            <button className="game-mode-button" onClick={() => handleCreateGame(false)}>
              Create Multiplayer Game
            </button>
            <button className="game-mode-button" onClick={() => handleCreateGame(true)}>
              Play vs AI
            </button>
          </>
        ) : (
          <button className="login-play-button" onClick={handleLoginRedirect}>
            Login to Play
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
