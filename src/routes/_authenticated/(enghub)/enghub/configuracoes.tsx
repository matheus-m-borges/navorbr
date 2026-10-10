import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Settings,
  Building2,
  HardHat,
  Shield,
  Save,
  Bell,
  FileCheck,
} from "lucide-react";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import {
  GlassCard,
  PrimaryButton,
  TextInput,
} from "@/components/navor-rephub/ui";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Navor EngHub" },
      { name: "description", content: "Configurações da construtora, dados técnicos e preferências." },
    ],
  }),
  component: EngHubConfiguracoes,
});

const STORAGE_KEY = "navor_enghub_settings";

export function EngHubConfiguracoes() {
  const [companyName, setCompanyName] = useState("Construtora & Engenharia Navor");
  const [cnpj, setCnpj] = useState("34.120.940/0001-55");
  const [techResponsible, setTechResponsible] = useState("Eng. Matheus Borges");
  const [creaRecord, setCreaRecord] = useState("CREA-MG 215.890/D");
  const [measurementCycle, setMeasurementCycle] = useState("mensal");
  const [notifyDelays, setNotifyDelays] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName) setCompanyName(parsed.companyName);
        if (parsed.cnpj) setCnpj(parsed.cnpj);
        if (parsed.techResponsible) setTechResponsible(parsed.techResponsible);
        if (parsed.creaRecord) setCreaRecord(parsed.creaRecord);
        if (parsed.measurementCycle) setMeasurementCycle(parsed.measurementCycle);
        if (parsed.notifyDelays !== undefined) setNotifyDelays(parsed.notifyDelays);
        if (parsed.notifyLowStock !== undefined) setNotifyLowStock(parsed.notifyLowStock);
      }
    } catch (e) {}
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      const payload = {
        companyName,
        cnpj,
        techResponsible,
        creaRecord,
        measurementCycle,
        notifyDelays,
        notifyLowStock,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      toast.success("Configurações da construtora salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EngHubAppShell
      title="Configurações"
      subtitle="Dados cadastrais da construtora, responsabilidade técnica e parâmetros operacionais"
      actions={
        <PrimaryButton onClick={handleSave} className="gap-1.5 text-xs">
          <Save className="size-3.5" />
          Salvar Alterações
        </PrimaryButton>
      }
    >
      <div className="max-w-4xl space-y-6">
        {/* Dados da Empresa */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <Building2 className="size-5 text-amber-500" />
            <h3 className="font-bold text-white text-sm">Dados da Construtora / Empresa</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Razão Social / Nome Fantasia:
              </label>
              <TextInput
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Navor Construtora e Incorporadora Ltda"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                CNPJ da Construtora:
              </label>
              <TextInput
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>
        </GlassCard>

        {/* Responsável Técnico & CREA */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <HardHat className="size-5 text-amber-500" />
            <h3 className="font-bold text-white text-sm">Responsabilidade Técnica & Engenharia</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Responsável Técnico Principal:
              </label>
              <TextInput
                value={techResponsible}
                onChange={(e) => setTechResponsible(e.target.value)}
                placeholder="Ex: Eng. Matheus Borges"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Número de Registro no CREA / CAU:
              </label>
              <TextInput
                value={creaRecord}
                onChange={(e) => setCreaRecord(e.target.value)}
                placeholder="Ex: CREA-MG 123.456/D"
              />
            </div>
          </div>
        </GlassCard>

        {/* Ciclo de Medições & Notificações */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <Bell className="size-5 text-amber-500" />
            <h3 className="font-bold text-white text-sm">Ciclos de Medição e Alertas</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Ciclo Padrão de Medições de Obra:
              </label>
              <select
                value={measurementCycle}
                onChange={(e) => setMeasurementCycle(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground cursor-pointer"
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal (Recomendado)</option>
              </select>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyDelays}
                  onChange={(e) => setNotifyDelays(e.target.checked)}
                  className="rounded border-border accent-amber-500"
                />
                <span>Alertar automaticamente quando uma etapa do cronograma estiver com prazo vencido</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyLowStock}
                  onChange={(e) => setNotifyLowStock(e.target.checked)}
                  className="rounded border-border accent-amber-500"
                />
                <span>Notificar quando pedidos de materiais ficarem pendentes por mais de 48 horas</span>
              </label>
            </div>
          </div>
        </GlassCard>

        <div className="flex justify-end">
          <PrimaryButton onClick={handleSave} disabled={isSaving} className="gap-1.5">
            <Save className="size-4" />
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </PrimaryButton>
        </div>
      </div>
    </EngHubAppShell>
  );
}
