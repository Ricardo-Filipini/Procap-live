import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { MainContentProps, UserMood } from '../../types';
import { upsertUserMood, getContagemData } from '../../services/supabaseClient';

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
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const areDataLoaded = appData.userMoods.length > 0;
        if (!areDataLoaded) {
            setIsLoading(true);
            getContagemData().then(data => {
                setAppData(prev => ({ ...prev, ...data }));
            }).finally(() => setIsLoading(false));
        }
    }, [appData.userMoods.length, setAppData]);

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
    
    if (isLoading) {
        return <div className="text-center p-8">Carregando dados...</div>;
    }

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