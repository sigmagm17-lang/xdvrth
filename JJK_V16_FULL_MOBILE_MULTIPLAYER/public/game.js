(() => {'use strict';
const $=id=>document.getElementById(id);
const WORLD={width:960,floor:380};
const keys={left:false,right:false,jump:false,dash:false,block:false};
const A={ws:null,id:null,heroes:{},monsters:{},room:null,mode:1,chosen:'gojo',screen:'menu',snapshot:null,localPositions:new Map(),fx:[],toastId:null,online:false,sound:true,soundContext:null,hitShake:0,roundStatus:'',didJoinFromURL:false,disconnects:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLOR={azure:'#78dfff',crimson:'#ff7e94'};
const sessionName=()=>($('nickname').value||'').trim().replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,14)||'SORCERER';
const send=(o)=>{if(A.ws&&A.ws.readyState===1){A.ws.send(JSON.stringify(o));return true;}notify('Offline — the server must be running.');return false;};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(A.toastId);A.toastId=setTimeout(()=>el.classList.remove('show'),3200);}
function sound(pitch=170,dur=.1,typ='sawtooth'){if(!A.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;A.soundContext=A.soundContext||new C();let ctx=A.soundContext,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=typ;osc.frequency.setValueAtTime(pitch,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,pitch*.6),ctx.currentTime+dur);gain.gain.setValueAtTime(.04,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+dur+.01);}catch{}}
function switchScreen(name){document.body.classList.toggle('mobile-in-match',name==='game');A.screen=name;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===name+'Screen'));if(name==='lobby')drawRoster();if(name==='menu')paintMenu();}
function setConnection(on){A.online=on;$('connectionDot').className='dot '+(on?'online':'offline');$('connectionText').textContent=on?'SERVER CONNECTED':'SERVER OFFLINE';}
function connect(){if(A.ws&&(A.ws.readyState===0||A.ws.readyState===1))return;
 $('connectionText').textContent='CONNECTING…';$('connectionDot').className='dot connecting';
 const proto=location.protocol==='https:'?'wss:':'ws:';
 const ws=new WebSocket(proto+'//'+location.host+'/ws');A.ws=ws;
 ws.onopen=()=>{setConnection(true);A.disconnects=0;send({type:'name',name:sessionName()});const room=new URLSearchParams(location.search).get('room');if(room&&!A.didJoinFromURL){A.didJoinFromURL=true;send({type:'join',code:room});}}
 ws.onmessage=e=>{try{onMessage(JSON.parse(e.data));}catch(err){console.error('Bad server message',err);}};
 ws.onerror=()=>{};
 ws.onclose=()=>{if(A.ws!==ws)return;setConnection(false);const wasGame=A.screen==='game',wasLobby=A.screen==='lobby';A.room=null;A.snapshot=null;if(wasGame||wasLobby){switchScreen('menu');notify('Connection lost. Please rejoin with a new room code.');}A.disconnects++;setTimeout(connect,Math.min(10000,500*Math.pow(1.6,A.disconnects)));};
}
function onMessage(m){switch(m.type){
 case 'welcome':A.id=m.id;A.heroes=m.heroes||{};A.monsters=m.monsters||{};paintMenu();break;
 case 'joined':A.id=m.id;try{history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(m.code));}catch{}switchScreen('lobby');notify('Joined room '+m.code);break;
 case 'room':A.room=m.room;if(A.room?.status==='fight'&&A.screen==='lobby'){A.roundStatus='fight';switchScreen('game');showOverlay(false);}else if(A.room?.status==='lobby'&&A.screen==='game'){A.snapshot=null;A.roundStatus='lobby';showOverlay(false);switchScreen('lobby');}else if(A.room?.status==='lobby'&&A.screen!=='game')switchScreen('lobby');renderRoom();break;
 case 'left':A.room=null;A.snapshot=null;try{history.replaceState(null,'',location.pathname);}catch{}switchScreen('menu');break;
 case 'started':A.room=m.room;A.snapshot=null;A.localPositions.clear();A.fx=[];A.roundStatus='fight';switchScreen('game');showOverlay(false);sound(220,.14);break;
 case 'roundStart':A.roundStatus='fight';showOverlay(false);A.localPositions.clear();notify('ROUND '+m.round+' • FIGHT!');sound(480,.18,'square');break;
 case 'state':A.snapshot=m;A.roundStatus=m.status;break;
 case 'hit':if(m.kind==='parry'){A.hitShake=8;sound(820,.18,'triangle');}else{A.hitShake=Math.min(12,4+(m.damage||0)*.2);sound(m.kind==='heavy'?110:185,.12);}addFX(m);break;
 case 'roundEnd':A.roundStatus='between';showOverlay(true,'ROUND '+m.round,m.winner==='draw'?'DRAW':m.winner.toUpperCase()+' WINS','Score: '+m.score.azure+' — '+m.score.crimson+'  •  Next round shortly',false);break;
 case 'matchEnd':A.roundStatus='ended';showOverlay(true,'FINAL RESULT',m.winner==='draw'?'DRAW':m.winner.toUpperCase()+' VICTORY',m.forfeit?'The opposing team disconnected.':'Best of three • Play again?',true);sound(500,.35,'triangle');break;
 case 'announcement':notify(m.text);sound(580,.35,'triangle');break;
 case 'notice':break;
 case 'error':notify('⚠ '+m.message);break;
 }}
