// # Filename: src/home/HomeFeatureCard.jsx
import React from "react";

/**
 * HomeFeatureCard
 * - Use this for both LIVE and COMING SOON cards.
 *
 * Props:
 * - title: string
 * - description: string
 * - icon: ReactNode
 * - badge?: string (e.g. "LIVE", "SOON")
 * - disabled?: boolean
 * - onClick?: () => Promise<void> | void
 * - actions?: Array<{ id: string, label: string, onClick: () => Promise<void> | void }>
 */
export default function HomeFeatureCard({
  title,
  description,
  icon,
  badge,
  disabled = false,
  onClick,
  actions,
}) {
  return (
    <div
      className={[
        "group relative rounded-2xl border border-slate-800/70 bg-black/55 backdrop-blur p-5",
        "shadow-[0_0_18px_rgba(29,161,242,0.04)] transition",
        disabled
          ? "opacity-70"
          : "hover:border-[#1DA1F2]/25 hover:shadow-[0_0_22px_rgba(29,161,242,0.08)]",
      ].join(" ")}
      role={onClick && !disabled ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : -1}
      onClick={async () => {
        if (disabled) return;
        if (onClick) await onClick();
      }}
      onKeyDown={async (e) => {
        if (disabled) return;
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          await onClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={[
              "grid h-11 w-11 place-items-center rounded-xl border border-slate-800/70 bg-slate-950/35",
              "text-[#1DA1F2]/75 transition",
              disabled
                ? ""
                : "group-hover:border-[#1DA1F2]/25 group-hover:bg-[#1DA1F2]/08 group-hover:text-[#1DA1F2]/90",
            ].join(" ")}
          >
            {icon}
          </span>

          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-200/80 truncate">
              {title}
            </h3>
            <p className="mt-1 text-xs tracking-wide text-slate-400/70">
              {description}
            </p>
          </div>
        </div>

        {badge ? (
          <span
            className={[
              "text-[11px] px-2 py-1 rounded-full border bg-white/5",
              badge === "LIVE"
                ? "border-emerald-400/20 text-emerald-300/80"
                : "border-slate-700/60 text-slate-200/60",
            ].join(" ")}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {/* Optional actions row (used by Games card) */}
      {Array.isArray(actions) && actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={async (e) => {
                e.stopPropagation();
                if (disabled) return;
                await a.onClick();
              }}
              className={[
                "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold",
                "border border-slate-800/70 bg-slate-950/35 text-slate-200/70 transition",
                disabled
                  ? "cursor-not-allowed"
                  : "hover:bg-[#1DA1F2]/08 hover:border-[#1DA1F2]/25 hover:text-[#1DA1F2]/85",
                "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/20",
              ].join(" ")}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* If disabled, show a subtle footer hint */}
      {disabled ? (
        <div className="mt-4 text-xs text-slate-400/60">Planned module — coming soon.</div>
      ) : null}
    </div>
  );
}
