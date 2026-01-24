import StrategyOpportunityCard from '../../_components/StrategyOpportunityCard';
import SummaryCard from '../_components/SummaryCard';
import StrategyStep1Client from './Step1Client';

export default function StrategyStep1Page({
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

  return <StrategyStep1Client rightSlot={rightSlot} />;
}
