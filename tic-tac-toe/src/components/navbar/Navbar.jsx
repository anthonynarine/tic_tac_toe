import React, { useState, useEffect, useRef } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { PiGameControllerThin } from "react-icons/pi";
import { CiLogin, CiLogout, CiHome } from "react-icons/ci";
import { LiaUserNinjaSolid } from "react-icons/lia";
import { PiUsersThree } from "react-icons/pi";

import { useAuth } from "../hooks/useAuth";
import { useUserContext } from "../context/userContext";
import useGameCreation from "../hooks/useGameCreation";
import FriendsSidebar from "../friends/FriendsSidebar";

import "./Navbar.css";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false); // Mobile nav toggle
  const [dropdownOpen, setDropdownOpen] = useState(false); // Game mode dropdown
  const [sidebarOpen, setSidebarOpen] = useState(false); // Friends sidebar

  const dropdownRef = useRef();
  const navigate = useNavigate();
  const { createNewGame } = useGameCreation();
  const { isLoggedIn, user, authLoaded } = useUserContext();
  const { logout } = useAuth();

  // Mobile menu toggle
  const toggleMenu = () => setIsOpen(!isOpen);

  // Game mode dropdown toggle
  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  // Close friends sidebar
  const closeSidebar = () => setSidebarOpen(false);

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Game start handlers
  const startMultiplayerGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (newGame) navigate(`/lobby/${newGame.id}`);
    } catch (error) {
      console.log("error", error);
    } finally {
      setDropdownOpen(false);
    }
  };

  const startAIGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame) navigate(`/games/${newGame.id}`);
    } catch (error) {
      console.log("error", error);
    } finally {
      setDropdownOpen(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-content">
          {/* Brand/Home Button */}
          <div className="navbar-brand" onClick={() => navigate("/")}>
            <CiHome className="game-icon" />
          </div>

          {/* Game Mode Dropdown */}
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

          {/* Navigation Icons */}
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
                      <LiaUserNinjaSolid className="nav-icon" />
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSidebarOpen(true)} title="Friends" className="nav-button">
                      <PiUsersThree className="nav-icon" />
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="navbar-toggle" onClick={toggleMenu}>
            {isOpen ? <FaTimes /> : <FaBars />}
          </div>
        </div>
      </nav>

      {/* Friends Sidebar */}
      {authLoaded && isLoggedIn && (
        <>
          <FriendsSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-40 z-40"
              onClick={closeSidebar}
            />
          )}
        </>
      )}
    </>
  );
};

export default Navbar;
