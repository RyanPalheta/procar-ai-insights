import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathname = url.pathname;

    // POST /seed-data/products - Upload products from Excel
    if (pathname.endsWith('/products') && req.method === 'POST') {
      const { products } = await req.json();
      
      console.log(`[seed-data] Inserting ${products.length} products`);
      
      const { data, error } = await supabase
        .from('products')
        .upsert(products, { onConflict: 'product_name' });

      if (error) {
        console.error('[seed-data] Error inserting products:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[seed-data] Successfully inserted ${products.length} products`);
      return new Response(
        JSON.stringify({ success: true, products_inserted: products.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /seed-data/playbook - Upload single playbook
    if (pathname.endsWith('/playbook') && req.method === 'POST') {
      const { product_type, title, content, steps } = await req.json();

      console.log(`[seed-data] Inserting playbook for type: ${product_type}`);

      const { data, error } = await supabase
        .from('playbooks')
        .upsert({ 
          product_type, 
          title, 
          content,
          steps: steps || null,
          metadata: { imported_at: new Date().toISOString() }
        }, { onConflict: 'product_type' });

      if (error) {
        console.error('[seed-data] Error inserting playbook:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[seed-data] Successfully inserted playbook: ${product_type}`);
      return new Response(
        JSON.stringify({ success: true, playbook_inserted: product_type }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[seed-data] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
