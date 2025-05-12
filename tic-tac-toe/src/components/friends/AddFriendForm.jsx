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
    // Component state
    const [email, setEmail] = useState("");                  // Input field value
    const [feedback, setFeedback] = useState(null);          // { type: "success" | "error", message: string }

    // Context methods for interacting with friends API
    const { sendRequest, refreshFriends } = useFriends();

    /**
     * Extracts a human-readable error message from the API error response.
     *
     * Supports:
     * - DRF's field errors (e.g., { "email": ["User not found."] })
     * - Flat messages (e.g., { "error": "Already friends." })
     * - Fallback to generic error
     *
     * @param {Object} error - Axios error object
     * @returns {string} - Cleaned-up error message
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
     * Handles the form submission:
     * - Sends the friend request
     * - Displays success or specific error message
     * - Refreshes the friends list on success
     *
     * @param {Event} event - Form submit event
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
            setFeedback({ type: "error", message: errorMsg });
        }
    };

    /**
     * Auto-clears feedback messages after 3 seconds.
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
