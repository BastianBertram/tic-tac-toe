import { useState } from 'react';
import type { SalesAnfrage, SalesStatus, Angebot } from '../../types';
import { SalesBottomNav, type SalesTab } from './SalesBottomNav';
import { SalesHomeScreen } from './SalesHomeScreen';
import { SalesPipelineScreen } from './SalesPipelineScreen';
import { SalesKundenScreen } from './SalesKundenScreen';
import { SalesStatistikScreen } from './SalesStatistikScreen';
import { SalesAnfrageDetailScreen } from './SalesAnfrageDetailScreen';
import { SalesNewAnfrageScreen } from './SalesNewAnfrageScreen';
import { SalesAngeboteScreen } from './SalesAngeboteScreen';
import { AngebotEditorScreen, type AngebotVorlage } from './AngebotEditorScreen';
import { AngebotDetailScreen } from './AngebotDetailScreen';
import s from '../../App.module.css';

type Editor = { open: false } | { open: true; angebotId: string | null; vorlage?: AngebotVorlage };

export function SalesApp() {
  const [tab, setTab]               = useState<SalesTab>('home');
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<SalesStatus | 'alle' | 'wiedervorlage'>('alle');
  const [angebotDetailId, setAngebotDetailId] = useState<string | null>(null);
  const [editor, setEditor]         = useState<Editor>({ open: false });

  function openDetail(a: SalesAnfrage) { setDetailId(a.id); }
  function openAngebot(a: Angebot) { setAngebotDetailId(a.id); }
  function goPipeline(filter: SalesStatus | 'alle' | 'wiedervorlage') {
    setPipelineFilter(filter);
    setTab('pipeline');
  }
  function fabClick() {
    if (tab === 'angebote') setEditor({ open: true, angebotId: null });
    else setShowNew(true);
  }

  // Angebot anlegen/bearbeiten (über allem)
  if (editor.open) {
    return (
      <div className={s.app}>
        <AngebotEditorScreen
          angebotId={editor.angebotId}
          vorlage={editor.vorlage}
          onClose={() => setEditor({ open: false })}
          onSaved={(id) => { setEditor({ open: false }); setAngebotDetailId(id); setTab('angebote'); }}
        />
      </div>
    );
  }

  if (angebotDetailId) {
    return (
      <div className={s.app}>
        <AngebotDetailScreen
          angebotId={angebotDetailId}
          onClose={() => setAngebotDetailId(null)}
          onEdit={(id) => { setAngebotDetailId(null); setEditor({ open: true, angebotId: id }); }}
        />
      </div>
    );
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
        <SalesAnfrageDetailScreen
          anfrageId={detailId}
          onClose={() => setDetailId(null)}
          onAngebotErstellen={(vorlage) => { setDetailId(null); setEditor({ open: true, angebotId: null, vorlage }); }}
          onAngebotOeffnen={(id) => { setDetailId(null); setAngebotDetailId(id); }}
        />
      </div>
    );
  }

  return (
    <div className={s.app}>
      <div className={s.content}>
        {tab === 'home'      && <SalesHomeScreen      onKachelClick={goPipeline} />}
        {tab === 'pipeline'  && <SalesPipelineScreen  initialFilter={pipelineFilter} onOpen={openDetail} />}
        {tab === 'angebote'  && <SalesAngeboteScreen  onOpen={openAngebot} />}
        {tab === 'kunden'    && <SalesKundenScreen    onOpen={openDetail} />}
        {tab === 'statistik' && <SalesStatistikScreen />}
      </div>
      <SalesBottomNav active={tab} onTab={setTab} onNew={fabClick} />
    </div>
  );
}
