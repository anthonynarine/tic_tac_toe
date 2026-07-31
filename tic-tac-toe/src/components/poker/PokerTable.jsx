import React, { useEffect, useMemo, useState } from "react";
import { LuBadgeDollarSign, LuCircleDollarSign, LuCopy, LuRefreshCw } from "react-icons/lu";
import { CiHome } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

import Button from "../ui/Button";
import PokerCard from "./PokerCard";
import { showToast } from "../../utils/toast/Toast";

const SEAT_POSITIONS = [
  "lg:left-[4%] lg:top-[42%]",
  "lg:left-[14%] lg:top-[14%]",
  "lg:left-[36%] lg:top-[5%]",
  "lg:right-[36%] lg:top-[5%]",
  "lg:right-[14%] lg:top-[14%]",
  "lg:right-[4%] lg:top-[42%]",
  "lg:right-[21%] lg:bottom-[9%]",
  "lg:left-[21%] lg:bottom-[9%]",
];

function BetMarker({ amount, name, className = "" }) {
  if (!amount) return null;
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 rounded-md bg-cyan-100 px-2 py-1 text-[11px] font-black text-slate-950 shadow-[0_8px_22px_rgba(0,0,0,0.3)]",
        className,
      ].join(" ")}
      title={`${name || "Player"} bet ${amount}`}
    >
      <span className="h-3 w-3 rounded-full border border-cyan-900/40 bg-[radial-gradient(circle_at_35%_35%,#ffffff_0_18%,#67e8f9_20%_58%,#0e7490_60%)]" />
      <span>{amount}</span>
    </div>
  );
}

