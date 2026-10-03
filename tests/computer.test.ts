import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseComputerShot, difficultyLevels, isDifficulty } from '../src/computer';
import { Physics, type Ball } from '../src/physics';
import { evaluate } from '../src/rules';

const ball = (id:number,x:number,y:number):Ball => ({ id,x,y,vx:0,vy:0,sunk:false,rotation:0 });
function play(balls:Ball[],plan:ReturnType<typeof chooseComputerShot>){
  const p=new Physics();p.balls=balls.map(b=>({...b}));
  assert.equal(p.place(plan.position.x,plan.position.y),true);
  p.shoot(plan.angle,plan.power*12);
  for(let step=0;step<240*14&&p.moving;step++)p.step(1/240);
  assert.equal(p.moving,false);return p;
}

test('computer pots a clear shot without mutating the live table',()=>{
  const balls=[ball(0,550,400),ball(1,550,220),ball(8,900,400)];
  const before=structuredClone(balls),plan=chooseComputerShot(balls,'solids');
  assert.deepEqual(balls,before);assert.equal(plan.target,1);
  const result=play(balls,plan);assert.ok(result.shot.sunk.includes(1));
  assert.equal(evaluate(result.shot,result.balls,'solids',false).keepTurn,true);
});

test('computer targets its assigned group, not an easier opposing ball',()=>{
  const balls=[ball(0,550,400),ball(1,550,220),ball(9,760,280),ball(8,950,400)];
  const plan=chooseComputerShot(balls,'stripes');assert.equal(plan.target,9);
  const result=play(balls,plan);assert.equal(result.shot.first,9);
  assert.equal(evaluate(result.shot,result.balls,'stripes',false).foul,null);
});

test('computer plays the eight only when its group is cleared',()=>{
  const balls=[ball(0,550,400),ball(8,550,220)];
  const plan=chooseComputerShot(balls,'solids');assert.equal(plan.target,8);
  const result=play(balls,plan);assert.equal(evaluate(result.shot,result.balls,'solids',false).winner,'shooter');
});

test('computer finds a legal ball-in-hand position and pots from it',()=>{
  const balls=[{...ball(0,550,220),sunk:true},ball(1,550,220),ball(8,900,400)];
  const plan=chooseComputerShot(balls,'solids',true);
  const result=play(balls,plan);assert.ok(result.shot.sunk.includes(1));
  assert.equal(evaluate(result.shot,result.balls,'solids',false).foul,null);
});

test('computer can play a crowded rack after a missed break',()=>{
  const balls=new Physics().balls;
  const plan=chooseComputerShot(balls,null,true);
  assert.ok(Number.isFinite(plan.angle));assert.ok(plan.power>=5&&plan.power<=100);
  const result=play(balls,plan);
  assert.equal(evaluate(result.shot,result.balls,null,false).foul,null);
  assert.notEqual(evaluate(result.shot,result.balls,null,false).winner,'opponent');
});

test('difficulty produces distinct potting accuracy on the same long shot',()=>{
  const balls=[ball(0,550,480),ball(1,550,200),ball(8,900,400)];
  const pots:Record<string,number>={easy:0,medium:0,hard:0};
  for(const level of difficultyLevels)for(let sample=0;sample<15;sample++){
    const plan=chooseComputerShot(balls,'solids',false,level,()=>(sample+.5)/15);
    assert.equal(plan.target,1);
    assert.ok(plan.power>=5&&plan.power<=100);
    const result=play(balls,plan);
    if(result.shot.sunk.includes(1)&&!result.shot.sunk.includes(0))pots[level]++;
  }
  assert.ok(pots.hard>pots.medium&&pots.medium>pots.easy,JSON.stringify(pots));
});

test('every difficulty preserves legal placement and assigned targets',()=>{
  const balls=[{...ball(0,550,220),sunk:true},ball(1,550,220),ball(9,760,280),ball(8,950,400)];
  const original=structuredClone(balls);
  for(const level of difficultyLevels){
    const plan=chooseComputerShot(balls,'stripes',true,level,()=>1);
    assert.equal(plan.target,9);assert.ok(Number.isFinite(plan.angle));
    assert.ok(plan.power>=5&&plan.power<=100);
    const p=new Physics();p.balls=structuredClone(balls);
    assert.equal(p.place(plan.position.x,plan.position.y),true);
  }
  assert.deepEqual(balls,original);
});

test('hard is deterministic and saved difficulty validation rejects unknown values',()=>{
  const balls=[ball(0,550,400),ball(1,550,220),ball(8,900,400)];
  assert.deepEqual(chooseComputerShot(balls,'solids',false,'hard',()=>0),chooseComputerShot(balls,'solids',false,'hard',()=>1));
  for(const value of [null,undefined,'impossible','',{},'toString'])assert.equal(isDifficulty(value),false);
  for(const value of difficultyLevels)assert.equal(isDifficulty(value),true);
});
