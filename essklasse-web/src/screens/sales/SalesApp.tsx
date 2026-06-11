import { useState } from 'react';
import type { SalesAnfrage, SalesStatus } from '../../types';
import { SalesBottomNav, type SalesTab } from './SalesBottomNav';
import { SalesHomeScreen } from './SalesHomeScreen';
import { SalesPipelineScreen } from './SalesPipelineScreen';
import { SalesKundenScreen } from './SalesKundenScreen';
import { SalesStatistikScreen } from './SalesStatistikScreen';
import { SalesAnfrageDetailScreen } from './SalesAnfrageDetailScreen';
import { SalesNewAnfrageScreen } from './SalesNewAnfrageScreen';
import s from '../../App.module.css';

export function SalesApp() {
  const [tab, setTab]               = useState<SalesTab>('home');
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<SalesStatus | 'alle' | 'wiedervorlage'>('alle');

  function openDetail(a: SalesAnfrage) { setDetailId(a.id); }
  function goPipeline(filter: SalesStatus | 'alle' | 'wiedervorlage') {
    setPipelineFilter(filter);
    setTab('pipeline');
  }

  if (showNew) {
    return (
      <div className={s.app}>
        <SalesNewAnfrageScreen
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); setDetailId(id); }}
        />
      </div>
    );
  }

  if (detailId) {
    return (
      <div className={s.app}>
        <SalesAnfrageDetailScreen anfrageId={detailId} onClose={() => setDetailId(null)} />
      </div>
    );
  }

  return (
    <div className={s.app}>
      <div className={s.content}>
        {tab === 'home'      && <SalesHomeScreen      onKachelClick={goPipeline} />}
        {tab === 'pipeline'  && <SalesPipelineScreen  initialFilter={pipelineFilter} onOpen={openDetail} />}
        {tab === 'kunden'    && <SalesKundenScreen    onOpen={openDetail} />}
        {tab === 'statistik' && <SalesStatistikScreen />}
      </div>
      <SalesBottomNav active={tab} onTab={setTab} onNew={() => setShowNew(true)} />
    </div>
  );
}
