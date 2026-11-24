// Tesseract TSV words retain position. Separate a repeated central gutter before joining lines.
export function layoutText(tsv,width,fallback=''){
 const words=String(tsv||'').split('\n').slice(1).map(row=>row.split('\t')).filter(c=>c[0]==='5'&&c.slice(11).join('\t').trim()).map(c=>({x:+c[6],y:+c[7],w:+c[8],h:+c[9],text:c.slice(11).join('\t').trim(),line:c.slice(1,5).join(':')}));
 if(!words.length)return {text:fallback,columns:1,split:null};
 const lines=new Map();for(const w of words){const line=lines.get(w.line)||[];line.push(w);lines.set(w.line,line);}
 const ordered=[...lines.values()].sort((a,b)=>Math.min(...a.map(w=>w.y))-Math.min(...b.map(w=>w.y)));
 const gaps=[];
 for(const line of ordered){const sorted=[...line].sort((a,b)=>a.x-b.x);for(let i=1;i<sorted.length;i++){const left=sorted[i-1],right=sorted[i],gap=right.x-left.x-left.w,center=(right.x+left.x+left.w)/2;if(gap>width*.07&&center>width*.32&&center<width*.68)gaps.push(center);}}
 const sectionStarts=[];
 for(const line of ordered){
  const sorted=[...line].sort((a,b)=>a.x-b.x),joined=sorted.map(w=>w.text.replace(/\s/g,'')).join('');
  for(const label of ['본선진출자발표','본선대회','본선경연','심사위원','시상내용']){
   const index=joined.indexOf(label);if(index<0)continue;let offset=0;
   const word=sorted.find(w=>{const end=offset+w.text.replace(/\s/g,'').length,match=offset<=index&&end>index;offset=end;return match;});
   if(word&&word.x>width*.4&&word.x<width*.7)sectionStarts.push(word.x);
  }
 }
 let split=null;
 for(const center of gaps){const matches=gaps.filter(x=>Math.abs(x-center)<width*.07);if(matches.length>=3){split=matches.reduce((a,b)=>a+b,0)/matches.length;break;}}
 if(sectionStarts.length>=2){sectionStarts.sort((a,b)=>a-b);split=sectionStarts[Math.floor(sectionStarts.length/2)]-width*.012;}
 const render=group=>group.map(line=>line.sort((a,b)=>a.x-b.x).map(w=>w.text).join(' ')).filter(Boolean).join('\n');
 if(split===null)return {text:render(ordered)||fallback,columns:1,split:null};
 // Keep spanning headers separate; never attach right-column dates to a left-column period.
 const header=[],left=[],right=[];
 for(const line of ordered){const a=line.filter(w=>w.x+w.w/2<split),b=line.filter(w=>w.x+w.w/2>=split);if(line.some(w=>w.x<split&&w.x+w.w>split)){header.push(line);continue;}if(a.length)left.push(a);if(b.length)right.push(b);}
 return {text:[render(header),render(left),render(right)].filter(Boolean).join('\n\n'),columns:2,split:Math.round(split)};
}
export function needsOcrRetry(text,confidence){return confidence<60||!text.trim()||(!/(?:접수|본선|예선|장\s*소|진출자|합격자|대상|수상)/.test(text));}
