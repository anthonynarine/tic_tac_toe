import React, { useState, useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import "./AddFriendForm.css"; // ✅ import external CSS

const AddFriendForm = () => {
    const [email, setEmail] = useState("");
    const [feedback, setFeedback] = useState(null);
    const { sendRequest, refreshFriends } = useFriends();

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!email) return;

        try {
        await sendRequest(email);
        setFeedback({ type: "success", message: "Friend request sent!" });
        setEmail("");
        refreshFriends();
        } catch (error) {
        const errorMsg =
            error.response?.data?.non_field_errors?.[0] ||
            error.response?.data?.error ||
            "Something went wrong.";
        setFeedback({ type: "error", message: errorMsg });
        }
    };

    // Optional: auto-clear feedback after 3 seconds
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
