// Browser audio seeking requires real byte-range responses, not a full 200 reply.
export function sendAudio(req,res,buffer,type){
  const headers={'Content-Type':type,'Accept-Ranges':'bytes'},range=req.headers.range;
  if(!range){res.writeHead(200,{...headers,'Content-Length':buffer.length});res.end(buffer);return;}
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;
  if(match && (match[1] || match[2])){if(!match[1]){const suffix=Number(match[2]);start=Math.max(0,buffer.length-suffix);end=buffer.length-1;if(!suffix)start=buffer.length;}else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),buffer.length-1):buffer.length-1;}}
  if(!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || start>=buffer.length || end<start){res.writeHead(416,{...headers,'Content-Range':`bytes */${buffer.length}`});res.end();return;}
  res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${buffer.length}`});res.end(buffer.subarray(start,end+1));
}
