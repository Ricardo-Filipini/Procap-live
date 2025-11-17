
import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleEvent, Comment, ContentType, MainContentProps } from '../../types';
import { CommentsModal } from '../shared/CommentsModal';
import { ContentActions } from '../shared/ContentActions';
import { handleInteractionUpdate, handleVoteUpdate } from '../../lib/content';
import { updateContentComments, getScheduleEvents } from '../../services/supabaseClient';
import { FontSizeControl, FONT_SIZE_CLASSES_LARGE } from '../shared/FontSizeControl';

interface CronogramaViewProps extends MainContentProps {}

const CalendarHeader: React.FC<{
    currentDate: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
}> = ({ currentDate, onPrevMonth, onNextMonth }) => (
    <div className="flex justify-between items-center mb-4">
        <button onClick={onPrevMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            &lt;
        </button>
        <h2 className="text-xl font-bold">
            {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        </h2>
        <button onClick={onNextMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            &gt;
        </button>
    </div>
);

export const CronogramaView: React.FC<CronogramaViewProps> = (props) => {
    const { appData, setAppData, currentUser, updateUser } = props;
    const { scheduleEvents } = appData;
    const procapStartDate = new Date(2025, 10, 3); // November 3, 2025
    const [currentDate, setCurrentDate] = useState(procapStartDate);
    const [selectedDate, setSelectedDate] = useState<Date>(procapStartDate);
    const [commentingOn, setCommentingOn] = useState<ScheduleEvent | null>(null);
    const [fontSize, setFontSize] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const contentType: ContentType = 'cronograma';

    useEffect(() => {
        if (appData.scheduleEvents.length === 0) {
            setIsLoading(true);
            getScheduleEvents().then(events => {
                setAppData(prev => ({ ...prev, scheduleEvents: events }));
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [appData.scheduleEvents.length, setAppData]);

    const scheduleByDate = useMemo(() => {
        return scheduleEvents.reduce((acc, event) => {
            (acc[event.date] = acc[event.date] || []).push(event);
            return acc;
        }, {} as Record<string, ScheduleEvent[]>);
    }, [scheduleEvents]);

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    
    const handleCommentAction = async (action: 'add' | 'vote', payload: any) => {
        if (!commentingOn) return;
        let updatedComments = [...(commentingOn.comments || [])];
        if (action === 'add') {
            updatedComments.push({ id: `c_evt_${Date.now()}`, authorId: currentUser.id, authorPseudonym: currentUser.pseudonym, text: payload.text, timestamp: new Date().toISOString(), hot_votes: 0, cold_votes: 0 });
        } else if (action === 'vote') {
             const commentIndex = updatedComments.findIndex(c => c.id === payload.commentId);
            if (commentIndex > -1) {
                updatedComments[commentIndex][`${payload.voteType}_votes`] += 1;
            }
        }
        
        const success = await updateContentComments('schedule_events', commentingOn.id, updatedComments);
        if (success) {
            const updatedItem = { ...commentingOn, comments: updatedComments };
            setAppData(prev => ({ ...prev, scheduleEvents: prev.scheduleEvents.map(evt => evt.id === updatedItem.id ? updatedItem : evt) }));
            setCommentingOn(updatedItem);
        }
    };
    
    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const blanks = Array(firstDayOfMonth).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        return (
            <div className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <CalendarHeader currentDate={currentDate} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} />
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {weekdays.map(day => <div key={day} className="font-semibold text-gray-500">{day}</div>)}
                    {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                    {days.map(day => {
                        const date = new Date(year, month, day);
                        const dateString = date.toISOString().split('T')[0];
                        const hasEvent = !!scheduleByDate[dateString];
                        const isSelected = selectedDate.toDateString() === date.toDateString();
                        const isToday = new Date().toDateString() === date.toDateString();

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDate(date)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative ${FONT_SIZE_CLASSES_LARGE[fontSize]}
                                    ${isSelected ? 'bg-primary-light text-white font-bold' : ''}
                                    ${!isSelected && isToday ? 'bg-secondary-light/20 text-secondary-dark font-bold' : ''}
                                    ${!isSelected && !isToday ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                                `}
                            >
                                {day}
                                {hasEvent && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary-light'}`}></span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const selectedDayEvents = useMemo(() => {
        const dateString = selectedDate.toISOString().split('T')[0];
        return (scheduleByDate[dateString] || []).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }, [selectedDate, scheduleByDate]);

    if (isLoading) {
        return <div className="text-center p-8">Carregando cronograma...</div>;
    }

    return (
        <div className={FONT_SIZE_CLASSES_LARGE[fontSize]}>
            <CommentsModal isOpen={!!commentingOn} onClose={() => setCommentingOn(null)} comments={commentingOn?.comments || []} onAddComment={(text) => handleCommentAction('add', {text})} onVoteComment={(commentId, voteType) => handleCommentAction('vote', {commentId, voteType})} contentTitle={commentingOn?.title || ''}/>
            <div className="mb-4">
                <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} maxSize={4} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    {renderCalendar()}
                </div>
                <div className="md:col-span-2">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold">
                            Agenda para {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {selectedDayEvents.length > 0 ? (
                            selectedDayEvents.map(event => (
                                <div key={event.id} className="bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border-l-4" style={{borderColor: event.color.startsWith('bg-') ? '' : event.color}}>
                                    <div className="flex items-start gap-4">
                                        <div className={`w-2 h-full rounded-full ${event.color}`}></div>
                                        <div className="flex-1">
                                            <p className="font-bold">{event.title}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{event.startTime} - {event.endTime}</p>
                                            {event.professor && <p className="text-sm text-gray-500">{event.professor}</p>}
                                            {event.details && <p className="text-xs italic text-gray-400 mt-1">{event.details}</p>}
                                        </div>
                                    </div>
                                    <ContentActions
                                        item={event}
                                        contentType={contentType}
                                        currentUser={currentUser}
                                        interactions={appData.userContentInteractions}
                                        onVote={(id, type, inc) => handleVoteUpdate(setAppData, currentUser, updateUser, appData, contentType, id, type, inc)}
                                        onToggleRead={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_read: !state })}
                                        onToggleFavorite={(id, state) => handleInteractionUpdate(setAppData, appData, currentUser, updateUser, contentType, id, { is_favorite: !state })}
                                        onComment={() => setCommentingOn(event)}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg text-center text-gray-500">
                                Nenhum evento agendado para este dia.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
