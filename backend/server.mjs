import {pathToFileURL} from 'node:url';
import {createAccountApp} from './account-server.mjs';
export {createApp} from './app-server.mjs';
export {createAccountApp} from './account-server.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.PORT||3210),host=process.env.HOST||'127.0.0.1';
  const server=createAccountApp();
  server.listen(port,host,()=>console.log(`Invarith account workspace is ready at ${process.env.APP_ORIGIN||'http://127.0.0.1:'+port}`));
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Set a different PORT in .env.`:error.message);process.exitCode=1;});
}
