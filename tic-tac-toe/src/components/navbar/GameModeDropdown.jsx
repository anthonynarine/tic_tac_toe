import React, { forwardRef } from "react";
import { PiGameControllerThin } from "react-icons/pi";

const GameModeDropdown = forwardRef(
    ({ dropdownOpen, setDropdownOpen, isLoggedIn, startMultiplayerGame, startAIGame, navigate }, ref) => (
        <div className="game-icon-container" onClick={() => setDropdownOpen((prev) => !prev)} ref={ref}>
        <PiGameControllerThin className="game-icon" />
        {dropdownOpen && (
            <div className="dropdown-menu">
            {isLoggedIn ? (
                <>
                <button onClick={startMultiplayerGame}>Multiplayer</button>
                <button onClick={startAIGame}>Play vs AI</button>
                </>
            ) : (
                <button onClick={() => navigate("/login")}>Login</button>
            )}
            </div>
        )}
        </div>
    )
);

export default GameModeDropdown;
