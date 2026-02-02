// # Filename: src/components/trinity/TrinityDrawer.jsx


import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./TrinityDrawer.module.css";
import { IoCloseSharp, IoSend } from "react-icons/io5";
import useAuthAxios from "../../auth/hooks/useAuthAxios";
import { useUI } from "../../context/uiContext";
import TronNeuralRing from "./svg/TronNeuralRing";

/**
 * TrinityDrawer
 * - Floating assistant drawer
 * - Asks LangChain agent questions about the app
 */
const TrinityDrawer = ({ isOpen: isOpenProp, onClose: onCloseProp }) => {
  const { isTrinityOpen, setTrinityOpen } = useUI();

  // Step 1: Support both props + context (props win)
  const isOpen = typeof isOpenProp === "boolean" ? isOpenProp : isTrinityOpen;

  const handleClose = useCallback(() => {
    if (typeof onCloseProp === "function") {
      onCloseProp();
      return;
    }
    setTrinityOpen(false);
  }, [onCloseProp, setTrinityOpen]);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messageLogRef = useRef(null);

  const { authAxios } = useAuthAxios();

  const handleSend = useCallback(async () => {
    // Step 2: Guard empty message
    if (!input.trim()) return;

    const userMessage = { type: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await authAxios.post("/trinity/", { question: input });
      const answer = res.data.answer;

      const aiMessage = { type: "ai", text: "" };
      setMessages((prev) => [...prev, aiMessage]);

      // Step 3: Typing animation
      let index = 0;
      const interval = setInterval(() => {
        aiMessage.text = answer.slice(0, index + 1);
        setMessages((prevMsgs) => {
          const updated = [...prevMsgs];
          updated[updated.length - 1] = { ...aiMessage };
          return updated;
        });
        index += 1;
        if (index >= answer.length) clearInterval(interval);
      }, 10);
    } catch (err) {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [authAxios, input]);

  // Step 4: Scroll to bottom on new message
  useEffect(() => {
    if (messageLogRef.current) {
      messageLogRef.current.scrollTop = messageLogRef.current.scrollHeight;
    }
  }, [messages]);

  // Step 5: Only render when open
  if (!isOpen) return null;

  return (
    <div className={styles.drawer}>
      <div className={styles.header}>
        <div className={styles.icon}>
          <TronNeuralRing className={styles.glowSvg} />
        </div>

        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close Trinity drawer">
          <IoCloseSharp />
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.messageLog} ref={messageLogRef}>
          {messages.map((msg, i) => (
            <div key={i} className={styles.line}>
              <span className={msg.type === "user" ? styles.prompt : styles.label}>
                {msg.type === "user" ? "User:" : "Trinity:"}
              </span>
              <span className={styles.text}>{msg.text}</span>
            </div>
          ))}

          {error && (
            <div className={styles.line}>
              <span className={styles.label}>Trinity:</span>
              <span className={styles.text} style={{ color: "#ff4d4d" }}>
                {error}
              </span>
            </div>
          )}
        </div>

        <div className={styles.inputRow}>
          <div className={styles.inputContainer}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.textarea}
              placeholder="Ask me about the app"
              rows={1}
            />
            <button
              onClick={handleSend}
              className={styles.sendButton}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <IoSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrinityDrawer;
