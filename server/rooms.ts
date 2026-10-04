import {createHash,randomBytes} from 'node:crypto';
import {initialMatch,simulateShot,validateCommand,type RoomView} from '../src/online-match.js';
import {RedisRoomStore,type RoomRecord,type RoomStore} from './store.js';

class RequestError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new RequestError(status,message);};
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomCode(){return Array.from(randomBytes(8),b=>alphabet[b%alphabet.length]).join('');}
function productionStore(){
  const url=process.env.KV_REST_API_URL??process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.KV_REST_API_TOKEN??process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)fail(503,'Online tables are not available yet. Please try again shortly.');
  return new RedisRoomStore(url!,token!);
}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function roomHandler(injected?:RoomStore){return async(request:Request):Promise<Response>=>{
  try{
    const url=new URL(request.url);
    if(!['GET','POST'].includes(request.method))fail(405,'Method not allowed.');
    const origin=request.headers.get('origin');
    if(origin&&origin!==url.origin)fail(403,'Open this room on the game website.');
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
    if(!/^[a-zA-Z0-9_-]{32,80}$/.test(token))fail(401,'Your room session is missing. Reopen the invite link.');
    const digest=hash(token),store=injected??productionStore();
    let body:any={};
    if(request.method==='POST'){
      if(Number(request.headers.get('content-length')??0)>8192)fail(413,'Request is too large.');
      const text=await request.text();if(text.length>8192)fail(413,'Request is too large.');
      try{body=JSON.parse(text);}catch{fail(400,'Invalid request.');}
      if(!body||typeof body!=='object')fail(400,'Invalid request.');
    }
    const ip=hash(request.headers.get('x-vercel-forwarded-for')??request.headers.get('x-forwarded-for')??'local').slice(0,24);
    const action=request.method==='GET'?'read':body.action;
    if(!['read','create','join','shot','leave','rematch'].includes(action))fail(400,'Unknown room action.');
    if(action==='create'||action==='join')if(!await store.limit(`${ip}:${action}`,action==='create'?12:60,3600))fail(429,'Too many room requests. Please try again later.');
    if(action==='create'){
      for(let attempt=0;attempt<4;attempt++){
        const room:RoomRecord={code:roomCode(),revision:1,tokens:[digest,null],closed:false,match:initialMatch(),replay:null,availableAt:0,rematchVotes:[],expiresAt:Date.now()+86400000};
        if(await store.create(room))return json(await view(store,room,0));
      }
      fail(503,'Could not create a table. Please try again.');
    }
    const code=String(action==='read'?url.searchParams.get('code'):body.code).toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))fail(400,'Enter the 8-character room code.');
    const room=await store.get(code);if(!room)fail(404,'This room expired or does not exist. Ask your friend for a new link.');
    const current=room!;let seat=current.tokens.indexOf(digest);
    if(action==='join'){
      if(seat>=0)return json(await view(store,current,seat));
      if(current.closed)fail(410,'This table is closed. Create a new room.');
      if(current.tokens[1])fail(409,'This table already has two players.');
      current.tokens[1]=digest;seat=1;
    }else{
      if(seat<0)fail(403,'This session does not belong to the room.');
      if(action==='read')return json(await view(store,current,seat));
      if(current.closed)fail(410,'This table is closed.');
      if(action==='shot'){
        if(current.replay&&current.replay.id===body.requestId&&current.replay.actor===seat)return json(await view(store,current,seat));
        if(!current.tokens[1])fail(409,'Wait for your friend to join.');
        if(current.match.player!==seat)fail(403,'It is your opponent’s turn.');
        if(current.match.winner!==null)fail(409,'This match is finished.');
        if(current.availableAt>Date.now())fail(409,'Wait for the balls to settle.');
        if(!Number.isInteger(body.revision)||body.revision!==current.revision)fail(409,'The table changed. Reconnecting to the latest shot.');
        if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId))fail(400,'Invalid shot identifier.');
        let result;
        try{result=simulateShot(current.match,validateCommand(body.command));}catch(e){fail(400,(e as Error).message);}
        current.replay={id:body.requestId,actor:seat,before:result!.before,command:validateCommand(body.command),startsAt:Date.now()+250,duration:result!.duration};
        current.availableAt=current.replay.startsAt+current.replay.duration;current.match=result!.match;current.rematchVotes=[];
      }else if(action==='leave'){current.closed=true;}
      else if(action==='rematch'){
        if(current.match.winner===null||current.availableAt>Date.now())fail(409,'Finish this match before requesting a rematch.');
        if(!current.rematchVotes.includes(seat))current.rematchVotes.push(seat);
        if(current.rematchVotes.length===2){current.match=initialMatch();current.replay=null;current.availableAt=0;current.rematchVotes=[];}
      }
    }
    const revision=current.revision;current.revision++;current.expiresAt=Date.now()+86400000;
    if(!await store.save(code,revision,current))fail(409,'The table changed. Please try again.');
    return json(await view(store,current,seat));
  }catch(error){return json({error:error instanceof RequestError?error.message:'Room connection interrupted. Retrying will restore the table.'},error instanceof RequestError?error.status:503);}
};}
async function view(store:RoomStore,room:RoomRecord,seat:number):Promise<RoomView>{
  const now=Date.now();return {code:room.code,revision:room.revision,seat,ready:!!room.tokens[1],closed:room.closed,match:room.match,replay:room.replay,availableAt:room.availableAt,serverNow:now,opponentOnline:await store.presence(room.code,seat,now),rematchVotes:room.rematchVotes,expiresAt:room.expiresAt};
}
