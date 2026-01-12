// # Filename: src/config.js


import { getToken } from "./components/auth/tokenStore";

// Step 1: Environment-aware mode
const isProduction = process.env.NODE_ENV === "production";

/**
 * resolveApiBaseUrl
 *
 * Priority:
 * 1) REACT_APP_API_BASE_URL (explicit override)
 * 2) REACT_APP_PROD_URL (prod) / REACT_APP_DEV_URL (dev)
 * 3) fallback hardcoded
 */
const resolveApiBaseUrl = () => {
  // Step 1: explicit override (best for Netlify)
  const explicit =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    "";

  if (explicit) return explicit.replace(/\/$/, "");

  // Step 2: env per mode
  const envUrl = isProduction
    ? process.env.REACT_APP_PROD_URL
    : process.env.REACT_APP_DEV_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

  // Step 3: fallback (safe defaults)
  return isProduction
    ? "https://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/api"
    : "http://localhost:8000/api";
};

/**
 * resolveWebsocketBaseUrl
 *
 * Uses:
 * - REACT_APP_BACKEND_WS (host:port, no scheme)
 * - Automatically picks ws/wss based on current page protocol
 */
const resolveWebsocketBaseUrl = () => {
  // Step 1: backendHost should be like "localhost:8000" or "your-prod-host.com"
  const backendHost =
    process.env.REACT_APP_BACKEND_WS ||
    (isProduction
      ? "tic-tac-toe-server-66c5e15cb1f1.herokuapp.com"
      : "localhost:8000");

  // Step 2: choose ws vs wss based on current page protocol
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";

  // Step 3: your backend routes WS under /ws/...
  return `${scheme}://${backendHost}/ws`;
};

const config = {
  // Step 2: Base URLs
  apiBaseUrl: resolveApiBaseUrl(),
  websocketBaseUrl: resolveWebsocketBaseUrl(),

  // Step 3: Always read tokens via tokenStore (cookie/local/session aware)
  getAccessToken: () => getToken("access_token"),
};

export default config;
