// # Filename: src/routes/RouteLogger.jsx


import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * RouteLogger
 *
 * Dev-only route debug logger.
 * Logs pathname + search whenever the location changes.
 */
export default function RouteLogger() {
  const location = useLocation();
  const navType = useNavigationType(); // PUSH | POP | REPLACE

  useEffect(() => {
    // # Step 1: Only log in development
    if (process.env.NODE_ENV !== "development") return;

    const { pathname, search, hash, state } = location;

    console.log(
      "[ROUTE]",
      navType,
      `${pathname}${search}${hash}`,
      state ? { state } : ""
    );
  }, [location, navType]);

  return null;
}
