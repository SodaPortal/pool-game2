import type { Shot, Ball } from './physics';
export type Group='solids'|'stripes';
export const inGroup=(id:number,group:Group)=>group==='solids'?id>0&&id<8:id>8;
export interface Ruling { foul:string|null; keepTurn:boolean; assigned:Group|null; winner:'shooter'|'opponent'|null }
// Club rules: open table after break; no called pockets; an eight on the break is re-spotted.
export function evaluate(shot:Shot,balls:Ball[],group:Group|null,isBreak:boolean):Ruling{
  const remainingBefore=group?balls.filter(b=>inGroup(b.id,group)&&(!b.sunk||shot.sunk.includes(b.id))).length:7;
  let foul:string|null=null;
  if(shot.sunk.includes(0))foul='Cue ball scratched';
  else if(shot.first===null)foul='No ball contacted';
  else if(!isBreak&&group&&(remainingBefore>0?!inGroup(shot.first,group):shot.first!==8))foul='Wrong ball contacted first';
  else if(!isBreak&&!group&&shot.first===8)foul='Eight ball contacted first';
  else if(!shot.rail&&!shot.sunk.some(id=>id>0))foul='No cushion reached after contact';
  if(!isBreak&&shot.sunk.includes(8))return {foul,keepTurn:false,assigned:null,winner:!foul&&group&&remainingBefore===0?'shooter':'opponent'};
  const first=shot.sunk.find(id=>id>0&&id!==8);
  const assigned=!group&&!isBreak&&!foul&&first!==undefined?(first<8?'solids':'stripes'):null;
  const effective=group??assigned;
  const keepTurn=!foul&&shot.sunk.some(id=>id>0&&id!==8&&(!effective||inGroup(id,effective)));
  return {foul,keepTurn,assigned,winner:null};
}
