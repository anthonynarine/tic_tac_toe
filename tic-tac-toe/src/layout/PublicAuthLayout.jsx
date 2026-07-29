// # Filename: src/layout/PublicAuthLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function PublicAuthLayout() {
  return (
    <div className="relative min-h-[100dvh] w-full flex items-start justify-center overflow-x-hidden overflow-y-auto bg-background-app px-3 py-6 sm:items-center sm:px-4 sm:py-12">
      <div className="absolute inset-0 -z-10 bg-radial-cyan-glow opacity-70" />
      <Outlet />
    </div>
  );
}
