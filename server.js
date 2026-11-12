'use strict';
// VEXELBOUND ONLINE - zero-dependency, single-instance server.
// Server owns positions, collision, damage, cooldowns, timers, teams and scores.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000);
const ROOT=path.resolve(__dirname,'public');
const TICK_MS=33;
const WORLD={width:960,floor:380};
const TEAMS=['azure','crimson'];
const HEROES={
  solis:{name:'Solis',role:'Rift Weaver',hp:110,speed:230,damage:11,accent:'#72d9ff',shade:'#2b3b72',skin:'#c19d87',hair:'#193255',kit:'rift',moves:['Rift Spear','Phase Rush'],ultimate:'Event Horizon'},
  ember:{name:'Ember',role:'Flame Brawler',hp:135,speed:219,damage:13,accent:'#ff9c5b',shade:'#862d36',skin:'#b77c5d',hair:'#ae4b2c',kit:'flame',moves:['Fireball','Inferno Step'],ultimate:'Phoenix Break'},
  noct:{name:'Noct',role:'Shadow Caller',hp:105,speed:250,damage:10,accent:'#ab91ff',shade:'#292144',skin:'#8f6a62',hair:'#302e54',kit:'shadow',moves:['Shadow Fang','Umbral Dash'],ultimate:'Nightfall'},
  atlas:{name:'Atlas',role:'Clap Vanguard',hp:170,speed:211,damage:15,accent:'#63ffd0',shade:'#2e6760',skin:'#9e6645',hair:'#17292a',kit:'swap',moves:['Clap Shift','Titan Elbow'],ultimate:'Brotherhood Rush'},
  rook:{name:'Rook',role:'Blade Warden',hp:120,speed:239,damage:12,accent:'#d6e2ff',shade:'#52576a',skin:'#a17d69',hair:'#55545b',kit:'blade',moves:['Wind Cutter','Draw Step'],ultimate:'Thousand Edges'},
  volt:{name:'Volt',role:'Storm Spear',hp:115,speed:253,damage:10,accent:'#8ffaff',shade:'#27547e',skin:'#bd8f7e',hair:'#70b7be',kit:'bolt',moves:['Spark Lance','Thunder Dash'],ultimate:'Storm Surge'},
  fortune:{name:'Fortune',role:'Lucky Bruiser',hp:150,speed:215,damage:12,accent:'#f2c65d',shade:'#614467',skin:'#bc886c',hair:'#e0c379',kit:'luck',moves:['Gold Gates','Lucky Swing'],ultimate:'Lucky Seven'},
  verdant:{name:'Verdant',role:'Vine Alchemist',hp:115,speed:229,damage:10,accent:'#9def91',shade:'#3c684f',skin:'#b18d6b',hair:'#62835a',kit:'vine',moves:['Thorn Dart','Vine Leap'],ultimate:'Wild Bloom'},
  aegis:{name:'Aegis',role:'Stone Guardian',hp:185,speed:195,damage:14,accent:'#e4b486',shade:'#69554f',skin:'#b49a88',hair:'#4d474d',kit:'stone',moves:['Stone Shot','Bulwark Charge'],ultimate:'Meteor Fist'},
  frost:{name:'Frost',role:'Ice Duelist',hp:117,speed:232,damage:11,accent:'#a6ddff',shade:'#536681',skin:'#ecc8b3',hair:'#e5fbff',kit:'ice',moves:['Shard Volley','Frost Step'],ultimate:'Glacial Crown'},
  prism:{name:'Prism',role:'Light Shaper',hp:108,speed:237,damage:11,accent:'#ffd5f8',shade:'#80528d',skin:'#b78a7c',hair:'#cf8fc0',kit:'light',moves:['Star Needle','Flash Step'],ultimate:'Solar Bloom'},
  gale:{name:'Gale',role:'Sky Striker',hp:124,speed:260,damage:11,accent:'#e5ff8d',shade:'#526e60',skin:'#ad806b',hair:'#7f9961',kit:'wind',moves:['Gale Blade','Cyclone Dash'],ultimate:'Skyfall'}
};
const PUBLIC_HEROES=Object.fromEntries(Object.entries(HEROES).map(([k,v])=>[k,{...v}]));
// Non-playable monsters are only used for solo training / future story encounters.
const MONSTERS={wraith:{name:'Fang Wraith',role:'Rift Monster',hp:180,speed:190,damage:12,accent:'#ff618f',shade:'#231a36',skin:'#5a4d74',hair:'#160f25',kit:'monster',moves:['Claw Rend','Fang Rush'],ultimate:'Abyssal Howl'}};
Object.assign(HEROES,MONSTERS);
const rooms=new Map(); const peers=new Set();
const rand=()=>crypto.randomInt(1_000_000);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const safe=(s,n=18)=>String(s||'').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,n);
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return json(res,400,{error:'Invalid URL'});}
  if(pathname==='/health')return json(res,200,{ok:true,rooms:rooms.size,players:[...peers].filter(p=>p.room).length});
  if(pathname==='/api/config')return json(res,200,{heroes:PUBLIC_HEROES,monsters:MONSTERS,version:'vexelbound-v9',world:WORLD});
  let full=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
  if(!full.startsWith(ROOT+path.sep))return json(res,403,{error:'Forbidden'});
  fs.stat(full,(err,st)=>{
    if(err||!st.isFile())return json(res,404,{error:'Not found'});
    const ext=path.extname(full);
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':pathname==='/'?'no-store':'public, max-age=600','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(full).pipe(res);
  });
});
// RFC 6455 WebSocket transport: messages under 8192B; data frames must be masked.
// Works without npm packages (Node 20+), including hosting providers that run npm start.
class Peer{
  constructor(sock){this.socket=sock;this.buf=Buffer.alloc(0);this.closed=false;this.room=null;this.playerId=crypto.randomUUID();this.lastSeen=Date.now();this.rate=0;this.counter=0;this.bytes=0;this.handleData=this.handleData.bind(this);sock.on('data',this.handleData);sock.on('close',()=>disconnect(this));sock.on('error',()=>disconnect(this));}
  send(obj){if(this.closed||this.socket.destroyed)return;let b=Buffer.from(JSON.stringify(obj));this.frame(1,b);}
  frame(op,payload){if(this.closed||this.socket.destroyed)return;const n=payload.length;let header;if(n<126){header=Buffer.from([0x80|op,n]);}else if(n<65536){header=Buffer.alloc(4);header[0]=0x80|op;header[1]=126;header.writeUInt16BE(n,2);}else{return;}if(this.socket.writableLength>512000)return;this.socket.write(Buffer.concat([header,payload]));}
  close(){if(this.closed)return;this.closed=true;this.socket.end(Buffer.from([0x88,0x00]));}
  handleData(chunk){this.buf=Buffer.concat([this.buf,chunk]);if(this.buf.length>32768){this.close();return;}
    while(this.buf.length>=2){let b=this.buf;let op=b[0]&15;const fin=Boolean(b[0]&128);let size=b[1]&127;let off=2;const masked=Boolean(b[1]&128);if(size===126){if(b.length<4)return;size=b.readUInt16BE(2);off=4;}else if(size===127){this.close();return;}
      if(!masked||!fin||size>8192){this.close();return;}if(b.length<off+4+size)return;
      let mask=b.subarray(off,off+4),payload=Buffer.from(b.subarray(off+4,off+4+size));for(let i=0;i<size;i++)payload[i]^=mask[i&3];this.buf=b.subarray(off+4+size);this.lastSeen=Date.now();
      if(op===8){this.close();return;}if(op===9){this.frame(10,payload);continue;}if(op===10)continue;if(op!==1){this.close();return;}
      // Stop overly chatty or malformed clients from overwhelming an arena.
      const t=Date.now();if(t-this.rate>1000){this.rate=t;this.counter=0;}if(++this.counter>90){this.close();return;}
      let msg;try{msg=JSON.parse(payload.toString('utf8'));}catch{continue;}if(msg&&typeof msg==='object')receive(this,msg);
    }
  }
}
server.on('upgrade',(req,sock,head)=>{
  let uri;try{uri=new URL(req.url,'http://localhost')}catch{sock.destroy();return;}
  if(uri.pathname!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||!/^13$/.test(req.headers['sec-websocket-version']||'')||typeof req.headers['sec-websocket-key']!=='string'){sock.destroy();return;}
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){sock.destroy();return;}}catch{sock.destroy();return;}}
  const key=req.headers['sec-websocket-key'];if(Buffer.from(key,'base64').length!==16){sock.destroy();return;}
  const expected=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+expected+'\r\n\r\n');const p=new Peer(sock);peers.add(p);p.send({type:'welcome',id:p.playerId,heroes:PUBLIC_HEROES,monsters:MONSTERS,version:'vexelbound-v9'});if(head.length)p.handleData(head);
});
function code(){let c;do{c=crypto.randomBytes(5).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(c));return c;}
function roomPublic(r){return {code:r.code,mode:r.mode,private:r.private,status:r.status,host:r.host,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,hero:p.hero,team:p.team,ready:p.ready,connected:!p.peer.closed})),score:r.score,round:r.round};}
function sendRoom(r){broadcast(r,{type:'room',room:roomPublic(r)});}
function broadcast(r,data){for(const p of r.players.values())p.peer.send(data);}
function tell(p,message){p.send({type:'notice',message});}
function error(p,message){p.send({type:'error',message});}
function makeRoom(p,mode,priv){if(p.room)leave(p);if(rooms.size>250)return error(p,'Server is busy. Try again later.');mode=Number(mode);if(![1,2,3].includes(mode))return error(p,'Choose 1v1, 2v2, or 3v3.');let r={code:code(),mode,private:priv,players:new Map(),host:p.playerId,status:'lobby',score:{azure:0,crimson:0},round:1,lastTick:0,frame:0,projectiles:[],fx:[],endAt:0,resetAt:0,winner:null};rooms.set(r.code,r);add(r,p);}
function add(r,peer){if(peer.room)leave(peer);if(r.status!=='lobby')return error(peer,'This match already started.');if(r.players.size>=r.mode*2)return error(peer,'That room is full.');
  let a=[...r.players.values()].filter(p=>p.team==='azure').length,b=r.players.size-a;let team=a<=b?'azure':'crimson';let player={id:peer.playerId,name:peer.displayName||'RIFT-'+rand().toString().slice(-4),hero:'solis',team,ready:false,peer,x:0,y:WORLD.floor,vx:0,vy:0,face:team==='azure'?1:-1,hp:1,energy:100,block:false,parryUntil:0,stun:0,hitUntil:0,dashUntil:0,invuln:0,combo:0,lastAttack:0,atkAt:0,heavyAt:0,skillAt:0,skill2At:0,ultAt:0,blocks:0,ko:0,inputs:{},buffUntil:0};r.players.set(player.id,player);peer.room=r;peer.send({type:'joined',code:r.code,id:player.id});sendRoom(r);}
