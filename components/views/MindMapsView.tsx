
import React, { useState, useEffect } from 'react';
import { MainContentProps } from '../../types';
import { MindMap, Comment, ContentType } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { updateContentComments, getMindMaps } from '../../services/supabaseClient';

interface MindMapsViewProps extends MainContentProps {
    allItems: (MindMap & { user_id: string, created_at: string, source: any})[];
    clearNavTarget: () => void;
}

export const MindMapsView: React.FC<MindMapsViewProps> = ({ allItems, appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget }) => {
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [commentingOn, setCommentingOn] = useState<MindMap | null>(null);
    const [fontSize, setFontSize] = useState(2);
    const contentType: ContentType = 'mind_map';
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [navigationState, setNavigationState] = useState<{ targetId: string; groupKey: string } | null>(null);

    useEffect(() => {
        const hasAnyMindMap = allItems.length > 0;
        if (appData.sources.length > 0 && !hasAnyMindMap) {
            setIsLoadingContent(true);
            getMindMaps().then(allMindMaps => {
                setAppData(prev => {
                    const sourcesWithContent = prev.sources.map(source => ({
                        ...source,
                        mind_maps: allMindMaps.filter(mm => mm.source_id === source.id)
                    }));
                    return { ...prev, sources: sourcesWithContent };
                });
                setIsLoadingContent(false);
            }).catch(() => setIsLoadingContent(false));
        }
    }, [appData.sources, allItems.length, setAppData]);

    const {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        isFiltering, aiFilterIds,
        processedItems, handleAiFilter, handleClearFilter,
    } = useContentViewController(allItems, currentUser, appData, contentType, 'source');

    const handleToggleGroup = (groupKey: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    // Step 1: Capture navigation command and prepare the component's state.
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

    // Step 2: Once the state is ready (group is open), perform DOM actions.
    useEffect(() => {
        if (!navigationState) return;

        if (openGroups.has(navigationState.groupKey)) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`mindmap-${navigationState.targetId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setNavigationState(null);
                } else {
                    console.warn(`Navigation target element 'mindmap-${navigationState.targetId}' not found in DOM.`);
                    setNavigationState(null);
                }
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [navigationState, openGroups]);


    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOn) return;
        let updatedComments = [...(commentingOn.comments || [])];
        if (action === 'add') {
            const newComment: Comment = { id: `c_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 };
            updatedComments.push(newComment);
        } else if (action === 'vote') {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) {
                updatedComments[commentIndex].hot_votes += payload.voteType === 'hot' ? 1 : 0;
                updatedComments[commentIndex].cold_votes += payload.voteType === 'cold' ? 1 : 0;
            }
        }
        
        const success = await updateContentComments('mind_maps', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, sources: prev.sources.map(s => s.id === updatedItem.source_id ? { ...s, mind_maps: s.mind_maps.map(mm => mm.id === updatedItem.id ? updatedItem : mm) } : s) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const renderItems = (items: any[]) => (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map(map => (
                <div id={`mindmap-${map.id}`} key={map.id} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
                    <h3 className={`text-xl font-bold mb-2 ${FONT_SIZE_CLASSES[fontSize]}`}>{map.title}</h3>
                     <p className="text-xs text-gray-500 mb-4">Fonte: {map.source?.title}</p>
                    <img src={map.imageUrl} alt={map.title} className="w-full h-auto rounded-md border border-border-light dark:border-border-dark"/>
                    <ContentActions
                        item={map} contentType={contentType} currentUser={currentUser} interactions={appData.userContentInteractions}
                        onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                        onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                        onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                        onComment={() => setCommentingOn(map)}
                    />
                </div>
            ))}
        </div>
    );

    return(
        <>
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.title || ''}/>
            <ContentToolbar {...{ sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly, onAiFilter: handleAiFilter, onGenerate: undefined, isFiltering: !!aiFilterIds, onClearFilter: handleClearFilter }} />
            <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} className="mb-4"/>
             {isLoadingContent ? <div className="text-center p-8">Carregando mapas mentais...</div> : (
                <div className="space-y-4">
                    {Array.isArray(processedItems) 
                        ? renderItems(processedItems)
                        : Object.entries(processedItems as Record<string, any[]>).map(([groupKey, items]: [string, any[]]) => {
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
             )}
        </>
    );
}
