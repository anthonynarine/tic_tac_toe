// # Filename: src/components/leaderboard/LeaderboardRow.jsx
import React from "react";
import Badge from "../ui/Badge";

const RANK_COLORS = {
  1: "text-brand-amber",
  2: "text-text-secondary",
  3: "text-brand-amber/60",
};

export default function LeaderboardRow({
  rank,
  name,
  primaryValue,
  secondaryLabel,
  isMe = false,
  streak = 0,
}) {
  return (
    <li
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
        isMe
          ? "border-brand-cyan/30 bg-brand-cyan/5"
          : "border-border-soft bg-surface",
      ].join(" ")}
    >
      <span
        className={[
          "w-6 shrink-0 text-sm font-bold tabular-nums text-center",
          RANK_COLORS[rank] || "text-text-faint",
        ].join(" ")}
      >
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {name}
          </span>
          {isMe && <Badge variant="brand">You</Badge>}
          {streak >= 3 && <Badge variant="warning">🔥 {streak}</Badge>}
        </div>
        {secondaryLabel && (
          <p className="text-xs text-text-faint mt-0.5">{secondaryLabel}</p>
        )}
      </div>

      <span className="text-base font-semibold text-brand-cyan tabular-nums shrink-0">
        {primaryValue}
      </span>
    </li>
  );
}
