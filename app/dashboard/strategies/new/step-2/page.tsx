import StrategyOpportunityCard from '../../_components/StrategyOpportunityCard';
import SummaryCard from '../_components/SummaryCard';
import StrategyStep2Client from './Step2Client';

export default function StrategyStep2Page({
  searchParams,
}: {
  searchParams?: { mode?: string; strategyId?: string };
}) {
  const mode = searchParams?.mode ?? '';
  const strategyId = searchParams?.strategyId ?? '';
  const showPipeline = mode === 'edit' && Boolean(strategyId);
  const rightSlot = showPipeline ? (
    <div className="space-y-3">
      <SummaryCard />
      <StrategyOpportunityCard strategyId={strategyId} />
    </div>
  ) : (
    <SummaryCard />
  );

  return <StrategyStep2Client rightSlot={rightSlot} />;
}
