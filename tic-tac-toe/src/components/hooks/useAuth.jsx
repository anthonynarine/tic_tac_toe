import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "./useAuthAxios";
import { useUserContext } from "../context/userContext";

export const useAuth = () => {
    const { authAxios, getToken, setToken, removeToken } = useAuthAxios(); // Axios instance with token helpers
    const { setUser, setIsLoggedIn } = useUserContext(); // Context functions for user state
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Login function
    const login = useCallback(async ({ email, password }) => {
        setIsLoading(true);
        setError(""); // Clear previous errors

        try {
            // STEP 1: Request tokens from login endpoint
            const { data: loginData } = await authAxios.post("/token/", { email, password });
            const accessToken = loginData.access;
            const refreshToken = loginData.refresh;
            
            // STEP 2: Store tokens in cookies or localStorage
            setToken("access_token", accessToken);
            setToken("refresh_token", refreshToken);
            console.log("Tokens successfully set.");

            // STEP 3: Fetch user profile data
            const { data: userData } = await authAxios.get("/users/profile/", {
                headers: {
                    Authorization: `Bearer ${accessToken}` // Attach access token to request
                }
            });
            console.log("User profile fetched:", userData);

            // STEP 4: Update user context with profile data
            setUser(userData);
            setIsLoggedIn(true);

            // Navigate to the homepage after login
            navigate("/");

        } catch (error) {
            console.error("Login failed:", error);

            // Handle login error based on response status
            if (error.response?.status === 401) {
                setError("Invalid email or password.");
            } else {
                setError("An error occurred. Please try again later.");
            }
        } finally {
            setIsLoading(false); // Reset loading state
        }
    }, [authAxios, setUser, setIsLoggedIn, setToken, navigate]);

    // Logout function
    const logout = useCallback(() => {
        // Remove tokens
        removeToken("access_token");
        removeToken("refresh_token");

        // Clear user context data
        setUser(null);
        setIsLoggedIn(false);

        // Redirect to login page
        navigate("/login");
    }, [removeToken, setUser, setIsLoggedIn, navigate]);

    // Registration function
    const register = useCallback(async ({ email, first_name, last_name, password }) => {
        setIsLoading(true);
        setError(""); // Clear previous errors

        try {
            // STEP 1: Send registration request
            const registerResponse = await authAxios.post("/users/", {
                email,
                first_name,
                last_name,
                password,
            });

            if (registerResponse.status === 201) {
                // STEP 2: Automatically log in after successful registration
                await login({ email, password });
            }
        } catch (error) {
            console.error("Registration failed:", error);

            // Handle registration errors
            if (error.response?.status === 400) {
                setError("Validation error. Please ensure all fields are correctly filled.");
            } else if (error.response?.status === 500) {
                setError("Internal server error. Please try again later.");
            } else if (error.response?.data) {
                setError(error.response.data.message || "Registration failed. Please try again.");
            } else {
                setError("An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false); // Reset loading state
        }
    }, [authAxios, login]);

    return {
        isLoading,  // Boolean indicating if a request is in progress
        error,      // Any error message encountered during auth operations
        login,      // Login function
        register,   // Registration function
        logout,     // Logout function 
    };
};
