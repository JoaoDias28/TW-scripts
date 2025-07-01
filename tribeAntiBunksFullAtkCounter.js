javascript:

if (window.location.href.indexOf('&screen=ally&mode=members') < 0 || window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
    //relocate
    window.location.assign(game_data.link_base_pure + "ally&mode=members");
}

var baseURL = `game.php?screen=ally&mode=members_troops&player_id=`;
var playerURLs = [];
var villageData = {};
var playerData = {};
var player = [];
var typeTotals = {};
var bucketVillages = {};
//remove previous ran version of script if accidental doublelaunch
$(".flex-container").remove();
$("div[id*='player']").remove();
// get/store settings
if (localStorage.getItem("settingsTribeMembersFullAtk") != null) {
    tempArray = JSON.parse(localStorage.getItem("settingsTribeMembersFullAtk"));
    minAxeAntiBunk = tempArray[0].value;
    minLightAntiBunk = tempArray[1].value;
    minRamAntiBunk = tempArray[2].value;
    minAxeFullAtk = tempArray[3].value;
    minLightFullAtk = tempArray[4].value;
    minRamFullAtk = tempArray[5].value;

}
else {
    tempArray = [
        { name: "minAxeAntiBunk", value: "4500" },
        { name: "minLightAntiBunk", value: "2000" },
        { name: "minRamAntiBunk", value: "1000" },
        { name: "minAxeFullAtk", value: "4500" },
        { name: "minLightFullAtk", value: "2000" },
        { name: "minRamFullAtk", value: "300" }
    ]
    minAxeAntiBunk = tempArray[0].value;
    minLightAntiBunk = tempArray[1].value;
    minRamAntiBunk = tempArray[2].value;
    minAxeFullAtk = tempArray[3].value;
    minLightFullAtk = tempArray[4].value;
    minRamFullAtk = tempArray[5].value;
    localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(tempArray));
}
//collect all player names/ids
$('input:radio[name=player]').each(function () {
    playerURLs.push(baseURL + $(this).attr("value"));
    player.push({ "id": $(this).attr("value"), "name": $(this).parent().text().trim() });
});

cssClassesSophie = `
<style>


.sophRowA,
.sophHeader{
    width:100% !important;       
}

.content{
    width:100% !important;
    overflow-x:auto;             
}

/
.village-list-table{
    width:100% !important;
    table-layout:fixed;
}

.village-list-table th,
.village-list-table td{
    padding:6px 8px;
    white-space:nowrap;         
}

.sophRowA {
padding: 10px;
background-color: #32353b;
color: white;
}

.sophRowB {
padding: 10px;
background-color: #36393f;
color: white;
}
.sophHeader {
padding: 10px;
background-color: #202225;
font-weight: bold;
color: white;
}
.sophTitle {
background-color:  #17181a;
}

.collapsible {
background-color: #32353b;
color: white;
cursor: pointer;
padding: 10px;
width: 100%;
border: none;
text-align: left;
outline: none;
font-size: 15px;
}

.active, .collapsible:hover {
background-color:  #36393f;
}

.collapsible:after {
content: '+';
color: white;
font-weight: bold;
float: right;
margin-left: 5px;
}

.active:after {
content: "-";
}

.content {
padding: 0 5px;
max-height: 0;
overflow: hidden;
transition: max-height 0.2s ease-out;
background-color:  #5b5f66;
color: white;
}

.item-padded {
padding: 5px;
}

.flex-container {
display: flex;
justify-content: space-between;
align-items:center
}

.submenu{
    display:flex;
    flex-direction:column;
    position: absolute;
    left:566px;
    top:53px;
    min-width:234px;
}

.village-list-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 0.9em;
}

.village-list-table thead th {
    background-color: #202225;
    color: #e0e0e0;
    padding: 10px;
    border-bottom: 2px solid #4CAF50; /* Green accent line */
}

.village-list-table tbody tr:nth-child(even) {
    background-color: #36393f;
}

.village-list-table tbody tr:nth-child(odd) {
    background-color: #32353b;
}

.village-list-table td {
    padding: 8px 10px;
    border-top: 1px solid #4f545c;
}


.village-list-table th:nth-child(1), .village-list-table td:nth-child(1) { text-align: left; } /* Village */
.village-list-table th:nth-child(n+2), .village-list-table td:nth-child(n+2) { text-align: right; } /* Axe, LC, Ram (and any future numeric columns) */
</style>`

