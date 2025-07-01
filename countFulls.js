/*************************************************************************
 * Tribe member troop counter – troop-based version
 * Original by Sophie “Shinko to Kuma”, refactored July 2025
 * ----------------------------------------------------------------------
 *  ➤ OFF buckets use raw counts:
 *      – Full Atk               axe ≥ fullAtkAxe  &&  lc ≥ fullAtkLC  &&  ram ≥ fullAtkRam
 *      – Full Atk + rams        axe ≥ plusAxe     &&  lc ≥ plusLC     &&  ram ≥ plusRam
 *        (villages that pass the second test are *not* counted in the first)
 *  ➤ DEF buckets still use population (spear/sword/archer/heavy/spy pop).
 *************************************************************************/

// ───────────────────── relocate to member list if needed ─────────────────────
if (window.location.href.indexOf('&screen=ally&mode=members') < 0 ||
    window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
    window.location.assign(game_data.link_base_pure + 'ally&mode=members');
}

// ─────────────────────────── globals & defaults ──────────────────────────────
const baseURL   = 'game.php?screen=ally&mode=members_troops&player_id=';
const playerURLs = [], players = [], playerData = {}, totals = {};
let
    // defensive pop tiers (same as the old script)
    fullPop     = 18000,
    almostPop   = 15000,
    halfPop     = 10000,
    quarterPop  =  5000,
    // Full-Atk thresholds
    fullAtkAxe  = 6000,
    fullAtkLC   = 2500,
    fullAtkRam  =  300,
    // Full-Atk + rams thresholds
    plusAxe     = 6000,
    plusLC      = 2500,
    plusRam     = 1000,
    // misc
    fangSize    =  200,
    scoutSize   = 4000;

// ─────────────────────────── load / save settings ────────────────────────────
const LS_KEY = 'settingsTribeMembersFullsAtk';
(function readSettings () {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
        const s = JSON.parse(stored);
        ({
            fullPop, almostPop, halfPop, quarterPop,
            fullAtkAxe, fullAtkLC, fullAtkRam,
            plusAxe, plusLC, plusRam,
            fangSize, scoutSize
        } = s);
    } else {
        persistSettings();
    }
})();
function persistSettings () {
    localStorage.setItem(LS_KEY, JSON.stringify({
        fullPop, almostPop, halfPop, quarterPop,
        fullAtkAxe, fullAtkLC, fullAtkRam,
        plusAxe, plusLC, plusRam,
        fangSize, scoutSize
    }));
}

// ───────────────────────── gather player IDs ────────────────────────────────
$('input:radio[name=player]').each(function () {
    playerURLs.push(baseURL + $(this).val());
    players.push({ id: $(this).val(), name: $(this).parent().text().trim() });
});

// ─────────────────────────── quick CSS injection ─────────────────────────────
const css = `
<style>
.sophRowA{padding:10px;background:#32353b;color:#fff}
.sophRowB{padding:10px;background:#36393f;color:#fff}
.sophHeader{padding:10px;background:#202225;font-weight:bold;color:#fff}
.sophTitle{background:#17181a}
.collapsible{background:#32353b;color:#fff;cursor:pointer;padding:10px;width:100%;border:none;text-align:left;font-size:15px}
.active,.collapsible:hover{background:#36393f}
.collapsible:after{content:'+';float:right;font-weight:bold;margin-left:5px}
.active:after{content:'-'}
.content{padding:0 5px;max-height:0;overflow:hidden;transition:max-height .2s ease-out;background:#5b5f66;color:#fff}
.item-padded{padding:5px}
.flex-container{display:flex;justify-content:space-between;align-items:center}
.submenu{display:flex;flex-direction:column;position:absolute;left:566px;top:53px;min-width:260px}
</style>`;
$('#contentContainer,#mobileHeader').first().prepend(css);

// ─────────────────────────── utility: batched $.get ──────────────────────────
$.getAll = function (urls, onLoad, onDone, onErr) {
    let idx = 0, last = 0, gap = 200;
    const next = () => {
        if (idx === urls.length) return onDone();
        const wait = gap - (Date.now() - last);
        if (wait > 0) return setTimeout(next, wait);
        $('#progress').css('width', ((idx + 1) / urls.length * 100) + '%');
        last = Date.now();
        $.get(urls[idx]).done(d => { onLoad(idx++, d); next(); })
                        .fail(onErr);
    };
    next();
};

