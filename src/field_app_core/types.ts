export type Role = 
  | 'platform_god'
  | 'tenant_admin'
  | 'contract_admin'
  | 'director'
  | 'project_coordinator'
  | 'project_manager'
  | 'qs'
  | 'finance'
  | 'procurement'
  | 'site_supervisor'
  | 'storeman'
  | 'site_encoder'
  | 'client';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  tenant_id: string;
  is_platform_god: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  project_code: string | null;
  location?: string | null;
  project_type?: string | null;
  status: 'active' | 'planning' | 'completed' | 'on_hold';
  schedule_status: 'draft' | 'baseline_locked' | null;
  start_date: string | null;
  end_date: string | null;
  contract_value: number | null;
  progress_pct?: number;
  created_at?: string;
}

export interface BOQItem {
  id: string;
  project_id: string;
  tenant_id?: string;
  bill_no: string | null;
  item_no: string | null;
  item_sequence: number | null;
  description: string;
  unit: string | null;
  contract_qty: number;
  contract_rate: number;
  contract_amount: number;
  quantity?: number;
  rate?: number;
  amount?: number;
  internal_rate: number | null;
  internal_amount: number | null;
  trade_code: string | null;
  trade_name: string | null;
  surveyed_qty: number | null;
  planning_qty?: number;
  actual_qty: number | null;
  progress_pct: number | null;
  status: 'draft' | 'in_progress' | 'complete' | 'certified' | 'recipe_pending';
  recipe_confirmed: boolean;
  section_group: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  daily_output_qty: number | null;
  created_at?: string;
}

export interface TaskDependency {
  id: string;
  project_id: string;
  tenant_id: string;
  task_id: string;
  predecessor_id: string;
  link_type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
}
