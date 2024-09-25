import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";

const useAuthAxios = () => {
    const navigate = useNavigate();
    const isProduction = process.env.NODE_ENV === "production";

    // Create the Axios instance
    const authAxios = axios.create({
        baseURL: process.env.REACT_APP_GAME_API_URL,
        withCredentials: true // Ensure cookies are sent with the request
    });

    /**
     * Handle authentication errors by clearing tokens and redirecting to the login page.
     */
    const handleAuthError = () => {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        Cookies.remove("csrftoken");
        Cookies.remove("sessionid");
        navigate("/login"); // Redirect to the login page
    };

    /**
     * Helper function to set cookies with secure and sameSite options.
     */
    const setCookie = (name, value, options = {}) => {
        Cookies.set(name, value, {
            ...options,
            secure: isProduction,
            sameSite: isProduction ? "None" : "Lax"
        });
    };

    /**
     * Request interceptor to attach access token and CSRF token to request headers.
     */
    const requestInterceptor = (config) => {
        const accessToken = Cookies.get("access_token");
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const csrfToken = Cookies.get("csrftoken");  // Fixed typo
        if (csrfToken) {
            config.headers["X-CSRFToken"] = csrfToken;
        }

        return config;
    };

    /**
     * Response interceptor to handle token updates and other response modifications.
     */
    const responseInterceptor = (response) => {
        const newCsrfToken = response.headers["x-csrftoken"];
        if (newCsrfToken) {
            setCookie("csrftoken", newCsrfToken);
        }

        const accessToken = response.data.access_token;
        if (accessToken) {
            setCookie("access_token", accessToken, { expires: new Date(Date.now() + 15 * 60 * 1000) });
        }

        const refreshToken = response.data.refresh_token;
        if (refreshToken) {
            setCookie("refresh_token", refreshToken, { expires: 7 });
        }

        if (response.config.url.includes("/logout/")) {
            Cookies.remove("access_token");
            Cookies.remove("refresh_token");
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
                    const newAccessToken = response.data.access_token;
                    setCookie("access_token", newAccessToken, { expires: new Date(Date.now() + 15 * 60 * 1000) });

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

    return { authAxios, setCookie };
};

export default useAuthAxios;
