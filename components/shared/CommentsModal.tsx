import React, { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { Comment } from '../../types';

export const CommentsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    comments: Comment[];
    onAddComment: (text: string) => void;
    onVoteComment: (commentId: string, voteType: 'hot' | 'cold') => void;
    contentTitle: string;
}> = ({ isOpen, onClose, comments, onAddComment, onVoteComment, contentTitle }) => {
    const [newComment, setNewComment] = useState("");
    const [sortOrder, setSortOrder] = useState<'time' | 'temp'>('temp');

    const handleAdd = () => {
        if (newComment.trim()) {
            onAddComment(newComment.trim());
            setNewComment("");
        }
    };
    
    const sortedComments = useMemo(() => {
        const commentsCopy = [...(comments || [])];
        if (sortOrder === 'time') {
            return commentsCopy.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else { // 'temp'
            return commentsCopy.sort((a, b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes));
        }
    }, [comments, sortOrder]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Comentários sobre "${contentTitle}"`}>
            <div className="flex justify-end items-center gap-2 mb-2 border-b border-border-light dark:border-border-dark pb-2">
                 <span className="text-sm font-semibold">Ordenar por:</span>
                 <button onClick={() => setSortOrder('temp')} title="Ordenar por temperatura" className={`p-1 rounded-md ${sortOrder === 'temp' ? 'bg-primary-light/20' : ''}`}><span className="text-xl">🌡️</span></button>
                 <button onClick={() => setSortOrder('time')} title="Ordenar por data" className={`p-1 rounded-md ${sortOrder === 'time' ? 'bg-primary-light/20' : ''}`}><span className="text-xl">🕐</span></button>
            </div>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {sortedComments.length > 0 ? sortedComments.map(comment => (
                    <div key={comment.id} className="bg-background-light dark:bg-background-dark p-3 rounded-lg">
                        <p className="font-bold text-sm">{comment.authorPseudonym}</p>
                        <p className="text-sm">{comment.text}</p>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-xs text-gray-500">{new Date(comment.timestamp).toLocaleString()}</p>
                            <div className="flex items-center gap-3">
                                <button onClick={() => onVoteComment(comment.id, 'hot')} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
                                    <span className="text-base">🔥</span> {comment.hot_votes || 0}
                                </button>
                                <button onClick={() => onVoteComment(comment.id, 'cold')} className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
                                    <span className="text-base">❄️</span> {comment.cold_votes || 0}
                                </button>
                            </div>
                        </div>
                    </div>
                )) : <p className="text-gray-500">Nenhum comentário ainda. Seja o primeiro!</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicione seu comentário..."
                    className="w-full h-20 p-2 border rounded-md bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark"
                />
                <button onClick={handleAdd} className="mt-2 w-full bg-primary-light text-white py-2 rounded-md hover:bg-indigo-600">
                    Enviar Comentário
                </button>
            </div>
        </Modal>
    );
};
