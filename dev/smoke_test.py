"""Smoke test: opens every page and every "new …" form against the demo server and fails on any JS error.

    pip install playwright && playwright install chromium
    python3 dev/mock_server.py &        # in another terminal
    python3 dev/smoke_test.py           # optional: --shots docs/screenshots
"""
import asyncio, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8765/')   # e.g. a flaky demo server: BASE=http://127.0.0.1:8766/
PAGES = ['', 'forecast', 'transactions', 'inbox', 'review', 'accounts', 'account/1', 'account/3?range=all', 'account/102', 'loans', 'budgets', 'categories',
         'bills', 'recurring', 'piggy', 'rules', 'reports', 'recap', 'settings']
# The markup's event handlers (data-onclick="App.x(…)") in the page and the TypeScript sources (not the minified
# bundle), with the JS concatenations ' + … + ' and template values ${…} filled in with 1
_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
_src = open(os.path.join(_root, 'index.html')).read() + ''.join(
    open(os.path.join(d, f)).read() for d, _, fs in os.walk(os.path.join(_root, 'src')) for f in fs if f.endswith('.ts'))
HANDLERS = sorted({re.sub(r"\$\{(?:[^{}]|\{[^{}]*\})*\}", '1', re.sub(r"' \+ .*? \+ '", '1', h)).replace("\\'", "'") for h in re.findall(r'data-on[a-z]+="(.*?)"', _src)})
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
# The page for the current hash has painted (not the previous page or the loading skeleton) and no animation is running
# (a function, not an expression: Playwright evals expressions, which the Content-Security-Policy refuses)
PAINTED = """() => { const r = parseHash(); return !S.vtRun && S.pageKey && S.pageKey.startsWith(r.name + '/' + r.id + '?')
  && document.querySelector('#view .head .actions, #view .error'); }"""


async def goto(page, route):
    await page.goto(BASE + '#/' + route)
    await page.wait_for_function(PAINTED, timeout=15000)


