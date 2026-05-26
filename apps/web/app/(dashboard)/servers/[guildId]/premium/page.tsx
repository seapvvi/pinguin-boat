'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function PremiumRedirect() {
  const router = useRouter();
  const { guildId } = useParams<{ guildId: string }>();
  useEffect(() => { router.replace(`/servers/${guildId}/soutien`); }, [guildId, router]);
  return null;
}
