import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ComunicaPJEService } from "@/lib/lawhub/comunicapje-service";

export interface CrawlerRunResult {
  monitorsProcessed: number;
  publicationsPersisted: number;
  errors: Array<{ monitorId: string; message: string }>;
}

/**
 * Worker canônico server-side para varredura autônoma de publicações jurídicas (DJEN / CNJ).
 * Processa apenas monitores ativos cadastrados em public.law_publication_monitors.
 */
export async function processPublicationMonitorsCrawler(batchLimit = 20): Promise<CrawlerRunResult> {
  const result: CrawlerRunResult = {
    monitorsProcessed: 0,
    publicationsPersisted: 0,
    errors: [],
  };

  // 1. Busca monitores ativos com limite controlado
  const { data: monitors, error: monError } = await (supabaseAdmin as any)
    .from("law_publication_monitors")
    .select("id, account_id, monitor_type, term, metadata, status")
    .eq("status", "active")
    .limit(batchLimit);

  if (monError) {
    throw new Error(`Falha ao buscar monitores de publicação: ${monError.message}`);
  }

  if (!monitors || monitors.length === 0) {
    return result;
  }

  for (const monitor of monitors) {
    result.monitorsProcessed++;
    try {
      if (monitor.monitor_type === "oab") {
        // Extrai número da OAB e UF
        const cleanOab = String(monitor.term || "").replace(/\D/g, "");
        const uf = String((monitor.metadata as any)?.uf || (monitor.metadata as any)?.oab_state || "PI").trim().toUpperCase();

        if (!cleanOab) {
          continue;
        }

        const items = await ComunicaPJEService.fetchByOAB({
          numeroOab: cleanOab,
          ufOab: uf,
          itensPorPagina: 20,
        });

        if (items && items.length > 0) {
          const sourceIds = items.map((i) => String(i.id));

          // Preserva status de processamento existente
          const { data: existingRows } = await (supabaseAdmin as any)
            .from("law_publications")
            .select("source_id, processing_status")
            .eq("account_id", monitor.account_id)
            .eq("provider", "comunicapje")
            .in("source_id", sourceIds);

          const existingStatusMap = new Map<string, string>();
          if (existingRows) {
            for (const r of existingRows) {
              existingStatusMap.set(String(r.source_id), String(r.processing_status));
            }
          }

          const rowsToUpsert = items.map((item) => {
            const sid = String(item.id);
            const currentStatus = existingStatusMap.get(sid) || "received";
            return {
              account_id: monitor.account_id,
              provider: "comunicapje",
              source_id: sid,
              process_number: item.process_cnj || null,
              tribunal: item.court || null,
              organ: item.vara || null,
              content: item.full_text || null,
              source_publication_date: item.publication_date || null,
              source_availability_date: item.release_date || null,
              matched_by: `OAB/${uf} ${cleanOab}`,
              processing_status: currentStatus,
              provenance: {
                source: "DJEN / ComunicaPJe (CNJ)",
                gazette_name: item.gazette_name || null,
                edition: item.edition_number || null,
                source_url: item.source_url || null,
                crawler_run_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            };
          });

          const { error: upsertErr } = await (supabaseAdmin as any)
            .from("law_publications")
            .upsert(rowsToUpsert, { onConflict: "account_id,provider,source_id" });

          if (upsertErr) {
            result.errors.push({ monitorId: monitor.id, message: upsertErr.message });
          } else {
            result.publicationsPersisted += rowsToUpsert.length;
          }
        }

        // Atualiza última execução do monitor
        await (supabaseAdmin as any)
          .from("law_publication_monitors")
          .update({
            metadata: {
              ...(monitor.metadata as Record<string, any> || {}),
              last_checked_at: new Date().toISOString(),
              last_found_count: items?.length || 0,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", monitor.id);
      }
    } catch (err: any) {
      result.errors.push({ monitorId: monitor.id, message: err?.message || String(err) });
    }
  }

  return result;
}
