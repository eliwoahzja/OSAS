// Retired endpoint. Do not silently turn an old username into a student ID.
Deno.serve((req: Request) => {
  const headers = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return Response.json({ error: 'Username login has been replaced by student ID login. Reload the page and use your student ID or email.' }, { status: 410, headers });
});
