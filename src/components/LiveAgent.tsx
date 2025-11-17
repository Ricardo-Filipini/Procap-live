import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    GoogleGenAI,
    LiveServerMessage,
    Modality,
    Blob,
    FunctionDeclaration,
    Type
} from '@google/genai';
import { AppData, User, View, AgentSettings, LiveAgentStatus } from '../types';
import { MicrophoneIcon, MicrophoneSlashIcon, PauseIcon } from './Icons';
import { decode, decodeAudioData, encode } from '../lib/audio';
import { VIEWS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface LiveAgentProps {
    appData: AppData;
    currentUser: User;
    setActiveView: (view: View) => void;
    setNavTarget: (target: {viewName: string, term?: string, id?: string, subId?: string} | null) => void;
    agentSettings: AgentSettings;
    screenContext: string | null;
    setLiveAgentStatus: (status: LiveAgentStatus) => void;
    setAgentSettings: React.Dispatch<React.SetStateAction<AgentSettings>>;
}

const RETRY_DELAYS = [1000, 2000, 5000, 10000]; // ms for retries
const MAX_RETRIES = RETRY_DELAYS.length;

const getApiKey = (): string | undefined => {
    const viteKey = (import.meta as any).env?.VITE_API_KEY;
    if (viteKey) return viteKey;
    const envKey = process.env.API_KEY;
    if (envKey) return envKey;
    return undefined;
};

export const LiveAgent: React.FC<LiveAgentProps> = ({ appData, currentUser, setActiveView, setNavTarget, agentSettings, screenContext, setLiveAgentStatus, setAgentSettings }) => {
    const [isMuted, setIsMuted] = useState(false);
    const isMutedRef = useRef(isMuted);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const resourcesRef = useRef<{
        stream: MediaStream | null;
        inputCtx: AudioContext | null;
        outputCtx: AudioContext | null;
        scriptProcessor: ScriptProcessorNode | null;
        mediaSource: MediaStreamAudioSourceNode | null;
        audioSources: Set<AudioBufferSourceNode>;
    }>({ stream: null, inputCtx: null, outputCtx: null, scriptProcessor: null, mediaSource: null, audioSources: new Set() });

    const nextStartTimeRef = useRef(0);
    const retryCountRef = useRef(0);
    const isUnmountingRef = useRef(false);
    
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const handleStopSpeech = useCallback(() => {
        const { audioSources, outputCtx } = resourcesRef.current;
        if (outputCtx) {
            for (const source of audioSources.values()) {
                try {
                    source.stop();
                } catch (e) {
                    // Ignore errors if source has already stopped
                }
            }
            audioSources.clear();
            nextStartTimeRef.current = 0;
        }
    }, []);

    const cleanup = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
        resourcesRef.current.stream?.getTracks().forEach(track => track.stop());
        resourcesRef.current.scriptProcessor?.disconnect();
        resourcesRef.current.mediaSource?.disconnect();
        resourcesRef.current.inputCtx?.close().catch(console.error);
        resourcesRef.current.outputCtx?.close().catch(console.error);
        handleStopSpeech();
        sessionPromiseRef.current = null;
    }, [handleStopSpeech]);

    const connect = useCallback(async () => {
        cleanup();
        setLiveAgentStatus('connecting');

        const apiKey = getApiKey();
        if (!apiKey) {
            console.error("No API Key available for Live Agent.");
            setLiveAgentStatus('error');
            return;
        }
        
        const ai = new GoogleGenAI({ apiKey });

        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('Audio recording not supported.');

            resourcesRef.current.inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            resourcesRef.current.outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            resourcesRef.current.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const availableViews = VIEWS.filter(v => !v.adminOnly || currentUser.pseudonym === 'admin').map(v => v.name);
            const baseSystemInstruction = `Você é "Ed", um tutor de IA amigável e proativo para a plataforma de estudos Procap G200. Sua voz é masculina e você fala em português do Brasil, usando uma linguagem casual e encorajadora. Seu principal objetivo é ajudar o usuário a estudar, guiando-o pela plataforma e respondendo às suas dúvidas.

**REGRAS CRÍTICAS DE OPERAÇÃO:**
1.  **NUNCA INVENTE NOMES:** Você tem acesso aos dados reais da plataforma. Use suas ferramentas para verificar nomes e IDs antes de agir. Não presuma que um caderno de questões ou resumo com um nome que você imaginou existe.
2.  **FLUXO DE NAVEGAÇÃO OBRIGATÓRIO (2 PASSOS):** Para abrir um item específico (ex: "abrir o caderno de SFN"), você DEVE seguir este processo:
    - **PASSO 1: ACHAR O ID.** Use a função \`findContent\` ou \`querySupabase\` para encontrar o ID exato do item que o usuário pediu.
    - **PASSO 2: NAVEGAR.** Use a função \`navigateTo\` com o ID que você encontrou no passo 1.
    - **Exceção:** Se o usuário pedir para ir a uma tela genérica (ex: "ir para Resumos"), você pode usar \`navigateTo\` diretamente, sem um ID.
3.  **USE O CONTEXTO DA TELA:** A seção "CONTEXTO DA TELA ATUAL" abaixo contém o texto que o usuário está vendo. Use essa informação para responder perguntas como "leia isso para mim" ou "me ajude com esta questão". Combine este contexto com seu conhecimento e, se necessário, com informações do Supabase para dar respostas completas.
4.  **SEJA PROATIVO:** Não espere apenas por comandos. Sugira atividades. Se o usuário parece preso, ofereça uma dica ou sugira abrir um resumo relacionado. Ex: "Notei que você errou algumas questões sobre política monetária. Que tal abrirmos um resumo sobre o COPOM para revisar?"

**FERRAMENTAS DISPONÍVEIS (FUNÇÕES):**

*   \`navigateTo(viewName, id, subId, term)\`:
    *   Uso: Mudar a tela do usuário.
    *   \`viewName\`: Para qual tela ir (ex: "Questões", "Resumos", "Flashcards").
    *   \`id\`: (Opcional) ID de um item principal para abrir (ex: ID de um caderno).
    *   \`subId\`: (Opcional) ID de um sub-item para focar (ex: ID de uma questão específica dentro do caderno).
    *   \`term\`: (Opcional) Termo para filtrar a tela (ex: nome de uma fonte em "Flashcards").

*   \`findContent(viewName, searchTerm)\`:
    *   Uso: Encontrar o ID de um item quando você só sabe o nome. **ESSENCIAL antes de usar \`navigateTo\` com um ID.**
    *   Exemplo: O usuário diz "abrir o caderno de estudos do BCB". Você chama \`findContent(viewName: "Questões", searchTerm: "estudos do BCB")\` para obter o ID, e SÓ ENTÃO chama \`navigateTo(viewName: "Questões", id: "ID_RETORNADO")\`.

*   \`querySupabase(tableName)\`:
    *   Uso: Obter uma lista de todos os itens disponíveis em uma categoria. Útil para responder "quais cadernos existem?".
    *   \`tableName\`: Tabelas permitidas: 'question_notebooks', 'sources'.
    *   Exemplo: O usuário pergunta "quais cadernos de questões temos?". Você chama \`querySupabase(tableName: 'question_notebooks')\` e lista os resultados para ele.

*   \`adjustPlaybackSpeed(speed)\`:
    *   Uso: Ajustar a velocidade da minha fala.
    *   \`speed\`: A nova velocidade. Valores permitidos: 0.85 (lento), 1.0 (normal), 1.15 (rápido).

**INFORMAÇÕES DISPONÍVEIS:**

*   **Usuário Atual:** ${JSON.stringify({ pseudonym: currentUser.pseudonym, level: currentUser.level, xp: currentUser.xp })}
*   **Visualizações Disponíveis:** ${JSON.stringify(availableViews)}

---
**CONTEXTO DA TELA ATUAL:**
${screenContext || "Nenhum conteúdo específico na tela. O usuário está provavelmente em uma tela de listagem."}
---`;
            
            const finalSystemInstruction = [baseSystemInstruction, agentSettings.systemPrompt].filter(Boolean).join('\n\n');

            const functionDeclarations: FunctionDeclaration[] = [
                {
                    name: 'navigateTo',
                    description: 'Navega para uma visualização específica no aplicativo e, opcionalmente, foca em um item ou aplica um filtro.',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            viewName: { type: Type.STRING, description: 'O nome exato da visualização para navegar (ex: "Questões", "Resumos").' },
                            id: { type: Type.STRING, description: '(Opcional) O ID do item específico para abrir (ex: o ID de um caderno de questões).' },
                            subId: { type: Type.STRING, description: '(Opcional) O ID de um sub-item para focar (ex: o ID de uma questão dentro de um caderno).' },
                            term: { type: Type.STRING, description: '(Opcional) Um termo para filtrar o conteúdo na visualização (ex: o nome de uma fonte para filtrar flashcards).' }
                        },
                        required: ['viewName']
                    },
                },
                {
                    name: 'findContent',
                    description: 'Busca por um item de conteúdo específico (como um caderno de questões ou resumo) pelo nome e retorna seu ID. Use isso ANTES de navigateTo se você tiver um nome, mas não um ID.',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            viewName: { type: Type.STRING, description: 'A categoria do conteúdo a ser pesquisado (ex: "Questões" para cadernos, "Resumos" para resumos).' },
                            searchTerm: { type: Type.STRING, description: 'O nome ou parte do nome do conteúdo a ser encontrado.' }
                        },
                        required: ['viewName', 'searchTerm']
                    }
                },
                {
                    name: 'querySupabase',
                    description: 'Consulta uma tabela do banco de dados para obter uma lista de itens. Útil para descobrir o que está disponível. Use para listar cadernos, fontes, etc.',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            tableName: { type: Type.STRING, description: 'O nome da tabela a ser consultada (permitido: "question_notebooks", "sources").' },
                        },
                        required: ['tableName']
                    }
                },
                {
                    name: 'adjustPlaybackSpeed',
                    description: 'Ajusta a velocidade da minha fala para mais rápido ou mais lento.',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            speed: { type: Type.NUMBER, description: 'A nova velocidade de reprodução. Valores permitidos: 0.85 (lento), 1.0 (normal), 1.15 (rápido).' }
                        },
                        required: ['speed']
                    },
                }
            ];

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agentSettings.voice } } },
                    systemInstruction: finalSystemInstruction,
                    tools: [{ functionDeclarations }],
                },
                callbacks: {
                    onopen: () => {
                        setLiveAgentStatus('connected');
                        retryCountRef.current = 0;
                        
                        const { inputCtx, stream } = resourcesRef.current;
                        if (!inputCtx || !stream) return;
                        
                        resourcesRef.current.mediaSource = inputCtx.createMediaStreamSource(stream);
                        resourcesRef.current.scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        resourcesRef.current.scriptProcessor.onaudioprocess = (e) => {
                            if (isMutedRef.current) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = { data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        resourcesRef.current.mediaSource.connect(resourcesRef.current.scriptProcessor);
                        resourcesRef.current.scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                            console.log("Agent speech interrupted by user input.");
                            handleStopSpeech();
                        }

                         if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result: any = { error: 'Função desconhecida' };
                                const args = fc.args as any;

                                try {
                                    if (fc.name === 'navigateTo') {
                                        const { viewName, id, subId, term } = args;
                                        const targetView = VIEWS.find(v => v.name.toLowerCase() === viewName.toLowerCase());
                                        if (targetView) {
                                            setActiveView(targetView);
                                            setTimeout(() => {
                                                setNavTarget({ viewName: targetView.name, term, id, subId });
                                            }, 50);
                                            result = { success: `Navegando para ${targetView.name}.` };
                                        } else {
                                            result = { error: `Visualização "${viewName}" não encontrada.` };
                                        }
                                    } else if (fc.name === 'findContent') {
                                        const { viewName, searchTerm } = args;
                                        const lowerSearchTerm = searchTerm.toLowerCase();
                                        let foundItem: { id: string, name: string } | null = null;
                                        
                                        if (viewName.toLowerCase() === 'questões') {
                                            const notebook = appData.questionNotebooks.find(n => n.name.toLowerCase().includes(lowerSearchTerm));
                                            if (notebook) foundItem = { id: notebook.id, name: notebook.name };
                                        } else if (viewName.toLowerCase() === 'resumos') {
                                            const summary = appData.sources.flatMap(s => s.summaries).find(s => s.title.toLowerCase().includes(lowerSearchTerm));
                                            if (summary) foundItem = { id: summary.id, name: summary.title };
                                        }
                                        
                                        if (foundItem) {
                                            result = foundItem;
                                        } else {
                                            result = { error: `Nenhum conteúdo encontrado em "${viewName}" com o termo "${searchTerm}".` };
                                        }
                                    } else if (fc.name === 'querySupabase') {
                                        const { tableName } = args;
                                        const allowedTables = ['question_notebooks', 'sources'];
                                        if (allowedTables.includes(tableName) && supabase) {
                                            // FIX: Changed select to '*' to prevent column not found errors, as 'name' exists in one table and 'title' in another.
                                            const { data, error } = await supabase.from(tableName).select('*');
                                            if (error) {
                                                result = { error: `Erro ao consultar a tabela: ${error.message}` };
                                            } else {
                                                result = { items: data };
                                            }
                                        } else {
                                            result = { error: `Acesso à tabela "${tableName}" não é permitido ou o banco de dados não está disponível.` };
                                        }
                                    } else if (fc.name === 'adjustPlaybackSpeed') {
                                        const { speed } = args;
                                        if (typeof speed === 'number' && [0.85, 1.0, 1.15].includes(speed)) {
                                            setAgentSettings(prev => ({ ...prev, speed }));
                                            result = { success: `Velocidade da fala ajustada para ${speed}.` };
                                        } else {
                                            result = { error: 'Velocidade inválida. Valores permitidos são 0.85, 1.0, 1.15.' };
                                        }
                                    }
                                } catch (e: any) {
                                    console.error(`Error executing tool call ${fc.name}:`, e);
                                    result = { error: `Ocorreu um erro interno ao executar a função: ${e.message}` };
                                }

                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } }
                                    });
                                });
                            }
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && resourcesRef.current.outputCtx) {
                            const outputCtx = resourcesRef.current.outputCtx;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.playbackRate.value = agentSettings.speed;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => resourcesRef.current.audioSources.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration / agentSettings.speed;
                            resourcesRef.current.audioSources.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setLiveAgentStatus('error');
                        if (!isUnmountingRef.current) handleReconnect();
                    },
                    onclose: (e: CloseEvent) => {
                        setLiveAgentStatus('disconnected');
                        if (!isUnmountingRef.current && e.code !== 1000) {
                            handleReconnect();
                        }
                    },
                },
            });
        } catch (error) {
            console.error('Failed to connect to Live session:', error);
            setLiveAgentStatus('error');
            if (!isUnmountingRef.current) handleReconnect();
        }
    }, [cleanup, setLiveAgentStatus, agentSettings, currentUser, appData, screenContext, setActiveView, setNavTarget, setAgentSettings, handleStopSpeech]);
    
    const handleReconnect = useCallback(() => {
        if (retryCountRef.current < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCountRef.current];
            setLiveAgentStatus('reconnecting');
            console.log(`Connection lost. Reconnecting in ${delay / 1000}s... (Attempt ${retryCountRef.current + 1})`);
            setTimeout(() => {
                retryCountRef.current++;
                connect();
            }, delay);
        } else {
            console.error("Max retries reached. Could not reconnect.");
            setLiveAgentStatus('error');
        }
    }, [connect, setLiveAgentStatus]);

    useEffect(() => {
        isUnmountingRef.current = false;
        connect();
        return () => {
            isUnmountingRef.current = true;
            cleanup();
            setLiveAgentStatus('inactive');
        };
    }, [connect, cleanup, setLiveAgentStatus]);

    return (
        <div className="fixed bottom-24 right-4 z-[100] flex items-center gap-3">
             <button
                onClick={handleStopSpeech}
                className="p-3 rounded-full shadow-lg transition-colors bg-yellow-500 text-white hover:bg-yellow-600"
                title="Pausar fala do agente"
            >
                <PauseIcon className="w-6 h-6" />
            </button>
             <button
                onClick={() => setIsMuted(prev => !prev)}
                className={`p-3 rounded-full shadow-lg transition-colors ${isMuted ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`}
                title={isMuted ? "Ativar microfone" : "Mutar microfone"}
            >
                {isMuted ? <MicrophoneSlashIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
            </button>
        </div>
    );
};
