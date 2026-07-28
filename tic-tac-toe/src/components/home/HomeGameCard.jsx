// # Filename: src/components/home/HomeGameCard.jsx
import React from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";

const GAME_META = {
  ttt:            { tagline: "Real-time 1v1 strategy" },
  "connect-four": { tagline: "Drop pieces, connect four to win" },
  sudoku:         { tagline: "Fill the 9×9 grid with logic" },
};

function StandardCard({ game, onComingSoon }) {
  const Icon = game.icon;
  const { tagline } = GAME_META[game.id] ?? { tagline: "" };
  const isLive = game.statusText === "Live";

  return (
    <Card variant="glass" interactive className="relative p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-cyan/10 border border-brand-cyan/25">
          <Icon size={20} className="text-brand-cyan" />
        </div>
        {isLive && <LivePip />}
      </div>

      <h3 className="text-base font-semibold tracking-tight mb-1 text-text-primary">
        {game.title}
      </h3>
      <p className="text-[12px] mb-5 leading-relaxed text-text-secondary">
        {tagline}
      </p>

      <div className="flex gap-2">
        {game.actions ? (
          game.actions.map((action, i) => (
            <ActionButton key={action.id} label={action.label} onClick={action.onClick} primary={i === 0} />
          ))
        ) : (
          <ComingSoonButton onClick={() => onComingSoon?.(game.title)} />
        )}
      </div>
    </Card>
  );
}

function FeaturedCard({ game, onComingSoon }) {
  const Icon = game.icon;
  const { tagline } = GAME_META[game.id] ?? { tagline: "" };
  const isLive = game.statusText === "Live";

  return (
    <Card variant="glass" interactive className="relative overflow-hidden">
      {/* Subtle cyan top sheen */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/40 to-transparent" />

      <div className="p-5 sm:flex sm:items-center sm:gap-6">
        {/* Icon */}
        <div className="w-14 h-14 flex items-center justify-center shrink-0 mb-4 sm:mb-0 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30">
          <Icon size={28} className="text-brand-cyan" />
        </div>

        {/* Title + tagline */}
        <div className="flex-1 min-w-0 mb-4 sm:mb-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-semibold tracking-tight text-text-primary">
              {game.title}
            </h3>
            {isLive && <LivePip />}
          </div>
          <p className="text-sm text-text-secondary">{tagline}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 sm:shrink-0">
          {game.actions ? (
            game.actions.map((action, i) => (
              <ActionButton key={action.id} label={action.label} onClick={action.onClick} primary={i === 0} />
            ))
          ) : (
            <ComingSoonButton onClick={() => onComingSoon?.(game.title)} />
          )}
        </div>
      </div>
    </Card>
  );
}

export default function HomeGameCard({ game, featured = false, onComingSoon }) {
  return featured
    ? <FeaturedCard game={game} onComingSoon={onComingSoon} />
    : <StandardCard game={game} onComingSoon={onComingSoon} />;
}

function LivePip() {
  return (
    <Badge variant="success" className="gap-1.5 px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-glow-emerald" />
      Live
    </Badge>
  );
}

function ActionButton({ label, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      className={`px-4 py-2 rounded-button text-xs font-semibold uppercase tracking-wide transition-colors duration-150 border ${
        primary
          ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/20 hover:border-brand-cyan/60"
          : "bg-surface border-border-soft text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function ComingSoonButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-button text-[11px] font-semibold uppercase tracking-wider bg-surface border border-border-soft text-text-faint cursor-default"
    >
      Coming soon
    </button>
  );
}
