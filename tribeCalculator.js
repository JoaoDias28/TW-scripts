javascript:
// Safety check to ensure the script runs only when necessary game data is available.
if (typeof game_data === 'undefined' || typeof $ === 'undefined') {
    console.log("Ally Troop Counter: Halting script execution. Game data or jQuery not found.");
}

// --- GLOBAL VARIABLES & CONFIGURATION ---
const baseURL = `game.php?screen=ally&mode=members_troops&player_id=`;
let playerURLs = [];
let villageData = {};
let playerData = {};
let player = [];
let typeTotals = {};
let bucketVillages = {};
let tempArray;
let minAxeAntiBunk, minLightAntiBunk, minRamAntiBunk, minAxeFullAtk, minLightFullAtk, minRamFullAtk;
let rows;

const unitSpeeds = {
    spear: 18, sword: 22, axe: 18, archer: 18,
    spy: 9, light: 10, marcher: 10, heavy: 11,
    ram: 30, catapult: 30, knight: 10, snob: 35
};

// --- INITIALIZATION & DATA FETCHING ---
function calculateEverything() {
    // Redirect if on the wrong page (but not the main members list)
    if (window.location.href.indexOf('&screen=ally&mode=members') < 0 || window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
        return;
    }

    // Reset data structures
    playerURLs = []; villageData = {}; playerData = {}; player = [];
    typeTotals = {}; bucketVillages = {};

    // Initial cleanup of old UI
    $(".flex-container").remove();
    $("div[id*='player']").remove();
    $("#ally-troop-counter-main").remove();

    // Load settings from localStorage
    if (localStorage.getItem("settingsTribeMembersFullAtk") != null) {
        tempArray = JSON.parse(localStorage.getItem("settingsTribeMembersFullAtk"));
        minAxeAntiBunk = tempArray[0].value; minLightAntiBunk = tempArray[1].value; minRamAntiBunk = tempArray[2].value;
        minAxeFullAtk = tempArray[3].value; minLightFullAtk = tempArray[4].value; minRamFullAtk = tempArray[5].value;
    } else {
        tempArray = [
            { name: "minAxeAntiBunk", value: "4500" }, { name: "minLightAntiBunk", value: "2000" }, { name: "minRamAntiBunk", value: "1000" },
            { name: "minAxeFullAtk", value: "4500" }, { name: "minLightFullAtk", value: "2000" }, { name: "minRamFullAtk", value: "300" }
        ];
        minAxeAntiBunk = tempArray[0].value; minLightAntiBunk = tempArray[1].value; minRamAntiBunk = tempArray[2].value;
        minAxeFullAtk = tempArray[3].value; minLightFullAtk = tempArray[4].value; minRamFullAtk = tempArray[5].value;
        localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(tempArray));
    }

    $('input:radio[name=player]').each(function () {
        playerURLs.push(baseURL + $(this).attr("value"));
        player.push({ "id": $(this).attr("value"), "name": $(this).parent().text().trim() });
    });
    
    injectCSS();

    const progressBarHtml = `<div id="ally-troop-counter-main"><div id="atc-progressbar"><div id="atc-progress">0 / ${playerURLs.length}</div></div></div>`;
    $("#contentContainer").eq(0).prepend(progressBarHtml);

    getAll(playerURLs,
        (i, data) => {
            villageData = {};
            villageData["total"] = {};
            if ($(data).find(".paged-nav-item").length == 0) { rows = $(data).find(".vis.w100 tr").not(':first'); } 
            else { rows = $(data).find(".vis.w100 tr").not(':first').not(":first").not(":last"); }
            const allPages = [];
            for (var pages = 0; pages < $(data).find(".paged-nav-item").length / 2; pages++) { allPages.push($(data).find(".paged-nav-item").eq(pages).attr("href")); }
            
            getAll(allPages,
                (p, getMore) => {
                    if ($(getMore).find(".paged-nav-item").length == 0) { rows = $.merge(rows, $(getMore).find(".vis.w100 tr").not(':first')); } 
                    else { rows = $.merge(rows, $(getMore).find(".vis.w100 tr").not(':first').not(":first").not(":last")); }
                },
                () => {
                    $.each(game_data.units, function (index) { villageData["total"][game_data.units[index]] = 0; });
                    $.each(rows, function (rowNr) {
                        const thisID = rows.eq(rowNr).find("a")[0].outerHTML.match(/id=(\d*)/)[1];
                        villageData[thisID] = {};
                        const linkTxt = rows.eq(rowNr).find('a').text();
                        villageData[thisID]['coords'] = linkTxt.match(/(\d+\|\d+)/)[1] || '?';
                        $.each(game_data.units, function (index) {
                            const unitName = game_data.units[index];
                            const unitValue = rows.eq(rowNr).children().not(':first').eq(index + 1).text().trim();
                            villageData[thisID][unitName] = unitValue !== '?' ? parseInt(unitValue) : 0;
                            villageData["total"][unitName] += villageData[thisID][unitName];
                        });
                    });
                    playerData[player[i].name] = villageData;
                },
                (error) => { console.error(error); });
        },
        () => { $("#atc-progressbar").remove(); displayEverything(); },
        (error) => { console.error(error); }
    );
}

