// Independent unattended runner: secrets enter through environment or hidden stdin; never print them.
// Node >=22, npm install (including tesseract.js) required. Run from the linked Site checkout.
import {mkdir} from 'node:fs/promises';
import {createWorker} from 'tesseract.js';
import {recognizePoster} from './ocr-recognize.mjs';
const flags=new Set(process.argv.slice(2));
let config;
if(flags.has('--env')){
 for(const flag of flags)if(!['--env','--status-only','--verify-auth'].includes(flag))throw new Error('Unknown collector option');
 config={origin:process.env.NNSS_ORIGIN||'https://nnss.kr',collectorToken:process.env.NNSS_COLLECTOR_TOKEN,statusOnly:flags.has('--status-only'),verifyAuth:flags.has('--verify-auth')};
}else{
 if(flags.size)throw new Error('Use --env for environment-based execution');
 if(process.stdin.isTTY)process.stdin.setRawMode(true);
 console.log('Ready for collector JSON on stdin (input is hidden).');
 const raw=await new Promise(resolve=>{let input='';const read=chunk=>{input+=chunk.toString();if(input.length>100000)throw new Error('Collector config too large');if(input.includes('\n')){process.stdin.off('data',read);process.stdin.pause();resolve(input.slice(0,input.indexOf('\n')));}};process.stdin.on('data',read);});
 if(process.stdin.isTTY)process.stdin.setRawMode(false);
 config=JSON.parse(raw);
}
const origin=new URL(config.origin);
if(!['https://nnss.kr','https://nnss-poetry-hub.indmria.chatgpt.site'].includes(origin.origin)||origin.username||origin.password)throw new Error('Trusted NNSS HTTPS origin required');
const endpoint=new URL('/api/collector/work',origin);
if(typeof config.collectorToken!=='string'||!config.collectorToken)throw new Error('Dedicated collector authentication is required.');
const headers={Authorization:`Bearer ${config.collectorToken}`};
let leaseLost=false;
async function request(method='GET',body,path=endpoint){if(leaseLost&&body?.action!=='end')throw new Error('Collector lease was lost; stopping this run.');const r=await fetch(path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(['heartbeat','end'].includes(body?.action)?20000:600000)});if(!r.ok){const error=new Error(`Collector HTTP ${r.status}`);error.status=r.status;throw error;}return r;}
if(config.statusOnly){const snapshot=await(await request()).json();console.log(JSON.stringify({phase:'status',lastRun:snapshot.lastRun,ocrQueue:snapshot.candidates.length}));process.exit(0);}
if(config.verifyAuth){const lease=await(await request('POST',{action:'begin'})).json();headers.Authorization=`Bearer ${config.collectorToken}.${lease.runToken}`;try{await request('POST',{action:'heartbeat'});console.log(JSON.stringify({phase:'authentication',verified:true}));}finally{await request('POST',{action:'end'});}process.exit(0);}
// One lease spans discovery, every batch, OCR and finalization. Never log the run token.
const lease=await(await request('POST',{action:'begin'})).json();headers.Authorization=`Bearer ${config.collectorToken}.${lease.runToken}`;
let heartbeatTask=Promise.resolve();
const heartbeat=setInterval(()=>{heartbeatTask=request('POST',{action:'heartbeat'}).then(()=>{}).catch(()=>{leaseLost=true;process.exitCode=1;});},60_000);heartbeat.unref();
try{
let result=config.ocrOnly?null:await(await request('POST',{action:'run'})).json();
const batches=result?[result]:[];
for(let pass=0;result?.remaining>0&&pass<19;pass++){result=await(await request('POST',{action:'run',discover:false})).json();batches.push(result);console.log(JSON.stringify({phase:'collection',batch:batches.length,remaining:result.remaining,new:result.new}));}
await mkdir('.sites-runtime/ocr-cache',{recursive:true});
const queue=await(await request()).json();if(config.ids)queue.candidates=queue.candidates.filter(row=>config.ids.includes(row.id));let worker,done=0,failed=0;
try{
 for(const row of queue.candidates.slice(0,config.maxOcr||queue.candidates.length)){
  const draft=JSON.parse(row.draftJson);let text='',error=false;const pages=[];
  try{
   worker??=await createWorker(['kor','eng'],1,{cachePath:'.sites-runtime/ocr-cache',logger:()=>{}});
   for(let i=0;i<Math.min(3,draft.images.length);i++){
    try{
     const path=new URL(endpoint);path.searchParams.set('image',row.id);path.searchParams.set('index',String(i));
     const bytes=Buffer.from(await(await request('GET',null,path)).arrayBuffer());
     const recognized=await recognizePoster(worker,bytes);
     if(recognized.confidence>=45&&recognized.text.trim()){text+='\n'+recognized.text;pages.push({url:draft.images[i],text:recognized.text.slice(0,40000),mode:recognized.mode,confidence:recognized.confidence});}
     else error=true;
    }catch(e){error=true;console.log(JSON.stringify({phase:'image-error',id:row.id,index:i,message:String(e.message).slice(0,180)}));}
   }

  }catch(e){console.log(JSON.stringify({phase:'ocr-error',id:row.id,message:String(e.message).slice(0,180)}));error=true;if(worker){await worker.terminate();worker=null;}}
  if(!text.trim()&&draft.images.length)error=true;
  try{await request('POST',{action:'ocr',id:row.id,revision:row.revision,text:text.slice(0,40000),failed:error,pages,version:2});}catch(e){if(e.status===409||e.status===404)continue;throw e;}if(error)failed++;else done++;if((done+failed)%5===0)console.log(JSON.stringify({phase:'ocr',done,failed,total:queue.candidates.length}));
 }
}finally{if(worker)await worker.terminate();}
const finished=await(await request('POST',{action:'finish',ids:batches.map(b=>b.runId),ocr:{done,failed}})).json();
console.log(JSON.stringify({collection:finished,ocr:{done,failed}}));
const readback=await(await request()).json();
if(!readback.lastRun||batches.length>0&&!batches.some(batch=>batch.runId===readback.lastRun.id)||readback.lastRun.state!==finished.state)throw new Error('Persisted collection readback did not match this run');
console.log(JSON.stringify({phase:'readback',runId:readback.lastRun.id,state:readback.lastRun.state,verified:true}));
if(finished.state!=='succeeded'||failed)process.exitCode=1;

}finally{
 clearInterval(heartbeat);
 await heartbeatTask;
 try{await request('POST',{action:'end'});}catch(e){console.log(JSON.stringify({phase:'lease-release-error',message:String(e.message).slice(0,100)}));process.exitCode=1;}
}
