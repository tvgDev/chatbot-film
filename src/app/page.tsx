'use client';

import { useChat } from '@ai-sdk/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Film, Sparkles, Loader2, PlayCircle, Star, X, Search, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Movie } from '@/lib/tmdb';

export default function Chatbot() {
  const { messages, status, sendMessage, error } = useChat({
    onError: (err) => {
      console.error("Erro no chat:", err);
    }
  });

  const [input, setInput] = useState('');
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }]
    });
    setInput('');
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[100dvh] bg-black selection:bg-rose-500/30">
      {/* Cinematic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/90 to-transparent pt-6 pb-12 px-8 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase drop-shadow-md">
            Cine<span className="text-rose-600">Match</span>
          </h1>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-24 pb-32 px-4 md:px-8 scrollbar-hide">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {messages.length === 0 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
              {/* Grid Background */}
              <div 
                className="absolute inset-0 z-0 opacity-[0.05] flex flex-col gap-4 justify-center items-start scale-110 overflow-hidden" 
                style={{ WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)', maskImage: 'radial-gradient(circle, black 30%, transparent 70%)' }}
              >
                {[
                  { direction: "-50%", duration: 240, offset: 0 },
                  { direction: "50%", duration: 260, offset: 3 },
                  { direction: "-50%", duration: 220, offset: 7 },
                  { direction: "50%", duration: 280, offset: 2 },
                  { direction: "-50%", duration: 250, offset: 9 }
                ].map((row, i) => {
                  const basePosters = [
                    '/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg', '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', '/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg', '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg',
                    '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg', '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg', '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg', '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
                    '/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg', '/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg', '/jFTVD4XoWQTcg7wdyJKa8PEds5q.jpg', '/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg'
                  ];
                  
                  // Cortamos o array a partir do 'offset' e colamos o começo no final
                  // Isso cria uma versão "rotacionada" do array para que as imagens nunca alinhem verticalmente entre as linhas
                  const shiftedPosters = [...basePosters.slice(row.offset), ...basePosters.slice(0, row.offset)];

                  return (
                    <motion.div 
                      key={i}
                      className="flex gap-4 w-max"
                      initial={{ x: row.direction === "-50%" ? "0%" : "-50%" }}
                      animate={{ x: row.direction === "-50%" ? "-50%" : "0%" }}
                      transition={{ repeat: Infinity, ease: "linear", duration: row.duration }}
                    >
                      {Array(8).fill(shiftedPosters).flat().map((img, j) => (
                        <img 
                          key={j} 
                          src={`https://image.tmdb.org/t/p/w200${img}`} 
                          className="w-24 md:w-32 lg:w-40 rounded-lg shadow-2xl object-cover aspect-[2/3]" 
                          alt="" 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ))}
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Content */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="z-10 flex flex-col items-center justify-center text-center mt-[-10vh]"
              >
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-600 tracking-tighter drop-shadow-2xl mb-4">
                  Cine<span className="text-rose-600">Match</span>
                </h2>
                <p className="text-zinc-400 max-w-sm md:max-w-md text-sm md:text-base font-medium leading-relaxed drop-shadow-md">
                  Descreva o que você quer assistir hoje e nós faremos a mágica para encontrar a obra perfeita.
                </p>
              </motion.div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`w-full ${m.role === 'user'
                  ? 'flex justify-end'
                  : 'flex justify-start'
                  }`}>
                  <div className={`${m.role === 'user'
                    ? 'bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full text-[15px] font-medium border border-white/5'
                    : 'w-full text-zinc-300'
                    }`}>


                    {m.parts?.map((part, index) => {
                      if (part.type === 'text') {
                        return (
                          <div key={index} className="prose prose-invert max-w-none text-[15px] leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown>
                              {m.role === 'user' 
                                ? part.text.replace(/Fale sobre o filme com ID \d+ \((.*?)\)/, 'Fale sobre o filme "$1"') 
                                : part.text}
                            </ReactMarkdown>
                          </div>
                        );
                      }

                      if (part.type === 'tool-searchMovie' || part.type === 'tool-discoverMovies' || part.type === 'tool-getMovieDetails' || part.type === 'dynamic-tool') {
                        // @ts-ignore - lidar com tipagem de invocação de ferramentas no SDK 7
                        const toolInvocation = part.toolInvocation || part;
                        const toolCallId = toolInvocation.toolCallId;

                        if (toolInvocation.state === 'result' || toolInvocation.state === 'output-available') {
                          if (toolInvocation.toolName === 'getMovieDetails' || part.type === 'tool-getMovieDetails') {
                            let movie = toolInvocation.result || toolInvocation.output;
                            if (typeof movie === 'string') {
                              try { movie = JSON.parse(movie); } catch (e) { }
                            }

                            if (!movie) return <div key={toolCallId} className="mt-3 text-sm text-zinc-400 italic">Buscando detalhes do filme...</div>;

                            if (movie.error) {
                              return (
                                <div key={toolCallId} className="mt-4 flex flex-col gap-3">
                                  <div className="prose prose-invert max-w-none text-[15px] leading-relaxed whitespace-pre-wrap">
                                    <ReactMarkdown>{movie.comentario?.replace(/\\n/g, '\n')}</ReactMarkdown>
                                  </div>
                                  <div className="text-sm text-zinc-400 italic">Filme não encontrado no banco de dados para exibir a imagem.</div>
                                </div>
                              );
                            }

                            return (
                              <div key={toolCallId} className="mt-8 flex flex-col gap-6">
                                {movie.comentario && (
                                  <div className="prose prose-invert max-w-none text-lg text-zinc-200 leading-relaxed whitespace-pre-wrap">
                                    <ReactMarkdown>{movie.comentario.replace(/\\n/g, '\n')}</ReactMarkdown>
                                  </div>
                                )}

                                <div className="flex flex-col gap-4 bg-gradient-to-br from-zinc-900/80 to-black/80 p-6 rounded-2xl border border-white/5 max-w-3xl shadow-2xl">
                                  <div className="flex flex-col sm:flex-row gap-6">
                                    <img src={movie.poster_url} className="w-40 h-60 object-cover rounded-xl shadow-2xl" alt={movie.title} />
                                    <div className="flex flex-col flex-1">
                                      <h3 className="text-xl font-bold text-rose-400">{movie.title} <span className="text-zinc-400 text-base font-normal">({movie.release_date?.split('-')[0] || 'N/A'})</span></h3>
                                      <div className="flex gap-4 items-center mt-1 mb-3">
                                        <div className="flex gap-1.5 items-center bg-black/40 px-2 py-1 rounded-md border border-white/5">
                                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                          <span className="text-sm font-semibold">{movie.vote_average?.toFixed(1) || '0.0'}</span>
                                        </div>
                                        {movie.trailer_url && (
                                          <button 
                                            onClick={() => setTrailerUrl(movie.trailer_url)}
                                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-rose-600/80 hover:bg-rose-500 px-3 py-1.5 rounded-md transition-colors"
                                          >
                                            <PlayCircle className="w-4 h-4" /> Trailer
                                          </button>
                                        )}
                                      </div>
                                      
                                      <div className="relative">
                                        <p 
                                          className="text-sm text-zinc-300 leading-relaxed overflow-y-auto max-h-32 pr-2 scrollbar-hide pb-4"
                                          style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
                                        >
                                          {movie.overview || 'Sinopse indisponível.'}
                                        </p>
                                      </div>

                                      {/* Streaming Providers */}
                                      {movie.providers && movie.providers.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                          <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wider">Onde assistir (Brasil)</p>
                                          <div className="flex flex-wrap gap-2">
                                            {movie.providers.map((p: any) => (
                                              <div key={p.provider_id} className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-md border border-white/5" title={p.provider_name}>
                                                <img src={p.logo_url} alt={p.provider_name} className="w-4 h-4 rounded-sm" />
                                                <span className="text-[10px] font-medium text-zinc-300">{p.provider_name}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Similar Movies */}
                                  {movie.similar && movie.similar.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-zinc-400 mb-3 font-medium uppercase tracking-wider">Filmes Similares</p>
                                      <div className="grid grid-cols-4 gap-3">
                                        {movie.similar.map((s: any) => (
                                          <div 
                                            key={s.id} 
                                            className="flex flex-col gap-1.5 group cursor-pointer" 
                                            title={s.title}
                                            onClick={() => {
                                              const text = `Fale sobre o filme com ID ${s.id} (${s.title})`;
                                              sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
                                            }}
                                          >
                                            <div className="overflow-hidden rounded-lg">
                                              <img src={s.poster_url} alt={s.title} className="w-full aspect-[2/3] object-cover group-hover:scale-110 group-hover:brightness-110 transition-all duration-500" />
                                            </div>
                                            <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight group-hover:text-rose-400 transition-colors">{s.title}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          let resultObj = toolInvocation.result || toolInvocation.output;
                          if (typeof resultObj === 'string') {
                            try {
                              resultObj = JSON.parse(resultObj);
                            } catch (e) {
                              console.error('Failed to parse resultObj', e);
                            }
                          }

                          const movies = Array.isArray(resultObj) ? resultObj : (resultObj?.results || []);
                          const comentario = !Array.isArray(resultObj) && resultObj?.comentario ? resultObj.comentario.replace(/\\n/g, '\n') : null;

                          if (!movies || movies.length === 0) {
                            return (
                              <div key={toolCallId} className="mt-8 flex flex-col gap-4">
                                {comentario && (
                                  <div className="prose prose-invert max-w-none text-lg text-zinc-200 leading-relaxed whitespace-pre-wrap mb-2">
                                    <ReactMarkdown>{comentario}</ReactMarkdown>
                                  </div>
                                )}
                                <div className="text-sm text-zinc-500 italic">Nenhum filme encontrado. Debug info:</div>
                                <pre className="text-xs text-red-400 bg-red-950/50 p-4 rounded-lg overflow-x-auto max-w-full">
                                  {JSON.stringify(toolInvocation, null, 2)}
                                </pre>
                              </div>
                            );
                          }

                          return (
                            <div key={toolCallId} className="mt-8 flex flex-col gap-4">
                              {comentario && (
                                <div className="prose prose-invert max-w-none text-lg text-zinc-200 leading-relaxed whitespace-pre-wrap mb-2">
                                  <ReactMarkdown>{comentario}</ReactMarkdown>
                                </div>
                              )}
                              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-hide snap-x">
                                {movies.map((movie: any) => (
                                  <motion.div
                                    key={movie.id}
                                    whileHover={{ y: -5, scale: 1.02 }}
                                    className="snap-start shrink-0 w-36 md:w-44 flex flex-col gap-2 group cursor-pointer"
                                    onClick={() => {
                                      const text = `Fale sobre o filme com ID ${movie.id} (${movie.title})`;
                                      sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
                                    }}
                                  >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-xl">
                                      {movie.poster_url ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={movie.poster_url}
                                          alt={movie.title}
                                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-zinc-800/80 flex items-center justify-center p-4 text-center text-zinc-500 text-xs border border-zinc-700/50">
                                          {movie.title}
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                        <PlayCircle className="text-white w-10 h-10 drop-shadow-md" />
                                      </div>
                                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs font-bold rounded-md flex items-center gap-1 backdrop-blur-md">
                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        {movie.vote_average.toFixed(1)}
                                      </div>
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-rose-400 transition-colors" title={movie.title}>{movie.title}</h3>
                                      <p className="text-xs text-zinc-500">{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={toolCallId} className="mt-3 flex items-center gap-2 text-zinc-400 text-sm italic">

                              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              <span className="animate-pulse">Buscando no acervo do TMDB...</span>
                            </div>
                          );
                        }
                      }

                      return null;
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {error && (
            <div className="flex w-full justify-center mt-4">
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-2xl max-w-[90%] md:max-w-[85%] text-sm flex flex-col items-center text-center gap-2">
                <span className="font-semibold">Ocorreu um erro na requisição.</span>
                <span className="text-xs opacity-80">
                  {(() => {
                    try {
                      const parsed = JSON.parse(error.message);
                      return parsed.error || error.message;
                    } catch {
                      return error.message || 'Erro desconhecido ao tentar contato com o servidor.';
                    }
                  })()}
                </span>
                <button onClick={() => window.location.reload()} className="mt-2 text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-full transition-colors">
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Trailer Modal */}
      <AnimatePresence>
        {trailerUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setTrailerUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setTrailerUrl(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <iframe 
                src={trailerUrl} 
                className="w-full h-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              ></iframe>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pb-8 pt-24 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shadow-rose-900/20 focus-within:border-rose-500/50 focus-within:shadow-rose-900/40 transition-all duration-300 overflow-hidden"
          >
            <div className="pl-6 text-zinc-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={input || ''}
              onChange={(e) => setInput(e.target.value)}
              placeholder="O que você quer assistir hoje? (Ex: Filmes de ação dos anos 90...)"
              className="w-full bg-transparent text-white px-4 py-5 outline-none placeholder:text-zinc-500 text-[15px]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input?.trim()}
              className="mr-2 p-3 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 transition-colors text-white flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
          <p className="text-center text-[10px] uppercase tracking-widest text-zinc-600 mt-4 font-semibold">
            Created by Thiago Guimarães
          </p>
        </div>
      </div>
    </div>
  );
}
