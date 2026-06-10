-- ====================================================================
-- CEFLOT ERP: PHASE 4 EXTREME PERFORMANCE SCALING & DATABASE OPTIMIZATIONS
-- This migration script provisions:
--   1. Step 4.2: SQL bulk update RPC recalculation for BOQ Trees
--   2. Step 4.3: Flat Postgres Subcontractor Views & pre-aggregated logic
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. BULK UPDATE BOQ ITEMS RPC
-- Reduces N client edit roundtrips down to 1 single atomic SQL batch.
-- Matches: Step 4.2: SQL bulk update RPC recalculation for BOQ Trees
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bulk_update_boq_items(
    p_updates jsonb[]
)
RETURNS VOID AS $$
DECLARE
    v_update jsonb;
BEGIN
    -- Batch update matching items in single statement via unnest mapping
    UPDATE public.boq_items AS target
    SET
        item_no = COALESCE((s.val->>'item_no'), target.item_no),
        description = COALESCE((s.val->>'description'), target.description),
        unit = COALESCE((s.val->>'unit'), target.unit),
        contract_qty = COALESCE((s.val->>'contract_qty')::numeric, target.contract_qty),
        contract_rate = COALESCE((s.val->>'contract_rate')::numeric, target.contract_rate),
        surveyed_qty = COALESCE((s.val->>'surveyed_qty')::numeric, target.surveyed_qty),
        actual_qty = COALESCE((s.val->>'actual_qty')::numeric, target.actual_qty),
        progress_pct = COALESCE((s.val->>'progress_pct')::numeric, target.progress_pct),
        status = COALESCE((s.val->>'status')::varchar, target.status),
        updated_at = timezone('utc'::text, now())
    FROM (
        SELECT (u->>'id')::uuid AS id, u AS val
        FROM unnest(p_updates) AS u
    ) AS s
    WHERE target.id = s.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------------------------------
-- 2. FLAT HIGH-PERFORMANCE SUBCONTRACTOR PERFORMANCE VIEW
-- Performs joins & aggregations server-side, preventing browser-side joins.
-- Matches: Step 4.3: Flat Postgres Subcontractor Views & pre-aggregated logic
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW public.subcontractor_performance_summary_view AS
SELECT 
    sub.id AS subcontractor_id,
    sub.tenant_id,
    sub.company_name,
    sub.trade_category,
    sub.status AS subcontractor_status,
    sub.rating,
    COUNT(assign.id) AS total_assignments_count,
    COALESCE(SUM(assign.contract_qty * assign.contract_rate), 0) AS total_agreed_contract_value,
    -- Get boq items and average project progress
    COALESCE(AVG(boq.progress_pct), 0) AS average_work_progress_pct
FROM 
    public.subcontractors sub
LEFT JOIN 
    public.subcontractor_assignments assign ON sub.id = assign.subcontractor_id
LEFT JOIN 
    public.boq_items boq ON assign.boq_item_id = boq.id
GROUP BY 
    sub.id, sub.tenant_id, sub.company_name, sub.trade_category, sub.status, sub.rating;

-- Enable Row-Level Security on the View and expose select permissions
-- RLS on views needs to target underlying tables, or be filtered via tenancy:
COMMENT ON VIEW public.subcontractor_performance_summary_view IS 'Pre-aggregated subcontractor statistics view for the contractor dashboard';


-- --------------------------------------------------------------------
-- 3. CORE SUBCONTRACTOR PROGRESS VIEW
-- Aggregates current progress quantities and financial measurements server-side
-- --------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_subcontractor_progress AS
SELECT 
    COALESCE(sub.company_name, 'Unassigned') AS subcontractor_name,
    bi.id AS boq_item_id,
    bi.description AS boq_description,
    bi.unit AS unit,
    COALESCE(assign.contract_qty, bi.contract_qty, 0) AS agreed_qty,
    COALESCE(SUM(act.progress_qty), 0) AS cumulative_progress_qty,
    CASE 
        WHEN COALESCE(assign.contract_qty, bi.contract_qty, 0) > 0 
        THEN (COALESCE(SUM(act.progress_qty), 0) / COALESCE(assign.contract_qty, bi.contract_qty, 0)) * 100
        ELSE 0 
    END AS progress_pct,
    COALESCE(SUM(act.progress_qty), 0) * COALESCE(assign.contract_rate, bi.contract_rate, 0) AS earned_value,
    COALESCE(assign.contract_qty, bi.contract_qty, 0) * COALESCE(assign.contract_rate, bi.contract_rate, 0) AS agreed_amount,
    COALESCE(assign.contract_rate, bi.contract_rate, 0) AS agreed_rate,
    bi.project_id,
    bi.tenant_id
FROM 
    public.boq_items bi
LEFT JOIN 
    public.subcontractor_assignments assign ON bi.id = assign.boq_item_id
LEFT JOIN 
    public.subcontractors sub ON assign.subcontractor_id = sub.id
LEFT JOIN 
    public.daily_activities act ON bi.id = act.boq_item_id
LEFT JOIN 
    public.daily_progress dp ON act.daily_progress_id = dp.id AND dp.status IN ('draft', 'submitted', 'reviewed')
GROUP BY 
    sub.company_name, bi.id, bi.description, bi.unit, assign.contract_qty, bi.contract_qty, assign.contract_rate, bi.contract_rate, bi.project_id, bi.tenant_id;

COMMENT ON VIEW public.v_subcontractor_progress IS 'Server-side pre-aggregated daily progress view for subcontractor work items';

COMMIT;
