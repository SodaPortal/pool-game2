<script lang="ts">
  import {normalizeSpin, type CueSpin} from './physics';
  let {value=$bindable<CueSpin>({side:0,top:0}),disabled=false}:{value?:CueSpin;disabled?:boolean}=$props();
  let pointer:number|null=null;
  const sideText=$derived(Math.abs(value.side)<.01?'No side spin':`${Math.round(Math.abs(value.side)*100)}% ${value.side<0?'left':'right'}`);
  const topText=$derived(Math.abs(value.top)<.01?'No draw or follow':`${Math.round(Math.abs(value.top)*100)}% ${value.top<0?'draw':'follow'}`);
  const centered=$derived(Math.hypot(value.side,value.top)<.01);
  function set(side:number,top:number){if(!disabled)value=normalizeSpin({side,top});}
  function position(event:PointerEvent){
    const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();
    let side=(event.clientX-rect.left-rect.width/2)/(rect.width*.36);
    let top=-(event.clientY-rect.top-rect.height/2)/(rect.height*.36);
    if(Math.hypot(side,top)<.08)side=top=0;
    set(side,top);
  }
  function down(event:PointerEvent){if(disabled||event.button!==0)return;pointer=event.pointerId;(event.currentTarget as HTMLElement).setPointerCapture(pointer);position(event);}
  function up(event:PointerEvent){if(pointer!==event.pointerId)return;pointer=null;const node=event.currentTarget as HTMLElement;if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);}
  function key(event:KeyboardEvent){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home',' '].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const step=event.shiftKey?.02:.1;
    if(event.key==='ArrowLeft')set(value.side-step,value.top);
    if(event.key==='ArrowRight')set(value.side+step,value.top);
    if(event.key==='ArrowUp')set(value.side,value.top+step);
    if(event.key==='ArrowDown')set(value.side,value.top-step);
    if(event.key==='Home'||event.key===' ')set(0,0);
  }
</script>

<section class="spin-control" aria-label="Cue spin">
  <div class="spin-intro"><span class="card-kicker">CUE SPIN</span><strong>{centered?'Center ball':'Shape your next shot.'}</strong><span>Top to follow. Bottom to draw.<br/> Sides change the cushion rebound.</span></div>
  <div class="spin-target-wrap"><span class="spin-direction follow">FOLLOW</span><span class="spin-direction draw">DRAW</span><button type="button" class="spin-target" aria-label={`Cue ball spin: ${sideText}, ${topText}. Use arrow keys to adjust; Home to center.`} {disabled} onpointerdown={down} onpointermove={(e)=>{if(pointer===e.pointerId)position(e);}} onpointerup={up} onpointercancel={up} onkeydown={key}><span class="spin-cross horizontal"></span><span class="spin-cross vertical"></span><span class="spin-ring"></span><span class="spin-dot" style={`left:${50+value.side*36}%;top:${50-value.top*36}%`}></span></button></div>
  <div class="spin-sliders">
    <label for="side-spin"><span>Left / right</span><output>{Math.abs(value.side)<.01?'Center':`${Math.round(Math.abs(value.side)*100)}% ${value.side<0?'L':'R'}`}</output></label>
    <input id="side-spin" aria-label="Side spin" aria-valuetext={sideText} type="range" min="-100" max="100" step="1" value={Math.round(value.side*100)} oninput={(e)=>set(Number(e.currentTarget.value)/100,value.top)} {disabled}/>
    <label for="top-spin"><span>Draw / follow</span><output>{Math.abs(value.top)<.01?'Center':`${Math.round(Math.abs(value.top)*100)}% ${value.top<0?'draw':'follow'}`}</output></label>
    <input id="top-spin" aria-label="Draw or follow spin" aria-valuetext={topText} type="range" min="-100" max="100" step="1" value={Math.round(value.top*100)} oninput={(e)=>set(value.side,Number(e.currentTarget.value)/100)} {disabled}/>
  </div>
  <div class="spin-reset"><button type="button" disabled={disabled||centered} onclick={()=>set(0,0)}>Reset spin</button><span>Resets after each shot.<br/>Aim guide shows first contact.</span></div>
</section>
