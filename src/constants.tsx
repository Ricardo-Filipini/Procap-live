
import React from 'react';
import { AppData, View, ScheduleEvent, AgentSettings } from './types';
import { BookOpenIcon, SparklesIcon, QuestionMarkCircleIcon, ShareIcon, UserCircleIcon, ShieldCheckIcon, CloudArrowUpIcon, UsersIcon, SpeakerWaveIcon, DocumentTextIcon, CalendarDaysIcon, PaperClipIcon } from './components/Icons';

export const VIEWS: View[] = [
    { name: 'Questões', icon: QuestionMarkCircleIcon },
    { name: 'Links/Arquivos', icon: PaperClipIcon },
    { name: 'Mídia', icon: SpeakerWaveIcon },
    { name: 'Flashcards', icon: SparklesIcon },
    { name: 'Resumos', icon: BookOpenIcon },
    { name: 'Perfil', icon: UserCircleIcon },
    { name: 'Mapas Mentais', icon: ShareIcon },
    { name: 'Comunidade', icon: UsersIcon},
    { name: 'Estudo de Caso', icon: DocumentTextIcon },
    { name: 'Fontes', icon: CloudArrowUpIcon },
    { name: 'Cronograma', icon: CalendarDaysIcon },
    { name: 'Admin', icon: ShieldCheckIcon, adminOnly: true },
];

