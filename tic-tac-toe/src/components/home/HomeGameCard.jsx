// # Filename: src/components/home/HomeGameCard.jsx

import React from "react";

/**
 * Props:
 * - game: {
 *    id: string,
 *    title: string,
 *    statusText: string,
 *    icon: React.ComponentType,
 *    actions?: Array<{ id: string, label: string, onClick: () => Promise<void> | void }>
 *  }
 * - onComingSoon: (gameTitle: string) => void
 */
export default function HomeGameCard({ game, onComingSoon }) {
  const Icon = game.icon;
  const isLive = game.statusText === "Live";

  return (
    <div
      className="
        group relative
        rounded-2xl
        border border-slate-800/70
        bg-black/55
        backdrop-blur
        p-5
        shadow-[0_0_18px_rgba(29,161,242,0.04)]
        transition
        hover:border-[#1DA1F2]/25
        hover:shadow-[0_0_22px_rgba(29,161,242,0.08)]
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="
              grid h-11 w-11 place-items-center
              rounded-xl
              border border-slate-800/70
              bg-slate-950/35
              text-[#1DA1F2]/75
              transition
              group-hover:border-[#1DA1F2]/25
              group-hover:bg-[#1DA1F2]/08
              group-hover:text-[#1DA1F2]/90
            "
          >
            <Icon size={26} />
          </span>

          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-200/80 truncate">
              {game.title}
            </h3>

            <p
              className={[
                "mt-1 text-xs tracking-wide",
                isLive ? "text-emerald-300/70" : "text-slate-400/70",
              ].join(" ")}
            >
              {game.statusText}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {game.actions ? (
          game.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={async () => await a.onClick()}
              className="
                inline-flex items-center justify-center
                rounded-xl px-3 py-2
                text-sm font-semibold
                border border-slate-800/70
                bg-slate-950/35
                text-slate-200/70
                hover:bg-[#1DA1F2]/08
                hover:border-[#1DA1F2]/25
                hover:text-[#1DA1F2]/85
                transition
                focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/20
              "
            >
              {a.label}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={async () => onComingSoon(game.title)}
            className="
              inline-flex items-center justify-center
              rounded-xl px-3 py-2
              text-sm font-semibold
              border border-slate-800/70
              bg-slate-950/25
              text-slate-300/65
              hover:bg-slate-900/30
              hover:text-slate-200/75
              transition
            "
          >
            Coming soon
          </button>
        )}
      </div>
    </div>
  );
}
