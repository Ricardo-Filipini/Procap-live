import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { MainContentProps, StudyPlan, XpEvent } from '../../types';
import { User } from '../../types';
import { UserCircleIcon, SparklesIcon } from '../Icons';
import { getPersonalizedStudyPlan } from '../../services/geminiService';
import { FontSizeControl, FONT_SIZE_CLASSES_LARGE } from '../shared/FontSizeControl';
import { addStudyPlan, logXpEvent } from '../../services/supabaseClient';

interface ProfileViewProps extends Pick<MainContentProps, 'currentUser' | 'appData' | 'setAppData' | 'updateUser'> {
  onNavigate: (viewName: string, term: string, id: string) => void;
}

const CustomYAxisTick: React.FC<any> = ({ x, y, payload }) => {
    const value = payload.value;
    const truncatedValue = value.length > 25 ? `${value.substring(0, 25)}...` : value;

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={4} textAnchor="end" fill="currentColor" fontSize={12} className="fill-current text-foreground-light dark:text-foreground-dark">
                <title>{value}</title> {/* Tooltip com nome completo */}
                {truncatedValue}
            </text>
        </g>
    );
};


export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser: user, appData, setAppData, updateUser, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'geral' | 'topico' | 'caderno'>('geral');
    const { 
        correctAnswers = 0, 
        questionsAnswered = 0, 
        topicPerformance = {} 
    } = user.stats || {};
    const overallAccuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;
    const pieData = [ { name: 'Corretas', value: correctAnswers }, { name: 'Incorretas', value: questionsAnswered - correctAnswers } ];
    const COLORS = ['#10b981', '#ef4444'];

    const topicPerformanceData = useMemo(() => {
        return Object.entries(topicPerformance)
            .map(([topic, data]: [string, { correct: number; total: number }]) => ({
                subject: topic,
                Acerto: data.total > 0 ? parseFloat(((data.correct / data.total) * 100).toFixed(1)) : 0,
                fullMark: 100,
                total: data.total,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8); // Top 8 most answered topics for clarity
    }, [topicPerformance]);

    const notebookPerformance = useMemo(() => {
        const performance = new Map<string, { correct: number, total: number }>();
        
        appData.userQuestionAnswers
            .filter(answer => answer.user_id === user.id)
            .forEach(answer => {
                const notebookId = answer.notebook_id;
                const stats = performance.get(notebookId) || { correct: 0, total: 0 };
                stats.total += 1;
                if (answer.is_correct_first_try) {
                    stats.correct += 1;
                }
                performance.set(notebookId, stats);
            });

        const notebookMap = new Map(appData.questionNotebooks.map(nb => [nb.id, nb.name]));
        notebookMap.set('all_questions', 'Todas as Questões');
        notebookMap.set('favorites_notebook', '⭐ Questões Favoritas');

        return Array.from(performance.entries())
            .map(([notebookId, stats]) => {
                const name = notebookMap.get(notebookId) || 'Caderno Desconhecido';
                return {
                    name: name,
                    Acerto: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
                    total: stats.total
                };
            })
            .filter(item => item.total > 0)
            .sort((a, b) => b.total - a.total);
    }, [appData.userQuestionAnswers, appData.questionNotebooks, user.id]);

    
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [fontSize, setFontSize] = useState(0);
    
    const userPlans = useMemo(() => {
        return appData.studyPlans.filter(p => p.user_id === user.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [appData.studyPlans, user.id]);
    
    const xpStats = useMemo(() => {
        const now = new Date();
        const userXpEvents = appData.xp_events.filter(e => e.user_id === user.id);

        const dailyStart = new Date(now);
        dailyStart.setHours(0, 0, 0, 0);
        
        const periodStart = new Date(now);
        periodStart.setHours(now.getHours() < 12 ? 0 : 12, 0, 0, 0);

        const hourlyStart = new Date(now.getTime() - 60 * 60 * 1000);

        const calculateXp = (filterFn: (event: XpEvent) => boolean) => 
            userXpEvents.filter(filterFn).reduce((sum, e) => sum + e.amount, 0);

        return {
            total: user.xp,
            daily: calculateXp(e => new Date(e.created_at) >= dailyStart),
            period: calculateXp(e => new Date(e.created_at) >= periodStart),
            hourly: calculateXp(e => new Date(e.created_at) >= hourlyStart),
        };
    }, [user.id, user.xp, appData.xp_events]);

    const handleGeneratePlan = async () => {
        setLoadingPlan(true);
        const allSummaries = appData.sources.flatMap(s => s.summaries);
        const allFlashcards = appData.sources.flatMap(s => s.flashcards);
        const allMedias = appData.sources.flatMap(s => s.audio_summaries);
        
        const content = {
            summaries: allSummaries,
            flashcards: allFlashcards,
            notebooks: appData.questionNotebooks,
            medias: allMedias
        };

        try {
            const planContent = await getPersonalizedStudyPlan(user.stats, appData.userContentInteractions, content);
            if (!planContent || planContent.startsWith("Desculpe")) {
                throw new Error("A IA não conseguiu gerar o plano de estudos.");
            }
            const newPlan = await addStudyPlan({ user_id: user.id, content: planContent });

            if (newPlan) {
                const isFirstPlan = userPlans.length === 0;
                const xpGained = isFirstPlan ? 100 : 15;

                setAppData(prev => ({ ...prev, studyPlans: [newPlan, ...prev.studyPlans] }));

                // FIX: Defensively cast `user.xp` to a number before performing addition to prevent runtime errors with potentially malformed data.
                const updatedUser = { ...user, xp: (Number(user.xp) || 0) + xpGained };
                updateUser(updatedUser);

                // Log the XP event
                const newXpEvent = await logXpEvent(user.id, xpGained, 'STUDY_PLAN_GENERATED', newPlan.id);
                if (newXpEvent) {
                    setAppData(prev => ({ ...prev, xp_events: [newXpEvent, ...prev.xp_events]}));
                }
            } else {
                throw new Error("Falha ao salvar o novo plano de estudos no banco de dados.");
            }
        } catch (error: any) {
            console.error("Error generating or saving study plan:", error);
            alert(`Ocorreu um erro ao gerar o plano de estudos: ${error.message}`);
        } finally {
            setLoadingPlan(false);
        }
    }
    
    const parseAndRenderMessage = (text: string) => {
        const parts: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        const regex = /(\#\[[^\]]+\])|(\!\[[^\]]+\])|(\?\[[^\]]+\])|(@\[[^\]]+\])/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            const fullMatch = match[0];
            const term = fullMatch.substring(2, fullMatch.length - 1);
            let viewName = '';
            let itemId = '';

            if (fullMatch.startsWith('#[')) {
                viewName = 'Resumos';
                const item = appData.sources.flatMap(s => s.summaries).find(s => s.title === term);
                if (item) itemId = item.id;
            } else if (fullMatch.startsWith('![')) {
                viewName = 'Flashcards';
                const item = appData.sources.flatMap(s => s.flashcards).find(f => f.front === term);
                if (item) itemId = item.id;
            } else if (fullMatch.startsWith('?[')) {
                viewName = 'Questões';
                const item = appData.questionNotebooks.find(n => n.name === term);
                if (item) itemId = item.id;
            } else if (fullMatch.startsWith('@[')) {
                viewName = 'Mídia';
                const item = appData.sources.flatMap(s => s.audio_summaries).find(m => m.title === term);
                if (item) itemId = item.id;
            }
            
            parts.push(
                <span
                    key={match.index}
                    className="text-blue-500 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    onClick={() => { if (itemId) onNavigate(viewName, term, itemId); }}
                >
                    {term}
                </span>
            );
            
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{parts}</div>;
    };


    return (
        <div className={FONT_SIZE_CLASSES_LARGE[fontSize]}>
             <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-bold">{user.pseudonym}</h2>
                <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} maxSize={4} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div className="lg:col-span-2 space-y-8">
                    {/* AI STUDY PLAN */}
                    <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Plano de Estudos Personalizado (IA)</h3>
                            <button onClick={handleGeneratePlan} disabled={loadingPlan} className="bg-secondary-light hover:bg-emerald-600 dark:bg-secondary-dark dark:hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5"/> {loadingPlan ? 'Gerando...' : 'Gerar/Atualizar Plano'}
                            </button>
                        </div>
                        <div className="space-y-2">
                        {userPlans.length > 0 ? (
                            userPlans.map((plan) => (
                                <details key={plan.id} className="bg-background-light dark:bg-background-dark p-3 rounded-lg">
                                    <summary className="font-semibold cursor-pointer">Plano de {new Date(plan.created_at).toLocaleString('pt-BR')}</summary>
                                    <div className="mt-2 pt-2 border-t border-border-light dark:border-border-dark">
                                        {parseAndRenderMessage(plan.content)}
                                    </div>
                                </details>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">Clique no botão para que a IA gere um plano de estudos com base em seu desempenho e interações.</p>
                        )}
                        </div>
                    </div>

                    {/* PERFORMANCE STATS */}
                    <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                        <h3 className="text-2xl font-bold mb-4">Estatísticas de Desempenho</h3>
                        
                        <div className="flex border-b border-border-light dark:border-border-dark mb-4">
                            {([
                                { key: 'geral', label: 'Visão Geral' },
                                { key: 'topico', label: 'Por Tópico' },
                                { key: 'caderno', label: 'Por Caderno' }
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-2 -mb-px border-b-2 text-sm font-semibold transition-colors
                                        ${activeTab === tab.key 
                                            ? 'border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark' 
                                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                        }`
                                    }
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="min-h-[400px]">
                            {activeTab === 'geral' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                                    const RADIAN = Math.PI / 180;
                                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                    return (
                                                        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold">
                                                            {`${(percent * 100).toFixed(0)}%`}
                                                        </text>
                                                    );
                                                }}>
                                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="space-y-4 text-center">
                                         <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
                                            <p className="font-semibold text-gray-500">Aproveitamento Geral</p>
                                            <p className="text-3xl font-bold text-primary-light dark:text-primary-dark">{overallAccuracy.toFixed(1)}%</p>
                                        </div>
                                         <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
                                            <p className="font-semibold text-gray-500">Questões Respondidas</p>
                                            <p className="text-3xl font-bold">{questionsAnswered}</p>
                                        </div>
                                         <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
                                            <p className="font-semibold text-gray-500">Maior Sequência</p>
                                            <p className="text-3xl font-bold">{user.stats.streak || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                             {activeTab === 'topico' && (
                                topicPerformanceData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={400}>
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={topicPerformanceData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                            <Radar name="% de Acerto" dataKey="Acerto" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                            <Tooltip />
                                            <Legend />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-center text-gray-500 pt-10">Responda a mais questões para ver seu desempenho por tópico.</p>
                            )}
                            {activeTab === 'caderno' && (
                                notebookPerformance.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={notebookPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" domain={[0, 100]} unit="%"/>
                                        <YAxis dataKey="name" type="category" width={150} tick={<CustomYAxisTick />} />
                                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                                        <Legend />
                                        <Bar dataKey="Acerto" fill="#82ca9d" />
                                    </BarChart>
                                </ResponsiveContainer>
                                ) : <p className="text-center text-gray-500 pt-10">Responda a questões em cadernos para ver seu desempenho.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-8">
                     {/* USER STATS */}
                    <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                        <h3 className="text-xl font-bold text-center mb-4">XP em Destaque</h3>
                        <div className="space-y-3">
                            <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg text-center">
                                <p className="font-semibold text-gray-500">XP Total</p>
                                <p className="text-3xl font-bold text-primary-light dark:text-primary-dark">{xpStats.total}</p>
                            </div>
                            <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg text-center">
                                <p className="font-semibold text-gray-500">XP Hoje</p>
                                <p className="text-2xl font-bold">{xpStats.daily}</p>
                            </div>
                            <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg text-center">
                                <p className="font-semibold text-gray-500">XP no Período</p>
                                <p className="text-2xl font-bold">{xpStats.period}</p>
                            </div>
                            <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg text-center">
                                <p className="font-semibold text-gray-500">XP na Última Hora</p>
                                <p className="text-2xl font-bold">{xpStats.hourly}</p>
                            </div>
                        </div>
                    </div>
                    {/* ACHIEVEMENTS */}
                    <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                        <h3 className="text-xl font-semibold mb-4">Conquistas</h3>
                        <div className="flex flex-wrap gap-2">
                            {Array.isArray(user.achievements) && user.achievements.length > 0 ? (
                                (user.achievements.slice().sort().map((ach: string) => (
                                    <div key={ach} title={ach} className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 text-sm font-semibold px-3 py-1 rounded-full">
                                        {ach}
                                    </div>
                                )))
                            ) : (
                                <p className="text-gray-500">Nenhuma conquista desbloqueada ainda.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};