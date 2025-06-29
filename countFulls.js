javascript:
// ————— Redirect if needed —————
if (
  window.location.href.indexOf('&screen=ally&mode=members') < 0 ||
  window.location.href.indexOf('&screen=ally&mode=members_troops') > -1
) {
  window.location.assign(game_data.link_base_pure + "ally&mode=members");
}

// ————— Sophie’s CSS —————
const css = `
<style>
.sophRowA { padding:10px; background:#32353b; color:#fff; cursor:pointer; }
.sophRowB { padding:10px; background:#36393f; color:#fff; }
.sophHeader { padding:10px; background:#202225; font-weight:bold; color:#fff; }
.sophTitle  { background:#17181a; color:#fff; }
.collapsible {
  background:#32353b; color:#fff; cursor:pointer; padding:10px; width:100%;
  border:none; text-align:left; font-size:15px;
}
.active, .collapsible:hover { background:#36393f; }
.collapsible:after { content:'+'; float:right; font-weight:bold; }
.active:after      { content:'-'; }
.content {
  padding:0 5px; max-height:0; overflow:hidden;
  transition:max-height 0.2s ease-out; background:#5b5f66; color:#fff;
}
.item-padded { padding:5px; }
.flex-container {
  display:flex; justify-content:space-between; align-items:center;
}
.submenu {
  display:flex; flex-direction:column; position:absolute;
  left:566px; top:53px; min-width:234px; z-index:99999;
}
#progressbar { width:100%; background:#36393f; margin-bottom:10px; }
#progress    { width:0%; height:35px; background:#4CAF50;
                text-align:center; line-height:35px; color:black; }
</style>`;
$("head").append(css);

// ————— Globals & Settings —————
const baseURL      = `game.php?screen=ally&mode=members_troops&player_id=`;
let   playerURLs   = [], 
      players      = [],
      playerData   = {},
      minAxe, minLightCav, minRam;

// load or init settings
(function(){
  const key = "settingsTribeMembers";
  let s = localStorage.getItem(key);
  if (s) {
    let a = JSON.parse(s);
    minAxe       = parseInt(a[0].value,10);
    minLightCav  = parseInt(a[1].value,10);
    minRam       = parseInt(a[2].value,10);
  } else {
    let def = [
      { name:"minAxe",      value:"100"  },
      { name:"minLightCav", value:"2000" },
      { name:"minRam",      value:"300"  }
    ];
    localStorage.setItem(key, JSON.stringify(def));
    [minAxe, minLightCav, minRam] = [100,2000,300];
  }
})();

// collect tribe members
$('input:radio[name=player]').each(function(){
  let id   = $(this).val(),
      name = $(this).parent().text().trim();
  playerURLs.push(baseURL + id);
  players.push({ id, name });
});

// throttled multi‐GET
$.getAll = function(urls, onLoad, onDone, onError) {
  let idx=0, last=0, minWait=600;
  (function next(){
    if(idx>=urls.length) return onDone();
    let now=Date.now(), d=now-last;
    if(d<minWait) return setTimeout(next, minWait-d);
    last=now;
    $.get(urls[idx])
      .done(html=>{ onLoad(idx, html); idx++; next(); })
      .fail(err=>onError(err));
  })();
};

