<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { Physics, colors } from './physics';
  import { draw } from './table';
  import { evaluate, inGroup, type Group } from './rules';
  import { chooseComputerShot, DIFFICULTIES, difficultyLevels, isDifficulty, type Difficulty, type ComputerShot } from './computer';
  const physics=new Physics();
  let canvas:HTMLCanvasElement;
  let mode=$state<'practice'|'versus'|'computer'>('practice');
  let difficulty=$state<Difficulty>('medium'), selectedDifficulty=$state<Difficulty>('medium');
  let modal=$state<'help'|'new'|null>(null);
  let paused=$state(false), moving=$state(false), sound=$state(true), guide=$state(true), theme=$state('green');
  let angle=$state(0), power=$state(65), dragging=$state(false), placement=$state(false);
  let shots=$state(0), sunk=$state<number[]>([]), elapsed=$state(0), player=$state(0);
  let groups=$state<(Group|null)[]>([null,null]), winner=$state<string|null>(null);
  let message=$state('The table is yours. Make your opening break.');
  let best=$state(0), fullscreen=$state(false);
  let dragStart={x:0,y:0}, dragDistance=0, frame=0, audio:AudioContext|undefined;
  let oldTime=0, accumulator=0, timer=0, shotStart=0, lastSound=0;
  let computerPlan:ComputerShot|null=null, computerDelay=0;
  const computerTurn=$derived(mode==='computer'&&player===1);
  const active=$derived(!moving&&!paused&&!modal&&!winner&&!computerTurn);
  function playerName(index:number){return mode==='computer'?(index===0?'You':'Computer'):`Player ${index+1}`;}
  const potted=$derived(sunk.filter(n=>n>0).length);
  const time=$derived(`${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}`);
  function tickSound(strength:number){
    if(!sound||!audio||strength<.04||audio.currentTime-lastSound<.016)return;
    lastSound=audio.currentTime;const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(650+strength*900,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(170,audio.currentTime+.055);
    gain.gain.setValueAtTime(Math.min(.16,strength*.17),audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.065);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.07);
  }
  function initAudio(){try{audio??=new AudioContext();void audio.resume();}catch{/* Audio is optional. */}}
  function openNewGame(){selectedDifficulty=difficulty;modal='new';}
  function newGame(next=mode,level=difficulty){
    if(next==='computer'){
      difficulty=level;selectedDifficulty=level;
      try{localStorage.setItem('after-hours-difficulty',level);}catch{}
    }
    mode=next;physics.rack();shots=0;sunk=[];elapsed=0;timer=0;moving=false;dragging=false;placement=false;paused=false;winner=null;player=0;groups=[null,null];angle=0;power=65;modal=null;accumulator=0;
    computerPlan=null;computerDelay=0;
    message=next==='practice'?'The table is yours. Make your opening break.':next==='computer'?'You break. The computer is ready when you are.':'Player 1 to break. The table is open.';
  }
  function shoot(){if(!active||placement||physics.balls[0].sunk)return;startShot();}
  function startShot(){initAudio();physics.shoot(angle,Math.max(80,power*12));tickSound(power/100);shots++;moving=true;dragging=false;accumulator=0;shotStart=performance.now();message=computerTurn?'Computer takes the shot. Let the table settle.':'A little patience. Let the table settle.';}
  function updateComputer(dt:number){
    if(mode!=='computer'||player!==1||moving)return;
    if(!computerPlan){
      computerPlan=chooseComputerShot(physics.balls,groups[1],placement,difficulty);
      if(placement){physics.place(computerPlan.position.x,computerPlan.position.y);placement=false;}
      angle=computerPlan.angle;power=Math.round(computerPlan.power*10)/10;
      message='Computer is lining up a shot…';computerDelay=0;
    }
    computerDelay+=dt;
    if(computerDelay>=1.4){startShot();computerPlan=null;computerDelay=0;}
  }
  function respotEight(){const b=physics.balls.find(b=>b.id===8)!;let x=748;while(physics.balls.some(o=>o.id!==8&&!o.sunk&&Math.hypot(o.x-x,o.y-310)<23)&&x<1000)x+=24;Object.assign(b,{sunk:false,x,y:310,vx:0,vy:0});}
  function ballInHand(){placement=true;physics.balls[0].sunk=false;for(let x=310;x<1000;x+=25)if(physics.place(x,310))break;}
  function finishShot(){
    moving=false;
    const shot=physics.shot;
    if(mode!=='practice'){
      const result=evaluate(shot,physics.balls,groups[player],shots===1);
      if(result.winner){const name=playerName(result.winner==='shooter'?player:1-player);winner=name==='You'?'You win':`${name} wins`;message=result.winner==='shooter'?'Eight ball down. Beautifully finished.':'The eight dropped early or on a foul.';}
      else{
        if(shots===1&&shot.sunk.includes(8))respotEight();
        if(result.assigned){groups[player]=result.assigned;groups[1-player]=result.assigned==='solids'?'stripes':'solids';}
        if(!result.keepTurn)player=1-player;
        if(result.foul){ballInHand();message=`${result.foul}. ${playerName(player)}: ${mode==='computer'&&player===1?'ball in hand.':'place the cue ball.'}`;}
        else message=`${playerName(player)}${mode==='computer'&&player===0?'r shot':", next shot"}. ${groups[player]?`Playing ${groups[player]}.`:'The table is open.'}`;
      }
    }else{
      if(shot.sunk.includes(0)){ballInHand();message='Scratch. Place the cue ball anywhere on the felt.';}
      else message=shot.sunk.length?'Nicely done. Find your next angle.':'Find your angle. The next shot is yours.';
    }
    sunk=physics.balls.filter(b=>b.sunk&&b.id>0).map(b=>b.id);
    if(mode==='practice'&&sunk.length===15){winner='Table cleared';message=`All fifteen, in ${shots} shots. That deserves another round.`;if(!best||shots<best){best=shots;try{localStorage.setItem('after-hours-best',String(best));}catch{}}}
  }
  function point(e:PointerEvent){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*1100/r.width,y:(e.clientY-r.top)*620/r.height};}
  function pointerMove(e:PointerEvent){if(!active)return;const p=point(e);if(placement){physics.place(p.x,p.y);return;}if(dragging){dragDistance=Math.hypot(p.x-dragStart.x,p.y-dragStart.y);power=Math.min(100,Math.round(dragDistance/1.6));}else angle=Math.atan2(p.y-physics.balls[0].y,p.x-physics.balls[0].x);}
  function pointerDown(e:PointerEvent){if(!active||e.button!==0)return;const p=point(e);canvas.focus();if(placement){if(physics.place(p.x,p.y)){placement=false;message='Cue ball placed. Line up your shot.';}return;}initAudio();angle=Math.atan2(p.y-physics.balls[0].y,p.x-physics.balls[0].x);dragStart=p;dragDistance=0;dragging=true;canvas.setPointerCapture(e.pointerId);}
  function pointerUp(e:PointerEvent){if(!dragging)return;dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(dragDistance>8)shoot();else power=65;}
  function keydown(e:KeyboardEvent){
    if(e.key==='Escape'){if(modal)modal=null;else paused=!paused;dragging=false;return;}
    if((e.target as HTMLElement)?.matches('input,select,button'))return;
    if(!active)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
    if(placement){const b=physics.balls[0];if(e.key==='ArrowLeft')physics.place(b.x-10,b.y);if(e.key==='ArrowRight')physics.place(b.x+10,b.y);if(e.key==='ArrowUp')physics.place(b.x,b.y-10);if(e.key==='ArrowDown')physics.place(b.x,b.y+10);if(e.key===' '){placement=false;message='Cue ball placed. Line up your shot.';}return;}
    if(e.key==='ArrowLeft')angle-=e.shiftKey?.003:.025;
    if(e.key==='ArrowRight')angle+=e.shiftKey?.003:.025;
    if(e.key==='ArrowUp')power=Math.min(100,power+5);
    if(e.key==='ArrowDown')power=Math.max(5,power-5);
    if(e.key===' ')shoot();
  }
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message='Fullscreen is unavailable in this browser.';}}
  function openDialog(node:HTMLDialogElement){const previous=document.activeElement as HTMLElement|null;node.showModal();return {destroy(){previous?.focus();}};}
  onMount(()=>{
    try{best=Number(localStorage.getItem('after-hours-best'))||0;}catch{}
    try{const saved=localStorage.getItem('after-hours-difficulty');if(isDifficulty(saved))difficulty=selectedDifficulty=saved;}catch{}
    physics.onHit=tickSound;const context=canvas.getContext('2d')!;
    const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    function loop(now:number){const dt=oldTime?Math.min((now-oldTime)/1000,.05):0;oldTime=now;
      if(!paused&&!modal&&!winner){if(shots){timer+=dt;elapsed=Math.floor(timer);}if(moving){accumulator+=dt;while(accumulator>=1/240){physics.step(1/240);accumulator-=1/240;}if(!physics.moving&&now-shotStart>100)finishShot();}else updateComputer(dt);}
      context.setTransform(canvas.width/1100,0,0,canvas.height/620,0,0);draw(context,physics,{angle,power,aim:!moving&&!winner,dragging,guide,placement,theme});frame=requestAnimationFrame(loop);
    }
    frame=requestAnimationFrame(loop);const change=()=>fullscreen=!!document.fullscreenElement;
    const visibility=()=>{if(document.hidden&&shots&&!winner){paused=true;dragging=false;}};
    document.addEventListener('fullscreenchange',change);document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('fullscreenchange',change);document.removeEventListener('visibilitychange',visibility);void audio?.close();};
  });
