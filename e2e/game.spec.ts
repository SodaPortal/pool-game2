import { test, expect } from '@playwright/test';

test('practice game shoots, settles, pauses, and resets without runtime errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'One more game.'})).toBeVisible();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Take shot'}).click();
 await expect(page.getByRole('button',{name:'Take shot'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Take shot'})).toBeEnabled({timeout:20000});
 await expect(page.locator('.shot-count strong')).toHaveText('02');
 await page.getByRole('button',{name:'Pause game',exact:true}).click();await expect(page.getByRole('heading',{name:'A little breather.'})).toBeVisible();
 await page.getByRole('button',{name:'Back to the table'}).click();
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Local two-player'}).click();
 await expect(page.locator('.player-label strong')).toHaveText('Player 1');
 await expect(page.locator('.shot-count strong')).toHaveText('01');expect(errors).toEqual([]);
});

test('settings, keyboard shots and accessible help work',async({page})=>{
 await page.goto('/');const assist=page.getByRole('switch',{name:'Aim assist'});await assist.click();await expect(assist).toHaveAttribute('aria-checked','false');
 await page.getByRole('button',{name:'Midnight blue felt'}).click();await expect(page.getByRole('button',{name:'Midnight blue felt'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Mute sound'}).click();await expect(page.getByRole('button',{name:'Enable sound'})).toBeVisible();
 await page.getByRole('button',{name:'How to play'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'A little breather.'})).toHaveCount(0);
 await page.locator('canvas').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#power')).toHaveValue('60');await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'Take shot'})).toBeDisabled();
});

test('mobile layout fits and aiming requires an explicit shot',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 const rect=(await page.locator('canvas').boundingBox())!;
 await page.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.5,{steps:10});await page.mouse.up();
 await expect(page.locator('.shot-count strong')).toHaveText('01');
 await page.getByRole('button',{name:'Take shot',exact:true}).click();
 await expect(page.locator('.mobile-shoot')).toBeDisabled();
 await expect(page.locator('.shot-count strong')).toHaveText('02');
});

test('computer plays automatically, locks human input, and returns the turn',async({page})=>{
 test.setTimeout(60000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto('/');
 await page.getByRole('button',{name:'Play the computer'}).click();
 await page.getByRole('radio',{name:'Hard',exact:true}).check();
 await page.getByRole('button',{name:'Vs computer'}).click();
 await expect(page.locator('.player-label strong')).toHaveText('You');
 // A soft shot deliberately misses the rack, giving the computer ball in hand.
 await page.locator('#power').fill('5');await page.getByRole('button',{name:'Take shot'}).click();
 await page.clock.runFor(1200);
 await expect(page.locator('.player-label strong')).toHaveText('Computer');
 await expect(page.locator('#power')).toBeDisabled();
 await expect(page.getByRole('button',{name:'Computer’s turn'})).toBeDisabled();
 const shotNumber=await page.locator('.shot-count strong').textContent();
 const power=await page.locator('#power').inputValue();
 await page.locator('canvas').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');
 await expect(page.locator('.shot-count strong')).toHaveText(shotNumber!);await expect(page.locator('#power')).toHaveValue(power);
 await page.getByRole('button',{name:'Pause game',exact:true}).click();
 await page.clock.runFor(5000);await expect(page.locator('.shot-count strong')).toHaveText(shotNumber!);
 await page.getByRole('button',{name:'Back to the table'}).click();await page.clock.runFor(1600);
 await expect(page.locator('.shot-count strong')).toHaveText('03');
 for(let i=0;i<16&&(await page.locator('.player-label strong').textContent())==='Computer';i++)await page.clock.runFor(5000);
 await expect(page.locator('.player-label strong')).toHaveText('You');
 await expect(page.getByRole('button',{name:'Take shot'})).toBeEnabled();
 expect(errors).toEqual([]);
});

test('new game clears a pending computer turn',async({page})=>{
 await page.clock.install();await page.goto('/');
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('radio',{name:'Hard',exact:true}).check();await page.getByRole('button',{name:'Vs computer'}).click();
 await page.locator('#power').fill('5');await page.getByRole('button',{name:'Take shot'}).click();await page.clock.runFor(1200);
 await expect(page.locator('.player-label strong')).toHaveText('Computer');
 await page.getByRole('button',{name:'How to play'}).click();await page.clock.runFor(5000);
 await expect(page.locator('.shot-count strong')).toHaveText('02');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Solo practice',exact:false}).last().click();
 await page.clock.runFor(5000);
 await expect(page.locator('.player-label strong')).toHaveText('Just you & the table');await expect(page.locator('.shot-count strong')).toHaveText('01');
 await expect(page.getByRole('button',{name:'Take shot'})).toBeEnabled();
});

test('difficulty selection applies to new matches, persists, and cancels safely',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const level of ['Easy','Medium','Hard']){
   await page.getByRole('button',{name:'New game',exact:true}).click();
   await page.getByRole('radio',{name:level,exact:true}).check();
   await expect(page.getByRole('radio',{name:level,exact:true})).toBeChecked();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
   await page.getByRole('button',{name:'Vs computer'}).click();
   await expect(page.locator('.table-title')).toContainText(`Vs computer / ${level}`);
   await expect(page.locator('.current-difficulty strong')).toHaveText(level);
   expect(await page.evaluate(()=>localStorage.getItem('after-hours-difficulty'))).toBe(level.toLowerCase());
 }
 await page.getByRole('button',{name:'Game menu',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Change',exact:true}).click();
 await page.getByRole('radio',{name:'Easy',exact:true}).check();
 await page.getByRole('button',{name:'Keep my current table'}).click();
 await expect(page.locator('.current-difficulty strong')).toHaveText('Hard');
 await page.getByRole('button',{name:'Game menu',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Change',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Hard',exact:true})).toBeChecked();
 await page.screenshot({path:'test-results/difficulty-mobile.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'New game',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Hard',exact:true})).toBeChecked();
});

