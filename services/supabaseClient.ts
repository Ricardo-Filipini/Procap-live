

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppData, User, Source, ChatMessage, UserMessageVote, UserSourceVote, Summary, Flashcard, Question, Comment, MindMap, ContentType, UserContentInteraction, QuestionNotebook, UserNotebookInteraction, UserQuestionAnswer, AudioSummary, CaseStudy, UserCaseStudyInteraction, ScheduleEvent, StudyPlan, LinkFile, XpEvent, UserMood } from '../types';
import { INITIAL_APP_DATA } from '../constants';


/*
-- =================================================================
-- 🚨 PROCAP - G200: SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS (v10.0) 🚨
-- =================================================================
--
-- INSTRUÇÕES:
-- Este script é IDEMPOTENTE e SEGURO para ser executado múltiplas vezes.
--
-- 1.  (SE NECESSÁRIO) CRIE OS BUCKETS:
--     - No menu do Supabase, vá em "Storage".
--     - Se não existirem, crie DOIS buckets públicos chamados `sources` e `files`.
--
-- 2.  EXECUTE ESTE SCRIPT:
--     - No menu lateral, vá para "SQL Editor".
--     - Clique em "+ New query".
--     - COPIE E COLE **TODO O CONTEÚDO** DESTE BLOCO SQL ABAIXO.
--     - Clique em "RUN".
--
-- O QUE HÁ DE NOVO (v10.0):
--   - POLÍTICA DE SEGURANÇA (RLS) UNIFICADA: A tabela `user_moods` agora usa
--     a mesma política de segurança genérica das outras tabelas. Isso corrige
--     um erro de permissão ('violates row-level security policy') causado por uma
--     incompatibilidade entre a política anterior e o sistema de login personalizado
--     do aplicativo.
-- =================================================================

-- Parte 1: Correção e Padronização das Políticas de Segurança (RLS)
CREATE OR REPLACE PROCEDURE fix_rls_policies_v4()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t TEXT;
    policy_name TEXT;
    is_rls_enabled BOOLEAN;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN (
            'users', 'sources', 'summaries', 'flashcards', 'questions', 'mind_maps',
            'audio_summaries', 'chat_messages', 'user_message_votes', 'user_source_votes',
            'user_content_interactions', 'question_notebooks', 'user_notebook_interactions',
            'user_question_answers', 'case_studies', 'schedule_events',
            'links_files', 'study_plans', 'xp_events', 'user_moods'
        )
    LOOP
        -- Habilitar RLS se não estiver ativo
        SELECT relrowsecurity INTO is_rls_enabled FROM pg_class WHERE relname = t AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        IF NOT is_rls_enabled THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        END IF;

        -- Limpar políticas antigas
        FOR policy_name IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, t);
        END LOOP;

        -- Criar política genérica de acesso total
        EXECUTE format('
            CREATE POLICY "Allow all operations for application users"
            ON public.%I
            FOR ALL
            USING (true)
            WITH CHECK (true);
        ', t);
    END LOOP;
END;
$$;
CALL fix_rls_policies_v4();
DROP PROCEDURE IF EXISTS fix_rls_policies_v4();

-- REMOÇÃO DAS POLÍTICAS ESPECÍFICAS ANTERIORES PARA GARANTIR A LIMPEZA
DROP POLICY IF EXISTS "Allow users to see all moods" ON public.user_moods;
DROP POLICY IF EXISTS "Allow users to update their own mood" ON public.user_moods;


-- Parte 2: Criação de Novas Tabelas (se não existirem)
CREATE TABLE IF NOT EXISTS public.links_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    file_path TEXT,
    file_name TEXT,
    is_anki_deck BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hot_votes INT NOT NULL DEFAULT 0,
    cold_votes INT NOT NULL DEFAULT 0,
    comments JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    source TEXT NOT NULL,
    content_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_moods (
    user_id UUID PRIMARY KEY NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mood TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Parte 3: Padronização e Segurança das Funções de Votação (RPC)
DROP FUNCTION IF EXISTS public.increment_vote(uuid, text, integer);
DROP FUNCTION IF EXISTS public.increment_content_vote(text, text, text, integer);

CREATE OR REPLACE FUNCTION increment_message_vote( message_id_param UUID, vote_type TEXT, increment_value INT ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF vote_type = 'hot_votes' THEN UPDATE public.chat_messages SET hot_votes = hot_votes + increment_value WHERE id = message_id_param; ELSIF vote_type = 'cold_votes' THEN UPDATE public.chat_messages SET cold_votes = cold_votes + increment_value WHERE id = message_id_param; END IF; END; $$;
CREATE OR REPLACE FUNCTION increment_source_vote( source_id_param UUID, vote_type TEXT, increment_value INT ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF vote_type = 'hot_votes' THEN UPDATE public.sources SET hot_votes = hot_votes + increment_value WHERE id = source_id_param; ELSIF vote_type = 'cold_votes' THEN UPDATE public.sources SET cold_votes = cold_votes + increment_value WHERE id = source_id_param; END IF; END; $$;
CREATE OR REPLACE FUNCTION increment_notebook_vote( notebook_id_param UUID, vote_type TEXT, increment_value INT ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF vote_type = 'hot_votes' THEN UPDATE public.question_notebooks SET hot_votes = hot_votes + increment_value WHERE id = notebook_id_param; ELSIF vote_type = 'cold_votes' THEN UPDATE public.question_notebooks SET cold_votes = cold_votes + increment_value WHERE id = notebook_id_param; END IF; END; $$;
CREATE OR REPLACE FUNCTION increment_case_study_vote( case_study_id_param UUID, vote_type TEXT, increment_value INT ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF vote_type = 'hot_votes' THEN UPDATE public.case_studies SET hot_votes = hot_votes + increment_value WHERE id = case_study_id_param; ELSIF vote_type = 'cold_votes' THEN UPDATE public.case_studies SET cold_votes = cold_votes + increment_value WHERE id = case_study_id_param; END IF; END; $$;
CREATE OR REPLACE FUNCTION increment_schedule_event_vote( event_id_param TEXT, vote_type TEXT, increment_value INT ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF vote_type = 'hot_votes' THEN UPDATE public.schedule_events SET hot_votes = hot_votes + increment_value WHERE id = event_id_param; ELSIF vote_type = 'cold_votes' THEN UPDATE public.schedule_events SET cold_votes = cold_votes + increment_value WHERE id = event_id_param; END IF; END; $$;

DROP FUNCTION IF EXISTS public.increment_general_content_vote(text, uuid, text, integer);
CREATE OR REPLACE FUNCTION increment_general_content_vote(table_name_param TEXT, content_id_param UUID, vote_type TEXT, increment_value INT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF table_name_param = 'summaries' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.summaries SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.summaries SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    ELSIF table_name_param = 'flashcards' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.flashcards SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.flashcards SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    ELSIF table_name_param = 'questions' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.questions SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.questions SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    ELSIF table_name_param = 'mind_maps' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.mind_maps SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.mind_maps SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    ELSIF table_name_param = 'audio_summaries' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.audio_summaries SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.audio_summaries SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    ELSIF table_name_param = 'links_files' THEN
        IF vote_type = 'hot_votes' THEN UPDATE public.links_files SET hot_votes = hot_votes + increment_value WHERE id = content_id_param;
        ELSIF vote_type = 'cold_votes' THEN UPDATE public.links_files SET cold_votes = cold_votes + increment_value WHERE id = content_id_param; END IF;
    END IF;
END;
$$;


-- Parte 4: Concessão de Permissões (Grants)
GRANT USAGE ON SCHEMA public, storage TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO anon, authenticated;


-- Parte 5: Políticas de Segurança para o Storage (Supabase Storage) - CORREÇÃO
CREATE OR REPLACE PROCEDURE fix_storage_policies_v4()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bucket_name TEXT;
BEGIN
    -- Habilitar RLS em storage.objects se ainda não estiver
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'objects' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage') AND relrowsecurity) THEN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    END IF;

    FOREACH bucket_name IN ARRAY ARRAY['sources', 'files']
    LOOP
        -- Limpar políticas antigas para evitar conflitos
        EXECUTE format('DROP POLICY IF EXISTS "Public Read Access on %s" ON storage.objects;', bucket_name);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Write Access on %s" ON storage.objects;', bucket_name);
        -- Drop legacy policy names from previous versions
        EXECUTE format('DROP POLICY IF EXISTS "Public Select for %s" ON storage.objects;', bucket_name);
        EXECUTE format('DROP POLICY IF EXISTS "Anon Write for %s" ON storage.objects;', bucket_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public access to %s bucket" ON storage.objects;', bucket_name);

        -- Política 1: Acesso de Leitura Público
        -- Qualquer pessoa pode ler (fazer download) de arquivos nestes buckets.
        EXECUTE format('
            CREATE POLICY "Public Read Access on %s"
            ON storage.objects FOR SELECT
            USING ( bucket_id = %L );
        ', bucket_name, bucket_name);

        -- Política 2: Acesso de Escrita para Usuários Autenticados
        -- Apenas usuários logados (autenticados) podem fazer upload, alterar ou deletar arquivos.
        EXECUTE format('
            CREATE POLICY "Authenticated Write Access on %s"
            ON storage.objects FOR ALL -- Abrange INSERT, UPDATE, DELETE
            TO authenticated
            USING ( bucket_id = %L )
            WITH CHECK ( bucket_id = %L );
        ', bucket_name, bucket_name, bucket_name);

    END LOOP;
END;
$$;
CALL fix_storage_policies_v4();
DROP PROCEDURE IF EXISTS fix_storage_policies_v4();

*/

