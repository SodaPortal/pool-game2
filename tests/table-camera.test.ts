import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampCamera,fullTable,tablePoint} from '../src/table-camera';

test('portrait and landscape touches map to the same physical aim point at full size and zoom',()=>{
  for(const camera of [fullTable,{x:530,y:310,zoom:2}]){
    const target={x:630,y:410},x=550+(target.x-camera.x)*camera.zoom,y=310+(target.y-camera.y)*camera.zoom;
    const landscape=tablePoint(x/1100,y/620,false,camera),portrait=tablePoint(y/620,1-x/1100,true,camera);
    for(const mapped of [landscape,portrait]){assert.ok(Math.abs(mapped.x-target.x)<1e-8);assert.ok(Math.abs(mapped.y-target.y)<1e-8);}
  }
});
test('panning clamps every viewport edge to the table without mutating the input',()=>{
  for(const zoom of [1,2,3])for(const x of [-10000,550,10000])for(const y of [-10000,310,10000]){
    const input={x,y,zoom},camera=clampCamera(input);
    assert.deepEqual(input,{x,y,zoom});
    assert.ok(camera.x-550/zoom>=0);assert.ok(camera.x+550/zoom<=1100);
    assert.ok(camera.y-310/zoom>=0);assert.ok(camera.y+310/zoom<=620);
  }
});
