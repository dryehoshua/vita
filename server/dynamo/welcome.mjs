export const welcomeAmount=10;

export async function welcomeOffer(store,userId){
 const [programs,claim]=await Promise.all([store.list('Programs'),store.get('WelcomeClaims',userId)]);
 const program=programs.find(p=>p.test&&p.active);
 return program?{points:welcomeAmount,programId:program.id,program:program.name,claimed:Boolean(claim),test:true}:null;
}

export async function claimWelcome(store,userId){
 const offer=await welcomeOffer(store,userId);
 if(!offer)return null;
 return store.transaction(async tx=>{
  const existing=await tx.get('WelcomeClaims',userId);
  if(existing)return {...offer,claimed:true,programId:existing.programId};
  const user=await tx.get('Users',userId);
  const program=await tx.get('Programs',offer.programId);
  if(!user?.verified||user.status!=='active'||!program?.test||!program.active)return null;
  const wallet=await tx.get('Wallets#'+userId,program.id)||{program_id:program.id,program:program.id,name:program.name,balance:0};
  const created_at=new Date().toISOString();
  const id='welcome:'+program.id;
  await tx.put('Wallets#'+userId,program.id,{...wallet,balance:wallet.balance+welcomeAmount});
  await tx.put('Ledger#'+userId,id,{id,user_id:userId,program:program.id,type:'welcome',reason:'Bienvenida de prueba',delta:welcomeAmount,created_at});
  await tx.put('WelcomeClaims',userId,{programId:program.id,created_at});
  return {...offer,claimed:true};
 });
}
