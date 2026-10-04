import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {roomHandler} from '../server/rooms';
import {MemoryRoomStore} from '../server/store';
import {initialMatch,simulateShot} from '../src/online-match';

const command={angle:0,power:5,spin:{side:0,top:0}};
function setup(){
  const store=new MemoryRoomStore(),handle=roomHandler(store),host=randomUUID(),guest=randomUUID();
  async function call(token:string,body?:Record<string,unknown>,code=''){
    const response=await handle(new Request(`https://pool.test/api/room?code=${code}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
    return {status:response.status,data:await response.json()};
  }
  return {store,handle,host,guest,call};
}
test('room create, join and reconnect retain seats without revealing tokens',async()=>{
  const {call,host,guest}=setup();const first=await call(host,{action:'create'});assert.equal(first.status,200);assert.equal(first.data.seat,0);
  const code=first.data.code;assert.match(code,/^[A-HJ-NP-Z2-9]{8}$/);
  const joined=await call(guest,{action:'join',code});assert.equal(joined.data.seat,1);assert.equal(joined.data.ready,true);
  const again=await call(guest,{action:'join',code});assert.equal(again.data.seat,1);assert.equal(again.data.revision,joined.data.revision);
  const read=await call(host,undefined,code);assert.equal(read.data.ready,true);assert.equal(read.data.opponentOnline,true);
  for(const result of [first,joined,read]){assert.equal('tokens' in result.data,false);assert.equal(JSON.stringify(result.data).includes(host),false);assert.equal(JSON.stringify(result.data).includes(guest),false);}
});
test('only one guest can claim a room and nonmembers cannot read or change it',async()=>{
  const {call,host,guest}=setup();const {data:{code}}=await call(host,{action:'create'});
  const results=await Promise.all([call(guest,{action:'join',code}),call(randomUUID(),{action:'join',code})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await call(randomUUID(),undefined,code)).status,403);
  assert.equal((await call(randomUUID(),{action:'leave',code})).status,403);
});
test('server enforces turns, rejects malformed input, and calculates authoritative results',async()=>{
  const {call,host,guest}=setup();const {data:{code}}=await call(host,{action:'create'});
  const joined=await call(guest,{action:'join',code});const revision=joined.data.revision;
  const action={action:'shot',code,revision,requestId:randomUUID(),command};
  assert.equal((await call(guest,action)).status,403);
  assert.equal((await call(host,{...action,command:{...command,power:9999}})).status,400);
  assert.equal((await call(host,{...action,command:{...command,spin:{side:1,top:1}}})).status,400);
  const result=await call(host,{...action,match:{winner:0}});assert.equal(result.status,200);
  assert.equal(result.data.match.shots,1);assert.equal(result.data.match.player,1);assert.equal(result.data.match.placement,true);assert.equal(result.data.match.winner,null);
  assert.equal(result.data.replay.command.power,5);assert.ok(result.data.availableAt>result.data.serverNow);
});
test('retries are idempotent and concurrent shot writes cannot both succeed',async()=>{
  const {call,host,guest}=setup();const {data:{code}}=await call(host,{action:'create'});const joined=await call(guest,{action:'join',code});
  const action={action:'shot',code,revision:joined.data.revision,requestId:randomUUID(),command};
  const results=await Promise.all([call(host,action),call(host,{...action,requestId:randomUUID()})]);assert.equal(results.filter(r=>r.status===200).length,1);
  const winner=results.find(r=>r.status===200)!;const retry=await call(host,{...action,requestId:winner.data.replay.id});
  assert.equal(retry.status,200);assert.equal(retry.data.match.shots,1);assert.equal(retry.data.revision,winner.data.revision);
});
test('shot cooldown and ball-in-hand placement are enforced',async()=>{
  const {call,host,guest,store}=setup();const {data:{code}}=await call(host,{action:'create'});const joined=await call(guest,{action:'join',code});
  const shot=await call(host,{action:'shot',code,revision:joined.data.revision,requestId:randomUUID(),command});
  const second={action:'shot',code,revision:shot.data.revision,requestId:randomUUID(),command:{...command,position:{x:310,y:310}}};
  assert.equal((await call(guest,second)).status,409);
  const record=(await store.get(code))!;record.availableAt=0;await store.save(code,record.revision,record);
  assert.equal((await call(guest,{...second,command:{...command,position:{x:748,y:310}}})).status,400);
  assert.equal((await call(guest,{...second,command:{...command,position:{x:72,y:72}}})).status,400);
  assert.equal((await call(guest,second)).status,200);
});
test('leaving closes the room and a rematch requires both players',async()=>{
  const {call,host,guest,store}=setup();const {data:{code}}=await call(host,{action:'create'});await call(guest,{action:'join',code});
  assert.equal((await call(host,{action:'rematch',code})).status,409);
  const record=(await store.get(code))!;record.match.winner=0;await store.save(code,record.revision,record);
  const vote=await call(host,{action:'rematch',code});assert.equal(vote.data.match.winner,0);assert.deepEqual(vote.data.rematchVotes,[0]);
  const rematch=await call(guest,{action:'rematch',code});assert.equal(rematch.data.match.winner,null);assert.equal(rematch.data.match.shots,0);
  assert.equal((await call(host,{action:'leave',code})).data.closed,true);
  assert.equal((await call(guest,undefined,code)).data.closed,true);
  assert.equal((await call(randomUUID(),{action:'join',code})).status,410);
});
test('missing rooms, invalid codes, untrusted origins and excessive room creation fail safely',async()=>{
  const {call,host,handle}=setup();assert.equal((await call(host,{action:'join',code:'ABCDEFGH'})).status,404);
  assert.equal((await call(host,{action:'join',code:'bad'})).status,400);
  const untrusted=await handle(new Request('https://pool.test/api/room',{method:'POST',headers:{origin:'https://evil.test',authorization:`Bearer ${host}`},body:'{"action":"create"}'}));assert.equal(untrusted.status,403);
  for(let i=0;i<12;i++)assert.equal((await call(host,{action:'create'})).status,200);
  assert.equal((await call(host,{action:'create'})).status,429);
});
test('authoritative simulation includes cue spin and never changes the supplied snapshot',()=>{
  const state=initialMatch();state.balls=state.balls.slice(0,2);state.balls[1].x=380;const original=structuredClone(state);
  const draw=simulateShot(state,{angle:0,power:42,spin:{side:0,top:-1}}),follow=simulateShot(state,{angle:0,power:42,spin:{side:0,top:1}});
  assert.ok(draw.match.balls[0].x<follow.match.balls[0].x);assert.deepEqual(state,original);
});
test('placement previews validate ownership and position without changing the match or revision',async()=>{
  const {call,host,guest,store}=setup();const {data:{code}}=await call(host,{action:'create'});await call(guest,{action:'join',code});
  const record=(await store.get(code))!;
  const preview={action:'placement',code,revision:record.revision,position:{x:400,y:250},confirmed:false,sequence:2};
  assert.equal((await call(host,preview)).status,409);
  record.match.placement=true;await store.save(code,record.revision,record);
  assert.equal((await call(guest,preview)).status,403);
  assert.equal((await call(randomUUID(),preview)).status,403);
  for(const position of [{x:748,y:310},{x:81,y:81},{x:-100,y:250},{x:'400',y:250}])assert.equal((await call(host,{...preview,position})).status,400);
  assert.equal((await call(host,{...preview,sequence:1.5})).status,400);
  assert.equal((await call(host,{...preview,revision:0})).status,409);
  assert.equal((await call(host,preview)).status,200);
  const read=await call(guest,undefined,code);
  assert.deepEqual(read.data.placementPreview,{x:400,y:250,confirmed:false,sequence:2});
  assert.equal(read.data.revision,record.revision);assert.deepEqual(read.data.match,record.match);
  await call(host,{...preview,position:{x:500,y:250},confirmed:true,sequence:3});
  await call(host,{...preview,sequence:1});
  assert.equal((await call(guest,undefined,code)).data.placementPreview.confirmed,true);
  const shot=await call(host,{action:'shot',code,revision:record.revision,requestId:randomUUID(),command:{...command,position:{x:500,y:250}}});
  assert.equal(shot.status,200);assert.equal(shot.data.placementPreview,null);
  assert.equal((await call(host,preview)).status,403);
  // Even if an old request finishes after the shot, its revision cannot leak into the new turn.
  await store.preview(code,record.revision,{x:600,y:250,confirmed:false,sequence:4});
  const latest=(await store.get(code))!;latest.availableAt=0;await store.save(code,latest.revision,latest);
  assert.equal((await call(guest,undefined,code)).data.placementPreview,null);
  await call(guest,{action:'leave',code});assert.equal((await call(host,undefined,code)).data.placementPreview,null);
});
test('aim previews share angle and pullback only for the current turn and clear after shooting',async()=>{
  const {call,host,guest,store}=setup();const {data:{code}}=await call(host,{action:'create'});
  const action={action:'aim',code,revision:1,angle:Math.PI/2,power:75,dragging:true,sequence:1};
  assert.equal((await call(host,action)).status,409);
  const joined=await call(guest,{action:'join',code});action.revision=joined.data.revision;
  assert.equal((await call(guest,action)).status,403);
  assert.equal((await call(randomUUID(),action)).status,403);
  for(const invalid of [{angle:null},{angle:10000},{power:101},{power:-1},{dragging:'yes'},{sequence:1.5}])assert.equal((await call(host,{...action,...invalid})).status,400);
  assert.equal((await call(host,{...action,position:{x:999,y:999}})).status,200);
  let read=(await call(guest,undefined,code)).data;
  assert.deepEqual(read.aimPreview,{x:310,y:310,angle:Math.PI/2,power:75,dragging:true,sequence:1});
  assert.equal(read.placementPreview,null);assert.deepEqual(read.match,joined.data.match);assert.equal(read.revision,action.revision);
  await call(host,{...action,angle:0,sequence:3});await call(host,{...action,sequence:2});
  assert.equal((await call(guest,undefined,code)).data.aimPreview.angle,0);
  const record=(await store.get(code))!;record.match.placement=true;await store.save(code,record.revision,record);
  assert.equal((await call(host,{...action,sequence:4})).status,400);
  assert.equal((await call(host,{...action,sequence:4,position:{x:748,y:310}})).status,400);
  assert.equal((await call(host,{...action,sequence:4,position:{x:400,y:250}})).status,200);
  read=(await call(guest,undefined,code)).data;assert.equal(read.aimPreview.x,400);assert.equal(read.placementPreview.confirmed,true);
  const shot=await call(host,{action:'shot',code,revision:action.revision,requestId:randomUUID(),command:{...command,position:{x:400,y:250}}});
  assert.equal(shot.status,200);assert.equal(shot.data.aimPreview,null);
  assert.equal((await call(guest,{...action,revision:shot.data.revision})).status,409);
  const latest=(await store.get(code))!;latest.availableAt=0;await store.save(code,latest.revision,latest);
  await store.preview(code,action.revision,{x:400,y:250,confirmed:true,sequence:100,aim:{angle:1,power:99,dragging:true}});
  assert.equal((await call(guest,undefined,code)).data.aimPreview,null);
  await call(host,{action:'leave',code});assert.equal((await call(guest,undefined,code)).data.aimPreview,null);
});
