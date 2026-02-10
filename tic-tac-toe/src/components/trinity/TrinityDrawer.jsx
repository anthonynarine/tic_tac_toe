// ✅ New Code
// # Filename: src/components/trinity/TrinityDrawer.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IoCloseSharp, IoSend } from "react-icons/io5";
import { useLocation } from "react-router-dom";

import styles from "./TrinityDrawer.module.css";

import useAuthAxios from "../../auth/hooks/useAuthAxios";
import { useUI } from "../../context/uiContext";

// Optional: if you have it, keep it. If not, remove these 2 lines.
import TronNeuralRing from "./svg/TronNeuralRing";

const TrinityDrawer = ({ isOpen: isOpenProp, onClose: onCloseProp }) => {
  const location = useLocation();
  const { isTrinityOpen, setTrinityOpen } = useUI();
  const { authAxios } = useAuthAxios();

  // # Step 1: Support both props + context (props win)
  const isOpen = typeof isOpenProp === "boolean" ? isOpenProp : isTrinityOpen;

  // # Step 2: Close handler
  const handleClose = useCallback(() => {
    if (typeof onCloseProp === "function") {
      onCloseProp();
      return;
    }
    setTrinityOpen(false);
  }, [onCloseProp, setTrinityOpen]);

  // # Step 3: Determine if we are in mobile/tablet mode (lg breakpoint)
  const [isLgUp, setIsLgUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsLgUp(mq.matches);

    handleChange();
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const isMobileOrTablet = !isLgUp;

  // # Step 4: State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const messageLogRef = useRef(null);
  const inputRef = useRef(null);

  // # Step 5: Lock body scroll while open (mobile/tablet only)
  useEffect(() => {
    if (!isOpen || !isMobileOrTablet) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, isMobileOrTablet]);

  // # Step 6: ESC closes
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // # Step 7: Optional auto-close on route change (mobile/tablet feels better)
  useEffect(() => {
    if (!isOpen || !isMobileOrTablet) return;
    handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // # Step 8: Focus input on open
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  // # Step 9: Scroll to bottom on updates
  useEffect(() => {
    if (!messageLogRef.current) return;
    messageLogRef.current.scrollTop = messageLogRef.current.scrollHeight;
  }, [messages, loading, error]);

  // # Step 10: Send
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");

    const userMessage = { type: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);
    setError(null);

    try {
      const res = await authAxios.post("/trinity/", { question });
      const answer = res?.data?.answer ?? "No answer returned.";

      // Add placeholder AI msg then type into it
      setMessages((prev) => [...prev, { type: "ai", text: "" }]);

      let index = 0;
      const interval = setInterval(() => {
        index += 1;
        const next = answer.slice(0, index);

        setMessages((prevMsgs) => {
          const updated = [...prevMsgs];
          updated[updated.length - 1] = { type: "ai", text: next };
          return updated;
        });

        if (index >= answer.length) clearInterval(interval);
      }, 10);
    } catch (err) {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [authAxios, input, loading]);

  // # Step 11: Enter to send (Shift+Enter newline)
  const handleTextareaKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !loading) handleSend();
      }
    },
    [handleSend, input, loading]
  );

  // # Step 12: Backdrop classes
  const overlayClassName = useMemo(() => {
    if (!isMobileOrTablet) return "hidden";
    return [
      styles.backdrop,
      isOpen ? styles.backdropOpen : styles.backdropClosed,
    ].join(" ");
  }, [isMobileOrTablet, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* ✅ Mobile/Tablet backdrop */}
      <button
        type="button"
        aria-label="Close Trinity overlay"
        onClick={handleClose}
        className={overlayClassName}
      />

      {/* Drawer */}
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Trinity assistant"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandIcon} aria-hidden="true">
              {/* If you don’t have TronNeuralRing, remove this component usage */}
              <TronNeuralRing className={styles.glowSvg} />
            </span>
            <span className={styles.brandText}>Trinity</span>
          </div>

          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close Trinity drawer"
            type="button"
          >
            <IoCloseSharp />
          </button>
        </div>

        {/* Body */}
        <div className={styles.content}>
          <div className={styles.messageLog} ref={messageLogRef}>
            {messages.map((msg, i) => {
              const isUser = msg.type === "user";
              return (
                <div
                  key={`${msg.type}-${i}`}
                  className={[
                    styles.line,
                    isUser ? styles.userLine : styles.aiLine,
                  ].join(" ")}
                >
                  <span className={isUser ? styles.userTag : styles.aiTag}>
                    {isUser ? "User" : "Trinity"}
                  </span>

                  <span
                    className={[
                      styles.text,
                      isUser ? styles.userText : styles.aiText,
                    ].join(" ")}
                  >
                    {msg.text}
                  </span>
                </div>
              );
            })}

            {loading ? (
              <div className={[styles.line, styles.aiLine].join(" ")}>
                <span className={styles.aiTag}>Trinity</span>
                <span className={[styles.text, styles.aiText].join(" ")}>
                  Thinking<span className={styles.dots}>...</span>
                </span>
              </div>
            ) : null}

            {error ? (
              <div className={[styles.line, styles.aiLine].join(" ")}>
                <span className={styles.aiTag}>Trinity</span>
                <span className={[styles.text, styles.aiText, styles.errorText].join(" ")}>
                  {error}
                </span>
              </div>
            ) : null}
          </div>

          {/* Input */}
          <div className={styles.inputRow}>
            <div className={styles.inputContainer}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                className={styles.textarea}
                placeholder="Ask me about the app..."
                rows={1}
              />

              <button
                onClick={handleSend}
                className={styles.sendButton}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                type="button"
              >
                <IoSend />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default TrinityDrawer;
