javascript:

if (window.location.href.indexOf('&screen=ally&mode=members') < 0 || window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
    window.location.assign(game_data.link_base_pure + "ally&mode=members");
}

var baseURL = `game.php?screen=ally&mode=members_troops&player_id=`;
var playerURLs = [];
var villageData = {};
var playerData = {};
var player = [];
var typeTotals = {};
var bucketVillages = {};
var requireNoble;   

/* ---------- DEF tab globals ---------- */
const baseDefURL      = `game.php?screen=ally&mode=members_defense&player_id=`;
const defPlayerURLs   = [];              // per-player fetch list
const defenseData     = {};              // player->village->unit map
const defTotals       = {};              // player-level village counts
const bucketDefense   = {};              // player-level village lists

// UI thresholds
var maxAvailableDefPop;
// --- NEW ---: Add unit speeds and travel time settings variables
var minAxeAntiBunk, minLightAntiBunk, minRamAntiBunk, minAxeFullAtk, minLightFullAtk, minRamFullAtk;
var targetVillage, maxTime, travelUnit;
const unitSpeeds = {
    spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
    cavlight: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
    knight: 10, noble: 35
};
// --- END NEW ---

$(".flex-container").remove();
$("div[id*='player']").remove();
$("#ally-troop-counter-main").remove();

// --- NEW ---: Helper functions for distance and time calculation
function getDistance(coords1, coords2) {
    try {
        const [x1, y1] = coords1.split('|').map(Number);
        const [x2, y2] = coords2.split('|').map(Number);
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return 0;
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    } catch (e) {
        return 0;
    }
}

function parseTimeToSeconds(timeString) { // HH:MM:SS
    try {
        const parts = timeString.split(':').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return 0;
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } catch(e) {
        return 0;
    }
}

