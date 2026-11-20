import nodemailer from 'nodemailer';
export function createDelivery(env=process.env){
 if(!env.SMTP_HOST)return null;
 const port=Number(env.SMTP_PORT||587);
 if(!env.SMTP_USER||!env.SMTP_PASSWORD||!env.MAIL_FROM)throw Error('SMTP configuration incomplete');
 const transport=nodemailer.createTransport({host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 return {verify:()=>transport.verify(),async send({to,purpose,url}){return transport.sendMail({from:env.MAIL_FROM,to,subject:purpose==='verify'?'Confirma tu cuenta · La Vita':purpose==='invite'?'Invitación al equipo · La Vita':'Recupera tu cuenta · La Vita',text:`La Vita Roma Condesa\n\n${url}\n\nSi no solicitaste esta acción, ignora este mensaje. / If you did not request this, ignore this message.`});}};
}
