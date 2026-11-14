const test=require('node:test');
const assert=require('node:assert/strict');
const {scoreHand,scorePeg,createGame,action,view,value,other}=require('../game');
const c=(r,s=0)=>({r,s,id:`${s}-${r}`});
test('29 point maximum hand and his nobs',()=>{
 const score=scoreHand([c(5,0),c(5,1),c(5,2),c(11,3)],c(5,3));
 assert.equal(score.total,29);assert.equal(score.nobs,1);assert.equal(score.fifteens,16);assert.equal(score.pairs,12);
});
test('crib flush only counts when all five suits match',()=>{
 const cards=[c(1),c(3),c(7),c(12)];assert.equal(scoreHand(cards,c(2,1),false).flush,4);assert.equal(scoreHand(cards,c(2,1),true).flush,0);assert.equal(scoreHand(cards,c(2),true).flush,5);
});
test('multiple runs and pair royal in counting',()=>{
 const s=scoreHand([c(3,0),c(3,1),c(4,2),c(5,3)],c(6));assert.equal(s.runs,8);assert.equal(s.pairs,2);
 assert.equal(scorePeg([c(3,0),c(3,1),c(3,2)],9).pairs,6);
 assert.equal(scorePeg([c(4,0),c(6,0),c(5,0)],15).total,5);
 assert.equal(scorePeg([c(1,0),c(1,1),c(1,2),c(1,3)],4).pairs,12);
});
test('invalid discards/turns rejected and view keeps opponent secret',()=>{
 const g=createGame(['Alice','Bob']);const p=0;
 assert.throws(()=>action(g,p,'discard',{ids:['9-99','9-98']}));
 const first=view(g,p);assert.ok(first.hand.length===6);assert.equal(first.opponentCardCount,6);assert.ok(!('deck' in first));assert.ok(!('crib' in first));assert.ok(!('kept' in first));assert.ok(!('hands' in first));
 action(g,p,'discard',{ids:first.hand.slice(0,2).map(c=>c.id)});
 assert.throws(()=>action(g,p,'discard',{ids:first.hand.slice(2,4).map(c=>c.id)}));
 const shown=view(g,p);assert.equal(shown.hand.length,4);assert.equal(shown.opponentCardCount,6);assert.equal(shown.discarded[p],true);
});
test('full random matches finish without deadlocks or duplicate cards',()=>{
 for(let match=0;match<200;match++){
  const g=createGame(['A','B']);let n=0;
  while(g.phase!=='gameOver'&&n++<1300){
   if(g.phase==='discard'){
    for(let p=0;p<2;p++)if(!g.discarded[p])action(g,p,'discard',{ids:g.hands[p].slice(0,2).map(c=>c.id)});
   }else if(g.phase==='cut'){action(g,g.active,'cut');}
   else if(g.phase==='pegging'){
    const p=g.active;const playable=g.hands[p].filter(c=>value(c)+g.count<=31);
    if(playable.length)action(g,p,'peg',{id:playable[Math.floor(Math.random()*playable.length)].id});else action(g,p,'go');
   }else if(g.phase==='show'){action(g,g.active,'count');}
   else if(g.phase==='roundEnd'){action(g,g.active,'deal');}
   else throw Error('Unknown phase '+g.phase);
   assert.ok(g.players.every(x=>x.score>=0&&x.score<150));
   assert.ok(g.count<=31);
  }
  assert.equal(g.phase,'gameOver',`Match ${match} failed after ${n} actions at ${g.phase}`);
  assert.ok(g.players[g.winner].score>=121);
  assert.ok(g.round>=1);
 }
});
test('rematch requires both players',()=>{
 const g=createGame(['A','B']);g.phase='gameOver';g.winner=0;
 action(g,0,'rematch');assert.equal(g.phase,'gameOver');assert.deepEqual(g.rematch,[true,false]);
 action(g,1,'rematch');assert.equal(g.phase,'discard');assert.deepEqual(g.players.map(p=>p.score),[0,0]);assert.equal(g.round,1);
});
