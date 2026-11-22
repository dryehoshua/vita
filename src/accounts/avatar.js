export const avatarAccept = 'image/*,.heic,.heif,.heics,.heifs';
const avatarEncoding = ['image/webp','image/jpeg','image/png'];

/** @type {Record<'preparing'|'ready'|'uploading'|'saved'|'readError'|'uploadError', [string, string]>} */
export const photoFeedback = {
 preparing:['Preparando tu foto…','Preparing your photo…'],
 ready:['Vista previa lista. Guarda la foto para subirla.','Preview ready. Save the photo to upload it.'],
 uploading:['Subiendo tu foto…','Uploading your photo…'],
 saved:['Foto guardada.','Photo saved.'],
 readError:['No se pudo abrir esta foto. Prueba con otra imagen.','Could not open this photo. Try a different image.'],
 uploadError:['No se pudo guardar la foto. La vista previa sigue aquí para que reintentes.','Could not save the photo. The preview is still here so you can retry.'],
};

const decodedBitmap=bitmap=>({image:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()});

async function decodeNative(file) {
 if(typeof createImageBitmap==='function'){
  try{
   return decodedBitmap(await createImageBitmap(file));
  }catch{}
 }
 const image=new Image(), url=URL.createObjectURL(file);
 const release=()=>URL.revokeObjectURL(url);
 try{
  await new Promise((resolve,reject)=>{
   image.onload=resolve;
   image.onerror=()=>reject(Error('Invalid photo'));
   image.src=url;
  });
  return {image,width:image.naturalWidth,height:image.naturalHeight,release};
 }catch(error){release();throw error;}
}

async function decodeAvatar(file){
 try{return await decodeNative(file);}
 catch(error){
  const signature=await file.slice(4,8).text();
  if(signature!=='ftyp'&&!/\.hei[cf]s?$/i.test(file.name||''))throw error;
  const {heicTo,isHeic}=await import('heic-to/csp');
  if(!await isHeic(file))throw error;
  if(typeof createImageBitmap==='function')return decodedBitmap(await heicTo({blob:file,type:'bitmap'}));
  return decodeNative(await heicTo({blob:file,type:'image/jpeg',quality:.9}));
 }
}

export async function encodeAvatar(file) {
 if(!file?.size)throw Error('Invalid photo');
 const {image,width,height,release}=await decodeAvatar(file);
 try{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const side=Math.min(width,height);
  canvas.getContext('2d').drawImage(image,(width-side)/2,(height-side)/2,side,side,0,0,512,512);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
  if(!blob||!avatarEncoding.includes(blob.type)||blob.size>2*1024*1024)throw Error('Photo conversion');
  return blob;
 }finally{release();}
}

/** @returns {Promise<string>} */
export function avatarPreview(blob) {
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(/** @type {string} */ (reader.result));
  reader.onerror=()=>reject(reader.error);
  reader.readAsDataURL(blob);
 });
}

export async function saveAvatar(client,userId,blob) {
 const path=userId+'/avatar.webp';
 const upload=await client.storage.from('avatars').upload(path,blob,{upsert:true,contentType:blob.type});
 if(upload.error)throw upload.error;
 const profile=await client.from('profiles').update({avatar_path:path}).eq('id',userId);
 if(profile.error)throw profile.error;
}