// --- HELPER & UI FUNCTIONS ---

function getAll(urls, onLoad, onDone, onError) {
    let numDone = 0, lastRequestTime = 0; const minWaitTime = 200;
    function loadNext() {
        if (numDone == urls.length) { onDone(); return; }
        let now = Date.now(), timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) { setTimeout(loadNext, minWaitTime - timeElapsed); return; }
        $("#atc-progress").css("width", `${(numDone + 1) / urls.length * 100}%`).text(`${(numDone + 1)} / ${urls.length}`);
        lastRequestTime = now;
        $.get(urls[numDone]).done((data) => { try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); } }).fail((xhr) => { onError(xhr); });
    }
    loadNext();
}

function calculateDistance(c1, c2) { const [x1, y1] = c1.split('|').map(Number); const [x2, y2] = c2.split('|').map(Number); return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)); }
function parseTimeToSeconds(t) { const p = t.split(':').map(Number); return (p.length !== 3 || p.some(isNaN)) ? null : p[0] * 3600 + p[1] * 60 + p[2]; }
function rerunDisplay() { $("#ally-troop-counter-main").remove(); displayEverything(); }
function numberWithCommas(x) { let p = /(\d+)(\d{3})/; while (p.test(x)) { x = x.replace(p, '$1.$2'); } return x; }
function saveSettings() { tempArray = $("#settings").serializeArray(); minAxeAntiBunk=t[0].v; minLightAntiBunk=t[1].v; minRamAntiBunk=t[2].v; minAxeFullAtk=t[3].v; minLightFullAtk=t[4].v; minRamFullAtk=t[5].v; localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(tempArray)); rerunDisplay(); }

function addAllEventListeners() {
    $(document).off('click', '.collapsible').on('click', '.collapsible', function () { this.classList.toggle("active"); let c = this.nextElementSibling; c.style.maxHeight = c.style.maxHeight ? null : c.scrollHeight + "px"; });
    $(document).on('click', '#atc-apply-filter-btn', rerunDisplay);
    $(document).on('click', '#atc-save-settings-btn', saveSettings);
}

