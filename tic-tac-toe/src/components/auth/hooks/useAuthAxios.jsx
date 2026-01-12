// # Filename: src/hooks/useAuthAxios.jsx

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

// NOTE: Update these paths if your auth folder differs.
// Based on your screenshot, authAxios lives at: src/components/auth/authAxios.js
import authAxios from "../authAxios";
import {
  setToken,
  getToken,
  removeToken,
  clearAuthCookies,
} from "../tokenStore"; 
import { AUTH_MODES, getAuthMode } from "../authMode"; 

let refreshTokenPromise = null;

const useAuthAxios = () => {
  const navigate = useNavigate();

  // Step 1: Decide whether to send cookies with requests (cookie-mode only)
  const shouldSendCredentials = () => getAuthMode() === AUTH_MODES.COOKIE; 

  /**
   * Clear all auth-related tokens and redirect to login.
   */
  const handleAuthError = () => {
    removeToken("access_token");
    removeToken("refresh_token");
    clearAuthCookies(); 
    navigate("/login");
  };

  /**
   * Determine if a request should NOT include Authorization headers.
   * We only treat these as public:
   * - POST /users/ (registration)
   * - POST /token/ (login)
   * - POST /token/refresh/ (refresh)
   *
   * Args:
   *   config (object): Axios request configuration.
   *
   * Returns:
   *   boolean: True if request is public, otherwise false.
   */
  const isPublicRequest = (config) => {
    const method = (config?.method || "get").toLowerCase();
    const rawUrl = config?.url || "";

    let path = rawUrl;
    try {
      const base = authAxios?.defaults?.baseURL || window.location.origin;
      path = new URL(rawUrl, base).pathname;
    } catch (e) {
      path = rawUrl;
    }

    const isToken = path === "/token/" || path === "/api/token/";
    const isRefresh =
      path === "/token/refresh/" || path === "/api/token/refresh/";
    const isRegister =
      (path === "/users/" || path === "/api/users/") && method === "post";

    return isToken || isRefresh || isRegister;
  };

  /**
   * Attach access token to outgoing request headers.
   *
   * Args:
   *   config (object): Axios request configuration.
   *
   * Returns:
   *   object: Modified request config with Authorization header.
   */
  const requestInterceptor = (config) => {
    // Step 1: Ensure headers exist
    config.headers = config.headers || {};

    // Step 2: If public (or explicitly skipped), do not attach Authorization
    if (config.skipAuth || isPublicRequest(config)) {
      if (config.headers.Authorization) {
        delete config.headers.Authorization;
      }
      if (config.headers["Authorization"]) {
        delete config.headers["Authorization"];
      }
      return config;
    }

    // Step 3: Attach Authorization for protected endpoints
    const accessToken = getToken("access_token");
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return config;
  };

  /**
   * Handle token storage after successful login or refresh.
   *
   * Args:
   *   response (object): Axios response object.
   *
   * Returns:
   *   object: The original response.
   */
  const responseInterceptor = (response) => {
    // Step 1: Only store tokens for token endpoints (avoid accidental overwrites)
    const url = response?.config?.url || "";
    const isTokenResponse =
      url.includes("/token/") || url.includes("/token/refresh/");

    if (isTokenResponse) {
      const accessToken = response?.data?.access;
      const refreshToken = response?.data?.refresh;

      if (accessToken) {
        setToken("access_token", accessToken);
      }

      if (refreshToken) {
        setToken("refresh_token", refreshToken, { expires: 7 });
      }
    }

    // Step 2: Handle logout responses
    if (response?.config?.url?.includes("/logout/")) {
      removeToken("access_token");
      removeToken("refresh_token");
      clearAuthCookies(); 
    }

    return response;
  };

  /**
   * Handle 401 errors and attempt to refresh the token.
   * Ensures only one refresh request is sent even if multiple fail.
   *
   * Args:
   *   error (object): Axios error object.
   *
   * Returns:
   *   Promise: Retry of original request or logout on failure.
   */
  const responseErrorInterceptor = async (error) => {
    const originalRequest = error.config;

    // Step 1: Never attempt refresh for public endpoints (prevents loops)
    if (originalRequest?.skipAuth || isPublicRequest(originalRequest)) {
      return Promise.reject(error);
    }

    // Step 2: If refresh endpoint itself fails, force logout
    if (originalRequest?.url?.includes("/token/refresh/")) {
      handleAuthError();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getToken("refresh_token");
      if (!refreshToken) {
        handleAuthError();
        return Promise.reject(error);
      }

      // Step 3: Single-flight refresh
      if (!refreshTokenPromise) {
        refreshTokenPromise = authAxios.post(
          "/token/refresh/",
          { refresh: refreshToken },
          {
            withCredentials: shouldSendCredentials(), 
            skipAuth: true,
          }
        );
      }

      try {
        const response = await refreshTokenPromise;
        refreshTokenPromise = null;

        const newAccessToken = response?.data?.access;
        if (!newAccessToken) {
          handleAuthError();
          return Promise.reject(error);
        }

        setToken("access_token", newAccessToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return authAxios(originalRequest);
      } catch (refreshError) {
        refreshTokenPromise = null;
        handleAuthError();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  };

  /**
   * useEffect to attach Axios interceptors on mount and clean them up on unmount.
   * Also restores Authorization header from stored access token.
   */
  useEffect(() => {
    const existingAccessToken = getToken("access_token");
    if (existingAccessToken) {
      authAxios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${existingAccessToken}`;
    }

    const reqInterceptor = authAxios.interceptors.request.use(
      requestInterceptor,
      (err) => Promise.reject(err)
    );

    const resInterceptor = authAxios.interceptors.response.use(
      responseInterceptor,
      responseErrorInterceptor
    );

    return () => {
      authAxios.interceptors.request.eject(reqInterceptor);
      authAxios.interceptors.response.eject(resInterceptor);
    };
  }, [navigate]);

  return { authAxios, setToken, getToken, removeToken };
};

export default useAuthAxios;
