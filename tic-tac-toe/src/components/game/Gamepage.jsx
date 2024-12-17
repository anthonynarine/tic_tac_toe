import "./Game.css";
import GameLoader from "../../utils/gameLoader/Gameloader";
import GameBoard from "./GameBoard";
import GameResult from "./GameResult";
import GameManager from "./GameManager";
import { WebSocketProvider } from "../websocket/WebSocketProvider";
import { useParams } from "react-router-dom";


/**
 * GamePage Component
 * 
 * The main component responsible for coordinating gameplay by combining game state
 * (retrieved and managed by GameManager) with UI components such as GameLoader, GameBoard,
 * and GameResult.
 */
export const GamePage = () => {
    const { id: gameId } = useParams(); // Extract the game ID from the URL.

    return (
        <GameManager gameId={gameId}>
            {({ state, loading, error, handleCellClick, playAgainAI, finalizeGame }) => {
                console.log("Updated state in GamePage:", state);

                const { game, playerRole, isGameOver, winner, winningCombination, cellValues } = state;

                return (
                    <div id="game">
                        {/* Display a loading spinner or error message */}
                        <GameLoader loading={loading} error={error} />

                        {/* Render the main gameplay UI once loading is complete and there are no errors */}
                        {!loading && !error && game && (
                            <>
                                <h1>Tic Tac Toe</h1>

                                {/* Display the notification */}
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
                                    isDisabled={
                                        isGameOver || game.current_turn !== playerRole
                                    }
                                />

                                {/* Render the result modal if the game is over */}
                                <GameResult
                                    isGameOver={isGameOver}
                                    winner={winner}
                                    onNewGameClicked={playAgainAI}
                                    onCompleteGame={() => finalizeGame(gameId, winner, state.isCompleted)}
                                />
                            </>
                        )}
                    </div>
                );
            }}
        </GameManager>
    );
};

/**
 * Game Component
 * 
 * Wraps the GamePage component with WebSocketProvider to enable real-time updates
 * during multiplayer gameplay. Ensures the WebSocket connection is scoped to the
 * current game ID.
 */
export const Game = () => (
    <WebSocketProvider gameId={useParams().id}>
        <GamePage />
    </WebSocketProvider>
);

