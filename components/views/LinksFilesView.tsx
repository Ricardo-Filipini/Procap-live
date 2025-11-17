
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MainContentProps, LinkFile, Comment, ContentType } from '../../types';
import { Modal } from '../Modal';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { addLinkFile, updateLinkFile, deleteLinkFile, updateContentComments, supabase, getLinksFiles } from '../../services/supabaseClient';
import { PlusIcon, PaperClipIcon, TrashIcon, CloudArrowUpIcon, DocumentTextIcon, LinkIcon, DownloadIcon, SparklesIcon } from '../Icons';

const AnkiStudyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    deck: LinkFile | null;
}> = ({ isOpen, onClose, deck }) => {
    const [cards, setCards] = useState<{ front: string; back: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        const fetchAndParseDeck = async () => {
            if (!deck || !deck.file_path) return;
            setIsLoading(true);
            try {
                const { data, error } = await supabase!.storage.from('files').download(deck.file_path);
                if (error) throw error;
                const text = await data.text();
                
                const cleanText = text.startsWith('\uFEFF') ? text.substring(1) : text;

                const lines = cleanText.split('\n').filter(line => !line.startsWith('#') && line.trim() !== '');
                
                const parsedCards = lines.map(line => {
                    const parts = line.split('\t');
                    const front = parts.shift()?.trim().replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                    const back = parts.join('\t').trim().replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                    return { front, back };
                }).filter(card => card.front && card.back);
                
                for (let i = parsedCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [parsedCards[i], parsedCards[j]] = [parsedCards[j], parsedCards[i]];
                }

                setCards(parsedCards);
                setCurrentCardIndex(0);
                setIsFlipped(false);
            } catch (error) {
                console.error("Failed to load or parse Anki deck:", error);
                setCards([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchAndParseDeck();
        }
    }, [isOpen, deck]);
    
    const currentCard = cards[currentCardIndex];

    const goToCard = (index: number) => {
        if (index >= 0 && index < cards.length) {
            setIsFlipped(false);
            setCurrentCardIndex(index);
        }
    };
    
    const handleNext = () => goToCard(currentCardIndex + 1);
    const handlePrev = () => goToCard(currentCardIndex - 1);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Estudando: ${deck?.title || 'Deck Anki'}`}>
            {isLoading ? (
                <div className="text-center p-8">Carregando deck...</div>
            ) : !currentCard ? (
                <div className="text-center p-8">Nenhum card encontrado neste deck. Verifique o formato do arquivo.</div>
            ) : (
                <div className="flex flex-col min-h-[60vh]">
                    <div className="text-center text-sm text-gray-500 mb-4">{currentCardIndex + 1} / {cards.length}</div>
                    
                    <div className="flex-grow flex items-center justify-center [perspective:1000px]">
                        <div 
                             onClick={() => setIsFlipped(f => !f)}
                             className={`relative w-full h-full min-h-[300px] cursor-pointer [transform-style:preserve-3d] transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                        >
                            <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center p-6 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark">
                                <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
                            </div>
                            <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex items-center justify-center p-6 bg-blue-100 dark:bg-blue-900/50 rounded-lg border border-blue-300 dark:border-blue-700">
                                 <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex flex-col items-center gap-4">
                        {!isFlipped ? (
                            <button onClick={() => setIsFlipped(true)} className="px-6 py-2 bg-primary-light text-white font-semibold rounded-md w-full md:w-auto">
                                Mostrar Resposta
                            </button>
                        ) : (
                            <div className="w-full flex justify-center gap-4">
                                <button onClick={handleNext} className="px-6 py-2 bg-red-500 text-white font-semibold rounded-md">Errei</button>
                                <button onClick={handleNext} className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-md">Bom</button>
                                <button onClick={handleNext} className="px-6 py-2 bg-green-500 text-white font-semibold rounded-md">Fácil</button>
                            </div>
                        )}
                         <div className="flex justify-between w-full">
                            <button onClick={handlePrev} disabled={currentCardIndex === 0} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-50">
                                Anterior
                            </button>
                            <button onClick={handleNext} disabled={currentCardIndex === cards.length - 1} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-50">
                                Próximo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const AddLinkFileModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (payload: Partial<LinkFile>, file?: File) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isAnkiDeck, setIsAnkiDeck] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTitle('');
            setDescription('');
            setUrl('');
            setFile(null);
            setIsAnkiDeck(false);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (!title.trim() || (!url.trim() && !file)) {
            alert('O título é obrigatório, e você deve fornecer um link ou um arquivo.');
            return;
        }
        setIsLoading(true);
        const payload: Partial<LinkFile> = {
            title: title.trim(),
            description: description.trim(),
            url: url.trim() || undefined,
            file_name: file?.name,
            is_anki_deck: isAnkiDeck,
        };
        onAdd(payload, file || undefined);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Link ou Arquivo">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Título *</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Descrição</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">URL do Link</label>
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" disabled={!!file} className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md disabled:opacity-50" />
                </div>
                <div className="text-center font-semibold text-gray-500">OU</div>
                <div>
                    <label className="block text-sm font-medium mb-1">Anexar Arquivo</label>
                    <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} disabled={!!url.trim()} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light/10 file:text-primary-light hover:file:bg-primary-light/20 disabled:opacity-50" />
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="is-anki-deck" 
                        checked={isAnkiDeck} 
                        onChange={e => setIsAnkiDeck(e.target.checked)} 
                        disabled={!file}
                        className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light disabled:opacity-50"
                    />
                    <label htmlFor="is-anki-deck" className={`text-sm cursor-pointer ${!file ? 'text-gray-400' : ''}`}>Marcar como Deck Anki (.txt)</label>
                </div>
                <button onClick={handleSubmit} disabled={isLoading} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50">
                    {isLoading ? "Adicionando..." : "Adicionar"}
                </button>
            </div>
        </Modal>
    );
};


