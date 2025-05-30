// TextInput.jsx
import React from "react";
import omit from "lodash/omit";



/**
 * Reusable input component.
 *
 * Props:
 * - label: string – field label
 * - name: string – input name/id
 * - value: string – controlled value
 * - onChange: function – change handler
 * - placeholder: string – optional input placeholder
 * - error: boolean – optional red border if true
 * - type: string – input type (default: "text")
 * - required: boolean – HTML required attribute
 */
const TextInput = ({
  label = "Input",
  name,
  value,
  onChange,
  placeholder = "",
  error = false,
  type = "text",
  required = true,
  className = "",
}) => {
  return (
    <div style={styles.formGroup}>
      <label htmlFor={name} style={{ ...styles.label, ...(error && styles.labelError) }}>
        {label}
      </label>
      <input
        type={type}
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
    </div>
  );
};

export default TextInput;

// 🔽 Scoped styles
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
};
