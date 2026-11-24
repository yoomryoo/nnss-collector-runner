import assert from 'node:assert/strict';
const scenario=process.env.NNSS_TEST_CASE;
let active=false,finished=false;
globalThis.fetch=async (url,init={})=>{
 assert.equal(new URL(url).origin,'https://nnss.kr');assert.match(init.headers.Authorization,new RegExp('^Bearer '+'a'.repeat(64)+'(?:\\.'+'f'.repeat(64)+')?$'));assert(!('X-NNSS-Collector' in init.headers));assert(!('X-NNSS-Run' in init.headers));assert(!('OAI-Sites-Authorization' in init.headers));
 const p=init.body?JSON.parse(init.body):null;
 if(scenario==='unauthorized')return Response.json({error:'denied'},{status:401});
 if(p?.action==='begin'){active=true;return Response.json({runToken:'f'.repeat(64)});}
 if(p?.action==='end'){assert(active);active=false;return Response.json({released:true});}
 if(p?.action==='heartbeat'){assert(active);return Response.json({renewed:true});}
 if(p?.action==='run'){assert(active);return Response.json({runId:'00000000-0000-4000-8000-000000000001',remaining:0,state:'succeeded'});}
 if(p?.action==='finish'){assert(active);assert.deepEqual(p.ocr,{done:0,failed:0});finished=true;return Response.json({state:scenario==='partial'?'partial':'succeeded',ocr:p.ocr,remaining:0});}
 if(!p)return Response.json({candidates:[],lastRun:finished?{id:scenario==='mismatch'?'another-run':'00000000-0000-4000-8000-000000000001',state:scenario==='partial'?'partial':'succeeded'}:null});
 throw new Error('Unexpected collector request');
};
process.on('exit',()=>{assert.equal(active,false,'lease must be released');});