// Tenta usar as variáveis de ambiente do Vite (import.meta.env) primeiro.
// Se não encontradas, recorre a process.env (para outros ambientes) e, finalmente, a um valor fixo.
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://nzdbzglklwpklzwzmqbp.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZGJ6Z2xrbHdwa2x6d3ptcWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjc2ODUsImV4cCI6MjA3NzgwMzY4NX0.1C5G24n-7DrPownNpKlOyfzAni5mMlR4JlsGNwzOor0';

export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error("Error creating Supabase client:", error);
  }
} else {
  console.error("Supabase URL or Key is missing. Community features will be disabled.");
}

const checkSupabase = () => {
    if (!supabase) {
        console.error("Supabase not configured. Cannot perform database operation.");
        return false;
    }
    return true;
}

const fetchTable = async (tableName: string, options?: { 
    ordering?: { column: string, options: { ascending: boolean } },
    filter?: { column: string, value: any }
}) => {
    if (!checkSupabase()) return [];
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit per request

    while (true) {
        let query = supabase!.from(tableName).select('*');
        
        if (options?.ordering) {
            query = query.order(options.ordering.column, options.ordering.options);
        }
        if (options?.filter) {
            query = query.eq(options.filter.column, options.filter.value);
        }

        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            throw new Error(`Error fetching data from table "${tableName}": ${error.message}`);
        }

        if (data) {
            allData = allData.concat(data);
        }

        if (!data || data.length < pageSize) {
            break; // Exit loop if last page is reached
        }
        page++;
    }
    return allData;
};

