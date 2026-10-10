--
-- PostgreSQL database dump
--

\restrict PyV7zS2YOcxf6IBDDqf5vCVhjoYWBWOzXrih8Y5hQlxIZBTpWzSJqxdV5JkeEqd

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: rephub; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA rephub;


ALTER SCHEMA rephub OWNER TO postgres;

--
-- Name: recalc_commission(uuid); Type: FUNCTION; Schema: rephub; Owner: postgres
--

CREATE FUNCTION rephub.recalc_commission(p_invoice_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'rephub', 'public'
    AS $$
DECLARE
  inv record;
  br record;
  fa record;
  v_mode text;
  v_pi numeric;
  v_ps numeric;
  v_src text;
  v_settled numeric := 0;
  v_potential numeric := 0;
  v_released numeric := 0;
  v_received numeric := 0;
  v_status text;
  v_cid uuid;
BEGIN
  SELECT * INTO inv FROM rephub.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO br FROM rephub.brands WHERE id = inv.brand_id;
  SELECT * INTO fa FROM rephub.factories WHERE id = COALESCE(inv.factory_id, br.factory_id);

  IF br.commission_mode IS NOT NULL THEN
    v_mode := br.commission_mode;
    v_pi := COALESCE(br.commission_pct_invoice, 0);
    v_ps := COALESCE(br.commission_pct_settlement, 0);
    v_src := 'Marca';
  ELSE
    v_mode := COALESCE(fa.commission_mode, 'Faturamento');
    v_pi := COALESCE(fa.commission_pct_invoice, 0);
    v_ps := COALESCE(fa.commission_pct_settlement, 0);
    v_src := 'Fábrica';
  END IF;

  SELECT COALESCE(sum(paid_amount), 0) INTO v_settled
  FROM rephub.invoice_installments WHERE invoice_id = inv.id;

  IF v_mode = 'Liquidez' THEN
    v_potential := round(inv.invoiced_value * v_ps / 100, 2);
    v_released := round(v_settled * v_ps / 100, 2);
  ELSIF v_mode = 'Mista' THEN
    v_potential := round(inv.invoiced_value * (v_pi + v_ps) / 100, 2);
    v_released := round(inv.invoiced_value * v_pi / 100, 2) + round(v_settled * v_ps / 100, 2);
  ELSE
    v_potential := round(inv.invoiced_value * v_pi / 100, 2);
    v_released := v_potential;
  END IF;

  SELECT id, received_amount INTO v_cid, v_received
  FROM rephub.commissions WHERE invoice_id = inv.id;
  v_received := COALESCE(v_received, 0);

  IF v_potential > 0 AND v_received >= v_potential THEN
    v_status := 'Recebida';
  ELSIF v_received > 0 THEN
    v_status := 'Parcialmente recebida';
  ELSIF v_released > 0 THEN
    v_status := 'A receber';
  ELSE
    v_status := 'Prevista';
  END IF;

  IF v_cid IS NULL THEN
    INSERT INTO rephub.commissions (
      invoice_id, order_id, client_id, factory_id, brand_id, collection_id, brand_collection_id,
      mode, rule_source, pct_invoice, pct_settlement, base_invoiced, base_settled,
      potential_amount, released_amount, received_amount, pending_amount, status, calc_memory
    ) VALUES (
      inv.id, inv.order_id, inv.client_id, COALESCE(inv.factory_id, br.factory_id), inv.brand_id, inv.collection_id, inv.brand_collection_id,
      v_mode, v_src, v_pi, v_ps, inv.invoiced_value, v_settled,
      v_potential, v_released, 0, GREATEST(v_released - 0, 0), v_status,
      jsonb_build_object(
        'modalidade', v_mode, 'origem_regra', v_src,
        'pct_faturamento', v_pi, 'pct_liquidez', v_ps,
        'base_faturada', inv.invoiced_value, 'base_liquidada', v_settled,
        'comissao_potencial', v_potential, 'comissao_liberada', v_released,
        'calculado_em', now()
      )
    );
  ELSE
    UPDATE rephub.commissions SET
      order_id = inv.order_id,
      client_id = inv.client_id,
      factory_id = COALESCE(inv.factory_id, br.factory_id),
      brand_id = inv.brand_id,
      collection_id = inv.collection_id,
      brand_collection_id = inv.brand_collection_id,
      mode = v_mode,
      rule_source = v_src,
      pct_invoice = v_pi,
      pct_settlement = v_ps,
      base_invoiced = inv.invoiced_value,
      base_settled = v_settled,
      potential_amount = v_potential,
      released_amount = v_released,
      pending_amount = GREATEST(v_released - v_received, 0),
      status = v_status,
      calculated_at = now(),
      calc_memory = jsonb_build_object(
        'modalidade', v_mode, 'origem_regra', v_src,
        'pct_faturamento', v_pi, 'pct_liquidez', v_ps,
        'base_faturada', inv.invoiced_value, 'base_liquidada', v_settled,
        'comissao_potencial', v_potential, 'comissao_liberada', v_released,
        'comissao_recebida', v_received, 'calculado_em', now()
      )
    WHERE id = v_cid;
  END IF;
END;
$$;


ALTER FUNCTION rephub.recalc_commission(p_invoice_id uuid) OWNER TO postgres;

--
-- Name: trg_invoice_commission(); Type: FUNCTION; Schema: rephub; Owner: postgres
--

CREATE FUNCTION rephub.trg_invoice_commission() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rephub', 'public'
    AS $$
BEGIN
  PERFORM rephub.recalc_commission(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION rephub.trg_invoice_commission() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: brand_collections; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.brand_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    factory_id uuid,
    name text NOT NULL,
    brand_code text,
    start_date date,
    end_date date,
    status text DEFAULT 'Planejada'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    description text,
    photos_link text,
    allow_download boolean DEFAULT true NOT NULL
);


ALTER TABLE rephub.brand_collections OWNER TO postgres;

--
-- Name: brands; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    legal_name text,
    trade_name text,
    cnpj text,
    brand text NOT NULL,
    segment text,
    commercial_contact text,
    phone text,
    whatsapp text,
    email text,
    website text,
    state text,
    city text,
    address text,
    notes text,
    status text DEFAULT 'Ativa'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    factory_id uuid,
    representative text,
    commission_mode text,
    commission_pct_invoice numeric(6,3),
    commission_pct_settlement numeric(6,3),
    is_demo boolean DEFAULT false NOT NULL,
    logo_url text,
    states text[] DEFAULT '{}'::text[] NOT NULL
);


