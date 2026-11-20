export function safePath(value) { return typeof value==='string' && /^\/[a-zA-Z0-9/_-]*$/.test(value) && !value.startsWith('//') && value.length<=240 ? value : '/'; }
export function escapeHTML(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function validConfig(c) {
 try{return c.enabled===true && c.provider==='local' && ['http:','https:'].includes(new URL(c.siteUrl).protocol) && safePath(c.privacyUrl)===c.privacyUrl && c.privacyUrl!=='/';}catch{return false;}
}
export function totals(entries){return entries.reduce((out,e)=>{out[e.program]=(out[e.program]||0)+e.delta;return out;},{});}
export function spaces(roles,memberships){return [...roles.map(r=>r.role),...memberships.filter(m=>m.active).map(m=>m.role)].filter((v,i,a)=>a.indexOf(v)===i);}
