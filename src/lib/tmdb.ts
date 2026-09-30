const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface Movie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
}

interface TMDBResponse {
  results: Movie[];
}

export async function searchMovie(query: string): Promise<Movie[]> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) throw new Error("TMDB_API_KEY is not defined");
  
  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.append('query', query);
  url.searchParams.append('language', 'pt-BR');
  
  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`
    }
  });

  if (!response.ok) {
    // Fallback caso a chave fornecida seja a v3 (API key) e não a v4 (Bearer token)
    const urlV3 = new URL(`${TMDB_BASE_URL}/search/movie`);
    urlV3.searchParams.append('query', query);
    urlV3.searchParams.append('language', 'pt-BR');
    urlV3.searchParams.append('api_key', API_KEY);
    
    const responseV3 = await fetch(urlV3.toString(), {
      headers: { accept: 'application/json' }
    });
    
    if (!responseV3.ok) throw new Error('Failed to fetch from TMDB');
    const dataV3 = await responseV3.json() as TMDBResponse;
    return dataV3.results.slice(0, 5);
  }

  const data = await response.json() as TMDBResponse;
  return data.results.slice(0, 5);
}

export async function searchPersonId(name: string): Promise<string | null> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) return null;
  const url = new URL(`${TMDB_BASE_URL}/search/person`);
  url.searchParams.append('query', name);
  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json', Authorization: `Bearer ${API_KEY}` }
  });
  if (!res.ok) {
    const urlV3 = new URL(url.toString());
    urlV3.searchParams.append('api_key', API_KEY);
    const resV3 = await fetch(urlV3.toString(), { headers: { accept: 'application/json' }});
    if (!resV3.ok) return null;
    const dataV3 = await resV3.json();
    return dataV3.results?.[0]?.id?.toString() || null;
  }
  const data = await res.json();
  return data.results?.[0]?.id?.toString() || null;
}

export async function discoverMovies(params: {
  with_genres?: string;
  primary_release_year?: string;
  primary_release_date_lte?: string;
  sort_by?: string;
  with_cast?: string;
}): Promise<Movie[]> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) throw new Error("TMDB_API_KEY is not defined");

  const url = new URL(`${TMDB_BASE_URL}/discover/movie`);
  url.searchParams.append('language', 'pt-BR');
  
  if (params.with_genres) url.searchParams.append('with_genres', params.with_genres);
  if (params.primary_release_year) url.searchParams.append('primary_release_year', params.primary_release_year);
  if (params.primary_release_date_lte) url.searchParams.append('primary_release_date.lte', params.primary_release_date_lte);
  if (params.sort_by) url.searchParams.append('sort_by', params.sort_by);
  if (params.with_cast) url.searchParams.append('with_cast', params.with_cast);
  
  // Garantir que os filmes recomendados sejam realmente famosos/conhecidos
  url.searchParams.append('vote_count.gte', '1500');

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`
    }
  });

  if (!response.ok) {
    // Fallback caso a chave seja v3
    const urlV3 = new URL(url.toString());
    urlV3.searchParams.append('api_key', API_KEY);
    const responseV3 = await fetch(urlV3.toString(), {
      headers: { accept: 'application/json' }
    });
    if (!responseV3.ok) throw new Error('Failed to fetch from TMDB');
    const dataV3 = await responseV3.json() as TMDBResponse;
    return dataV3.results.slice(0, 5);
  }

  const data = await response.json() as TMDBResponse;
  return data.results.slice(0, 5);
}

export function getImageUrl(path: string | null, size: 'w500' | 'original' = 'w500') {
  if (!path) return 'https://via.placeholder.com/500x750?text=Sem+Poster';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export async function getMovieProviders(movieId: number): Promise<WatchProvider[]> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) return [];
  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}/watch/providers`);
  url.searchParams.append('api_key', API_KEY);
  try {
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' }});
    if (!res.ok) return [];
    const data = await res.json();
    const brData = data.results?.BR;
    if (!brData) return [];
    
    const providersMap = new Map<number, WatchProvider>();
    const addProviders = (list: any[]) => {
      if (!list) return;
      list.forEach(p => providersMap.set(p.provider_id, {
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_path: p.logo_path
      }));
    };
    
    addProviders(brData.flatrate);
    addProviders(brData.rent);
    addProviders(brData.buy);
    
    return Array.from(providersMap.values());
  } catch(e) { return []; }
}

export async function getSimilarMovies(movieId: number): Promise<Movie[]> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) return [];
  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}/similar`);
  url.searchParams.append('language', 'pt-BR');
  url.searchParams.append('api_key', API_KEY);
  try {
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' }});
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 4);
  } catch(e) { return []; }
}

export async function getMovieTrailer(movieId: number): Promise<string | null> {
  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) return null;
  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}/videos`);
  url.searchParams.append('language', 'pt-BR');
  url.searchParams.append('api_key', API_KEY);
  try {
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' }});
    if (!res.ok) return null;
    const data = await res.json();
    let trailers = data.results.filter((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    if (trailers.length === 0) {
      url.searchParams.set('language', 'en-US');
      const resEn = await fetch(url.toString(), { headers: { accept: 'application/json' }});
      const dataEn = await resEn.json();
      trailers = (dataEn.results || []).filter((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    }
    return trailers.length > 0 ? trailers[0].key : null;
  } catch(e) { return null; }
}
