import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Navigation,
  MapPin,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Car,
  Clock,
  Printer,
  CheckCircle2,
  Calendar,
  Building2,
  Phone,
  MessageCircle,
  Save,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  GlassCard,
  PrimaryButton,
  GhostButton,
  SectionTitle,
  StatusBadge,
  TextInput,
  SelectInput,
  Modal,
  EmptyState,
} from "@/components/navor-rephub/ui";
import { useClients, type Client } from "@/hooks/useCrm";
import { UF_LIST, whatsappLink } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/rotas")({
  head: () => ({
    meta: [
      { title: "Rotas de Viagem | CRM Representação" },
      {
        name: "description",
        content: "Planejamento logístico de visitas comerciais a clientes e roteiros de atendimento.",
      },
    ],
  }),
  component: RotasPage,
});

export interface RouteStop {
  id: string;
  clientId?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
  notes?: string;
  status: "Planejada" | "Em Rota" | "Concluída" | "Cancelada";
  scheduledTime?: string;
}

export interface SavedRoute {
  id: string;
  title: string;
  date: string;
  origin: string;
  stops: RouteStop[];
  createdAt: string;
}

const STORAGE_KEY = "navor_rephub_saved_routes";
const ACTIVE_ROUTE_KEY = "navor_rephub_active_route";