function displayEverything() {
    let grandTotalAntiBunk = 0, grandTotalFullAtk = 0;
    const targetCoords = $('#atc-filter-target-coords').val() ? $('#atc-filter-target-coords').val().trim() : '';
    const maxTimeStr = $('#atc-filter-max-time').val() ? $('#atc-filter-max-time').val().trim() : '';
    const selectedUnit = $('#atc-filter-unit-selector').val() || 'ram';
    const maxTimeSeconds = parseTimeToSeconds(maxTimeStr);
    const isFilterActive = /^\d+\|\d+$/.test(targetCoords) && maxTimeSeconds !== null;
    const unitSpeed = isFilterActive ? (unitSpeeds[selectedUnit] / game_data.speed / game_data.unit_speed) : 0;
    
    $.each(playerData, function (playerName) {
        bucketVillages[playerName] = { AntiBunk: [], FullAtk: [] };
        const villageIds = Object.keys(playerData[playerName]).filter(k => k !== "total");
        for (const villageId of villageIds) {
            const v = playerData[playerName][villageId];
            if ((v.axe||0)>=minAxeAntiBunk && (v.light||0)>=minLightAntiBunk && (v.ram||0)>=minRamAntiBunk) bucketVillages[playerName].AntiBunk.push({ c:v.coords, a:v.axe, l:v.light, r:v.ram });
            else if ((v.axe||0)>=minAxeFullAtk && (v.light||0)>=minLightFullAtk && (v.ram||0)>=minRamFullAtk && (v.ram||0)<minRamAntiBunk) bucketVillages[playerName].FullAtk.push({ c:v.coords, a:v.axe, l:v.light, r:v.ram });
        }
        const filteredAB = isFilterActive ? bucketVillages[playerName].AntiBunk.filter(v => (calculateDistance(v.c, targetCoords)*unitSpeed*60)<=maxTimeSeconds) : bucketVillages[playerName].AntiBunk;
        const filteredFA = isFilterActive ? bucketVillages[playerName].FullAtk.filter(v => (calculateDistance(v.c, targetCoords)*unitSpeed*60)<=maxTimeSeconds) : bucketVillages[playerName].FullAtk;
        typeTotals[playerName] = { AntiBunk: filteredAB.length, FullAtk: filteredFA.length };
        grandTotalAntiBunk += filteredAB.length; grandTotalFullAtk += filteredFA.length;
    });

    let html = `<div id="ally-troop-counter-main"><div class="atc-main-header"><div class="atc-main-title">Full Atk / Anti Bunk Tribe Counter</div></div><div class="atc-grand-totals"><div>Tribe Anti-Bunk Nukes: <span class="total-count">${grandTotalAntiBunk}</span></div><div>Tribe Standard Full-Atk: <span class="total-count">${grandTotalFullAtk}</span></div></div><div class="atc-settings-wrapper"><button class="collapsible">Travel Time Filter</button><div class="content"><div class="atc-panel-content"><div class="atc-form-grid"><label for="atc-filter-target-coords">Target Coords:</label><input type="text" id="atc-filter-target-coords" placeholder="e.g., 555|444" value="${targetCoords}"><label for="atc-filter-max-time">Max Time:</label><input type="text" id="atc-filter-max-time" placeholder="hh:mm:ss" value="${maxTimeStr}"><label for="atc-filter-unit-selector">Unit:</label><select id="atc-filter-unit-selector"><option value="ram" ${selectedUnit==='ram'?'selected':''}>Ram</option><option value="axe" ${selectedUnit==='axe'?'selected':''}>Axe</option><option value="light" ${selectedUnit==='light'?'selected':''}>LC</option></select></div><div style="text-align:center;margin-top:15px;"><button id="atc-apply-filter-btn" class="btn">Apply Filter</button></div></div></div></div><div class="atc-settings-wrapper"><button class="collapsible">Settings & Thresholds</button><div class="content"><div class="atc-panel-content"><form id="settings" class="atc-settings-form"><table><tr><th colspan="2">Anti-Bunk</th></tr><tr><td>Axe ≥</td><td><input name="minAxeAntiBunk" type="text" value="${minAxeAntiBunk}"></td></tr><tr><td>LC ≥</td><td><input name="minLightAntiBunk" type="text" value="${minLightAntiBunk}"></td></tr><tr><td>Ram ≥</td><td><input name="minRamAntiBunk" type="text" value="${minRamAntiBunk}"></td></tr><tr><th colspan="2">Full-Atk</th></tr><tr><td>Axe ≥</td><td><input name="minAxeFullAtk" type="text" value="${minAxeFullAtk}"></td></tr><tr><td>LC ≥</td><td><input name="minLightFullAtk" type="text" value="${minLightFullAtk}"></td></tr><tr><td>Ram ≥</td><td><input name="minRamFullAtk" type="text" value="${minRamFullAtk}"></td></tr><tr><td colspan="2" style="text-align:center;padding-top:15px;"><input type="button" class="btn evt-confirm-btn" value="Save" id="atc-save-settings-btn"></td></tr></table></form></div></div></div>`;
    $.each(playerData, function (playerName) {
        const villagesToDisplayAB = isFilterActive ? bucketVillages[playerName].AntiBunk.filter(v => (calculateDistance(v.c, targetCoords)*unitSpeed*60)<=maxTimeSeconds) : bucketVillages[playerName].AntiBunk;
        const villagesToDisplayFA = isFilterActive ? bucketVillages[playerName].FullAtk.filter(v => (calculateDistance(v.c, targetCoords)*unitSpeed*60)<=maxTimeSeconds) : bucketVillages[playerName].FullAtk;
        const abRows = villagesToDisplayAB.map(v => `<tr><td>${v.c}</td><td>${numberWithCommas(v.a)}</td><td>${numberWithCommas(v.l)}</td><td>${numberWithCommas(v.r)}</td></tr>`).join('');
        const faRows = villagesToDisplayFA.map(v => `<tr><td>${v.c}</td><td>${numberWithCommas(v.a)}</td><td>${numberWithCommas(v.l)}</td><td>${numberWithCommas(v.r)}</td></tr>`).join('');
        let totalsGrid = '';
        $.each(playerData[playerName]["total"], (n, c) => { totalsGrid += `<div class="atc-troop-item"><img src="/graphic/unit/unit_${n}.png"> ${numberWithCommas(c)}</div>`; });
        html += `<div class="atc-player-card" id="player${playerName}"><div class="atc-player-header">${playerName}</div><div class="atc-player-body"><div class="atc-category"><h4>Anti-Bunk Nukes <span class="count">${typeTotals[playerName].AntiBunk}</span></h4><button class="collapsible">Show Villages</button><div class="content">${abRows?`<table class="village-list-table"><thead><tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr></thead><tbody>${abRows}</tbody></table>`:'<div style="padding:10px;text-align:center;">- None -</div>'}</div></div><div class="atc-category"><h4>Standard Full-Atk <span class="count">${typeTotals[playerName].FullAtk}</span></h4><button class="collapsible">Show Villages</button><div class="content">${faRows?`<table class="village-list-table"><thead><tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr></thead><tbody>${faRows}</tbody></table>`:'<div style="padding:10px;text-align:center;">- None -</div>'}</div></div></div><div style="padding:0 15px 15px;"><button class="collapsible">Total Troop Summary</button><div class="content"><div class="atc-totals-grid">${totalsGrid}</div></div></div></div>`;
    });
    $("#contentContainer").prepend(html + '</div>');
    addAllEventListeners();
}

