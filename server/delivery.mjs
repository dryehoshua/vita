import nodemailer from 'nodemailer';
import {fileURLToPath} from 'node:url';
import {accountEmail} from './account-email.mjs';

const logo=fileURLToPath(new URL('../dist/assets/la-vita-logo-512.png',import.meta.url));

export function createDelivery(env=process.env){
 if(!env.SMTP_HOST)return null;
 const port=Number(env.SMTP_PORT||587);
 if(![465,587].includes(port)||!env.SMTP_USER||!env.SMTP_PASSWORD||!env.MAIL_FROM)throw Error('SMTP configuration incomplete');
 const transport=nodemailer.createTransport({
  host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
  auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},
  connectionTimeout:10000,greetingTimeout:8000,socketTimeout:20000,
 });
 return {
  verify:()=>transport.verify(),
  async send({to,purpose,url,otpCode}){
   return transport.sendMail({
    from:{name:'La Vita Roma Condesa',address:env.MAIL_FROM},to,
    ...accountEmail({purpose,url,otpCode}),
    attachments:[{filename:'la-vita.png',path:logo,cid:'lavita-logo',contentType:'image/png'}],
    disableUrlAccess:true,
   });
  },
 };
}
