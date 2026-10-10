import { createFileRoute } from "@tanstack/react-router";
import { launchLawHubSso } from "@/lib/lawhub-sso";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/(navor-lawhub)/lawhub/$")({
  ssr: false,
  component: LawHubSplatRedirect,
});

function LawHubSplatRedirect() {
  const { _splat } = Route.useParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawPath = _splat ? `/lawhub/${_splat.replace(/^\/+/, "")}` : "/lawhub/dashboard";
  const safePath = /^\/lawhub(\/[a-zA-Z0-9_\-\$/]+)*$/.test(rawPath) ? rawPath : "/lawhub/dashboard";

  async function attemptSso() {
    setStatus("loading");
    setErrorMessage(null);

    const result = await launchLawHubSso(safePath);
    if (!result.success) {
      if (result.requiresAccountSelection) {
        window.location.assign("/acesso-bloqueado?status=account_selection&produto=lawhub");
        return;
      }
      if (result.error === "SUBSCRIPTION_INACTIVE" || result.error === "ACCESS_DENIED") {
        window.location.assign("/acesso-bloqueado?produto=lawhub");
        return;
      }
      setStatus("error");
      setErrorMessage(result.message || "Não foi possível conectar ao LawHub.");
    }
  }

  useEffect(() => {
    void attemptSso();
  }, [_splat]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl text-center space-y-4">
          <div className="size-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-semibold text-white">Falha ao Conectar ao LawHub</h2>
          <p className="text-sm text-slate-300">{errorMessage}</p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => void attemptSso()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              Tentar Novamente
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition inline-block"
            >
              Voltar ao Início
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans">
      <div className="text-center space-y-3">
        <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-300 font-medium">Redirecionando para Navor LawHub...</p>
      </div>
    </div>
  );
}
