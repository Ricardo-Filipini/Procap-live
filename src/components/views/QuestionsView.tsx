

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainContentProps } from '../../types';
import { Question, Comment, QuestionNotebook, UserNotebookInteraction, UserQuestionAnswer } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { checkAndAwardAchievements } from '../../lib/achievements';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
// FIX: Replaced incrementVoteCount with incrementNotebookVote for type safety and correctness.
import { addQuestionNotebook, upsertUserVote, incrementNotebookVote, updateContentComments, updateUser as supabaseUpdateUser, upsertUserQuestionAnswer, clearNotebookAnswers, supabase } from '../../services/supabaseClient';
import { NotebookDetailView, NotebookGridView } from './QuestionsViewPart2';

type SortOption = 'temp' | 'time' | 'subject' | 'user' | 'source';

// Fix: Removed the incompatible 'navTarget' override. The correct type is inherited from MainContentProps.
interface QuestionsViewProps extends MainContentProps {
    allItems: (Question & { user_id: string, created_at: string, source: any})[];
    clearNavTarget: () => void;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({ allItems, appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget, setScreenContext }) => {
    const [selectedNotebook, setSelectedNotebook] = useState<QuestionNotebook | 'all' | null>(null);
    const [commentingOnNotebook, setCommentingOnNotebook] = useState<QuestionNotebook | null>(null);
    const [sort, setSort] = useState<SortOption>('temp');
    const [questionIdToFocus, setQuestionIdToFocus] = useState<string | null>(null);
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);
    
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


    useEffect(() => {
        const fetchCurrentUserAnswers = async () => {
            if (!supabase || !currentUser?.id) return;

            const { data, error } = await supabase
                .from('user_question_answers')
                .select('*')
                .eq('user_id', currentUser.id);

            if (error) {
                console.error("Failed to fetch current user's answers:", error);
            } else if (data) {
                setAppData(prev => {
                    // Filter out stale answers for the current user and merge fresh data
                    const otherUsersAnswers = prev.userQuestionAnswers.filter(
                        a => a.user_id !== currentUser.id
                    );
                    return {
                        ...prev,
                        userQuestionAnswers: [...otherUsersAnswers, ...data],
                    };
                });
            }
        };

        fetchCurrentUserAnswers();
    }, [currentUser.id, setAppData]);

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
        
        // FIX: Replaced the generic incrementVoteCount with the specific incrementNotebookVote function.
        await incrementNotebookVote(notebookId, `${type}_votes`, increment);
        
        const notebook = appData.questionNotebooks.find(n => n.id === notebookId);
        if (notebook) {
            const authorId = notebook.user_id;
            if (authorId !== currentUser.id) {
                const author = appData.users.find(u => u.id === authorId);
                if (author) {
                    const xpChange = (type === 'hot' ? 1 : -1) * increment;
                    // FIX: Defensively cast `author.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
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
        // Fix: Explicitly type `notebooks` to resolve type inference issues.
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