function PlayerPanel({
  name,
  chips,
  bet,
  cards,
  active,
  label,
  dealer,
  best,
  folded,
  allIn,
  className = "",
  tableSeat = false,
  showMeta = true,
  handNumber = 1,
  seat,
}) {
  return (
    <div className={[
      "relative overflow-visible transition duration-200",
      tableSeat
        ? "w-[154px] rounded-sm px-2 py-1.5 shadow-[0_12px_26px_rgba(0,0,0,0.32)]"
        : "w-full rounded-lg border px-3 py-2.5",
      "bg-slate-950/88 backdrop-blur",
      folded ? "opacity-60" : "opacity-100",
      tableSeat
        ? active
          ? "shadow-[0_0_26px_rgba(16,185,129,0.24),0_12px_26px_rgba(0,0,0,0.32)]"
          : ""
        : active
          ? "border-emerald-300/75 shadow-[0_0_0_1px_rgba(110,231,183,0.24),0_0_26px_rgba(16,185,129,0.24)]"
          : "border-white/10",
      className,
    ].join(" ")}>
      {tableSeat ? (
        <>
          <BetMarker
            amount={bet}
            name={name}
            className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[78%] scale-90"
          />
          {dealer ? (
            <span className="absolute -right-2 -top-2 z-20 grid h-5 w-5 place-items-center rounded-full bg-amber-200 text-[10px] font-black text-slate-950 shadow-[0_8px_18px_rgba(0,0,0,0.32)]">
              D
            </span>
          ) : null}
        </>
      ) : null}
      <div className={tableSeat ? "flex items-center justify-between gap-2" : "flex items-center justify-between gap-3"}>
        <div className="min-w-0 flex-1">
          {showMeta ? (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-text-muted">
              {active ? (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/12 px-1.5 py-0.5 text-[9px] font-bold text-emerald-100">
                  To Act
                </span>
              ) : label ? <span>{label}</span> : null}
              {dealer ? (
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                  D
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" /> : null}
            <div className={["font-semibold text-text-primary truncate", tableSeat ? "text-[11px]" : "text-sm"].join(" ")}>
              {name || "Waiting"}
            </div>
            {dealer && !tableSeat ? (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-200 text-[9px] font-black text-slate-950">
                D
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={["inline-flex items-center gap-1 text-amber-100", tableSeat ? "text-[10px]" : ""].join(" ")}>
              <LuBadgeDollarSign size={tableSeat ? 10 : 12} />
              {chips}
            </span>
            {folded ? <span className="text-text-muted">Folded</span> : null}
            {allIn ? <span className="text-rose-200">All-in</span> : null}
            {best ? <span className="text-emerald-200">{best}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {(cards || []).map((card, idx) => (
            <PokerCard
              key={`${handNumber}-${seat || name || "seat"}-${idx}-${card}`}
              card={card}
              small={!tableSeat}
              mini={tableSeat}
              animate={Boolean(card)}
              dealVariant="hole"
              delay={idx * 110 + (tableSeat ? 120 : 40)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PokerTable({ game, wsStatus, onAction, onNextHand, onPlayAgain }) {
  const navigate = useNavigate();
  const [raiseTo, setRaiseTo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [clientNow, setClientNow] = useState(Date.now());
  const mySeat = game?.my_seat;
  const tablePlayers = useMemo(() => {
    if (game?.players?.length) {
      return game.players.map((seat) => ({
        seat: seat.seat,
        name: seat.name || "Player",
        chips: seat.chips,
        bet: seat.bet,
        cards: seat.cards || [],
        best: seat.best,
        folded: seat.folded,
        allIn: seat.all_in,
      }));
    }
    return [
      {
        seat: 1,
        name: game?.player_one_name || "Player 1",
        chips: game?.player_one_chips,
        bet: game?.player_one_bet,
        cards: game?.player_one_cards || [],
        best: game?.player_one_best,
      },
      {
        seat: 2,
        name: game?.player_two_name || "Player 2",
        chips: game?.player_two_chips,
        bet: game?.player_two_bet,
        cards: game?.player_two_cards || [],
        best: game?.player_two_best,
      },
    ];
  }, [game]);
  const me = tablePlayers.find((player) => Number(player.seat) === Number(mySeat)) || tablePlayers[0];
  const opponents = tablePlayers.filter((player) => Number(player.seat) !== Number(mySeat));
  const isMyTurn = game?.current_turn === mySeat && !game?.is_completed;
  const currentPlayer = tablePlayers.find((player) => Number(player.seat) === Number(game?.current_turn));
  const winnerPlayer = tablePlayers.find((player) => Number(player.seat) === Number(game?.winner));
  const statusText = game?.is_completed
    ? game.winner === 0 ? "Split pot" : `${winnerPlayer?.name || "Player"} wins with ${game.winning_label}`
    : isMyTurn ? "Your action" : `${currentPlayer?.name || "Player"}'s action`;
  const can = (action) => game?.legal_actions?.includes(action);
  const minRaiseTo = game?.min_raise_to;
  const maxRaiseTo = game?.max_raise_to;
  const serverOffset = useMemo(() => {
    if (!game?.server_now) return 0;
    const parsed = Date.parse(game.server_now);
    return Number.isFinite(parsed) ? parsed - Date.now() : 0;
  }, [game?.server_now]);
  const timerRemaining = useMemo(() => {
    if (!game?.turn_deadline_at || game?.is_completed) return null;
    const deadline = Date.parse(game.turn_deadline_at);
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, Math.ceil((deadline - (clientNow + serverOffset)) / 1000));
  }, [clientNow, game?.is_completed, game?.turn_deadline_at, serverOffset]);
  const timerPercent = timerRemaining == null
    ? 0
    : Math.max(0, Math.min(100, (timerRemaining / Math.max(1, game?.turn_timer_seconds || 1)) * 100));
  const timerUrgent = timerRemaining != null && timerRemaining <= 8;
  const raisePresets = useMemo(() => {
    if (!minRaiseTo || !maxRaiseTo) return [];
    const halfPot = Math.ceil(((game?.pot || 0) / 2 + (game?.current_bet || 0)) / 10) * 10;
    const pot = Math.ceil(((game?.pot || 0) + (game?.current_bet || 0)) / 10) * 10;
    return Array.from(new Set([minRaiseTo, halfPot, pot, maxRaiseTo]))
      .filter((amount) => amount >= minRaiseTo && amount <= maxRaiseTo)
      .slice(0, 4);
  }, [game?.current_bet, game?.pot, maxRaiseTo, minRaiseTo]);

  useEffect(() => {
    if (minRaiseTo) setRaiseTo(minRaiseTo);
  }, [minRaiseTo, game?.hand_number, game?.phase, game?.current_bet]);

  useEffect(() => {
    const interval = window.setInterval(() => setClientNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const handleCopyTableLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      showToast("success", "Table link copied.");
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      showToast("error", "Could not copy table link.");
    }
  };

  return (
    <div className="w-full max-w-6xl min-h-0 flex flex-col gap-2 sm:gap-4 lg:min-h-[720px]">
      <div className="hidden flex-col gap-3 px-1 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/75">No-limit Texas Hold'em</div>
          <h1 className="text-2xl font-semibold text-text-primary">Poker Table</h1>
          <div className="mt-1 text-[11px] text-text-secondary">
            Hand {game?.hand_number || 1} • Dealer: {tablePlayers.find((p) => Number(p.seat) === Number(game?.dealer))?.name || "Seat"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopyTableLink} title="Copy table link">
            <LuCopy size={15} />
            {copied ? "Copied" : "Table Link"}
          </Button>
          {wsStatus ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
              WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 pt-5 lg:hidden">
        {opponents.map((opponent) => (
          <PlayerPanel
            key={opponent.seat}
            label=""
            active={Number(game?.current_turn) === Number(opponent.seat) && !game?.is_completed}
            dealer={Number(game?.dealer) === Number(opponent.seat)}
            tableSeat
            showMeta={false}
            className="min-w-[154px] max-w-[154px]"
            handNumber={game?.hand_number || 1}
            {...opponent}
          />
        ))}
      </div>

      <div className="relative min-h-[300px] rounded-[22px] border border-emerald-200/15 bg-[#07110f] shadow-[0_28px_90px_rgba(0,0,0,0.5)] overflow-hidden sm:min-h-[360px] sm:rounded-[32px] lg:min-h-[560px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(22,101,52,0.96),rgba(6,78,59,0.76)_48%,rgba(2,6,23,0.98)_82%)]" />
        <div className="absolute inset-x-2 inset-y-4 rounded-[34px] border-[6px] border-[#24170f] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2),inset_0_20px_58px_rgba(0,0,0,0.48)] sm:inset-x-3 sm:inset-y-7 sm:rounded-[54px] sm:border-[10px] lg:inset-x-8 lg:inset-y-10 lg:rounded-[118px]" />

        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
          {opponents.slice(0, 8).map((opponent, idx) => {
            const seatPosition = SEAT_POSITIONS[idx] || SEAT_POSITIONS[0];
            return (
              <React.Fragment key={opponent.seat}>
                <PlayerPanel
                  label="Player"
                  active={Number(game?.current_turn) === Number(opponent.seat) && !game?.is_completed}
                  dealer={Number(game?.dealer) === Number(opponent.seat)}
                  tableSeat
                  showMeta={false}
                  className={[
                    "pointer-events-auto absolute !w-[142px]",
                    seatPosition,
                  ].join(" ")}
                  handNumber={game?.hand_number || 1}
                  {...opponent}
                />
              </React.Fragment>
            );
          })}
          <PlayerPanel
            label="You"
            active={isMyTurn}
            dealer={Number(game?.dealer) === Number(mySeat)}
            tableSeat
            showMeta={false}
            className="pointer-events-auto absolute bottom-4 left-1/2 !w-[150px] -translate-x-1/2"
            handNumber={game?.hand_number || 1}
            {...me}
          />
        </div>

        <div className="relative z-10 h-full min-h-[300px] flex flex-col items-center justify-center gap-2 px-2 pb-5 pt-24 sm:min-h-[360px] sm:gap-4 sm:px-4 sm:pb-10 sm:pt-28 lg:min-h-[560px] lg:px-28 lg:pb-28 lg:pt-28">
          <div className="absolute left-1/2 top-4 z-30 flex w-[min(94%,620px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 px-1.5 py-1 text-[10px] font-semibold text-text-muted sm:top-6 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[11px] lg:top-[22%]">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/35 px-2 py-0.5 text-emerald-100/80">
              <LuCircleDollarSign size={12} />
              Pot {game?.pot || 0}
            </span>
            <span className="rounded-full bg-emerald-950/20 px-2 py-0.5 capitalize text-text-secondary">{game?.phase || "preflop"}</span>
            <span className="rounded-full bg-emerald-950/25 px-2 py-0.5 text-emerald-100/75">{game?.small_blind}/{game?.big_blind}</span>
            <span className={["rounded-full px-2 py-0.5", timerUrgent ? "bg-rose-950/35 text-rose-100/85" : "bg-emerald-950/25 text-emerald-100/75"].join(" ")}>
              {timerRemaining == null ? "--" : `${timerRemaining}s`}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[72px] px-2 py-2 sm:gap-2 sm:min-h-[96px] sm:px-4 sm:py-3 lg:min-h-[112px] lg:pt-16">
            {Array.from({ length: 5 }).map((_, idx) => (
              <PokerCard
                key={`${game?.hand_number || 1}-${idx}-${game?.community_cards?.[idx] || "empty"}`}
                card={game?.community_cards?.[idx]}
                animate={Boolean(game?.community_cards?.[idx])}
                dealVariant="community"
                delay={idx * 90}
              />
            ))}
          </div>
          <div className="min-h-[40px] max-w-2xl text-center sm:min-h-[48px]">
            <div className="text-sm font-semibold text-text-primary sm:text-base">{statusText}</div>
            <div className="mt-1 text-[10px] text-text-secondary uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.22em]">
              {game?.last_action || "Waiting for action"}
            </div>
            {timerRemaining != null ? (
              <div className="mt-2 h-1.5 w-52 max-w-[72vw] overflow-hidden rounded-full bg-white/10 sm:mt-3 sm:w-64">
                <div
                  className={[
                    "h-full rounded-full transition-[width,background-color] duration-200",
                    timerUrgent ? "bg-rose-300" : "bg-emerald-300",
                  ].join(" ")}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-5 lg:hidden">
        <PlayerPanel
          label=""
          active={isMyTurn}
          dealer={Number(game?.dealer) === Number(mySeat)}
          tableSeat
          showMeta={false}
          className="!w-[164px]"
          handNumber={game?.hand_number || 1}
          {...me}
        />
      </div>

      <div className="min-h-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-2 sm:min-h-[150px] sm:gap-3 sm:px-3 sm:py-4">
        {game?.is_completed ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onNextHand ? (
              <Button type="button" variant="primary" size="sm" onClick={onNextHand} title="Next hand">
                Next Hand
              </Button>
            ) : null}
            {onPlayAgain ? (
              <Button type="button" variant="secondary" size="sm" onClick={onPlayAgain} title="New table">
                <LuRefreshCw size={16} />
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/")} title="Home">
              <CiHome size={16} />
            </Button>
          </div>
        ) : (
          <>
            <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="px-2 sm:px-4"
                disabled={!can("check")}
                onClick={() => onAction("check")}
              >
                Check
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="px-2 sm:px-4"
                disabled={!can("call")}
                onClick={() => onAction("call")}
              >
                Call {game?.call_amount || ""}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="px-2 bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.25)] hover:bg-amber-200 sm:px-4"
                disabled={!can("raise")}
                onClick={() => onAction("raise", raiseTo)}
              >
                Raise {raiseTo || ""}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="px-2 sm:px-4"
                disabled={!can("all_in")}
                onClick={() => onAction("all_in")}
              >
                All In
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-2 sm:px-4"
                disabled={!can("fold")}
                onClick={() => onAction("fold")}
              >
                Fold
              </Button>
            </div>

            <div className={[
              "w-full max-w-xl rounded-lg border border-amber-300/15 bg-slate-950/70 px-2 py-2 sm:px-3 sm:py-3",
              can("raise") ? "opacity-100" : "opacity-45",
            ].join(" ")}>
              <div className="flex items-center justify-between gap-3 text-[11px] text-text-secondary">
                <span>Raise To</span>
                <span>{raiseTo || "-"}</span>
              </div>
              <input
                type="range"
                min={minRaiseTo || 0}
                max={maxRaiseTo || minRaiseTo || 0}
                step="10"
                value={raiseTo || minRaiseTo || 0}
                disabled={!can("raise")}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                className="mt-2 w-full accent-amber-300"
              />
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                {raisePresets.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={!can("raise")}
                    onClick={() => setRaiseTo(amount)}
                    className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-100 disabled:opacity-40"
                  >
                    {amount === maxRaiseTo ? "Max" : amount}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
