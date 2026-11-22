import {createDelivery} from '../server/delivery.mjs';
import {chmod, mkdir, rename, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const chunks=[];
for await(const chunk of process.stdin)chunks.push(chunk);
const password=Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/,'');
if(!password)throw Error('Falta la contraseña del buzón.');
const config={
 SMTP_HOST:'smtp.ionos.com',
 SMTP_PORT:465,
 SMTP_USER:'noreply@roma-condesa.app',
 SMTP_PASSWORD:password,
 MAIL_FROM:'noreply@roma-condesa.app',
};
try{await createDelivery(config).verify();}
catch{
 console.error('IONOS no aceptó la conexión del buzón. No se guardó ningún cambio.');
 process.exit(1);
}
const dir=join(homedir(),'Library','Application Support','La Vita Runtime','.local-data');
await mkdir(dir,{mode:0o700,recursive:true});
const path=join(dir,'transactional-mail.json');
const temporary=path+'.'+randomUUID()+'.tmp';
await writeFile(temporary,JSON.stringify(config),{mode:0o600,flag:'wx'});
await chmod(temporary,0o600);
await rename(temporary,path);
console.log('Autenticación SMTP de IONOS comprobada. Configuración guardada en el Mac.');
