'use client';

import { SkeletonPage } from '@/components/layout/SkeletonPage';

export function SkeletonForModules({ moduleCount }: { moduleCount: number }) {
  const rows = moduleCount > 4 ? 3 : moduleCount <= 2 ? 1 : 2;
  return <SkeletonPage rows={rows} />;
}

