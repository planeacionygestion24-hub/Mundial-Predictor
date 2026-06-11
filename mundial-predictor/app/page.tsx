export const runtime = 'nodejs';

import Link from "next/link";
import { db } from "../lib/db/client";
import { matches } from "../lib/db/schema";
import { desc } from "drizzle-orm";

export default async function Home() {
  // Traemos los partidos desde la base de datos Postgres de Vercel
  const allMatches = await db.select().from(matches).orderBy(desc(matches.date));

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 bg-gradient-to-b from-blue-900 to-indigo-950 text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex flex-col">
        
        {/* Encabezado */}
        <header className="text-center my-8">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            🏆 Predictor Mundialista
          </h1>
          <p className="mt-2 text-lg text-blue-200">
            Guarda tus pronósticos y compite con tus amigos
          </p>
        </header>

        {/* Lista de Partidos */}
        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/10">
          <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2 flex justify-between items-center">
            <span>⚽ Próximos Partidos</span>
            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">En vivo</span>
          </h2>

          {allMatches.length === 0 ? (
            <div className="text-center py-8 text-blue-200">
              <p>No hay partidos registrados en la base de datos todavía.</p>
              <p className="text-xs mt-2 opacity-60">Usa el panel de administración para añadir partidos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allMatches.map((match) => (
                <div 
                  key={match.id} 
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <div className="flex-1 text-right font-semibold pr-4">{match.homeTeam}</div>
                  <div className="px-4 py-1 bg-blue-600 rounded-lg font-bold text-center min-w-[60px]">
                    VS
                  </div>
                  <div className="flex-1 text-left font-semibold pl-4">{match.awayTeam}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botonera de Navegación */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-2xl justify-center">
          <Link 
            href="/predicciones" 
            className="flex-1 text-center bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-bold py-3 px-6 rounded-xl shadow-lg transform active:scale-95 transition-all"
          >
            🎯 Mis Predicciones
          </Link>
          <Link 
            href="/admin" 
            className="text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl border border-white/10 transition-all text-sm flex items-center justify-center"
          >
            ⚙️ Panel Admin
          </Link>
        </div>

      </div>
    </main>
  );
}
