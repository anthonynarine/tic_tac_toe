// # Filename: src/components/navbar/Navbar.jsx
// ✅ New Code

import React, { useCallback } from "react";
import { CiMenuFries } from "react-icons/ci";

import TrinityOverlay from "../trinity/TrinityOverlay";
import { useUI } from "../context/uiContext";

export default function Navbar() {
  const { isSidebarOpen, setSidebarOpen, setTrinityOpen } = useUI();

  // Step 1: Toggle sidebar (mobile/tablet)
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(!isSidebarOpen);
  }, [isSidebarOpen, setSidebarOpen]);

  // Step 2: Open Trinity drawer
  const handleOpenTrinity = useCallback(() => {
    setTrinityOpen(true);
  }, [setTrinityOpen]);

  return (
    <header
      className="
        sticky top-0 z-50
        bg-black/95 backdrop-blur
        border-b border-[#1DA1F2]/15
      "
    >
      <div className="relative h-[76px] sm:h-[80px] md:h-[84px]">
        <div className="h-full grid grid-cols-3 items-center px-3 md:px-4">
          {/* Left spacer keeps Trinity perfectly centered */}
          <div />

          {/* Center dock */}
          <div className="flex justify-center">
            <div className="flex items-end justify-center pt-1 pb-2">
              <TrinityOverlay onClick={handleOpenTrinity} />
            </div>
          </div>

          {/* Hamburger only on mobile/tablet */}
          <div className="flex justify-end lg:hidden">
            <button
              type="button"
              onClick={handleToggleSidebar}
              className="
                h-10 w-10 grid place-items-center rounded-lg
                text-[#1DA1F2]/80 hover:text-[#1DA1F2]
                hover:bg-[#1DA1F2]/10
                focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35
              "
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
              title={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              <CiMenuFries size={26} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