function formatTimeFromSeconds(totalSeconds) {
    if (totalSeconds < 0) return 'N/A';
    totalSeconds = Math.round(totalSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
}
// --- END NEW ---

// --- MODIFIED ---: Settings loading function
function loadSettings() {
    let defaults = {
        minAxeAntiBunk: "4500",
        minLightAntiBunk: "2000",
        minRamAntiBunk: "1000",
        minAxeFullAtk: "4500",
        minLightFullAtk: "2000",
        minRamFullAtk: "300",
        maxAvailableDefPop:"24000",
        targetVillage: "",
        maxTime: "12:00:00",
        travelUnit: "ram",
        requireNoble: "off"
    };

    let settings = localStorage.getItem("settingsTribeMembersFullAtk");
    let settingsObj = {};

    if (settings) {
        let parsedSettings = JSON.parse(settings);
        if (Array.isArray(parsedSettings)) {
            parsedSettings.forEach(item => {
                settingsObj[item.name] = item.value;
            });
        } else {
            settingsObj = parsedSettings;
        }
    }

    let finalSettings = { ...defaults, ...settingsObj };

    minAxeAntiBunk = finalSettings.minAxeAntiBunk;
    minLightAntiBunk = finalSettings.minLightAntiBunk;
    minRamAntiBunk = finalSettings.minRamAntiBunk;
    minAxeFullAtk = finalSettings.minAxeFullAtk;
    minLightFullAtk = finalSettings.minLightFullAtk;
    minRamFullAtk = finalSettings.minRamFullAtk;
    maxAvailableDefPop = finalSettings.maxAvailableDefPop;
    targetVillage = finalSettings.targetVillage;
    maxTime = finalSettings.maxTime;
    travelUnit = finalSettings.travelUnit;
    requireNoble = finalSettings.requireNoble === "on";
}

loadSettings(); // Initial call


$('input:radio[name=player]').each(function () {
    playerURLs.push(baseURL + $(this).attr("value"));
    defPlayerURLs.push(baseDefURL + $(this).attr("value"));
    player.push({ "id": $(this).attr("value"), "name": $(this).parent().text().trim() });
});

const improvedCSS = `
<style>
    :root {
        --atc-bg-main: #2e3136;
        --atc-bg-header: #202225;
        --atc-bg-card: #36393f;
        --atc-bg-card-header: #2a2d31;
        --atc-bg-interactive: #40444b;
        --atc-bg-interactive-hover: #4d525a;
        --atc-text-light: #dcddde;
        --atc-text-header: #ffffff;
        --atc-border-color: #4f545c;
        --atc-accent-color: #4CAF50;
        --atc-href-color: #5794e6;
    }
    #ally-troop-counter-main {
        width: 850px;
        margin: 15px auto;
        color: var(--atc-text-light);
        background-color: var(--atc-bg-main);
        border: 1px solid var(--atc-bg-header);
        border-radius: 5px;
        padding-bottom: 5px;
    }
    .atc-main-header {
        background-color: var(--atc-bg-header);
        color: var(--atc-text-header);
        padding: 12px 20px;
        border-radius: 5px 5px 0 0;
        text-align: center;
    }
    .atc-main-title {
        font-size: 20px;
        font-weight: bold;
    }
    .atc-grand-totals {
        display: flex;
        justify-content: center;
        gap: 30px;
        padding: 12px;
        background-color: var(--atc-bg-card-header);
        font-size: 16px;
        font-weight: bold;
        border-bottom: 1px solid var(--atc-border-color);
    }
    .atc-grand-totals .total-count {
        color: var(--atc-accent-color);
        margin-left: 8px;
    }
    .atc-player-card {
        background-color: var(--atc-bg-card);
        margin: 10px 10px 0 10px;
        border: 1px solid var(--atc-border-color);
        border-radius: 4px;
        overflow: hidden;
    }
    .atc-player-header {
        padding: 12px 15px;
        font-size: 16px;
        font-weight: bold;
        background-color: var(--atc-bg-card-header);
    }
    .atc-player-body {
        padding: 15px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }
    .atc-category h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: var(--atc-text-header);
    }
    .atc-category h4 .count {
        background-color: var(--atc-accent-color);
        color: black;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 12px;
        margin-left: 8px;
    }
    .collapsible {
        background-color: var(--atc-bg-interactive);
        color: var(--atc-text-light);
        cursor: pointer;
        padding: 10px 15px;
        width: 100%;
        border: 1px solid var(--atc-border-color);
        border-radius: 3px;
        text-align: left;
        outline: none;
        font-size: 14px;
        transition: background-color 0.2s ease;
    }
    .collapsible:hover, .collapsible.active {
        background-color: var(--atc-bg-interactive-hover);
    }
    .collapsible:after {
        content: '+';
        color: var(--atc-text-light);
        font-weight: bold;
        float: right;
    }
    .collapsible.active:after {
        content: "-";
    }
    .content {
        padding: 0;
        max-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        transition: max-height 0.3s ease-out;
        background-color: var(--atc-bg-interactive);
        border-radius: 0 0 3px 3px;
        border: 1px solid var(--atc-border-color);
        border-top: none;
        margin-bottom: 10px;
    }
    .atc-settings-wrapper {
        margin: 10px 10px 0 10px;
    }
    .atc-settings-panel {
        padding: 20px;
    }
    .atc-settings-form table {
        width: 100%;
    }
    .atc-settings-form th {
        text-align: left;
        padding: 10px 0 5px 0;
        border-bottom: 1px solid var(--atc-border-color);
    }
    .atc-settings-form td {
        padding: 8px 4px;
    }
    .atc-settings-form input[type="text"], .atc-settings-form select {
        width: 120px;
        padding: 4px;
        background-color: var(--atc-bg-main);
        color: var(--atc-text-light);
        border: 1px solid var(--atc-border-color);
    }
    .atc-totals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 10px;
        padding: 10px;
    }
    .def-inline .atc-totals-grid{
    display:flex;               /* ditch the auto-fill grid        */
    gap:12px;                   /* space between the three pills   */
    justify-content:flex-start; /* keep them left-aligned           */
    }
    .atc-troop-item {
        display: flex;
        align-items: center;
        background-color: rgba(0,0,0,0.2);
        padding: 5px;
        border-radius: 3px;
    }
    .atc-troop-item img { margin-right: 8px; }
    .village-list-table {
        width: 100%;
        border-collapse: collapse;
    }
    .village-list-table th {
        background-color: var(--atc-bg-card-header);
        padding: 8px;
        text-align: right;
    }
    .village-list-table th:first-child { text-align: left; }
    .village-list-table td {
        padding: 6px 8px;
        border-top: 1px solid var(--atc-border-color);
        text-align: right;
    }
    .village-list-table a {
    color: var(--atc-href-color);
    }
    .village-list-table td:first-child { text-align: left; }
    .village-list-table tr:nth-child(even) { background-color: rgba(0,0,0,0.15); }
    #atc-progressbar { width: 100%; background-color: var(--atc-bg-card); border-radius: 5px; overflow: hidden; height: 30px; margin-bottom: 10px; }
    #atc-progress { width: 0%; height: 100%; background-color: var(--atc-accent-color); transition: width 0.3s ease; text-align: center; line-height: 30px; color: black; font-weight: bold; }
[data-tip]{
    position:relative; cursor:help;
}
[data-tip]::after{
    content:attr(data-tip);
    position:absolute; left:50%; bottom:75%;
    transform:translateX(-50%) scale(0);
    background:#111; color:#eee; padding:6px 8px;
    border-radius:4px; font-size:12px; line-height:1.3;
    white-space:pre; z-index:9999; pointer-events:none;
    transition:transform .15s ease-out, opacity .15s;
    opacity:0;
}
[data-tip]::before{                /* little arrow */
    content:"";
    position:absolute; left:50%; bottom:115%;
    transform:translateX(-50%) scale(0);
    border:6px solid transparent;
    border-top-color:#111; z-index:9998;
    transition:transform .15s ease-out, opacity .15s;
    opacity:0;
}
[data-tip]:hover::after,
[data-tip]:hover::before{
    transform:translateX(-50%) scale(1);
    opacity:1;
}
    </style>`;

$("#contentContainer").eq(0).prepend(improvedCSS);
$("#mobileHeader").eq(0).prepend(improvedCSS);

$.getAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0;
    var lastRequestTime = 0;
    var minWaitTime = 200;
    loadNext();
    function loadNext() {
        if (numDone == urls.length) {
            onDone();
            return;
        }
        let now = Date.now();
        let timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) {
            let timeRemaining = minWaitTime - timeElapsed;
            setTimeout(loadNext, timeRemaining);
            return;
        }
         lastRequestTime = now;
        $.get(urls[numDone])
            .done((data) => {
                try {
                    onLoad(numDone, data);
                    ++numDone;
                    loadNext();
                } catch (e) {
                    (onError || console.error)(e);
                }
            })
            .fail((xhr) => {
               (onError || console.error)(xhr); 
            });
    }
};

