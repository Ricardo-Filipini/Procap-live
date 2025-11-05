import { AppData, User } from '../types';
import { ACHIEVEMENTS } from '../constants';

export const checkAndAwardAchievements = (user: User, appData: AppData): User => {
    const newAchievements = new Set(user.achievements);
    const interactions = appData.userContentInteractions.filter(i => i.user_id === user.id);
    
    const checkCategory = (category: { count: number; title: string; }[], count: number) => {
        category.forEach(ach => {
            if (count >= ach.count && !newAchievements.has(ach.title)) {
                newAchievements.add(ach.title);
            }
        });
    };

    checkCategory(ACHIEVEMENTS.FLASHCARDS_FLIPPED, interactions.filter(i => i.content_type === 'flashcard' && i.is_read).length);
    checkCategory(ACHIEVEMENTS.QUESTIONS_CORRECT, user.stats.correctAnswers);
    checkCategory(ACHIEVEMENTS.STREAK, user.stats.streak || 0);
    checkCategory(ACHIEVEMENTS.SUMMARIES_READ, interactions.filter(i => i.content_type === 'summary' && i.is_read).length);
    checkCategory(ACHIEVEMENTS.MIND_MAPS_READ, interactions.filter(i => i.content_type === 'mind_map' && i.is_read).length);
    
    if (newAchievements.size > user.achievements.length) {
        return { ...user, achievements: Array.from(newAchievements).sort() };
    }
    return user;
};
