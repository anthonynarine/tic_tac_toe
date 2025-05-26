/**
 * useIsDesktop
 *
 * A custom React hook that determines whether the viewport width is at least 1200px.
 * Commonly used to toggle between desktop and mobile/tablet layouts for responsive components.
 *
 * It uses the Window.matchMedia API to listen for changes to the screen width,
 * updating its internal state in real-time as the window is resized.
 *
 * @returns {boolean} isDesktop - True if the viewport is ≥ 1200px wide, false otherwise.
 *
 * Example usage:
 *   const isDesktop = useIsDesktop();
 *   if (isDesktop) renderDesktopSidebar();
 */

import { useState, useEffect } from "react";

const useIsDesktop = () => {
    // Initialize state based on current window width
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1200);

    useEffect(() => {
        // Create a media query that matches when width is ≥ 1200px
        const mediaQuery = window.matchMedia("(min-width: 1200px)");

        // Define the handler that updates state on match change
        const handler = (e) => setIsDesktop(e.matches);

        // Attach the listener
        mediaQuery.addEventListener("change", handler);

        // Cleanup the event listener on unmount
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return isDesktop;
};

export default useIsDesktop;
