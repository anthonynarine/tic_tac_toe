// # Filename: src/components/friends/AddFriendPanel.jsx

import React, { useCallback, useMemo, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";
import AddFriendForm from "./AddFriendForm";

export default function AddFriendPanel({ defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  const bodyClassName = useMemo(() => {
    const base = "transition-all duration-300 ease-out will-change-[max-height,opacity]";
    return isOpen
      ? `${base} max-h-[180px] opacity-100 mt-3`
      : `${base} max-h-0 opacity-0 mt-0 pointer-events-none`;
  }, [isOpen]);

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="add-friend-panel-body"
      >
        <h3 className="text-sm font-medium tracking-wide text-[#1DA1F2] truncate">
          Add Friend
        </h3>

        <span
          className="
            h-9 w-9 grid place-items-center
            rounded-lg hover:bg-[#1DA1F2]/10
            text-[#1DA1F2]/90 hover:text-[#1DA1F2]
            focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/40
          "
          aria-hidden="true"
        >
          {isOpen ? <CiCircleChevUp size={26} /> : <CiCircleChevDown size={26} />}
        </span>
      </button>

      <div id="add-friend-panel-body" className={bodyClassName}>
        {/* ✅ New Code: hide internal label to avoid double header text */}
        <AddFriendForm showLabel={false} />
      </div>
    </section>
  );
}
