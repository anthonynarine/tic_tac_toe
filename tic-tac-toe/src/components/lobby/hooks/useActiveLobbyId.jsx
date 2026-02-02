// # Filename: src/components/lobby/hooks/useActiveLobbyId.js
// Step 1: Read current location
// Step 2: Extract lobbyId if path matches /lobby/:id
// Step 3: Return null otherwise

import { useMemo } from "react";
import { useLocation, matchPath } from "react-router-dom";

export default function useActiveLobbyId() {
  const location = useLocation();

  return useMemo(() => {
    const m =
      matchPath({ path: "/lobby/:id/*", end: false }, location.pathname) ||
      matchPath({ path: "/lobby/:id", end: true }, location.pathname);

    return m?.params?.id || null;
  }, [location.pathname]);
}