ALTER TABLE rephub.brands OWNER TO postgres;

--
-- Name: client_brand_access; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.client_brand_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    status text DEFAULT 'Ativa'::text NOT NULL,
    notes text,
    authorized_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE rephub.client_brand_access OWNER TO postgres;

--
-- Name: client_brands; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.client_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    start_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.client_brands OWNER TO postgres;

--
-- Name: client_collection_access; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.client_collection_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE rephub.client_collection_access OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cnpj text,
    legal_name text NOT NULL,
    trade_name text,
    state_registration text,
    segment text,
    client_type text,
    city text,
    state text,
    address text,
    district text,
    zip_code text,
    contact_name text,
    contact_role text,
    phone text,
    whatsapp text,
    email text,
    instagram text,
    other_contacts text,
    interest_brands text[] DEFAULT '{}'::text[] NOT NULL,
    owner_id uuid,
    owner_name text,
    first_contact_date date,
    source text,
    status text DEFAULT 'Prospect'::text NOT NULL,
    purchase_potential text,
    notes text,
    origin_lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE rephub.clients OWNER TO postgres;

--
-- Name: collections; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    brand_id uuid,
    factory_id uuid,
    sales_start date,
    sales_end date,
    launch_date date,
    status text DEFAULT 'Planejada'::text NOT NULL,
    target_value numeric(14,2) DEFAULT 0 NOT NULL,
    notes text,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    description text,
    season text,
    year integer,
    cover_url text,
    portal_scope text DEFAULT 'marca'::text NOT NULL,
    allow_download boolean DEFAULT true NOT NULL,
    collection_type text
);


ALTER TABLE rephub.collections OWNER TO postgres;

--
-- Name: commission_receipt_items; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.commission_receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid NOT NULL,
    commission_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.commission_receipt_items OWNER TO postgres;

--
-- Name: commission_receipts; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.commission_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    factory_id uuid,
    received_at date DEFAULT CURRENT_DATE NOT NULL,
    expected_amount numeric(14,2) DEFAULT 0 NOT NULL,
    amount numeric(14,2) NOT NULL,
    difference numeric(14,2) DEFAULT 0 NOT NULL,
    justification text,
    period_label text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_by_name text
);


ALTER TABLE rephub.commission_receipts OWNER TO postgres;

