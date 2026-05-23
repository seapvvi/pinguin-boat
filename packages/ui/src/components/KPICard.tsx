'use client';
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down';
    value: string;
  };
  className?: string;
}

export function KPICard({ icon, label, value, trend, className }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius)] p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[var(--text-secondary)]">{icon}</span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' ? 'text-[var(--success)]' : 'text-[var(--error)]',
            )}
          >
            {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
      </div>
      <span className="block text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-1">
        {value}
      </span>
      <span className="block text-xs text-[var(--text-secondary)]">{label}</span>
    </motion.div>
  );
}
