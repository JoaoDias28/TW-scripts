javascript: 
if (window.location.href.indexOf('&screen=ally&mode=members') < 0
 || window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
  window.location.assign(game_data.link_base_pure + "ally&mode=members");
}

let baseURL = `game.php?screen=ally&mode=members_troops&player_id=`,
    playerURLs = [], players = [], playerData = [],
    minVK, minLightCav, minRam;

// --- Load (or initialize) thresholds from localStorage ---
(function(){
  let s = localStorage.getItem("settingsTribeMembers");
  if (s) {
    let a = JSON.parse(s).map(o=>parseInt(o.value,10));
    [minVK, minLightCav, minRam] = a;
  } else {
    let defaults = [
      { name:"minVK",       value:"4500" },
      { name:"minLightCav", value:"2000" },
      { name:"minRam",      value:"300"  }
    ];
    localStorage.setItem("settingsTribeMembers", JSON.stringify(defaults));
    [minVK, minLightCav, minRam] = defaults.map(o=>parseInt(o.value,10));
  }
})();

// --- Collect tribe members ---
$('input:radio[name=player]').each(function(){
  let id = $(this).val(),
      name = $(this).parent().text().trim();
  playerURLs.push(baseURL + id);
  players.push({ id, name });
});

// --- Throttled multi-GET helper ---
$.getAll = function(urls, onLoad, onDone, onError){
  let idx=0, last=0, minWait=600;
  (function next(){
    if(idx>=urls.length) return onDone();
    let now=Date.now(), delta=now-last;
    if(delta<minWait) return setTimeout(next, minWait-delta);
    last=now;
    $.get(urls[idx])
     .done(data=>{ onLoad(idx, data); idx++; next(); })
     .fail(err=> onError(err));
  })();
};

// --- Fetch & parse every member’s troop pages ---
function calculateEverything(){
  $.getAll(playerURLs,
    (i, html) => {
      let name = players[i].name,
          $doc = $(html),
          rows = $doc.find('.vis.w100 tr').not(':first'),
          extraLinks = $doc.find('.paged-nav-item[href]').map((_,a)=>a.href).get();

      playerData[name] = [];

      // fetch extra pages if any
      $.getAll(extraLinks,
        (_, moreHtml) => {
          rows = rows.add($(moreHtml).find('.vis.w100 tr').not(':first'));
        },
        ()=>{ /* all pages loaded */ },
        e=>console.error(e)
      );

      // parse each village row
      rows.each((_,tr)=>{
        let $tr = $(tr).children(),
            // grab unit counts
            stats = { vk:0, light:0, ram:0 };
        game_data.units.forEach((unit, idx)=>{
          let txt = $tr.eq(idx+1).text().trim(),
              cnt = txt==='?'?0:parseInt(txt,10);
          switch(unit){
            case 'axe':     stats.vk    += cnt;       break;
            case 'light':   stats.vk    += 4*cnt;
                             stats.light= cnt;       break;
            case 'marcher': stats.vk    += 5*cnt;       break;
            case 'ram':     stats.vk    += 5*cnt;
                             stats.ram  = cnt;       break;
            case 'catapult':stats.vk    += 8*cnt;       break;
            // any other unit: ignore entirely
          }
        });
        playerData[name].push(stats);
      });
    },
    () => displayTotals(),
    err => console.error(err)
  );
}

// --- Compute tribe + per-player “full” counts & render ---
function displayTotals(){
  let tribeFull = 0,
      perPlayer = {};

  players.forEach(p => {
    let list = playerData[p.name] || [],
        full = list.reduce((sum, v)=>{
          return sum + (
            v.vk    >= minVK &&
            v.light >= minLightCav &&
            v.ram   >= minRam
            ? 1 : 0
          );
        }, 0);
    perPlayer[p.name] = full;
    tribeFull += full;
  });

  // build and inject a simple UI
  let panel = `
    <div style="background:#202225;color:#fff;padding:10px;margin:10px 0">
      <h2>Tribe “full-attack” villages: ${tribeFull}</h2>
      <table style="width:100%;border-collapse:collapse;color:#fff">
        <thead>
          <tr><th style="text-align:left">Member</th>
              <th style="text-align:right">Full count</th></tr>
        </thead>
        <tbody>
          ${players.map(p=>`
            <tr>
              <td style="padding:4px">${p.name}</td>
              <td style="padding:4px;text-align:right">${perPlayer[p.name]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  $("#contentContainer").prepend(panel);
}

calculateEverything();
