import React from "react";

export default function CheckersStatusBar({
  currentTurn,
  myPiece,
  winner,
  isCompleted,
  p1Name = "Red",
  p2Name = "Blue",
  wsStatus,
  isAI = false,
}) {
  const turnName = currentTurn === 1 ? p1Name : p2Name;
  const winnerName = winner === 1 ? p1Name : winner === 2 ? p2Name : null;
  const text = isCompleted
    ? winnerName ? `${winnerName} wins` : "Draw"
    : myPiece === currentTurn ? "Your turn" : `${turnName}'s turn`;

  return (
    <div
      className="
        w-full mx-auto rounded-t-xl border border-b-0 border-brand-cyan/20 bg-background-app
        px-3 pt-2.5 pb-2
        [@media(min-width:768px)_and_(max-height:700px)]:pt-1.5
        [@media(min-width:768px)_and_(max-height:700px)]:pb-1
      "
      style={{ maxWidth: "min(88vw, 640px, calc(100dvh - 450px))" }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 [@media(min-width:768px)_and_(max-height:700px)]:mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
          {isAI ? "vs AI" : "Multiplayer"}
        </span>
        {wsStatus ? (
          <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2 py-0.5 text-[10px] text-brand-cyan">
            WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-primary truncate">{text}</div>
        <div className="text-[11px] text-text-secondary">
          You are {myPiece === 1 ? "Red" : "Blue"}
        </div>
      </div>
    </div>
  );
}
