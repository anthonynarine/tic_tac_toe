// hooks/useLayoutView.js

import { useUI } from "../context/uiContext";
import { useDirectMessage } from "../context/directMessageContext";
import useIsDesktop from "./useIsDesktop";
/**
 * useLayoutView
 *
 * Centralizes logic for determining which layout mode should be displayed
 * based on screen size and application state (sidebar open, active DM, etc).
 *
 * @returns {("desktop" | "sidebar" | "drawer" | "main")} layoutView
 *   - "desktop": Render full 3-column layout (sidebar + main + drawer)
 *   - "sidebar": Show only the sidebar (tablet/mobile)
 *   - "drawer": Show only the DM drawer (tablet/mobile)
 *   - "main": Fallback view (typically MainRoutes)
 */
export const useLayoutView = () => {
  const { isSidebarOpen } = useUI();
  const { activeChat } = useDirectMessage();
  const isDesktop = useIsDesktop();

  if (isDesktop) return "desktop";
  if (isSidebarOpen) return "sidebar";
  if (activeChat) return "drawer";
  return "main";
};
