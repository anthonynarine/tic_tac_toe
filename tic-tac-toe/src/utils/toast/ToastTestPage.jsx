import React from "react";
import { ToastContainer } from "react-toastify";
import { showToast } from "./Toast";
import "react-toastify/dist/ReactToastify.css";

const ToastTestPage = () => {
    const handleSuccessToast = () => {
        showToast("success", "This is a success toast!");
    };

    const handleErrorToast = () => {
        showToast("error", "This is an error toast!");
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>Toast Notification Test Page</h1>
            <div style={{ marginBottom: "100px" }}>
                <button onClick={handleSuccessToast} style={buttonStyle}>
                    Show Success Toast
                </button>
                <button onClick={handleErrorToast} style={buttonStyle}>
                    Show Error Toast
                </button>
            </div>

            {/* ToastContainer is required to display toast notifications */}
            <ToastContainer />
        </div>
    );
};

const buttonStyle = {
    margin: "0 10px",
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "5px",
    cursor: "pointer",
    border: "none",
    backgroundColor: "#E34F26",
    color: "white",
};

export default ToastTestPage;
