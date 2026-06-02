'use client';
import { Select } from '@pinguin/ui';

interface StepLogsProps {
  logChannelId: string | null;
  channels: { id: string; name: string }[];
  onChange: (logChannelId: string) => void;
}

export function StepLogs({ logChannelId, channels, onChange }: StepLogsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Choisissez le salon où seront envoyés les événements du serveur (arrivées, départs, modifications, etc.)
      </p>
      <Select
        label="Salon de logs"
        value={logChannelId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        options={[
          { value: '', label: '— Sélectionner un salon —' },
          ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
        ]}
      />
    </div>
  );
}