export const getQuestions = async (): Promise<Question[]> => {
    if (!checkSupabase()) return [];
    const raw = await fetchTable('questions');
    return raw.map((q: any) => ({
        ...q,
        questionText: q.question_text,
        correctAnswer: q.correct_answer,
    }));
};
export const getSummaries = async (): Promise<Summary[]> => {
    if (!checkSupabase()) return [];
    const raw = await fetchTable('summaries');
    return raw.map((s: any) => ({...s, keyPoints: s.key_points}));
};
export const getFlashcards = async (): Promise<Flashcard[]> => fetchTable('flashcards');
export const getMindMaps = async (): Promise<MindMap[]> => {
    if (!checkSupabase()) return [];
    const raw = await fetchTable('mind_maps');
    return raw.map((m: any) => ({...m, imageUrl: m.image_url}));
};
export const getAudioSummaries = async (): Promise<AudioSummary[]> => {
    if (!checkSupabase()) return [];
    const raw = await fetchTable('audio_summaries');
    return raw.map((a: any) => ({...a, audioUrl: a.audio_url}));
};

export const getSourcesWithContent = async (): Promise<Source[]> => {
    const [sources, summaries, flashcards, questions, mindMaps, audioSummaries] = await Promise.all([
        fetchTable('sources'),
        getSummaries(),
        getFlashcards(),
        getQuestions(),
        getMindMaps(),
        getAudioSummaries()
    ]);

    return sources.map(source => ({
        ...source,
        summaries: summaries.filter(s => s.source_id === source.id),
        flashcards: flashcards.filter(f => f.source_id === source.id),
        questions: questions.filter(q => q.source_id === source.id),
        mind_maps: mindMaps.filter(m => m.source_id === source.id),
        audio_summaries: audioSummaries.filter(a => a.source_id === source.id),
    }));
};


