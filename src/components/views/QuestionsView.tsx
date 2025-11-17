



import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainContentProps } from '../../types';
import { Question, Comment, QuestionNotebook, UserNotebookInteraction, UserQuestionAnswer, Source } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { checkAndAwardAchievements } from '../../lib/achievements';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { addQuestionNotebook, upsertUserVote, incrementNotebookVote, updateContentComments, updateUser as supabaseUpdateUser, upsertUserQuestionAnswer, clearNotebookAnswers, supabase, getQuestions, getSourcesBase, getQuestionNotebooks, getUserQuestionAnswers, getUserNotebookInteractions } from '../../services/supabaseClient';
import { NotebookDetailView, NotebookGridView } from './QuestionsViewPart2';

type SortOption = 'temp' | 'time' | 'subject' | 'user' | 'source';

interface QuestionsViewProps extends MainContentProps {
    clearNavTarget: () => void;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({ appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget, setScreenContext }) => {
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [selectedNotebook, setSelectedNotebook] = useState<QuestionNotebook | 'all' | null>(null);
    const [commentingOnNotebook, setCommentingOnNotebook] = useState<QuestionNotebook | null>(null);
    const [sort, setSort] = useState<SortOption>('temp');
    const [questionIdToFocus, setQuestionIdToFocus] = useState<string | null>(null);
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    const allItems = useMemo(() => appData.sources.flatMap(s => (s.questions || []).map(q => ({ ...q, source: s, user_id: s.user_id, created_at: s.created_at }))), [appData.sources]);
    
    const handleFocusConsumed = () => {
        setQuestionIdToFocus(null);
    };
    
    useEffect(() => {
        const needsData =
            !appData.sources.some(s => s.questions?.length > 0) ||
            appData.questionNotebooks.length === 0 ||
            appData.userQuestionAnswers.length === 0 ||
            appData.userNotebookInteractions.length === 0;

        if (needsData) {
            setIsLoadingContent(true);
            Promise.all([
                appData.questionNotebooks.length === 0 ? getQuestionNotebooks() : Promise.resolve(null),
                appData.userQuestionAnswers.length === 0 ? getUserQuestionAnswers(currentUser.id) : Promise.resolve(null),
                appData.userNotebookInteractions.length === 0 ? getUserNotebookInteractions(currentUser.id) : Promise.resolve(null),
                !appData.sources.some(s => s.questions?.length > 0) ? getQuestions() : Promise.resolve(null),
                !appData.sources.some(s => s.questions?.length > 0) ? getSourcesBase() : Promise.resolve(null),
            ]).then(([notebooks, answers, interactions, questions, sources]) => {
                setAppData(prev => {
                    const newState = { ...prev };
                    
                    if (notebooks) newState.questionNotebooks = notebooks;
                    if (answers) newState.userQuestionAnswers = answers;
                    if (interactions) newState.userNotebookInteractions = interactions;

                    if (questions && sources) {
                        const questionsBySource = new Map<string, Question[]>();
                        questions.forEach(q => {
                            const list = questionsBySource.get(q.source_id) || [];
                            list.push(q);
                            questionsBySource.set(q.source_id, list);
                        });

                        const newSources = [...prev.sources];
                        const sourceMap = new Map(newSources.map(s => [s.id, s]));

                        sources.forEach(source => {
                            if (!sourceMap.has(source.id)) {
                                sourceMap.set(source.id, source);
                            }
                        });

                        sourceMap.forEach(source => {
                            source.questions = questionsBySource.get(source.id) || source.questions || [];
                        });
                        
                        newState.sources = Array.from(sourceMap.values());
                    }
                    return newState;
                });
            }).catch(e => {
                console.error("Failed to load QuestionsView data", e);
            }).finally(() => {
                setIsLoadingContent(false);
            });
        }
    }, [appData, currentUser.id, setAppData]);
    
    // Restore from localStorage on initial mount
    useEffect(() => {
        if (appData.questionNotebooks.length > 0 && !restoredFromStorage && !navTarget) {
            const savedNotebookId = localStorage.getItem('procap_lastNotebookId');
            if (savedNotebookId) {
                const notebook = savedNotebookId === 'all' ? 'all' : appData.questionNotebooks.find(n => n.id === savedNotebookId);
                if (notebook) {
                    setSelectedNotebook(notebook);
                    setQuestionIdToFocus(localStorage.getItem('procap_lastQuestionId'));
                } else {
                    // Clean up invalid data from storage
                    localStorage.removeItem('procap_lastNotebookId');
                    localStorage.removeItem('procap_lastQuestionId');
                }
            }
            setRestoredFromStorage(true); // Ensure this runs only once
        }
    }, [appData.questionNotebooks, restoredFromStorage, navTarget]);

    // Handle explicit navigation from other views
    useEffect(() => {
        if (navTarget?.id) {
            const notebook = appData.questionNotebooks.find(n => n.id === navTarget.id);
            if (notebook) {
                setSelectedNotebook(notebook);
                setQuestionIdToFocus(navTarget.subId || null);
            } else {
                alert(`Caderno de questões com ID "${navTarget.id}" não encontrado.`);
            }
            clearNavTarget();
        } else if (navTarget?.term) {
            const notebook = appData.questionNotebooks.find(n => n.name.toLowerCase() === navTarget.term!.toLowerCase());
            if (notebook) {
                setSelectedNotebook(notebook);
                setQuestionIdToFocus(navTarget.subId || null);
            } else {
                alert(`Caderno de questões "${navTarget.term}" não encontrado.`);
            }
            clearNavTarget();
        }
    }, [navTarget, clearNavTarget, appData.questionNotebooks]);

    // Save current notebook to localStorage
    useEffect(() => {
        if (selectedNotebook) {
            const idToSave = selectedNotebook === 'all' ? 'all' : selectedNotebook.id;
            localStorage.setItem('procap_lastNotebookId', idToSave);
        } else {
            localStorage.removeItem('procap_lastNotebookId');
            localStorage.removeItem('procap_lastQuestionId');
        }
    }, [selectedNotebook]);

    const handleNotebookInteractionUpdate = async (notebookId: string, update: Partial<UserNotebookInteraction>) => {
        let newInteractions = [...appData.userNotebookInteractions];
        const existingIndex = newInteractions.findIndex(i => i.user_id === currentUser.id && i.notebook_id === notebookId);
        if (existingIndex > -1) {
            newInteractions[existingIndex] = { ...newInteractions[existingIndex], ...update };
        } else {
            newInteractions.push({ id: `temp-nb-${Date.now()}`, user_id: currentUser.id, notebook_id: notebookId, is_read: false, is_favorite: false, hot_votes: 0, cold_votes: 0, ...update });
        }
        setAppData(prev => ({...prev, userNotebookInteractions: newInteractions }));

        const result = await upsertUserVote('user_notebook_interactions', { user_id: currentUser.id, notebook_id: notebookId, ...update }, ['user_id', 'notebook_id']);
        if (!result) {
            console.error("Failed to update notebook interaction.");
            setAppData(appData);
        }
    };
    
    const handleNotebookVote = async (notebookId: string, type: 'hot' | 'cold', increment: 1 | -1) => {
        const interaction = appData.userNotebookInteractions.find(i => i.user_id === currentUser.id && i.notebook_id === notebookId);
        const currentVoteCount = (type === 'hot' ? interaction?.hot_votes : interaction?.cold_votes) || 0;
        if (increment === -1 && currentVoteCount <= 0) return;

        handleNotebookInteractionUpdate(notebookId, { [`${type}_votes`]: currentVoteCount + increment });
        
        setAppData(prev => ({ ...prev, questionNotebooks: prev.questionNotebooks.map(n => n.id === notebookId ? { ...n, [`${type}_votes`]: n[`${type}_votes`] + increment } : n) }));
        
        await incrementNotebookVote(notebookId, `${type}_votes`, increment);
        
        const notebook = appData.questionNotebooks.find(n => n.id === notebookId);
        if (notebook) {
            const authorId = notebook.user_id;
            if (authorId !== currentUser.id) {
                const author = appData.users.find(u => u.id === authorId);
                if (author) {
                    const xpChange = (type === 'hot' ? 1 : -1) * increment;
                    const updatedAuthor = { ...author, xp: (Number(author.xp) || 0) + xpChange };
                    const result = await supabaseUpdateUser(updatedAuthor);
                    if (result) {
                        setAppData(prev => ({...prev, users: prev.users.map(u => u.id === result.id ? result : u)}));
                    }
                }
            }
        }
    };

     const handleNotebookCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOnNotebook) return;
        let updatedComments = [...commentingOnNotebook.comments];
        if (action === 'add') {
            updatedComments.push({ id: `c_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 });
        } else {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) updatedComments[commentIndex][`${payload.voteType}_votes`] += 1;
        }
        
        const success = await updateContentComments('question_notebooks', commentingOnNotebook.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOnNotebook, comments: updatedComments };
            setAppData(prev => ({ ...prev, questionNotebooks: prev.questionNotebooks.map(n => n.id === updatedItem.id ? updatedItem : n) }));
            setCommentingOnNotebook(updatedItem);
        }
    };
    
    const processedNotebooks = useMemo(() => {
        const notebooks: QuestionNotebook[] = [...appData.questionNotebooks];
        switch (sort) {
            case 'time':
                return notebooks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            case 'temp':
                 return notebooks.sort((a, b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes));
            case 'user':
                const grouped = notebooks.reduce((acc, nb) => {
                    const key = nb.user_id || 'unknown';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(nb);
                    return acc;
                }, {} as Record<string, QuestionNotebook[]>);
                Object.values(grouped).forEach(group => {
                     group.sort((a,b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes));
                });
                return grouped;
            default:
                return notebooks;
        }
    }, [appData.questionNotebooks, sort]);

    if (isLoadingContent) {
        return <div className="text-center p-8">Carregando questões e cadernos...</div>;
    }

    if (selectedNotebook) {
        return <NotebookDetailView 
            notebook={selectedNotebook}
            allQuestions={allItems}
            appData={appData}
            setAppData={setAppData}
            currentUser={currentUser}
            updateUser={updateUser}
            onBack={() => {
                setSelectedNotebook(null);
                setQuestionIdToFocus(null);
            }}
            questionIdToFocus={questionIdToFocus}
            onFocusConsumed={handleFocusConsumed}
            setScreenContext={setScreenContext}
        />
    }

    const renderGrid = (items: QuestionNotebook[]) => (
        <NotebookGridView 
            notebooks={items}
            appData={appData}
            setAppData={setAppData}
            currentUser={currentUser}
            updateUser={updateUser}
            onSelectNotebook={setSelectedNotebook}
            handleNotebookInteractionUpdate={handleNotebookInteractionUpdate}
            handleNotebookVote={handleNotebookVote}
            setCommentingOnNotebook={setCommentingOnNotebook}
        />
    )

    return (
        <>
            <CommentsModal 
                isOpen={!!commentingOnNotebook}
                onClose={() => setCommentingOnNotebook(null)}
                comments={commentingOnNotebook?.comments || []}
                onAddComment={(text) => handleNotebookCommentAction('add', { text })}
                onVoteComment={(id, type) => handleNotebookCommentAction('vote', { commentId: id, voteType: type })}
                contentTitle={commentingOnNotebook?.name || ''}
            />
            <ContentToolbar 
                sort={sort} 
                setSort={setSort} 
                supportedSorts={['temp', 'time', 'user']}
            />
            
            <div className="space-y-6">
                {Array.isArray(processedNotebooks) 
                    ? renderGrid(processedNotebooks)
                    : Object.entries(processedNotebooks as Record<string, QuestionNotebook[]>).map(([groupKey, items]: [string, QuestionNotebook[]]) => (
                        <details key={groupKey} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
                             <summary className="text-xl font-bold cursor-pointer">{sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}</summary>
                            <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                               {renderGrid(items)}
                            </div>
                        </details>
                    ))
                }
            </div>
        </>
    );
};