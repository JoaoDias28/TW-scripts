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

    // default minima
    let axeMin = 6000;
    let lcMin  = 2500;
    let ramMin = 300;

    // try restore thresholds
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
        if (s) { axeMin = +s[0].value; lcMin = +s[1].value; ramMin = +s[2].value; }
    } catch (e) { console.warn("settings parse", e); }

    if (!localStorage.getItem(SETTINGS_KEY)) {
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify([
                { name: "axeMin", value: axeMin },
                { name: "lcMin",  value: lcMin  },
                { name: "ramMin", value: ramMin }
            ])
        );
    }

    const baseURL     = `game.php?screen=ally&mode=members_troops&player_id=`;
    const playerURLs  = [];
    const players     = [];
    const fullTotals  = {};
    let tribeFullSum  = 0;

    $(".flex-container").remove();
    $("div[id*='player']").remove();

    $("input:radio[name=player]").each(function () {
        const id = this.value;
        playerURLs.push(baseURL + id);
        players.push({ id, name: $(this).parent().text().trim() });
    });

    /* ------------------------------------------------------------------
       2.  CSS (dark theme)
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
       3.  $.getAll helper (polite)
    -------------------------------------------------------------------*/
    $.getAll = function (urls, each, done, fail) {
        let i = 0, last = 0, gap = 200;
        (function next () {
            if (i === urls.length) return done();
            const now = Date.now();
            if (now - last < gap) return setTimeout(next, gap - (now - last));
            $("#progress").css("width", `${((i + 1) / urls.length) * 100}%`);
            last = now;
            $.get(urls[i])
                .done(d => { try { each(i, d); ++i; next(); } catch (e) { fail(e); }})
                .fail(fail);
        })();
    };

    const fmt = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    /* ------------------------------------------------------------------
       4.  saveSettings()
    -------------------------------------------------------------------*/
    function saveSettings () {
        const a = $("#settings").serializeArray();
        axeMin = +a[0].value; lcMin = +a[1].value; ramMin = +a[2].value;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(a));
        $(".flex-container,div[id*='player']").remove();
        tribeFullSum = 0;
        displayEverything();
    }
    window.saveFullSettings = saveSettings;

    const hookCollaps = () => $(".collapsible").off("click").on("click", function(){
        this.classList.toggle("active");
        const n = this.nextElementSibling;
        n.style.maxHeight = n.style.maxHeight ? null : n.scrollHeight + "px";
    });

    /* ------------------------------------------------------------------
       5.  core calculation
    -------------------------------------------------------------------*/
    function calculateEverything () {
        $("#contentContainer,#mobileHeader").first().prepend(`<div id="progressbar" style="width:100%;background:#36393f"><div id="progress" style="width:0%;height:35px;background:#4CAF50;line-height:32px;text-align:center;color:black"></div></div>`);

        $.getAll(
            playerURLs,
            (idx, doc) => {
                const name = players[idx].name;
                fullTotals[name] = { full: 0 };

                const grabRows = d => $(d).find(".vis.w100 tr").not(":first,:last");
                let rows = grabRows(doc);

                const extras = $(doc).find(".paged-nav-item").map((_,e)=>$(e).attr("href")).get();
                $.getAll(
                    extras.slice(0, extras.length/2),
                    (_, pg)=>{ rows = $.merge(rows, grabRows(pg)); },
                    ()=>{
                        rows.each(function(){
                            const cells = $(this).children();
                            if (cells.length < 10) return; // sanity
                            const toInt = i => parseInt(cells.eq(i).text().trim().replace(/\D/g, "")) || 0;
                            const axe = toInt(5);
                            const lc  = toInt(7);
                            const ram = toInt(9);
                            if (axe >= axeMin && lc >= lcMin && ram >= ramMin) {
                                fullTotals[name].full += 1;
                                tribeFullSum += 1;
                            }
                        });
                    },
                    console.error
                );
            },
            ()=> { $("#progressbar").remove(); displayEverything(); },
            console.error
        );
    }

    /* ------------------------------------------------------------------
       6.  UI rendering
    -------------------------------------------------------------------*/
    function displayEverything () {
        let html = `
<div class="sophTitle sophHeader flex-container" style="width:800px;position:relative">
  <div class="sophHeader" style="width:550px;min-width:520px"><font size="5">Tribe Full‑Nuke Counter</font></div>
  <button class="sophRowA collapsible" style="width:250px;min-width:230px">Open settings</button>
  <div class="content submenu" style="width:200px;height:260px;z-index:99999">
    <form id="settings">
      <table style="border-spacing:2px">
        <tr><td class="item-padded"><label>Axe ≥</label></td><td class="item-padded"><input type="text" name="axeMin" value="${axeMin}" style="width:92px"></td></tr>
        <tr><td class="item-padded"><label>Light ≥</label></td><td class="item-padded"><input type="text" name="lcMin" value="${lcMin}" style="width:92px"></td></tr>
        <tr><td class="item-padded"><label>Ram ≥</label></td><td class="item-padded"><input type="text" name="ramMin" value="${ramMin}" style="width:92px"></td></tr>
        <tr><td colspan="2" class="item-padded"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="window.saveFullSettings()"></td></tr>
      </table>
    </form>
  </div>
</div>
<div class="sophHeader" style="width:800px;margin-top:5px">Tribe total full nukes: <b>${fmt(tribeFullSum)}</b></div>`;

        Object.keys(fullTotals).forEach(p=>{
            html += `<div id="player${p}" class="sophRowA" style="width:800px"><table width="100%"><tr><td class="item-padded"><b>${p}</b></td><td class="item-padded">Full nukes: ${fmt(fullTotals[p].full)}</td></tr></table></div>`;
        });

        $("#contentContainer").prepend(html);
        hookCollaps();
    }

    /* ------------------------------------------------------------------
       7.  export & init
    -------------------------------------------------------------------*/
    window.calculateEverything = calculateEverything;
    window.grabEverything      = calculateEverything;
    calculateEverything();
})();
