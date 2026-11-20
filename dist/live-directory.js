const main = document.querySelector('main');
const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
const matches = {
  '/': row => row.kind === 'promotion' && row.document.category !== 'stay'
    || row.kind === 'business' && row.document.category !== 'stay',
  '/alojamientos': row => ['business','promotion'].includes(row.kind) && row.document.category === 'stay',
  '/guias': row => ['guide','tour'].includes(row.kind),
  '/socialite': row => row.kind === 'article',
};
const day = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'}).format(new Date());
const normalized = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
const element = (tag,text) => {const el=document.createElement(tag);if(text)el.textContent=text;return el;};
function translation(es,en){return document.documentElement.lang.startsWith('en')?en:es;}
function link(href, label){
  if (!href?.startsWith('https://')) return;
  const anchor=element('a',label);
  anchor.href=href;
  anchor.rel='noopener noreferrer';
  anchor.target='_blank';
  return anchor;
}
function cover(photo) {
  if (!photo || !/^\/(assets\/|api\/workspaces\/media\/)/.test(photo.url)) return;
  const img=element('img');
  img.src=photo.url;
  img.alt=photo.caption || '';
  img.loading='lazy';
  return img;
}
function renderDetail(d){
  const dialog=element('dialog');
  dialog.className='live-detail';
  const close=element('button',translation('Cerrar','Close'));
  close.onclick=()=>dialog.close();
  const content=element('article');
  content.append(close,element('h2',d.title),element('p',d.summary));
  for(const photo of d.photos||[]){
    const img=cover(photo);
    if(!img)continue;
    const figure=element('figure');
    figure.append(img,element('figcaption',[photo.caption,photo.credit].filter(Boolean).join(' · ')));
    content.append(figure);
  }
  for(const key of ['address','venue','hours','specialty','body','bio','itinerary','meetingPoint','conditions']){
    if(d[key])content.append(element('p',d[key]));
  }
  for(const item of [...(d.menu||[]),...(d.services||[])]){
    if(item.available)content.append(element('p',item.name+' · '+new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(item.priceCents/100)));
  }
  const official=link(d.contactUrl||d.website,translation('Sitio oficial','Official site'));
  if(official)content.append(official);
  for(const source of d.sources||[]){
    const citation=link(source.url,source.title);
    if(citation)content.append(citation);
  }
  dialog.append(content);
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();
}
async function setup(){
  const filter=matches[path];
  if(!filter||!main)return;
  const response=await fetch('/api/public/content',{signal:AbortSignal.timeout(6000)});
  if(!response.ok)return;
  const {data}=await response.json();
  const rows=data.filter(filter).filter(row=>row.kind!=='promotion'||row.document.day<=day&&row.document.endDay>=day);
  if(!rows.length)return;
  const section=element('section');
  section.className='live-directory';
  const title=element('h2');
  const grid=element('div');
  function render(){
    title.textContent=translation('Fichas de La Vita','La Vita listings');
    grid.replaceChildren();
    const selected=new Map();
    for(const row of rows.slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))){
      const key=row.kind+':'+normalized(row.document.title);
      const previous=selected.get(key);
      if(!previous||previous.document.language!==document.documentElement.lang&&row.document.language===document.documentElement.lang)selected.set(key,row);
    }
    const liveCards=[];
    // Published records supersede matching cards when the standard catalog rerenders.
    for(const {document:d} of selected.values()){
      const name=normalized(d.title);
      const headings=[...main.querySelectorAll('h2,h3,h4')].filter(h=>!section.contains(h)&&normalized(h.textContent)===name);
      const duplicate=headings.map(h=>h.closest('article')).find(Boolean);
      if(duplicate) duplicate.hidden=true;
      const card=element('article');
      const img=cover(d.photos?.[0]);
      if(img)card.append(img);
      const open=element('button',d.title);
      open.onclick=()=>renderDetail(d);
      card.append(open,element('p',d.summary));
      liveCards.push(card);
    }
    grid.replaceChildren(...liveCards);
  }
  section.append(title,grid);
  main.append(section);
  render();
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
setup().catch(()=>{ /* Keep the packaged directory during a backend outage. */ });
