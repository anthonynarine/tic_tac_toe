// # Filename: src/components/home/HomeGameCard.jsx
import React from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";

const GAME_META = {
  ttt:            { tagline: "Real-time 1v1 strategy" },
  "connect-four": { tagline: "Drop pieces, connect four to win" },
  checkers:       { tagline: "Capture pieces and crown kings" },
  poker:          { tagline: "Bet, read, and reveal the river" },
  sudoku:         { tagline: "Fill the 9×9 grid with logic" },
};

function StandardCard({ game, onComingSoon }) {
  const Icon = game.icon;
  const { tagline } = GAME_META[game.id] ?? { tagline: "" };
  const isLive = game.statusText === "Live";

  return (
    <Card variant="glass" interactive className="relative p-3.5 sm:p-5 [@media(min-width:768px)_and_(max-height:820px)]:p-3.5">
      <div className="flex items-start justify-between mb-3 sm:mb-4 [@media(min-width:768px)_and_(max-height:820px)]:mb-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-brand-cyan/10 border border-brand-cyan/25">
          <Icon size={20} className="text-brand-cyan" />
        </div>
        {isLive && <LivePip />}
      </div>

      <h3 className="text-base font-semibold tracking-tight mb-1 text-text-primary">
        {game.title}
      </h3>
      <p className="text-[12px] mb-3.5 sm:mb-5 leading-relaxed text-text-secondary [@media(min-width:768px)_and_(max-height:820px)]:mb-3.5">
        {tagline}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:flex">
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

      <div className="p-3.5 sm:flex sm:items-center sm:gap-6 sm:p-5 [@media(min-width:768px)_and_(max-height:820px)]:p-3.5">
        {/* Icon */}
        <div className="w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 mb-3 sm:mb-0 rounded-lg sm:rounded-xl bg-brand-cyan/10 border border-brand-cyan/30">
          <Icon size={28} className="text-brand-cyan" />
        </div>

        {/* Title + tagline */}
        <div className="flex-1 min-w-0 mb-4 sm:mb-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-text-primary">
              {game.title}
            </h3>
            {isLive && <LivePip />}
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">{tagline}</p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
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
      className={`min-h-11 px-2 py-2 rounded-button text-[10px] sm:min-h-0 sm:px-3 sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-wide transition-colors duration-150 border ${
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
