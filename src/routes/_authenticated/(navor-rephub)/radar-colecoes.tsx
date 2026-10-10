import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { Chip, GhostButton } from "@/components/navor-rephub/ui";
import { TableShell, Tr, Td } from "@/components/navor-rephub/repui";
import { useRadarColecoes, RadarAlert, RadarPriority } from "@/hooks/useRadar";
import { supabase } from "@/integrations/supabase/client";
import { crmDb } from "@/hooks/useCrm";
import { toast } from "sonner";
import { FilePlus, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/radar-colecoes")({
  head: () => ({
    meta: [{ title: "Radar de Coleções Atuais" }],
  }),
  component: RadarColecoes,
});

function getPriorityColor(priority: RadarPriority) {
  switch (priority) {
    case "Atenção": return "amber";
    case "Follow-up Necessário": return "amber";
    case "Urgente": return "rose";
    case "Crítico": return "rose";
    case "Coleção Perdida": return "muted";
    default: return "muted";
  }
}

function getPriorityIcon(priority: RadarPriority) {
  switch (priority) {
    case "Atenção": return "🟡";
    case "Follow-up Necessário": return "🟠";
    case "Urgente": return "🔴";
    case "Crítico": return "🔴";
    case "Coleção Perdida": return "❌";
    default: return "⚠️";
  }
}

function RadarColecoes() {
  const alerts = useRadarColecoes();
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = alerts.filter(a => {
     if (filterStatus !== "all" && a.status !== filterStatus) return false;
     if (filterPriority !== "all" && a.priority !== filterPriority) return false;
     if (search && !a.client_name.toLowerCase().includes(search.toLowerCase()) && !a.collection_name.toLowerCase().includes(search.toLowerCase())) return false;
     return true;
  });

  const handleCreateFollowup = async (alert: RadarAlert) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Follow-up para amanhã

    const { error } = await crmDb.from("tasks").insert({
      title: `Follow-up: Cliente sem pedido na coleção ${alert.collection_name}`,
      client_id: alert.client_id,
      task_type: "Ligação",
      priority: "Alta",
      due_at: dueDate.toISOString(),
      description: `Motivo: Cliente ${alert.client_name} ainda não realizou pedido na coleção atual. Coleção ativa há ${alert.days_active} dias.`,
      owner_id: userData.user.id,
      created_by: userData.user.id
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Follow-up criado com sucesso!");
      void navigate({ to: "/tarefas" });
    }
  };

  return (
    <AppShell title="Radar de Coleções" subtitle="Monitoramento automático de clientes sem pedido nas coleções abertas.">
       <div className="space-y-6">
          
          <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
             <div className="flex-1 min-w-[250px]">
                <input
                   type="text"
                   placeholder="Buscar por cliente ou coleção..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full text-sm border border-border bg-background rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
                />
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Status:</span>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-border bg-background rounded-md px-2 py-2 outline-none">
                   <option value="all">Todos</option>
                   <option value="active">Coleções em Andamento</option>
                   <option value="closed">Coleções Encerradas (Perdas)</option>
                </select>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Prioridade:</span>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-sm border border-border bg-background rounded-md px-2 py-2 outline-none">
                   <option value="all">Todas</option>
                   <option value="Atenção">Atenção</option>
                   <option value="Follow-up Necessário">Follow-up Necessário</option>
                   <option value="Urgente">Urgente</option>
                   <option value="Crítico">Crítico</option>
                </select>
             </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
             {filtered.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                   Nenhum cliente sem pedido encontrado para os filtros atuais.
                </div>
             ) : (
                <TableShell head={["Cliente", "Marca / Coleção", "Dias sem pedido", "Prioridade", "Ações comerciais"]}>
                   {filtered.map(alert => (
                      <Tr key={alert.id}>
                         <Td className="font-semibold text-card-foreground">{alert.client_name}</Td>
                         <Td>
                            <span className="text-brand font-medium">{alert.brand_name}</span>
                            <br />
                            <span className="text-xs text-muted-foreground">{alert.collection_name}</span>
                         </Td>
                         <Td>
                            {alert.status === "active" ? (
                               <span>
                                 {alert.days_active} dias
                                 <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-brand" style={{ width: `${Math.min(alert.progress_pct, 100)}%` }} />
                                 </div>
                               </span>
                            ) : (
                               <span className="text-xs text-muted-foreground uppercase font-semibold">
                                  Fechada
                               </span>
                            )}
                         </Td>
                         <Td>
                            <Chip tone={getPriorityColor(alert.priority)}>
                               {getPriorityIcon(alert.priority)} {alert.priority}
                            </Chip>
                         </Td>
                         <Td>
                            <div className="flex items-center gap-2">
                               <Link to="/clientes" search={{ c: alert.client_id } as never}>
                                  <GhostButton>Ver</GhostButton>
                               </Link>
                               {alert.status === "active" && (
                                  <>
                                     <button
                                        onClick={() => handleCreateFollowup(alert)}
                                        title="Criar Follow-up"
                                        className="text-muted-foreground hover:text-amber-500 transition-colors p-1"
                                     >
                                        <CalendarCheck className="size-4" />
                                     </button>
                                     {/* A interface de criação de pedido não tem link direto pra preencher client_id pelo search params nativo a menos que suporte, mas podemos colocar */}
                                     <Link to="/pedidos" title="Lançar Pedido">
                                        <button className="text-muted-foreground hover:text-emerald-500 transition-colors p-1">
                                           <FilePlus className="size-4" />
                                        </button>
                                     </Link>
                                  </>
                               )}
                            </div>
                         </Td>
                      </Tr>
                   ))}
                </TableShell>
             )}
          </div>

       </div>
    </AppShell>
  );
}
