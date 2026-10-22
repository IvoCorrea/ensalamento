"use client";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 p-6 lg:p-10 max-w-3xl mx-auto w-full flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 lg:p-8 space-y-4 w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-extrabold uppercase">
          Erro de Conexão / Servidor
        </div>
        <h1 className="text-xl font-black text-slate-900">
          Não foi possível carregar os dados do banco de dados
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          Verifique se a variável de ambiente <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-800">DATABASE_URL</code> está configurada nas <strong>Environment Variables</strong> do seu projeto na Vercel e faça um <strong>Redeploy</strong>.
        </p>

        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto space-y-1">
          <div className="text-red-400 font-bold">
            Mensagem: {error.message || "Erro interno na renderização SSR"}
          </div>
          {error.digest && (
            <div className="text-slate-400">Digest ID: {error.digest}</div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    </main>
  );
}
