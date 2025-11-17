import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { AgentSettings } from '../types';
import { LinkIcon } from './Icons';

interface AgentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AgentSettings;
    setSettings: React.Dispatch<React.SetStateAction<AgentSettings>>;
}

export const AgentSettingsModal: React.FC<AgentSettingsModalProps> = ({ isOpen, onClose, settings, setSettings }) => {
    const [localSettings, setLocalSettings] = useState<AgentSettings>(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    const handleSave = () => {
        setSettings(localSettings);
        onClose();
    };

    const handleInputChange = (field: keyof AgentSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalSettings(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleRadioChange = (field: keyof AgentSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Agente IA (Ed)">
            <div className="space-y-4 text-sm">
                {/* FIX: Removed API key management UI to adhere to guidelines. */}

                <div>
                    <label className="block font-medium mb-1">Voz do Agente</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="voice" value="Fenrir" checked={localSettings.voice === 'Fenrir'} onChange={() => handleRadioChange('voice', 'Fenrir')} className="text-primary-light focus:ring-primary-light"/>
                            Masculina
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="voice" value="Kore" checked={localSettings.voice === 'Kore'} onChange={() => handleRadioChange('voice', 'Kore')} className="text-primary-light focus:ring-primary-light"/>
                            Feminina
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-1">Velocidade da Fala</label>
                    <div className="flex gap-4">
                        {[
                            { label: 'Lenta', value: 0.85 },
                            { label: 'Normal', value: 1.0 },
                            { label: 'Rápida', value: 1.15 }
                        ].map(({ label, value }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="speed" value={value} checked={localSettings.speed === value} onChange={() => handleRadioChange('speed', value)} className="text-primary-light focus:ring-primary-light"/>
                                {label}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-1">Prompt de Sistema Personalizado (Opcional)</label>
                     <textarea
                        value={localSettings.systemPrompt}
                        onChange={handleInputChange('systemPrompt')}
                        rows={3}
                        placeholder="Ex: 'Seja sempre muito formal' ou 'Use um tom mais descontraído'"
                        className="w-full p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md"
                    />
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 font-semibold">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary-light text-white font-semibold">Salvar</button>
                </div>
            </div>
        </Modal>
    );
};