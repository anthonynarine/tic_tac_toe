// # Filename: src/layout/PublicAuthLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function PublicAuthLayout() {
  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center px-4 py-12 bg-background-app overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-radial-cyan-glow opacity-70" />
      <Outlet />
    </div>
  );
}