export const getLinksFiles = async (): Promise<LinkFile[]> => fetchTable('links_files', { ordering: { column: 'created_at', options: { ascending: false } } });
export const getCaseStudiesData = async (): Promise<{ caseStudies: CaseStudy[], userCaseStudyInteractions: UserCaseStudyInteraction[] } | { error: string }> => {
    try {
        const [caseStudies, userCaseStudyInteractions] = await Promise.all([
            fetchTable('case_studies', { ordering: { column: 'created_at', options: { ascending: false } } }),
            fetchTable('user_case_study_interactions'),
        ]);
        return { caseStudies, userCaseStudyInteractions };
    } catch (e: any) { return { error: e.message }; }
};
export const getCommunityData = async (): Promise<{ chatMessages: ChatMessage[], userMessageVotes: UserMessageVote[], xp_events: XpEvent[] } | { error: string }> => {
    try {
        const [chatMessages, userMessageVotes, xp_events] = await Promise.all([
            fetchTable('chat_messages', { ordering: { column: 'timestamp', options: { ascending: true } } }),
            fetchTable('user_message_votes'),
            fetchTable('xp_events', { ordering: { column: 'created_at', options: { ascending: false } } }),
        ]);
        return { chatMessages, userMessageVotes, xp_events };
    } catch (e: any) { return { error: e.message }; }
};
export const getScheduleEvents = async (): Promise<ScheduleEvent[]> => fetchTable('schedule_events', { ordering: { column: 'date', options: { ascending: true } } });
export const getUserStudyPlans = async (userId: string): Promise<StudyPlan[]> => fetchTable('study_plans', { filter: { column: 'user_id', value: userId } });
export const getUserMoods = async (): Promise<UserMood[]> => fetchTable('user_moods');
export const getQuestionNotebooks = async (): Promise<QuestionNotebook[]> => fetchTable('question_notebooks');
export const getUserQuestionAnswers = async (userId: string): Promise<UserQuestionAnswer[]> => fetchTable('user_question_answers', { filter: { column: 'user_id', value: userId } });
export const getUserNotebookInteractions = async (userId: string): Promise<UserNotebookInteraction[]> => fetchTable('user_notebook_interactions', { filter: { column: 'user_id', value: userId } });
export const getUserContentInteractions = async (userId: string): Promise<UserContentInteraction[]> => fetchTable('user_content_interactions', { filter: { column: 'user_id', value: userId } });
export const getUserXpEvents = async (userId: string): Promise<XpEvent[]> => fetchTable('xp_events', { filter: { column: 'user_id', value: userId }, ordering: { column: 'created_at', options: { ascending: false } } });

