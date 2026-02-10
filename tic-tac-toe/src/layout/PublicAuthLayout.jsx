// # Filename: src/layout/PublicAuthLayout.jsx
// ✅ New Code

import React from "react";
import { Outlet } from "react-router-dom";


import LayoutFrame from "./LayoutFrame";

export default function PublicAuthLayout() {
  return (
    <LayoutFrame header={null} sidebar={null}>
      <Outlet />
    </LayoutFrame>
  );
}
