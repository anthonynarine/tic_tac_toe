import React from "react";
import { useParams } from "react-router-dom";

import PokerTable from "./PokerTable";
import { usePokerGame } from "./hooks/usePokerGame";

export default function PokerMPPage() {
  const { id: gameId } = useParams();
  const { state, act, nextHand } = usePokerGame(gameId, { multiplayer: true });

  return (
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 md:pt-10 pb-20 sm:pb-24">
      <div className="mx-auto max-w-3xl">
        {state.status === "loading" && <div className="min-h-[calc(100dvh-180px)] sm:min-h-[640px] grid place-items-center text-sm text-text-secondary">Loading poker...</div>}
        {state.status === "error" && <div className="min-h-[calc(100dvh-180px)] sm:min-h-[640px] grid place-items-center text-sm text-brand-rose">{state.error}</div>}
        {state.game && state.status !== "error" ? (
          <PokerTable game={state.game} wsStatus={state.wsStatus} onAction={act} onNextHand={nextHand} />
        ) : null}
      </div>
    </div>
  );
}
