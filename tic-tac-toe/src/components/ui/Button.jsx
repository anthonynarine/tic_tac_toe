// # Filename: src/components/ui/Button.jsx
import React from "react";
import classNames from "classnames";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-button font-medium tracking-tight transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:pointer-events-none disabled:opacity-50";

const VARIANTS = {
  primary: "bg-brand-cyan text-background-app shadow-glow-cyan hover:bg-brand-cyan-300",
  secondary:
    "border border-border bg-surface-elevated text-text-primary shadow-card-soft hover:border-border-strong hover:bg-surface-strong",
  ghost: "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
  outline:
    "border border-border-soft bg-transparent text-text-primary hover:border-border-strong hover:bg-surface",
  danger: "bg-brand-rose text-background-app shadow-glow-rose hover:bg-brand-rose-300",
};

const SIZES = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  as: Component = "button",
  ...props
}) {
  return (
    <Component
      className={classNames(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
