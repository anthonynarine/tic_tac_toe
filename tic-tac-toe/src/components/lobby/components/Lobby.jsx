// # Filename: src/components/lobby/Lobby.jsx
// Step 1: Thin route wrapper — LobbyPage is the single canonical lobby screen.
// Step 2: LobbyPage owns ALL lobby + chat WebSocket side-effects.
// Step 3: This wrapper must never open sockets or manage lobby state.

import React from "react";
import LobbyPage from "./LobbyPage";

export default function Lobby() {
  return <LobbyPage />;
}
