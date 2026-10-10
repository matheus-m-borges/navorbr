import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GlassCard, Button } from "@/components/navor-rephub/ui";
import { formatDateTime } from "@/lib/crm";
import { useEffect, useState } from "react";
import { clearAdminErrorLogs, getAdminErrorLogs } from "@/api/admin-actions";
import { toast } from "sonner";
import {
  Activity,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/(saas)/admin/error-logs")({
  head: () => ({
    meta: [{ title: "Logs de Erros | NAVOR" }],
  }),
  component: ErrorLogsPage,
});

function ErrorLogsPage() {
  const [isClearing, setIsClearing] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: () => getAdminErrorLogs(),
    refetchInterval: 15000,
  });

  // Marca os erros como visualizados imediatamente ao carregar a página
  useEffect(() => {
    try {
      localStorage.setItem("admin_last_seen_errors_at", new Date().toISOString());
      window.dispatchEvent(new Event("admin_errors_cleared"));
    } catch {}
  }, [logs]);

  async function handleClearLogs() {
    if (!window.confirm("Deseja marcar todos os erros como resolvidos e limpar a lista de logs?")) {
      return;
    }

    setIsClearing(true);
    try {
      await clearAdminErrorLogs();
      toast.success("Logs de erros limpos com sucesso!");
      localStorage.setItem("admin_last_seen_errors_at", new Date().toISOString());
      window.dispatchEvent(new Event("admin_errors_cleared"));
      await refetch();
    } catch (err: any) {
      toast.error(`Erro ao limpar logs: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  }

  function copyError(log: any) {
    const text = `[${log.created_at}] Ação: ${log.action}\nErro: ${log.description}\nUsuário: ${log.user_name || log.user_id || "N/A"}`;
    navigator.clipboard.writeText(text);
    toast.success("Detalhes do erro copiados!");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="size-6 text-rose-500" />
            <span>Logs de Erros da Plataforma</span>
            {logs && logs.length > 0 ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-semibold">
                {logs.length} {logs.length === 1 ? "registro" : "registros"}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
            Monitoramento em tempo real de falhas e exceções capturadas nos sistemas NAVOR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="text-xs border-slate-200 dark:border-slate-800"
          >
            <RotateCw className={`size-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          {logs && logs.length > 0 ? (
            <Button
              size="sm"
              onClick={handleClearLogs}
              disabled={isClearing}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
            >
              {isClearing ? (
                <>
                  <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                  <span>Limpando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-1.5" />
                  <span>Limpar Logs de Erros</span>
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <GlassCard className="overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="size-4 animate-spin text-blue-600" />
            <span>Carregando logs de erros...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Data / Hora</th>
                  <th className="p-3.5">Origem / Ação</th>
                  <th className="p-3.5">Descrição do Erro</th>
                  <th className="p-3.5">Usuário / Operador</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {logs?.length ? (
                  logs.map((log: any) => (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="p-3.5 font-semibold text-rose-600 dark:text-rose-400">
                        {log.action}
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 max-w-md break-words font-mono text-[11px]">
                        {log.description}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {log.user_name || log.user_id || "Sistema"}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => copyError(log)}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          <Copy className="size-3" /> Copiar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="size-8 text-emerald-500" />
                        <p className="font-bold text-sm text-slate-800 dark:text-white">
                          Nenhum erro registrado no momento!
                        </p>
                        <p className="text-xs text-slate-400">
                          Todos os sistemas estão operando sem falhas reportadas.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

