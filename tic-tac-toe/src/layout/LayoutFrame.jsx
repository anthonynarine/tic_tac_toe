// # Filename: src/layout/LayoutFrame.jsx
// ✅ Updated: mount sidebar on mobile (so hamburger can control it) while keeping docked sidebar on lg+
// Step 1: Sidebar stays in-flow on desktop (no padding-left hacks).
// Step 2: Sidebar is STILL rendered on mobile, but takes no layout space (w-0) so the fixed drawer can work.
// Step 3: Main column centers route content via a consistent content wrapper.

import React from "react";

export default function LayoutFrame({
  header,
  sidebar,
  children,
  contentMaxWidth = "max-w-[1120px]", // tweak globally if you want (980/1040/1120)
  contentClassName = "", // per-page padding/spacing overrides
  fullBleed = false, // if true, route content spans full main width
}) {
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
          {hasSidebar ? (
            <aside
              className={[
                // ✅ New: ALWAYS mount the sidebar so the mobile fixed drawer can render
                // ✅ New: only allocate docked width on lg+ (matches FriendsSidebar lg:static)
                "relative shrink-0",
                "w-0 lg:w-[340px]",

                // Desktop-only dock styling
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
              // ✅ IMPORTANT: keep min-h-0 on desktop so children can flex/scroll properly
              "flex-1 relative bg-black",
              "min-h-screen md:min-h-0",
              "bg-[radial-gradient(circle_at_50%_20%,rgba(29,161,242,0.14),rgba(0,0,0,0.92)_55%,rgba(0,0,0,1)_100%)]",
            ].join(" ")}
          >
            {/* ✅ New: only show this desktop vignette when sidebar is docked */}
            {hasSidebar ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-4 bg-gradient-to-r from-black/70 to-transparent lg:block" />
            ) : null}

            {/* ✅ New: consistent content wrapper */}
            <div
              className={[
                // Step 1: consistent padding for all route content
                "h-full min-h-0",
                "px-3 sm:px-4 md:px-6",
                "py-4 md:py-6",
                // Step 2: center inside main column
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
