import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuCalendarClock, LuPlay, LuRefreshCw, LuTrash2, LuUsers, LuX } from "react-icons/lu";

import { pokerApi } from "../../api/pokerApi";
import { showToast } from "../../utils/toast/Toast";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Tooltip from "../ui/Tooltip";

const DEFAULT_FORM = {
  title: "",
  scheduled_start: "",
  max_players: 6,
  starting_chips: 1000,
  small_blind: 10,
  big_blind: 20,
  turn_timer_seconds: 45,
};

function defaultStartValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function statusVariant(status) {
  if (status === "open") return "success";
  if (status === "closed") return "warning";
  if (status === "in_progress") return "brand";
  if (status === "cancelled") return "danger";
  return "neutral";
}

function formatStart(value) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  const first = Object.values(data).flat()[0];
  return typeof first === "string" ? first : fallback;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "tournament-input h-10 w-full rounded-lg border border-border-soft bg-slate-950/70 px-3 text-sm text-text-primary outline-none transition focus:border-brand-cyan/50";

function StartDateTimeInput({ value, onChange }) {
  const inputRef = React.useRef(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={`${inputClass} pr-11`}
        type="datetime-local"
        value={value}
        onChange={onChange}
        required
      />
      <Tooltip content="Pick start date and time" className="absolute right-1.5 top-1/2 -translate-y-1/2">
        <button
          type="button"
          onClick={openPicker}
          className="grid h-7 w-7 place-items-center rounded-md border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan transition hover:bg-brand-cyan/15"
          aria-label="Pick tournament start"
        >
          <LuCalendarClock size={15} />
        </button>
      </Tooltip>
    </div>
  );
}

