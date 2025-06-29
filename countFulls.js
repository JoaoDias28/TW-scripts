javascript:
if (window.location.href.indexOf('&screen=ally&mode=members') < 0 
 || window.location.href.indexOf('&screen=ally&mode=members_troops') > -1) {
  window.location.assign(game_data.link_base_pure + "ally&mode=members");
}

const baseURL      = `game.php?screen=ally&mode=members_troops&player_id=`;
let   playerURLs   = [], 
      players      = [], 
      playerData   = {},   // { playerName: [ {axe, light, ram}, … ] }

let minAxe, minLightCav, minRam;

// === SETTINGS LOAD / INIT ===
(function(){
  const key = "settingsTribeMembers";
  let stored = localStorage.getItem(key);
  if (stored) {
    let arr = JSON.parse(stored);
    minAxe        = parseInt(arr[0].value, 10);
    minLightCav   = parseInt(arr[1].value, 10);
    minRam        = parseInt(arr[2].value, 10);
  } else {
    let defaults = [
      { name:"minAxe",       value:"100"  },  // default min axes
      { name:"minLightCav",  value:"2000" },
      { name:"minRam",       value:"300"  }
    ];
    localStorage.setItem(key, JSON.stringify(defaults));
    minAxe        = 100;
    minLightCav   = 2000;
    minRam        = 300;
  }
})();

// === COLLECT MEMBERS ===
$('input:radio[name=player]').each(function(){
  let id   = $(this).val(),
      name = $(this).parent().text().trim();
  playerURLs.push(baseURL + id);
  players.push({ id, name });
});

// === THROTTLED MULTI-GET ===
$.getAll = function(urls, onLoad, onDone, onError) {
  let idx = 0, last = 0, delay = 600;
  (function next(){
    if (idx >= urls.length) return onDone();
    let now = Date.now(), d = now - last;
    if (d < delay) return setTimeout(next, delay - d);
    last = now;
    $.get(urls[idx])
      .done(html => { onLoad(idx, html); idx++; next(); })
      .fail(err => onError(err));
  })();
};

// === SCRAPE EACH MEMBER ===
function calculateEverything() {
  $.getAll(
    playerURLs,
    (i, html) => {
      let playerName = players[i].name;
      let $doc       = $(html);
      let rows       = $doc.find('.vis.w100 tr').not(':first');

      // pagination links
      let extraHrefs = [];
      $doc.find('.paged-nav-item[href]').each((_,el)=>{
        let href = $(el).getAttribute
                    ? el.href 
                    : $(el).attr('href');
        if (href && !extraHrefs.includes(href)) extraHrefs.push(href);
      });

      playerData[playerName] = [];

      // fetch extra pages
      $.getAll(
        extraHrefs.map(h=>game_data.link_base_pure + h),
        (_, moreHtml) => {
          let $m = $(moreHtml);
          let r  = $m.find('.vis.w100 tr').not(':first');
          rows = rows.add(r);
        },
        () => {
          // parse all rows
          rows.each((_, tr) => {
            let $cells = $(tr).children(),
                stats  = { axe:0, light:0, ram:0 };

            game_data.units.forEach((unit, idx) => {
              let txt = $cells.eq(idx+1).text().trim(),
                  cnt = txt === '?' ? 0 : parseInt(txt,10);
              switch(unit) {
                case 'axe':
                  stats.axe = cnt;
                  break;
                case 'light':
                  stats.light = cnt;
                  break;
                case 'ram':
                  stats.ram = cnt;
                  break;
                // ignore all others
              }
            });

            playerData[playerName].push(stats);
          });
        },
        err => console.error(err)
      );
    },
    () => displayResults(),
    err => console.error(err)
  );
}

// === COMPUTE & DISPLAY ===
function displayResults() {
  let tribeFull = 0,
      perPlayer = {};

  players.forEach(p => {
    let list = playerData[p.name] || [];
    let fullCount = list.reduce((sum, v) => {
      return sum + (
        v.axe   >= minAxe       &&
        v.light >= minLightCav  &&
        v.ram   >= minRam
        ? 1 : 0
      );
    }, 0);
    perPlayer[p.name] = fullCount;
    tribeFull += fullCount;
  });

  const panel = `
    <div style="background:#202225;color:#fff;padding:12px;margin:12px 0">
      <h2 style="margin:0">
        Tribe full villages (axe≥${minAxe}, light≥${minLightCav}, ram≥${minRam}): 
        ${tribeFull}
      </h2>
      <table style="width:100%;border-collapse:collapse;color:#fff;margin-top:8px">
        <thead>
          <tr>
            <th style="text-align:left;padding:4px">Member</th>
            <th style="text-align:right;padding:4px">Full count</th>
          </tr>
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
    </div>`;
  $("#contentContainer").prepend(panel);
}

calculateEverything();
