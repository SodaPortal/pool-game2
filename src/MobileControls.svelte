<script lang="ts">
  let {angle=$bindable(0),power=$bindable(65),disabled=false,placement=false,label='Take shot',spinActive=false,online=false,paused=false,onshoot,onspin,ononline,onpause}:{angle?:number;power?:number;disabled?:boolean;placement?:boolean;label?:string;spinActive?:boolean;online?:boolean;paused?:boolean;onshoot:()=>void;onspin:()=>void;ononline:()=>void;onpause:()=>void}=$props();
  let pointer:number|null=null,startX=0,startAngle=0;
  const degrees=$derived(((angle*180/Math.PI)%360+360)%360);
  function start(e:PointerEvent){if(disabled||placement||pointer!==null)return;pointer=e.pointerId;startX=e.clientX;startAngle=angle;e.currentTarget instanceof HTMLElement&&e.currentTarget.setPointerCapture(pointer);}
  function move(e:PointerEvent){if(pointer===e.pointerId&&!disabled&&!placement)angle=startAngle+(e.clientX-startX)*.002;}
  function stop(e:PointerEvent){if(pointer===e.pointerId){pointer=null;const node=e.currentTarget as HTMLElement;if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);}}
  function key(e:KeyboardEvent){if(disabled||placement)return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();angle+=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.001:.003);}}
</script>

<div class="mobile-controls">
  <div class="fine-aim">
    <button aria-label="Aim slightly left" disabled={disabled||placement} onclick={()=>angle-=.003}>−</button>
    <div class="aim-dial" role="slider" tabindex={disabled||placement?-1:0} aria-label="Fine aim" aria-valuemin="0" aria-valuemax="360" aria-valuenow={Math.round(degrees*10)/10} aria-valuetext={`${degrees.toFixed(1)} degrees`} aria-disabled={disabled||placement} onpointerdown={start} onpointermove={move} onpointerup={stop} onpointercancel={stop} onkeydown={key}>
      <span>{placement?'MOVE BALL ON TABLE':'FINE AIM'}<small>{placement?'Then tap Place cue ball':'Slide for precision'}</small></span><i></i>
    </div>
    <button aria-label="Aim slightly right" disabled={disabled||placement} onclick={()=>angle+=.003}>+</button>
  </div>
  <div class="mobile-shot-row">
    <div class="mobile-power"><label for="mobile-power">POWER <strong>{Math.round(power)}%</strong></label><input id="mobile-power" aria-label="Shot power" type="range" min="5" max="100" bind:value={power} disabled={disabled||placement} style={`--power:${power}%`}/></div>
    <button class="mobile-shoot" disabled={disabled} onclick={onshoot}>{placement&&!disabled?'Place cue ball':label}<span aria-hidden="true">↗</span></button>
  </div>
  <div class="mobile-tools">
    <button class:has-spin={spinActive} disabled={disabled||placement} onclick={onspin}><span aria-hidden="true">◉</span> {spinActive?'Spin set':'Cue spin'}</button>
    <button onclick={ononline}><span aria-hidden="true">◎</span> {online?'Room':'Play online'}</button>
    <button disabled={online} onclick={onpause}><span aria-hidden="true">{paused?'▶':'Ⅱ'}</span> {paused?'Resume':'Pause'}</button>
  </div>
</div>