// ─────────────────────────── main data collection ────────────────────────────
function collect () {
    $('#contentContainer').prepend(
      `<div id="progressbar" style="width:100%;background:#36393f">
         <div id="progress" style="width:0%;height:35px;background:#4CAF50;line-height:32px"></div>
       </div>`
    );
    $.getAll(playerURLs,
        (i, page) => grabPlayer(i, page),
        () => { $('#progressbar').remove(); buildUI(); },
        console.error
    );
}
function grabPlayer (idx, firstPage) {
    const pages = [];
    const nav = $(firstPage).find('.paged-nav-item');
    for (let p = 0; p < nav.length / 2; ++p) pages.push(nav.eq(p).attr('href'));

    const rows = [];
    const pushRows = pg => {
        const base = $(pg).find('.vis.w100 tr');
        const slice = nav.length ? base.not(':first,:first,:last') : base.not(':first');
        $.merge(rows, slice);
    };
    pushRows(firstPage);

    $.getAll(pages,
        (__, pg) => pushRows(pg),
        () => parseRows(idx, rows),
        console.error
    );
}
function parseRows (idx, rows) {
    const pdata = { total:{} };
    game_data.units.forEach(u => pdata.total[u] = 0);

    rows.forEach(row => {
        const $r = $(row);

        /* ---------- FIXED village-id extraction ---------- */
        const href = ($r.find('a[href*="info_village"]')[0] || {}).href || '';
        const m    = href.match(/[?&]id=(\d+)/);
        if (!m) return;                     // skip rows without an id
        const vId = m[1];
        /* -------------------------------------------------- */

        pdata[vId] = {};
        game_data.units.forEach((u,i)=>{
            const val = +$r.children().not(':first').eq(i+1).text().trim().replace(/\D/g,'')||0;
            pdata[vId][u] = val;
            pdata.total[u]+= val;
        });
    });

    playerData[players[idx].name] = pdata;
    totals[players[idx].name] = {
        fullAtk:0, plusAtk:0,
        fullDV:0, almostDV:0, semiDV:0, quarterDV:0,
        train:0, fang:0, scout:0
    };
}

