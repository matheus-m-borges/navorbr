import { useState, useEffect } from "react";
import { GlassCard, PrimaryButton, GhostButton, Modal } from "@/components/navor-rephub/ui";
import {
  Sun,
  CloudRain,
  Cloud,
  AlertTriangle,
  HardHat,
  Users,
  Plus,
  Calendar,
  Camera,
  FileCheck2,
  Printer,
  ChevronDown,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Download,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface RdoItem {
  id: string;
  obraId: string;
  date: string;
  weatherMorning: "ensolarado" | "nublado" | "chuva_fraca" | "chuva_forte" | "impraticavel";
  weatherAfternoon: "ensolarado" | "nublado" | "chuva_fraca" | "chuva_forte" | "impraticavel";
  workerCountOwn: number;
  workerCountThirdParty: number;
  workersDetail: string;
  equipmentInUse: string;
  activitiesDone: string;
  occurrences: string;
  safetyNotes: string;
  photos: string[];
  engineerName: string;
  engineerCrea: string;
  status: "aprovado" | "em_revisao";
  createdAt: string;
}

interface DiarioObraRdoManagerProps {
  obraId: string;
  obraName: string;
  stages: any[];
}

const WEATHER_OPTIONS = [
  { value: "ensolarado", label: "Ensolarado / Bom", icon: Sun, color: "text-amber-400" },
  { value: "nublado", label: "Nublado", icon: Cloud, color: "text-slate-400" },
  { value: "chuva_fraca", label: "Chuva Fraca", icon: CloudRain, color: "text-blue-400" },
  { value: "chuva_forte", label: "Chuva Forte", icon: CloudRain, color: "text-indigo-400" },
  { value: "impraticavel", label: "Tempo Impraticável", icon: AlertTriangle, color: "text-rose-400" },
] as const;

export function DiarioObraRdoManager({ obraId, obraName, stages }: DiarioObraRdoManagerProps) {
  const [rdos, setRdos] = useState<RdoItem[]>([]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRdo, setSelectedRdo] = useState<RdoItem | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weatherMorning, setWeatherMorning] = useState<RdoItem["weatherMorning"]>("ensolarado");
  const [weatherAfternoon, setWeatherAfternoon] = useState<RdoItem["weatherAfternoon"]>("ensolarado");
  const [workerCountOwn, setWorkerCountOwn] = useState("8");
  const [workerCountThirdParty, setWorkerCountThirdParty] = useState("6");
  const [workersDetail, setWorkersDetail] = useState("4 Pedreiros, 4 Serventes, 2 Eletricistas, 2 Encanadores, 2 Carpinteiros");
  const [equipmentInUse, setEquipmentInUse] = useState("1 Betoneira 400L, 2 Andaimes tubulares, 1 Serra mármore");
  const [activitiesDone, setActivitiesDone] = useState("");
  const [occurrences, setOccurrences] = useState("Sem acidentes de trabalho. Inspeção de segurança realizada no início do turno.");
  const [safetyNotes, setSafetyNotes] = useState("Uso de EPIs obrigatórios (capacete, bota com biqueira e óculos) 100% conforme NR-18.");
  const [engineerName, setEngineerName] = useState("Eng. Responsável Técnico");
  const [engineerCrea, setEngineerCrea] = useState("CREA-PI 14.892/D");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState("");

  // Carregar RDOs salvos no localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`enghub_rdos_${obraId}`);
      if (stored) {
        setRdos(JSON.parse(stored));
      } else {
        // Dados de demonstração padrão
        const initialRdos: RdoItem[] = [
          {
            id: `rdo-demo-1`,
            obraId,
            date: new Date().toISOString().slice(0, 10),
            weatherMorning: "ensolarado",
            weatherAfternoon: "ensolarado",
            workerCountOwn: 10,
            workerCountThirdParty: 6,
            workersDetail: "5 Pedreiros, 5 Serventes, 3 Eletricistas, 3 Armadores",
            equipmentInUse: "1 Betoneira 400L, 1 Guincho de coluna, Andaimes Fachadeiros",
            activitiesDone: "Concretagem dos pilares do 2º pavimento e montagem das fôrmas das vigas V-101 e V-102. Aplicação de chapisco na alvenaria externa.",
            occurrences: "Recebimento de carga de brita nº 1 e cimento CP-II (150 sacos) com NF conferida. Sem ocorrências de acidentes.",
            safetyNotes: "DDS (Diálogo Diário de Segurança) realizado às 07:00 sobre trabalho em altura e ancoragem de cinto tipo paraquedista.",
            photos: [
              "https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80"
            ],
            engineerName: "Eng. Artur Cavalcante",
            engineerCrea: "CREA-PI 22.410/D",
            status: "aprovado",
            createdAt: new Date().toISOString(),
          },
        ];
        setRdos(initialRdos);
        localStorage.setItem(`enghub_rdos_${obraId}`, JSON.stringify(initialRdos));
      }
    } catch {}
  }, [obraId]);

  const saveRdos = (newList: RdoItem[]) => {
    setRdos(newList);
    try {
      localStorage.setItem(`enghub_rdos_${obraId}`, JSON.stringify(newList));
    } catch {}
  };

  const handleCreateRdo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activitiesDone.trim()) {
      toast.error("Preencha as atividades executadas no dia.");
      return;
    }

    const newRdo: RdoItem = {
      id: `rdo-${Date.now()}`,
      obraId,
      date,
      weatherMorning,
      weatherAfternoon,
      workerCountOwn: parseInt(workerCountOwn, 10) || 0,
      workerCountThirdParty: parseInt(workerCountThirdParty, 10) || 0,
      workersDetail,
      equipmentInUse,
      activitiesDone,
      occurrences,
      safetyNotes,
      photos,
      engineerName,
      engineerCrea,
      status: "aprovado",
      createdAt: new Date().toISOString(),
    };

    const updated = [newRdo, ...rdos];
    saveRdos(updated);
    toast.success("Diário de Obra (RDO) registrado e assinado com sucesso!");
    setIsNewModalOpen(false);
    setActivitiesDone("");
    setPhotos([]);
  };

  const handleDeleteRdo = (id: string) => {
    if (!confirm("Deseja realmente remover este registro de RDO?")) return;
    const updated = rdos.filter((r) => r.id !== id);
    saveRdos(updated);
    if (selectedRdo?.id === id) setSelectedRdo(null);
    toast.success("RDO excluído.");
  };

  const handleAddPhoto = () => {
    if (!photoInput.trim()) return;
    setPhotos([...photos, photoInput.trim()]);
    setPhotoInput("");
  };

  const handlePrintRdo = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho do RDO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <ClipboardList className="size-5 text-gold" />
            Diário de Obra Digital (RDO)
          </h3>
          <p className="text-xs text-muted-foreground">
            Acompanhamento diário de contingências, efetivo, clima, avanço físico e segurança
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-background hover:bg-yellow-400 transition shadow-xs cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Novo RDO</span>
          </button>
        </div>
      </div>

      {/* Resumo Rápido de Efetivo e Clima */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total de RDOs
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-white">{rdos.length}</span>
            <span className="text-xs text-muted-foreground">dias registrados</span>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Último Efetivo
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-gold">
              {rdos[0] ? rdos[0].workerCountOwn + rdos[0].workerCountThirdParty : 0}
            </span>
            <span className="text-xs text-muted-foreground">operários em campo</span>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Conformidade CREA/CAU
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>ART / RDO Regular</span>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Segurança do Trabalho
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>0 Incidentes</span>
          </div>
        </GlassCard>
      </div>

      {/* Lista de RDOs Registrados */}
      <div className="space-y-3">
        {rdos.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-2">
            <HardHat className="size-10 text-gold/40 mx-auto" />
            <h4 className="text-sm font-bold text-white">Nenhum Diário de Obra registrado ainda</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Clique no botão "Novo RDO" para registrar o efetivo do dia, as condições climáticas e as atividades concluídas.
            </p>
          </GlassCard>
        ) : (
          rdos.map((rdo) => {
            const morningOpt = WEATHER_OPTIONS.find((w) => w.value === rdo.weatherMorning) || WEATHER_OPTIONS[0];
            const afternoonOpt = WEATHER_OPTIONS.find((w) => w.value === rdo.weatherAfternoon) || WEATHER_OPTIONS[0];
            const MorningIcon = morningOpt.icon;
            const AfternoonIcon = afternoonOpt.icon;

            return (
              <GlassCard
                key={rdo.id}
                className="p-5 space-y-4 hover:border-gold/30 transition border-white/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20">
                      <Calendar className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          RDO de {new Date(rdo.date + "T12:00:00").toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric"
                          })}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          {rdo.status === "aprovado" ? "Validado / RT" : "Em Revisão"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5 text-gold" />
                          Efetivo: <strong>{rdo.workerCountOwn + rdo.workerCountThirdParty}</strong> (
                          {rdo.workerCountOwn} próprios + {rdo.workerCountThirdParty} terceiros)
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <HardHat className="size-3.5" />
                          {rdo.engineerName} ({rdo.engineerCrea})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Condições Climáticas e Ações */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1 text-xs border border-white/5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase">M:</span>
                        <MorningIcon className={cn("size-3.5", morningOpt.color)} />
                      </div>
                      <span className="text-white/20">|</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase">T:</span>
                        <AfternoonIcon className={cn("size-3.5", afternoonOpt.color)} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRdo(rdo)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/10 transition cursor-pointer"
                    >
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRdo(rdo.id)}
                      className="text-white/40 hover:text-rose-400 p-1 transition"
                      title="Excluir RDO"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Conteúdo Principal do Dia */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2 space-y-1.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-gold">
                      Atividades Desenvolvidas
                    </span>
                    <p className="text-white/80 leading-relaxed whitespace-pre-line bg-white/5 p-3 rounded-lg border border-white/5">
                      {rdo.activitiesDone}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground block mb-1">
                        Equipamentos em Uso
                      </span>
                      <p className="text-muted-foreground bg-white/5 p-2 rounded-lg border border-white/5">
                        {rdo.equipmentInUse || "Nenhum equipamento especial alocado."}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground block mb-1">
                        Segurança & Ocorrências
                      </span>
                      <p className="text-muted-foreground bg-white/5 p-2 rounded-lg border border-white/5">
                        {rdo.occurrences}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fotos do Dia (se houver) */}
                {rdo.photos && rdo.photos.length > 0 && (
                  <div className="pt-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground block mb-1.5">
                      Registro Fotográfico ({rdo.photos.length})
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {rdo.photos.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Canteiro foto ${idx + 1}`}
                          className="size-20 rounded-lg object-cover border border-white/10 hover:scale-105 transition"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Modal Novo RDO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="font-display font-bold text-base text-white">
                  Novo Registro Diário de Obra (RDO)
                </h4>
                <p className="text-xs text-muted-foreground">{obraName}</p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-muted-foreground hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRdo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Data da Ocorrência *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Clima (Manhã) *</label>
                  <select
                    value={weatherMorning}
                    onChange={(e) => setWeatherMorning(e.target.value as any)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  >
                    {WEATHER_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Clima (Tarde) *</label>
                  <select
                    value={weatherAfternoon}
                    onChange={(e) => setWeatherAfternoon(e.target.value as any)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  >
                    {WEATHER_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Efetivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Mão de Obra Própria (Qtd)</label>
                  <input
                    type="number"
                    min="0"
                    value={workerCountOwn}
                    onChange={(e) => setWorkerCountOwn(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Mão de Obra Terceirizada (Qtd)</label>
                  <input
                    type="number"
                    min="0"
                    value={workerCountThirdParty}
                    onChange={(e) => setWorkerCountThirdParty(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Detalhamento dos Profissionais</label>
                <input
                  type="text"
                  placeholder="Ex: 6 Pedreiros, 4 Serventes, 2 Eletricistas..."
                  value={workersDetail}
                  onChange={(e) => setWorkersDetail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Equipamentos em Operação</label>
                <input
                  type="text"
                  placeholder="Ex: 1 Betoneira 400L, 2 Andaimes..."
                  value={equipmentInUse}
                  onChange={(e) => setEquipmentInUse(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Atividades Desenvolvidas no Dia *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Descreva em detalhes o avanço dos serviços nas etapas..."
                  value={activitiesDone}
                  onChange={(e) => setActivitiesDone(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Ocorrências / Recebimentos de Carga</label>
                  <input
                    type="text"
                    value={occurrences}
                    onChange={(e) => setOccurrences(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Segurança do Trabalho (NR-18)</label>
                  <input
                    type="text"
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Engenheiro / Responsável Técnico</label>
                  <input
                    type="text"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Registro CREA / CAU</label>
                  <input
                    type="text"
                    value={engineerCrea}
                    onChange={(e) => setEngineerCrea(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              {/* Inserir URL de Foto */}
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Adicionar Foto do Canteiro (URL)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/foto-obra.jpg"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className="rounded-lg bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20 transition"
                  >
                    Adicionar
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {photos.map((p, i) => (
                      <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded text-white truncate max-w-[150px]">
                        Foto #{i + 1}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-gold px-4 py-2 font-bold text-background hover:bg-yellow-400 transition cursor-pointer shadow-xs"
                >
                  Salvar e Assinar RDO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizador & Impressão Técnica de RDO */}
      {selectedRdo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-5 text-gold" />
                <h4 className="font-display font-bold text-base text-white">
                  Relatório Diário de Obra — {new Date(selectedRdo.date + "T12:00:00").toLocaleDateString("pt-BR")}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintRdo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <Printer className="size-3.5 text-gold" />
                  Imprimir / PDF
                </button>
                <button
                  onClick={() => setSelectedRdo(null)}
                  className="text-muted-foreground hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Layout de Impressão Timbrado */}
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Obra / Empreendimento</span>
                  <span className="font-bold text-sm text-gold">{obraName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Responsável Técnico</span>
                  <span className="font-bold">{selectedRdo.engineerName}</span>
                  <span className="text-[10px] text-muted-foreground block">{selectedRdo.engineerCrea}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Condições Climáticas</span>
                  <span>Manhã: {selectedRdo.weatherMorning} • Tarde: {selectedRdo.weatherAfternoon}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Efetivo de Campo</span>
                  <span>{selectedRdo.workerCountOwn + selectedRdo.workerCountThirdParty} trabalhadores</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status da Validação</span>
                  <span className="text-emerald-400 font-bold">100% Homologado</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gold uppercase font-bold block mb-1">Atividades e Evolução Física</span>
                <p className="leading-relaxed whitespace-pre-line text-white/90 bg-black/30 p-3 rounded-lg">
                  {selectedRdo.activitiesDone}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Equipamentos & Máquinas</span>
                <p className="text-muted-foreground">{selectedRdo.equipmentInUse}</p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Ocorrências e Segurança</span>
                <p className="text-muted-foreground">{selectedRdo.occurrences}</p>
              </div>

              {selectedRdo.photos && selectedRdo.photos.length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1.5">Acervo Fotográfico</span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRdo.photos.map((p, idx) => (
                      <img key={idx} src={p} alt="" className="rounded-lg w-full h-32 object-cover border border-white/10" />
                    ))}
                  </div>
                </div>
              )}

              {/* Assinatura */}
              <div className="pt-4 grid grid-cols-2 gap-6 text-center text-[11px] border-t border-white/10">
                <div>
                  <div className="border-t border-white/20 pt-1 mt-6">
                    <p className="font-bold">{selectedRdo.engineerName}</p>
                    <p className="text-[10px] text-muted-foreground">Engenheiro Civil / Fiscal</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-white/20 pt-1 mt-6">
                    <p className="font-bold">Mestre de Obras / Encarregado</p>
                    <p className="text-[10px] text-muted-foreground">Fiscalização de Campo</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRdo(null)}
                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