test('spin target supports dragging, keyboard adjustments, and reset on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Cue spin',exact:true}).click();
 // Wait for font layout before recording coordinates for a precise diagonal drag.
 await page.evaluate(()=>document.fonts.ready);
 const target=page.getByRole('button',{name:/^Cue ball spin:/});
 await target.scrollIntoViewIfNeeded();const rect=(await target.boundingBox())!;
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
 await page.mouse.move(rect.x+rect.width*.95,rect.y+rect.height*.95,{steps:5});await page.mouse.up();
 expect(Number(await page.getByRole('slider',{name:'Side spin',exact:true}).inputValue())).toBeCloseTo(71,0);
 expect(Number(await page.getByRole('slider',{name:'Draw or follow spin'}).inputValue())).toBeCloseTo(-71,0);
 await target.focus();await page.keyboard.press('Home');
 await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('0');
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('0');
 await page.keyboard.press('ArrowUp');await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('10');
 await page.keyboard.press('Shift+ArrowRight');await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('2');
 await page.keyboard.press('Space');await expect(page.locator('.shot-count strong')).toHaveText('01');
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('0');
 await page.getByRole('slider',{name:'Side spin',exact:true}).fill('-40');await page.getByRole('slider',{name:'Draw or follow spin'}).fill('50');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'test-results/spin-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Reset spin',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('0');
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('0');
});

test('spin is locked during a shot and resets when the balls settle',async({page})=>{
 await page.clock.install();await page.goto('/');
 await page.getByRole('slider',{name:'Draw or follow spin'}).fill('-80');
 await page.getByRole('button',{name:'Take shot'}).click();
 await expect(page.getByRole('button',{name:/^Cue ball spin:/})).toBeDisabled();
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toBeDisabled();
 await page.clock.runFor(15000);
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('0');
 await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('0');
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Local two-player'}).click();
 await page.getByRole('slider',{name:'Side spin',exact:true}).fill('60');
 await page.getByRole('button',{name:'Pause game',exact:true}).click();await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Back to the table'}).click();await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('60');
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Vs computer'}).click();
 await expect(page.getByRole('slider',{name:'Side spin',exact:true})).toHaveValue('0');
 await page.getByRole('slider',{name:'Draw or follow spin'}).fill('70');await page.locator('#power').fill('5');await page.getByRole('button',{name:'Take shot'}).click();
 await page.clock.runFor(1200);
 await expect(page.locator('.player-label strong')).toHaveText('Computer');
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toBeDisabled();
 await expect(page.getByRole('slider',{name:'Draw or follow spin'})).toHaveValue('0');
});
