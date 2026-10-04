import { Physics, R, pockets, colors, bounds } from './physics';
import type {PlacementPreview,AimPreview} from './online-match';
export interface View {angle:number;power:number;aim:boolean;dragging:boolean;guide:boolean;placement:boolean;theme:string;cuePreview?:PlacementPreview|null;opponentAim?:AimPreview|null;mobile?:boolean;portrait?:boolean;}
const phoneColors=['#fffdf0','#ffd146','#4b9eea','#ef6556','#b483ee','#ffae4f','#59c987','#de5b85','#17191d'];
export function draw(ctx:CanvasRenderingContext2D, physics:Physics, v:View){
  const c=ctx; c.clearRect(0,0,1100,620);
  function rect(x:number,y:number,w:number,h:number,r:number,fill:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
  c.shadowColor='#0009';c.shadowBlur=30;c.shadowOffsetY=15;rect(19,19,1062,582,47,'#141a19');c.shadowBlur=0;c.shadowOffsetY=0;
  const wood=c.createLinearGradient(0,20,0,600);wood.addColorStop(0,'#48514a');wood.addColorStop(.08,'#282f2b');wood.addColorStop(.9,'#202924');wood.addColorStop(1,'#3a423c');
  c.beginPath();c.roundRect(23,23,1054,574,43);c.fillStyle=wood;c.fill();c.strokeStyle='#74806a55';c.lineWidth=1;c.stroke();
  rect(45,45,1010,530,28,'#0b2421');
  const blue=v.theme==='blue';const felt=c.createRadialGradient(530,230,20,550,310,620);felt.addColorStop(0,blue?'#286977':'#287e67');felt.addColorStop(1,blue?'#16414e':'#164c40');
  c.fillStyle=felt;c.fillRect(70,70,960,480);
  // Deterministic fine weave, drawn in table coordinates.
  c.fillStyle='#ffffff06';for(let y=73;y<550;y+=5)for(let x=73;x<1030;x+=7)c.fillRect(x+(y%3),y,1,1);
  c.strokeStyle='#d8f5da10';c.lineWidth=1;c.beginPath();c.moveTo(310,84);c.lineTo(310,536);c.stroke();
  c.beginPath();c.arc(310,310,76,Math.PI/2,Math.PI*1.5);c.stroke();
  for(const x of [310,748]){c.fillStyle='#e3f3dc55';c.beginPath();c.arc(x,310,2,0,Math.PI*2);c.fill();}
  c.fillStyle=blue?'#205766':'#1b6752';
  for(const [x,y,w,h] of [[92,52,431,18],[577,52,431,18],[92,550,431,18],[577,550,431,18],[52,92,18,436],[1030,92,18,436]]){c.fillRect(x,y,w,h);}
  c.strokeStyle='#8bd1a72b';c.beginPath();c.moveTo(98,71);c.lineTo(519,71);c.moveTo(581,71);c.lineTo(1002,71);c.moveTo(71,98);c.lineTo(71,522);c.stroke();
  for(const p of pockets){c.shadowColor='#000';c.shadowBlur=10;c.beginPath();c.arc(p.x,p.y,25,0,Math.PI*2);c.fillStyle='#0b100f';c.fill();c.shadowBlur=0;c.strokeStyle='#87907855';c.lineWidth=3;c.stroke();c.beginPath();c.arc(p.x,p.y+3,18,0,Math.PI*2);c.fillStyle='#040807';c.fill();}
  c.fillStyle='#afba9380';for(const x of [190,310,430,670,790,910])for(const y of [36,584]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillRect(-2,-2,4,4);c.restore();}for(const x of [36,1064])for(const y of [190,310,430]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillRect(-2,-2,4,4);c.restore();}
  c.save();c.translate(550,438);c.fillStyle='#b8ddc31a';c.textAlign='center';c.font='500 12px sans-serif';c.letterSpacing='5px';c.fillText('AFTER HOURS',0,0);c.letterSpacing='2px';c.font='9px sans-serif';c.fillText('THE POOL CLUB',0,18);c.restore();
  const cue=v.opponentAim?{...physics.balls[0],x:v.opponentAim.x,y:v.opponentAim.y}:physics.balls[0],ux=Math.cos(v.angle),uy=Math.sin(v.angle);
  if(v.aim&&!cue.sunk&&!v.placement){
    if(v.guide){
      let distance=1200, target:typeof cue|undefined;
      for(const b of physics.balls){if(!b.id||b.sunk)continue;const dx=b.x-cue.x,dy=b.y-cue.y,along=dx*ux+dy*uy,perp=dx*uy-dy*ux;if(along>0&&Math.abs(perp)<R*2){const t=along-Math.sqrt((R*2)**2-perp**2);if(t>=0&&t<distance){distance=t;target=b;}}}
      const wall=Math.min(ux>0?(bounds.right-R-cue.x)/ux:ux<0?(bounds.left+R-cue.x)/ux:Infinity,uy>0?(bounds.bottom-R-cue.y)/uy:uy<0?(bounds.top+R-cue.y)/uy:Infinity);
      if(wall<distance){distance=wall;target=undefined;}
      const ex=cue.x+ux*distance,ey=cue.y+uy*distance;
      c.strokeStyle='#e7f0d877';c.lineWidth=1.3;c.setLineDash([4,7]);c.beginPath();c.moveTo(cue.x+ux*18,cue.y+uy*18);c.lineTo(ex,ey);c.stroke();c.setLineDash([]);
      c.beginPath();c.arc(ex,ey,R,0,Math.PI*2);c.strokeStyle='#eef4d8aa';c.stroke();
      if(target){const a=Math.atan2(target.y-ey,target.x-ex);c.beginPath();c.moveTo(target.x,target.y);c.lineTo(target.x+Math.cos(a)*65,target.y+Math.sin(a)*65);c.stroke();}
    }
    c.save();c.translate(cue.x,cue.y);c.rotate(v.angle);const pull=22+(v.dragging?v.power*1.05:8);const g=c.createLinearGradient(-pull-270,0,-pull,0);g.addColorStop(0,'#4b3024');g.addColorStop(.36,'#97654a');g.addColorStop(.38,'#222b26');g.addColorStop(.43,'#ddd3a6');g.addColorStop(1,'#e5d0a0');c.fillStyle=g;c.beginPath();c.moveTo(-pull,-2);c.lineTo(-pull-270,-5);c.lineTo(-pull-270,5);c.lineTo(-pull,2);c.closePath();c.fill();c.fillStyle='#82c8c0';c.fillRect(-pull,-2,4,4);c.restore();
  }
  for(const ball of physics.balls){const b=ball.id===0&&v.cuePreview?{...ball,...v.cuePreview,sunk:false}:ball;if(b.sunk)continue;
    c.save();c.translate(b.x,b.y);c.shadowColor='#001b18aa';c.shadowBlur=5;c.shadowOffsetY=4;
    const palette=v.mobile?phoneColors:colors;
    c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.fillStyle=b.id>8?(v.mobile?'#ffffff':'#eeeada'):palette[b.id];c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
    if(b.id>8){c.save();c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.clip();if(!v.mobile)c.rotate(Math.sin(b.rotation*.25)*.6);c.fillStyle=palette[b.id-8];c.fillRect(-R,-6.5,R*2,13);c.restore();}
    if(!v.mobile){const shine=c.createRadialGradient(-4,-5,0,2,3,15);shine.addColorStop(0,'#ffffff70');shine.addColorStop(.45,'#ffffff00');shine.addColorStop(1,'#00000085');c.fillStyle=shine;c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.fill();}
    else{c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.strokeStyle='#f8ffe5';c.lineWidth=1.2;c.stroke();}
    if(b.id){c.beginPath();c.arc(0,0,v.mobile?6.8:5,0,Math.PI*2);c.fillStyle=v.mobile?'#ffffff':'#fff9e8';c.fill();c.fillStyle='#111a14';c.font=v.mobile?'bold 10px Arial':'bold 7px Arial';c.textAlign='center';c.textBaseline='middle';c.save();if(v.portrait)c.rotate(Math.PI/2);c.fillText(String(b.id),0,.6);c.restore();}
    if(!v.mobile){c.beginPath();c.ellipse(-3.5,-5,2.8,1.5,-.5,0,Math.PI*2);c.fillStyle='#ffffff80';c.fill();}c.restore();
  }
  if(v.placement){c.strokeStyle='#e5e8aa';c.setLineDash([3,4]);c.beginPath();c.arc(cue.x,cue.y,19,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  if(v.cuePreview){
    const p=v.cuePreview;c.save();c.strokeStyle='#baf8e6';c.lineWidth=2;c.setLineDash(p.confirmed?[]:[4,5]);c.beginPath();c.arc(p.x,p.y,20,0,Math.PI*2);c.stroke();
    c.fillStyle='#e3fff5';c.font='600 12px sans-serif';c.textAlign='center';c.fillText(p.confirmed?'OPPONENT PLACED':'OPPONENT PLACING',Math.max(152,Math.min(948,p.x)),p.y<115?p.y+40:p.y-30);c.restore();
  }
}
