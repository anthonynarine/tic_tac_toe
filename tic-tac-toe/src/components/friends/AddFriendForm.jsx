// # Filename: src/components/friends/AddFriendForm.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IoAddSharp } from "react-icons/io5";
import { useFriends } from "../../context/friendsContext"

export default function AddFriendForm({ showLabel = true, onSuccess }) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { sendRequest, refreshFriends } = useFriends();

  const canSubmit = useMemo(() => Boolean(email.trim()) && !isSubmitting, [email, isSubmitting]);

  const extractErrorMessage = useCallback((error) => {
    const data = error?.response?.data;
    if (!data) return "Something went wrong. Please try again.";
    if (typeof data.error === "string") return data.error;
    if (typeof data.detail === "string") return data.detail;

    const firstKey = Object.keys(data)[0];
    const value = data[firstKey];
    if (Array.isArray(value)) return value[0];
    if (typeof value === "string") return value;

    return "Something went wrong. Please try again.";
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!email.trim() || isSubmitting) return;

      setIsSubmitting(true);

      try {
        await sendRequest(email.trim());
        setFeedback({ type: "success", message: "Friend request sent." });
        setEmail("");
        refreshFriends();
        setTimeout(() => onSuccess?.(), 900);
      } catch (error) {
        setFeedback({ type: "error", message: extractErrorMessage(error) });
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, isSubmitting, sendRequest, refreshFriends, extractErrorMessage, onSuccess]
  );

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between">
          <label htmlFor="friendEmail" className="text-xs font-semibold tracking-wide uppercase text-text-muted">
            Add a friend
          </label>
        </div>
      )}

      <div
        className={[
          showLabel ? "mt-3" : "mt-1",
          "flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 focus-within:border-brand-cyan/40 transition",
        ].join(" ")}
      >
        <input
          id="friendEmail"
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-faint outline-none"
          autoComplete="email"
          inputMode="email"
          required
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            "h-9 w-9 grid place-items-center rounded-lg",
            "text-text-muted hover:text-brand-cyan hover:bg-brand-cyan/10",
            "focus:outline-none",
            !canSubmit ? "opacity-40 cursor-not-allowed hover:bg-transparent" : "",
          ].join(" ")}
          title={isSubmitting ? "Sending..." : "Send friend request"}
          aria-label="Send friend request"
        >
          <IoAddSharp size={18} />
        </button>
      </div>

      {feedback?.message && (
        <div
          className={[
            "mt-2 text-xs",
            feedback.type === "success" ? "text-brand-emerald" : "text-brand-rose",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}
    </form>
  );
}
