import { streamText, tool, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchMovie, discoverMovies, getImageUrl, searchPersonId, getMovieProviders, getSimilarMovies, getMovieTrailer } from '@/lib/tmdb';

export const maxDuration = 30;

// Rate limit em memória (simples para proteção básica)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT_COUNT = 10; // Limite de requisições
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Baseado no IP
    const ip = req.headers.get('x-forwarded-for') || 'anonymous_ip';
    const now = Date.now();
    const rateInfo = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    
    if (now > rateInfo.resetTime) {
      rateInfo.count = 1;
      rateInfo.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      rateInfo.count++;
      if (rateInfo.count > RATE_LIMIT_COUNT) {
        return new Response(JSON.stringify({ error: 'Muitas requisições. Por favor, aguarde um minuto antes de enviar novas mensagens.' }), { 
          status: 429, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }
    rateLimitMap.set(ip, rateInfo);

    // 2. Validação do Payload e Prevenção de Exaustão de Tokens
    const body = await req.json();
    if (!body || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'Formato de requisição inválido.' }), { status: 400 });
    }

    const { messages } = body;
    
    // Evita que mandem textos de 100 mil caracteres para torrar sua conta do Gemini
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.content) {
      // Se for string simples
      if (typeof lastMessage.content === 'string' && lastMessage.content.length > 1000) {
        return new Response(JSON.stringify({ error: 'A mensagem excede o limite máximo de 1000 caracteres.' }), { status: 413 });
      }
      // Se for Array (parts)
      if (Array.isArray(lastMessage.content)) {
        const textParts = lastMessage.content.map((p: any) => p.text || '').join('');
        if (textParts.length > 1000) {
          return new Response(JSON.stringify({ error: 'A mensagem excede o limite máximo de 1000 caracteres.' }), { status: 413 });
        }
      }
    }

    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      system: `Você é o "CineBot", um assistente de cinema especialista, charmoso e conversacional. Seu papel principal é CONVERSAR com o usuário sobre a sétima arte!
      REGRAS CRÍTICAS DE COMPORTAMENTO:
      1. VOCÊ É UM CHATBOT CONVERSACIONAL: Não responda apenas com listas de filmes. Converse com o usuário, dê sua opinião e fale curiosidades.
      2. LISTAS E RECOMENDAÇÕES: SEMPRE invoque \`discoverMovies\` ou \`searchMovie\` quando o usuário pedir "me recomende", "liste", ou "busque" filmes. NUNCA faça listas em texto. OBRIGATORIAMENTE preencha o parâmetro 'comentario' das ferramentas com o seu texto conversacional (apresentando a lista, dando opiniões)!
      3. DISCUTINDO UM FILME ESPECÍFICO: Quando o usuário quiser falar de um filme específico (ex: "fale sobre esse titanic"), INVOQUE OBRIGATORIAMENTE a ferramenta \`getMovieDetails\`. PREENCHA OBRIGATORIAMENTE os dois parâmetros da ferramenta: 'query' (com o nome do filme) e 'comentario' (com toda a sua resposta e conversa, resumos, opiniões). NUNCA mande texto solto fora do parâmetro "comentario"!
      4. FILTROS POR ATOR/ATRIZ: Se o usuário pedir filmes de um ator ou atriz específico (ex: "filmes com Adam Sandler"), PREENCHA OBRIGATORIAMENTE o parâmetro "ator_ou_atriz" da ferramenta discoverMovies.
      DICA DE BUSCA: Para recomendar "os melhores", sempre use sort_by="popularity.desc" e NUNCA "vote_average.desc". Para filmes antigos, use primary_release_date_lte="1999-12-31".
      Responda em português (PT-BR).`,
      messages: await convertToModelMessages(messages),
      tools: {
        searchMovie: tool({
          description: 'Busca um filme específico pelo título na base de dados.',
          parameters: z.object({
            query: z.string().describe('O título do filme para pesquisar'),
            comentario: z.string().describe('Seu texto conversacional para o usuário apresentando a lista de filmes.')
          }),
          // @ts-ignore - TS incorrectly infers the execute overload in AI SDK v7
          execute: async ({ query, comentario }) => {
            const movies = await searchMovie(query);
            return {
              comentario,
              results: movies.map(m => ({
                ...m,
                poster_url: getImageUrl(m.poster_path)
              }))
            };
          },
        }),
        discoverMovies: tool({
          description: 'Busca recomendações de filmes baseadas em gênero, ano ou popularidade.',
          parameters: z.object({
            with_genres: z.string().optional().describe('ID NUMÉRICO do gênero (ex: "28" para Ação, "35" para Comédia)'),
            primary_release_year: z.string().optional().describe('O ano exato de lançamento'),
            primary_release_date_lte: z.string().optional().describe('Filtra para filmes lançados antes ou até esta data (Formato: YYYY-MM-DD). Ex: "1999-12-31" para filmes antigos.'),
            sort_by: z.string().optional().describe('Critério de ordenação. Ex: popularity.desc, vote_average.desc'),
            year: z.string().optional().describe('Alias para primary_release_year'),
            genre: z.string().optional().describe('Alias para with_genres. DEVE SER O ID NUMÉRICO DO GÊNERO, NÃO O NOME! (ex: "35")'),
            genre_id: z.string().optional().describe('Alias para with_genres. DEVE SER O ID NUMÉRICO!'),
            ator_ou_atriz: z.string().describe('Nome de um ator ou atriz se o usuário pedir (ex: "Adam Sandler"). Se não pedir nenhum ator, envie em branco ("").'),
            comentario: z.string().describe('Seu texto conversacional para o usuário apresentando a lista de filmes.')
          }),
          // @ts-ignore - TS incorrectly infers the execute overload in AI SDK v7
          execute: async (params) => {
            let final_genres = params.with_genres ? params.with_genres : (params.genre ? params.genre : (params.genre_id ? params.genre_id : undefined));
            
            if (final_genres && isNaN(Number(final_genres))) {
              const genreMap: Record<string, string> = {
                'ação': '28', 'acao': '28', 'comédia': '35', 'comedia': '35',
                'terror': '27', 'romance': '10749', 'ficção': '878', 'ficcao': '878',
                'drama': '18', 'suspense': '53', 'animação': '16', 'animacao': '16',
                'aventura': '12', 'fantasia': '14', 'família': '10751', 'familia': '10751',
                'mistério': '9648', 'misterio': '9648', 'crime': '80', 'documentário': '99'
              };
              final_genres = genreMap[final_genres.toLowerCase()] || undefined;
            }

            const tmdbParams: any = {
              with_genres: final_genres,
              primary_release_year: params.primary_release_year ? String(params.primary_release_year) : (params.year ? String(params.year) : undefined),
              primary_release_date_lte: params.primary_release_date_lte ? String(params.primary_release_date_lte) : undefined,
              sort_by: params.sort_by ? String(params.sort_by) : undefined
            };
            
            const castName = params.ator_ou_atriz || params.cast_name;
            if (castName) {
              const personId = await searchPersonId(castName);
              if (personId) {
                tmdbParams.with_cast = personId;
              }
            }

            const movies = await discoverMovies(tmdbParams);
            return {
              comentario: params.comentario,
              results: movies.map(m => ({
                ...m,
                poster_url: getImageUrl(m.poster_path)
              }))
            };
          },
        }),
        getMovieDetails: tool({
          description: 'Busca os detalhes ricos e a imagem de UM filme específico para ser exibido em destaque no chat.',
          parameters: z.object({
            query: z.string().describe('O título exato do filme (ex: "Titanic", "Obsessão")'),
            comentario: z.string().describe('Sua resposta conversacional para o usuário (opinando, resumindo e falando sobre o filme)'),
          }),
          // @ts-ignore
          execute: async ({ query, comentario }) => {
            const movies = await searchMovie(query);
            const m = movies[0];
            if (!m) return { error: "Filme não encontrado", comentario };
            
            const [providers, similar, trailer] = await Promise.all([
              getMovieProviders(m.id),
              getSimilarMovies(m.id),
              getMovieTrailer(m.id)
            ]);

            return {
              ...m,
              comentario,
              poster_url: getImageUrl(m.poster_path),
              trailer_url: trailer ? `https://www.youtube.com/embed/${trailer}?autoplay=1` : null,
              providers: providers.map(p => ({
                ...p,
                logo_url: getImageUrl(p.logo_path, 'w500') // using w500 to guarantee quality, TMDB uses original/w200 for logos too
              })),
              similar: similar.map(s => ({
                id: s.id,
                title: s.title,
                poster_url: getImageUrl(s.poster_path)
              }))
            };
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("API ROUTE ERROR:", error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