--
-- Name: commission_rules; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.commission_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    factory_id uuid,
    brand_id uuid,
    scope text DEFAULT 'Fábrica'::text NOT NULL,
    mode text NOT NULL,
    pct_invoice numeric(6,3) DEFAULT 0 NOT NULL,
    pct_settlement numeric(6,3) DEFAULT 0 NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE rephub.commission_rules OWNER TO postgres;

--
-- Name: commissions; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    order_id uuid,
    client_id uuid,
    factory_id uuid,
    brand_id uuid,
    collection_id uuid,
    mode text NOT NULL,
    rule_source text NOT NULL,
    pct_invoice numeric(6,3) DEFAULT 0 NOT NULL,
    pct_settlement numeric(6,3) DEFAULT 0 NOT NULL,
    base_invoiced numeric(14,2) DEFAULT 0 NOT NULL,
    base_settled numeric(14,2) DEFAULT 0 NOT NULL,
    potential_amount numeric(14,2) DEFAULT 0 NOT NULL,
    released_amount numeric(14,2) DEFAULT 0 NOT NULL,
    received_amount numeric(14,2) DEFAULT 0 NOT NULL,
    pending_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'Prevista'::text NOT NULL,
    calc_memory jsonb DEFAULT '{}'::jsonb NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_collection_id uuid
);


ALTER TABLE rephub.commissions OWNER TO postgres;

--
-- Name: invoice_installments; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.invoice_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    number integer DEFAULT 1 NOT NULL,
    due_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_at date,
    status text DEFAULT 'Em aberto'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.invoice_installments OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    client_id uuid,
    factory_id uuid,
    brand_id uuid,
    collection_id uuid,
    nf_number text NOT NULL,
    issue_date date NOT NULL,
    invoiced_value numeric(14,2) NOT NULL,
    net_value numeric(14,2),
    invoiced_pieces integer,
    notes text,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    brand_collection_id uuid
);


ALTER TABLE rephub.invoices OWNER TO postgres;

--
-- Name: lead_brands; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.lead_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.lead_brands OWNER TO postgres;

--
-- Name: lead_interactions; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.lead_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    client_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_type text NOT NULL,
    responsible_name text,
    description text NOT NULL,
    result text,
    next_action text,
    next_action_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE rephub.lead_interactions OWNER TO postgres;

--
-- Name: lead_sources; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.lead_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.lead_sources OWNER TO postgres;

--
-- Name: lead_status_history; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.lead_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    changed_by_name text,
    note text
);


ALTER TABLE rephub.lead_status_history OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_at timestamp with time zone DEFAULT now() NOT NULL,
    company_name text NOT NULL,
    cnpj text,
    legal_name text,
    trade_name text,
    city text,
    state text,
    contact_name text,
    contact_role text,
    phone text,
    whatsapp text,
    email text,
    instagram text,
    website text,
    source text NOT NULL,
    status text DEFAULT 'Novo Lead'::text NOT NULL,
    owner_id uuid,
    owner_name text,
    catalog_sent boolean DEFAULT false NOT NULL,
    catalog_sent_at date,
    catalog_channel text,
    catalog_name text,
    catalog_notes text,
    positivado text DEFAULT 'Não'::text NOT NULL,
    positivado_at date,
    positivado_brand text,
    estimated_value numeric(12,2),
    effective_value numeric(12,2),
    order_number text,
    positivado_notes text,
    loss_reason text,
    loss_notes text,
    last_interaction_at timestamp with time zone,
    next_followup_at timestamp with time zone,
    notes text,
    converted_client_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE rephub.leads OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    description text NOT NULL,
    reference text,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total_value numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE rephub.order_items OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: rephub; Owner: postgres
--

CREATE TABLE rephub.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    internal_number text DEFAULT ('PED-'::text || lpad((nextval('public.order_internal_seq'::regclass))::text, 5, '0'::text)) NOT NULL,
    factory_order_number text,
    client_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    factory_id uuid,
    collection_id uuid NOT NULL,
    lead_id uuid,
    order_date date NOT NULL,
    issue_date date,
    total_value numeric(14,2) NOT NULL,
    total_pieces integer NOT NULL,
    rep_name text,
    notes text,
    status text DEFAULT 'Pedido lançado'::text NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    brand_collection_id uuid NOT NULL
);


ALTER TABLE rephub.orders OWNER TO postgres;

--
-- Name: brand_collections brand_collections_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brand_collections
    ADD CONSTRAINT brand_collections_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: client_brand_access client_brand_access_client_id_brand_id_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brand_access
    ADD CONSTRAINT client_brand_access_client_id_brand_id_key UNIQUE (client_id, brand_id);


