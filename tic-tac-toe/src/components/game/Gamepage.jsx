// File: components/game/GamePage.jsx

import GameLoader from "../../utils/gameLoader/Gameloader";
import GameManager from "./GameManager";
import GameResult from "./GameResult";
import ResponsiveBoard from "./board/ResponsiveBoard"
import { useParams } from "react-router-dom";

/**
 * GamePage
 * --------------------------------------------
 * Handles logic for loading a game and rendering it
 * through ResponsiveBoard and GameResult.
 */
export const GamePage = () => {
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
            const {
            game,
            isGameOver,
            winner,
            winningCombination,
            cellValues,
            isAI,
            } = state;

            const playerRole =
            state.playerRole || (game?.player_x === state.userEmail ? "X" : "O");

            const isDisabled =
            isGameOver || game?.current_turn !== playerRole;

            const handleNewGameClicked = () => {
            state.isAI ? playAgainAI() : requestRematch();
            };

            return (
            <>
                <GameLoader loading={loading} error={error} />

                {!loading && !error && game && (
                <>
                    <ResponsiveBoard
                    cellValues={cellValues}
                    winningCombination={winningCombination}
                    handleCellClick={handleCellClick}
                    isDisabled={isDisabled}
                    playerRole={playerRole}
                    currentTurn={game.current_turn}
                    winner={winner}
                    isGameOver={isGameOver}
                    />

                    <GameResult
                    isGameOver={isGameOver}
                    isAI={isAI}
                    winner={winner}
                    onNewGameClicked={handleNewGameClicked}
                    onCompleteGame={() =>
                        finalizeGame(gameId, winner, state.isCompleted)
                    }
                    />
                </>
                )}
            </>
            );
        }}
        </GameManager>
    );
};
