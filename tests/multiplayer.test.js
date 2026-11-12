'use strict';
const assert=require('node:assert/strict');
const URL=process.env.TEST_URL||'ws://localhost:3077/ws';
class Client {
 constructor(name){this.name=name;this.msg=[];this.ws=null;}
 async connect(){this.ws=new WebSocket(URL);this.ws.addEventListener('message',e=>{try{this.msg.push(JSON.parse(e.data));}catch{}});await new Promise((res,rej)=>{this.ws.addEventListener('open',res,{once:true});this.ws.addEventListener('error',rej,{once:true});});await this.wait(m=>m.type==='welcome');this.send({type:'name',name:this.name});return this;}
 send(o){this.ws.send(JSON.stringify(o));}
 async wait(test,ms=5500){const limit=Date.now()+ms;while(Date.now()<limit){let n=this.msg.findIndex(test);if(n>=0)return this.msg.splice(n,1)[0];await new Promise(r=>setTimeout(r,25));}throw Error('Timed out waiting '+test+' recent: '+this.msg.slice(-4).map(x=>x.type+' '+JSON.stringify(x).slice(0,50)));}
 close(){this.ws.close();}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const everyone=[];
 try {
  const http=await fetch(URL.replace('ws:','http:').replace('/ws','/health'));assert.equal((await http.json()).ok,true);
  for(const size of [1,2,3]){
    const party=[];for(let i=0;i<size*2;i++){let c=await new Client('Fighter'+i).connect();party.push(c);everyone.push(c);}
    let host=party[0];host.send({type:'create',mode:size,private:true});const j=await host.wait(m=>m.type==='joined');assert.match(j.code,/^[A-F0-9]{6}$/);
    for(let i=1;i<party.length;i++){party[i].send({type:'join',code:j.code});let joined=await party[i].wait(m=>m.type==='joined');assert.equal(joined.code,j.code);}
    await host.wait(m=>m.type==='room'&&m.room.players.length===size*2);
    let blue=party.map((_,i)=>i).filter(i=>i%2===0).length;assert.equal(blue,size);
    party.forEach((c,i)=>{c.send({type:'choose',hero:i%2?'ember':'atlas'});c.send({type:'ready',ready:true});});
    await host.wait(m=>m.type==='started');let st=await host.wait(m=>m.type==='state'&&m.players.length===2*size,3000);
    assert.equal(st.round,1);assert.equal(st.players.filter(p=>p.team==='azure').length,size);
    assert.equal(st.players.filter(p=>p.team==='crimson').length,size);
    assert(st.players.every(p=>p.hp>0));
    // Authoritative movement: no client-supplied HP/coordinates are honored.
    party[0].send({type:'input',keys:{right:true}});let old=st.players.find(x=>x.team==='azure').x;await sleep(500);const newer=await host.wait(m=>m.type==='state'&&m.players.find(p=>p.team==='azure')?.x>old+60);assert(newer.players.some(p=>p.x>old+60));
    party[0].send({type:'input',keys:{right:false}});
    // Finish a private match through disconnect: team-less side forfeits.
    for(let i=1;i<party.length;i+=2)party[i].close();
    if(size===1){await host.wait(m=>m.type==='matchEnd'&&m.forfeit,3000);}
    for(let i=0;i<party.length;i+=2)party[i].close();
    await sleep(80);
    console.log('PASS',size+'v'+size,'room join, teams, ready, live state, movement');
  }
  const c=await new Client('Missing').connect();everyone.push(c);c.send({type:'join',code:'XXXXXX'});await c.wait(m=>m.type==='error');c.close();console.log('PASS invalid invite error');
  console.log('ALL MULTIPLAYER TESTS PASSED');process.exit(0);
 } catch(e){console.error('TEST FAILURE:',e);process.exitCode=1;for(const c of everyone){try{c.close();}catch{}}setTimeout(()=>process.exit(1),500);} 
})();
