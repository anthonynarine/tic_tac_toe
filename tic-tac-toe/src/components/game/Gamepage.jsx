import "./Game.css";
import GameLoader from "../../utils/gameLoader/Gameloader";
import GameBoard from "./GameBoard";
import ResponsiveBoard from "../board/ResponsiveBoard";
import GameResult from "./GameResult";
import GameManager from "./GameManager";
import { useParams } from "react-router-dom";

/**
 * GamePage Component
 *
 * This component is responsible for rendering the main game page. It uses `GameManager`
 * to manage the game's state and logic, including handling moves, loading state,
 * and game results. The component also determines the current player's role
 * and whether the game board should be interactive.
 *
 * @returns {JSX.Element} The game page UI.
 */
export const GamePage = () => {
    // Extract the game ID from the URL
    const { id: gameId } = useParams();

    return (
        <GameManager gameId={gameId}>
            {({
                state,
                loading,
                error,
                handleCellClick,
                playAgainAI,
                finalizeGame,
                requestRematch,
            }) => {
                console.log("Updated state in GamePage:", state);

                // Destructure the relevant state variables
                const { game, isGameOver, winner, winningCombination, cellValues, isAI } = state;

                /**
                 * Determine the player's role in the game.
                 * If `state.playerRole` is available, use it directly. Otherwise, fall back to
                 * determining the role based on `game.player_x` and `state.userEmail`.
                 */
                const playerRole =
                    state.playerRole || (game?.player_x === state.userEmail ? "X" : "O");

                console.log("Player Role:", playerRole);

                /**
                 * Determine if the game board should be disabled.
                 * The board is disabled if the game is over or if it's not the player's turn.
                 */
                const isDisabled =
                    isGameOver ||
                    (game && game.current_turn && game.current_turn !== playerRole);

                console.log("Game State:", game);
                console.log("Board Disabled:", isDisabled);

                const handleNewGameClicked = () => {
                    if (state.isAI) {
                        playAgainAI();
                    } else {
                        requestRematch()
                    }
                }

                return (
                    <div className="game-container">
                        {/* Display a loading spinner or error message */}
                        <GameLoader loading={loading} error={error} />

                        {/* Render the main gameplay UI once loading is complete and no errors exist */}
                        {!loading && !error && game && (
                            <>
                                <h1>Tic Tac Toe</h1>

                                {/* Display the turn notification */}
                                <div className="turn-notification">
                                    {isGameOver
                                        ? winner
                                            ? `Game Over! Winner: ${winner}`
                                            : "Game Over! It's a draw."
                                        : game.current_turn === playerRole
                                        ? "It's your turn"
                                        : "Waiting for opponent's turn"}
                                </div>

                                {/* Render the game board */}
                                <GameBoard
                                    cellValues={cellValues || []}
                                    winningCombination={winningCombination || []}
                                    handleCellClick={handleCellClick}
                                    isDisabled={isDisabled}
                                />

                                {/* Render the result modal if the game is over */}
                                <GameResult
                                    isGameOver={isGameOver}
                                    isAI={isAI}
                                    winner={winner}
                                    onNewGameClicked={handleNewGameClicked  }
                                    onCompleteGame={() =>
                                        finalizeGame(gameId, winner, state.isCompleted)
                                    }
                                />
                            </>
                        )}
                    </div>
                );
            }}
        </GameManager>
    );
};