--
-- Name: client_brand_access client_brand_access_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brand_access
    ADD CONSTRAINT client_brand_access_pkey PRIMARY KEY (id);


--
-- Name: client_brands client_brands_client_id_brand_id_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brands
    ADD CONSTRAINT client_brands_client_id_brand_id_key UNIQUE (client_id, brand_id);


--
-- Name: client_brands client_brands_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brands
    ADD CONSTRAINT client_brands_pkey PRIMARY KEY (id);


--
-- Name: client_collection_access client_collection_access_collection_id_client_id_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_collection_access
    ADD CONSTRAINT client_collection_access_collection_id_client_id_key UNIQUE (collection_id, client_id);


--
-- Name: client_collection_access client_collection_access_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_collection_access
    ADD CONSTRAINT client_collection_access_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: commission_receipt_items commission_receipt_items_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_receipt_items
    ADD CONSTRAINT commission_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: commission_receipts commission_receipts_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_receipts
    ADD CONSTRAINT commission_receipts_pkey PRIMARY KEY (id);


--
-- Name: commission_rules commission_rules_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_rules
    ADD CONSTRAINT commission_rules_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_invoice_id_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_invoice_id_key UNIQUE (invoice_id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: invoice_installments invoice_installments_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoice_installments
    ADD CONSTRAINT invoice_installments_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lead_brands lead_brands_lead_id_brand_id_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_brands
    ADD CONSTRAINT lead_brands_lead_id_brand_id_key UNIQUE (lead_id, brand_id);


--
-- Name: lead_brands lead_brands_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_brands
    ADD CONSTRAINT lead_brands_pkey PRIMARY KEY (id);


--
-- Name: lead_interactions lead_interactions_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_interactions
    ADD CONSTRAINT lead_interactions_pkey PRIMARY KEY (id);


--
-- Name: lead_sources lead_sources_name_key; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_sources
    ADD CONSTRAINT lead_sources_name_key UNIQUE (name);


--
-- Name: lead_sources lead_sources_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_sources
    ADD CONSTRAINT lead_sources_pkey PRIMARY KEY (id);


--
-- Name: lead_status_history lead_status_history_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_status_history
    ADD CONSTRAINT lead_status_history_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: idx_brand_collections_brand; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_brand_collections_brand ON rephub.brand_collections USING btree (brand_id);


--
-- Name: idx_brand_collections_collection; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_brand_collections_collection ON rephub.brand_collections USING btree (collection_id);


--
-- Name: idx_collections_brand; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_collections_brand ON rephub.collections USING btree (brand_id);


--
-- Name: idx_commissions_brand_collection; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_commissions_brand_collection ON rephub.commissions USING btree (brand_collection_id);


--
-- Name: idx_installments_invoice; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_installments_invoice ON rephub.invoice_installments USING btree (invoice_id);


--
-- Name: idx_interactions_lead; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_interactions_lead ON rephub.lead_interactions USING btree (lead_id, occurred_at DESC);


--
-- Name: idx_invoices_brand_collection; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_invoices_brand_collection ON rephub.invoices USING btree (brand_collection_id);


--
-- Name: idx_invoices_order; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_invoices_order ON rephub.invoices USING btree (order_id);


--
-- Name: idx_leads_entry; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_leads_entry ON rephub.leads USING btree (entry_at DESC);


--
-- Name: idx_leads_last_interaction; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_leads_last_interaction ON rephub.leads USING btree (last_interaction_at);


--
-- Name: idx_leads_status; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_leads_status ON rephub.leads USING btree (status);


--
-- Name: idx_orders_brand; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_orders_brand ON rephub.orders USING btree (brand_id);


--
-- Name: idx_orders_brand_collection; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_orders_brand_collection ON rephub.orders USING btree (brand_collection_id);


--
-- Name: idx_orders_client; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_orders_client ON rephub.orders USING btree (client_id);


--
-- Name: idx_orders_collection; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_orders_collection ON rephub.orders USING btree (collection_id);


--
-- Name: idx_status_history_lead; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE INDEX idx_status_history_lead ON rephub.lead_status_history USING btree (lead_id, changed_at DESC);


--
-- Name: uq_brand_collections_collection_brand; Type: INDEX; Schema: rephub; Owner: postgres
--

CREATE UNIQUE INDEX uq_brand_collections_collection_brand ON rephub.brand_collections USING btree (collection_id, brand_id);


--
-- Name: brand_collections trg_brand_collections_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_brand_collections_updated BEFORE UPDATE ON rephub.brand_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: brands trg_brands_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON rephub.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_brand_access trg_cba_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_cba_updated BEFORE UPDATE ON rephub.client_brand_access FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients trg_clients_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON rephub.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: collections trg_collections_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_collections_updated BEFORE UPDATE ON rephub.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commissions trg_commissions_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON rephub.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoice_installments trg_installments_commission; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_installments_commission AFTER INSERT OR DELETE OR UPDATE ON rephub.invoice_installments FOR EACH ROW EXECUTE FUNCTION public.trg_installment_commission();


--
-- Name: invoice_installments trg_installments_status; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_installments_status BEFORE INSERT OR UPDATE OF paid_amount, amount, due_date ON rephub.invoice_installments FOR EACH ROW EXECUTE FUNCTION public.trg_installment_status();


--
-- Name: invoice_installments trg_installments_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_installments_updated BEFORE UPDATE ON rephub.invoice_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices trg_invoices_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON rephub.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads trg_leads_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON rephub.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders trg_orders_audit; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_orders_audit AFTER UPDATE ON rephub.orders FOR EACH ROW EXECUTE FUNCTION public.trg_audit_order();


--
-- Name: orders trg_orders_updated; Type: TRIGGER; Schema: rephub; Owner: postgres
--

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON rephub.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: brand_collections brand_collections_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brand_collections
    ADD CONSTRAINT brand_collections_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: brand_collections brand_collections_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brand_collections
    ADD CONSTRAINT brand_collections_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rephub.collections(id) ON DELETE CASCADE;


--
-- Name: brand_collections brand_collections_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brand_collections
    ADD CONSTRAINT brand_collections_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: brands brands_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.brands
    ADD CONSTRAINT brands_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: client_brand_access client_brand_access_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brand_access
    ADD CONSTRAINT client_brand_access_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: client_brand_access client_brand_access_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brand_access
    ADD CONSTRAINT client_brand_access_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE CASCADE;


--
-- Name: client_brands client_brands_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brands
    ADD CONSTRAINT client_brands_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: client_brands client_brands_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_brands
    ADD CONSTRAINT client_brands_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE CASCADE;


--
-- Name: client_collection_access client_collection_access_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_collection_access
    ADD CONSTRAINT client_collection_access_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE CASCADE;


--
-- Name: client_collection_access client_collection_access_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.client_collection_access
    ADD CONSTRAINT client_collection_access_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rephub.collections(id) ON DELETE CASCADE;


--
-- Name: collections collections_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.collections
    ADD CONSTRAINT collections_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: collections collections_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.collections
    ADD CONSTRAINT collections_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: commission_receipt_items commission_receipt_items_commission_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_receipt_items
    ADD CONSTRAINT commission_receipt_items_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES rephub.commissions(id) ON DELETE CASCADE;


--
-- Name: commission_receipt_items commission_receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_receipt_items
    ADD CONSTRAINT commission_receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES rephub.commission_receipts(id) ON DELETE CASCADE;


--
-- Name: commission_receipts commission_receipts_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_receipts
    ADD CONSTRAINT commission_receipts_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_rules
    ADD CONSTRAINT commission_rules_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: commission_rules commission_rules_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commission_rules
    ADD CONSTRAINT commission_rules_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE CASCADE;


--
-- Name: commissions commissions_brand_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_brand_collection_id_fkey FOREIGN KEY (brand_collection_id) REFERENCES rephub.brand_collections(id) ON DELETE RESTRICT;


--
-- Name: commissions commissions_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE SET NULL;


--
-- Name: commissions commissions_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE SET NULL;


--
-- Name: commissions commissions_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rephub.collections(id) ON DELETE SET NULL;


--
-- Name: commissions commissions_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: commissions commissions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES rephub.invoices(id) ON DELETE CASCADE;


--
-- Name: commissions commissions_order_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.commissions
    ADD CONSTRAINT commissions_order_id_fkey FOREIGN KEY (order_id) REFERENCES rephub.orders(id) ON DELETE CASCADE;


--
-- Name: invoice_installments invoice_installments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoice_installments
    ADD CONSTRAINT invoice_installments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES rephub.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_brand_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_brand_collection_id_fkey FOREIGN KEY (brand_collection_id) REFERENCES rephub.brand_collections(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rephub.collections(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES rephub.orders(id) ON DELETE CASCADE;


--
-- Name: lead_brands lead_brands_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_brands
    ADD CONSTRAINT lead_brands_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE CASCADE;


--
-- Name: lead_brands lead_brands_lead_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_brands
    ADD CONSTRAINT lead_brands_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rephub.leads(id) ON DELETE CASCADE;


--
-- Name: lead_interactions lead_interactions_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_interactions
    ADD CONSTRAINT lead_interactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE CASCADE;


--
-- Name: lead_interactions lead_interactions_lead_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_interactions
    ADD CONSTRAINT lead_interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rephub.leads(id) ON DELETE CASCADE;


--
-- Name: lead_status_history lead_status_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.lead_status_history
    ADD CONSTRAINT lead_status_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rephub.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_converted_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.leads
    ADD CONSTRAINT leads_converted_client_id_fkey FOREIGN KEY (converted_client_id) REFERENCES rephub.clients(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES rephub.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_brand_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_brand_collection_id_fkey FOREIGN KEY (brand_collection_id) REFERENCES rephub.brand_collections(id) ON DELETE RESTRICT;


--
-- Name: orders orders_brand_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rephub.brands(id) ON DELETE RESTRICT;


--
-- Name: orders orders_client_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES rephub.clients(id) ON DELETE RESTRICT;


--
-- Name: orders orders_collection_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rephub.collections(id) ON DELETE RESTRICT;


--
-- Name: orders orders_factory_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: orders orders_lead_id_fkey; Type: FK CONSTRAINT; Schema: rephub; Owner: postgres
--

ALTER TABLE ONLY rephub.orders
    ADD CONSTRAINT orders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES rephub.leads(id) ON DELETE SET NULL;


--
-- Name: brand_collections; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.brand_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_collections brand_collections_delete; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brand_collections_delete ON rephub.brand_collections FOR DELETE TO authenticated USING (private.is_admin());


--
-- Name: brand_collections brand_collections_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brand_collections_delete_admin ON rephub.brand_collections FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: brand_collections brand_collections_insert; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brand_collections_insert ON rephub.brand_collections FOR INSERT TO authenticated WITH CHECK (private.is_admin());


--
-- Name: brand_collections brand_collections_select; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brand_collections_select ON rephub.brand_collections FOR SELECT TO authenticated USING (private.is_staff());


--
-- Name: brand_collections brand_collections_update; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brand_collections_update ON rephub.brand_collections FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: brands; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: brands brands_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brands_delete_admin ON rephub.brands FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: brands brands_insert_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brands_insert_admin ON rephub.brands FOR INSERT TO authenticated WITH CHECK (private.is_admin());


--
-- Name: brands brands_select_staff; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brands_select_staff ON rephub.brands FOR SELECT TO authenticated USING (private.is_staff());


--
-- Name: brands brands_update_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY brands_update_admin ON rephub.brands FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: client_brand_access cba_admin_write; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY cba_admin_write ON rephub.client_brand_access TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: client_collection_access cca_admin_write; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY cca_admin_write ON rephub.client_collection_access TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: client_brand_access; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.client_brand_access ENABLE ROW LEVEL SECURITY;

--
-- Name: client_brand_access client_brand_access_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY client_brand_access_select_scoped ON rephub.client_brand_access FOR SELECT TO authenticated USING ((private.is_admin() OR (EXISTS ( SELECT 1
   FROM core.client_portal_users p
  WHERE ((p.user_id = auth.uid()) AND (p.client_id = client_brand_access.client_id))))));


--
-- Name: client_brands; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.client_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: client_brands client_brands_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY client_brands_scoped ON rephub.client_brands TO authenticated USING ((private.is_admin() OR private.owns_client(client_id))) WITH CHECK ((private.is_admin() OR private.owns_client(client_id)));


--
-- Name: client_collection_access; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.client_collection_access ENABLE ROW LEVEL SECURITY;

--
-- Name: client_collection_access client_collection_access_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY client_collection_access_select_scoped ON rephub.client_collection_access FOR SELECT TO authenticated USING ((private.is_admin() OR (EXISTS ( SELECT 1
   FROM core.client_portal_users p
  WHERE ((p.user_id = auth.uid()) AND (p.client_id = client_collection_access.client_id))))));


--
-- Name: clients; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients clients_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY clients_delete_admin ON rephub.clients FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: clients clients_insert_own; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY clients_insert_own ON rephub.clients FOR INSERT TO authenticated WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR (owner_id = auth.uid())));


--
-- Name: clients clients_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY clients_select_scoped ON rephub.clients FOR SELECT TO authenticated USING ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: clients clients_update_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY clients_update_scoped ON rephub.clients FOR UPDATE TO authenticated USING ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid()))) WITH CHECK ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: collections; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: collections collections_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY collections_delete_admin ON rephub.collections FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: collections collections_insert_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY collections_insert_admin ON rephub.collections FOR INSERT TO authenticated WITH CHECK (private.is_admin());


