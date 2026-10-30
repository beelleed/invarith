import {build} from 'esbuild';
await build({entryPoints:['frontend/react/Workspace.jsx'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:'frontend/react-shell.mjs',minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
console.log('Built React workspace shell.');
