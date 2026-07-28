// # Filename: src/components/lobby/hooks/useActiveLobbyId.js
// Step 1: Read current location
// Step 2: Extract { gameType, lobbyId } if path matches /lobby/:gameType/:id
// Step 3: Return { lobbyId: null, gameType: null } otherwise

import { useMemo } from "react";
import { useLocation, matchPath } from "react-router-dom";

export default function useActiveLobbyId() {
  const location = useLocation();

  return useMemo(() => {
    const m =
      matchPath({ path: "/lobby/:gameType/:id/*", end: false }, location.pathname) ||
      matchPath({ path: "/lobby/:gameType/:id", end: true }, location.pathname);

    return {
      lobbyId: m?.params?.id || null,
      gameType: m?.params?.gameType || null,
    };
  }, [location.pathname]);
}
