import React, { useEffect, useState } from "react";
import useGameServices from "../hooks/useGameServices";
import { Board } from "../board/Board";
import "./HomePage.css";

const Home = () => {
  const { fetchJoinableGames, joinableGames, createNewGame, loading, error } = useGameServices();
  const [selectedGame, setSelectedGame] = useState(null);

  // Fetch joinable games on component mount
  useEffect(() => {
    fetchJoinableGames();
  }, []);

  const handleCreateGame = (isAIGame = false) => {
    createNewGame(null, isAIGame);
  };

  const handleJoinGame = async (game) => {
    setSelectedGame(game);
    // Call join game service (useGameServices) here to update the state
  };

  // Initial empty board state (9 cells, all empty)
  const emptyBoardState = Array(9).fill("");

  return (
    <div className="homepage-container">
      <h1> The tic-tac-anto</h1>
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
              {/* Display empty board when no games are available */}
              <Board
                cellValues={emptyBoardState}
                winningCombination={[]} // No winning combination for empty board
                cellClicked={() => {}} // No interaction in the empty board
              />
            </div>
          )}

          <div className="game-options">
            <button className="game-btn multiplayer-btn" onClick={() => handleCreateGame(false)}>
              Multiplayer Game
            </button>
            <button className="game-btn ai-btn" onClick={() => handleCreateGame(true)}>
              Play vs Ai
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
