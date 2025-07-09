Of course! This is an excellent idea for improving the script. Separating the "total owned troops" from the "troops currently at home" provides much more actionable intelligence.

Here is the improved script. I've broken down the changes and explained them below.

Key Improvements:

Dual Data Fetching: The script now fetches data from both members_troops and members_defense sequentially.

Separate Data Storage: Data is stored in separate objects (playerData_troops, playerData_defense, etc.) to keep everything clean and distinct.

Tabbed UI: The user interface has been redesigned with tabs, allowing you to easily switch between the "Total Troops" view and the "Available Troops" view.

Refactored Logic: The calculation and display logic has been modularized. A single function now generates the content for a tab, and it's called once for each dataset. This avoids code duplication.

Efficient Recalculation: When you change settings and click "Save & Recalculate", the script no longer re-fetches all the data. It just re-runs the calculations on the already stored data, making it instantaneous.

Improved Progress Bar: The progress bar now shows the progress for both fetching phases.

The Improved Script

Copy and paste this entire code block into your quick bar.

Generated javascript
javascript:
(function() {
    // Redirect if not on the main ally members page
    if (window.location.href.indexOf('&screen=ally&mode=members') < 0) {
        if (window.location.href.indexOf('&screen=ally&mode=members_troops') > -1 || window.location.href.indexOf('&screen=ally&mode=members_defense') > -1) {
            // If already on a sub-page, just go to the main one.
        } else {
            alert("Script must be run on the Ally -> Members page.");
            return;
        }
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
        return;
    }

    // --- State & Data Variables ---
    var playerData_troops = {}, playerData_defense = {};
    var typeTotals_troops = {}, typeTotals_defense = {};
    var bucketVillages_troops = {}, bucketVillages_defense = {};
    var playerList = [];
    var playerURLs_troops = [], playerURLs_defense = [];

    // --- Settings Variables ---
    var minAxeAntiBunk, minLightAntiBunk, minRamAntiBunk, minAxeFullAtk, minLightFullAtk, minRamFullAtk;
    var targetVillage, maxTime, travelUnit;
    const unitSpeeds = {
        spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
        light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
        knight: 10, noble: 35
    };

    // --- Initial Cleanup ---
    $(".flex-container").remove();
    $("div[id*='player']").remove();
    $("#ally-troop-counter-main").remove();

    // --- Helper Functions ---
    function getDistance(coords1, coords2) {
        try {
            const [x1, y1] = coords1.split('|').map(Number);
            const [x2, y2] = coords2.split('|').map(Number);
            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return 0;
            return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        } catch (e) { return 0; }
    }

    function parseTimeToSeconds(timeString) { // HH:MM:SS
        try {
            const parts = timeString.split(':').map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) return 0;
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } catch(e) { return 0; }
    }

    function formatTimeFromSeconds(totalSeconds) {
        if (totalSeconds < 0) return 'N/A';
        totalSeconds = Math.round(totalSeconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
    }

    function loadSettings() {
        let defaults = {
            minAxeAntiBunk: "4500", minLightAntiBunk: "2000", minRamAntiBunk: "1000",
            minAxeFullAtk: "4500", minLightFullAtk: "2000", minRamFullAtk: "300",
            targetVillage: "", maxTime: "12:00:00", travelUnit: "ram"
        };
        let settings = localStorage.getItem("settingsTribeMembersFullAtk");
        let settingsObj = settings ? JSON.parse(settings) : {};
        if (Array.isArray(settingsObj)) { // Handle old format
            let tempObj = {};
            settingsObj.forEach(item => { tempObj[item.name] = item.value; });
            settingsObj = tempObj;
        }
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
        loadSettings();
        recalculateAndRenderAllTabs(); // Efficiently recalculate without refetching
    }

    function makeThingsCollapsible() {
        $(document).off('click', '.collapsible').on('click', '.collapsible', function() {
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
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    // --- UI & Styling ---
    const mainCSS = `
    <style>
        :root { --atc-bg-main: #2e3136; --atc-bg-header: #202225; --atc-bg-card: #36393f; --atc-bg-card-header: #2a2d31; --atc-bg-interactive: #40444b; --atc-bg-interactive-hover: #4d525a; --atc-text-light: #dcddde; --atc-text-header: #ffffff; --atc-border-color: #4f545c; --atc-accent-color: #4CAF50; --atc-href-color: #5794e6; }
        #ally-troop-counter-main { width: 850px; margin: 15px auto; color: var(--atc-text-light); background-color: var(--atc-bg-main); border: 1px solid var(--atc-bg-header); border-radius: 5px; padding-bottom: 5px; }
        .atc-main-header { background-color: var(--atc-bg-header); color: var(--atc-text-header); padding: 12px 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .atc-main-title { font-size: 20px; font-weight: bold; }
        .atc-tabs { display: flex; background-color: var(--atc-bg-card-header); }
        .atc-tab-button { background-color: transparent; border: none; padding: 12px 20px; cursor: pointer; color: var(--atc-text-light); font-size: 16px; transition: background-color 0.2s, box-shadow 0.2s; flex-grow: 1; }
        .atc-tab-button:hover { background-color: var(--atc-bg-interactive); }
        .atc-tab-button.active { background-color: var(--atc-bg-main); color: var(--atc-text-header); font-weight: bold; border-bottom: 3px solid var(--atc-accent-color); }
        .atc-tab-content { display: none; padding: 5px; }
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
    $("head").append(mainCSS);

    // --- Data Fetching Logic ---
    function getAllPages(initialUrl, onDone, onError, progressCallback) {
        let allRows = [];
        $.get(initialUrl).done(data => {
            let initialRows = $(data).find(".vis.w100 tr").not(':first').not(":first").not(":last");
            if ($(data).find(".paged-nav-item").length === 0) {
                 initialRows = $(data).find(".vis.w100 tr").not(':first');
            }
            allRows.push(...initialRows);

            const pageLinks = [...$(data).find(".paged-nav-item")].map(a => a.href).filter((v, i, a) => a.indexOf(v) === i);
            if (pageLinks.length === 0) {
                onDone(allRows);
                return;
            }

            let pagesLoaded = 0;
            pageLinks.forEach(link => {
                $.get(link).done(pageData => {
                    let pageRows = $(pageData).find(".vis.w100 tr").not(':first').not(":first").not(":last");
                    allRows.push(...pageRows);
                }).fail(onError).always(() => {
                    pagesLoaded++;
                    if (progressCallback) progressCallback(pagesLoaded, pageLinks.length);
                    if (pagesLoaded === pageLinks.length) {
                        onDone(allRows);
                    }
                });
            });
        }).fail(onError);
    }

    function fetchDataForMode(mode, onComplete) {
        const urls = mode === 'troops' ? playerURLs_troops : playerURLs_defense;
        const targetData = mode === 'troops' ? playerData_troops : playerData_defense;
        let playersDone = 0;
        const totalPlayers = urls.length;
        $("#atc-progress-text").text(`Fetching data for: ${mode}`);

        urls.forEach((playerUrl, index) => {
            getAllPages(playerUrl,
                (rows) => {
                    const playerName = playerList[index].name;
                    let villageData = { total: {} };
                    game_data.units.forEach(unit => villageData.total[unit] = 0);

                    $(rows).each(function() {
                        const row = $(this);
                        const link = row.find("a").first();
                        const thisID = link.attr('href').match(/village=(\d+)/)[1];
                        villageData[thisID] = {};
                        const linkTxt = link.text();
                        villageData[thisID]['coords'] = linkTxt.match(/(\d+\|\d+)/)[1] || '?';
                        villageData[thisID]['continent'] = linkTxt.match(/(K\d+)/)[1] || '?';

                        row.find('td.unit-item').each(function(i) {
                            const unitName = game_data.units[i];
                            const unitValue = $(this).text().trim();
                            const count = unitValue === '?' ? 0 : parseInt(unitValue, 10);
                            villageData[thisID][unitName] = count;
                            villageData.total[unitName] += count;
                        });
                    });
                    targetData[playerName] = villageData;
                },
                (err) => console.error(`Error fetching pages for ${playerUrl}:`, err),
                null // No inner progress callback needed here
            ).always(() => {
                playersDone++;
                let totalProgress = (mode === 'troops' ? 0 : totalPlayers) + playersDone;
                let overallTotal = totalPlayers * 2;
                $("#atc-progress").css("width", `${(totalProgress / overallTotal) * 100}%`).text(`${totalProgress} / ${overallTotal}`);
                if (playersDone === totalPlayers) {
                    onComplete();
                }
            });
        });
    }

    // --- Calculation and Rendering ---
    function generateTabContent(mode) {
        const playerData = (mode === 'troops') ? playerData_troops : playerData_defense;
        const typeTotals = (mode === 'troops') ? typeTotals_troops : typeTotals_defense;
        const bucketVillages = (mode === 'troops') ? bucketVillages_troops : bucketVillages_defense;
        
        let grandTotalAntiBunk = 0;
        let grandTotalFullAtk = 0;
        const isTimeFilterActive = targetVillage && targetVillage.match(/\d+\|\d+/) && maxTime && maxTime.match(/\d+:\d+:\d+/);
        const maxTimeSeconds = isTimeFilterActive ? parseTimeToSeconds(maxTime) : 0;
        const unitSpeed = isTimeFilterActive ? unitSpeeds[travelUnit] : 0;

        Object.keys(playerData).forEach(playerName => {
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
                        if (travelTimeSeconds > maxTimeSeconds) continue;
                    } else continue;
                }
                
                const { axe = 0, light = 0, ram = 0 } = village;
                if (axe >= minAxeAntiBunk && light >= minLightAntiBunk && ram >= minRamAntiBunk) {
                    typeTotals[playerName]["AntiBunk"]++;
                    bucketVillages[playerName].AntiBunk.push({ coord: village.coords, continent: village.continent, axe, lc: light, ram, travelTime: travelTimeSeconds });
                } else if (axe >= minAxeFullAtk && light >= minLightFullAtk && ram >= minRamFullAtk && ram < minRamAntiBunk) {
                    typeTotals[playerName]["FullAtk"]++;
                    bucketVillages[playerName].FullAtk.push({ coord: village.coords, continent: village.continent, axe, lc: light, ram, travelTime: travelTimeSeconds });
                }
            }
            grandTotalAntiBunk += typeTotals[playerName]["AntiBunk"];
            grandTotalFullAtk += typeTotals[playerName]["FullAtk"];
        });

        let tabHtml = `
            <div class="atc-grand-totals">
                <div>Tribe Anti-Bunk Nukes: <span class="total-count">${grandTotalAntiBunk}</span></div>
                <div>Tribe Standard Full-Atk: <span class="total-count">${grandTotalFullAtk}</span></div>
            </div>`;

        Object.keys(playerData).sort().forEach(playerName => {
            const timeHeader = isTimeFilterActive ? `<th>Time (${travelUnit})</th>` : '';
            const timeCell = (v) => isTimeFilterActive ? `<td>${formatTimeFromSeconds(v.travelTime)}</td>` : '';
            
            const createTable = (data) => {
                if (data.length === 0) return '<div style="padding:10px; text-align:center;">- No villages meet criteria -</div>';
                const rows = data.map(v => {
                    const [x, y] = v.coord.split('|');
                    const mapLink = `${game_data.link_base_pure}map&x=${x}&y=${y}`;
                    return `<tr><td><a href="${mapLink}" target="_blank">${v.coord}</a> ${v.continent}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td>${timeCell(v)}</tr>`;
                }).join('');
                return `<table class="village-list-table"><thead><tr><th>Village</th><th>Axe</th><th>CL</th><th>Ram</th>${timeHeader}</tr></thead><tbody>${rows}</tbody></table>`;
            };

            const abTable = createTable(bucketVillages[playerName].AntiBunk);
            const faTable = createTable(bucketVillages[playerName].FullAtk);
            const totalsGrid = Object.entries(playerData[playerName].total).map(([troop, count]) => 
                `<div class="atc-troop-item"><img src="/graphic/unit/unit_${troop}.png"> ${numberWithCommas(count)}</div>`
            ).join('');

            tabHtml += `
                <div class="atc-player-card">
                    <div class="atc-player-header">${playerName}</div>
                    <div class="atc-player-body">
                        <div class="atc-category"><h4>Anti-Bunk Nukes <span class="count">${typeTotals[playerName]["AntiBunk"]}</span></h4><button class="collapsible">Show Villages</button><div class="content">${abTable}</div></div>
                        <div class="atc-category"><h4>Standard Full-Atk <span class="count">${typeTotals[playerName]["FullAtk"]}</span></h4><button class="collapsible">Show Villages</button><div class="content">${faTable}</div></div>
                    </div>
                    <div style="padding: 0 15px 15px;"><button class="collapsible">Total Troop Summary</button><div class="content"><div class="atc-totals-grid">${totalsGrid}</div></div></div>
                </div>`;
        });
        return tabHtml;
    }

    function recalculateAndRenderAllTabs() {
        $("#atc-tab-content-troops").html(generateTabContent('troops'));
        $("#atc-tab-content-defense").html(generateTabContent('defense'));
        makeThingsCollapsible();
        window.saveSettings = saveSettings; // Re-bind after html replacement
    }

    function displayUI() {
        const html = `
            <div id="ally-troop-counter-main">
                <div class="atc-main-header"><div class="atc-main-title">Tribe Offensive Power Analysis</div></div>
                <div id="atc-progressbar-container">
                     <div id="atc-progress-text" style="text-align:center; margin-bottom: 5px;">Initializing...</div>
                     <div id="atc-progressbar"><div id="atc-progress">0 / 0</div></div>
                </div>
                <div id="atc-main-content" style="display:none;">
                    <div class="atc-tabs">
                        <button class="atc-tab-button active" data-tab="troops">Total Troops (owned)</button>
                        <button class="atc-tab-button" data-tab="defense">Available Troops (at home)</button>
                    </div>
                    <div id="atc-tab-content-troops" class="atc-tab-content active"></div>
                    <div id="atc-tab-content-defense" class="atc-tab-content"></div>
                    <div class="atc-settings-wrapper">
                        <button class="collapsible">Settings & Filters</button>
                        <div class="content">
                            <div class="atc-settings-panel">
                                <form id="settings" class="atc-settings-form">
                                    <table>
                                        <tr><th colspan="2">Anti-Bunk Thresholds</th><th colspan="2" style="padding-left:20px;">Full-Atk Thresholds</th></tr>
                                        <tr><td>Axe ≥</td><td><input name="minAxeAntiBunk" type="text" value="${minAxeAntiBunk}"></td><td style="padding-left:20px;">Axe ≥</td><td><input name="minAxeFullAtk" type="text" value="${minAxeFullAtk}"></td></tr>
                                        <tr><td>CL ≥</td><td><input name="minLightAntiBunk" type="text" value="${minLightAntiBunk}"></td><td style="padding-left:20px;">CL ≥</td><td><input name="minLightFullAtk" type="text" value="${minLightFullAtk}"></td></tr>
                                        <tr><td>Ram ≥</td><td><input name="minRamAntiBunk" type="text" value="${minRamAntiBunk}"></td><td style="padding-left:20px;">Ram ≥</td><td><input name="minRamFullAtk" type="text" value="${minRamFullAtk}"></td></tr>
                                        <tr><th colspan="4">Travel Time Filter</th></tr>
                                        <tr><td>Target Coords</td><td><input name="targetVillage" type="text" value="${targetVillage}" placeholder="e.g., 500|500"></td><td style="padding-left:20px;">Max Time (HH:MM:SS)</td><td><input name="maxTime" type="text" value="${maxTime}"></td></tr>
                                        <tr><td>Calculate with Unit</td><td colspan="3"><select name="travelUnit">${Object.keys(unitSpeeds).map(u => `<option value="${u}" ${u===travelUnit?'selected':''}>${u.charAt(0).toUpperCase()+u.slice(1)}</option>`).join('')}</select></td></tr>
                                        <tr><td colspan="4" style="text-align:center; padding-top: 15px;"><input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save & Recalculate" onclick="saveSettings()"></td></tr>
                                    </table>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        $("#contentContainer").prepend(html);
        
        // Tab switching logic
        $('.atc-tab-button').on('click', function() {
            const tab = $(this).data('tab');
            $('.atc-tab-button').removeClass('active');
            $(this).addClass('active');
            $('.atc-tab-content').removeClass('active');
            $('#atc-tab-content-' + tab).addClass('active');
        });
    }

    // --- Main Execution ---
    function run() {
        loadSettings();

        // Populate player lists and URLs
        const baseURL_troops = game_data.link_base_pure + "ally&mode=members_troops&player_id=";
        const baseURL_defense = game_data.link_base_pure + "ally&mode=members_defense&player_id=";
        $('#ally_content .vis tr').not(':first-child').each(function() {
            const playerLink = $(this).find('a').first();
            const playerName = playerLink.text().trim();
            const playerID = playerLink.attr('href').match(/id=(\d+)/)[1];
            if (playerID) {
                playerList.push({ "id": playerID, "name": playerName });
                playerURLs_troops.push(baseURL_troops + playerID);
                playerURLs_defense.push(baseURL_defense + playerID);
            }
        });

        displayUI(); // Display the UI shell with progress bar immediately

        // Start fetching data sequentially
        fetchDataForMode('troops', () => {
            console.log("Finished fetching members_troops data.");
            fetchDataForMode('defense', () => {
                console.log("Finished fetching members_defense data.");
                $("#atc-progressbar-container").hide();
                $("#atc-main-content").show();
                recalculateAndRenderAllTabs();
            });
        });
    }

    run(); // Start the script
})();

