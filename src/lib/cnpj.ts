// Consulta pública de dados cadastrais de CNPJ (base da Receita Federal).
// A busca é feita pelo servidor do próprio sistema, que tenta várias bases
// públicas em sequência, evitando bloqueios do navegador.

import { consultarCnpj } from "./cnpj.functions";

export interface CnpjData {
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
}

export function onlyDigits(value: string) {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCnpj(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCnpj(value: string) {
  const d = onlyDigits(value);
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

/** Busca os dados do CNPJ na base pública. Lança erro com mensagem amigável. */
export async function lookupCnpj(value: string): Promise<CnpjData> {
  const digits = onlyDigits(value);
  if (!isValidCnpj(digits)) throw new Error("CNPJ inválido. Confira os números digitados.");

  let result;
  try {
    result = await consultarCnpj({ data: { cnpj: digits } });
  } catch {
    throw new Error("Não foi possível consultar o CNPJ agora. Tente novamente em instantes.");
  }
  if (!result.ok || !result.data) {
    throw new Error(result.message ?? "CNPJ não encontrado na base pública.");
  }
  return result.data;
}
