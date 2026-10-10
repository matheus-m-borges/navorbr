import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getArticles = createServerFn({ method: "GET" }).handler(async () => {
  const { listPublishedArticles } = await import("@/lib/support/support-service.server");
  return listPublishedArticles();
});

export const Route = createFileRoute("/_authenticated/(saas)/suporte/kb/")({
  loader: () => getArticles(),
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const articles = Route.useLoaderData();
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/_authenticated/(saas)/suporte" className="text-sm text-slate-400 hover:text-emerald-400">← Voltar</Link>
        <h1 className="text-2xl font-bold text-slate-100">Base de Conhecimento</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a: any) => (
          <Link
            key={a.id}
            to="/_authenticated/(saas)/suporte/kb/$slug"
            params={{ slug: a.slug }}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-emerald-500/50 transition-colors"
          >
            <h3 className="mb-2 text-lg font-semibold text-emerald-400">{a.title}</h3>
            <p className="text-sm text-slate-400 line-clamp-2">{a.content?.slice(0, 120)}...</p>
            <div className="mt-3 flex gap-2">
              {a.tags?.map((tag: string) => (
                <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{tag}</span>
              ))}
            </div>
          </Link>
        ))}
        {articles.length === 0 && (
          <p className="col-span-3 text-center text-slate-500">Nenhum artigo publicado.</p>
        )}
      </div>
    </div>
  );
}
