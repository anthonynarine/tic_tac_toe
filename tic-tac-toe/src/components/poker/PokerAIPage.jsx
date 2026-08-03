import React, { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { pokerApi } from "../../api/pokerApi";
import { showToast } from "../../utils/toast/Toast";
import PokerTable from "./PokerTable";
import { usePokerGame } from "./hooks/usePokerGame";

export default function PokerAIPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState(params.id || null);
  const [aiPlayerCount, setAiPlayerCount] = useState(3);
  const [creating, setCreating] = useState(false);
  const { state, act, nextHand, createAiRematch } = usePokerGame(gameId, { multiplayer: false });

  const createInitial = useCallback(async () => {
    setCreating(true);
    try {
      const game = await pokerApi.createGame(true, { ai_player_count: aiPlayerCount });
      setGameId(String(game.id));
      navigate(`/games/poker/ai/${game.id}`, { replace: true });
    } catch {
      showToast("error", "Could not create poker game.");
    } finally {
      setCreating(false);
    }
  }, [aiPlayerCount, navigate]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col">
        {!gameId ? (
          <div className="grid min-h-[calc(100dvh-120px)] place-items-center px-4">
            <div className="w-full max-w-md rounded-xl border border-stone-200/[0.08] bg-[linear-gradient(180deg,rgba(18,15,12,0.86),rgba(7,6,5,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.38)]">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/75">No-limit Texas Hold'em</div>
              <h1 className="mt-2 text-2xl font-bold text-text-primary">AI Table</h1>
              <div className="mt-5">
                <label className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  <span>AI Players</span>
                  <span className="rounded bg-emerald-300/12 px-2 py-0.5 text-emerald-100">{aiPlayerCount}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={aiPlayerCount}
                  onChange={(event) => setAiPlayerCount(Number(event.target.value))}
                  className="mt-3 w-full accent-emerald-200"
                />
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[1, 3, 5, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAiPlayerCount(count)}
                      className={[
                        "rounded-md border px-2 py-1.5 text-xs font-bold transition",
                        aiPlayerCount === count
                          ? "border-emerald-200/35 bg-emerald-300/18 text-emerald-50"
                          : "border-white/[0.08] bg-black/24 text-text-secondary hover:border-emerald-200/22 hover:text-emerald-50",
                      ].join(" ")}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={createInitial}
                className="mt-6 h-11 w-full rounded-lg border border-emerald-100/35 bg-emerald-200 text-sm font-black uppercase tracking-[0.12em] text-slate-950 shadow-[0_10px_28px_rgba(16,185,129,0.2)] transition hover:bg-emerald-100 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-70"
              >
                {creating ? "Creating..." : "Start Table"}
              </button>
            </div>
          </div>
        ) : null}
        {state.status === "loading" && <div className="grid min-h-[calc(100dvh-120px)] place-items-center text-sm text-text-secondary">Loading poker...</div>}
        {state.status === "error" && <div className="grid min-h-[calc(100dvh-120px)] place-items-center text-sm text-brand-rose">{state.error}</div>}
        {state.game && state.status !== "error" ? (
          <PokerTable game={state.game} onAction={act} onNextHand={nextHand} onPlayAgain={createAiRematch} />
        ) : null}
      </div>
    </div>
  );
}
