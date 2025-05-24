import React from "react";
import { ToastContainer } from "react-toastify";

// Context Providers
import { UIProvider } from "./components/context/uiContext";
import { UserProvider } from "./components/context/userContext";
import { DirectMessageProvider } from "./components/context/directMessageContext";

// Routes (new split file)
import AppRoutes from "./AppRoutes";

function App() {
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
