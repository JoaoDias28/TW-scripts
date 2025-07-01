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

    // Only set up the overall player structure if not already done.
    // The bucketVillages should already be populated from calculateEverything()
    // It's fine to initialize typeTotals here if you want to recalculate them,
    // but better to move all calculations to calculateEverything.
    // For now, let's keep the calculations in displayEverything as you had them,
    // but ensure bucketVillages is NOT emptied.

    // NO RE-INITIALIZATION OF bucketVillages HERE!
    // The previous loop that re-initialized typeTotals and bucketVillages
    // should be removed or changed like this:
    $.each(player, function (play) {
        // If typeTotals are only calculated in calculateEverything, this line can be removed.
        // If they are calculated again in displayEverything (as your current code does),
        // then this re-initialization is needed for typeTotals.
        // But bucketVillages must NOT be re-initialized here.
        // typeTotals[player[play].name] = { "AntiBunk": 0, "FullAtk": 0};
        // bucketVillages[player[play].name] = { AntiBunk:[], FullAtk:[] }; // <-- THIS WAS THE PROBLEM LINE
    });


    $.each(playerData, function (playerName) {
        // Recalculate typeTotals and bucketVillages *within* displayEverything for current player
        // This is where you recalculate and push villages into bucketVillages
        // It's generally better to do all calculations in calculateEverything
        // and just display in displayEverything.
        // However, to fix your immediate problem, we'll keep the calculation here
        // but ensure bucketVillages is *not* emptied at the start of displayEverything.

        // Re-initialize for the current player's *display* calculations
        typeTotals[playerName] = { "AntiBunk": 0, "FullAtk": 0};
        bucketVillages[playerName] = { AntiBunk:[], FullAtk:[] };

        for (var villageCounter = 0; villageCounter < Object.keys(playerData[playerName]).length; villageCounter++) {
            if (Object.keys(playerData[playerName])[villageCounter] != "total") {
                thisVillageAxeUnits = 0;
                thisVillageLightUnits = 0;
                thisVillageRamUnits = 0;

                // Make sure to parse ints properly, your original code had issues here.
                // It was using parseInt on `trim()` which is fine, but the logic
                // for which units contribute to axe/light/ram was based on `game_data.units[lol]`
                // instead of the actual key in `playerData[playerName][villageId]`.
                // The switch case based on `Object.keys(playerData[playerName][Object.keys(playerData[playerName])[villageCounter]])[lol]`
                // is quite convoluted. It's better to directly access by unit name.

                const currentVillageData = playerData[playerName][Object.keys(playerData[playerName])[villageCounter]];
                thisVillageAxeUnits = parseInt(currentVillageData.axe || 0);
                thisVillageLightUnits = parseInt(currentVillageData.light || 0);
                thisVillageRamUnits = parseInt(currentVillageData.ram || 0);

                //AntiBunk
                if (thisVillageAxeUnits >= minAxeAntiBunk && thisVillageLightUnits >= minLightAntiBunk && thisVillageRamUnits >= minRamAntiBunk){
                    typeTotals[playerName]["AntiBunk"] += 1;
                    bucketVillages[playerName].AntiBunk.push({
                        coord : currentVillageData.coords,
                        axe   : thisVillageAxeUnits,
                        lc    : thisVillageLightUnits,
                        ram   : thisVillageRamUnits
                    });
                }
                //FullAtk
                if (thisVillageAxeUnits >= minAxeFullAtk && thisVillageLightUnits >= minLightFullAtk && thisVillageRamUnits >= minRamFullAtk && thisVillageRamUnits < minRamAntiBunk){
                    typeTotals[playerName]["FullAtk"] += 1;
                    bucketVillages[playerName].FullAtk.push({
                        coord : currentVillageData.coords,
                        axe   : thisVillageAxeUnits,
                        lc    : thisVillageLightUnits,
                        ram   : thisVillageRamUnits
                    });
                }
            }
        }

        html += `
        <div id='player${playerName}' class="sophHeader" style="float: left;width: 800px;">
            <p style="padding:10px">${playerName}</p>
            <div class="sophRowA" width="760px">
            <table width="100%"><tr><td><table>`
        offTable = "";
        defTable = "";
        other = "";
        $.each(typeTotals[playerName], function (type) {
            switch (type) {
                case "AntiBunk":
                    // Ensure bucketVillages[playerName][type] exists and is an array before mapping
                    const abRows = (bucketVillages[playerName] && bucketVillages[playerName][type] ? bucketVillages[playerName][type] : []).map(v =>
                         `<tr><td>${v.coord}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td></tr>`).join('');
                     offTable += `
                     <tr><td class="item-padded">Full Anti-Bunk:</td>
                         <td class="item-padded">${typeTotals[playerName][type]}</td></tr>
                       <tr><td colspan="2" class="item-padded">
                         <button class="collapsible">Villages</button>
                           <div class="content"><table>
                           <tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr>
                              ${abRows || '<tr><td colspan="4">—</td></tr>'}
                         </table></div>
                      </td></tr>`;
                     break;
                case "FullAtk":
                  const faRows = (bucketVillages[playerName] && bucketVillages[playerName][type] ? bucketVillages[playerName][type] : []).map(v =>
                          `<tr><td>${v.coord}</td><td>${numberWithCommas(v.axe)}</td><td>${numberWithCommas(v.lc)}</td><td>${numberWithCommas(v.ram)}</td></tr>`).join('');
                     offTable += `
                      <tr><td class="item-padded">Full Atk Normal:</td>
                          <td class="item-padded">${typeTotals[playerName][type]}</td></tr>
                      <tr><td colspan="2" class="item-padded">
                          <button class="collapsible">Villages</button>
                         <div class="content"><table>
                            <tr><th>Village</th><th>Axe</th><th>LC</th><th>Ram</th></tr>
                            ${faRows || '<tr><td colspan="4">—</td></tr>'}
                          </table></div>
                       </td></tr>`;
                     break;
                default:
                    console.log("Rip in pepperonis")
                    break;
            }
        });

        html += offTable + "</table></td><td><table>" + defTable + "</table></td><td><table>" + other;
        html += `</table></td></tr></table>
                </div>
                <button class="collapsible">More details</button>
                <div class="content"><table><tr>`;
        $.each(playerData[playerName]["total"], function (troopName) {
            if (troopName == "spy" || troopName == "ram" || troopName == "snob") {
                html += '</tr><tr>'
            }
            html += `<td><table><tr><td class="item-padded"><img src="/graphic/unit/unit_${troopName}.png" title="${troopName}" alt="" class=""></td>
                <td class="item-padded">${numberWithCommas(playerData[playerName]["total"][troopName])}</td></tr></table></td>`
        })

        html += `</tr></table></div></div>`;
    });

    $("#contentContainer").prepend(html);
    makeThingsCollapsible();
}
