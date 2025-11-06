
import React, { useState, useEffect, useRef } from 'react';
import { MainContentProps, LinkFile, Comment, ContentType } from '../../types';
import { Modal } from '../Modal';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentToolbar } from '../shared/ContentToolbar';
import { ContentActions } from '../shared/ContentActions';
import { useContentViewController } from '../../hooks/useContentViewController';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { addLinkFile, updateLinkFile, deleteLinkFile, updateContentComments, supabase } from '../../services/supabaseClient';
import { PlusIcon, PaperClipIcon, TrashIcon, CloudArrowUpIcon, DocumentTextIcon, LinkIcon, DownloadIcon } from '../Icons';

const AddLinkFileModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (payload: Partial<LinkFile>, file?: File) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTitle('');
            setDescription('');
            setUrl('');
            setFile(null);
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
                <button onClick={handleSubmit} disabled={isLoading} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50">
                    {isLoading ? "Adicionando..." : "Adicionar"}
                </button>
            </div>
        </Modal>
    );
};


// Fix: Added clearNavTarget to props to align with passed props from MainContent, resolving type error.
interface LinksFilesViewProps extends MainContentProps {
    allItems: (LinkFile & { user_id: string, created_at: string})[];
    clearNavTarget: () => void;
}

export const LinksFilesView: React.FC<LinksFilesViewProps> = (props) => {
    const { allItems, appData, setAppData, currentUser, updateUser } = props;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [commentingOn, setCommentingOn] = useState<LinkFile | null>(null);
    const [itemToDelete, setItemToDelete] = useState<LinkFile | null>(null);
    const contentType: ContentType = 'link_file';

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
                    <div className="mt-4 flex items-center gap-4">
                        {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => handleAccessContent(item)} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-sm font-semibold hover:bg-blue-200">
                                <LinkIcon className="w-4 h-4" /> Abrir Link
                            </a>
                        )}
                        {fileUrl && (
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

    return (
        <>
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
