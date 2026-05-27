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

async function run() {
  try {
    const { data: mats } = await supabase.from('materials').select('*').limit(2);
    console.log('materials row:', JSON.stringify(mats, null, 2));

    const { data: fuels } = await supabase.from('fuel_types').select('*').limit(2);
    console.log('fuel_types row:', JSON.stringify(fuels, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

run();
