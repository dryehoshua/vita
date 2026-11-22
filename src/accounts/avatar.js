export const avatarTypes = ['image/jpeg','image/png','image/webp'];

export async function encodeAvatar(file) {
 if(!avatarTypes.includes(file?.type)||file.size>5*1024*1024)throw Error('Invalid photo');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw Error('Photo too large');
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const side=Math.min(bitmap.width,bitmap.height);
  canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,512,512);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
  if(blob?.type!=='image/webp')throw Error('Photo conversion');
  return blob;
 }finally{bitmap.close();}
}

export async function saveAvatar(client,userId,blob) {
 const path=userId+'/avatar.webp';
 const upload=await client.storage.from('avatars').upload(path,blob,{upsert:true,contentType:'image/webp'});
 if(upload.error)throw upload.error;
 const profile=await client.from('profiles').update({avatar_path:path}).eq('id',userId);
 if(profile.error)throw profile.error;
}
