import {rmSync} from 'node:fs';
import {build} from 'esbuild';
rmSync('dist/assets/accounts',{recursive:true,force:true});
await build({
 entryPoints:{'account':'src/accounts/account.js','account-header':'src/accounts/header.js','panel':'src/accounts/panel.js','client-profile':'src/client-profile/profile.tsx'},
 bundle:true,splitting:true,external:['/account-config.js'],format:'esm',target:['es2022'],
 outdir:'dist',chunkNames:'assets/accounts/[name]-[hash]',minify:true,legalComments:'eof'
});
