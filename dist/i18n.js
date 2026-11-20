import {translations as t} from './translations.js';
const picker=document.querySelector('#language');let language='es';try{language=sessionStorage.getItem('lavita-language')==='en'?'en':'es';}catch{}
const originals=new WeakMap(),attributes=new WeakMap();
const terms=['puntos de ejemplo','puntos · Demo','Música en vivo','Rooftop y lounge','Cerveza y billar','Coctelería','Bienestar','Hospedaje','Talleres','Baile','Vino','POR RESERVAR','FECHAS A CONSULTAR','CLASE MUESTRA GRATIS'];
function translate(s){const trim=s.trim();if(t[trim])return s.replace(trim,t[trim]);let out=s.replaceAll('Archivo 2023','Archive 2023');out=out.replace(/^(\d+) plan(?:es)?$/,(m,n)=>n+' '+(n==='1'?'experience':'experiences')).replace(' · Ver el plan',' · View experience').replace('Cupón demo no canjeable','Demo coupon, not redeemable').replace('Publicado por ARIA','Published by ARIA').replace(/ pts · Demo/,' pts · Demo');
if(/^Hola,\s/.test(trim))out=out.replace('Hola,','Hello,');
out=out.replace(/(\d+) planes en esta selección · Agenda y lugares reales/,'$1 experiences · Real events and venues').replace(/(\d+) puntos para el siguiente nivel de ejemplo\./,'$1 points to the next demo level.').replace('8 cupones ficticios y 1 clase muestra publicada por ARIA','8 fictional coupons and 1 trial class published by ARIA');
for(const [es,en] of Object.entries(t)){if(es.length>30&&out.includes(es))out=out.replaceAll(es,en);}
if(out.includes(' · '))out=out.split(' · ').map(v=>t[v.trim()]||v).join(' · ');
for(const term of terms){const en=t[term]||(term==='puntos · Demo'?'points · Demo':term);out=out.replaceAll(term,en);}
out=out.replace(/(\d+) Y (\d+) NOV/,'$1 & $2 NOV').replace(/(\d+) puntos · Demo/,'$1 points · Demo').replace(' · material promocional',' · promotional material').replace(' · cartel de la película',' · film poster').replace(' · sitio oficial',' · official website');
out=out.replace(/^Foto: /,'Photo: ').replace(/ · imagen publicada por el lugar u organizador/,' · image published by the venue or organizer').replace(/ · imagen del organizador/,' · organizer image').replace(/^Consulta: 5 de noviembre de 2026\. /,'Checked November 5, 2026. ');
return out;}
function apply(){observer.disconnect();document.documentElement.lang=language;picker.value=language;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
while(node=walker.nextNode()){if(node.parentElement.closest('script,style,select,textarea,code'))continue;const current=node.nodeValue;let record=originals.get(node);if(!record||current!==record.rendered)record={original:current};record.rendered=language==='en'?translate(record.original):record.original;if(current!==record.rendered)node.nodeValue=record.rendered;originals.set(node,record);}
for(const el of document.querySelectorAll('[placeholder],[aria-label],[alt]')){let record=attributes.get(el)||{};for(const a of ['placeholder','aria-label','alt'])if(el.hasAttribute(a)){const current=el.getAttribute(a);if(!record[a]||current!==record[a].rendered)record[a]={original:current};record[a].rendered=language==='en'?translate(record[a].original):record[a].original;el.setAttribute(a,record[a].rendered);}attributes.set(el,record);}
observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
const observer=new MutationObserver(apply);picker.addEventListener('change',()=>{language=picker.value;try{sessionStorage.setItem('lavita-language',language);}catch{}apply();});apply();
