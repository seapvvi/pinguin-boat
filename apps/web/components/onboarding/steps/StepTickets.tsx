'use client';
import { Input, Select, Toggle } from '@pinguin/ui';

interface StepTicketsProps {
  enabled: boolean;
  logChannelId: string | null;
  panelMessage: string;
  channels: { id: string; name: string }[];
  onEnabledChange: (enabled: boolean) => void;
  onLogChannelChange: (channelId: string) => void;
  onPanelMessageChange: (message: string) => void;
}

export function StepTickets({
  enabled,
  logChannelId,
  panelMessage,
  channels,
  onEnabledChange,
  onLogChannelChange,
  onPanelMessageChange,
}: StepTicketsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Permettez à vos membres d'ouvrir des tickets de support.
      </p>

      <Toggle
        checked={enabled}
        onChange={onEnabledChange}
        label="Activer les tickets"
      />

      <Select
        label="Salon de logs des tickets"
        value={logChannelId ?? ''}
        onChange={(e) => onLogChannelChange(e.target.value)}
        options={[
          { value: '', label: '— Sélectionner un salon —' },
          ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">
          Message d'ouverture du panel
        </label>
        <textarea
          value={panelMessage}
          onChange={(e) => onPanelMessageChange(e.target.value)}
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-24"
        />
      </div>
    </div>
  );
}
