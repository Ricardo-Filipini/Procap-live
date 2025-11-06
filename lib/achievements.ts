


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

    // New Achievement Checks
    const contentCreatedCount = appData.sources.filter(s => s.user_id === user.id).length;
    checkCategory(ACHIEVEMENTS.CONTENT_CREATED, contentCreatedCount);
    
    const votesGiven = appData.userContentInteractions
        .filter(i => i.user_id === user.id)
        // FIX: Defensively parse vote counts to ensure they are numbers before adding them.
        .reduce((sum, i) => sum + (parseInt(i.hot_votes as any) || 0) + (parseInt(i.cold_votes as any) || 0), 0)
        +
        appData.userNotebookInteractions
        .filter(i => i.user_id === user.id)
        // FIX: Defensively parse vote counts to ensure they are numbers before adding them.
        .reduce((sum, i) => sum + (parseInt(i.hot_votes as any) || 0) + (parseInt(i.cold_votes as any) || 0), 0);
    checkCategory(ACHIEVEMENTS.VOTES_GIVEN, votesGiven);

    const iaInteractions = appData.chatMessages.filter(m => m.author === user.pseudonym && (m.text.toLowerCase().includes('@ia') || m.text.toLowerCase().includes('@ed'))).length;
    checkCategory(ACHIEVEMENTS.IA_INTERACTIONS, iaInteractions);

    const caseStudiesCompleted = appData.userCaseStudyInteractions.filter(i => i.user_id === user.id && i.completed_at !== null).length;
    checkCategory(ACHIEVEMENTS.CASE_STUDIES_COMPLETED, caseStudiesCompleted);
    checkCategory(ACHIEVEMENTS.XP_EARNED, user.xp);
    
    if (newAchievements.size > user.achievements.length) {
        return { ...user, achievements: Array.from(newAchievements).sort() };
    }
    return user;
};