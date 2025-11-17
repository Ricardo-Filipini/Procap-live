

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Theme, View, AppData, User, MainContentProps, Source } from '../types';
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
// Fix: Correctly import CaseStudyView from its new file.
import { CaseStudyView } from './views/CaseStudyView';
import { CronogramaView } from './views/CronogramaView';
import { LinksFilesView } from './views/LinksFilesView';
import { ContagemView } from './views/ContagemView';

import { getSummaries, getSourcesBase, getFlashcards, getMindMaps, getAudioSummaries, getLinksFiles, getCaseStudiesData, getScheduleEvents, getUserMoods, getQuestions, getQuestionNotebooks, getUserQuestionAnswers, getUserNotebookInteractions } from '../services/supabaseClient';


export const MainContent: React.FC<MainContentProps> = (props) => {
  const { activeView, setActiveView, appData, setAppData, currentUser, theme, setTheme, onToggleLiveAgent, isLiveAgentActive, onToggleAgentSettings, navTarget, setNavTarget, setScreenContext, liveAgentStatus, processingTasks, setProcessingTasks } = props;

  useEffect(() => {
    const successTasks = processingTasks.filter(t => t.status === 'success');
    if (successTasks.length > 0) {
        const timer = setTimeout(() => {
            setProcessingTasks(prev => prev.filter(t => !successTasks.find(st => st.id === t.id)));
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [processingTasks, setProcessingTasks]);

    // Idle pre-fetching logic
    const idleTimerRef = useRef<number | null>(null);
    const prefetchedViewsRef = useRef(new Set<string>());

    useEffect(() => {
        const IDLE_TIMEOUT = 8000; // 8 seconds of inactivity

        // Helper function for merging
        const mergeSourcesWithContent = (prev: AppData, newSources: Source[], newContent: any[], contentType: 'summaries' | 'flashcards' | 'questions' | 'mind_maps' | 'audio_summaries'): AppData => {
            const contentBySource = new Map<string, any[]>();
            newContent.forEach(item => {
                const list = contentBySource.get(item.source_id) || [];
                list.push(item);
                contentBySource.set(item.source_id, list);
            });

            const sourceMap = new Map(prev.sources.map(s => [s.id, JSON.parse(JSON.stringify(s))]));
            newSources.forEach(source => {
                if (!sourceMap.has(source.id)) {
                    sourceMap.set(source.id, { ...source, summaries: [], flashcards: [], questions: [], mind_maps: [], audio_summaries: [] });
                }
            });

            sourceMap.forEach(source => {
                const contentForSource = contentBySource.get(source.id);
                if (contentForSource) {
                    (source[contentType] as any[]) = contentForSource;
                } else if (!source[contentType]) {
                    (source[contentType] as any[]) = [];
                }
            });
            
            return { ...prev, sources: Array.from(sourceMap.values()) };
        };


        const prefetchData = async () => {
            console.log("User is idle, starting pre-fetch...");

            const viewsToPrefetch = VIEWS.filter(v => v.name !== activeView.name && !prefetchedViewsRef.current.has(v.name));

            for (const view of viewsToPrefetch) {
                if (prefetchedViewsRef.current.has(view.name)) continue;
                
                let dataFetched = false;
                
                try {
                    switch (view.name) {
                        case 'Resumos':
                            if (!appData.sources.some(s => s.summaries?.length > 0)) {
                                const [sources, summaries] = await Promise.all([getSourcesBase(), getSummaries()]);
                                setAppData(prev => mergeSourcesWithContent(prev, sources, summaries, 'summaries'));
                                dataFetched = true;
                            }
                            break;
                        case 'Flashcards':
                             if (!appData.sources.some(s => s.flashcards?.length > 0)) {
                                const [sources, flashcards] = await Promise.all([getSourcesBase(), getFlashcards()]);
                                setAppData(prev => mergeSourcesWithContent(prev, sources, flashcards, 'flashcards'));
                                dataFetched = true;
                            }
                            break;
                        case 'Mapas Mentais':
                            if (!appData.sources.some(s => s.mind_maps?.length > 0)) {
                                const [sources, mindMaps] = await Promise.all([getSourcesBase(), getMindMaps()]);
                                setAppData(prev => mergeSourcesWithContent(prev, sources, mindMaps, 'mind_maps'));
                                dataFetched = true;
                            }
                            break;
                         case 'Mídia':
                            if (!appData.sources.some(s => s.audio_summaries?.length > 0)) {
                                const [sources, audioSummaries] = await Promise.all([getSourcesBase(), getAudioSummaries()]);
                                setAppData(prev => mergeSourcesWithContent(prev, sources, audioSummaries, 'audio_summaries'));
                                dataFetched = true;
                            }
                            break;
                        case 'Questões':
                             if (!appData.sources.some(s => s.questions?.length > 0) || appData.questionNotebooks.length === 0) {
                                const [notebooks, questions, sources] = await Promise.all([getQuestionNotebooks(), getQuestions(), getSourcesBase()]);
                                setAppData(prev => {
                                    const withNotebooks = { ...prev, questionNotebooks: notebooks };
                                    return mergeSourcesWithContent(withNotebooks, sources, questions, 'questions');
                                });
                                dataFetched = true;
                            }
                            break;
                        case 'Links/Arquivos':
                            if (appData.linksFiles.length === 0) {
                                const linksFiles = await getLinksFiles();
                                setAppData(prev => ({ ...prev, linksFiles }));
                                dataFetched = true;
                            }
                            break;
                        case 'Estudo de Caso':
                            if (appData.caseStudies.length === 0) {
// FIX: The `getCaseStudiesData` function can return an error object. Added a check to ensure we only process data if the call was successful.
                                const caseStudiesData = await getCaseStudiesData();
                                if (!('error' in caseStudiesData)) {
                                    setAppData(prev => ({...prev, caseStudies: caseStudiesData.caseStudies, userCaseStudyInteractions: caseStudiesData.userCaseStudyInteractions}));
                                }
                                dataFetched = true;
                            }
                            break;
                         case 'Cronograma':
                            if (appData.scheduleEvents.length === 0) {
                                const scheduleEvents = await getScheduleEvents();
                                setAppData(prev => ({ ...prev, scheduleEvents }));
                                dataFetched = true;
                            }
                            break;
                        case 'Contagem':
                             if (appData.userMoods.length === 0) {
                                const userMoods = await getUserMoods();
                                setAppData(prev => ({...prev, userMoods}));
                                dataFetched = true;
                            }
                            break;

                    }

                    if (dataFetched) {
                         console.log(`Successfully prefetched data for ${view.name}`);
                         prefetchedViewsRef.current.add(view.name);
                    } else {
                        prefetchedViewsRef.current.add(view.name);
                    }
                } catch (e) {
                    console.error(`Failed to prefetch data for ${view.name}`, e);
                }
            }
        };

        const resetIdleTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(prefetchData, IDLE_TIMEOUT);
        };

        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keydown', resetIdleTimer, { passive: true });
        window.addEventListener('scroll', resetIdleTimer, { passive: true });
        resetIdleTimer();

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            window.removeEventListener('mousemove', resetIdleTimer);
            window.removeEventListener('keydown', resetIdleTimer);
            window.removeEventListener('scroll', resetIdleTimer);
        };
    }, [activeView.name, appData, setAppData]);


  const handleNavigation = (viewName: string, term: string, id?: string) => {
    const targetView = VIEWS.find(v => v.name === viewName);
    if (targetView && setNavTarget) {
      setNavTarget({ viewName, term, id });
      setActiveView(targetView);
    }
  };

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
        return <SummariesView {...viewProps} />;
      case 'Flashcards':
        return <FlashcardsView {...viewProps} />;
      case 'Questões':
        return <QuestionsView {...viewProps} />;
      case 'Links/Arquivos':
        return <LinksFilesView {...viewProps} />;
      case 'Mapas Mentais':
          return <MindMapsView {...viewProps} />;
      case 'Mídia':
          return <AudioSummariesView {...viewProps} />;
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