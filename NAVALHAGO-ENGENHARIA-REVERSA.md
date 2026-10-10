# Engenharia Reversa: Navalhago → BarberHub

Este documento consolida a análise funcional e visual do sistema Navalhago para servir como blueprint na implementação do BarberHub (Vercel + Supabase + Drizzle).

## 1. Identidade Visual e UX Global

### Tema e Paleta
- **Base:** Dark Mode profundo (#0f172a ou similar) para reduzir fadiga visual em ambientes de barbearia.
- **Acento Primário:** Laranja/Âmbar (#f59e0b) para CTAs, status ativos e destaques. Evita-se roxo/índigo conforme diretrizes.
- **Tipografia:** Sans-serif geométrica (Inter ou Geist) para legibilidade em dashboards densos.
- **Layout:** Sidebar fixa à esquerda (navegação principal) + Topbar (contexto, busca, perfil). Conteúdo principal com padding generoso e cards com bordas sutis.

### Navegação Global
- **Sidebar:** Módulos agrupados por domínio (Operações, Relacionamento, Financeiro, Configurações). Indicadores visuais de módulo ativo.
- **Topbar:** Seletor de barbearia (multi-tenant), notificações, acesso rápido ao caixa atual e perfil do usuário.
- **Responsividade:** Sidebar colapsável em tablets; menu hambúrguer em mobile com priorização da agenda.

---

## 2. Módulos Funcionais Detalhados

### 2.1 Agenda e Atendimento (Bloco Atendimento)
- **Visualização:** Timeline vertical por profissional com slots de horário. Arrastar-e-soltar para reagendamento.
- **Status do Agendamento:** Cores distintas para Confirmado, Em Atendimento, Finalizado, Cancelado e No-Show.
- **Checkout Rápido:** Modal ao clicar no agendamento para adicionar serviços extras, produtos vendidos, forma de pagamento e gorjeta sem sair da agenda.
- **Recorrência:** Suporte a agendamentos recorrentes (ex: corte quinzenal automático).

### 2.2 Catálogo e Equipe
- **Serviços:** Nome, preço base, duração estimada, categoria (Corte, Barba, Combo) e comissão padrão do profissional.
- **Profissionais:** Perfil com especialidades, horários de trabalho, metas mensais e histórico de avaliações.
- **Comissões Flexíveis:** Override de comissão por serviço específico ou por profissional individual.

### 2.3 Clientes (CRM)
- **Ficha Completa:** Dados pessoais, preferências (profissional favorito, bebida), histórico financeiro e frequência média.
- **Loyalty Tiers:** Níveis automáticos baseados em gasto/frequência (Bronze, Prata, Ouro) com benefícios configuráveis.
- **Aniversariantes:** Lista automática diária/semanal para campanhas proativas.

### 2.4 Clube de Assinatura
- **Planos:** Mensalidade fixa com X cortes inclusos + desconto em serviços extras.
- **Gestão de Membros:** Status ativo/pausado/cancelado, data de renovação e uso mensal dos benefícios.
- **Upsell:** Sugestão automática de upgrade quando o cliente excede o limite do plano atual.

### 2.5 Financeiro
- **Fluxo de Caixa:** Entradas/saídas categorizadas com filtro por período, profissional e forma de pagamento.
- **Contas a Pagar/Receber:** Cronograma com alertas de vencimento e conciliação bancária manual.
- **KPIs em Tempo Real:** Faturamento bruto/líquido, ticket médio, taxa de ocupação e churn rate.

### 2.6 Marketing e Fidelização
- **Campanhas:** Envio segmentado via WhatsApp/SMS baseado em comportamento (ex: sumiu há 30 dias, aniversariante).
- **Pontuação:** Regras de acúmulo/resgate configuráveis por barbearia. Extrato detalhado por cliente.
- **Relatórios de ROI:** Métricas de conversão por campanha e custo de aquisição vs. LTV.

### 2.7 Configurações
- **Dados da Barbearia:** Logo, endereço, horários de funcionamento, moeda e fuso horário.
- **Permissões:** Roles granulares (Admin, Gerente, Barbeiro, Recepcionista) com controle de acesso por módulo.
- **Integrações:** Webhooks, APIs de pagamento e conectores de mensageria.

---

## 3. Roadmap de Implementação BarberHub

### Fase 1: MVP Operacional (Semanas 1-4)
- Autenticação multi-tenant e gestão de barbearias.
- Catálogo de serviços e profissionais.
- Agenda básica com CRUD de agendamentos.
- Checkout simples e registro financeiro básico.
- Lista de clientes com histórico mínimo.

### Fase 2: Retenção e Financeiro (Semanas 5-8)
- Sistema de pontos e níveis de fidelidade.
- Fluxo de caixa completo com categorias.
- Clube de assinaturas recorrentes.
- Dashboard de KPIs operacionais.

### Fase 3: Growth e Automação (Semanas 9-12)
- Campanhas de marketing segmentadas.
- Relatórios avançados e exportação.
- Integração WhatsApp/Pagamentos.
- App mobile para barbeiros e clientes.

---

## 4. Schema Sugerido (Drizzle / Supabase)

```sql
-- Multi-tenancy core
CREATE TABLE barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin','manager','barber','receptionist')),
  metadata JSONB DEFAULT '{}'
);

-- Operations
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id),
  name TEXT NOT NULL,
  price_cents INT NOT NULL,
  duration_minutes INT NOT NULL,
  commission_pct NUMERIC(5,2) DEFAULT 0.50
);

CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  specialties TEXT[],
  schedule JSONB -- { "mon": ["09:00-18:00"], ... }
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id),
  client_id UUID, -- nullable for walk-ins
  service_ids UUID[] NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('confirmed','in_progress','completed','cancelled','no_show')),
  total_cents INT,
  payment_method TEXT
);

-- CRM & Loyalty
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id),
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  loyalty_tier TEXT DEFAULT 'bronze',
  lifetime_value_cents INT DEFAULT 0
);

CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  amount INT NOT NULL,
  reason TEXT, -- 'purchase', 'redeem', 'bonus'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id),
  appointment_id UUID REFERENCES appointments(id),
  type TEXT CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount_cents INT NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id),
  name TEXT NOT NULL,
  monthly_price_cents INT NOT NULL,
  included_cuts INT NOT NULL
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT CHECK (status IN ('active','paused','cancelled')),
  current_period_end TIMESTAMPTZ,
  used_cuts_this_period INT DEFAULT 0
);
```

---

## 5. Notas Técnicas para BarberHub

- **RLS no Supabase:** Todas as tabelas devem ter políticas de Row Level Security filtrando por `barbershop_id` extraído do JWT.
- **Drizzle Relations:** Definir relações explícitas para evitar N+1 em dashboards. Usar `with` para eager loading de agendamentos + serviços.
- **Edge Functions:** Processar webhooks de pagamento e disparos de campanha fora da API principal para não bloquear o frontend.
- **Cache:** Redis/Vercel KV para sessões ativas e cache de catálogo (leitura pesada, escrita rara).
- **Auditoria:** Trigger em tabelas críticas (transactions, subscriptions) para log imutável de alterações.

> Este documento é vivo. Atualize conforme novas descobertas ou mudanças de escopo no BarberHub.
