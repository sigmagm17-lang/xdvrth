'use strict';
const assert=require('node:assert/strict');
const URL=process.env.TEST_URL||'ws://localhost:3000/ws';
class Client{
 constructor(){this.a=[];this.ws=null;}
 async open(){this.ws=new WebSocket(URL);this.ws.onmessage=e=>{try{this.a.push(JSON.parse(e.data));if(this.a.length>400)this.a.shift();}catch{}};await new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j;});await this.wait(m=>m.type==='welcome');return this;}
 send(m){this.ws.send(JSON.stringify(m));}
 async wait(check,t=5000){let end=Date.now()+t;while(Date.now()<end){let i=this.a.findIndex(check);if(i>=0)return this.a.splice(i,1)[0];await new Promise(r=>setTimeout(r,18));}throw Error('timeout '+this.a.slice(-8).map(x=>x.type+':'+(x.kind||'')).join(','));}
 close(){this.ws.close();}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let a,b;try{
 a=await new Client().open();b=await new Client().open();a.send({type:'create',mode:1,private:true});let code=(await a.wait(x=>x.type==='joined')).code;
 b.send({type:'join',code});await b.wait(x=>x.type==='joined');await a.wait(x=>x.type==='room'&&x.room.players.length===2);
 a.send({type:'choose',hero:'gojo'});b.send({type:'choose',hero:'yuji'});a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});
 await a.wait(x=>x.type==='started');
 a.send({type:'input',keys:{right:true}});b.send({type:'input',keys:{left:true}});
 await a.wait(x=>x.type==='state'&&x.players.length===2&&Math.abs(x.players[0].x-x.players[1].x)<58,6000);
 a.send({type:'input',keys:{}});b.send({type:'input',keys:{}});await sleep(75);
 // Perfect parry: timed block creates a short counter window.
 b.send({type:'input',keys:{block:true}});await sleep(70);a.send({type:'action',action:'punch'});
 let parry=await b.wait(x=>x.type==='hit'&&x.kind==='parry',2000);assert(parry);
 b.send({type:'input',keys:{block:false}});await sleep(55);b.send({type:'action',action:'counter'});
 let counter=await a.wait(x=>x.type==='hit'&&x.kind==='counter',2500);assert(counter.damage>=25);
 await a.wait(x=>x.type==='state'&&x.players.some(p=>p.hero==='gojo'&&p.hp<110));
 console.log('PASS perfect parry and counter');
 // Input injection: server ignores forged coordinates and HP in input payload.
 a.send({type:'input',keys:{},x:900,hp:999999});let state=await a.wait(x=>x.type==='state'&&x.players.length===2);
 assert(state.players.every(x=>x.hp<=200));
 console.log('PASS authoritative state rejects forged HP');
 // The opposing curse is not selectable; bot appears only in training.
 const c=await new Client().open();let welcome=c.a.find(x=>x.type==='welcome');c.send({type:'practice'});let started=await c.wait(x=>x.type==='started');assert(started);
 const monster=await c.wait(x=>x.type==='state'&&x.players.some(p=>p.bot));assert.equal(monster.players.find(p=>p.bot).hero,'mahito');assert.equal(monster.players.find(p=>p.bot).faction,'curse');c.close();
 console.log('PASS solo training monster; hero-only roster');
 a.close();b.close();process.exit(0);
 }catch(e){console.error(e);if(a)a.close();if(b)b.close();process.exit(1);}})();