--
-- Name: collections collections_select; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY collections_select ON rephub.collections FOR SELECT TO authenticated USING (private.is_staff());


--
-- Name: collections collections_update_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY collections_update_admin ON rephub.collections FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: commission_receipt_items; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.commission_receipt_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_receipt_items commission_receipt_items_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commission_receipt_items_admin ON rephub.commission_receipt_items TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: commission_receipts; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.commission_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_receipts commission_receipts_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commission_receipts_admin ON rephub.commission_receipts TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: commission_rules; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.commission_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_rules commission_rules_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commission_rules_admin ON rephub.commission_rules TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: commissions; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: commissions commissions_admin_insert; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commissions_admin_insert ON rephub.commissions FOR INSERT TO authenticated WITH CHECK (private.is_admin());


--
-- Name: commissions commissions_admin_read; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commissions_admin_read ON rephub.commissions FOR SELECT TO authenticated USING (private.is_admin());


--
-- Name: commissions commissions_admin_update; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commissions_admin_update ON rephub.commissions FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: commissions commissions_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY commissions_delete_admin ON rephub.commissions FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: invoice_installments; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.invoice_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_installments invoice_installments_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY invoice_installments_scoped ON rephub.invoice_installments TO authenticated USING ((private.is_admin() OR private.can_see_invoice(invoice_id))) WITH CHECK ((private.is_admin() OR private.can_see_invoice(invoice_id)));


