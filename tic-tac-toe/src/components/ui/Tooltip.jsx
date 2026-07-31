import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}) {
  const triggerRef = useRef(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 10;
    const next = {
      top: rect.top + rect.height / 2,
      left: rect.left + rect.width / 2,
      transform: "translate(-50%, -100%)",
    };

    if (position === "right") {
      next.left = rect.right + gap;
      next.transform = "translate(0, -50%)";
    } else if (position === "left") {
      next.left = rect.left - gap;
      next.transform = "translate(-100%, -50%)";
    } else if (position === "bottom") {
      next.top = rect.bottom + gap;
      next.transform = "translate(-50%, 0)";
    } else {
      next.top = rect.top - gap;
    }

    setCoords(next);
  }, [position]);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!content) return children;

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[9999] max-w-52 whitespace-nowrap rounded-md border border-brand-cyan/25 bg-slate-950/95 px-2.5 py-1.5 text-[11px] font-medium text-text-primary shadow-[0_14px_36px_rgba(0,0,0,0.45)] backdrop-blur motion-safe:animate-[tooltipIn_140ms_ease-out]"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                transform: coords.transform,
              }}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </>
  );
}
