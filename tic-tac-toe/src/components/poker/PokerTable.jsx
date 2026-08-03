import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LuBadgeDollarSign, LuCopy, LuRefreshCw, LuUsers, LuX } from "react-icons/lu";
import { CiHome } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

import Button from "../ui/Button";
import PokerCard from "./PokerCard";
import { showToast } from "../../utils/toast/Toast";
import Tooltip from "../ui/Tooltip";
import { ensureFreshAccessToken } from "../../auth/ensureFreshAccessToken";
import { getChatWSUrl } from "../../websocket/getWebsocketURL";

const TABLE_CONTAINER_HALF_WIDTH_PCT = 50;
const TABLE_CONTAINER_HALF_HEIGHT_PCT = 50;
const TABLE_FELT_INSET_X_PCT = 15;
const TABLE_FELT_INSET_Y_PCT = 20;
const TABLE_FELT_HALF_WIDTH_PCT = TABLE_CONTAINER_HALF_WIDTH_PCT - TABLE_FELT_INSET_X_PCT;
const TABLE_FELT_HALF_HEIGHT_PCT = TABLE_CONTAINER_HALF_HEIGHT_PCT - TABLE_FELT_INSET_Y_PCT;

const STADIUM_FELT_STRAIGHT_HALF_PCT = TABLE_FELT_HALF_WIDTH_PCT - TABLE_FELT_HALF_HEIGHT_PCT;
const CARD_RING_RADIUS_PCT = TABLE_FELT_HALF_HEIGHT_PCT - 6;
const CHIP_RING_RADIUS_PCT = TABLE_FELT_HALF_HEIGHT_PCT + 9;
const CARD_RING_STRAIGHT_HALF_PCT = STADIUM_FELT_STRAIGHT_HALF_PCT;
const CHIP_RING_STRAIGHT_HALF_PCT = STADIUM_FELT_STRAIGHT_HALF_PCT;
const CHIP_RING_OFFSET_FROM_FELT_PCT = CHIP_RING_RADIUS_PCT - TABLE_FELT_HALF_HEIGHT_PCT;
const CHIP_RING_CAP_MAX_HORIZONTAL_OFFSET_PCT = 5.8;
const STADIUM_HERO_FRACTION = stadiumHeroFraction(
  STADIUM_FELT_STRAIGHT_HALF_PCT,
  TABLE_FELT_HALF_HEIGHT_PCT
);
const CARD_RING_HERO_FRACTION = stadiumHeroFraction(
  CARD_RING_STRAIGHT_HALF_PCT,
  CARD_RING_RADIUS_PCT
);
const BET_MARKER_OFFSET_X_PX = 52;
const BET_MARKER_OFFSET_Y_PX = 44;
const DEALER_MIN_OPPONENTS = 4;

function stadiumPerimeter(straightHalfPct, radiusPct) {
  return 4 * straightHalfPct + 2 * Math.PI * radiusPct;
}

function stadiumPointAtFraction(fraction, straightHalfPct, radiusPct) {
  const topLength = 2 * straightHalfPct;
  const capLength = Math.PI * radiusPct;
  const perimeter = stadiumPerimeter(straightHalfPct, radiusPct);
  let distance = (((fraction % 1) + 1) % 1) * perimeter;

  if (distance <= topLength) {
    return {
      xPct: -straightHalfPct + distance,
      yPct: -radiusPct,
      inwardX: 0,
      inwardY: 1,
    };
  }

  distance -= topLength;
  if (distance <= capLength) {
    const angle = -Math.PI / 2 + distance / radiusPct;
    return {
      xPct: straightHalfPct + radiusPct * Math.cos(angle),
      yPct: radiusPct * Math.sin(angle),
      inwardX: -Math.cos(angle),
      inwardY: -Math.sin(angle),
    };
  }

  distance -= capLength;
  if (distance <= topLength) {
    return {
      xPct: straightHalfPct - distance,
      yPct: radiusPct,
      inwardX: 0,
      inwardY: -1,
    };
  }

  distance -= topLength;
  const angle = Math.PI / 2 + distance / radiusPct;
  return {
    xPct: -straightHalfPct + radiusPct * Math.cos(angle),
    yPct: radiusPct * Math.sin(angle),
    inwardX: -Math.cos(angle),
    inwardY: -Math.sin(angle),
  };
}

function stadiumHeroFraction(straightHalfPct, radiusPct) {
  const topLength = 2 * straightHalfPct;
  const capLength = Math.PI * radiusPct;
  return (topLength + capLength + straightHalfPct) / stadiumPerimeter(straightHalfPct, radiusPct);
}

function opponentSeatFraction(index, opponentCount) {
  const safeCount = Math.max(1, Math.min(8, Number(opponentCount) || 1));
  const totalSeats = safeCount + 1;
  return (STADIUM_HERO_FRACTION + (index + 1) / totalSeats) % 1;
}

function stadiumPositionStyle(point) {
  return {
    left: `${50 + point.xPct}%`,
    top: `${50 + point.yPct}%`,
  };
}

function stadiumPointAtPerpendicularOffset(fraction, straightHalfPct, radiusPct, offsetPct, maxHorizontalOffsetPct = null) {
  const point = stadiumPointAtFraction(fraction, straightHalfPct, radiusPct);
  const outwardX = -point.inwardX * offsetPct;
  const outwardY = -point.inwardY * offsetPct;
  const cappedOutwardX = maxHorizontalOffsetPct == null
    ? outwardX
    : Math.sign(outwardX) * Math.min(Math.abs(outwardX), maxHorizontalOffsetPct);
  return {
    ...point,
    xPct: point.xPct + cappedOutwardX,
    yPct: point.yPct + outwardY,
  };
}

function desktopSeatPosition(index, count) {
  return stadiumPositionStyle(
    stadiumPointAtPerpendicularOffset(
      opponentSeatFraction(index, count),
      CHIP_RING_STRAIGHT_HALF_PCT,
      TABLE_FELT_HALF_HEIGHT_PCT,
      CHIP_RING_OFFSET_FROM_FELT_PCT,
      CHIP_RING_CAP_MAX_HORIZONTAL_OFFSET_PCT
    )
  );
}

function desktopFeltCardPoint(index, count) {
  return stadiumPointAtFraction(
    opponentSeatFraction(index, count),
    CARD_RING_STRAIGHT_HALF_PCT,
    CARD_RING_RADIUS_PCT
  );
}

function desktopHeroFeltCardPoint() {
  return stadiumPointAtFraction(
    CARD_RING_HERO_FRACTION,
    CARD_RING_STRAIGHT_HALF_PCT,
    CARD_RING_RADIUS_PCT
  );
}

function betMarkerStyleForStadiumPoint(point) {
  return {
    transform: `translate(calc(-50% + ${point.inwardX * BET_MARKER_OFFSET_X_PX}px), calc(-50% + ${point.inwardY * BET_MARKER_OFFSET_Y_PX}px))`,
  };
}

function roleChipClassForStadiumPoint(point) {
  return point?.xPct > 0 ? "-right-3 -bottom-2" : "-left-3 -bottom-2";
}

function hasFaceUpCards(cards = []) {
  return cards.some((card) => card && card !== "??");
}

function isEliminatedPlayer(player) {
  return Boolean(
    player &&
      Number(player.chips || 0) <= 0 &&
      Number(player.bet || 0) <= 0 &&
      !player.allIn &&
      !(player.cards || []).length
  );
}

