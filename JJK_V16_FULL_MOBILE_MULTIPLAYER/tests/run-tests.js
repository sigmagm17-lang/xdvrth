'use strict';
const {spawn}=require('node:child_process');
const PORT=31377;
const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>process.stdout.write('[server] '+d));child.stderr.on('data',d=>process.stderr.write('[server] '+d));
async function ready(){for(let i=0;i<45;i++){try{const r=await fetch('http://127.0.0.1:'+PORT+'/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,120));}throw Error('Server did not start');}
(async()=>{try{await ready();for(const name of ['multiplayer.test.js','combat.test.js']){await new Promise((resolve,reject)=>{const t=spawn(process.execPath,['tests/'+name],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,TEST_URL:'ws://127.0.0.1:'+PORT+'/ws'},stdio:'inherit'});t.on('exit',code=>code===0?resolve():reject(Error(name+' failed: '+code)));});}console.log('\n✓ ALL TEST SUITES PASSED');}catch(e){console.error(e);process.exitCode=1;}finally{child.kill();}})();
