'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('../server');
const root=path.join(__dirname,'..','public');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const style=fs.readFileSync(path.join(root,'styles.css'),'utf8');

test('Two distinct 52-card franchise histories and unique named players',()=>{
 const cle=app.match(/cleveland:\{[\s\S]*?players:\[([^\]]+)\]\}/);
 const det=app.match(/detroit:\{[\s\S]*?players:\[([^\]]+)\]\}/);
 assert(cle&&det);
 for(const [name,entry] of [['Cleveland',cle],['Detroit',det]]){
  const cards=[...entry[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  assert.equal(cards.length,52,`${name} must have 52 players`);
  assert.equal(new Set(cards).size,52,`${name} must have unique players`);
 }
 assert(!det[1].includes('Mayo Smith'),'A franchise manager is not a player card');
});

test('Baseball stadium and visual card portraits are present without changing game engine',()=>{
 assert(app.includes('function diamondPosition('));
 assert(app.includes('n<=120'));
 assert(app.includes('WORLD SERIES TROPHY'));
 assert(app.includes('/portraits/'));
 assert(style.includes('.stadium-svg'));
 for(const team of ['cle','det'])for(let i=0;i<8;i++)assert(fs.existsSync(path.join(root,'portraits',`${team}-${i}.webp`)));
});

test('Portrait files serve over HTTPS-compatible HTTP routes with correct MIME and no arbitrary file access', async()=>{
 const appServer=createServer({dataFile:null});
 await new Promise(resolve=>appServer.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${appServer.server.address().port}`;
 try{
  for(const file of ['cle-0.webp','det-7.webp']){
   const response=await fetch(`${base}/portraits/${file}`);
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-type'),/image\/webp/);
   assert((await response.arrayBuffer()).byteLength>1000);
  }
  assert.equal((await fetch(`${base}/portraits/cle-9.webp`)).status,404);
  assert.equal((await fetch(`${base}/portraits/secret.txt`)).status,404);
 }finally{await new Promise(resolve=>appServer.server.close(resolve));}
});
