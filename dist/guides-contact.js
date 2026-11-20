// Only enter a WhatsApp number approved for public display, in international digits.
// User-approved shared demo contact; individual fictional guide numbers remain null.
export const demoWhatsApp = '525573513782';
export function whatsappUrl(number,message){
  const digits=String(number||'').replace(/[\s()+-]/g,'');
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
export function guideMessage(guide,language,{experience='',date='',hours=guide.minHours,people=2}={}){
 const en=language==='en';
 const lines=[en?`Hi ${guide.name.split(' ')[0]}, I saw you on La Vita Roma Condesa and I’d like you to be my guide.`:`Hola ${guide.name.split(' ')[0]}, te vi en La Vita Roma Condesa y quiero que seas mi guía.`];
 if(experience)lines.push(en?`I’m interested in: ${experience}.`:`Me interesa: ${experience}.`);
 if(date)lines.push(en?`Preferred date: ${date}.`:`Fecha que tengo en mente: ${date}.`);
 lines.push(en?`We are ${people} people and are planning ${hours} hours.`:`Somos ${people} personas y pensamos en un recorrido de ${hours} horas.`);
 lines.push(en?'Could you share your availability, what is included, and the final price?':'¿Me compartes tu disponibilidad, qué incluye y el precio final?');
 return lines.join('\n\n');
}
