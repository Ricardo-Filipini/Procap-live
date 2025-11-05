import React from 'react';
import { LiveAgentStatus, Theme } from '../../types';
import { SunIcon, MoonIcon, Cog6ToothIcon, MicrophoneIcon } from '../Icons';

export const Header: React.FC<{ 
    title: string; 
    theme: Theme; 
    setTheme: (theme: Theme) => void; 
    onToggleLiveAgent: () => void;
    isLiveAgentActive: boolean;
    liveAgentStatus: LiveAgentStatus;
    onToggleAgentSettings: () => void;
}> = ({ title, theme, setTheme, onToggleLiveAgent, isLiveAgentActive, liveAgentStatus, onToggleAgentSettings }) => {
    
    const statusInfo = {
        inactive: { color: 'bg-gray-400', title: 'Agente IA Inativo' },
        connecting: { color: 'bg-yellow-400 animate-pulse', title: 'Conectando...' },
        connected: { color: 'bg-green-500', title: 'Conectado' },
        error: { color: 'bg-red-500', title: 'Erro de Conexão' },
        reconnecting: { color: 'bg-yellow-400 animate-pulse', title: 'Reconectando...' },
        disconnected: { color: 'bg-red-500', title: 'Desconectado' },
    }[liveAgentStatus || 'inactive'];
    
    return (
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
                 <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleLiveAgent}
                        title={isLiveAgentActive ? "Encerrar Sessão com IA" : "Iniciar Aprendizado Guiado por IA"}
                        className={`p-2 rounded-full bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:shadow-md transition-shadow relative ${isLiveAgentActive ? 'text-red-500' : ''}`}
                        aria-label={isLiveAgentActive ? "Encerrar sessão com IA" : "Iniciar sessão com IA"}
                    >
                        <MicrophoneIcon className={`w-6 h-6 transition-transform ${liveAgentStatus === 'connected' ? 'animate-pulse' : ''}`} />
                    </button>
                    <span title={statusInfo.title} className={`w-3 h-3 rounded-full ${statusInfo.color} transition-colors`}></span>
                </div>
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
};