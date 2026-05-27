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

async function inspect() {
  try {
    // 1. Get a project
    const { data: projects, error: pError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);

    if (pError) {
      console.error('Error fetching project:', pError);
    }
    console.log('Project fetched:', projects);

    const tenantId = projects?.[0]?.tenant_id;
    console.log('Found tenant_id:', tenantId);

    // 2. Clear first, let's find BOQ items with this tenant
    const { data: boqItems, error: bError } = await supabase
      .from('boq_items')
      .select('*')
      .limit(5);

    if (bError) {
      console.error('Error fetching boq_items:', bError);
    }
    console.log('BOQ items count:', boqItems?.length);

    if (boqItems && boqItems.length > 0) {
      const boqItemId = boqItems[0].id;
      console.log('Selected BOQ item ID:', boqItemId);

      // Try selecting from boq_item_resources
      const { data: resources, error: rError } = await supabase
        .from('boq_item_resources')
        .select('*');

      console.log('Resources fetch status. Error:', rError, 'Count:', resources?.length);
      if (resources && resources.length > 0) {
        console.log('Sample resource columns:', Object.keys(resources[0]));
        console.log('Sample resource row:', resources[0]);
        process.exit(0);
      }

      // Try to insert a test resource with RLS fields
      const { data: testData, error: insertError } = await supabase
        .from('boq_item_resources')
        .insert([{ 
          boq_item_id: boqItemId,
          tenant_id: tenantId, 
          resource_name: 'inspect_column_temp', 
          resource_type: 'material', 
          consumption_rate: 1, 
          resource_unit: 'pc'
        }])
        .select();

      if (insertError) {
        console.error('Insert attempt with RLS context:', insertError);
      } else {
        console.log('Successfully inserted temporary resource!');
        console.log('Resource fields:', Object.keys(testData[0]));
        console.log('Resource data:', testData[0]);
        // Clean up
        await supabase.from('boq_item_resources').delete().eq('id', testData[0].id);
      }
    }
  } catch (err) {
    console.error('Fatal inspection error:', err);
  }
}

inspect();
