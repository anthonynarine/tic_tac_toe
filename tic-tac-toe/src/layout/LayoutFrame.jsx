// # Filename: src/layout/LayoutFrame.jsx
// ✅ New Code

import React from "react";

export default function LayoutFrame({ header, sidebar, children }) {
  const hasSidebar = Boolean(sidebar);

  return (
    <div
      className={[
        "min-h-screen bg-black",
        "md:flex md:justify-center md:items-start",
        "md:pt-6 md:pb-10 md:px-6",
      ].join(" ")}
    >
      <div
        className={[
          "w-full md:max-w-[1400px]",
          "md:rounded-2xl md:overflow-hidden",
          "md:border md:border-[#1DA1F2]/10",
          "md:tron-frame",
          "flex flex-col",
        ].join(" ")}
      >
        {header ? <div className="shrink-0">{header}</div> : null}

        <div className="flex-1 min-h-0 md:flex">
          {/* ✅ Only render sidebar column if we actually have one */}
          {hasSidebar ? (
            <aside
              className={[
                "hidden md:block",
                "w-[320px] lg:w-[340px]",
                "bg-black",
                "border-r border-[#1DA1F2]/10",
                "shadow-[inset_-12px_0_24px_rgba(0,0,0,0.45)]",
              ].join(" ")}
            >
              {sidebar}
            </aside>
          ) : null}

          <main
            className={[
              "flex-1 min-h-screen md:min-h-0",
              "relative bg-black",
              "bg-[radial-gradient(circle_at_50%_20%,rgba(29,161,242,0.14),rgba(0,0,0,0.92)_55%,rgba(0,0,0,1)_100%)]",
            ].join(" ")}
          >
            {/* ✅ Only render the left seam fade when a sidebar exists */}
            {hasSidebar ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/70 to-transparent" />
            ) : null}

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