function calculateEverything() {
     let doneTroops = false, doneDef = false;
let offPlayersDone = 0;   // counts players whose OFF pages are fully parsed
let defPlayersDone = 0;   // counts players whose DEF page is parsed
    
  const progressBarHtml = `
        <div id="ally-troop-counter-main">
            <div id="atc-progressbar">
                <div id="atc-progress">0 / ${playerURLs.length * 2}</div>
            </div>
        </div>`;
          const renderIfReady = () => { if (doneTroops && doneDef) { $("#atc-progressbar").remove(); displayEverything(); } };
    $("#contentContainer").eq(0).prepend(progressBarHtml);

     /* ========== pass 1: OFFENSIVE ========== */
    $.getAll(playerURLs,
        (i, data) => {
            console.log("Grabbing player nr " + i);
            console.log("Grabbing page nr 0");
            villageData = {};
            villageData["total"] = {}
            if ($(data).find(".paged-nav-item").length == 0) {
                rows = $(data).find(".vis.w100 tr").not(':first');
            } else {
                rows = $(data).find(".vis.w100 tr").not(':first').not(":first").not(":last");
            }
            var allPages = []
            for (var pages = 0; pages < $(data).find(".paged-nav-item").length / 2; pages++) {
                allPages.push($(data).find(".paged-nav-item").eq(pages).attr("href"));
            }
            console.log(allPages);
            $.getAll(allPages,
                (p, getMore) => {
                    console.log("Grabbing page nr " + (p + 1));
                    if ($(getMore).find(".paged-nav-item").length == 0) {
                        rows = $.merge(rows, $(getMore).find(".vis.w100 tr").not(':first'));
                    } else {
                        rows = $.merge(rows, $(getMore).find(".vis.w100 tr").not(':first').not(":first").not(":last"));
                    }
                },
                () => {
                    console.log("Rows for player " + player[i].name + " total: " + rows.length);
                    $.each(game_data.units, function (index) {
                        unitName = game_data.units[index];
                        villageData["total"][unitName] = 0;
                    })
                    $.each(rows, function (rowNr) {
                        const anchor = rows.eq(rowNr).find("a")[0];
                        if (!anchor) return;
                        const thisID = anchor.outerHTML.match(/id=(\d+)/)[1];
                        villageData[thisID] = {};
                        const linkTxt = rows.eq(rowNr).find('a').text();
                        const mCoords = linkTxt.match(/(\d+\|\d+)/);
                        const mContinent = linkTxt.match(/(K\d{2})/);
                        villageData[thisID]['coords'] = mCoords ? mCoords[1] : '?';
                          villageData[thisID]['continent'] = mContinent ? mContinent[1] : '?'; 
                        $.each(game_data.units, function (index) {
                            const unitName = game_data.units[index];
                            const unitValue = rows.eq(rowNr).children().not(':first').eq(index + 1).text().trim();
                            if (unitValue !== '?') {
                                villageData[thisID][unitName] = parseInt(unitValue);
                                villageData["total"][unitName] += parseInt(unitValue);
                            } else {
                                villageData[thisID][unitName] = 0;
                            }
                        });
                    });
                    playerData[player[i].name] = villageData;
                    typeTotals[player[i].name] = { "AntiBunk": 0, "FullAtk": 0 };
                    bucketVillages[player[i].name] = { AntiBunk: [], FullAtk: [] };
                      offPlayersDone++;
        $("#atc-progress").css("width",
               `${(offPlayersDone + defPlayersDone) / (player.length * 2) * 100}%`)
               .text(`${offPlayersDone + defPlayersDone} / ${player.length * 2}`);

        if (offPlayersDone === player.length) {
            doneTroops = true;
          

            renderIfReady();
        }
                },
                (error) => {
                    console.error(error);
                });
        },
        () => {},      
        (error) => {
            console.error(error);
        });

         /* ========== pass 2: DEFENSIVE ========== */
    $.getAll(defPlayerURLs,
        (i, data) => {
        
            const $rows = $(data).find(".vis.w100 tr").not(':first');
            const pName = player[i].name;            // same player index
            if (!defenseData[pName]) {
                defenseData[pName]  = {};
                defTotals[pName]    = 0;
                bucketDefense[pName]= [];
            }

            $rows.each(function () {
                const $tds = $(this).children();
                if ($tds.eq(2).text().trim() !== 'na aldeia') return;
                console.log($tds.eq(2).text().trim());
                const anchor = $(this).find('a')[0];
                if (!anchor) return;
                const vID = anchor.href.match(/id=(\d+)/)[1];
                const link = $tds.first().text();            // coords + KXY
                const mCoords    = link.match(/(\d+\|\d+)/);
                const mContinent = link.match(/K\d{2}/);

                defenseData[pName][vID] = {
                    coords    : mCoords    ? mCoords[1] : '?',
                    continent : mContinent ? mContinent[0] : '?'
                };

                // parse spear / sword / heavy columns (index based on world’s unit order)
                const spear = +$tds.eq(3).text().trim() || 0;
                const sword = +$tds.eq(4).text().trim() || 0;
                const heavy = +$tds.eq(8).text().trim() || 0;

                const axe = +$tds.eq(5).text().trim() || 0;
                const light = +$tds.eq(7).text().trim() || 0;
                const ram = +$tds.eq(9).text().trim() || 0;

                const offAvailablePop = axe + light * 4 + ram * 5;
                const defPop = spear + sword + heavy * 6;
                defenseData[pName][vID].spear = spear;
                defenseData[pName][vID].sword = sword;
                defenseData[pName][vID].heavy = heavy;

                if (defPop <= +maxAvailableDefPop && offAvailablePop <= 5000) {
                    defTotals[pName]         += 1;
                    bucketDefense[pName].push(defenseData[pName][vID]);
                }
                
            });
            defPlayersDone++;
$("#atc-progress").css("width",
       `${(offPlayersDone + defPlayersDone) / (player.length * 2) * 100}%`)
       .text(`${offPlayersDone + defPlayersDone} / ${player.length * 2}`);

if (defPlayersDone === player.length) {
    doneDef = true;
 
    renderIfReady();
}

        },
    () => {},      
        (e)=>console.error(e));

}

