import React from 'react';
import { motion } from 'motion/react';
import { containerVariants } from '@/lib/motion';

interface ModuleGridProps {
  children: React.ReactNode;
}

export function ModuleGrid({ children }: ModuleGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={[
        'grid-cols-1',
        'lg:grid-cols-2',
        'gap-5',
        'w-full',
        'items-start',
      ].join(' ')}
>
      {children}
    </motion.div>
  );
}

