import "./lobby.css";
import React from "react";
import PropTypes from "prop-types";
import { CiCirclePlus } from "react-icons/ci";

/**
 * PlayerList Component
 * 
 * Renders a list of players and handles empty slots with an invite button or a placeholder.
 * 
 * Props:
 * @param {Object[]} players - Array of player objects to display.
 * @param {number} maxPlayers - Maximum number of players allowed in the lobby.
 * @param {Function} [onInvite] - Optional handler for inviting players to empty slots.
 * @param {React.ReactNode} [emptySlotPlaceholder] - Optional content for empty slots.
 * 
 * @returns {JSX.Element} The rendered player list UI.
 */
const PlayerList = ({ players, maxPlayers, onInvite, emptySlotPlaceholder }) => (
    <div className="players-list">
        {Array.from({ length: maxPlayers }).map((_, index) => {
            const player = players[index];
            return (
                <div key={index} className="player-slot">
                    {player ? (
                        <div className="player-details">
                            <div className="player-avatar">
                                {player.first_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="player-name">{player.first_name}</div>
                        </div>
                    ) : (
                        <div
                            className="empty-slot"
                            role="button"
                            tabIndex={0}
                            aria-label="Invite player"
                            onClick={onInvite}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    onInvite();
                                }
                            }}
                        >
                            {onInvite ? (
                                <CiCirclePlus className="icon-invite" />
                            ) : (
                                emptySlotPlaceholder || "Empty Slot"
                            )}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

PlayerList.propTypes = {
    players: PropTypes.arrayOf(
        PropTypes.shape({
            first_name: PropTypes.string.isRequired,
        })
    ).isRequired,
    maxPlayers: PropTypes.number.isRequired,
    onInvite: PropTypes.func,
    emptySlotPlaceholder: PropTypes.node,
};

PlayerList.defaultProps = {
    onInvite: null,
    emptySlotPlaceholder: null,
};

export default PlayerList;
