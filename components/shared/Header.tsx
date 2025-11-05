import React from 'react';
import { Theme } from '../../types';
import { SunIcon, MoonIcon, Cog6ToothIcon, MicrophoneIcon } from '../Icons';

export const Header: React.FC<{ 
    title: string; 
    theme: Theme; 
    setTheme: (theme: Theme) => void; 
    onToggleLiveAgent: () => void;
    isLiveAgentActive: boolean;
    onToggleAgentSettings: () => void;
}> = ({ title, theme, setTheme, onToggleLiveAgent, isLiveAgentActive, onToggleAgentSettings }) => (
    <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground-light dark:text-foreground-dark">{title}</h1>
        <div className="flex items-center gap-4">
            <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-full bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:shadow-md transition-shadow"
                aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            >
                {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
            </button>
             <button
                onClick={onToggleLiveAgent}
                title={isLiveAgentActive ? "Encerrar Sessão com IA" : "Iniciar Aprendizado Guiado por IA"}
                className={`p-2 rounded-full bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:shadow-md transition-shadow relative ${isLiveAgentActive ? 'text-red-500' : ''}`}
                aria-label={isLiveAgentActive ? "Encerrar sessão com IA" : "Iniciar sessão com IA"}
            >
                <MicrophoneIcon className="w-6 h-6" />
                {isLiveAgentActive && <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 animate-pulse"></span>}
            </button>
             <button
                onClick={onToggleAgentSettings}
                title="Configurações do Agente IA"
                className="p-2 rounded-full bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:shadow-md transition-shadow"
                aria-label="Configurações do Agente IA"
            >
                <Cog6ToothIcon className="w-6 h-6" />
            </button>
        </div>
    </div>
);