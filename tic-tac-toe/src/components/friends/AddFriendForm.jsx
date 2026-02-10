// # Filename: src/components/friends/AddFriendForm.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IoAddSharp } from "react-icons/io5";
import { useFriends } from "../../context/friendsContext"

export default function AddFriendForm({ showLabel = true }) {
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
      } catch (error) {
        setFeedback({ type: "error", message: extractErrorMessage(error) });
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, isSubmitting, sendRequest, refreshFriends, extractErrorMessage]
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
          <label htmlFor="friendEmail" className="text-sm font-medium tracking-wide text-[#1DA1F2]">
            Add a friend
          </label>
        </div>
      )}

      <div
        className={[
          showLabel ? "mt-3" : "mt-1",
          `
          flex items-center gap-2
          rounded-xl border border-slate-700/40
          bg-slate-900/30
          px-3 py-2
          focus-within:border-[#1DA1F2]/50
          focus-within:shadow-[0_0_18px_rgba(29,161,242,0.08)]
          transition
        `,
        ].join(" ")}
      >
        <input
          id="friendEmail"
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="
            flex-1 min-w-0 bg-transparent
            text-sm text-slate-100 placeholder:text-slate-500
            outline-none
          "
          autoComplete="email"
          inputMode="email"
          required
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            "h-9 w-9 grid place-items-center rounded-lg",
            "text-[#1DA1F2]/85 hover:text-[#1DA1F2]",
            "hover:bg-[#1DA1F2]/10",
            "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35",
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
            feedback.type === "success" ? "text-emerald-300" : "text-rose-300",
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
