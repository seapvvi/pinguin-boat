'use client';
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

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
  const animatedValue = useCountUp(typeof value === 'number' ? value : 0, 700);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border-color)] p-6',
        className,
      )}
      style={{ borderRadius: 0 }}
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
        {typeof value === 'number' ? animatedValue.toLocaleString() : value}
      </span>
      <span className="block text-sm text-[var(--text-secondary)]">{label}</span>
    </motion.div>
  );
}
