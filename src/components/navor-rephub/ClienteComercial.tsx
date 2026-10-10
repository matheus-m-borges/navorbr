import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Chip, GhostButton, SectionTitle } from "./ui";
import { DocumentsPanel } from "./DocumentsPanel";
import { RepBadge, TableShell, Td, Tr } from "./repui";
import { AuditHistoryButton } from "./AuditHistoryButton";
import { currency, formatDate } from "@/lib/crm";
import { orderTone, sumMoney } from "@/lib/rep";
import { crmDb, useBrands } from "@/hooks/useCrm";
import { supabase } from "@/integrations/supabase/client";
import { useClientBrands, useCommissions, useInvoices, useOrders, useCollections } from "@/hooks/useRep";
import { TrendingUp, AlertCircle, CalendarCheck, FilePlus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useRadarColecoes, RadarAlert } from "@/hooks/useRadar";

/** Histórico comercial do cliente com foco na Evolução de Pedidos. */
export function ClienteComercial({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: orders = [] } = useOrders();
  const { data: invoices = [] } = useInvoices();
  const { data: commissions = [] } = useCommissions();
  const { data: allLinks = [] } = useClientBrands();
  const { data: brands = [] } = useBrands();
  const { data: collections = [] } = useCollections();
  
  const [busy, setBusy] = useState(false);
  
  // States da nova Comparação Manual
  const [cmpBrand, setCmpBrand] = useState<string>("all");
  const [cmpCol1, setCmpCol1] = useState<string>("");
  const [cmpCol2, setCmpCol2] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  const radarAlerts = useRadarColecoes().filter((a) => a.client_id === clientId);
  const activeAlerts = radarAlerts.filter((a) => a.status === "active");
  const closedAlerts = radarAlerts.filter((a) => a.status === "closed");

  const clientOrders = useMemo(
    () => orders.filter((o) => o.client_id === clientId && o.status !== "Cancelado"),
    [orders, clientId],
  );

  const orderIds = new Set(clientOrders.map((o) => o.id));
  const links = allLinks.filter((l) => l.client_id === clientId);
  const clientInvoices = invoices.filter((i) => orderIds.has(i.order_id));
  const clientCommissions = commissions.filter((c) => c.order_id && orderIds.has(c.order_id));

  const totalValueGeral = sumMoney(clientOrders, (o) => o.total_value);
  const billed = sumMoney(clientInvoices, (i) => i.invoiced_value);
  const commissionTotal = sumMoney(clientCommissions, (c) => c.potential_amount);
  const linkedIds = new Set(links.map((l) => l.brand_id));

  // 1. RESUMO DO CLIENTE (Global)
  const totalOrders = clientOrders.length;
  const totalPieces = clientOrders.reduce((acc, curr) => acc + Number(curr.total_pieces || 0), 0);
  const sortedByDate = [...clientOrders].sort((a,b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
  const lastPurchase = sortedByDate.length > 0 ? sortedByDate[0]!.order_date : null;
  const ticketMedio = totalOrders > 0 ? totalValueGeral / totalOrders : 0;
  const marcasAtivas = new Set(clientOrders.map(o => o.brand_id)).size;
  const colecoesCompradas = new Set(clientOrders.map(o => o.collection_id)).size;

  // Coleções para os Dropdowns da Comparação (respeitando o filtro de marca)
  const availableCollections = useMemo(() => {
     let c = collections.filter(col => col.name);
     if (cmpBrand !== "all") {
       c = c.filter(col => col.brand_collections?.some(bc => bc.brand_id === cmpBrand));
     }
     return c.sort((a,b) => new Date(a.sales_start || 0).getTime() - new Date(b.sales_start || 0).getTime());
  }, [collections, cmpBrand]);

  // Motor da Comparação Manual
  const analysisResult = useMemo(() => {
     if (!isAnalyzed || !cmpCol1 || !cmpCol2) return null;
     
     const col1Data = collections.find(c => c.id === cmpCol1);
     const col2Data = collections.find(c => c.id === cmpCol2);
     if (!col1Data || !col2Data) return null;

     let ordersC1 = clientOrders.filter(o => o.collection_id === cmpCol1);
     let ordersC2 = clientOrders.filter(o => o.collection_id === cmpCol2);

     if (cmpBrand !== "all") {
       ordersC1 = ordersC1.filter(o => o.brand_id === cmpBrand);
       ordersC2 = ordersC2.filter(o => o.brand_id === cmpBrand);
     }

     const count1 = ordersC1.length;
     const count2 = ordersC2.length;
     
     let growth = 0;
     let status: "crescimento" | "queda_total" | "queda" | "estavel" | "novos" = "estavel";
     let growthText = "0%";

     if (count1 === 0 && count2 > 0) {
        status = "novos";
        growthText = `+${count2} pedidos`;
     } else if (count1 > 0 && count2 === 0) {
        status = "queda_total";
        growthText = "-100%";
        growth = -100;
     } else if (count1 === count2) {
        status = "estavel";
        growthText = "0%";
     } else {
        growth = ((count2 - count1) / count1) * 100;
        status = growth > 0 ? "crescimento" : "queda";
        growthText = growth > 0 ? `+${growth.toFixed(2)}%` : `${growth.toFixed(2)}%`;
     }

     const pieces1 = ordersC1.reduce((a, b) => a + Number(b.total_pieces || 0), 0);
     const pieces2 = ordersC2.reduce((a, b) => a + Number(b.total_pieces || 0), 0);
     const val1 = sumMoney(ordersC1, o => o.total_value);
     const val2 = sumMoney(ordersC2, o => o.total_value);

     const chartData = [
       { name: col1Data.name, ordersCount: count1 },
       { name: col2Data.name, ordersCount: count2 }
     ];

     return {
        col1: { name: col1Data.name, count: count1, pieces: pieces1, val: val1 },
        col2: { name: col2Data.name, count: count2, pieces: pieces2, val: val2, isActive: new Date(col2Data.sales_end || "2099-01-01") >= new Date() },
        status,
        growthText,
        chartData
     };
  }, [isAnalyzed, cmpCol1, cmpCol2, clientOrders, collections]);

  // Tabela Histórica Inferior: Não afetada pelos dropdowns superiores, pega todo o histórico
  const collectionsData = useMemo(() => {
    const groups: Record<string, typeof clientOrders> = {};
    for (const o of clientOrders) {
      if (!groups[o.collection_id]) groups[o.collection_id] = [];
      groups[o.collection_id]!.push(o);
    }
    
    const data = Object.keys(groups).map((colId) => {
      const ords = groups[colId] ?? [];
      const col = collections.find((c) => c.id === colId);
      const name = col?.name || ords[0]?.collections?.name || "Coleção";
      const totalPieces = ords.reduce((acc, curr) => acc + Number(curr.total_pieces || 0), 0);
      const totalValue = ords.reduce((acc, curr) => acc + Number(curr.total_value || 0), 0);
      
      const salesStart = col?.sales_start;
      
      let firstOrderDate = ords[0]?.order_date ?? "";
      for (const o of ords) {
        if (!firstOrderDate || new Date(o.order_date) < new Date(firstOrderDate)) firstOrderDate = o.order_date;
      }
      
      return {
        id: colId,
        name,
        salesStart: salesStart || firstOrderDate,
        ordersCount: ords.length,
        totalPieces,
        totalValue,
        firstOrderDate,
        isLost: false,
      };
    });

    closedAlerts.forEach((alert) => {
      if (!data.some((d) => d.id === alert.collection_id)) {
        const col = collections.find((c) => c.id === alert.collection_id);
        data.push({
          id: alert.collection_id,
          name: alert.collection_name,
          salesStart: col?.sales_start || new Date().toISOString(),
          ordersCount: 0,
          totalPieces: 0,
          totalValue: 0,
          firstOrderDate: "",
          isLost: true,
        });
      }
    });

    data.sort((a, b) => new Date(a.salesStart ?? "").getTime() - new Date(b.salesStart ?? "").getTime());
    
    return data.map((d, index) => {
      let growth = 0;
      let prevCount = 0;
      if (index > 0) {
        prevCount = data[index - 1]!.ordersCount;
        if (prevCount > 0) {
          growth = ((d.ordersCount - prevCount) / prevCount) * 100;
        } else if (d.ordersCount > 0) {
          growth = 100;
        }
      }
      return {
        ...d,
        prevCount,
        growth,
        growthLabel: growth > 0 ? `+${growth.toFixed(2)}%` : `${growth.toFixed(2)}%`
      };
    });
  }, [clientOrders, collections, closedAlerts]);

  const handleCreateFollowup = async (alert: RadarAlert) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // amanhã

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

  async function toggleBrand(brandId: string) {
    setBusy(true);
    const existing = links.find((l) => l.brand_id === brandId);
    const { error } = existing
      ? await crmDb.from("client_brands").delete().eq("id", existing.id)
      : await crmDb.from("client_brands").insert({ client_id: clientId, brand_id: brandId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["client_brands"] });
  }

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. RESUMO DO CLIENTE */}
      <div>
        <div className="flex items-start justify-between">
          <SectionTitle title="Resumo do cliente" hint="Métricas vitais de consumo" />
          <AuditHistoryButton entityType="client" entityId={clientId} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          {[
            { label: "Total de Pedidos", value: String(totalOrders) },
            { label: "Total de Peças", value: String(totalPieces) },
            { label: "Última Compra", value: lastPurchase ? formatDate(lastPurchase) : "—" },
            { label: "Ticket Médio", value: currency(ticketMedio) },
            { label: "Marcas Ativas", value: String(marcasAtivas) },
            { label: "Coleções", value: String(colecoesCompradas) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="mt-1 font-display text-base sm:text-lg font-semibold text-card-foreground truncate">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ⚠️ RADAR COMERCIAL: ALERTA DE CLIENTE SEM PEDIDO */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.map(alert => (
            <div key={alert.id} className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-sm">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div className="flex items-start gap-3">
                   <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/20 text-rose-600 mt-0.5">⚠️</div>
                   <div>
                     <p className="text-base font-semibold text-rose-700">CLIENTE SEM PEDIDO NA COLEÇÃO ATUAL</p>
                     <p className="text-sm text-card-foreground mt-1">
                       O cliente ainda não realizou pedido na coleção <strong>{alert.collection_name}</strong> ({alert.brand_name}).
                     </p>
                     <p className="text-xs text-muted-foreground mt-1">
                       Coleção ativa há {alert.days_active} dias. Ação recomendada: Entrar em contato.
                     </p>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => handleCreateFollowup(alert)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-accent transition-colors shadow-sm">
                      <CalendarCheck className="size-4" />
                      Follow-up
                   </button>
                   <Link to="/pedidos" search={{ client: clientId }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm">
                      <FilePlus className="size-4" />
                      Lançar Pedido
                   </Link>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. COMPARAÇÃO MANUAL DE PEDIDOS POR COLEÇÃO */}
      <div>
        <SectionTitle title="Comparação de Pedidos por Coleção" hint="Selecione as coleções que deseja comparar para analisar a evolução da quantidade de pedidos deste cliente." />
        
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-6">
           <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                 <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Marca (Filtro)</label>
                 <select value={cmpBrand} onChange={e => { setCmpBrand(e.target.value); setCmpCol1(""); setCmpCol2(""); setIsAnalyzed(false); }} className="w-full text-sm border border-border bg-background rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring">
                    <option value="all">Todas as marcas</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.brand}</option>)}
                 </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                 <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coleção 1</label>
                 <select value={cmpCol1} onChange={e => { setCmpCol1(e.target.value); setIsAnalyzed(false); }} className="w-full text-sm border border-border bg-background rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Selecionar coleção</option>
                    {availableCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                 <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coleção 2</label>
                 <select value={cmpCol2} onChange={e => { setCmpCol2(e.target.value); setIsAnalyzed(false); }} className="w-full text-sm border border-border bg-background rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Selecionar coleção</option>
                    {availableCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <div>
                 <button 
                   onClick={() => {
                      if (!cmpCol1 || !cmpCol2) { toast.error("Selecione ambas as coleções."); return; }
                      if (cmpCol1 === cmpCol2) { toast.error("Selecione duas coleções diferentes para realizar a comparação."); return; }
                      setIsAnalyzed(true);
                   }}
                   className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2 rounded-md hover:bg-primary/90 transition shadow-sm h-[38px] w-full sm:w-auto"
                 >
                    ANALISAR
                 </button>
              </div>
           </div>

           {!isAnalyzed || !analysisResult ? (
              <div className="py-10 text-center rounded-lg border border-border border-dashed bg-muted/30">
                 <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Selecione duas coleções para iniciar a análise</p>
              </div>
           ) : (
              <div className="space-y-8 pt-6 border-t border-border">
                 {/* RESULTADO DA COMPARAÇÃO */}
                 <div className="text-center">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">Resultado da Comparação</h3>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
                       <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{analysisResult.col1.name}</span>
                          <span className="text-3xl font-display font-bold text-card-foreground">{analysisResult.col1.count} <span className="text-lg">pedidos</span></span>
                       </div>
                       <div className="text-muted-foreground hidden sm:block">
                          <TrendingUp className="size-8 opacity-20 rotate-90" />
                       </div>
                       <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{analysisResult.col2.name}</span>
                          <span className="text-3xl font-display font-bold text-card-foreground">{analysisResult.col2.count} <span className="text-lg">pedidos</span></span>
                       </div>
                    </div>

                    <div className="mt-8 flex justify-center">
                       {analysisResult.status === "crescimento" && (
                         <div className="bg-emerald-500/10 text-emerald-600 px-8 py-4 rounded-2xl border border-emerald-500/20 text-center shadow-sm">
                            <p className="text-3xl font-bold">{analysisResult.growthText}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider mt-1">Crescimento</p>
                         </div>
                       )}
                       {analysisResult.status === "novos" && (
                         <div className="bg-emerald-500/10 text-emerald-600 px-8 py-4 rounded-2xl border border-emerald-500/20 text-center shadow-sm">
                            <p className="text-3xl font-bold">{analysisResult.growthText}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider mt-1">Novos Pedidos</p>
                            <p className="text-[11px] mt-1.5 max-w-[200px] leading-tight">O cliente não realizou pedidos na primeira coleção selecionada.</p>
                         </div>
                       )}
                       {analysisResult.status === "queda" && (
                         <div className="bg-red-500/10 text-red-600 px-8 py-4 rounded-2xl border border-red-500/20 text-center shadow-sm">
                            <p className="text-3xl font-bold">{analysisResult.growthText}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider mt-1">Queda</p>
                         </div>
                       )}
                       {analysisResult.status === "queda_total" && (
                         <div className="bg-red-500/10 text-red-600 px-8 py-4 rounded-2xl border border-red-500/20 text-center shadow-sm">
                            <p className="text-3xl font-bold">{analysisResult.growthText}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider mt-1">Queda Total</p>
                            {analysisResult.col2.isActive && <p className="text-[10px] mt-2 font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-1 rounded">⚠️ Coleção Atual s/ pedido</p>}
                         </div>
                       )}
                       {analysisResult.status === "estavel" && (
                         <div className="bg-blue-500/10 text-blue-600 px-8 py-4 rounded-2xl border border-blue-500/20 text-center shadow-sm">
                            <p className="text-3xl font-bold">{analysisResult.growthText}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider mt-1">Estável</p>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* GRAFICO E INFORMAÇÕES COMPLEMENTARES LADO A LADO */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div>
                       <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Curva de Crescimento</h3>
                       <div className="h-[200px] w-full -ml-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analysisResult.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                                dy={10}
                              />
                              <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                                allowDecimals={false}
                              />
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                                labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--card-foreground))', marginBottom: '4px' }}
                                itemStyle={{ color: 'hsl(var(--primary))', fontSize: '14px' }}
                                formatter={(value: number) => [`${value} pedidos`, "Quantidade"]}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="ordersCount" 
                                stroke="hsl(var(--primary))" 
                                strokeWidth={3} 
                                dot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                                activeDot={{ r: 7, strokeWidth: 0 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                       </div>
                    </div>

                    <div>
                       <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Informações Complementares</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted/30 p-4 rounded-xl border border-border">
                             <p className="text-xs font-bold text-card-foreground uppercase truncate mb-3">{analysisResult.col1.name}</p>
                             <div className="space-y-2">
                               <div className="flex justify-between">
                                  <span className="text-[11px] text-muted-foreground">Pedidos</span>
                                  <span className="text-[11px] font-semibold text-card-foreground">{analysisResult.col1.count}</span>
                               </div>
                               <div className="flex justify-between">
                                  <span className="text-[11px] text-muted-foreground">Peças</span>
                                  <span className="text-[11px] font-semibold text-card-foreground">{analysisResult.col1.pieces}</span>
                               </div>
                               <div className="flex justify-between pt-2 border-t border-border">
                                  <span className="text-[11px] text-muted-foreground">Valor dos pedidos</span>
                                  <span className="text-[11px] font-semibold text-primary">{currency(analysisResult.col1.val)}</span>
                               </div>
                             </div>
                          </div>
                          
                          <div className="bg-muted/30 p-4 rounded-xl border border-border">
                             <p className="text-xs font-bold text-card-foreground uppercase truncate mb-3">{analysisResult.col2.name}</p>
                             <div className="space-y-2">
                               <div className="flex justify-between">
                                  <span className="text-[11px] text-muted-foreground">Pedidos</span>
                                  <span className="text-[11px] font-semibold text-card-foreground">{analysisResult.col2.count}</span>
                               </div>
                               <div className="flex justify-between">
                                  <span className="text-[11px] text-muted-foreground">Peças</span>
                                  <span className="text-[11px] font-semibold text-card-foreground">{analysisResult.col2.pieces}</span>
                               </div>
                               <div className="flex justify-between pt-2 border-t border-border">
                                  <span className="text-[11px] text-muted-foreground">Valor dos pedidos</span>
                                  <span className="text-[11px] font-semibold text-primary">{currency(analysisResult.col2.val)}</span>
                               </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* 3. EVOLUÇÃO POR COLEÇÃO E PEÇAS (TABELA) */}
        <div>
          <SectionTitle title="Evolução por Coleção" />
          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="font-medium p-3">Coleção</th>
                  <th className="font-medium p-3">Pedidos</th>
                  <th className="font-medium p-3">Anterior</th>
                  <th className="font-medium p-3">Cresc.</th>
                  <th className="font-medium p-3">Peças</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collectionsData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhuma coleção</td>
                  </tr>
                ) : (
                  collectionsData.map((d, i) => (
                    <tr key={d.id} className={`hover:bg-muted/30 transition-colors ${d.isLost ? 'bg-rose-500/5' : ''}`}>
                      <td className="p-3 font-medium">{d.name}</td>
                      <td className="p-3 font-semibold">
                         {d.isLost ? (
                           <span className="text-rose-600 flex items-center gap-1 text-[11px] uppercase tracking-wider"><AlertCircle className="size-3"/> Não comprou</span>
                         ) : d.ordersCount}
                      </td>
                      <td className="p-3 text-muted-foreground">{i === 0 ? "—" : d.prevCount}</td>
                      <td className="p-3">
                        {i === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={`font-semibold ${d.growth > 0 ? "text-emerald-600" : d.growth < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {d.growthLabel}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{d.totalPieces}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. PONTUALIDADE NAS COLEÇÕES */}
        <div>
          <SectionTitle title="Pontualidade de Compra" hint="Tempo até o 1º pedido na coleção" />
          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="font-medium p-3">Coleção</th>
                  <th className="font-medium p-3">Início Vendas</th>
                  <th className="font-medium p-3">1º Pedido</th>
                  <th className="font-medium p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collectionsData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-muted-foreground">Sem dados</td>
                  </tr>
                ) : (
                  collectionsData.map((d) => {
                    const hasStart = !!collections.find(c => c.id === d.id)?.sales_start;
                    const diffTime = hasStart ? new Date(d.firstOrderDate ?? "").getTime() - new Date(d.salesStart ?? "").getTime() : 0;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let pontualidade = "—";
                    let cor = "text-muted-foreground";
                    if (hasStart) {
                      if (d.isLost) { pontualidade = "NÃO COMPROU"; cor = "text-rose-600"; }
                      else if (diffDays <= 15) { pontualidade = "MUITO PONTUAL"; cor = "text-emerald-600"; }
                      else if (diffDays <= 45) { pontualidade = "NO PRAZO"; cor = "text-blue-600"; }
                      else { pontualidade = "ATRASADO"; cor = "text-orange-600"; }
                    }

                    return (
                      <tr key={d.id} className={`hover:bg-muted/30 transition-colors ${d.isLost ? 'bg-rose-500/5' : ''}`}>
                        <td className="p-3 font-medium">{d.name}</td>
                        <td className="p-3 text-muted-foreground">
                          {hasStart ? formatDate(d.salesStart) : "Não definido"}
                        </td>
                        <td className="p-3">{d.isLost ? "—" : formatDate(d.firstOrderDate)}</td>
                        <td className="p-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-sm bg-muted ${cor}`}>
                            {pontualidade}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. MARCAS TRABALHADAS E VALORES GERAIS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div>
          <SectionTitle title="Marcas trabalhadas" hint="Marque as marcas que este cliente já compra" />
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => {
              const active = linkedIds.has(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleBrand(b.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 shadow-sm ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/60"
                  }`}
                >
                  {b.brand}
                </button>
              );
            })}
            {brands.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma marca cadastrada.</p> : null}
          </div>
        </div>
        
        <div>
           <SectionTitle title="Métricas Financeiras" hint="Valores totais do histórico (Dados Secundários)" />
           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Vendido (Geral)", value: currency(totalValueGeral) },
              { label: "Faturado (Geral)", value: currency(billed) },
              { label: "Comissão Gerada", value: currency(commissionTotal) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className="mt-1 font-display text-base font-semibold text-card-foreground truncate">{k.value}</p>
              </div>
            ))}
           </div>
        </div>
      </div>

      {/* 7. HISTÓRICO DETALHADO (PEDIDOS) */}
      <div>
        <SectionTitle title="Histórico detalhado" hint="Lista de todos os pedidos realizados" />
        {clientOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum pedido lançado para este cliente.</p>
        ) : (
          <TableShell head={["Pedido", "Data", "Marca / Coleção", "Peças", "Valor", "Status", ""]}>
            {clientOrders.map((o) => (
              <Tr key={o.id}>
                <Td className="font-medium">{o.internal_number}</Td>
                <Td>{formatDate(o.order_date)}</Td>
                <Td>
                  {o.brands?.brand ?? "—"}
                  {o.brand_collections?.name || o.collections?.name ? ` · ${o.brand_collections?.name || o.collections?.name}` : ""}
                </Td>
                <Td>{o.total_pieces}</Td>
                <Td>{currency(Number(o.total_value ?? 0))}</Td>
                <Td>
                  <RepBadge status={o.status} tones={orderTone} />
                </Td>
                <Td>
                  <Link to="/pedidos" search={{ o: o.id } as never}>
                    <GhostButton>Abrir</GhostButton>
                  </Link>
                </Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </div>

      {/* FATURAMENTOS */}
      {clientInvoices.length > 0 ? (
        <div>
          <SectionTitle title="Faturamentos" />
          <div className="flex flex-wrap gap-2">
            {clientInvoices.map((i) => (
              <Chip key={i.id} tone="muted">
                NF {i.nf_number} · {formatDate(i.issue_date)} ·{" "}
                {currency(Number(i.invoiced_value ?? 0))}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* DOCUMENTOS */}
      <DocumentsPanel
        entityType="client"
        entityId={clientId}
        title="Documentos do cliente"
        hint="Cadastro, ficha, comprovantes e pedidos assinados"
        defaultCategory="Cadastro"
      />
    </div>
  );
}
