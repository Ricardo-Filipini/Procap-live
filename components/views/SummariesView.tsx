import React, { useState, useEffect, useMemo } from 'react';
import { MainContentProps } from '../../types';
import { Summary, Comment, ContentType } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { GenerateContentModal } from '../shared/GenerateContentModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate, handleGenerateNewContent } from '../../lib/content';
import { updateContentComments } from '../../services/supabaseClient';

const renderSummaryWithTooltips = (summary: Summary, fontSizeClass: string) => {
    let content: (string | React.ReactElement)[] = [(summary.content || "")];
    
    const processMarkdown = (part: string | React.ReactElement) => {
        if (typeof part !== 'string') return [part];
        const elements: (string | React.ReactElement)[] = [];
        const parts = part.split(/(\*\*.*?\*\*)/g);
        parts.forEach((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) {
                elements.push(<strong key={`strong-${i}`}>{p.slice(2, -2)}</strong>);
            } else {
                elements.push(p);
            }
        });
        return elements;
    };

    content = content.flatMap(processMarkdown);

    for (const keyPoint of (summary.keyPoints || [])) {
        if (!keyPoint.term) continue;
        let newContent: (string | React.ReactElement)[] = [];
        const regex = new RegExp(`\\b(${keyPoint.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})\\b`, 'gi');
        
        for (const part of content) {
            if (typeof part === 'string') {
                const stringParts = part.split(regex);
                for (let i = 0; i < stringParts.length; i++) {
                    if (i % 2 === 1) { // It's the term
                        newContent.push(
                            <span key={`${keyPoint.term}-${i}`} className="relative group font-bold text-primary-light dark:text-primary-dark cursor-pointer underline decoration-dotted">
                                {stringParts[i]}
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2 bg-gray-800 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                                    {keyPoint.description}
                                </span>
                            </span>
                        );
                    } else {
                        newContent.push(stringParts[i]);
                    }
                }
            } else {
                newContent.push(part);
            }
        }
        content = newContent;
    }
    return <div className={`prose dark:prose-invert max-w-none whitespace-pre-wrap ${fontSizeClass}`}>{content}</div>;
}

// Fix: Removed the incompatible 'navTarget' override. The correct type is inherited from MainContentProps.
interface SummariesViewProps extends MainContentProps {
    allItems: (Summary & { user_id: string, created_at: string, source: any})[];
    clearNavTarget: () => void;
}

