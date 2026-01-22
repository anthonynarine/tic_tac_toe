// ✅ New Code
// # Filename: src/components/notifications/InviteCard.jsx

import React, { useMemo } from "react";

const GAME_LABELS = {
  tic_tac_toe: "Tic Tac Toe",
  connect_4: "Connect 4",
};

/**
 * InviteCard (Presentational)
 *
 * Action-only card for PENDING invites.
 * - No Join button
 * - No status history
 * - No navigation
 */
export default function InviteCard({ invite, onAccept, onDecline }) {
  const fromName = invite?.fromUserName || "Friend";
  const gameType = invite?.gameType || "tic_tac_toe";
  const lobbyId = invite?.lobbyId;

  const gameLabel = useMemo(() => {
    return GAME_LABELS[gameType] || gameType;
  }, [gameType]);

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {fromName}
          </p>
          <p className="text-xs text-slate-400">
            {gameLabel}
            {lobbyId ? ` • Lobby ${lobbyId}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={async () => await onAccept(invite)}
            className="rounded-md bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30"
            title="Accept invite"
          >
            Accept
          </button>

          <button
            onClick={async () => await onDecline(invite)}
            className="rounded-md bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30"
            title="Decline invite"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
