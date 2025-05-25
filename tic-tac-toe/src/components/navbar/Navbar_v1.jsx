import React, { useState, useEffect, useRef } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { PiGameControllerThin } from "react-icons/pi";
import { CiLogin, CiLogout, CiHome } from "react-icons/ci";

import { useAuth } from "../hooks/useAuth";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext"; 
import useGameCreation from "../hooks/useGameCreation";

import "./Navbar.css";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false); // Mobile hamburger toggle
  const [dropdownOpen, setDropdownOpen] = useState(false); // Game mode dropdown toggle

  const { isLoggedIn, user, authLoaded } = useUserContext();
  const { logout } = useAuth();
  const { createNewGame } = useGameCreation();
  const { setSidebarOpen } = useUI(); 

  const dropdownRef = useRef();
  const navigate = useNavigate();

  // Toggle mobile navbar
  const toggleMenu = () => setIsOpen((prev) => !prev);

  // Toggle dropdown for game modes
  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  // Auto-close game mode dropdown if user clicks outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handler: Create multiplayer game and route to lobby
  const startMultiplayerGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (newGame) navigate(`/lobby/${newGame.id}`);
    } catch (error) {
      console.error("Multiplayer error:", error);
    } finally {
      setDropdownOpen(false);
    }
  };

  // Handler: Create AI game and route directly to game page
  const startAIGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame) navigate(`/games/${newGame.id}`);
    } catch (error) {
      console.error("AI game error:", error);
    } finally {
      setDropdownOpen(false);
    }
  };

  return (
    <>
      <nav className="navbar">
          <div className="navbar-content">
            {/* Logo / Home Button */}
            <div className="navbar-brand" onClick={() => navigate("/")}>
              <CiHome className="game-icon" />
            </div>

            {/* Center Game Controller Icon for Game Mode Selection */}
            <div className="game-icon-container" onClick={toggleDropdown} ref={dropdownRef}>
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

            {/* Right Navigation Buttons */}
            <div className={`navbar-links ${isOpen ? "active" : ""}`}>
              <ul>
                {!isLoggedIn ? (
                  <li>
                    <button onClick={() => navigate("/login")} title="Login" className="nav-button">
                      <CiLogin className="nav-icon" />
                    </button>
                  </li>
                ) : (
                  <>
                    <li>
                      <button onClick={logout} title="Logout" className="nav-button">
                        <CiLogout className="nav-icon" />
                      </button>
                    </li>
                    <li>
                      <button onClick={() => navigate("/profile")} title="Profile" className="nav-button">
                        <span className="nav-label glow-pulse">{user?.first_name}</span>
                      </button>
                    </li>
                    <div className="mobile-social-only">
                      <li>
                        {/* ✅ Opens FriendsSidebar via global context */}
                        <button onClick={() => setSidebarOpen(true)} title="Friends" className="nav-button">
                          <span className="nav-label glow-pulse">Social</span>
                        </button>
                      </li>
                    </div>
                  </>
                )}
              </ul>
            </div>

            {/* Hamburger Icon for Mobile Menu */}
            <div className="navbar-toggle" onClick={toggleMenu}>
              {isOpen ? <FaTimes /> : <FaBars />}
            </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
