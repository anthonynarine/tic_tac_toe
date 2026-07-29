// # Filename: src/components/leaderboard/LeaderboardPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

import Card from "../ui/Card";
import LeaderboardRow from "./LeaderboardRow";
import { formatSeconds } from "./formatSeconds";
import { TicTacToeIcon, ConnectFourIcon, SudokuIcon } from "../home/GameIcons";
import { statsApi } from "../../api/statsApi";
import { useUserContext } from "../../context/userContext";

const TABS = [
  { id: "tic_tac_toe", label: "Tic-Tac-Toe", Icon: TicTacToeIcon, kind: "pvp" },
  { id: "connect_four", label: "Connect Four", Icon: ConnectFourIcon, kind: "pvp" },
  { id: "sudoku", label: "Sudoku", Icon: SudokuIcon, kind: "sudoku" },
];

const DIFFICULTIES = ["easy", "medium", "hard", "expert"];

export default function LeaderboardPage() {
  const { user } = useUserContext();
  const [activeTab, setActiveTab] = useState("tic_tac_toe");
  const [difficulty, setDifficulty] = useState("medium");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeTabDef = useMemo(
    () => TABS.find((t) => t.id === activeTab) || TABS[0],
    [activeTab]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTabDef.kind === "sudoku") {
        const data = await statsApi.getSudokuLeaderboard(difficulty);
        setRows(data?.rows || []);
      } else {
        const data = await statsApi.getPvpLeaderboard(activeTabDef.id);
        setRows(data?.rows || []);
      }
    } catch {
      setError("Failed to load leaderboard.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTabDef, difficulty]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 pb-20 sm:pb-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 sm:mb-6">
          <div className="hidden text-[11px] tracking-[0.28em] text-text-muted uppercase sm:block">
            Friends
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-wide">
            Leaderboard
          </h1>
        </div>

        {/* Game tabs */}
        <div className="grid grid-cols-3 gap-1.5 mb-3 sm:flex sm:gap-2 sm:mb-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                "flex-1 flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[11px] font-medium transition-colors sm:gap-1.5 sm:rounded-xl sm:px-2 sm:py-3 sm:text-xs",
                activeTab === id
                  ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                  : "border-border-soft bg-surface text-text-secondary hover:bg-surface-elevated",
              ].join(" ")}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>

        {/* Sudoku difficulty picker -- fixed-height slot so its presence/absence
            never shifts the layout below it */}
        <div className="min-h-9 mb-3 flex items-center sm:mb-4">
          {activeTabDef.kind === "sudoku" && (
            <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={[
                    "px-2 py-1 rounded-lg text-xs font-semibold capitalize transition focus:outline-none sm:px-2.5",
                    difficulty === d
                      ? "border border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan"
                      : "border border-border-soft bg-transparent text-text-muted hover:text-text-secondary",
                  ].join(" ")}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fixed-height results panel: content scrolls internally instead of
            growing/shrinking the card (and shifting the vertically-centered
            app shell) as loading/empty/row-count states change. */}
        <Card variant="glass" className="p-2.5 h-[min(54dvh,380px)] min-h-[300px] flex flex-col sm:p-3 sm:h-[380px]">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-text-secondary">Loading…</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-brand-rose">{error}</p>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="flex-1 flex items-center justify-center px-6">
              <p className="text-sm text-text-faint text-center">
                No results yet — play a few games with friends to show up here.
              </p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <ul className="space-y-2 overflow-y-auto tron-scrollbar-dark pr-1">
              {rows.map((row, idx) => (
                <LeaderboardRow
                  key={row.userId}
                  rank={idx + 1}
                  name={row.name}
                  isMe={row.userId === user?.id}
                  streak={row.currentStreak || 0}
                  primaryValue={
                    activeTabDef.kind === "sudoku"
                      ? formatSeconds(row.bestTimeSeconds)
                      : row.wins
                  }
                  secondaryLabel={
                    activeTabDef.kind === "sudoku"
                      ? "best time"
                      : `${row.wins}W – ${row.losses}L – ${row.draws}D`
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
