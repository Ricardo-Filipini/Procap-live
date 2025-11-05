import React, { useState, useEffect } from 'react';
import { MainContentProps } from '../../types';
import { AudioSummary, Comment, ContentType, Source } from '../../types';
import { Modal } from '../Modal';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { updateContentComments, addSource, updateSource, supabase, addAudioSummary } from '../../services/supabaseClient';
import { PlusIcon } from '../Icons';

const AddMediaModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    setAppData: React.Dispatch<React.SetStateAction<MainContentProps['appData']>>,
    currentUser: MainContentProps['currentUser']
}> = ({ isOpen, onClose, setAppData, currentUser }) => {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const handleAdd = async () => {
        if (!file || !title.trim()) {
            alert("Por favor, preencha o título e anexe um arquivo.");
            return;
        }
        setIsLoading(true);
        try {
            const sourcePayload: Partial<Source> = {
                user_id: currentUser.id,
                title: title.trim(),
                summary: `Arquivo de mídia: ${file.name}`,
                original_filename: [file.name],
                storage_path: [],
                materia: 'Mídia',
                topic: 'Upload de Usuário',
                hot_votes: 0,
                cold_votes: 0,
                comments: []
            };
            const newSource = await addSource(sourcePayload);
            if (!newSource) throw new Error("Falha ao criar a fonte para a mídia.");

            const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const sanitizedName = sanitizeFileName(file.name);
            const filePath = `${currentUser.id}/media/${Date.now()}_${sanitizedName}`;
            const { error: uploadError } = await supabase!.storage.from('sources').upload(filePath, file);
            if (uploadError) throw uploadError;

            await updateSource(newSource.id, { storage_path: [filePath] });
            newSource.storage_path = [filePath];

            const { data: { publicUrl } } = supabase!.storage.from('sources').getPublicUrl(filePath);

            const audioPayload: Partial<AudioSummary> = {
                title: title.trim(),
                audioUrl: publicUrl,
                source_id: newSource.id,
                hot_votes: 0,
                cold_votes: 0,
                comments: []
            };
            const newAudio = await addAudioSummary(audioPayload);
            if (!newAudio) throw new Error("Falha ao salvar a mídia.");
            
            const newSourceWithContent: Source = {
                ...newSource,
                summaries: [], flashcards: [], questions: [], mind_maps: [],
                audio_summaries: [newAudio]
            };
            setAppData(prev => ({ ...prev, sources: [newSourceWithContent, ...prev.sources] }));
            onClose();

        } catch(error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setTitle("");
            setIsLoading(false);
        }
    }, [isOpen]);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Mídia">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Título</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Arquivo (Áudio ou Vídeo)</label>
                    <input type="file" accept="audio/*,video/mp4" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light/10 file:text-primary-light hover:file:bg-primary-light/20" />
                </div>
                <button onClick={handleAdd} disabled={isLoading} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50">
                    {isLoading ? "Adicionando..." : "Adicionar"}
                </button>
            </div>
        </Modal>
    );
};


// Fix: Removed the incompatible 'navTarget' override. The correct type is inherited from MainContentProps.
interface AudioSummariesViewProps extends MainContentProps {
    allItems: (AudioSummary & { user_id: string, created_at: string, source: any})[];
    clearNavTarget: () => void;
}

