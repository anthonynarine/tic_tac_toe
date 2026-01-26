// # Filename: src/components/home/FooterTicker.jsx
// ✅ New Code

import React, { useEffect, useMemo, useState } from "react";

const FooterTicker = ({ items = [] }) => {
  const safeItems = useMemo(() => items.filter(Boolean), [items]);
  const [index, setIndex] = useState(0);

  // Step 1: Rotate the message
  useEffect(() => {
    if (safeItems.length <= 1) return;

    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, 5500);

    return () => clearInterval(id);
  }, [safeItems.length]);

  const current = safeItems[index] || "";

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-40
        border-t border-[#1DA1F2]/15
        bg-black/70 backdrop-blur
        shadow-[0_-10px_30px_rgba(29,161,242,0.08)]
      "
    >
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#1DA1F2] font-semibold shrink-0">Next up:</span>

          {/* Step 2: Smooth fade between items */}
          <span
            key={current}
            className="
              text-slate-200/80
              animate-[fadeIn_300ms_ease-in]
              truncate
            "
            title={current}
          >
            {current}
          </span>
        </div>
      </div>

      {/* ✅ New Code: local keyframes without touching global CSS */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default FooterTicker;
