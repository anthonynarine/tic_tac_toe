import { createContext, useContext, useState } from "react";

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    return (
        <UIContext.Provider value={{ isSidebarOpen, setSidebarOpen }}>
        {children}
        </UIContext.Provider>
    );
};
