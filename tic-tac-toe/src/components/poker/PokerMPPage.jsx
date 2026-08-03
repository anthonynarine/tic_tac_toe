import React from "react";
import { useParams } from "react-router-dom";

import PokerTable from "./PokerTable";
import { usePokerGame } from "./hooks/usePokerGame";

export default function PokerMPPage() {
  const { id: gameId } = useParams();
  const { state, act, nextHand } = usePokerGame(gameId, { multiplayer: true });

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col">
        {state.status === "loading" && <div className="grid min-h-[calc(100dvh-120px)] place-items-center text-sm text-text-secondary">Loading poker...</div>}
        {state.status === "error" && <div className="grid min-h-[calc(100dvh-120px)] place-items-center text-sm text-brand-rose">{state.error}</div>}
        {state.game && state.status !== "error" ? (
          <PokerTable game={state.game} wsStatus={state.wsStatus} onAction={act} onNextHand={nextHand} />
        ) : null}
      </div>
    </div>
  );
}
