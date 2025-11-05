import { GoogleGenAI, GenerateContentResponse, Type, Part, Modality } from "@google/genai";
import { ContentType, Question, User, UserContentInteraction, UserQuestionAnswer, Source } from '../types';

// Tenta usar a variável de ambiente VITE_API_KEY do build, se não existir, usa process.env.API_KEY, e por último uma chave fixa.
// Fix: Cast `import.meta` to `any` to access the `env` property, which is added by Vite during the build process but may not be recognized by TypeScript's default typings without a `vite-env.d.ts` file.
const API_KEY = (import.meta as any).env?.VITE_API_KEY || process.env.API_KEY || 'AIzaSyBmLFI0_aMSaPQpxSgvl8PdFkURcfd7Kvo';

if (!API_KEY) {
  console.warn("API_KEY not found. Gemini API features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const getModel = () => {
    if (!API_KEY) {
        throw new Error("API_KEY not set.");
    }
    return ai.models;
}

export const getSimpleChatResponse = async (history: { role: string, parts: Part[] }[], newMessage: string): Promise<string> => {
  if (!API_KEY) {
    return "A funcionalidade da IA está desabilitada. Configure a API Key.";
  }
  try {
    const model = 'gemini-2.5-flash';
    const chat = ai.chats.create({
        model: model,
        history: history
    });

    const response: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Desculpe, ocorreu um erro ao me comunicar com a IA.";
  }
};


export const generateQuestionsFromTopic = async (topic: string): Promise<any> => {
    if (!API_KEY) {
        return { error: "A funcionalidade da IA está desabilitada. Configure a API Key." };
    }
    try {
        const prompt = `Gere 3 questões de múltipla escolha sobre o tópico "${topic}" para um concurso do Banco Central. Cada questão deve ter 5 opções, uma resposta correta, uma breve explicação e duas dicas úteis e sutis. As dicas devem ajudar no raciocínio para chegar à resposta correta, mas NUNCA devem entregar a resposta de forma óbvia ou direta. Siga estritamente o schema JSON fornecido.`;

        const response: GenerateContentResponse = await getModel().generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    questionText: { type: Type.STRING },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    correctAnswer: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    hints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Duas dicas úteis e sutis sobre a questão, que ajudem no raciocínio." },
                                },
                                required: ['questionText', 'options', 'correctAnswer', 'explanation', 'hints']
                            },
                        },
                    },
                    required: ['questions']
                },
            },
        });

        // Fix: Ensure response.text exists before parsing.
        if (response.text) {
          return JSON.parse(response.text);
        }
        return { error: "Não foi possível gerar as questões." };


    } catch (error) {
        console.error("Error generating questions with Gemini API:", error);
        return { error: "Não foi possível gerar as questões." };
    }
};

