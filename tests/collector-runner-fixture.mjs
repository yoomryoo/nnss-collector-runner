import assert from 'node:assert/strict';
const scenario=process.env.NNSS_TEST_CASE;
let active=false,finished=false,batches=0;
globalThis.fetch=async (url,init={})=>{
 assert.equal(new URL(url).origin,'https://nnss.kr');assert.match(init.headers.Authorization,new RegExp('^Bearer '+'a'.repeat(64)+'(?:\\.'+'f'.repeat(64)+')?$'));assert(!('X-NNSS-Collector' in init.headers));assert(!('X-NNSS-Run' in init.headers));assert(!('OAI-Sites-Authorization' in init.headers));
 const p=init.body?JSON.parse(init.body):null;
 if(scenario==='unauthorized')return Response.json({error:'denied'},{status:401});
 if(!p&&new URL(url).searchParams.has('image'))return Response.json({error:'unavailable'},{status:502});
 if(p?.action==='begin'){active=true;return Response.json({runToken:'f'.repeat(64)});}
 if(p?.action==='end'){assert(active);active=false;return Response.json({released:true});}
 if(p?.action==='heartbeat'){assert(active);return Response.json({renewed:true});}
 if(p?.action==='run'){assert(active);if(scenario==='resume')assert.equal(p.discover,false);batches++;return Response.json({runId:'00000000-0000-4000-8000-000000000001',remaining:scenario==='many-batches'&&batches<23?5:0,state:'succeeded'});}
 if(p?.action==='ocr'){assert.equal(scenario,'image-http-failure');assert.equal(p.failed,true);assert.equal(p.text,'');assert.deepEqual(p.failures,[{url:'https://example.org/poster.jpg',code:'http',status:502}]);return Response.json({saved:true});}
 if(p?.action==='finish'){assert(active);if(scenario==='many-batches')assert.equal(batches,23);assert.deepEqual(p.ocr,{done:0,failed:scenario==='image-http-failure'?1:0});finished=true;return Response.json({state:['partial','image-http-failure'].includes(scenario)?'partial':'succeeded',ocr:p.ocr,remaining:0});}
 if(!p)return Response.json({candidates:scenario==='image-http-failure'?[{id:'10000000-0000-4000-8000-000000000001',revision:1,draftJson:JSON.stringify({images:['https://example.org/poster.jpg']})}]:[],lastRun:finished?{id:scenario==='mismatch'?'another-run':'00000000-0000-4000-8000-000000000001',state:['partial','image-http-failure'].includes(scenario)?'partial':'succeeded'}:null});
 throw new Error('Unexpected collector request');
};
process.on('exit',()=>{assert.equal(active,false,'lease must be released');});
