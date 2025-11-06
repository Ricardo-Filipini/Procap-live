

import React from 'react';

export type Theme = 'light' | 'dark';

export type ContentType = 'summary' | 'flashcard' | 'question' | 'mind_map' | 'question_notebook' | 'audio_summary' | 'case_study' | 'cronograma' | 'link_file';

export type LiveAgentStatus = 'inactive' | 'connecting' | 'connected' | 'error' | 'reconnecting' | 'disconnected';


export interface View {
  name: string;
  // Fix: Use React.ReactElement as JSX is not in scope in .ts files.
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  adminOnly?: boolean;
}

export interface User {
  id: string;
  pseudonym: string;
  password: string;
  level: number;
  xp: number;
  achievements: string[];
  stats: {
    questionsAnswered: number;
    correctAnswers: number;
    topicPerformance: { [topic: string]: { correct: number; total: number } };
    streak?: number;
  };
}

export interface Comment {
    id: string;
    authorId: string;
    authorPseudonym: string;
    text: string;
    timestamp: string;
    hot_votes: number;
    cold_votes: number;
}

// Represents a file source processed by the AI
export interface Source {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  original_filename: string[];
  storage_path: string[];
  drive_links?: string[];
  materia: string;
  topic: string;
  subtopic?: string;
  created_at: string;
  hot_votes: number;
  cold_votes: number;
  comments: Comment[];
  // Nested content for easier data access
  summaries: Omit<Summary, 'source'>[];
  flashcards: Omit<Flashcard, 'source'>[];
  questions: Omit<Question, 'source'>[];
  mind_maps: Omit<MindMap, 'source'>[];
  audio_summaries: Omit<AudioSummary, 'source'>[];
}


export interface Summary {
  id: string;
  source_id: string;
  source?: Source; // Optional full source object for context
  title: string;
  content: string;
  keyPoints: { term: string; description: string; }[];
  relatedTopics: string[];
  comments: Comment[];
  hot_votes: number;
  cold_votes: number;
}

export interface Flashcard {
  id:string;
  source_id: string;
  source?: Source;
  front: string;
  back: string;
  comments: Comment[];
  hot_votes: number;
  cold_votes: number;
}

export interface Question {
  id: string;
  source_id: string;
  source?: Source;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hints: string[];
  comments: Comment[];
  hot_votes: number;
  cold_votes: number;
}

export interface MindMap {
    id: string;
    source_id: string;
    source?: Source;
    title: string;
    imageUrl: string;
    comments: Comment[];
    hot_votes: number;
    cold_votes: number;
}

export interface AudioSummary {
    id: string;
    source_id: string;
    source?: Source;
    title: string;
    audioUrl: string;
    hot_votes: number;
    cold_votes: number;
    comments: Comment[];
}

export interface LinkFile {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    url?: string;
    file_path?: string;
    file_name?: string;
    created_at: string;
    hot_votes: number;
    cold_votes: number;
    comments: Comment[];
}

export interface ChatMessage {
  id: string;
  author: 'user' | 'IA' | string;
  text: string;
  timestamp: string;
  hot_votes: number;
  cold_votes: number;
}

export interface QuestionNotebook {
    id: string;
    user_id: string;
    name: string;
    question_ids: string[];
    created_at: string;
    hot_votes: number;
    cold_votes: number;
    comments: Comment[];
}

export interface UserNotebookInteraction {
    id: string;
    user_id: string;
    notebook_id: string;
    is_read: boolean;
    is_favorite: boolean;
    hot_votes: number;
    cold_votes: number;
}

export interface UserQuestionAnswer {
    id: string;
    user_id: string;
    notebook_id: string;
    question_id: string;
    attempts: string[];
    is_correct_first_try: boolean;
    xp_awarded: number;
    timestamp: string;
}


