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
    // Select from boq_item_resources without RLS or by selecting with a wild match
    const { data, error } = await supabase
      .from('boq_item_resources')
      .select('*')
      .limit(10);
      
    if (error) {
      console.error('Fetch error:', error);
    } else {
      console.log('Row count:', data?.length);
      if (data && data.length > 0) {
        console.log('Sample row:', data[0]);
      } else {
        console.log('Table is empty. Let us check what tables are in pg_tables:');
        // Let's list all columns of boq_item_resources using the pg_catalog.pg_attribute system table if readable
        const { data: cols, error: colsErr } = await supabase
          .from('pg_attribute' as any)
          .select('*')
          .limit(1);
        console.log('pg_attribute error (expected if hidden):', colsErr?.message);
      }
    }
  } catch (err: any) {
    console.error('Fatal:', err.message);
  }
}

run();
