import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: cors });

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });

  const merchantCredential = Deno.env.get("PICPAY_MERCHANT_CREDENTIAL") || "";
  const transparentToken = Deno.env.get("PICPAY_TRANSPARENT_TOKEN") || "";
  if (!merchantCredential || !transparentToken) {
    return new Response(JSON.stringify({ error: "Checkout Transparente PicPay não configurado no servidor" }), { status: 503, headers: cors });
  }

  return new Response(JSON.stringify({ merchantCredential, transparentToken }), { status: 200, headers: cors });
});