// Fix: Add optional created_at and updated_at to align with database schema.
export interface UserMessageVote {
    id: string;
    user_id: string;
    message_id: string;
    hot_votes: number;
    cold_votes: number;
    created_at?: string;
    updated_at?: string;
}

// Fix: Add optional created_at and updated_at to align with database schema.
export interface UserSourceVote {
    id: string;
    user_id: string;
    source_id: string;
    hot_votes: number;
    cold_votes: number;
    created_at?: string;
    updated_at?: string;
}

export interface UserContentInteraction {
    id: string;
    user_id: string;
    content_id: string;
    content_type: ContentType;
    is_read: boolean;
    is_favorite: boolean;
    hot_votes: number;
    cold_votes: number;
}

export interface DecisionOption {
    id: string;
    text: string;
    predicted_outcome: string;
}

export interface DecisionPoint {
    id: string;
    context: string;
    options: DecisionOption[];
    actual_bcb_action: string;
    bcb_action_outcome: string;
}

export interface CaseStudy {
    id: string;
    user_id: string;
    title: string;
    summary: string;
    full_case_text: string;
    source_file_path?: string;
    correlated_materias: string[];
    key_points: string[];
    decision_points: DecisionPoint[];
    created_at: string;
    hot_votes: number;
    cold_votes: number;
    comments: Comment[];
}

export interface UserCaseStudyInteraction {
    id: string;
    user_id: string;
    case_study_id: string;
    current_decision_point_index: number;
    choices: {
        decision_point_id: string;
        chosen_option_id: string;
    }[];
    xp_earned: number;
    completed_at: string | null;
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  professor?: string;
  type: 'aula' | 'prova' | 'seminario' | 'orientacao';
  details?: string;
  color: string;
  hot_votes: number;
  cold_votes: number;
  comments: Comment[];
}

export interface StudyPlan {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface XpEvent {
    id: string;
    user_id: string;
    amount: number;
    source: string;
    content_id?: string;
    created_at: string;
}

export interface AppData {
  users: User[];
  sources: Source[];
  linksFiles: LinkFile[];
  chatMessages: ChatMessage[];
  questionNotebooks: QuestionNotebook[];
  caseStudies: CaseStudy[];
  scheduleEvents: ScheduleEvent[];
  studyPlans: StudyPlan[];
  userMessageVotes: UserMessageVote[];
  userSourceVotes: UserSourceVote[];
  userContentInteractions: UserContentInteraction[];
  userNotebookInteractions: UserNotebookInteraction[];
  userQuestionAnswers: UserQuestionAnswer[];
  userCaseStudyInteractions: UserCaseStudyInteraction[];
  xp_events: XpEvent[];
}

export interface StarRating {
    contentId: string;
    rating: number; // 1-5
}

export interface ProcessingTask {
  id: string;
  name: string;
  message: string;
  status: 'processing' | 'success' | 'error';
}

export interface AgentSettings {
  apiKey: string;
  voice: 'Fenrir' | 'Kore'; // Male | Female
  speed: number; // e.g. 0.75, 1.0, 1.25
  systemPrompt: string;
}

export interface MainContentProps {
  activeView: View;
  setActiveView: (view: View) => void;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  currentUser: User;
  updateUser: (user: User) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  processingTasks: ProcessingTask[];
  setProcessingTasks: React.Dispatch<React.SetStateAction<ProcessingTask[]>>;
  onToggleLiveAgent?: () => void;
  onToggleAgentSettings?: () => void;
  isLiveAgentActive?: boolean;
  liveAgentStatus?: LiveAgentStatus;
  agentSettings?: AgentSettings;
  // FIX: Made the 'term' property optional to match its usage in the application, resolving a type mismatch.
  navTarget?: {viewName: string, term?: string, id?: string, subId?: string} | null;
  setNavTarget?: (target: {viewName: string, term?: string, id?: string, subId?: string} | null) => void;
  screenContext?: string | null;
  setScreenContext?: (context: string | null) => void;
}