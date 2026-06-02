'use client';
import { Select, Toggle } from '@pinguin/ui';

interface StepWelcomeProps {
  enabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  channels: { id: string; name: string }[];
  onEnabledChange: (enabled: boolean) => void;
  onChannelChange: (channelId: string) => void;
  onMessageChange: (message: string) => void;
}

export function StepWelcome({
  enabled,
  welcomeChannelId,
  welcomeMessage,
  channels,
  onEnabledChange,
  onChannelChange,
  onMessageChange,
}: StepWelcomeProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Choisissez le salon et le message de bienvenue.
      </p>

      <Toggle
        checked={enabled}
        onChange={onEnabledChange}
        label="Activer le message de bienvenue"
      />

      <Select
        label="Salon de bienvenue"
        value={welcomeChannelId ?? ''}
        onChange={(e) => onChannelChange(e.target.value)}
        options={[
          { value: '', label: '— Sélectionner un salon —' },
          ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">
          Message de bienvenue
        </label>
        <textarea
          value={welcomeMessage ?? ''}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Bienvenue {user} sur {server} !"
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-24"
        />
      </div>
    </div>
  );
}
