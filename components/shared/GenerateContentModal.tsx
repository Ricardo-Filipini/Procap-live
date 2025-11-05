import React, { useState } from 'react';
import { Modal } from '../Modal';
import { Source } from '../../types';
import { SparklesIcon } from '../Icons';

export const GenerateContentModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    sources: Source[],
    onGenerate: (selectedSourceIds: string[], prompt: string) => void,
    prompt: string,
    contentType: 'summaries' | 'flashcards' | 'questions',
    isLoading: boolean
}> = ({ isOpen, onClose, sources, onGenerate, prompt, contentType, isLoading }) => {
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

    const handleToggleSource = (sourceId: string) => {
        setSelectedSources(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sourceId)) {
                newSet.delete(sourceId);
            } else {
                newSet.add(sourceId);
            }
            return newSet;
        });
    };

    const handleGenerate = () => {
        if (selectedSources.size > 0) {
            onGenerate(Array.from(selectedSources), prompt);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gerar ${contentType} com IA`}>
            <p className="text-sm mb-4">A IA usará o conteúdo das fontes selecionadas como base para gerar novos materiais sobre: <strong className="text-primary-light dark:text-primary-dark">"{prompt}"</strong></p>
            <div className="space-y-2 max-h-60 overflow-y-auto border-y border-border-light dark:border-border-dark py-2 my-2">
                <h3 className="font-semibold">Selecione as fontes de contexto:</h3>
                {sources.map(source => (
                    <div key={source.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-background-light dark:hover:bg-background-dark">
                        <input
                            type="checkbox"
                            id={`source-${source.id}`}
                            checked={selectedSources.has(source.id)}
                            onChange={() => handleToggleSource(source.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light"
                        />
                        <label htmlFor={`source-${source.id}`} className="flex-grow cursor-pointer">
                            <span className="font-medium">{source.title}</span>
                            <span className="text-xs text-gray-500 ml-2">({source.materia})</span>
                        </label>
                    </div>
                ))}
            </div>
            <button
                onClick={handleGenerate}
                disabled={selectedSources.size === 0 || isLoading}
                className="mt-4 w-full bg-primary-light text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-10"
            >
                {isLoading ? (
                    <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Gerando...</span>
                    </div>
                ) : (
                    <> <SparklesIcon className="w-5 h-5 mr-2" /> Gerar Conteúdo </>
                )}
            </button>
        </Modal>
    );
};
