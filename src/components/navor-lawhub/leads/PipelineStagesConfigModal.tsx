// @ts-nocheck — tipos legados do LawHub em migração
import React, { useState } from 'react';
import { 
  X, 
  Settings2, 
  Plus, 
  Trash2, 
  Clock, 
  Trophy, 
  XCircle, 
  ShieldAlert, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Check
} from 'lucide-react';
import { LawLeadPipelineStage, PIPELINE_TEMPLATES } from '@/lib/lawhub/lead-types';
import { toast } from 'sonner';
import { createLawHubLeadStage, deleteLawHubLeadStage, updateLawHubLeadStage } from '@/lib/lawhub/lead.functions';

interface PipelineStagesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LawLeadPipelineStage[];
  onStagesUpdated: (newStages: LawLeadPipelineStage[]) => void;
}

export const PipelineStagesConfigModal: React.FC<PipelineStagesConfigModalProps> = ({
  isOpen,
  onClose,
  stages: initialStages,
  onStagesUpdated,
}) => {
  const [stages, setStages] = useState<LawLeadPipelineStage[]>(initialStages);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#eab308');
  const [newStageSla, setNewStageSla] = useState<number | undefined>(48);

  if (!isOpen) return null;

  const handleApplyTemplate = (templateKey: keyof typeof PIPELINE_TEMPLATES) => {
    const template = PIPELINE_TEMPLATES[templateKey];
    if (!template) return;

    if (window.confirm(`Deseja carregar o template "${template.name}"? Isso substituirá a configuração atual de etapas.`)) {
      toast.error('Templates locais foram desativados; crie e configure etapas reais no Supabase.');
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast.error('Informe o nome da etapa.');
      return;
    }

    try {
      const created = await createLawHubLeadStage({ data: { stage: {
        name: newStageName.trim(),
        color: newStageColor,
        sla_hours: newStageSla || undefined,
        position: stages.length + 1,
        is_won: false,
        is_lost: false,
        is_conflict: false,
      } } });

      const updated = [...stages, created];
      setStages(updated);
      onStagesUpdated(updated);
      setNewStageName('');
      toast.success('Etapa adicionada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar etapa.');
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (stages.length <= 2) {
      toast.error('O funil deve possuir pelo menos duas etapas.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta etapa?')) {
      await deleteLawHubLeadStage({ data: { stageId } });
      const updated = stages.filter(s => s.id !== stageId);
      setStages(updated);
      onStagesUpdated(updated);
      toast.success('Etapa removida.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;

    const copy = [...stages];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;

    const reordered = copy.map((st, i) => ({ ...st, position: i + 1 }));
    setStages(reordered);
    for (const stage of reordered) await updateLawHubLeadStage({ data: { stageId: stage.id, updates: { position: stage.position } } });
    onStagesUpdated(reordered);
  };

  const handleUpdateField = async (stageId: string, updates: Partial<LawLeadPipelineStage>) => {
    const updated = await updateLawHubLeadStage({ data: { stageId, updates } });
    const newStages = stages.map(s => s.id === stageId ? updated : s);
    setStages(newStages);
    onStagesUpdated(newStages);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Personalizar Funil de Atendimento</h2>
              <p className="text-xs text-slate-400">Ajuste etapas, cores, regras de SLA e templates por área jurídica</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Templates Rápidos */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Templates Pré-Configurados por Especialidade
              </div>
              <span className="text-[11px] text-slate-500">Substitui o fluxo com 1 clique</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(PIPELINE_TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyTemplate(key as any)}
                  className="p-3 text-left bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/30 rounded-lg transition-all group"
                >
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                    {tpl.name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {tpl.stages.length} etapas definidas
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Etapas Atuais */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Etapas do Funil ({stages.length})
              </h3>
              <span className="text-xs text-slate-500">Reordene ou ajuste alertas de SLA</span>
            </div>

            <div className="space-y-2">
              {stages.map((st, idx) => (
                <div 
                  key={st.id}
                  className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700/80 transition-all"
                >
                  {/* Controles de Reordenação */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                      title="Mover para cima"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === stages.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cor da Etapa */}
                  <input
                    type="color"
                    value={st.color}
                    onChange={(e) => handleUpdateField(st.id, { color: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer shrink-0"
                    title="Alterar cor da etapa"
                  />

                  {/* Nome da Etapa */}
                  <input
                    type="text"
                    value={st.name}
                    onChange={(e) => handleUpdateField(st.id, { name: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />

                  {/* SLA em Horas */}
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg shrink-0" title="Horas máximas permitidas nesta etapa">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      placeholder="SLA (h)"
                      value={st.sla_hours || ''}
                      onChange={(e) => handleUpdateField(st.id, { sla_hours: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-14 bg-transparent text-xs text-slate-200 text-right focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500">h</span>
                  </div>

                  {/* Badges de Tipo */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateField(st.id, { is_won: !st.is_won, is_lost: false, is_conflict: false })}
                      className={`p-1.5 rounded-md border text-xs transition-colors ${
                        st.is_won ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                      title="Marcar como etapa Ganha (Gera cliente e processo)"
                    >
                      <Trophy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateField(st.id, { is_lost: !st.is_lost, is_won: false, is_conflict: false })}
                      className={`p-1.5 rounded-md border text-xs transition-colors ${
                        st.is_lost ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                      title="Marcar como etapa Perdida / Desqualificada"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateField(st.id, { is_conflict: !st.is_conflict, is_won: false, is_lost: false })}
                      className={`p-1.5 rounded-md border text-xs transition-colors ${
                        st.is_conflict ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                      title="Marcar como etapa Conflito de Interesses"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Deletar Etapa */}
                  <button
                    type="button"
                    onClick={() => handleDeleteStage(st.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Excluir etapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Adicionar Nova Etapa */}
          <div className="pt-3 border-t border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Criar Nova Etapa
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                placeholder="Nome da etapa (ex: Aguardando Procuração)"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg shrink-0">
                <Clock className="w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  placeholder="SLA (h)"
                  value={newStageSla || ''}
                  onChange={(e) => setNewStageSla(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-16 bg-transparent text-xs text-slate-200 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddStage}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-amber-400" />
            Concluir Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
