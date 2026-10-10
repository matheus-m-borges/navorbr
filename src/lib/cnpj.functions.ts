// Consulta de CNPJ feita no servidor: evita bloqueios do navegador e permite
// tentar várias bases públicas oficiais em sequência (dados da Receita Federal
// republicados por CNPJ.ws, ReceitaWS e BrasilAPI).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CnpjLookupResult {
  ok: boolean;
  message?: string;
  source?: string;
  data?: {
    cnpj: string;
    legal_name: string;
    trade_name: string;
    state_registration: string;
    phone: string;
    email: string;
    zip_code: string;
    address: string;
    district: string;
    city: string;
    state: string;
    segment: string;
    situation: string;
  };
}

function digits(value: string) {
  return (value ?? "").replace(/\D/g, "");
}

function maskCnpj(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function validCnpj(value: string) {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinStreet(parts: unknown[]) {
  return parts
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RepHub/1.0 (CRM)" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as Record<string, unknown>;
  if (!body || typeof body !== "object") return null;
  return body;
}

/** CNPJ.ws (base pública da Receita Federal). */
async function fromCnpjWs(d: string) {
  const body = await getJson(`https://publica.cnpj.ws/cnpj/${d}`);
  if (!body) return null;
  const est = (body["estabelecimento"] ?? {}) as Record<string, unknown>;
  const cidade = (est["cidade"] ?? {}) as Record<string, unknown>;
  const estado = (est["estado"] ?? {}) as Record<string, unknown>;
  const atividade = (est["atividade_principal"] ?? {}) as Record<string, unknown>;
  const ie = (est["inscricoes_estaduais"] ?? []) as Record<string, unknown>[];
  const phone = [clean(est["ddd1"]), clean(est["telefone1"])].filter(Boolean).join(" ");
  return {
    cnpj: maskCnpj(d),
    legal_name: clean(body["razao_social"]),
    trade_name: clean(est["nome_fantasia"]),
    state_registration: clean(ie[0]?.["inscricao_estadual"]),
    phone,
    email: clean(est["email"]).toLowerCase(),
    zip_code: clean(est["cep"]),
    address: joinStreet([
      [clean(est["tipo_logradouro"]), clean(est["logradouro"])].filter(Boolean).join(" "),
      est["numero"],
      est["complemento"],
    ]),
    district: clean(est["bairro"]),
    city: clean(cidade["nome"]),
    state: clean(estado["sigla"]).toUpperCase(),
    segment: clean(atividade["descricao"]),
    situation: clean(est["situacao_cadastral"]),
  };
}

/** ReceitaWS. */
async function fromReceitaWs(d: string) {
  const body = await getJson(`https://receitaws.com.br/v1/cnpj/${d}`);
  if (!body || clean(body["status"]).toUpperCase() === "ERROR") return null;
  const atividades = (body["atividade_principal"] ?? []) as Record<string, unknown>[];
  return {
    cnpj: maskCnpj(d),
    legal_name: clean(body["nome"]),
    trade_name: clean(body["fantasia"]),
    state_registration: "",
    phone: clean(body["telefone"]),
    email: clean(body["email"]).toLowerCase(),
    zip_code: clean(body["cep"]),
    address: joinStreet([body["logradouro"], body["numero"], body["complemento"]]),
    district: clean(body["bairro"]),
    city: clean(body["municipio"]),
    state: clean(body["uf"]).toUpperCase(),
    segment: clean(atividades[0]?.["text"]),
    situation: clean(body["situacao"]),
  };
}

/** BrasilAPI. */
async function fromBrasilApi(d: string) {
  const body = await getJson(`https://brasilapi.com.br/api/v1/cnpj/${d}`);
  if (!body) return null;
  return {
    cnpj: maskCnpj(d),
    legal_name: clean(body["razao_social"]),
    trade_name: clean(body["nome_fantasia"]),
    state_registration: "",
    phone: clean(body["ddd_telefone_1"]),
    email: clean(body["email"]).toLowerCase(),
    zip_code: clean(body["cep"]),
    address: joinStreet([
      [clean(body["descricao_tipo_de_logradouro"]), clean(body["logradouro"])]
        .filter(Boolean)
        .join(" "),
      body["numero"],
      body["complemento"],
    ]),
    district: clean(body["bairro"]),
    city: clean(body["municipio"]),
    state: clean(body["uf"]).toUpperCase(),
    segment: clean(body["cnae_fiscal_descricao"]),
    situation: clean(body["descricao_situacao_cadastral"]),
  };
}

export const consultarCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnpj: string }) => ({ cnpj: String(input?.cnpj ?? "") }))
  .handler(async ({ data }): Promise<CnpjLookupResult> => {
    const d = digits(data.cnpj);
    if (!validCnpj(d)) {
      return { ok: false, message: "CNPJ inválido. Confira os números digitados." };
    }

    const sources: { name: string; run: () => Promise<Awaited<ReturnType<typeof fromCnpjWs>>> }[] = [
      { name: "CNPJ.ws", run: () => fromCnpjWs(d) },
      { name: "ReceitaWS", run: () => fromReceitaWs(d) },
      { name: "BrasilAPI", run: () => fromBrasilApi(d) },
    ];

    for (const source of sources) {
      try {
        const found = await source.run();
        if (found && found.legal_name) {
          return { ok: true, source: source.name, data: found };
        }
      } catch {
        // tenta a próxima base
      }
    }

    return {
      ok: false,
      message:
        "Não localizamos este CNPJ nas bases públicas agora. Tente novamente em alguns instantes ou preencha manualmente.",
    };
  });