export const AudioSummariesView: React.FC<AudioSummariesViewProps> = ({ allItems, appData, setAppData, currentUser, updateUser, navTarget, clearNavTarget }) => {
    const [commentingOn, setCommentingOn] = useState<(AudioSummary & { user_id: string, created_at: string}) | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [fontSize, setFontSize] = useState(2);
    const contentType: ContentType = 'audio_summary';
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [navigationState, setNavigationState] = useState<{ targetId: string; groupKey: string } | null>(null);
    
    const {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        aiFilterIds, isFiltering,
        processedItems, handleAiFilter, handleClearFilter,
    } = useContentViewController(allItems, currentUser, appData, contentType);

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
                const element = document.getElementById(`media-${navigationState.targetId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setNavigationState(null);
                } else {
                     console.warn(`Navigation target element 'media-${navigationState.targetId}' not found in DOM.`);
                    setNavigationState(null);
                }
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [navigationState, openGroups]);

    const handleMediaPlay = (audioSummary: AudioSummary) => {
        const interaction = appData.userContentInteractions.find(
            i => i.user_id === currentUser.id && i.content_id === audioSummary.id && i.content_type === contentType
        );
        const isAlreadyRead = interaction?.is_read || false;

        if (!isAlreadyRead) {
            handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, audioSummary.id, { is_read: true });
        }
    };

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
        
        const success = await updateContentComments('audio_summaries', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, sources: prev.sources.map(s => s.id === updatedItem.source_id ? { ...s, audio_summaries: s.audio_summaries.map(as => as.id === updatedItem.id ? updatedItem : as) } : s) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const renderItem = (audio: AudioSummary & { user_id: string, created_at: string}) => {
        const author = appData.users.find(u => u.id === audio.source?.user_id);
        const authorName = author ? author.pseudonym : 'Edmercio';
        const createdAt = new Date(audio.source?.created_at || Date.now());
        const formattedDate = `${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        
        const filePath = audio.source?.storage_path?.[0];
        let mediaUrl: string | undefined;

        if (filePath && supabase) {
            const { data } = supabase.storage.from('sources').getPublicUrl(filePath);
            mediaUrl = data.publicUrl;
        } else {
            // Fallback for safety, in case source or storage_path is missing
            mediaUrl = audio.audioUrl;
        }

        return (
        <div id={`media-${audio.id}`} key={audio.id} className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
            <h3 className={`text-xl font-bold mb-2 ${FONT_SIZE_CLASSES[fontSize]}`}>{audio.title}</h3>
            <p className="text-xs text-gray-500 mb-4">Upload por {authorName} em {formattedDate}</p>
            {mediaUrl ? (
                mediaUrl.toLowerCase().includes('.mp4') ? (
                    <video controls className="w-full rounded-md max-h-72" onPlay={() => handleMediaPlay(audio)}>
                        <source src={mediaUrl} type="video/mp4" />
                        Seu navegador não suporta o elemento de vídeo.
                    </video>
                ) : (
                    <audio controls className="w-full" onPlay={() => handleMediaPlay(audio)}>
                        <source src={mediaUrl} type="audio/mpeg" />
                        Seu navegador não suporta este elemento de áudio.
                    </audio>
                )
            ) : (
                 <div className="w-full p-4 text-center bg-gray-100 dark:bg-gray-700 rounded-md">
                    <p className="text-sm text-gray-500">Mídia indisponível ou processando.</p>
                </div>
            )}
            <ContentActions
                item={audio} contentType={contentType} currentUser={currentUser} interactions={appData.userContentInteractions}
                onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                onComment={() => setCommentingOn(audio)}
            />
        </div>
    )};
    
    return(
        <>
            <AddMediaModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} setAppData={setAppData} currentUser={currentUser} />
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.title || ''}/>
            <div className="flex justify-between items-center mb-4">
                <ContentToolbar {...{ sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly, onAiFilter: handleAiFilter, onGenerate: undefined, isFiltering: !!aiFilterIds, onClearFilter: handleClearFilter }} />
                 <div className="flex flex-col gap-4">
                    <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-primary-light text-white font-semibold rounded-md hover:bg-indigo-600 flex items-center gap-2">
                        <PlusIcon className="w-5 h-5" /> Adicionar Mídia
                    </button>
                    <FontSizeControl fontSize={fontSize} setFontSize={setFontSize}/>
                </div>
            </div>
            
            <div className="space-y-4">
                {Array.isArray(processedItems) 
                    ? processedItems.map(renderItem)
                    : Object.entries(processedItems as Record<string, any[]>).map(([groupKey, items]: [string, any[]]) => (
                        <details key={groupKey} open={openGroups.has(groupKey)} onToggle={(e) => { e.preventDefault(); handleToggleGroup(groupKey); }} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
                             <summary className="text-xl font-bold cursor-pointer">{sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}</summary>
                            <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                                {items.map(renderItem)}
                            </div>
                        </details>
                    ))
                }
            </div>
        </>
    );
};
