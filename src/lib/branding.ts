// Identidade do sistema (nome fixo do produto) e dados da representação
// comercial que usa o sistema (nome, slogan, ícone e imagem de topo).

import { useQuery } from "@tanstack/react-query";

export const SYSTEM_NAME = "RepHub";
export const SYSTEM_TAGLINE = "Gestão de representação comercial";

/** Marca da plataforma (dona do SaaS), exibida nas telas públicas de entrada. */
export const PLATFORM_NAME = "NavorBR";
export const PLATFORM_TAGLINE = "Sistemas conectados. Decisões mais simples.";

export const SYSTEM_ICON_URL = "/navorbr-icon.svg";
export const SYSTEM_LOGO_URL = "/navorbr-logo-dark.svg";
export const NAVOR_ICON_URL = "/navorbr-icon.svg";
export const NAVOR_LOGO_URL = "/navorbr-logo-dark.svg";

export interface Representation {
  name: string;
  slogan: string;
  legal_name: string;
  cnpj: string;
  state_registration: string;
  responsible: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  district: string;
  city: string;
  state: string;
  zip_code: string;
  regions: string;
  regions_states: string;
  regions_abroad: string;
  notes: string;
  icon_url: string;
  banner_url: string;
  icon_path: string;
  banner_path: string;
}

export const EMPTY_REPRESENTATION: Representation = {
  name: "",
  slogan: "",
  legal_name: "",
  cnpj: "",
  state_registration: "",
  responsible: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  address: "",
  district: "",
  city: "",
  state: "",
  zip_code: "",
  regions: "",
  regions_states: "",
  regions_abroad: "",
  notes: "",
  icon_url: "",
  banner_url: "",
  icon_path: "",
  banner_path: "",
};

/** Configurações que não pertencem a nenhum assinante (padrão do sistema). */
export const GLOBAL_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000";

export const REPRESENTATION_KEY = "representation";

export function parseRepresentation(value: unknown): Representation {
  if (!value || typeof value !== "object") return EMPTY_REPRESENTATION;
  const raw = value as Record<string, unknown>;
  const out = { ...EMPTY_REPRESENTATION };
  for (const key of Object.keys(EMPTY_REPRESENTATION) as (keyof Representation)[]) {
    const v = raw[key];
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

/** Dados da representação para cabeçalhos, relatórios e pedidos (dentro do CRM). */
export function useRepresentation() {
  const query = useQuery({
    queryKey: ["representation"],
    queryFn: async () => {
      const { getMyRepresentation } = await import("./branding.functions");
      return getMyRepresentation();
    },
  });
  return { representation: query.data ?? EMPTY_REPRESENTATION, isLoading: query.isLoading };
}

/**
 * Identidade global da plataforma (NAVOR), usada nas telas públicas de
 * entrada (login, escolha de área, portal do cliente). Não exige login.
 */
export function useGlobalRepresentation() {
  const query = useQuery({
    queryKey: ["representation", "global"],
    queryFn: async () => {
      const { getGlobalRepresentation } = await import("./branding.functions");
      return getGlobalRepresentation();
    },
  });
  return { representation: query.data ?? EMPTY_REPRESENTATION, isLoading: query.isLoading };
}
