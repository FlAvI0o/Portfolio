import React from "react";

interface BrandButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary"; // Added for future flexibility
}

export function BrandButton({ children, onClick, className = "" }: BrandButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        px-10 py-5
        bg-df-dark text-white
        /* SHARP PRECISION: Small radius (md) for an architectural feel */
        rounded-md 
        font-mono font-bold text-[14px] uppercase tracking-[0.25em]
        transition-all duration-df-medium ease-df-heavy
        
        /* THE GALLERY CONTRAST: Hard edges, no soft glow on idle */
        border border-df-dark
        
        /* HOVER: The button 'wakes up' with a precision violet edge */
        hover:border-df-primary/50
        hover:shadow-[10px_10px_0px_0px_rgba(147,51,234,0.1)]
        hover:-translate-x-1 hover:-translate-y-1
        
        /* CLICK: Mechanical compression */
        active:translate-x-0 active:translate-y-0 active:scale-[0.98]
        ${className}
      `}
    >
      <span className="relative z-10 flex items-center gap-3">
        {children}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="square" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}