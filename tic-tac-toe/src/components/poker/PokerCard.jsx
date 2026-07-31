import React from "react";

const SUITS = {
  c: { symbol: "♣", cls: "text-slate-900" },
  d: { symbol: "♦", cls: "text-red-600" },
  h: { symbol: "♥", cls: "text-red-600" },
  s: { symbol: "♠", cls: "text-slate-900" },
};

export default function PokerCard({
  card,
  small = false,
  mini = false,
  animate = false,
  delay = 0,
  dealVariant = "community",
}) {
  const hidden = !card || card === "??";
  const rank = hidden ? "" : card[0];
  const suit = hidden ? null : SUITS[card[1]];
  const animationClass = animate
    ? dealVariant === "hole"
      ? "poker-card-deal-hole"
      : "poker-card-deal"
    : "";
  return (
    <div
      className={[
        "relative rounded-md border shadow-[0_12px_28px_rgba(0,0,0,0.28)]",
        mini ? "h-12 w-8" : small ? "h-16 w-11" : "h-16 w-11 sm:h-24 sm:w-16",
        animationClass,
        hidden
          ? "border-brand-cyan/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(15,23,42,0.9))]"
          : "border-white/70 bg-slate-50",
      ].join(" ")}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      {hidden ? (
        <div className="absolute inset-1 rounded border border-white/10 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.3),transparent_55%)]" />
      ) : (
        <div className={`h-full flex flex-col justify-between p-1.5 font-black ${suit.cls}`}>
          <span className={mini ? "text-xs leading-none" : small ? "text-base leading-none" : "text-base leading-none sm:text-lg"}>{rank}</span>
          <span className={mini ? "text-base leading-none self-center" : small ? "text-xl leading-none self-center" : "text-xl leading-none self-center sm:text-2xl"}>
            {suit.symbol}
          </span>
          <span className={`${mini ? "text-xs" : small ? "text-base" : "text-base sm:text-lg"} leading-none self-end rotate-180`}>{rank}</span>
        </div>
      )}
    </div>
  );
}