export const getInitialData = async (): Promise<{ data: AppData; error: string | null; }> => {
    try {
        const users = await fetchTable('users');
        const data = {
            ...INITIAL_APP_DATA,
            users,
        };
        return { data, error: null };
    } catch (error: any) {
        console.error("Error fetching initial user data from Supabase", error);
        return { data: INITIAL_APP_DATA, error: error.message };
    }
};

export const getSourcesBase = async (): Promise<Source[]> => {
    const sources = await fetchTable('sources');
    // Garante que os arrays de conteúdo aninhado existam para evitar erros
    return sources.map(s => ({
        ...s,
        summaries: s.summaries || [],
        flashcards: s.flashcards || [],
        questions: s.questions || [],
        mind_maps: s.mind_maps || [],
        audio_summaries: s.audio_summaries || [],
    }));
};

export const getQuestionStats = async () => {
    if (!checkSupabase()) return { data: null, error: 'Supabase not configured' };
    return supabase!.rpc('get_question_stats');
}

export const getNotebookLeaderboards = async () => {
    if (!checkSupabase()) return { data: null, error: 'Supabase not configured' };
    return supabase!.rpc('get_notebook_leaderboards');
}


export const createUser = async (newUserPayload: Omit<User, 'id'>): Promise<{ user: User | null, error: string | null }> => {
    if (!checkSupabase()) return { user: null, error: "Supabase client not configured." };
    const { data, error } = await supabase!
        .from('users')
        .insert(newUserPayload)
        .select()
        .single();
    if (error) {
        if (error.code === '23505') return { user: null, error: 'duplicate' };
        console.error("Error creating user:", error);
        return { user: null, error: error.message };
    }
    return { user: data as User, error: null };
};

export const updateUser = async (userToUpdate: User): Promise<User | null> => {
    if (!checkSupabase()) return null;
    const { id, ...updateData } = userToUpdate;
    const { data, error } = await supabase!
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    if (error) {
        console.error("Error updating user:", error);
        return null;
    }
    return data as User;
};

export const logXpEvent = async (
    user_id: string, 
    amount: number, 
    source: string, 
    content_id?: string
): Promise<XpEvent | null> => {
    if (!checkSupabase() || amount === 0) return null;
    
    const { data, error } = await supabase!
        .from('xp_events')
        .insert({ user_id, amount, source, content_id })
        .select()
        .single();
        
    if (error) {
        console.error("Error logging XP event:", error);
        return null;
    }
    return data as XpEvent;
};

export const upsertUserMood = async (userId: string, mood: string): Promise<UserMood | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!
        .from('user_moods')
        .upsert({ user_id: userId, mood, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();
    if (error) {
        console.error("Error upserting user mood:", error);
        return null;
    }
    return data as UserMood;
};


// ... (other db functions)
export const addSource = async (sourcePayload: Partial<Source>): Promise<Source | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('sources').insert(sourcePayload).select().single();
    if (error) { console.error("Error adding source:", error); return null; }
    return data as Source;
};

export const updateSource = async (sourceId: string, updatePayload: Partial<Source>): Promise<Source | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('sources').update(updatePayload).eq('id', sourceId).select().single();
    if (error) { console.error("Error updating source:", error); return null; }
    return data as Source;
};

export const deleteSource = async (sourceId: string, storagePaths: string[] | undefined): Promise<boolean> => {
    if (!checkSupabase()) return false;
    if (storagePaths && storagePaths.length > 0) {
        const { error: storageError } = await supabase!.storage.from('sources').remove(storagePaths);
        if (storageError) {
            console.error("Error deleting source files from storage:", storageError);
            return false;
        }
    }
    const { error } = await supabase!.from('sources').delete().eq('id', sourceId);
    if (error) { console.error("Error deleting source from DB:", error); return false; }
    return true;
};

