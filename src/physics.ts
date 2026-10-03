export const R = 11;
export const bounds = { left: 70, right: 1030, top: 70, bottom: 550 };
export const pockets = [{x:72,y:72},{x:550,y:61},{x:1028,y:72},{x:72,y:548},{x:550,y:559},{x:1028,y:548}];
export const colors = ['#f6f2df','#edb937','#3272b6','#d75242','#9863c0','#e88632','#258775','#962e43','#171c20'];
export interface Ball { id:number; x:number; y:number; vx:number; vy:number; sunk:boolean; rotation:number }
export interface Shot { sunk:number[]; first:number|null; rail:boolean }
export class Physics {
  balls:Ball[]=[];
  shot:Shot={sunk:[],first:null,rail:false};
  onHit: (strength:number)=>void = ()=>{};
  constructor(){this.rack();}
  rack(){
    this.balls=[{id:0,x:310,y:310,vx:0,vy:0,sunk:false,rotation:0}];
    const ids=[1,9,2,10,8,3,4,11,5,12,6,13,7,14,15];
    let i=0;
    for(let row=0;row<5;row++) for(let col=0;col<=row;col++) this.balls.push({id:ids[i++],x:748+row*(R*2+.25)*Math.sqrt(3)/2,y:310+(col-row/2)*(R*2+.25),vx:0,vy:0,sunk:false,rotation:0});
  }
  get moving(){return this.balls.some(b=>!b.sunk&&(b.vx!==0||b.vy!==0));}
  shoot(angle:number,power:number){this.shot={sunk:[],first:null,rail:false};const b=this.balls[0];b.vx=Math.cos(angle)*power;b.vy=Math.sin(angle)*power;}
  place(x:number,y:number){
    x=Math.max(bounds.left+R,Math.min(bounds.right-R,x));y=Math.max(bounds.top+R,Math.min(bounds.bottom-R,y));
    if(this.balls.some(b=>b.id&&!b.sunk&&Math.hypot(b.x-x,b.y-y)<R*2+1)) return false;
    Object.assign(this.balls[0],{x,y,vx:0,vy:0,sunk:false});return true;
  }
  step(dt:number){
    const active=this.balls.filter(b=>!b.sunk);
    for(const b of active){
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.rotation+=Math.hypot(b.vx,b.vy)*dt/R;
      if(pockets.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<23)) {b.sunk=true;b.vx=b.vy=0;this.shot.sunk.push(b.id);this.onHit(0.3);continue;}
      let rail=false;
      if(b.x<bounds.left+R){b.x=bounds.left+R;b.vx=Math.abs(b.vx)*.84;rail=true;}
      if(b.x>bounds.right-R){b.x=bounds.right-R;b.vx=-Math.abs(b.vx)*.84;rail=true;}
      if(b.y<bounds.top+R){b.y=bounds.top+R;b.vy=Math.abs(b.vy)*.84;rail=true;}
      if(b.y>bounds.bottom-R){b.y=bounds.bottom-R;b.vy=-Math.abs(b.vy)*.84;rail=true;}
      if(rail){if(this.shot.first!==null)this.shot.rail=true;this.onHit(Math.hypot(b.vx,b.vy)/1200);}
      const speed=Math.hypot(b.vx,b.vy), next=Math.max(0,speed-95*dt);
      if(speed>0){b.vx*=next/speed;b.vy*=next/speed;}
      if(next<3){b.vx=b.vy=0;}
    }
    for(let i=0;i<active.length;i++) for(let j=i+1;j<active.length;j++){
      const a=active[i],b=active[j];if(a.sunk||b.sunk)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d>=R*2||d<.0001)continue;
      const nx=dx/d,ny=dy/d,overlap=(R*2-d)/2+.001;
      a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
      const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(rel<=0)continue;
      const impulse=rel*.985;
      a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
      if(this.shot.first===null&&(a.id===0||b.id===0))this.shot.first=a.id===0?b.id:a.id;
      this.onHit(Math.min(1,rel/1000));
    }
  }
}
