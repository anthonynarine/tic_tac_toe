import { useState, useEffect, createContext, useContext } from "react";

// Create a context to hold user data and login status
export const UserContext = createContext(undefined);

// Hook to easily access the UserContext within components
export function useUserContext() {
    const context = useContext(UserContext);

    if (context === undefined) {
        throw new Error("useUserContext must be used within a UserProvider");
    }
    return context;
}

// UserProvider will wrap the app or sections of the app to provide user data globally
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

// On component mount: check localStorage for user and login status
useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedIsLoggedIn = localStorage.getItem("isLoggedIn");

    if (storedUser && storedIsLoggedIn === "true") {
        setUser(JSON.parse(storedUser)); // Set user from localStorage
        setIsLoggedIn(true); // Set logged-in status
    }
}, []);  // Runs once when the component mounts

// Listen for changes to user or isLoggedIn and update localStorage
useEffect(() => {
    if (user && isLoggedIn) {
        localStorage.setItem("user", JSON.stringify(user));  // Store user in localStorage
        localStorage.setItem("isLoggedIn", "true"); // Store login status
    } else {
        localStorage.removeItem("user"); // Clear user if logged out
        localStorage.setItem("isLoggedIn", "false");
    }
}, [user, isLoggedIn]);  // Runs whenever user or isLoggedIn changes

    return (
        <UserContext.Provider value={{ user, setUser, isLoggedIn, setIsLoggedIn }}>
            {children}
        </UserContext.Provider>
    );
};
