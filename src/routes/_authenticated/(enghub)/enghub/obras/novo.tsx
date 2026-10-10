import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import { GlassCard, PrimaryButton, TextInput, Field } from "@/components/navor-rephub/ui";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HardHat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/obras/novo")({
  component: NovaObra,
});

function NovaObra() {
  const navigate = useNavigate();
  const { accountId } = Route.useRouteContext();
  const [busy, setBusy] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "",
    address: "",
    contract_value: "",
    expected_cost: "",
    expected_end_date: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) {
      toast.error("O nome da obra é obrigatório.");
      return;
    }
    setBusy(true);
    try {
      if (!accountId) throw new Error("ACCOUNT_SELECTION_REQUIRED");

      const { data, error } = await supabase
        .from("enghub_projects")
        .insert({
          account_id: accountId,
          name: form.name,
          code: form.code,
          type: form.type,
          address: form.address,
          contract_value: Number(form.contract_value) || 0,
          expected_cost: Number(form.expected_cost) || 0,
          expected_end_date: form.expected_end_date || null,
          status: 'planejamento'
        })
        .select("id")
        .single();
        
      if (error) throw error;
      
      toast.success("Obra criada com sucesso!");
      navigate({ to: "/enghub/obras/$obraId", params: { obraId: data.id } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar obra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EngHubAppShell
      title="Nova Obra"
      subtitle="Cadastre um novo projeto para gerenciar"
    >
      <div className="max-w-2xl mx-auto">
        <GlassCard className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
            <div className="grid size-12 place-items-center rounded-lg bg-gold/10 text-gold">
              <HardHat className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Dados da Obra</h2>
              <p className="text-sm text-muted-foreground">Preencha as informações iniciais do projeto.</p>
            </div>
          </div>
          
          <form onSubmit={submit} className="space-y-6">
            <Field label="Nome da Obra (Identificação)" required>
              <TextInput 
                placeholder="Ex: Edifício Bella Vista" 
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-6">
              <Field label="Código Interno">
                <TextInput 
                  placeholder="Ex: OB-001" 
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </Field>
              <Field label="Tipo de Obra">
                <TextInput 
                  placeholder="Ex: Residencial, Galpão..." 
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Endereço Completo">
              <TextInput 
                placeholder="Rua, Número, Bairro, Cidade" 
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-6">
              <Field label="Valor do Contrato (R$)">
                <TextInput 
                  type="number"
                  placeholder="0.00" 
                  value={form.contract_value}
                  onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
                />
              </Field>
              <Field label="Custo Previsto (Orçamento) (R$)">
                <TextInput 
                  type="number"
                  placeholder="0.00" 
                  value={form.expected_cost}
                  onChange={e => setForm(f => ({ ...f, expected_cost: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Data de Conclusão Prevista">
              <TextInput 
                type="date"
                className="w-full"
                value={form.expected_end_date}
                onChange={e => setForm(f => ({ ...f, expected_end_date: e.target.value }))}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
              <button 
                type="button" 
                onClick={() => navigate({ to: "/enghub/obras" })}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Criar Obra"}
              </PrimaryButton>
            </div>
          </form>
        </GlassCard>
      </div>
    </EngHubAppShell>
  );
}
