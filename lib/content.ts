
import React from 'react';
import { AppData, User, ContentType, UserContentInteraction, Source, Summary, Flashcard, Question, ScheduleEvent, LinkFile } from '../types';
import { upsertUserContentInteraction, incrementContentVote, updateUser as supabaseUpdateUser, addGeneratedContent, logXpEvent } from '../services/supabaseClient';
import { generateSpecificContent } from '../services/geminiService';
import { checkAndAwardAchievements } from './achievements';

export const handleInteractionUpdate = async (
    setAppData: React.Dispatch<React.SetStateAction<AppData>>,
    appData: AppData,
    currentUser: User,
    updateUser: (user: User) => void,
    contentType: ContentType,
    contentId: string,
    update: Partial<UserContentInteraction>
) => {
    const existingInteraction = appData.userContentInteractions.find(
      i => i.user_id === currentUser.id && i.content_id === contentId && i.content_type === contentType
    );
    const wasRead = existingInteraction?.is_read || false;

    let xpGained = 0;
    // Grant XP if an item is being marked as read for the first time
    if (update.is_read && !wasRead) {
        switch (contentType) {
            case 'flashcard':
                xpGained += 3;
                break;
            case 'summary':
                xpGained += 5;
                break;
            case 'link_file':
                xpGained += 1;
                break;
            case 'audio_summary':
                xpGained += 25;
                break;
            default:
                xpGained += 1; // Manter padrão para outros tipos
                break;
        }
    }

    // Optimistic UI update
    let newInteractions = [...appData.userContentInteractions];
    const existingIndex = newInteractions.findIndex(i => i.id === existingInteraction?.id);
    if (existingIndex > -1) {
        newInteractions[existingIndex] = { ...newInteractions[existingIndex], ...update };
    } else {
        newInteractions.push({ id: `temp-${Date.now()}`, user_id: currentUser.id, content_id: contentId, content_type: contentType, is_read: false, is_favorite: false, hot_votes: 0, cold_votes: 0, ...update });
    }
    const tempAppData = { ...appData, userContentInteractions: newInteractions };
    setAppData(tempAppData);

    // Update DB
    const result = await upsertUserContentInteraction({
        user_id: currentUser.id,
        content_id: contentId,
        content_type: contentType,
        ...update
    });
    
    if (!result) {
        console.error("Failed to update interaction on the server.");
        // Revert state on failure
        setAppData(appData);
        return;
    }

    if (xpGained > 0) {
        logXpEvent(currentUser.id, xpGained, `${contentType.toUpperCase()}_READ`, contentId).then(newEvent => {
            if (newEvent) {
                setAppData(prev => ({...prev, xp_events: [...prev.xp_events, newEvent]}));
            }
        });
    }

    // FIX: Defensively cast `currentUser.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
    const userWithNewXp = { ...currentUser, xp: (Number(currentUser.xp) || 0) + xpGained };
    const userWithNewAchievements = checkAndAwardAchievements(userWithNewXp, tempAppData);

    if (userWithNewAchievements.xp !== currentUser.xp || userWithNewAchievements.achievements.length !== currentUser.achievements.length) {
        updateUser(userWithNewAchievements);
    }
};

