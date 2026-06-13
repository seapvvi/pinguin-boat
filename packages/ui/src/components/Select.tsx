'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  id?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  className,
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (optValue: string) => {
    onChange?.({ target: { value: optValue } });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[11px] font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-1.5 block"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!open) setOpen(true);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className={cn(
            'w-full text-left text-sm text-[var(--text-primary)] border border-[var(--border-color)] transition-colors duration-150',
            'bg-[var(--bg-surface)]',
            'outline-none focus:outline-2 focus:outline-[var(--accent-primary)] focus:outline-offset-0',
            'flex items-center',
            error && 'border-[var(--error)]',
            className,
          )}
          style={{
            height: 'var(--input-height)',
            paddingLeft: 'var(--input-padding-x)',
            paddingRight: '2.25rem',
            borderRadius: 0,
          }}
        >
          <span className={cn(!selectedOption && !placeholder && 'text-[var(--text-secondary)]')}>
            {selectedOption ? selectedOption.label : placeholder || 'Sélectionner...'}
          </span>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 5L6 8L9 5"
              stroke="var(--text-secondary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && typeof document !== 'undefined' && createPortal(
          <div
            style={{
              ...dropdownStyle,
              maxHeight: 220,
              background: 'var(--bg-surface-alt)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              borderRadius: 0,
              overflowY: 'auto',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full text-left text-sm px-3 py-2 transition-colors duration-150 border-0',
                  opt.value === value
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
      {error && <span className="text-xs text-[var(--error)] mt-1">{error}</span>}
    </div>
  );
}
