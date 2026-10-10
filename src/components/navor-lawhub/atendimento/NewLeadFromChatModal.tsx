import { useState, useEffect } from "react";
import { UserPlus, X, Sparkles, Calendar, Clock, Tag, Target, ArrowRight, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LawConversation, LawTrafficCampaignCode } from "@/lib/lawhub/atendimento-types";
import { createLawHubLead, listLawHubLeads } from "@/lib/lawhub/lead.functions";
import { LawHubAtendimentoService } from "@/lib/lawhub/atendimento-service";
import { useCurrentUser } from "@/hooks/useSession";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewLeadFromChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: LawConversation | null;
  onLeadCreated: (newLead: any) => void;
}

export function NewLeadFromChatModal({
  isOpen,
  onClose,
  conversation,
  onLeadCreated,
}: NewLeadFromChatModalProps) {
  const { user } = useCurrentUser();

  // Estados com inicialização segura
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [leadType, setLeadType] = useState<"imediato" | "futuro">("imediato");
  const [futureDate, setFutureDate] = useState("");
  const [futureTime, setFutureTime] = useState("10:00");
  const [futureReason, setFutureReason] = useState("");
  const [trafficCode, setTrafficCode] = useState("");
  const [trafficAction, setTrafficAction] = useState("");
  const [areaDireito, setAreaDireito] = useState("Trabalhista");
  const [notes, setNotes] = useState("");
  const [campaignCodes, setCampaignCodes] = useState<LawTrafficCampaignCode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [principalStageId, setPrincipalStageId] = useState<string>("");
  const [futureStageId, setFutureStageId] = useState<string>("");

  // Sincroniza dados da conversa ao abrir
  useEffect(() => {
    if (!isOpen || !conversation) return;

    void Promise.all([listLawHubLeads({ data: { pipelineId: "pipe-principal" } }), listLawHubLeads({ data: { pipelineId: "pipe-futuros" } })]).then(([main, future]) => {
      const first = (main.stages as any[]).find((stage) => !stage.is_won && !stage.is_lost);
      const futureFirst = (future.stages as any[]).find((stage) => !stage.is_won && !stage.is_lost);
      setPrincipalStageId(first?.id || ""); setFutureStageId(futureFirst?.id || "");
    }).catch(() => setPrincipalStageId(""));

    setName(conversation.contact_name || "");
    setPhone(conversation.contact_phone || "");
    setAreaDireito(conversation.ai_detected_area || "Trabalhista");
    setNotes(conversation.ai_summary || "");

    const nextWeek = new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0];
    setFutureDate(nextWeek ?? "");
    setFutureTime("10:00");
    setFutureReason("Cliente prefere aguardar documentação rescisória ou momento oportuno.");

    // Carrega campanhas ativas
    const codes = LawHubAtendimentoService.getCampaignCodes().filter((c) => c.active);
    setCampaignCodes(codes);

    // Verifica se a conversa já possui código ou se o robô reconhece no snippet
    if (conversation.traffic_code) {
      setTrafficCode(conversation.traffic_code);
      setTrafficAction(conversation.traffic_action_name || "");
    } else {
      const detected = LawHubAtendimentoService.detectTrafficCode(conversation.last_message_snippet || "");
      if (detected) {
        setTrafficCode(detected.code);
        setTrafficAction(detected.action_type);
        if (detected.area_direito) setAreaDireito(detected.area_direito);
      } else {
        setTrafficCode("");
        setTrafficAction("");
      }
    }
  }, [isOpen, conversation]);

  if (!isOpen || !conversation) return null;

  // Quando o usuário seleciona uma campanha no dropdown
  const handleSelectCampaign = (codeVal: string) => {
    setTrafficCode(codeVal);
    const matched = campaignCodes.find((c) => c.code === codeVal);
    if (matched) {
      setTrafficAction(matched.action_type);
      setAreaDireito(matched.area_direito);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("O nome do lead é obrigatório.");
      return;
    }

    if (leadType === "futuro" && !futureDate) {
      toast.error("Por favor, informe a data agendada para o contato do Lead Futuro.");
      return;
    }

    try {
      setIsSubmitting(true);
      const actorName = user?.name || "Atendimento Call Center";

      const stageId = leadType === "futuro" ? futureStageId : principalStageId;
      if (!stageId) throw new Error("Pipeline sem etapa configurada no Supabase.");
      const created = await createLawHubLead({ data: {
        stage_id: stageId,
        pipeline_id: leadType === "futuro" ? "pipe-futuros" : "pipe-principal",
        name: name.trim(),
        phone: phone.trim(),
        area_direito: areaDireito,
        lead_type: leadType,
        future_contact_date: leadType === "futuro" ? futureDate : undefined,
        future_contact_time: leadType === "futuro" ? futureTime : undefined,
        future_contact_reason: leadType === "futuro" ? futureReason.trim() : undefined,
        traffic_code: trafficCode.trim() || undefined,
        traffic_action_name: trafficAction.trim() || undefined,
        notes: notes.trim(),
        responsible_name: actorName,
        source: "WhatsApp",
      } });

      if (leadType === "futuro") {
        toast.success(`Lead Futuro agendado para ${futureDate} às ${futureTime}! Notificação agendada no Call Center.`);
      } else {
        toast.success("Lead criado com sucesso e adicionado ao Funil Ativo (LEADs)!");
      }

      onLeadCreated(created);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar criação de lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Gerar Lead a partir do WhatsApp</h3>
              <p className="text-[11px] text-muted-foreground">
                Integração do Call Center com o Funil de Oportunidades
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Seletor Imediato vs Futuro */}
          <div>
            <label className="font-bold text-foreground block mb-1.5">
              Destino do Lead
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setLeadType("imediato")}
                className={cn(
                  "py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                  leadType === "imediato"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>⚡ Lead Imediato</span>
                <span className="text-[10px] opacity-75 font-normal hidden sm:inline">(Funil Ativo)</span>
              </button>

              <button
                type="button"
                onClick={() => setLeadType("futuro")}
                className={cn(
                  "py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                  leadType === "futuro"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Lead Futuro</span>
                <span className="text-[10px] opacity-90 font-normal hidden sm:inline">(Agendar)</span>
              </button>
            </div>
          </div>

          {/* Seção Condicional de Lead Futuro */}
          {leadType === "futuro" && (
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Agendamento de Novo Contato</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O lead ficará em quarentena organizada na aba &quot;Leads Futuros&quot;. No dia agendado, um alerta será disparado no LawHub e na central do Call Center.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Data do Retorno *
                  </label>
                  <input
                    type="date"
                    value={futureDate}
                    onChange={(e) => setFutureDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Horário Previsto
                  </label>
                  <input
                    type="time"
                    value={futureTime}
                    onChange={(e) => setFutureTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Motivo do Contato Futuro
                </label>
                <input
                  type="text"
                  value={futureReason}
                  onChange={(e) => setFutureReason(e.target.value)}
                  placeholder="Ex: Aguardando homologação da rescisão pelo sindicato"
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
            </div>
          )}

          {/* Dados do Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-foreground block mb-1">Nome do Contato *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">Telefone WhatsApp *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Rastreamento de Tráfego Pago & Ação Referenciada */}
          <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-500" />
                Origem: Tráfego Pago / Campanha
              </span>
              {trafficCode && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-600 text-white">
                  {trafficCode}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Código da Campanha
                </label>
                <select
                  value={trafficCode}
                  onChange={(e) => handleSelectCampaign(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground cursor-pointer font-mono font-bold"
                >
                  <option value="">Nenhum / Orgânico</option>
                  {campaignCodes.map((c) => (
                    <option key={c.id} value={c.code}>
                      [{c.code}] {c.action_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Ação Referenciada
                </label>
                <input
                  type="text"
                  value={trafficAction}
                  onChange={(e) => setTrafficAction(e.target.value)}
                  placeholder="Ex: Revisional de FGTS / Horas Extras"
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Área Jurídica */}
          <div>
            <label className="font-semibold text-foreground block mb-1">Área do Direito *</label>
            <select
              value={areaDireito}
              onChange={(e) => setAreaDireito(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary cursor-pointer font-medium"
            >
              <option value="Trabalhista">Trabalhista</option>
              <option value="Previdenciário">Previdenciário (INSS)</option>
              <option value="Cível">Cível / Contratos</option>
              <option value="Cível / Consumidor">Cível / Consumidor</option>
              <option value="Cível / Imobiliário">Cível / Imobiliário</option>
              <option value="Bancário">Bancário</option>
              <option value="Família e Sucessões">Família e Sucessões</option>
              <option value="Tributário">Tributário</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Relato Fático / Resumo da Conversa */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-foreground block">
                Relato Fático / Observações da Triagem
              </label>
              {conversation.ai_summary && (
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Triagem IA
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Descreva as peculiaridades do caso coletadas no WhatsApp..."
              className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className={cn(
                "font-semibold shadow-xs cursor-pointer text-white",
                leadType === "futuro" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {leadType === "futuro" ? "Agendar Lead Futuro" : "Criar e Vincular Lead"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
