// # Filename: src/layout/LayoutFrame.jsx
// ✅ New Code

import React from "react";

export default function LayoutFrame({ sidebar, children }) {
  return (
    <div
      className={[
        // Step 1: outer page
        "min-h-screen bg-black",
        // Step 2: center on desktop, full-bleed on mobile
        "md:flex md:items-center md:justify-center",
        "md:p-6",
      ].join(" ")}
    >
      <div
        className={[
          // Step 3: app frame container
          "w-full md:max-w-[1400px]",
          "md:rounded-2xl md:overflow-hidden",
          // Step 4: subtle hairline (no boxy hard border)
          "md:border md:border-[#1DA1F2]/10",
          // Step 5: use a CSS utility for the glow (defined below)
          "md:tron-frame",
          // Step 6: structure
          "md:flex",
        ].join(" ")}
      >
        {/* Sidebar */}
        <aside
          className={[
            "hidden md:block",
            "w-[320px] lg:w-[340px]",
            "bg-black",
            // Step 7: divider should match accent, not grey
            "border-r border-[#1DA1F2]/10",
            // optional: subtle inner depth
            "shadow-[inset_-12px_0_24px_rgba(0,0,0,0.45)]",
          ].join(" ")}
        >
          {sidebar}
        </aside>

        {/* Main */}
        <main
          className={[
            "flex-1 min-h-screen md:min-h-[calc(100vh-3rem)]",
            "relative bg-black",
            // Step 8: radial “workspace glow”
            "bg-[radial-gradient(circle_at_50%_20%,rgba(29,161,242,0.14),rgba(0,0,0,0.92)_55%,rgba(0,0,0,1)_100%)]",
          ].join(" ")}
        >
          {/* Step 9: seam fade to reduce “two boxes glued” look */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/70 to-transparent" />

          {children}
        </main>
      </div>
    </div>
  );
}
