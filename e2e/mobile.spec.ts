import {test,expect,type Page} from '@playwright/test';

async function tablePoint(page:Page,x:number,y:number){
  const r=(await page.locator('canvas').boundingBox())!;
  const portrait=await page.locator('.app-shell').evaluate(el=>el.classList.contains('mobile-portrait'));
  return portrait?{x:r.x+y/620*r.width,y:r.y+(1-x/1100)*r.height}:{x:r.x+x/1100*r.width,y:r.y+y/620*r.height};
}
async function fits(page:Page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  for(const selector of ['canvas','.mobile-controls','.mobile-shoot']){
    const r=(await page.locator(selector).boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x+r.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
    expect(r.y+r.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
  }
}

test('phone touch aiming, fine adjustment, spin and rotation preserve the game',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  try{
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.app-shell')).toHaveClass(/mobile-portrait/);await fits(page);
    const p=await tablePoint(page,410,410);await page.touchscreen.tap(p.x,p.y);
    const initialAim=Number(await page.getByRole('slider',{name:'Fine aim'}).getAttribute('aria-valuenow'));
    // Touch coordinates are rounded to physical pixels differently across engines.
    expect(Math.abs(initialAim-45)).toBeLessThan(1);
    await expect(page.locator('.shot-count strong')).toHaveText('01');
    await page.getByRole('button',{name:'Aim slightly right'}).tap();
    expect(Number(await page.getByRole('slider',{name:'Fine aim'}).getAttribute('aria-valuenow'))).toBeGreaterThan(initialAim);
    // Actual touch drag on the fine-aim surface, without firing or scrolling the page.
    if(browser.browserType().name()==='chromium'){
      const dial=(await page.getByRole('slider',{name:'Fine aim'}).boundingBox())!,cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dial.x+dial.width/2,y:dial.y+22}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dial.x+dial.width/2+30,y:dial.y+22}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else for(let i=0;i<20;i++)await page.getByRole('slider',{name:'Fine aim'}).press('ArrowRight');
    expect(Number(await page.getByRole('slider',{name:'Fine aim'}).getAttribute('aria-valuenow'))).toBeGreaterThan(initialAim+3);
    await expect(page.locator('.shot-count strong')).toHaveText('01');
    await page.getByRole('button',{name:'Cue spin',exact:true}).tap();await page.getByRole('slider',{name:'Draw or follow spin'}).fill('-40');
    await page.getByRole('button',{name:'Back to the table',exact:true}).tap();await expect(page.getByRole('button',{name:'Spin set'})).toBeVisible();
    const direction=await page.getByRole('slider',{name:'Fine aim'}).getAttribute('aria-valuenow');
    await page.screenshot({path:'test-results/phone-portrait.png',fullPage:true});
    await page.setViewportSize({width:844,height:390});await expect(page.locator('.app-shell')).toHaveClass(/mobile-landscape/);await fits(page);
    await expect(page.getByRole('slider',{name:'Fine aim'})).toHaveAttribute('aria-valuenow',direction!);
    await page.screenshot({path:'test-results/phone-landscape.png',fullPage:true});
    await page.getByRole('slider',{name:'Shot power'}).fill('5');await page.getByRole('button',{name:'Take shot',exact:true}).tap();
    await expect(page.locator('.shot-count strong')).toHaveText('02');
    await expect(page.getByRole('button',{name:'Take shot',exact:true})).toBeEnabled({timeout:10000});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('small phones keep controls reachable and menu dialogs scroll',async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage();await page.goto('/');await fits(page);
    await page.getByRole('button',{name:'Game menu',exact:true}).tap();await page.getByRole('dialog').getByRole('switch',{name:'Aim assist'}).tap();
    await expect(page.getByRole('dialog').getByRole('switch',{name:'Aim assist'})).toHaveAttribute('aria-checked','false');
    await page.getByRole('button',{name:'How to play',exact:true}).tap();await expect(page.getByRole('dialog')).toContainText('Touch and slide');
    await page.getByRole('button',{name:"Got it. Let's play."}).tap();await fits(page);
    await page.getByRole('button',{name:'New game',exact:true}).tap();await page.getByRole('radio',{name:'Hard',exact:true}).check();await page.getByRole('button',{name:'Vs computer'}).tap();
    await expect(page.locator('.player-label strong')).toHaveText('You');await fits(page);
  }finally{await context.close();}
});

test('phone ball-in-hand uses touch preview and explicit placement in an online room',async({browser})=>{
  const desktop=await browser.newContext(),phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
    const host=await desktop.newPage(),guest=await phone.newPage();await host.goto('/');await host.getByRole('button',{name:'Play online'}).click();await host.getByRole('button',{name:'Create room',exact:true}).click();
    const code=await host.locator('.room-code').textContent();await guest.goto(`/?room=${code}`);await expect(guest.locator('.room-code')).toHaveText(code!);
    await expect(host.locator('.room-status')).toHaveText('Both players connected',{timeout:10000});
    await host.locator('#power').fill('5');await host.getByRole('button',{name:'Take shot',exact:true}).click();
    await expect(guest.getByRole('button',{name:'Place cue ball',exact:true})).toBeEnabled({timeout:10000});
    const p=await tablePoint(guest,450,250);await guest.touchscreen.tap(p.x,p.y);
    await expect(guest.getByRole('button',{name:'Place cue ball',exact:true})).toBeEnabled();
    await expect(host.locator('.table-message')).toContainText('Opponent is choosing');
    await expect.poll(()=>host.locator('canvas').evaluate((c:HTMLCanvasElement)=>{const pixel=c.getContext('2d')!.getImageData(Math.round(c.width*450/1100),Math.round(c.height*250/620),1,1).data;return pixel[0]>180&&pixel[1]>180;}),{timeout:10000}).toBe(true);
    await guest.getByRole('button',{name:'Place cue ball',exact:true}).tap();await expect(host.locator('.table-message')).toContainText('Opponent placed',{timeout:10000});
    await fits(guest);await guest.screenshot({path:'test-results/phone-online.png',fullPage:true});
    await guest.getByRole('slider',{name:'Shot power'}).fill('5');await guest.getByRole('button',{name:'Take shot',exact:true}).tap();
    await expect(host.locator('.shot-count strong')).toHaveText('03',{timeout:10000});
    await host.getByRole('button',{name:'Leave room',exact:true}).click();
  }finally{await desktop.close();await phone.close();}
});