$("#contentContainer").eq(0).prepend(cssClassesSophie);
$("#mobileHeader").eq(0).prepend(cssClassesSophie);

$.getAll = function (
    urls, // array of URLs
    onLoad, // called when any URL is loaded, params (index, data)
    onDone, // called when all URLs successfully loaded, no params
    onError // called when a URL load fails or if onLoad throws an exception, params (error)
) {
    var numDone = 0;
    var lastRequestTime = 0;
    var minWaitTime = 200; // ms between requests
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
        $("#progress").css("width", `${(numDone + 1) / urls.length * 100}%`);
        lastRequestTime = now;
        $.get(urls[numDone])
            .done((data) => {
                try {
                    onLoad(numDone, data);
                    ++numDone;
                    loadNext();
                } catch (e) {
                    onError(e);
                }
            })
            .fail((xhr) => {
                onError(xhr);
            })
    }
};

function calculateEverything() {
    //progress bar
    $("#contentContainer").eq(0).prepend(`
    <div id="progressbar" style="width: 100%;
    background-color: #36393f;"><div id="progress" style="width: 0%;
    height: 35px;
    background-color: #4CAF50;
    text-align: center;
    line-height: 32px;
    color: black;"></div>
    </div>`);
    $("#mobileHeader").eq(0).prepend(`
    <div id="progressbar" style="width: 100%;
    background-color: #36393f;"><div id="progress" style="width: 0%;
    height: 35px;
    background-color: #4CAF50;
    text-align: center;
    line-height: 32px;
    color: black;"></div>
    </div>`);

    // collect all data from every player
    $.getAll(playerURLs,
        (i, data) => {
            console.log("Grabbing player nr " + i);
            console.log("Grabbing page nr 0");

            villageData = {};
            villageData["total"] = {}
            //grab village rows
            if ($(data).find(".paged-nav-item").length == 0) {
                rows = $(data).find(".vis.w100 tr").not(':first');
            }
            else {
                rows = $(data).find(".vis.w100 tr").not(':first').not(":first").not(":last");
            }

            //grab extra pages if there are any
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
                    }
                    else {
                        rows = $.merge(rows, $(getMore).find(".vis.w100 tr").not(':first').not(":first").not(":last"));
                    }

                },
                () => {
                    console.log("Rows for player " + player[i].name + " total: " + rows.length);
                    //create empty total object
                    $.each(game_data.units, function (index) {
                        unitName = game_data.units[index];
                        villageData["total"][unitName] = 0;
                    })
                    //get all unit data
                    $.each(rows, function (rowNr) {
                        const thisID = rows.eq(rowNr).find("a")[0].outerHTML.match(/id=(\d*)/)[1];
                        // =========================================================================
                        // BUG FIX #1: Initialize as an object {}, not an array [].
                        // =========================================================================
                        villageData[thisID] = {};
                        
                        const linkTxt = rows.eq(rowNr).find('a').text();
                        const mCoords = linkTxt.match(/(\d+\|\d+)/);
                        villageData[thisID]['coords'] = mCoords ? mCoords[1] : '?';

                        $.each(game_data.units, function (index) {
                            const unitName = game_data.units[index];
                            const unitValue = rows.eq(rowNr).children().not(':first').eq(index + 1).text().trim();
                            
                            if (unitValue !== '?') {
                                villageData[thisID][unitName] = parseInt(unitValue);
                                villageData["total"][unitName] += parseInt(unitValue);
                            }
                            else {
                                villageData[thisID][unitName] = 0;
                            }
                        });
                    });

                    playerData[player[i].name] = villageData;
                    // set up total nuke/DV counts at 0 to start
                    typeTotals[player[i].name] = { "AntiBunk": 0, "FullAtk": 0 };
                    bucketVillages[player[i].name] = { AntiBunk: [], FullAtk: [] };

                },
                (error) => {
                    console.error(error);
                });



        },
        () => {
            $("#progressbar").remove();
            displayEverything();
        },
        (error) => {
            console.error(error);
        });
}

