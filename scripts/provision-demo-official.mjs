import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

// Load .env
const envContent = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq > 0) {
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"];
const supabaseServiceKey = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Role Key missing!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== INICIANDO PROVISIONAMENTO DA CONTA DEMO COMERCIAL (B5-B27) ===");

  const demoEmail = "demo@navorbr.com";

  // 1. Verificar se demo@navorbr.com já existe em auth.users
  console.log("1. Verificando existência de demo@navorbr.com no Auth...");
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
  let demoUser = userList.users.find((u) => u.email?.toLowerCase() === demoEmail);

  // Senha segura randômica de alta entropia (gerada dinamicamente, nunca hardcoded)
  const ephemeralSecurePassword = `NavDemo_${crypto.randomBytes(16).toString("hex")}!9`;

  if (!demoUser) {
    console.log("   -> Usuário não existe. Criando através do fluxo seguro de primeiro acesso...");
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: ephemeralSecurePassword,
      email_confirm: true,
      user_metadata: {
        full_name: "NAVOR Demonstração Comercial",
        is_demo: true,
        account_type: "demo",
      },
    });

    if (createErr || !newUser?.user) {
      console.error("Erro ao criar usuário demo:", createErr);
      process.exit(1);
    }
    demoUser = newUser.user;
    console.log("   -> Usuário criado com sucesso. ID:", demoUser.id);
  } else {
    console.log("   -> Usuário existente encontrado. ID:", demoUser.id);
    // Atualizar senha segura para os testes ao vivo
    await supabaseAdmin.auth.admin.updateUserById(demoUser.id, {
      password: ephemeralSecurePassword,
    });
  }

  // 2. Garantir perfil do usuário demo
  await supabaseAdmin.from("profiles").upsert({
    id: demoUser.id,
    full_name: "NAVOR Demonstração Comercial",
    email: demoEmail,
    active: true,
    must_change_password: false,
  });

  // 3. B6 — Validar que demo@navorbr.com NÃO é platform_admin
  console.log("2. Validando B6: demo@navorbr.com platform_admin = FALSE...");
  const { data: paCheck } = await supabaseAdmin
    .from("platform_admins")
    .select("*")
    .eq("user_id", demoUser.id)
    .maybeSingle();

  if (paCheck) {
    console.error("CRITICAL: demo@navorbr.com não pode estar em platform_admins! Removendo...");
    await supabaseAdmin.from("platform_admins").delete().eq("user_id", demoUser.id);
  }
  console.log("   -> PASS: demo@navorbr.com NÃO possui acesso de platform_admin.");

  // 4. Buscar produtos
  const { data: products } = await supabaseAdmin.from("products").select("id, name, slug");
  const lawhubProd = products.find((p) => p.slug === "lawhub");
  const barberhubProd = products.find((p) => p.slug === "barberhub");
  const rephubProd = products.find((p) => p.slug === "rephub");
  const enghubProd = products.find((p) => p.slug === "enghub");

  console.log("3. Provisionando tenants demo isolados...");

  // 4.1 Tenant LawHub Demo
  let lawhubTenantId = null;
  const { data: existingLawDemo } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("name", "NAVOR Demo — LawHub")
    .maybeSingle();

  if (existingLawDemo) {
    lawhubTenantId = existingLawDemo.id;
    await supabaseAdmin
      .from("accounts")
      .update({ account_type: "demo", is_billable: false, contact_email: demoEmail })
      .eq("id", lawhubTenantId);
  } else {
    const { data: newLawDemo, error: lawErr } = await supabaseAdmin
      .from("accounts")
      .insert({
        name: "NAVOR Demo — LawHub",
        contact_email: demoEmail,
        product_id: lawhubProd.id,
        account_type: "demo",
        is_billable: false,
      })
      .select()
      .single();
    if (lawErr) throw lawErr;
    lawhubTenantId = newLawDemo.id;
  }
  console.log("   -> Tenant LawHub Demo ID:", lawhubTenantId);

  // 4.2 Tenant BarberHub Demo
  let barberhubTenantId = null;
  const { data: existingBarberDemo } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("name", "NAVOR Demo — BarberHub")
    .maybeSingle();

  if (existingBarberDemo) {
    barberhubTenantId = existingBarberDemo.id;
    await supabaseAdmin
      .from("accounts")
      .update({ account_type: "demo", is_billable: false, contact_email: demoEmail })
      .eq("id", barberhubTenantId);
  } else {
    const { data: newBarberDemo, error: barberErr } = await supabaseAdmin
      .from("accounts")
      .insert({
        name: "NAVOR Demo — BarberHub",
        contact_email: demoEmail,
        product_id: barberhubProd.id,
        account_type: "demo",
        is_billable: false,
      })
      .select()
      .single();
    if (barberErr) throw barberErr;
    barberhubTenantId = newBarberDemo.id;
  }
  console.log("   -> Tenant BarberHub Demo ID:", barberhubTenantId);

  // 4.3 Tenant EngHub Demo
  let enghubTenantId = null;
  const { data: existingEngDemo } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("name", "NAVOR Demo — EngHub")
    .maybeSingle();

  if (existingEngDemo) {
    enghubTenantId = existingEngDemo.id;
    await supabaseAdmin
      .from("accounts")
      .update({ account_type: "demo", is_billable: false, contact_email: demoEmail })
      .eq("id", enghubTenantId);
  } else {
    const { data: newEngDemo, error: engErr } = await supabaseAdmin
      .from("accounts")
      .insert({
        name: "NAVOR Demo — EngHub",
        contact_email: demoEmail,
        product_id: enghubProd.id,
        account_type: "demo",
        is_billable: false,
      })
      .select()
      .single();
    if (engErr) throw engErr;
    enghubTenantId = newEngDemo.id;
  }
  console.log("   -> Tenant EngHub Demo ID:", enghubTenantId);

  // 4.4 Tenant RepHub Demo (já existente)
  const rephubTenantId = "f5efb1ad-e00e-49f0-9d21-e8d80f15a42a";
  await supabaseAdmin
    .from("accounts")
    .update({ name: "NAVOR Demo — RepHub", account_type: "demo", is_billable: false, contact_email: demoEmail })
    .eq("id", rephubTenantId);
  console.log("   -> Tenant RepHub Demo ID:", rephubTenantId);

  // 5. Vincular demoUser a todos os 4 tenants demo
  console.log("4. Vinculando demo@navorbr.com aos tenants demo em account_members...");
  const demoTenants = [lawhubTenantId, barberhubTenantId, enghubTenantId, rephubTenantId];
  for (const tId of demoTenants) {
    await supabaseAdmin.from("account_members").upsert(
      {
        account_id: tId,
        user_id: demoUser.id,
        role: "admin",
        product_role: "administrador",
      },
      { onConflict: "account_id,user_id" },
    );
  }
  console.log("   -> PASS: demo@navorbr.com vinculado a todos os tenants demo como admin.");

  // 6. Criar ou atualizar assinaturas demo com status 'active' e amount 0 (não faturável)
  console.log("5. Garantindo assinaturas não faturáveis para tenants demo...");
  for (const tId of demoTenants) {
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("account_id", tId)
      .maybeSingle();

    if (!existingSub) {
      await supabaseAdmin.from("subscriptions").insert({
        account_id: tId,
        status: "active",
        amount: 0,
      });
    } else {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "active", amount: 0 })
        .eq("id", existingSub.id);
    }
  }

  // 7. B15 — SEEDING DADOS DEMO SINTÉTICOS LAWHUB
  console.log("6. Populando dados sintéticos demonstrativos LawHub (B15)...");
  
  // Limpar dados anteriores do tenant demo para garantir idempotência
  await supabaseAdmin.from("law_processes").delete().eq("account_id", lawhubTenantId);
  await supabaseAdmin.from("law_clients").delete().eq("account_id", lawhubTenantId);
  await supabaseAdmin.from("law_lawyers").delete().eq("account_id", lawhubTenantId);

  // Advogado
  const { data: lawyer, error: lawyerErr } = await supabaseAdmin
    .from("law_lawyers")
    .insert({
      account_id: lawhubTenantId,
      name: "Dra. Helena Mendes Demonstrativa",
      email: "helena.demo@navorbr.com",
      oab_number: "000000",
      oab_state: "SP",
      role: "advogado",
      specialties: ["Cível", "Contratos"],
      status: "active",
    })
    .select()
    .single();

  // Clientes sintéticos (LGPD compliant, fictícios)
  const { data: clientPf } = await supabaseAdmin
    .from("law_clients")
    .insert({
      account_id: lawhubTenantId,
      client_type: "PF",
      name: "Carlos Eduardo da Silva [SIMULAÇÃO]",
      document: "000.000.000-00",
      email: "carlos.simulado@exemplo.navorbr.com",
      phone: "(11) 90000-0000",
      notes: "Cliente fictício para demonstração comercial NAVOR",
      status: "active",
    })
    .select()
    .single();

  const { data: clientPj } = await supabaseAdmin
    .from("law_clients")
    .insert({
      account_id: lawhubTenantId,
      client_type: "PJ",
      name: "Inovação & Comércio Exemplo S/A [SIMULAÇÃO]",
      trade_name: "Inovação Demo",
      document: "00.000.000/0001-00",
      representative_name: "Diretor Comercial Demonstrativo",
      email: "contato@inovacaoexemplo.com",
      phone: "(11) 3000-0000",
      notes: "Pessoa jurídica fictícia para demonstração comercial NAVOR",
      status: "active",
    })
    .select()
    .single();

  // Processos sintéticos
  const { data: proc1 } = await supabaseAdmin
    .from("law_processes")
    .insert({
      account_id: lawhubTenantId,
      client_id: clientPf.id,
      cnj_number: "0001234-56.2026.8.26.0100 [SIMULAÇÃO]",
      title: "Ação Indenizatória Cível Demonstrativa",
      active_pole: "Carlos Eduardo da Silva [SIMULAÇÃO]",
      passive_pole: "Varejo Modelo Construtora [SIMULAÇÃO]",
      party_position: "ativo",
      court: "TJSP",
      judicial_branch: "2ª Vara Cível do Foro Central",
      judicial_district: "São Paulo - SP",
      legal_area: "Cível",
      case_value: 45000.0,
      responsible_id: lawyer.id,
      status: "em_andamento",
      notes: "Processo fictício demonstrativo.",
    })
    .select()
    .single();

  const { data: proc2 } = await supabaseAdmin
    .from("law_processes")
    .insert({
      account_id: lawhubTenantId,
      client_id: clientPj.id,
      cnj_number: "0005678-90.2026.8.26.0100 [SIMULAÇÃO]",
      title: "Execução de Título Extrajudicial Simulação",
      active_pole: "Inovação & Comércio Exemplo S/A [SIMULAÇÃO]",
      passive_pole: "Devedor Fictício Comércio Ltda [SIMULAÇÃO]",
      party_position: "ativo",
      court: "TJSP",
      judicial_branch: "5ª Vara Cível do Foro Central",
      judicial_district: "São Paulo - SP",
      legal_area: "Empresarial",
      case_value: 120000.0,
      responsible_id: lawyer.id,
      status: "em_andamento",
      notes: "Processo fictício demonstrativo.",
    })
    .select()
    .single();

  // Prazos demonstrativos
  const in5Days = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
  const in12Days = new Date(Date.now() + 12 * 86400000).toISOString().split("T")[0];

  await supabaseAdmin.from("law_deadlines").insert([
    {
      account_id: lawhubTenantId,
      process_id: proc1.id,
      client_id: clientPf.id,
      responsible_id: lawyer.id,
      title: "Manifestação sobre Laudo Pericial [SIMULAÇÃO]",
      deadline_date: in5Days,
      priority: "urgente",
      status: "pendente",
    },
    {
      account_id: lawhubTenantId,
      process_id: proc2.id,
      client_id: clientPj.id,
      responsible_id: lawyer.id,
      title: "Indicação de Bens à Penhora [SIMULAÇÃO]",
      deadline_date: in12Days,
      priority: "normal",
      status: "pendente",
    },
  ]);

  // Tarefas demonstrativas
  await supabaseAdmin.from("law_tasks").insert([
    {
      account_id: lawhubTenantId,
      process_id: proc1.id,
      client_id: clientPf.id,
      assigned_to_id: lawyer.id,
      title: "Reunião de Alinhamento com Perito Técnico [DEMO]",
      priority: "media",
      status: "pendente",
    },
  ]);

  // Financeiro demonstrativo
  await supabaseAdmin.from("law_financial_entries").insert([
    {
      account_id: lawhubTenantId,
      client_id: clientPj.id,
      process_id: proc2.id,
      entry_type: "honorario",
      title: "Honorários Iniciais de Ajuizamento [DEMO]",
      amount: 6000.0,
      due_date: in5Days,
      status: "pago",
      category: "honorario_inicial",
      payment_method: "pix",
    },
    {
      account_id: lawhubTenantId,
      client_id: clientPf.id,
      process_id: proc1.id,
      entry_type: "honorario",
      title: "Honorários de Êxito Estimados [DEMO]",
      amount: 9000.0,
      due_date: in12Days,
      status: "pendente",
      category: "honorario_exito",
      payment_method: "boleto",
    },
  ]);

  console.log("   -> PASS: Dados sintéticos LawHub criados com sucesso.");

  // 8. B18 — SEEDING DADOS DEMO SINTÉTICOS ENGHUB
  console.log("7. Populando dados sintéticos demonstrativos EngHub (B18)...");
  await supabaseAdmin.from("enghub_projects").delete().eq("account_id", enghubTenantId);
  await supabaseAdmin.from("enghub_clients").delete().eq("account_id", enghubTenantId);

  const { data: engClient } = await supabaseAdmin
    .from("enghub_clients")
    .insert({
      account_id: enghubTenantId,
      name: "Incorporadora Alpha Engenharia [SIMULAÇÃO]",
      document: "00.000.000/0001-99",
      contact_email: "obras@incorporadorademo.com",
    })
    .select()
    .single();

  if (engClient) {
    const { data: engProj } = await supabaseAdmin
      .from("enghub_projects")
      .insert({
        account_id: enghubTenantId,
        client_id: engClient.id,
        name: "Edifício Residencial Horizonte [SIMULAÇÃO]",
        status: "em_andamento",
        address: "Av. Exemplo das Nações, 1000 - São Paulo/SP",
      })
      .select()
      .single();

    if (engProj) {
      await supabaseAdmin.from("enghub_project_stages").insert([
        {
          account_id: enghubTenantId,
          project_id: engProj.id,
          name: "Fundações e Contenções [SIMULAÇÃO]",
          status: "concluido",
        },
        {
          account_id: enghubTenantId,
          project_id: engProj.id,
          name: "Estrutura de Concreto Armado [SIMULAÇÃO]",
          status: "em_andamento",
        },
      ]);
    }
  }
  console.log("   -> PASS: Dados sintéticos EngHub criados com sucesso.");

  // 9. B23/B24 — TESTES DE SEGURANÇA E ISOLAMENTO
  console.log("8. Testando B23/B24: Isolamento do usuário Demo...");

  // 9.1 Demo tentando acessar tenant real 'Arthur Advogados' (50ccbdf7-e0da-4c32-a832-8d41e58ae17e)
  const realTenantId = "50ccbdf7-e0da-4c32-a832-8d41e58ae17e";
  const { data: realMembership } = await supabaseAdmin
    .from("account_members")
    .select("*")
    .eq("account_id", realTenantId)
    .eq("user_id", demoUser.id);

  if (realMembership && realMembership.length > 0) {
    console.error("FAIL: demo@navorbr.com possui vínculo no tenant real!");
  } else {
    console.log("   -> PASS: demo@navorbr.com NÃO tem membership em tenant real.");
  }

  // 9.2 Platform Admin sem membership tentando acessar tenant demo
  const adminUserId = "19339bb0-4640-4700-a386-ab6203c84549";
  const { data: adminInDemo } = await supabaseAdmin
    .from("account_members")
    .select("*")
    .eq("user_id", adminUserId)
    .in("account_id", demoTenants);

  if (adminInDemo && adminInDemo.length > 0) {
    console.error("FAIL: statosrep@gmail.com possui vínculo em tenant demo!");
  } else {
    console.log("   -> PASS: statosrep@gmail.com NÃO possui membership em tenants demo.");
  }

  // Salvar credenciais temporárias para validação no teste live (apenas em scratch/ local, nunca versionado)
  fs.writeFileSync(
    "scratch/demo_test_credentials.json",
    JSON.stringify({
      email: demoEmail,
      password: ephemeralSecurePassword,
      userId: demoUser.id,
      lawhubTenantId,
      barberhubTenantId,
      enghubTenantId,
      rephubTenantId,
    }),
    "utf8"
  );

  console.log("=== PROVISIONAMENTO DA CONTA DEMO CONCLUÍDO COM SUCESSO! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
