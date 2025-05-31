// App.jsx
import React from "react";
import { ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";

// Context Providers
import { UIProvider } from "./components/context/uiContext";
import { UserProvider } from "./components/context/userContext";
import { DirectMessageProvider } from "./components/context/directMessageContext";

// Route container
import AppRoutes from "./routes/AppRoutes";

// Isolated page
import TechnicalPaper from "./components/technical-paper/TechnicalPaper";

function App() {
    const location = useLocation();

    // ✅ Isolated route with zero layout, no providers, no WebSocket
    if (location.pathname === "/technical-paper") {
        return <TechnicalPaper />;
    }

    return (
        <>
        <ToastContainer />
        <UIProvider>
            <UserProvider>
            <DirectMessageProvider>
                <AppRoutes />
            </DirectMessageProvider>
            </UserProvider>
        </UIProvider>
        </>
    );
}

export default App;
