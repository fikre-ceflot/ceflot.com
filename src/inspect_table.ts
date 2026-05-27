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

const candidates = [
  'unit_price',
  'price',
  'cost',
  'amount',
  'base_price',
  'overridden_rate',
  'manual_price',
  'manual_unit_rate',
  'hourly_rate',
  'daily_rate',
  'salary_rate',
  'subcontractor_rate',
  'labor_rate',
  'labour_rate',
  'material_rate'
];

async function inspect() {
  console.log('Testing more candidates on boq_item_resources...');
  for (const col of candidates) {
    const payload: Record<string, any> = {};
    payload[col] = 123.45;
    
    const { error } = await supabase
      .from('boq_item_resources')
      .update(payload)
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      if (error.code === 'PGRST204') {
        // Doesn't exist
      } else {
        console.log(`✅ Column "${col}" EXISTS (code ${error.code}, message "${error.message}")`);
      }
    } else {
      console.log(`✅ Column "${col}" EXISTS (no error)`);
    }
  }
}

inspect();
