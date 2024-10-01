import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "./useAuthAxios";

export const useAuth = () => {
    const { authAxios, getToken, setToken } = useAuthAxios();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!getToken("access_token")); //Check token using getToken()
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    setError("");

    try {
        // STEP 1: Make the request to the login endpoint to obtain tokens
        const loginResponse = await authAxios.post("/token/", { email, password });
        console.log("Login response:", loginResponse.data);

        // Manually set the tokens
        const accessToken = loginResponse.data.access;
        const refreshToken = loginResponse.data.refresh;
        setToken("access_token", accessToken);
        setToken("refresh_token", refreshToken);
        console.log("Tokens successfully set.");

        // Ensure the token is stored
        console.log("Stored access token:", getToken("access_token"));

        // STEP 2: Manually set the Authorization header for the profile request
        const userResponse = await authAxios.get("/users/profile/", {
            // HAD TO ADD THE HEADERS MANUALLY FOR SOME REASON MY AXIOS INSTANCE REQUEST FUNCTION FOR 
            // THIS ISN'T WORKING AS EXPECTED. ITS NOT A TIMING ISSUE I ALREADY TESTED WITH SETTIMEOUT. 
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log("User profile fetched:", userResponse.data);

        // Update the user state
        setUser(userResponse.data);
        setIsLoggedIn(true);

        // Navigate to home after successful login
        navigate("/");  
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
}, [authAxios, navigate]);

    
    


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
