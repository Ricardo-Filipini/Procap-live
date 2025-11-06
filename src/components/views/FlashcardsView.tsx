import React, { useState, useEffect, useMemo } from 'react';
import { MainContentProps } from '../../types';
import { Flashcard, Comment, ContentType } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { GenerateContentModal } from '../shared/GenerateContentModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate, handleGenerateNewContent } from '../../lib/content';
import { updateContentComments } from '../../services/supabaseClient';
import { XMarkIcon } from '../Icons';

interface FlashcardsViewProps extends MainContentProps {
    allItems: (Flashcard & { user_id: string, created_at: string, source: any})[];
    clearNavTarget: () => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ allItems, appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget }) => {
    const [flipped, setFlipped] = useState<string | null>(null);
    const [commentingOn, setCommentingOn] = useState<Flashcard | null>(null);
    const [fontSize, setFontSize] = useState(1);
    const contentType: ContentType = 'flashcard';
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [navigationState, setNavigationState] = useState<{ targetId: string; groupKey: string } | null>(null);
    const [sourceFilter, setSourceFilter] = useState<string | null>(null);

    useEffect(() => {
        if (navTarget?.term) {
            setSourceFilter(navTarget.term);
            clearNavTarget();
        }
    }, [navTarget, clearNavTarget]);

    const itemsToDisplay = useMemo(() => {
        if (sourceFilter) {
            return allItems.filter(item => item.source?.title === sourceFilter);
        }
        return allItems;
    }, [allItems, sourceFilter]);

    const controller = useContentViewController(itemsToDisplay, currentUser, appData, contentType, 'source');
    const { processedItems, sort, filter, favoritesOnly, aiFilterIds, setSort, setFilter, setFavoritesOnly, handleAiFilter, handleClearFilter, handleOpenGenerateModal, generateModalOpen, isGenerating, setIsGenerating, generationPrompt } = controller;

    const [stableItems, setStableItems] = useState(processedItems);
    
    useEffect(() => {
        setStableItems(processedItems);
    }, [sort, filter, favoritesOnly, aiFilterIds, sourceFilter, itemsToDisplay]);

    const itemsToRender = (filter === 'unread' || filter === 'read') ? stableItems : processedItems;

    const handleToggleGroup = (groupKey: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    useEffect(() => {
        if (navTarget?.id) {
            const item = allItems.find(i => i.id === navTarget.id);
            const groupKey = item?.source?.title;
            
            if (groupKey) {
                setNavigationState({ targetId: navTarget.id, groupKey });
                setSort('source');
                setOpenGroups(prev => new Set(prev).add(groupKey));
                clearNavTarget();
            } else {
                clearNavTarget();
            }
        }
    }, [navTarget, allItems, setSort, clearNavTarget]);

    useEffect(() => {
        if (!navigationState) return;

        if (openGroups.has(navigationState.groupKey)) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`flashcard-${navigationState.targetId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setNavigationState(null);
                } else {
                    console.warn(`Navigation target element 'flashcard-${navigationState.targetId}' not found in DOM.`);
                    setNavigationState(null);
                }
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [navigationState, openGroups]);


    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOn) return;
        let updatedComments = [...commentingOn.comments];
        if (action === 'add') {
            const newComment: Comment = { id: `c_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 };
            updatedComments.push(newComment);
        } else if (action === 'vote') {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) {
                if (payload.voteType === 'hot') {
                    updatedComments[commentIndex].hot_votes = (updatedComments[commentIndex].hot_votes || 0) + 1;
                } else if (payload.voteType === 'cold') {
                    updatedComments[commentIndex].cold_votes = (updatedComments[commentIndex].cold_votes || 0) + 1;
                }
            }
        }
        
        const success = await updateContentComments('flashcards', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, sources: prev.sources.map(s => s.id === updatedItem.source_id ? { ...s, flashcards: s.flashcards.map(fc => fc.id === updatedItem.id ? updatedItem : fc) } : s) }));
            setCommentingOn(updatedItem);
        }
    };

    const handleFlip = (cardId: string) => {
        if (flipped !== cardId) {
            handleInteractionUpdate(setAppData, appData, currentUser, updateUser, 'flashcard', cardId, { is_read: true });
        }
        setFlipped(flipped === cardId ? null : cardId);
    };
    
    const renderItems = (items: any[]) => (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map(card => {
                 const author = appData.users.find(u => u.id === card.source?.user_id);
                 const authorName = author ? author.pseudonym : 'Desconhecido';
                 return (
                 <div id={`flashcard-${card.id}`} key={card.id} className="[perspective:1000px] min-h-64 group flex flex-col">
                    <div className={`relative w-full flex-grow [transform-style:preserve-3d] transition-transform duration-700 ${flipped === card.id ? '[transform:rotateY(180deg)]' : ''}`} onClick={() => handleFlip(card.id)}>
                        <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col justify-between p-6 bg-card-light dark:bg-card-dark rounded-t-lg shadow-md border border-b-0 border-border-light dark:border-border-dark cursor-pointer">
                            <div>
                                <p className="text-xs text-gray-500">Criado por {authorName}</p>
                                <p className={`font-semibold text-center mt-4 flex-grow flex items-center justify-center ${FONT_SIZE_CLASSES[fontSize]}`}>{card.front}</p>
                            </div>
                            <div className="text-center text-xs text-gray-400">Clique para virar</div>
                        </div>
                        <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center p-6 bg-primary-light dark:bg-primary-dark text-white rounded-t-lg shadow-md cursor-pointer">
                            <p className={`text-center ${FONT_SIZE_CLASSES[fontSize]}`}>{card.back}</p>
                        </div>
                    </div>
                    <div className="bg-background-light dark:bg-background-dark p-2 rounded-b-lg border border-t-0 border-border-light dark:border-border-dark">
                         <ContentActions
                            item={card} contentType={contentType} currentUser={currentUser} interactions={appData.userContentInteractions}
                            onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                            onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                            onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                            onComment={() => setCommentingOn(card)}
                        />
                    </div>
                </div>
            )})}
        </div>
    );

    return (
        <>
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.front || ''}/>
            <GenerateContentModal 
                isOpen={generateModalOpen}
                onClose={() => controller.setGenerateModalOpen(false)}
                sources={appData.sources}
                prompt={generationPrompt}
                contentType="flashcards"
                isLoading={isGenerating}
                onGenerate={(ids, p) => handleGenerateNewContent(setAppData, appData, setIsGenerating, () => controller.setGenerateModalOpen(false), 'flashcards', ids, p)}
            />
            <ContentToolbar {...{ sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly, onAiFilter: handleAiFilter, onGenerate: handleOpenGenerateModal, isFiltering: !!aiFilterIds, onClearFilter: handleClearFilter }} />
            
            {sourceFilter && (
                <div className="flex items-center justify-between gap-2 p-3 mb-4 bg-primary-light/10 text-primary-light dark:text-primary-dark dark:bg-primary-dark/20 rounded-md text-sm">
                    <span>Filtrando por fonte: <strong>{sourceFilter}</strong></span>
                    <button onClick={() => setSourceFilter(null)} className="p-1 rounded-full hover:bg-primary-light/20" title="Limpar filtro">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
            
            <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} className="mb-4" />
            <div className="space-y-6">
                {Array.isArray(itemsToRender) 
                    ? renderItems(itemsToRender)
                    : Object.entries(itemsToRender as Record<string, any[]>).map(([groupKey, items]: [string, any[]]) => {
                        const isHighlighted = groupKey.startsWith('(Apostila)');
                        return (
                            <details key={groupKey} open={openGroups.has(groupKey)} className={`bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark transition-all ${isHighlighted ? 'border-primary-light dark:border-primary-dark border-2 shadow-lg' : ''}`}>
                                 <summary onClick={(e) => { e.preventDefault(); handleToggleGroup(groupKey); }} className={`text-xl font-bold cursor-pointer ${isHighlighted ? 'text-primary-light dark:text-primary-dark' : ''}`}>{sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}</summary>
                                <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                                   {renderItems(items)}
                                </div>
                            </details>
                        )
                    })
                }
            </div>
        </>
    );
};
