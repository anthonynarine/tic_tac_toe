import { useState, useEffect, createContext, useContext } from "react";

/**
 * Context to hold the current user data and login status globally.
 * @typedef {Object} UserContextValue
 * @property {Object|null} user - The currently logged-in user's data.
 * @property {Function} setUser - Function to update user data.
 * @property {boolean} isLoggedIn - Boolean indicating login status.
 * @property {Function} setIsLoggedIn - Function to update login status.
 */

/**
 * Create the UserContext with undefined initial value.
 * Must be wrapped with a UserProvider to access.
 */
export const UserContext = createContext(undefined);

/**
 * Custom hook to access the UserContext safely.
 * 
 * @returns {UserContextValue} The user context value (user, setUser, isLoggedIn, setIsLoggedIn)
 * @throws {Error} If used outside of a UserProvider.
 */
export function useUserContext() {
    const context = useContext(UserContext);

    if (context === undefined) {
        throw new Error("useUserContext must be used within a UserProvider");
    }
    return context;
}

/**
 * Provides user-related state and functions to its child components.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to the user context.
 * @returns {JSX.Element} UserProvider component wrapping the children with user state.
 */
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Step 1: Initialize user state
    const [isLoggedIn, setIsLoggedIn] = useState(false); // Step 2: Initialize login status state

    // Step 3: On mount, check localStorage for existing user session
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const storedIsLoggedIn = localStorage.getItem("isLoggedIn");

        if (storedUser && storedIsLoggedIn === "true") {
            setUser(JSON.parse(storedUser)); // Step 3.1: Set user state from localStorage
            setIsLoggedIn(true); // Step 3.2: Set logged-in status to true
        }
    }, []); // Empty dependency array means this runs once on mount

    // Step 4: Whenever user or login status changes, sync with localStorage
    useEffect(() => {
        if (user && isLoggedIn) {
            localStorage.setItem("user", JSON.stringify(user)); // Step 4.1: Save user info
            localStorage.setItem("isLoggedIn", "true"); // Step 4.2: Save login status
        } else {
            localStorage.removeItem("user"); // Step 4.3: Clear user info if logged out
            localStorage.setItem("isLoggedIn", "false");
        }
    }, [user, isLoggedIn]); // Re-run when either 'user' or 'isLoggedIn' changes

    // Step 5: Provide context to all children
    return (
        <UserContext.Provider value={{ user, setUser, isLoggedIn, setIsLoggedIn }}>
            {children}
        </UserContext.Provider>
    );
};