export const PROCAP_SCHEDULE_DATA: ScheduleEvent[] = [
  // Semana 1: 03/11 a 09/11
  { id: 'semana1-1a', date: '2025-11-03', startTime: '08:00', endTime: '11:00', title: 'Orientações e Integração', details: 'On-line com a comissão', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-1b', date: '2025-11-03', startTime: '11:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-1c', date: '2025-11-03', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-2a', date: '2025-11-04', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-2b', date: '2025-11-04', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-3a', date: '2025-11-05', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-3b', date: '2025-11-05', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-4a', date: '2025-11-06', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-4b', date: '2025-11-06', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-5a', date: '2025-11-07', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-5b', date: '2025-11-07', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-6a', date: '2025-11-08', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', details: '*Aula Assíncrona', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana1-6b', date: '2025-11-08', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', details: '*Aula Assíncrona', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },

  // Semana 2: 10/11 a 16/11
  { id: 'semana2-1a', date: '2025-11-10', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-1b', date: '2025-11-10', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-2a', date: '2025-11-11', startTime: '08:00', endTime: '12:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-2b', date: '2025-11-11', startTime: '14:00', endTime: '18:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-3a', date: '2025-11-12', startTime: '08:00', endTime: '12:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-3b', date: '2025-11-12', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', details: '*Aula Assíncrona', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-4a', date: '2025-11-13', startTime: '08:00', endTime: '12:00', title: 'Segurança Cibernética', professor: 'Prof: Carlos Eduardo Gomes Marins, Prof: Marcos José Candido Euzebio', type: 'aula', color: 'bg-lime-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-4b', date: '2025-11-13', startTime: '14:00', endTime: '18:00', title: 'Segurança Cibernética', professor: 'Prof: Carlos Eduardo Gomes Marins, Prof: Marcos José Candido Euzebio', type: 'aula', color: 'bg-lime-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-5a', date: '2025-11-14', startTime: '08:00', endTime: '12:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-5b', date: '2025-11-14', startTime: '14:00', endTime: '18:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-6a', date: '2025-11-15', startTime: '08:00', endTime: '12:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', details: '*Aula Assíncrona', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana2-6b', date: '2025-11-15', startTime: '14:00', endTime: '18:00', title: 'Sistema Financeiro Nacional, Banco Central do Brasil e Bancos Centrais', professor: 'Prof: Fernando Viana', details: '*Aula Assíncrona', type: 'aula', color: 'bg-rose-400', hot_votes: 0, cold_votes: 0, comments: [] },

  // Semana 3: 17/11 a 23/11
  { id: 'semana3-1a', date: '2025-11-17', startTime: '08:00', endTime: '12:00', title: 'Educação Financeira', professor: 'Prof: Fábio de Almeida Lopes Araujo', type: 'aula', color: 'bg-pink-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-1b', date: '2025-11-17', startTime: '14:00', endTime: '18:00', title: 'Segurança da Informação no Banco Central', professor: 'Prof: Fabio dos Santos Fonseca', type: 'aula', color: 'bg-green-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-2a', date: '2025-11-18', startTime: '08:00', endTime: '12:00', title: 'Segurança da Informação no Banco Central', professor: 'Prof: Fabio dos Santos Fonseca', type: 'aula', color: 'bg-green-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-2b', date: '2025-11-18', startTime: '14:00', endTime: '18:00', title: 'Gestão, Organização e Pessoas no Banco Central do Brasil', professor: 'Prof: Juliana Signorelli', type: 'aula', color: 'bg-cyan-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-3a', date: '2025-11-19', startTime: '08:00', endTime: '12:00', title: 'Gestão, Organização e Pessoas no Banco Central do Brasil', professor: 'Prof: Juliana Signorelli', type: 'aula', color: 'bg-cyan-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-3b', date: '2025-11-19', startTime: '14:00', endTime: '18:00', title: 'VAGO', details: 'Deslocamento dos candidatos/alunos', type: 'seminario', color: 'bg-fuchsia-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-4', date: '2025-11-20', startTime: '08:00', endTime: '18:00', title: 'VAGO', details: 'Deslocamento dos candidatos/alunos', type: 'seminario', color: 'bg-fuchsia-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-5', date: '2025-11-21', startTime: '08:00', endTime: '18:00', title: 'VAGO', details: 'Deslocamento dos candidatos/alunos', type: 'seminario', color: 'bg-fuchsia-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-6', date: '2025-11-22', startTime: '08:00', endTime: '18:00', title: 'VAGO', details: 'Deslocamento dos candidatos/alunos', type: 'seminario', color: 'bg-fuchsia-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana3-7', date: '2025-11-23', startTime: '08:00', endTime: '12:00', title: 'PROVA OBJETIVA DO PROCAP', type: 'prova', color: 'bg-green-600', hot_votes: 0, cold_votes: 0, comments: [] },

  // Semana 4: 24/11 a 28/11
  { id: 'semana4-1', date: '2025-11-24', startTime: '08:00', endTime: '18:00', title: 'Presencial (Confirmar local)', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana4-2', date: '2025-11-25', startTime: '08:00', endTime: '18:00', title: 'Presencial (Confirmar local)', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana4-3', date: '2025-11-26', startTime: '08:00', endTime: '18:00', title: 'Orientações e Integração Sede do Banco Central', details: 'PRESENCIAL', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana4-4', date: '2025-11-27', startTime: '08:00', endTime: '18:00', title: 'Presencial (Confirmar local)', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
  { id: 'semana4-5', date: '2025-11-28', startTime: '08:00', endTime: '12:00', title: 'Presencial (Confirmar local)', type: 'orientacao', color: 'bg-yellow-400', hot_votes: 0, cold_votes: 0, comments: [] },
];


export const INITIAL_APP_DATA: AppData = {
  users: [],
  sources: [],
  linksFiles: [],
  chatMessages: [],
  questionNotebooks: [],
  caseStudies: [],
  scheduleEvents: [],
  studyPlans: [],
  userMessageVotes: [],
  userSourceVotes: [],
  userContentInteractions: [],
  userNotebookInteractions: [],
  userQuestionAnswers: [],
  userCaseStudyInteractions: [],
  xp_events: [],
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
    apiKey: '',
    voice: 'Fenrir', // Male
    speed: 1, // Normal
    systemPrompt: ''
};


export const ACHIEVEMENTS = {
  FLASHCARDS_FLIPPED: [
    { count: 10, title: "Aprendiz de Flashcards" },
    { count: 25, title: "Praticante de Flashcards" },
    { count: 50, title: "Adepto de Flashcards" },
    { count: 100, title: "Mestre de Flashcards" },
    { count: 150, title: "Sábio de Flashcards" },
    { count: 200, title: "Lenda dos Flashcards" },
  ],
  QUESTIONS_CORRECT: [
    { count: 10, title: "Primeiros Passos" },
    { count: 25, title: "Estudante Dedicado" },
    { count: 50, title: "Conhecedor" },
    { count: 100, title: "Especialista" },
    { count: 200, title: "Mestre das Questões" },
    { count: 300, title: "Doutrinador" },
    { count: 400, title: "Sábio das Questões" },
    { count: 500, title: "Oráculo" },
  ],
  STREAK: [
    { count: 5, title: "Embalado!" },
    { count: 10, title: "Imparável!" },
    { count: 15, title: "Invencível!" },
    { count: 20, title: "Dominante!" },
    { count: 25, title: "Lendário!" },
    { count: 50, title: "Divino!" },
  ],
  SUMMARIES_READ: [
    { count: 3, title: "Leitor Iniciante" },
    { count: 5, title: "Leitor Atento" },
    { count: 7, title: "Leitor Voraz" },
    { count: 10, title: "Devorador de Livros" },
    { count: 20, title: "Bibliotecário" },
    { count: 30, title: "Arquivista" },
    { count: 50, title: "Historiador" },
  ],
  MIND_MAPS_READ: [
    { count: 3, title: "Visualizador Curioso" },
    { count: 5, title: "Explorador Visual" },
    { count: 7, title: "Cartógrafo do Saber" },
    { count: 10, title: "Mapeador de Ideias" },
    { count: 20, title: "Estrategista Visual" },
    { count: 30, title: "Mestre dos Mapas" },
    { count: 50, title: "Iluminado" },
  ],
  CONTENT_CREATED: [
      { count: 1, title: "A Fonte" },
      { count: 3, title: "Criador de Conteúdo" },
      { count: 5, title: "Máquina de Conteúdo" },
      { count: 10, title: "Produtor Prolífico" },
  ],
  VOTES_GIVEN: [
      { count: 10, title: "Crítico Criterioso" },
      { count: 25, title: "Curador da Comunidade" },
      { count: 50, title: "O Juiz" },
      { count: 100, title: "Sommelier de Conteúdo" },
  ],
  IA_INTERACTIONS: [
      { count: 5, title: "Amigo do Ed" },
      { count: 15, title: "Papeando com a IA" },
      { count: 30, title: "Sussurrador de IA" },
      { count: 50, title: "Mestre de Prompts" },
  ]
};
