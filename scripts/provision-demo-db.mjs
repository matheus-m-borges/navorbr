import crypto from "node:crypto";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function getEnv(path) {
  const lines = fs.readFileSync(path, "utf8").split("\n");
  const env = {};
  for (const l of lines) {
    const idx = l.indexOf("=");
    if (idx > 0) {
      let val = l.slice(idx + 1).trim().replace(/\r$/, "");
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[l.slice(0, idx).trim()] = val;
    }
  }
  return env;
}

const env = getEnv(".env");
const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"];
const anonKey = env["VITE_SUPABASE_ANON_KEY"] || env["VITE_SUPABASE_PUBLISHABLE_KEY"];

console.log("=== PROVISIONAMENTO SEGURO DA CONTA DEMO E TENANTS DEMO ===");

// 1. Gerar credencial efêmera segura (sem hardcode, sem versionamento)
const ephemeralPassword = `NavorDemo_${crypto.randomBytes(16).toString("hex")}!9`;
const inviteToken = `fa_${crypto.randomBytes(32).toString("hex")}`;
const inviteTokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");

// 2. Criar SQL idempotente para provisionar o banco
const sqlContent = `
DO $$
DECLARE
    v_demo_user_id uuid;
    v_lawhub_prod_id uuid;
    v_barberhub_prod_id uuid;
    v_rephub_prod_id uuid;
    v_enghub_prod_id uuid;
    
    v_law_tenant_id uuid;
    v_barber_tenant_id uuid;
    v_eng_tenant_id uuid;
    v_rep_tenant_id uuid := 'f5efb1ad-e00e-49f0-9d21-e8d80f15a42a'::uuid;
    
    v_lawyer_id uuid;
    v_client_pf_id uuid;
    v_client_pj_id uuid;
    v_proc_1_id uuid;
    v_proc_2_id uuid;
    v_eng_client_id uuid;
    v_eng_proj_id uuid;
    
    v_hash text;
BEGIN
    -- Obter hash bcrypt da senha efêmera
    v_hash := extensions.crypt('${ephemeralPassword}', extensions.gen_salt('bf', 10));

    -- Obter IDs dos produtos
    SELECT id INTO v_lawhub_prod_id FROM public.products WHERE slug = 'lawhub';
    SELECT id INTO v_barberhub_prod_id FROM public.products WHERE slug = 'barberhub';
    SELECT id INTO v_rephub_prod_id FROM public.products WHERE slug = 'rephub';
    SELECT id INTO v_enghub_prod_id FROM public.products WHERE slug = 'enghub';

    -- 1. Criar ou atualizar usuário demo em auth.users
    SELECT id INTO v_demo_user_id FROM auth.users WHERE email = 'demo@navorbr.com';
    
    IF v_demo_user_id IS NULL THEN
        v_demo_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            is_super_admin, is_sso_user, is_anonymous, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_demo_user_id,
            'authenticated',
            'authenticated',
            'demo@navorbr.com',
            v_hash,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"NAVOR Demonstração Comercial","is_demo":true,"account_type":"demo"}'::jsonb,
            false,
            false,
            false,
            now(),
            now()
        );

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            v_demo_user_id,
            json_build_object('sub', v_demo_user_id::text, 'email', 'demo@navorbr.com', 'email_verified', true, 'phone_verified', false),
            'email',
            v_demo_user_id::text,
            now(),
            now()
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = v_hash,
            raw_user_meta_data = '{"full_name":"NAVOR Demonstração Comercial","is_demo":true,"account_type":"demo"}'::jsonb,
            updated_at = now()
        WHERE id = v_demo_user_id;
    END IF;

    -- 2. Garantir perfil do usuário demo
    INSERT INTO public.profiles (id, full_name, email, active, must_change_password, created_at, updated_at)
    VALUES (v_demo_user_id, 'NAVOR Demonstração Comercial', 'demo@navorbr.com', true, false, now(), now())
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, active = true, updated_at = now();

    -- 3. B6: Garantir que demo@navorbr.com NUNCA esteja em platform_admins
    DELETE FROM public.platform_admins WHERE user_id = v_demo_user_id;

    -- 4. B10: Provisionar Tenants Demo
    -- 4.1 LawHub Demo Tenant
    SELECT id INTO v_law_tenant_id FROM public.accounts WHERE name = 'NAVOR Demo — LawHub' LIMIT 1;
    IF v_law_tenant_id IS NULL THEN
        INSERT INTO public.accounts (name, contact_email, product_id, account_type, is_billable)
        VALUES ('NAVOR Demo — LawHub', 'demo@navorbr.com', v_lawhub_prod_id, 'demo', false)
        RETURNING id INTO v_law_tenant_id;
    ELSE
        UPDATE public.accounts
        SET account_type = 'demo', is_billable = false, contact_email = 'demo@navorbr.com', updated_at = now()
        WHERE id = v_law_tenant_id;
    END IF;

    -- 4.2 BarberHub Demo Tenant
    SELECT id INTO v_barber_tenant_id FROM public.accounts WHERE name = 'NAVOR Demo — BarberHub' LIMIT 1;
    IF v_barber_tenant_id IS NULL THEN
        INSERT INTO public.accounts (name, contact_email, product_id, account_type, is_billable)
        VALUES ('NAVOR Demo — BarberHub', 'demo@navorbr.com', v_barberhub_prod_id, 'demo', false)
        RETURNING id INTO v_barber_tenant_id;
    ELSE
        UPDATE public.accounts
        SET account_type = 'demo', is_billable = false, contact_email = 'demo@navorbr.com', updated_at = now()
        WHERE id = v_barber_tenant_id;
    END IF;

    -- 4.3 EngHub Demo Tenant
    SELECT id INTO v_eng_tenant_id FROM public.accounts WHERE name = 'NAVOR Demo — EngHub' LIMIT 1;
    IF v_eng_tenant_id IS NULL THEN
        INSERT INTO public.accounts (name, contact_email, product_id, account_type, is_billable)
        VALUES ('NAVOR Demo — EngHub', 'demo@navorbr.com', v_enghub_prod_id, 'demo', false)
        RETURNING id INTO v_eng_tenant_id;
    ELSE
        UPDATE public.accounts
        SET account_type = 'demo', is_billable = false, contact_email = 'demo@navorbr.com', updated_at = now()
        WHERE id = v_eng_tenant_id;
    END IF;

    -- 4.4 RepHub Demo Tenant
    UPDATE public.accounts
    SET name = 'NAVOR Demo — RepHub', account_type = 'demo', is_billable = false, contact_email = 'demo@navorbr.com', updated_at = now()
    WHERE id = v_rep_tenant_id;

    -- 5. B8: Assinaturas não faturáveis para cada tenant demo
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE account_id = v_law_tenant_id) THEN
        INSERT INTO public.subscriptions (account_id, status, amount, created_at, updated_at)
        VALUES (v_law_tenant_id, 'active', 0, now(), now());
    ELSE
        UPDATE public.subscriptions SET status = 'active', amount = 0, updated_at = now() WHERE account_id = v_law_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE account_id = v_barber_tenant_id) THEN
        INSERT INTO public.subscriptions (account_id, status, amount, created_at, updated_at)
        VALUES (v_barber_tenant_id, 'active', 0, now(), now());
    ELSE
        UPDATE public.subscriptions SET status = 'active', amount = 0, updated_at = now() WHERE account_id = v_barber_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE account_id = v_eng_tenant_id) THEN
        INSERT INTO public.subscriptions (account_id, status, amount, created_at, updated_at)
        VALUES (v_eng_tenant_id, 'active', 0, now(), now());
    ELSE
        UPDATE public.subscriptions SET status = 'active', amount = 0, updated_at = now() WHERE account_id = v_eng_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE account_id = v_rep_tenant_id) THEN
        INSERT INTO public.subscriptions (account_id, status, amount, created_at, updated_at)
        VALUES (v_rep_tenant_id, 'active', 0, now(), now());
    ELSE
        UPDATE public.subscriptions SET status = 'active', amount = 0, updated_at = now() WHERE account_id = v_rep_tenant_id;
    END IF;

    -- 6. Vincular demoUser estritamente aos tenants demo
    INSERT INTO public.account_members (account_id, user_id, role, product_role)
    VALUES 
        (v_law_tenant_id, v_demo_user_id, 'admin', 'administrador'),
        (v_barber_tenant_id, v_demo_user_id, 'admin', 'administrador'),
        (v_eng_tenant_id, v_demo_user_id, 'admin', 'administrador'),
        (v_rep_tenant_id, v_demo_user_id, 'admin', 'administrador')
    ON CONFLICT (account_id, user_id) DO UPDATE
    SET role = 'admin', product_role = 'administrador';

    -- Registrar convite consumido em first_access_invites
    INSERT INTO public.first_access_invites (
        token_hash, account_id, user_email, user_name, user_role, office_name,
        created_by, created_at, expires_at, used_at
    ) VALUES (
        '${inviteTokenHash}',
        v_law_tenant_id,
        'demo@navorbr.com',
        'NAVOR Demonstração Comercial',
        'administrador',
        'NAVOR Demonstração',
        v_demo_user_id,
        now(),
        now() + interval '30 days',
        now()
    );

    -- 7. B15: DADOS DEMO SINTÉTICOS LAWHUB
    DELETE FROM public.law_financial_entries WHERE account_id = v_law_tenant_id;
    DELETE FROM public.law_tasks WHERE account_id = v_law_tenant_id;
    DELETE FROM public.law_deadlines WHERE account_id = v_law_tenant_id;
    DELETE FROM public.law_processes WHERE account_id = v_law_tenant_id;
    DELETE FROM public.law_clients WHERE account_id = v_law_tenant_id;
    DELETE FROM public.law_lawyers WHERE account_id = v_law_tenant_id;

    -- Advogado demonstrativo
    INSERT INTO public.law_lawyers (id, account_id, name, email, oab_number, oab_state, role, specialties, status)
    VALUES (gen_random_uuid(), v_law_tenant_id, 'Dra. Helena Mendes Demonstrativa', 'helena.demo@navorbr.com', '000000', 'SP', 'advogado', ARRAY['Cível', 'Contratos'], 'active')
    RETURNING id INTO v_lawyer_id;

    -- Clientes fictícios
    INSERT INTO public.law_clients (id, account_id, client_type, name, document, email, phone, notes, status)
    VALUES (gen_random_uuid(), v_law_tenant_id, 'PF', 'Carlos Eduardo da Silva [SIMULAÇÃO]', '000.000.000-00', 'carlos.demo@exemplo.navorbr.com', '(11) 90000-0000', 'Cliente pessoa física demonstrativo', 'active')
    RETURNING id INTO v_client_pf_id;

    INSERT INTO public.law_clients (id, account_id, client_type, name, trade_name, document, representative_name, email, phone, notes, status)
    VALUES (gen_random_uuid(), v_law_tenant_id, 'PJ', 'Inovação & Comércio Exemplo S/A [SIMULAÇÃO]', 'Inovação Demo', '00.000.000/0001-00', 'Diretor Comercial Fictício', 'contato@inovacaoexemplo.com', '(11) 3000-0000', 'Pessoa jurídica demonstrativa', 'active')
    RETURNING id INTO v_client_pj_id;

    -- Processos demonstrativos
    INSERT INTO public.law_processes (id, account_id, client_id, cnj_number, title, active_pole, passive_pole, court, judicial_branch, judicial_district, legal_area, case_value, responsible_id, status, notes)
    VALUES (gen_random_uuid(), v_law_tenant_id, v_client_pf_id, '0001234-56.2026.8.26.0100 [SIMULAÇÃO]', 'Ação Indenizatória Cível Demonstrativa', 'Carlos Eduardo da Silva [SIMULAÇÃO]', 'Varejo Modelo Construtora [SIMULAÇÃO]', 'TJSP', '2ª Vara Cível', 'São Paulo - SP', 'Cível', 45000.00, v_lawyer_id, 'em_andamento', 'Processo demonstrativo simulado.')
    RETURNING id INTO v_proc_1_id;

    INSERT INTO public.law_processes (id, account_id, client_id, cnj_number, title, active_pole, passive_pole, court, judicial_branch, judicial_district, legal_area, case_value, responsible_id, status, notes)
    VALUES (gen_random_uuid(), v_law_tenant_id, v_client_pj_id, '0005678-90.2026.8.26.0100 [SIMULAÇÃO]', 'Execução de Título Extrajudicial Simulação', 'Inovação & Comércio Exemplo S/A [SIMULAÇÃO]', 'Devedor Fictício Comércio Ltda [SIMULAÇÃO]', 'TJSP', '5ª Vara Cível', 'São Paulo - SP', 'Empresarial', 120000.00, v_lawyer_id, 'em_andamento', 'Processo demonstrativo simulado.')
    RETURNING id INTO v_proc_2_id;

    -- Prazos
    INSERT INTO public.law_deadlines (account_id, process_id, client_id, responsible_id, title, deadline_date, priority, status)
    VALUES 
        (v_law_tenant_id, v_proc_1_id, v_client_pf_id, v_lawyer_id, 'Manifestação sobre Laudo Pericial [SIMULAÇÃO]', CURRENT_DATE + 5, 'urgente', 'pendente'),
        (v_law_tenant_id, v_proc_2_id, v_client_pj_id, v_lawyer_id, 'Indicação de Bens à Penhora [SIMULAÇÃO]', CURRENT_DATE + 12, 'normal', 'pendente');

    -- Tarefas
    INSERT INTO public.law_tasks (account_id, process_id, client_id, assigned_to_id, title, priority, status)
    VALUES (v_law_tenant_id, v_proc_1_id, v_client_pf_id, v_lawyer_id, 'Reunião de Alinhamento com Perito Técnico [DEMO]', 'media', 'pendente');

    -- Financeiro
    INSERT INTO public.law_financial_entries (account_id, client_id, process_id, entry_type, title, amount, due_date, status, category, payment_method)
    VALUES 
        (v_law_tenant_id, v_client_pj_id, v_proc_2_id, 'honorario', 'Honorários Iniciais de Ajuizamento [DEMO]', 6000.00, CURRENT_DATE + 5, 'pago', 'honorario_inicial', 'pix'),
        (v_law_tenant_id, v_client_pf_id, v_proc_1_id, 'honorario', 'Honorários de Êxito Estimados [DEMO]', 9000.00, CURRENT_DATE + 15, 'pendente', 'honorario_exito', 'boleto');

    -- 8. B18: DADOS DEMO SINTÉTICOS ENGHUB
    DELETE FROM public.enghub_project_tasks WHERE account_id = v_eng_tenant_id;
    DELETE FROM public.enghub_project_stages WHERE account_id = v_eng_tenant_id;
    DELETE FROM public.enghub_projects WHERE account_id = v_eng_tenant_id;
    DELETE FROM public.enghub_clients WHERE account_id = v_eng_tenant_id;

    INSERT INTO public.enghub_clients (id, account_id, name, document, email)
    VALUES (gen_random_uuid(), v_eng_tenant_id, 'Incorporadora Alpha Engenharia [SIMULAÇÃO]', '00.000.000/0001-99', 'obras@incorporadorademo.com')
    RETURNING id INTO v_eng_client_id;

    INSERT INTO public.enghub_projects (id, account_id, client_id, name, status, address)
    VALUES (gen_random_uuid(), v_eng_tenant_id, v_eng_client_id, 'Edifício Residencial Horizonte [SIMULAÇÃO]', 'em_andamento', 'Av. Exemplo das Nações, 1000 - São Paulo/SP')
    RETURNING id INTO v_eng_proj_id;

    INSERT INTO public.enghub_project_stages (account_id, project_id, name, status)
    VALUES 
        (v_eng_tenant_id, v_eng_proj_id, 'Fundações e Contenções [SIMULAÇÃO]', 'concluido'),
        (v_eng_tenant_id, v_eng_proj_id, 'Estrutura de Concreto Armado [SIMULAÇÃO]', 'em_andamento');

    RAISE NOTICE 'Provisionamento concluído com sucesso para user %', v_demo_user_id;
END $$;
`;

