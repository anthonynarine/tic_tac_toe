import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isDMOpen, setDMOpen] = useState(false);

    const location = useLocation();

    // 🔒 Auto-close DM drawer and block re-opening on restricted routes
    useEffect(() => {
        if (location.pathname === "/technical-paper") {
        setDMOpen(false);
        }
    }, [location.pathname]);

    // 🚫 Prevent setting DM drawer open on disallowed pages
    const safeSetDMOpen = (state) => {
        if (location.pathname !== "/technical-paper") {
        setDMOpen(state);
        }
    };

    return (
        <UIContext.Provider
        value={{
            isSidebarOpen,
            setSidebarOpen,
            isDMOpen,
            setDMOpen: safeSetDMOpen, // 👈 use the guarded setter
        }}
        >
        {children}
        </UIContext.Provider>
    );
};
