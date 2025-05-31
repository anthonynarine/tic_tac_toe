// File: AddFriendForm.jsx - Updated with React Icon and Modular CSS

import React, { useState, useEffect } from "react";
import { AiOutlineUserAdd } from "react-icons/ai";
import { useFriends } from "../context/friendsContext";
import styles from "./AddFriendForm.module.css";

/**
 * AddFriendForm Component
 * ----------------------------------------------------------------
 * Allows users to send friend requests via email.
 * Uses Tron-style modular CSS and React Icon for submit button.
 */
const AddFriendForm = () => {
    const [email, setEmail] = useState("");
    const [feedback, setFeedback] = useState(null);
    const { sendRequest, refreshFriends } = useFriends();

    // Handle form submission
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!email) return;

        try {
        await sendRequest(email);
        setFeedback({ type: "success", message: "Friend request sent!" });
        setEmail("");
        refreshFriends();
        } catch (error) {
        const errorMsg = extractErrorMessage(error);
        console.log("[AddFriendForm] Extracted error message:", errorMsg);
        setFeedback({ type: "error", message: errorMsg });
        }
    };

    // Parse error message from API
    const extractErrorMessage = (error) => {
        const data = error?.response?.data;
        if (!data) return "Something went wrong.";

        if (typeof data.error === "string") return data.error;
        if (typeof data.detail === "string") return data.detail;

        const firstKey = Object.keys(data)[0];
        const value = data[firstKey];

        if (Array.isArray(value)) return value[0];
        if (typeof value === "string") return value;

        return "Something went wrong.";
    };

    // Auto-clear feedback
    useEffect(() => {
        if (feedback) {
        const timer = setTimeout(() => setFeedback(null), 3000);
        return () => clearTimeout(timer);
        }
    }, [feedback]);

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
        {/* Label */}
        <label htmlFor="friendEmail" className={styles.label}>
            Add a friend
        </label>

        {/* Input + Icon Button */}
        <div className={styles.inputGroup}>
            <input
            id="friendEmail"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
            />

            <button type="submit" className={styles.addBtn} title="Send friend request">
            <AiOutlineUserAdd size={20} />
            </button>
        </div>

        {/* Feedback */}
        {feedback && (
            <p className={`${styles.feedback} ${styles[feedback.type]}`}>
            {feedback.message}
            </p>
        )}
        </form>
    );
};

export default AddFriendForm;
