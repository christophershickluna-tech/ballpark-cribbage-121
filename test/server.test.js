const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../server');
test('HTTP create / join / private SSE / legal moves / reconnection / third seat blocked',async t=>{
 const inst=createServer({dataFile:null});const server=inst.server;await new Promise(res=>server.listen(0,'127.0.0.1',res));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 async function post(path,body){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 const host=await post('create',{name:'Alice'});assert.equal(host.status,200);assert.equal(host.data.code.length,6);
 const invite=await post('join',{code:host.data.code,name:'Bob'});assert.equal(invite.status,200);assert.equal(invite.data.seat,1);
 const third=await post('join',{code:host.data.code,name:'Charlie'});assert.equal(third.status,409);
 const h={code:host.data.code,token:host.data.token};const b={code:invite.data.code,token:invite.data.token};
 assert.equal((await post('resume',h)).data.seat,0);assert.equal((await post('resume',b)).data.seat,1);
 const room=inst.rooms.get(host.data.code);const gh=room.game;
 const sse=await fetch(base+'/api/events?'+new URLSearchParams(h));assert.equal(sse.status,200);assert.match(sse.headers.get('content-type'),/event-stream/);
 const reader=sse.body.getReader();const chunk=await reader.read();const str=new TextDecoder().decode(chunk.value);assert.match(str,/"type":"state"/);
 const own=JSON.parse(str.match(/data: (\{.*\})/)[1]);assert.equal(own.game.hand.length,6);assert.equal(own.game.opponentCardCount,6);
 const raw=JSON.stringify(own);assert.ok(!raw.includes(JSON.stringify(gh.hands[1][0])),'Other player card hidden');
 const invalid=await post('action',{...h,command:'discard',payload:{ids:gh.hands[1].slice(0,2).map(c=>c.id)}});assert.equal(invalid.status,400);
 assert.equal((await post('action',{...h,command:'discard',payload:{ids:gh.hands[0].slice(0,2).map(c=>c.id)}})).status,200);
 reader.cancel().catch(()=>{});
});