// ————— Main runner —————
function calculateEverything(){
  // remove old UI
  $(".flex-container, #progressbar, #tribePanel").remove();
  $("div[id^='player']").remove();

  // inject settings + tribe header
  const header = `
    <div class="sophTitle sophHeader flex-container" id="tribePanel">
      <div><font size="5">Tribe “full” village counter</font></div>
      <button class="sophRowA collapsible">Open settings menu</button>
      <div class="content submenu">
        <form id="settings">
          <table>
            <tr>
              <td class="item-padded"><label>Min Axe</label></td>
              <td class="item-padded"><input type="text" name="minAxe" value="${minAxe}" /></td>
            </tr>
            <tr>
              <td class="item-padded"><label>Min Light Cav</label></td>
              <td class="item-padded"><input type="text" name="minLightCav" value="${minLightCav}" /></td>
            </tr>
            <tr>
              <td class="item-padded"><label>Min Ram</label></td>
              <td class="item-padded"><input type="text" name="minRam" value="${minRam}" /></td>
            </tr>
            <tr>
              <td colspan="2" class="item-padded">
                <input type="button" class="sophRowA" value="Save" onclick="saveSettings()" />
              </td>
            </tr>
          </table>
        </form>
      </div>
    </div>`;
  $("#contentContainer").prepend(header);
  makeThingsCollapsible();

  // inject progress bar
  const prog = `<div id="progressbar"><div id="progress">0%</div></div>`;
  $("#contentContainer").prepend(prog);

  playerData = {};

  // fetch each member
  $.getAll(
    playerURLs,
    (i, html) => {
      let name = players[i].name;
      let $d   = $(html);
      let rows = $d.find('.vis.w100 tr').not(':first');
      // pagination links
      let extras = [];
      $d.find('.paged-nav-item[href]').each((_,el)=>{
        let href = $(el).href || $(el).attr('href');
        if (href && extras.indexOf(href)<0) extras.push(href);
      });

      playerData[name] = [];

      // fetch extras
      $.getAll(
        extras.map(h=>game_data.link_base_pure + h),
        (_, moreHtml) => {
          let $m = $(moreHtml);
          let r  = $m.find('.vis.w100 tr').not(':first');
          rows = rows.add(r);
        },
        () => {
          // parse all villages
          rows.each((_, tr)=>{
            let $c   = $(tr).children(),
                stats= { axe:0, light:0, ram:0 };
            game_data.units.forEach((u, idx)=>{
              let txt = $c.eq(idx+1).text().trim(),
                  cnt = txt==='?'?0:parseInt(txt,10);
              if (u==='axe')     stats.axe   = cnt;
              if (u==='light')   stats.light = cnt;
              if (u==='ram')     stats.ram   = cnt;
            });
            playerData[name].push(stats);
          });
        },
        err=>console.error(err)
      );

      // update progress bar
      let pct = Math.round((i+1)/playerURLs.length*100);
      $("#progress").css("width",pct+"%").text(pct+"%");
    },
    () => {
      $("#progressbar").remove();
      displayResults();
    },
    err => console.error(err)
  );
}

// ————— Save settings —————
function saveSettings(){
  let a = $("#settings").serializeArray();
  minAxe       = parseInt(a[0].value,10);
  minLightCav  = parseInt(a[1].value,10);
  minRam       = parseInt(a[2].value,10);
  localStorage.setItem("settingsTribeMembers", JSON.stringify(a));
  calculateEverything();
}

// ————— Compute & render —————
function displayResults(){
  let tribeFull = 0,
      perPlayer = {};

  players.forEach(p=>{
    let list = playerData[p.name]||[],
        full = list.reduce((sum,v)=>
          sum + (
            v.axe   >= minAxe      &&
            v.light >= minLightCav &&
            v.ram   >= minRam
            ?1:0
          ), 0
        );
    perPlayer[p.name]=full;
    tribeFull += full;
  });

  let html = `
    <div class="sophHeader" style="margin:10px 0">
      <p style="padding:10px; color:#fff; background:#202225">
        Tribe full villages: ${tribeFull}
      </p>
      <div class="sophRowB">
        <table style="width:100%; color:#fff">
          <thead>
            <tr>
              <th style="text-align:left; padding:5px">Member</th>
              <th style="text-align:right; padding:5px">Full</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p=>`
              <tr>
                <td style="padding:5px">${p.name}</td>
                <td style="padding:5px; text-align:right">
                  ${perPlayer[p.name]}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  $("#contentContainer").prepend(html);
}

// ————— Collapsible helper —————
function makeThingsCollapsible(){
  $(".collapsible").off('click').on('click', function(){
    $(this).toggleClass("active");
    let c = $(this).next(".content");
    if (c.css("max-height") === "0px") {
      c.css("max-height", c.prop("scrollHeight")+"px");
    } else {
      c.css("max-height", "0");
    }
  });
}

// ————— Fire it off —————
calculateEverything();
