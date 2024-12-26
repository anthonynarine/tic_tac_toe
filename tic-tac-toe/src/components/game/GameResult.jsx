import { ResultModal } from "../reslutModal/ResultModal";

/**
 * GameResult Component
 * 
 * Manages the display of the game result, including options to replay or complete the game.
 * 
 * Props:
 * - isGameOver (boolean): Indicates if the game is over.
 * - winner (string|null): The winner of the game (if any).
 * - onNewGameClicked (function): Handler to start a new game.
 * - onCompleteGame (function): Handler to complete the game.
 */
const GameResult = ({ isGameOver, winner, onNewGameClicked, onCompleteGame }) => {

    // Debugging logs
    // console.log("GameResult Props:", { isGameOver, winner, onNewGameClicked, onCompleteGame, game });

    return (
        <ResultModal
            isGameOver={isGameOver}
            winner={winner}
            onNewGameClicked={onNewGameClicked}
            onCompleteGame={onCompleteGame}
        />
    );
};

export default GameResult;