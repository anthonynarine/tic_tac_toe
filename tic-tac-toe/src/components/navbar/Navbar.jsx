import React, { useState, useRef, useEffect } from "react";
import { useUserContext } from "../context/userContext";
import { useAuth } from "../hooks/useAuth";
import { useUI } from "../context/uiContext";
import useGameCreation from "../hooks/useGameCreation";
import { useNavigate } from "react-router-dom";

import HomeButton from "./HomeButton";
import GameModeDropdown from "./GameModeDropdown";
import NavLinks from "./NavLinks";
import MobileMenu from "./MobileMenu";
import HamburgerToggle from "./HamburgerToggle";

import "./Navbar.css";

const Navbar = () => {
    
    const [isOpen, setIsOpen] = useState(false); // hamburger state
    const [dropdownOpen, setDropdownOpen] = useState(false); // game mode dropdown state
    const dropdownRef = useRef();

    const { isLoggedIn, user } = useUserContext();
    const { logout } = useAuth();
    const { createNewGame } = useGameCreation();
    const { setSidebarOpen } = useUI();
    const navigate = useNavigate();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
            setDropdownOpen(false);
        }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Multiplayer and AI game handlers
    const startMultiplayerGame = async () => {
        try {
        const newGame = await createNewGame(user?.first_name || "Player", false);
        if (newGame) navigate(`/lobby/${newGame.id}`);
        } catch (err) {
        console.error("Multiplayer error:", err);
        } finally {
        setDropdownOpen(false);
        setIsOpen(false);
        }
    };

    const startAIGame = async () => {
        try {
        const newGame = await createNewGame(user?.first_name || "Player", true);
        if (newGame) navigate(`/games/${newGame.id}`);
        } catch (err) {
        console.error("AI game error:", err);
        } finally {
        setDropdownOpen(false);
        setIsOpen(false);
        }
    };

    return (
        <nav className="navbar">
        <div className="navbar-content">
            <HomeButton />
            <GameModeDropdown
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
            ref={dropdownRef}
            isLoggedIn={isLoggedIn}
            startMultiplayerGame={startMultiplayerGame}
            startAIGame={startAIGame}
            navigate={navigate}
            />
            <NavLinks
            isLoggedIn={isLoggedIn}
            // user={user}
            logout={logout}
            navigate={navigate}
            setSidebarOpen={setSidebarOpen}
            isOpen={isOpen}
            />
            <HamburgerToggle isOpen={isOpen} toggleMenu={() => setIsOpen((prev) => !prev)} />
        </div>

        <MobileMenu
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            isLoggedIn={isLoggedIn}
            user={user}
            navigate={navigate}
            logout={logout}
            setSidebarOpen={setSidebarOpen}
            startMultiplayerGame={startMultiplayerGame}
            startAIGame={startAIGame}
        />
        </nav>
    );
};

export default Navbar;
