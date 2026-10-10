DROP TRIGGER IF EXISTS trg_invoices_commission ON rephub.invoices CASCADE;
DROP FUNCTION IF EXISTS rephub.recalc_commission(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.recalc_commission(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.recalc_commission(p_invoice_id uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

