// # Filename: src/components/reducers/inviteReducer.js

export const INITIAL_INVITE_STATE = {
  byId: {},   // { [inviteId]: invite }
  order: [],  // newest first
};

export const InviteActionTypes = {
  INVITE_UPSERT: "INVITE_UPSERT",
  INVITE_REMOVE: "INVITE_REMOVE",
  INVITES_RESET: "INVITES_RESET",
};

export function inviteReducer(state, action) {
  switch (action.type) {
    case InviteActionTypes.INVITE_UPSERT: {
      const invite = action.payload;
      if (!invite?.inviteId) return state;

      const exists = Boolean(state.byId[invite.inviteId]);

      return {
        ...state,
        byId: {
          ...state.byId,
          [invite.inviteId]: invite,
        },
        order: exists ? state.order : [invite.inviteId, ...state.order],
      };
    }

    case InviteActionTypes.INVITE_REMOVE: {
      const { inviteId } = action.payload || {};
      if (!inviteId || !state.byId[inviteId]) return state;

      const { [inviteId]: _, ...rest } = state.byId;

      return {
        ...state,
        byId: rest,
        order: state.order.filter((id) => id !== inviteId),
      };
    }

    case InviteActionTypes.INVITES_RESET:
      return { ...INITIAL_INVITE_STATE };

    default:
      return state;
  }
}
