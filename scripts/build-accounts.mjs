import {readFileSync,rmSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
rmSync('dist/assets/accounts',{recursive:true,force:true});
await build({
 entryPoints:{'account':'src/accounts/account.js','account-header':'src/accounts/header.js','panel':'src/accounts/panel.js','client-profile':'src/client-profile/profile.tsx'},
 bundle:true,splitting:true,external:['/account-config.js'],format:'esm',target:['es2022'],
 outdir:'dist',chunkNames:'assets/accounts/[name]-[hash]',minify:true,legalComments:'eof'
});
const heicLicense=readFileSync('node_modules/heic-to/LICENSE','utf8');
writeFileSync('dist/assets/accounts/heic-to-license.txt',`heic-to 1.6.7 (LGPL-3.0)\nSource: https://github.com/hoppergee/heic-to/tree/v1.6.7\n\n${heicLicense}`);
