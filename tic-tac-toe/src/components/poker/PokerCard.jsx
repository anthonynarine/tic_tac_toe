import React from "react";

const SUITS = {
  c: { symbol: "♣", cls: "text-slate-900" },
  d: { symbol: "♦", cls: "text-red-600" },
  h: { symbol: "♥", cls: "text-red-600" },
  s: { symbol: "♠", cls: "text-slate-900" },
};

export default function PokerCard({
  card,
  micro = false,
  mobileHero = false,
  small = false,
  mini = false,
  compact = false,
  faceDown = false,
  animate = false,
  delay = 0,
  dealVariant = "community",
}) {
  const hidden = !card || card === "??";
  const rank = hidden ? "" : card[0];
  const suit = hidden ? null : SUITS[card[1]];
  const cardLabel = faceDown ? "Face-down card" : hidden ? "Empty card slot" : `${rank} ${suit?.symbol || ""}`;
  const animationClass = animate
    ? dealVariant === "hole"
      ? "poker-card-deal-hole"
      : "poker-card-deal"
    : "";
  const compactContent = micro || mobileHero;
  return (
    <div
      className={[
        "relative overflow-hidden rounded-md border shadow-[0_12px_28px_rgba(0,0,0,0.28)]",
        mobileHero ? "h-10 w-7" : micro ? "h-9 w-6" : mini ? "h-12 w-8" : compact ? "h-14 w-10 sm:h-16 sm:w-11" : small ? "h-16 w-11" : "h-16 w-11 sm:h-24 sm:w-16",
        animationClass,
        faceDown
          ? "border-cyan-100/45 bg-[#111827]"
          : hidden
          ? "border-brand-cyan/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(15,23,42,0.9))]"
          : "border-white/70 bg-slate-50",
      ].join(" ")}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
      aria-label={cardLabel}
    >
      {faceDown ? (
        <div className="absolute inset-1 overflow-hidden rounded border border-cyan-100/35 bg-[radial-gradient(circle_at_50%_48%,rgba(34,211,238,0.18),transparent_42%),linear-gradient(135deg,rgba(190,18,60,0.92),rgba(76,5,25,0.98))]">
          <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.13)_0_1px,transparent_1px_5px)]" />
          <div className="absolute inset-[18%] rounded-sm border border-cyan-100/30 bg-black/12" />
          <div className="absolute inset-[32%] rounded-full border border-cyan-100/35 bg-cyan-100/12 shadow-[0_0_14px_rgba(34,211,238,0.2)]" />
        </div>
      ) : hidden ? (
        <div className="absolute inset-1 rounded border border-white/10 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.3),transparent_55%)]" />
      ) : (
        <div className={`h-full min-h-0 flex flex-col justify-between ${compactContent ? "p-1" : "p-1.5"} font-black ${suit.cls}`}>
          <span className={compactContent ? "text-[10px] leading-none" : mini ? "text-xs leading-none" : compact ? "text-sm leading-none" : small ? "text-base leading-none" : "text-base leading-none sm:text-lg"}>{rank}</span>
          <span className={compactContent ? "text-sm leading-none self-center" : mini ? "text-base leading-none self-center" : compact ? "text-lg leading-none self-center" : small ? "text-xl leading-none self-center" : "text-xl leading-none self-center sm:text-2xl"}>
            {suit.symbol}
          </span>
          <span className={`${compactContent ? "text-[10px]" : mini ? "text-xs" : compact ? "text-sm" : small ? "text-base" : "text-base sm:text-lg"} inline-block leading-none self-end rotate-180`}>{rank}</span>
        </div>
      )}
    </div>
  );
}
