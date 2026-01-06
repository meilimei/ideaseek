import DraftPrefill from './_components/DraftPrefill';
import { DraftProvider } from './_draft/context';

export default function StrategyWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DraftProvider>
      <DraftPrefill>{children}</DraftPrefill>
    </DraftProvider>
  );
}
