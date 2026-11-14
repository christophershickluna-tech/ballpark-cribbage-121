'use strict';
// A tiny Node HTTP + Server-Sent Events server. No runtime npm dependencies.
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {createGame,action,view}=require('./game');
const publicDir=path.join(__dirname,'public');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.ico':'image/x-icon'};
const roomExpiry=7*24*3600*1000;
function cleanName(n){return typeof n==='string'?n.trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,24):'';}
function createServer(options={}){
  const storage=options.dataFile===undefined?(process.env.DATA_FILE||path.join(__dirname,'data','rooms.json')):options.dataFile;
  const rooms=new Map();const streams=new Map();
  if(storage&&fs.existsSync(storage)){
    try{const raw=JSON.parse(fs.readFileSync(storage,'utf8'));for(const r of raw){if(r&&typeof r.code==='string'&&Array.isArray(r.members)&&r.updated&&Date.now()-r.updated<roomExpiry)rooms.set(r.code,r);}}
    catch(e){console.error('Could not read room storage:',e.message);}
  }
  function persist(){if(!storage)return;fs.mkdirSync(path.dirname(storage),{recursive:true});const tmp=storage+'.tmp';fs.writeFileSync(tmp,JSON.stringify([...rooms.values()]));fs.renameSync(tmp,storage);}
  function token(){return crypto.randomBytes(24).toString('base64url');}
  function code(){let c;do{c=Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');}while(rooms.has(c));return c;}
  function findRoom(body){const room=rooms.get(String(body.code||'').toUpperCase());if(!room)throw Object.assign(new Error('Room not found. Check the six-character code.'),{status:404});const seat=room.members.findIndex(m=>m&&crypto.timingSafeEqual(Buffer.from(m.token),Buffer.from(typeof body.token==='string'&&body.token.length===m.token.length?body.token:'x'.repeat(m.token.length))));if(seat<0)throw Object.assign(new Error('Session not recognized. Rejoin with the original device.'),{status:401});return {room,seat};}
  function connection(room,seat){const slots=streams.get(room.code)||[new Set(),new Set()];return slots[seat].size>0;}
  function broadcast(room){const slots=streams.get(room.code);if(!slots)return;for(let seat=0;seat<2;seat++)for(const res of slots[seat]){
    const payload={type:'state',code:room.code,waiting:!room.game,seat,players:room.members.map(m=>m&&m.name),game:room.game?view(room.game,seat,[connection(room,0),connection(room,1)]):null};
    try{res.write(`data: ${JSON.stringify(payload)}\n\n`);}catch(e){slots[seat].delete(res);}
  }}
  function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function readBody(req){return new Promise((resolve,reject)=>{
    let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>16000){reject(Object.assign(new Error('Request too large.'),{status:413}));req.destroy();}});
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON request.'),{status:400}));}});
    req.on('error',reject);
  });}
  async function handler(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,rooms:rooms.size});
    if(req.method==='POST'&&url.pathname.startsWith('/api/')){
      try{
        if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Content-Type must be application/json.'),{status:415});
        const body=await readBody(req);
        if(url.pathname==='/api/create'){
          const name=cleanName(body.name);if(!name)throw new Error('Enter your player name.');
          const c=code(),key=token();const room={code:c,members:[{name,token:key},null],game:null,updated:Date.now()};
          rooms.set(c,room);persist();return json(res,200,{code:c,token:key,seat:0});
        }
        if(url.pathname==='/api/join'){
          const c=String(body.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const room=rooms.get(c);
          if(!room)throw Object.assign(new Error('Room not found. Check the invite code.'),{status:404});
          if(room.members[1])throw Object.assign(new Error('This table already has two players.'),{status:409});
          const name=cleanName(body.name);if(!name)throw new Error('Enter your player name.');
          const key=token();room.members[1]={name,token:key};room.game=createGame(room.members.map(m=>m.name));room.updated=Date.now();persist();broadcast(room);
          return json(res,200,{code:c,token:key,seat:1});
        }
        const {room,seat}=findRoom(body);
        if(url.pathname==='/api/resume')return json(res,200,{code:room.code,seat});
        if(url.pathname==='/api/action'){
          if(!room.game)throw new Error('Waiting for the second player.');
          action(room.game,seat,body.command,body.payload||{});room.updated=Date.now();persist();broadcast(room);return json(res,200,{ok:true});
        }
        throw Object.assign(new Error('Unknown action.'),{status:404});
      }catch(e){if(!res.headersSent&&!res.destroyed)json(res,e.status||400,{error:e.message});return;}
    }
    if(req.method==='GET'&&url.pathname==='/api/events'){
      try{
        const {room,seat}=findRoom(Object.fromEntries(url.searchParams));
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        res.write('retry: 1500\n\n');
        if(!streams.has(room.code))streams.set(room.code,[new Set(),new Set()]);const slots=streams.get(room.code);slots[seat].add(res);
        broadcast(room);
        const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},20000);
        res.on('close',()=>{clearInterval(heartbeat);slots[seat].delete(res);broadcast(room);if(!slots[0].size&&!slots[1].size)streams.delete(room.code);});
      }catch(e){return json(res,e.status||401,{error:e.message});}
      return;
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
    const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
    const portrait=/^\/portraits\/(cle|det)-[0-7]\.webp$/.test(url.pathname)?url.pathname.slice(1):null;
    const file=files[url.pathname]||portrait;if(!file)return json(res,404,{error:'Not found.'});
    fs.readFile(path.join(publicDir,file),(err,data)=>{
      if(err)return json(res,404,{error:'File not found.'});
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':file==='index.html'||file==='sw.js'?'no-cache':'public, max-age=3600'});res.end(data);
    });
  }
  const server=http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error('Server error:',e);if(!res.headersSent)json(res,500,{error:'Internal server error.'});else res.end();});});
  const cleanup=setInterval(()=>{let changed=false;for(const [id,r] of rooms){const s=streams.get(id);if(Date.now()-r.updated>roomExpiry&&!s?.some(set=>set.size)){rooms.delete(id);changed=true;}}if(changed)persist();},3600*1000);cleanup.unref();
  server.on('close',()=>clearInterval(cleanup));
  return {server,rooms,streams,persist};
}
if(require.main===module){const {server}=createServer();const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`Cribbage 121 online ready on port ${port}`));}
module.exports={createServer};
