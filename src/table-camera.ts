export interface Camera {x:number;y:number;zoom:number}
export const fullTable:Camera={x:550,y:310,zoom:1};
export function clampCamera(camera:Camera):Camera{
  const zoom=Math.max(1,Math.min(3,camera.zoom));
  return {zoom,x:Math.max(550/zoom,Math.min(1100-550/zoom,camera.x)),y:Math.max(310/zoom,Math.min(620-310/zoom,camera.y))};
}
/** Convert normalized canvas coordinates into the same world space used by physics. */
export function tablePoint(x:number,y:number,portrait:boolean,camera:Camera){
  const base=portrait?{x:(1-y)*1100,y:x*620}:{x:x*1100,y:y*620};
  return {x:camera.x+(base.x-550)/camera.zoom,y:camera.y+(base.y-310)/camera.zoom};
}
