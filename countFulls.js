
    /* --------------------------------------------------
       1.  RE‑ROUTE TO THE TROOP OVERVIEW FOR MEMBERS
    ---------------------------------------------------*/
    if (
        window.location.href.indexOf("&screen=ally&mode=members") < 0 ||
        window.location.href.indexOf("&screen=ally&mode=members_troops") > -1
    ) {
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
    }

    /* --------------------------------------------------
       2.  GLOBALS & USER SETTINGS
    ---------------------------------------------------*/
    const SETTINGS_KEY = "settingsNukeCriteria";

    // Default thresholds (edit here or via the UI once the script is running)
    let axeMin = 6000;
    let lcMin = 2500;
    let ramMin = 300;
    let scoutSize = 4000; // still used to detect "scout" villages if you wish

    // Load user‑defined settings if present
    if (localStorage.getItem(SETTINGS_KEY) !== null) {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            axeMin = parseInt(saved[0].value, 10);
            lcMin = parseInt(saved[1].value, 10);
            ramMin = parseInt(saved[2].value, 10);
            if (saved[3] !== undefined) scoutSize = parseInt(saved[3].value, 10);
        } catch (e) {
            console.warn("Could not parse saved settings, using defaults.");
        }
    } else {
        // Persist defaults on first run so they appear in the UI
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify([
                { name: "axeMin", value: axeMin.toString() },
                { name: "lcMin", value: lcMin.toString() },
                { name: "ramMin", value: ramMin.toString() },
                { name: "scoutSize", value: scoutSize.toString() }
            ])
        );
    }

    /* --------------------------------------------------
       3.  DATA STRUCTURES
    ---------------------------------------------------*/
    const baseURL = `game.php?screen=ally&mode=members_troops&player_id=`;
    const playerURLs = [];
    const playerMeta = []; // {id, name}
    const playerData = {}; // full village/unit dump per player
    const fullCounts = {}; // {playerName: {fullNuke: x}}
    let tribeTotalFulls = 0;

    // Clean up any previous accidental double‑launch
    $(".flex-container").remove();
    $("div[id*='player']").remove();

    /* --------------------------------------------------
       4.  COLLECT MEMBER IDS & BUILD URL LIST
    ---------------------------------------------------*/
    $("input:radio[name=player]").each(function () {
        const id = $(this).attr("value");
        playerURLs.push(baseURL + id);
        playerMeta.push({ id, name: $(this).parent().text().trim() });
    });

    /* --------------------------------------------------
       5.  INSERT CSS FOR DARK UI
    ---------------------------------------------------*/
    const cssInject = `
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

    $("#contentContainer, #mobileHeader").first().prepend(cssInject);

    /* --------------------------------------------------
       6.  HELPER FUNCTIONS (AJAX BATCH, COLLAPSIBLE, FORMATING)
    ---------------------------------------------------*/
    $.getAll = function (urls, onLoad, onDone, onError) {
        let numDone = 0;
        let lastRequestTime = 0;
        const minWaitTime = 200;
        const loadNext = () => {
            if (numDone === urls.length) return onDone();
            const now = Date.now();
            const delta = now - lastRequestTime;
            if (delta < minWaitTime) return setTimeout(loadNext, minWaitTime - delta);
            $("#progress").css("width", `${((numDone + 1) / urls.length) * 100}%`);
            lastRequestTime = now;
            $.get(urls[numDone])
                .done(data => {
                    try {
                        onLoad(numDone, data);
                        ++numDone;
                        loadNext();
                    } catch (e) {
                        onError(e);
                    }
                })
                .fail(xhr => onError(xhr));
        };
        loadNext();
    };

    const numberWithCommas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    const makeCollapsibles = () => {
        $(".collapsible").each(function () {
            this.addEventListener("click", function () {
                this.classList.toggle("active");
                const c = this.nextElementSibling;
                c.style.maxHeight = c.style.maxHeight ? null : `${c.scrollHeight}px`;
            });
        });
    };

    /* --------------------------------------------------
       7.  BUILD & SAVE THE SETTINGS MENU
    ---------------------------------------------------*/
    function saveSettings() {
        const arr = $("#settings").serializeArray();
        axeMin = parseInt(arr[0].value, 10);
        lcMin = parseInt(arr[1].value, 10);
        ramMin = parseInt(arr[2].value, 10);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(arr));
        $(".flex-container").remove();
        $("div[id*='player']").remove();
        tribeTotalFulls = 0;
        displayEverything();
    }

    /* --------------------------------------------------
       8.  MAIN DATA‑GATHERING ROUTINE
    ---------------------------------------------------*/
    function grabEverything() {
        // progress bar UI
        const barHTML = `<div id="progressbar" style="width:100%;background:#36393f"><div id="progress" style="width:0%;height:35px;background:#4CAF50;line-height:32px;text-align:center;color:black"></div></div>`;
        $("#contentContainer, #mobileHeader").first().prepend(barHTML);

        $.getAll(
            playerURLs,
            (i, data) => {
                /* ~~~~~~~~~ Per‑player callback ~~~~~~~~~ */
                const rowsAllPages = $();
                const addRowsFromDoc = doc => {
                    let rows;
                    if ($(doc).find(".paged-nav-item").length === 0) {
                        rows = $(doc).find(".vis.w100 tr").not(":first");
                    } else {
                        rows = $(doc).find(".vis.w100 tr").not(":first").not(":first").not(":last");
                    }
                    return rows;
                };

                let rows = addRowsFromDoc(data);

                const extraPages = [];
                $(data)
                    .find(".paged-nav-item")
                    .each((p, el) => {
                        if (p < $(data).find(".paged-nav-item").length / 2) extraPages.push($(el).attr("href"));
                    });

                // fetch remaining pages synchronously per player
                $.getAll(
                    extraPages,
                    (p, d) => {
                        rows = $.merge(rows, addRowsFromDoc(d));
                    },
                    () => {
                        // finished gathering this player
                        const thisPlayerName = playerMeta[i].name;
                        fullCounts[thisPlayerName] = { fullNuke: 0 };

                        // iterate villages
                        rows.each(function () {
                            const cells = $(this).children();
                            if (cells.length === 0) return;

                            const getInt = idx => parseInt(cells.not(":first").eq(idx).text().trim().replace(/\D/g, "")) || 0;
                            const axe = getInt(game_data.units.indexOf("axe"));
                            const lc = getInt(game_data.units.indexOf("light"));
                            const ram = getInt(game_data.units.indexOf("ram"));

                            if (axe >= axeMin && lc >= lcMin && ram >= ramMin) {
                                fullCounts[thisPlayerName].fullNuke += 1;
                                tribeTotalFulls += 1;
                            }
                        });
                    },
                    err => console.error(err)
                );
            },
            () => {
                $("#progressbar").remove();
                displayEverything();
            },
            err => console.error(err)
        );
    }

    /* --------------------------------------------------
       9.  UI RENDERING
    ---------------------------------------------------*/
    function displayEverything() {
        // Build settings & tribe summary header
        let html = `
