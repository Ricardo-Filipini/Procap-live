import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MainContentProps } from '../../types';
import { CaseStudy, DecisionOption, UserCaseStudyInteraction, Comment, Source, UserContentInteraction } from '../../types';
import { SparklesIcon, TrashIcon, CheckCircleIcon, XMarkIcon, CloudArrowUpIcon } from '../Icons';
import { Modal } from '../Modal';
import { generateCaseStudy } from '../../services/geminiService';
// FIX: Replaced incrementVoteCount with incrementCaseStudyVote for type safety and correctness.
import { addCaseStudy, upsertUserCaseStudyInteraction, clearCaseStudyProgress, updateContentComments, upsertUserVote, incrementCaseStudyVote, updateUser as supabaseUpdateUser, logXpEvent } from '../../services/supabaseClient';
import { ContentActions } from '../shared/ContentActions';
import { CommentsModal } from '../shared/CommentsModal';
import { useContentViewController } from '../../hooks/useContentViewController';
import { ContentToolbar } from '../shared/ContentToolbar';
import { handleInteractionUpdate } from '../../lib/content';
import { FontSizeControl, FONT_SIZE_CLASSES_LARGE } from '../shared/FontSizeControl';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import { checkAndAwardAchievements } from '../../lib/achievements';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@^4.4.168/build/pdf.worker.mjs`;

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


const CreateCaseStudyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    appData: MainContentProps['appData'];
    setAppData: MainContentProps['setAppData'];
    currentUser: MainContentProps['currentUser'];
    setProcessingTasks: MainContentProps['setProcessingTasks'];
}> = ({ isOpen, onClose, appData, setAppData, currentUser, setProcessingTasks }) => {
    const [prompt, setPrompt] = useState("");
    const [text, setText] = useState("");
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
    const [files, setFiles] = useState<FileList | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    
     const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setFiles(e.dataTransfer.files);
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) setFiles(e.target.files);
    };

    useEffect(() => {
        if (!isOpen) {
            setPrompt("");
            setText("");
            setSelectedSources(new Set());
            setFiles(null);
            setIsLoading(false);
            setIsDragging(false);
        }
    }, [isOpen]);

    const handleCreate = async () => {
        setIsLoading(true);
        const taskId = `task_casestudy_${Date.now()}`;
        setProcessingTasks(prev => [...prev, { id: taskId, name: `Estudo de Caso`, message: 'Iniciando...', status: 'processing' }]);
        
        try {
            let fullText = text.trim();
            if (files) {
                setProcessingTasks(prev => prev.map(t => t.id === taskId ? {...t, message: 'Extraindo texto dos arquivos...' } : t));
                // Fix: Explicitly type `fileArray` as `File[]` to prevent type inference issues.
                const fileArray: File[] = Array.from(files);
                const textPromises = fileArray.map(extractTextFromFile);
                const texts = await Promise.all(textPromises);
                const fileText = texts.join('\n\n---\n\n');
                fullText = fullText ? `${fullText}\n\n---\n\n${fileText}` : fileText;
            }

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? {...t, message: 'Gerando com IA...' } : t));
            const contextSources = appData.sources.filter(s => selectedSources.has(s.id));
            const generated = await generateCaseStudy(fullText || null, contextSources, prompt.trim());
            if (generated.error) throw new Error(generated.error);

            setProcessingTasks(prev => prev.map(t => t.id === taskId ? {...t, message: 'Salvando no banco de dados...' } : t));

            const payload: Partial<CaseStudy> = {
                user_id: currentUser.id,
                title: generated.title,
                summary: generated.summary,
                full_case_text: fullText || `Gerado a partir do prompt: ${prompt.trim()}`,
                correlated_materias: generated.correlated_materias,
                key_points: generated.key_points,
                decision_points: generated.decision_points,
                hot_votes: 0,
                cold_votes: 0,
                comments: []
            };

            const newCaseStudy = await addCaseStudy(payload);
            if (!newCaseStudy) throw new Error("Falha ao salvar o estudo de caso.");
            
            setAppData(prev => ({ ...prev, caseStudies: [newCaseStudy, ...prev.caseStudies] }));
            setProcessingTasks(prev => prev.map(t => t.id === taskId ? {...t, message: `Estudo de caso "${newCaseStudy.title}" criado!`, status: 'success' } : t));
            onClose();

        } catch (error: any) {
            console.error(error);
            setProcessingTasks(prev => prev.map(t => t.id === taskId ? {...t, message: `Erro: ${error.message}`, status: 'error' } : t));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Estudo de Caso com IA">
            <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">A IA pode criar um estudo de caso a partir de um tema, de um texto que você fornecer, ou usando as fontes da plataforma como contexto.</p>
                <div>
                    <label className="block text-sm font-medium mb-1">Tema ou Prompt para a IA</label>
                    <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: 'Uma crise cambial e a resposta do BCB'" className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Texto Base (Opcional)</label>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Cole aqui um texto para a IA usar como base..." className="w-full p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">Ou envie arquivos (Opcional)</label>
                    <div
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary-light bg-primary-light/10' : 'border-border-light dark:border-border-dark hover:border-primary-light/50'}`}
                    >
                        <CloudArrowUpIcon className="w-10 h-10 text-gray-400 mb-2"/>
                        <p className="font-semibold">Arraste e solte os arquivos aqui</p>
                        <p className="text-sm text-gray-500">ou clique para selecionar (.pdf, .docx, .txt)</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".pdf,.docx,.txt" className="hidden"/>
                    </div>
                     {files && (
                        <div className="mt-2">
                            <h4 className="font-semibold text-xs mb-1">Arquivos Selecionados:</h4>
                            <ul className="text-xs list-disc list-inside bg-background-light dark:bg-background-dark p-2 rounded-md">
                                {/* FIX: Explicitly type `f` as `File` to allow access to `.name` property. */}
                                {Array.from(files).map((f: File) => <li key={f.name}>{f.name}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Fontes de Contexto (Opcional)</label>
                    <div className="max-h-32 overflow-y-auto border border-border-light dark:border-border-dark rounded-md p-2 space-y-1">
                       {appData.sources.map(source => (
                            <div key={source.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                <input type="checkbox" id={`source-cs-${source.id}`} checked={selectedSources.has(source.id)} onChange={() => setSelectedSources(p => { const n = new Set(p); n.has(source.id) ? n.delete(source.id) : n.add(source.id); return n; })}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light" />
                                <label htmlFor={`source-cs-${source.id}`} className="text-sm cursor-pointer flex-grow">{source.title}</label>
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={handleCreate} disabled={isLoading} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 flex items-center justify-center gap-2">
                    <SparklesIcon className="w-5 h-5"/> {isLoading ? "Gerando..." : "Gerar Estudo de Caso"}
                </button>
            </div>
        </Modal>
    );
};

const CaseStudyDetailView: React.FC<{
    caseStudy: CaseStudy;
    interaction: UserCaseStudyInteraction;
    onUpdateInteraction: (update: Partial<UserCaseStudyInteraction>) => void;
    onBack: () => void;
    currentUser: MainContentProps['currentUser'];
    updateUser: MainContentProps['updateUser'];
    appData: MainContentProps['appData'];
    setAppData: MainContentProps['setAppData'];
}> = ({ caseStudy, interaction, onUpdateInteraction, onBack, currentUser, updateUser, appData, setAppData }) => {
    const [fontSize, setFontSize] = useState(0);
    
    const handleSelectOption = (decisionPoint: DecisionOption, index: number) => {
        if (index !== interaction.current_decision_point_index) return;
        
        const point = caseStudy.decision_points[index];
        const isAlreadyAnswered = interaction.choices.some(c => c.decision_point_id === point.id);
        if (isAlreadyAnswered) return;

        const isCorrect = decisionPoint.text === point.actual_bcb_action;
        let xpGained = 0;
        if (isCorrect) {
            xpGained = 20;
            // FIX: Defensively cast `currentUser.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
            const updatedUser = { ...currentUser, xp: (Number(currentUser.xp) || 0) + xpGained };
            updateUser(updatedUser);
            logXpEvent(currentUser.id, xpGained, 'CASE_STUDY_CORRECT', caseStudy.id).then(newEvent => {
                if (newEvent) {
                    setAppData(prev => ({...prev, xp_events: [newEvent, ...prev.xp_events]}));
                }
            });
        }
        
        const isLastPoint = index >= caseStudy.decision_points.length - 1;

        const updatedChoices = [...interaction.choices, { decision_point_id: point.id, chosen_option_id: decisionPoint.id }];
        
        onUpdateInteraction({
            choices: updatedChoices,
            // FIX: Defensively cast `interaction.xp_earned` to a number to prevent runtime errors.
            xp_earned: (Number(interaction.xp_earned) || 0) + xpGained,
            current_decision_point_index: isLastPoint ? index : index + 1,
            completed_at: isLastPoint ? new Date().toISOString() : null,
        });

        if (isLastPoint) {
            const tempAppData = { ...appData };
            const interactionIndex = tempAppData.userCaseStudyInteractions.findIndex(i => i.user_id === currentUser.id && i.case_study_id === caseStudy.id);
            const completedInteraction = {
                 ...interaction,
                 choices: updatedChoices,
                 completed_at: new Date().toISOString()
            };

            if (interactionIndex > -1) {
                tempAppData.userCaseStudyInteractions[interactionIndex] = completedInteraction;
            } else {
                tempAppData.userCaseStudyInteractions.push(completedInteraction);
            }
            
            const userWithNewAchievements = checkAndAwardAchievements(currentUser, tempAppData);
            if (userWithNewAchievements.achievements.length > currentUser.achievements.length) {
                updateUser(userWithNewAchievements);
            }
        }
    };
    
    const handleRestart = async () => {
        const success = await clearCaseStudyProgress(currentUser.id, caseStudy.id);
        if(success) {
            onUpdateInteraction({
                current_decision_point_index: 0,
                choices: [],
                xp_earned: 0,
                completed_at: null,
            });
        }
    }
    
    return (
        <div className={FONT_SIZE_CLASSES_LARGE[fontSize]}>
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={onBack} className="text-primary-light dark:text-primary-dark hover:underline">&larr; Voltar para a lista</button>
                    <div className="flex items-center gap-4">
                        <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} maxSize={4} />
                        <button onClick={handleRestart} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Recomeçar Estudo</button>
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">{caseStudy.title}</h2>
                
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
                    <div className="bg-primary-light h-2.5 rounded-full" style={{ width: `${((interaction.current_decision_point_index) / caseStudy.decision_points.length) * 100}%` }}></div>
                </div>

                <div className="prose dark:prose-invert max-w-none space-y-8">
                    {caseStudy.decision_points.map((decisionPoint, index) => {
                        const userChoice = interaction.choices.find(c => c.decision_point_id === decisionPoint.id);
                        const isCurrentPoint = index === interaction.current_decision_point_index;
                        
                        return(
                        <div key={decisionPoint.id} className={`p-4 border-l-4 rounded ${isCurrentPoint && !userChoice ? 'border-primary-light bg-primary-light/5 dark:bg-primary-dark/10' : 'border-transparent'}`}>
                            <h3 className="font-semibold">Ponto de Decisão {index + 1}/{caseStudy.decision_points.length}: Contexto</h3>
                            <p>{decisionPoint.context}</p>

                            <h3 className="font-semibold mt-6">Opções:</h3>
                            <div className="space-y-3">
                                {decisionPoint.options.map(option => {
                                    const isSelected = userChoice?.chosen_option_id === option.id;
                                    const isCorrectAction = option.text === decisionPoint.actual_bcb_action;
                                    const canInteract = isCurrentPoint && !userChoice;
                                    
                                    let optionClass = "border-border-light dark:border-border-dark";
                                    if(userChoice) { // if the point has been answered
                                        if (isCorrectAction) optionClass = "border-green-500 bg-green-100 dark:bg-green-900/50";
                                        else if (isSelected) optionClass = "border-red-500 bg-red-100 dark:bg-red-900/50";
                                        else optionClass = "opacity-60";
                                    } else if (!canInteract) {
                                        optionClass = "opacity-60"; // future, unanswered points
                                    }

                                    return (
                                        <div key={option.id} onClick={() => handleSelectOption(option, index)} className={`p-4 border rounded-lg transition-colors not-prose ${canInteract ? 'cursor-pointer hover:border-primary-light' : 'cursor-default'} ${optionClass}`}>
                                            <p className="font-semibold">{option.text}</p>
                                            {userChoice && <p className="text-sm italic mt-2">Resultado previsto: {option.predicted_outcome}</p>}
                                        </div>
                                    );
                                })}
                            </div>

                            {userChoice && (
                                <div className="mt-6 p-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                                    <h3 className="text-lg font-bold">Resultado da Ação Real do BCB</h3>
                                    <p className="mt-2">{decisionPoint.bcb_action_outcome}</p>
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>

                {interaction.completed_at && (
                    <div className="mt-8 text-center p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
                        <h3 className="text-xl font-bold text-green-700 dark:text-green-300">🎉 Estudo de Caso Concluído!</h3>
                        <p>Você ganhou {interaction.xp_earned} XP.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const CaseStudyView: React.FC<MainContentProps> = (props) => {
    const { appData, setAppData, currentUser, updateUser, setProcessingTasks } = props;
    const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [commentingOn, setCommentingOn] = useState<CaseStudy | null>(null);
    const contentType = 'case_study';

    const {
        sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly,
        processedItems,
        handleAiFilter,
        handleClearFilter,
        aiFilterIds,
    } = useContentViewController(appData.caseStudies, currentUser, appData, contentType);

    const handleInteraction = (caseStudyId: string, update: Partial<UserContentInteraction>) => {
        handleInteractionUpdate(setAppData, appData, currentUser, updateUser, 'case_study', caseStudyId, update);
    };
    
    const handleVote = async (caseStudyId: string, type: 'hot' | 'cold', increment: 1 | -1) => {
        const interaction = appData.userContentInteractions.find(i => i.user_id === currentUser.id && i.content_id === caseStudyId && i.content_type === 'case_study');
        const currentVoteCount = (type === 'hot' ? interaction?.hot_votes : interaction?.cold_votes) || 0;
        if (increment === -1 && currentVoteCount <= 0) return;
        
        handleInteraction(caseStudyId, { [`${type}_votes`]: currentVoteCount + increment });
        
        setAppData(prev => ({...prev, caseStudies: prev.caseStudies.map(cs => cs.id === caseStudyId ? {...cs, [`${type}_votes`]: cs[`${type}_votes`] + increment} : cs)}));
        
        // FIX: Replaced the generic incrementVoteCount with the specific incrementCaseStudyVote function.
        await incrementCaseStudyVote(caseStudyId, `${type}_votes`, increment);
    };

    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOn) return;
        let updatedComments = [...(commentingOn.comments || [])];
        if (action === 'add') {
            updatedComments.push({ id: `c_cs_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 });
        } else if (action === 'vote') {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) updatedComments[commentIndex][`${payload.voteType}_votes`] += 1;
        }
        
        const success = await updateContentComments('case_studies', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = { ...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, caseStudies: prev.caseStudies.map(cs => cs.id === updatedItem.id ? updatedItem : cs) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const handleUpdateInteraction = async (caseId: string, update: Partial<UserCaseStudyInteraction>) => {
        const currentInteraction = appData.userCaseStudyInteractions.find(i => i.user_id === currentUser.id && i.case_study_id === caseId);
        const newInteraction = { ...currentInteraction, ...update, user_id: currentUser.id, case_study_id: caseId } as UserCaseStudyInteraction;

        setAppData(prev => {
            const existingIndex = prev.userCaseStudyInteractions.findIndex(i => i.user_id === currentUser.id && i.case_study_id === caseId);
            const newInteractions = [...prev.userCaseStudyInteractions];
            if (existingIndex > -1) {
                newInteractions[existingIndex] = newInteraction;
            } else {
                newInteractions.push({ ...newInteraction, id: `temp-csi-${Date.now()}`});
            }
            return { ...prev, userCaseStudyInteractions: newInteractions };
        });
        
        await upsertUserCaseStudyInteraction(newInteraction);
    };

    if (selectedCaseStudy) {
        let interaction = appData.userCaseStudyInteractions.find(i => i.user_id === currentUser.id && i.case_study_id === selectedCaseStudy.id);
        if(!interaction) {
            interaction = { id: `temp_${Date.now()}`, user_id: currentUser.id, case_study_id: selectedCaseStudy.id, current_decision_point_index: 0, choices: [], xp_earned: 0, completed_at: null };
        }
        return <CaseStudyDetailView 
            caseStudy={selectedCaseStudy}
            interaction={interaction}
            onUpdateInteraction={(update) => handleUpdateInteraction(selectedCaseStudy.id, update)}
            onBack={() => setSelectedCaseStudy(null)}
            currentUser={currentUser}
            updateUser={updateUser}
            appData={appData}
            setAppData={setAppData}
        />
    }

    const renderCaseStudyItem = (cs: CaseStudy) => {
        const interaction = appData.userCaseStudyInteractions.find(i => i.user_id === currentUser.id && i.case_study_id === cs.id);
        const isCompleted = !!interaction?.completed_at;
        const progress = interaction ? (interaction.current_decision_point_index / cs.decision_points.length) * 100 : 0;
        
        return (
            <div key={cs.id} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark flex flex-col">
                <div className="flex-grow">
                    <h3 className="text-2xl font-bold">{cs.title}</h3>
                    <p className="text-base text-gray-500 dark:text-gray-400 mt-1 mb-2">Criado por {appData.users.find(u => u.id === cs.user_id)?.pseudonym || 'Desconhecido'}</p>
                    <p className="text-base">{cs.summary}</p>
                </div>
                <div className="mt-4">
                    {interaction && !isCompleted && progress > 0 && (
                        <div className="mb-2">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div className="bg-secondary-light dark:bg-secondary-dark h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <button onClick={() => setSelectedCaseStudy(cs)} className="px-4 py-2 bg-primary-light text-white font-semibold rounded-md hover:bg-indigo-700 text-sm">
                            {isCompleted ? 'Revisar' : (interaction && progress > 0 ? 'Continuar' : 'Iniciar Estudo')}
                        </button>
                    </div>
                </div>
                <ContentActions
                    item={cs}
                    contentType={contentType}
                    currentUser={currentUser}
                    interactions={appData.userContentInteractions}
                    onVote={(id, type, inc) => handleVote(id, type, inc)}
                    onToggleRead={(id, state) => handleInteraction(id, { is_read: !state })}
                    onToggleFavorite={(id, state) => handleInteraction(id, { is_favorite: !state })}
                    onComment={() => setCommentingOn(cs)}
                />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <CreateCaseStudyModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} {...props} />
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(id, type) => handleCommentAction('vote', {commentId: id, voteType: type})} contentTitle={commentingOn?.title || ''}/>

            <div className="flex justify-between items-center">
                 <ContentToolbar 
                    sort={sort} setSort={setSort} 
                    filter={filter} setFilter={setFilter}
                    favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}
                    onAiFilter={handleAiFilter}
                    isFiltering={!!aiFilterIds}
                    onClearFilter={handleClearFilter}
                    supportedSorts={['temp', 'time', 'user']}
                 />
                <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white font-semibold rounded-md hover:bg-indigo-600 transition-colors">
                    <SparklesIcon className="w-5 h-5" />
                    Novo
                </button>
            </div>
            
            <div className="space-y-4">
                 {Array.isArray(processedItems) 
                    ? <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{processedItems.map(renderCaseStudyItem)}</div>
                    : Object.entries(processedItems as Record<string, CaseStudy[]>).map(([groupKey, items]) => (
                        <details key={groupKey} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
                            <summary className="text-xl font-bold cursor-pointer">{appData.users.find(u=>u.id === groupKey)?.pseudonym || "Desconhecido"}</summary>
                            <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark grid grid-cols-1 md:grid-cols-2 gap-6">
                                {items.map(renderCaseStudyItem)}
                            </div>
                        </details>
                    ))
                }
            </div>

        </div>
    );
};