function leave(peer){let r=peer.room;if(!r)return;peer.room=null;r.players.delete(peer.playerId);if(r.practice){rooms.delete(r.code);return;}
  if(!r.players.size){rooms.delete(r.code);return;}
  if(r.host===peer.playerId)r.host=r.players.keys().next().value;
  if(r.status==='fight'){
    const azure=[...r.players.values()].filter(p=>p.team==='azure').length,crimson=r.players.size-azure;
    if(!azure||!crimson){r.status='ended';r.winner=azure?'azure':'crimson';broadcast(r,{type:'matchEnd',winner:r.winner,forfeit:true});}
  }
  sendRoom(r);
}
function disconnect(p){if(p.closed){peers.delete(p);leave(p);return;}p.closed=true;peers.delete(p);leave(p);try{p.socket.destroy();}catch{}}
function receive(peer,msg){const t=String(msg.type||'');if(t==='name'){peer.displayName=safe(msg.name,14)||'RIFT-'+rand().toString().slice(-4);tell(peer,'Name set to '+peer.displayName);return;}
 if(t==='create')return makeRoom(peer,msg.mode,Boolean(msg.private));
 if(t==='practice'){
   if(peer.room)leave(peer);
   makeRoom(peer,1,true);const r=peer.room;if(!r)return;
   r.practice=true;
   const botPeer={playerId:'monster-'+crypto.randomUUID(),displayName:'FANG WRAITH',room:null,closed:false,send(){}};
   add(r,botPeer);const b=r.players.get(botPeer.playerId);b.hero='wraith';b.name='FANG WRAITH';b.bot=true;b.faction='curse';
   const human=r.players.get(peer.playerId);human.team='azure';human.ready=true;b.team='crimson';b.ready=true;
   start(r);return;
 }
 if(t==='quick'){
   const mode=Number(msg.mode);if(![1,2,3].includes(mode))return error(peer,'Invalid mode');let r=[...rooms.values()].find(r=>!r.private&&r.mode===mode&&r.status==='lobby'&&r.players.size<mode*2);if(r)add(r,peer);else makeRoom(peer,mode,false);return;
 }
 if(t==='join'){const c=String(msg.code||'').toUpperCase().trim();const r=rooms.get(c);if(!r)return error(peer,'Room not found. Ask your friend for a fresh code.');return add(r,peer);}
 if(t==='leave'){leave(peer);peer.send({type:'left'});return;}
 const r=peer.room;if(!r)return error(peer,'Join a room first.');const p=r.players.get(peer.playerId);if(!p)return;
 if(t==='choose'&&r.status==='lobby'){if(!HEROES[msg.hero])return error(peer,'Unknown fighter');p.hero=msg.hero;p.ready=false;sendRoom(r);return;}
 if(t==='team'&&r.status==='lobby'){let team=msg.team;if(!TEAMS.includes(team))return;const count=[...r.players.values()].filter(x=>x.team===team).length;if(count>=r.mode)return error(peer,'That team is full.');p.team=team;p.ready=false;sendRoom(r);return;}
 if(t==='ready'&&r.status==='lobby'){p.ready=Boolean(msg.ready);sendRoom(r);const ps=[...r.players.values()],blue=ps.filter(x=>x.team==='azure'),red=ps.filter(x=>x.team==='crimson');if(ps.length===r.mode*2&&blue.length===r.mode&&red.length===r.mode&&ps.every(x=>x.ready))start(r);return;}
 if(t==='rematch'&&r.status==='ended'){if(r.practice){r.round=1;r.score={azure:0,crimson:0};start(r);return;}r.status='lobby';r.score={azure:0,crimson:0};r.round=1;r.projectiles=[];for(let x of r.players.values())x.ready=false;sendRoom(r);return;}
 if(r.status!=='fight')return;
 if(t==='input'){
   // Only directions / jump / dash / block are continuously held; no client coordinates or health accepted.
   const i=msg.keys||{};p.inputs={left:Boolean(i.left),right:Boolean(i.right),jump:Boolean(i.jump),dash:Boolean(i.dash),block:Boolean(i.block)};return;
 }
 if(t==='action')action(r,p,String(msg.action||''));
}
function start(r){r.status='fight';r.score={azure:0,crimson:0};r.round=1;r.winner=null;resetRound(r);broadcast(r,{type:'started',room:roomPublic(r)});sendRoom(r);}
function resetRound(r){r.status='fight';r.endAt=Date.now()+90_000;r.resetAt=0;r.projectiles=[];r.fx=[];
 const blue=[...r.players.values()].filter(p=>p.team==='azure'),red=[...r.players.values()].filter(p=>p.team==='crimson');
 for(const [side,arr] of [['azure',blue],['crimson',red]])arr.forEach((p,i)=>{const def=HEROES[p.hero];p.hp=def.hp;p.energy=70;p.x=side==='azure'?140+i*65:820-i*65;p.y=WORLD.floor;p.vx=0;p.vy=0;p.face=side==='azure'?1:-1;p.stun=0;p.hitUntil=0;p.dashUntil=0;p.invuln=Date.now()+1200;p.buffUntil=0;p.parryUntil=0;p.block=false;p.inputs={};p.lastAttack=p.atkAt=p.heavyAt=p.skillAt=p.skill2At=p.ultAt=0;p.combo=0;p.counterUntil=0;p._wasBlock=false;p.animAt=0;p.animKind='';});
 broadcast(r,{type:'roundStart',round:r.round});
}
function fx(r,kind,x,y,color,team,more={}){r.fx.push({kind,x:Math.round(x),y:Math.round(y),color,team,time:Date.now(),...more});if(r.fx.length>30)r.fx.shift();}
function hurt(r,att,tar,dmg,kb,kind){const now=Date.now();if(tar.hp<=0||now<tar.invuln)return false;const def=HEROES[tar.hero];if(tar.block&&Math.abs(tar.x-att.x)<175&&tar.face===Math.sign(att.x-tar.x)){
   if(now<tar.parryUntil){tar.counterUntil=now+850;att.stun=now+630;fx(r,'parry',tar.x,tar.y-52,'#a8e5ff',tar.team);broadcast(r,{type:'hit',kind:'parry',x:tar.x,y:tar.y-48,by:tar.id});return false;}
   dmg=Math.max(1,Math.round(dmg*.15));kb*=.2;fx(r,'block',tar.x,tar.y-46,'#93c8ff',tar.team);
 }
 tar.hp=clamp(tar.hp-dmg,0,def.hp);tar.vx=(tar.x>att.x?1:-1)*kb;tar.vy=Math.min(tar.vy,-90);tar.stun=now+Math.min(370,120+dmg*7);tar.hitUntil=now+200;att.energy=clamp(att.energy+dmg*.38,0,100);if(tar.hp===0)att.ko++;
 fx(r,kind,tar.x,tar.y-45,HEROES[att.hero].accent,att.team,{damage:dmg});broadcast(r,{type:'hit',kind,x:tar.x,y:tar.y-45,damage:dmg,by:att.id,target:tar.id});return true;
}
function enemies(r,p,range){return [...r.players.values()].filter(e=>e.team!==p.team&&e.hp>0&&Math.abs(e.x-p.x)<range&&Math.abs(e.y-p.y)<100).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));}
function melee(r,p,{damage,range,kb,kind}){let targets=enemies(r,p,range).filter(e=>((e.x-p.x)*p.face)>-12);for(const e of targets.slice(0,2))hurt(r,p,e,damage,kb,kind);return targets.length;}
function action(r,p,act){const now=Date.now(),d=HEROES[p.hero];if(p.hp<=0||now<p.stun||r.status!=='fight')return;
 if(act==='counter'){if(now>=p.counterUntil)return;p.counterUntil=0;p.animAt=now;p.animKind='heavy';p.block=false;melee(r,p,{damage:30,range:125,kb:340,kind:'counter'});fx(r,'parry',p.x+p.face*55,p.y-45,d.accent,p.team);return;}
 if(p.block)return;
 if(act==='punch'){if(now-p.atkAt<235)return;p.animAt=now;p.animKind='punch';p.atkAt=now;p.combo=now-p.lastAttack<850?(p.combo+1)%4:0;p.lastAttack=now;const dm=d.damage+(p.combo===3?5:0);p.energy=clamp(p.energy+3,0,100);melee(r,p,{damage:dm,range:p.combo===3?94:75,kb:p.combo===3?250:130,kind:'punch'});fx(r,'slash',p.x+p.face*38,p.y-44,d.accent,p.team);return;}
 if(act==='heavy'){if(now-p.heavyAt<750)return;p.animAt=now;p.animKind='heavy';p.heavyAt=now;melee(r,p,{damage:d.damage+9,range:90,kb:325,kind:'heavy'});fx(r,'heavy',p.x+p.face*55,p.y-48,d.accent,p.team);return;}
 if(act==='skill1'){if(now-p.skillAt<3800||p.energy<18)return;p.animAt=now;p.animKind='cast';p.skillAt=now;p.energy-=18;
   if(d.kit==='swap'){const target=enemies(r,p,340)[0];if(target){let old=p.x;p.x=clamp(target.x-p.face*38,30,930);target.x=old;p.face=Math.sign(target.x-p.x)||p.face;hurt(r,p,target,15,175,'swap');fx(r,'swap',old,p.y-42,d.accent,p.team);}return;}
   const speed=570;p.projectile=now;r.projectiles.push({id:crypto.randomUUID(),owner:p.id,team:p.team,x:p.x+p.face*22,y:p.y-45,vx:speed*p.face,damage:d.damage+6,life:1.4,accent:d.accent,kit:d.kit});fx(r,'cast',p.x,p.y-43,d.accent,p.team);return;
 }
 if(act==='skill2'){if(now-p.skill2At<6200||p.energy<30)return;p.animAt=now;p.animKind='dash';p.skill2At=now;p.energy-=30;
   if(d.kit==='vine'||d.kit==='light'){let allies=[...r.players.values()].filter(x=>x.team===p.team&&x.hp>0).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));for(let a of allies.slice(0,2))a.hp=clamp(a.hp+18,0,HEROES[a.hero].hp);fx(r,'heal',p.x,p.y-54,d.accent,p.team);return;}
   p.vx=p.face*460;p.dashUntil=now+300;p.invuln=now+160;melee(r,p,{damage:d.damage+6,range:117,kb:270,kind:'dash'});fx(r,'dash',p.x,p.y-44,d.accent,p.team);return;
 }
 if(act==='ultimate'){if(now-p.ultAt<12000||p.energy<100)return;p.animAt=now;p.animKind='ultimate';p.ultAt=now;p.energy=0;
   if(d.kit==='luck'){p.buffUntil=now+13500;p.hp=clamp(p.hp+45,0,d.hp);fx(r,'jackpot',p.x,p.y-52,d.accent,p.team);broadcast(r,{type:'announcement',text:'LUCKY SEVEN! '+p.name+' hit the jackpot!',team:p.team});return;}
   const hits=enemies(r,p,230);for(let e of hits)hurt(r,p,e,d.damage+32,420,'ultimate');fx(r,'ultimate',p.x,p.y-55,d.accent,p.team);broadcast(r,{type:'announcement',text:d.ultimate.toUpperCase()+'!',team:p.team});return;
 }
}
function updateRoom(r,dt){const now=Date.now();if(r.status!=='fight')return;
 for(const p of r.players.values()){
   const d=HEROES[p.hero];if(p.hp<=0)continue;
   if(p.bot){const human=[...r.players.values()].find(v=>!v.bot&&v.hp>0);if(human){const dist=human.x-p.x;p.face=Math.sign(dist)||p.face;p.inputs={left:dist < -72,right:dist > 72,jump:false,dash:Math.abs(dist)>240,block:Math.abs(dist)<100&&Math.random()<.08};if(Math.abs(dist)<93&&now-(p.lastBotAttack||0)>920){p.lastBotAttack=now;action(r,p,'punch');}if(Math.abs(dist)<420&&now-(p.lastBotSkill||0)>4700){p.lastBotSkill=now;action(r,p,'skill1');}}}

   const input=p.inputs||{};p.block=!!input.block&&now>=p.stun;
   if(p.block&&!p._wasBlock)p.parryUntil=now+175;p._wasBlock=p.block;
   if(now>=p.stun){let dir=(input.right?1:0)-(input.left?1:0);if(dir)p.face=dir;
     if(now>=p.dashUntil){p.vx=dir*d.speed*(p.block?.34:1);if(input.dash&&p.energy>=12&&now>=(p.nextDash||0)&&dir){p.vx=dir*550;p.dashUntil=now+240;p.nextDash=now+1150;p.energy-=12;fx(r,'dash',p.x,p.y-40,d.accent,p.team);}}
     if(input.jump&&p.y>=WORLD.floor-.01){p.vy=-475;fx(r,'dust',p.x,p.y,d.accent,p.team);}
   }else{p.vx*=.86;}
   p.x=clamp(p.x+p.vx*dt,22,WORLD.width-22);
   p.vy+=1190*dt;p.y=Math.min(WORLD.floor,p.y+p.vy*dt);if(p.y>=WORLD.floor)p.vy=0;
   p.energy=clamp(p.energy+3.5*dt,0,100);
   if(now<p.buffUntil){p.hp=clamp(p.hp+12*dt,0,d.hp);p.energy=100;}
 }
 for(let i=r.projectiles.length-1;i>=0;i--){let o=r.projectiles[i];o.x+=o.vx*dt;o.life-=dt;const owner=r.players.get(o.owner);if(!owner||o.life<=0||o.x<0||o.x>WORLD.width){r.projectiles.splice(i,1);continue;}
  const tar=[...r.players.values()].find(p=>p.team!==o.team&&p.hp>0&&Math.abs(p.x-o.x)<24&&Math.abs(p.y-45-o.y)<54);if(tar){hurt(r,owner,tar,o.damage,220,'projectile');r.projectiles.splice(i,1);}
 }
 r.fx=r.fx.filter(o=>now-o.time<720);
 const blue=[...r.players.values()].filter(p=>p.team==='azure'&&p.hp>0),red=[...r.players.values()].filter(p=>p.team==='crimson'&&p.hp>0);
 if(!blue.length||!red.length||now>=r.endAt){
   let winner;if(!blue.length&&!red.length)winner='draw';else if(!blue.length)winner='crimson';else if(!red.length)winner='azure';else{
     const a=blue.reduce((s,p)=>s+p.hp/HEROES[p.hero].hp,0),b=red.reduce((s,p)=>s+p.hp/HEROES[p.hero].hp,0);winner=a===b?'draw':a>b?'azure':'crimson';
   }
   r.status='between';if(winner!=='draw')r.score[winner]++;r.resetAt=now+3300;r.roundWinner=winner;broadcast(r,{type:'roundEnd',winner,score:r.score,round:r.round});
 }
}
function snapshot(r){return {type:'state',time:Date.now(),expires:r.endAt,round:r.round,score:r.score,status:r.status,players:[...r.players.values()].map(p=>({id:p.id,team:p.team,name:p.name,hero:p.hero,bot:!!p.bot,faction:p.faction||'hero',x:Math.round(p.x),y:Math.round(p.y),face:p.face,hp:Math.round(p.hp),energy:Math.round(p.energy),block:p.block,parry:Date.now()<p.parryUntil,stun:Date.now()<p.stun,hit:Date.now()<p.hitUntil,combo:p.combo,buff:Date.now()<p.buffUntil,attack:Date.now()-p.animAt<240,action:p.animKind,counter:Date.now()<p.counterUntil,cooldowns:{skill1:Math.max(0,3800-(Date.now()-p.skillAt)),skill2:Math.max(0,6200-(Date.now()-p.skill2At)),ultimate:Math.max(0,12000-(Date.now()-p.ultAt))},dead:p.hp<=0})),projectiles:r.projectiles,fx:r.fx};}
let prev=Date.now();setInterval(()=>{
 const now=Date.now(),dt=Math.min(.075,(now-prev)/1000);prev=now;
 for(const r of rooms.values()){
  if(r.status==='fight'){updateRoom(r,dt);if(++r.frame%2===0)broadcast(r,snapshot(r));}
  else if(r.status==='between'&&now>=r.resetAt){
    if(r.score.azure>=2||r.score.crimson>=2||r.round>=5){r.status='ended';r.winner=r.score.azure===r.score.crimson?'draw':r.score.azure>r.score.crimson?'azure':'crimson';broadcast(r,{type:'matchEnd',winner:r.winner,score:r.score});sendRoom(r);}
    else{r.round++;resetRound(r);sendRoom(r);}
  }
 }
},TICK_MS).unref();
// Heartbeats and cleanup of closed / abandoned lobby instances.
setInterval(()=>{for(const p of peers){if(Date.now()-p.lastSeen>65_000)p.close();else if(!p.closed)p.frame(9,Buffer.alloc(0));}for(const [c,r] of rooms){if(!r.players.size)rooms.delete(c);}},15000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log('Vexelbound Online listening on http://localhost:'+PORT));
module.exports={server,rooms,HEROES};
