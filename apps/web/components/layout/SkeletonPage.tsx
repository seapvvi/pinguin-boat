import { Skeleton } from '@pinguin/ui';
import { ModuleGrid } from './ModuleGrid';

// Squelette générique qui imite 2 colonnes de modules
// Utilisé sur toutes les pages pendant le chargement initial
export function SkeletonPage({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header skeleton */}
      <div className="flex justify-between items-center pb-5 border-b border-[var(--border-color)]">
        <div className="flex flex-col gap-2">
          <Skeleton variant="heading" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <Skeleton variant="button" />

      </div>
      {/* Modules skeleton en grille 2 colonnes */}
      {Array.from({ length: rows }).map((_, i) => (
        <ModuleGrid key={i}>
          <Skeleton variant="card" className="h-44" />
          <Skeleton variant="card" className="h-44" />
        </ModuleGrid>
      ))}
    </div>
  );
}