--
-- Name: invoices; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY invoices_delete_admin ON rephub.invoices FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: invoices invoices_insert_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY invoices_insert_scoped ON rephub.invoices FOR INSERT TO authenticated WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR private.can_see_order(order_id)));


--
-- Name: invoices invoices_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY invoices_select_scoped ON rephub.invoices FOR SELECT TO authenticated USING ((private.is_admin() OR (created_by = auth.uid()) OR private.can_see_order(order_id)));


--
-- Name: invoices invoices_update_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY invoices_update_scoped ON rephub.invoices FOR UPDATE TO authenticated USING ((private.is_admin() OR (created_by = auth.uid()) OR private.can_see_order(order_id))) WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR private.can_see_order(order_id)));


--
-- Name: lead_brands; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.lead_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_brands lead_brands_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_brands_scoped ON rephub.lead_brands TO authenticated USING ((private.is_admin() OR private.owns_lead(lead_id))) WITH CHECK ((private.is_admin() OR private.owns_lead(lead_id)));


--
-- Name: lead_interactions; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.lead_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_interactions lead_interactions_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_interactions_scoped ON rephub.lead_interactions TO authenticated USING ((private.is_admin() OR ((lead_id IS NOT NULL) AND private.owns_lead(lead_id)) OR ((client_id IS NOT NULL) AND private.owns_client(client_id)))) WITH CHECK ((private.is_admin() OR ((lead_id IS NOT NULL) AND private.owns_lead(lead_id)) OR ((client_id IS NOT NULL) AND private.owns_client(client_id))));