interface LinksFilesViewProps extends MainContentProps {
    clearNavTarget: () => void;
}

export const LinksFilesView: React.FC<LinksFilesViewProps> = (props) => {
    const { appData, setAppData, currentUser, updateUser } = props;
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [commentingOn, setCommentingOn] = useState<LinkFile | null>(null);
    const [itemToDelete, setItemToDelete] = useState<LinkFile | null>(null);
    const [studyingDeck, setStudyingDeck] = useState<LinkFile | null>(null);
    const contentType: ContentType = 'link_file';

     useEffect(() => {
        if (appData.linksFiles.length === 0) {
            setIsLoadingContent(true);
            getLinksFiles().then(linksFiles => {
                setAppData(prev => ({ ...prev, linksFiles }));
                setIsLoadingContent(false);
            }).catch(() => setIsLoadingContent(false));
        }
    }, [appData.linksFiles.length, setAppData]);
    
    const allItems = useMemo(() => appData.linksFiles.map(lf => ({...lf, user_id: lf.user_id, created_at: lf.created_at})), [appData.linksFiles]);

    const {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        processedItems,
    } = useContentViewController(allItems, currentUser, appData, contentType, 'temp');

    const handleAccessContent = (item: LinkFile) => {
        const interaction = appData.userContentInteractions.find(
            i => i.user_id === currentUser.id && i.content_id === item.id && i.content_type === contentType
        );
        const isAlreadyRead = interaction?.is_read || false;

        if (!isAlreadyRead) {
            handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, item.id, { is_read: true });
        }
    };

    const handleAddItem = async (payload: Partial<LinkFile>, file?: File) => {
        let finalPayload = { ...payload, user_id: currentUser.id, comments: [], hot_votes: 0, cold_votes: 0 };

        if (file) {
            const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${currentUser.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
            const { error: uploadError } = await supabase!.storage.from('files').upload(filePath, file);
            if (uploadError) {
                alert(`Erro no upload: ${uploadError.message}`);
                setIsAddModalOpen(false);
                return;
            }
            finalPayload.file_path = filePath;
        }

        const newItem = await addLinkFile(finalPayload);
        if (newItem) {
            setAppData(prev => ({ ...prev, linksFiles: [newItem, ...prev.linksFiles] }));
        }
        setIsAddModalOpen(false);
    };

    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        const success = await deleteLinkFile(itemToDelete.id, itemToDelete.file_path);
        if (success) {
            setAppData(prev => ({ ...prev, linksFiles: prev.linksFiles.filter(item => item.id !== itemToDelete.id) }));
        } else {
            alert("Falha ao deletar o item.");
        }
        setItemToDelete(null);
    };

    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOn) return;
        let updatedComments = [...commentingOn.comments];
        if (action === 'add') {
            updatedComments.push({ id: `c_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 });
        } else if (action === 'vote') {
            const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) updatedComments[commentIndex][`${payload.voteType}_votes`] += 1;
        }
        
        const success = await updateContentComments('links_files', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = { ...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, linksFiles: prev.linksFiles.map(item => item.id === updatedItem.id ? updatedItem : item) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const renderItem = (item: LinkFile) => {
        const author = appData.users.find(u => u.id === item.user_id);
        let fileUrl: string | null = null;
        if (item.file_path) {
            const { data } = supabase!.storage.from('files').getPublicUrl(item.file_path);
            fileUrl = data.publicUrl;
        }

        return (
            <div key={item.id} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-xs text-gray-500 mb-2">por {author?.pseudonym || 'Desconhecido'} em {new Date(item.created_at).toLocaleDateString()}</p>
                    {item.description && <p className="text-sm my-2">{item.description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        {item.is_anki_deck && fileUrl && (
                             <button onClick={() => setStudyingDeck(item)} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded-full text-sm font-semibold hover:bg-purple-200">
                                <SparklesIcon className="w-4 h-4" /> Estudar Deck
                            </button>
                        )}
                        {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => handleAccessContent(item)} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-sm font-semibold hover:bg-blue-200">
                                <LinkIcon className="w-4 h-4" /> Abrir Link
                            </a>
                        )}
                        {fileUrl && !item.is_anki_deck && (
                            <a href={fileUrl} download={item.file_name} onClick={() => handleAccessContent(item)} className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-full text-sm font-semibold hover:bg-green-200">
                                <DownloadIcon className="w-4 h-4" /> Baixar Arquivo
                            </a>
                        )}
                    </div>
                </div>
                <ContentActions
                    item={item} contentType={contentType} currentUser={currentUser} interactions={appData.userContentInteractions}
                    onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                    onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                    onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                    onComment={() => setCommentingOn(item)}
                    extraActions={
                        (currentUser.id === item.user_id || currentUser.pseudonym === 'admin') && (
                            <button onClick={() => setItemToDelete(item)} title="Deletar" className="text-gray-400 hover:text-red-500">
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        )
                    }
                />
            </div>
        );
    };

    if (isLoadingContent) {
        return <div className="text-center p-8">Carregando links e arquivos...</div>;
    }

    return (
        <>
            <AnkiStudyModal isOpen={!!studyingDeck} onClose={() => setStudyingDeck(null)} deck={studyingDeck} />
            <AddLinkFileModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddItem} />
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.title || ''}/>
            {itemToDelete && <Modal isOpen={true} onClose={() => setItemToDelete(null)} title="Confirmar Exclusão">
                <p>Tem certeza que deseja excluir "{itemToDelete.title}"? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setItemToDelete(null)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700">Cancelar</button>
                    <button onClick={handleDeleteItem} className="px-4 py-2 rounded-md bg-red-600 text-white">Excluir</button>
                </div>
            </Modal>}

            <div className="flex justify-between items-center mb-6">
                 <ContentToolbar 
                    sort={sort} setSort={setSort} 
                    filter={filter} setFilter={setFilter}
                    favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}
                    supportedSorts={['temp', 'time', 'user']}
                 />
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white font-semibold rounded-md hover:bg-indigo-600">
                    <PaperClipIcon className="w-5 h-5" /> Adicionar
                </button>
            </div>

            <div className="space-y-4">
                {Array.isArray(processedItems) 
                    ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{processedItems.map(renderItem)}</div>
                    : Object.entries(processedItems as Record<string, LinkFile[]>).map(([groupKey, items]) => (
                        <details key={groupKey} open className="p-4 rounded-lg">
                            <summary className="text-2xl font-bold cursor-pointer mb-4">
                                {sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}
                            </summary>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {items.map(renderItem)}
                            </div>
                        </details>
                    ))
                }
            </div>
        </>
    );
};