function BetMarker({ amount, name, className = "", style = undefined }) {
  if (!amount) return null;
  return (
    <Tooltip content={`${name || "Player"} bet ${amount}`}>
      <div
        className={[
          "inline-flex flex-col items-center gap-0.5 text-[10px] font-black text-cyan-50 shadow-[0_10px_24px_rgba(0,0,0,0.34)]",
          className,
        ].join(" ")}
        style={style}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full border border-cyan-100/55 bg-[repeating-conic-gradient(from_8deg,#67e8f9_0deg_14deg,#0e7490_14deg_28deg)] p-[2px] shadow-[inset_0_0_0_1px_rgba(8,47,73,0.42),inset_0_4px_10px_rgba(255,255,255,0.2)]">
          <span className="grid h-full w-full place-items-center rounded-full border border-cyan-950/45 bg-[radial-gradient(circle_at_35%_30%,#ecfeff_0_11%,#67e8f9_12%_45%,#0891b2_46%_100%)] text-[7px] font-black leading-none text-slate-950">
            {amount}
          </span>
        </span>
      </div>
    </Tooltip>
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

function actionLabelClass(label, active = false) {
  const normalized = String(label || "").toLowerCase();
  if (active || normalized === "action" || normalized === "to act") {
    return "bg-emerald-300 text-slate-950";
  }
  if (normalized.startsWith("bet") || normalized.startsWith("raise")) {
    return "bg-amber-300/18 text-amber-100";
  }
  if (normalized.startsWith("call") || normalized === "check") {
    return "bg-cyan-300/16 text-cyan-100";
  }
  if (normalized.includes("all in") || normalized.includes("all-in")) {
    return "bg-rose-400/20 text-rose-100";
  }
  if (normalized.startsWith("fold")) {
    return "bg-slate-950/60 text-slate-300";
  }
  return "bg-black/28 text-emerald-50/62";
}

const PLAYER_AVATAR_PALETTE = [
  { visor: "#0e7490", band: "#67e8f9", vest: "#083344", trim: "#22d3ee" },
  { visor: "#065f46", band: "#34d399", vest: "#052e2b", trim: "#6ee7b7" },
  { visor: "#7f1d1d", band: "#fb7185", vest: "#3f1518", trim: "#fda4af" },
  { visor: "#312e81", band: "#a78bfa", vest: "#1e1b4b", trim: "#c4b5fd" },
  { visor: "#78350f", band: "#fbbf24", vest: "#451a03", trim: "#fde68a" },
  { visor: "#334155", band: "#94a3b8", vest: "#111827", trim: "#cbd5e1" },
  { visor: "#14532d", band: "#84cc16", vest: "#0f2419", trim: "#bef264" },
  { visor: "#581c87", band: "#e879f9", vest: "#2e1065", trim: "#f0abfc" },
];

const HERO_AVATAR_COLORS = {
  visor: "#92400e",
  band: "#fbbf24",
  vest: "#1f2937",
  trim: "#fde68a",
};

const PLAYER_AVATAR_FACE = {
  eyeY: 26.2,
  eyeHighlightY: 25.8,
  brimTopY: 18.6,
  brimBottomY: 21.6,
  brimTrimY: 21.2,
};

function avatarColorsForSeat(seat, isMe = false) {
  if (isMe) return HERO_AVATAR_COLORS;
  const seatNumber = Math.max(1, Number(seat) || 1);
  return PLAYER_AVATAR_PALETTE[(seatNumber - 1) % PLAYER_AVATAR_PALETTE.length];
}

function PlayerAvatarFace({ seat, isMe = false }) {
  const colors = avatarColorsForSeat(seat, isMe);
  return (
    <svg
      viewBox="0 0 52 52"
      aria-hidden="true"
      className="h-[46px] w-[46px] shrink-0 drop-shadow-[0_7px_12px_rgba(0,0,0,0.28)]"
    >
      <circle cx="26" cy="26" r="23" fill="rgba(2,6,23,0.78)" stroke={colors.trim} strokeWidth="1.6" />
      <path d="M12 46C13 36 18 31 26 31C34 31 39 36 40 46Z" fill={colors.vest} />
      <path d="M18 33L26 43L34 33C32 31.8 29.4 31.2 26 31.2C22.6 31.2 20 31.8 18 33Z" fill="#f8fafc" />
      <path d="M20 34L26 39L22 42Z" fill="#e2e8f0" />
      <path d="M32 34L26 39L30 42Z" fill="#e2e8f0" />
      <path d="M13 46C14.5 38 18.2 33.5 23 32L26 46Z" fill={colors.vest} />
      <path d="M39 46C37.5 38 33.8 33.5 29 32L26 46Z" fill={colors.vest} />
      <circle cx="26" cy="22.5" r="13.5" fill="#d6a57a" />
      <path d="M13.5 20C15 12.2 19.5 8.5 26 8.5C32.8 8.5 37.5 12.4 38.8 20C32.5 17.4 20.6 17.4 13.5 20Z" fill={colors.visor} />
      <path d={`M13.2 ${PLAYER_AVATAR_FACE.brimTopY}H38.8V${PLAYER_AVATAR_FACE.brimBottomY}C33.4 23.2 19 23.2 13.2 ${PLAYER_AVATAR_FACE.brimBottomY}Z`} fill={colors.visor} />
      <path d="M15.2 17.5C18.3 12.9 21.7 11.2 26 11.2C30.8 11.2 34.6 13.2 37 17.5Z" fill={colors.band} />
      <path d={`M15 ${PLAYER_AVATAR_FACE.brimTrimY}C20.6 22.7 31.3 22.8 37.2 ${PLAYER_AVATAR_FACE.brimTrimY}`} fill="none" stroke={colors.trim} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M19.2 24.1C21 23 22.7 22.9 24.4 23.8" fill="none" stroke="#7c2d12" strokeWidth="1" strokeLinecap="round" />
      <path d="M27.6 23.8C29.3 22.9 31 23 32.8 24.1" fill="none" stroke="#7c2d12" strokeWidth="1" strokeLinecap="round" />
      <path d="M25.4 25.6C24.6 27.3 24.8 28.7 26.3 29.3" fill="none" stroke="#9a5732" strokeWidth="1" strokeLinecap="round" />
      <path d="M22 32C24.2 33.6 27.7 33.6 30 32" fill="none" stroke="#7f3f1d" strokeWidth="1.4" strokeLinecap="round" />
      <g>
        <path d={`M20 ${PLAYER_AVATAR_FACE.eyeY}C21.4 25.4 22.8 25.4 24 ${PLAYER_AVATAR_FACE.eyeY}C22.8 27 21.4 27 20 ${PLAYER_AVATAR_FACE.eyeY}Z`} fill="#0f172a" />
        <path d={`M28 ${PLAYER_AVATAR_FACE.eyeY}C29.2 25.4 30.6 25.4 32 ${PLAYER_AVATAR_FACE.eyeY}C30.6 27 29.2 27 28 ${PLAYER_AVATAR_FACE.eyeY}Z`} fill="#0f172a" />
        <circle cx="23" cy={PLAYER_AVATAR_FACE.eyeHighlightY} r="0.55" fill="#f8fafc" />
        <circle cx="31" cy={PLAYER_AVATAR_FACE.eyeHighlightY} r="0.55" fill="#f8fafc" />
      </g>
    </svg>
  );
}

function CasinoSeatPod({
  player,
  active,
  dealer,
  isMe = false,
  className = "",
  handNumber = 1,
  showCards = true,
  moveLabel = "",
  timerRemaining = null,
  timerPercent = 0,
  timerUrgent = false,
  style = undefined,
}) {
  const showTimer = active && timerRemaining != null;
  const statusText = moveLabel || (active ? "To act" : player.folded ? "Fold" : player.allIn ? "All in" : player.best || "Waiting");

  return (
    <div
      className={[
        "pointer-events-auto absolute flex w-[142px] -translate-x-1/2 flex-col items-center",
        className,
      ].join(" ")}
      style={style}
    >
      <div
        className={[
          "relative flex h-[58px] w-full items-center gap-1.5 rounded-sm border px-1.5 py-1 text-left shadow-[0_10px_22px_rgba(0,0,0,0.32)]",
          active
            ? "border-emerald-200/45 bg-[linear-gradient(180deg,rgba(16,185,129,0.26),rgba(6,78,59,0.96))] shadow-[0_0_24px_rgba(16,185,129,0.22),0_10px_22px_rgba(0,0,0,0.32)]"
            : "border-emerald-200/[0.12] bg-[linear-gradient(180deg,rgba(8,47,37,0.94),rgba(12,28,24,0.98))]",
          player.folded ? "opacity-55" : "",
        ].join(" ")}
      >
        <PlayerAvatarFace seat={player.seat} isMe={isMe} />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.06em] text-emerald-50/90">
            {isMe ? "You" : player.name || "Player"}
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold text-amber-100">
            <LuBadgeDollarSign size={9} className="shrink-0 text-amber-200/80" />
            <span className="truncate">{player.chips}</span>
          </div>
          {showCards ? (
            <div className="mt-0.5 flex justify-start gap-0.5">
              {(player.cards || []).map((card, idx) => (
                <PokerCard
                  key={`${handNumber}-${player.seat || player.name || "casino"}-${idx}-${card}`}
                  card={card}
                  mini
                  animate={Boolean(card)}
                  dealVariant="hole"
                  delay={idx * 90 + 80}
                />
              ))}
            </div>
          ) : null}
          <div className={["mt-0.5 h-3.5 truncate rounded-sm px-1 py-0.5 text-[7px] font-black uppercase leading-none tracking-[0.08em]", actionLabelClass(statusText, active)].join(" ")}>
            {statusText}
          </div>
          {showTimer ? (
            <div className="mt-0.5 overflow-hidden rounded-full bg-black/35">
              <div
                className={[timerUrgent ? "bg-rose-300" : "bg-emerald-200", "h-1 rounded-full transition-[width] duration-200"].join(" ")}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CasinoDealer({ activeOpponentCount = 0 }) {
  if (activeOpponentCount < DEALER_MIN_OPPONENTS) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-6 z-10 hidden h-[92px] w-[104px] -translate-x-1/2 lg:block xl:top-8 xl:h-[104px] xl:w-[118px]">
      <svg
        viewBox="0 0 140 132"
        role="img"
        aria-label="Casino dealer"
        className="h-full w-full drop-shadow-[0_12px_22px_rgba(0,0,0,0.36)]"
      >
        <ellipse cx="70" cy="123" rx="47" ry="7" fill="rgba(0,0,0,0.28)" />
        <motion.g
          animate={{ y: [0, 2, 0] }}
          transition={{ duration: 4.8, ease: "easeInOut", repeat: Infinity }}
          style={{ transformOrigin: "70px 82px" }}
        >
          <g className="dealerTorso">
            <path
              d="M34 122C36 94 49 80 70 80C91 80 104 94 106 122Z"
              fill="#0f211b"
              stroke="rgba(16,185,129,0.28)"
              strokeWidth="2"
            />
            <path d="M52 84L70 116L88 84C83 81 77 80 70 80C63 80 57 81 52 84Z" fill="#f8fafc" />
            <path d="M55 86L70 98L62 104Z" fill="#e2e8f0" />
            <path d="M85 86L70 98L78 104Z" fill="#e2e8f0" />
            <path d="M58 86L69 121H37C40 103 47 92 58 86Z" fill="#13251f" />
            <path d="M82 86L71 121H103C100 103 93 92 82 86Z" fill="#13251f" />
            <path d="M62 99L70 94L78 99L70 105Z" fill="#020617" />
            <circle cx="70" cy="109" r="1.7" fill="#fbbf24" />
            <circle cx="70" cy="116" r="1.7" fill="#fbbf24" />
          </g>
          <g className="dealerHead">
            <circle cx="70" cy="49" r="27" fill="#d6a57a" />
            <path d="M47 45C50 28 59 20 70 20C82 20 92 29 94 45C83 40 60 40 47 45Z" fill="#111827" />
            <path d="M46 43H94V52C84 55 56 55 46 52Z" fill="#0f172a" />
            <path d="M49 41C54 30 61 25 70 25C80 25 88 31 92 41Z" fill="#164e3d" />
            <motion.g
              animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
              transition={{ duration: 6.8, ease: "easeInOut", times: [0, 0.91, 0.925, 0.94, 1], repeat: Infinity }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <rect x="59" y="55" width="5.8" height="2.8" rx="1.4" fill="#0f172a" />
              <rect x="75.2" y="55" width="5.8" height="2.8" rx="1.4" fill="#0f172a" />
            </motion.g>
            <path d="M64 65C68 68 73 68 77 65" fill="none" stroke="#7f3f1d" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g className="dealerArmResting">
            <path
              d="M39 94C29 98 24 106 24 118"
              fill="none"
              stroke="#d6a57a"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="24" cy="118" r="5.5" fill="#d6a57a" />
          </g>
          <g className="dealerArmCards">
            <path
              d="M98 93C108 94 115 101 119 111"
              fill="none"
              stroke="#d6a57a"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="119" cy="111" r="5.5" fill="#d6a57a" />
          </g>
          <motion.g
            animate={{ rotate: [0, -1.4, 0] }}
            transition={{ duration: 5.4, ease: "easeInOut", repeat: Infinity }}
            style={{ transformOrigin: "103px 79px" }}
          >
            <rect x="91" y="76" width="17" height="24" rx="2" fill="#f8fafc" stroke="#67e8f9" strokeWidth="1.4" transform="rotate(-16 99.5 88)" />
            <rect x="101" y="73" width="17" height="24" rx="2" fill="#f8fafc" stroke="#fbbf24" strokeWidth="1.4" transform="rotate(3 109.5 85)" />
            <rect x="111" y="78" width="17" height="24" rx="2" fill="#f8fafc" stroke="#10b981" strokeWidth="1.4" transform="rotate(18 119.5 90)" />
            <circle cx="109" cy="85" r="1.7" fill="#0891b2" />
            <path d="M120 88L123 92L117 92Z" fill="#059669" />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}

function SeatRoleChip({ label, className = "" }) {
  if (!label) return null;
  const styles = {
    D: "bg-white text-slate-950",
    SB: "bg-sky-300 text-slate-950",
    BB: "bg-amber-300 text-slate-950",
  };
  return (
    <span
      className={[
        "absolute z-30 grid h-5 min-w-5 place-items-center rounded-full border border-slate-950/55 px-1 text-[9px] font-black shadow-[0_0_0_2px_rgba(255,255,255,0.18),0_8px_16px_rgba(0,0,0,0.42)]",
        styles[label] || styles.D,
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function FeltHoleCards({
  player,
  className = "",
  handNumber = 1,
  roleLabel = "",
  style = undefined,
  faceDown = false,
  betMarkerStyle = undefined,
  roleChipClassName = "-left-3 -bottom-2",
}) {
  if (!player) return null;
  const cards = player.cards?.length ? player.cards : ["??", "??"];
  const hasRealHiddenCards = Boolean(player.cards?.length);
  const folded = Boolean(player.folded);

  return (
    <div
      className={["pointer-events-none absolute z-20 flex -translate-x-1/2 items-center gap-0.5", className].join(" ")}
      style={style}
    >
      <SeatRoleChip label={roleLabel} className={roleChipClassName} />
      <div className="relative flex items-center gap-0.5">
        <div className={["flex items-center gap-0.5", folded ? "opacity-55 saturate-50" : ""].join(" ")}>
          {cards.map((card, idx) => (
            <PokerCard
              key={`${handNumber}-${player.seat || player.name || "felt"}-${idx}-${card}`}
              card={card}
              mini
              faceDown={faceDown && hasRealHiddenCards && card === "??" && !folded}
              animate={Boolean(card)}
              dealVariant="hole"
              delay={idx * 90 + 80}
            />
          ))}
        </div>
        {folded ? (
          <span className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-sm border border-rose-200/35 bg-rose-950/82 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-rose-100 shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
            Folded
          </span>
        ) : null}
      </div>
      <BetMarker
        amount={player.bet}
        name={player.name}
        className="absolute left-1/2 top-1/2 z-30"
        style={betMarkerStyle}
      />
    </div>
  );
}

function MobileOpponentTile({ player, active, dealer, handNumber, tileRef, pendingLabel = "", faceDown = false }) {
  const statusText = pendingLabel || (active ? "To act" : player.folded ? "Folded" : player.allIn ? "All-in" : "In hand");

  return (
    <div
      ref={tileRef}
      className={[
        "relative flex h-[74px] w-[138px] shrink-0 items-center justify-between gap-2 rounded-lg border px-2 py-2",
        "bg-slate-950/88 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur",
        active
          ? "border-emerald-300/45 shadow-[0_0_22px_rgba(16,185,129,0.2),0_10px_24px_rgba(0,0,0,0.28)]"
          : "border-white/[0.07]",
        player.folded ? "opacity-55" : "",
      ].join(" ")}
    >
      {player.bet ? (
        <BetMarker
          amount={player.bet}
          name={player.name}
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[68%] scale-75"
        />
      ) : null}
      {dealer ? (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-amber-200 text-[10px] font-black text-slate-950">
          D
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" /> : null}
          <div className="truncate text-[12px] font-semibold text-text-primary">
            {player.name || "Player"}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-100">
          <LuBadgeDollarSign size={10} className="text-amber-200/80" />
          <span>{player.chips}</span>
        </div>
        <div className={["mt-0.5 truncate rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.1em]", actionLabelClass(statusText, active)].join(" ")}>
          {statusText}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5">
        {(player.cards || []).map((card, idx) => (
          <PokerCard
            key={`${handNumber}-${player.seat || player.name || "mobile"}-${idx}-${card}`}
            card={card}
            mini
            faceDown={faceDown && card === "??" && !player.folded}
            animate={Boolean(card)}
            dealVariant="hole"
            delay={idx * 90 + 80}
          />
        ))}
      </div>
    </div>
  );
}

function SeatStatusSheet({ open, players, currentTurn, dealerSeat, mySeat, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:hidden">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close seats"
        onClick={onClose}
      />
      <div className="relative w-full rounded-t-2xl border border-emerald-300/15 bg-background-app-panel shadow-[0_-24px_80px_rgba(0,0,0,0.62)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">Table</div>
            <div className="text-sm font-semibold text-text-primary">{players.length}/9 seats</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-surface text-text-secondary"
            aria-label="Close seats"
          >
            <LuX size={17} />
          </button>
        </div>
        <div className="max-h-[62dvh] overflow-y-auto p-3 tron-scrollbar-dark">
          <div className="space-y-2">
            {players.map((player) => {
              const eliminated = Boolean(player.eliminated);
              const active = !eliminated && Number(currentTurn) === Number(player.seat);
              const dealer = !eliminated && Number(dealerSeat) === Number(player.seat);
              const isMe = Number(mySeat) === Number(player.seat);
              return (
                <div
                  key={player.seat}
                  className={[
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                    active
                      ? "border-emerald-300/35 bg-emerald-300/10"
                      : "border-white/[0.07] bg-slate-950/45",
                    player.folded || eliminated ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {active ? <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" /> : null}
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {player.name || "Player"}{isMe ? " (You)" : ""}
                      </span>
                      {dealer ? <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-black text-slate-950">D</span> : null}
                      {eliminated ? <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-black text-slate-200">OUT</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                      <span className="text-amber-100">{player.chips} chips</span>
                      {player.bet ? <span className="text-cyan-100">Bet {player.bet}</span> : null}
                      {player.folded ? <span>Folded</span> : null}
                      {player.allIn ? <span className="text-rose-200">All-in</span> : null}
                      {eliminated ? <span>Out</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {!eliminated && (player.cards || []).map((card, idx) => (
                      <PokerCard
                        key={`${player.seat}-sheet-${idx}-${card}`}
                        card={card}
                        mini
                        faceDown={!isMe && card === "??" && !player.folded}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const MOBILE_SEAT_COORDS_BY_COUNT = {
  1: [{ x: 50, top: 14 }],
  2: [{ x: 25, top: 18 }, { x: 75, top: 18 }],
  3: [{ x: 18, top: 32 }, { x: 50, top: 12 }, { x: 82, top: 32 }],
  4: [{ x: 17, top: 34 }, { x: 35, top: 12 }, { x: 65, top: 12 }, { x: 83, top: 34 }],
  5: [{ x: 15, top: 35 }, { x: 25, top: 17 }, { x: 50, top: 10 }, { x: 75, top: 17 }, { x: 85, top: 35 }],
  6: [{ x: 15, top: 35 }, { x: 24, top: 18 }, { x: 50, top: 10 }, { x: 76, top: 18 }, { x: 85, top: 35 }, { x: 76, bottom: 18 }],
  7: [{ x: 15, top: 35 }, { x: 23, top: 18 }, { x: 40, top: 10 }, { x: 60, top: 10 }, { x: 77, top: 18 }, { x: 85, top: 35 }, { x: 76, bottom: 18 }],
  8: [{ x: 15, top: 35 }, { x: 22, top: 18 }, { x: 38, top: 10 }, { x: 62, top: 10 }, { x: 78, top: 18 }, { x: 85, top: 35 }, { x: 76, bottom: 18 }, { x: 24, bottom: 18 }],
};

function mobileSeatPositionStyle(index, count) {
  const safeCount = Math.max(1, Math.min(8, Number(count) || 1));
  const coords = MOBILE_SEAT_COORDS_BY_COUNT[safeCount] || MOBILE_SEAT_COORDS_BY_COUNT[8];
  const coord = coords[index] || coords[0];
  return {
    left: `${coord.x}%`,
    ...(coord.bottom == null ? { top: `${coord.top}%` } : { bottom: `${coord.bottom}%` }),
  };
}

function MobileTableSeatMarkers({ opponents, currentTurn, dealerSeat, smallBlindSeat, bigBlindSeat }) {
  if (!opponents.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 sm:hidden">
      {opponents.slice(0, 8).map((player, idx) => {
        const active = Number(currentTurn) === Number(player.seat);
        const dealer = Number(dealerSeat) === Number(player.seat);
        const roleLabel = dealer
          ? "D"
          : Number(player.seat) === Number(smallBlindSeat)
            ? "SB"
            : Number(player.seat) === Number(bigBlindSeat)
              ? "BB"
              : "";
        return (
          <div
            key={player.seat}
            className={[
              "absolute w-[74px] -translate-x-1/2 rounded-md border px-1.5 py-1",
              active
                ? "border-emerald-300/45 bg-emerald-950/80 shadow-[0_0_18px_rgba(16,185,129,0.28)]"
                : "border-white/[0.08] bg-slate-950/72",
              player.folded ? "opacity-50" : "",
            ].join(" ")}
            style={mobileSeatPositionStyle(idx, opponents.length)}
          >
            {roleLabel ? (
              <span
                className={[
                  "absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border border-slate-950/55 px-0.5 text-[7px] font-black text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_6px_12px_rgba(0,0,0,0.38)]",
                  roleLabel === "D" ? "bg-white" : roleLabel === "SB" ? "bg-sky-300" : "bg-amber-300",
                ].join(" ")}
              >
                {roleLabel}
              </span>
            ) : null}
            {player.bet ? (
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[82%] rounded bg-cyan-100 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                {player.bet}
              </span>
            ) : null}
            <div className="flex items-center gap-1">
              {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" /> : null}
              <span className="truncate text-[10px] font-semibold text-text-primary">
                {player.name || "Player"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-1">
              <span className="truncate text-[9px] font-semibold text-amber-100">
                {player.chips}
              </span>
              <span className="flex shrink-0 gap-0.5">
                <span className="h-3.5 w-2.5 rounded-[2px] border border-white/20 bg-[linear-gradient(135deg,#ef4444,#7f1d1d)]" />
                <span className="h-3.5 w-2.5 rounded-[2px] border border-white/20 bg-[linear-gradient(135deg,#ef4444,#7f1d1d)]" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeltInfoPanel({ game }) {
  return (
    <div className="z-30 flex items-center justify-center gap-1 px-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-emerald-50 sm:text-xs">
      <span>Pot Total:</span>
      <LuBadgeDollarSign size={12} className="shrink-0 text-amber-200/85" />
      <span>{game?.pot || 0}</span>
    </div>
  );
}

function FeltRoundMeta({ game }) {
  return (
    <div className="z-30 flex items-center justify-center gap-3 whitespace-nowrap text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-emerald-50/68 sm:gap-4">
      <span>Blinds: {game?.small_blind || 0}/{game?.big_blind || 0}</span>
      <span className="h-1 w-1 rounded-full bg-emerald-50/35" />
      <span>{game?.phase || "preflop"}</span>
    </div>
  );
}

function playerMoveLabel(player, active, game) {
  if (!player) return "";
  if (active && !game?.is_completed) return "Action";
  if (player.folded) return "Fold";
  if (player.allIn) return "All in";
  if (player.bet) return `Bet ${player.bet}`;
  return "Waiting";
}

function optimisticActionLabel(action, amount, game) {
  switch (action) {
    case "check":
      return "Check";
    case "call":
      return `Call ${game?.call_amount || ""}`.trim();
    case "raise":
      return `Bet ${amount || ""}`.trim();
    case "all_in":
      return "All in";
    case "fold":
      return "Fold";
    default:
      return "";
  }
}

function nextOccupiedSeat(fromSeat, players) {
  const ordered = [...players].map((player) => Number(player.seat)).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const current = Number(fromSeat);
  return ordered.find((seat) => seat > current) || ordered[0];
}

function getBlindSeats(game, players) {
  const dealer = Number(game?.dealer);
  if (!dealer || !players.length) return { smallBlindSeat: null, bigBlindSeat: null };
  if (players.length === 2) {
    return {
      smallBlindSeat: dealer,
      bigBlindSeat: nextOccupiedSeat(dealer, players),
    };
  }
  const smallBlindSeat = nextOccupiedSeat(dealer, players);
  return {
    smallBlindSeat,
    bigBlindSeat: nextOccupiedSeat(smallBlindSeat, players),
  };
}

function MobileHeroSeatMarker({ player, active, handNumber, roleLabel, timerRemaining, timerPercent, timerUrgent, pendingLabel = "" }) {
  if (!player) return null;
  const showTimer = active && !pendingLabel && timerRemaining != null;
  const statusText = pendingLabel || (active ? "Action" : player.folded ? "Fold" : player.allIn ? "All in" : player.best || "Waiting");

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 flex w-[132px] -translate-x-1/2 flex-col items-center sm:hidden">
      <div className="relative flex justify-center gap-1">
        <SeatRoleChip label={roleLabel} className="-left-6 top-1/2 -translate-y-1/2" />
        {(player.cards || []).map((card, idx) => (
          <PokerCard
            key={`${handNumber}-${player.seat || "me"}-hero-${idx}-${card}`}
            card={card}
            small
            animate={Boolean(card)}
            dealVariant="hole"
            delay={idx * 110 + 40}
          />
        ))}
        {player.folded ? (
          <span className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-sm border border-rose-200/35 bg-rose-950/82 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-rose-100 shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
            Folded
          </span>
        ) : null}
      </div>
      <div
        className={[
          "relative mt-3 w-full rounded-md border px-2 py-1 text-center shadow-[0_10px_22px_rgba(0,0,0,0.32)]",
          active
            ? "border-emerald-300/45 bg-emerald-950/92"
            : "border-white/[0.08] bg-slate-950/90",
        ].join(" ")}
      >
        {player.bet ? (
          <span className="absolute right-2 top-0 -translate-y-[72%] rounded bg-cyan-100 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
            {player.bet}
          </span>
        ) : null}
        <div className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-text-primary">
          You
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1 truncate text-[10px] font-semibold text-amber-100">
          <LuBadgeDollarSign size={10} className="shrink-0 text-amber-200/80" />
          <span className="truncate">{player.chips}</span>
        </div>
        <div className={["mt-1 h-4 truncate rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.1em]", actionLabelClass(statusText, active)].join(" ")}>
          {statusText}
        </div>
        {showTimer ? (
          <div className="mt-1 overflow-hidden rounded-full bg-black/35">
            <div
              className={[timerUrgent ? "bg-rose-300" : "bg-emerald-200", "h-1 rounded-full transition-[width] duration-200"].join(" ")}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function PokerTableChat({ gameId }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const wsRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (!gameId || !isDesktop) return undefined;
    let closed = false;
    let socket = null;

    const connect = async () => {
      const token = await ensureFreshAccessToken({ minTtlSeconds: 60 });
      if (!token || closed) return;
      socket = new WebSocket(getChatWSUrl({ gameType: "poker_table", lobbyId: gameId, token }));
      wsRef.current = socket;
      socket.onopen = () => {
        if (!closed) setConnected(true);
      };
      socket.onclose = () => {
        if (!closed) setConnected(false);
      };
      socket.onerror = () => {
        if (!closed) setConnected(false);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "chat_message" || !data.message?.content) return;
          setMessages((current) => {
            const exists = data.message.id && current.some((message) => message.id === data.message.id);
            return exists ? current : [...current.slice(-29), data.message];
          });
        } catch {
          // Ignore malformed chat messages.
        }
      };
    };

    connect();
    return () => {
      closed = true;
      setConnected(false);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, [gameId, isDesktop]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      showToast("error", "Table chat is still connecting.");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "chat_message", message: text }));
    setDraft("");
  }, [draft]);

  if (!isDesktop) return null;

  return (
    <aside className="hidden min-h-[150px] w-[300px] shrink-0 self-stretch overflow-hidden rounded-lg border border-stone-200/[0.08] bg-[linear-gradient(180deg,rgba(18,15,12,0.84),rgba(8,7,6,0.96))] lg:flex lg:flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50/80">Table Chat</span>
        <span className={["text-[9px] font-bold uppercase tracking-[0.16em]", connected ? "text-emerald-200" : "text-text-faint"].join(" ")}>
          {connected ? "Live" : "Connecting"}
        </span>
      </div>
      <div ref={messagesRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 lol-scrollbar">
        {messages.length ? messages.map((message) => (
          <div key={message.id || `${message.sender}-${message.content}`} className="text-[11px] leading-snug text-text-secondary">
            <span className="font-bold text-emerald-100/85">{message.sender || "Player"}: </span>
            <span>{message.content}</span>
          </div>
        )) : (
          <div className="flex h-full items-center justify-center text-center text-[10px] uppercase tracking-[0.16em] text-text-faint">
            No messages
          </div>
        )}
      </div>
      <div className="flex gap-1.5 border-t border-white/[0.06] p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendMessage();
          }}
          placeholder="Message"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-faint focus:border-emerald-300/45"
        />
        <Button type="button" variant="secondary" size="sm" className="px-3" disabled={!connected || !draft.trim()} onClick={sendMessage}>
          Send
        </Button>
      </div>
    </aside>
  );
}

export default function PokerTable({ game, wsStatus, onAction, onNextHand, onPlayAgain }) {
  const navigate = useNavigate();
  const [raiseTo, setRaiseTo] = useState(0);
  const [raisePanelOpen, setRaisePanelOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientNow, setClientNow] = useState(Date.now());
  const [visibleHoleCards, setVisibleHoleCards] = useState(Number.POSITIVE_INFINITY);
  const [visibleCommunityCards, setVisibleCommunityCards] = useState(Number.POSITIVE_INFINITY);
  const [pendingSeatActions, setPendingSeatActions] = useState({});
  const dealStateRef = useRef({ handNumber: null, communityCount: 0 });
  const opponentRailRef = useRef(null);
  const opponentTileRefs = useRef({});
  const mySeat = game?.my_seat;
  const handNumber = game?.hand_number || 1;
  const communityCount = game?.community_cards?.length || 0;
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
        folded: game?.player_one_folded,
        allIn: game?.player_one_all_in,
      },
      {
        seat: 2,
        name: game?.player_two_name || "Player 2",
        chips: game?.player_two_chips,
        bet: game?.player_two_bet,
        cards: game?.player_two_cards || [],
        best: game?.player_two_best,
        folded: game?.player_two_folded,
        allIn: game?.player_two_all_in,
      },
    ];
  }, [game]);
  const totalHoleCards = useMemo(
    () => tablePlayers.reduce((total, player) => total + (player.cards?.length || 0), 0),
    [tablePlayers]
  );
  const holeRevealBySeat = useMemo(() => {
    const counts = {};
    const ordered = [...tablePlayers].sort((a, b) => Number(a.seat) - Number(b.seat));
    let revealIndex = 0;
    for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
      for (const player of ordered) {
        if ((player.cards || [])[cardIndex]) {
          revealIndex += 1;
          if (Number(player.seat) === Number(mySeat) || visibleHoleCards >= revealIndex) {
            counts[player.seat] = (counts[player.seat] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [mySeat, tablePlayers, visibleHoleCards]);
  const displayedTablePlayers = useMemo(
    () => tablePlayers.map((player) => ({
      ...player,
      eliminated: isEliminatedPlayer(player),
      cards: (player.cards || []).slice(0, holeRevealBySeat[player.seat] || 0),
    })),
    [holeRevealBySeat, tablePlayers]
  );
  const activeTablePlayers = useMemo(
    () => tablePlayers.filter((player) => !isEliminatedPlayer(player)),
    [tablePlayers]
  );
  const activeDisplayedTablePlayers = useMemo(
    () => displayedTablePlayers.filter((player) => !player.eliminated),
    [displayedTablePlayers]
  );
  const displayedCommunityCards = useMemo(
    () => (game?.community_cards || []).slice(0, visibleCommunityCards),
    [game?.community_cards, visibleCommunityCards]
  );
  const me = displayedTablePlayers.find((player) => Number(player.seat) === Number(mySeat)) || displayedTablePlayers[0];
  const rawMe = tablePlayers.find((player) => Number(player.seat) === Number(mySeat)) || tablePlayers[0];
  const heroEliminated = isEliminatedPlayer(rawMe);
  const heroFeltPlayer = heroEliminated
    ? { ...me, cards: [], eliminated: true }
    : hasFaceUpCards(rawMe?.cards)
    ? { ...me, cards: rawMe.cards, folded: rawMe.folded }
    : me;
  const opponents = activeDisplayedTablePlayers.filter((player) => Number(player.seat) !== Number(mySeat));
  const isMyTurn = game?.current_turn === mySeat && !game?.is_completed;
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
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");
  const { smallBlindSeat, bigBlindSeat } = useMemo(
    () => getBlindSeats(game, activeTablePlayers),
    [activeTablePlayers, game]
  );
  const roleForSeat = (seat) => {
    const seatNumber = Number(seat);
    if (seatNumber === Number(game?.dealer)) return "D";
    if (seatNumber === Number(smallBlindSeat)) return "SB";
    if (seatNumber === Number(bigBlindSeat)) return "BB";
    return "";
  };
  const heroCardPoint = useMemo(() => desktopHeroFeltCardPoint(), []);
  const pendingLabelForSeat = (seat) => pendingSeatActions[String(seat)] || "";
  const clearPendingSeatAction = useCallback((seat) => {
    if (seat == null) return;
    setPendingSeatActions((current) => {
      const key = String(seat);
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);
  const handleAction = useCallback((action, amount = null) => {
    const seat = mySeat;
    const label = optimisticActionLabel(action, amount, game);
    if (seat != null && label) {
      setPendingSeatActions((current) => ({
        ...current,
        [String(seat)]: label,
      }));
    }

    try {
      const result = onAction(action, amount);
      if (result && typeof result.catch === "function") {
        result.catch(() => clearPendingSeatAction(seat));
      }
      return result;
    } catch (error) {
      clearPendingSeatAction(seat);
      throw error;
    }
  }, [clearPendingSeatAction, game, mySeat, onAction]);
  const canRaiseOrAllIn = can("raise") || can("all_in");
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
    if (!game?.legal_actions?.includes("raise") && !game?.legal_actions?.includes("all_in")) {
      setRaisePanelOpen(false);
    }
  }, [game?.legal_actions]);

  useEffect(() => {
    setPendingSeatActions({});
  }, [handNumber]);

  useEffect(() => {
    setPendingSeatActions((current) => {
      let changed = false;
      const next = { ...current };
      Object.keys(next).forEach((seat) => {
        if (Number(seat) !== Number(game?.current_turn)) {
          delete next[seat];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [game?.current_turn]);

  useEffect(() => {
    const interval = window.setInterval(() => setClientNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!game?.id) return undefined;
    const previous = dealStateRef.current;

    if (game.is_completed) {
      setVisibleHoleCards(Number.POSITIVE_INFINITY);
      setVisibleCommunityCards(Number.POSITIVE_INFINITY);
      dealStateRef.current = {
        handNumber,
        communityCount: 0,
      };
      return undefined;
    }

    if (previous.handNumber === handNumber) return undefined;

    dealStateRef.current = {
      handNumber,
      communityCount: 0,
    };
    setVisibleCommunityCards(0);

    if (!totalHoleCards) {
      setVisibleHoleCards(0);
      return undefined;
    }

    setVisibleHoleCards(0);
    const timers = Array.from({ length: totalHoleCards }, (_, idx) => (
      window.setTimeout(() => setVisibleHoleCards(idx + 1), 140 + idx * 115)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [game?.id, game?.is_completed, handNumber, totalHoleCards]);

  useEffect(() => {
    if (!game?.id || game.is_completed) return undefined;
    const nextCount = communityCount;
    const previous = dealStateRef.current;

    if (previous.handNumber !== handNumber) return undefined;
    if (nextCount <= previous.communityCount) return undefined;

    const startCount = previous.communityCount;
    dealStateRef.current = { handNumber, communityCount: nextCount };
    setVisibleCommunityCards(startCount);

    const timers = Array.from({ length: nextCount - startCount }, (_, idx) => (
      window.setTimeout(() => setVisibleCommunityCards(startCount + idx + 1), 160 + idx * 150)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [communityCount, game?.id, game?.is_completed, handNumber]);

  useEffect(() => {
    if (!game?.current_turn || Number(game.current_turn) === Number(mySeat)) return;
    const tile = opponentTileRefs.current[String(game.current_turn)];
    if (!tile) return;
    tile.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [game?.current_turn, mySeat]);

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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col gap-2 pb-[calc(env(safe-area-inset-bottom)+150px)] sm:gap-3 sm:pb-0">
      <div className="hidden flex-col gap-3 px-1 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/75">No-limit Texas Hold'em</div>
          <h1 className="text-2xl font-semibold text-text-primary">Poker Table</h1>
          <div className="mt-1 text-[11px] text-text-secondary">
            Hand {game?.hand_number || 1} • Dealer: {tablePlayers.find((p) => Number(p.seat) === Number(game?.dealer))?.name || "Seat"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Copy table link">
            <Button type="button" variant="outline" size="sm" onClick={handleCopyTableLink}>
              <LuCopy size={15} />
              {copied ? "Copied" : "Table Link"}
            </Button>
          </Tooltip>
          {wsStatus ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
              WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 sm:hidden">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Texas Hold'em</div>
          <div className="truncate text-sm font-semibold text-text-primary">Hand {game?.hand_number || 1}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {wsStatus ? (
            <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
              {wsStatus === "connected" ? "Live" : wsStatus}
            </span>
          ) : null}
          <Tooltip content="Seats">
            <button
              type="button"
              onClick={() => setSeatsOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-slate-950/75 text-text-primary"
              aria-label="Show seats"
            >
              <LuUsers size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Copy table link">
            <button
              type="button"
              onClick={handleCopyTableLink}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-slate-950/75 text-text-primary"
              aria-label="Copy table link"
            >
              <LuCopy size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div ref={opponentRailRef} className="hidden gap-2 overflow-x-auto pb-1 pt-4 sm:flex lg:hidden tron-scrollbar-dark">
        {opponents.map((opponent) => (
          <MobileOpponentTile
            key={opponent.seat}
            player={opponent}
            active={Number(game?.current_turn) === Number(opponent.seat) && !game?.is_completed && !pendingLabelForSeat(opponent.seat)}
            dealer={Number(game?.dealer) === Number(opponent.seat)}
            handNumber={game?.hand_number || 1}
            pendingLabel={pendingLabelForSeat(opponent.seat)}
            faceDown
            tileRef={(node) => {
              if (node) opponentTileRefs.current[String(opponent.seat)] = node;
            }}
          />
        ))}
      </div>

      <div className="relative min-h-[min(66dvh,620px)] flex-1 overflow-hidden rounded-full border border-emerald-200/15 bg-[#1b1009] shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:min-h-[min(70dvh,640px)] lg:min-h-[500px] lg:flex-none xl:min-h-[540px] 2xl:min-h-[580px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(120,64,24,0.5),transparent_34%),linear-gradient(90deg,rgba(40,20,10,0.96),rgba(88,45,19,0.88),rgba(28,14,8,0.96))]" />
        <div className="absolute inset-x-2 inset-y-5 rounded-full border-[8px] border-[#8a4b18] bg-[radial-gradient(ellipse_at_50%_48%,rgba(22,101,52,0.98),rgba(5,76,44,0.94)_52%,rgba(3,49,32,0.98)_100%)] shadow-[inset_0_0_0_2px_rgba(250,204,21,0.25),inset_0_0_0_8px_rgba(15,23,42,0.28),inset_0_24px_58px_rgba(0,0,0,0.4),0_18px_38px_rgba(0,0,0,0.5)] sm:inset-x-6 sm:inset-y-10 sm:border-[10px] lg:inset-x-[15%] lg:inset-y-[20%]" />
        {isDesktopLayout ? <CasinoDealer activeOpponentCount={opponents.length} /> : null}

        <MobileTableSeatMarkers
          opponents={opponents}
          currentTurn={game?.current_turn}
          dealerSeat={game?.dealer}
          smallBlindSeat={smallBlindSeat}
          bigBlindSeat={bigBlindSeat}
        />
        {!heroEliminated ? (
          <MobileHeroSeatMarker
            player={heroFeltPlayer}
            active={isMyTurn}
            handNumber={game?.hand_number || 1}
            roleLabel={roleForSeat(me?.seat)}
            timerRemaining={timerRemaining}
            timerPercent={timerPercent}
            timerUrgent={timerUrgent}
            pendingLabel={pendingLabelForSeat(me?.seat)}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
          {opponents.slice(0, 8).map((opponent, idx) => {
            const seatPosition = desktopSeatPosition(idx, opponents.length);
            const pendingLabel = pendingLabelForSeat(opponent.seat);
            const active = Number(game?.current_turn) === Number(opponent.seat) && !game?.is_completed;
            return (
              <React.Fragment key={opponent.seat}>
                <CasinoSeatPod
                  player={opponent}
                  active={active}
                  dealer={Number(game?.dealer) === Number(opponent.seat)}
                  className="-translate-y-1/2"
                  style={seatPosition}
                  handNumber={game?.hand_number || 1}
                  showCards={false}
                  moveLabel={pendingLabel || playerMoveLabel(opponent, active, game)}
                  timerRemaining={timerRemaining}
                  timerPercent={timerPercent}
                  timerUrgent={timerUrgent}
                />
              </React.Fragment>
            );
          })}
          {opponents.slice(0, 8).map((opponent, idx) => {
            const cardPoint = desktopFeltCardPoint(idx, opponents.length);
            return (
              <FeltHoleCards
                key={`felt-${opponent.seat}`}
                player={opponent}
                className="-translate-y-1/2"
                style={stadiumPositionStyle(cardPoint)}
                handNumber={game?.hand_number || 1}
                roleLabel={roleForSeat(opponent.seat)}
                faceDown
                betMarkerStyle={betMarkerStyleForStadiumPoint(cardPoint)}
                roleChipClassName={roleChipClassForStadiumPoint(cardPoint)}
              />
            );
          })}
          <CasinoSeatPod
            player={heroFeltPlayer}
            active={!heroEliminated && isMyTurn}
            dealer={!heroEliminated && Number(game?.dealer) === Number(mySeat)}
            isMe
            className="bottom-5 left-1/2"
            handNumber={game?.hand_number || 1}
            showCards={false}
            moveLabel={heroEliminated ? "Out" : pendingLabelForSeat(me?.seat) || playerMoveLabel(me, isMyTurn, game)}
            timerRemaining={timerRemaining}
            timerPercent={timerPercent}
            timerUrgent={timerUrgent}
          />
          {!heroEliminated ? (
            <FeltHoleCards
              player={heroFeltPlayer}
              className="-translate-y-1/2"
              style={stadiumPositionStyle(heroCardPoint)}
              handNumber={game?.hand_number || 1}
              roleLabel={roleForSeat(me?.seat)}
              betMarkerStyle={betMarkerStyleForStadiumPoint(heroCardPoint)}
              roleChipClassName={roleChipClassForStadiumPoint(heroCardPoint)}
            />
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-1/2 top-[calc(50%-50px)] -translate-x-1/2 sm:top-[calc(50%-56px)] lg:top-[calc(50%-54px)]">
            <FeltRoundMeta game={game} />
          </div>
          <div className="absolute left-1/2 top-1/2 flex min-h-[70px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 px-1 py-2 sm:gap-2 sm:min-h-[86px] sm:px-4 sm:py-3 lg:min-h-[74px]">
            {Array.from({ length: 5 }).map((_, idx) => (
              <PokerCard
                key={`${game?.hand_number || 1}-${idx}-${displayedCommunityCards?.[idx] || "empty"}`}
                card={displayedCommunityCards?.[idx]}
                compact
                animate={Boolean(displayedCommunityCards?.[idx])}
                dealVariant="community"
                delay={idx * 90}
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-[calc(50%+40px)] -translate-x-1/2 sm:top-[calc(50%+48px)] lg:top-[calc(50%+44px)]">
            <FeltInfoPanel game={game} />
          </div>
        </div>
      </div>

      <div className="hidden justify-center pt-2 sm:flex lg:hidden">
        <PlayerPanel
          label={heroEliminated ? "Out" : pendingLabelForSeat(me?.seat)}
          active={!heroEliminated && isMyTurn && !pendingLabelForSeat(me?.seat)}
          dealer={!heroEliminated && Number(game?.dealer) === Number(mySeat)}
          tableSeat
          showMeta={heroEliminated || Boolean(pendingLabelForSeat(me?.seat))}
          className="!w-[176px] border border-emerald-300/15"
          handNumber={game?.hand_number || 1}
          {...heroFeltPlayer}
        />
      </div>

      <SeatStatusSheet
        open={seatsOpen}
        players={displayedTablePlayers}
        currentTurn={game?.current_turn}
        dealerSeat={game?.dealer}
        mySeat={mySeat}
        onClose={() => setSeatsOpen(false)}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 min-h-0 flex flex-col items-center justify-center gap-2 border-t border-stone-200/[0.08] bg-[#080706]/96 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 shadow-[0_-18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:static sm:mx-auto sm:w-full sm:max-w-[980px] sm:rounded-lg sm:border sm:bg-[linear-gradient(180deg,rgba(18,15,12,0.86),rgba(7,6,5,0.96))] sm:px-3 sm:py-4 sm:shadow-none sm:backdrop-blur-0 sm:min-h-[150px] sm:gap-3">
        <div className="flex w-full max-w-[920px] flex-col items-center justify-center gap-2 sm:gap-3 lg:flex-row lg:items-stretch lg:gap-3">
        <div className="flex min-w-0 flex-col items-center justify-center gap-2 sm:gap-3 lg:w-[540px]">
          {game?.is_completed ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                Next hand auto-deals shortly
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
              {onNextHand ? (
                <Tooltip content="Deal next hand now">
                  <Button type="button" variant="outline" size="sm" onClick={onNextHand}>
                    Deal Now
                  </Button>
                </Tooltip>
              ) : null}
              {onPlayAgain ? (
                <Tooltip content="New table">
                  <Button type="button" variant="secondary" size="sm" onClick={onPlayAgain} aria-label="New table">
                    <LuRefreshCw size={16} />
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip content="Home">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate("/")} aria-label="Home">
                  <CiHome size={16} />
                </Button>
              </Tooltip>
              </div>
            </div>
          ) : (
            <>
            <div className="grid w-full grid-cols-4 gap-1.5 rounded-lg border border-white/[0.06] bg-black/24 p-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2 sm:bg-black/18 sm:p-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-11 border-emerald-200/10 bg-emerald-950/28 px-1 text-xs text-emerald-50 hover:border-emerald-200/24 hover:bg-emerald-900/45 sm:h-9 sm:px-4 sm:text-sm"
                disabled={!can("check")}
                onClick={() => handleAction("check")}
              >
                Check
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-11 border-cyan-200/10 bg-cyan-950/22 px-1 text-xs text-cyan-50 hover:border-cyan-200/24 hover:bg-cyan-900/34 sm:h-9 sm:px-4 sm:text-sm"
                disabled={!can("call")}
                onClick={() => handleAction("call")}
              >
                Call {game?.call_amount || ""}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="hidden border border-emerald-200/20 !bg-emerald-300/88 px-2 !text-slate-950 shadow-[0_8px_22px_rgba(16,185,129,0.14)] hover:!bg-emerald-200 sm:inline-flex sm:px-4"
                disabled={!can("raise")}
                onClick={() => handleAction("raise", raiseTo)}
              >
                Raise {raiseTo || ""}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="h-11 border border-emerald-200/20 !bg-emerald-300/88 px-1 text-xs !text-slate-950 shadow-[0_8px_22px_rgba(16,185,129,0.14)] hover:!bg-emerald-200 sm:hidden"
                disabled={!canRaiseOrAllIn}
                onClick={() => setRaisePanelOpen((open) => !open)}
              >
                Bet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden border-fuchsia-300/22 !bg-fuchsia-500/16 px-2 !text-fuchsia-100 !shadow-none hover:border-fuchsia-200/32 hover:!bg-fuchsia-500/24 sm:inline-flex sm:px-4"
                disabled={!can("all_in")}
                onClick={() => handleAction("all_in")}
              >
                All In
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 border-slate-300/10 bg-slate-950/28 px-1 text-xs text-slate-200 hover:border-slate-200/20 hover:bg-slate-800/40 sm:h-9 sm:px-4 sm:text-sm"
                disabled={!can("fold")}
                onClick={() => handleAction("fold")}
              >
                Fold
              </Button>
            </div>

            <div className={[
              "w-full max-w-md rounded-lg border border-stone-200/[0.08] bg-[linear-gradient(180deg,rgba(18,15,12,0.84),rgba(8,7,6,0.96))] px-2 py-2 sm:px-3 sm:py-3",
              raisePanelOpen ? "block" : "hidden sm:block",
              canRaiseOrAllIn ? "opacity-100" : "opacity-45",
            ].join(" ")}>
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                <span>Raise To</span>
                <span className="rounded bg-emerald-300/12 px-2 py-0.5 text-emerald-100">{raiseTo || "-"}</span>
              </div>
              <input
                type="range"
                min={minRaiseTo || 0}
                max={maxRaiseTo || minRaiseTo || 0}
                step="10"
                value={raiseTo || minRaiseTo || 0}
                disabled={!can("raise")}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                className="mt-2 w-full accent-emerald-200"
              />
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                {raisePresets.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={!can("raise")}
                    onClick={() => setRaiseTo(amount)}
                    className="rounded-md border border-emerald-200/14 bg-emerald-300/[0.07] px-2 py-1 text-[11px] font-bold text-emerald-100/90 transition hover:border-emerald-200/28 hover:bg-emerald-300/13 disabled:opacity-40"
                  >
                    {amount === maxRaiseTo ? "Max" : amount}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:hidden">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="h-11 border border-emerald-200/20 !bg-emerald-300/88 text-xs !text-slate-950 shadow-[0_8px_22px_rgba(16,185,129,0.14)] hover:!bg-emerald-200"
                  disabled={!can("raise")}
                  onClick={() => handleAction("raise", raiseTo)}
                >
                  Raise {raiseTo || ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 border-fuchsia-300/22 !bg-fuchsia-500/16 text-xs !text-fuchsia-100 !shadow-none hover:border-fuchsia-200/32 hover:!bg-fuchsia-500/24"
                  disabled={!can("all_in")}
                  onClick={() => handleAction("all_in")}
                >
                  All In
                </Button>
              </div>
            </div>
            </>
          )}
        </div>
        <PokerTableChat gameId={game?.id} />
        </div>
      </div>
    </div>
  );
}
