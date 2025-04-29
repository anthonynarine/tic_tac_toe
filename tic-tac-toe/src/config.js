const isProduction = process.env.NODE_ENV === "production";

const config = {
    apiBaseUrl: isProduction 
        ? "https://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/api"
        : "http://localhost:8000/api",
    
    websocketBaseUrl: isProduction
        ? "wss://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/ws"
        : "ws://localhost:8000/ws",
};

export default config;
