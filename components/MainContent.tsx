import React, { useState, useMemo } from 'react';
import { Theme, View, AppData, User, MainContentProps } from '../types';
import { VIEWS } from '../constants';
import { Header } from './shared/Header';

// Importando as novas views modularizadas
import { AdminView } from './views/AdminView';
import { SummariesView } from './views/SummariesView';
import { FlashcardsView } from './views/FlashcardsView';
import { QuestionsView } from './views/QuestionsView';
import { MindMapsView } from './views/MindMapsView';
import { AudioSummariesView } from './views/AudioSummariesView';
import { CommunityView } from './views/CommunityView';
import { ProfileView } from './views/ProfileView';
import { SourcesView } from './views/SourcesView';
// Fix: Correctly import CaseStudyView from its new file.
import { CaseStudyView } from './views/CaseStudyView';
import { CronogramaView } from './views/CronogramaView';
import { LinksFilesView } from './views/LinksFilesView';

export const MainContent: React.FC<MainContentProps> = (props) => {
  const { activeView, setActiveView, appData, theme, setTheme, onToggleLiveAgent, isLiveAgentActive, onToggleAgentSettings, navTarget, setNavTarget, setScreenContext, liveAgentStatus } = props;

  const handleNavigation = (viewName: string, term: string, id?: string) => {
    const targetView = VIEWS.find(v => v.name === viewName);
    if (targetView && setNavTarget) {
      setNavTarget({ viewName, term, id });
      setActiveView(targetView);
    }
  };

  const allSummaries = useMemo(() => appData.sources.flatMap(s => (s.summaries || []).map(summary => ({ ...summary, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
  const allFlashcards = useMemo(() => appData.sources.flatMap(s => (s.flashcards || []).map(fc => ({ ...fc, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
  const allQuestions = useMemo(() => appData.sources.flatMap(s => (s.questions || []).map(q => ({ ...q, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
  const allMindMaps = useMemo(() => appData.sources.flatMap(s => (s.mind_maps || []).map(mm => ({ ...mm, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
  const allAudioSummaries = useMemo(() => appData.sources.flatMap(s => (s.audio_summaries || []).map(as => ({ ...as, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
  const allLinksFiles = useMemo(() => appData.linksFiles.map(lf => ({...lf, user_id: lf.user_id, created_at: lf.created_at})), [appData.linksFiles]);

  const renderContent = () => {
    // Fix: Pass the full navTarget object if the view name matches to maintain type consistency. The child component can then destructure what it needs.
    const currentNavTarget = (navTarget && navTarget.viewName === activeView.name) ? navTarget : null;
    const clearNavTarget = () => setNavTarget ? setNavTarget(null) : undefined;

    const viewProps = {
      ...props,
      navTarget: currentNavTarget,
      clearNavTarget: clearNavTarget,
      setScreenContext: setScreenContext,
    };

    switch (activeView.name) {
      case 'Resumos':
        return <SummariesView {...viewProps} allItems={allSummaries} />;
      case 'Flashcards':
        return <FlashcardsView {...viewProps} allItems={allFlashcards} />;
      case 'Questões':
        return <QuestionsView {...viewProps} allItems={allQuestions} />;
      case 'Links/Arquivos':
        return <LinksFilesView {...viewProps} allItems={allLinksFiles} />;
      case 'Mapas Mentais':
          return <MindMapsView {...viewProps} allItems={allMindMaps} />;
      case 'Mídia':
          return <AudioSummariesView {...viewProps} allItems={allAudioSummaries} />;
      case 'Estudo de Caso':
          return <CaseStudyView {...props} />;
      case 'Cronograma':
          return <CronogramaView {...props} />;
      case 'Comunidade':
          return <CommunityView {...props} onNavigate={handleNavigation}/>;
      case 'Perfil':
          return <ProfileView {...props} onNavigate={handleNavigation} />;
      case 'Admin':
          return <AdminView {...props} />;
      case 'Fontes':
          return <SourcesView {...props} />;
      default:
        return <div className="text-center mt-10">Selecione uma opção no menu.</div>;
    }
  };

  return (
      <div>
          <Header 
            title={activeView.name} 
            theme={theme} 
            setTheme={setTheme} 
            onToggleLiveAgent={onToggleLiveAgent!}
            isLiveAgentActive={isLiveAgentActive!}
            liveAgentStatus={liveAgentStatus!}
            onToggleAgentSettings={onToggleAgentSettings!}
          />
          {renderContent()}
      </div>
  );
};