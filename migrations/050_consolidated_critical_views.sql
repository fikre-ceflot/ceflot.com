-- migration: 050_consolidated_critical_views
-- Description: Re-asserts all critical views needed for dashboards after migrations were cleaned

DO $$ 
BEGIN
    -- 1. Project Financial Summary View
    DROP VIEW IF EXISTS public.v_project_financial_summary CASCADE;
    CREATE OR REPLACE VIEW public.v_project_financial_summary AS
    WITH project_boq AS (
        SELECT 
            project_id,
            SUM(COALESCE(contract_amount, COALESCE(contract_qty, quantity, 0) * COALESCE(contract_rate, rate, 0))) as original_budget
        FROM public.boq_items
        GROUP BY project_id
    ),
    project_variations AS (
        SELECT 
            project_id,
            SUM(COALESCE(estimated_cost, 0)) as approved_variations
        FROM public.variations
        WHERE status = 'approved'
        GROUP BY project_id
    ),
    project_actuals AS (
        SELECT 
            project_id,
            SUM(COALESCE(actual_total_cost, 0)) as actual_cost_to_date
        FROM public.daily_progress
        WHERE status = 'reviewed'
        GROUP BY project_id
    ),
    project_subcontractors AS (
        SELECT 
            project_id,
            SUM(COALESCE(gross_amount, 0)) as subcontractor_certified_to_date
        FROM public.payment_certificates
        WHERE status IN ('certified', 'paid')
        GROUP BY project_id
    )
    SELECT 
        p.id as project_id,
        p.name as project_name,
        p.tenant_id,
        COALESCE(pb.original_budget, 0) as original_budget,
        COALESCE(pv.approved_variations, 0) as approved_variations,
        (COALESCE(pb.original_budget, 0) + COALESCE(pv.approved_variations, 0)) as revised_budget,
        COALESCE(pa.actual_cost_to_date, 0) as actual_cost_to_date,
        COALESCE(ps.subcontractor_certified_to_date, 0) as subcontractor_certified_to_date,
        (COALESCE(pa.actual_cost_to_date, 0) + COALESCE(ps.subcontractor_certified_to_date, 0)) as total_expenditure,
        CASE 
            WHEN (COALESCE(pb.original_budget, 0) + COALESCE(pv.approved_variations, 0)) > 0 
            THEN ((COALESCE(pa.actual_cost_to_date, 0) + COALESCE(ps.subcontractor_certified_to_date, 0)) / (COALESCE(pb.original_budget, 0) + COALESCE(pv.approved_variations, 0))) * 100 
            ELSE 0 
        END as budget_utilization_pct
    FROM public.projects p
    LEFT JOIN project_boq pb ON p.id = pb.project_id
    LEFT JOIN project_variations pv ON p.id = pv.project_id
    LEFT JOIN project_actuals pa ON p.id = pa.project_id
    LEFT JOIN project_subcontractors ps ON p.id = ps.project_id;

    -- 2. Material Consumption Variance View
    DROP VIEW IF EXISTS public.v_material_consumption_variance CASCADE;
    CREATE OR REPLACE VIEW public.v_material_consumption_variance AS
    SELECT 
        b.project_id,
        b.tenant_id,
        m.name AS material_name,
        b.description AS activity_description,
        (b.contract_qty * COALESCE(br.consumption_rate, 0)) AS planned_qty,
        COALESCE(b.actual_qty, 0) AS actual_qty,
        CASE 
            WHEN (b.contract_qty * COALESCE(br.consumption_rate, 0)) > 0 
            THEN ((COALESCE(b.actual_qty, 0) - (b.contract_qty * br.consumption_rate)) / (b.contract_qty * br.consumption_rate)) * 100 
            ELSE 0 
        END AS variance_pct
    FROM public.boq_items b
    LEFT JOIN public.boq_item_resources br ON b.id = br.boq_item_id
    LEFT JOIN public.materials m ON br.material_id = m.id
    WHERE br.material_id IS NOT NULL;

    -- 3. Price Trends View
    DROP VIEW IF EXISTS public.v_material_price_trends CASCADE;
    CREATE OR REPLACE VIEW public.v_material_price_trends AS
    SELECT 
        po.tenant_id,
        poi.material_id,
        m.name AS material_name,
        po.issue_date AS purchase_date,
        poi.unit_rate AS purchase_price,
        m.base_rate AS library_price
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON poi.po_id = po.id
    JOIN public.materials m ON poi.material_id = m.id
    WHERE po.status IN ('approved', 'closed', 'received');

    -- 4. Inventory Health View
    DROP VIEW IF EXISTS public.v_inventory_health CASCADE;
    CREATE OR REPLACE VIEW public.v_inventory_health AS
    SELECT 
        m.id AS material_id,
        m.id AS stock_id,
        m.tenant_id,
        m.name AS material_name,
        m.name AS material_code,
        m.category,
        m.unit,
        COALESCE(m.current_stock, 0) AS current_balance,
        COALESCE(m.min_stock_level, 0) AS reorder_level,
        CASE 
            WHEN COALESCE(m.current_stock, 0) = 0 THEN 'critical'
            WHEN COALESCE(m.current_stock, 0) < COALESCE(m.min_stock_level, 0) THEN 'warning'
            ELSE 'healthy'
        END AS stock_status
    FROM public.materials m;

    -- Grant permissions
    GRANT SELECT ON public.v_project_financial_summary TO anon, authenticated, service_role;
    GRANT SELECT ON public.v_material_consumption_variance TO anon, authenticated, service_role;
    GRANT SELECT ON public.v_material_price_trends TO anon, authenticated, service_role;
    GRANT SELECT ON public.v_inventory_health TO anon, authenticated, service_role;

    -- Force cache reload
    NOTIFY pgrst, 'reload schema';
END $$;