async def check(pw, width, height, mobile):
    br = await pw.chromium.launch()
    ctx = await br.new_context(viewport={'width': width, 'height': height}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    # MONEY_CHECK_HTML makes html`` log markup that it escaped and html`` joined with + (see app/src/core/html.ts)
    await ctx.add_init_script("window.MONEY_CHECK_HTML = true")
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(f'{page.url}: {e}'))
    # anything the Content-Security-Policy blocks (the mock server sends the same policy as nginx)
    page.on('console', lambda m: any(k in m.text for k in ('Content Security Policy', 'Escaped HTML-looking text', 'Html joined with +')) and errors.append(f'{page.url}: {m.text}'))
    # Signing in (the static demo needs none and never shows the sign-in screen)
    await page.goto(BASE)
    if mobile:          # with the form
        await page.wait_for_selector('#login:not([hidden]), #app:not([hidden])')
        if await page.locator('#login:not([hidden])').count():
            await page.fill('#loginPw', 'nope'); await page.click('#loginForm button[type=submit]')
            await page.wait_for_selector('#loginErr:not([hidden])')
            await page.fill('#loginPw', 'demo'); await page.click('#loginForm button[type=submit]')
    else:               # a password saved by an older version is traded for a session, then deleted
        await page.evaluate("localStorage.setItem('moneyKey', 'demo')"); await page.reload()
    await page.wait_for_function(PAINTED, timeout=15000)
    if await page.evaluate("localStorage.getItem('moneyKey')"): errors.append('the password saved by an older version was not deleted')
    # every data-on* handler in the source parses and calls an App method that exists
    if not mobile:
        await goto(page, '')
        for h in HANDLERS:
            bad = await page.evaluate('''h => { try { const p = parseHandler(h); const miss = p.filter(s => s.fn && typeof App[s.fn] !== 'function');
              return miss.length ? 'no App.' + miss[0].fn : ''; } catch (e) { return e.message; } }''', h)
            if bad: errors.append(f'handler {h!r}: {bad}')
    for p in PAGES:
        await goto(page, p)
        await page.wait_for_timeout(300)
        if await page.locator('#view .error').count():
            errors.append(f'#{p}: page showed an error: ' + await page.inner_text('#view .error'))
        # open each primary "new …" button on the page, then close the drawer
        buttons = page.locator('#view .head .actions button.btn.primary')
        for i in range(await buttons.count()):
            await buttons.nth(i).click()
            await page.wait_for_timeout(600)
            if not await page.evaluate("el('drawer').classList.contains('open')"):
                errors.append(f'#{p}: button {i} did not open a form')
            await page.keyboard.press('Escape')
            await page.wait_for_timeout(500)
    # a few interactions
    await goto(page, 'transactions'); await page.wait_for_selector('tr[data-gid]')
    await page.locator('tr[data-gid]').first.click(); await page.wait_for_selector('#txForm')
    await page.keyboard.press('Escape'); await page.wait_for_timeout(500)
    await page.evaluate('App.quickAdd()'); await page.wait_for_selector('#nlq')
    await page.locator('#nlq').press_sequentially('coffee 4.50 yesterday'); await page.wait_for_timeout(300)
    if await page.evaluate('S.form.splits[0].amount') != '4.50':
        errors.append('quick add did not parse the amount')
    await page.keyboard.press('Escape'); await page.wait_for_timeout(400)
    # a background refresh must not drop what you're in the middle of
    if not mobile:
        await page.evaluate("App.selAll(false)")
        boxes = page.locator('input[data-sel]')
        await boxes.nth(0).check(); await boxes.nth(1).check()
        await page.evaluate('refreshAll()')
        if await page.evaluate('S.sel.size') != 2:
            errors.append('a background refresh cleared the bulk-edit selection')
        await page.evaluate('App.selAll(false)')
        # switching between a cached page and one that isn't cached must not stack pages on top of each other
        for p in ['inbox', 'transactions', 'inbox', 'transactions']:
            await page.locator('.nav a[href="#/' + p + '"]').click(); await page.wait_for_function(PAINTED, timeout=15000); await page.wait_for_timeout(300)
        if await page.locator('#view .head h1').count() != 1:
            errors.append('pages stacked up: ' + ', '.join(await page.locator('#view .head h1').all_inner_texts()))
        await goto(page, 'inbox')
        await page.evaluate('refreshAll()')
        if not await page.evaluate('!!(S.inbox && S.inbox.paint.live)'):
            errors.append('a background refresh disconnected the Categorize page from the screen')
        # "All time" in the month selector applies to every page that has one
        await goto(page, 'transactions')
        await page.locator('#view .month button', has_text='All time').click()
        await page.wait_for_selector('#view .month span:text-is("All time")', timeout=15000)
        for p in ['transactions', '', 'budgets', 'categories', 'bills', 'account/1']:
            await goto(page, p); await page.wait_for_timeout(300)
            if await page.locator('#view .error').count():
                errors.append(f'#{p} (all time): page showed an error: ' + await page.inner_text('#view .error'))
            elif p != 'account/1' and await page.locator('#view .month span', has_text='All time').count() != 1:
                errors.append(f'#{p}: the month selector did not stay on All time')
        await page.locator('#view .seg').get_by_role('button', name='Month', exact=True).click(); await page.wait_for_function(PAINTED, timeout=15000)
        if await page.evaluate('S.all'):
            errors.append('picking Month on an account did not leave All time')
        await page.locator('#view .seg').get_by_role('button', name='Month', exact=True).click()   # back to this month
        # Customize the overview: column count, the extra cards, hiding the summary
        await goto(page, ''); await page.wait_for_selector('#dash [data-w="payees"] .cat', timeout=15000)
        for k in ['payees', 'income', 'goals']:
            if not await page.locator(f'#dash [data-w="{k}"]').count(): errors.append(f'overview card {k!r} is missing')
        await page.evaluate('App.dashEdit(true)'); await page.wait_for_selector('#dashCols')
        await page.locator('#dashCols button', has_text='2').click()
        await page.wait_for_timeout(600)
        if await page.evaluate("el('dash').dataset.cols + '/' + JSON.parse(localStorage.getItem('money.dash')).cols") != '2/2':
            errors.append('picking 2 columns did not apply or save')
        # freeform tiles: drag one across and down with the mouse, then resize it by its corner; tiles never overlap
        await page.locator('#dashCols button', has_text='3').click(); await page.wait_for_function(PAINTED, timeout=15000)
        await page.wait_for_selector('#dash.grid.editing'); await page.wait_for_timeout(1500)   # and let the slow cards fill in
        await page.evaluate("scrollTo(0, scrollY + el('dash').getBoundingClientRect().top - 120)")
        a = await page.locator('#dash [data-w="safe"] .wctl strong').bounding_box(); dw = (await page.locator('#dash').bounding_box())['width']
        await page.mouse.move(a['x'] + 5, a['y'] + 5); await page.mouse.down()
        for i in range(1, 16): await page.mouse.move(a['x'] + 5 + dw * .45 * i / 15, a['y'] + 5 + 60 * i / 15); await page.wait_for_timeout(30)
        await page.wait_for_timeout(250); await page.mouse.up(); await page.wait_for_timeout(500)
        moved = await page.evaluate("JSON.parse(localStorage.getItem('money.dash')).free.safe")
        if not moved or moved[0] < 8:
            errors.append(f'dragging a tile across did not move it: {moved}')
        c = await page.locator('#dash [data-w="safe"] .rsz').bounding_box()
        await page.mouse.move(c['x'] + 8, c['y'] + 8); await page.mouse.down()
        for i in range(1, 11): await page.mouse.move(c['x'] + 8 - dw * .15 * i / 10, c['y'] + 8); await page.wait_for_timeout(30)
        await page.wait_for_timeout(250); await page.mouse.up(); await page.wait_for_timeout(500)
        sized = await page.evaluate("JSON.parse(localStorage.getItem('money.dash')).free.safe")
        if not sized or sized[2] >= moved[2]:
            errors.append(f'dragging the corner did not make the tile narrower: {moved} -> {sized}')
        overlap = await page.evaluate("""() => { const r = [...document.querySelectorAll('#dash > .w')].map(w => [w.dataset.w, w.getBoundingClientRect()]);
          for (const [a, p] of r) for (const [b, q] of r) if (a < b && p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) return a + '/' + b; return ''; }""")
        if overlap: errors.append('overview tiles overlap: ' + overlap)
        await page.locator('#dashCols button', has_text='2').click(); await page.wait_for_function(PAINTED, timeout=15000); await page.wait_for_selector('#dashCols')
        await page.locator('.dash-opts input[type=checkbox]').first.uncheck(); await page.wait_for_function(PAINTED, timeout=15000)
        await page.wait_for_selector('#dashCols')
        if await page.locator('#view .hero').count() or await page.evaluate("el('dash').dataset.cols") != '2':
            errors.append('hiding the net worth summary did not stick')
        # Payees list what was spent at each one in the month picked at the top
        await goto(page, 'accounts?tab=expense'); await page.wait_for_selector('#view .tbl td.amt')
        if '$' not in await page.locator('#view .tbl tbody tr td.amt').first.inner_text() or not await page.locator('#view .month').count():
            errors.append('the Payees tab does not show a total for the month')
        # Logos: the ones the server has show, the rest fall back to initials (the broken img is removed)
        await page.wait_for_timeout(800)
        logos = await page.evaluate("[...document.querySelectorAll('#view img.logo')].map(i => i.complete && i.naturalWidth > 0 && i.classList.contains('ok'))")
        # (the static demo build has no logo server, so there every logo falls back)
        if not all(logos) or (not logos and '/demo/' not in BASE): errors.append(f'payee logos did not load or fall back cleanly: {logos}')
        # Bills calendar: the demo's monthly bills sit on their days
        await goto(page, 'bills?view=calendar'); await page.wait_for_selector('#view .bcal-grid')
        if await page.locator('#view .bcal .bpill').count() < 3: errors.append('the bills calendar shows fewer than 3 bills')
        # Review: ticking one off takes it out of the queue
        await goto(page, 'review'); await page.wait_for_selector('#view .review-row')
        n = await page.locator('#view .review-row').count()
        await page.locator('#view .review-row .btn').first.click(); await page.wait_for_timeout(900)
        if await page.locator('#view .review-row').count() != n - 1: errors.append('ticking off a transaction did not take it out of the review queue')
        # Forecast what-if: adding one puts it in the list of what's coming
        await goto(page, 'forecast'); await page.wait_for_selector('form.whatif')
        await page.fill('form.whatif input[name=label]', 'Smoke test laptop'); await page.fill('form.whatif input[name=amount]', '900')
        await page.locator('form.whatif button').click(); await page.wait_for_function(PAINTED, timeout=15000); await page.wait_for_timeout(400)
        if not await page.locator('#view .tbl .desc', has_text='Smoke test laptop').count(): errors.append('a forecast what-if did not show up')
        await goto(page, ''); await page.wait_for_selector('#dash [data-w="payees"] .cat', timeout=15000)
        await page.evaluate('App.dashEdit(true)'); await page.wait_for_selector('#dashCols')
        # A tile's own settings: fewer recent transactions
        await page.locator('#dash [data-w="recent"] .obtn').click(); await page.wait_for_selector('#dash [data-w="recent"] .wopts:not([hidden]) select')
        await page.locator('#dash [data-w="recent"] .wopts select').select_option('5'); await page.wait_for_function(PAINTED, timeout=15000)
        await page.wait_for_selector('#dash [data-w="recent"] tr.click')
        n = await page.locator('#dash [data-w="recent"] tr.click').count()
        if n != 5: errors.append(f'the recent transactions setting showed {n} rows instead of 5')
        await page.evaluate('App.dashReset()'); await page.wait_for_function(PAINTED, timeout=15000)
        if not await page.locator('#view .hero').count(): errors.append('Reset did not bring the summary back')
        await page.evaluate('App.dashEdit(false)')
        # Signing out ends the session: the API refuses until you sign in again
        if '/demo/' not in BASE:
            await page.evaluate('App.signOut()'); await page.wait_for_selector('#login:not([hidden])')
            # (the sign-out request may still be on its way, and the flaky demo server answers some reads with a 502)
            st = await page.evaluate('''async () => { for (let i = 0; i < 20; i++) { const s = (await fetch('/api/v1/about', { headers: { 'X-Money': '1' } })).status;
              if (s !== 502 && s !== 200) return s; await new Promise(r => setTimeout(r, 200)); } return 'still signed in'; }''')
            if st != 401: errors.append(f'the session still worked after signing out: {st}')
    await br.close()
    return errors


