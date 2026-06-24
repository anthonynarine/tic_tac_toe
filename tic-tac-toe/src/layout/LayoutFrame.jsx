// # Filename: src/layout/LayoutFrame.jsx
import React from "react";

export default function LayoutFrame({
  header,
  sidebar,
  children,
  contentMaxWidth = "max-w-[1120px]",
  contentClassName = "",
  fullBleed = false,
}) {
  const hasSidebar = Boolean(sidebar);

  return (
    <div
      className={[
        // Step 1: iOS-safe height
        "min-h-[100dvh] w-full bg-black",
        // Step 2: desktop framing
        "md:flex md:justify-center md:items-start md:pt-6 md:pb-10 md:px-6",
      ].join(" ")}
    >
      <div
        className={[
          // Step 3: frame container
          "w-full md:max-w-[1400px] flex flex-col",
          // Step 4: Tron/HUD frame (TW only)
          "md:rounded-2xl md:overflow-hidden",
          "md:border md:border-[#1DA1F2]/10",
          "md:shadow-[0_0_18px_rgba(29,161,242,0.10),0_0_32px_rgba(29,161,242,0.06)]",
          "bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,1)_55%,rgba(14,26,43,0.75))]",
        ].join(" ")}
      >
        {header ? <div className="shrink-0">{header}</div> : null}

        <div className="flex-1 min-h-0 md:flex">
          {/* Sidebar: mounted always; only takes width on lg+ */}
          {hasSidebar ? (
            <aside
              className={[
                "relative shrink-0",
                "w-0 lg:w-[340px]",
                // Desktop dock styling
                "lg:bg-black",
                "lg:border-r lg:border-[#1DA1F2]/10",
                "lg:shadow-[inset_-12px_0_24px_rgba(0,0,0,0.45)]",
              ].join(" ")}
            >
              {sidebar}
            </aside>
          ) : null}

          <main
            className={[
              "flex-1 relative bg-black min-h-0",
              // Step 5: main background glow
              "bg-[radial-gradient(circle_at_50%_20%,rgba(29,161,242,0.14),rgba(0,0,0,0.92)_55%,rgba(0,0,0,1)_100%)]",
            ].join(" ")}
          >
            {/* Step 6: desktop-only vignette when sidebar is docked */}
            {hasSidebar ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-4 bg-gradient-to-r from-black/70 to-transparent lg:block" />
            ) : null}

            {/* Step 7: content wrapper + safe-area bottom padding (iOS) */}
            <div
              className={[
                "h-full min-h-0",
                "px-3 sm:px-4 md:px-6",
                "py-4 md:py-6",
                "pb-[calc(24px+env(safe-area-inset-bottom))]",
                fullBleed ? "" : "flex justify-center",
                contentClassName,
              ].join(" ")}
            >
              <div className={fullBleed ? "w-full" : `w-full ${contentMaxWidth}`}>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
