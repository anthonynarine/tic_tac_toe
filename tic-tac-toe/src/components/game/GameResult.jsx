import { AIResultModal } from "../reslutModal/AIResultModal";
import { MultiplayerResultModal } from "../reslutModal/MultiplayerResultModal";

/**
 * GameResult Component
 *
 * Responsible for rendering the correct result modal based on game mode.
 *
 * Props:
 * - isGameOver (boolean): Indicates if the game is over.
 * - winner (string|null): The winner of the game.
 * - onNewGameClicked (function): Handler for starting a new game.
 * - isAI (boolean): Whether the current game is against an AI.
 */
const GameResult = ({ isGameOver, winner, onNewGameClicked, isAI }) => {
    return isAI ? (
        <AIResultModal
        isGameOver={isGameOver}
        winner={winner}
        onNewGameClicked={onNewGameClicked}
        />
    ) : (
        <MultiplayerResultModal isGameOver={isGameOver} winner={winner} />
    );
};

export default GameResult;