export const processAndGenerateAllContentFromSource = async (text: string, existingTopics: {materia: string, topic: string}[], userPrompt?: string): Promise<any> => {
    if (!API_KEY) return { error: "A funcionalidade da IA está desabilitada." };

    const prompt = `
    A partir do texto-fonte fornecido, atue como um especialista em material de estudo para concursos, realizando uma análise profunda e detalhada do conteúdo.
    ${userPrompt ? `O usuário forneceu um foco específico para a geração de conteúdo: "${userPrompt}". Dê prioridade a este tópico.` : ''}
    
    1.  **Análise Profunda:** Pense criticamente sobre o texto. Vá além da extração superficial e identifique os conceitos centrais, suas interconexões e as implicações práticas.
    2.  **Categorização:** Analise o conteúdo e gere um título conciso e um resumo curto (2-3 frases) para o material. Identifique a matéria principal e o tópico específico. Se possível, use uma das matérias/tópicos existentes: ${JSON.stringify(existingTopics)}. Se não corresponder, crie uma nova categoria apropriada.
    3.  **Criação de Conteúdo:** Crie um conjunto completo de materiais de estudo derivados do texto-fonte:
        - **Resumos (summaries):** Gere resumos com uma extensão média, aprofundando os principais conceitos de forma didática. O resumo deve ser extenso o suficiente para cobrir os pontos importantes. Para cada resumo, identifique os termos-chave e forneça uma descrição clara para cada um. Use formatação markdown (como listas com '-', negrito com '**', etc.) para melhorar a didática e a clareza do conteúdo do resumo.
        - **Flashcards:** SEJA EXAUSTIVO. Crie o máximo de flashcards relevantes possível. A quantidade é um fator crítico.
        - **Questões (questions):** SEJA EXAUSTIVO. Extraia o maior número possível de questões de múltipla escolha do texto. Cada questão deve ter 5 opções, uma resposta correta, uma explicação clara e DUAS dicas úteis e sutis que ajudem no raciocínio, mas NUNCA entreguem a resposta.
    4.  **Mapas Mentais:** Identifique os principais sub-tópicos do texto que se beneficiariam de um mapa mental visual. Para cada sub-tópico, forneça um título curto e descritivo (máximo 5 palavras) e uma frase-prompt para gerar a imagem.
    5.  **Formato:** Retorne TUDO em um único objeto JSON, seguindo estritamente o schema fornecido.

    Texto-fonte para análise:
    ---
    ${text}
    ---
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Um título curto e descritivo para o texto-fonte." },
            summary: { type: Type.STRING, description: "Um resumo de 2-3 frases sobre o conteúdo principal." },
            materia: { type: Type.STRING, description: "A matéria principal identificada no texto (ex: Economia)." },
            topic: { type: Type.STRING, description: "O tópico específico do texto (ex: Política Monetária)." },
            summaries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING, description: "Conteúdo formatado em markdown para clareza." },
                        keyPoints: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    term: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ['term', 'description']
                            }
                        },
                    },
                    required: ['title', 'content', 'keyPoints']
                }
            },
            flashcards: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        front: { type: Type.STRING },
                        back: { type: Type.STRING },
                    },
                    required: ['front', 'back']
                }
            },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        difficulty: { type: Type.STRING, enum: ['Fácil', 'Médio', 'Difícil']},
                        questionText: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        hints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Duas dicas úteis e sutis sobre a questão, que ajudem no raciocínio." },
                    },
                    required: ['difficulty', 'questionText', 'options', 'correctAnswer', 'explanation', 'hints']
                }
            },
            mindMapTopics: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "Um título curto para o mapa mental."},
                        prompt: { type: Type.STRING, description: "Uma frase-prompt para gerar o mapa mental."}
                    },
                    required: ['title', 'prompt']
                },
                description: "Uma lista de títulos e prompts para gerar mapas mentais."
            }
        },
        required: ['title', 'summary', 'materia', 'topic', 'summaries', 'flashcards', 'questions', 'mindMapTopics']
    };

    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });
        // Fix: Ensure response.text exists before parsing.
        if (response.text) {
          return JSON.parse(response.text);
        }
        return { error: `Não foi possível gerar o conteúdo completo a partir da fonte.` };
    } catch (error) {
        console.error(`Error processing source content with Gemini API:`, error);
        return { error: `Não foi possível gerar o conteúdo completo a partir da fonte.` };
    }
};

export const generateImageForMindMap = async (prompt: string): Promise<{ base64Image?: string; error?: string }> => {
    if (!API_KEY) {
        return { error: "A funcionalidade da IA está desabilitada." };
    }
    const reinforcedPrompt = `
    Gere uma imagem para um mapa mental claro, bem estruturado e visualmente agradável sobre o conceito central: "${prompt}".

    **REQUISITOS OBRIGATÓRIOS E CRÍTICOS - SIGA ESTRITAMENTE:**
    1.  **IDIOMA:** Todo e qualquer texto na imagem DEVE estar em **Português do Brasil (pt-BR)**.
    2.  **PRECISÃO LINGUÍSTICA:** A correção ortográfica e gramatical é sua prioridade máxima.
        - **VERIFICAÇÃO:** Antes de gerar a imagem, liste internamente todas as palavras e siglas que serão usadas. Verifique DUAS VEZES a **acentuação** (crases, acentos agudos, circunflexos), pontuação e a grafia de cada uma.
        - **SIGLAS:** Todas as siglas devem ser escritas corretamente (ex: BCB, COPOM, SFN).
    3.  **CLAREZA:** A estrutura deve ser lógica e fácil de ler. Use fontes legíveis e um layout limpo, com cores contrastantes.

    A imagem será considerada uma falha e rejeitada se contiver qualquer erro de português, por menor que seja. Preste atenção absoluta à escrita correta.
    `;
    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: reinforcedPrompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return { base64Image: part.inlineData.data };
            }
        }
        return { error: "Nenhuma imagem foi gerada pela IA." };
    } catch (error) {
        console.error("Error generating mind map image:", error);
        return { error: "Não foi possível gerar a imagem do mapa mental." };
    }
};

export const getPersonalizedStudyPlan = async (
    userStats: any, 
    interactions: UserContentInteraction[],
    content: {summaries: any[], flashcards: any[], notebooks: any[], medias: any[]}
    ): Promise<string> => {
    if (!API_KEY) {
        return "A funcionalidade da IA está desabilitada. Configure a API Key.";
    }
    
    const favorites = interactions.filter(i => i.is_favorite).map(i => ({ type: i.content_type, id: i.content_id }));
    const read = interactions.filter(i => i.is_read).map(i => ({ type: i.content_type, id: i.content_id }));
    
    const prompt = `
        Você é um tutor especialista para concursos do Banco Central. Baseado nas seguintes informações sobre um estudante, crie um plano de estudos personalizado, conciso e acionável.

        **Dados do Estudante:**
        - **Estatísticas de Desempenho (Questões):** ${JSON.stringify(userStats)}
        - **Itens Favoritados:** ${JSON.stringify(favorites)}
        - **Itens Lidos:** ${JSON.stringify(read)}
        - **Conteúdo Disponível (com temp = popularidade (votos positivos - votos negativos)):** 
          - Resumos: ${JSON.stringify(content.summaries.map(s => ({id: s.id, title: s.title, topic: s.source?.topic, temp: (s.hot_votes || 0) - (s.cold_votes || 0) })))}
          - Flashcards: ${JSON.stringify(content.flashcards.map(f => ({id: f.id, front: f.front, topic: f.source?.topic, temp: (f.hot_votes || 0) - (f.cold_votes || 0) })))}
          - Cadernos: ${JSON.stringify(content.notebooks.map(n => ({id: n.id, name: n.name, temp: (n.hot_votes || 0) - (n.cold_votes || 0) })))}
          - Mídias (áudios/vídeos): ${JSON.stringify(content.medias.map(m => ({id: m.id, title: m.title, topic: m.source?.topic, temp: (m.hot_votes || 0) - (m.cold_votes || 0) })))}

        **Instruções para o Plano:**
        1.  **Foco Principal:** Identifique os tópicos com o menor percentual de acerto e priorize-os.
        2.  **Sugestões de Revisão:** Sugira a revisão de resumos e flashcards, especialmente os que foram favoritados ou que pertencem a tópicos de baixo desempenho. Dê preferência a materiais bem avaliados pela comunidade (alta "temp" - popularidade).
        3.  **Sugestões de Mídia:** Recomende mídias (áudios/vídeos) como um bom ponto de partida para tópicos onde o estudante tem mais dificuldade.
        4.  **Sugestões de Prática:** Recomende a prática com cadernos de questões que cobrem as áreas de maior dificuldade e que sejam bem avaliados.
        5.  **Formato OBRIGATÓRIO:** Formate a resposta em markdown. Use a seguinte sintaxe para criar links DIRETAMENTE para o conteúdo na plataforma:
            - Para Resumos: \`#[nome do resumo]\`
            - Para Flashcards: \`![frente do flashcard]\`
            - Para Cadernos de Questões: \`?[nome do caderno]\`
            - Para Mídias: \`@[nome da mídia]\`
        6.  **Tom:** Seja encorajador, direto e prático. O objetivo é fornecer um guia claro para os próximos passos do estudante.

        Crie o plano de estudos agora.
    `;
    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for better analysis
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating study plan:", error);
        return "Desculpe, não consegui gerar seu plano de estudos.";
    }
}