function injectCSS() {
    if ($('#atc-styles').length > 0) return;
    const css = `<style id="atc-styles">:root{--atc-bg-main:#2e3136;--atc-bg-header:#202225;--atc-bg-card:#36393f;--atc-bg-card-header:#2a2d31;--atc-bg-interactive:#40444b;--atc-bg-interactive-hover:#4d525a;--atc-text-light:#dcddde;--atc-text-header:#ffffff;--atc-border-color:#4f545c;--atc-accent-color:#4CAF50;}#ally-troop-counter-main{width:850px;margin:15px auto;color:var(--atc-text-light);background-color:var(--atc-bg-main);border:1px solid var(--atc-bg-header);border-radius:5px;padding-bottom:5px;}.atc-main-header{background-color:var(--atc-bg-header);color:var(--atc-text-header);padding:12px 20px;border-radius:5px 5px 0 0;text-align:center;}.atc-main-title{font-size:20px;font-weight:bold;}.atc-grand-totals{display:flex;justify-content:center;gap:30px;padding:12px;background-color:var(--atc-bg-card-header);font-size:16px;font-weight:bold;border-bottom:1px solid var(--atc-border-color);}.atc-grand-totals .total-count{color:var(--atc-accent-color);margin-left:8px;}.atc-player-card,.atc-tool-card{background-color:var(--atc-bg-card);margin:10px 10px 0 10px;border:1px solid var(--atc-border-color);border-radius:4px;overflow:hidden;}.atc-card-header,.atc-player-header{padding:12px 15px;font-size:16px;font-weight:bold;background-color:var(--atc-bg-card-header);}.atc-player-body{padding:15px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}.atc-category h4{margin:0 0 10px 0;font-size:14px;color:var(--atc-text-header);}.atc-category h4 .count{background-color:var(--atc-accent-color);color:black;padding:2px 6px;border-radius:10px;font-size:12px;margin-left:8px;}.collapsible{background-color:var(--atc-bg-interactive);color:var(--atc-text-light);cursor:pointer;padding:10px 15px;width:100%;border:1px solid var(--atc-border-color);border-radius:3px;text-align:left;outline:none;font-size:14px;transition:background-color .2s ease;}.collapsible:hover,.collapsible.active{background-color:var(--atc-bg-interactive-hover);}.collapsible:after{content:'+';color:var(--atc-text-light);font-weight:bold;float:right;}.collapsible.active:after{content:"-";}.content{padding:0;max-height:0;overflow-y:auto;overflow-x:hidden;transition:max-height .3s ease-out;background-color:var(--atc-bg-interactive);border-radius:0 0 3px 3px;border:1px solid var(--atc-border-color);border-top:none;margin-bottom:10px;}.atc-panel-content{padding:20px;}.atc-form-grid{display:grid;grid-template-columns:auto 1fr;gap:10px 20px;align-items:center;}.atc-form-grid label{font-weight:bold;}.atc-form-grid input[type="text"],.atc-form-grid select{width:100%;padding:5px;background-color:var(--atc-bg-main);border:1px solid var(--atc-border-color);color:var(--atc-text-light);border-radius:3px;}.atc-settings-wrapper{margin:10px 10px 0 10px;}.atc-settings-form table{width:100%;}.atc-settings-form th{text-align:left;padding:10px 0 5px 0;border-bottom:1px solid var(--atc-border-color);}.atc-settings-form td{padding:8px 4px;}.atc-settings-form input[type="text"]{width:100px;padding:4px;}.atc-totals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;padding:10px;}.atc-troop-item{display:flex;align-items:center;background-color:rgba(0,0,0,0.2);padding:5px;border-radius:3px;}.atc-troop-item img{margin-right:8px;}.village-list-table{width:100%;border-collapse:collapse;}.village-list-table th{background-color:var(--atc-bg-card-header);padding:8px;text-align:right;}.village-list-table th:first-child{text-align:left;}.village-list-table td{padding:6px 8px;border-top:1px solid var(--atc-border-color);text-align:right;}.village-list-table td:first-child{text-align:left;}.village-list-table tr:nth-child(even){background-color:rgba(0,0,0,0.15);}}#atc-progressbar{width:100%;background-color:var(--atc-bg-card);border-radius:5px;overflow:hidden;height:30px;margin-bottom:10px;}#atc-progress{width:0%;height:100%;background-color:var(--atc-accent-color);transition:width .3s ease;text-align:center;line-height:30px;color:black;font-weight:bold;}</style>`;
    $('head').append(css);
}
