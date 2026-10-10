import { useMemo } from "react";
import { useClients } from "./useCrm";
import { useCollections, useClientBrands, useOrders } from "./useRep";

export type RadarPriority = "Atenção" | "Follow-up Necessário" | "Urgente" | "Crítico" | "Coleção Perdida";

export interface RadarAlert {
  id: string; // brand_collection_id + client_id
  client_id: string;
  client_name: string;
  brand_id: string;
  brand_name: string;
  collection_id: string;
  collection_name: string;
  days_active: number;
  total_days: number;
  progress_pct: number;
  priority: RadarPriority;
  status: "active" | "closed";
}

export function useRadarColecoes() {
  const { data: clients = [] } = useClients();
  const { data: collections = [] } = useCollections();
  const { data: links = [] } = useClientBrands();
  const { data: orders = [] } = useOrders();

  const alerts = useMemo(() => {
    const results: RadarAlert[] = [];
    const now = new Date();

    // Filtra apenas coleções gerais que têm data de início de vendas
    const validCollections = collections.filter((c) => c.sales_start);

    for (const col of validCollections) {
      // Itera sobre as coleções da marca dentro da coleção geral
      const brandCollections = col.brand_collections || [];
      
      for (const bc of brandCollections) {
        const startDate = new Date(bc.start_date || col.sales_start!);
        // Se não tiver data de término definida, tenta a da coleção geral ou assume 6 meses
        const endDate = bc.end_date
          ? new Date(bc.end_date)
          : col.sales_end
            ? new Date(col.sales_end)
            : new Date(startDate.getTime() + 180 * 86400000);

        const isActive = now >= startDate && now <= endDate;
        const isClosed = now > endDate;

        // Se a coleção ainda não começou, não há por que cobrar.
        if (!isActive && !isClosed) continue;

        // Encontrar todos os clientes que têm ligação (link) com a marca da coleção
        const brandLinks = links.filter((l) => l.brand_id === bc.brand_id);

        for (const link of brandLinks) {
          const client = clients.find((c) => c.id === link.client_id);
          if (!client) continue;

          // Verificar se esse cliente já fez algum pedido para essa coleção (geral + marca)
          const hasOrder = orders.some(
            (o) => 
              o.client_id === client.id && 
              o.collection_id === col.id && 
              o.brand_id === bc.brand_id &&
              o.status !== "Cancelado"
          );

          if (!hasOrder) {
            // Cliente não comprou: Gerar alerta Radar
            const daysActive = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
            const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
            const progressPct = totalDays > 0 ? (daysActive / totalDays) * 100 : 100;

            let priority: RadarPriority = "Atenção";

            if (isClosed) {
              priority = "Coleção Perdida";
            } else {
              if (progressPct >= 85) priority = "Crítico";
              else if (progressPct >= 60) priority = "Urgente";
              else if (progressPct >= 30) priority = "Follow-up Necessário";
            }

            results.push({
              id: `${bc.id}-${client.id}`,
              client_id: client.id,
              client_name: client.trade_name || client.legal_name,
              brand_id: bc.brand_id,
              brand_name: bc.brands?.brand || "Marca",
              collection_id: col.id,
              collection_name: col.name,
              days_active: daysActive,
              total_days: totalDays,
              progress_pct: progressPct,
              priority,
              status: isClosed ? "closed" : "active",
            });
          }
        }
      }
    }

    // Ordenação de prioridade (os ativos e mais críticos primeiro, depois os perdidos)
    return results.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.progress_pct - a.progress_pct;
    });
  }, [clients, collections, links, orders]);

  return alerts;
}
