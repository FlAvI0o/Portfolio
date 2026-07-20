import React from 'react';

interface CornerButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  'aria-label'?: string;
}

export const CornerButton: React.FC<CornerButtonProps> = ({
  onClick,
  children,
  className = '',
  type = 'button',
  disabled = false,
  'aria-label': ariaLabel,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`relative group cursor-pointer px-6 py-3.5 bg-transparent flex items-center justify-center transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {/* Corner brackets — expand outwards on hover */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-df-obsidian/40 transition-all duration-300 group-hover:-translate-x-1.5 group-hover:-translate-y-1.5 group-hover:border-df-obsidian/90 group-disabled:group-hover:translate-x-0 group-disabled:group-hover:translate-y-0" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-df-obsidian/40 transition-all duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-1.5 group-hover:border-df-obsidian/90 group-disabled:group-hover:translate-x-0 group-disabled:group-hover:translate-y-0" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-df-obsidian/40 transition-all duration-300 group-hover:-translate-x-1.5 group-hover:translate-y-1.5 group-hover:border-df-obsidian/90 group-disabled:group-hover:translate-x-0 group-disabled:group-hover:translate-y-0" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-df-obsidian/40 transition-all duration-300 group-hover:translate-x-1.5 group-hover:translate-y-1.5 group-hover:border-df-obsidian/90 group-disabled:group-hover:translate-x-0 group-disabled:group-hover:translate-y-0" />

      {/* -mr cancels the phantom trailing letter-space so the label sits
        optically dead-center between the brackets */}
      <span className="relative z-10 -mr-[0.18em] font-mono text-sm uppercase tracking-[0.18em] text-df-obsidian/60 group-hover:text-df-obsidian transition-colors duration-300">
        {children}
      </span>

      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-none">
        <div
          className="absolute inset-0 z-20 skew-x-12 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out group-disabled:group-hover:translate-x-[-100%]"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(5, 4, 4, 0.15), transparent)',
          }}
        />
      </div>
    </button>
  );
};
