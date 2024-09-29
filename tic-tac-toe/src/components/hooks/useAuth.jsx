import Cookies from "js-cookie";
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "./useAuthAxios";

export const useAuth = () => {
    const { authAxios, getToken, setToken } = useAuthAxios();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!getToken("access_token")); //Check token using getToken()
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

// Login function
const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    setError("");

    try {
        // STEP 1: Make the request to the login endpoint to obtain tokens
        const loginResponse = await authAxios.post("/token/", { email, password });

        const accessToken = loginResponse.data.access;
        const refreshToken = loginResponse.data.refresh;

        if (accessToken && refreshToken) {
            // STEP 2: Store tokens using the setToken method
            setToken("access_token", accessToken);  // Store access token
            setToken("refresh_token", refreshToken);  // Store refresh token

            console.log("Tokens successfully set.");
            
            // STEP 3: Fetch the user data using the access token stored by authAxios
            const userResponse = await authAxios.get("/users/profile/");
            
            // Update the user state
            setUser(userResponse.data);
            setIsLoggedIn(true);

            // Navigate to home after successful login
            navigate("/");  
        } else {
            console.error("Login successful, but tokens are missing from the response.");
            setError("Login failed due to missing tokens.");
        }
    } catch (error) {
        console.error("Login failed:", error);

        // Handle invalid user credentials
        if (error.response?.status === 401) {
            setError("Invalid email or password.");
        } else {
            setError("An error occurred. Please try again later.");
        }
    } finally {
        setIsLoading(false);
    }
}, [authAxios, setToken, navigate]);


    // Registration function
    const register = useCallback(async ({ email, first_name, last_name, password }) => {
        setIsLoading(true);
        setError("");

        try {
            // STEP 1: Send registration request to the backend
            const registerResponse = await authAxios.post("/users/", {
                email,
                first_name,
                last_name,
                password,
            });

            if (registerResponse.status === 201) {
                // Automatically log the user in after successful registration
                await login({ email, password });
            }
        } catch (error) {
            console.error("Registration failed:", error);

            // More explicit error handling
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
            setIsLoading(false);
        }
    }, [authAxios, login]);

    return {
        isLoading,
        isLoggedIn,
        user,
        error,
        login,
        register,
    };
};
