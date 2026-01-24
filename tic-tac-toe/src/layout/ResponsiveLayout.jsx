// # Filename: src/components/layout/ResponsiveLayout.jsx
// ✅ New Code

import React from "react";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/messaging/DMDrawer/DMDrawer";
import useIsDesktop from "../components/hooks/ui/useIsDesktop";
import { useUI } from "../components/context/uiContext";
import { useUserContext } from "../components/context/userContext";
import MainRoutes from "../routes/MainRoutes";

const ResponsiveLayout = () => {
  const isDesktop = useIsDesktop();
  const { isSidebarOpen, isDMOpen, setDMOpen } = useUI();
  const { isLoggedIn } = useUserContext();

  if (isDesktop) {
    return (
      <div className="frame-body relative">
        {isLoggedIn && <FriendsSidebar />}

        {/* ✅ DO NOT pad the main content anymore */}
        <div className="main-content">
          <MainRoutes />
        </div>

        {/* ✅ Drawer anchored to frame-body top-right */}
        {isLoggedIn && (
          <DMDrawer
            isOpen={isDMOpen}
            onClose={() => setDMOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="frame-body relative">
      {isSidebarOpen && isLoggedIn ? (
        <div className="friends-sidebar-wrapper">
          <FriendsSidebar />
        </div>
      ) : (
        <>
          <div className="main-content">
            <MainRoutes />
          </div>

          {isLoggedIn && (
            <DMDrawer
              isOpen={isDMOpen}
              onClose={() => setDMOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ResponsiveLayout;
