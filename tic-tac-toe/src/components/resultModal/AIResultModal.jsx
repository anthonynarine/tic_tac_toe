// File: AIResultModal.jsx

import styles from "./AIResultModal.module.css";
import classNames from "classnames";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

/**
 * AIResultModal
 *
 * Displays game results for AI matches. Includes play again and home buttons.
 *
 * Props:
 * @param {boolean} isGameOver - Whether the game has ended.
 * @param {string} winner - The winner of the game ("X", "O", or "D" for draw).
 * @param {function} onNewGameClicked - Callback to trigger a new game.
 */
export const AIResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate();

  const resultMessage = winner === "D" ? "It's a Draw!" : `${winner} Wins`;
  const modalClass = classNames(styles.modalOverlay, {
    [styles.modalOpen]: isGameOver,
  });

  return (
    <div className={modalClass}>
      <div className={styles.modalBox}>
        <div className={styles.winnerText}>{resultMessage}</div>
        <div className={styles.buttonGroup}>
          <button className={styles.modalButton} onClick={onNewGameClicked}>
            Play Again
          </button>
          <button className={styles.modalButton} onClick={() => navigate("/")}>
            <AiFillHome style={{ marginRight: 8 }} />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};