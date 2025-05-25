// hooks/useIsDesktop.js
import { useState, useEffect } from "react";

const useIsDesktop = () => {
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1025);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 1025px)");
        const handler = (e) => setIsDesktop(e.matches);

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return isDesktop;
};

export default useIsDesktop;
