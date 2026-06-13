import React from 'react';

interface ModuleGridProps {
  children: React.ReactNode;
}

export function ModuleGrid({ children }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {children}
    </div>
  );
}
