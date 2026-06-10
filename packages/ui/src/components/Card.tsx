'use client';
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className, padding = true, hover = false, style }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius)]',
        padding && 'p-5',
        hover && 'transition-transform duration-200 ease-in-out hover:-translate-y-0.5',
        className,
      )}
      style={{ opacity: 1, willChange: 'transform', ...style }}
    >
      {children}
    </motion.div>
  );
}
