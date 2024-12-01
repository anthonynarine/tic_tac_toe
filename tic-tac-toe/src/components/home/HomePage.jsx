import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import useGameServices from "../hooks/useGameServices";
import { useGameContext } from "../context/gameContext";
import { Board } from "../board/Board";

import "./HomePage.css";
import "../board/Board.css";

const Home = () => {
  /**
   * Description:
   * This page serves as the home screen for the Tic Tac Toe game. 
   * It allows users to:
   * - View a list of joinable multiplayer games.
   * - Create a new multiplayer or AI game.
   * - Display an empty board as a placeholder when no games are available.
   * Users can also see the game details for any selected game and navigate to the game page.
   */

  const { fetchJoinableGames, joinableGames, createNewGame, loading, error } = useGameServices();
  const { dispatch } = useGameContext();
  const navigate = useNavigate();

  const [selectedGame, setSelectedGame] = useState(null);

  // Clear state when the Home component mounts
  useEffect(() => {
    dispatch({ type: "RESET_GAME_STATE" });
  }, [dispatch]);

  // Fetch joinable games on component mount
  useEffect(() => {
    fetchJoinableGames();
  }, [fetchJoinableGames]);

  // Handle creation of a new game (AI or multiplayer)
  const handleCreateGame = async (isAIGame = false) => {
    try {
      dispatch({ type: "RESET_GAME_STATE" }); // Clear any stale state
      const newGame = await createNewGame(null, isAIGame); // Create a new game

      if (newGame) {
        console.log("New game created:", newGame.id, newGame);
        dispatch({ type: "SET_GAME", payload: newGame }); // Update state with the new game
        if (isAIGame) navigate(`/games/${newGame.id}`); // Navigate to game page if AI game
      } else {
        console.error("Failed to create a new game");
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };

  // Handle joining an existing game
  const handleJoinGame = async (game) => {
    setSelectedGame(game); // Update the selected game state
    navigate(`/games/${game.id}`); // Navigate to the game page
  };

  // Initial empty board state (9 cells, all empty)
  const emptyBoardState = Array(9).fill("");

  return (
    <div className="homepage-container">
      <h1>The Tic-Tac-Anto</h1>
      <p className="homepage-description">
        Welcome to Tic Tac Toe! You can create a new game, join an existing game, or play against an AI. Start by choosing an option below.
      </p>

      {loading && <p>Loading games...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <>
          {joinableGames.length > 0 ? (
            <div className="games-list">
              <h3>Available Games to Join</h3>
              <div className="game-cards">
                {joinableGames.map((game) => (
                  <div className="game-card" key={game.id}>
                    <button className="join-btn" onClick={() => handleJoinGame(game)}>
                      Join Game
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="no-games-msg">No games are currently available. You can create a new game!</p>
              <Board
                cellValues={emptyBoardState}
                winningCombination={[]} // No winning combination for an empty board
                cellClicked={() => {}} // No interaction for the empty board
              />
            </div>
          )}

          <div className="game-options">
            <button className="game-btn multiplayer-btn" onClick={() => handleCreateGame(false)}>
              Multiplayer Game
            </button>
            <button className="game-btn ai-btn" onClick={() => handleCreateGame(true)}>
              Play vs AI
            </button>
          </div>

          {selectedGame && (
            <div className="selected-game">
              <h2>Game ID: {selectedGame.id}</h2>
              <Board
                cellValues={selectedGame.board_state.split("")}
                winningCombination={[]}
                cellClicked={() => {}} // Replace with logic to handle moves
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
