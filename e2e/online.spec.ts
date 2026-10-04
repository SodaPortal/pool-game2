import {test,expect} from '@playwright/test';

test('two independent players join by invite, exchange shots, and restore a seat after refresh',async({browser})=>{
  test.setTimeout(60000);
  const hostContext=await browser.newContext(),guestContext=await browser.newContext(),thirdContext=await browser.newContext();
  try{
    const host=await hostContext.newPage(),guest=await guestContext.newPage(),third=await thirdContext.newPage();
    const errors:string[]=[];host.on('pageerror',e=>errors.push(e.message));guest.on('pageerror',e=>errors.push(e.message));
    await host.goto('/');await host.getByRole('button',{name:'Play online'}).click();await host.getByRole('button',{name:'Create room',exact:true}).click();
    await expect(host.locator('.room-code')).toBeVisible();const code=(await host.locator('.room-code').textContent())!;
    await expect(host.getByRole('button',{name:'Waiting for friend',exact:true})).toBeDisabled();
    await guest.goto(`/?room=${code}`);await expect(guest.locator('.room-code')).toHaveText(code);
    await expect(host.locator('.room-status')).toHaveText('Both players connected',{timeout:10000});
    await expect(guest.getByRole('button',{name:'Waiting for friend',exact:true})).toBeDisabled();
    await third.goto(`/?room=${code}`);await expect(third.getByRole('alert')).toContainText('already has two players');
    const stickAt=(page:typeof host,x:number,y:number)=>page.locator('canvas').evaluate((canvas:HTMLCanvasElement,at)=>{
      const pixel=canvas.getContext('2d')!.getImageData(Math.round(canvas.width*at.x/1100),Math.round(canvas.height*at.y/620),1,1).data;
      return pixel[0]>110&&pixel[0]>pixel[1]*1.07&&pixel[1]>pixel[2]*1.08;
    },{x,y});
    const hostPoint=async(x:number,y:number)=>{const table=(await host.locator('canvas').boundingBox())!;return {x:table.x+table.width*x/1100,y:table.y+table.height*y/620};};
    let at=await hostPoint(310,410);await host.mouse.move(at.x,at.y);
    await expect.poll(()=>stickAt(guest,310,200),{timeout:10000}).toBe(true);
    await host.locator('canvas').focus();await host.keyboard.press('ArrowRight');
    await expect.poll(()=>stickAt(guest,310-Math.cos(Math.PI/2+.025)*110,310-Math.sin(Math.PI/2+.025)*110),{timeout:10000}).toBe(true);
    // A held drag pulls the remote stick away from the ball, before any shot is fired.
    at=await hostPoint(310,410);await host.mouse.move(at.x,at.y);await host.mouse.down();at=await hostPoint(310,550);await host.mouse.move(at.x,at.y);
    await expect.poll(()=>stickAt(guest,310,260),{timeout:10000}).toBe(false);
    await expect.poll(()=>stickAt(guest,310,150),{timeout:10000}).toBe(true);
    await host.keyboard.press('Escape');await host.mouse.up();at=await hostPoint(410,310);await host.mouse.move(at.x,at.y);
    await expect.poll(()=>stickAt(guest,200,310),{timeout:10000}).toBe(true);
    await host.locator('#top-spin').fill('-40');await host.locator('#power').fill('5');await host.getByRole('button',{name:'Take shot',exact:true}).click();
    await expect(guest.locator('.shot-count strong')).toHaveText('02',{timeout:10000});
    await expect(guest.locator('.table-message')).toContainText('place the cue ball',{timeout:10000});
    const cue=await guest.locator('canvas').boundingBox();
    await guest.mouse.move(cue!.x+cue!.width*.4,cue!.y+cue!.height*.4);
    await expect(host.locator('.table-message')).toContainText('Opponent is choosing a cue-ball position');
    // Verify the remote canvas actually draws the white cue ball at the hovered position.
    const remoteCue=()=>host.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>{
      const pixel=canvas.getContext('2d')!.getImageData(Math.round(canvas.width*.4),Math.round(canvas.height*.4),1,1).data;
      return pixel[0]>180&&pixel[1]>180&&pixel[2]>150;
    });
    await expect.poll(remoteCue,{timeout:10000}).toBe(true);
    await guest.locator('canvas').focus();await guest.keyboard.press('ArrowRight');await guest.keyboard.press('Space');
    await expect(host.locator('.table-message')).toContainText('Opponent placed the cue ball',{timeout:10000});
    const placedTable=(await guest.locator('canvas').boundingBox())!;
    await guest.mouse.move(placedTable.x+placedTable.width*450/1100,placedTable.y+placedTable.height*348/620);
    await expect.poll(()=>stickAt(host,450,138),{timeout:10000}).toBe(true);
    await guest.locator('#power').fill('5');await guest.getByRole('button',{name:'Take shot',exact:true}).click();
    await expect(host.locator('.shot-count strong')).toHaveText('03',{timeout:10000});
    await expect(host.locator('.table-message')).toContainText('place the cue ball',{timeout:10000});
    await guest.reload();await expect(guest.locator('.room-code')).toHaveText(code);await expect(guest.locator('.shot-count strong')).toHaveText('03');
    await expect(guest.getByRole('button',{name:'Waiting for friend',exact:true})).toBeDisabled();
    await host.screenshot({path:'test-results/online-host.png',fullPage:true});
    await host.getByRole('button',{name:'Leave room',exact:true}).click();await expect(guest.locator('.room-status')).toHaveText('Room closed',{timeout:10000});
    expect(errors).toEqual([]);
  }finally{await hostContext.close();await guestContext.close();await thirdContext.close();}
});

test('room code entry works on mobile and offline polling recovers',async({browser})=>{
  test.setTimeout(45000);
  const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext();
  try{
    const host=await a.newPage(),guest=await b.newPage();await host.goto('/');await host.getByRole('button',{name:'Play online'}).click();await host.getByRole('button',{name:'Create room',exact:true}).click();
    await expect(host.locator('.room-code')).toBeVisible();const code=(await host.locator('.room-code').textContent())!;
    await guest.goto('/');await guest.getByRole('button',{name:'Play online'}).click();await guest.getByLabel('Room code',{exact:true}).fill(code.toLowerCase());await guest.getByRole('button',{name:'Join room',exact:true}).click();
    await expect(guest.locator('.room-code')).toHaveText(code);
    expect(await host.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await b.setOffline(true);await expect(guest.locator('.room-status')).toContainText('Reconnecting',{timeout:15000});
    await b.setOffline(false);await expect(guest.locator('.room-status')).toHaveText('Both players connected',{timeout:20000});
    await host.screenshot({path:'test-results/online-mobile.png',fullPage:true});
    await host.getByRole('button',{name:'Leave room',exact:true}).click();
  }finally{await a.close();await b.close();}
});
