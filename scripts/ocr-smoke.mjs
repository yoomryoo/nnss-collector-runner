import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {createWorker} from 'tesseract.js';
await mkdir('.sites-runtime/ocr-cache',{recursive:true});
const bytes=await sharp(Buffer.from('<svg width="1000" height="240"><rect width="100%" height="100%" fill="white"/><text x="40" y="170" font-family="DejaVu Sans" font-size="130" fill="black">NNSS 2026</text></svg>')).png().toBuffer();
const worker=await createWorker(['kor','eng'],1,{cachePath:'.sites-runtime/ocr-cache',logger:()=>{}});
try {const result=await worker.recognize(bytes);assert.match(result.data.text,/2026/);console.log('Free Korean/English Tesseract runtime smoke check passed.');}
finally {await worker.terminate();}
