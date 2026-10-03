import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Physics,normalizeSpin,type CueSpin} from '../src/physics';

function headOn(spin:CueSpin){
  const p=new Physics();p.balls=p.balls.slice(0,2);
  Object.assign(p.balls[1],{x:380,y:310});p.shoot(0,500,spin);
  for(let i=0;i<120;i++)p.step(1/240);
  return p;
}
test('follow carries the cue forward and draw brings it back after contact',()=>{
  const follow=headOn({side:0,top:1}),draw=headOn({side:0,top:-1}),center=headOn({side:0,top:0});
  for(const p of [follow,draw,center])assert.equal(p.shot.first,1);
  assert.ok(follow.balls[0].x>center.balls[0].x+30);
  assert.ok(draw.balls[0].x<center.balls[0].x-30);
  assert.ok(follow.balls[0].vx>50);assert.ok(draw.balls[0].vx<-50);
});

test('opposite side spins change cushion rebound in opposite directions',()=>{
  function bounce(side:number){const p=new Physics();p.balls=p.balls.slice(0,1);Object.assign(p.balls[0],{x:980,y:310});p.shoot(0,400,{side,top:0});for(let i=0;i<80;i++)p.step(1/240);return p.balls[0];}
  const left=bounce(-1),right=bounce(1),center=bounce(0);
  assert.ok(left.vx<0&&right.vx<0&&center.vx<0);
  assert.ok(left.y<300);assert.ok(right.y>320);assert.equal(center.y,310);
  assert.ok(Math.abs(left.y+right.y-620)<.001);
});

test('side spin transfers along the tangent of a horizontal cushion',()=>{
  const p=new Physics();p.balls=p.balls.slice(0,1);Object.assign(p.balls[0],{x:400,y:125});p.shoot(-Math.PI/2,400,{side:1,top:0});
  for(let i=0;i<80;i++)p.step(1/240);
  assert.ok(p.balls[0].vy>0);assert.ok(p.balls[0].vx>20);
});

test('neutral spin preserves the original shot and computer simulation behavior',()=>{
  const a=new Physics(),b=new Physics();a.shoot(.07,800);b.shoot(.07,800,{side:0,top:0});
  for(let i=0;i<240*12;i++){a.step(1/240);b.step(1/240);}
  assert.deepEqual(a.balls,b.balls);assert.deepEqual(a.shot,b.shot);
});

test('combined spin is limited to the cue target circle and invalid values are safe',()=>{
  assert.ok(Math.abs(Math.hypot(...Object.values(normalizeSpin({side:1,top:1})))-1)<1e-12);
  assert.deepEqual(normalizeSpin({side:Infinity,top:NaN}),{side:0,top:0});
});

test('maximum spin breaks settle without stuck turns or invalid positions',()=>{
  for(const spin of [{side:1,top:1},{side:-1,top:-1},{side:0,top:-1},{side:0,top:1}]){
    const p=new Physics();p.shoot(0,1200,spin);
    for(let i=0;i<240*25;i++)p.step(1/240);
    assert.equal(p.moving,false);
    assert.ok(p.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
  }
});

test('scratching, placing and reracking clear the previous spin',()=>{
  const p=new Physics();p.balls=p.balls.slice(0,1);Object.assign(p.balls[0],{x:550,y:95});p.shoot(-Math.PI/2,500,{side:1,top:-1});
  for(let i=0;i<120;i++)p.step(1/240);assert.equal(p.balls[0].sunk,true);assert.equal(p.moving,false);
  assert.equal(p.place(310,310),true);p.step(1/240);assert.equal(p.moving,false);
  p.rack();const fresh=new Physics();p.shoot(0,650);fresh.shoot(0,650);
  for(let i=0;i<240*12;i++){p.step(1/240);fresh.step(1/240);}
  assert.deepEqual(p.balls,fresh.balls);
});
