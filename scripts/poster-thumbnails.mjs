// Free local Sharp conversion. Dedicated derivative keys only; no catalogue writes.
import sharp from 'sharp';
import {createHash} from 'node:crypto';
export async function makePosterThumbnail(bytes){
 let result;for(const quality of [78,65,50]){result=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize({width:800,height:1200,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality,mozjpeg:true}).toBuffer();if(result.length<=350_000)return result;}
 throw new Error('Thumbnail exceeds size limit');
}
export async function syncPosterThumbnails({origin,token}){
 const url=new URL(origin);if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('HTTPS origin required');
 const headers={Authorization:'Bearer '+token};let lease;
 async function call(path,options={}){const r=await fetch(new URL(path,url),{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error('Thumbnail HTTP '+r.status);return r;}
 const endpoint='/api/collector/poster-thumbnails',before=await(await call(endpoint)).json();const result={total:before.total,pending:before.pending.length,saved:0,failed:0,originalBytes:0,thumbnailBytes:0};
 if(!before.pending.length)return {...result,remaining:0};
 lease=await(await call('/api/collector/work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'begin'})})).json();headers.Authorization='Bearer '+token+'.'+lease.runToken;
 try{for(const id of before.pending){try{await call('/api/collector/work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat'})});const source=Buffer.from(await(await call(endpoint+'?id='+encodeURIComponent(id))).arrayBuffer()),thumb=await makePosterThumbnail(source);
 const saved=await(await call(endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Upload-Id':id,'X-Original-SHA256':createHash('sha256').update(source).digest('hex')},body:thumb})).json();if(saved.saved){result.saved++;result.originalBytes+=source.length;result.thumbnailBytes+=thumb.length;}
 }catch{result.failed++;}}
 const after=await(await call(endpoint)).json();return {...result,remaining:after.pending.length};
 }finally{await call('/api/collector/work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end'})});}
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const result=await syncPosterThumbnails({origin:process.env.NNSS_ORIGIN||'https://nnss.kr',token:process.env.NNSS_COLLECTOR_TOKEN||''});console.log(JSON.stringify(result));if(result.failed||result.remaining)process.exitCode=1;
}
