import React, { useState } from "react";
import useGameServices from "../hooks/useGameServices";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast/Toast";
import "./HomePage.css";

const Home = () => {
  const { createNewGame } = useGameServices();
  const [inviteLink, setInviteLink] = useState(null); // For multiplayer invite link
  const navigate = useNavigate();

  /**
   * Handles creating a new game.
   * 
   * @param {boolean} isAIGame - Determines whether the new game is against AI or multiplayer.
   */
  const handleCreateGame = async (isAIGame) => {
    try {
      const newGame = await createNewGame(null, isAIGame);

      if (newGame) {
        if (isAIGame) {
          navigate(`/games/${newGame.id}`);
        } else {
          const newInviteLink = `${window.location.origin}/games/join/${newGame.id}`;
          setInviteLink(newInviteLink);
          // showToast("success", "Multiplayer game created! Share the link with a friend.");
        }
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };

  /**
   * Handles copying the invite link to the clipboard.
   */
  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      showToast("success", "Link copied to clipboard!");
    }
  };

  return (
    <div className="homepage-container">
      <h1 className="homepage-title">Tic Tac Anto</h1>
      <p className="homepage-tagline">Play with friends or challenge AI. Anytime, anywhere.</p>

      <div className="game-modes">
        <button className="game-mode-button" onClick={() => handleCreateGame(false)}>
          Create Multiplayer Game
        </button>
        <button className="game-mode-button" onClick={() => handleCreateGame(true)}>
          Play vs AI
        </button>
      </div>

      {inviteLink && (
        <div className="invite-section">
          <p className="invite-message">Invite your friend</p>
          <div className="invite-actions">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="invite-link"
              onClick={(e) => e.target.select()}
            />
            <button className="copy-button" onClick={handleCopyLink}>
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
