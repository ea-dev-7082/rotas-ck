import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, types = "address,neighborhood,locality,place,region", limit = 5 } = await req.json();

    if (!query || query.trim().length < 2) {
      return Response.json({ features: [] });
    }

    const token = Deno.env.get("MAPBOX_API_KEY");
    if (!token) {
      return Response.json({ error: "MAPBOX_API_KEY not configured" }, { status: 500 });
    }

    const encoded = encodeURIComponent(query.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=BR&limit=${limit}&language=pt&types=${types}`;

    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ error: `Mapbox error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ features: data.features || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});