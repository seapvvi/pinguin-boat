import OwnerPasswordGate from '@/components/OwnerPasswordGate';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <OwnerPasswordGate>{children}</OwnerPasswordGate>;
}