--
-- Name: lead_sources; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.lead_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_sources lead_sources_admin_delete; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_sources_admin_delete ON rephub.lead_sources FOR DELETE TO authenticated USING (private.is_admin());


--
-- Name: lead_sources lead_sources_admin_update; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_sources_admin_update ON rephub.lead_sources FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: lead_sources lead_sources_admin_write; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_sources_admin_write ON rephub.lead_sources FOR INSERT TO authenticated WITH CHECK (private.is_admin());


--
-- Name: lead_sources lead_sources_select; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_sources_select ON rephub.lead_sources FOR SELECT TO authenticated USING (true);


--
-- Name: lead_status_history; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.lead_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_status_history lead_status_history_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY lead_status_history_scoped ON rephub.lead_status_history TO authenticated USING ((private.is_admin() OR private.owns_lead(lead_id))) WITH CHECK ((private.is_admin() OR private.owns_lead(lead_id)));


--
-- Name: leads; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads leads_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY leads_delete_admin ON rephub.leads FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: leads leads_insert_own; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY leads_insert_own ON rephub.leads FOR INSERT TO authenticated WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR (owner_id = auth.uid())));


--
-- Name: leads leads_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY leads_select_scoped ON rephub.leads FOR SELECT TO authenticated USING ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: leads leads_update_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY leads_update_scoped ON rephub.leads FOR UPDATE TO authenticated USING ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid()))) WITH CHECK ((private.is_admin() OR (owner_id = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: order_items; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY order_items_scoped ON rephub.order_items TO authenticated USING ((private.is_admin() OR private.can_see_order(order_id))) WITH CHECK ((private.is_admin() OR private.can_see_order(order_id)));


--
-- Name: orders; Type: ROW SECURITY; Schema: rephub; Owner: postgres
--

ALTER TABLE rephub.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_delete_admin; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY orders_delete_admin ON rephub.orders FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders orders_insert_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY orders_insert_scoped ON rephub.orders FOR INSERT TO authenticated WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR private.owns_client(client_id)));


--
-- Name: orders orders_select_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY orders_select_scoped ON rephub.orders FOR SELECT TO authenticated USING ((private.is_admin() OR (created_by = auth.uid()) OR private.owns_client(client_id)));


--
-- Name: orders orders_update_scoped; Type: POLICY; Schema: rephub; Owner: postgres
--

CREATE POLICY orders_update_scoped ON rephub.orders FOR UPDATE TO authenticated USING ((private.is_admin() OR (created_by = auth.uid()) OR private.owns_client(client_id))) WITH CHECK ((private.is_admin() OR (created_by = auth.uid()) OR private.owns_client(client_id)));


--
-- Name: SCHEMA rephub; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA rephub TO authenticated;


--
-- Name: TABLE brand_collections; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.brand_collections TO authenticated;
GRANT ALL ON TABLE rephub.brand_collections TO service_role;


--
-- Name: TABLE brands; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.brands TO authenticated;
GRANT ALL ON TABLE rephub.brands TO service_role;


--
-- Name: TABLE client_brand_access; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.client_brand_access TO authenticated;
GRANT ALL ON TABLE rephub.client_brand_access TO service_role;


--
-- Name: TABLE client_brands; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.client_brands TO authenticated;
GRANT ALL ON TABLE rephub.client_brands TO service_role;


--
-- Name: TABLE client_collection_access; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.client_collection_access TO authenticated;
GRANT ALL ON TABLE rephub.client_collection_access TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.clients TO authenticated;
GRANT ALL ON TABLE rephub.clients TO service_role;


--
-- Name: TABLE collections; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.collections TO authenticated;
GRANT ALL ON TABLE rephub.collections TO service_role;


--
-- Name: TABLE commission_receipt_items; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.commission_receipt_items TO authenticated;
GRANT ALL ON TABLE rephub.commission_receipt_items TO service_role;


--
-- Name: TABLE commission_receipts; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.commission_receipts TO authenticated;
GRANT ALL ON TABLE rephub.commission_receipts TO service_role;


--
-- Name: TABLE commission_rules; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.commission_rules TO authenticated;
GRANT ALL ON TABLE rephub.commission_rules TO service_role;


--
-- Name: TABLE commissions; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.commissions TO authenticated;
GRANT ALL ON TABLE rephub.commissions TO service_role;


--
-- Name: TABLE invoice_installments; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.invoice_installments TO authenticated;
GRANT ALL ON TABLE rephub.invoice_installments TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.invoices TO authenticated;
GRANT ALL ON TABLE rephub.invoices TO service_role;


--
-- Name: TABLE lead_brands; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.lead_brands TO authenticated;
GRANT ALL ON TABLE rephub.lead_brands TO service_role;


--
-- Name: TABLE lead_interactions; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.lead_interactions TO authenticated;
GRANT ALL ON TABLE rephub.lead_interactions TO service_role;


--
-- Name: TABLE lead_sources; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.lead_sources TO authenticated;
GRANT ALL ON TABLE rephub.lead_sources TO service_role;


--
-- Name: TABLE lead_status_history; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.lead_status_history TO authenticated;
GRANT ALL ON TABLE rephub.lead_status_history TO service_role;


--
-- Name: TABLE leads; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.leads TO authenticated;
GRANT ALL ON TABLE rephub.leads TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.order_items TO authenticated;
GRANT ALL ON TABLE rephub.order_items TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: rephub; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rephub.orders TO authenticated;
GRANT ALL ON TABLE rephub.orders TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict PyV7zS2YOcxf6IBDDqf5vCVhjoYWBWOzXrih8Y5hQlxIZBTpWzSJqxdV5JkeEqd