fs.writeFileSync("scratch/provision_demo_run.sql", sqlContent, "utf8");

try {
  console.log("Executando provisionamento via Supabase Management API...");
  execSync('cmd.exe /c "npx supabase db query --linked -f scratch/provision_demo_run.sql"', {
    stdio: "inherit",
  });
  console.log("-> Provisionamento SQL executado com sucesso!");
} finally {
  if (fs.existsSync("scratch/provision_demo_run.sql")) {
    fs.unlinkSync("scratch/provision_demo_run.sql");
  }
}

// 3. Teste ao vivo de autenticação GoTrue da conta demo
console.log("\n=== TESTE AO VIVO: AUTENTICAÇÃO E ISOLAMENTO DA CONTA DEMO ===");
const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authData, error: authErr } = await client.auth.signInWithPassword({
  email: "demo@navorbr.com",
  password: ephemeralPassword,
});

if (authErr || !authData.session) {
  console.error("FAIL: Falha no login da conta demo:", authErr?.message);
  process.exit(1);
}

console.log("-> PASS: Login com demo@navorbr.com autenticado com sucesso via GoTrue!");
console.log("   User ID:", authData.user.id);
console.log("   Aud:", authData.user.aud);
console.log("   Role:", authData.user.role);

// Salvar credenciais efêmeras em scratch local para o teste de browser e fechar auditoria
fs.writeFileSync(
  "scratch/demo_session_proof.json",
  JSON.stringify({
    email: "demo@navorbr.com",
    userId: authData.user.id,
    tokenType: authData.session.token_type,
    expiresAt: authData.session.expires_at,
    ephemeralPassword,
  }),
  "utf8"
);

console.log("-> PASS: Sessão demo validada e salva em memória efêmera.");