export const addGeneratedContent = async (sourceId: string, content: any): Promise<any | null> => {
    if (!checkSupabase()) return null;
    const results: any = {};
    try {
        if (content.summaries?.length) {
            const payload = content.summaries.map((s: any) => ({
                title: s.title,
                content: s.content,
                key_points: s.keyPoints,
                source_id: sourceId
            }));
            const { data, error } = await supabase!.from('summaries').insert(payload).select();
            if(error) throw error;
            results.summaries = data.map((s: any) => ({...s, keyPoints: s.key_points}));
        }
         if (content.flashcards?.length) {
            const { data, error } = await supabase!.from('flashcards').insert(content.flashcards.map((f: any) => ({...f, source_id: sourceId}))).select();
            if(error) throw error;
            results.flashcards = data;
        }
         if (content.questions?.length) {
            const payload = content.questions.map((q: any) => ({
                source_id: sourceId,
                difficulty: q.difficulty,
                question_text: q.questionText,
                options: q.options,
                correct_answer: q.correctAnswer,
                explanation: q.explanation,
                hints: q.hints
            }));
            const { data, error } = await supabase!.from('questions').insert(payload).select();
            if(error) throw error;
            results.questions = data;
        }
         if (content.mind_maps?.length) {
            const payload = content.mind_maps.map((m: any) => ({...m, source_id: sourceId, image_url: m.imageUrl}));
            const { data, error } = await supabase!.from('mind_maps').insert(payload).select();
            if(error) throw error;
            results.mind_maps = data.map((m: any) => ({...m, imageUrl: m.image_url}));
        }
        return results;
    } catch(err) {
        console.error("Error in addGeneratedContent", err);
        return null;
    }
};

export const appendGeneratedContentToSource = async (sourceId: string, content: any): Promise<any | null> => {
     if (!checkSupabase()) return null;
    const results: any = { newSummaries: [], newFlashcards: [], newQuestions: [], newMindMaps: [] };
    try {
        if (content.summaries?.length) {
            const payload = content.summaries.map((s: any) => ({
                title: s.title,
                content: s.content,
                key_points: s.keyPoints,
                source_id: sourceId
            }));
            const { data, error } = await supabase!.from('summaries').insert(payload).select();
            if(error) throw error;
            results.newSummaries = data.map((s: any) => ({...s, keyPoints: s.key_points}));
        }
        if (content.flashcards?.length) {
            const { data, error } = await supabase!.from('flashcards').insert(content.flashcards.map((f: any) => ({...f, source_id: sourceId}))).select();
            if(error) throw error;
            results.newFlashcards = data;
        }
        if (content.questions?.length) {
            const payload = content.questions.map((q: any) => ({
                source_id: sourceId,
                difficulty: q.difficulty,
                question_text: q.questionText,
                options: q.options,
                correct_answer: q.correctAnswer,
                explanation: q.explanation,
                hints: q.hints
            }));
            const { data, error } = await supabase!.from('questions').insert(payload).select();
            if(error) throw error;
            results.newQuestions = data;
        }
        if (content.mind_maps?.length) {
            const payload = content.mind_maps.map((m: any) => ({...m, source_id: sourceId, image_url: m.imageUrl}));
            const { data, error } = await supabase!.from('mind_maps').insert(payload).select();
            if(error) throw error;
            results.newMindMaps = data.map((m: any) => ({...m, imageUrl: m.image_url}));
        }
        return results;
    } catch(err) {
        console.error("Error appending generated content:", err);
        return null;
    }
};

export const addSourceComment = async (source: Source, comment: Comment): Promise<Source | null> => {
    const updatedComments = [...(source.comments || []), comment];
    return updateSource(source.id, { comments: updatedComments });
}

export const updateContentComments = async (tableName: string, contentId: string, comments: Comment[]): Promise<boolean> => {
    if (!checkSupabase()) return false;
    const { error } = await supabase!.from(tableName).update({ comments }).eq('id', contentId);
    if (error) { console.error(`Error updating comments on ${tableName}:`, error); return false; }
    return true;
}

export const addChatMessage = async (message: Omit<ChatMessage, 'id' | 'hot_votes' | 'cold_votes'>): Promise<ChatMessage | null> => {
    if (!checkSupabase()) return null;
    const payload = { ...message, hot_votes: 0, cold_votes: 0 };
    const { data, error } = await supabase!.from('chat_messages').insert(payload).select().single();
    if(error) { console.error("Error adding chat message:", error); return null; }
    return data;
};

