import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { crmDb } from "@/hooks/useCrm";
import { useDocuments } from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";
import { DOCUMENT_CATEGORIES } from "@/lib/rep";
import { formatDateTime } from "@/lib/crm";
import { GhostButton, SectionTitle, SelectInput } from "./ui";

const BUCKET = "documentos";
const MAX_BYTES = 200 * 1024 * 1024;

export function DocumentsPanel({
  entityType,
  entityId,
  title = "Documentos",
  hint,
  defaultCategory = "Pedido",
}: {
  entityType: string;
  entityId: string;
  title?: string;
  hint?: string;
  defaultCategory?: string;
}) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { data: docs = [] } = useDocuments(entityType, entityId);
  const [category, setCategory] = useState(defaultCategory);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo maior que 200 MB.");
      return;
    }
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
    const path = `${entityType}/${entityId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      setBusy(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await crmDb.from("documents").insert({
      entity_type: entityType,
      entity_id: entityId,
      category,
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: user?.name ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento anexado.");
  }

  async function open(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(id: string, path: string) {
    await supabase.storage.from(BUCKET).remove([path]);
    await crmDb.from("documents").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento excluído.");
  }

  return (
    <div>
      <SectionTitle title={title} hint={hint} />
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="max-w-48"
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <GhostButton disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Enviando..." : "+ Anexar documento"}
        </GhostButton>
      </div>

      <div className="mt-3 space-y-2">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-card-foreground">{d.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.category} · {((d.size_bytes ?? 0) / 1024).toFixed(0)} KB ·{" "}
                    {formatDateTime(d.created_at)} · {d.uploaded_by_name ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <GhostButton onClick={() => void open(d.file_path)}>
                  <Download className="size-3.5" /> Abrir
                </GhostButton>
                <GhostButton
                  className="border-rose/30 text-rose"
                  onClick={() => void remove(d.id, d.file_path)}
                >
                  <Trash2 className="size-3.5" />
                </GhostButton>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