export default function PokerTournamentsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, scheduled_start: defaultStartValue() }));
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rosterTournamentId, setRosterTournamentId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pokerApi.listTournaments();
      setTournaments(data?.results || []);
    } catch {
      showToast("error", "Could not load tournaments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(
    () => [...tournaments].sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)),
    [tournaments]
  );
  const rosterTournament = useMemo(
    () => upcoming.find((tournament) => tournament.id === rosterTournamentId) || null,
    [rosterTournamentId, upcoming]
  );

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        scheduled_start: new Date(form.scheduled_start).toISOString(),
        max_players: Number(form.max_players),
        starting_chips: Number(form.starting_chips),
        small_blind: Number(form.small_blind),
        big_blind: Number(form.big_blind),
        turn_timer_seconds: Number(form.turn_timer_seconds),
      };
      await pokerApi.createTournament(payload);
      setForm({ ...DEFAULT_FORM, scheduled_start: defaultStartValue() });
      setIsCreateOpen(false);
      showToast("success", "Tournament posted.");
      await load();
    } catch (error) {
      showToast("error", errorMessage(error, "Could not create tournament."));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (tournamentId, action, successMessage) => {
    setBusyId(tournamentId);
    try {
      const result = await action();
      if (successMessage) showToast("success", successMessage);
      if (result?.gameId) {
        navigate(`/games/poker/${result.gameId}`);
        return;
      }
      await load();
    } catch (error) {
      showToast("error", errorMessage(error, "Tournament action failed."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full px-1 pb-4 pt-1 sm:px-4 sm:pb-24 sm:pt-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="hidden text-[11px] uppercase tracking-[0.28em] text-text-muted sm:block">
              Poker
            </div>
            <h1 className="text-xl font-semibold tracking-wide text-text-primary sm:text-2xl">
              Tournaments
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
              Create
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
              <LuRefreshCw size={15} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {loading ? (
            <Card variant="outline" className="grid min-h-[220px] place-items-center p-4 text-sm text-text-secondary lg:col-span-2">
              Loading tournaments...
            </Card>
          ) : null}

          {!loading && upcoming.length === 0 ? (
            <Card variant="outline" className="grid min-h-[220px] place-items-center p-6 text-center text-sm text-text-faint lg:col-span-2">
              No tournaments posted yet.
            </Card>
          ) : null}

          {!loading && upcoming.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              busy={busyId === tournament.id}
              onRegister={() => runAction(
                tournament.id,
                () => pokerApi.registerTournament(tournament.id),
                "Registered."
              )}
              onWithdraw={() => runAction(
                tournament.id,
                () => pokerApi.withdrawTournament(tournament.id),
                "Registration withdrawn."
              )}
              onStart={() => runAction(
                tournament.id,
                () => pokerApi.startTournament(tournament.id),
                "Tournament started."
              )}
              onRoster={() => setRosterTournamentId(tournament.id)}
              onJoin={() => navigate(`/games/poker/${tournament.game_id}`)}
            />
          ))}
        </div>
      </div>

      {rosterTournament ? (
        <RosterModal
          tournament={rosterTournament}
          busy={busyId === rosterTournament.id}
          onClose={() => setRosterTournamentId(null)}
          onRemove={(registrationId) => runAction(
            rosterTournament.id,
            () => pokerApi.removeTournamentRegistration(rosterTournament.id, registrationId),
            "Player removed."
          )}
        />
      ) : null}

      {isCreateOpen ? (
        <CreateTournamentModal
          form={form}
          saving={saving}
          onChange={updateForm}
          onSubmit={submit}
          onClose={() => setIsCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CreateTournamentModal({ form, saving, onChange, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-3 sm:py-6">
      <div className="w-full max-w-lg rounded-t-2xl border border-border-soft bg-background-app-panel shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:rounded-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Poker Tournament
            </div>
            <div className="text-base font-semibold text-text-primary">Create Tournament</div>
          </div>
          <Tooltip content="Close">
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-soft text-text-muted transition hover:bg-surface hover:text-text-primary"
              aria-label="Close create tournament"
            >
              <LuX size={17} />
            </button>
          </Tooltip>
        </div>

        <form onSubmit={onSubmit} className="grid max-h-[78dvh] gap-3 overflow-y-auto p-4 tron-scrollbar-dark sm:max-h-[72dvh] sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => onChange("title", event.target.value)}
                placeholder="Friday Night Hold'em"
                required
                maxLength={80}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Start">
              <StartDateTimeInput
                value={form.scheduled_start}
                onChange={(event) => onChange("scheduled_start", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Players">
            <input
              className={inputClass}
              type="number"
              min="2"
              max="9"
              value={form.max_players}
              onChange={(event) => onChange("max_players", event.target.value)}
            />
          </Field>

          <Field label="Stack">
            <input
              className={inputClass}
              type="number"
              min="500"
              max="10000"
              step="100"
              value={form.starting_chips}
              onChange={(event) => onChange("starting_chips", event.target.value)}
            />
          </Field>

          <Field label="Small Blind">
            <input
              className={inputClass}
              type="number"
              min="5"
              step="5"
              value={form.small_blind}
              onChange={(event) => onChange("small_blind", event.target.value)}
            />
          </Field>

          <Field label="Big Blind">
            <input
              className={inputClass}
              type="number"
              min="10"
              step="5"
              value={form.big_blind}
              onChange={(event) => onChange("big_blind", event.target.value)}
            />
          </Field>

          <Field label="Turn Timer">
            <input
              className={inputClass}
              type="number"
              min="15"
              max="120"
              step="5"
              value={form.turn_timer_seconds}
              onChange={(event) => onChange("turn_timer_seconds", event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:items-end sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-11 sm:h-9" disabled={saving}>
              Post Tournament
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TournamentCard({
  tournament,
  busy,
  onRegister,
  onWithdraw,
  onStart,
  onRoster,
  onJoin,
}) {
  const canRegister = tournament.status === "open" && !tournament.is_registered;
  const canWithdraw = tournament.is_registered && ["open", "closed"].includes(tournament.status) && !tournament.is_creator;
  const canStart = tournament.is_creator && ["open", "closed"].includes(tournament.status);
  const canJoin = tournament.status === "in_progress" && tournament.game_id && tournament.is_registered;

  return (
    <Card variant="glass" className="flex min-h-0 flex-col p-3 sm:min-h-[260px] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-text-primary">{tournament.title}</div>
          <div className="mt-1 text-xs text-text-secondary">Hosted by {tournament.creator_name}</div>
        </div>
        <Badge variant={statusVariant(tournament.status)} className="capitalize">
          {tournament.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-secondary sm:grid-cols-4">
        <div className="rounded-lg border border-border-soft bg-slate-950/40 p-2">
          <LuCalendarClock className="mb-1 text-brand-cyan" size={16} />
          {formatStart(tournament.scheduled_start)}
        </div>
        <div className="rounded-lg border border-border-soft bg-slate-950/40 p-2">
          <LuUsers className="mb-1 text-brand-emerald" size={16} />
          {tournament.registered_count}/{tournament.max_players}
        </div>
        <div className="rounded-lg border border-border-soft bg-slate-950/40 p-2">
          Stack<br />
          <span className="text-text-primary">{tournament.starting_chips}</span>
        </div>
        <div className="rounded-lg border border-border-soft bg-slate-950/40 p-2">
          Blinds<br />
          <span className="text-text-primary">{tournament.small_blind}/{tournament.big_blind}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={onRoster}>
          <LuUsers size={15} />
          Roster
        </Button>
        {canRegister ? (
          <Button type="button" size="sm" className="h-11 sm:h-9" onClick={onRegister} disabled={busy}>
            Register
          </Button>
        ) : null}
        {canWithdraw ? (
          <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={onWithdraw} disabled={busy}>
            Withdraw
          </Button>
        ) : null}
        {canStart ? (
          <Button type="button" variant="secondary" size="sm" className="h-11 sm:h-9" onClick={onStart} disabled={busy}>
            <LuPlay size={15} />
            Start
          </Button>
        ) : null}
        {canJoin ? (
          <Button type="button" size="sm" className="h-11 sm:h-9" onClick={onJoin}>
            Join Table
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function RosterModal({ tournament, busy, onClose, onRemove }) {
  const registrations = tournament.registrations || [];
  const canManage = tournament.is_creator && ["open", "closed"].includes(tournament.status);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-3 sm:py-6">
      <div className="w-full max-w-md rounded-t-2xl border border-border-soft bg-background-app-panel shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:rounded-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Registered Players
            </div>
            <div className="truncate text-base font-semibold text-text-primary">{tournament.title}</div>
            <div className="mt-1 text-xs text-text-secondary">
              {tournament.registered_count}/{tournament.max_players} seats
            </div>
          </div>
          <Tooltip content="Close">
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-soft text-text-muted transition hover:bg-surface hover:text-text-primary"
              aria-label="Close roster"
            >
              <LuX size={17} />
            </button>
          </Tooltip>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-3 tron-scrollbar-dark">
          {registrations.length === 0 ? (
            <div className="grid min-h-28 place-items-center rounded-lg border border-border-soft bg-slate-950/35 px-4 text-center text-sm text-text-faint">
              No registered players yet.
            </div>
          ) : (
            <div className="space-y-2">
              {registrations.map((registration, idx) => (
                <div
                  key={registration.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-slate-950/45 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-cyan/10 text-xs font-bold text-brand-cyan">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text-primary">
                        {registration.name}
                      </div>
                      <div className="text-xs capitalize text-text-muted">{registration.status}</div>
                    </div>
                  </div>

                  {canManage && registration.status === "registered" && !registration.is_me ? (
                    <Tooltip content="Remove">
                      <button
                        type="button"
                        onClick={() => onRemove(registration.id)}
                        disabled={busy}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-rose/20 text-brand-rose transition hover:bg-brand-rose/10 disabled:opacity-50"
                        aria-label={`Remove ${registration.name}`}
                      >
                        <LuTrash2 size={14} />
                      </button>
                    </Tooltip>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
