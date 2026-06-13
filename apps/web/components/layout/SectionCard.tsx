'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  accent?: string;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  icon,
  headerAction,
  expandable = false,
  defaultExpanded = true,
  accent,
  children,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius-sm)] overflow-hidden"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
            {description && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {headerAction}
          {expandable && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
              style={{ borderRadius: 0 }}
            >
              <ChevronDown
                size={16}
                className="transition-transform duration-200"
                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {(!expandable || expanded) && (
          <motion.div
            key="content"
            initial={expandable ? { opacity: 0, height: 0 } : undefined}
            animate={expandable ? { opacity: 1, height: 'auto' } : undefined}
            exit={expandable ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
            className="px-5 py-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
