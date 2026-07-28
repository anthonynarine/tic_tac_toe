// # Filename: src/components/ui/Card.jsx
import React from "react";
import classNames from "classnames";

const VARIANTS = {
  glass:
    "border border-border bg-gradient-to-b from-surface-strong to-surface backdrop-blur-xl shadow-card-soft",
  solid: "border border-border-soft bg-background-app-panel",
  outline: "border border-border-soft bg-transparent",
};

export default function Card({
  variant = "glass",
  interactive = false,
  className = "",
  children,
  ...props
}) {
  return (
    <div
      className={classNames(
        "rounded-card",
        VARIANTS[variant],
        interactive &&
          "transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-elevated hover:shadow-glow-cyan",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