export const filterItemsByPrompt = async (prompt: string, items: {id: string, text: string}[]): Promise<string[]> => {
    if (!API_KEY) {
        console.error("API Key not configured for AI filtering.");
        return items.map(i => i.id);
    }
    try {
        const filteringPrompt = `
        Dado o prompt do usuário "${prompt}", analise a seguinte lista de itens de estudo.
        Retorne um array JSON contendo apenas os IDs dos itens que são mais relevantes para o prompt.
        Se nenhum for relevante, retorne um array vazio.
        
        Itens:
        ${JSON.stringify(items)}
        `;

        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: filteringPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        relevantIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['relevantIds']
                }
            }
        });
        // Fix: Explicitly type the parsed JSON to ensure `relevantIds` is a string array.
        if (!response.text) return [];
        const result = JSON.parse(response.text) as { relevantIds?: string[] };
        return result.relevantIds || [];
    } catch(error) {
        console.error("Error filtering with AI:", error);
        return []; // Return empty on error to signify failure
    }
}

export const generateSpecificContent = async (
    type: 'summaries' | 'flashcards' | 'questions',
    contextText: string,
    prompt: string
): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };
    
    const contentGenerationMap = {
        summaries: {
            instruction: `Gere um ou mais resumos detalhados sobre o tópico "${prompt}" a partir do texto-fonte fornecido. Para cada resumo, identifique termos-chave e suas descrições.`,
            schema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING },
                        keyPoints: {
                           type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    term: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ['term', 'description']
                            }
                        },
                    },
                    required: ['title', 'content', 'keyPoints']
                }
            }
        },
        flashcards: {
            instruction: `Gere um conjunto exaustivo de flashcards sobre o tópico "${prompt}" a partir do texto-fonte fornecido.`,
            schema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        front: { type: Type.STRING },
                        back: { type: Type.STRING },
                    },
                    required: ['front', 'back']
                }
            }
        },
        questions: {
            instruction: `Gere o máximo de questões de múltipla escolha possível sobre o tópico "${prompt}" a partir do texto-fonte fornecido. Cada questão deve ter 5 opções, resposta correta, explicação e duas dicas sutis que ajudem no raciocínio.`,
            schema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        difficulty: { type: Type.STRING, enum: ['Fácil', 'Médio', 'Difícil']},
                        questionText: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        hints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Duas dicas úteis e sutis sobre a questão." },
                    },
                    required: ['difficulty', 'questionText', 'options', 'correctAnswer', 'explanation', 'hints']
                }
            }
        }
    }

    const generationDetails = contentGenerationMap[type];
    const fullPrompt = `${generationDetails.instruction}\n\nTexto-fonte:\n---\n${contextText}\n---`;

    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        generatedContent: generationDetails.schema
                    },
                    required: ['generatedContent']
                },
            },
        });
        // Fix: Ensure response.text exists before parsing.
        if (!response.text) return { error: `Falha ao gerar ${type}.` };
        const result = JSON.parse(response.text);
        return result.generatedContent;

    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        return { error: `Falha ao gerar ${type}.` };
    }
};