calculateEverything();
function makeThingsCollapsible() {
    // Use event delegation for dynamically added elements to be safe
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
    // add . to make numbers more readable
    x = x.toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1.$2");
    return x;
}

function saveSettings() {
    tempArray = $("#settings").serializeArray();
    minAxeAntiBunk = tempArray[0].value;
    minLightAntiBunk = tempArray[1].value;
    minRamAntiBunk = tempArray[2].value;
    minAxeFullAtk = tempArray[3].value;
    minLightFullAtk = tempArray[4].value;
    minRamFullAtk = tempArray[5].value;
    localStorage.setItem("settingsTribeMembersFullAtk", JSON.stringify(tempArray));
    $(".flex-container").remove();
    $("div[id*='player']").remove();
    displayEverything();
}

function displayEverything() {
    html = `
    <div class="sophTitle sophHeader flex-container" style="width: 800px;position: relative">
        <div class="sophTitle sophHeader" style="width: 550px;min-width: 520px;"><font size="5">Full Atk / Anti Bunk tribe counter </font></div>
        <button class="sophRowA collapsible" style="width: 250px;min-width: 230px;">Open settings menu</button>
        <div class="content submenu" style="width: 200px;height:500px;z-index:99999">
            <form id="settings">
                <table style="border-spacing:2px;">
                    <!-- ─────────── Anti-Bunk section ─────────── -->
                    <tr><th colspan="2" class="item-padded" style="text-align:left;background:#32353b">Anti-Bunk thresholds</th></tr>
                    <tr><td class="item-padded">Axe ≥</td><td class="item-padded"><input name="minAxeAntiBunk"  value="${minAxeAntiBunk}"  style="width:80px"> u</td></tr>
                    <tr><td class="item-padded">LC ≥</td> <td class="item-padded"><input name="minLightAntiBunk" value="${minLightAntiBunk}" style="width:80px"> u</td></tr>
                    <tr><td class="item-padded">Ram ≥</td><td class="item-padded"><input name="minRamAntiBunk"   value="${minRamAntiBunk}"  style="width:80px"> u</td></tr>
                    <!-- ─────────── Full-Atk section ─────────── -->
                    <tr><th colspan="2" class="item-padded" style="text-align:left;background:#32353b">Full-Atk thresholds</th></tr>
                    <tr><td class="item-padded">Axe ≥</td><td class="item-padded"><input name="minAxeFullAtk"   value="${minAxeFullAtk}"   style="width:80px"> u</td></tr>
                    <tr><td class="item-padded">LC ≥</td> <td class="item-padded"><input name="minLightFullAtk" value="${minLightFullAtk}" style="width:80px"> u</td></tr>
                    <tr><td class="item-padded">Ram ≥</td><td class="item-padded"><input name="minRamFullAtk"   value="${minRamFullAtk}"   style="width:80px"> u</td></tr>
                    <!-- save button -->
                    <tr><td colspan="2" style="padding:6px;text-align:center">
                    <input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="saveSettings();">
                    </td></tr>
                </table>
            </form>
        </div>
    </div>`;

    //display the data in a neat UI
    $.each(player, function (play) {
        typeTotals[player[play].name] = { "AntiBunk": 0, "FullAtk": 0 };
        bucketVillages[player[play].name] = { AntiBunk: [], FullAtk: [] };
    });

    $.each(playerData, function (playerName) {
        // Loop through village IDs, skipping the "total" key
        const villageIds = Object.keys(playerData[playerName]).filter(key => key !== "total");

        for (const villageId of villageIds) {
            const village = playerData[playerName][villageId];

            // =========================================================================
            // BUG FIX #2: Use direct property access instead of fragile key-order logic.
            // =========================================================================
            const thisVillageAxeUnits = village.axe || 0;
            const thisVillageLightUnits = village.light || 0;
            const thisVillageRamUnits = village.ram || 0;

            // AntiBunk
            if (thisVillageAxeUnits >= minAxeAntiBunk && thisVillageLightUnits >= minLightAntiBunk && thisVillageRamUnits >= minRamAntiBunk) {
                typeTotals[playerName]["AntiBunk"] += 1;
                bucketVillages[playerName].AntiBunk.push({
                    coord: village.coords,
                    axe: thisVillageAxeUnits,
                    lc: thisVillageLightUnits,
                    ram: thisVillageRamUnits
                });
            }
            // FullAtk
            else if (thisVillageAxeUnits >= minAxeFullAtk && thisVillageLightUnits >= minLightFullAtk && thisVillageRamUnits >= minRamFullAtk && thisVillageRamUnits < minRamAntiBunk) {
                typeTotals[playerName]["FullAtk"] += 1;
                bucketVillages[playerName].FullAtk.push({
                    coord: village.coords,
                    axe: thisVillageAxeUnits,
                    lc: thisVillageLightUnits,
                    ram: thisVillageRamUnits
                });
            }
        }

        html += `
        <div id='player${playerName}' class="sophHeader" style="float: left;width: 800px;">
            <p style="padding:10px">${playerName}</p>
            <div class="sophRowA" width="760px">
                <table width="100%"><tr><td>
                    <table>`;

        let offTable = "";
        const playerBuckets = bucketVillages[playerName];

        // --- AntiBunk Table ---
        const abRows = playerBuckets.AntiBunk.map(v =>
            `<tr><td>${v.coord}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td></tr>`).join('');
        offTable += `
            <tr>
                <td class="item-padded">Full Anti-Bunk:</td>
                <td class="item-padded">${typeTotals[playerName]["AntiBunk"]}</td>
            </tr>
            <tr>
                <td colspan="2" class="item-padded">
                    <button class="collapsible">Villages</button>
                    <div class="content">
                        <table class="village-list-table">
                            <tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr>
                            ${abRows || '<tr><td class="item-padded" colspan="4">—</td></tr>'}
                        </table>
                    </div>
                </td>
            </tr>`;

        // --- FullAtk Table ---
        const faRows = playerBuckets.FullAtk.map(v =>
            `<tr class="village-list-table"><td class="item-padded">${v.coord}</td><td class="item-padded">${numberWithCommas(v.axe)}</td><td class="item-padded">${numberWithCommas(v.lc)}</td><td class="item-padded">${numberWithCommas(v.ram)}</td></tr>`).join('');
        offTable += `
            <tr>
                <td class="item-padded">Full Atk Normal:</td>
                <td class="item-padded">${typeTotals[playerName]["FullAtk"]}</td>
            </tr>
            <tr>
                <td colspan="2" class="item-padded">
                    <button class="collapsible">Villages</button>
                    <div class="content">
                        <table class="village-list-table">
                            <tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr>
                            ${faRows || '<tr><td class="item-padded" >—</td></tr>'}
                        </table>
                    </div>
                </td>
            </tr>`;

        html += offTable + `</table></td></tr></table>
            </div>
            <button class="collapsible">More details</button>
            <div class="content"><table><tr>`;
        
        // --- Total Troops Table ---
        $.each(playerData[playerName]["total"], function (troopName, troopCount) {
            if (troopName == "spy" || troopName == "ram" || troopName == "snob") {
                html += '</tr><tr>'
            }
            html += `<td><table><tr><td class="item-padded"><img src="/graphic/unit/unit_${troopName}.png" title="${troopName}" alt="" class=""></td>
                <td class="item-padded">${numberWithCommas(troopCount)}</td></tr></table></td>`
        })

        html += `</tr></table></div></div>`;
    });

    $("#contentContainer").prepend(html);
    makeThingsCollapsible();
}