export const upsertUserVote = async (tableName: string, payload: any, conflictColumns: string[]): Promise<any | null> => {
    if (!checkSupabase()) return null;
    const { hot_votes_increment, cold_votes_increment, ...basePayload } = payload;

    // This is a simplified version; a real implementation should use an RPC for atomic increments
    // For now, it relies on the client's optimistic update.
    const { data, error } = await supabase!.from(tableName)
        .upsert(basePayload, { onConflict: conflictColumns.join(',') })
        .select()
        .single();
    
    if(error) { console.error(`Error upserting vote to ${tableName}:`, error); return null; }
    return data;
}

export const incrementMessageVote = async (messageId: string, voteType: string, increment: number) => {
    if (!checkSupabase()) return;
    const { error } = await supabase!.rpc('increment_message_vote', {
        message_id_param: messageId,
        vote_type: voteType,
        increment_value: increment
    });
    if (error) console.error(`Error calling RPC increment_message_vote:`, error);
};

export const incrementSourceVote = async (sourceId: string, voteType: string, increment: number) => {
    if (!checkSupabase()) return;
    const { error } = await supabase!.rpc('increment_source_vote', {
        source_id_param: sourceId,
        vote_type: voteType,
        increment_value: increment
    });
    if (error) console.error(`Error calling RPC increment_source_vote:`, error);
};

export const incrementNotebookVote = async (notebookId: string, voteType: string, increment: number) => {
    if (!checkSupabase()) return;
    const { error } = await supabase!.rpc('increment_notebook_vote', {
        notebook_id_param: notebookId,
        vote_type: voteType,
        increment_value: increment
    });
    if (error) console.error(`Error calling RPC increment_notebook_vote:`, error);
};

export const incrementCaseStudyVote = async (caseStudyId: string, voteType: string, increment: number) => {
    if (!checkSupabase()) return;
    const { error } = await supabase!.rpc('increment_case_study_vote', {
        case_study_id_param: caseStudyId,
        vote_type: voteType,
        increment_value: increment
    });
    if (error) console.error(`Error calling RPC increment_case_study_vote:`, error);
};

export const incrementContentVote = async (tableName: string, contentId: string, voteType: string, increment: number) => {
    if (!checkSupabase()) return;
    
    // Schedule events have a text ID and a specific function
    if (tableName === 'schedule_events') {
        const { error } = await supabase!.rpc('increment_schedule_event_vote', { 
            event_id_param: contentId, 
            vote_type: voteType, 
            increment_value: increment 
        });
        if (error) console.error(`Error calling RPC increment_schedule_event_vote:`, error);
    } else {
         // Other content types use the new general function which expects a UUID
        const { error } = await supabase!.rpc('increment_general_content_vote', { 
            table_name_param: tableName, 
            content_id_param: contentId, 
            vote_type: voteType, 
            increment_value: increment 
        });
        if (error) console.error(`Error calling RPC increment_general_content_vote for table ${tableName}:`, error);
    }
};

export const addQuestionNotebook = async (payload: Partial<QuestionNotebook>): Promise<QuestionNotebook | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('question_notebooks').insert(payload).select().single();
    if(error) { console.error("Error adding question notebook:", error); return null; }
    return data;
};

export const upsertUserQuestionAnswer = async (payload: Partial<UserQuestionAnswer>): Promise<UserQuestionAnswer | null> => {
    if(!checkSupabase()) return null;
    const { data, error } = await supabase!.from('user_question_answers').upsert(payload, { onConflict: 'user_id,notebook_id,question_id'}).select().single();
    if(error) { console.error("Error upserting question answer:", error); return null; }
    return data;
};

