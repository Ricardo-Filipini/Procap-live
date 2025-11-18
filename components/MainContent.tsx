
import React, { useState, useMemo, useEffect } from 'react';
import { Theme, View, AppData, User, MainContentProps } from '../types';
import { VIEWS } from '../constants';
import { Header } from './shared/Header';
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from './Icons';

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
import { CaseStudyView } from './views/CaseStudyView';
import { CronogramaView } from './views/CronogramaView';
import { LinksFilesView } from './views/LinksFilesView';
import { ContagemView } from './views/ContagemView';


export const MainContent: React.FC<MainContentProps> = (props) => {
  const { activeView, setActiveView, appData, theme, setTheme, onToggleLiveAgent, isLiveAgentActive, onToggleAgentSettings, navTarget, setNavTarget, setScreenContext, liveAgentStatus, processingTasks, setProcessingTasks } = props;

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
  
   // Auto-dismiss successful processing tasks
  useEffect(() => {
    const successTasks = processingTasks.filter(t => t.status === 'success');
    if (successTasks.length > 0) {
        const timer = setTimeout(() => {
            setProcessingTasks(prev => prev.filter(t => !successTasks.find(st => st.id === t.id)));
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [processingTasks, setProcessingTasks]);


  const renderContent = () => {
    const currentNavTarget = (navTarget && navTarget.viewName === activeView.name) ? navTarget : null;
    const clearNavTarget = () => setNavTarget ? setNavTarget(null) : undefined;

    const viewProps = {
      ...props,
      navTarget: currentNavTarget,
      clearNavTarget: clearNavTarget,
      setScreenContext: setScreenContext,
    };

    switch (activeView.name) {
      case 'Contagem':
        return <ContagemView {...viewProps} />;
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
          <div className="fixed bottom-24 right-4 z-[60] flex flex-col items-end gap-2 w-80">
            {processingTasks.map(task => (
              <div key={task.id} className="w-full bg-card-light dark:bg-card-dark p-3 rounded-lg shadow-lg border border-border-light dark:border-border-dark animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {task.status === 'processing' && <svg className="animate-spin h-5 w-5 text-primary-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {task.status === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                    {task.status === 'error' && <XCircleIcon className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" title={task.name}>{task.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{task.message}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {task.status === 'error' && (
                      <button onClick={() => setProcessingTasks(prev => prev.filter(t => t.id !== task.id))} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      </div>
  );
};
