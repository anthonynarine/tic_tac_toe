// TrinityQuote.jsx
import React, { useState, useEffect } from "react";
import styles from "./TrinityQuote.module.css";

/**
 * TrinityQuote
 * Cycles through Matrix-style assistant quotes with a typewriter effect.
 */
const quotes = [
    "The code is real.",
    "You already know the answer.",
    "I'm watching the source...",
    "Follow the white rabbit.",
    "Reality is programmable.",
    "I read your serializers.",
    "We are the loop.",
    "Ask me anyting about the app",
    "Hello julia!"

];

const TrinityQuote = () => {
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [charIndex, setCharIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
        const fullText = quotes[quoteIndex];
        if (charIndex < fullText.length) {
            setDisplayedText(fullText.slice(0, charIndex + 1));
            setCharIndex((prev) => prev + 1);
        } else {
            clearInterval(interval);
            setTimeout(() => {
            setCharIndex(0);
            setQuoteIndex((prev) => (prev + 1) % quotes.length);
            setDisplayedText("");
            }, 3000); // pause before cycling to next
        }
        }, 75);

        return () => clearInterval(interval);
    }, [charIndex, quoteIndex]);

    return <div className={styles.quote}>{displayedText}</div>;
};

export default TrinityQuote;
