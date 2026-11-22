const escape = value => String(value||'').replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[char]));

export function accountEmail({purpose,otpCode,url,logo='cid:lavita-logo'}){
 const verification=purpose==='verify';
 if(verification&&!/^\d{6}$/.test(otpCode||''))throw Error('Missing verification code');
 const title=verification?'Verifica tu correo':purpose==='invite'?'Invitación a La Vita':'Recupera tu cuenta';
 const intro=verification?'Usa este código para terminar de crear tu cuenta en La Vita Roma Condesa.':purpose==='invite'?'Usa el enlace para aceptar tu invitación.':'Usa el enlace para elegir una nueva contraseña.';
 const subject=verification?'Verifica tu correo · La Vita':title+' · La Vita';
 const text=verification
  ? `La Vita Roma Condesa\n\n${intro}\n\nCódigo: ${otpCode}\nVence en 10 minutos.\n\nSi no solicitaste este código, puedes ignorar este correo.`
  : `La Vita Roma Condesa\n\n${intro}\n${url||''}\n\nSi no solicitaste este mensaje, puedes ignorarlo.`;
 const instruction=verification
  ? `<div style="margin:26px 0 12px;padding:18px 12px;background:#f7f3ec;border:1px solid #d9cfc4;border-radius:12px;text-align:center;"><div style="color:#641d32;font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;margin-bottom:9px;">Tu código</div><strong style="display:block;color:#431323;font:700 40px/1.1 'Courier New',monospace;letter-spacing:4px;">${otpCode}</strong></div>
     <p style="text-align:center;color:#625854;font:14px/1.5 Arial,sans-serif;margin:0 0 26px;">Válido por <strong>10 minutos</strong>.</p>`
  : `<p style="margin:26px 0;"><a href="${escape(url)}" style="display:inline-block;background:#641d32;color:white;text-decoration:none;border-radius:9px;padding:14px 18px;font:700 15px Arial,sans-serif;">${purpose==='invite'?'Aceptar invitación':'Restablecer contraseña'}</a></p>`;
 const preview=verification?'Tu código de acceso a La Vita. Vence en 10 minutos.':intro;
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
 <body style="margin:0;background:#f7f3ec;color:#242020;">
 <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preview}</span>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #d9cfc4;border-radius:16px;overflow:hidden;">
   <tr><td align="center" style="background:#58242f;padding:4px 0;">
    <img alt="La Vita Roma Condesa" src="${escape(logo)}" width="112" height="112" style="display:block;margin:auto;border:0;color:#fff;font:16px Georgia,serif;">
   </td></tr>
   <tr><td style="padding:26px 24px 22px;">
    <h1 style="margin:0 0 10px;color:#641d32;font:400 30px/1.15 Georgia,serif;">${title}</h1>
    <p style="font:16px/1.55 Arial,sans-serif;margin:0;">${intro}</p>
    ${instruction}
    <p style="margin:0;padding-top:16px;border-top:1px solid #e9dfd7;color:#625854;font:13px/1.5 Arial,sans-serif;">Si no solicitaste este ${verification?'código':'mensaje'}, puedes ignorar este correo.</p>
   </td></tr>
  </table>
 </td></tr></table></body></html>`;
 return {subject,text,html};
}