export function RotasPage() {
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  const [routeTitle, setRouteTitle] = useState("Roteiro Comercial");
  const [routeDate, setRouteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [originAddress, setOriginAddress] = useState("Sede Comercial / Escritório Central");
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);

  // Search & filter for adding clients
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCustomStopModalOpen, setIsCustomStopModalOpen] = useState(false);
  const [customStopName, setCustomStopName] = useState("");
  const [customStopAddress, setCustomStopAddress] = useState("");
  const [customStopCity, setCustomStopCity] = useState("");
  const [customStopState, setCustomStopState] = useState("MG");

  // Load saved routes and active draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSavedRoutes(JSON.parse(saved));
      }
      const active = localStorage.getItem(ACTIVE_ROUTE_KEY);
      if (active) {
        const parsed = JSON.parse(active);
        setRouteTitle(parsed.title || "Roteiro Comercial");
        setRouteDate(parsed.date || new Date().toISOString().slice(0, 10));
        setOriginAddress(parsed.origin || "Sede Comercial / Escritório Central");
        setStops(parsed.stops || []);
      }
    } catch (e) {
      console.warn("Erro ao carregar rotas do localStorage:", e);
    }
  }, []);

  // Save active route draft
  const saveDraft = (updatedStops: RouteStop[]) => {
    setStops(updatedStops);
    try {
      localStorage.setItem(
        ACTIVE_ROUTE_KEY,
        JSON.stringify({
          title: routeTitle,
          date: routeDate,
          origin: originAddress,
          stops: updatedStops,
        })
      );
    } catch (e) {}
  };

  const handleSaveRoute = () => {
    if (stops.length === 0) {
      toast.error("Adicione ao menos um cliente ou parada ao roteiro.");
      return;
    }
    const newRoute: SavedRoute = {
      id: "route-" + Date.now(),
      title: routeTitle || "Roteiro " + routeDate,
      date: routeDate,
      origin: originAddress,
      stops: [...stops],
      createdAt: new Date().toISOString(),
    };

    const updated = [newRoute, ...savedRoutes.filter((r) => r.id !== newRoute.id)];
    setSavedRoutes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    toast.success("Roteiro salvo com sucesso no seu histórico!");
  };

  const handleLoadRoute = (r: SavedRoute) => {
    setRouteTitle(r.title);
    setRouteDate(r.date);
    setOriginAddress(r.origin);
    saveDraft(r.stops);
    toast.info(`Roteiro '${r.title}' carregado.`);
  };

  const handleDeleteSavedRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedRoutes.filter((r) => r.id !== id);
    setSavedRoutes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    toast.success("Roteiro excluído do histórico.");
  };

  // Move stops
  const moveStop = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= stops.length) return;
    const copy = [...stops];
    const item = copy.splice(index, 1)[0];
    if (!item) return;
    copy.splice(target, 0, item);
    saveDraft(copy);
  };

  const removeStop = (id: string) => {
    const updated = stops.filter((s) => s.id !== id);
    saveDraft(updated);
    toast.info("Parada removida da rota.");
  };

  const updateStopStatus = (id: string, status: RouteStop["status"]) => {
    const updated = stops.map((s) => (s.id === id ? { ...s, status } : s));
    saveDraft(updated);
    toast.success(`Status da visita atualizado para ${status}.`);
  };

  const addClientToRoute = (client: Client) => {
    if (stops.some((s) => s.clientId === client.id)) {
      toast.warning("Este cliente já está no roteiro atual.");
      return;
    }
    const clientName = client.trade_name || client.legal_name;
    const fullAddress = [client.address, client.city, client.state]
      .filter(Boolean)
      .join(", ");

    const newStop: RouteStop = {
      id: "stop-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      clientId: client.id,
      name: clientName,
      address: fullAddress || clientName,
      city: client.city || "",
      state: client.state || "",
      phone: client.phone || client.whatsapp || undefined,
      status: "Planejada",
      scheduledTime: "09:00",
    };

    saveDraft([...stops, newStop]);
    toast.success(`${clientName} adicionado à rota.`);
  };

  const handleAddCustomStop = () => {
    if (!customStopName.trim()) {
      toast.error("Informe o nome do ponto de parada.");
      return;
    }
    const fullAddress = [customStopAddress, customStopCity, customStopState]
      .filter(Boolean)
      .join(", ");

    const newStop: RouteStop = {
      id: "stop-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: customStopName.trim(),
      address: fullAddress || customStopName.trim(),
      city: customStopCity.trim(),
      state: customStopState,
      status: "Planejada",
      scheduledTime: "12:00",
    };

    saveDraft([...stops, newStop]);
    setIsCustomStopModalOpen(false);
    setCustomStopName("");
    setCustomStopAddress("");
    setCustomStopCity("");
    toast.success("Parada personalizada adicionada.");
  };

  // Google Maps Multi-Destination Link
  const googleMapsUrl = useMemo(() => {
    if (stops.length === 0) return null;
    const destinationStop = stops.at(-1);
    if (!destinationStop) return null;
    const origin = encodeURIComponent(originAddress || "Brasil");
    const destination = encodeURIComponent(destinationStop.address);
    const waypoints = stops
      .slice(0, -1)
      .map((s) => encodeURIComponent(s.address))
      .join("|");

    if (waypoints) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }, [originAddress, stops]);

  // Waze Link for the next pending stop
  const nextPendingStop = useMemo(() => {
    return stops.find((s) => s.status === "Planejada" || s.status === "Em Rota");
  }, [stops]);

  const wazeUrl = useMemo(() => {
    if (!nextPendingStop) return null;
    return `https://waze.com/ul?q=${encodeURIComponent(nextPendingStop.address)}`;
  }, [nextPendingStop]);

  // Filter clients for modal
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !searchTerm ||
        (c.trade_name || c.legal_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.state || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchState = !filterState || c.state === filterState;
      const matchCity =
        !filterCity || (c.city || "").toLowerCase().includes(filterCity.toLowerCase());
      return matchSearch && matchState && matchCity;
    });
  }, [clients, searchTerm, filterState, filterCity]);

  // Available cities from client list
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set).sort();
  }, [clients]);

  return (
    <AppShell
      title="Rotas de Viagem"
      subtitle="Planejamento logístico de visitas comerciais e roteiros de atendimento a clientes"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {savedRoutes.length > 0 && (
            <div className="relative">
              <select
                onChange={(e) => {
                  const r = savedRoutes.find((x) => x.id === e.target.value);
                  if (r) handleLoadRoute(r);
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>
                  Carregar Roteiro Salvo ({savedRoutes.length})
                </option>
                {savedRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.stops.length} paradas - {r.date})
                  </option>
                ))}
              </select>
            </div>
          )}
          <GhostButton onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="size-3.5" />
            Imprimir Roteiro
          </GhostButton>
          <PrimaryButton onClick={handleSaveRoute} className="gap-1.5 text-xs">
            <Save className="size-3.5" />
            Salvar Roteiro
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Control Bar: Route Metadata & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Configuração da Viagem
              </span>
              <button
                onClick={() => {
                  if (confirm("Deseja limpar todo o roteiro atual?")) {
                    saveDraft([]);
                  }
                }}
                className="text-xs text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                Limpar Rota
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Nome do Roteiro:
                </label>
                <TextInput
                  value={routeTitle}
                  onChange={(e) => setRouteTitle(e.target.value)}
                  placeholder="Ex: Roteiro Sul de Minas"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Data Prevista:
                </label>
                <TextInput
                  type="date"
                  value={routeDate}
                  onChange={(e) => setRouteDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Ponto de Partida / Origem:
              </label>
              <TextInput
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="Ex: Escritório Central / Cidade de saída"
              />
            </div>
          </GlassCard>

          {/* Quick Metrics */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Resumo Logístico
              </span>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-card/60 p-2.5 border border-border/50 text-center">
                  <div className="text-2xl font-bold text-foreground">{stops.length}</div>
                  <div className="text-[10px] text-muted-foreground">Paradas Totais</div>
                </div>
                <div className="rounded-lg bg-card/60 p-2.5 border border-border/50 text-center">
                  <div className="text-2xl font-bold text-emerald-500">
                    {stops.filter((s) => s.status === "Concluída").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Concluídas</div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Car className="size-4 text-brand" />
              <span>
                {stops.length > 0
                  ? `Estimativa: ~${stops.length * 35} km percurso`
                  : "Nenhuma parada adicionada"}
              </span>
            </div>
          </GlassCard>

          {/* Direct Navigation Links */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Navegação GPS
              </span>
              <p className="text-[11px] text-muted-foreground mt-1">
                Abra seu roteiro diretamente nos navegadores móveis para iniciar o trajeto.
              </p>
            </div>
            <div className="space-y-2 mt-3">
              {googleMapsUrl ? (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                >
                  <Navigation className="size-3.5" />
                  Abrir no Google Maps
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <button
                  disabled
                  className="w-full rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  Google Maps (Adicione paradas)
                </button>
              )}

              {wazeUrl ? (
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-sky-700 transition"
                >
                  <Car className="size-3.5" />
                  Navegar Próxima no Waze
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </GlassCard>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="Itinerário de Visitas"
            hint="Ordene e gerencie a sequência de clientes a serem visitados nesta viagem"
          />
          <div className="flex items-center gap-2">
            <GhostButton
              onClick={() => setIsCustomStopModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Adicionar Ponto Extra (Hotel, Almoço)
            </GhostButton>
            <PrimaryButton
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Building2 className="size-3.5" />
              Adicionar Cliente da Carteira
            </PrimaryButton>
          </div>
        </div>

        {/* Route Stops Sequence */}
        {stops.length === 0 ? (
          <EmptyState
            title="Nenhuma parada no roteiro"
            hint="Clique em 'Adicionar Cliente da Carteira' para incluir lojas e clientes no planejamento desta viagem."
          />
        ) : (
          <div className="space-y-3">
            {/* Origin Banner */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-4 py-3">
              <div className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground font-bold text-xs">
                <Navigation className="size-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">
                  Ponto de Partida: {originAddress}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Início previsto do deslocamento comercial
                </div>
              </div>
            </div>

            {stops.map((stop, index) => {
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;

              return (
                <GlassCard
                  key={stop.id}
                  className="p-4 transition hover:border-brand/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Stop Number Badge */}
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-card border border-border font-bold text-sm text-foreground shadow-xs">
                      {index + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">{stop.name}</h4>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            stop.status === "Concluída"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : stop.status === "Em Rota"
                              ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                              : stop.status === "Cancelada"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          }`}
                        >
                          {stop.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 text-rose-500" />
                          {stop.address}
                        </span>
                        {stop.scheduledTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5 text-muted-foreground" />
                            {stop.scheduledTime}
                          </span>
                        )}
                      </div>

                      {/* Contact shortcuts */}
                      {stop.phone && (
                        <div className="flex items-center gap-2 pt-1">
                          <a
                            href={whatsappLink(stop.phone, `Olá! Estou a caminho para nossa visita agendada hoje.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20"
                          >
                            <MessageCircle className="size-3" />
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${stop.phone}`}
                            className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                          >
                            <Phone className="size-3" />
                            {stop.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Ordering */}
                  <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0">
                    <select
                      value={stop.status}
                      onChange={(e) => updateStopStatus(stop.id, e.target.value as any)}
                      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs cursor-pointer"
                    >
                      <option value="Planejada">Planejada</option>
                      <option value="Em Rota">Em Rota</option>
                      <option value="Concluída">Concluída</option>
                      <option value="Cancelada">Cancelada</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveStop(index, "up")}
                        disabled={isFirst}
                        title="Subir prioridade"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        onClick={() => moveStop(index, "down")}
                        disabled={isLast}
                        title="Descer prioridade"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        onClick={() => removeStop(stop.id)}
                        title="Remover parada"
                        className="rounded p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer ml-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Modal: Add Clients from Directory */}
        <Modal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Selecionar Clientes para o Roteiro"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <TextInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, cidade ou CNPJ..."
                />
              </div>
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <option value="">Todos os Estados</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-border">
              {filteredClients.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum cliente encontrado com os filtros aplicados.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isAlreadyAdded = stops.some((s) => s.clientId === client.id);

                  return (
                    <div
                      key={client.id}
                      className="pt-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {client.trade_name || client.legal_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {client.city || "-"} - {client.state || "-"} • {client.status}
                        </div>
                      </div>

                      <button
                        onClick={() => addClientToRoute(client)}
                        disabled={isAlreadyAdded}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                          isAlreadyAdded
                            ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                            : "bg-brand text-brand-foreground hover:opacity-90"
                        }`}
                      >
                        {isAlreadyAdded ? "Adicionado" : "Adicionar"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <GhostButton onClick={() => setIsAddModalOpen(false)}>
                Fechar
              </GhostButton>
            </div>
          </div>
        </Modal>

        {/* Modal: Add Custom Stop */}
        <Modal
          open={isCustomStopModalOpen}
          onClose={() => setIsCustomStopModalOpen(false)}
          title="Adicionar Ponto Extra / Parada Técnica"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nome da Parada / Estabelecimento:
              </label>
              <TextInput
                value={customStopName}
                onChange={(e) => setCustomStopName(e.target.value)}
                placeholder="Ex: Hotel Ibis, Restaurante Gaúcho, Posto Graal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Endereço / Referência:
              </label>
              <TextInput
                value={customStopAddress}
                onChange={(e) => setCustomStopAddress(e.target.value)}
                placeholder="Ex: Rodovia Fernão Dias, KM 820"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Cidade:
                </label>
                <TextInput
                  value={customStopCity}
                  onChange={(e) => setCustomStopCity(e.target.value)}
                  placeholder="Ex: Pouso Alegre"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Estado (UF):
                </label>
                <select
                  value={customStopState}
                  onChange={(e) => setCustomStopState(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
                >
                  {UF_LIST.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <GhostButton onClick={() => setIsCustomStopModalOpen(false)}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={handleAddCustomStop}>
                Incluir Parada
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
