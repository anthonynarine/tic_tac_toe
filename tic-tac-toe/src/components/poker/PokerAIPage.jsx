import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { pokerApi } from "../../api/pokerApi";
import { showToast } from "../../utils/toast/Toast";
import PokerTable from "./PokerTable";
import { usePokerGame } from "./hooks/usePokerGame";

export default function PokerAIPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState(params.id || null);
  const { state, act, nextHand, createAiRematch } = usePokerGame(gameId, { multiplayer: false });

  const createInitial = useCallback(async () => {
    try {
      const game = await pokerApi.createGame(true);
      setGameId(String(game.id));
      navigate(`/games/poker/ai/${game.id}`, { replace: true });
    } catch {
      showToast("error", "Could not create poker game.");
    }
  }, [navigate]);

  useEffect(() => {
    if (!gameId) createInitial();
  }, [gameId, createInitial]);

  return (
    <div className="w-full px-4 pt-8 md:pt-12 xl:pt-14 pb-24">
      <div className="mx-auto max-w-3xl">
        {state.status === "loading" && <div className="min-h-[640px] grid place-items-center text-sm text-text-secondary">Loading poker...</div>}
        {state.status === "error" && <div className="min-h-[640px] grid place-items-center text-sm text-brand-rose">{state.error}</div>}
        {state.game && state.status !== "error" ? (
          <PokerTable game={state.game} onAction={act} onNextHand={nextHand} onPlayAgain={createAiRematch} />
        ) : null}
      </div>
    </div>
  );
}