<div class="sophTitle sophHeader flex-container" style="width:800px;position:relative">
  <div class="sophTitle sophHeader" style="width:550px;min-width:520px"><font size="5">Tribe nuke counter</font></div>
  <button class="sophRowA collapsible" style="width:250px;min-width:230px">Open settings</button>
  <div class="content submenu" style="width:200px;height:320px;z-index:99999">
    <form id="settings">
      <table style="border-spacing:2px">
        <tr><td class="item-padded"><label for="axeMin">Axe ≥</label></td><td class="item-padded"><input type="text" name="axeMin" value="${axeMin}" style="width:92px"> units</td></tr>
        <tr><td class="item-padded"><label for="lcMin">Light Cav ≥</label></td><td class="item-padded"><input type="text" name="lcMin" value="${lcMin}" style="width:92px"> units</td></tr>
        <tr><td class="item-padded"><label for="ramMin">Ram ≥</label></td><td class="item-padded"><input type="text" name="ramMin" value="${ramMin}" style="width:92px"> units</td></tr>
        <tr><td colspan="2" style="padding:6px"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="(${saveSettings.toString()})()"></td></tr>
        <tr><td colspan="2" class="item-padded"><p><font size="1">Script adapted from Shinko to Kuma</font></p></td></tr>
      </table>
    </form>
  </div>
</div>

<div class="sophHeader" style="width:800px;margin-top:5px">Tribe total full nukes: <b>${numberWithCommas(tribeTotalFulls)}</b></div>`;

        // Per‑player list
        Object.keys(fullCounts).forEach(playerName => {
            html += `<div id="player${playerName}" class="sophRowA" style="width:800px">
                <table width="100%"><tr>
                  <td style="padding:5px"><b>${playerName}</b></td>
                  <td style="padding:5px">Full nukes: ${numberWithCommas(fullCounts[playerName].fullNuke)}</td>
                </tr></table>
              </div>`;
        });

        $("#contentContainer").prepend(html);
        makeCollapsibles();
    }

    /* --------------------------------------------------
       10.  RUN
    ---------------------------------------------------*/
    grabEverything();
}
