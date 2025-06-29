(function () {
    "use strict";

    /* ------------------------------------------------------------------
       0.  ROUTE TO ALLY‑MEMBERS PAGE IF NEEDED
    -------------------------------------------------------------------*/
    if (
        window.location.href.indexOf("&screen=ally&mode=members") < 0 ||
        window.location.href.indexOf("&screen=ally&mode=members_troops") > -1
    ) {
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
    }

    /* ------------------------------------------------------------------
       1.  GLOBALS & STORAGE
    -------------------------------------------------------------------*/
    const SETTINGS_KEY = "settingsTribeFulls";

    // defaults
    let axeMin   = 6000;
    let lcMin    = 2500;
    let ramMin   = 300;

    // Restore saved thresholds
    if (localStorage.getItem(SETTINGS_KEY)) {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            axeMin = +s[0].value;
            lcMin  = +s[1].value;
            ramMin = +s[2].value;
        } catch (e) { console.warn("Settings read fail", e); }
    } else {
        // store defaults so they appear first‑run in the menu
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify([
                { name: "axeMin", value: axeMin.toString() },
                { name: "lcMin",  value: lcMin.toString()  },
                { name: "ramMin", value: ramMin.toString() }
            ])
        );
    }

    const baseURL   = `game.php?screen=ally&mode=members_troops&player_id=`;
    const playerURLs = [];
    const players    = []; // {id,name}
    const playerData = {}; // raw village unit dump
    const fullTotals = {}; // per‑player count
    let tribeFullSum = 0;

    // cleanup in case of double‑launch
    $(".flex-container").remove();
    $("div[id*='player']").remove();

    // Collect members
    $("input:radio[name=player]").each(function () {
        const id = this.value;
        const name = $(this).parent().text().trim();
        playerURLs.push(baseURL + id);
        players.push({ id, name });
    });

    /* ------------------------------------------------------------------
       2.  DARK CSS (same as Sophie style)
    -------------------------------------------------------------------*/
    const css = `
<style>
.sophRowA{padding:10px;background:#32353b;color:#fff}
.sophHeader{padding:10px;background:#202225;font-weight:bold;color:#fff}
.sophTitle{background:#17181a}
.collapsible{background:#32353b;color:#fff;cursor:pointer;padding:10px;width:100%;border:none;text-align:left;font-size:15px}
.active,.collapsible:hover{background:#36393f}
.collapsible:after{content:'+';float:right;margin-left:5px;font-weight:bold}
.active:after{content:'-'}
.content{padding:0 5px;max-height:0;overflow:hidden;transition:max-height .2s ease-out;background:#5b5f66;color:#fff}
.item-padded{padding:5px}
.flex-container{display:flex;justify-content:space-between;align-items:center}
.submenu{display:flex;flex-direction:column;position:absolute;left:566px;top:53px;min-width:234px}
</style>`;
    $("#contentContainer,#mobileHeader").first().prepend(css);

    /* ------------------------------------------------------------------
       3.  HELPER – batch GET with polite delay
    -------------------------------------------------------------------*/
    $.getAll = function (urls, per, done, fail) {
        let idx = 0, last = 0;
        const wait = 200;
        (function next () {
            if (idx === urls.length) return done();
            const now = Date.now();
            if (now - last < wait) return setTimeout(next, wait - (now - last));
            $("#progress").css("width", `${((idx + 1) / urls.length) * 100}%`);
            last = now;
            $.get(urls[idx])
                .done(d => { try { per(idx, d); ++idx; next(); } catch (e) { fail(e); } })
                .fail(fail);
        })();
    };

    const commas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    /* ------------------------------------------------------------------
       4.  SAVE SETTINGS
    -------------------------------------------------------------------*/
    function saveSettings () {
        const arr = $("#settings").serializeArray();
        axeMin = +arr[0].value;
        lcMin  = +arr[1].value;
        ramMin = +arr[2].value;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(arr));
        $(".flex-container, div[id*='player']").remove();
        tribeFullSum = 0;
        displayEverything();
    }
    window.saveFullSettings = saveSettings; // expose for HTML onclick

    function hookCollapsibles () {
        $(".collapsible").each(function () {
            this.onclick = function () {
                this.classList.toggle("active");
                const c = this.nextElementSibling;
                c.style.maxHeight = c.style.maxHeight ? null : `${c.scrollHeight}px`;
            };
        });
    }

    /* ------------------------------------------------------------------
       5.  MAIN DATA‑GRAB LOGIC (calculateEverything)
    -------------------------------------------------------------------*/
    function calculateEverything () {
        const bar = `<div id="progressbar" style="width:100%;background:#36393f"><div id="progress" style="width:0%;height:35px;background:#4CAF50;line-height:32px;text-align:center;color:black"></div></div>`;
        $("#contentContainer,#mobileHeader").first().prepend(bar);

        $.getAll(
            playerURLs,
            (i, doc) => {
                const pname = players[i].name;
                fullTotals[pname] = { full: 0 };

                const rowsIn = d =>
                    $(d).find(".vis.w100 tr").not(":first").not(":last");

                let rows = rowsIn(doc);

                // extra pages
                const extra = $(doc).find(".paged-nav-item").map((_, el) => $(el).attr("href")).get();
                const extraPages = extra.slice(0, extra.length / 2);

                $.getAll(
                    extraPages,
                    (_, pg) => { rows = $.merge(rows, rowsIn(pg)); },
                    () => {
                        // iterate villages
                        rows.each(function () {
                            const cells = $(this).children();
                            if (!cells.length) return;
                            const unitIdx = u => game_data.units.indexOf(u);
                            const get = u => parseInt(cells.not(":first").eq(unitIdx(u)).text().trim().replace(/\D/g, "")) || 0;
                            const axe = get("axe"), lc = get("light"), ram = get("ram");
                            if (axe >= axeMin && lc >= lcMin && ram >= ramMin) {
                                fullTotals[pname].full += 1;
                                tribeFullSum += 1;
                            }
                        });
                    },
                    console.error
                );
            },
            () => { $("#progressbar").remove(); displayEverything(); },
            console.error
        );
    }

    /* ------------------------------------------------------------------
       6.  DISPLAY (displayEverything)
    -------------------------------------------------------------------*/
    function displayEverything () {
        // header + settings UI
        let html = `
<div class="sophTitle sophHeader flex-container" style="width:800px;position:relative">
  <div class="sophHeader" style="width:550px;min-width:520px"><font size="5">Tribe Full‑Nuke Counter</font></div>
  <button class="sophRowA collapsible" style="width:250px;min-width:230px">Open settings</button>
  <div class="content submenu" style="width:200px;height:260px;z-index:99999">
    <form id="settings">
      <table style="border-spacing:2px">
        <tr><td class="item-padded"><label>Axe ≥</label></td><td class="item-padded"><input type="text" name="axeMin" value="${axeMin}" style="width:92px"> u</td></tr>
        <tr><td class="item-padded"><label>Light ≥</label></td><td class="item-padded"><input type="text" name="lcMin"  value="${lcMin}" style="width:92px"> u</td></tr>
        <tr><td class="item-padded"><label>Ram ≥</label></td><td class="item-padded"><input type="text" name="ramMin" value="${ramMin}" style="width:92px"> u</td></tr>
        <tr><td colspan="2" class="item-padded"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="window.saveFullSettings()"></td></tr>
        <tr><td colspan="2" class="item-padded"><font size="1">Based on Shinko to Kuma</font></td></tr>
      </table>
    </form>
  </div>
</div>
<div class="sophHeader" style="width:800px;margin-top:5px">Tribe total full nukes: <b>${commas(tribeFullSum)}</b></div>`;

        // per‑player rows
        Object.keys(fullTotals).forEach(p => {
            html += `<div id="player${p}" class="sophRowA" style="width:800px"><table width="100%"><tr><td class="item-padded"><b>${p}</b></td><td class="item-padded">Full nukes: ${commas(fullTotals[p].full)}</td></tr></table></div>`;
        });

        $("#contentContainer").prepend(html);
        hookCollapsibles();
    }

    /* ------------------------------------------------------------------
       7.  EXPORT & RUN
    -------------------------------------------------------------------*/
    window.calculateEverything = calculateEverything;
    calculateEverything();
})();