async def screenshots(pw, out):
    br = await pw.chromium.launch()
    async def shot(route, name, w=1440, h=900, mobile=False, theme='glass', action=None, full=False):
        ctx = await br.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
        await ctx.add_cookies([{'name': 'money_session', 'value': 'demo', 'url': BASE.split('#')[0].rstrip('/') + '/api/'}])
        if theme: await ctx.add_init_script(f"localStorage.setItem('moneyTheme','{theme}')")
        pg = await ctx.new_page(); await pg.goto(BASE + '#/' + route)
        await pg.wait_for_function(PAINTED); await pg.wait_for_function("() => !document.querySelector('#view .sk, #view [aria-busy]')"); await pg.wait_for_timeout(1200)
        if action: await action(pg)
        await pg.screenshot(path=f'{out}/{name}.png', full_page=full); await ctx.close()
    async def open_tx(pg):
        await pg.locator('tr[data-gid] .desc').nth(1).click(); await pg.wait_for_selector('#txForm'); await pg.wait_for_timeout(700)
    async def quick_add(pg):
        await pg.evaluate('App.quickAdd()'); await pg.wait_for_selector('#nlq'); await pg.wait_for_timeout(300)
        await pg.locator('#nlq').press_sequentially('coffee 5.40 rewards yesterday', delay=10); await pg.wait_for_timeout(500)
    async def to_flow(pg):
        await pg.evaluate("document.querySelector('[data-w=flow]').scrollIntoView({block:'end'})"); await pg.evaluate('scrollBy(0,30)'); await pg.wait_for_timeout(500)
    await shot('', 'overview')
    await shot('', 'overview-charts', action=to_flow)
    await shot('transactions', 'transactions')
    await shot('transactions', 'quick-add', action=quick_add)
    await shot('', 'overview-light', theme='light')
    await shot('', 'phone-overview', 390, 844, True)
    await shot('transactions', 'phone-edit-sheet', 390, 844, True, action=open_tx)
    await br.close()


async def main():
    async with async_playwright() as pw:
        errs = await check(pw, 1440, 900, False) + await check(pw, 390, 844, True)
        if SHOTS:
            await screenshots(pw, SHOTS)
    if errs:
        print('FAILED'); [print(' -', e) for e in errs]; sys.exit(1)
    print('OK: every page and form opened without errors (desktop + phone)')

asyncio.run(main())
