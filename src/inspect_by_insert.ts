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
  let projId: string | null = null;
  let boqId: string | null = null;
  let resId: string | null = null;
  
  try {
    console.log('Inserting mock project...');
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .insert([{
        name: 'Schema Inspector Temporary Project'
      }])
      .select();
      
    if (projErr) throw new Error('Project insert failed: ' + projErr.message);
    projId = proj[0].id;
    const tenantId = proj[0].tenant_id;
    console.log('Inserted Project ID:', projId, 'Tenant:', tenantId);
    
    console.log('Inserting mock BOQ item...');
    const { data: boq, error: boqErr } = await supabase
      .from('boq_items')
      .insert([{
        project_id: projId,
        tenant_id: tenantId,
        item_no: '99.99',
        description: 'Temporary BOQ item',
        unit: 'm3',
        contract_qty: 1,
        contract_rate: 100,
        contract_amount: 100
      }])
      .select();
      
    if (boqErr) throw new Error('BOQ Item insert failed: ' + boqErr.message);
    boqId = boq[0].id;
    console.log('Inserted BOQ Item ID:', boqId);
    
    console.log('Inserting mock resource...');
    const { data: res, error: resErr } = await supabase
      .from('boq_item_resources')
      .insert([{
        boq_item_id: boqId,
        tenant_id: tenantId,
        resource_name: 'Temp inspection resource',
        resource_type: 'material',
        resource_unit: 'pc',
        consumption_rate: 1,
        is_manual: true
      }])
      .select();
      
    if (resErr) {
      console.error('Resource insert failed:', resErr);
      throw new Error('Resource insert failed: ' + resErr.message);
    }
    
    resId = res[0].id;
    console.log('Inserted resource keys:', Object.keys(res[0]));
    console.log('Full inserted resource row:', res[0]);
    
  } catch (err: any) {
    console.error('Error during execution:', err.message);
  } finally {
    // Clean up in reverse order
    console.log('Cleaning up inserts...');
    if (resId) {
      await supabase.from('boq_item_resources').delete().eq('id', resId);
    }
    if (boqId) {
      await supabase.from('boq_items').delete().eq('id', boqId);
    }
    if (projId) {
      await supabase.from('projects').delete().eq('id', projId);
    }
    console.log('Clean up complete.');
  }
}

run();
