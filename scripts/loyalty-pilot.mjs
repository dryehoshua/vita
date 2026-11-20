import {openStore} from '../server/dynamo/store.mjs';
const organization = 'vita-loyalty-test';
const program = 'vita-loyalty-test-visits';
const reward = 'vita-loyalty-test-reward';
const email = process.argv[2]?.trim().toLowerCase();
const store=await openStore();
try{
  await store.transaction(async tx=>{
    if(!await tx.get('Organizations',organization))await tx.put('Organizations',organization,{id:organization,name:'La Vita · Negocio de prueba',test:true});
    if(!await tx.get('Programs',program))await tx.put('Programs',program,{id:program,organization_id:organization,name:'Visitas · Prueba / Test',points_per_visit:10,daily_earn_limit:1,conditions:'Solo prueba. Sin valor comercial / Test only. No commercial value.',active:true,version:1,test:true});
    if(!await tx.get('Rewards',reward))await tx.put('Rewards',reward,{id:reward,program_id:program,title:'Canje de prueba / Test reward',cost:20,stock:10,conditions:'Sin valor comercial / No commercial value',active:true,version:1,test:true});
    if(email){
      const index = await tx.get('Emails',email);
      const account = index && await tx.get('Users',index.id);
      if(!account?.verified||account.status!=='active')throw Error('Verify the test account locally first.');
      const id=organization+':'+account.id;
      await tx.put('Memberships',id,{organization_id:organization,user_id:account.id,role:'owner',active:true});
    }
  });
  console.log(email?'Demo business ready, owner assigned.':'Demo business and reward ready.');
} finally {store.close();}
