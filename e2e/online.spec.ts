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
    await host.locator('#top-spin').fill('-40');await host.locator('#power').fill('5');await host.getByRole('button',{name:'Take shot',exact:true}).click();
    await expect(guest.locator('.shot-count strong')).toHaveText('02',{timeout:10000});
    await expect(guest.locator('.table-message')).toContainText('place the cue ball',{timeout:10000});
    const cue=await guest.locator('canvas').boundingBox();await guest.locator('canvas').click({position:{x:cue!.width*.3,y:cue!.height*.5}});
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