calculateEverything();
function makeThingsCollapsible() {
    $(document).off('click', '.collapsible').on('click', '.collapsible', function () {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
}
function numberWithCommas(x) {
    x = x.toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1.$2");
    return x;
}

// --- MODIFIED ---: Save settings and recalculate
function saveSettings() {
    tempArray = $("#settings").serializeArray();
    localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(tempArray));
    loadSettings();
    $(".flex-container").remove();
    $("div[id*='player']").remove();
    $("#ally-troop-counter-main").remove();
    displayEverything();
}
// --- END MODIFIED ---

// --- MODIFIED ---: Main display function with filtering logic
function displayEverything() {
    let grandTotalAntiBunk = 0;
    let grandTotalFullAtk = 0;


    const isTimeFilterActive = targetVillage && targetVillage.match(/\d+\|\d+/) && maxTime && maxTime.match(/\d+:\d+:\d+/);
    const maxTimeSeconds = isTimeFilterActive ? parseTimeToSeconds(maxTime) : 0;
    const unitSpeed = isTimeFilterActive ? unitSpeeds[travelUnit] : 0;

    $.each(playerData, function (playerName) {
        typeTotals[playerName] = { "AntiBunk": 0, "FullAtk": 0 };
        bucketVillages[playerName] = { AntiBunk: [], FullAtk: [] };

        const villageIds = Object.keys(playerData[playerName]).filter(key => key !== "total");
        for (const villageId of villageIds) {
            const village = playerData[playerName][villageId];

            let travelTimeSeconds = -1;
            if (isTimeFilterActive) {
                const distance = getDistance(village.coords, targetVillage);
                if (distance > 0 && unitSpeed > 0) {
                    travelTimeSeconds = distance * unitSpeed * 60;
                    if (travelTimeSeconds > maxTimeSeconds) {
                        continue; // Skip village, it's too far
                    }
                } else {
                    continue; // Cannot calculate time, skip if filter is active
                }
            }

            const thisVillageAxeUnits = village.axe || 0;
            const thisVillageLightUnits = village.light || 0;
            const thisVillageRamUnits = village.ram || 0;
            const thisVillageNobleUnits = village.snob || village.noble || 0;
            if (thisVillageAxeUnits >= minAxeAntiBunk && thisVillageLightUnits >= minLightAntiBunk && thisVillageRamUnits >= minRamAntiBunk && (!requireNoble || thisVillageNobleUnits > 0) ) {
                typeTotals[playerName]["AntiBunk"] += 1;
                bucketVillages[playerName].AntiBunk.push({ coord: village.coords, continent: village.continent, axe: thisVillageAxeUnits, lc: thisVillageLightUnits, ram: thisVillageRamUnits, travelTime: travelTimeSeconds, noble: thisVillageNobleUnits, });
            } else if (thisVillageAxeUnits >= minAxeFullAtk && thisVillageLightUnits >= minLightFullAtk && thisVillageRamUnits >= minRamFullAtk && thisVillageRamUnits < minRamAntiBunk && (!requireNoble || thisVillageNobleUnits > 0) ) {
                typeTotals[playerName]["FullAtk"] += 1;
                bucketVillages[playerName].FullAtk.push({ coord: village.coords, continent: village.continent, axe: thisVillageAxeUnits, lc: thisVillageLightUnits, ram: thisVillageRamUnits, travelTime: travelTimeSeconds, noble: thisVillageNobleUnits, });
            }
        }
        grandTotalAntiBunk += typeTotals[playerName]["AntiBunk"];
        grandTotalFullAtk += typeTotals[playerName]["FullAtk"];
    });

    let html = `
    <div id="ally-troop-counter-main">
        <div class="atc-main-header">
            <div class="atc-main-title">Full Atk / Anti Bunk Tribe Counter</div>
        </div>
        <div class="atc-grand-totals">
            <div>Tribe Anti-Bunk Nukes: <span class="total-count">${grandTotalAntiBunk}</span></div>
            <div>Tribe Standard Full-Atk: <span class="total-count">${grandTotalFullAtk}</span></div>
        </div>
        <div class="atc-settings-wrapper">
            <button class="collapsible">Settings & Filters</button>
            <div class="content">
                <div class="atc-settings-panel">
                    <form id="settings" class="atc-settings-form">
                        <table>
                        <tr><th style="margin-top:10px" data-tip="Tick to show villages that have fulls + nobles ready" colspan="2">Require Noble</th></tr>
                        <tr>
                            <td colspan="2">
                            <label style="white-space:nowrap">
                              <input name="requireNoble" type="checkbox" ${requireNoble ? "checked" : ""}>
                              Show only villages with ≥ 1 Noble
                             </label>
                            </td>
                        </tr>
                            <tr><th colspan="2">Anti-Bunk Thresholds</th></tr>
                            <tr><td>Axe ≥</td><td><input name="minAxeAntiBunk" type="text" value="${minAxeAntiBunk}"></td></tr>
                            <tr><td>CL ≥</td><td><input name="minLightAntiBunk" type="text" value="${minLightAntiBunk}"></td></tr>
                            <tr><td>Ram ≥</td><td><input name="minRamAntiBunk" type="text" value="${minRamAntiBunk}"></td></tr>
                            <tr><th colspan="2">Full-Atk Thresholds</th></tr>
                            <tr><td>Axe ≥</td><td><input name="minAxeFullAtk" type="text" value="${minAxeFullAtk}"></td></tr>
                            <tr><td>CL ≥</td><td><input name="minLightFullAtk" type="text" value="${minLightFullAtk}"></td></tr>
                            <tr><td>Ram ≥</td><td><input name="minRamFullAtk" type="text" value="${minRamFullAtk}"></td></tr>
                            <tr><th data-tip="Only count villages whose *home* spear+sword+heavy population is at or below this value.\n So to not count bunks " colspan="2">Available-defense pop limit</th></tr>
                            <tr>
                                <td  colspan="2">
                                    <select onchange="document.getElementsByName('maxAvailableDefPop')[0].value=this.value;">
                                        <option value="24000">24 000</option>
                                        <option value="26400">26 400</option>
                                        <option value="30000">30 000</option>
                                    </select>
                                    or&nbsp;custom: <input   name="maxAvailableDefPop" type="text" value="${maxAvailableDefPop}" style="width:80px;">
                                </td>
                            </tr>
                            <tr><th colspan="2">Travel Time Filter</th></tr>
                            <tr><td>Target Coords</td><td><input name="targetVillage" type="text" value="${targetVillage}" placeholder="e.g., 500|500"></td></tr>
                            <tr><td>Max Time (HH:MM:SS)</td><td><input name="maxTime" type="text" value="${maxTime}"></td></tr>
                            <tr><td>Calculate with Unit</td><td>
                                <select name="travelUnit">
                                    ${Object.keys(unitSpeeds).map(unit => `<option value="${unit}" ${unit === travelUnit ? 'selected' : ''}>${unit.charAt(0).toUpperCase() + unit.slice(1)}</option>`).join('')}
                                </select>
                            </td></tr>
                            <tr><td colspan="2" style="text-align:center; padding-top: 15px;">
                                <input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save & Recalculate" onclick="saveSettings();">
                            </td></tr>
                        </table>
                    </form>
                </div>
            </div>
        </div>
    `;

    $.each(playerData, function (playerName) {
        const defList   = bucketDefense[playerName] || [];   // <- instead of bucketDefense[…]
const defCount  = defTotals[playerName] || 0;
        const timeHeader = isTimeFilterActive ? `<th>Time (${travelUnit})</th>` : '';
        const timeCell = (v) => isTimeFilterActive ? `<td>${formatTimeFromSeconds(v.travelTime)}</td>` : '';

       const abRows = bucketVillages[playerName].AntiBunk.map(v => {
        const [x, y] = v.coord.split('|');
        const mapLink = `${game_data.link_base_pure}map&x=${x}&y=${y}`;
        return `<tr><td><a href="${mapLink}" target="_blank">${v.coord}</a> ${v.continent}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td><td>${numberWithCommas(v.noble)}</td>${timeCell(v)}</tr>`;
    }).join(''); const abTable = abRows ? `<table class="village-list-table">
                                      <thead><tr><th>Village</th><th>Axe</th><th>CL</th><th>Ram</th><th>Noble</th>${timeHeader}</tr></thead>
                                      <tbody>${abRows}</tbody>
                                  </table>` : '<div style="padding:10px; text-align:center;">- No villages meet criteria -</div>';

         const faRows = bucketVillages[playerName].FullAtk.map(v => {
        const [x, y] = v.coord.split('|');
        const mapLink = `${game_data.link_base_pure}map&x=${x}&y=${y}`;
        return `<tr><td><a href="${mapLink}" target="_blank">${v.coord}</a> ${v.continent}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td><td>${numberWithCommas(v.noble)}</td>${timeCell(v)}</tr>`;
    }).join('');
 const faTable = faRows ? `<table class="village-list-table">
                                      <thead><tr><th>Village</th><th>Axe</th><th>CL</th><th>Ram</th><th>Noble</th>${timeHeader}</tr></thead>
                                      <tbody>${faRows}</tbody>
                                  </table>` : '<div style="padding:10px; text-align:center;">- No villages meet criteria -</div>';
        
        let totalsGrid = '';
        $.each(playerData[playerName]["total"], function (troopName, troopCount) {
            totalsGrid += `<div class="atc-troop-item"><img src="/graphic/unit/unit_${troopName}.png"> ${numberWithCommas(troopCount)}</div>`;
        });
       const defHomeTotals = defList.reduce(
    (acc, v) => {
        acc.spear += v.spear;
        acc.sword += v.sword;
        acc.heavy += v.heavy;
        return acc;
    },
    { spear: 0, sword: 0, heavy: 0 }
);
const defSummary = `
    <div class="atc-totals-grid">
        <div class="atc-troop-item"><img src="/graphic/unit/unit_spear.png"> ${numberWithCommas(defHomeTotals.spear)}</div>
        <div class="atc-troop-item"><img src="/graphic/unit/unit_sword.png"> ${numberWithCommas(defHomeTotals.sword)}</div>
        <div class="atc-troop-item"><img src="/graphic/unit/unit_heavy.png"> ${numberWithCommas(defHomeTotals.heavy)}</div>
    </div>`;
const defTable = defSummary; 
        html += `
        <div class="atc-player-card" id="player${playerName}">
            <div class="atc-player-header">${playerName}</div>
            <div class="atc-player-body">
                <div class="atc-category">
                    <h4>Anti-Bunk Nukes <span class="count">${typeTotals[playerName]["AntiBunk"]}</span></h4>
                    <button class="collapsible">Show Villages</button>
                    <div class="content">${abTable}</div>
                </div>
                <div class="atc-category">
                    <h4>Standard Full-Atk <span class="count">${typeTotals[playerName]["FullAtk"]}</span></h4>
                    <button class="collapsible">Show Villages</button>
                    <div class="content">${faTable}</div>
                </div>
             <div class="atc-category def-inline">
                <h4>Available Defense ≤ ${numberWithCommas(maxAvailableDefPop)} pop </h4>
              
               ${defTable}
            </div>
            </div>
            <div style="padding: 0 15px 15px;">
                <button class="collapsible">Total Troop Summary</button>
                <div class="content">
                    <div class="atc-totals-grid">${totalsGrid}</div>
                </div>
            </div>
        </div>`;
    });

    html += `</div>`;

    if ($("#ally-troop-counter-main").length) {
        $("#ally-troop-counter-main").replaceWith(html);
    } else {
        $("#contentContainer").prepend(html);
    }
    
    makeThingsCollapsible();
}