</script>

<svelte:window onkeydown={keydown}/>

<div class="app-shell">
  <header>
    <a class="brand" href="./" aria-label="After Hours home"><span class="brand-mark">8<span>✦</span></span><span>after hours<span class="brand-caption">THE POOL CLUB</span></span></a>
    <nav aria-label="Main navigation"><span class="nav-active">The table</span><button onclick={()=>modal='help'}>How to play <span>↗</span></button></nav>
    <div class="header-right"><span class="live-dot"></span> ALWAYS OPEN <span class="header-divider"></span><span class="club-number">EST. 2026</span></div>
  </header>

  <main>
    <section class="intro"><div><div class="eyebrow"><span></span> GOOD ANGLES. GREAT COMPANY.</div><h1>One more <em>game.</em></h1><p>Leave the day at the door. Find your next perfect shot.</p></div><button class="outline-button" onclick={openNewGame}><Icon name="reset" size={16}/> New game</button></section>

    <div class="game-layout">
      <section class="game-panel" aria-label="Pool game">
        <div class="table-toolbar"><div class="table-title"><span class="small-eight">8</span><strong>Table 01</strong><span class="toolbar-divider"></span><span>{mode==='practice'?'Solo practice':mode==='computer'?`Vs computer / ${DIFFICULTIES[difficulty].label}`:'Local eight-ball'}</span></div><div class="table-actions"><span class="ready"><span class:rolling={moving}></span>{winner?'FINISHED':paused?'PAUSED':moving?'IN MOTION':computerTurn?'THINKING':'IN PLAY'}</span><button class="icon-button" title={sound?'Mute sound':'Enable sound'} aria-label={sound?'Mute sound':'Enable sound'} onclick={()=>{sound=!sound;initAudio();}}><Icon name={sound?'sound':'mute'} size={17}/></button><button class="icon-button" title={fullscreen?'Exit fullscreen':'Fullscreen'} aria-label={fullscreen?'Exit fullscreen':'Fullscreen'} onclick={toggleFullscreen}><Icon name="expand" size={17}/></button></div></div>

        <div class="scorebar"><div class="player-label"><span class="avatar">{mode==='practice'?'Y':mode==='computer'?(player===0?'Y':'C'):player+1}</span><div><strong>{mode==='practice'?'Just you & the table':playerName(player)}</strong><span>{mode==='practice'?'No rush. Make it count.':groups[player]?`${groups[player]} · ${physics.balls.filter(b=>inGroup(b.id,groups[player]!)&&!sunk.includes(b.id)).length} remaining`:'Open table · break the ice'}</span></div></div><div class="rack-progress" aria-label={`${potted} balls pocketed`}>{#each Array.from({length:15},(_,i)=>i+1) as id}<span class="mini-ball" class:pocketed={sunk.includes(id)} class:striped={id>8} style={`--ball:${colors[id>8?id-8:id]}`}>{id}</span>{/each}</div><div class="shot-count"><span>SHOT</span><strong>{String(shots+(!winner?1:0)).padStart(2,'0')}</strong></div></div>

        <div class="table-stage">
          <div class="table-glow"></div>
          <canvas bind:this={canvas} aria-label="Pool table. Aim with the pointer, drag backward and release to shoot. Keyboard: left and right to aim, up and down for power, space to shoot." tabindex="0" onpointermove={pointerMove} onpointerdown={pointerDown} onpointerup={pointerUp} onpointercancel={()=>dragging=false}>Your browser needs canvas support to play pool.</canvas>
          {#if paused||winner}<div class="table-overlay"><div><span class="eyebrow">{winner?'WELL PLAYED':'TAKE YOUR TIME'}</span><h2>{winner??'A little breather.'}</h2><p>{winner?message:'Your table will be right here.'}</p><button class="primary-button" onclick={()=>winner?newGame():paused=false}>{winner?'Play another round':'Back to the table'}<Icon name="arrow" size={18}/></button></div></div>{/if}
        </div>
        <div class="table-message" aria-live="polite"><span class="message-dot"></span>{message}<span class="key-hint">{computerTurn?'COMPUTER’S TURN':placement?'CLICK TO PLACE':dragging?'RELEASE TO SHOOT':'AIM · PULL BACK · RELEASE'}</span></div>
        <div class="controls"><div class="aim-help"><Icon name="mouse" size={25}/><div><strong>{computerTurn?'A worthy opponent.':'Your next great shot.'}</strong><span>{computerTurn?'Watch the computer find its angle.':'Point to aim. Drag back to power up.'}</span></div></div><div class="power-control"><label for="power">SHOT POWER <span>{Math.round(power)}%</span></label><input id="power" type="range" min="5" max="100" bind:value={power} disabled={!active||placement} style={`--power:${power}%`}/></div><button class="shoot-button" disabled={!active||placement} onclick={shoot}>{computerTurn?'Computer’s turn':'Take shot'} <Icon name="arrow" size={17}/></button><button class="icon-button pause-button" aria-label={paused?'Resume game':'Pause game'} title={paused?'Resume':'Pause'} disabled={!!winner} onclick={()=>{paused=!paused;dragging=false;}}><Icon name={paused?'play':'pause'} size={18}/></button></div>
      </section>

      <aside>
        <section class="side-card mode-card"><div class="card-kicker">MAKE YOURSELF AT HOME</div><h2>Pick your pace.</h2><div class="mode-options"><button class:chosen={mode==='practice'} onclick={()=>{if(mode!=='practice'){openNewGame();}}}><span class="mode-icon"><Icon name="target" size={21}/></span><span><strong>Solo practice</strong><small>You, your cue, your rhythm.</small></span><span class="radio-dot"></span></button><button class:chosen={mode==='versus'} onclick={()=>{if(mode!=='versus')openNewGame();}}><span class="mode-icon players-icon">Ⅱ</span><span><strong>Play a friend</strong><small>Two players. One table.</small></span><span class="radio-dot"></span></button><button class:chosen={mode==='computer'} onclick={()=>{if(mode!=='computer')openNewGame();}}><span class="mode-icon"><Icon name="computer" size={21}/></span><span><strong>Play the computer</strong><small>A worthy rival. Always ready.</small></span><span class="radio-dot"></span></button></div>{#if mode==='computer'}<div class="current-difficulty"><span>Difficulty <strong>{DIFFICULTIES[difficulty].label}</strong></span><button onclick={openNewGame}>Change</button></div>{/if}<div class="local-note"><span class="live-dot"></span> No sign-up. Just show up.</div></section>
        <section class="side-card session-card"><div class="card-heading"><span class="card-kicker">THIS SESSION</span><span class="tiny-star">✧</span></div><div class="session-stats"><div><strong>{String(potted).padStart(2,'0')}<span> / 15</span></strong><small>Balls pocketed</small></div><div><strong>{time}</strong><small>Time at the table</small></div></div><div class="session-bottom"><span>{mode==='practice'?'Personal best':mode==='computer'?'You / Computer':'Player 1 / Player 2'}</span><strong>{mode==='practice'?(best?`${best} shots`:'Make your first mark'):groups[0]?`${groups[0]} / ${groups[1]}`:'Open / Open'} <span>↗</span></strong></div></section>
        <section class="side-card settings-card"><span class="card-kicker">YOUR TABLE, YOUR RULES</span><div class="setting-row"><label for="guide">Aim assist <span>Find the right line</span></label><button id="guide" role="switch" aria-checked={guide} aria-label="Aim assist" class="toggle" class:enabled={guide} onclick={()=>guide=!guide}><span></span></button></div><div class="setting-row"><span>Table felt</span><div class="felt-options"><button class:swatch-active={theme==='green'} class="swatch green" aria-label="Classic green felt" aria-pressed={theme==='green'} onclick={()=>theme='green'}>{#if theme==='green'}<Icon name="check" size={12}/>{/if}</button><button class:swatch-active={theme==='blue'} class="swatch blue" aria-label="Midnight blue felt" aria-pressed={theme==='blue'} onclick={()=>theme='blue'}>{#if theme==='blue'}<Icon name="check" size={12}/>{/if}</button></div></div></section>
        <div class="tip-card"><span class="tip-icon">✳</span><div><span class="card-kicker">A LITTLE TABLE WISDOM</span><p>Power gets the attention.<br/><em>Precision wins the game.</em></p></div></div>
      </aside>
    </div>
    <div class="bottom-strip"><span><span class="keyboard-symbol">⌘</span> A little less scrolling. A little more playing.</span><button onclick={()=>modal='help'}>Learn the ropes <Icon name="arrow" size={15}/></button></div>
  </main>
  <footer><span>BUILT FOR THE LOVE OF THE GAME.</span><span class="footer-brand">Stay a little longer. <span>✦</span></span><span>NO DOWNLOADS. NO DISTRACTIONS.</span></footer>
</div>

{#if modal}
  <div class="modal-backdrop" role="presentation" onclick={(e)=>{if(e.target===e.currentTarget)modal=null;}}>
    <dialog class="modal" use:openDialog oncancel={(e)=>{e.preventDefault();modal=null;}} aria-label={modal==='help'?'How to play':'Start a new game'}>
      <button class="icon-button modal-close" aria-label="Close dialog" onclick={()=>modal=null}><Icon name="close"/></button>
      <span class="eyebrow">WELCOME TO THE CLUB</span><h2>{modal==='help'?'Find your angle.':'A fresh start.'}</h2>
      {#if modal==='help'}<p>A good game is only a few shots away.</p><div class="help-step"><b>01</b><div><strong>Line it up</strong><p>Move your pointer over the table to aim. The dotted line previews your cue ball’s first contact.</p></div></div><div class="help-step"><b>02</b><div><strong>Make your move</strong><p>Press on the table, drag back to set power, and release. Or adjust the power slider and choose Take shot.</p></div></div><div class="help-step"><b>03</b><div><strong>Play your way</strong><p>Practice: clear all 15 balls in as few shots as possible. Play a friend or the computer: pocket your group, then the eight. A legal pot keeps your turn; a foul gives your opponent ball in hand. You break against the computer; it aims and shoots automatically on its turn.</p></div></div><div class="rules-note">Club rules: groups are assigned after the break. Hit your group first and pocket a ball or reach a cushion. Early eight loses; an eight on the break is re-spotted. No called pockets.</div><div class="keyboard-help"><span><kbd>←</kbd><kbd>→</kbd> Aim</span><span><kbd>↑</kbd><kbd>↓</kbd> Power</span><span><kbd>Space</kbd> Shoot</span><span><kbd>Esc</kbd> Pause</span></div><p class="access-note">Hold Shift for fine aim. With ball in hand, use arrows to position and Space to place.</p><button class="primary-button full" onclick={()=>modal=null}>Got it. Let's play.<Icon name="arrow" size={18}/></button>
      {:else}<p>{shots?'Starting a new game will reset this table.':'The felt is fresh. The night is young.'}</p><button class="new-mode" onclick={()=>newGame('practice')}><Icon name="target" size={26}/><span><strong>Solo practice</strong><small>Clear the table. Beat your personal best.</small></span><Icon name="arrow"/></button><button class="new-mode" onclick={()=>newGame('versus')}><span class="players-icon">Ⅱ</span><span><strong>Local two-player</strong><small>Classic eight-ball with a friend on this device.</small></span><Icon name="arrow"/></button><fieldset class="difficulty-picker"><legend>Computer difficulty</legend><div class="difficulty-options">{#each difficultyLevels as level}<label><input type="radio" name="difficulty" value={level} bind:group={selectedDifficulty}/><span>{DIFFICULTIES[level].label}</span></label>{/each}</div><p aria-live="polite">{DIFFICULTIES[selectedDifficulty].description}</p></fieldset><button class="new-mode" onclick={()=>newGame('computer',selectedDifficulty)}><Icon name="computer" size={26}/><span><strong>Vs computer</strong><small>{DIFFICULTIES[selectedDifficulty].label} opponent. You make the opening break.</small></span><Icon name="arrow"/></button><button class="text-button" onclick={()=>modal=null}>Keep my current table</button>{/if}
    </dialog>
  </div>
{/if}