// ────────────────────────── build the interface ──────────────────────────────
function buildUI () {
    // ── settings menu ──
    const settingsHTML = `
<div class="sophTitle sophHeader flex-container" style="width:800px;position:relative">
  <div class="sophTitle sophHeader" style="width:550px"><font size="5">Tribe member troop counter</font></div>
  <button class="sophRowA collapsible" style="width:250px">Open settings</button>
  <div class="content submenu">
   <form id="settings">
    <button type="button" class="collapsible">Full Atk thresholds</button>
    <div class="content">
      <table><tr><td>Axe ≥</td><td><input name="fullAtkAxe" value="${fullAtkAxe}" style="width:80px"></td></tr>
             <tr><td>LC ≥</td><td> <input name="fullAtkLC"  value="${fullAtkLC}"  style="width:80px"></td></tr>
             <tr><td>Rams ≥</td><td><input name="fullAtkRam" value="${fullAtkRam}" style="width:80px"></td></tr></table>
    </div>
    <button type="button" class="collapsible">Full Atk + rams</button>
    <div class="content">
      <table><tr><td>Axe ≥</td><td><input name="plusAxe" value="${plusAxe}" style="width:80px"></td></tr>
             <tr><td>LC ≥</td><td> <input name="plusLC"  value="${plusLC}"  style="width:80px"></td></tr>
             <tr><td>Rams ≥</td><td><input name="plusRam" value="${plusRam}" style="width:80px"></td></tr></table>
    </div>
    <button type="button" class="collapsible">Def pop & misc</button>
    <div class="content">
      <table><tr><td>Full DV</td><td><input name="fullPop" value="${fullPop}" style="width:80px"> pop</td></tr>
             <tr><td>¾ DV</td><td>   <input name="almostPop" value="${almostPop}" style="width:80px"></td></tr>
             <tr><td>½ DV</td><td>   <input name="halfPop" value="${halfPop}" style="width:80px"></td></tr>
             <tr><td>¼ DV</td><td>   <input name="quarterPop" value="${quarterPop}" style="width:80px"></td></tr>
             <tr><td>Fang ≥</td><td> <input name="fangSize" value="${fangSize}" style="width:80px"></td></tr>
             <tr><td>Scout ≥</td><td><input name="scoutSize" value="${scoutSize}" style="width:80px"></td></tr></table>
    </div>
    <p style="padding:8px"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="saveSettings();"></p>
   </form>
  </div>
</div>`;
    $('#contentContainer').prepend(settingsHTML);

    // ── classify villages ──
    players.forEach(pl => {
        const pName = pl.name, pData = playerData[pName], t = totals[pName];
        Object.keys(pData).forEach(vID => {
            if (vID === 'total') return;
            const v = pData[vID];
            const axe=v.axe||0, lc=v.light||0, r=v.ram||0;

            const plusOK  = (axe>=plusAxe  && lc>=plusLC  && r>=plusRam);
            const fullOK  = (!plusOK) && (axe>=fullAtkAxe && lc>=fullAtkLC && r>=fullAtkRam);
            if (plusOK) t.plusAtk++; else if (fullOK) t.fullAtk++;

            // defensive pop
            const defPop = v.spear + v.sword + v.archer + 6*(v.heavy||0) + 2*(v.spy||0);
            if      (defPop>=fullPop)    t.fullDV++;
            else if (defPop>=almostPop)  t.almostDV++;
            else if (defPop>=halfPop)    t.semiDV++;
            else if (defPop>=quarterPop) t.quarterDV++;

            if ((v.snob||0)>=4)        t.train++;
            if ((v.catapult||0)>fangSize) t.fang++;
            if ((v.spy||0)>scoutSize)  t.scout++;
        });
    });

    // ── output per player ──
    let html = '';
    players.forEach(pl => {
        const pName = pl.name, t = totals[pName];
        html += `<div id="player${pName}" class="sophHeader" style="width:800px">
  <p style="padding:10px">${pName}</p>
  <div class="sophRowA"><table width="100%"><tr>
    <td><table>
      <tr><td class="item-padded">Full Atk:</td><td class="item-padded">${t.fullAtk}</td></tr>
      <tr><td class="item-padded">Full Atk + rams:</td><td class="item-padded">${t.plusAtk}</td></tr>
    </table></td>
    <td><table>
      <tr><td class="item-padded">Full DV:</td><td class="item-padded">${t.fullDV}</td></tr>
      <tr><td class="item-padded">¾ DV:</td><td class="item-padded">${t.almostDV}</td></tr>
      <tr><td class="item-padded">½ DV:</td><td class="item-padded">${t.semiDV}</td></tr>
      <tr><td class="item-padded">¼ DV:</td><td class="item-padded">${t.quarterDV}</td></tr>
    </table></td>
    <td><table>
      <tr><td class="item-padded">Trains:</td><td class="item-padded">${t.train}</td></tr>
      <tr><td class="item-padded">Fangs:</td><td class="item-padded">${t.fang}</td></tr>
      <tr><td class="item-padded">Scout vil:</td><td class="item-padded">${t.scout}</td></tr>
    </table></td></tr></table></div>
  <button class="collapsible">More details</button>
  <div class="content"><table><tr>`;
        Object.entries(playerData[pName].total).forEach(([u,c],i) => {
            if (['spy','ram','snob'].includes(u) && i) html += '</tr><tr>';
            html += `<td><table><tr><td class="item-padded">
               <img src="/graphic/unit/unit_${u}.png" title="${u}"></td>
               <td class="item-padded">${c.toLocaleString('de')}</td></tr></table></td>`;
        });
        html += `</tr></table></div></div>`;
    });
    $('#contentContainer').append(html);
    enableCollapsibles();
}

// ────────────────────────── misc helpers ────────────────────────────
function enableCollapsibles () {
    document.querySelectorAll('.collapsible').forEach(btn =>
        btn.addEventListener('click', function () {
            this.classList.toggle('active');
            const c = this.nextElementSibling;
            c.style.maxHeight = c.style.maxHeight ? null : c.scrollHeight + 'px';
        })
    );
}
function saveSettings () {
    const m = Object.fromEntries($('#settings').serializeArray().map(o => [o.name,+o.value]));
    ({
        fullPop, almostPop, halfPop, quarterPop,
        fullAtkAxe, fullAtkLC, fullAtkRam,
        plusAxe, plusLC, plusRam,
        fangSize, scoutSize
    } = m);
    persistSettings();
    $('.flex-container').remove(); $('[id^=player]').remove();
    buildUI();
}

// ──────────────────────────── run! ──────────────────────────────────
collect();

