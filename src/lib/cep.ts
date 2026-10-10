// Consulta de CEP na base pública dos Correios (ViaCEP) para preencher o
// endereço automaticamente nos cadastros.

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

/** Deixa o CEP no padrão 00000-000 conforme o usuário digita. */
export function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export interface CepData {
  address: string;
  district: string;
  city: string;
  state: string;
}

/** Busca o endereço do CEP. Lança erro com mensagem amigável. */
export async function lookupCep(value: string): Promise<CepData> {
  const d = onlyDigits(value);
  if (d.length !== 8) throw new Error("Informe um CEP com 8 números.");
  let json: Record<string, string> & { erro?: boolean | string };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error("Não foi possível consultar o CEP agora.");
  }
  if (json.erro) throw new Error("CEP não encontrado.");
  return {
    address: [json["logradouro"], json["complemento"]].filter(Boolean).join(", "),
    district: json["bairro"] ?? "",
    city: json["localidade"] ?? "",
    state: json["uf"] ?? "",
  };
}
