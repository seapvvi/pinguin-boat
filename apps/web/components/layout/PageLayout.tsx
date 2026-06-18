'use client';
import React from 'react';
import { motion } from 'motion/react';
import { pageVariants, pageVariantsReduced } from '@/lib/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  const reduced = useReducedMotion();
  const variants = reduced ? pageVariantsReduced : pageVariants;

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className="w-full">
      <div className="flex justify-between items-start pb-5 border-b border-[var(--border-color)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-6 flex flex-col gap-6">{children}</div>

    </motion.div>
  );
}
