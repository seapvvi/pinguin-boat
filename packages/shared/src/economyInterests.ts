export function calculateBankInterest(bank: number, interestRate: number): number {
  if (!Number.isFinite(bank) || bank <= 0) return 0;
  if (!Number.isFinite(interestRate) || interestRate <= 0) return 0;

  const interest = bank * (interestRate / 100);
  if (!Number.isFinite(interest)) return 0;
  return Math.floor(interest);
}

