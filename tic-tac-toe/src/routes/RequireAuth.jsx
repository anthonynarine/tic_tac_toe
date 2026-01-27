import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserContext } from "../components/context/userContext";

export default function RequireAuth({ children }) {
  const { isLoggedIn, authLoaded } = useUserContext();
  const location = useLocation();

  // # Step 1: Don’t redirect until auth check is complete
  if (!authLoaded) return null;

  // # Step 2: If not logged in, go login and remember where user wanted to go
  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
