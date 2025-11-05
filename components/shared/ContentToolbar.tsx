import React, { useState } from 'react';
import { XMarkIcon, StarIcon } from '../Icons';

type SortOption = 'temp' | 'time' | 'subject' | 'user' | 'source';
type FilterStatus = 'all' | 'read' | 'unread';

export const ContentToolbar: React.FC<{
    sort: SortOption, setSort: (s: SortOption) => void,
    filter?: FilterStatus, setFilter?: (f: FilterStatus) => void,
    favoritesOnly?: boolean, setFavoritesOnly?: (b: boolean) => void,
    onAiFilter?: (prompt: string) => void,
    onGenerate?: (prompt: string) => void,
    isFiltering?: boolean,
    onClearFilter?: () => void,
    supportedSorts?: SortOption[],
}> = ({ sort, setSort, filter, setFilter, favoritesOnly, setFavoritesOnly, onAiFilter, onGenerate, isFiltering, onClearFilter, supportedSorts }) => {
    const [prompt, setPrompt] = useState('');
    
    const allSorts: Record<SortOption, { title: string, icon: string }> = {
        temp: { title: "Temperatura", icon: "🌡️" },
        time: { title: "Data", icon: "🕐" },
        subject: { title: "Matéria", icon: "📚" },
        user: { title: "Usuário", icon: "👤" },
        source: { title: "Fonte", icon: "📄" },
    };

    const availableSorts = supportedSorts ? supportedSorts.map(s => ({ key: s, ...allSorts[s] })) : Object.entries(allSorts).map(([key, value]) => ({ key: key as SortOption, ...value }));
    
    return (
        <div className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark mb-6 space-y-4">
            {onAiFilter && (
                 <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-grow w-full relative">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={onGenerate ? "Filtrar por relevância com IA ou gerar novo conteúdo..." : "Filtrar por relevância com IA..."}
                            className="w-full p-2 pl-4 pr-32 rounded-md bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
                        />
                        <div className="absolute right-1 top-1 flex gap-1">
                        <button onClick={() => onAiFilter(prompt)} className="px-3 py-1 bg-secondary-light text-white text-sm rounded-md hover:bg-emerald-600 disabled:opacity-50" disabled={!prompt}>Filtrar</button>
                        {onGenerate && <button onClick={() => { onGenerate(prompt); }} className="px-3 py-1 bg-primary-light text-white text-sm rounded-md hover:bg-indigo-600 disabled:opacity-50" disabled={!prompt}>Gerar</button>}
                        </div>
                    </div>
                    {isFiltering && onClearFilter && (
                        <button onClick={onClearFilter} className="flex items-center gap-2 text-red-500 font-semibold text-sm">
                            <XMarkIcon className="w-4 h-4" /> Limpar Filtro
                        </button>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-4">
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
                {filter !== undefined && setFilter && favoritesOnly !== undefined && setFavoritesOnly && (
                    <div className="flex items-center gap-4">
                        <div>
                            <span className="font-semibold mr-2">Mostrar:</span>
                            <select value={filter} onChange={e => setFilter(e.target.value as FilterStatus)} className="p-1 rounded-md bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                                <option value="all">Todos</option>
                                <option value="read">Lidos</option>
                                <option value="unread">Não lidos</option>
                            </select>
                        </div>
                        <button onClick={() => setFavoritesOnly(!favoritesOnly)} className={`flex items-center gap-1 p-2 rounded-md ${favoritesOnly ? 'bg-yellow-400/20 text-yellow-600' : ''}`}>
                            <StarIcon filled={favoritesOnly} className="w-5 h-5" /> Favoritos
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
