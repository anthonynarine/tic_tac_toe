// config.js

import Cookies from "js-cookie";

const isProduction = process.env.NODE_ENV === "production";

const config = {
    apiBaseUrl: isProduction
        ? "https://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/api"
        : "http://localhost:8000/api",
    websocketBaseUrl: isProduction
        ? "wss://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/ws"
        : "ws://localhost:8000/ws",
    getAccessToken: () => {
        return isProduction
            ? Cookies.get("access_token")
            : localStorage.getItem("access_token");
    }
};

export default config;
