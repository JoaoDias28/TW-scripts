javascript:
(function() {
    'use strict';

    // --- Page validation ---
    if (window.location.href.indexOf('&screen=ally&mode=members') < 0) {
        alert("This script must be run from the Ally -> Members page.");
        return; // Stop if not on the main members page
    }
    if (window.location.href.indexOf('&screen=ally&mode=members_troops') > -1 || window.location.href.indexOf('&screen=ally&mode=members_defense') > -1) {
        // If on a sub-page, redirect back to the main members page to start fresh
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
        return;
    }


    // --- State & Data Variables ---
    var playerData_troops = {};
    var playerData_defense = {};
    var playerList = [];
    var bucketVillages_troops = {}; // This will be populated by the display function
    var bucketVillages_defense = {}; // This will be populated by the display function


    // --- Settings & Constants ---
    var minAxeAntiBunk, minLightAntiBunk, minRamAntiBunk, minAxeFullAtk, minLightFullAtk, minRamFullAtk;
    var targetVillage, maxTime, travelUnit;
    const unitSpeeds = {
        spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
        light: 10,
        marcher: 10, heavy: 11, ram: 30, catapult: 30,
        knight: 10, noble: 35
    };

    // --- Initial Cleanup ---
    $("#ally-troop-counter-main").remove();

    // --- Helper Functions ---
    const delay = ms => new Promise(res => setTimeout(res, ms));
    function getDistance(coords1, coords2) {
        try {
            const [x1, y1] = coords1.split('|').map(Number);
            const [x2, y2] = coords2.split('|').map(Number);
            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return 0;
            return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        } catch (e) { return 0; }
    }
    function parseTimeToSeconds(timeString) {
        try {
            const parts = timeString.split(':').map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) return 0;
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } catch (e) { return 0; }
    }
    function formatTimeFromSeconds(totalSeconds) {
        if (totalSeconds < 0) return 'N/A';
        totalSeconds = Math.round(totalSeconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
    }
    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
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

    // --- Settings Management ---
    function loadSettings() {
        let defaults = {
            minAxeAntiBunk: "4500", minLightAntiBunk: "2000", minRamAntiBunk: "1000",
            minAxeFullAtk: "4500", minLightFullAtk: "2000", minRamFullAtk: "300",
            targetVillage: "", maxTime: "12:00:00", travelUnit: "ram"
        };
        let settings = localStorage.getItem("settingsTribeMembersFullAtk");
        let settingsObj = settings ? JSON.parse(settings) : {};
        let finalSettings = { ...defaults, ...settingsObj };
        ({ minAxeAntiBunk, minLightAntiBunk, minRamAntiBunk, minAxeFullAtk, minLightFullAtk, minRamFullAtk, targetVillage, maxTime, travelUnit } = finalSettings);
    }

    function saveSettings() {
        let settingsData = {
            minAxeAntiBunk: $('[name="minAxeAntiBunk"]').val(),
            minLightAntiBunk: $('[name="minLightAntiBunk"]').val(),
            minRamAntiBunk: $('[name="minRamAntiBunk"]').val(),
            minAxeFullAtk: $('[name="minAxeFullAtk"]').val(),
            minLightFullAtk: $('[name="minLightFullAtk"]').val(),
            minRamFullAtk: $('[name="minRamFullAtk"]').val(),
            targetVillage: $('[name="targetVillage"]').val(),
            maxTime: $('[name="maxTime"]').val(),
            travelUnit: $('[name="travelUnit"]').val()
        };
        localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(settingsData));
        loadSettings(); // Reload settings into variables

        // Regenerate the content for both tabs with the new filters
        $("#tab-content-troops").html(generateTabContentHtml('troops'));
        $("#tab-content-defense").html(generateTabContentHtml('defense'));
        makeThingsCollapsible(); // Re-apply collapsible logic to new content
        UI.InfoMessage("Settings saved and view updated.", 3000);
    }
    window.saveSettings = saveSettings; // Make it accessible from the inline onclick attribute

    // --- Prepare Player URLs ---
    const baseURL_troops = game_data.link_base_pure + "ally&mode=members_troops&player_id=";
    const baseURL_defense = game_data.link_base_pure + "ally&mode=members_defense&player_id=";
    $('#ally_content_classic tr.lit-item, #ally_content_classic tr.row_a, #ally_content_classic tr.row_b').not(':first').each(function () {
        const playerLink = $(this).find('a[href*="screen=info_player"]');
        if (playerLink.length === 0) return;
        const playerName = playerLink.text().trim();
        const playerId = (playerLink.attr('href').match(/id=(\d+)/) || [])[1];
        if (playerId && playerName) {
            playerList.push({ id: playerId, name: playerName });
        }
    });

    // --- Styling ---
    const improvedCSS = `
    <style>
        :root { --atc-bg-main: #2e3136; --atc-bg-header: #202225; --atc-bg-card: #36393f; --atc-bg-card-header: #2a2d31; --atc-bg-interactive: #40444b; --atc-bg-interactive-hover: #4d525a; --atc-text-light: #dcddde; --atc-text-header: #ffffff; --atc-border-color: #4f545c; --atc-accent-color: #4CAF50; --atc-href-color: #5794e6; }
        #ally-troop-counter-main { width: 850px; margin: 15px auto; color: var(--atc-text-light); background-color: var(--atc-bg-main); border: 1px solid var(--atc-bg-header); border-radius: 5px; padding-bottom: 5px; }
        .atc-main-header { background-color: var(--atc-bg-header); color: var(--atc-text-header); padding: 12px 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .atc-main-title { font-size: 20px; font-weight: bold; }
        .atc-tabs { display: flex; background-color: var(--atc-bg-card-header); }
        .atc-tab-button { background-color: transparent; border: none; padding: 12px 20px; cursor: pointer; color: var(--atc-text-light); font-size: 16px; transition: background-color 0.2s, box-shadow 0.2s; flex-grow: 1; border-bottom: 3px solid transparent;}
        .atc-tab-button:hover { background-color: var(--atc-bg-interactive); }
        .atc-tab-button.active { background-color: var(--atc-bg-main); color: var(--atc-text-header); font-weight: bold; border-bottom: 3px solid var(--atc-accent-color); }
        .atc-tab-content { display: none; padding: 5px 5px 0 5px; }
        .atc-tab-content.active { display: block; }
        .atc-grand-totals { display: flex; justify-content: center; gap: 30px; padding: 12px; background-color: var(--atc-bg-card-header); font-size: 16px; font-weight: bold; border-bottom: 1px solid var(--atc-border-color); }
        .atc-grand-totals .total-count { color: var(--atc-accent-color); margin-left: 8px; }
        .atc-player-card { background-color: var(--atc-bg-card); margin: 10px; border: 1px solid var(--atc-border-color); border-radius: 4px; overflow: hidden; }
        .atc-player-header { padding: 12px 15px; font-size: 16px; font-weight: bold; background-color: var(--atc-bg-card-header); }
        .atc-player-body { padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .atc-category h4 { margin: 0 0 10px 0; font-size: 14px; color: var(--atc-text-header); }
        .atc-category h4 .count { background-color: var(--atc-accent-color); color: black; padding: 2px 6px; border-radius: 10px; font-size: 12px; margin-left: 8px; }
        .collapsible { background-color: var(--atc-bg-interactive); color: var(--atc-text-light); cursor: pointer; padding: 10px 15px; width: 100%; border: 1px solid var(--atc-border-color); border-radius: 3px; text-align: left; outline: none; font-size: 14px; transition: background-color 0.2s ease; }
        .collapsible:hover, .collapsible.active { background-color: var(--atc-bg-interactive-hover); }
        .collapsible:after { content: '+'; color: var(--atc-text-light); font-weight: bold; float: right; }
        .collapsible.active:after { content: "-"; }
        .content { padding: 0; max-height: 0; overflow-y: auto; overflow-x: hidden; transition: max-height 0.3s ease-out; background-color: var(--atc-bg-interactive); border-radius: 0 0 3px 3px; border: 1px solid var(--atc-border-color); border-top: none; margin-bottom: 10px; }
        .atc-settings-wrapper { margin: 10px; }
        .atc-settings-panel { padding: 20px; }
        .atc-settings-form table { width: 100%; }
        .atc-settings-form th { text-align: left; padding: 10px 0 5px 0; border-bottom: 1px solid var(--atc-border-color); }
        .atc-settings-form td { padding: 8px 4px; }
        .atc-settings-form input[type="text"], .atc-settings-form select { width: 120px; padding: 4px; background-color: var(--atc-bg-main); color: var(--atc-text-light); border: 1px solid var(--atc-border-color); }
        .atc-totals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 10px; }
        .atc-troop-item { display: flex; align-items: center; background-color: rgba(0,0,0,0.2); padding: 5px; border-radius: 3px; }
        .atc-troop-item img { margin-right: 8px; }
        .village-list-table { width: 100%; border-collapse: collapse; }
        .village-list-table th { background-color: var(--atc-bg-card-header); padding: 8px; text-align: right; }
        .village-list-table th:first-child { text-align: left; }
        .village-list-table td { padding: 6px 8px; border-top: 1px solid var(--atc-border-color); text-align: right; }
        .village-list-table a { color: var(--atc-href-color); }
        .village-list-table td:first-child { text-align: left; }
        .village-list-table tr:nth-child(even) { background-color: rgba(0,0,0,0.15); }
        #atc-progressbar-container { padding: 15px; background-color: var(--atc-bg-header); }
        #atc-progressbar { width: 100%; background-color: var(--atc-bg-card); border-radius: 5px; overflow: hidden; height: 30px; }
        #atc-progress { width: 0%; height: 100%; background-color: var(--atc-accent-color); transition: width 0.3s ease; text-align: center; line-height: 30px; color: black; font-weight: bold; }
    </style>`;
    $("head").append(improvedCSS);


    // --- NEW ASYNC DATA FETCHER ---
    async function parsePlayerPages(playerURL, mode) {
        const villageData = { "total": {} };
        game_data.units.forEach(unit => villageData.total[unit] = 0);

        try {
            const initialHtml = await $.get(playerURL);
            const initialDoc = $(initialHtml);
            let allRows = $();

            // Find all unique pagination links (FIXED SELECTOR HERE)
            const pageUrls = [...initialDoc.find("a.paged-nav-item")]
                .map(a => a.href)
                .filter((v, i, a) => a.indexOf(v) === i);

            // Fetch all subsequent pages in parallel
            const pageFetches = pageUrls.map(url => $.get(url));
            const subsequentPagesHtml = await Promise.all(pageFetches);

            // Combine rows from all pages into a single jQuery object
            const allHtmlDocs = [initialHtml, ...subsequentPagesHtml];
            allHtmlDocs.forEach(html => {
                const doc = $(html);
                const tableRows = doc.find(".vis.w100 tr").not(':first');
                allRows = allRows.add(tableRows);
            });

            // Now parse all the combined rows
            if (mode === 'defense') {
                const mainRows = allRows.filter(function() { return $(this).find('td[rowspan="2"]').length > 0; });
                mainRows.each(function() {
                    const row = $(this);
                    const link = row.find("a").first();
                    if (!link.length) return;
                    const thisID = (link.attr('href').match(/village=(\d+)/) || [])[1];
                    if (!thisID) return;

                    villageData[thisID] = {};
                    villageData[thisID]['coords'] = (link.text().match(/(\d+\|\d+)/) || [])[1] || '?';
                    villageData[thisID]['continent'] = (link.text().match(/(K\d{2})/) || [])[1] || '?';

                    game_data.units.forEach((unitName, index) => {
                        const cellVal = row.children().eq(index + 3).text().trim(); // Defense table has extra columns
                        const count = cellVal && cellVal !== '?' ? parseInt(cellVal, 10) : 0;
                        villageData[thisID][unitName] = count;
                        villageData.total[unitName] += count;
                    });
                });
            } else { // 'troops' mode
                allRows.each(function() {
                    const row = $(this);
                    const link = row.find("a").first();
                    if (!link.length) return;
                    const thisID = (link.attr('href').match(/id=(\d+)/) || [])[1];
                    if (!thisID) return;

                    villageData[thisID] = {};
                    villageData[thisID]['coords'] = (link.text().match(/(\d+\|\d+)/) || [])[1] || '?';
                    villageData[thisID]['continent'] = (link.text().match(/(K\d{2})/) || [])[1] || '?';

                    game_data.units.forEach((unitName, index) => {
                        const cellVal = row.children().not(':first').eq(index + 1).text().trim();
                        const count = cellVal && cellVal !== '?' ? parseInt(cellVal, 10) : 0;
                        villageData[thisID][unitName] = count;
                        villageData.total[unitName] += count;
                    });
                });
            }
        } catch (error) {
            console.error(`Failed to fetch or parse data for URL ${playerURL}:`, error);
        }
        return villageData;
    }


    // --- UI Generation ---
    function generateTabContentHtml(mode) {
        const playerData = (mode === 'troops') ? playerData_troops : playerData_defense;
        const bucketVillages = (mode === 'troops') ? bucketVillages_troops : bucketVillages_defense;

        let grandTotalAntiBunk = 0;
        let grandTotalFullAtk = 0;
        const isTimeFilterActive = targetVillage && targetVillage.match(/\d+\|\d+/) && maxTime && maxTime.match(/\d+:\d+:\d+/);
        const maxTimeSeconds = isTimeFilterActive ? parseTimeToSeconds(maxTime) : 0;
        const unitSpeed = isTimeFilterActive ? unitSpeeds[travelUnit] : 0;

        $.each(playerData, function (playerName) {
            let typeTotals = { "AntiBunk": 0, "FullAtk": 0 };
            bucketVillages[playerName] = { AntiBunk: [], FullAtk: [] };
            const villageIds = Object.keys(playerData[playerName]).filter(key => key !== "total");

            for (const villageId of villageIds) {
                const village = playerData[playerName][villageId];
                let travelTimeSeconds = -1;

                if (isTimeFilterActive) {
                    const distance = getDistance(village.coords, targetVillage);
                    if (distance > 0 && unitSpeed > 0) {
                        travelTimeSeconds = distance * unitSpeed * 60;
                        if (travelTimeSeconds > maxTimeSeconds) continue; // Skip village
                    } else continue; // Skip if cant calculate
                }

                const vAxe = village.axe || 0, vLight = village.light || 0, vRam = village.ram || 0;
                if (vAxe >= minAxeAntiBunk && vLight >= minLightAntiBunk && vRam >= minRamAntiBunk) {
                    typeTotals["AntiBunk"]++;
                    bucketVillages[playerName].AntiBunk.push({ ...village, travelTime: travelTimeSeconds, lc: vLight });
                } else if (vAxe >= minAxeFullAtk && vLight >= minLightFullAtk && vRam >= minRamFullAtk && vRam < minRamAntiBunk) {
                    typeTotals["FullAtk"]++;
                    bucketVillages[playerName].FullAtk.push({ ...village, travelTime: travelTimeSeconds, lc: vLight });
                }
            }
            grandTotalAntiBunk += typeTotals.AntiBunk;
            grandTotalFullAtk += typeTotals.FullAtk;
        });

        let html = `
            <div class="atc-grand-totals">
                <div>Tribe Anti-Bunk Nukes: <span class="total-count">${grandTotalAntiBunk}</span></div>
                <div>Tribe Standard Full-Atk: <span class="total-count">${grandTotalFullAtk}</span></div>
            </div>`;

        $.each(playerData, function (playerName) {
            const timeHeader = isTimeFilterActive ? `<th>Time (${travelUnit})</th>` : '';
            const timeCell = (v) => isTimeFilterActive ? `<td>${formatTimeFromSeconds(v.travelTime)}</td>` : '';
            const createTable = (data) => {
                if (data.length === 0) return '<div style="padding:10px; text-align:center;">- No villages meet criteria -</div>';
                const rows = data.map(v => {
                    const [x, y] = v.coord.split('|'); const mapLink = `${game_data.link_base_pure}map&x=${x}&y=${y}`;
                    return `<tr><td><a href="${mapLink}" target="_blank">${v.coord}</a> ${v.continent}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td>${timeCell(v)}</tr>`;
                }).join('');
                return `<table class="village-list-table"><thead><tr><th>Village</th><th>Axe</th><th>CL</th><th>Ram</th>${timeHeader}</tr></thead><tbody>${rows}</tbody></table>`;
            };
            const abTable = createTable(bucketVillages[playerName].AntiBunk);
            const faTable = createTable(bucketVillages[playerName].FullAtk);
            const totalsGrid = Object.entries(playerData[playerName]["total"]).map(([troopName, troopCount]) => `<div class="atc-troop-item"><img src="/graphic/unit/unit_${troopName}.png"> ${numberWithCommas(troopCount)}</div>`).join('');
            const antiBunkCount = bucketVillages[playerName].AntiBunk.length;
            const fullAtkCount = bucketVillages[playerName].FullAtk.length;

            html += `<div class="atc-player-card" id="player${playerName.replace(/\s/g, '')}-${mode}">
                <div class="atc-player-header">${playerName}</div>
                <div class="atc-player-body">
                    <div class="atc-category"><h4>Anti-Bunk Nukes <span class="count">${antiBunkCount}</span></h4><button class="collapsible">Show Villages</button><div class="content">${abTable}</div></div>
                    <div class="atc-category"><h4>Standard Full-Atk <span class="count">${fullAtkCount}</span></h4><button class="collapsible">Show Villages</button><div class="content">${faTable}</div></div>
                </div>
                <div style="padding: 0 15px 15px;"><button class="collapsible">Total Troop Summary</button><div class="content"><div class="atc-totals-grid">${totalsGrid}</div></div></div>
            </div>`;
        });
        return html;
    }

    function buildInitialUI() {
        let html = `
        <div id="ally-troop-counter-main">
            <div class="atc-main-header"><div class="atc-main-title">Tribe Offensive Power Analysis</div></div>
            <div id="atc-progressbar-container">
                <div id="atc-progress-text" style="text-align:center; margin-bottom: 5px;">Initializing...</div>
                <div id="atc-progressbar"><div id="atc-progress">0 / ${playerList.length * 2}</div></div>
            </div>
            <div id="atc-main-content" style="display:none;">
                <div class="atc-tabs">
                    <button class="atc-tab-button active" data-tab="troops">Total Troops (Owned)</button>
                    <button class="atc-tab-button" data-tab="defense">Available Troops (At Home)</button>
                </div>
                <div id="tab-content-troops" class="atc-tab-content active"></div>
                <div id="tab-content-defense" class="atc-tab-content"></div>
                <div class="atc-settings-wrapper">
                    <button class="collapsible">Settings & Filters</button>
                    <div class="content">
                        <div class="atc-settings-panel">
                            <form id="settings" class="atc-settings-form" onsubmit="return false;">
                                <table>
                                    <tr><th colspan="2">Anti-Bunk Thresholds</th></tr>
                                    <tr><td>Axe ≥</td><td><input name="minAxeAntiBunk" type="text" value="${minAxeAntiBunk}"></td></tr>
                                    <tr><td>CL ≥</td><td><input name="minLightAntiBunk" type="text" value="${minLightAntiBunk}"></td></tr>
                                    <tr><td>Ram ≥</td><td><input name="minRamAntiBunk" type="text" value="${minRamAntiBunk}"></td></tr>
                                    <tr><th colspan="2">Full-Atk Thresholds</th></tr>
                                    <tr><td>Axe ≥</td><td><input name="minAxeFullAtk" type="text" value="${minAxeFullAtk}"></td></tr>
                                    <tr><td>CL ≥</td><td><input name="minLightFullAtk" type="text" value="${minLightFullAtk}"></td></tr>
                                    <tr><td>Ram ≥</td><td><input name="minRamFullAtk" type="text" value="${minRamFullAtk}"></td></tr>
                                    <tr><th colspan="2">Travel Time Filter</th></tr>
                                    <tr><td>Target Coords</td><td><input name="targetVillage" type="text" value="${targetVillage}" placeholder="e.g., 500|500"></td></tr>
                                    <tr><td>Max Time (HH:MM:SS)</td><td><input name="maxTime" type="text" value="${maxTime}"></td></tr>
                                    <tr><td>Calculate with Unit</td><td><select name="travelUnit">${Object.keys(unitSpeeds).map(unit => `<option value="${unit}" ${unit === travelUnit ? 'selected' : ''}>${unit.charAt(0).toUpperCase() + unit.slice(1)}</option>`).join('')}</select></td></tr>
                                    <tr><td colspan="2" style="text-align:center; padding-top: 15px;"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save & Recalculate" onclick="saveSettings();"></td></tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        $("#contentContainer").prepend(html);

        $('.atc-tab-button').on('click', function() {
            const tab = $(this).data('tab');
            $('.atc-tab-button').removeClass('active');
            $(this).addClass('active');
            $('.atc-tab-content').removeClass('active');
            $('#tab-content-' + tab).addClass('active');
        });
    }

    // --- SCRIPT EXECUTION FLOW ---
    async function main() {
        if (playerList.length === 0) {
            UI.InfoMessage("No players found on this page.", 5000, "error");
            return;
        }

        loadSettings();
        buildInitialUI();

        const totalFetches = playerList.length * 2;
        let fetchesDone = 0;

        // Fetch Troops Data
        $("#atc-progress-text").text("Fetching Total Troops data...");
        for (const player of playerList) {
            const url = baseURL_troops + player.id;
            playerData_troops[player.name] = await parsePlayerPages(url, 'troops');
            fetchesDone++;
            $("#atc-progress").css("width", `${(fetchesDone / totalFetches) * 100}%`).text(`${fetchesDone} / ${totalFetches}`);
            await delay(250); // Be nice to the server
        }

        // Fetch Defense Data
        $("#atc-progress-text").text("Fetching Available Troops data...");
        for (const player of playerList) {
            const url = baseURL_defense + player.id;
            playerData_defense[player.name] = await parsePlayerPages(url, 'defense');
            fetchesDone++;
            $("#atc-progress").css("width", `${(fetchesDone / totalFetches) * 100}%`).text(`${fetchesDone} / ${totalFetches}`);
            await delay(250); // Be nice to the server
        }

        // All data is ready, render the final UI
        $("#atc-progressbar-container").hide();
        $("#atc-main-content").show();
        $("#tab-content-troops").html(generateTabContentHtml('troops'));
        $("#tab-content-defense").html(generateTabContentHtml('defense'));
        makeThingsCollapsible();
        UI.InfoMessage("Troop analysis complete!", 3000, 'success');
    }

    // --- Start the script ---
    main();

})();
