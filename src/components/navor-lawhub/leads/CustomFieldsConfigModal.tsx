// @ts-nocheck — tipos legados do LawHub em migração
import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Plus, 
  Trash2, 
  Check, 
  FileCode, 
  Tag,
  ListFilter
} from 'lucide-react';
import { LawLeadCustomField, CustomFieldType, AreaDireito } from '@/lib/lawhub/lead-types';
import { toast } from 'sonner';
import { createLawHubLeadCustomField, deleteLawHubLeadCustomField } from '@/lib/lawhub/lead.functions';

interface CustomFieldsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  customFields: LawLeadCustomField[];
  onFieldsUpdated: (fields: LawLeadCustomField[]) => void;
}

export const CustomFieldsConfigModal: React.FC<CustomFieldsConfigModalProps> = ({
  isOpen,
  onClose,
  customFields: initialFields,
  onFieldsUpdated,
}) => {
  const [fields, setFields] = useState<LawLeadCustomField[]>(initialFields);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [area, setArea] = useState<string>('');
  const [isRequired, setIsRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState('');

  if (!isOpen) return null;

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Informe o rótulo do campo.');
      return;
    }

    const fieldKey = label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    const options = fieldType === 'select' && optionsStr.trim()
      ? optionsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    try {
      const created = await createLawHubLeadCustomField({ data: { field: {
        label: label.trim(),
        field_key: fieldKey,
        field_type: fieldType,
        area: area || undefined,
        is_required: isRequired,
        options,
        position: fields.length + 1,
      } } });

      const updated = [...fields, created];
      setFields(updated);
      onFieldsUpdated(updated);
      setLabel('');
      setOptionsStr('');
      setIsRequired(false);
      toast.success(`Campo "${created.label}" criado com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar campo customizado.');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (window.confirm('Tem certeza que deseja remover este campo personalizado?')) {
      await deleteLawHubLeadCustomField({ data: { fieldId } });
      const updated = fields.filter(f => f.id !== fieldId);
      setFields(updated);
      onFieldsUpdated(updated);
      toast.success('Campo removido.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Motor de Campos Customizados</h2>
              <p className="text-xs text-slate-400">Defina dados específicos por área jurídica (ex: Salário, Regime Tributário)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Formulário de Novo Campo */}
          <form onSubmit={handleAddField} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Adicionar Novo Campo Dinâmico
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rótulo / Pergunta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Último Salário Bruto"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tipo de Dado</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="text">Texto Curto</option>
                  <option value="number">Número Inteiro</option>
                  <option value="currency">Moeda (R$)</option>
                  <option value="date">Data</option>
                  <option value="select">Lista de Seleção (Dropdown)</option>
                  <option value="boolean">Sim / Não (Checkbox)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Área do Direito (Opcional)</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Todas as Áreas (Geral)</option>
                  <option value="Trabalhista">Trabalhista</option>
                  <option value="Cível">Cível</option>
                  <option value="Tributário">Tributário</option>
                  <option value="Empresarial">Empresarial</option>
                  <option value="Família">Família</option>
                  <option value="Previdenciário">Previdenciário</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="chk-req"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500/20"
                />
                <label htmlFor="chk-req" className="text-xs text-slate-300">
                  Campo Obrigatório na Triagem
                </label>
              </div>

              {fieldType === 'select' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Opções de Escolha (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="Opção A, Opção B, Opção C"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Cadastrar Campo
              </button>
            </div>
          </form>

          {/* Lista de Campos Existentes */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Campos Ativos ({fields.length})
            </h3>

            {fields.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 border border-slate-800 rounded-xl text-slate-500 text-xs">
                Nenhum campo personalizado cadastrado até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200">{f.label}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {f.field_key}
                          </span>
                          {f.is_required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tipo: <strong className="text-slate-400 capitalize">{f.field_type}</strong> | Área: <strong className="text-slate-400">{f.area || 'Todas'}</strong>
                          {f.options && f.options.length > 0 && ` | [${f.options.join(', ')}]`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteField(f.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
                      title="Excluir campo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
