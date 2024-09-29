import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";

const useAuthAxios = () => {
    const navigate = useNavigate();
    const isProduction = process.env.NODE_ENV === "production";

    // Create the Axios instance
    const authAxios = axios.create({
        baseURL: process.env.REACT_APP_DEV_URL, // Backend URL
        withCredentials: true // Always true, for both environments
    });

    /**
     * Set token in cookies (production) or localStorage (development)
     */
    const setToken = (name, value, options = {}) => {
        if (isProduction) {
            Cookies.set(name, value, {
                secure: true,
                sameSite: "None",
                expires: name === "refresh_token" ? 7 : undefined, // 7 days for refresh token
                ...options
            });
        } else {
            localStorage.setItem(name, value);
        }
    };

    /**
     * Get token from cookies (production) or localStorage (development)
     */
    const getToken = (name) => {
        return isProduction ? Cookies.get(name) : localStorage.getItem(name);
    };

    /**
     * Remove token from cookies (production) or localStorage (development)
     */
    const removeToken = (name) => {
        if (isProduction) {
            Cookies.remove(name);
        } else {
            localStorage.removeItem(name);
        }
    };

    /**
     * Handle authentication errors by clearing tokens and redirecting to the login page.
     */
    const handleAuthError = () => {
        // Remove tokens from cookies or local storage
        removeToken("access_token");
        removeToken("refresh_token");
        Cookies.remove("csrftoken");  // Always remove CSRF token from cookies
        Cookies.remove("sessionid");  // Optional: Remove session ID if stored

        navigate("/login"); // Redirect to the login page
    };

    /**
     * Request interceptor to attach access token and CSRF token to request headers.
     */
    const requestInterceptor = (config) => {
        const accessToken = getToken("access_token");
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const csrfToken = Cookies.get("csrftoken");  // Always get CSRF from cookies
        if (csrfToken) {
            config.headers["X-CSRFToken"] = csrfToken;
        }

        return config;
    };

    /**
     * Response interceptor to handle token updates and other response modifications.
     */
    const responseInterceptor = (response) => {
        console.log("Login response:", response.data);

        // In production, set CSRF tokens
        const newCsrfToken = response.headers["x-csrftoken"];
        if (newCsrfToken) {
            Cookies.set("csrftoken", newCsrfToken, { secure: isProduction, sameSite: "Lax" });
        }

        // Store access and refresh tokens
        const accessToken = response.data.access;
        if (accessToken) {
            setToken("access_token", accessToken);
        }

        const refreshToken = response.data.refresh;
        if (refreshToken) {
            setToken("refresh_token", refreshToken, { expires: 7 });
        }

        // Handle logout scenario
        if (response.config.url.includes("/logout/")) {
            removeToken("access_token");
            removeToken("refresh_token");
            Cookies.remove("csrftoken");
            Cookies.remove("sessionid");
        }

        return response;
    };

    /**
     * Response error interceptor to handle token expiration and refresh logic.
     */
    const responseErrorInterceptor = async (error) => {
        const originalRequest = error.config;

        // Handle expired access tokens and attempt to refresh them ONCE
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const response = await authAxios.post("/token/refresh/", {}, { withCredentials: true });

                if (response.status === 200) {
                    const newAccessToken = response.data.access;
                    setToken("access_token", newAccessToken);

                    // Update the auth headers with new access token
                    originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
                    return authAxios(originalRequest); // Retry original request with new token
                }
            } catch (refreshError) {
                console.log("Failed to refresh access token", refreshError);
                handleAuthError();
            }
        }

        handleAuthError();
        return Promise.reject(error);
    };

    /**
     * useEffect to set up Axios interceptors and clean up on component unmount.
     */
    useEffect(() => {
        const reqInterceptor = authAxios.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error));
        const resInterceptor = authAxios.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

        return () => {
            // Eject the interceptors when the component unmounts
            authAxios.interceptors.request.eject(reqInterceptor);
            authAxios.interceptors.response.eject(resInterceptor);
        };
    }, [navigate]);

    return { authAxios, setToken, getToken, removeToken };
};

export default useAuthAxios;