export const clearNotebookAnswers = async (userId: string, notebookId: string, questionIds?: string[]): Promise<boolean> => {
    if(!checkSupabase()) return false;
    
    let query = supabase!.from('user_question_answers').delete().match({ user_id: userId, notebook_id: notebookId });

    if (questionIds && questionIds.length > 0) {
        query = query.in('question_id', questionIds);
    }
    
    const { error } = await query;
    if(error) { console.error("Error clearing notebook answers:", error); return false; }
    return true;
};

export const addCaseStudy = async (payload: Partial<CaseStudy>): Promise<CaseStudy | null> => {
    if(!checkSupabase()) return null;
    const { data, error } = await supabase!.from('case_studies').insert(payload).select().single();
    if(error) { console.error("Error adding case study:", error); return null; }
    return data;
};

export const upsertUserCaseStudyInteraction = async (payload: Partial<UserCaseStudyInteraction>): Promise<UserCaseStudyInteraction | null> => {
    if(!checkSupabase()) return null;
    const { data, error } = await supabase!.from('user_case_study_interactions').upsert(payload, { onConflict: 'user_id,case_study_id' }).select().single();
    if(error) { console.error("Error upserting case study interaction:", error); return null; }
    return data;
};

export const clearCaseStudyProgress = async (userId: string, caseStudyId: string): Promise<boolean> => {
    if(!checkSupabase()) return false;
    // We are resetting, so we can delete the row. It will be recreated on next interaction.
    const { error } = await supabase!.from('user_case_study_interactions').delete().match({ user_id: userId, case_study_id: caseStudyId });
    if(error) { console.error("Error clearing case study progress:", error); return false; }
    return true;
};

export const addAudioSummary = async (payload: Partial<AudioSummary>): Promise<AudioSummary | null> => {
    if(!checkSupabase()) return null;
    
    const { audioUrl, ...restPayload } = payload;
    const dbPayload = {
        ...restPayload,
        ...(audioUrl && { audio_url: audioUrl }),
    };

    const { data, error } = await supabase!.from('audio_summaries').insert(dbPayload).select().single();

    if(error) { 
        console.error("Error adding audio summary:", error); 
        return null; 
    }
    
    if (data) {
        const { audio_url, ...restData } = data;
        return { ...restData, audioUrl: audio_url } as AudioSummary;
    }

    return null;
};

export const upsertUserContentInteraction = async (payload: Partial<UserContentInteraction>): Promise<UserContentInteraction | null> => {
    if(!checkSupabase()) return null;
    const { data, error } = await supabase!.from('user_content_interactions').upsert(payload, { onConflict: 'user_id,content_id,content_type'}).select().single();
    if(error) { console.error("Error upserting content interaction:", error); return null; }
    return data;
};

export const addStudyPlan = async (payload: Omit<StudyPlan, 'id' | 'created_at'>): Promise<StudyPlan | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('study_plans').insert(payload).select().single();
    if (error) {
        console.error("Error adding study plan:", error);
        return null;
    }
    return data;
};

export const addLinkFile = async (payload: Partial<LinkFile>): Promise<LinkFile | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('links_files').insert(payload).select().single();
    if (error) { console.error("Error adding link/file:", error); return null; }
    return data as LinkFile;
};

export const updateLinkFile = async (id: string, payload: Partial<LinkFile>): Promise<LinkFile | null> => {
    if (!checkSupabase()) return null;
    const { data, error } = await supabase!.from('links_files').update(payload).eq('id', id).select().single();
    if (error) { console.error("Error updating link/file:", error); return null; }
    return data as LinkFile;
};

export const deleteLinkFile = async (id: string, filePath?: string): Promise<boolean> => {
    if (!checkSupabase()) return false;
    if (filePath) {
        const { error: storageError } = await supabase!.storage.from('files').remove([filePath]);
        if (storageError) {
            console.error("Error deleting file from storage:", storageError);
            // Non-blocking, continue to delete DB record
        }
    }
    const { error } = await supabase!.from('links_files').delete().eq('id', id);
    if (error) { console.error("Error deleting link/file from DB:", error); return false; }
    return true;
};