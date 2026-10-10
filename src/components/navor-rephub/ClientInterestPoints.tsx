import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientInterestPoints, crmDb, type ClientInterestPoint } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { formatDate } from "@/lib/crm";
import { useRemoveRecord } from "@/lib/registro";
import {
  EmptyState,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  SectionTitle,
  TextArea,
  TextInput,
} from "./ui";

const emptyForm = {
  point_date: new Date().toISOString().split("T")[0],
  source: "",
  subject: "",
  description: "",
};

export function ClientInterestPoints({ clientId }: { clientId: string }) {
  const { data: points = [], isLoading } = useClientInterestPoints(clientId);
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const removeRecord = useRemoveRecord();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientInterestPoint | null>(null);
  const [form, setForm] = useState(emptyForm);

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(point: ClientInterestPoint) {
    setEditing(point);
    setForm({
      point_date: point.point_date,
      source: point.source,
      subject: point.subject,
      description: point.description ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.point_date || !form.source.trim() || !form.subject.trim()) {
      toast.error("Preencha a data, fonte e assunto.");
      return;
    }

    const payload = {
      client_id: clientId,
      point_date: form.point_date,
      source: form.source.trim(),
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      created_by: user?.id ?? null,
    };

    if (editing) {
      const { error } = await crmDb
        .from("client_interest_points")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Ponto de interesse atualizado.");
    } else {
      const { error } = await crmDb.from("client_interest_points").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Ponto de interesse registrado.");
    }

    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["client-interest-points", clientId] });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle
        title="Pontos de Interesse"
        action={
          <GhostButton onClick={startNew}>
            <Plus className="size-4" /> Adicionar
          </GhostButton>
        }
      />

      {isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : points.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <EmptyState
            title="Nenhum ponto registrado"
            hint="Registre aqui assuntos que interessam a este cliente (ex: campanhas, produtos específicos)."
          />
          <PrimaryButton onClick={startNew}>Adicionar ponto</PrimaryButton>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {points.map((p) => (
            <div key={p.id} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-card-foreground">
                      {formatDate(p.point_date)}
                    </span>
                    <span>•</span>
                    <span>{p.source}</span>
                  </div>
                  <h4 className="mt-1 font-medium text-card-foreground">{p.subject}</h4>
                  {p.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(p)}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-card-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() =>
                      void removeRecord({
                        table: "client_interest_points",
                        id: p.id,
                        label: `ponto de interesse: ${p.subject}`,
                      }).then((ok) => {
                        if (ok) void qc.invalidateQueries({ queryKey: ["client-interest-points", clientId] });
                      })
                    }
                    className="grid size-8 place-items-center rounded-lg text-rose hover:bg-rose/10"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar ponto de interesse" : "Novo ponto de interesse"}
      >
        <div className="grid gap-3">
          <Field label="Data *">
            <TextInput
              type="date"
              value={form.point_date}
              onChange={(e) => setForm({ ...form, point_date: e.target.value })}
            />
          </Field>
          <Field label="Fonte *">
            <TextInput
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Ex: Instagram, WhatsApp, Feira..."
            />
          </Field>
          <Field label="Assunto *">
            <TextInput
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Ex: Interesse em coleção Verão 2027"
            />
          </Field>
          <Field label="Descrição">
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhes sobre o interesse..."
              rows={4}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void save()}>Salvar</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