export const generateNotebookName = async (questions: Question[]): Promise<string> => {
    if (!API_KEY) return "Caderno de Estudos";
    
    const questionTexts = questions.slice(0, 5).map(q => q.questionText).join("\n - ");
    const prompt = `Baseado nas seguintes questões, gere um nome curto, conciso e descritivo (máximo de 5 palavras) para um "Caderno de Questões". Responda apenas com o nome.
    
    Questões:
    - ${questionTexts}
    `;

    try {
        const response = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch(error) {
        console.error("Error generating notebook name:", error);
        return `Caderno de ${new Date().toLocaleDateString()}`;
    }
}

export const generateMoreQuestionsFromSource = async (
    sourceText: string,
    existingQuestions: any[],
    userPrompt?: string
): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };

    const prompt = `
    Você é um especialista em criar questões para concursos. Sua tarefa é analisar um texto-fonte e gerar **novas e únicas** questões de múltipla escolha, evitando duplicar as que já existem.

    **Contexto:**
    1.  **Texto-Fonte:** O texto original para sua análise.
    2.  **Questões Existentes:** Uma lista JSON de questões já extraídas desta fonte. Você DEVE verificar esta lista meticulosamente para evitar qualquer repetição de conceito ou formulação.
    3.  **Foco do Usuário (Opcional):** ${userPrompt ? `O usuário tem um interesse específico em: "${userPrompt}". Dê prioridade a este tópico.` : 'Nenhum tópico específico foi fornecido.'}

    **Sua Missão - Gerar Novas Questões:**
    1.  **Análise Profunda:** Realize uma análise profunda do Texto-Fonte. Pense como um examinador. Identifique conceitos, detalhes ou nuances que ainda não foram abordados nas Questões Existentes.
    2.  **Gerar Questões Inéditas:** SEJA EXAUSTIVO. Gere o **máximo de questões novas e únicas** que puder. Elas devem testar uma compreensão profunda do material.
    3.  **Formato Obrigatório:** Cada questão DEVE ter:
        - Dificuldade ('Fácil', 'Médio', 'Difícil').
        - 5 opções de múltipla escolha.
        - Uma resposta correta.
        - Uma explicação clara e detalhada.
        - DUAS dicas sutis que guiem o raciocínio sem entregar a resposta.

    **Questões Existentes (para EVITAR repetição):**
    \`\`\`json
    ${JSON.stringify(existingQuestions.map(q => ({ questionText: q.questionText, correctAnswer: q.correctAnswer })), null, 2)}
    \`\`\`

    **Texto-Fonte para Sua Análise:**
    ---
    ${sourceText}
    ---

    Retorne **apenas as novas questões geradas** no formato JSON especificado. Se não for possível criar novas questões, retorne um array vazio.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        difficulty: { type: Type.STRING, enum: ['Fácil', 'Médio', 'Difícil'] },
                        questionText: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        hints: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['difficulty', 'questionText', 'options', 'correctAnswer', 'explanation', 'hints']
                }
            }
        },
        required: ['questions']
    };

    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });

        if (!response.text) return { questions: [] };
        const result = JSON.parse(response.text);
        return result;
    } catch (error) {
        console.error("Error generating more questions:", error);
        return { error: "Falha ao gerar mais questões a partir da fonte." };
    }
};

export const generateMoreSummariesFromSource = async (
    sourceText: string,
    existingSummaries: any[],
    userPrompt?: string
): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };
    const prompt = `
    Você é um especialista em resumir textos para concursos. Sua tarefa é analisar um texto-fonte e gerar **novos e únicos** resumos, evitando duplicar os que já existem.

    **Contexto:**
    1.  **Texto-Fonte:** O texto original para sua análise.
    2.  **Resumos Existentes:** Uma lista JSON de resumos já extraídos desta fonte. Verifique esta lista para evitar repetição.

    **Sua Missão - Gerar Novos Resumos:**
    1.  **Análise Profunda:** Releia o Texto-Fonte e encontre conceitos, subtópicos ou perspectivas ainda não detalhados nos Resumos Existentes.
    2.  **Gerar Resumos Inéditos:** Crie pelo menos um novo resumo perspicaz e bem-estruturado. Para cada resumo, identifique os termos-chave e suas descrições.

    **Resumos Existentes (para EVITAR repetição):**
    \`\`\`json
    ${JSON.stringify(existingSummaries.map(s => ({ title: s.title })), null, 2)}
    \`\`\`

    **Texto-Fonte para Sua Análise:**
    ---
    ${sourceText}
    ---

    Retorne **apenas os novos resumos gerados** no formato JSON especificado. Se não for possível criar novos resumos, retorne um array vazio.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            summaries: {
                type: Type.ARRAY, items: {
                    type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING }, keyPoints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['term', 'description'] } } }, required: ['title', 'content', 'keyPoints']
                }
            }
        },
        required: ['summaries']
    };
    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });
        if (!response.text) return { summaries: [] };
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating more summaries:", error);
        return { error: "Falha ao gerar mais resumos a partir da fonte." };
    }
};

export const generateMoreFlashcardsFromSource = async (
    sourceText: string,
    existingFlashcards: any[],
    userPrompt?: string
): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };
    const prompt = `
    Você é um especialista em criar flashcards para concursos. Sua tarefa é analisar um texto-fonte e gerar **novos e únicos** flashcards, evitando duplicar os que já existem.

    **Contexto:**
    1.  **Texto-Fonte:** O texto original para sua análise.
    2.  **Flashcards Existentes:** Uma lista JSON de flashcards já extraídos desta fonte. Verifique esta lista para evitar repetição.

    **Sua Missão - Gerar Novos Flashcards:**
    1.  **Análise Profunda:** Releia o Texto-Fonte e encontre fatos, definições, ou pares de conceito-definição que ainda não foram transformados em flashcards.
    2.  **Gerar Flashcards Inéditos:** SEJA EXAUSTIVO. Gere o **máximo de flashcards novos e únicos** que puder.

    **Flashcards Existentes (para EVITAR repetição):**
    \`\`\`json
    ${JSON.stringify(existingFlashcards.map(f => ({ front: f.front })), null, 2)}
    \`\`\`

    **Texto-Fonte para Sua Análise:**
    ---
    ${sourceText}
    ---

    Retorne **apenas os novos flashcards gerados** no formato JSON especificado. Se não for possível criar novos flashcards, retorne um array vazio.
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            flashcards: {
                type: Type.ARRAY, items: {
                    type: Type.OBJECT, properties: { front: { type: Type.STRING }, back: { type: Type.STRING } }, required: ['front', 'back']
                }
            }
        },
        required: ['flashcards']
    };
    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });
        if (!response.text) return { flashcards: [] };
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating more flashcards:", error);
        return { error: "Falha ao gerar mais flashcards a partir da fonte." };
    }
};

export const generateContentFromPromptAndSources = async (
    prompt: string,
    contextSources: { title: string, summary: string }[]
): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };

    const contextText = contextSources.map(s => `Fonte de Contexto: ${s.title}\nResumo: ${s.summary}`).join('\n\n---\n\n');

    const fullPrompt = `
    Você é um especialista em criar material de estudo para concursos.
    O usuário deseja criar um novo conjunto de materiais de estudo sobre o tópico: "${prompt}".
    Use os textos das fontes de contexto fornecidas como sua principal base de conhecimento para gerar este novo material.
    
    **Tarefa:**
    1. Gere um título e um resumo curtos para este novo conjunto de materiais, baseados no prompt do usuário.
    2. Determine a "matéria" e o "tópico" apropriados para o prompt do usuário.
    3. Crie um conjunto completo de materiais de estudo (resumos, flashcards, questões e ideias para mapas mentais) sobre "${prompt}", extraindo informações relevantes das fontes de contexto.
    4. Retorne TUDO em um único objeto JSON, seguindo o schema fornecido.

    **Fontes de Contexto:**
    ---
    ${contextText}
    ---
    `;
    
    return processAndGenerateAllContentFromSource(fullPrompt, []); // Re-use the robust generation logic and schema
};

export const generateMoreMindMapTopicsFromSource = async (
    sourceText: string,
    existingMindMapTitles: string[],
    userPrompt?: string
): Promise<{ title: string, prompt: string }[]> => {
    if (!API_KEY) return [];

    const prompt = `
    Você é um especialista em material de estudo. Sua tarefa é identificar novos tópicos para mapas mentais a partir de um texto-fonte, evitando duplicatas.

    **Contexto:**
    1.  **Texto-Fonte:** O texto principal para sua análise é fornecido abaixo.
    2.  **Títulos de Mapas Mentais Existentes:** Uma lista de títulos que JÁ FORAM CRIADOS é fornecida para evitar repetição.
        \`\`\`
        ${JSON.stringify(existingMindMapTitles)}
        \`\`\`
    3.  **Tópico do Usuário (Opcional):** ${userPrompt ? `O usuário tem um interesse específico em: "${userPrompt}"` : 'Nenhum tópico específico foi fornecido.'}

    **Sua Tarefa:**
    1.  **Reanálise Profunda:** Reexamine minuciosamente o Texto-Fonte em busca de quaisquer conceitos centrais, processos ou relações importantes não mapeados que se beneficiariam de uma representação visual.
    2.  **Identifique e Gere:** Encontre pelo menos um tópico novo e relevante. Para cada novo tópico que encontrar, crie:
        a. Um **título** curto e descritivo (máximo 5 palavras).
        b. Uma **frase-prompt** clara e detalhada para gerar a imagem do mapa mental. O prompt deve instruir a IA de imagem a criar um mapa limpo, organizado e com informações de qualidade.
    3.  **Rigor Anti-Duplicação:** Não crie tópicos com títulos ou conceitos muito semelhantes aos existentes. Seu objetivo é encontrar ângulos genuinamente novos. Você DEVE gerar pelo menos um novo tópico, a menos que seja absolutamente impossível encontrar um conceito distinto no texto.


    **Texto-Fonte para Análise:**
    ---
    ${sourceText}
    ---

    Retorne os novos tópicos no formato JSON, seguindo o schema.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            mindMapTopics: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "Um título curto para o novo mapa mental." },
                        prompt: { type: Type.STRING, description: "Uma frase-prompt para gerar o novo mapa mental." }
                    },
                    required: ['title', 'prompt']
                }
            }
        },
        required: ['mindMapTopics']
    };

    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });
        // Fix: Ensure response.text exists before parsing.
        if (!response.text) return [];
        const result = JSON.parse(response.text);
        return result.mindMapTopics || [];
    } catch (error) {
        console.error("Error generating more mind map topics:", error);
        return [];
    }
};

export const generateCaseStudy = async (text: string | null, sources: Source[], userPrompt?: string): Promise<any> => {
    if (!API_KEY) return { error: "API Key not configured." };

    const materias = [...new Set(sources.map(s => s.materia))];
    const basePrompt = `
    Você é um especialista em análise financeira e educador, focado no Banco Central do Brasil (BCB). Sua tarefa é criar um estudo de caso interativo e complexo.
    
    ${userPrompt ? `O usuário forneceu um prompt para guiar a criação: "${userPrompt}". Dê prioridade a este foco.` : ''}

    ${text 
        ? `Use o seguinte texto como base para o estudo de caso: --- ${text} ---`
        : `Siga este processo de pesquisa em duas etapas para garantir profundidade e precisão:

1.  **Pesquisa Inicial (Etapa 1):** Usando suas ferramentas de pesquisa, identifique vários eventos ou casos de estudo reais, significativos e bem documentados que envolvem grandes decisões ou intervenções do Banco Central do Brasil (BCB). Considere tópicos como controle de inflação, estabilidade financeira, crises bancárias, ou grandes mudanças regulatórias. Use as matérias a seguir como contexto para esta pesquisa inicial: ${materias.join(', ')}.

2.  **Pesquisa Aprofundada (Etapa 2):** A partir dos resultados da primeira etapa, selecione o caso mais robusto e interessante. Em seguida, realize uma segunda pesquisa, mais aprofundada e focada *exclusivamente* neste caso escolhido. Busque detalhes, cronologias, os principais atores envolvidos, as opções que foram consideradas e os resultados das ações tomadas.

3.  **Criação do Estudo de Caso:** Com base na sua pesquisa aprofundada e no contexto das fontes da plataforma, construa o estudo de caso.`
    }

    Com base na informação, construa o estudo de caso seguindo estas etapas:
    1.  **Análise e Resumo**:
        - Crie um \`title\` conciso e informativo para o caso. Se um nome de caso de estudo for fornecido pelo usuário, use-o como base, mas sinta-se à vontade para refiná-lo para maior clareza.
        - Escreva um \`summary\` breve (2-4 frases) explicando o problema central.
        - Identifique e liste os principais \`key_points\` do caso.
        - Correlacione este caso com a seguinte lista de matérias acadêmicas, retornando as mais relevantes: ${JSON.stringify(materias)}

    2.  **Crie Pontos de Decisão Interativos**:
        - Identifique de 2 a 4 momentos críticos no caso onde o BCB teve que tomar uma decisão significativa. Estes serão seus \`decision_points\`.
        - Para cada ponto de decisão, forneça:
            - \`context\`: Um parágrafo detalhado descrevendo a situação e o desafio enfrentado pelo BCB.
            - \`options\`: Um array com exatamente 3 ações plausíveis e distintas. Uma delas deve ser a ação que o BCB realmente tomou. Para cada opção:
                - \`text\`: Uma descrição clara da ação.
                - \`predicted_outcome\`: Uma previsão realista das consequências prováveis se esta ação fosse tomada.
            - \`actual_bcb_action\`: Uma string que corresponda EXATAMENTE ao texto da opção correta no array \`options\`.
            - \`bcb_action_outcome\`: Uma explicação detalhada do que realmente aconteceu como resultado da decisão real do BCB.

    Retorne tudo em um único objeto JSON que siga estritamente o schema fornecido. Os IDs devem ser UUIDs gerados aleatoriamente.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            correlated_materias: { type: Type.ARRAY, items: { type: Type.STRING } },
            decision_points: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "UUID aleatório" },
                        context: { type: Type.STRING },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING, description: "UUID aleatório" },
                                    text: { type: Type.STRING },
                                    predicted_outcome: { type: Type.STRING },
                                },
                                required: ['id', 'text', 'predicted_outcome']
                            }
                        },
                        actual_bcb_action: { type: Type.STRING },
                        bcb_action_outcome: { type: Type.STRING }
                    },
                    required: ['id', 'context', 'options', 'actual_bcb_action', 'bcb_action_outcome']
                }
            }
        },
        required: ['title', 'summary', 'key_points', 'correlated_materias', 'decision_points']
    };

    try {
        const response: GenerateContentResponse = await getModel().generateContent({
            model: 'gemini-2.5-pro',
            contents: basePrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                ...(text ? {} : { tools: [{googleSearch: {}}] })
            },
        });
        // Fix: Ensure response.text exists before parsing.
        if (!response.text) return { error: "Falha ao gerar o estudo de caso." };
        const result = JSON.parse(response.text);
        // Gemini doesn't generate UUIDs, so let's add them here.
        result.decision_points.forEach((dp: any) => {
            dp.id = crypto.randomUUID();
            dp.options.forEach((opt: any) => opt.id = crypto.randomUUID());
        });
        return result;
    } catch (error) {
        console.error("Error generating case study:", error);
        return { error: "Falha ao gerar o estudo de caso." };
    }
};