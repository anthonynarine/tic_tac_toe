// PasswordInput.jsx
import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import omit from "lodash/omit";



/**
 * Reusable password input with toggle visibility and error support.
 *
 * Props:
 * - label: string – input label
 * - name: string – form field name
 * - value: string – current input value
 * - onChange: func – input change handler
 * - placeholder: string – optional placeholder text
 * - error: boolean – shows red border if true
 * - required: boolean – HTML required attribute
 */
const PasswordInput = ({
    label = "Password",
    name = "password",
    value,
    onChange,
    placeholder = "Enter your password",
    error = false,
    required = true,
    className = "", 
}) => {
    const [visible, setVisible] = useState(false);
    const inputType = visible ? "text" : "password";

    return (
        <div style={styles.formGroup}>
        <label htmlFor={name} style={{ ...styles.label, ...(error && styles.labelError) }}>
            {label}
        </label>
        <div style={styles.inputWrapper}>
            <input
            type={inputType}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className={className} 
            style={{
                ...omit(styles.input, ["backgroundColor"]), // remove bg from inline
                ...(error && styles.inputError),
                            }}
            />
            <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? "Hide password" : "Show password"}
            style={styles.toggle}
            >
            {visible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
        </div>
        </div>
    );
};


export default PasswordInput;

// 🔽 Scoped inline styles
const styles = {
  formGroup: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "1.75rem",
  },
  label: {
    fontSize: "0.9rem",
    color: "#1DA1F2",
    marginBottom: "0.5rem",
    fontWeight: 600,
  },
  labelError: {
    color: "#ff4d4d",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "1rem",
    fontSize: "1rem",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    color: "white",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    outline: "none",
    boxShadow: "0 0 8px rgba(0, 170, 255, 0.1)",
    transition: "all 0.3s ease",
  },
  inputError: {
    borderColor: "#ff4d4d",
    boxShadow: "0 0 10px rgba(255, 77, 77, 0.4)",
  },
  toggle: {
    position: "absolute",
    right: "0.75rem",
    background: "transparent",
    border: "none",
    color: "#ccc",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
};
