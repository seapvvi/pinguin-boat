'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/servers/${guildId}/overview`);
  }, [guildId, router]);

  return null;
}
