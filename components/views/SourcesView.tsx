

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MainContentProps } from '../../types';
import { Source } from '../../types';
import { CloudArrowUpIcon, DocumentTextIcon, PencilIcon, PlusIcon, SparklesIcon, TrashIcon, MinusIcon, DownloadIcon } from '../Icons';
import { Modal } from '../Modal';
import { processAndGenerateAllContentFromSource, generateImageForMindMap, generateMoreMindMapTopicsFromSource, generateMoreQuestionsFromSource, generateMoreSummariesFromSource, generateMoreFlashcardsFromSource } from '../../services/geminiService';
// FIX: Replaced incrementVoteCount with incrementSourceVote for type safety and correctness.
import { addSource, addGeneratedContent, updateSource, deleteSource, upsertUserVote, incrementSourceVote, updateUser as supabaseUpdateUser, updateContentComments, appendGeneratedContentToSource, addSourceComment } from '../../services/supabaseClient';
import { supabase } from '../../services/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import { CommentsModal } from '../shared/CommentsModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@^4.4.168/build/pdf.worker.mjs`;

type SortOption = 'temp' | 'time' | 'subject' | 'user' | 'source';

const ContentToolbar: React.FC<{
    sort: SortOption, setSort: (s: SortOption) => void,
    supportedSorts?: SortOption[],
}> = ({ sort, setSort, supportedSorts }) => {
    
    const allSorts: Record<SortOption, { title: string, icon: string }> = {
        temp: { title: "Temperatura", icon: "🌡️" },
        time: { title: "Data", icon: "🕐" },
        subject: { title: "Matéria", icon: "📚" },
        user: { title: "Usuário", icon: "👤" },
        source: { title: "Fonte", icon: "📄" },
    };

    const availableSorts = supportedSorts ? supportedSorts.map(s => ({ key: s, ...allSorts[s] })) : Object.entries(allSorts).map(([key, value]) => ({ key: key as SortOption, ...value }));
    
    return (
        <div className="bg-card-light dark:bg-card-dark p-2 rounded-lg shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4 text-sm">
            <span className="font-semibold">Ordenar por:</span>
            <div className="flex items-center gap-0">
                    {availableSorts.map(s => (
                    <div key={s.key} className="flex flex-col items-center justify-start h-10 w-10">
                        <button 
                            onClick={() => setSort(s.key)} 
                            title={s.title} 
                            className={`p-1.5 rounded-full transition-colors ${sort === s.key ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            <span className="text-xl">{s.icon}</span>
                        </button>
                        <div className="h-4 mt-1">
                            {sort === s.key && (
                                <span className="text-xs font-semibold text-primary-light dark:text-primary-dark whitespace-nowrap">
                                    {s.title}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AddSourceModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onProcess: (files: FileList, title: string, prompt: string) => void;
}> = ({ isOpen, onClose, onProcess }) => {
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(e.dataTransfer.files);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
        }
    };

    const handleProcessClick = () => {
        if (files) {
            onProcess(files, title.trim(), prompt.trim());
            onClose();
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setFiles(null);
            setTitle('');
            setPrompt('');
            setIsDragging(false);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Nova Fonte de Estudo">
            <div className="space-y-4">
                <p className="text-sm">Envie um ou mais arquivos (.pdf, .docx, .txt) para que a IA extraia o conteúdo e gere materiais de estudo. Você pode fornecer um nome e um prompt para guiar a IA.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="sourceTitle">
                        Nome da Fonte (Opcional)
                    </label>
                    <input
                        id="sourceTitle"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                        placeholder="A IA criará um nome se este campo for deixado em branco"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="sourcePrompt">
                        Prompt para a IA (Opcional)
                    </label>
                    <textarea
                        id="sourcePrompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                        placeholder="Ex: 'Foco em análise de risco de crédito e regulamentação do SFN'"
                    />
                </div>

                <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary-light bg-primary-light/10' : 'border-border-light dark:border-border-dark hover:border-primary-light/50'}`}
                >
                    <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mb-2"/>
                    <p className="font-semibold">Arraste e solte os arquivos aqui</p>
                    <p className="text-sm text-gray-500">ou clique para selecionar</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".pdf,.docx,.txt,.md" className="hidden"/>
                </div>
                {files && (
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Arquivos Selecionados:</h4>
                        <ul className="text-xs list-disc list-inside bg-background-light dark:bg-background-dark p-2 rounded-md">
                            {/* FIX: Explicitly type `f` as `File` to allow access to `.name` property. */}
                            {Array.from(files).map((f: File) => <li key={f.name}>{f.name}</li>)}
                        </ul>
                    </div>
                )}
                <button onClick={handleProcessClick} disabled={!files} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 flex items-center justify-center gap-2">
                   <SparklesIcon className="w-5 h-5"/> Processar e Gerar Conteúdo
                </button>
            </div>
        </Modal>
    );
};

type SourcesViewProps = Pick<MainContentProps, 'appData' | 'setAppData' | 'currentUser' | 'updateUser' | 'processingTasks' | 'setProcessingTasks'>

export const SourcesView: React.FC<SourcesViewProps> = ({ appData, setAppData, currentUser, updateUser, processingTasks, setProcessingTasks }) => {
    const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
    const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
    const [sourceToRename, setSourceToRename] = useState<Source | null>(null);
    const [newSourceName, setNewSourceName] = useState("");
    const [sort, setSort] = useState<SortOption>('temp');
    const [commentingOn, setCommentingOn] = useState<Source | null>(null);
    const [activeVote, setActiveVote] = useState<{ sourceId: string; type: 'hot' | 'cold' } | null>(null);
    const [generatingMore, setGeneratingMore] = useState<{ sourceId: string, type: 'summaries' | 'flashcards' | 'questions' | 'mind_maps' } | null>(null);
    const votePopupRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (votePopupRef.current && !votePopupRef.current.contains(event.target as Node)) {
                setActiveVote(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const extractTextFromFile = async (file: File): Promise<string> => {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += (content.items as any[]).map(item => item.str).join(' ');
            }
            return text;
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } else if (file.type === 'text/plain' || file.type === 'text/markdown') {
            return file.text();
        }
        throw new Error(`Unsupported file type: ${file.type}`);
    };

    const handleProcessFiles = async (files: FileList, title: string, prompt: string) => {
        // Fix: Explicitly type `fileArray` as `File[]` to resolve type inference issues where properties on `File` objects (like `.name`) were not being recognized.
        const fileArray: File[] = Array.from(files);
        const taskId = `task_batch_${Date.now()}`;
        setProcessingTasks(prev => [...prev, { id: taskId, name: `${fileArray.length} arquivo(s)`, message: 'Iniciando processamento...', status: 'processing' }]);

        try {
            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Extraindo texto dos arquivos...' } : t));
            const textPromises = fileArray.map(extractTextFromFile);
            const texts = await Promise.all(textPromises);
            const fullText = texts.join('\n\n---\n\n');

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Analisando e gerando conteúdo com IA...' } : t));
            const existingTopics = appData.sources.map(s => ({ materia: s.materia, topic: s.topic }));
            const generated = await processAndGenerateAllContentFromSource(fullText, existingTopics, prompt);
            if (generated.error) throw new Error(generated.error);
            
            const finalTitle = title || generated.title;

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Salvando nova fonte...' } : t));
            const sourcePayload: Partial<Source> = {
                user_id: currentUser.id,
                title: finalTitle,
                summary: generated.summary,
                original_filename: fileArray.map((f: File) => f.name),
                storage_path: [],
                materia: generated.materia,
                topic: generated.topic,
                hot_votes: 0,
                cold_votes: 0,
                comments: []
            };
            const newSource = await addSource(sourcePayload);
            if (!newSource) throw new Error("Falha ao criar a fonte no banco de dados.");

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Salvando conteúdo gerado...' } : t));
            const mindMapPrompts = generated.mindMapTopics || [];
            const mindMapPromises = mindMapPrompts.map(async (topic: {title: string, prompt: string}) => {
                const { base64Image } = await generateImageForMindMap(topic.prompt);
                if (base64Image) {
                    const imageBlob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();
                    const imagePath = `${currentUser.id}/mindmaps/${newSource.id}_${topic.title.replace(/\s/g, '_')}.png`;
                    const { error } = await supabase!.storage.from('sources').upload(imagePath, imageBlob);
                    if (error) {
                        console.error("Failed to upload mind map image:", error);
                        return null;
                    }
                    const { data: { publicUrl } } = supabase!.storage.from('sources').getPublicUrl(imagePath);
                    return { title: topic.title, imageUrl: publicUrl };
                }
                return null;
            });
            
            const resolvedMindMaps = (await Promise.all(mindMapPromises)).filter((m): m is { title: string, imageUrl: string } => m !== null);
            
            const contentToSave = {
                summaries: generated.summaries,
                flashcards: generated.flashcards,
                questions: generated.questions,
                mind_maps: resolvedMindMaps
            };

            const createdContent = await addGeneratedContent(newSource.id, contentToSave);
            if (!createdContent) throw new Error("Falha ao salvar o conteúdo gerado.");

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Enviando arquivos originais...' } : t));
            const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const uploadPromises = fileArray.map(async (file: File) => {
                const filePath = `${currentUser.id}/${newSource.id}_${sanitizeFileName(file.name)}`;
                const { error } = await supabase!.storage.from('sources').upload(filePath, file);
                if (error) throw error;
                return filePath;
            });
            const storagePaths = await Promise.all(uploadPromises);

            await updateSource(newSource.id, { storage_path: storagePaths });

            const finalSource: Source = {
                ...newSource,
                title: finalTitle,
                summary: generated.summary,
                original_filename: fileArray.map((f: File) => f.name),
                storage_path: storagePaths,
                materia: generated.materia,
                topic: generated.topic,
                summaries: createdContent.summaries,
                flashcards: createdContent.flashcards,
                questions: createdContent.questions,
                mind_maps: createdContent.mind_maps,
                audio_summaries: []
            };
            
            setAppData(prev => ({ ...prev, sources: [finalSource, ...prev.sources] }));
            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: 'Processamento concluído com sucesso!', status: 'success' } : t));
        
        } catch (error: any) {
            console.error(`Failed to process files:`, error);
            setProcessingTasks(prev => prev.map(t => t.id === taskId ? { ...t, message: `Erro: ${error.message}`, status: 'error' } : t));
        }
    };
    
    const handleGenerateMore = async (source: Source, type: 'summaries' | 'flashcards' | 'questions' | 'mind_maps') => {
        if (generatingMore) return;
        setGeneratingMore({ sourceId: source.id, type });

        try {
            let fullText = "";
            if (source.storage_path && source.storage_path.length > 0) {
                const textPromises = source.storage_path.map(async (path, index) => {
                    const { data: blob, error } = await supabase!.storage.from('sources').download(path);
                    if (error || !blob) {
                        throw new Error(`Falha ao baixar o arquivo: ${path}`);
                    }
                    const filename = (source.original_filename || [])[index] || 'file';
                    const file = new File([blob], filename, { type: blob.type });
                    return extractTextFromFile(file);
                });
                fullText = (await Promise.all(textPromises)).join('\n\n---\n\n');
            } else {
                throw new Error("Nenhum arquivo encontrado para esta fonte.");
            }
            
            if (type === 'mind_maps') {
                const existingTitles = source.mind_maps.map(m => m.title);
                const newTopics = await generateMoreMindMapTopicsFromSource(fullText, existingTitles);

                if (newTopics.length === 0) {
                    alert("A IA não encontrou novos tópicos para Mapas Mentais.");
                    return;
                }

                const mindMapPromises = newTopics.map(async (topic) => {
                    const { base64Image } = await generateImageForMindMap(topic.prompt);
                    if (base64Image) {
                        const imageBlob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();
                        const imagePath = `${currentUser.id}/mindmaps/${source.id}_${topic.title.replace(/\s/g, '_')}_${Date.now()}.png`;
                        const { error } = await supabase!.storage.from('sources').upload(imagePath, imageBlob);
                        if (error) return null;
                        const { data: { publicUrl } } = supabase!.storage.from('sources').getPublicUrl(imagePath);
                        return { title: topic.title, imageUrl: publicUrl };
                    }
                    return null;
                });

                const resolvedMindMaps = (await Promise.all(mindMapPromises)).filter((m): m is { title: string, imageUrl: string } => m !== null);
                const appendedContent = await appendGeneratedContentToSource(source.id, { mind_maps: resolvedMindMaps });
                
                if (!appendedContent || !appendedContent.newMindMaps) throw new Error("Falha ao salvar os novos mapas mentais.");
                
                setAppData(prev => ({
                    ...prev,
                    sources: prev.sources.map(s => s.id === source.id ? { ...s, mind_maps: [...s.mind_maps, ...appendedContent.newMindMaps] } : s)
                }));
            } else {
                let newGenerated: any;
                const userPrompt = undefined; // No UI for this yet, but the function supports it.

                if (type === 'questions') {
                    newGenerated = await generateMoreQuestionsFromSource(fullText, source.questions, userPrompt);
                } else if (type === 'summaries') {
                    newGenerated = await generateMoreSummariesFromSource(fullText, source.summaries, userPrompt);
                } else if (type === 'flashcards') {
                    newGenerated = await generateMoreFlashcardsFromSource(fullText, source.flashcards, userPrompt);
                }

                if (!newGenerated || newGenerated.error) throw new Error(newGenerated?.error || "A geração de conteúdo falhou.");
                
                const newContentArray = newGenerated[type];
                if (!newContentArray || newContentArray.length === 0) {
                    alert("A IA não encontrou nenhum conteúdo inédito para adicionar.");
                    return;
                }

                const contentToAppend = { [type]: newContentArray };
                const appendedContent = await appendGeneratedContentToSource(source.id, contentToAppend);
                if (!appendedContent) throw new Error("Falha ao salvar o novo conteúdo no banco de dados.");
                
                setAppData(prev => {
                    const newSources = prev.sources.map(s => {
                        if (s.id === source.id) {
                            const key = `new${type.charAt(0).toUpperCase() + type.slice(1)}`;
                            const newItems = appendedContent[key as keyof typeof appendedContent];
                            
                            let formattedItems = newItems;
                            if (type === 'questions' && Array.isArray(newItems)) {
                                formattedItems = newItems.map((q: any) => ({...q, questionText: q.question_text, correctAnswer: q.correct_answer}));
                            }
                            
                            const existingContent = s[type] || [];
                            return {
                                ...s,
                                [type]: [...existingContent, ...formattedItems],
                            };
                        }
                        return s;
                    });
                    return { ...prev, sources: newSources };
                });
            }
        } catch (error: any) {
            console.error("Error generating more content:", error);
            alert(`Falha ao gerar mais conteúdo: ${error.message}`);
        } finally {
            setGeneratingMore(null);
        }
    };


    const handleDeleteSource = async () => {
        if (!sourceToDelete) return;
        const success = await deleteSource(sourceToDelete.id, sourceToDelete.storage_path);
        if (success) {
            setAppData(prev => ({
                ...prev,
                sources: prev.sources.filter(s => s.id !== sourceToDelete.id)
            }));
        } else {
            alert("Falha ao deletar a fonte.");
        }
        setSourceToDelete(null);
    };

    const handleRenameSource = async () => {
        if (!sourceToRename || !newSourceName.trim()) return;
        const result = await updateSource(sourceToRename.id, { title: newSourceName.trim() });
        if (result) {
            setAppData(prev => ({
                ...prev,
                sources: prev.sources.map(s => s.id === sourceToRename.id ? { ...s, title: newSourceName.trim() } : s)
            }));
        }
        setSourceToRename(null);
    };

    const handleSourceVote = async (sourceId: string, type: 'hot' | 'cold', increment: 1 | -1) => {
        const userVote = appData.userSourceVotes.find(v => v.user_id === currentUser.id && v.source_id === sourceId);
        const currentVoteCount = (type === 'hot' ? userVote?.hot_votes : userVote?.cold_votes) || 0;
        if (increment === -1 && currentVoteCount <= 0) return;

        setAppData(prev => {
            const newVotes = prev.userSourceVotes.map(v => (v.user_id === currentUser.id && v.source_id === sourceId) ? { ...v, [`${type}_votes`]: (v[`${type}_votes`] || 0) + increment } : v);
            if (!newVotes.some(v => v.user_id === currentUser.id && v.source_id === sourceId)) {
                 newVotes.push({ id: `temp_src_vote_${Date.now()}`, user_id: currentUser.id, source_id: sourceId, hot_votes: type === 'hot' ? increment : 0, cold_votes: type === 'cold' ? increment : 0 });
            }
            const newSources = prev.sources.map(s => s.id === sourceId ? { ...s, [`${type}_votes`]: s[`${type}_votes`] + increment } : s);
            return { ...prev, userSourceVotes: newVotes, sources: newSources };
        });

        await upsertUserVote('user_source_votes', { user_id: currentUser.id, source_id: sourceId, hot_votes_increment: type === 'hot' ? increment : 0, cold_votes_increment: type === 'cold' ? increment : 0 }, ['user_id', 'source_id']);
        // FIX: Replaced the generic incrementVoteCount with the specific incrementSourceVote function.
        await incrementSourceVote(sourceId, `${type}_votes`, increment);
        
        const source = appData.sources.find(s => s.id === sourceId);
        if (source && source.user_id !== currentUser.id) {
            const author = appData.users.find(u => u.id === source.user_id);
            if (author) {
                const xpChange = (type === 'hot' ? 1 : -1) * increment;
                // FIX: Defensively cast `author.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
                const updatedAuthor = { ...author, xp: Math.max(0, (Number(author.xp) || 0) + xpChange) };
                const result = await supabaseUpdateUser(updatedAuthor);
                if (result) {
                    setAppData(prev => ({ ...prev, users: prev.users.map(u => u.id === result.id ? result : u) }));
                }
            }
        }
    };
    
    const sortedSources = useMemo(() => {
        let sources: Source[] = [...appData.sources].filter(s => s.materia !== 'Mídia');
        
        const sortByTemp = (a: Source, b: Source) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes);

        switch (sort) {
            case 'time':
                return sources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            case 'temp':
                return sources.sort(sortByTemp);
            case 'subject':
            case 'user':
                const groupKey = sort === 'subject' ? 'materia' : 'user_id';
                const grouped = sources.reduce((acc, s) => {
                    const key = s[groupKey as keyof Source] as string || (sort === 'subject' ? 'Outros' : 'Desconhecido');
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(s);
                    return acc;
                }, {} as Record<string, Source[]>);
                Object.values(grouped).forEach(group => group.sort(sortByTemp));
                return grouped;
            default:
                return sources;
        }
    }, [appData.sources, sort]);

    const renderSourceItem = (source: Source) => {
        const userVote = appData.userSourceVotes.find(v => v.user_id === currentUser.id && v.source_id === source.id);
        const author = appData.users.find(u => u.id === source.user_id);
        const isOwner = currentUser.id === source.user_id || currentUser.pseudonym === 'admin';

        return (
            <details key={source.id} className="bg-background-light dark:bg-background-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                <summary className="cursor-pointer">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold">{source.title}</h3>
                            <p className="text-sm text-gray-500">
                                {source.materia} &gt; {source.topic} | por: {author?.pseudonym || 'Desconhecido'}
                            </p>
                        </div>
                         <div className="flex items-center gap-4 relative text-sm">
                             <div className="flex items-center gap-3 relative">
                                <button onClick={(e) => { e.preventDefault(); setActiveVote({ sourceId: source.id, type: 'hot' }); }} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
                                    <span className="text-lg">🔥</span> {source.hot_votes || 0}
                                </button>
                                <button onClick={(e) => { e.preventDefault(); setActiveVote({ sourceId: source.id, type: 'cold' }); }} className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
                                    <span className="text-lg">❄️</span> {source.cold_votes || 0}
                                </button>
                                {activeVote?.sourceId === source.id && (
                                     <div ref={votePopupRef} className="absolute -top-12 -left-2 z-10 bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center p-1 gap-1 shadow-lg">
                                        <button onClick={(e) => { e.stopPropagation(); handleSourceVote(source.id, activeVote.type, 1); }} className="p-1 hover:bg-white/20 rounded-full"><PlusIcon className="w-4 h-4" /></button>
                                        <span className="text-sm font-bold w-4 text-center">{activeVote.type === 'hot' ? userVote?.hot_votes || 0 : userVote?.cold_votes || 0}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleSourceVote(source.id, activeVote.type, -1); }} className="p-1 hover:bg-white/20 rounded-full"><MinusIcon className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                            <button onClick={(e) => { e.preventDefault(); setCommentingOn(source); }} className="text-gray-500 hover:text-primary-light">Comentários ({source.comments?.length || 0})</button>
                            {isOwner && (
                                <>
                                <button onClick={(e) => { e.preventDefault(); setSourceToRename(source); setNewSourceName(source.title); }} title="Renomear" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><PencilIcon className="w-4 h-4"/></button>
                                <button onClick={(e) => { e.preventDefault(); setSourceToDelete(source); }} title="Deletar" className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500"><TrashIcon className="w-4 h-4"/></button>
                                </>
                            )}
                        </div>
                    </div>
                </summary>
                <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                    <p className="text-sm">{source.summary}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(['summaries', 'flashcards', 'questions', 'mind_maps'] as const).map(type => {
                            const count = (source[type] as any[] | undefined)?.length || 0;
                            const typeNameMap = { summaries: 'Resumos', flashcards: 'Flashcards', questions: 'Questões', mind_maps: 'Mapas' };
                            const isGeneratingThis = generatingMore?.sourceId === source.id && generatingMore?.type === type;
                            return (
                                <div key={type} className="bg-card-light dark:bg-card-dark p-3 rounded-lg border border-border-light dark:border-border-dark flex flex-col justify-between">
                                    <p className="font-semibold">{typeNameMap[type]}: {count}</p>
                                    <button onClick={() => handleGenerateMore(source, type)} disabled={isGeneratingThis} className="text-sm text-primary-light dark:text-primary-dark hover:underline mt-2 disabled:opacity-50 flex items-center gap-1">
                                        {isGeneratingThis ? 'Gerando...' : <><SparklesIcon className="w-4 h-4" /> Gerar mais</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                     {source.original_filename && source.original_filename.length > 0 && (
                        <div className="pt-4 border-t border-border-light dark:border-border-dark">
                            <h4 className="font-semibold text-sm mb-2">Arquivos Originais</h4>
                            <div className="flex flex-col items-start gap-2">
                                {source.original_filename.map((filename, index) => {
                                    const path = source.storage_path?.[index];
                                    if (!path || !supabase) return null;
                                    const { data: { publicUrl } } = supabase.storage.from('sources').getPublicUrl(path);

                                    return (
                                        <a key={index} href={publicUrl} download={filename} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary-light hover:underline">
                                            <DownloadIcon className="w-4 h-4" />
                                            {filename}
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </details>
        );
    };

    return (
        <>
            <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onProcess={handleProcessFiles} />
            {sourceToDelete && <Modal isOpen={true} onClose={() => setSourceToDelete(null)} title="Confirmar Exclusão">
                <p>Tem certeza que deseja excluir a fonte "{sourceToDelete.title}" e todo o seu conteúdo? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setSourceToDelete(null)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700">Cancelar</button>
                    <button onClick={handleDeleteSource} className="px-4 py-2 rounded-md bg-red-600 text-white">Excluir</button>
                </div>
            </Modal>}
            {sourceToRename && <Modal isOpen={true} onClose={() => setSourceToRename(null)} title="Renomear Fonte">
                <input type="text" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} className="w-full p-2 border rounded-md bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark" />
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setSourceToRename(null)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700">Cancelar</button>
                    <button onClick={handleRenameSource} className="px-4 py-2 rounded-md bg-primary-light text-white">Salvar</button>
                </div>
            </Modal>}
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} contentTitle={commentingOn?.title || ''}
                onAddComment={async (text) => {
                    if (!commentingOn) return;
                    const newComment = { id: `c_src_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 };
                    const updatedSource = await addSourceComment(commentingOn, newComment);
                    if(updatedSource) {
                        setAppData(prev => ({...prev, sources: prev.sources.map(s => s.id === updatedSource.id ? updatedSource : s)}));
                        setCommentingOn(updatedSource);
                    }
                }}
                onVoteComment={async (commentId, voteType) => {
                    if (!commentingOn) return;
                    const updatedComments = commentingOn.comments.map(c => c.id === commentId ? {...c, [`${voteType}_votes`]: c[`${voteType}_votes`] + 1 } : c);
                    const success = await updateContentComments('sources', commentingOn.id, updatedComments);
                    if(success) {
                        const updatedSource = {...commentingOn, comments: updatedComments};
                        setAppData(prev => ({...prev, sources: prev.sources.map(s => s.id === updatedSource.id ? updatedSource : s)}));
                        setCommentingOn(updatedSource);
                    }
                }}
            />
            
            <div className="flex justify-between items-center mb-6">
                <ContentToolbar sort={sort} setSort={setSort} supportedSorts={['temp', 'time', 'subject', 'user']} />
                <button onClick={() => setIsAddSourceModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white font-semibold rounded-md hover:bg-indigo-600">
                    <DocumentTextIcon className="w-5 h-5" /> Adicionar Fonte
                </button>
            </div>
            
             <div className="space-y-4">
                {Array.isArray(sortedSources) 
                    ? sortedSources.map(renderSourceItem)
                    : Object.entries(sortedSources as Record<string, Source[]>).map(([groupKey, items]) => (
                        <div key={groupKey} className="mb-6">
                            <h2 className="text-2xl font-bold mb-2 border-b-2 border-primary-light dark:border-primary-dark pb-1">
                                {sort === 'user' ? (appData.users.find(u => u.id === groupKey)?.pseudonym || 'Desconhecido') : groupKey}
                            </h2>
                            <div className="space-y-4">
                                {items.map(renderSourceItem)}
                            </div>
                        </div>
                    ))
                }
            </div>
        </>
    );
};