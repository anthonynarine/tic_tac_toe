import React from "react";

const MobileMenu = ({
    isOpen,
    setIsOpen,
    isLoggedIn,
    navigate,
    logout,
    setSidebarOpen,
    startMultiplayerGame,
    startAIGame,
    user,
    }) => {
    if (!isOpen) return null;

    return (
        <div className="mobile-dropdown">
        <button onClick={() => { navigate("/"); setIsOpen(false); }}>🏠 Home</button>
        <button onClick={() => { setSidebarOpen(true); setIsOpen(false); }}>👥 Social</button>
        <button onClick={startMultiplayerGame}>🎮 Multiplayer</button>
        <button onClick={startAIGame}>🤖 Play vs AI</button>
        <button onClick={() => { navigate("/technical-paper"); setIsOpen(false); }}>📄 About</button>
        {isLoggedIn ? (
            <>
            <button onClick={() => { navigate("/profile"); setIsOpen(false); }}>👤 {user?.first_name}</button>
            <button onClick={() => { logout(); setIsOpen(false); }}>🔓 Logout</button>
            </>
        ) : (
            <button onClick={() => { navigate("/login"); setIsOpen(false); }}>🔐 Login</button>
        )}
        </div>
    );
};

export default MobileMenu;