export const handleVoteUpdate = async (
    setAppData: React.Dispatch<React.SetStateAction<AppData>>,
    currentUser: User,
    updateUser: (user: User) => void,
    appData: AppData,
    contentType: 'summary' | 'flashcard' | 'question' | 'mind_map' | 'audio_summary' | 'cronograma' | 'link_file',
    contentId: string,
    type: 'hot' | 'cold',
    increment: 1 | -1
) => {
    const tableMap = { summary: 'summaries', flashcard: 'flashcards', question: 'questions', mind_map: 'mind_maps', audio_summary: 'audio_summaries', cronograma: 'schedule_events', link_file: 'links_files' };
    const tableName = tableMap[contentType];

    const interaction = appData.userContentInteractions.find(
        i => i.user_id === currentUser.id && i.content_id === contentId && i.content_type === contentType
    );
    const currentVoteCount = (type === 'hot' ? interaction?.hot_votes : interaction?.cold_votes) || 0;

    if (increment === -1 && currentVoteCount <= 0) return; // Can't go below 0

    const newVoteCount = currentVoteCount + increment;
    const voteUpdate: Partial<UserContentInteraction> = {
        [`${type}_votes`]: newVoteCount
    };

    // Perform a single, combined optimistic update for maximum safety and to prevent UI glitches.
    setAppData(prev => {
        // 1. Update userContentInteractions (the user's specific vote count)
        const interactionIndex = prev.userContentInteractions.findIndex(
            i => i.user_id === currentUser.id && i.content_id === contentId && i.content_type === contentType
        );
        const newInteractions = [...prev.userContentInteractions];
        if (interactionIndex > -1) {
            newInteractions[interactionIndex] = { ...newInteractions[interactionIndex], ...voteUpdate };
        } else {
            newInteractions.push({ id: `temp-vote-${Date.now()}`, user_id: currentUser.id, content_id: contentId, content_type: contentType, is_read: false, is_favorite: false, hot_votes: 0, cold_votes: 0, ...voteUpdate });
        }

        // 2. Update total votes on the content item itself
        let newScheduleEvents = prev.scheduleEvents;
        let newSources = prev.sources;
        let newLinksFiles = prev.linksFiles;

        if (tableName === 'schedule_events') {
            newScheduleEvents = prev.scheduleEvents.map(item =>
                item.id === contentId ? { ...item, [`${type}_votes`]: item[`${type}_votes`] + increment } : item
            );
        } else if (tableName === 'links_files') {
            newLinksFiles = prev.linksFiles.map(item =>
                item.id === contentId ? { ...item, [`${type}_votes`]: item[`${type}_votes`] + increment } : item
            );
        }
        else {
            newSources = prev.sources.map(source => {
                const contentList = source[tableName as keyof Source] as any[];
                if (contentList?.some(item => item.id === contentId)) {
                    return {
                        ...source,
                        [tableName]: contentList.map(item =>
                            item.id === contentId ? { ...item, [`${type}_votes`]: item[`${type}_votes`] + increment } : item
                        )
                    };
                }
                return source;
              });
        }

        return { ...prev, userContentInteractions: newInteractions, scheduleEvents: newScheduleEvents, sources: newSources, linksFiles: newLinksFiles };
    });

    // DB Updates
    const dbPromises = [];

    dbPromises.push(upsertUserContentInteraction({
        user_id: currentUser.id,
        content_id: contentId,
        content_type: contentType,
        ...voteUpdate
    }));

    dbPromises.push(incrementContentVote(tableName, contentId, `${type}_votes`, increment));
    
    // XP for content author
    if (contentType !== 'cronograma') {
        let authorId: string | undefined;

        if (contentType === 'link_file') {
            const item = appData.linksFiles.find(i => i.id === contentId);
            authorId = item?.user_id;
        } else {
            const sourceContainingItem = appData.sources.find(s => 
                (s[tableName as keyof Source] as any[])?.some(item => item.id === contentId)
            );
            authorId = sourceContainingItem?.user_id;
        }

        if (authorId && authorId !== currentUser.id) {
            const author = appData.users.find(u => u.id === authorId);
            if (author) {
                const xpChange = (type === 'hot' ? 1 : -1) * increment;
                // FIX: Defensively cast `author.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
                const updatedAuthor = { ...author, xp: Math.max(0, (Number(author.xp) || 0) + xpChange) };
                
                dbPromises.push(supabaseUpdateUser(updatedAuthor).then(result => {
                    if (result) {
                        logXpEvent(author.id, xpChange, 'VOTE_RECEIVED', contentId).then(newEvent => {
                            if (newEvent) setAppData(prev => ({...prev, xp_events: [...prev.xp_events, newEvent]}));
                        });
                        setAppData(prev => ({
                            ...prev,
                            users: prev.users.map(u => u.id === result.id ? result : u),
                        }));
                    }
                }));
            }
        }
    }

    await Promise.all(dbPromises).catch(err => {
        console.error("Error during vote DB updates, reverting UI state:", err);
        // On failure, revert the entire appData state
        setAppData(appData);
    });
};


export const handleGenerateNewContent = async (
    setAppData: React.Dispatch<React.SetStateAction<AppData>>,
    appData: AppData,
    setIsGenerating: (b: boolean) => void,
    onClose: () => void,
    contentType: 'summaries' | 'flashcards' | 'questions',
    selectedSourceIds: string[],
    prompt: string
) => {
    setIsGenerating(true);
    const contextSources = appData.sources.filter(s => selectedSourceIds.includes(s.id));
    
    if (contextSources.length === 0) {
        alert("Nenhuma fonte selecionada.");
        setIsGenerating(false);
        return;
    }
    
    const firstSource = contextSources[0];
    
    try {
        const contextText = contextSources.map(s => `Fonte: ${s.title}\n${s.summary}`).join('\n\n---\n\n');
        
        const newContent = await generateSpecificContent(contentType, contextText, prompt);

        if (newContent.error) {
            throw new Error(newContent.error);
        }

        const createdContent = await addGeneratedContent(firstSource.id, { [contentType]: newContent });

        if (!createdContent) {
            throw new Error("Falha ao salvar o conteúdo gerado.");
        }

        setAppData(prev => {
            const newSources = [...prev.sources];
            const sourceIndex = newSources.findIndex(s => s.id === firstSource.id);
            if (sourceIndex > -1) {
                const newlyAddedItems = createdContent[contentType as keyof typeof createdContent];
                const updatedSource = {
                    ...newSources[sourceIndex],
                    [contentType]: [
                        ...(newSources[sourceIndex][contentType as keyof Source] as any[] || []),
                        ...newlyAddedItems
                    ]
                };
                newSources[sourceIndex] = updatedSource;
            }
            return { ...prev, sources: newSources };
        });

    } catch (error: any) {
        alert(`Erro ao gerar conteúdo: ${error.message}`);
    } finally {
        setIsGenerating(false);
        onClose();
    }
};
