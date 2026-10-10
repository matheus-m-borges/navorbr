// @ts-nocheck — tipos legados do LawHub em migração
import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  DollarSign, 
  Calendar, 
  Phone, 
  Mail, 
  FileText, 
  Building2,
  AlertTriangle
} from 'lucide-react';
import { LawLead, LawLeadPipelineStage, LawLeadCustomField, AreaDireito } from '@/lib/lawhub/lead-types';
import { LawHubAtendimentoService } from '@/lib/lawhub/atendimento-service';
import { toast } from 'sonner';
import { checkLawHubLeadConflict, createLawHubLead } from '@/lib/lawhub/lead.functions';
import { cn } from '@/lib/utils';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LawLeadPipelineStage[];
  customFields: LawLeadCustomField[];
  onLeadCreated: (lead: LawLead) => void;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  stages,
  customFields,
  onLeadCreated,
}) => {
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [areaDireito, setAreaDireito] = useState<AreaDireito>('Trabalhista');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [leadType, setLeadType] = useState<'imediato' | 'futuro'>('imediato');
  const [futureDate, setFutureDate] = useState(() => new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
  const [futureTime, setFutureTime] = useState('10:00');
  const [futureReason, setFutureReason] = useState('');
  const [trafficCode, setTrafficCode] = useState('');
  const [trafficAction, setTrafficAction] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [opposingPartyDoc, setOpposingPartyDoc] = useState('');
  const [source, setSource] = useState('Indicação');
  const [estimatedSuccessRate, setEstimatedSuccessRate] = useState<'alta' | 'media' | 'baixa'>('alta');
  const [notes, setNotes] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const campaignCodes = React.useMemo(() => {
    return LawHubAtendimentoService.getCampaignCodes().filter((c) => c.active);
  }, []);

  const handleSelectCampaign = (codeVal: string) => {
    setTrafficCode(codeVal);
    const matched = campaignCodes.find((c) => c.code === codeVal);
    if (matched) {
      setTrafficAction(matched.action_type);
      setAreaDireito(matched.area_direito as AreaDireito);
      setSource(`Tráfego Pago (${matched.code})`);
    }
  };

  // Checagem de conflito instantânea ao digitar parte contrária
  const [conflictCheck, setConflictCheck] = useState<{ hasConflict: boolean; notes: string; matchedRecords: Array<{ type: 'client' | 'process'; name: string; details?: string }> }>({ hasConflict: false, notes: '', matchedRecords: [] });
  React.useEffect(() => {
    let cancelled = false;
    if (!opposingParty.trim() && !opposingPartyDoc.trim()) {
      setConflictCheck({ hasConflict: false, notes: '', matchedRecords: [] });
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkLawHubLeadConflict({ data: { opposingParty, opposingPartyDoc } });
        if (!cancelled) setConflictCheck(result);
      } catch {
        if (!cancelled) setConflictCheck({ hasConflict: false, notes: 'Checagem indisponível; a gravação será interrompida se a base não puder ser consultada.', matchedRecords: [] });
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [opposingParty, opposingPartyDoc]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do lead / potencial cliente.');
      return;
    }

    if (leadType === 'futuro' && !futureDate) {
      toast.error('Informe a data para o contato futuro.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createLawHubLead({ data: {
        name: name.trim(),
        document_number: documentNumber.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        area_direito: areaDireito,
        stage_id: stageId || stages[0]?.id,
        opposing_party: opposingParty.trim() || undefined,
        opposing_party_doc: opposingPartyDoc.trim() || undefined,
        source: trafficCode ? `Tráfego Pago (${trafficCode})` : (source.trim() || 'Indicação'),
        estimated_success_rate: estimatedSuccessRate,
        notes: notes.trim() || undefined,
        custom_fields: customFieldValues,
        lead_type: leadType,
        future_contact_date: leadType === 'futuro' ? futureDate : undefined,
        future_contact_time: leadType === 'futuro' ? futureTime : undefined,
        future_contact_reason: leadType === 'futuro' ? futureReason.trim() : undefined,
        traffic_code: trafficCode || undefined,
        traffic_action_name: trafficAction || undefined,
      } });

      if (leadType === 'futuro') {
        toast.success(`Lead Futuro "${created.name}" agendado para ${futureDate}!`);
      } else {
        toast.success(`Lead "${created.name}" cadastrado com sucesso no funil!`);
      }
      onLeadCreated(created);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Topo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Novo Lead Jurídico</h2>
              <p className="text-xs text-slate-400">Cadastre a oportunidade e inicie a triagem no funil</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alerta de Conflito em Tempo Real */}
          {conflictCheck.hasConflict && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3 text-red-200 text-sm">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-red-300 font-semibold mb-1">
                  Alerta Ético de Conflito de Interesses Detectado!
                </strong>
                <p className="text-xs text-red-300/90 mb-2">
                  A parte contrária informada já possui vínculo registrado na base deste escritório:
                </p>
                <ul className="text-xs list-disc list-inside space-y-1 text-red-200">
                  {conflictCheck.matchedRecords.map((m, idx) => (
                    <li key={idx}>
                      <span className="font-medium capitalize">{m.type === 'client' ? 'Cliente Ativo' : 'Processo Existente'}:</span> {m.name} {m.details && `(${m.details})`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Dados do Potencial Cliente */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Identificação do Lead
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva ou Construtora Alfa Ltda"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">CPF ou CNPJ</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="(11) 99999-8888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dados Jurídicos e Enquadramento */}
          <div className="pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Triagem Jurídica e Risco
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Área do Direito</label>
                <select
                  value={areaDireito}
                  onChange={(e) => setAreaDireito(e.target.value as AreaDireito)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="Trabalhista">Trabalhista</option>
                  <option value="Cível">Cível</option>
                  <option value="Tributário">Tributário</option>
                  <option value="Empresarial">Empresarial</option>
                  <option value="Família">Família</option>
                  <option value="Previdenciário">Previdenciário</option>
                  <option value="Criminal">Criminal</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Etapa Inicial do Funil</label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.sla_hours ? `(${st.sla_hours}h SLA)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Parte Contrária (Reclamada / Réu)</label>
                <input
                  type="text"
                  placeholder="Ex: Banco S.A., Antiga Empresa"
                  value={opposingParty}
                  onChange={(e) => setOpposingParty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Doc. Parte Contrária (CNPJ/CPF)</label>
                <input
                  type="text"
                  placeholder="Para checagem automática"
                  value={opposingPartyDoc}
                  onChange={(e) => setOpposingPartyDoc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Tipo de Lead: Imediato vs Futuro */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Classificação do Lead</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLeadType("imediato")}
                    className={cn(
                      "py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                      leadType === "imediato"
                        ? "bg-slate-800 text-amber-400 border border-amber-500/40"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span>⚡ Lead Imediato</span>
                    <span className="text-[10px] font-normal opacity-75">(Funil Ativo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadType("futuro")}
                    className={cn(
                      "py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                      leadType === "futuro"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Lead Futuro</span>
                    <span className="text-[10px] font-normal opacity-85">(Agendar)</span>
                  </button>
                </div>
              </div>

              {/* Se for Lead Futuro: data, hora e motivo */}
              {leadType === "futuro" && (
                <div className="md:col-span-2 p-3.5 rounded-xl border border-indigo-500/40 bg-indigo-950/20 space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                    <Calendar className="w-4 h-4" />
                    <span>Agendamento para Contato Futuro</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Data Prevista *</label>
                      <input
                        type="date"
                        value={futureDate}
                        onChange={(e) => setFutureDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Horário Previsto</label>
                      <input
                        type="time"
                        value={futureTime}
                        onChange={(e) => setFutureTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Motivo do Retorno Posterior</label>
                    <input
                      type="text"
                      placeholder="Ex: Aguardando rescisão ou retorno após viagem"
                      value={futureReason}
                      onChange={(e) => setFutureReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Tráfego Pago / Campanha */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Código de Tráfego Pago / Anúncio</label>
                <select
                  value={trafficCode}
                  onChange={(e) => handleSelectCampaign(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500/50"
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Ação Referenciada</label>
                <input
                  type="text"
                  placeholder="Ex: Revisional de FGTS / Horas Extras"
                  value={trafficAction}
                  onChange={(e) => setTrafficAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Probabilidade de Êxito</label>
                <select
                  value={estimatedSuccessRate}
                  onChange={(e) => setEstimatedSuccessRate(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="alta">Alta Probabilidade (Tese Pacífica / Prova Robusta)</option>
                  <option value="media">Média Probabilidade (Controvérsia Probante)</option>
                  <option value="baixa">Baixa / Risco Elevado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Canal de Origem</label>
                <input
                  type="text"
                  placeholder="Ex: Google Ads, Indicação, Instagram"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Campos Customizados Dinâmicos Cadastrados para a Área */}
          {customFields.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Campos Específicos do Escritório
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map((cf) => (
                  <div key={cf.id}>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {cf.label} {cf.is_required && '*'}
                    </label>
                    {cf.field_type === 'select' ? (
                      <select
                        value={customFieldValues[cf.field_key] || ''}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.field_key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">Selecione...</option>
                        {cf.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : cf.field_type === 'boolean' ? (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id={`cf-${cf.id}`}
                          checked={!!customFieldValues[cf.field_key]}
                          onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.field_key]: e.target.checked }))}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500/20"
                        />
                        <label htmlFor={`cf-${cf.id}`} className="text-xs text-slate-300">Sim / Confirmado</label>
                      </div>
                    ) : (
                      <input
                        type={cf.field_type === 'number' || cf.field_type === 'currency' ? 'number' : cf.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues[cf.field_key] || ''}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.field_key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relato Preliminar / Notas */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-medium text-slate-300 mb-1">Notas Preliminares / Relato dos Fatos</label>
            <textarea
              rows={3}
              placeholder="Descreva o que o cliente relatou no primeiro contato..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Criar Lead no Funil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
