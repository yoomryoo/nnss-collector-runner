import sharp from 'sharp';
import {layoutText,needsOcrRetry} from './ocr-layout.mjs';
export async function recognizePoster(worker,bytes){
 const image=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize({width:2400,withoutEnlargement:true}).png().toBuffer();
     const metadata=await sharp(image).metadata();
     const recognize=async buffer=>{
      let timer;
      try{const recognized=await Promise.race([worker.recognize(buffer,{}, {tsv:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR timeout')),90000);timer.unref();})]);return recognized.data;}finally{clearTimeout(timer);}
     };
     let data=await recognize(image),layout=layoutText(data.tsv,metadata.width,data.text),mode=layout.columns===2?'position-columns':'position-lines';
     // A second pass uses real crops, so columns cannot be interleaved by the OCR engine.
     if(layout.split||needsOcrRetry(layout.text,data.confidence)){
      if(layout.split){
       const split=layout.split,parts=[];let confidence=0;
       for(const crop of [{left:0,top:0,width:split,height:metadata.height},{left:split,top:0,width:metadata.width-split,height:metadata.height}]){
        const region=await sharp(image).extract(crop).resize({width:1800}).normalize().png().toBuffer(),part=await recognize(region);
        parts.push(layoutText(part.tsv,1800,part.text).text);confidence+=part.confidence/2;
       }
       if(confidence>=45){layout={text:parts.join('\n\n')};data={...data,confidence};mode='cropped-columns';}
      }else{
       const retry=await sharp(image).resize({width:2800}).grayscale().normalize().png().toBuffer(),part=await recognize(retry);
       if(part.confidence>data.confidence){layout=layoutText(part.tsv,2800,part.text);data=part;mode='enhanced';}
      }
     }
 return {text:layout.text,mode,confidence:data.confidence};
}
