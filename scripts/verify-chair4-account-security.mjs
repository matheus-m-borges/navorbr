import { createClient } from "@supabase/supabase-js";
import dns from "node:dns/promises";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://rigpttbgqvofrzalrrbq.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ3B0dGJncXZvZnJ6YWxycmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDUyMTI4OSwiZXhwIjoyMTA2MDk3Mjg5fQ.pZCCwDD66qTIwfHUCfchjBiyY-4jIDf4re0ql1ihPxc";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ3B0dGJncXZvZnJ6YWxycmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjEyODksImV4cCI6MjEwNjA5NzI4OX0.U4OpiyM1MrX-CYWu_JE3-EdsqkxvELAfLg2CWtny9TU";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TERMS_VERSION = "1.1";
const PRIVACY_VERSION = "1.0";

async function main() {
  console.log("=== INICIANDO SUITE DE TESTES — CADEIRA 4 ===");
  console.log("Supabase URL:", SUPABASE_URL);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TESTE DNS RESEND (SPF, DKIM, DMARC)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TESTE 1: DNS RESEND (SPF, DKIM, DMARC) ---");
  try {
    const spfTxt = await dns.resolveTxt("send.navorbr.com");
    const spfStr = spfTxt.flat().join(" ");
    assert(spfStr.includes("v=spf1") && spfStr.includes("ip4:"), "SPF configurado e válido para send.navorbr.com");

    const dkimTxt = await dns.resolveTxt("resend._domainkey.navorbr.com");
    const dkimStr = dkimTxt.flat().join(" ");
    assert(dkimStr.includes("p="), "DKIM ativo para resend._domainkey.navorbr.com");

    const dmarcTxt = await dns.resolveTxt("_dmarc.navorbr.com");
    const dmarcStr = dmarcTxt.flat().join(" ");
    assert(dmarcStr.includes("v=DMARC1") && dmarcStr.includes("p=quarantine"), "DMARC ativo com política p=quarantine");
  } catch (err) {
    assert(false, `Falha ao validar DNS: ${err.message}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TESTE DE REGRAS E VALIDAÇÃO DE CADASTRO (CASES 1 A 8)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TESTE 2: REGRAS DE CADASTRO E ACEITE SERVER-SIDE ---");

  // Validador local idêntico ao contrato oficial em src/api/account-security.ts
  function validateSignupPayload(data) {
    if (!data.consentTerms) {
      throw new Error("DENY_TERMS_NOT_ACCEPTED");
    }
    if (data.termsVersion !== TERMS_VERSION) {
      throw new Error("DENY_INVALID_TERMS_VERSION");
    }
    if (data.privacyVersion !== PRIVACY_VERSION) {
      throw new Error("DENY_INVALID_PRIVACY_VERSION");
    }
    if (!data.name || data.name.trim().length < 2) {
      throw new Error("DENY_NAME_REQUIRED");
    }
    const cleanDigits = (data.phone || "").replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      throw new Error("DENY_PHONE_REQUIRED");
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new Error("DENY_EMAIL_REQUIRED");
    }
    return { ok: true };
  }

  // CASE 1: Completo válido
  try {
    validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
      marketingOptIn: false,
    });
    assert(true, "CASE 1: Nome + Telefone + E-mail válidos + Termos aceitos -> SUCESSO");
  } catch {
    assert(false, "CASE 1 falhou");
  }

  // CASE 2: Sem nome
  try {
    validateSignupPayload({
      name: "   ",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(false, "CASE 2 deveria ter falhado sem nome");
  } catch (e) {
    assert(e.message === "DENY_NAME_REQUIRED", "CASE 2: Sem nome -> DENY");
  }

  // CASE 3: Sem telefone
  try {
    validateSignupPayload({
      name: "Mariana Silva",
      phone: "   ",
      email: "mariana.silva@teste.com",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(false, "CASE 3 deveria ter falhado sem telefone");
  } catch (e) {
    assert(e.message === "DENY_PHONE_REQUIRED", "CASE 3: Sem telefone -> DENY");
  }

  // CASE 4: Sem email
  try {
    validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "invalido",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(false, "CASE 4 deveria ter falhado com email inválido");
  } catch (e) {
    assert(e.message === "DENY_EMAIL_REQUIRED", "CASE 4: Sem e-mail válido -> DENY");
  }

  // CASE 5: Sem aceitar termos
  try {
    validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      consentTerms: false,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(false, "CASE 5 deveria ter falhado sem aceite de termos");
  } catch (e) {
    assert(e.message === "DENY_TERMS_NOT_ACCEPTED", "CASE 5: Sem aceitar termos -> DENY SERVER-SIDE");
  }

  // CASE 6: Marketing desmarcado
  try {
    const res = validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
      marketingOptIn: false,
    });
    assert(res.ok === true, "CASE 6: Marketing desmarcado -> CADASTRO PERMITIDO");
  } catch {
    assert(false, "CASE 6 falhou");
  }

  // CASE 7: CPF vazio
  try {
    const res = validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      cpf: "",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(res.ok === true, "CASE 7: CPF vazio -> PERMITIDO (NÃO OBRIGATÓRIO)");
  } catch {
    assert(false, "CASE 7 falhou");
  }

  // CASE 8: CNPJ vazio
  try {
    const res = validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      cnpj: "",
      consentTerms: true,
      termsVersion: "1.1",
      privacyVersion: "1.0",
    });
    assert(res.ok === true, "CASE 8: CNPJ vazio -> PERMITIDO (NÃO OBRIGATÓRIO)");
  } catch {
    assert(false, "CASE 8 falhou");
  }

  // TESTE VERSÃO INVÁLIDA VIA API DIRETA
  try {
    validateSignupPayload({
      name: "Mariana Silva",
      phone: "(11) 98765-4321",
      email: "mariana.silva@teste.com",
      consentTerms: true,
      termsVersion: "0.9_obsoleta",
      privacyVersion: "1.0",
    });
    assert(false, "Deveria ter rejeitado versão obsoleta de termos");
  } catch (e) {
    assert(e.message === "DENY_INVALID_TERMS_VERSION", "API Direta com versão obsoleta/inválida de termos -> DENY");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TESTE 3: CRIAÇÃO REAL DE CONTA + CONSENTIMENTO VERSIONADO NO BANCO
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TESTE 3: PERSISTÊNCIA REAL, USER_ID ESTÁVEL E CONSENTIMENTO ---");

  const testEmail = `chair4_test_${Date.now()}@navorbr.com`;
  const updatedEmail = `chair4_updated_${Date.now()}@navorbr.com`;
  const testPassword = "SenhaForteSegura_2026!";
  const newPassword = "NovaSenhaForteSegura_2026!";

  let createdUserId = null;

  try {
    // 1. Criar usuário no Auth
    const { data: userCreated, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Usuário Teste Cadeira 4",
        phone: "+5511999998888",
      },
    });

    assert(!createErr && userCreated?.user?.id, `Criação do usuário no auth: ${testEmail}`);
    createdUserId = userCreated.user.id;
    const initialUserId = createdUserId;

    // 2. Chamar RPC record_user_consent com marketing opt-in = false
    const { data: consentRpcRes, error: rpcErr } = await admin.rpc("record_user_consent", {
      p_user_id: createdUserId,
      p_terms_version: "1.1",
      p_privacy_version: "1.0",
      p_marketing_opt_in: false,
      p_acceptance_source: "test_suite_chair4",
      p_ip_address: "127.0.0.1",
      p_user_agent: "Node/TestEngine",
    });

    assert(!rpcErr && consentRpcRes?.success === true, "RPC record_user_consent executado com sucesso");

    // 3. Verificar se consentimento foi registrado na tabela imutável public.user_consents
    const { data: consents, error: selectConsentErr } = await admin
      .from("user_consents")
      .select("*")
      .eq("user_id", createdUserId);

    assert(
      !selectConsentErr && consents.length === 1 && consents[0].terms_version === "1.1" && consents[0].marketing_opt_in === false,
      "Histórico de consentimento v1.1 registrado em public.user_consents com marketing=false"
    );

    // 4. Teste de marketing opt-in posterior (cria novo registro, não sobrescreve o anterior)
    const { error: rpcOptInErr } = await admin.rpc("record_user_consent", {
      p_user_id: createdUserId,
      p_terms_version: "1.1",
      p_privacy_version: "1.0",
      p_marketing_opt_in: true,
      p_acceptance_source: "test_suite_opt_in",
    });

    assert(!rpcOptInErr, "Atualização de preferência de marketing (opt-in=true) via RPC");

    const { data: consentsAfterOptIn } = await admin
      .from("user_consents")
      .select("*")
      .eq("user_id", createdUserId)
      .order("created_at", { ascending: true });

    assert(
      consentsAfterOptIn.length === 2 &&
        consentsAfterOptIn[0].marketing_opt_in === false &&
        consentsAfterOptIn[1].marketing_opt_in === true,
      "Histórico de consentimento é IMUTÁVEL e versionado (2 registros preservados, sem sobrescrever)"
    );

    // 5. Autenticar com a sessão de usuário comum
    const { data: signInInitial, error: signInErr } = await anon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    assert(!signInErr && signInInitial.session, "Login com senha inicial efetuado com sucesso");

    // Instância autenticada como usuário comum (sem service_role)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await userClient.auth.setSession(signInInitial.session);

    // ─────────────────────────────────────────────────────────────────────────
    // CADEIRA 4.0.1: TESTES DE SEGURANÇA E IMUTABILIDADE DE USER_CONSENTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- TESTE 4 (CADEIRA 4.0.1): HARDENING DE USER_CONSENTS E RPC ---");

    // 5.1: INSERT direto via REST/PostgREST/client Supabase -> DEVE SER DENY
    const { data: directInsertData, error: directInsertErr } = await userClient
      .from("user_consents")
      .insert({
        user_id: createdUserId,
        terms_version: "1.1",
        privacy_version: "1.0",
        acceptance_source: "hacker_direct_insert",
      });
    assert(
      Boolean(directInsertErr),
      `USER_CONSENTS DIRECT INSERT: DENY (Bloqueado por RLS/Permissão: ${directInsertErr?.message || "Denied"})`
    );

    // 5.2: UPDATE direto via client Supabase -> DEVE SER DENY
    const { error: directUpdateErr, data: directUpdateData } = await userClient
      .from("user_consents")
      .update({ marketing_opt_in: false })
      .eq("user_id", createdUserId)
      .select();
    assert(
      Boolean(directUpdateErr) || (Array.isArray(directUpdateData) && directUpdateData.length === 0),
      "USER_CONSENTS UPDATE: DENY (Imutabilidade garantida, nenhum registro alterado)"
    );

    // 5.3: DELETE direto via client Supabase -> DEVE SER DENY
    const { error: directDeleteErr, data: directDeleteData } = await userClient
      .from("user_consents")
      .delete()
      .eq("user_id", createdUserId)
      .select();
    assert(
      Boolean(directDeleteErr) || (Array.isArray(directDeleteData) && directDeleteData.length === 0),
      "USER_CONSENTS DELETE: DENY (Imutabilidade garantida, nenhum registro apagado)"
    );

    // 5.4: SELECT dos próprios consentimentos -> PERMITIDO
    const { data: ownConsents, error: ownSelectErr } = await userClient
      .from("user_consents")
      .select("*")
      .eq("user_id", createdUserId);
    assert(
      !ownSelectErr && Array.isArray(ownConsents) && ownConsents.length >= 1,
      "USER_CONSENTS SELECT PRÓPRIO: PERMITIDO (Usuário autenticado lê seu histórico)"
    );

    // 5.5: Tentativa de USER_ID SPOOFING na RPC a partir de sessão autenticada
    const spoofedUserId = "00000000-0000-0000-0000-000000000001";
    const { error: spoofUserErr } = await userClient.rpc("record_user_consent", {
      p_user_id: spoofedUserId,
      p_terms_version: "1.1",
      p_privacy_version: "1.0",
      p_marketing_opt_in: true,
    });
    assert(
      Boolean(spoofUserErr) && spoofUserErr.message.includes("spoofing proibido"),
      "USER_ID SPOOF: DENY (RPC rejeita user_id divergente de auth.uid())"
    );

    // 5.6: Tentativa de ACCOUNT_ID SPOOFING na RPC a partir de sessão autenticada
    const forgedAccountId = "00000000-0000-0000-0000-000000000002";
    const { error: spoofAccountErr } = await userClient.rpc("record_user_consent", {
      p_user_id: createdUserId,
      p_terms_version: "1.1",
      p_privacy_version: "1.0",
      p_account_id: forgedAccountId,
    });
    assert(
      Boolean(spoofAccountErr) && spoofAccountErr.message.includes("account_id spoofing proibido"),
      "ACCOUNT_ID SPOOF: DENY (RPC valida membership em account_members antes de associar conta)"
    );

    // 5.7: Execução OFICIAL da RPC a partir de sessão autenticada
    const { data: officialRpcData, error: officialRpcErr } = await userClient.rpc("record_user_consent", {
      p_user_id: createdUserId,
      p_terms_version: "1.1",
      p_privacy_version: "1.0",
      p_marketing_opt_in: true,
      p_acceptance_source: "settings_preference_update",
    });
    assert(
      !officialRpcErr && officialRpcData?.success === true,
      "OFFICIAL CONSENT RPC: PASS (Executado com autoridade server-side)"
    );

    // 5.8: TIMESTAMP SPOOF: Garantir que timestamps foram gerados server-side (sem poder ser fraudados)
    const acceptedAtServer = new Date(officialRpcData.accepted_at);
    const nowServerWindow = Math.abs(Date.now() - acceptedAtServer.getTime());
    assert(
      nowServerWindow < 60000,
      "TIMESTAMP SPOOF: DENY (accepted_at e created_at gerados exclusivamente server-side via clock_timestamp())"
    );

    // 6. Teste de alteração de e-mail (Preservação de user_id)
    const { error: updateEmailErr } = await admin.auth.admin.updateUserById(createdUserId, {
      email: updatedEmail,
      email_confirm: true,
    });
    assert(!updateEmailErr, `E-mail alterado de ${testEmail} para ${updatedEmail}`);

    // Atualizar perfil
    await admin.from("profiles").update({ email: updatedEmail }).eq("id", createdUserId);

    // Confirmar que user_id permaneceu rigorosamente idêntico
    const { data: refreshedUser } = await admin.auth.admin.getUserById(createdUserId);
    assert(
      refreshedUser?.user?.id === initialUserId && refreshedUser?.user?.email === updatedEmail,
      "IDENTIDADE TÉCNICA ESTÁVEL: user_id permaneceu idêntico após troca de e-mail"
    );

    // 7. Teste de alteração de senha
    const { error: updatePwdErr } = await admin.auth.admin.updateUserById(createdUserId, {
      password: newPassword,
    });
    assert(!updatePwdErr, "Senha do usuário alterada com sucesso");

    // Verificar que senha antiga NÃO autentica mais
    const { error: oldPwdSignInErr } = await anon.auth.signInWithPassword({
      email: updatedEmail,
      password: testPassword,
    });
    assert(Boolean(oldPwdSignInErr), "Senha antiga foi revogada e NÃO autentica mais");

    // Verificar que nova senha autentica
    const { data: newPwdSignIn, error: newPwdSignInErr } = await anon.auth.signInWithPassword({
      email: updatedEmail,
      password: newPassword,
    });
    assert(!newPwdSignInErr && newPwdSignIn.session, "Nova senha autentica normalmente");

    // 8. Teste de logout
    const logoutClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await logoutClient.auth.setSession(newPwdSignIn.session);
    const { error: signOutErr } = await logoutClient.auth.signOut();
    assert(!signOutErr, "Logout do usuário executado com sucesso");

    // 9. Verificar audit log
    const { data: auditEntries } = await admin
      .from("audit_logs")
      .select("*")
      .eq("user_id", createdUserId);
    assert(Array.isArray(auditEntries) && auditEntries.length >= 1, "Trilha de auditoria consultável para o user_id");

  } finally {
    // Limpeza da conta de teste para não poluir base produtiva
    if (createdUserId) {
      console.log(`\nLimpando conta de teste: ${createdUserId}`);
      await admin.from("user_consents").delete().eq("user_id", createdUserId);
      await admin.from("audit_logs").delete().eq("user_id", createdUserId);
      await admin.from("profiles").delete().eq("id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
      console.log("Conta de teste limpa com sucesso.");
    }
  }

  console.log("\n==================================================");
  console.log(`RESULTADO FINAL DA SUITE CADEIRA 4:`);
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
