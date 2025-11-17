
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppData, User, ChatMessage, MainContentProps, XpEvent } from '../../types';
import { PaperAirplaneIcon, MinusIcon, PlusIcon, PlayIcon, PauseIcon, ArrowPathIcon } from '../Icons';
import { FontSizeControl, FONT_SIZE_CLASSES } from '../shared/FontSizeControl';
import { addChatMessage, supabase, upsertUserVote, incrementMessageVote, updateUser as supabaseUpdateUser, logXpEvent, getCommunityData } from '../../services/supabaseClient';
import { getSimpleChatResponse } from '../../services/geminiService';

const Chat: React.FC<{currentUser: User, appData: AppData, setAppData: React.Dispatch<React.SetStateAction<AppData>>; onNavigate: (viewName: string, term: string) => void;}> = ({currentUser, appData, setAppData, onNavigate}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sortOrder, setSortOrder] = useState<'time' | 'temp'>('time');
    const [activeVote, setActiveVote] = useState<{ messageId: string; type: 'hot' | 'cold' } | null>(null);
    const [fontSize, setFontSize] = useState(2);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const votePopupRef = useRef<HTMLDivElement>(null);
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [appData.chatMessages]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (votePopupRef.current && !votePopupRef.current.contains(event.target as Node)) {
                setActiveVote(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    useEffect(() => {
        if (!supabase) return;

        const handleChatMessage = (payload: any, eventType: 'INSERT' | 'UPDATE') => {
             setAppData(prev => {
                let newMessages = [...prev.chatMessages];
                const existingIndex = newMessages.findIndex(m => m.id === payload.new.id);
                if (existingIndex > -1) {
                    if (eventType === 'UPDATE') newMessages[existingIndex] = payload.new;
                } else if (eventType === 'INSERT') {
                    newMessages.push(payload.new);
                }
                return { ...prev, chatMessages: newMessages };
            });
        }
        
        const handleUserVote = (payload: any) => {
             setAppData(prev => {
                let newVotes = [...prev.userMessageVotes];
                const existingIndex = newVotes.findIndex(v => v.id === payload.new.id);
                if (existingIndex > -1) {
                    newVotes[existingIndex] = payload.new;
                } else {
                    newVotes.push(payload.new);
                }
                return { ...prev, userMessageVotes: newVotes };
            });
        }

        const chatChannel = supabase.channel('public:chat_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => handleChatMessage(payload, 'INSERT'))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => handleChatMessage(payload, 'UPDATE'))
            .subscribe();
            
        const voteChannel = supabase.channel('public:user_message_votes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_message_votes' }, handleUserVote)
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(voteChannel);
        };
    }, [setAppData]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
    
        const textToSend = input.trim();
        setInput('');
    
        const userMessagePayload: Omit<ChatMessage, 'id' | 'hot_votes' | 'cold_votes'> = {
            author: currentUser.pseudonym,
            text: textToSend,
            timestamp: new Date().toISOString()
        };
        
        const insertedUserMessage = await addChatMessage(userMessagePayload);
    
        if (insertedUserMessage) {
            setAppData(prev => ({
                ...prev,
                chatMessages: [...prev.chatMessages.filter(m => m.id !== insertedUserMessage.id), insertedUserMessage]
            }));
    
            const lowerInput = textToSend.toLowerCase();
            if (lowerInput.includes('@ia') || lowerInput.includes('@ed')) {
                setIsLoading(true);
                try {
                    const history = [...appData.chatMessages, insertedUserMessage]
                        .filter(m => m.author === currentUser.pseudonym || m.author === 'IA')
                        .map(m => ({
                            role: m.author === currentUser.pseudonym ? 'user' : 'model',
                            parts: [{ text: m.text }]
                        }));
    
                    const aiResponseText = await getSimpleChatResponse(history, textToSend);
                    
                    const aiMessagePayload: Omit<ChatMessage, 'id' | 'hot_votes' | 'cold_votes'> = {
                        author: 'IA',
                        text: aiResponseText,
                        timestamp: new Date().toISOString()
                    };
                    const insertedAiMessage = await addChatMessage(aiMessagePayload);
    
                    if (insertedAiMessage) {
                        setAppData(prev => ({
                            ...prev,
                            chatMessages: [...prev.chatMessages.filter(m => m.id !== insertedAiMessage.id), insertedAiMessage]
                        }));
                    }
                } catch (error) {
                    console.error("Error with AI response in chat:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        } else {
            setInput(textToSend);
            alert("Falha ao enviar a mensagem. Tente novamente.");
        }
    };
    
    const handleVote = async (messageId: string, type: 'hot' | 'cold', increment: 1 | -1) => {
        const userVote = appData.userMessageVotes.find(v => v.user_id === currentUser.id && v.message_id === messageId);
        if (increment === -1) {
            if (type === 'hot' && (userVote?.hot_votes || 0) <= 0) return;
            if (type === 'cold' && (userVote?.cold_votes || 0) <= 0) return;
        }

        const message = appData.chatMessages.find(m => m.id === messageId);
        const author = message ? appData.users.find((u): u is User => !!u && u.pseudonym === message.author) : null;
        const isOwnContent = !author || author.id === currentUser.id;

        setAppData(prev => {
            const newVotes = prev.userMessageVotes.map(v => 
                (v.user_id === currentUser.id && v.message_id === messageId)
                ? { ...v, [`${type}_votes`]: (v[`${type}_votes`] || 0) + increment }
                : v
            );
            if (!newVotes.some(v => v.user_id === currentUser.id && v.message_id === messageId)) {
                 newVotes.push({ id: `temp_${Date.now()}`, user_id: currentUser.id, message_id: messageId, hot_votes: type === 'hot' ? 1 : 0, cold_votes: type === 'cold' ? 1 : 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            }

            const newMessages = prev.chatMessages.map(m => 
                m.id === messageId ? { ...m, [`${type}_votes`]: (m[`${type}_votes`] || 0) + increment } : m
            );
            return { ...prev, userMessageVotes: newVotes, chatMessages: newMessages };
        });

        await upsertUserVote('user_message_votes', { user_id: currentUser.id, message_id: messageId, hot_votes_increment: type === 'hot' ? increment : 0, cold_votes_increment: type === 'cold' ? increment : 0 }, ['user_id', 'message_id']);
        await incrementMessageVote(messageId, `${type}_votes`, increment);

        if (author && !isOwnContent) {
            const xpChange = (type === 'hot' ? 1 : -1) * increment;
            const updatedAuthor = { ...author, xp: (Number(author.xp) || 0) + xpChange };
            const result = await supabaseUpdateUser(updatedAuthor);
            if (result) {
                logXpEvent(author.id, xpChange, 'CHAT_VOTE_RECEIVED', messageId).then(newEvent => {
                    if (newEvent) setAppData(prev => ({...prev, xp_events: [...prev.xp_events, newEvent]}));
                });
                setAppData(prev => ({
                    ...prev,
                    users: prev.users.map(u => u.id === result.id ? result : u),
                }));
            }
        }
    }
    
    const formatTimestamp = (isoString: string) => {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    };

    const sortedMessages = useMemo(() => {
        const messages = [...appData.chatMessages];
        if (sortOrder === 'time') {
            return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
        if (sortOrder === 'temp') {
            return messages.sort((a, b) => {
                const tempA = (a.hot_votes || 0) - (a.cold_votes || 0);
                const tempB = (b.hot_votes || 0) - (b.cold_votes || 0);
                if (tempB !== tempA) return tempB - tempA;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
        }
        return messages;
    }, [appData.chatMessages, sortOrder]);

    const parseAndRenderMessage = (text: string, onNavigate: (view: string, term: string) => void) => {
        const parts = [];
        let lastIndex = 0;
        const regex = /(\#\[[^\]]+\])|(\!\[[^\]]+\])|(\?\[[^\]]+\])/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            const fullMatch = match[0];
            const term = fullMatch.substring(2, fullMatch.length - 1);
            let viewName = '';

            if (fullMatch.startsWith('#[')) viewName = 'Resumos';
            else if (fullMatch.startsWith('![')) viewName = 'Flash Cards';
            else if (fullMatch.startsWith('?[')) viewName = 'Questões';
            
            parts.push(
                <span
                    key={match.index}
                    className="text-blue-500 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    onClick={() => onNavigate(viewName, term)}
                >
                    {fullMatch}
                </span>
            );
            
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts;
    };


    return (
         <div className="flex flex-col h-full bg-card-light dark:bg-card-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
            <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-2xl font-bold">Chat Geral</h3>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSortOrder('time')} className={`p-2 rounded-full ${sortOrder === 'time' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            <span className="text-2xl">🕐</span>
                        </button>
                        <button onClick={() => setSortOrder('temp')} className={`p-2 rounded-full ${sortOrder === 'temp' ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            <span className="text-2xl">🌡️</span>
                        </button>
                    </div>
                     <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} />
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-6">
                    {sortedMessages.map(msg => {
                        const isCurrentUser = msg.author === currentUser.pseudonym;
                        const userVote = appData.userMessageVotes.find(v => v.user_id === currentUser.id && v.message_id === msg.id);
                        return (
                            <div key={msg.id} className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                    <span className="font-bold">{msg.author}</span>
                                    <span>{formatTimestamp(msg.timestamp)}</span>
                                </div>
                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                    isCurrentUser ? 'bg-primary-light text-white rounded-br-none' : 
                                    msg.author === 'IA' ? 'bg-secondary-light/20 dark:bg-secondary-dark/30 rounded-bl-none' : 
                                    'bg-gray-200 dark:bg-gray-700 rounded-bl-none'
                                }`}>
                                    <p className={`whitespace-pre-wrap ${FONT_SIZE_CLASSES[fontSize]}`}>{parseAndRenderMessage(msg.text, onNavigate)}</p>
                                </div>
                                 <div className="flex items-center gap-4 relative mt-2">
                                    <button onClick={() => setActiveVote({ messageId: msg.id, type: 'hot' })} className="flex items-center gap-1 text-base">
                                        <span className="text-lg">🔥</span><span>{msg.hot_votes || 0}</span>
                                    </button>
                                    <button onClick={() => setActiveVote({ messageId: msg.id, type: 'cold' })} className="flex items-center gap-1 text-base">
                                        <span className="text-lg">❄️</span><span>{msg.cold_votes || 0}</span>
                                    </button>
                                    {activeVote?.messageId === msg.id && (
                                         <div ref={votePopupRef} className="absolute top-full mt-1 z-10 bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center p-1 gap-1 shadow-lg">
                                            <button onClick={() => handleVote(msg.id, activeVote.type, 1)} className="p-1 hover:bg-white/20 rounded-full"><PlusIcon className="w-4 h-4" /></button>
                                            <span className="text-sm font-bold w-4 text-center">
                                                {activeVote.type === 'hot' ? (userVote?.hot_votes || 0) : (userVote?.cold_votes || 0)}
                                            </span>
                                            <button onClick={() => handleVote(msg.id, activeVote.type, -1)} className="p-1 hover:bg-white/20 rounded-full"><MinusIcon className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {isLoading && (
                        <div className="flex items-start">
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm text-gray-500 dark:text-gray-400 mb-1">IA</span>
                                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-secondary-light/20 dark:bg-secondary-dark/30 rounded-bl-none">
                                    <div className="flex items-center space-x-1"><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></span></div>
                                </div>
                            </div>
                        </div>
                    )}
                     <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-border-light dark:border-border-dark">
                <div className="flex items-center">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Digite sua mensagem... (@IA ou @ed para chamar o assistente)" className="flex-1 px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-light"/>
                    <button onClick={handleSend} disabled={isLoading} className="bg-primary-light text-white p-3 rounded-r-md disabled:opacity-50"><PaperAirplaneIcon className="w-5 h-5"/></button>
                </div>
            </div>
        </div>
    );
};

interface CommunityViewProps extends Pick<MainContentProps, 'appData' | 'currentUser' | 'setAppData' | 'theme'> {
  onNavigate: (viewName: string, term: string) => void;
}

const LeaderboardRaceChart: React.FC<{ users: User[]; xp_events: XpEvent[]; theme: MainContentProps['theme'] }> = ({ users, xp_events, theme }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<number | 'auto'>('auto');

    const { sortedEvents, timeRange, userMap } = useMemo(() => {
        const validUsers = users.filter((u): u is User => !!u);
        const uMap = new Map(validUsers.map(u => {
            const hue = (u.id.charCodeAt(0) * u.id.length * 7) % 360;
            return [u.id, { ...u, color: `hsl(${hue}, 80%, 60%)` }];
        }));

        if (!xp_events || xp_events.length < 2) {
            return { sortedEvents: [], timeRange: null, userMap: uMap };
        }

        const sEvents = [...xp_events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const start = new Date(sEvents[0].created_at).getTime();
        const end = new Date(sEvents[sEvents.length - 1].created_at).getTime();

        if (start >= end) {
            return { sortedEvents: sEvents, timeRange: null, userMap: uMap };
        }

        return {
            sortedEvents: sEvents,
            timeRange: { start, end, duration: end - start },
            userMap: uMap
        };
    }, [users, xp_events]);

    const getInitialTime = useCallback(() => {
        if (!timeRange) return 0;
        const startDate = new Date(timeRange.start);
        startDate.setHours(8, 0, 0, 0);
        return startDate.getTime();
    }, [timeRange]);

    const [currentTime, setCurrentTime] = useState(getInitialTime);

    const targetRaceData = useMemo(() => {
        if (!timeRange) return [];
        const xpMap = new Map<string, number>();
        for (const event of sortedEvents) {
            if (new Date(event.created_at).getTime() > currentTime) break;
            xpMap.set(event.user_id, (xpMap.get(event.user_id) || 0) + event.amount);
        }
        return Array.from(userMap.values())
            .map(user => ({
              ...(user as User & { color: string }),
              xp: xpMap.get((user as User).id) || 0,
            }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 15);
    }, [currentTime, sortedEvents, userMap, timeRange]);

    const [displayedRaceData, setDisplayedRaceData] = useState<(User & { color: string; xp: number })[]>([]);
    const displayedDataRef = useRef(displayedRaceData);
    displayedDataRef.current = displayedRaceData;
    const targetRaceDataRef = useRef(targetRaceData);
    targetRaceDataRef.current = targetRaceData;

    useEffect(() => {
        if (!userMap.size) return;
        setDisplayedRaceData(Array.from(userMap.values()).map(user => ({ ...(user as User & { color: string }), xp: 0 })));
    }, [userMap]);

    useEffect(() => {
        const animationInterval = setInterval(() => {
            const currentData = displayedDataRef.current;
            const targetMap = new Map(targetRaceDataRef.current.map(u => [u.id, u.xp]));
            let hasChanged = false;
            const nextDataMap = new Map(currentData.map(u => [u.id, { ...u }]));

            targetMap.forEach((targetXp, userId) => {
                if (!nextDataMap.has(userId)) {
                    const userObject = userMap.get(userId);
                    if (userObject) {
                        nextDataMap.set(userId, { ...userObject, xp: 0 });
                        hasChanged = true;
                    }
                }
            });
            
            // FIX: Correctly type `user` to ensure `xp` is a number for arithmetic operations.
            nextDataMap.forEach((user: User & { color: string; xp: number }, userId) => {
                const targetXp = targetMap.get(userId) ?? 0;
                // FIX: `user.xp` is now correctly typed as number.
                const currentXp = Number(user.xp) || 0;
                const diff = targetXp - currentXp;
            
                if (Math.abs(diff) < 0.5) {
                    if (currentXp !== targetXp) {
                        user.xp = targetXp;
                        hasChanged = true;
                    }
                } else {
                    const increment = diff * 0.1;
                    user.xp = currentXp + increment;
                    hasChanged = true;
                }
            });

            if (hasChanged) {
                const sortedNextData = Array.from(nextDataMap.values())
                    // FIX: With correct types, direct subtraction is safe and no 'any' is needed.
                    .sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0))
                    .slice(0, 15);
                setDisplayedRaceData(sortedNextData);
            }
        }, 50);

        return () => clearInterval(animationInterval);
    }, [userMap]);

    useEffect(() => {
        if (!isPlaying || !timeRange) return;
        let timeoutId: number;
        const tick = () => {
            let baseInterval = typeof playbackSpeed === 'number' ? 400 / playbackSpeed : 400;
            
            setCurrentTime(prevTime => {
                if (prevTime >= timeRange.end) {
                    setIsPlaying(false);
                    return timeRange.end;
                }
                
                let newDate = new Date(prevTime);
                const twoHoursInMs = 2 * 60 * 60 * 1000;
                if (newDate.getHours() >= 20) {
                    newDate.setDate(newDate.getDate() + 1);
                    newDate.setHours(8, 0, 0, 0);
                } else {
                    newDate.setTime(newDate.getTime() + twoHoursInMs);
                }
                const newTime = Math.min(newDate.getTime(), timeRange.end);

                if (playbackSpeed === 'auto') {
                    const eventsInStep = sortedEvents.filter(e => {
                        const eventTime = new Date(e.created_at).getTime();
                        return eventTime > prevTime && eventTime <= newTime;
                    }).length;
                    baseInterval = eventsInStep > 0 ? 500 : 150;
                }

                timeoutId = window.setTimeout(tick, baseInterval);
                return newTime;
            });
        };
        timeoutId = window.setTimeout(tick, 100);
        return () => clearTimeout(timeoutId);
    }, [isPlaying, timeRange, playbackSpeed, sortedEvents]);

    const handlePlayPause = () => {
        if (timeRange && currentTime >= timeRange.end) {
            setCurrentTime(getInitialTime());
            setIsPlaying(true);
        } else {
            setIsPlaying(p => !p);
        }
    };

    const handleReset = () => {
        if (timeRange) {
            setCurrentTime(getInitialTime());
            setDisplayedRaceData(Array.from(userMap.values()).map(user => ({ ...(user as User & { color: string }), xp: 0 })));
            setIsPlaying(true);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsPlaying(false);
        setCurrentTime(e.target.valueAsNumber);
    };

    useEffect(() => {
        setCurrentTime(getInitialTime());
    }, [timeRange, getInitialTime]);

    if (!timeRange) {
        return <div className="text-center p-8 bg-card-light dark:bg-card-dark rounded-lg shadow-md border border-border-light dark:border-border-dark flex-1 flex items-center justify-center">Dados de XP insuficientes para a animação.</div>;
    }

    const maxXP = Math.max(20, ...displayedRaceData.map(d => d.xp));
    const ITEM_HEIGHT = 48;
    const labelColor = theme === 'dark' ? 'text-white' : 'text-black';

    return (
        <div className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-md border border-border-light dark:border-border-dark flex-1 flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
                 <div className="text-center font-bold text-lg tabular-nums">
                    {new Date(currentTime).toLocaleDateString('pt-BR')} {new Date(currentTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePlayPause} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={handleReset} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                     <select value={playbackSpeed} onChange={e => setPlaybackSpeed(e.target.value === 'auto' ? 'auto' : Number(e.target.value))} className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md text-sm p-1">
                        <option value="auto">Auto</option>
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={5}>5x</option>
                    </select>
                </div>
            </div>
             <input
                type="range"
                min={timeRange.start}
                max={timeRange.end}
                value={currentTime}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mb-4"
            />
             <div className="relative overflow-y-auto h-[33rem] lg:h-auto lg:flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {displayedRaceData.map((user, index) => (
                    <div
                        key={user.id}
                        className="absolute w-full h-12 flex items-center transition-all duration-300 ease-out"
                        style={{ transform: `translateY(${index * ITEM_HEIGHT}px)` }}
                    >
                        <div className="relative w-full h-full bg-background-light dark:bg-background-dark rounded-md shadow-sm">
                            {/* Bar */}
                            <div
                                className="absolute top-0 left-0 h-full rounded-md transition-all duration-500 ease-linear"
                                style={{ width: `${(user.xp / maxXP) * 100}%`, backgroundColor: user.color }}
                            />
                            {/* Content Layer */}
                            <div className="relative w-full h-full flex items-center justify-between px-2">
                                <div className="flex items-center">
                                    <span className="font-bold text-lg w-8 text-center text-white mix-blend-difference flex-shrink-0">{index + 1}</span>
                                    <span className={`font-semibold ${labelColor} ml-4 whitespace-nowrap`}>{user.pseudonym}</span>
                                </div>
                                <span className="font-bold text-primary-light dark:text-primary-dark tabular-nums flex-shrink-0 pr-2">{Math.floor(user.xp)} XP</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const CommunityView: React.FC<CommunityViewProps> = ({ appData, currentUser, setAppData, onNavigate, theme }) => {
    const [leaderboardFilter, setLeaderboardFilter] = useState<'geral' | 'diaria' | 'periodo' | 'hora'>('geral');
    const [isRaceChartActive, setIsRaceChartActive] = useState(false);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    useEffect(() => {
        const dataLoaded = appData.chatMessages.length > 0 && appData.xp_events.length > 0;
        if (!dataLoaded) {
            setIsLoadingContent(true);
            getCommunityData().then(result => {
                if ('error' in result) {
                    console.error("Failed to load community data:", result.error);
                } else {
                    setAppData(prev => ({ ...prev, ...result }));
                }
                setIsLoadingContent(false);
            });
        }
    }, [appData.chatMessages.length, appData.xp_events.length, setAppData]);


    const filteredLeaderboard = useMemo(() => {
        if (isRaceChartActive) return [];

        if (leaderboardFilter === 'geral') {
            return [...appData.users].sort((a: User, b: User) => (Number(b.xp) || 0) - (Number(a.xp) || 0));
        }

        const calculateXpFromEvents = (events: typeof appData.xp_events) => {
            const userXpMap = new Map<string, number>();
            events.forEach(event => {
                const currentXp = userXpMap.get(event.user_id) || 0;
                userXpMap.set(event.user_id, currentXp + event.amount);
            });
            return appData.users.filter((user): user is User => !!user).map((user: User) => ({
                ...user,
                xp: userXpMap.get(user.id) || 0,
            }));
        };

        const now = new Date();
        let startTime: Date;

        switch (leaderboardFilter) {
            case 'diaria': startTime = new Date(now); startTime.setHours(0, 0, 0, 0); break;
            case 'periodo': startTime = new Date(now); startTime.setHours(now.getHours() < 12 ? 0 : 12, 0, 0, 0); break;
            case 'hora': startTime = new Date(now.getTime() - 60 * 60 * 1000); break;
            default: startTime = new Date(0); break;
        }
        
        const xpEventsInPeriod = appData.xp_events.filter(event => new Date(event.created_at) >= startTime);
        const userXpInPeriod = calculateXpFromEvents(xpEventsInPeriod);

        return userXpInPeriod.filter(user => user.xp > 0).sort((a: User, b: User) => (Number(b.xp) || 0) - (Number(a.xp) || 0));

    }, [appData.users, appData.xp_events, leaderboardFilter, isRaceChartActive]);
    
    const filterOptions = [
        { key: 'geral', emoji: '🌍', title: 'Geral' },
        { key: 'diaria', emoji: '📅', title: 'Diária' },
        { key: 'periodo', emoji: '🌓', title: 'Período' },
        { key: 'hora', emoji: '⏱️', title: 'Hora' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-11rem)]">
            <div className="lg:col-span-1 flex flex-col h-full">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold flex-shrink-0">Leaderboard</h3>
                    <div className="flex items-end gap-1" style={{ minHeight: '4rem' }}>
                        <div className="flex flex-col items-center justify-start text-center w-12">
                            <button title="Corrida de XP" onClick={() => setIsRaceChartActive(a => !a)} className={`p-2 rounded-full transition-colors ${isRaceChartActive ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                                <PlayIcon className="w-5 h-5"/>
                            </button>
                             <div className="h-5 mt-1">
                                {isRaceChartActive && <span className="text-xs font-semibold text-primary-light dark:text-primary-dark">Corrida</span>}
                            </div>
                        </div>
                        {filterOptions.map(opt => (
                             <div key={opt.key} className="flex flex-col items-center justify-start text-center w-12">
                                <button title={opt.title} onClick={() => { setLeaderboardFilter(opt.key as any); setIsRaceChartActive(false); }} className={`p-2 rounded-full text-xl transition-colors ${leaderboardFilter === opt.key && !isRaceChartActive ? 'bg-primary-light/20' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                                    {opt.emoji}
                                </button>
                                <div className="h-5 mt-1">
                                    {leaderboardFilter === opt.key && !isRaceChartActive && (
                                        <span className="text-xs font-semibold text-primary-light dark:text-primary-dark">
                                            {opt.title}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {isRaceChartActive ? (
                    isLoadingContent ? <div className="text-center p-8">Carregando dados da comunidade...</div> : <LeaderboardRaceChart users={appData.users} xp_events={appData.xp_events} theme={theme!} />
                ) : (
                    <div className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-md border border-border-light dark:border-border-dark flex-1 overflow-y-auto h-[33rem] lg:h-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {isLoadingContent ? <div className="text-center p-8">Carregando...</div> :
                        <ul className="space-y-3">
                            {filteredLeaderboard.length > 0 ? filteredLeaderboard.map((user, index) => (
                                <li key={user.id} className={`flex items-center justify-between p-2 rounded-md ${user.id === currentUser.id ? 'bg-primary-light/20' : 'bg-background-light dark:bg-background-dark'}`}>
                                    <div className="flex items-center min-w-0">
                                        <span className="font-bold text-lg w-14 text-right pr-4 flex-shrink-0">{index + 1}.</span>
                                        <span className="font-semibold truncate">{user.pseudonym}</span>
                                    </div>
                                    <span className="font-bold text-primary-light dark:text-primary-dark ml-2 flex-shrink-0">{user.xp} XP</span>
                                </li>
                            )) : (
                                <div className="text-center text-gray-500 py-8">
                                    Nenhum dado para este período.
                                </div>
                            )}
                        </ul>
                        }
                    </div>
                )}
            </div>
            <div className="lg:col-span-1 h-full">
                 {isLoadingContent ? <div className="text-center p-8">Carregando chat...</div> : <Chat currentUser={currentUser} appData={appData} setAppData={setAppData} onNavigate={onNavigate} /> }
            </div>
        </div>
    );
};
