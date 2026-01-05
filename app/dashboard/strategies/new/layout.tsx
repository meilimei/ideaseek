import { DraftProvider } from './_draft/context';

export default function StrategyWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftProvider>{children}</DraftProvider>;
}
