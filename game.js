'use strict';
// Authoritative, dependency-free classic two-player cribbage engine.
const { randomInt } = require('node:crypto');
const SUITS = ['♠','♥','♦','♣'];
const rank = n => ({1:'A',11:'J',12:'Q',13:'K'}[n] || `${n}`);
const value = c => Math.min(c.r, 10);
const other = p => 1-p;
const deck = () => Array.from({length:52}, (_,i) => ({id:`${Math.floor(i/13)}-${(i%13)+1}`,s:Math.floor(i/13),r:(i%13)+1}));
function shuffle(cards) { for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[j],cards[i]]=[cards[i],cards[j]];} return cards; }
const popcount = x => {let n=0;while(x){x&=x-1;n++;}return n;};
function scoreHand(hand, starter, crib=false) {
  if(hand.length!==4||!starter) throw new Error('A counted hand requires four cards and a starter');
  const cards=[...hand,starter];let fifteens=0,pairs=0,runs=0,flush=0,nobs=0;
  for(let mask=1;mask<32;mask++) {let sum=0;for(let i=0;i<5;i++)if(mask&(1<<i))sum+=value(cards[i]);if(sum===15)fifteens+=2;}
  for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)if(cards[i].r===cards[j].r)pairs+=2;
  for(let len=5;len>=3;len--) {
    let num=0;
    for(let mask=1;mask<32;mask++){
      if(popcount(mask)!==len)continue;
      const rs=cards.filter((_,i)=>mask&(1<<i)).map(c=>c.r);
      if(new Set(rs).size===len && Math.max(...rs)-Math.min(...rs)===len-1)num++;
    }
    if(num){runs=len*num;break;}
  }
  if(hand.every(c=>c.s===hand[0].s)){
    if(starter.s===hand[0].s)flush=5;
    else if(!crib)flush=4;
  }
  if(hand.some(c=>c.r===11 && c.s===starter.s))nobs=1;
  return {fifteens,pairs,runs,flush,nobs,total:fifteens+pairs+runs+flush+nobs};
}
function scorePeg(seq, count) {
  let fifteen=count===15?2:0, thirtyOne=count===31?2:0, pairs=0, runs=0;
  if(seq.length>=2){let streak=1;const last=seq.at(-1).r;for(let i=seq.length-2;i>=0 && seq[i].r===last;i--)streak++;pairs=({2:2,3:6,4:12})[streak]||0;}
  for(let len=seq.length;len>=3;len--) {
    const rs=seq.slice(-len).map(c=>c.r);
    if(new Set(rs).size===len && Math.max(...rs)-Math.min(...rs)===len-1) {runs=len;break;}
  }
  return {fifteen,thirtyOne,pairs,runs,total:fifteen+thirtyOne+pairs+runs};
}
function addLog(g,msg){g.log.unshift({round:g.round,msg});if(g.log.length>100)g.log.pop();}
function firstDeal(){const cards=shuffle(deck());let a,b;do{a=cards.pop();b=cards.pop();}while(a.r===b.r);return {dealer:a.r<b.r?0:1,cards:[a,b]};}
function createGame(names){
  const cut=firstDeal();
  const g={players:names.map(name=>({name,score:0,prev:0})),cut,dealer:cut.dealer,round:0,phase:'idle',hands:[[],[]],kept:[[],[]],crib:[],discarded:[false,false],starter:null,deck:[],active:0,seq:[],prevSeq:[],count:0,go:[false,false],lastPlayed:null,countIndex:0,log:[],winner:null,rematch:[false,false]};
  addLog(g,`${names[0]} cuts ${rank(cut.cards[0].r)}${SUITS[cut.cards[0].s]}; ${names[1]} cuts ${rank(cut.cards[1].r)}${SUITS[cut.cards[1].s]}. ${names[cut.dealer]} deals first (low card).`);
  deal(g);return g;
}
function deal(g){
  g.round++;g.phase='discard';g.deck=shuffle(deck());g.hands=[[],[]];g.kept=[[],[]];g.crib=[];g.discarded=[false,false];g.starter=null;g.seq=[];g.prevSeq=[];g.count=0;g.go=[false,false];g.lastPlayed=null;g.countIndex=0;g.active=other(g.dealer);
  for(let i=0;i<6;i++){g.hands[other(g.dealer)].push(g.deck.pop());g.hands[g.dealer].push(g.deck.pop());}
  for(let p=0;p<2;p++)g.hands[p].sort((a,b)=>a.r-b.r||a.s-b.s);
  addLog(g,`Hand ${g.round}. ${g.players[g.dealer].name} deals and owns the crib. Each player discards two cards.`);
}
function award(g,p,pts,reason){
  if(pts<=0||g.phase==='gameOver')return false;
  const player=g.players[p];player.prev=player.score;player.score+=pts;
  addLog(g,`${player.name} +${pts} (${reason}).`);
  if(player.score>=121){g.winner=p;g.phase='gameOver';addLog(g,`${player.name} wins ${player.score}–${g.players[other(p)].score}${g.players[other(p)].score<91?' — skunk!':''}.`);return true;}
  return false;
}
function canPlay(g,p){return g.hands[p].some(c=>value(c)+g.count<=31);}
function allPlayed(g){return g.hands[0].length===0&&g.hands[1].length===0;}
function resetCount(g,reason){g.prevSeq=[...g.seq];g.seq=[];g.count=0;g.go=[false,false];g.lastPlayed=null;addLog(g,`Running count resets after ${reason}.`);}
function beginShow(g){g.phase='show';g.active=other(g.dealer);g.seq=[];g.count=0;g.countIndex=0;addLog(g,'Pegging complete. Count non-dealer, dealer, then the crib.');}
function finalizeSequence(g,reason,leader){
  if(g.lastPlayed!==null && award(g,g.lastPlayed,1,reason))return;
  resetCount(g,reason);
  if(allPlayed(g)){beginShow(g);return;}
  g.active=g.hands[leader].length?leader:other(leader);
  autoSkipEmpty(g);
}
function autoSkipEmpty(g){
  // If a player has played all four cards, they do not need to manually press Go.
  for(let i=0;i<5&&g.phase==='pegging'&&!g.hands[g.active].length;i++){
    const p=g.active, op=other(p);
    g.go[p]=true;
    if(canPlay(g,op)){g.active=op;continue;}
    finalizeSequence(g,'go / last card',p);
  }
}
function discard(g,p,ids){
  if(g.phase!=='discard'||g.discarded[p])throw new Error('You have already discarded or the discard phase has ended.');
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||!ids.every(id=>typeof id==='string'&&g.hands[p].some(c=>c.id===id)))throw new Error('Select exactly two cards from your own six-card hand.');
  const hand=g.hands[p];g.crib.push(...hand.filter(c=>ids.includes(c.id)));g.hands[p]=hand.filter(c=>!ids.includes(c.id));g.kept[p]=[...g.hands[p]];g.discarded[p]=true;
  addLog(g,`${g.players[p].name} discards two cards to the crib.`);
  if(g.discarded.every(Boolean)){g.phase='cut';g.active=other(g.dealer);addLog(g,`${g.players[g.active].name} cuts the starter.`);}
}
function cut(g,p){
  if(g.phase!=='cut'||g.active!==p)throw new Error('Only the non-dealer may cut the starter.');
  const pos=randomInt(4,g.deck.length-3);g.starter=g.deck.splice(pos,1)[0];
  addLog(g,`Starter: ${rank(g.starter.r)}${SUITS[g.starter.s]}.`);
  if(g.starter.r===11&&award(g,g.dealer,2,'his heels — starter Jack'))return;
  g.phase='pegging';g.active=other(g.dealer);g.seq=[];g.prevSeq=[];g.count=0;g.go=[false,false];g.lastPlayed=null;
  addLog(g,`${g.players[g.active].name} leads the pegging.`);
}
function peg(g,p,id){
  if(g.phase!=='pegging'||g.active!==p)throw new Error('It is not your turn to peg.');
  const i=g.hands[p].findIndex(c=>c.id===id);if(i<0)throw new Error('Choose a card from your own hand.');
  const card=g.hands[p][i];if(value(card)+g.count>31)throw new Error('That card would exceed 31.');
  g.hands[p].splice(i,1);g.seq.push({card,p});g.count+=value(card);g.lastPlayed=p;
  addLog(g,`${g.players[p].name} plays ${rank(card.r)}${SUITS[card.s]} — count ${g.count}.`);
  const scores=scorePeg(g.seq.map(x=>x.card),g.count);
  const why=[];if(scores.fifteen)why.push('15');if(scores.thirtyOne)why.push('31');if(scores.pairs)why.push(scores.pairs===2?'pair':`${scores.pairs===6?'three':'four'} of a kind`);if(scores.runs)why.push(`run of ${scores.runs}`);
  if(scores.total && award(g,p,scores.total,why.join(' + ')))return;
  if(g.count===31){resetCount(g,'31');if(allPlayed(g)){beginShow(g);return;}g.active=g.hands[other(p)].length?other(p):p;autoSkipEmpty(g);return;}
  if(allPlayed(g)){if(award(g,p,1,'last card'))return;beginShow(g);return;}
  const op=other(p);
  if(g.go[op]||g.hands[op].length===0){
    if(canPlay(g,p))g.active=p;
    else finalizeSequence(g,'go / last card',op);
    return;
  }
  g.active=op;autoSkipEmpty(g);
}
function sayGo(g,p){
  if(g.phase!=='pegging'||g.active!==p)throw new Error('It is not your turn to call Go.');
  if(canPlay(g,p))throw new Error('You must play a card when one can fit.');
  const op=other(p);g.go[p]=true;addLog(g,`${g.players[p].name} says Go.`);
  if(canPlay(g,op)){g.active=op;return;}
  finalizeSequence(g,'go / last card',p);
}
function countEntry(g){
  if(g.countIndex===0)return {pid:other(g.dealer),kind:'hand',label:`${g.players[other(g.dealer)].name}'s hand (non-dealer)`,cards:g.kept[other(g.dealer)]};
  if(g.countIndex===1)return {pid:g.dealer,kind:'hand',label:`${g.players[g.dealer].name}'s hand (dealer)`,cards:g.kept[g.dealer]};
  return {pid:g.dealer,kind:'crib',label:`${g.players[g.dealer].name}'s crib`,cards:g.crib};
}
function scoreShow(g,p){
  if(g.phase!=='show')throw new Error('Not counting hands yet.');
  const entry=countEntry(g);if(p!==entry.pid)throw new Error('The player who owns this hand must count it.');
  const points=scoreHand(entry.cards,g.starter,entry.kind==='crib');
  addLog(g,`${entry.label} counts ${points.total}.`);
  if(points.total&&award(g,p,points.total,`${entry.kind} show`))return;
  g.countIndex++;
  if(g.countIndex===3){g.phase='roundEnd';g.active=other(g.dealer);addLog(g,`Hand ${g.round} complete. ${g.players[g.active].name} deals next.`);}else g.active=countEntry(g).pid;
}
function nextDeal(g,p){if(g.phase!=='roundEnd'||p!==other(g.dealer))throw new Error('The next dealer must start the new hand.');g.dealer=other(g.dealer);deal(g);}
function rematch(g,p){if(g.phase!=='gameOver')throw new Error('Finish the current game first.');g.rematch[p]=true;if(g.rematch.every(Boolean)){
  const fresh=createGame(g.players.map(x=>x.name));Object.keys(g).forEach(k=>delete g[k]);Object.assign(g,fresh);
}}
function action(g,p,command,payload={}){
  if(![0,1].includes(p))throw new Error('Invalid player.');
  switch(command){case 'discard':discard(g,p,payload.ids);break;case 'cut':cut(g,p);break;case 'peg':peg(g,p,payload.id);break;case 'go':sayGo(g,p);break;case 'count':scoreShow(g,p);break;case 'deal':nextDeal(g,p);break;case 'rematch':rematch(g,p);break;default:throw new Error('Unknown game action.');}
}
function view(g,p,connection=[false,false]){
  const preview=g.phase==='show'?countEntry(g):null;
  return {
    phase:g.phase,round:g.round,dealer:g.dealer,active:g.active,winner:g.winner,rematch:g.rematch,
    players:g.players.map((x,i)=>({...x,connected:!!connection[i]})),
    me:p,hand:g.hands[p],myKept:g.kept[p],opponentCardCount:g.hands[other(p)].length,opponentKeptCount:g.kept[other(p)].length,
    discarded:g.discarded,cribCount:g.crib.length,starter:g.starter,
    sequence:g.seq,previousSequence:g.prevSeq,running:g.count,canPlay:g.phase==='pegging'&&g.active===p&&canPlay(g,p),
    show:preview?{label:preview.label,pid:preview.pid,kind:preview.kind,cards:preview.cards,score:scoreHand(preview.cards,g.starter,preview.kind==='crib')}:null,
    log:g.log.slice(0,35),cut:g.cut&&{cards:g.cut.cards}
  };
}
module.exports={SUITS,deck,scoreHand,scorePeg,createGame,action,view,canPlay,rank,value,other};