export const SummariesView: React.FC<SummariesViewProps> = ({ allItems, appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget, setScreenContext }) => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [commentingOn, setCommentingOn] = useState<Summary | null>(null);
    const contentType: ContentType = 'summary';
    const [fontSize, setFontSize] = useState(1);
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [navigationState, setNavigationState] = useState<{ targetId: string; groupKey: string } | null>(null);

    const {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        aiFilterIds, isFiltering, isGenerating, setIsGenerating,
        generateModalOpen, setGenerateModalOpen, generationPrompt,
        processedItems, handleAiFilter, handleClearFilter, handleOpenGenerateModal
    } = useContentViewController(allItems, currentUser, appData, contentType, 'source');

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
    
    const handleExpand = (summary: Summary) => {
        const isExpanding = expanded !== summary.id;
        setExpanded(isExpanding ? summary.id : null);
        
        if (setScreenContext) {
            setScreenContext(isExpanding ? `Resumo: ${summary.title}\n\n${summary.content}` : null);
        }

        const interaction = appData.userContentInteractions.find(
            i => i.user_id === currentUser.id && i.content_id === summary.id && i.content_type === contentType
        );
        const isAlreadyRead = interaction?.is_read || false;

        if (isExpanding && !isAlreadyRead) {
            handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, summary.id, { is_read: true });
        }
    };
    
    // Step 1: Capture navigation command and prepare the component's state.
    useEffect(() => {
        if (navTarget?.id) {
            const item = allItems.find(i => i.id === navTarget.id);
            const groupKey = item?.source?.title;
            
            if (groupKey) {
                // Set internal state to start the navigation process
                setNavigationState({ targetId: navTarget.id, groupKey });
                
                // Force the view into the required state
                setSort('source');
                setOpenGroups(prev => new Set(prev).add(groupKey));
                
                // CRITICAL: We clear the target here so this effect doesn't re-run,
                // but the navigationState now holds the needed information.
                clearNavTarget();
            } else {
                // If item not found, just clear the target
                clearNavTarget();
            }
        }
    }, [navTarget, allItems, setSort, clearNavTarget]);

    // Step 2: Once the state is ready (group is open), perform DOM actions.
    useEffect(() => {
        // Only run if we are in a navigation process
        if (!navigationState) return;

        // Check if the target group is actually in the openGroups set
        if (openGroups.has(navigationState.groupKey)) {
            // Wait for the DOM to update after the state change
            const timer = setTimeout(() => {
                const element = document.getElementById(`summary-${navigationState.targetId}`);
                if (element) {
                    // Perform DOM actions
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setExpanded(navigationState.targetId); // Expand the summary itself

                    // Navigation is complete, reset local navigation state
                    setNavigationState(null);
                } else {
                    // Failsafe in case element is not found
                    console.warn(`Navigation target element 'summary-${navigationState.targetId}' not found in DOM.`);
                    setNavigationState(null);
                }
            }, 300); // 300ms is a safe delay to ensure render completes.

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
                updatedComments[commentIndex].hot_votes += payload.voteType === 'hot' ? 1 : 0;
                updatedComments[commentIndex].cold_votes += payload.voteType === 'cold' ? 1 : 0;
            }
        }
        
        const success = await updateContentComments('summaries', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, sources: prev.sources.map(s => s.id === updatedItem.source_id ? { ...s, summaries: s.summaries.map(sum => sum.id === updatedItem.id ? updatedItem : sum) } : s) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const renderItem = (summary: Summary & { user_id: string, created_at: string}) => (
        <div id={`summary-${summary.id}`} key={summary.id} className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
            <div onClick={() => handleExpand(summary)} className="cursor-pointer">
                <h3 className="text-xl font-bold">{summary.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{summary.source?.topic}</p>
                {expanded === summary.id && (
                    <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                        {renderSummaryWithTooltips(summary, FONT_SIZE_CLASSES[fontSize])}
                    </div>
                )}
            </div>
            <ContentActions
                item={summary} contentType={contentType} currentUser={currentUser} interactions={appData.userContentInteractions}
                onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                onComment={() => setCommentingOn(summary)}
            />
        </div>
    );
    
    return (
        <>
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.title || ''}/>
            <GenerateContentModal 
                isOpen={generateModalOpen}
                onClose={() => setGenerateModalOpen(false)}
                sources={appData.sources}
                prompt={generationPrompt}
                contentType="summaries"
                isLoading={isGenerating}
                onGenerate={(ids, p) => handleGenerateNewContent(setAppData, appData, setIsGenerating, () => setGenerateModalOpen(false), 'summaries', ids, p)}
            />
            <ContentToolbar {...{ sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly, onAiFilter: handleAiFilter, onGenerate: handleOpenGenerateModal, isFiltering: !!aiFilterIds, onClearFilter: handleClearFilter }} />
            
            <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} className="mb-4" />

            <div className="space-y-4">
                {Array.isArray(processedItems) 
                    ? processedItems.map(renderItem)
                    : Object.entries(processedItems as Record<string, any[]>).map(([groupKey, items]: [string, any[]]) => {
                        const isHighlighted = groupKey.startsWith('(Apostila)');
                        return (
                            <details key={groupKey} open={openGroups.has(groupKey)} className={`bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark transition-all ${isHighlighted ? 'border-primary-light dark:border-primary-dark border-2 shadow-lg' : ''}`}>
                                <summary onClick={(e) => { e.preventDefault(); handleToggleGroup(groupKey); }} className={`text-xl font-bold cursor-pointer ${isHighlighted ? 'text-primary-light dark:text-primary-dark' : ''}`}>
                                    {sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}
                                </summary>
                                <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                                    {items.map(renderItem)}
                                </div>
                            </details>
                        )
                    })
                }
            </div>
        </>
    );
};