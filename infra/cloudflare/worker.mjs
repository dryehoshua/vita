const measuredPages = new Set(['/','/cuenta','/perfil','/panel','/guias','/alojamientos','/ahora','/socialite']);
const noCache = {'Cache-Control':'no-store'};
const unavailable = () => Response.json({error:'Pilot backend unavailable'},{status:503,headers:noCache});
const offlineConfig = () => new Response('export const accountConfig={enabled:false};',{headers:{...noCache,'Content-Type':'text/javascript; charset=utf-8'}});
const notFound = () => new Response('Not found',{status:404});

function upstream(env, path) {
  if (!env.BACKEND_ORIGIN || !env.VITA_GATEWAY_KEY) return null;
  const url = new URL(path, env.BACKEND_ORIGIN);
  return url.protocol === 'https:' ? url : null;
}

async function trackPage(env, path) {
  const url = upstream(env, '/api/internal/page-view');
  if (!url) return;
  try {
    await fetch(url, {method:'POST', headers:{
      'Content-Type':'application/json', 'x-vita-gateway':env.VITA_GATEWAY_KEY,
      'x-vita-event':'page-view', Origin:'https://roma-condesa.app',
    }, body:JSON.stringify({path})});
  } catch {
    // The directory remains available during a local outage.
  }
}

export default {
  async fetch(request,env,ctx){
    const url = new URL(request.url);
    const path = url.pathname;
    if (url.hostname === 'analytics.roma-condesa.app') {
      return Response.redirect('https://roma-condesa.app/cuenta?view=analytics',302);
    }
    if (path.startsWith('/dev/') || path.startsWith('/api/internal/')) return notFound();
    if (path.startsWith('/api/') || path === '/account-config.js' || path === '/privacidad-local') {
      const failed = path === '/account-config.js' ? offlineConfig : unavailable;
      // Assign pathname rather than treating caller-controlled input as a URL.
      const target = upstream(env, '/');
      if (!target) return failed();
      target.pathname = path;
      target.search = url.search;
      const headers = new Headers(request.headers);
      headers.set('x-vita-gateway',env.VITA_GATEWAY_KEY);
      headers.delete('x-vita-event');
      try {
        const response = await fetch(new Request(target,{method:request.method,headers,
          ...(path==='/account-config.js'?{signal:AbortSignal.timeout(4000)}:{}),
          body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'}));
        if (response.status >= 502 || path==='/account-config.js'&&(!response.ok||!response.headers.get('Content-Type')?.includes('javascript')))return failed();
        const out = new Response(response.body,response);
        out.headers.set('Cache-Control','no-store');
        return out;
      } catch {
        return failed();
      }
    }
    const response = await env.ASSETS.fetch(request);
    const canonical = path.replace(/\.html$/,'').replace(/\/$/,'') || '/';
    if (ctx && request.method === 'GET' && response.ok && measuredPages.has(canonical)
      && response.headers.get('content-type')?.includes('text/html')) {
      ctx.waitUntil(trackPage(env,canonical));
    }
    return response;
  }
};
