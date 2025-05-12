import React, { useState, useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import "./AddFriendForm.css"; // Custom styling for form and feedback UI

/**
 * AddFriendForm
 *
 * Component for submitting friend requests by email.
 * Integrates with the friends context to trigger the backend API,
 * display user-friendly feedback, and refresh the friends list.
 *
 * Features:
 * - Email input validation
 * - Server-side error parsing and display
 * - Success and error feedback with auto-clear
 */
const AddFriendForm = () => {
    // Local state for input and feedback message
    const [email, setEmail] = useState("");
    const [feedback, setFeedback] = useState(null); // { type: "success" | "error", message: string }

    // Access friend request API actions from context
    const { sendRequest, refreshFriends } = useFriends();

    /**
     * Extracts a clean error message from an Axios error object.
     * Supports Django REST Framework's nested field error formats.
   */
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

    /**
     * Handles form submission:
     * - Sends the request
     * - Updates friend list
     * - Sets appropriate feedback message
     */
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

    /**
     * Clears the feedback message after 3 seconds.
     */
    useEffect(() => {
        if (feedback) {
        const timer = setTimeout(() => setFeedback(null), 3000);
        return () => clearTimeout(timer);
        }
    }, [feedback]);

    return (
        <form onSubmit={handleSubmit} className="friends-sidebar__add-form">
        <label htmlFor="friendEmail" className="friends-sidebar__label">
            Add a friend
        </label>
        <div className="friends-sidebar__input-group">
            <input
            id="friendEmail"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="friends-sidebar__input"
            required
            />
            <button type="submit" className="add-btn">Add</button>
        </div>

        {feedback && (
            <p className={`feedback ${feedback.type}`}>{feedback.message}</p>
        )}
        </form>
    );
};

export default AddFriendForm;
