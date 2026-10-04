import type {MatchState, ShotReplay, PlacementPreview} from '../src/online-match.js';

export interface RoomRecord {
  code:string; revision:number; tokens:(string|null)[]; closed:boolean;
  match:MatchState; replay:ShotReplay|null; availableAt:number; expiresAt:number; rematchVotes:number[];
}
export interface RoomStore {
  get(code:string):Promise<RoomRecord|null>;
  create(room:RoomRecord):Promise<boolean>;
  save(code:string,revision:number,room:RoomRecord):Promise<boolean>;
  presence(code:string,seat:number,now:number):Promise<boolean>;
  limit(key:string,count:number,seconds:number):Promise<boolean>;
  preview(code:string,revision:number,value?:PlacementPreview):Promise<PlacementPreview|null>;
}
const TTL=86400;
export class RedisRoomStore implements RoomStore {
  constructor(private url:string,private token:string){}
  private async command(args:(string|number)[]):Promise<any>{
    const response=await fetch(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    const data=await response.json();
    if(!response.ok||data.error)throw new Error('Room service is temporarily unavailable.');
    return data.result;
  }
  async get(code:string){const raw=await this.command(['GET',`pool:room:${code}`]);return raw?JSON.parse(raw) as RoomRecord:null;}
  async preview(code:string,revision:number,value?:PlacementPreview):Promise<PlacementPreview|null>{
    const key=`pool:placement:${code}:${revision}`;
    if(value){
      const script="local old=redis.call('GET',KEYS[1]); if not old or cjson.decode(old).sequence<tonumber(ARGV[1]) then redis.call('SET',KEYS[1],ARGV[2],'EX',3600) end; return 1";
      await this.command(['EVAL',script,1,key,value.sequence,JSON.stringify(value)]);return value;
    }
    const raw=await this.command(['GET',key]);return raw?JSON.parse(raw):null;
  }
  async create(room:RoomRecord){return await this.command(['SET',`pool:room:${room.code}`,JSON.stringify(room),'EX',TTL,'NX'])==='OK';}
  async save(code:string,revision:number,room:RoomRecord){
    const script="local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; if cjson.decode(raw).revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1";
    return await this.command(['EVAL',script,1,`pool:room:${code}`,revision,JSON.stringify(room),TTL])===1;
  }
  async presence(code:string,seat:number,now:number){
    const script="redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); redis.call('EXPIRE',KEYS[1],60); return redis.call('HGET',KEYS[1],ARGV[2])";
    const other=await this.command(['EVAL',script,1,`pool:presence:${code}`,seat,1-seat,now]);
    return !!other&&now-Number(other)<20000;
  }
  async limit(key:string,count:number,seconds:number){
    const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
    return await this.command(['EVAL',script,1,`pool:limit:${key}`,seconds])<=count;
  }
}

/** Explicitly injected only by the local Vite server and tests. Never a production fallback. */
export class MemoryRoomStore implements RoomStore {
  private rooms=new Map<string,RoomRecord>();
  private seen=new Map<string,number>();
  private counts=new Map<string,{value:number;until:number}>();
  private previews=new Map<string,{value:PlacementPreview;until:number}>();
  async preview(code:string,revision:number,value?:PlacementPreview){
    const key=`${code}:${revision}`,old=this.previews.get(key);
    if(value&&(!old||old.until<Date.now()||old.value.sequence<value.sequence))this.previews.set(key,{value:structuredClone(value),until:Date.now()+3600000});
    const current=this.previews.get(key);return current&&current.until>Date.now()?structuredClone(current.value):null;
  }
  async get(code:string){const room=this.rooms.get(code);return room&&room.expiresAt>Date.now()?structuredClone(room):null;}
  async create(room:RoomRecord){if(await this.get(room.code))return false;this.rooms.set(room.code,structuredClone(room));return true;}
  async save(code:string,revision:number,room:RoomRecord){const old=this.rooms.get(code);if(!old||old.revision!==revision)return false;this.rooms.set(code,structuredClone(room));return true;}
  async presence(code:string,seat:number,now:number){this.seen.set(`${code}:${seat}`,now);return now-(this.seen.get(`${code}:${1-seat}`)??0)<20000;}
  async limit(key:string,count:number,seconds:number){let item=this.counts.get(key);if(!item||item.until<Date.now()){item={value:0,until:Date.now()+seconds*1000};this.counts.set(key,item);}return ++item.value<=count;}
}
