import React, { useEffect, useState } from "react";
import useGameServices from "../hooks/useGameServices";
import { useNavigate } from "react-router-dom";
import { Board } from "../board/Board";
import "./HomePage.css";
import "../board/Board.css"


const Home = () => {
  const { fetchJoinableGames, joinableGames, createNewGame, loading, error } = useGameServices();
  const [selectedGame, setSelectedGame] = useState(null);

  const navigate = useNavigate();

  // Fetch joinable games on component mount
  useEffect(() => {
    fetchJoinableGames();
  }, []);

  const handleCreateGame = async (isAIGame = false) => {
    // Call createNewGame to initiate game creation with the specified type (AI or multiplayer)
    // `null` is passed for `player_o` since it's determined by the backend
     // Await the promise returned by createNewGame to ensure we wait for the game to be created
    const newGame = await createNewGame(null, isAIGame);
  
    // If the game creation is successful, the new game object will be returned
    if (newGame) {
      // Log the game ID and player_o 
      console.log(newGame.id, newGame.player_o);
      
      // If the created game is an AI game, automatically navigate to the game page
      if (isAIGame) {
        // Navigate to the game page with the newly created game's ID
        navigate(`/games/${newGame.id}`);
      }
    }
  };
  

  const handleJoinGame = async (game) => {
    setSelectedGame(game);
    // Call join game service (useGameServices) here to update the state
    navigate(`/games/${game.id}`);
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
