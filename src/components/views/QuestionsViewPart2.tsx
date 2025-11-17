import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainContentProps } from '../../types';
import { Question, Comment, QuestionNotebook, UserNotebookInteraction, UserQuestionAnswer, Source } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { Modal } from '../Modal';
import { PlusIcon, LightBulbIcon, ChartBarSquareIcon, MagnifyingGlassIcon, TrashIcon, XCircleIcon, SparklesIcon } from '../Icons';
import { ContentActions } from '../shared/ContentActions';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { checkAndAwardAchievements } from '../../lib/achievements';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { filterItemsByPrompt, generateNotebookName } from '../../services/geminiService';
import { addQuestionNotebook, upsertUserVote, updateContentComments, updateUser as supabaseUpdateUser, upsertUserQuestionAnswer, clearNotebookAnswers, supabase, logXpEvent } from '../../services/supabaseClient';

const CreateNotebookModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    appData: MainContentProps['appData'];
    setAppData: MainContentProps['setAppData'];
    currentUser: MainContentProps['currentUser'];
}> = ({ isOpen, onClose, appData, setAppData, currentUser }) => {
    const [name, setName] = useState("");
    const [questionCount, setQuestionCount] = useState(40);
    const [prompt, setPrompt] = useState("");
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
    const [excludeAnswered, setExcludeAnswered] = useState(false);
    const [keepWrongAndFavorites, setKeepWrongAndFavorites] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    const handleToggleSource = (id: string) => {
        setSelectedSourceIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleCreate = async () => {
        setIsLoading(true);
        setStatusMessage("Coletando questões...");
        try {
            const allAvailableSources = appData.sources.filter(s => s.questions && s.questions.length > 0);
            
            const sourcesToUse = selectedSourceIds.size > 0
                ? allAvailableSources.filter(s => selectedSourceIds.has(s.id))
                : allAvailableSources;
            
            let questionsPool = sourcesToUse.flatMap(s => s.questions);

            let orderedQuestionsPool: Question[];

            if (keepWrongAndFavorites) {
                const answeredIncorrectlyIds = new Set(
                    appData.userQuestionAnswers
                        .filter(a => a.user_id === currentUser.id && !a.is_correct_first_try)
                        .map(a => a.question_id)
                );
                const favoritedQuestionIds = new Set(
                    appData.userContentInteractions
                        .filter(i => i.user_id === currentUser.id && i.content_type === 'question' && i.is_favorite)
                        .map(i => i.content_id)
                );
                const priorityIds = new Set([...answeredIncorrectlyIds, ...favoritedQuestionIds]);
                
                const priorityQuestions = questionsPool.filter(q => priorityIds.has(q.id));
                let otherQuestions = questionsPool.filter(q => !priorityIds.has(q.id));
    
                if (excludeAnswered) {
                    const answeredQuestionIds = new Set(appData.userQuestionAnswers.filter(a => a.user_id === currentUser.id).map(a => a.question_id));
                    otherQuestions = otherQuestions.filter(q => !answeredQuestionIds.has(q.id));
                }
    
                orderedQuestionsPool = [...priorityQuestions, ...otherQuestions.sort(() => 0.5 - Math.random())];
            } else {
                orderedQuestionsPool = [...questionsPool];
                if (excludeAnswered) {
                    const answeredQuestionIds = new Set(appData.userQuestionAnswers.filter(a => a.user_id === currentUser.id).map(a => a.question_id));
                    orderedQuestionsPool = orderedQuestionsPool.filter(q => !answeredQuestionIds.has(q.id));
                }
            }
            
            if (orderedQuestionsPool.length === 0) {
                throw new Error("Nenhuma questão disponível com os filtros aplicados.");
            }

            let finalQuestionIds: string[];
            if (prompt.trim()) {
                setStatusMessage("Filtrando questões com IA...");
                const itemsToFilter = orderedQuestionsPool.map(q => ({ id: q.id, text: q.questionText }));
                const relevantIds = await filterItemsByPrompt(prompt, itemsToFilter);
                
                if (relevantIds.length > 0) {
                    const relevantIdSet = new Set(relevantIds);
                    finalQuestionIds = orderedQuestionsPool.map(q => q.id).filter(id => relevantIdSet.has(id));
                } else {
                    finalQuestionIds = orderedQuestionsPool.map(q => q.id); 
                }
            } else {
                finalQuestionIds = orderedQuestionsPool.map(q => q.id);
            }
            
            let questionIdsToSlice = finalQuestionIds;
             if (!keepWrongAndFavorites) {
                questionIdsToSlice = finalQuestionIds.sort(() => 0.5 - Math.random());
            }

            const sliced = questionIdsToSlice.slice(0, questionCount);

            let finalName = name.trim();
            if (!finalName) {
                setStatusMessage("Gerando nome com IA...");
                const allQuestions = appData.sources.flatMap(s => s.questions);
                const selectedQuestions = allQuestions.filter(q => sliced.includes(q.id));
                finalName = await generateNotebookName(selectedQuestions);
            }

            setStatusMessage("Salvando caderno...");
            const payload: Partial<QuestionNotebook> = {
                user_id: currentUser.id, name: finalName, question_ids: sliced, comments: [], hot_votes: 0, cold_votes: 0,
            };
            const newNotebook = await addQuestionNotebook(payload);
            if (newNotebook) {
                setAppData(prev => ({ ...prev, questionNotebooks: [newNotebook, ...prev.questionNotebooks] }));
                onClose();
            } else {
                throw new Error("Falha ao salvar o caderno no banco de dados.");
            }
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setIsLoading(false);
            setStatusMessage("");
        }
    };
    
    useEffect(() => {
        if (!isOpen) {
            setName("");
            setQuestionCount(40);
            setPrompt("");
            setSelectedSourceIds(new Set());
            setExcludeAnswered(false);
            setKeepWrongAndFavorites(true);
            setIsLoading(false);
            setStatusMessage("");
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Novo Caderno de Questões">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome (opcional)</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="A IA gera um se deixado em branco"
                        className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Quantidade de Questões</label>
                    <input type="number" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Prompt para IA (opcional)</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: 'Foco em política monetária e COPOM'"
                        className="w-full h-20 p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Fontes (opcional, padrão: todas)</label>
                    <div className="max-h-40 overflow-y-auto border border-border-light dark:border-border-dark rounded-md p-2 space-y-1">
                       {appData.sources.filter(s => s.questions && s.questions.length > 0).map(source => (
                            <div key={source.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                <input type="checkbox" id={`source-select-${source.id}`} checked={selectedSourceIds.has(source.id)} onChange={() => handleToggleSource(source.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light" />
                                <label htmlFor={`source-select-${source.id}`} className="text-sm cursor-pointer flex-grow flex justify-between items-center gap-2">
                                    <span className="truncate" title={source.title}>{source.title}</span>
                                    <span className="flex-shrink-0 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">Questões: {source.questions.length}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="keep-wrong-favorites" checked={keepWrongAndFavorites} onChange={e => setKeepWrongAndFavorites(e.target.checked)} 
                            className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light" />
                        <label htmlFor="keep-wrong-favorites" className="text-sm cursor-pointer">Priorizar erradas e favoritas</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="exclude-answered" checked={excludeAnswered} onChange={e => setExcludeAnswered(e.target.checked)} 
                            className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light" />
                        <label htmlFor="exclude-answered" className="text-sm cursor-pointer">Não incluir questões já respondidas</label>
                    </div>
                </div>
                <button onClick={handleCreate} disabled={isLoading} className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-10">
                    {isLoading ? (
                         <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>{statusMessage}</span>
                        </div>
                    ) : 'Criar Caderno'}
                </button>
            </div>
        </Modal>
    );
};

const QuestionStatsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    question: Question;
    appData: MainContentProps['appData'];
}> = ({ isOpen, onClose, question, appData }) => {
    const stats = useMemo(() => {
        if (!question) return null;

        const allAnswersForThisQuestion = appData.userQuestionAnswers.filter(
            ans => ans.question_id === question.id
        );

        const firstTryAnswers = allAnswersForThisQuestion.map(ans => ans.attempts[0]);
        const totalFirstTries = firstTryAnswers.length;
        if (totalFirstTries === 0) {
            return { total: 0, correct: 0, incorrect: 0, distribution: question.options.map(o => ({ option: o, count: 0, percentage: 0})) };
        }

        const correctFirstTries = allAnswersForThisQuestion.filter(ans => ans.is_correct_first_try).length;
        const incorrectFirstTries = totalFirstTries - correctFirstTries;

        const distribution = (question.options as string[]).map(option => {
            const count = firstTryAnswers.filter(ans => ans === option).length;
            return { option, count, percentage: (count / totalFirstTries) * 100 };
        });

        return {
            total: totalFirstTries,
            correct: correctFirstTries,
            incorrect: incorrectFirstTries,
            distribution: distribution.sort((a,b) => b.count - a.count)
        };
    }, [question, appData.userQuestionAnswers]);

    if (!stats) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Estatísticas da Questão`}>
            <div className="space-y-4">
                <p className="text-sm font-semibold truncate">{question.questionText}</p>
                 {stats.total > 0 ? (
                    <>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg">
                                <p className="font-semibold text-gray-500">Respostas</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                             <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-lg">
                                <p className="font-semibold text-green-700 dark:text-green-300">Acertos</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.correct}</p>
                            </div>
                             <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">
                                <p className="font-semibold text-red-700 dark:text-red-300">Erros</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.incorrect}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Distribuição das Respostas (1ª Tentativa)</h4>
                            <div className="space-y-2">
                                {stats.distribution.map(({ option, count, percentage }) => (
                                    <div key={option}>
                                        <div className="flex justify-between items-center text-sm mb-1">
                                            <span className={`truncate ${option === question.correctAnswer ? 'font-bold' : ''}`} title={option}>{option}</span>
                                            <span>{count} ({percentage.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                            <div className={`h-2.5 rounded-full ${option === question.correctAnswer ? 'bg-green-500' : 'bg-primary-light'}`} style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-center text-gray-500 py-4">Nenhum usuário respondeu a esta questão ainda.</p>
                )}
            </div>
        </Modal>
    );
};

interface ClearAnswersModalProps {
    isOpen: boolean;
    onClose: () => void;
    notebook: QuestionNotebook | 'all';
    appData: MainContentProps['appData'];
    allQuestions: (Question & { source?: any })[];
    currentUser: MainContentProps['currentUser'];
    onConfirm: (questionIdsToClear: string[]) => void;
}

const ClearAnswersModal: React.FC<ClearAnswersModalProps> = ({ isOpen, onClose, notebook, appData, allQuestions, currentUser, onConfirm }) => {
    
    const notebookId = notebook === 'all' ? 'all_questions' : notebook.id;
    const notebookName = notebook === 'all' ? "Todas as Questões" : (notebook as QuestionNotebook).name;

    const sourcesInNotebook = useMemo(() => {
        const notebookQuestionIds = new Set(
            notebook === 'all'
            ? allQuestions.map(q => q.id)
            : (notebook.question_ids || []).filter((id): id is string => typeof id === 'string')
        );

        const answeredInNotebook = appData.userQuestionAnswers.filter(
            ans => ans.user_id === currentUser.id && ans.notebook_id === notebookId && notebookQuestionIds.has(ans.question_id)
        );

        const questionSourceMap = new Map<string, Source>();
        allQuestions.forEach(q => {
            if (q.source) {
                questionSourceMap.set(q.id, q.source);
            }
        });

        const sourceMap = new Map<string, { id: string; title: string; count: number; questionIds: string[] }>();
        answeredInNotebook.forEach(ans => {
            const source = questionSourceMap.get(ans.question_id);
            if (source) {
                const entry = sourceMap.get(source.id) || { id: source.id, title: source.title, count: 0, questionIds: [] };
                entry.count++;
                entry.questionIds.push(ans.question_id);
                sourceMap.set(source.id, entry);
            }
        });
        return Array.from(sourceMap.values());

    }, [notebook, allQuestions, appData.userQuestionAnswers, currentUser.id, notebookId]);


    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setSelectedSourceIds(new Set(sourcesInNotebook.map(s => s.id)));
        }
    }, [isOpen, sourcesInNotebook]);
    
    const handleToggle = (sourceId: string) => {
        setSelectedSourceIds(prev => {
            const next = new Set(prev);
            if (next.has(sourceId)) next.delete(sourceId);
            else next.add(sourceId);
            return next;
        });
    };
    
    const handleConfirm = () => {
        const questionIdsToClear = sourcesInNotebook
            .filter(s => selectedSourceIds.has(s.id))
            .flatMap(s => s.questionIds);
        onConfirm(questionIdsToClear);
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Limpar Respostas: ${notebookName}`}>
            <p className="text-sm mb-4">Selecione as fontes das quais você deseja limpar suas respostas neste caderno. As respostas de questões de outras fontes não serão afetadas.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto border-y border-border-light dark:border-border-dark py-2 my-2">
                {sourcesInNotebook.length > 0 ? (
                    sourcesInNotebook.map(source => (
                         <div key={source.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-background-light dark:hover:bg-background-dark">
                            <input
                                type="checkbox"
                                id={`clear-source-${source.id}`}
                                checked={selectedSourceIds.has(source.id)}
                                onChange={() => handleToggle(source.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light"
                            />
                            <label htmlFor={`clear-source-${source.id}`} className="flex-grow cursor-pointer flex justify-between">
                                <span>{source.title}</span>
                                <span className="text-xs text-gray-500">{source.count} questões respondidas</span>
                            </label>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 p-4">Nenhuma questão foi respondida neste caderno ainda.</p>
                )}
            </div>
             <div className="flex justify-end gap-4 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700">Cancelar</button>
                <button onClick={handleConfirm} disabled={selectedSourceIds.size === 0} className="px-4 py-2 rounded-md bg-red-600 text-white disabled:opacity-50">Limpar Selecionadas</button>
            </div>
        </Modal>
    );
};


const NotebookStatsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    notebook: QuestionNotebook | 'all';
    appData: MainContentProps['appData'];
    allQuestions: (Question & { source?: any })[];
    currentUser: MainContentProps['currentUser'];
    onClearAnswers: (questionIdsToClear: string[]) => void;
    onStartClearing: () => void;
}> = ({ isOpen, onClose, notebook, appData, allQuestions, currentUser, onClearAnswers, onStartClearing }) => {
    const notebookId = notebook === 'all' ? 'all_questions' : notebook.id;
    const notebookName = notebook === 'all' ? "Todas as Questões" : notebook.name;
    
    const questionIds = useMemo(() => {
        if (notebook === 'all') {
            return new Set(appData.sources.flatMap(s => s.questions.map(q => q.id)));
        }
        const ids = Array.isArray(notebook.question_ids) ? notebook.question_ids.filter((id: any): id is string => typeof id === 'string') : [];
        return new Set(ids);
    }, [notebook, appData.sources]);

    const relevantAnswers = useMemo(() => {
        return appData.userQuestionAnswers.filter(
            ans => ans.user_id === currentUser.id && ans.notebook_id === notebookId
        );
    }, [appData.userQuestionAnswers, currentUser.id, notebookId]);

    const leaderboardData = useMemo(() => {
        const userScores: { [userId: string]: { correct: number } } = {};

        appData.userQuestionAnswers
            .filter(ans => String(ans.notebook_id) === notebookId)
            .forEach(ans => {
                if (!userScores[ans.user_id]) {
                    userScores[ans.user_id] = { correct: 0 };
                }
                if (ans.is_correct_first_try) {
                    userScores[ans.user_id].correct++;
                }
            });

        return Object.entries(userScores)
            .map(([userId, scores]) => {
                const user = appData.users.find(u => u.id === userId);
                return {
                    userId,
                    pseudonym: user?.pseudonym || 'Desconhecido',
                    score: scores.correct,
                };
            })
            .sort((a, b) => b.score - a.score);
    }, [appData.userQuestionAnswers, appData.users, notebookId]);

    const totalQuestions = questionIds.size;
    const questionsAnswered = relevantAnswers.length;
    const correctFirstTry = relevantAnswers.filter(a => a.is_correct_first_try).length;
    const accuracy = questionsAnswered > 0 ? (correctFirstTry / questionsAnswered) * 100 : 0;
    const progress = totalQuestions > 0 ? (questionsAnswered / totalQuestions) * 100 : 0;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Estatísticas: ${notebookName}`}>
            <div className="space-y-4 p-2">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Seu Progresso</h3>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div className="bg-primary-light h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ width: `${progress}%` }}>
                            {progress.toFixed(0)}%
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 text-right mt-1">{questionsAnswered} de {totalQuestions} questões respondidas</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg text-center">
                        <p className="text-lg font-semibold">Acertos na 1ª Tentativa</p>
                        <p className="text-3xl font-bold text-green-500">{correctFirstTry}</p>
                    </div>
                    <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg text-center">
                        <p className="text-lg font-semibold">Aproveitamento</p>
                        <p className="text-3xl font-bold text-secondary-light dark:text-secondary-dark">{accuracy.toFixed(1)}%</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                    <h3 className="text-lg font-semibold mb-2">Leaderboard do Caderno</h3>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                        {leaderboardData.length > 0 ? leaderboardData.map((entry, index) => (
                            <div key={entry.userId} className={`flex items-center justify-between p-2 rounded-md ${entry.userId === currentUser.id ? 'bg-primary-light/10' : 'bg-background-light dark:bg-background-dark'}`}>
                                <p><span className="font-bold w-6 inline-block">{index + 1}.</span> {entry.pseudonym}</p>
                                <p className="font-bold">{entry.score} acertos</p>
                            </div>
                        )) : <p className="text-sm text-gray-500">Ninguém respondeu a este caderno ainda.</p>}
                    </div>
                </div>

                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                    <button 
                        onClick={onStartClearing}
                        className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition flex items-center justify-center gap-2"
                    >
                    <TrashIcon className="w-5 h-5"/> Limpar Respostas e Recomeçar
                    </button>
                </div>
            </div>
        </Modal>
    );
};


export const NotebookGridView: React.FC<{
    notebooks: QuestionNotebook[];
    appData: MainContentProps['appData'];
    setAppData: MainContentProps['setAppData'];
    currentUser: MainContentProps['currentUser'];
    updateUser: MainContentProps['updateUser'];
    onSelectNotebook: (notebook: QuestionNotebook | 'all') => void;
    handleNotebookInteractionUpdate: (notebookId: string, update: Partial<UserNotebookInteraction>) => void;
    handleNotebookVote: (notebookId: string, type: 'hot' | 'cold', increment: 1 | -1) => void;
    setCommentingOnNotebook: (notebook: QuestionNotebook) => void;
}> = ({ notebooks, appData, setAppData, currentUser, updateUser, onSelectNotebook, handleNotebookInteractionUpdate, handleNotebookVote, setCommentingOnNotebook }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    const allQuestions = useMemo(() => appData.sources.flatMap(s => s.questions || []), [appData.sources]);

    const favoritedQuestionIds = useMemo(() => {
        return appData.userContentInteractions
            .filter(i => i.user_id === currentUser.id && i.content_type === 'question' && i.is_favorite)
            .map(i => i.content_id);
    }, [appData.userContentInteractions, currentUser.id]);

    const renderNotebook = (notebook: QuestionNotebook | 'all' | 'new' | 'favorites') => {
        if (notebook === 'new') {
            return (
                 <div 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex flex-col items-center justify-center text-center p-6 rounded-lg shadow-sm border-2 border-dashed border-border-light dark:border-border-dark cursor-pointer hover:shadow-md hover:border-primary-light dark:hover:border-primary-dark transition-all min-h-[220px]"
                >
                    <PlusIcon className="w-10 h-10 text-primary-light dark:text-primary-dark mb-2"/>
                    <h3 className="text-lg font-bold">Novo Caderno</h3>
                </div>
            );
        }
        
        let id, name, questionCount, item, contentType, interactions, onSelect, resolvedCount;
        
        if (notebook === 'all') {
            id = 'all_notebooks';
            name = "Todas as Questões";
            questionCount = allQuestions.length;
            
            const answeredInAllNotebookContext = new Set(appData.userQuestionAnswers
                .filter(a => a.user_id === currentUser.id && a.notebook_id === 'all_questions')
                .map(a => a.question_id));
                
            resolvedCount = allQuestions.filter(q => answeredInAllNotebookContext.has(q.id)).length;
            onSelect = () => onSelectNotebook('all');
        } else if (notebook === 'favorites') {
             if (favoritedQuestionIds.length === 0) return null;
             id = 'favorites_notebook';
             name = "⭐ Questões Favoritas";
             questionCount = favoritedQuestionIds.length;
             const answeredInFavorites = new Set(appData.userQuestionAnswers.filter(a => a.user_id === currentUser.id && a.notebook_id === 'favorites_notebook').map(a => a.question_id));
             resolvedCount = favoritedQuestionIds.filter(qId => answeredInFavorites.has(qId)).length;
             onSelect = () => {
                 const favoriteNotebook: QuestionNotebook = {
                    id: 'favorites_notebook', user_id: currentUser.id, name: '⭐ Questões Favoritas', question_ids: favoritedQuestionIds,
                    created_at: new Date().toISOString(), hot_votes: 0, cold_votes: 0, comments: []
                 };
                 onSelectNotebook(favoriteNotebook);
             };
        } else {
            id = notebook.id;
            name = notebook.name;
// FIX: Defensively filter question_ids to ensure it's an array of strings before creating a Set, preventing a 'Set<unknown>' type error.
            const notebookQuestionIds = new Set((notebook.question_ids || []).filter((id): id is string => typeof id === 'string'));
            questionCount = notebookQuestionIds.size;
            
            const answeredInThisNotebook = new Set(appData.userQuestionAnswers
                .filter(a => a.user_id === currentUser.id && a.notebook_id === notebook.id)
                .map(a => a.question_id));

            resolvedCount = answeredInThisNotebook.size;
            
            item = notebook;
            contentType = 'question_notebook';
            interactions = appData.userNotebookInteractions.filter(i => i.user_id === currentUser.id);
            onSelect = () => onSelectNotebook(notebook);
        }

        return (
            <div key={id} className="bg-card-light dark:bg-card-dark rounded-lg shadow-sm border border-border-light dark:border-border-dark flex flex-col">
                <div onClick={onSelect} className="p-4 flex-grow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-lg transition-colors">
                    <h4 className="font-bold">{name}</h4>
                    {notebook !== 'all' && notebook !== 'favorites' && (
                        <p className="text-xs text-gray-400 mt-1">por: {appData.users.find(u => u.id === notebook.user_id)?.pseudonym || 'Desconhecido'}</p>
                    )}
                    <div className="text-right mt-4">
                        <p className="font-bold text-primary-light dark:text-primary-dark">{questionCount} Questões</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">({resolvedCount}/{questionCount} resolvidas)</p>
                    </div>
                </div>
                {item && contentType && interactions && (
                    <div className="p-2 border-t border-border-light dark:border-border-dark">
                        <ContentActions
                            item={item}
                            contentType={contentType as 'question_notebook'}
                            currentUser={currentUser}
                            interactions={interactions}
                            onVote={handleNotebookVote}
                            onToggleRead={(id, state) => handleNotebookInteractionUpdate(id, { is_read: !state })}
                            onToggleFavorite={(id, state) => handleNotebookInteractionUpdate(id, { is_favorite: !state })}
                            onComment={() => setCommentingOnNotebook(item)}
                        />
                    </div>
                )}
            </div>
        )
    };

    return (
        <>
            <CreateNotebookModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                appData={appData}
                setAppData={setAppData}
                currentUser={currentUser}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {renderNotebook('new')}
                {renderNotebook('all')}
                {renderNotebook('favorites')}
                {notebooks.map(notebook => renderNotebook(notebook))}
            </div>
        </>
    );
};

export const NotebookDetailView: React.FC<{
    notebook: QuestionNotebook | 'all';
    allQuestions: (Question & { user_id: string, created_at: string, source: any})[];
    appData: MainContentProps['appData'];
    setAppData: MainContentProps['setAppData'];
    currentUser: MainContentProps['currentUser'];
    updateUser: MainContentProps['updateUser'];
    onBack: () => void;
    questionIdToFocus?: string | null;
    onFocusConsumed: () => void;
    setScreenContext?: (context: string | null) => void;
}> = ({ notebook, allQuestions, appData, setAppData, currentUser, updateUser, onBack, questionIdToFocus, onFocusConsumed, setScreenContext }) => {
    
    const [userAnswers, setUserAnswers] = useState<Map<string, UserQuestionAnswer>>(new Map());
    const notebookId = notebook === 'all' ? 'all_questions' : notebook.id;
    
    useEffect(() => {
        const answersForNotebook = appData.userQuestionAnswers.filter(
            ans => ans.user_id === currentUser.id && ans.notebook_id === notebookId
        );
        const answerMap = new Map(answersForNotebook.map(ans => [ans.question_id, ans]));
        setUserAnswers(answerMap);
    }, [appData.userQuestionAnswers, currentUser.id, notebookId]);
    
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [wrongAnswers, setWrongAnswers] = useState<Set<string>>(new Set());
    const [isCompleted, setIsCompleted] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [isQuestionStatsModalOpen, setIsQuestionStatsModalOpen] = useState(false);
    const [commentingOnQuestion, setCommentingOnQuestion] = useState<Question | null>(null);
    const [fontSize, setFontSize] = useState(1);
    const [struckOptions, setStruckOptions] = useState<Set<string>>(new Set());
    const longPressTimerRef = useRef<number | null>(null);
    const wasLongPress = useRef(false);
    const wasSwipe = useRef(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    
    const [questionSortOrder, setQuestionSortOrder] = useState<'default' | 'temp' | 'date' | 'random'>('default');
    const [shuffleTrigger, setShuffleTrigger] = useState(0);
    const [prioritizeApostilas, setPrioritizeApostilas] = useState(notebook === 'all');
    const [showWrongOnly, setShowWrongOnly] = useState(false);
    const [showUnansweredInAnyNotebook, setShowUnansweredInAnyNotebook] = useState(false);
    const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Fácil' | 'Médio' | 'Difícil'>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [shuffleOptions, setShuffleOptions] = useState(true);
    const [displayedOptions, setDisplayedOptions] = useState<string[]>([]);

    const navigationActionRef = useRef<'sort' | 'filter' | null>(null);
    const preservedIndexRef = useRef<number | null>(null);
    const displayedQuestionRef = useRef<Question | null>(null);

    const focusConsumedRef = useRef(false);

    useEffect(() => {
        // Reset the consumed flag if the focus target changes (e.g., navigating from another view)
        focusConsumedRef.current = false;
    }, [questionIdToFocus]);
    
    const consumeFocus = () => {
        if (questionIdToFocus && !focusConsumedRef.current) {
            onFocusConsumed();
            focusConsumedRef.current = true;
        }
    };

    const questionsInNotebook = useMemo(() => {
        if (notebook === 'all') return allQuestions;
        const questionIds: string[] = Array.isArray(notebook.question_ids) ? notebook.question_ids.filter((id): id is string => typeof id === 'string') : [];
        const idSet = new Set(questionIds);
        return allQuestions.filter(q => idSet.has(q.id));
    }, [notebook, allQuestions]);
    
     const sourcesForFilter = useMemo(() => {
        if (notebook !== 'all') return [];
        const sourceMap = new Map<string, { id: string, title: string }>();
        allQuestions.forEach(q => {
            if (q.source && !sourceMap.has(q.source.id)) {
                sourceMap.set(q.source.id, { id: q.source.id, title: q.source.title });
            }
        });
        return Array.from(sourceMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [notebook, allQuestions]);


    const questionErrorRates = useMemo(() => {
        const stats = new Map<string, { total: number; correct: number }>();
        appData.userQuestionAnswers.forEach(ans => {
            const stat = stats.get(ans.question_id) || { total: 0, correct: 0 };
            stat.total++;
            if (ans.is_correct_first_try) stat.correct++;
            stats.set(ans.question_id, stat);
        });
        const rates = new Map<string, number>();
        stats.forEach((stat, qId) => {
            if (stat.total > 0) rates.set(qId, 1 - (stat.correct / stat.total));
        });
        return rates;
    }, [appData.userQuestionAnswers]);
    
    const difficultyThresholds = useMemo(() => {
        const ratesInNotebook = questionsInNotebook
            .map(q => questionErrorRates.get(q.id) ?? 0.5) 
            .sort((a, b) => a - b);
        
        if (ratesInNotebook.length < 3) {
            return { easy: 0.33, medium: 0.66 };
        }
        
        const easyPercentile = ratesInNotebook[Math.floor(ratesInNotebook.length * 0.33)];
        const mediumPercentile = ratesInNotebook[Math.floor(ratesInNotebook.length * 0.66)];
        
        return {
            easy: easyPercentile,
            medium: mediumPercentile
        };
    }, [questionsInNotebook, questionErrorRates]);


    const stableRandomSort = useMemo(() => {
        const randomValues = new Map<string, number>();
        questionsInNotebook.forEach(q => randomValues.set(q.id, Math.random()));
        return (a: Question, b: Question) => (randomValues.get(a.id) ?? 0) - (randomValues.get(b.id) ?? 0);
    }, [questionsInNotebook, shuffleTrigger]);
    
    const sortedQuestions = useMemo(() => {
        let questionsToProcess = [...questionsInNotebook];

        if (notebook === 'all' && sourceFilter !== 'all') {
            questionsToProcess = questionsToProcess.filter(q => q.source?.id === sourceFilter);
        }

        if (showWrongOnly) {
            const answeredIncorrectlyIds = new Set(
                appData.userQuestionAnswers
                    .filter(ans => ans.user_id === currentUser.id && !ans.is_correct_first_try)
                    .map(ans => ans.question_id)
            );
            questionsToProcess = questionsToProcess.filter(q => answeredIncorrectlyIds.has(q.id));
        } else if (notebook === 'all' && showUnansweredInAnyNotebook) {
            const answeredInAnyNotebookIds = new Set(appData.userQuestionAnswers.filter(ans => ans.user_id === currentUser.id).map(ans => ans.question_id));
            questionsToProcess = questionsToProcess.filter(q => !answeredInAnyNotebookIds.has(q.id));
        }
        
        if (difficultyFilter !== 'all') {
            questionsToProcess = questionsToProcess.filter(q => {
                const errorRate = questionErrorRates.get(q.id) ?? 0.5;
                if (difficultyFilter === 'Fácil') return errorRate <= difficultyThresholds.easy;
                if (difficultyFilter === 'Médio') return errorRate > difficultyThresholds.easy && errorRate <= difficultyThresholds.medium;
                if (difficultyFilter === 'Difícil') return errorRate > difficultyThresholds.medium;
                return true;
            });
        }

        const sortGroup = (group: (Question & { user_id: string, created_at: string})[]) => {
            const groupToSort = [...group];
            switch (questionSortOrder) {
                case 'temp': groupToSort.sort((a, b) => (b.hot_votes - b.cold_votes) - (a.hot_votes - a.cold_votes)); break;
                case 'date': groupToSort.sort((a, b) => new Date(b.source?.created_at || 0).getTime() - new Date(a.source?.created_at || 0).getTime()); break;
                case 'random': groupToSort.sort(stableRandomSort); break;
                default: // 'default'
                    if (notebook !== 'all') {
                        const questionIds: string[] = Array.isArray(notebook.question_ids) ? notebook.question_ids.filter((id): id is string => typeof id === 'string') : [];
                        const orderMap = new Map(questionIds.map((id, index) => [id, index]));
                        groupToSort.sort((a,b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
                    }
                    break;
            }
            return groupToSort;
        };
        
        let sortedGroup;
        if (notebook === 'all' && prioritizeApostilas) {
            const apostilaQuestions = questionsToProcess.filter(q => q.source?.title.startsWith('(Apostila)'));
            const otherQuestions = questionsToProcess.filter(q => !q.source?.title.startsWith('(Apostila)'));
            sortedGroup = [...sortGroup(apostilaQuestions), ...sortGroup(otherQuestions)];
        } else {
            sortedGroup = sortGroup(questionsToProcess);
        }
        
        return sortedGroup;

    }, [
        questionsInNotebook, questionSortOrder, prioritizeApostilas, notebook, 
        stableRandomSort, showWrongOnly, appData.userQuestionAnswers, currentUser.id,
        showUnansweredInAnyNotebook, difficultyFilter, questionErrorRates, difficultyThresholds, sourceFilter
    ]);

    const currentQuestionIndex = useMemo(() => {
        if (!activeQuestionId) return -1;
        return sortedQuestions.findIndex(q => q.id === activeQuestionId);
    }, [activeQuestionId, sortedQuestions]);

    const currentQuestion = useMemo(() => {
        if (currentQuestionIndex > -1) {
            return sortedQuestions[currentQuestionIndex];
        }
        // Fallback to find from original list if it was filtered out after answering
        return questionsInNotebook.find(q => q.id === activeQuestionId);
    }, [currentQuestionIndex, sortedQuestions, questionsInNotebook, activeQuestionId]);

     useEffect(() => {
        if (currentQuestion) {
            const options = [...currentQuestion.options];
            if (shuffleOptions) {
                // Fisher-Yates shuffle for stable shuffling within a question view
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
            }
            setDisplayedOptions(options);
        }
    }, [currentQuestion, shuffleOptions]);


    if (currentQuestion) {
        displayedQuestionRef.current = currentQuestion;
    }
    const questionToRender = isCompleted ? (displayedQuestionRef.current ?? currentQuestion) : currentQuestion;

    // This effect is the new single source of truth for navigation.
    useEffect(() => {
        // 1. Prioritize explicit navigation from another view or session restoration
        if (questionIdToFocus) {
            const indexToFocus = sortedQuestions.findIndex(q => q.id === questionIdToFocus);
            if (indexToFocus !== -1 && activeQuestionId !== questionIdToFocus) {
                setActiveQuestionId(questionIdToFocus);
            }
            // This logic runs once per `questionIdToFocus` change and then stops.
            return;
        }

        // 2. Handle navigation from user-initiated sort or filter
        if (navigationActionRef.current) {
            const action = navigationActionRef.current;
            const desiredIndex = action === 'sort' ? (preservedIndexRef.current ?? 0) : 0;
            const newIndex = Math.max(0, Math.min(desiredIndex, sortedQuestions.length - 1));
            
            const newQuestion = sortedQuestions[newIndex] || sortedQuestions[0] || null;

            if (newQuestion && newQuestion.id !== activeQuestionId) {
                setActiveQuestionId(newQuestion.id);
            } else if (!newQuestion && activeQuestionId !== null) {
                setActiveQuestionId(null);
            }
            
            navigationActionRef.current = null;
            preservedIndexRef.current = null;
            return; 
        }

        // 3. Fallback for initialization
        if (sortedQuestions.length > 0 && !activeQuestionId) {
            setActiveQuestionId(sortedQuestions[0].id);
        }
        
    }, [sortedQuestions, activeQuestionId, questionIdToFocus]);

    const handleSortChange = (newSort: typeof questionSortOrder) => {
        consumeFocus();
        navigationActionRef.current = 'sort';
        preservedIndexRef.current = currentQuestionIndex > -1 ? currentQuestionIndex : 0;
        setQuestionSortOrder(newSort);
        if (newSort === 'random') {
            setShuffleTrigger(c => c + 1);
        }
    };

    const triggerFilterChange = () => {
        consumeFocus();
        navigationActionRef.current = 'filter';
        preservedIndexRef.current = 0;
    };
    
    const handleDifficultyFilterChange = (newDifficulty: typeof difficultyFilter) => {
        triggerFilterChange();
        setDifficultyFilter(prev => (prev === newDifficulty ? 'all' : newDifficulty));
    };

    const handleShowWrongOnlyChange = () => {
        triggerFilterChange();
        const isTurningOn = !showWrongOnly;
        setShowWrongOnly(isTurningOn);
        if (isTurningOn) setShowUnansweredInAnyNotebook(false);
    };

    const handleShowUnansweredChange = () => {
        triggerFilterChange();
        const isTurningOn = !showUnansweredInAnyNotebook;
        setShowUnansweredInAnyNotebook(isTurningOn);
        if (isTurningOn) setShowWrongOnly(false);
    };
    
    const handleSourceFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        triggerFilterChange();
        setSourceFilter(e.target.value);
    };

    useEffect(() => {
        if (activeQuestionId) {
            localStorage.setItem('procap_lastQuestionId', activeQuestionId);
        }
    }, [activeQuestionId]);
    
    useEffect(() => {
        if (!questionToRender) return;
        
        const savedAnswer = userAnswers.get(questionToRender.id);
        if (savedAnswer && savedAnswer.notebook_id === notebookId) {
            const correct = savedAnswer.attempts.includes(questionToRender.correctAnswer);
            setIsCompleted(true);
            setSelectedOption(correct ? questionToRender.correctAnswer : savedAnswer.attempts[savedAnswer.attempts.length - 1]);
            setWrongAnswers(new Set(savedAnswer.attempts.filter(a => a !== questionToRender.correctAnswer)));
        } else {
            setSelectedOption(null);
            setWrongAnswers(new Set());
            setIsCompleted(false);
            setStruckOptions(new Set());
        }
    }, [activeQuestionId, questionToRender, userAnswers, notebookId]);
    
    useEffect(() => {
        if (setScreenContext && questionToRender) {
            const context = `Questão: ${questionToRender.questionText}\n\nOpções:\n- ${questionToRender.options.join('\n- ')}`;
            setScreenContext(context);
        }
        return () => { if (setScreenContext) setScreenContext(null); }
    }, [questionToRender, setScreenContext]);

    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOnQuestion) return;
        let updatedComments = [...commentingOnQuestion.comments];
        if (action === 'add') {
            const newComment: Comment = { id: `c_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 };
            updatedComments.push(newComment);
        } else if (action === 'vote') {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) updatedComments[commentIndex][`${payload.voteType}_votes`] += 1;
        }
        
        const success = await updateContentComments('questions', commentingOnQuestion.id, updatedComments);
        if (success) {
            const updatedItem = {...commentingOnQuestion, comments: updatedComments };
            setAppData(prev => ({ ...prev, sources: prev.sources.map(s => s.id === updatedItem.source_id ? { ...s, questions: s.questions.map(q => q.id === updatedItem.id ? updatedItem : q) } : s) }));
            setCommentingOnQuestion(updatedItem);
        }
    };
    
    const handleSelectOption = (option: string) => {
        if (isCompleted || wrongAnswers.has(option)) return;

        if (struckOptions.has(option)) {
            const newSet = new Set(struckOptions);
            newSet.delete(option);
            setStruckOptions(newSet);
            setSelectedOption(option);
        } else if (selectedOption === option) {
            handleConfirmAnswer();
        } else {
            setSelectedOption(option);
        }
    };
    
    const persistAnswer = async (isFinalCorrect: boolean, finalWrongAnswers: Set<string>) => {
        if (!questionToRender || !selectedOption) return;
        
        const wasAnsweredBeforeInThisNotebook = userAnswers.has(questionToRender.id);
        if (wasAnsweredBeforeInThisNotebook) return;

        const wasAnsweredBeforeAnywhere = appData.userQuestionAnswers.some(a => a.user_id === currentUser.id && a.question_id === questionToRender.id);

        let xpGained = 0;
        if (isFinalCorrect && !wasAnsweredBeforeAnywhere) {
            const xpMap = [10, 5, 2]; // XP for 0, 1, or 2 wrong attempts before correct answer
            xpGained = xpMap[finalWrongAnswers.size] ?? 0;
        }

        const attempts = [...finalWrongAnswers, selectedOption];
        const isCorrectFirstTry = isFinalCorrect && attempts.length === 1;

        const answerPayload: Partial<UserQuestionAnswer> = {
            user_id: currentUser.id,
            notebook_id: notebookId,
            question_id: questionToRender.id,
            attempts: attempts,
            is_correct_first_try: isCorrectFirstTry,
            xp_awarded: xpGained,
            timestamp: new Date().toISOString(),
        };

        const savedAnswer = await upsertUserQuestionAnswer(answerPayload);

        if (savedAnswer) {
            setAppData(prev => {
                const newAnswers = prev.userQuestionAnswers.filter(a => a.id !== savedAnswer.id);
                newAnswers.push(savedAnswer);
                return { ...prev, userQuestionAnswers: newAnswers };
            });
        }
        
        if (!wasAnsweredBeforeAnywhere) {
            const newStats = { ...currentUser.stats };
            newStats.questionsAnswered = (newStats.questionsAnswered || 0) + 1;
            const currentStreak = currentUser.stats.streak || 0;
            newStats.streak = isCorrectFirstTry ? currentStreak + 1 : 0;
            if (isCorrectFirstTry) {
                newStats.correctAnswers = (newStats.correctAnswers || 0) + 1;
            }
            const topic = questionToRender.source?.topic || 'Geral';
            if (!newStats.topicPerformance[topic]) newStats.topicPerformance[topic] = { correct: 0, total: 0 };
            newStats.topicPerformance[topic].total += 1;
            if (isCorrectFirstTry) newStats.topicPerformance[topic].correct += 1;
            
            const userWithNewStats = { ...currentUser, stats: newStats, xp: (Number(currentUser.xp) || 0) + xpGained };
            const finalUser = checkAndAwardAchievements(userWithNewStats, appData);
            updateUser(finalUser);

            if (xpGained > 0) {
                 logXpEvent(currentUser.id, xpGained, 'QUESTION_ANSWER', questionToRender.id).then(newEvent => {
                    if (newEvent) setAppData(prev => ({...prev, xp_events: [newEvent, ...prev.xp_events]}));
                });
            }
        }
    };


    const handleConfirmAnswer = async () => {
        if (!selectedOption || !questionToRender || isCompleted) return;

        const isCorrect = selectedOption === questionToRender.correctAnswer;

        if (isCorrect) {
            setIsCompleted(true);
            await persistAnswer(true, wrongAnswers);
        } else {
            const newWrongAnswers = new Set(wrongAnswers).add(selectedOption);
            setWrongAnswers(newWrongAnswers);
            setSelectedOption(null); // Reset selection for next try

            if (newWrongAnswers.size >= 3) {
                setIsCompleted(true);
                await persistAnswer(false, newWrongAnswers);
            }
        }
    };

    const toggleStrike = (option: string) => {
        if (isCompleted) return;
        setStruckOptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(option)) {
                newSet.delete(option);
            } else {
                newSet.add(option);
                if(selectedOption === option) {
                    setSelectedOption(null);
                }
            }
            return newSet;
        });
    };

    const handleTouchStart = (option: string, e: React.TouchEvent) => {
        wasLongPress.current = false;
        wasSwipe.current = false;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        
        longPressTimerRef.current = window.setTimeout(() => {
            toggleStrike(option);
            wasLongPress.current = true;
        }, 500);
    };

    const handleTouchEnd = (option: string, e: React.TouchEvent) => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (wasLongPress.current) {
            return;
        }

        if (touchStartX.current === null || touchStartY.current === null) {
            return;
        }

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX.current;
        const deltaY = touchEndY - touchStartY.current;

        touchStartX.current = null;
        touchStartY.current = null;

        const SWIPE_THRESHOLD = 50;
        const SWIPE_VERTICAL_LIMIT = 50;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_VERTICAL_LIMIT) {
            wasSwipe.current = true;
            toggleStrike(option);
        }
    };
    
    const navigateQuestion = (direction: 1 | -1) => {
        consumeFocus();
        let newIndex;
        if (currentQuestionIndex < 0) { // Current question was filtered out
            newIndex = direction === 1 ? 0 : sortedQuestions.length - 1;
        } else {
            newIndex = currentQuestionIndex + direction;
        }
        
        if (newIndex >= 0 && newIndex < sortedQuestions.length) {
            setActiveQuestionId(sortedQuestions[newIndex].id);
        }
    };
    
    const handleNextUnanswered = () => {
        consumeFocus();
        let nextIndex = -1;
        const startIndex = currentQuestionIndex > -1 ? currentQuestionIndex : -1;

        for (let i = startIndex + 1; i < sortedQuestions.length; i++) {
            if (!userAnswers.has(sortedQuestions[i].id)) {
                nextIndex = i;
                break;
            }
        }
        
        if (nextIndex === -1) {
            for (let i = 0; i < startIndex; i++) {
                if (!userAnswers.has(sortedQuestions[i].id)) {
                    nextIndex = i;
                    break;
                }
            }
        }

        if (nextIndex !== -1) {
            setActiveQuestionId(sortedQuestions[nextIndex].id);
        } else {
            alert("Parabéns! Você respondeu todas as questões deste caderno com os filtros atuais.");
        }
    };

    if (!questionToRender) {
        return (
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <button onClick={onBack} className="mb-4 text-primary-light dark:text-primary-dark hover:underline">&larr; Voltar</button>
                <p>Nenhuma questão encontrada para os filtros selecionados.</p>
            </div>
        );
    }
    
    const revealedHints = questionToRender.hints.slice(0, wrongAnswers.size);
    const showAllHints = isCompleted && selectedOption === questionToRender.correctAnswer;
    
    return (
      <>
        <CommentsModal 
            isOpen={!!commentingOnQuestion} 
            onClose={() => setCommentingOnQuestion(null)} 
            comments={commentingOnQuestion?.comments || []} 
            onAddComment={(text) => handleCommentAction('add', {text})} 
            onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} 
            contentTitle={commentingOnQuestion?.questionText?.substring(0, 50) + '...' || ''}
        />

        <NotebookStatsModal
            isOpen={isStatsModalOpen}
            onClose={() => setIsStatsModalOpen(false)}
            notebook={notebook}
            appData={appData}
            allQuestions={allQuestions}
            currentUser={currentUser}
            onStartClearing={() => setIsClearing(true)}
            onClearAnswers={async (questionIdsToClear) => {
                const success = await clearNotebookAnswers(currentUser.id, notebookId, questionIdsToClear.length > 0 ? questionIdsToClear : undefined);
                if (success) {
                    setAppData(prev => ({
                        ...prev, 
                        userQuestionAnswers: prev.userQuestionAnswers.filter(a => {
                            const isForThisNotebook = a.user_id === currentUser.id && a.notebook_id === notebookId;
                            if (!isForThisNotebook) return true;
                            if (questionIdsToClear.length > 0) {
                                return !questionIdsToClear.includes(a.question_id);
                            }
                            return false; 
                        })
                    }));
                    if(sortedQuestions.length > 0) setActiveQuestionId(sortedQuestions[0].id);
                } else {
                    alert("Não foi possível limpar as respostas.");
                }
            }}
        />
        <ClearAnswersModal
            isOpen={isClearing}
            onClose={() => setIsClearing(false)}
            notebook={notebook}
            appData={appData}
            allQuestions={allQuestions}
            currentUser={currentUser}
            onConfirm={(idsToClear) => {
                const clearAndReset = async () => {
                    const success = await clearNotebookAnswers(currentUser.id, notebookId, idsToClear.length > 0 ? idsToClear : undefined);
                    if (success) {
                        setAppData(prev => ({
                            ...prev, 
                            userQuestionAnswers: prev.userQuestionAnswers.filter(a => {
                                const isForThisNotebook = a.user_id === currentUser.id && a.notebook_id === notebookId;
                                if (!isForThisNotebook) return true;
                                if (idsToClear.length > 0) {
                                    return !idsToClear.includes(a.question_id);
                                }
                                return false; 
                            })
                        }));
                        if(sortedQuestions.length > 0) setActiveQuestionId(sortedQuestions[0].id);
                    } else {
                        alert("Não foi possível limpar as respostas.");
                    }
                };
                clearAndReset();
                setIsClearing(false);
                setIsStatsModalOpen(false);
            }}
        />

        {isQuestionStatsModalOpen && (
             <QuestionStatsModal
                isOpen={isQuestionStatsModalOpen}
                onClose={() => setIsQuestionStatsModalOpen(false)}
                question={questionToRender}
                appData={appData}
            />
        )}
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
             <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <button onClick={onBack} className="text-primary-light dark:text-primary-dark hover:underline">&larr; Voltar</button>
                        <button onClick={() => setIsStatsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-secondary-light text-white text-sm font-semibold rounded-md hover:bg-emerald-600 transition-colors shadow-sm">
                            <ChartBarSquareIcon className="w-5 h-5" />
                            Estatísticas
                        </button>
                    </div>
                    <div className="text-right">
                        <span className="font-semibold">{(currentQuestionIndex > -1 ? currentQuestionIndex : 0) + 1} / {sortedQuestions.length}</span>
                    </div>
                </div>
                <div className="w-full text-left md:text-right text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span className="font-bold">Fonte: </span>
                    <span title={questionToRender?.source?.title}>{questionToRender?.source?.title || 'Desconhecida'}</span>
                </div>
            </div>

            <div className="w-full max-w-full flex flex-wrap justify-start md:justify-between items-center gap-4 mb-4 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Ordenar por:</span>
                    <button title="Padrão do Caderno" onClick={() => handleSortChange('default')} className={`p-2 rounded-full transition ${questionSortOrder === 'default' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>#️⃣</button>
                    <button title="Temperatura" onClick={() => handleSortChange('temp')} className={`p-2 rounded-full transition ${questionSortOrder === 'temp' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>🌡️</button>
                    <button title="Mais Recentes" onClick={() => handleSortChange('date')} className={`p-2 rounded-full transition ${questionSortOrder === 'date' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>🕐</button>
                    <button title="Aleatória" onClick={() => handleSortChange('random')} className={`p-2 rounded-full transition ${questionSortOrder === 'random' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>🔀</button>
                    <button title="Embaralhar Alternativas" onClick={() => setShuffleOptions(s => !s)} className={`p-2 rounded-full transition ${shuffleOptions ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>🎲</button>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Filtrar:</span>
                     {(['Fácil', 'Médio', 'Difícil'] as const).map(d => (
                        <button key={d} onClick={() => handleDifficultyFilterChange(d)} className={`px-3 py-1 rounded-md transition ${difficultyFilter === d ? 'bg-primary-light text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{d}</button>
                    ))}
                    <button title="Mostrar apenas questões erradas" onClick={handleShowWrongOnlyChange} className={`p-2 rounded-full transition ${showWrongOnly ? 'bg-red-500/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}> <XCircleIcon className={`w-5 h--- START OF FILE src/components/views/ContagemView.tsx ---

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { MainContentProps, UserMood } from '../../types';
import { upsertUserMood } from '../../services/supabaseClient';

const PROCAP_START = new Date('2025-11-03T08:00:00-03:00'); // Brasília time (GMT-3)
const PROVA_TIME = new Date('2025-11-23T08:00:00-03:00');

const MOODS = [
    { name: 'Animado', emoji: '🥳', color: '#10b981', bgColor: 'bg-green-500/10', borderColor: 'border-green-500' },
    { name: 'Motivado', emoji: '💪', color: '#14b8a6', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500' },
    { name: 'Focado', emoji: '🎯', color: '#3b82f6', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500' },
    { name: 'Cansado', emoji: '😴', color: '#6b7280', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500' },
    { name: 'Nervoso', emoji: '😬', color: '#eab308', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500' },
    { name: 'Ansioso', emoji: '😰', color: '#f97316', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500' },
    { name: 'Revoltado', emoji: '😡', color: '#ef4444', bgColor: 'bg-red-500/10', borderColor: 'border-red-500' },
    { name: 'Perdido', emoji: '😵', color: '#8b5cf6', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500' },
    { name: 'Marcelando', emoji: '😎', color: '#06b6d4', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500' },
];

const CustomYAxisTick: React.FC<any> = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={4} textAnchor="end" fill="currentColor" fontSize={24} className="transition-all">
            {payload.value}
        </text>
    </g>
);

export const ContagemView: React.FC<MainContentProps> = ({ appData, setAppData, currentUser }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeValues = useMemo(() => {
        const totalDuration = PROVA_TIME.getTime() - PROCAP_START.getTime();
        const elapsedDuration = now.getTime() - PROCAP_START.getTime();
        const progressPercentage = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));

        const remaining = Math.max(0, PROVA_TIME.getTime() - now.getTime());
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(remaining / (1000 * 60));
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(days / 7);

        return { progressPercentage, weeks, days, hours, minutes, seconds };
    }, [now]);

    const moodChartData = useMemo(() => {
        const totalVotes = appData.userMoods.length;

        const moodCounts = new Map<string, number>();
        appData.userMoods.forEach(userMood => {
            moodCounts.set(userMood.mood, (moodCounts.get(userMood.mood) || 0) + 1);
        });

        return MOODS.map(mood => {
            const count = moodCounts.get(mood.name) || 0;
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return {
                name: mood.name,
                emoji: mood.emoji,
                count: count,
                color: mood.color,
                formattedLabel: `${count} (${percentage.toFixed(0)}%)`
            };
        });
    }, [appData.userMoods]);

    const currentUserMood = useMemo(() => {
        return appData.userMoods.find(m => m.user_id === currentUser.id)?.mood;
    }, [appData.userMoods, currentUser.id]);

    const handleMoodChange = async (mood: string) => {
        const oldMood = appData.userMoods.find(m => m.user_id === currentUser.id);

        const optimisticUpdate: UserMood = { user_id: currentUser.id, mood, updated_at: new Date().toISOString() };
        setAppData(prev => ({
            ...prev,
            userMoods: [...prev.userMoods.filter(m => m.user_id !== currentUser.id), optimisticUpdate]
        }));

        const result = await upsertUserMood(currentUser.id, mood);
        if (!result) {
            // Revert on failure
            setAppData(prev => ({
                ...prev,
                userMoods: oldMood ? [...prev.userMoods.filter(m => m.user_id !== currentUser.id), oldMood] : prev.userMoods.filter(m => m.user_id !== currentUser.id)
            }));
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <h2 className="text-2xl font-bold mb-1">🏁 Reta Final: Sua Saga até a Aprovação</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">"A dor é temporária, o cargo é para sempre." (Autor Desconhecido, provavelmente aprovado)</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                    <div
                        className="bg-primary-light h-6 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-1000 ease-out"
                        style={{ width: `${timeValues.progressPercentage}%` }}
                    >
                        {timeValues.progressPercentage.toFixed(4)}%
                    </div>
                </div>
            </div>

            <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <h2 className="text-2xl font-bold mb-2">⏳ Contagem Regressiva para a Glória (ou para o Pânico)</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-center">
                    {[{value: timeValues.weeks, label: "Semanas"}, {value: timeValues.days, label: "Dias"}, {value: timeValues.hours, label: "Horas"}, {value: timeValues.minutes, label: "Minutos"}, {value: timeValues.seconds, label: "Segundos"}].map(item => (
                        <div key={item.label} className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
                            <div className="text-4xl font-bold text-primary-light dark:text-primary-dark">{item.value.toLocaleString('pt-BR')}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{item.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                    <h2 className="text-2xl font-bold mb-4">Como você está se sentindo hoje? 🤔</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MOODS.map(mood => (
                            <button
                                key={mood.name}
                                onClick={() => handleMoodChange(mood.name)}
                                className={`p-2 rounded-lg text-center transition-all border-2 ${
                                    currentUserMood === mood.name
                                        ? `${mood.bgColor} ${mood.borderColor} scale-105 shadow-lg`
                                        : 'bg-background-light dark:bg-background-dark border-transparent hover:scale-105 hover:shadow-md'
                                }`}
                            >
                                <div className="text-2xl">{mood.emoji}</div>
                                <div className="text-xs font-semibold mt-1">{mood.name}</div>
                            </button>
                        ))}
                    </div>
                </div>
                 <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                     <h2 className="text-2xl font-bold mb-4">🌡️ Termômetro do Humor da Galera</h2>
                     <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={moodChartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                             <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                             <XAxis type="number" hide />
                             <YAxis dataKey="emoji" type="category" width={60} tickLine={false} axisLine={false} tick={<CustomYAxisTick />} />
                             <Tooltip 
                                cursor={{fill: 'rgba(200,200,200,0.1)'}} 
                                contentStyle={{ backgroundColor: 'rgba(30,30,30,0.8)', border: 'none', color: 'white', borderRadius: '8px' }}
                                formatter={(value, name, props) => [props.payload.formattedLabel, props.payload.name]}
                             />
                             <Bar dataKey="count" fill="#8884d8" barSize={20}>
                                <LabelList dataKey="formattedLabel" position="right" offset={5} style={{ fill: 'currentColor', fontSize: 12, fontWeight: 'bold' }} />
                                {moodChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                             </Bar>
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
            </div>
        </div>
    );
};
