import React from "react";
import { showToast } from "./Toast";


const ToastTester = () => {
    // Simulate a test error
    const simulateError = () => {
        showToast("error", "This is a test error notification!");
    };

    // Simulate a test success
    const simulateSuccess = () => {
        showToast("success", "This is a test success notification!");
    };

    return (
        <div style={{ marginTop: "20px" }}>
            <button onClick={simulateError} style={{ marginRight: "10px" }}>
                Trigger Error Toast
            </button>
            <button onClick={simulateSuccess}>
                Trigger Success Toast
            </button>
        </div>
    );
};

export default ToastTester;
