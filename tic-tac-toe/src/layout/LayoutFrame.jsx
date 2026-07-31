// # Filename: src/layout/LayoutFrame.jsx
import React from "react";
import { useUI } from "../context/uiContext";

export default function LayoutFrame({
  header,
  sidebar,
  children,
  overlay,
  contentMaxWidth = "max-w-[1120px]",
  contentClassName = "",
  fullBleed = false,
}) {
  const hasSidebar = Boolean(sidebar);
  const { isSidebarCollapsed } = useUI() || {};
  const sidebarWidth = isSidebarCollapsed ? "72px" : "280px";

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background-app md:flex md:items-center md:justify-center md:py-10" style={{ "--sidebar-w": sidebarWidth }}>
      <div className="w-full flex flex-col h-[100dvh] md:h-[calc(100dvh-5rem)] md:max-h-[calc(100dvh-5rem)] md:max-w-[1440px] md:rounded-panel overflow-hidden bg-background-app-panel md:border md:border-border md:shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
        {header && <div className="shrink-0">{header}</div>}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {hasSidebar && (
            <aside className="relative shrink-0 w-0 transition-[width] duration-200 lg:w-[var(--sidebar-w)] border-r border-border-soft">
              {sidebar}
            </aside>
          )}

          <main className="flex-1 relative min-h-0 overflow-hidden bg-background-app-panel">
            {hasSidebar && (
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 lg:block bg-gradient-to-r from-black/30 to-transparent" />
            )}
            <div
              className={[
                "h-full min-h-0 overflow-y-auto lol-scrollbar px-2.5 sm:px-5 md:px-8",
                "py-4 sm:py-6 md:py-10",
                "pb-[calc(92px+env(safe-area-inset-bottom))] lg:pb-[calc(24px+env(safe-area-inset-bottom))]",
                fullBleed ? "" : "flex justify-center",
                contentClassName,
              ].join(" ")}
            >
              <div className={fullBleed ? "w-full" : `w-full ${contentMaxWidth}`}>
                {children}
              </div>
            </div>
            {overlay}
          </main>
        </div>
      </div>
    </div>
  );
}
