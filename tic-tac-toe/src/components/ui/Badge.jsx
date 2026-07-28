// # Filename: src/components/ui/Badge.jsx
import React from "react";
import classNames from "classnames";

const VARIANTS = {
  brand: "border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan",
  ai: "border-brand-violet/25 bg-brand-violet/10 text-brand-violet",
  success: "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald",
  warning: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
  danger: "border-brand-rose/25 bg-brand-rose/10 text-brand-rose",
  neutral: "border-border-soft bg-surface-elevated text-text-secondary",
};

export default function Badge({ variant = "neutral", className = "", children, ...props }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-button border px-3 py-1 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
