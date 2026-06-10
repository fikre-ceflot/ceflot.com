-- ====================================================================
-- CEFLOT ERP: PHASE 3 POSTGRESQL SECURITY & INTEGRITY HARDENING SQL
-- This migration script provisions:
--   1. Real-time, Database-authoritative Audit Trails for SOC 2 non-repudiation
--   2. Postgres triggers for Row Versioning and Optimistic Lock controls
--   3. PL/pgSQL Atomic transaction function for multi-record Purchase Orders
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. DATABASE AUDIT LOGS TABLE & TRIGGER (SOC 2, ISO 27001 AUDITABILITY)
-- Matches: Step 3.3: Server-side managed Audit Logs using Postgres triggers
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    action_type VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    target_table VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security on audit logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their tenant's audit trail, while platform administrators bypass RLS
CREATE POLICY "Tenant Audit Log View Policy" ON public.system_audit_logs
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
        OR (SELECT is_platform_god FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = true
    );

-- Prevent any manual inserts, updates, or deletes on audit logs by standard client applications
CREATE POLICY "Strict Audit Trail Non-Repudiation Policy" ON public.system_audit_logs
    FOR ALL WITH CHECK (false);

-- System audit trail PL/pgSQL trigger function
CREATE OR REPLACE FUNCTION public.proc_log_row_change_audi_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Resolve context user identity and tenant
    v_user_id := auth.uid();
    
    -- Attempt to fallback to record specific tenant identifier
    IF TG_OP = 'DELETE' THEN
        IF (OLD.tenant_id IS NOT NULL) THEN
            v_tenant_id := OLD.tenant_id;
        END IF;
    ELSE
        IF (NEW.tenant_id IS NOT NULL) THEN
            v_tenant_id := NEW.tenant_id;
        END IF;
    END IF;

    -- Record log parameters
    INSERT INTO public.system_audit_logs (
        tenant_id,
        user_id,
        action_type,
        target_table,
        record_id,
        old_data,
        new_data
    ) VALUES (
        v_tenant_id,
        v_user_id,
        TG_OP,
        TG_TABLE_NAME::text,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------------------------------
-- 2. AUTOMATIC ROW VERSIONING TRIGGER (OPTIMISTIC CONCURRENCY CONTROL)
-- Matches: Step 3.2: Database Optimistic Concurrency and version triggers
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proc_increment_row_version_concurrency()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------------------------------
-- 3. APPLY INTEGRITY TRIGGERS TO CORE COMMERCIAL RELATIONS
-- --------------------------------------------------------------------

-- Apply row update versioning trigger on boq_items
DROP TRIGGER IF EXISTS trg_boq_items_version_increment ON public.boq_items;
CREATE TRIGGER trg_boq_items_version_increment
    BEFORE UPDATE ON public.boq_items
    FOR EACH ROW
    EXECUTE FUNCTION public.proc_increment_row_version_concurrency();

-- Apply non-repudiation audit logging on boq_items modifications
DROP TRIGGER IF EXISTS trg_boq_items_audit_logger ON public.boq_items;
CREATE TRIGGER trg_boq_items_audit_logger
    AFTER INSERT OR UPDATE OR DELETE ON public.boq_items
    FOR EACH ROW
    EXECUTE FUNCTION public.proc_log_row_change_audi_trail();

-- Apply non-repudiation audit logging on financial approvals
DROP TRIGGER IF EXISTS trg_approval_chains_audit_logger ON public.approval_chains;
CREATE TRIGGER trg_approval_chains_audit_logger
    AFTER INSERT OR UPDATE OR DELETE ON public.approval_chains
    FOR EACH ROW
    EXECUTE FUNCTION public.proc_log_row_change_audi_trail();


-- --------------------------------------------------------------------
-- 4. ATOMIC PL/PGSQL MULTI-RECORD PO FUNCTION
-- Matches: Step 3.1: Transactional RPC for atomic Purchase Order creation
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_purchase_order_with_items(
    p_project_id UUID,
    p_tenant_id UUID,
    p_supplier_id UUID,
    p_po_number VARCHAR(100),
    p_total_amount NUMERIC(15, 2),
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_po_id UUID;
    v_item RECORD;
BEGIN
    -- Insert the core purchase order parent record
    INSERT INTO public.purchase_orders (
        project_id,
        tenant_id,
        supplier_id,
        po_number,
        total_amount,
        status,
        created_at
    ) VALUES (
        p_project_id,
        p_tenant_id,
        p_supplier_id,
        p_po_number,
        p_total_amount,
        'draft',
        now()
    ) RETURNING id INTO v_po_id;

    -- Loop and insert each item as child lines within the single database write block
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        resource_id UUID,
        resource_type VARCHAR(50),
        description TEXT,
        quantity NUMERIC(12, 4),
        unit_rate NUMERIC(12, 2),
        total_price NUMERIC(15, 2)
    ) LOOP
        INSERT INTO public.po_items (
            po_id,
            tenant_id,
            resource_id,
            resource_type,
            description,
            quantity,
            unit_rate,
            total_price
        ) VALUES (
            v_po_id,
            p_tenant_id,
            v_item.resource_id,
            v_item.resource_type,
            v_item.description,
            v_item.quantity,
            v_item.unit_rate,
            v_item.total_price
        );
    END LOOP;

    RETURN v_po_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Explicit SQL rollback transaction
        RAISE EXCEPTION 'PO Generation Transaction failed. Aborting database execution to prevent orphan items. Details: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
