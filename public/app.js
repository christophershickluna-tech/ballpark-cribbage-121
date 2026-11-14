'use strict';
const $=id=>document.getElementById(id);
const SUITS=['♠','♥','♦','♣'];
const SUIT_NAMES=['Spades','Hearts','Diamonds','Clubs'];
const rank=n=>({1:'A',11:'J',12:'Q',13:'K'}[n]||String(n));
const cardValue=c=>Math.min(c.r,10);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other=p=>1-p;
const TEAM_THEMES={
  cleveland:{key:'cleveland',label:'Cleveland Legends',short:'CLE',deckLabel:'Cleveland Indians / Guardians History',
    players:['Nap Lajoie','Tris Speaker','Earl Averill','Bob Feller','Lou Boudreau','Larry Doby','Bob Lemon','Al Rosen','Rocky Colavito','Vic Wertz','Herb Score','Minnie Miñoso','Early Wynn','Jim Perry','Sam McDowell','Gaylord Perry','Buddy Bell','Duane Kuiper','Dennis Eckersley','Andre Thornton','Joe Carter','Julio Franco','Brook Jacoby','Tom Candiotti','Albert Belle','Sandy Alomar Jr.','Carlos Baerga','Jim Thome','Kenny Lofton','Omar Vizquel','Manny Ramirez','David Justice','Roberto Alomar','Bartolo Colón','Travis Hafner','Victor Martinez','Grady Sizemore','Cliff Lee','C.C. Sabathia','Shin-Soo Choo','Asdrúbal Cabrera','Michael Brantley','Corey Kluber','Carlos Santana','Francisco Lindor','José Ramírez','Shane Bieber','Emmanuel Clase','Steven Kwan','Andrés Giménez','Josh Naylor','Triston McKenzie']},
  detroit:{key:'detroit',label:'Detroit Legends',short:'DET',deckLabel:'Detroit Tigers Franchise History',
    players:['Ty Cobb','Sam Crawford','Harry Heilmann','Charlie Gehringer','Hank Greenberg','Mickey Cochrane','Schoolboy Rowe','Hal Newhouser','Rudy York','George Kell','Al Kaline','Norm Cash','Bill Freehan','Willie Horton','Denny McLain','Mickey Lolich','Dick McAuliffe','Mark Fidrych','Jack Morris','Alan Trammell','Lou Whitaker','Lance Parrish','Chet Lemon','Kirk Gibson','Darrell Evans','Cecil Fielder','Travis Fryman','Tony Phillips','Bobby Higginson','Justin Thompson','Damion Easley','Robert Fick','Dmitri Young','Magglio Ordóñez','Carlos Guillén','Placido Polanco','Curtis Granderson','Justin Verlander','Miguel Cabrera','Max Scherzer','Prince Fielder','J.D. Martinez','Victor Martinez','Ian Kinsler','Nick Castellanos','Michael Fulmer','Jeimer Candelario','Tarik Skubal','Riley Greene','Spencer Torkelson','Kerry Carpenter','Parker Meadows']}
};
let session=null, stream=null, latest=null, selected=new Set(), selectedHandKey='', busy=false, primary=null, toastTimer=0;
function note(s){const el=$('toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),3600);}
function network(text,offline=false){$('netBadge').textContent='● '+text;$('netBadge').classList.toggle('offline',offline);}
function inviteURL(){const link=new URL(window.location.href);link.searchParams.set('room',session.code);return link.toString();}
async function copyText(s,success){try{await navigator.clipboard.writeText(s);note(success);}catch{window.prompt('Copy this invite:',s);}}
function toggle(id,show){$(id).classList.toggle('hidden',!show);}
function showScreen(name){for(const id of ['lobby','waiting','game'])toggle(id,id===name);toggle('lobbyBtn',name!=='lobby');}
function remember(s){session=s;const raw=JSON.stringify(s);try{localStorage.setItem('cribonline:'+s.code,raw);localStorage.setItem('cribonline:last',s.code);sessionStorage.setItem('cribonline:tab:'+s.code,raw);}catch{}const url=new URL(window.location.href);url.searchParams.set('room',s.code);history.replaceState({},'',url);}
function recall(code){try{return JSON.parse(sessionStorage.getItem('cribonline:tab:'+code)||localStorage.getItem('cribonline:'+code)||'null');}catch{return null;}}
async function post(path,data){let res;try{res=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch{throw new Error('Unable to reach the game server. Check your connection.');}let body;try{body=await res.json();}catch{throw new Error('The game server gave an invalid response.');}if(!res.ok)throw new Error(body.error||'Request failed');return body;}
async function resume(s){const result=await post('resume',{code:s.code,token:s.token});startSession({...s,seat:result.seat});}
function startSession(s){if(stream){stream.close();stream=null;}latest=null;selected.clear();remember(s);network('Connecting…',true);showScreen('waiting');$('waitCode').textContent=s.code;
 $('publicHint').textContent=['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname)?'This is a local test address. To invite someone outside this device, first publish the server on a public HTTPS host.':'';
 const e=new EventSource('/api/events?'+new URLSearchParams({code:s.code,token:s.token}));stream=e;
 e.onopen=()=>{if(e!==stream)return;network('Connected');};
 e.onmessage=event=>{if(e!==stream)return;let data;try{data=JSON.parse(event.data);}catch{return;}if(data.type!=='state')return;latest=data;
  if(data.game){showScreen('game');renderGame(data.game);}else{showScreen('waiting');$('waitCode').textContent=s.code;}
 };
 e.onerror=()=>{if(e!==stream)return;network('Reconnecting…',true);};
}
async function create(){const name=$('playerName').value.trim();if(!name){note('Enter your name first.');return;}if(busy)return;busy=true;$('createBtn').disabled=true;
 try{const data=await post('create',{name});startSession({code:data.code,token:data.token,seat:data.seat});}
 catch(e){note(e.message);}finally{busy=false;$('createBtn').disabled=false;}}
async function join(){const code=$('roomCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');const name=$('playerName').value.trim();if(code.length!==6){note('Enter the six-character room code.');return;}if(busy)return;
 busy=true;$('joinBtn').disabled=true;try{const existing=recall(code);if(existing){await resume(existing);return;}if(!name)throw new Error('Enter your name before joining.');const data=await post('join',{code,name});startSession({code:data.code,token:data.token,seat:data.seat});}
 catch(e){note(e.message);}finally{busy=false;$('joinBtn').disabled=false;}}
function leaveToLobby(){if(stream)stream.close();stream=null;latest=null;session=null;selected.clear();showScreen('lobby');network('Ready');const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);prepareResume();}
async function send(command,payload={}){if(busy||!session)return;busy=true;
 try{await post('action',{code:session.code,token:session.token,command,payload});selected.clear();}
 catch(e){note(e.message);}finally{busy=false;if(latest?.game)renderGame(latest.game);}}
function teamForSeat(seat){return seat===0?TEAM_THEMES.cleveland:TEAM_THEMES.detroit;}
function activeTheme(){return teamForSeat(latest?.game?.me ?? session?.seat ?? 0);}
function cardLegend(c){const theme=activeTheme();const idx=(c.s*13)+(c.r-1);return {theme,player:theme.players[idx%theme.players.length],index:idx,portrait:`/portraits/${theme.key==='cleveland'?'cle':'det'}-${idx%8}.webp`};}
function cardFace(c,{small=false,disabled=false,selected=false,clickable=false}={}){
 if(!c)return `<div class="card back${small?' small':''}" aria-label="Card face down"></div>`;
 const suit=SUITS[c.s],r=rank(c.r);const legend=cardLegend(c);const classes=`card baseball-card theme-${legend.theme.key}${c.s===1||c.s===2?' red':''}${small?' small':''}${selected?' selected':''}${clickable?' clickable':''}`;
 const inner=`<span class="card-team-band"><span class="team-monogram">${legend.theme.short==='CLE'?'C':'D'}</span><span>${escapeHTML(legend.theme.short)} · ALL-TIME</span></span><div class="player-art"><img src="${legend.portrait}" loading="lazy" alt="Stylized, interpretive baseball portrait" draggable="false" /></div><div class="player-name">${escapeHTML(legend.player)}</div><span class="card-rank-badge ${c.s===1||c.s===2?'is-red':''}">${r}${suit}</span><div class="player-meta">FRANCHISE COLLECTION · ${String(legend.index+1).padStart(2,'0')}/52</div>`;
 if(clickable)return `<button class="${classes}" type="button" data-card="${c.id}" aria-pressed="${selected}" aria-label="${escapeHTML(legend.player)}, ${r} of ${SUIT_NAMES[c.s]}" ${disabled?'disabled':''}>${inner}</button>`;
 return `<div class="${classes}">${inner}</div>`;
}
function diamondPosition(n,seat){
 const points=seat===0?[[450,506],[704,307],[450,108],[196,307],[450,506]]:[[450,463],[657,307],[450,151],[243,307],[450,463]];
 if(n<=0)return points[0];
 const clamped=Math.min(120,n),leg=Math.min(3,Math.floor((clamped-1)/30)),t=(clamped-leg*30)/30;
 return [points[leg][0]+(points[leg+1][0]-points[leg][0])*t,points[leg][1]+(points[leg+1][1]-points[leg][1])*t];
}
function stadiumPeg(n,seat,rear=false){
 const [x,y]=diamondPosition(n,seat),fill=seat===0?'#c8102e':'#fa4616',ring=seat===0?'#fce3ea':'#f7e3ce';
 if(n>=121)return `<g transform="translate(${seat===0?425:475},554)" aria-label="World Series trophy finish"><circle r="14" fill="${fill}" stroke="#fff5c7" stroke-width="2.5"/><text text-anchor="middle" x="0" y="5" font-size="17">🏆</text></g>`;
 if(rear)return `<g transform="translate(${x},${y}) rotate(-34)"><circle r="11" fill="#122a32" stroke="${ring}" stroke-width="1.5"/><path d="M -1 -7 Q 3 -10 4 -7 L 3 3 L -2 3 Z" fill="#d4a36a" stroke="#fff8e5" stroke-width=".65"/><rect x="-2" y="3" width="2.6" height="5" rx=".8" fill="#f8d9a0"/></g>`;
 return `<g transform="translate(${x},${y})"><circle r="12" fill="${fill}" stroke="${ring}" stroke-width="2.4"/><circle r="7.8" fill="#faf7ed"/><path d="M -3.5 -6 Q -9 0 -3.5 6 M 3.5 -6 Q 9 0 3.5 6" fill="none" stroke="#bf4b46" stroke-width="1.6" stroke-dasharray="2 2"/></g>`;
}
function stadiumBoard(g){
 let tracks='';
 for(let seat=0;seat<2;seat++){
  const score=Math.min(121,g.players[seat].score),previous=Math.min(121,g.players[seat].prev),color=seat===0?'#df4c5f':'#ff9857';
  let holes='';for(let n=1;n<=120;n++){
   const [x,y]=diamondPosition(n,seat),done=n<=score;
   holes+=`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${n%5===0?4.4:3.35}" fill="${done?color:'#f2f2dc'}" fill-opacity="${done?.97:.68}" stroke="${done?'#fff4db':'#102e2a'}" stroke-width="${done?'.5':'.8'}"><title>${seat===0?'Cleveland':'Detroit'} scoring hole ${n}</title></circle>`;
  }
  const linePts=[0,30,60,90,120].map(n=>diamondPosition(n,seat).join(',')).join(' ');
  tracks+=`<g class="diamond-lane lane-${seat}"><polyline points="${linePts}" fill="none" stroke="${seat===0?'#751d32':'#b33b14'}" stroke-width="24" opacity=".55" stroke-linejoin="round"/><polyline points="${linePts}" fill="none" stroke="#eac48f" stroke-width="1.5" opacity=".85"/>${holes}${previous!==score?stadiumPeg(previous,seat,true):''}${stadiumPeg(score,seat)}</g>`;
 }
 const p0=g.players[0],p1=g.players[1],winning=g.players.find(p=>p.score>=121);
 $('boardSlots').innerHTML=`<div class="stadium-frame"><svg class="stadium-svg" viewBox="0 0 900 615" role="img" aria-label="Diamond shaped cribbage pegboard with 120 scoring holes for Cleveland and Detroit; a World Series trophy marks the finish at 121 points.">
 <defs>
  <linearGradient id="skyGrad" x2="0" y2="1"><stop stop-color="#25445f"/><stop offset="1" stop-color="#091d21"/></linearGradient>
  <radialGradient id="grassGrad"><stop stop-color="#388d5b"/><stop offset="1" stop-color="#145235"/></radialGradient>
  <pattern id="fieldGrass" width="38" height="38" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="38" height="38" fill="#216446"/><rect x="0" y="0" width="19" height="38" fill="#24744e"/></pattern>
  <pattern id="stands" width="18" height="14" patternUnits="userSpaceOnUse"><rect width="18" height="14" fill="#173344"/><path d="M0 4 H18 M0 11 H18 M9 0 V14" stroke="#4b6571" stroke-width="1"/></pattern>
  <filter id="pegShadow" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".6"/></filter>
 </defs>
 <rect x="4" y="4" width="892" height="607" rx="24" fill="url(#skyGrad)" stroke="#6d806b" stroke-width="3"/>
 <path d="M46 280 Q52 35 450 22 Q848 35 854 280 L846 570 Q802 598 450 602 Q98 598 54 570 Z" fill="url(#stands)" stroke="#9f9f86" stroke-width="3"/>
 <ellipse cx="450" cy="308" rx="350" ry="272" fill="url(#fieldGrass)" stroke="#b87852" stroke-width="15"/>
 <ellipse cx="450" cy="308" rx="332" ry="254" fill="url(#grassGrad)" opacity=".28"/>
 <path d="M450 74 L738 307 L450 535 L162 307Z" fill="#8a603c" opacity=".9" stroke="#eadcb1" stroke-width="3"/>
 <path d="M450 117 L678 307 L450 499 L222 307Z" fill="url(#fieldGrass)" stroke="#f5e7cb" stroke-width="2"/>
 <path d="M450 231 L542 307 L450 385 L358 307Z" fill="#a1734a" opacity=".83"/>
 <circle cx="450" cy="307" r="28" fill="#b98751" stroke="#f0d3a3" stroke-width="3"/><circle cx="450" cy="307" r="8" fill="#eed4a7"/>
 <g fill="#fff9de" stroke="#d9c5a6" stroke-width="1"><rect x="442" y="105" width="16" height="16" transform="rotate(45 450 113)"/><rect x="695" y="299" width="16" height="16" transform="rotate(45 703 307)"/><rect x="189" y="299" width="16" height="16" transform="rotate(45 197 307)"/></g>
 <g text-anchor="middle" font-family="system-ui,sans-serif" fill="#f5e4c1" font-size="12" font-weight="900" letter-spacing="1.2"><text x="450" y="70">SECOND BASE</text><text x="755" y="305">FIRST BASE</text><text x="145" y="305">THIRD BASE</text><text x="450" y="568">HOME PLATE</text></g>
 <g class="stadium-scoreboard"><rect x="310" y="246" width="280" height="127" rx="14" fill="#07191a" fill-opacity=".9" stroke="#ebc88b" stroke-width="3"/><text x="450" y="267" text-anchor="middle" fill="#f3d28c" font-size="10" letter-spacing="2.5" font-weight="800">ROAD TO THE WORLD SERIES</text><path d="M330 279 H570" stroke="#caa772" opacity=".6"/>
 <text x="339" y="301" fill="#ed7584" font-size="14" font-weight="900">CLEVELAND</text><text x="561" y="301" text-anchor="end" fill="white" font-size="20" font-weight="900">${p0.score}</text>
 <text x="339" y="329" fill="#ff965a" font-size="14" font-weight="900">DETROIT</text><text x="561" y="329" text-anchor="end" fill="white" font-size="20" font-weight="900">${p1.score}</text>
 <text x="450" y="354" text-anchor="middle" fill="#c1d3c2" font-size="9" letter-spacing="1.1">120 HOLES + CHAMPIONSHIP AT 121</text></g>
 <g filter="url(#pegShadow)">${tracks}</g>
 <g transform="translate(450,554)"><path d="M-8 -15H8 V-3 Q7 4 0 7 Q-7 4 -8 -3 Z" fill="#ffdf85" stroke="#fff5c6" stroke-width="1.7"/><path d="M-8 -12Q-26 -15 -20 0Q-17 7 -6 1 M8 -12Q26 -15 20 0Q17 7 6 1" fill="none" stroke="#ffc95d" stroke-width="3"/><path d="M-3 7 V12 H-11 V16 H11 V12 H3 V7" fill="#e5b74b"/><text text-anchor="middle" x="0" y="-1" font-size="9" fill="#584414">★</text></g>
 <text x="450" y="591" fill="#ffdf8a" font-size="13" font-weight="900" text-anchor="middle">${winning?'WORLD SERIES CHAMPION':'WORLD SERIES TROPHY · 121'}</text>
 </svg><div class="stadium-legend"><span class="clubline cle"><b>C</b><span>${escapeHTML(p0.name)} · ${p0.score}/121</span></span><span class="clubline det"><b>D</b><span>${escapeHTML(p1.name)} · ${p1.score}/121</span></span></div></div>`;
}
function lanes(g){stadiumBoard(g);}
function renderScores(g){$('scores').innerHTML=g.players.map((p,i)=>{const team=teamForSeat(i);return `<div class="score-row p${i}"><div class="score-icon">${i===0?'C':'D'}</div><div class="score-person"><strong>${escapeHTML(p.name)}${i===g.me?' (you)':''}</strong><small>${escapeHTML(team.deckLabel)} · ${i===g.dealer?'Dealer · owns crib':'Non-dealer'} · ${p.connected?'Online':'Offline'}</small><div class="progress"><span style="width:${Math.min(100,p.score/121*100)}%"></span></div></div><span class="score-num">${p.score}</span></div>`;}).join('');
 $('eventsLog').innerHTML=g.log.map(l=>`<div class="log-entry"><span class="log-round">${l.round?'H'+l.round:''}</span><span>${escapeHTML(l.msg)}</span></div>`).join('');
 const theme=activeTheme();
 $('myThemeTag').textContent=theme.deckLabel;
 $('oppThemeTag').textContent=teamForSeat(other(g.me)).deckLabel;
}
function showAction({eyebrow,title,detail,button,command,payload,enabled=true}){
 $('actionEyebrow').textContent=eyebrow||'YOUR NEXT AT-BAT';$('actionTitle').textContent=title;$('actionText').textContent=detail||'';$('actionIndicator').textContent=button?'⚾':'⌛';primary=button?{command,payload}:null;
 const btn=$('mainAction');toggle('mainAction',!!button);if(button){btn.textContent=button;btn.disabled=!enabled||busy;}
}
function countPreview(g){const box=$('showPreview');if(!g.show){box.innerHTML='';toggle('showPreview',false);return;}
 toggle('showPreview',true);const s=g.show;
 box.innerHTML=`<div class="show-cards">${s.cards.map(c=>cardFace(c,{small:true})).join('')}<span style="align-self:center;color:#f3d38a">+</span>${cardFace(g.starter,{small:true})}</div><dl class="breakdown"><dt>Fifteens</dt><dd>${s.score.fifteens}</dd><dt>Pairs</dt><dd>${s.score.pairs}</dd><dt>Runs</dt><dd>${s.score.runs}</dd><dt>Flush</dt><dd>${s.score.flush}</dd><dt>His nobs</dt><dd>${s.score.nobs}</dd><dt class="total">TOTAL</dt><dd class="total">${s.score.total} runs</dd></dl>`;
}
function renderGame(g){if(!session)return;
 const me=g.me,op=other(me),mine=g.players[me].name,them=g.players[op].name,isTurn=g.active===me,roundKey=`${g.round}-${g.phase}`;
 if(selectedHandKey!==roundKey){selected.clear();selectedHandKey=roundKey;}
 $('roomLabel').textContent='CLUBHOUSE '+session.code;$('miniCode').textContent=session.code;$('handLabel').textContent=`INNING ${g.round} · ${g.players[g.dealer].name.toUpperCase()} DEALS`;
 $('phaseLabel').textContent=({discard:'LINEUP',cut:'FIRST PITCH',pegging:'AT BAT',show:'BOX SCORE',roundEnd:'INNING OVER',gameOver:'FINAL'})[g.phase]||'LIVE';
 lanes(g);renderScores(g);
 $('starterSlot').innerHTML=cardFace(g.starter,{small:true});$('runningCount').textContent=g.running;
 $('sequence').innerHTML=g.sequence.length?g.sequence.map(entry=>cardFace(entry.card,{small:true})).join(''):'<span class="muted">Cards played during this at-bat appear here.</span>';
 $('oldSequence').textContent=g.previousSequence.length?'Previous at-bat: '+g.previousSequence.map(e=>`${rank(e.card.r)}${SUITS[e.card.s]}`).join(' · '):'';
 $('cribStatus').textContent=g.phase==='discard'?`${g.cribCount} / 4 cards sent to the bullpen`:g.phase==='cut'?'Bullpen hidden until the cut':`Bullpen belongs to ${g.players[g.dealer].name}`;
 $('myHandTitle').textContent=mine+'’s lineup';$('handInfo').textContent=g.phase==='discard'?(g.discarded[me]?'Bullpen set':'Select 2 of 6'):g.phase==='pegging'?(isTurn?'Your at-bat':'Keep your hand private'):g.phase==='show'?'Scoring lineup':'Inning complete';
 const cards=(['show','roundEnd','gameOver'].includes(g.phase)?g.myKept:g.hand)||[];
 const clickable=(g.phase==='discard'&&!g.discarded[me])||(g.phase==='pegging'&&isTurn);
 $('myCards').innerHTML=cards.length?cards.map(c=>cardFace(c,{clickable,selected:selected.has(c.id),disabled:g.phase==='pegging'&&cardValue(c)+g.running>31})).join(''):'<span class="muted">All your cards have been played.</span>';
 const remain=g.opponentCardCount;$('opponentCards').innerHTML=Array.from({length:remain},()=>cardFace(null,{small:true})).join('')||'<span class="muted">0 cards</span>';
 countPreview(g);
 if(g.phase==='discard'){
  $('statusTitle').textContent=g.discarded[me]?'Your bullpen is set':'Set your bullpen';$('statusText').textContent=`${g.players[g.dealer].name} owns the bullpen. Each player privately sends two cards there.`;
  if(g.discarded[me])showAction({eyebrow:'BULLPEN READY',title:'Waiting in the dugout',detail:`${them} is choosing two cards for the bullpen.`});
  else showAction({eyebrow:'YOUR AT-BAT',title:`Choose two cards (${selected.size}/2)`,detail:'Tap any two of your six cards, then send them to the dealer’s bullpen.',button:`Send ${selected.size} of 2`,command:'discard',payload:{ids:[...selected]},enabled:selected.size===2});
 }
 else if(g.phase==='cut'){
  $('statusTitle').textContent=isTurn?'Throw the first pitch':'Waiting for the first pitch';$('statusText').textContent='The non-dealer cuts the remaining pack. A starter Jack scores two for the dealer.';
  if(isTurn)showAction({title:'Reveal the starter card',detail:'You are the non-dealer. Cut the deck to reveal the first pitch.',button:'Cut for the starter',command:'cut'});
  else showAction({eyebrow:'OPPONENT TO CUT',title:`${them} is cutting`,detail:'The starter will appear at the mound.'});
 }
 else if(g.phase==='pegging'){
  $('statusTitle').textContent=isTurn?'Your at-bat':`${them} is at bat`;$('statusText').textContent=`The running count is ${g.running}. Score 15, 31, pairs and runs as the at-bat unfolds.`;
  if(isTurn){if(g.canPlay)showAction({title:'Play a card from your lineup',detail:'Tap any highlighted card. You may not go above 31.'});
   else showAction({eyebrow:'NO LEGAL PLAY',title:'Call Go',detail:'None of your remaining cards fit under 31. Your opponent can continue, or the count resets.',button:'Say Go',command:'go'});}
  else showAction({eyebrow:'OPPONENT TO PLAY',title:`Waiting for ${them}`,detail:'Your lineup remains private until your next turn.'});
 }
 else if(g.phase==='show'){
  $('statusTitle').textContent='Score the box score';$('statusText').textContent='Non-dealer first, then dealer, then the bullpen crib. The first to 121 wins immediately.';
  if(isTurn)showAction({eyebrow:'COUNT THE RUNS',title:g.show.label,detail:`Review the ${g.show.score.total}-point hand and add the runs to your board.`,button:`Score ${g.show.score.total} runs`,command:'count'});
  else showAction({eyebrow:'OPPONENT COUNTING',title:g.show.label,detail:`${them} will confirm ${g.show.score.total} points.`});
 }
 else if(g.phase==='roundEnd'){
  $('statusTitle').textContent=`Inning ${g.round} complete`;$('statusText').textContent=`${g.players[g.active].name} deals the next inning. The bullpen changes owners.`;
  if(isTurn)showAction({title:'Deal the next inning',detail:'New inning, new bullpen, same race to the World Series trophy.',button:'Deal next inning',command:'deal'});
  else showAction({eyebrow:'WAITING FOR NEXT DEAL',title:`${them} is up`,detail:'The next inning will start shortly.'});
 }
 else if(g.phase==='gameOver'){
  const winner=g.players[g.winner],loser=g.players[other(g.winner)];const won=g.winner===me;
  $('statusTitle').textContent=won?'🏆 You win the pennant!':`${winner.name} wins!`;$('statusText').textContent=`Final score ${winner.score}–${loser.score}${loser.score<91?' · Skunk!':''}. Trophy secured.`;
  if(g.rematch[me])showAction({eyebrow:'REMATCH REQUESTED',title:'Waiting for your opponent',detail:'The next game begins when both managers choose Rematch.'});
  else showAction({eyebrow:'FINAL SCORE',title:won?'Championship baseball cribbage!':'Good game!',detail:'Keep the same room and play another series.',button:'Request a rematch',command:'rematch'});
 }
}
$('myCards').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-card]');if(!btn||!latest?.game||busy)return;
 const g=latest.game,id=btn.dataset.card;
 if(g.phase==='discard'&&!g.discarded[g.me]){if(selected.has(id))selected.delete(id);else if(selected.size<2)selected.add(id);renderGame(g);}
 else if(g.phase==='pegging'&&g.active===g.me)send('peg',{id});
});
$('mainAction').addEventListener('click',()=>{if(primary&&!busy)send(primary.command,primary.payload||{});});
$('createBtn').addEventListener('click',create);$('joinBtn').addEventListener('click',join);
$('roomCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);});
$('roomCode').addEventListener('keydown',e=>{if(e.key==='Enter')join();});$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')create();});
$('copyInviteBtn').addEventListener('click',()=>copyText(inviteURL(),'Invite link copied. Send it to your opponent.'));
$('copyCodeBtn').addEventListener('click',()=>copyText(session.code,'Room code copied.'));
$('shareBtn').addEventListener('click',async()=>{const url=inviteURL();if(navigator.share){try{await navigator.share({title:'Play Ballpark Cribbage 121',text:`Join my cribbage room ${session.code}`,url});return;}catch{}}copyText(url,'Invite link copied.');});
$('lobbyBtn').addEventListener('click',leaveToLobby);
function showRules(show){toggle('rulesModal',show);if(show)$('closeRules').focus();}
$('rulesBtn').addEventListener('click',()=>showRules(true));$('fullRulesBtn').addEventListener('click',()=>showRules(true));$('closeRules').addEventListener('click',()=>showRules(false));
$('rulesModal').addEventListener('click',e=>{if(e.target===$('rulesModal'))showRules(false);});
window.addEventListener('keydown',e=>{if(e.key==='Escape')showRules(false);});
function prepareResume(){try{const code=localStorage.getItem('cribonline:last');const s=code&&recall(code);toggle('resumeBtn',!!s);if(s){$('resumeBtn').textContent=`Rejoin your previous ballpark (${s.code}) →`;$('resumeBtn').onclick=()=>resume(s).catch(e=>note(e.message));}}catch{}}
async function boot(){prepareResume();const params=new URLSearchParams(location.search),code=String(params.get('room')||'').trim().toUpperCase();if(code){$('roomCode').value=code;const existing=recall(code);if(existing){try{await resume(existing);}catch(e){note(e.message);}}}
 if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
}
boot();
