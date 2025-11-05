import { useState, useMemo } from 'react';
import { AppData, User, ContentType } from '../types';
import { filterItemsByPrompt } from '../services/geminiService';

type SortOption = 'temp' | 'time' | 'subject' | 'user' | 'source';
type FilterStatus = 'all' | 'read' | 'unread';

export const useContentViewController = (
    allItems: any[], 
    currentUser: User, 
    appData: AppData, 
    contentType: ContentType,
    initialSort: SortOption = 'temp'
) => {
    const [sort, setSort] = useState<SortOption>(initialSort);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [aiFilterIds, setAiFilterIds] = useState<string[] | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const [generationPrompt, setGenerationPrompt] = useState("");

    const processedItems = useMemo(() => {
        let items = [...allItems];
        
        if (aiFilterIds) {
            const idSet = new Set(aiFilterIds);
            items = items.filter(item => idSet.has(item.id));
        }

        if (favoritesOnly) {
            items = items.filter(item => {
                const interaction = appData.userContentInteractions.find(i => i.user_id === currentUser.id && i.content_id === item.id && i.content_type === contentType);
                return interaction?.is_favorite;
            });
        }
        
        if (filter !== 'all') {
            items = items.filter(item => {
                const interaction = appData.userContentInteractions.find(i => i.user_id === currentUser.id && i.content_id === item.id && i.content_type === contentType);
                const isRead = interaction?.is_read || false;
                return filter === 'read' ? isRead : !isRead;
            });
        }

        switch (sort) {
            case 'time':
                items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                break;
            case 'temp':
                items.sort((a, b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes));
                break;
        }
        
        if (sort === 'subject' || sort === 'user' || sort === 'source') {
            const grouped = items.reduce((acc, item) => {
                let groupKey: string;
                if (sort === 'subject') {
                    groupKey = item.source?.materia || 'Outros';
                } else if (sort === 'user') {
                    groupKey = item.user_id || 'Desconhecido';
                } else { // source
                    groupKey = item.source?.title || 'Fonte Desconhecida';
                }
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(item);
                return acc;
            }, {} as Record<string, any[]>);
            
            Object.keys(grouped).forEach(key => {
                const groupItems: any[] = grouped[key];
                groupItems.sort((a, b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes));
            });

            const groupKeys = Object.keys(grouped);

            if (sort === 'source') {
                groupKeys.sort((a, b) => {
                    const aIsApostila = a.startsWith('(Apostila)');
                    const bIsApostila = b.startsWith('(Apostila)');
                    if (aIsApostila && !bIsApostila) return -1;
                    if (!aIsApostila && bIsApostila) return 1;
                    return a.localeCompare(b);
                });
            } else {
                groupKeys.sort((a, b) => a.localeCompare(b));
            }

            const sortedGrouped = groupKeys.reduce((acc, key) => {
                acc[key] = grouped[key];
                return acc;
            }, {} as Record<string, any[]>);

            return sortedGrouped;
        }

        return items;
    }, [allItems, sort, filter, favoritesOnly, aiFilterIds, appData.userContentInteractions, currentUser.id, contentType]);
    
    const handleAiFilter = async (prompt: string) => {
        if (!prompt) return;
        setIsFiltering(true);
        const itemsToFilter = allItems.map(item => {
            let text = '';
            if (contentType === 'summary') text = item.title + " " + item.content;
            if (contentType === 'flashcard') text = item.front + " " + item.back;
            if (contentType === 'question') text = item.questionText + " " + item.options.join(' ');
            if (contentType === 'mind_map') text = item.title;
            if (contentType === 'audio_summary') text = item.title;
            return { id: item.id, text };
        });
        const relevantIds = await filterItemsByPrompt(prompt, itemsToFilter);
        setAiFilterIds(relevantIds);
        setIsFiltering(false);
    };
    
    const handleClearFilter = () => setAiFilterIds(null);

    const handleOpenGenerateModal = (prompt: string) => {
        setGenerationPrompt(prompt);
        setGenerateModalOpen(true);
    };
    
    return {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        aiFilterIds, setAiFilterIds, isFiltering, setIsFiltering,
        isGenerating, setIsGenerating, generateModalOpen, setGenerateModalOpen,
        generationPrompt,
        processedItems, handleAiFilter, handleClearFilter, handleOpenGenerateModal
    };
};