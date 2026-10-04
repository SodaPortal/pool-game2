import { Physics, bounds, pockets, R, type Ball, type CueSpin } from './physics.js';
import { evaluate, type Group } from './rules.js';

export interface MatchState {
  balls: Ball[];
  shots: number;
  player: number;
  groups: (Group|null)[];
  winner: number|null;
  placement: boolean;
  message: string;
}
export interface ShotCommand { angle:number; power:number; spin:CueSpin; position?:{x:number;y:number} }
export interface ShotReplay { id:string; actor:number; before:Ball[]; command:ShotCommand; startsAt:number; duration:number }
export interface PlacementPreview {x:number;y:number;confirmed:boolean;sequence:number}
export interface RoomView {
  code:string; revision:number; seat:number; ready:boolean; closed:boolean;
  match:MatchState; replay:ShotReplay|null; availableAt:number; serverNow:number;
  opponentOnline:boolean; rematchVotes:number[]; expiresAt:number;
  placementPreview?:PlacementPreview|null;
}
export function validatePlacement(balls:Ball[],value:unknown):{x:number;y:number}{
  const at=value as {x:number;y:number};
  if(!at||!Number.isFinite(at.x)||!Number.isFinite(at.y)||at.x<bounds.left+R||at.x>bounds.right-R||at.y<bounds.top+R||at.y>bounds.bottom-R||
    pockets.some(h=>Math.hypot(at.x-h.x,at.y-h.y)<24)||balls.some(b=>b.id&&!b.sunk&&Math.hypot(b.x-at.x,b.y-at.y)<R*2+1))
    throw new Error('Place the cue ball on clear felt, away from a pocket.');
  return {x:at.x,y:at.y};
}
export function initialMatch():MatchState {
  return {balls:new Physics().balls,shots:0,player:0,groups:[null,null],winner:null,placement:false,message:'Player 1 to break. The table is open.'};
}
export function validateCommand(value:unknown):ShotCommand {
  const c=value as ShotCommand;
  if(!c||!Number.isFinite(c.angle)||Math.abs(c.angle)>Math.PI*100||!Number.isFinite(c.power)||c.power<0||c.power>100||
    !c.spin||!Number.isFinite(c.spin.side)||!Number.isFinite(c.spin.top)||Math.hypot(c.spin.side,c.spin.top)>1.001)
    throw new Error('Invalid shot. Check your aim, power, and spin.');
  if(c.position&&(!Number.isFinite(c.position.x)||!Number.isFinite(c.position.y)))throw new Error('Invalid cue-ball position.');
  return {angle:c.angle,power:c.power,spin:{side:c.spin.side,top:c.spin.top},...(c.position?{position:{x:c.position.x,y:c.position.y}}:{})};
}
export function simulateShot(state:MatchState,command:ShotCommand) {
  if(state.winner!==null)throw new Error('This match is finished.');
  const input=validateCommand(command),p=new Physics();p.balls=structuredClone(state.balls);
  if(state.placement){
    const at=validatePlacement(p.balls,input.position);p.place(at.x,at.y);
  }else if(input.position)throw new Error('You do not have ball in hand.');
  const before=structuredClone(p.balls);
  p.shoot(input.angle,Math.max(80,input.power*12),input.spin);
  let steps=0;
  while(p.moving&&steps<240*30){p.step(1/240);steps++;}
  if(p.moving)throw new Error('The shot could not settle. Please try again.');
  const result=evaluate(p.shot,p.balls,state.groups[state.player],state.shots===0);
  const next:MatchState={...state,balls:p.balls,groups:[...state.groups],shots:state.shots+1,placement:false};
  if(result.winner){next.winner=result.winner==='shooter'?state.player:1-state.player;next.message=result.winner==='shooter'?'Eight ball down. Beautifully finished.':'The eight dropped early or on a foul.';}
  else{
    if(state.shots===0&&p.shot.sunk.includes(8)){
      const eight=p.balls.find(b=>b.id===8)!;
      for(let x=748;x>=100;x-=24)if(!p.balls.some(b=>b.id!==8&&!b.sunk&&Math.hypot(b.x-x,b.y-310)<23)){Object.assign(eight,{x,y:310,sunk:false});break;}
    }
    if(result.assigned){next.groups[state.player]=result.assigned;next.groups[1-state.player]=result.assigned==='solids'?'stripes':'solids';}
    if(!result.keepTurn)next.player=1-state.player;
    if(result.foul){
      next.placement=true;
      outer:for(let y=310;y<530;y+=25)for(let x=310;x<1000;x+=25)if(p.place(x,y))break outer;
      next.message=`${result.foul}. Player ${next.player+1}: place the cue ball.`;
    }else next.message=`Player ${next.player+1}, your shot. ${next.groups[next.player]?`Playing ${next.groups[next.player]}.`:'The table is open.'}`;
  }
  return {match:next,before,duration:steps*1000/240};
}
