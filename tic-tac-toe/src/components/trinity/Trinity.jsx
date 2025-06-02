// File: Trinity.jsx
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import useAuthAxios from "../hooks/useAuthAxios";
import styles from "./Trinity.module.css";

/**
 * 🧠 Trinity AI Assistant
 * - Powered by LangChain + OpenAI
 * - Renders markdown, code, typing animations
 * - Styled with Tron theme (CSS Modules)
 */
const Trinity = () => {
    const [question, setQuestion] = useState("");
    const [rawAnswer, setRawAnswer] = useState(null);
    const [displayedAnswer, setDisplayedAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const authAxios = useAuthAxios();

    /**
     * Handles sending the question to the backend agent
     */
    const handleAsk = async () => {
        if (!question.trim()) return;

        setLoading(true);
        setError(null);
        setRawAnswer(null);
        setDisplayedAnswer("");

        try {
        const res = await authAxios.post("/api/trinity/", { question });
        setRawAnswer(res.data.answer);
        } catch (err) {
        setError("Something went wrong.");
        } finally {
        setLoading(false);
        }
    };

    /**
     * Typing animation for answer
     */
    useEffect(() => {
        if (!rawAnswer) return;

        let index = 0;
        const interval = setInterval(() => {
        setDisplayedAnswer((prev) => prev + rawAnswer[index]);
        index++;
        if (index >= rawAnswer.length) clearInterval(interval);
        }, 10);

        return () => clearInterval(interval);
    }, [rawAnswer]);

    return (
        <div className={styles.trinityContainer}>
        <h1 className={styles.title}>Ask Trinity</h1>

        {/* Input Section */}
        <div className={styles.inputGroup}>
            <textarea
            placeholder="This app is my domain. Ask me anything."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className={styles.textarea}
            />
            <button onClick={handleAsk} className={styles.askButton}>
            Ask
            </button>
        </div>

        {/* Response Section */}
        <div className={styles.responseBox}>
            {loading && <p className={styles.loading}>Trinity is thinking<span className={styles.dots}>...</span></p>}
            {error && <p className={styles.error}>{error}</p>}
            {displayedAnswer && (
            <ReactMarkdown
                className={styles.markdown}
                children={displayedAnswer}
                components={{
                code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                    <SyntaxHighlighter
                        style={materialDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                    >
                        {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                    ) : (
                    <code className={className} {...props}>
                        {children}
                    </code>
                    );
                },
                }}
            />
            )}
        </div>
        </div>
    );
};

export default Trinity;
