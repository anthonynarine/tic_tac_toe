import { createContext, useContext, useReducer } from "react";
import {
  inviteReducer,
  INITIAL_INVITE_STATE,
  InviteActionTypes,
} from "../reducers/inviteReducer";

// Step 1: Create context
export const InviteContext = createContext(undefined);

// Step 2: Hook
export function useInviteContext() {
  const context = useContext(InviteContext);

  if (context === undefined) {
    throw new Error("useInviteContext must be used within an InviteProvider");
  }

  return context;
}

// Step 3: Provider
export const InviteProvider = ({ children }) => {
  const [state, dispatch] = useReducer(inviteReducer, INITIAL_INVITE_STATE);

  // Helpers so components don’t manually craft dispatch objects
  const upsertInvite = (invite) => {
    dispatch({ type: InviteActionTypes.INVITE_UPSERT, payload: invite });
  };

  const removeInvite = (inviteId) => {
    dispatch({ type: InviteActionTypes.INVITE_REMOVE, payload: { inviteId } });
  };

  const resetInvites = () => {
    dispatch({ type: InviteActionTypes.INVITES_RESET });
  };

  // Derived list for your panel (pending only)
  const pendingInvites = state.order
    .map((id) => state.byId[id])
    .filter(Boolean)
    .filter((inv) => String(inv.status || "pending").toLowerCase() === "pending");

  const contextValues = {
    state,
    dispatch,
    upsertInvite,
    removeInvite,
    resetInvites,
    pendingInvites,
  };

  return (
    <InviteContext.Provider value={contextValues}>
      {children}
    </InviteContext.Provider>
  );
};