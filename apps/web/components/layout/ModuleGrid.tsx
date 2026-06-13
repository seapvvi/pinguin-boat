import React from 'react';

interface ModuleGridProps {
  children: React.ReactNode;
}

export function ModuleGrid({ children }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
      {children}
    </div>
  );
}
