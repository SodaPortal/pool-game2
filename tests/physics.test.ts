import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Physics, R } from '../src/physics';
import { evaluate } from '../src/rules';

test('rack contains sixteen non-overlapping balls with the eight in the center',()=>{
 const p=new Physics();assert.equal(p.balls.length,16);assert.equal(new Set(p.balls.map(b=>b.id)).size,16);
 assert.equal(p.balls.find(b=>b.id===8)!.y,310);
 for(const a of p.balls)for(const b of p.balls)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=R*2);
});
test('a head-on collision transfers momentum and records first contact',()=>{
 const p=new Physics();p.balls=p.balls.slice(0,2);Object.assign(p.balls[1],{x:360,y:310});p.shoot(0,500);
 for(let i=0;i<25;i++)p.step(1/240);
 assert.equal(p.shot.first,1);assert.ok(p.balls[1].vx>400);assert.ok(p.balls[0].vx<30);
});
test('a full-power break stays finite and settles',()=>{
 const p=new Physics();p.shoot(0,1200);
 for(let i=0;i<240*20;i++)p.step(1/240);
 assert.equal(p.moving,false);assert.equal(p.shot.first,1);
 assert.ok(p.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
 assert.ok(p.balls.filter(b=>b.id&&!b.sunk).some(b=>Math.abs(b.y-310)>80));
});
test('cushions reflect velocity and reduce its magnitude',()=>{
 const p=new Physics();p.balls=p.balls.slice(0,1);Object.assign(p.balls[0],{x:1020,y:250,vx:400});p.step(1/240);
 assert.ok(p.balls[0].vx<0);assert.ok(Math.abs(p.balls[0].vx)<400);
});
test('middle pockets capture balls exactly once',()=>{
 const p=new Physics();p.balls=p.balls.slice(0,1);Object.assign(p.balls[0],{x:550,y:85,vy:-300});
 for(let i=0;i<10;i++)p.step(1/240);
 assert.equal(p.balls[0].sunk,true);assert.deepEqual(p.shot.sunk,[0]);
});
test('ball placement rejects overlapping objects and clamps to the table',()=>{
 const p=new Physics();assert.equal(p.place(748,310),false);assert.equal(p.place(-100,300),true);assert.equal(p.balls[0].x,81);
});
test('legal pot on open table assigns a group and keeps the turn',()=>{
 const result=evaluate({sunk:[9],first:9,rail:false},new Physics().balls,null,false);
 assert.equal(result.assigned,'stripes');assert.equal(result.keepTurn,true);assert.equal(result.foul,null);
});
test('break pots do not assign a group',()=>{
 assert.equal(evaluate({sunk:[1],first:1,rail:true},new Physics().balls,null,true).assigned,null);
});
test('scratch and wrong first contact are fouls',()=>{
 assert.equal(evaluate({sunk:[0,1],first:1,rail:true},new Physics().balls,'solids',false).foul,'Cue ball scratched');
 assert.equal(evaluate({sunk:[],first:9,rail:true},new Physics().balls,'solids',false).foul,'Wrong ball contacted first');
});
test('contact must be followed by a rail or pot',()=>{
 assert.equal(evaluate({sunk:[],first:1,rail:false},new Physics().balls,'solids',false).foul,'No cushion reached after contact');
});
test('eight ball wins only after the group was cleared on a previous shot',()=>{
 const p=new Physics();for(const b of p.balls)if(b.id>0&&b.id<8)b.sunk=true;
 assert.equal(evaluate({sunk:[8],first:8,rail:false},p.balls,'solids',false).winner,'shooter');
 assert.equal(evaluate({sunk:[7,8],first:7,rail:false},p.balls,'solids',false).winner,'opponent');
 assert.equal(evaluate({sunk:[0,8],first:8,rail:false},p.balls,'solids',false).winner,'opponent');
});
