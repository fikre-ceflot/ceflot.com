import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase config!');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkColumn(colName: string) {
  const payload: Record<string, any> = {};
  payload[colName] = 12.34; // test numeric value
  
  const { error } = await supabase
    .from('boq_item_resources')
    .update(payload)
    .eq('id', '00000000-0000-0000-0000-000000000000'); // dummy UUID
    
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('Could not find') || error.code === '42703') {
      return { exists: false, code: error.code, message: error.message };
    }
    // Any other error means the column EXISTS (e.g., column is generated, type mismatch, or RLS/row not found etc.)
    return { exists: true, code: error.code, message: error.message };
  }
  // No error means it succeeded or matched 0 rows, which means the column exists!
  return { exists: true, code: '200', message: 'Success (or matched 0 rows)' };
}

async function run() {
  const candidates = [
    'rate', 'base_rate', 'custom_rate', 'manual_rate', 'unit_rate', 'resource_rate',
    'overridden_rate', 'override_rate', 'rate_override', 'direct_rate', 'actual_rate',
    'price', 'unit_price', 'custom_price', 'manual_price', 'override_price', 'price_override',
    'cost', 'unit_cost', 'custom_cost', 'manual_cost', 'override_cost', 'cost_override',
    'budget_rate', 'planned_rate', 'contract_rate', 'estimated_rate', 'forecast_rate',
    'target_rate', 'billing_rate', 'sale_rate', 'purchase_rate', 'effective_rate',
    'resource_unit_rate', 'user_rate', 'adjusted_rate', 'rate_adjusted', 'over_rate',
    'material_rate', 'labour_rate', 'equipment_rate', 'vehicle_rate'
  ];
  
  console.log(`Testing ${candidates.length} candidates on boq_item_resources table...`);
  
  const results = [];
  for (const col of candidates) {
    const res = await checkColumn(col);
    if (res.exists) {
      console.log(`🎉 Column "${col}" EXISTS! Error state: code=${res.code}, message=${res.message}`);
      results.push({ column: col, ...res });
    }
  }
  
  console.log('\nScanning finished.');
  console.log('Writable / Valid columns found:', results);
}

run();
