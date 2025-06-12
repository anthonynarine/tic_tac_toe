import { useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";

/**
 * Context to hold the current user data and login status globally.
 * @typedef {Object} UserContextValue
 * @property {Object|null} user - The currently logged-in user's data.
 * @property {Function} setUser - Function to update user data.
 * @property {boolean} isLoggedIn - Boolean indicating login status.
 * @property {Function} setIsLoggedIn - Function to update login status.
 * @property {boolean} authLoaded - Boolean indicating whether auth check has completed.
 */

/**
 * Create the UserContext with undefined initial value.
 * Must be wrapped with a UserProvider to access.
 */
export const UserContext = createContext(undefined);

/**
 * Custom hook to access the UserContext safely.
 *
 * @returns {UserContextValue} The user context value (user, setUser, isLoggedIn, setIsLoggedIn, authLoaded)
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
    const [authLoaded, setAuthLoaded] = useState(false); // Step 3: Initialize auth loading state

    const navigate = useNavigate();

    // Step 4: On mount, validate access token and restore session
    useEffect(() => {
        // Step 4.1: Determine token source based on environment
        const token =
            process.env.NODE_ENV === "production"
                ? Cookies.get("access_token") // In production, use secure cookies
                : localStorage.getItem("access_token"); // In dev, use localStorage

        // Step 4.2: Define which routes should NOT require auth (e.g. login/register)
        const publicRoutes = ["/login", "/register"];
        const currentPath = window.location.pathname;

        // Step 4.3: If there's no token and user is visiting a protected page
        if (!token) {
            if (!publicRoutes.includes(currentPath)) {
                // Step 4.3.1: Clear any existing auth state
                setUser(null);
                setIsLoggedIn(false);
                localStorage.removeItem("user");
                localStorage.setItem("isLoggedIn", "false");

                // Step 4.3.2: Redirect to login page
                navigate("/login");
            }
        } else {
            // Step 4.4: Token exists — restore user session from localStorage
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                // Step 4.4.1: Hydrate user state from localStorage
                setUser(JSON.parse(storedUser));
                setIsLoggedIn(true);
            }
        }

        // Step 4.5: Mark auth check as completed (used to guard initial render)
        setAuthLoaded(true);
    }, []);


    // Step 5: Sync user/auth state changes with localStorage
    useEffect(() => {
        if (user && isLoggedIn) {
            localStorage.setItem("user", JSON.stringify(user)); // Step 5.1: Save user info
            localStorage.setItem("isLoggedIn", "true"); // Step 5.2: Save login status
        } else {
            localStorage.removeItem("user"); // Step 5.3: Clear user info if logged out
            localStorage.setItem("isLoggedIn", "false");
        }
    }, [user, isLoggedIn]);

    // Step 6: Provide context to all children
    return (
        <UserContext.Provider value={{ user, setUser, isLoggedIn, setIsLoggedIn, authLoaded }}>
            {children}
        </UserContext.Provider>
    );
};
