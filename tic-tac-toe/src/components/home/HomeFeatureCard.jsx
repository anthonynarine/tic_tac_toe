// # Filename: src/home/HomeFeatureCard.jsx
import React from "react";
import Card from "../ui/Card";

export default function HomeFeatureCard({ title, description, icon, badge, disabled, onClick }) {
  return (
    <Card
      variant="outline"
      className={`relative p-4 flex items-start gap-3 transition-all duration-200 [@media(min-width:768px)_and_(max-height:700px)]:p-3 ${
        disabled ? "opacity-45 cursor-default" : "cursor-pointer hover:border-border-strong hover:bg-surface"
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 rounded-lg bg-surface-elevated border border-border-soft">
        <span className="text-text-muted">{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {title}
          </span>
          {badge && (
            <span className="text-[9px] font-semibold tracking-widest uppercase shrink-0 text-text-faint">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5 leading-relaxed text-text-faint">
          {description}
        </p>
      </div>
    </Card>
  );
}
