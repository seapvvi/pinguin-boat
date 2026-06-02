'use client';
import { Input, Toggle } from '@pinguin/ui';

interface StepEconomyProps {
  enabled: boolean;
  currencyName: string;
  currencySymbol: string;
  onEnabledChange: (enabled: boolean) => void;
  onCurrencyNameChange: (name: string) => void;
  onCurrencySymbolChange: (symbol: string) => void;
}

export function StepEconomy({
  enabled,
  currencyName,
  currencySymbol,
  onEnabledChange,
  onCurrencyNameChange,
  onCurrencySymbolChange,
}: StepEconomyProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Donnez une monnaie virtuelle à vos membres.
      </p>

      <Toggle
        checked={enabled}
        onChange={onEnabledChange}
        label="Activer l'économie"
      />

      <Input
        label="Nom de la monnaie"
        value={currencyName}
        onChange={(e) => onCurrencyNameChange(e.target.value)}
        placeholder="pièces"
      />

      <Input
        label="Symbole"
        value={currencySymbol}
        onChange={(e) => onCurrencySymbolChange(e.target.value)}
        placeholder="🪙"
      />
    </div>
  );
}
