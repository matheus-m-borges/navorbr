import { createClient } from "@supabase/supabase-js";

/**
 * Gatekeeper de segurança do Backend para o módulo LawHub Atendimento.
 * Valida se a conta solicitante possui o módulo 'atendimento_whatsapp' ativo,
 * seja por atribuição direta no Portal NAVOR (account_modules) ou inclusão no plano (subscriptions -> plans -> plan_modules).
 */
export async function assertAccountHasAtendimentoModule(accountId: string): Promise<boolean> {
  if (!accountId) {
    throw new Error("MÓDULO_BLOQUEADO: Identificador da conta (account_id) não fornecido.");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("MÓDULO_BLOQUEADO: Serviço de autorização não configurado.");
  }

  const admin = createClient(supabaseUrl, supabaseKey);

  // 1. Verifica se a conta possui o módulo ativo diretamente em account_modules (atribuição especial NAVOR)
  const { data: directModule } = await admin
    .from("account_modules")
    .select("module_id, system_modules!inner(key, is_active)")
    .eq("account_id", accountId)
    .in("system_modules.key", ["call_center", "atendimento_whatsapp"])
    .eq("system_modules.is_active", true)
    .maybeSingle();

  if (directModule) {
    return true;
  }

  // 2. Verifica se a assinatura ativa da conta inclui o módulo via plano
  const { data: sub } = await admin
    .from("subscriptions")
    .select(`
      status,
      plans!inner (
        id,
        plan_modules!inner (
          system_modules!inner (key, is_active)
        )
      )
    `)
    .eq("account_id", accountId)
    .eq("status", "active")
    .in("plans.plan_modules.system_modules.key", ["call_center", "atendimento_whatsapp"])
    .eq("plans.plan_modules.system_modules.is_active", true)
    .maybeSingle();

  if (sub) {
    return true;
  }

  throw new Error(
    "MÓDULO_BLOQUEADO: Seu plano atual não possui acesso à Central de Atendimento & WhatsApp. Solicite o upgrade para o plano Contencioso Pro ou Full Law Enterprise no Portal NAVOR."
  );
}
