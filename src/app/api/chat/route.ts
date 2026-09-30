import { streamText, tool, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchMovie, discoverMovies, getImageUrl, searchPersonId, getMovieProviders, getSimilarMovies, getMovieTrailer, getMovieById } from '@/lib/tmdb';

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

    let fallbackQuery = "Filme";
    if (lastMessage) {
      if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
        fallbackQuery = lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text || '').join(' ');
      } else if (lastMessage.content) {
        if (typeof lastMessage.content === 'string') fallbackQuery = lastMessage.content;
        else if (Array.isArray(lastMessage.content)) fallbackQuery = lastMessage.content.map((p: any) => p.text || '').join(' ');
      }
    }

    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      messages: await convertToModelMessages(messages),
      system: `Você é o "CineBot", um assistente de cinema especialista, charmoso e conversacional. Seu papel principal é CONVERSAR com o usuário sobre a sétima arte!
      REGRAS CRÍTICAS DE COMPORTAMENTO:
      1. VOCÊ É UM CHATBOT CONVERSACIONAL: Não responda apenas com listas de filmes. Converse com o usuário, dê sua opinião e fale curiosidades.
      2. LISTAS E RECOMENDAÇÕES: Invoque \`discoverMovies\` ou \`searchMovie\` OBRIGATORIAMENTE.
         - Se o usuário pedir um GÊNERO genérico (ação, comédia) ou ANO, use \`discoverMovies\`.
         - Se o usuário pedir uma FRANQUIA, NOME ESPECÍFICO, ou SAGA (ex: "Naruto", "Batman", "Marvel", "Senhor dos Anéis"), USE OBRIGATORIAMENTE \`searchMovie\` com o nome da franquia no parâmetro 'query'. NUNCA use discoverMovies para franquias.
      3. DISCUTINDO UM FILME ESPECÍFICO: Quando o usuário quiser falar de um filme específico (ex: "fale sobre esse titanic"), INVOQUE OBRIGATORIAMENTE a ferramenta \`getMovieDetails\`. USE EXATAMENTE O NOME OU ID QUE O USUÁRIO PEDIU. NUNCA INVENTE OU TROQUE O NOME DO FILME. Se o usuário clicar em um filme e enviar o ID, passe o ID EXATO para a ferramenta.
      4. FILTROS POR ATOR/ATRIZ: Se o usuário pedir filmes de um ator ou atriz (ex: "filmes com Adam Sandler"), use \`discoverMovies\` com o parâmetro "ator_ou_atriz".
      5. PARÂMETRO COMENTÁRIO: TODAS as ferramentas possuem um parâmetro chamado \`comentario\`. Você DEVE preencher este parâmetro OBRIGATORIAMENTE com um texto conversacional, charmoso, empolgante e rico. Dê sua opinião sobre os filmes, conte uma curiosidade ou faça uma piada leve. NUNCA DEIXE ESTE CAMPO VAZIO OU COM TEXTOS GENÉRICOS!
      DICA DE BUSCA: Para recomendar "os melhores", sempre use sort_by="popularity.desc" e NUNCA "vote_average.desc". Para filmes antigos, use primary_release_date_lte="1999-12-31".
      Responda em português (PT-BR).`,
      tools: {
        searchMovie: tool({
          description: 'Busca um filme específico pelo título na base de dados. OBRIGATÓRIO USAR QUANDO QUISER MOSTRAR UM FILME ESPECÍFICO.',
          parameters: z.object({
            query: z.string().describe('OBRIGATÓRIO. O título do filme para pesquisar. VOCÊ NÃO PODE DEIXAR ISSO VAZIO! (ex: "Naruto")'),
            comentario: z.string().describe('Seu texto conversacional para o usuário apresentando a lista de filmes.')
          }),
          // @ts-ignore - TS incorrectly infers the execute overload in AI SDK v7
          execute: async ({ query, comentario }) => {
            if (!query || query === 'undefined') {
              query = fallbackQuery;
            }
            let movies = await searchMovie(query);
            if (movies.length === 0) {
              return { comentario: comentario || "Não encontrei resultados exatos para isso. Pode tentar outro nome?", results: [] };
            }
            return {
              comentario: comentario || "Aqui estão os filmes que encontrei para você:",
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
            with_genres: z.string().optional().describe('ID NUMÉRICO do gênero. Mapeamento: 28=Ação, 35=Comédia, 27=Terror, 878=Ficção, 10749=Romance, 16=Animação, 53=Suspense, 18=Drama, 12=Aventura, 14=Fantasia.'),
            primary_release_year: z.string().optional().describe('O ano exato de lançamento'),
            primary_release_date_lte: z.string().optional().describe('Filtra para filmes lançados antes ou até esta data (Formato: YYYY-MM-DD). Ex: "1999-12-31" para filmes antigos.'),
            sort_by: z.string().optional().describe('Critério de ordenação. Ex: popularity.desc, vote_average.desc'),
            year: z.string().optional().describe('Alias para primary_release_year'),
            genre: z.string().optional().describe('Alias para with_genres. DEVE SER O ID NUMÉRICO (28, 35, 27, 878, 10749...)'),
            genre_id: z.string().optional().describe('Alias para with_genres. DEVE SER O ID NUMÉRICO!'),
            ator_ou_atriz: z.string().describe('Nome de um ator ou atriz se o usuário pedir (ex: "Adam Sandler"). Se não pedir nenhum ator, envie em branco ("").'),
            comentario: z.string().describe('Seu texto conversacional para o usuário apresentando a lista de filmes.')
          }),
          // @ts-ignore - TS incorrectly infers the execute overload in AI SDK v7
          execute: async (params) => {
            let final_genres = params.with_genres ? params.with_genres : (params.genre ? params.genre : (params.genre_id ? params.genre_id : undefined));
            
            if (final_genres && isNaN(Number(final_genres))) {
              const genreMap: Record<string, string> = {
                'ação': '28', 'acao': '28', 'action': '28',
                'comédia': '35', 'comedia': '35', 'comedy': '35',
                'terror': '27', 'horror': '27',
                'romance': '10749', 
                'ficção': '878', 'ficcao': '878', 'sci-fi': '878', 'science fiction': '878',
                'drama': '18', 
                'suspense': '53', 'thriller': '53',
                'animação': '16', 'animacao': '16', 'animation': '16', 'anime': '16', 'animes': '16',
                'aventura': '12', 'adventure': '12',
                'fantasia': '14', 'fantasy': '14',
                'família': '10751', 'familia': '10751', 'family': '10751',
                'mistério': '9648', 'misterio': '9648', 'mystery': '9648',
                'crime': '80', 
                'documentário': '99', 'documentary': '99', 'documentario': '99',
                'guerra': '10752', 'war': '10752',
                'faroeste': '37', 'western': '37',
                'história': '36', 'historia': '36', 'history': '36',
                'música': '10402', 'musica': '10402', 'music': '10402', 'musical': '10402',
                'tv movie': '10770', 'filme de tv': '10770'
              };
              final_genres = genreMap[final_genres.toLowerCase()] || undefined;
            }

            const today = new Date().toISOString().split('T')[0];
            const tmdbParams: any = {
              with_genres: final_genres,
              primary_release_year: params.primary_release_year ? String(params.primary_release_year) : (params.year ? String(params.year) : undefined),
              primary_release_date_lte: params.primary_release_date_lte ? String(params.primary_release_date_lte) : (params.primary_release_year ? undefined : today),
              release_date_lte: today, // Força dupla contra filmes não lançados
              sort_by: params.sort_by ? String(params.sort_by) : 'popularity.desc'
            };
            
            const castName = params.ator_ou_atriz || params.cast_name;
            if (castName && castName !== 'undefined') {
              const personId = await searchPersonId(castName);
              if (personId) {
                tmdbParams.with_cast = personId;
              }
            }

            const movies = await discoverMovies(tmdbParams);
            return {
              comentario: params.comentario || "Separei algumas recomendações para você dar uma olhada:",
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
            query: z.string().describe('OBRIGATÓRIO. O título exato do filme ou o ID Numérico (ex: "Titanic", "12345"). NÃO DEIXE VAZIO.'),
            comentario: z.string().describe('Sua resposta conversacional para o usuário (opinando, resumindo e falando sobre o filme)')
          }),
          // @ts-ignore
          execute: async ({ query, comentario }) => {
            let m: any = null;
            if (!query || query === 'undefined') {
              query = fallbackQuery;
            }

            // FORÇA BRUTA: Se o último texto do usuário foi o clique no botão, nós garantimos que o ID correto seja usado, ignorando qualquer alucinação da IA.
            const matchId = fallbackQuery.match(/Fale sobre o filme com ID (\d+)/);
            if (matchId && matchId[1]) {
              query = matchId[1]; // Força a busca por ID
            }
            
            if (/^\d+$/.test(query.trim())) {
              m = await getMovieById(Number(query.trim()));
            } else {
              const movies = await searchMovie(query);
              m = movies[0];
            }
            
            if (!m) return { comentario: comentario || "Não achei esse filme no banco de dados.", error: "Filme não encontrado" };
            
            const [providers, similar, trailer] = await Promise.all([
              getMovieProviders(m.id),
              getSimilarMovies(m.id),
              getMovieTrailer(m.id)
            ]);

            return {
              ...m,
              comentario: comentario || "Aqui estão os detalhes desse filme:",
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
    console.error("API ROUTE ERROR:", error.stack || error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
