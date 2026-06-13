'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { itemVariants } from '@/lib/motion';
import { Toggle } from '@pinguin/ui';

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

  // Détection si le headerAction contient un Toggle qui vient de passer à ON
  const [justEnabled, setJustEnabled] = useState(false);

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      setJustEnabled(true);
      setTimeout(() => setJustEnabled(false), 2000);
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)]"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {/* HEADER */}
      <motion.div
        whileHover={{ borderColor: 'var(--border-color-strong)' }}
        transition={{ duration: 0.15 }}
        className="flex justify-between items-center px-5 py-4 border-b border-[var(--border-color)]"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
          <div className="flex items-center gap-2">
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
              {description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
              )}
            </div>
            <AnimatePresence>
              {justEnabled && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                  className="text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-live)] text-white px-1.5 py-0.5"
                >
                  ON
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {headerAction && React.isValidElement<{ checked: boolean; onChange: (v: boolean) => void }>(headerAction) && headerAction.type === Toggle ? (
            React.cloneElement(headerAction, {
              onChange: (checked: boolean) => {
                handleToggleChange(checked);
                headerAction.props.onChange?.(checked);
              },
            })
          ) : (
            headerAction
          )}
          {expandable && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center justify-center w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
              style={{ borderRadius: 0 }}
            >
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <ChevronDown size={16} />
              </motion.div>
            </button>
          )}
        </div>
      </motion.div>

      {/* BODY */}
      {expandable ? (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 py-4">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="px-5 py-4">{children}</div>
      )}
    </motion.div>
  );
}

