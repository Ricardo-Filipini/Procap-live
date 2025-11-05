import React, { useState, useEffect, useRef } from 'react';
import { Comment, ContentType, UserContentInteraction, UserNotebookInteraction, User } from '../../types';
import { PlusIcon, MinusIcon, EyeIcon, StarIcon } from '../Icons';

export const ContentActions: React.FC<{
    item: { id: string, comments: Comment[], hot_votes: number, cold_votes: number },
    contentType: ContentType | 'question_notebook' | 'question',
    currentUser: User,
    interactions: UserContentInteraction[] | UserNotebookInteraction[],
    onVote: (contentId: string, type: 'hot' | 'cold', increment: 1 | -1) => void,
    onToggleRead: (contentId: string, currentState: boolean) => void,
    onToggleFavorite: (contentId: string, currentState: boolean) => void,
    onComment: () => void,
    extraActions?: React.ReactNode,
}> = ({ item, contentType, currentUser, interactions, onVote, onToggleRead, onToggleFavorite, onComment, extraActions }) => {
    const [activeVote, setActiveVote] = useState<'hot' | 'cold' | null>(null);
    const votePopupRef = useRef<HTMLDivElement>(null);
    
    // Type guard for interactions
    const isContentInteraction = (i: any): i is UserContentInteraction => 'content_type' in i;

    const interaction = interactions.find(i => {
        if (isContentInteraction(i)) {
            return i.user_id === currentUser.id && i.content_id === item.id && i.content_type === contentType;
        } else {
            return i.user_id === currentUser.id && (i as UserNotebookInteraction).notebook_id === item.id;
        }
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (votePopupRef.current && !votePopupRef.current.contains(event.target as Node)) {
                setActiveVote(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-light dark:border-border-dark text-sm">
            <div className="flex items-center gap-3 relative">
                 <button onClick={() => setActiveVote(prev => prev === 'hot' ? null : 'hot')} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
                    <span className="text-lg">🔥</span> {item.hot_votes || 0}
                </button>
                <button onClick={() => setActiveVote(prev => prev === 'cold' ? null : 'cold')} className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
                    <span className="text-lg">❄️</span> {item.cold_votes || 0}
                </button>
                 {activeVote && (
                     <div ref={votePopupRef} className="absolute -top-12 -left-2 z-10 bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center p-1 gap-1 shadow-lg">
                        <button onClick={() => onVote(item.id, activeVote, 1)} className="p-1 hover:bg-white/20 rounded-full"><PlusIcon className="w-4 h-4" /></button>
                        <span className="text-sm font-bold w-4 text-center">{activeVote === 'hot' ? interaction?.hot_votes || 0 : interaction?.cold_votes || 0}</span>
                        <button onClick={() => onVote(item.id, activeVote, -1)} className="p-1 hover:bg-white/20 rounded-full"><MinusIcon className="w-4 h-4" /></button>
                    </div>
                 )}
            </div>
            <div className="flex-grow" />
            <button onClick={onComment} className="text-gray-500 hover:text-primary-light">Comentários ({item.comments?.length || 0})</button>
            {extraActions}
             <button onClick={() => onToggleRead(item.id, !!interaction?.is_read)} title={interaction?.is_read ? "Marcar como não lido" : "Marcar como lido"}>
                <EyeIcon className={`w-5 h-5 ${interaction?.is_read ? 'text-green-500' : 'text-gray-400'}`} />
            </button>
            <button onClick={() => onToggleFavorite(item.id, !!interaction?.is_favorite)} title={interaction?.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}>
                <StarIcon filled={!!interaction?.is_favorite} className={`w-5 h-5 ${interaction?.is_favorite ? 'text-yellow-500' : 'text-gray-400'}`} />
            </button>
        </div>
    );
};