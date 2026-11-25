import {CHAPTERS,WORDS} from './story.js'; import {SCENES} from './scenes.js';
let bad=0; const carried=new Set();const E=(...a)=>{bad++;console.log(...a)};
for(const c of CHAPTERS){const found=new Set(carried);const here=new Set();
 const sc=SCENES[c.id];for(const s of sc.spots){if(!c.spots[s.id])E('no text',c.id,s.id)}
 for(const id in c.spots){if(!sc.spots.find(s=>s.id===id))E('no spot',c.id,id);const s=c.spots[id];const t=[s.head,s.text,...(s.docs||[]).map(d=>d.b)].join(' ');
  for(const m of t.matchAll(/\[\[(\w+)(\|[^\]]*)?\]\]/g)){if(!WORDS[m[1]])E('unknown word',m[1]);found.add(m[1]);here.add(m[1])}}
 let blanks=0;for(const p of c.pages){const a=[...(p.faces||[]),...[...(p.text||'').matchAll(/\{(\w+)\}/g)].map(m=>m[1])];blanks+=a.length;for(const x of a){if(!WORDS[x])E('unknown answer',x);if(!found.has(x))E('unreachable',c.id,p.title,x)}if(p.hints.length!==3)E('hints')
  for(const x of p.faces||[])carried.add(x)}
 const by={};for(const w of here)(by[WORDS[w][0]]??=[]).push(w);
 console.log(c.id,'spots',sc.spots.length,'words',here.size,'blanks',blanks,Object.fromEntries(Object.entries(by).map(([k,v])=>[k,v.length])))}
console.log(bad?bad+' problems':'ok');
