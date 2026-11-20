// Existing static site plus same-origin API bridge. Secrets stay in Worker/server.
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')||url.pathname==='/account-config.js'||url.pathname==='/privacidad-local'){
   if(!env.BACKEND_ORIGIN||!env.VITA_GATEWAY_KEY)return new Response(JSON.stringify({error:'Pilot backend unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
   const upstream=new URL(env.BACKEND_ORIGIN);if(upstream.protocol!=='https:')return new Response('Invalid origin',{status:503});
   upstream.pathname=url.pathname;upstream.search=url.search;
   const headers=new Headers(request.headers);headers.delete('x-vita-gateway');headers.set('x-vita-gateway',env.VITA_GATEWAY_KEY);
   try{const response=await fetch(new Request(upstream,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'}));const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');return out;}catch{return new Response(JSON.stringify({error:'Pilot computer offline'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
  }
  if(url.pathname.startsWith('/dev/'))return new Response('Not found',{status:404});
  return env.ASSETS.fetch(request);
 }
};
