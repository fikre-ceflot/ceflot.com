import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase config!');
  process.exit(1);
}

async function run() {
  try {
    const fullUrl = url!.trim().replace(/\/$/, '') + '/rest/v1/boq_item_resources';
    console.log(`Sending OPTIONS request to: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      method: 'OPTIONS',
      headers: {
        'apikey': key!,
        'Authorization': `Bearer ${key!}`
      }
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      const data = await response.json();
      console.log('PostgREST OPTIONS Schema Details for boq_item_resources:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('OPTIONS request was not successful.');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

run();
