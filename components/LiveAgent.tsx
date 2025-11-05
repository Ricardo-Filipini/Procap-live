import React, { useState, useEffect, useRef } from 'react';
// Fix: Removed unused and unexported 'LiveSession' type. The session type is inferred.
import {
    GoogleGenAI,
    LiveServerMessage,
    Modality,
    Blob,
    FunctionDeclaration,
    Type
} from '@google/genai';
import { AppData, User, View, AgentSettings } from '../types';
import { MicrophoneIcon, MicrophoneSlashIcon } from './Icons';
import { decode, decodeAudioData, encode } from '../lib/audio';
import { VIEWS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface LiveAgentProps {
    appData: AppData;
    currentUser: User;
    setActiveView: (view: View) => void;
    setNavTarget: (target: {viewName: string, term: string, id?: string, subId?: string} | null) => void;
    agentSettings: AgentSettings;
}

export const LiveAgent: React.FC<LiveAgentProps> = ({ appData, currentUser, setActiveView, setNavTarget, agentSettings }) => {
    const [isMuted, setIsMuted] = useState(false);
    const isMutedRef = useRef(isMuted);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);

    const createBlob = (data: Float32Array): Blob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
    };

    useEffect(() => {
        let ai: GoogleGenAI;
        try {
            // Use user-provided key if available, otherwise fallback to the default one from environment.
            const apiKey = agentSettings.apiKey.trim() || process.env.API_KEY!;
            if (!apiKey) throw new Error("API Key not found.");
            ai = new GoogleGenAI({ apiKey });
        } catch (e) {
            console.error(e);
            return;
        }
       
        const availableViews = VIEWS.filter(v => !v.adminOnly || currentUser.pseudonym === 'admin').map(v => v.name);
        
        const baseSystemInstruction = `
            Você é 'Ed', um assistente de IA especialista na plataforma de estudos Procap-G200.
            Seu objetivo é ajudar o usuário, ${currentUser.pseudonym}, a navegar e utilizar a plataforma de forma eficiente.
            Você é amigável, prestativo e direto. Responda sempre em Português do Brasil.
            Para interagir com a UI, você DEVE usar as funções disponíveis.

            **FLUXO 1: Acessar um item específico (ex: um caderno de questões)**
            1.  **SEMPRE** comece usando a função 'findContent' para pesquisar o que o usuário pediu. Por exemplo, se o usuário diz "abrir caderno de SFN", você chama 'findContent({ viewName: 'Questões', searchTerm: 'SFN' })'.
            2.  A função retornará uma lista de itens encontrados com seus IDs. Analise a lista.
            3.  **ENTÃO**, chame a função 'navigateTo' usando o 'id' que você encontrou. Exemplo: 'navigateTo({ viewName: 'Questões', itemId: 'uuid-do-caderno-encontrado' })'.
            4.  NUNCA chame 'navigateTo' com um nome de item; SEMPRE use o ID. Se 'findContent' não retornar nada, informe ao usuário que não encontrou.

            **FLUXO 2: Filtrar uma tela por uma fonte (ex: flashcards de uma apostila)**
            1.  Use 'findContent' na tela 'Fontes' para obter o nome exato da fonte. Ex: 'findContent({ viewName: 'Fontes', searchTerm: 'Apostila 2' })'.
            2.  A função retornará o nome completo da fonte, como '(Apostila) 2.SFN e BCB...'.
            3.  **ENTÃO**, chame 'navigateTo' para a tela desejada (ex: 'Flashcards'), passando o nome completo da fonte no parâmetro 'term'. Ex: 'navigateTo({ viewName: 'Flashcards', term: '(Apostila) 2.SFN e BCB...' })'.

            **FLUXO 3: Obter informações gerais (ex: listar cadernos disponíveis)**
            1.  Use a função 'querySupabase' para consultar tabelas permitidas ('question_notebooks', 'sources').
            2.  Exemplo: Para listar cadernos, chame 'querySupabase({ tableName: 'question_notebooks', columns: 'name' })'.
            3.  Use o resultado para informar o usuário ou para tomar uma decisão (como escolher um caderno aleatório e navegar para ele usando o FLUXO 1).
        `;

        const finalSystemInstruction = [baseSystemInstruction, agentSettings.systemPrompt].filter(Boolean).join('\n\n');
        
        const findContent = (viewName: string, searchTerm: string): string => {
            const normalizedSearchTerm = searchTerm.toLowerCase();
            let results: { name: string; id: string }[] = [];

            if (viewName === 'Resumos') {
                results = appData.sources.flatMap(s => s.summaries).filter(s => s.title.toLowerCase().includes(normalizedSearchTerm)).map(r => ({ name: r.title, id: r.id }));
            } else if (viewName === 'Questões') {
                results = appData.questionNotebooks.filter(n => n.name.toLowerCase().includes(normalizedSearchTerm)).map(n => ({ name: n.name, id: n.id }));
            } else if (viewName === 'Fontes') {
                results = appData.sources.filter(s => s.title.toLowerCase().includes(normalizedSearchTerm)).map(s => ({ name: s.title, id: s.id }));
            }

            return JSON.stringify(results);
        };

        const navigateTo = (viewName: string, itemId?: string, subItemId?: string, term?: string) => {
            const targetView = VIEWS.find(v => v.name.toLowerCase() === viewName.toLowerCase());
            if (!targetView) return `Tela '${viewName}' não encontrada.`;

            // O termo de filtro tem prioridade se ambos forem fornecidos.
            if (term) {
                setNavTarget({ viewName: targetView.name, term: term, id: undefined, subId: undefined });
                return `Navegando para a tela '${viewName}' e filtrando por '${term}'.`;
            } else if (itemId) {
                 setNavTarget({ viewName: targetView.name, term: "", id: itemId, subId: subItemId });
            }
            setActiveView(targetView);
            return `Navegando para ${itemId ? 'o item' : 'a tela'} '${viewName}'.`;
        };
        
        const querySupabase = async (tableName: string, columns: string = '*', filterColumn?: string, filterValue?: string): Promise<string> => {
            if (!supabase) return JSON.stringify({ error: "Supabase não conectado." });
            const WHITELIST = ['question_notebooks', 'sources'];
            if (!WHITELIST.includes(tableName)) return JSON.stringify({ error: `Acesso à tabela '${tableName}' não permitido.` });
            
            try {
                let query = supabase.from(tableName).select(columns);
                if (filterColumn && filterValue) {
                    query = query.ilike(filterColumn, `%${filterValue}%`);
                }
                const { data, error } = await query.limit(20);
                if (error) throw error;
                return JSON.stringify(data);
            } catch (e: any) {
                return JSON.stringify({ error: `Erro ao consultar Supabase: ${e.message}` });
            }
        };

        const findContentFunctionDeclaration: FunctionDeclaration = {
            name: 'findContent',
            description: 'Busca por conteúdo (resumos, cadernos, fontes, etc.) dentro de uma tela para obter seus nomes e IDs.',
            parameters: {
                type: Type.OBJECT,
                properties: { viewName: { type: Type.STRING, description: `A tela para buscar. Opções: ${availableViews.join(', ')}.` }, searchTerm: { type: Type.STRING, description: 'O termo a ser buscado.' } },
                required: ['viewName', 'searchTerm']
            }
        };

        const navigateToFunctionDeclaration: FunctionDeclaration = {
            name: 'navigateTo',
            description: 'Navega para uma tela, para um item específico (usando seu ID) ou filtra uma tela (usando um termo).',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    viewName: { type: Type.STRING, description: `O nome da tela. Opções: ${availableViews.join(', ')}.` },
                    itemId: { type: Type.STRING, description: "Opcional. O ID do item para abrir (obtido via 'findContent')." },
                    subItemId: { type: Type.STRING, description: "Opcional. O ID de um sub-item (ex: uma questão dentro de um caderno)." },
                    term: { type: Type.STRING, description: "Opcional. Um termo para filtrar a tela (ex: o nome exato de uma fonte)." }
                },
                required: ['viewName']
            }
        };
        
         const querySupabaseFunctionDeclaration: FunctionDeclaration = {
            name: 'querySupabase',
            description: "Consulta uma tabela no banco de dados Supabase para obter informações. Tabelas permitidas: 'question_notebooks', 'sources'.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    tableName: { type: Type.STRING, description: "O nome da tabela a ser consultada ('question_notebooks' ou 'sources')." },
                    columns: { type: Type.STRING, description: "Opcional. As colunas a serem retornadas, separadas por vírgula (ex: 'id,name'). Padrão é '*' (todas as colunas)." },
                    filterColumn: { type: Type.STRING, description: "Opcional. A coluna pela qual filtrar os resultados." },
                    filterValue: { type: Type.STRING, description: "Opcional. O valor a ser usado no filtro (busca parcial, insensível a maiúsculas)." }
                },
                required: ['tableName']
            }
        };

        const connect = async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('Audio recording not supported.');
                
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agentSettings.voice } } },
                        systemInstruction: finalSystemInstruction,
                        tools: [{ functionDeclarations: [findContentFunctionDeclaration, navigateToFunctionDeclaration, querySupabaseFunctionDeclaration] }],
                    },
                    callbacks: {
                        onopen: () => {
                            if (!inputAudioContextRef.current || !streamRef.current) return;
                            mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current.onaudioprocess = (e) => {
                                if (isMutedRef.current) return;
                                const inputData = e.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
                            };
                            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                           if (message.toolCall) {
                                for (const fc of message.toolCall.functionCalls) {
                                    let result = "ok";
                                    try {
                                        if (fc.name === 'findContent') {
                                            result = findContent(fc.args.viewName as string, fc.args.searchTerm as string);
                                        } else if (fc.name === 'navigateTo') {
                                            result = navigateTo(fc.args.viewName as string, fc.args.itemId as string, fc.args.subItemId as string, fc.args.term as string);
                                        } else if (fc.name === 'querySupabase') {
                                            result = await querySupabase(fc.args.tableName as string, fc.args.columns as string, fc.args.filterColumn as string, fc.args.filterValue as string);
                                        }
                                    } catch (e: any) { result = `Erro: ${e.message}`; }

                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] });
                                    });
                                }
                            }

                            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (audioData && outputAudioContextRef.current) {
                                const outputCtx = outputAudioContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.playbackRate.value = agentSettings.speed;
                                source.connect(outputCtx.destination);
                                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration / agentSettings.speed;
                                sourcesRef.current.add(source);
                            }

                            if(message.serverContent?.interrupted) {
                                for(const source of sourcesRef.current.values()) {
                                    source.stop();
                                    sourcesRef.current.delete(source);
                                }
                                nextStartTimeRef.current = 0;
                            }
                        },
                        onerror: (e: ErrorEvent) => console.error('Live session error:', e),
                        onclose: (e: CloseEvent) => {},
                    },
                });
            } catch (error) {
                console.error('Failed to connect to Live session:', error);
            }
        };

        connect();

        return () => {
            sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
            streamRef.current?.getTracks().forEach(track => track.stop());
            scriptProcessorRef.current?.disconnect();
            mediaStreamSourceRef.current?.disconnect();
            inputAudioContextRef.current?.close().catch(console.error);
            outputAudioContextRef.current?.close().catch(console.error);
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
        };
    }, [currentUser, setActiveView, setNavTarget, appData, agentSettings]);

    return (
        <div className="fixed bottom-24 right-4 z-[100] flex flex-col items-center gap-4">
             <button
                onClick={() => setIsMuted(prev => !prev)}
                className={`p-4 rounded-full shadow-lg transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                title={isMuted ? "Desmutar Microfone" : "Mutar Microfone"}
            >
                {isMuted ? <MicrophoneSlashIcon className="w-8 h-8" /> : <MicrophoneIcon className="w-8 h-8" />}
            </button>
        </div>
    );
};