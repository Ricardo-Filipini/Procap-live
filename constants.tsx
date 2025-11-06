

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
    { count: 50, title: "Praticante de Flashcards" },
    { count: 100, title: "Adepto de Flashcards" },
    { count: 250, title: "Mestre de Flashcards" },
    { count: 500, title: "Lenda dos Flashcards" },
  ],
  QUESTIONS_CORRECT: [
    { count: 10, title: "Primeiros Passos" },
    { count: 50, title: "Estudante Dedicado" },
    { count: 100, title: "Conhecedor" },
    { count: 250, title: "Especialista" },
    { count: 500, title: "Mestre das Questões" },
    { count: 750, title: "Doutrinador" },
    { count: 1000, title: "Oráculo" },
  ],
  STREAK: [
    { count: 3, title: "Embalado!" },
    { count: 7, title: "Imparável!" },
    { count: 15, title: "Invencível!" },
    { count: 30, title: "Dominante!" },
    { count: 50, title: "Lendário!" },
    { count: 100, title: "Divino!" },
  ],
  SUMMARIES_READ: [
    { count: 5, title: "Leitor Atento" },
    { count: 10, title: "Leitor Voraz" },
    { count: 25, title: "Devorador de Livros" },
    { count: 50, title: "Bibliotecário" },
  ],
  MIND_MAPS_READ: [
    { count: 5, title: "Explorador Visual" },
    { count: 10, title: "Cartógrafo do Saber" },
    { count: 25, title: "Mapeador de Ideias" },
    { count: 50, title: "Iluminado" },
  ],
  CONTENT_CREATED: [
      { count: 1, title: "A Fonte" },
      { count: 3, title: "Criador de Conteúdo" },
      { count: 7, title: "Máquina de Conteúdo" },
      { count: 15, title: "Produtor Prolífico" },
  ],
  VOTES_GIVEN: [
      { count: 10, title: "Crítico Criterioso" },
      { count: 50, title: "Curador da Comunidade" },
      { count: 100, title: "O Juiz" },
      { count: 250, title: "Sommelier de Conteúdo" },
  ],
  IA_INTERACTIONS: [
      { count: 10, title: "Papeando com Ed" },
      { count: 25, title: "Sussurrador de IA" },
      { count: 50, title: "Mestre de Prompts" },
      { count: 100, title: "Cyber-Psicólogo" },
  ],
  CASE_STUDIES_COMPLETED: [
      { count: 1, title: "Detetive Financeiro" },
      { count: 3, title: "Analista de Crise" },
      { count: 5, title: "Estrategista do BCB" },
  ],
  XP_EARNED: [
      { count: 1000, title: "Acumulador de Conhecimento" },
      { count: 5000, title: "Magnata do XP" },
      { count: 10000, title: "Sem Vida Social" },
      { count: 20000, title: "Lenda do Procap" },
  ]
};

export const FALLBACK_API_KEYS = [
    'AIzaSyCvsigzPyzoBuM7WOFeRqe9hZX-0yQ-WjU',
    'AIzaSyC0994KXf-7tPBBHT-Ty22mxxOKOSCBIlY',
    'AIzaSyB5YZwv9GcabHXBtgI6wE8jGHt3kQ9ty2A',
    'AIzaSyBBijuz1gLGpckEjuzhDnDBM61U09zvfyY',
];

/**
 * Retrieves the final API key based on a priority order:
 * 1. User-provided key (from settings).
 * 2. VITE_API_KEY environment variable.
 * 3. API_KEY environment variable.
 * 4. A random key from the fallback list.
 * Returns undefined if no key is found.
 */
export const getFinalApiKey = (userApiKey?: string): string | undefined => {
    const userKey = userApiKey?.trim();
    if (userKey) {
        return userKey;
    }

    const viteEnvKey = (import.meta as any).env?.VITE_API_KEY;
    if (viteEnvKey) {
        return viteEnvKey;
    }

    const envKey = process.env.API_KEY;
    if (envKey) {
        return envKey;
    }
    
    if (FALLBACK_API_KEYS && FALLBACK_API_KEYS.length > 0) {
        return FALLBACK_API_KEYS[Math.floor(Math.random() * FALLBACK_API_KEYS.length)];
    }

    return undefined;
};
