import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const res = await fetch("https://ap-experiment-zone.onrender.com/api/external/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "fyI2K26aTOeIJkw_m_vBaoHm7Y8B3J5EjunFJZCepmY",
      },
      body: JSON.stringify(body),
    });

    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
