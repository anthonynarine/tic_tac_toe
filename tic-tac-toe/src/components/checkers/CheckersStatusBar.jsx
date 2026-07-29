import React from "react";

export default function CheckersStatusBar({
  currentTurn,
  myPiece,
  winner,
  isCompleted,
  p1Name = "Red",
  p2Name = "Blue",
  wsStatus,
}) {
  const turnName = currentTurn === 1 ? p1Name : p2Name;
  const winnerName = winner === 1 ? p1Name : winner === 2 ? p2Name : null;
  const text = isCompleted
    ? winnerName ? `${winnerName} wins` : "Draw"
    : myPiece === currentTurn ? "Your turn" : `${turnName}'s turn`;

  return (
    <div className="w-full max-w-[min(88vw,520px)] flex items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-primary truncate">{text}</div>
        <div className="text-[11px] text-text-secondary">
          You are {myPiece === 1 ? p1Name : p2Name}
        </div>
      </div>
      {wsStatus ? (
        <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2.5 py-1 text-[11px] text-brand-cyan">
          WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
        </span>
      ) : null}
    </div>
  );
}