function showOverlay(visible,eyebrow='',title='',subtitle='',rematch=false){$('gameOverlay').classList.toggle('hidden',!visible);if(!visible)return;$('overlayEyebrow').textContent=eyebrow;$('overlayTitle').textContent=title;$('overlayTitle').style.color=title.includes('CRIMSON')?COLOR.crimson:COLOR.azure;$('overlaySubtitle').textContent=subtitle;$('rematchBtn').classList.toggle('hidden',!rematch);}
function renderRoom(){let r=A.room;if(!r)return;$('roomCode').textContent=r.code;$('gameRoomCode').textContent=r.code;$('lobbyMode').textContent=r.mode+'V'+r.mode;$('gameMode').textContent=r.mode+'V'+r.mode;
 const self=r.players.find(p=>p.id===A.id);$('fillBotsBtn').disabled=r.host!==A.id||r.status!=='lobby'||r.players.length>=r.mode*2;if(self){A.chosen=self.hero;$('readyBtn').textContent=self.ready?'NOT READY ✕':'READY UP ✓';$('readyBtn').classList.toggle('secondary',self.ready);$('readyBtn').classList.toggle('primary',!self.ready);}
 for(const team of ['azure','crimson']){
 let arr=r.players.filter(x=>x.team===team),container=$(team+'Players');$(team+'Count').textContent=arr.length+'/'+r.mode;container.replaceChildren();for(let i=0;i<r.mode;i++){
 const row=document.createElement('div');row.className='player-slot'+(arr[i]?'':' empty');if(arr[i]){const p=arr[i],hero=A.heroes[p.hero];row.innerHTML='<span class="slot-num">'+String(i+1).padStart(2,'0')+'</span><span class="slot-name">'+esc(p.name)+(p.id===A.id?' ★':'')+'</span><span class="slot-hero">'+esc(hero?.name||p.hero)+'</span><span class="'+(p.ready?'slot-ready':'slot-wait')+'">'+(p.ready?'READY':'WAITING')+'</span>';}else row.innerHTML='<span class="slot-num">'+String(i+1).padStart(2,'0')+'</span><span class="slot-name">EMPTY SLOT</span><span class="slot-wait">—</span>';container.appendChild(row);
 }
 }
 const count=r.players.length,full=count===r.mode*2,allReady=r.players.every(p=>p.ready);
 $('lobbyNotification').textContent=full?(allReady?'ALL FIGHTERS READY • STARTING MATCH':'ALL SLOTS FILLED • READY UP TO BEGIN'):'WAITING FOR '+(r.mode*2-count)+' MORE FIGHTER'+(r.mode*2-count===1?'':'S')+' • SHARE THE ROOM CODE';
 $('lobbySummary').textContent=count+' / '+(r.mode*2)+' fighters joined. Team battles start only when each side is full and everyone is ready.';
 $('readyBtn').disabled=!self||r.status!=='lobby';$('joinAzure').disabled=!self||self.team==='azure'||r.players.filter(p=>p.team==='azure').length>=r.mode;$('joinCrimson').disabled=!self||self.team==='crimson'||r.players.filter(p=>p.team==='crimson').length>=r.mode;
 drawRoster();
}
function drawRoster(){const box=$('roster');if(!Object.keys(A.heroes).length)return;box.replaceChildren();for(const [id,hero] of Object.entries(A.heroes)){
 const button=document.createElement('button');button.className='hero-card'+(id===A.chosen?' selected':'');const can=document.createElement('canvas');can.width=90;can.height=90;button.appendChild(can);const label=document.createElement('span');label.textContent=hero.name.toUpperCase();button.appendChild(label);
 button.addEventListener('click',()=>{A.chosen=id;send({type:'choose',hero:id});drawRoster();sound(450,.045,'square');});box.appendChild(button);
 const ctx=can.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#0d1b33';ctx.fillRect(0,0,90,90);ctx.fillStyle=hero.accent+'1c';ctx.fillRect(0,42,90,48);ctx.fillStyle=hero.accent;ctx.fillRect(1,84,88,2);drawFighter(ctx,{hero:id,x:43,y:82,face:1,hp:100,block:false,buff:false},Date.now(),1.2);
 }
 const hero=A.heroes[A.chosen];if(hero){$('selectedHero').textContent=hero.name.toUpperCase()+' • '+hero.role.toUpperCase();$('heroDetail').innerHTML='<strong>'+esc(hero.role.toUpperCase())+'</strong><span>① '+esc(hero.moves[0])+' &nbsp; ② '+esc(hero.moves[1])+' &nbsp; R '+esc(hero.ultimate)+'</span>';}
}
$('fillBotsBtn').onclick=()=>send({type:'fillBots'});
$('nickname').value=localStorage.getItem('jjk-private-fighter-name')||'SORCERER';
$('nickname').addEventListener('change',()=>{const name=sessionName();localStorage.setItem('jjk-private-fighter-name',name);if(A.online)send({type:'name',name});});
document.querySelectorAll('.mode-btn').forEach(b=>b.onclick=()=>{A.mode=Number(b.dataset.mode);document.querySelectorAll('.mode-btn').forEach(x=>x.classList.toggle('selected',x===b));$('modeHint').textContent=(A.mode*2)+' players';sound(400,.04);});
function launch(type){if(!A.online)return notify('Server offline — start node server.js first.');send({type:'name',name:sessionName()});send({type,mode:A.mode,private:type==='create'});sound(330,.08);}
$('quickBtn').onclick=()=>launch('quick');$('createBtn').onclick=()=>launch('create');$('practiceBtn').onclick=()=>{if(!A.online)return notify('Start the server to train against a monster.');send({type:'name',name:sessionName()});send({type:'practice'});};
function join(){if(!A.online)return notify('Server offline — start the server first.');const code=$('roomInput').value.trim().toUpperCase();if(!/^[A-F0-9]{6}$/.test(code))return notify('Enter a six-character room code.');send({type:'name',name:sessionName()});send({type:'join',code});}
$('joinBtn').onclick=join;$('roomInput').onkeydown=e=>{if(e.key==='Enter')join();};
$('copyCode').onclick=async()=>{if(!A.room)return;const link=location.origin+location.pathname+'?room='+A.room.code;try{await navigator.clipboard.writeText(link);notify('Invite link copied! Share it with your friends.');}catch{window.prompt('Copy this invite link:',link);}};
$('leaveLobby').onclick=()=>{send({type:'leave'});A.room=null;A.snapshot=null;try{history.replaceState(null,'',location.pathname);}catch{}switchScreen('menu');};
$('readyBtn').onclick=()=>{const p=A.room?.players.find(x=>x.id===A.id);if(p){send({type:'ready',ready:!p.ready});sound(570,.1,'triangle');}};
$('joinAzure').onclick=()=>send({type:'team',team:'azure'});$('joinCrimson').onclick=()=>send({type:'team',team:'crimson'});
$('exitMatch').onclick=()=>{if(!window.confirm('Leave this match? Your team may forfeit.'))return;send({type:'leave'});A.room=null;A.snapshot=null;try{history.replaceState(null,'',location.pathname);}catch{}switchScreen('menu');};
$('mobileExitBtn').onclick=()=>$('exitMatch').click();
$('rematchBtn').onclick=()=>{send({type:'rematch'});A.roundStatus='lobby';A.snapshot=null;showOverlay(false);switchScreen('lobby');};
$('musicBtn').onclick=()=>{A.sound=!A.sound;$('musicBtn').classList.toggle('off',!A.sound);notify(A.sound?'Sound effects ON':'Sound effects OFF');};
// Controls use browser-friendly keyboard/mouse or the onscreen touch buttons.
function sendKeys(){if(A.screen==='game'&&A.roundStatus==='fight')send({type:'input',keys});}
const MAP={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',Space:'jump',ArrowUp:'jump',ShiftLeft:'dash',ShiftRight:'dash',KeyF:'block'};
const ACTIONS={KeyQ:'counter',KeyJ:'punch',KeyK:'heavy',Digit1:'skill1',Digit2:'skill2',KeyR:'ultimate'};
function fire(action){if(A.screen!=='game'||A.roundStatus!=='fight')return;send({type:'action',action});if(action==='punch')sound(145,.065);}
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target?.tagName))return;if(A.screen!=='game')return;if(MAP[e.code]){e.preventDefault();if(!keys[MAP[e.code]]){keys[MAP[e.code]]=true;sendKeys();}}else if(ACTIONS[e.code]){e.preventDefault();if(!e.repeat)fire(ACTIONS[e.code]);}});
window.addEventListener('keyup',e=>{if(MAP[e.code]){keys[MAP[e.code]]=false;sendKeys();}});
$('arena').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){e.preventDefault();fire(e.button===2?'heavy':'punch');}});
$('arena').addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);sendKeys();});
for(const b of document.querySelectorAll('[data-action]')){b.addEventListener('pointerdown',e=>{e.preventDefault();fire(b.dataset.action);b.classList.add('active');});b.addEventListener('pointerup',()=>b.classList.remove('active'));b.addEventListener('pointercancel',()=>b.classList.remove('active'));}
for(const b of document.querySelectorAll('[data-hold]')){const k=b.dataset.hold;const release=()=>{keys[k]=false;b.classList.remove('active');sendKeys();};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[k]=true;b.classList.add('active');sendKeys();});b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}
setInterval(sendKeys,90);
// --------- ORIGINAL PIXEL-ART RENDERER ---------
const canvas=$('arena'),g=canvas.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
const menuCan=$('menuArt'),mg=menuCan.getContext('2d');mg.imageSmoothingEnabled=false;
const RGB=(s,a)=>s+(Math.round(a*255).toString(16).padStart(2,'0'));
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
function poly(c,pts,color){c.beginPath();c.moveTo(Math.round(pts[0][0]),Math.round(pts[0][1]));for(let i=1;i<pts.length;i++)c.lineTo(Math.round(pts[i][0]),Math.round(pts[i][1]));c.closePath();c.fillStyle=color;c.fill();}
const darken=(hex,amount)=>{let s=hex.replace('#','');if(s.length!==6)return hex;const v=[0,2,4].map(i=>clamp(parseInt(s.slice(i,i+2),16)+amount,0,255).toString(16).padStart(2,'0'));return '#'+v.join('');};
const JJK_SPRITES={};
for(const id of [...Object.keys({gojo:1,yuji:1,megumi:1,todo:1,yuta:1,maki:1,nanami:1,nobara:1,hakari:1,kashimo:1,choso:1,toji:1,yuki:1,higuruma:1,mahito:1,jogo:1,hanami:1,sukuna:1,heian:1})]){
  const im=new Image();im.src='/sprites/'+id+'.png';JJK_SPRITES[id]=im;
}
function drawFighter(ctx,p,t,size=2){
 const im=JJK_SPRITES[p.hero];
 if(im&&im.complete&&im.naturalWidth){
   const running=Math.abs(p.vx||0)>18,jumping=(p.y||0)<WORLD.floor-4;
   const ki=p.dead?28:p.hit?20:p.block||p.parry?19:p.attack?10+Math.floor(t/110)%3:jumping?21:running?4+Math.floor(t/125)%6:Math.floor(t/350)%4;
   const sx=ki%6*116,sy=Math.floor(ki/6)*128;
   ctx.save();ctx.translate(Math.round(p.x||0),Math.round(p.y||0));ctx.scale((p.face||1)*size*.58,size*.58);
   if(p.buff){ctx.globalAlpha=.34;ctx.fillStyle='#cc9bff';for(let j=0;j<4;j++)ctx.fillRect(-44+j*24,-123,8,115);ctx.globalAlpha=1;}
   if(p.hit)ctx.globalAlpha=.63;
   ctx.drawImage(im,sx,sy,116,128,-58,-128,116,128);ctx.restore();
   return;
 }
const d=A.heroes[p.hero]||A.monsters[p.hero]||A.heroes.gojo||{accent:'#72d9ff',shade:'#253655',hair:'#6a93be',skin:'#bc8d71',kit:'rift'};
 if(d.kit==='monster')return drawMonster(ctx,p,t,size,d);
 const x=p.x||0,y=p.y||0,act=!!p.attack,run=Math.abs(p.vx||0)>50,wave=run?Math.sin(t*.015):Math.sin(t*.003)*.35,jump=y<WORLD.floor-10,block=!!p.block,hit=!!p.hit,parry=!!p.parry,bruiser=d.kit==='swap'||d.kit==='stone',armor=d.kit==='stone';
 const coat=d.shade,edge=darken(coat,-21),bright=darken(coat,22),energy=d.accent;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale((p.face||1)*size,size);
 if(p.buff){ctx.globalAlpha=.32+Math.sin(t*.02)*.13;for(let j=0;j<3;j++)rect(ctx,-23+j*12,-66+Math.sin(t*.004+j)*5,18,60,d.accent);ctx.globalAlpha=1;}
 const bend=jump?-2:0,leg=run?Math.sin(t*.015)*6:1;
 // Pixel-art silhouette drawn in real layered pixel shapes, shaded from left to right.
 rect(ctx,-11,-20+bend,9,15,edge);poly(ctx,[[-10,-18+bend],[-1,-20+bend],[-2+leg*.6,-7],[2+leg*.45,-2],[-3+leg*.45,0],[-10,-2]],coat);
 rect(ctx,-12+leg*.45,-4,14,5,edge);rect(ctx,-10+leg*.45,-4,10,2,bright);
 poly(ctx,[[2,-20+bend],[11,-19+bend],[10-leg*.65,-5],[12-leg*.6,0],[3-leg*.5,0],[-1,-8]],coat);
 rect(ctx,1-leg*.55,-4,16,5,edge);rect(ctx,3-leg*.55,-4,11,2,bright);
 // Back arm and near-arm, arranged for attack and guard silhouettes.
 const kick=act?13:0;poly(ctx,[[-12,-44],[-18,-41],[-21,-27],[-14,-25],[-10,-34]],edge);
 rect(ctx,-19,-29,6,7,d.skin);rect(ctx,-18,-30,3,3,darken(d.skin,-25));
 poly(ctx,[[-13,-43],[-6,-48],[8,-48],[15,-41],[13,-22],[-10,-22]],edge);
 poly(ctx,[[-11,-43],[-5,-47],[7,-46],[11,-41],[9,-25],[-9,-25]],coat);
 poly(ctx,[[-9,-41],[-3,-45],[5,-44],[9,-40],[7,-34],[-8,-35]],bright);
 rect(ctx,-6,-30,10,2,energy);rect(ctx,-11,-25,22,3,darken(coat,-35));
 // Costume signatures, original art not based on anime assets.
 if(d.kit==='swap'){rect(ctx,-13,-43,26,9,'#3c827c');rect(ctx,-7,-42,3,12,energy);rect(ctx,3,-42,3,12,energy);}
 if(d.kit==='luck'){rect(ctx,-8,-40,16,3,energy);rect(ctx,-3,-46,5,7,'#efd69e');}
 if(d.kit==='stone'){rect(ctx,-15,-43,9,12,'#ac978b');rect(ctx,8,-43,9,12,'#b19e92');}
 if(d.kit==='blade'){rect(ctx,-2,-30,6,7,'#d4b47e');}
 if(d.kit==='vine'){rect(ctx,-7,-46,4,20,'#85c591');}
 // Front arm uses a pose shape, not a static rectangle.
 if(block){poly(ctx,[[9,-43],[15,-43],[18,-52],[22,-49],[21,-35],[15,-30],[10,-32]],coat);rect(ctx,15,-51,8,8,d.skin);rect(ctx,16,-52,3,4,darken(d.skin,-18));}
 else if(act){poly(ctx,[[9,-43],[16,-41],[25,-38],[33,-38],[33,-33],[23,-32],[11,-30]],coat);rect(ctx,30,-39,8,8,d.skin);rect(ctx,33,-38,4,4,darken(d.skin,-25));}
 else{poly(ctx,[[9,-43],[17,-41],[21,-32],[17+wave,-24],[10+wave,-27],[12,-34]],coat);rect(ctx,12+wave,-27,8,7,d.skin);rect(ctx,14+wave,-28,5,3,darken(d.skin,-25));}
 // Head / neck / nose / highlights.
 rect(ctx,-4,-53,8,7,darken(d.skin,-20));poly(ctx,[[-10,-64],[-2,-67],[9,-64],[12,-58],[10,-48],[-1,-46],[-10,-50]],darken(d.skin,-28));
 poly(ctx,[[-9,-63],[-1,-65],[8,-62],[10,-57],[8,-50],[-1,-48],[-9,-51]],d.skin);
 rect(ctx,8,-57,4,2,darken(d.skin,-18));rect(ctx,4,-58,4,2,'#101a31');rect(ctx,6,-57,2,2,energy);rect(ctx,3,-52,5,1,darken(d.skin,-48));
 // Layered spiky / slick / masked hairstyles per fighter.
 if(d.kit==='swap'){rect(ctx,-10,-68,20,6,d.hair);rect(ctx,-9,-71,5,5,d.hair);rect(ctx,0,-73,4,8,d.hair);rect(ctx,6,-70,5,5,d.hair);rect(ctx,-9,-62,4,4,d.hair);}
 else if(d.kit==='luck'){poly(ctx,[[-12,-64],[-11,-70],[-6,-74],[1,-73],[8,-70],[11,-66],[1,-65],[-8,-63]],d.hair);rect(ctx,-9,-70,14,2,darken(d.hair,18));}
 else if(d.kit==='blade'||d.kit==='shadow'){poly(ctx,[[-13,-64],[-16,-69],[-9,-68],[-11,-74],[-3,-70],[1,-78],[5,-70],[13,-74],[11,-65],[3,-64]],d.hair);rect(ctx,-11,-63,10,5,d.hair);}
 else if(d.kit==='bolt'||d.kit==='ice'){poly(ctx,[[-12,-65],[-17,-72],[-6,-69],[-4,-79],[2,-72],[10,-80],[13,-68],[5,-65]],d.hair);rect(ctx,-8,-67,15,3,darken(d.hair,22));}
 else{poly(ctx,[[-12,-65],[-14,-70],[-7,-69],[-5,-75],[2,-70],[9,-74],[12,-65],[7,-63],[-6,-64]],d.hair);rect(ctx,-8,-67,11,2,darken(d.hair,18));}
 // Masks, forehead ornament, individual armor/equipment.
 if(d.kit==='rift'){rect(ctx,-7,-59,18,3,'#d0bb78');rect(ctx,1,-59,8,2,energy);}
 if(d.kit==='shadow'){rect(ctx,-7,-59,16,4,'#16142e');rect(ctx,4,-58,4,2,'#bf89f7');}
 if(d.kit==='blade'){poly(ctx,[[5,-40],[22,-55],[25,-55],[11,-37]],'#c1d3e9');rect(ctx,10,-41,3,7,'#e8d7a7');}
 if(d.kit==='light'){rect(ctx,-3,-69,6,3,energy);}
 if(d.kit==='wind'){rect(ctx,-12,-65,19,2,'#c3e9a5');}
 if(d.kit==='ice'){rect(ctx,4,-65,3,6,'#e4fcff');}
 if(hit){ctx.globalAlpha=.38;rect(ctx,-19,-77,55,80,'#ffffff');ctx.globalAlpha=1;}
 if(p.counter){rect(ctx,-15,-84,31,5,'#fff4ba');}
 if(block){ctx.strokeStyle=parry?'#f5e18a':'#8fdcf8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(9,-42,25,-1.0,1.07);ctx.stroke();}
 ctx.restore();
}
function drawMonster(ctx,p,t,size,d){
 ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale((p.face||1)*size,size);
 const claw=p.attack?14:1;
 rect(ctx,-24,0,48,3,'#080c17');
 poly(ctx,[[-16,-2],[-19,-17],[-11,-28],[11,-28],[20,-17],[16,-2],[6,-4],[1,-15],[-5,-6]],'#171427');
 for(let side of [-1,1]){
  poly(ctx,[[side*7,-20],[side*21,-10],[side*27,-1],[side*18,-3],[side*13,-11]],'#34304b');
  poly(ctx,[[side*16,-38],[side*25,-32],[side*(28+claw),-25],[side*(37+claw),-26],[side*(28+claw),-17],[side*14,-25]],'#292139');
  poly(ctx,[[side*(30+claw),-21],[side*(40+claw),-16],[side*(34+claw),-25]],'#aeb2ca');
 }
 poly(ctx,[[-14,-50],[-23,-42],[-18,-27],[-7,-21],[10,-22],[20,-37],[13,-54]],'#121323');
 poly(ctx,[[-12,-52],[-16,-40],[-8,-28],[9,-28],[15,-43],[9,-54]],'#3a2b4c');
 for(let i=-2;i<=2;i++)rect(ctx,i*5-1,-35+(i%2)*3,3,7,'#ad5c91');
 poly(ctx,[[-10,-57],[-17,-68],[-10,-66],[-4,-78],[0,-66],[10,-74],[11,-62],[18,-55],[11,-48],[-6,-47]],'#181525');
 poly(ctx,[[-9,-59],[-7,-64],[4,-62],[11,-55],[6,-48],[-7,-49]],'#706087');
 rect(ctx,2,-59,7,4,'#ff648e');rect(ctx,4,-58,2,2,'#ffffff');
 rect(ctx,2,-51,10,2,'#0c0c15');for(let i=0;i<4;i++)rect(ctx,3+i*2,-51,1,4,'#ddd8e7');
 if(p.hit){ctx.globalAlpha=.45;rect(ctx,-20,-79,61,82,'#ffffff');ctx.globalAlpha=1;}
 if(p.block){ctx.strokeStyle='#a9dafa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(7,-35,25,-1,1);ctx.stroke();}
 ctx.restore();
}
const backgrounds={};
function buildBackground(theme='night'){let off=document.createElement('canvas');off.width=960;off.height=540;let c=off.getContext('2d');let s=0x12345;const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
 const pink=theme==='sunset';rect(c,0,0,960,540,pink?'#321832':'#0d1939');
 for(let y=0;y<360;y+=6){rect(c,0,y,960,6,`rgba(${pink?'106,52,80':'31,55,102'},${.11+y/4500})`);}
 // Stars and atmospheric colored pixels.
 for(let i=0;i<95;i++){let x=Math.round(rnd()*960/3)*3,y=Math.round(rnd()*260/3)*3;rect(c,x,y,3,3,rnd()>.75?'#667bba':'#344678');}
 rect(c,700,64,79,79,pink?'#e79aa1':'#c5ddff');rect(c,710,72,63,63,pink?'#eec6bb':'#dde8ff');
 for(let layer=0;layer<2;layer++){let x=0;while(x<960){const w=35+Math.floor(rnd()*55/5)*5,h=70+rnd()*115+layer*20,y=338-h;rect(c,x,y,w,h,layer?'#111d34':'#1b2a4c');rect(c,x+3,y-5,w-6,6,layer?'#101a2c':'#263855');for(let wy=y+12;wy<334;wy+=13)for(let wx=x+8;wx<x+w-8;wx+=11)if(rnd()>.48)rect(c,wx,wy,4,6,layer?(rnd()>.8?'#ba8da2':'#3e5676'):'#465c81');x+=w+2;}}
 // Distant shrine towers / pillars.
 for(const x of [90,405,745]){rect(c,x,255,11,94,'#1b2641');rect(c,x-8,251,27,7,'#31405e');rect(c,x-17,243,45,7,'#213553');rect(c,x+5,253,3,88,'#485677');}
 // Railings, paved floor and shadows.
 rect(c,0,333,960,9,'#293753');rect(c,0,342,960,6,'#11192f');for(let x=0;x<960;x+=49){rect(c,x,337,5,23,'#25334f');}
 rect(c,0,360,960,180,'#1b223a');rect(c,0,380,960,5,'#5d6582');rect(c,0,389,960,3,'#2d3959');
 for(let y=395;y<540;y+=24){rect(c,0,y,960,2,'#2a3854');for(let x=(y/24%2)*26-45;x<960;x+=76){rect(c,x,y,3,20,'#2a3854');rect(c,x+5,y+4,25,3,'#1a263f');}}
 for(let i=0;i<55;i++){let x=Math.floor(rnd()*960/4)*4,y=384+Math.floor(rnd()*150/4)*4;rect(c,x,y,4+Math.round(rnd())*4,2,rnd()>.5?'#3e4969':'#131b32');}
 rect(c,0,378,960,2,'#89b8cd');
 backgrounds[theme]=off;
}
buildBackground('night');
function paintMenu(){let t=Date.now();mg.clearRect(0,0,460,270);mg.save();mg.scale(.48,.48);mg.drawImage(backgrounds.night,0,0);mg.restore();const pts=[{hero:'gojo',x:143,y:236,face:1},{hero:'yuji',x:319,y:239,face:-1},{hero:'todo',x:396,y:257,face:-1}];for(let p of pts)drawFighter(mg,p,t,2.75);mg.strokeStyle='#82d9ff';mg.lineWidth=3;mg.beginPath();mg.arc(246,145,40,-.4,1.6);mg.stroke();}
function addFX(m){let x=m.x||0,y=m.y||0;for(let i=0;i<13;i++){const th=Math.random()*Math.PI*2,sp=25+Math.random()*100;A.fx.push({x,y,vx:Math.cos(th)*sp,vy:Math.sin(th)*sp,born:performance.now(),dur:250+Math.random()*220,color:m.kind==='parry'?'#a8eaff':m.kind==='ultimate'?'#ffc6ed':'#ffe8aa'});}if(A.fx.length>170)A.fx.splice(0,A.fx.length-170);}
function drawBG(ctx){ctx.drawImage(backgrounds.night,0,0);}
function hud(ctx,snap){const ps=snap.players||[],azure=ps.filter(p=>p.team==='azure'),crimson=ps.filter(p=>p.team==='crimson');
 rect(ctx,0,0,960,Math.max(67,25+Math.max(azure.length,crimson.length)*24),'#060a19e9');
 for(const [team,arr] of [['azure',azure],['crimson',crimson]]){const pos=team==='azure'?18:682;const color=COLOR[team];rect(ctx,pos,12,260,4,color);ctx.fillStyle=color;ctx.font='bold 14px monospace';ctx.textAlign='left';ctx.fillText(team.toUpperCase(),pos,31);
   arr.forEach((p,i)=>{const y=39+i*24;const d=A.heroes[p.hero]||A.monsters[p.hero]||{hp:120,name:p.hero};const bw=snap.players.length>2?116:193;const off=team==='azure'?0:145;rect(ctx,pos+off,y-10,bw,10,'#28314a');rect(ctx,pos+off,y-10,bw*clamp(p.hp/d.hp,0,1),10,p.dead?'#525a6e':color);ctx.fillStyle='#c5d0e5';ctx.font='bold 11px monospace';ctx.fillText((p.id===A.id?'▶ ':'')+d.name.toUpperCase(),pos+(team==='azure'?128:0),y-1);});
 }
 rect(ctx,408,9,144,50,'#111d36');rect(ctx,411,12,138,3,'#9abcf0');ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='bold 22px monospace';ctx.fillText(Math.max(0,Math.ceil((snap.expires-Date.now())/1000))+'s',480,36);ctx.fillStyle='#bdc8de';ctx.font='bold 11px monospace';ctx.fillText('ROUND '+snap.round+'   '+snap.score.azure+' - '+snap.score.crimson,480,51);
 const me=ps.find(p=>p.id===A.id);if(me){const hero=A.heroes[me.hero];if(hero){rect(ctx,185,456,590,62,'#0a1227df');rect(ctx,187,458,586,2,hero.accent);ctx.fillStyle='#ffffff';ctx.font='bold 17px monospace';ctx.textAlign='left';ctx.fillText(hero.name.toUpperCase(),202,482);ctx.fillStyle='#9eacce';ctx.font='bold 11px monospace';ctx.fillText(hero.role.toUpperCase(),202,499);
 const base=368;rect(ctx,base,477,174,14,'#303651');rect(ctx,base,477,174*me.energy/100,14,hero.accent);ctx.fillStyle='#0b1725';ctx.fillText(Math.round(me.energy)+'%',base+69,488);for(let i=0;i<3;i++){const x=560+i*67,k=['1','2','R'][i],label=i===0?hero.moves[0]:i===1?hero.moves[1]:'ULT';rect(ctx,x,468,61,44,i===2?'#302544':'#21324a');rect(ctx,x,468,61,3,hero.accent);const secs=(me.cooldowns?.[i===0?'skill1':i===1?'skill2':'ultimate']||0)/1000;if(secs>0){rect(ctx,x,472,61,39,'#04091599');ctx.fillStyle='#ffd994';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(secs.toFixed(1)+'s',x+30,503);}ctx.fillStyle='#f3f5ff';ctx.textAlign='center';ctx.font='bold 17px monospace';ctx.fillText(k,x+30,489);ctx.fillStyle='#acb0c9';ctx.font='bold 8px monospace';ctx.fillText(label.slice(0,9).toUpperCase(),x+30,501);}
 $('abilityDisplay').textContent=hero.moves[0]+' [1]  •  '+hero.moves[1]+' [2]  •  '+hero.ultimate+' [R]';
 }}
}
function drawFX(ctx,snap,t){for(const o of snap.fx||[]){const age=t-o.time;if(age>720)continue;ctx.save();ctx.globalAlpha=1-age/720;ctx.strokeStyle=o.color||'#c5e5ff';ctx.lineWidth=o.kind==='ultimate'?7:4;const radius=8+age*(o.kind==='ultimate'?.3:.085);ctx.beginPath();ctx.arc(o.x,o.y,radius,0,Math.PI*2);ctx.stroke();if(o.damage){ctx.fillStyle='#fff4c6';ctx.font='bold 17px monospace';ctx.textAlign='center';ctx.fillText('-'+o.damage,o.x,o.y-age*.04-15);}if(o.kind==='jackpot'){ctx.fillStyle=o.color;ctx.font='bold 23px monospace';ctx.textAlign='center';ctx.fillText('✦ 777 ✦',o.x,o.y-60);}ctx.restore();}
 for(const p of snap.projectiles||[]){ctx.save();ctx.shadowBlur=18;ctx.shadowColor=p.accent;rect(ctx,p.x-16,p.y-9,32,18,p.accent);rect(ctx,p.x-10,p.y-5,20,10,'#ffffff');ctx.shadowBlur=0;ctx.restore();}
 for(let i=A.fx.length-1;i>=0;i--){let f=A.fx[i],age=t-f.born;if(age>f.dur){A.fx.splice(i,1);continue;}let dt=age/1000;rect(ctx,f.x+f.vx*dt,f.y+f.vy*dt+150*dt*dt,5,5,f.color);}
}
let lastRender=0;
function draw(t){if(A.screen==='menu'&&t-lastRender>60)paintMenu();lastRender=t;
 if(A.screen==='game'){
  g.clearRect(0,0,960,540);g.save();if(A.hitShake>0){g.translate((Math.random()-.5)*A.hitShake,(Math.random()-.5)*A.hitShake);A.hitShake*=.8;if(A.hitShake<.5)A.hitShake=0;}
  drawBG(g);
  const snap=A.snapshot;if(snap){const sorted=[...snap.players].sort((a,b)=>a.y-b.y);for(const p of sorted){const prev=A.localPositions.get(p.id)||{x:p.x,y:p.y};const next={x:prev.x+(p.x-prev.x)*.34,y:prev.y+(p.y-prev.y)*.5};A.localPositions.set(p.id,next);
    rect(g,next.x-29,380,58,5,'#080e1d90');if(p.dead){g.globalAlpha=.3;}drawFighter(g,{...p,x:next.x,y:next.y,attack:p.attack,hit:p.hit,parry:p.parry,block:p.block,vx:Math.abs(next.x-prev.x)*50},t,1.8);g.globalAlpha=1;
    rect(g,next.x-43,next.y-111,86,16,'#091124db');g.fillStyle=p.team==='azure'?COLOR.azure:COLOR.crimson;g.font='bold 12px monospace';g.textAlign='center';g.fillText(p.name.toUpperCase().slice(0,12),next.x,next.y-100);
  }drawFX(g,snap,Date.now());hud(g,snap);
  }else{g.fillStyle='#e1eeff';g.font='bold 28px monospace';g.textAlign='center';g.fillText('CONNECTING FIGHTERS…',480,257);}
  g.restore();
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
// Prevent accidental text highlighting and contextual copy while tapping the game.
// Players can still type/edit names and codes; the COPY LINK button works normally.
const isEditable = el => !!el?.closest?.('input,textarea,[contenteditable="true"]');
document.addEventListener('selectstart',e=>{if(!isEditable(e.target))e.preventDefault();});
document.addEventListener('copy',e=>{if(!isEditable(e.target))e.preventDefault();});
document.addEventListener('contextmenu',e=>{if(!isEditable(e.target))e.preventDefault();});
connect();
})();
