import type {RoomView,ShotCommand} from './online-match';

export class RoomError extends Error {constructor(message:string,public status:number){super(message);}}
export class RoomClient {
  room:RoomView|null=null;
  offset=0;
  private token='';
  private timer:ReturnType<typeof setTimeout>|undefined;
  private stopped=false;
  private failures=0;
  private controller=new AbortController();
  constructor(private update:(room:RoomView)=>void,private connection:(connected:boolean)=>void,private error:(message:string)=>void){}
  private async request(body?:Record<string,unknown>):Promise<RoomView>{
    const response=await fetch(`/api/room${body?'':`?code=${this.room!.code}`}`,{
      method:body?'POST':'GET',headers:{Authorization:`Bearer ${this.token}`,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(12000)]),cache:'no-store'
    });
    const data=await response.json();
    if(!response.ok)throw new RoomError(data.error??'The room could not be reached.',response.status);
    return data as RoomView;
  }
  private accept(room:RoomView){
    if(this.stopped||this.room&&room.revision<this.room.revision)return;
    this.offset=room.serverNow-Date.now();this.room=room;this.failures=0;this.connection(true);this.update(room);
  }
  async enter(code?:string){
    if(code){try{this.token=localStorage.getItem(`pool-seat:${code}`)??'';}catch{}}
    this.token||=crypto.randomUUID();
    if(code){try{localStorage.setItem(`pool-seat:${code}`,this.token);}catch{}}
    const room=await this.request(code?{action:'join',code}:{action:'create'});
    if(this.stopped)return;
    try{localStorage.setItem(`pool-seat:${room.code}`,this.token);}catch{}
    this.accept(room);this.schedule();
  }
  private schedule(){
    if(this.stopped||this.room?.closed)return;
    const delay=this.failures?Math.min(10000,1000*2**this.failures):document.hidden?10000:!this.room?.ready?2000:this.room.match.player===this.room.seat?1600:800;
    this.timer=setTimeout(()=>void this.poll(),delay);
  }
  async poll(){
    clearTimeout(this.timer);if(this.stopped||!this.room)return;
    try{this.accept(await this.request());}
    catch(e){if(this.stopped)return;this.failures++;this.connection(false);if(e instanceof RoomError&&[401,403,404,410].includes(e.status)){this.error(e.message);return;}}
    this.schedule();
  }
  async shot(command:ShotCommand){
    if(!this.room)throw new Error('Join a room first.');
    const body={action:'shot',code:this.room.code,revision:this.room.revision,requestId:crypto.randomUUID(),command};
    try{this.accept(await this.request(body));}
    catch(e){
      // Only retry an uncertain transport failure, using the same idempotency key.
      if(!(e instanceof RoomError))this.accept(await this.request(body));
      else{await this.poll();throw e;}
    }
  }
  async rematch(){if(this.room)this.accept(await this.request({action:'rematch',code:this.room.code}));}
  leave(){
    if(this.room&&!this.room.closed)void fetch('/api/room',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'leave',code:this.room.code}),keepalive:true}).catch(()=>{});
    this.stop();
  }
  stop(){this.stopped=true;clearTimeout(this.timer);this.controller.abort();}
}
