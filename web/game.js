"use strict";
// Python owns state, rules, rewards and saves. This file draws and reads devices.
const C = document.getElementById("game"), g = C.getContext("2d");
const E = id => document.getElementById(id);
const images = ["icefield_environment", "crystal_environment", "magnetic_environment"].map(name => {
  const im = new Image(); im.src = `/assets/${name}.png`; return im;
});
const shipImage = new Image(); shipImage.src = "/assets/ship_side.png";
const bossImage = new Image(); bossImage.src = "/assets/core_warden.png";
const bossPhase2Image = new Image(); bossPhase2Image.src = "/assets/boss_phase2.png";
const sceneImages = Object.fromEntries(["loading","failure","victory"].map(name=>{
  const im=new Image();im.src=`/assets/${name}_scene.png`;return [name,im];
}));
const keys = new Set(), pending = [], shots = [];
let state = null, mode = "keyboard", lastButtons = [], stick = [0,0], padNow = null;
let busy = false, lastTick = performance.now(), lastMove = 0, lastRendered = "", tailY = 300;
let workshop = false, deathSelection = 0, rumbling = null;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const put = (action, extras={}) => pending.push({action,...extras});
const kb = (a,b) => mode === "gamepad" ? b : a;
const tint = ["#79caec","#b9a8ee","#e7a576"];

function stopRumble(pad=rumbling || padNow) {
  try { pad?.vibrationActuator?.reset?.(); } catch (_) {}
  try { pad?.vibrationActuator?.playEffect?.("dual-rumble",{duration:1,strongMagnitude:0,weakMagnitude:0}); } catch (_) {}
  rumbling = null;
}
function vibrate(event,pad) {
  const spec = {damage:[260,.9,.75],mining_good:[130,.48,.55],mining_miss:[220,.65,.35],
    hit:[85,.4,.35],collected:[310,.8,.7],boss_phase:[300,.85,.65],
    boss_defeated:[520,.95,.8],defeat:[520,.95,.8],victory:[380,.7,.9]}[event];
  if (!spec || !pad?.vibrationActuator?.playEffect) return;
  rumbling = pad;
  try { pad.vibrationActuator.playEffect("dual-rumble",{duration:spec[0],strongMagnitude:spec[1],weakMagnitude:spec[2]}).catch(()=>{}); } catch (_) {}
}
function tone(event) { window.GameAudio?.event(event); }
function setMode(next){if(mode!==next){mode=next;lastRendered="";}}
function helpOpen(){stopRumble();E("help").hidden=false;E("help-mode").textContent=`Current prompts: ${mode==="gamepad"?"controller":"keyboard"}. Press H or Esc / B to close.`;E("demo-help").hidden=!state?.demo;}
function helpClose(){E("help").hidden=true;}
function chooseDeath(){
  if(!workshop){if(deathSelection===0){stopRumble();put("start");}else{workshop=true;deathSelection=0;lastRendered="";}}
  else if(deathSelection<3)put(`buy:${["hull","scanner","drill"][deathSelection]}`);
  else if(deathSelection===3){workshop=false;deathSelection=0;lastRendered="";}
  else {stopRumble();put("start");}
}
E("help-button").onclick=helpOpen; E("close-help").onclick=helpClose;
E("sound-button").onclick=()=>window.GameAudio?.toggle();
E("card-screen").addEventListener("click",e=>{
  const special=e.target.closest("[data-local]");
  if(special){workshop=special.dataset.local==="workshop";deathSelection=0;lastRendered="";return;}
  const btn=e.target.closest("[data-action],[data-choice]");if(!btn)return;
  window.GameAudio?.unlock();window.GameAudio?.effect("click",.27,85);
  setMode("keyboard");
  if(btn.dataset.action==="start")stopRumble();
  if(btn.dataset.choice!==undefined){let d=Number(btn.dataset.choice)-state.selection;while(d>0){put("right");d--;}while(d<0){put("left");d++;}put("confirm");}
  else put(btn.dataset.action);
});
document.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();if([" ","arrowup","arrowdown","arrowleft","arrowright","backspace"].includes(k))e.preventDefault();
  if(k==="m"&&!e.repeat){window.GameAudio?.toggle();return;}
  if(["enter"," ","q","j"].includes(k))window.GameAudio?.unlock();
  if(k==="f"&&!e.repeat){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();return;}
  if(k==="h"&&!e.repeat){E("help").hidden?helpOpen():helpClose();return;}
  if(!E("help").hidden){if(k==="escape")helpClose();return;}
  if(state?.demo && /^[0-6]$/.test(k)&&!e.repeat){stopRumble();put("jump",{destination:Number(k)});return;}
  keys.add(k);if(e.repeat)return;setMode("keyboard");
  if(["enter"," "].includes(k))window.GameAudio?.effect("click",.21,105);
  if(k.startsWith("arrow"))window.GameAudio?.effect("hover",.19,130);
  if(k==="escape"){stopRumble();put(state?.phase==="paused"?"resume":"pause");}
  else if(k==="backspace"){
    if(state?.phase==="death"&&workshop){workshop=false;deathSelection=0;lastRendered="";}
    else put(state?.phase==="paused"?"resume":"back");
  }
  else if(k==="q")put("scan");
  else if(k==="enter")state?.phase==="death"?chooseDeath():put(["menu","victory"].includes(state?.phase)?"start":state?.phase==="paused"?"resume":"confirm");
  else if(k===" ")put(state?.phase==="pipes"?"rotate":state?.phase==="mine"?"mine":"confirm");
  else if(k.startsWith("arrow")){
    if(state?.phase==="death") {deathSelection=clamp(deathSelection+(k==="arrowright"||k==="arrowdown"?1:-1),0,workshop?4:1);lastRendered="";}
    else put(k.slice(5));
  }
});
document.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
window.addEventListener("blur",()=>{keys.clear();stopRumble();if(["flight","boss"].includes(state?.phase))put("pause");});
document.addEventListener("visibilitychange",()=>{if(document.hidden){keys.clear();stopRumble();}});
window.addEventListener("beforeunload",()=>stopRumble());
window.addEventListener("gamepaddisconnected",()=>{stopRumble();padNow=null;lastButtons=[];setMode("keyboard");E("toast").textContent="Controller disconnected · keyboard ready";});

function readPad(now){
  let p=null;try{p=Array.from(navigator.getGamepads?.()||[]).find(x=>x?.connected)||null;}catch(_){}
  padNow=p;if(!p){stick=[0,0];lastButtons=[];return {dx:0,dy:0,shoot:false,scan:false,pad:null};}
  const down=Array.from({length:17},(_,i)=>Boolean(p.buttons?.[i]?.pressed));
  const rise=i=>down[i]&&!lastButtons[i];
  const ax=Math.abs(p.axes?.[0]||0)>.23?p.axes[0]:0,ay=Math.abs(p.axes?.[1]||0)>.23?p.axes[1]:0;
  stick=[ax,ay];if(Math.abs(ax)>.5||Math.abs(ay)>.5||down.some((v,i)=>v&&!lastButtons[i]))setMode("gamepad");
  if(!E("help").hidden){if(rise(1)||rise(3))helpClose();lastButtons=down;return {dx:0,dy:0,shoot:false,scan:false,pad:p};}
  if(rise(3))helpOpen();
  if(rise(8))window.GameAudio?.toggle();
  if(rise(9)){stopRumble();put(state?.phase==="paused"?"resume":"pause");}
  if(rise(1)){
    if(state?.phase==="death"&&workshop){workshop=false;deathSelection=0;lastRendered="";}
    else put(state?.phase==="paused"?"resume":"back");
  }
  if(rise(2))put("scan");
  if(rise(0)){window.GameAudio?.unlock();window.GameAudio?.effect("click",.21,105);}
  if(rise(0))state?.phase==="death"?chooseDeath():put(state?.phase==="pipes"?"rotate":state?.phase==="mine"?"mine":
    ["menu","victory"].includes(state?.phase)?"start":state?.phase==="paused"?"resume":"confirm");
  if(["identify","upgrade","pipes"].includes(state?.phase)&&now-lastMove>190){
    if(Math.abs(ax)>.62||Math.abs(ay)>.62){const horizontal=Math.abs(ax)>=Math.abs(ay);
      put(horizontal?(ax>0?"right":"left"):(ay>0?"down":"up"));window.GameAudio?.effect("hover",.19,180);lastMove=now;}
  }
  if(state?.phase==="death"&&now-lastMove>230&&(Math.abs(ax)>.62||Math.abs(ay)>.62)){
    const delta=Math.abs(ax)>=Math.abs(ay)?Math.sign(ax):Math.sign(ay);
    deathSelection=clamp(deathSelection+delta,0,workshop?4:1);lastRendered="";lastMove=now;
  }
  lastButtons=down;
  return {dx:ax,dy:ay,shoot:down[7],scan:down[2],pad:p};
}
async function tick(){
  const now=performance.now(),dt=clamp((now-lastTick)/1000,0,.08);lastTick=now;
  const opening=Boolean(E("opening")),pad=opening?{dx:0,dy:0,shoot:false,scan:false,pad:null}:readPad(now);
  if(state&&!busy&&!opening&&E("help").hidden){
    busy=true;
    const dx=Number(keys.has("d"))-Number(keys.has("a"))||pad.dx;
    const dy=Number(keys.has("s"))-Number(keys.has("w"))||pad.dy;
    const next=pending.shift()||{};
    try{
      const r=await fetch("/api/step",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({dt,dx,dy,shoot:keys.has("j")||pad.shoot,scan_hold:keys.has("q")||pad.scan,...next})});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      state=await r.json();
      if(state.phase!=="death"){workshop=false;deathSelection=0;}
      window.GameAudio?.sync(state);
      for(const ev of state.events){tone(ev);vibrate(ev,pad.pad);
        if(ev==="shoot")for(const offset of state.shot_count===2?[-19,19]:[0])
          shots.push({x:state.player.x+30,y:state.player.y+offset,life:.55});
      }
      if(state.phase==="paused"||state.phase==="menu")stopRumble();
      renderUI();
    }catch(err){E("toast").textContent=`Game connection lost: ${err.message}`;}
    busy=false;
  }
  for(let i=shots.length-1;i>=0;i--){shots[i].x+=dt*790;shots[i].life-=dt;if(shots[i].life<=0)shots.splice(i,1);}
  setTimeout(tick,35);
}
function hint(items){return items.map(([a,b,label])=>`<span class="hint-item"><b>${kb(a,b)}</b><em>${label}</em></span>`).join("");}
function icon(type){
  if(type==="O")return `<svg viewBox="0 0 120 136" aria-hidden="true"><polygon points="61,2 100,42 96,112 61,133 23,111 22,40" fill="#7bd5f0"/><polygon points="61,2 22,40 61,68 100,42" fill="#edffff"/><polygon points="22,40 61,68 61,133 23,111" fill="#8fdff3"/><polygon points="61,68 100,42 96,112 61,133" fill="#4fadd5"/><polygon points="61,2 43,48 61,68 80,44" fill="#d3faff"/></svg>`;
  if(type==="Si")return `<svg viewBox="0 0 120 136" aria-hidden="true"><polygon points="11,103 21,48 42,68 60,2 79,52 102,35 110,108 65,133" fill="#baa5ef"/><polygon points="60,2 42,68 63,99 79,52" fill="#f4eaff"/><polygon points="11,103 21,48 42,68 65,133" fill="#d6c5f9"/><polygon points="63,99 102,35 110,108 65,133" fill="#8773ba"/><polygon points="42,68 60,2 79,52" fill="#fff8ff"/></svg>`;
  if(type==="Fe")return `<svg viewBox="0 0 120 136" aria-hidden="true"><polygon points="24,28 68,5 107,34 100,101 60,133 12,99" fill="#cf9167"/><polygon points="24,28 68,5 83,49 45,67 12,99" fill="#f2b073"/><polygon points="68,5 107,34 100,101 83,49" fill="#59606a"/><polygon points="12,99 45,67 83,49 60,133" fill="#a2654c"/><polygon points="83,49 100,101 60,133" fill="#51555e"/></svg>`;
  const shapes={repair:`<path d="M24 82 L49 47 L63 57 L87 24 L105 55 L71 107 Z" fill="#e5ad72"/><path d="M63 18v36M46 36h35" stroke="#a6edce" stroke-width="9"/>`,hull:`<path d="M60 8 L108 30 V76 L60 126 L12 76 V30 Z" fill="#3d8a98" stroke="#a6edce" stroke-width="5"/><path d="M60 24 L92 40 V70 L60 104 L28 70 V40 Z" fill="#174b68"/>`,double:`<path d="M15 84 L75 48 L105 68 L74 91 Z" fill="#6dadd8"/><path d="M66 39 H112M66 99 H112" stroke="#9ff9f7" stroke-width="9"/>`,scanner:`<circle cx="60" cy="68" r="42" fill="#212e63" stroke="#74eddb" stroke-width="7"/><path d="M60 10 V44M60 92 V126M4 68 H37M84 68 H116" stroke="#8cf4de" stroke-width="5"/><path d="M60 34 L87 98 L60 87 L33 98 Z" fill="#cbb8f1"/>`,drill:`<path d="M6 43 L42 24 L105 65 L42 105 L6 87 Z" fill="#cc8153"/><path d="M43 31 L105 65 L43 96" fill="#bdcce1" stroke="#f6dda6" stroke-width="4"/>`,data:`<path d="M10 15 Q40 6 60 21 Q82 6 110 15 V111 Q83 101 60 116 Q37 101 10 111 Z" fill="#f2eadb" stroke="#79cbdc" stroke-width="4"/><path d="M27 49 L44 28 L58 62 L41 83 Z" fill="#8ae5ee"/><path d="M73 56 L89 43 L97 69 L79 81 Z" fill="#da9d65"/>`};
  return `<svg viewBox="0 0 120 136" aria-hidden="true">${shapes[type]||shapes.data}</svg>`;
}
function card(title,detail,type,i,selected){return `<button class="choice-card ${selected?"selected":""}" data-choice="${i}" style="color:${type==="O"?tint[0]:type==="Si"?tint[1]:type==="Fe"?tint[2]:"#a6edce"}">${icon(type)}${["O","Si","Fe"].includes(type)?`<span class="symbol">${type}</span>`:""}<strong>${title}</strong><small>${detail}</small></button>`;}
function panel(content,small=false){return `<div class="veil"></div><section class="scene-panel ${small?"mini-panel":""}">${content}</section>`;}
function renderUI(){
  if(!state)return;
  const s=state,phase=s.phase,active=s.stage<=3?Math.max(0,s.stage-1):2;
  const quiet=["loading","death","victory"].includes(phase);
  E("hud").hidden=quiet;E("resources").hidden=quiet||s.stage===4;E("equipment").hidden=quiet;
  E("bottom-left").hidden=quiet;E("bottom-right").hidden=quiet;
  E("location").textContent=s.stage===4?`CORE WARDEN · PHASE ${s.boss?.phase||2}`:phase==="menu"?"EARTH BUILDER / MISSION":`${String(s.stage).padStart(2,"0")} / 03  ·  ${s.stage_name.toUpperCase()}`;
  E("location").style.color=tint[active];
  E("status").textContent=`SHIELDS  ${"◆ ".repeat(Math.max(0,s.player.shields))}${"◇ ".repeat(Math.max(0,s.player.max_shields-s.player.shields))}`;
  E("resources").textContent=`SIGNALS  ${s.collected.length} / 3  ·  ${s.collected.join(" / ")||"NOT YET IDENTIFIED"}   ·   DATA ${s.research_run}`;
  E("equipment").textContent=Object.entries(s.upgrades||{}).filter(([,v])=>v).map(([key])=>({hull:"EXTRA SHIELD",double:"TWIN LASER",scanner:"SIGNAL FOCUS",drill:"PRECISION DRILL"}[key])).filter(Boolean).join("  ·  ");
  E("boss-health").hidden=!(s.stage===4&&["boss","boss_defeat","paused"].includes(phase));
  if(s.boss){E("boss-phase-label").textContent=`CORE WARDEN  ·  PHASE ${s.boss.phase}`;
    E("boss-health-fill").style.width=`${Math.max(0,(s.boss.nodes.reduce((a,b)=>a+b,0)+s.boss.core)/34*100)}%`;}
  E("demo-badge").hidden=!s.demo||quiet;
  let prompts=[],message="",html="";
  if(phase==="menu"){
    html=panel(`<div class="eyebrow">THREE SIGNALS · ONE EXPEDITION</div><h1>EARTH BUILDER<br>MISSION</h1><p>Recover water ice, quartz and magnetite. Cross three deep-space routes, solve each mineral circuit, then face the Core Warden.</p><div class="actions"><button class="primary" data-action="start">LAUNCH EXPEDITION · ${kb("ENTER","A")}</button></div>`,true);
    prompts=[["ENTER","A","START"],["H","CONTROLS","FULL KEY GUIDE"]];
  }else if(phase==="flight"){
    message=s.stage===1&&s.tutorial<3?["Fly to the glowing ring · learn to steer","Continue through the second ring","Align with the target and fire"][s.tutorial]:"Follow the signal rightward · hold scan near the crystal";
    prompts=[["WASD","LEFT STICK","MOVE"],["J","RT","FIRE"],["Q","X","SCAN"]];
  }else if(phase==="scan"){
    message=`LOCK ${Math.min(100,Math.round(s.scan_meter/.8*100))}% · align the reticle, then hold ${kb("Q","X")}`;
    prompts=[["A / D","LEFT STICK","ALIGN"],["HOLD Q","HOLD X","LOCK"]];
  }else if(phase==="identify"){
    const samples=[{symbol:"O",title:"WATER ICE",detail:"H₂O signature"},{symbol:"Si",title:"QUARTZ",detail:"Angular crystal"},{symbol:"Fe",title:"MAGNETITE",detail:"Magnetic iron ore"}];
    html=panel(`<div class="eyebrow">MINERAL IDENTIFICATION / READ BOTH CLUES</div><h1>IDENTIFY THE SAMPLE</h1><div class="clues"><span>${s.clues[0]}</span><span>${s.clues[1]}</span></div><div class="card-grid">${samples.map((v,i)=>card(v.title,v.detail,v.symbol,i,s.selection===i)).join("")}</div><p class="notice">${s.message}</p>`);
    prompts=[["← / →","LEFT STICK","CHOOSE"],["ENTER","A","CONFIRM"],["BACKSPACE","B","BACK"]];
  }else if(phase==="pipes"){
    message="CONNECT THE CIRCUIT · rotate the crystal pieces from left inlet to right outlet";
    prompts=[["ARROWS","LEFT STICK","SELECT"],["SPACE","A","ROTATE"],["BACKSPACE","B","BACK"]];
  }else if(phase==="pipes_success"){
    message="CIRCUIT CONNECTED · energy flowing to the mineral drill";
  }else if(phase==="mine"){
    message=s.mine_cooldown>0?"DRILL COOLING · your completed layers are safe":`THREE-LAYER EXTRACTION  ${s.mine_good} / 3  ·  HEAT ${s.mine_heat} / 3`;
    prompts=[["SPACE","A","TAP IN THE GREEN ARC"]];
  }else if(phase==="upgrade"){
    html=panel(`<div class="eyebrow">SAMPLE SECURED · TEMPORARY UPGRADE</div><h1>PREPARE FOR THE NEXT ROUTE</h1><p>Choose one. This upgrade lasts for this run.</p><div class="card-grid two">${s.offer.map((u,i)=>card(u.name.toUpperCase(),u.detail,u.key,i,s.selection===i)).join("")}</div>`);
    prompts=[["← / →","LEFT STICK","CHOOSE"],["ENTER","A","CONFIRM"]];
  }else if(phase==="loading"){
    html=`<section class="loading-copy"><div class="eyebrow">NEXT SECTOR</div><h1>${s.next_stage_name.toUpperCase()}</h1><p>${s.message}</p><div class="loading-dots"><i></i><i></i><i></i></div></section>`;
  }else if(phase==="boss"){
    message=s.boss.transition>0?"PHASE 2 · ARMOUR BREAKING APART":s.boss.phase===1?(s.boss.scanned?"SHOOT THE GLOWING UPPER AND LOWER NODES":"SCAN TO REVEAL THE SHIELD NODES"):(s.boss.window>0?"CORE EXPOSED · FIRE NOW":"DODGE THE AMBER VOLLEY · WAIT FOR THE CORE");
    prompts=[["WASD","LEFT STICK","DODGE"],["Q","X","SCAN"],["J","RT","FIRE"]];
  }else if(phase==="boss_defeat"){
    message="CORE WARDEN DEFEATED · REBUILDING EARTH";
  }else if(phase==="paused"){
    html=panel(`<div class="eyebrow">MISSION PAUSED</div><h1>TAKE YOUR TIME</h1><p>Current task: ${s.paused_from}. Press A / Enter to continue, or B / Esc to return to the game. H opens the complete control guide.</p><div class="actions"><button class="primary" data-action="resume">CONTINUE · ${kb("ENTER","A")}</button></div>`,true);
    prompts=[["ENTER","A","CONTINUE"],["ESC","B","BACK TO GAME"]];
  }else if(phase==="death"){
    html=workshop?panel(`<div class="eyebrow">PERMANENT UPGRADES · BANK ${s.profile.research} DATA</div><h1>SHIP WORKSHOP</h1><p>Research remains between expeditions. Upgrades cost banked research.</p><div class="workshop">${s.permanent.map((p,i)=>`<button class="${deathSelection===i?"selected-action":""}" data-action="buy:${p.key}" ${p.level>=2?"disabled":""}>${p.name.toUpperCase()}<br>LEVEL ${p.level}/2 · COST ${p.cost}</button>`).join("")}</div><p class="notice">${s.message}</p><div class="actions"><button class="${deathSelection===3?"selected-action":""}" data-local="failure">BACK</button><button class="primary ${deathSelection===4?"selected-action":""}" data-action="start">RESTART · ${kb("ENTER","A")}</button></div>`,true):
      `<section class="result-panel"><div class="eyebrow">MISSION INTERRUPTED</div><h1>SHIP SHIELDS DEPLETED</h1><p class="research-pill">◆ &nbsp; RESEARCH SAVED: <strong>${s.profile.research}</strong></p><div class="result-actions"><button class="primary ${deathSelection===0?"selected-action":""}" data-action="start">RESTART · ${kb("ENTER","A")}</button><button class="${deathSelection===1?"selected-action":""}" data-local="workshop">SHIP WORKSHOP</button></div><small>${kb("← / →","LEFT STICK")} SELECT &nbsp; · &nbsp; ${kb("ENTER","A")} CONFIRM</small></section>`;
    prompts=[["← / →","LEFT STICK","SELECT"],["ENTER","A","CONFIRM"],["BACKSPACE","B","BACK"]];
  }else if(phase==="victory"){
    html=`<section class="victory-panel"><h1>EARTH<br>ASSEMBLED</h1><p>Three signatures secured · Core Warden defeated</p><div class="victory-line"></div><h2>MISSION COMPLETE</h2><button class="primary" data-action="start">NEW EXPEDITION · ${kb("ENTER","A")}</button></section>`;
    prompts=[["ENTER","A","NEW RUN"]];
  }
  E("prompt").textContent=message;
  E("control-hint").innerHTML=hint(prompts);
  E("help-button").textContent=mode==="gamepad"?"CONTROLS · Y":"CONTROLS · H";
  E("pause-hint").textContent=mode==="gamepad"?"START · MENU / PAUSE":"ESC · MENU / PAUSE";
  const sig=`${phase}:${s.stage}:${s.selection}:${s.message}:${s.profile.research}:${workshop}:${deathSelection}:${mode}:${s.offer.map(x=>x.key).join()}`;
  if(sig!==lastRendered){E("card-screen").innerHTML=html;lastRendered=sig;}
}

function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(C.clientWidth*d)),h=Math.max(1,Math.round(C.clientHeight*d));if(C.width!==w||C.height!==h){C.width=w;C.height=h;}g.setTransform(w/1000,0,0,h/600,0,0);}
function poly(points,fill,stroke="",width=1){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function line(points,color,width=2){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function box(x,y,w,h,fill,stroke="",radius=10){g.beginPath();g.roundRect(x,y,w,h,radius);g.fillStyle=fill;g.fill();if(stroke){g.lineWidth=2;g.strokeStyle=stroke;g.stroke();}}
function disc(x,y,r,fill,stroke="",width=2){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function txt(str,x,y,size=19,color="#e5fff5",align="center",spacing=0){g.fillStyle=color;g.font=`700 ${size}px Segoe UI,Arial,sans-serif`;g.textAlign=align;g.fillText(str,x,y);}
function background(s,t){
  const index=clamp((s?.stage||1)-1,0,2),img=images[index];
  if(img.complete&&img.naturalWidth)g.drawImage(img,0,0,1000,600);
  else {g.fillStyle="#071528";g.fillRect(0,0,1000,600);}
  g.fillStyle="rgba(1,9,22,.12)";g.fillRect(0,0,1000,600);
  // Sparse slow drifting specks add depth without flashing.
  if(!reduced)for(let i=0;i<36;i++){const x=((i*183.79+t*(i%3+1)*.004)%1000),y=(i*97.31)%600;
    g.globalAlpha=.18+(Math.sin(t*.0005+i)*.5+.5)*.25;disc(x,y,i%4?0.7:1.1,"#d3fbf9");}g.globalAlpha=1;
}
function crystal(x,y,scale,type,t=0){
  g.save();g.translate(x,y);g.scale(scale,scale);g.rotate(reduced?0:Math.sin(t*.0005+x)*.045);
  if(type==="O"){
    g.shadowColor="#72ddff";g.shadowBlur=21;
    poly([[0,-51],[27,-14],[25,35],[0,51],[-28,34],[-26,-16]],"#5bbbea","#c7faff",2);g.shadowBlur=0;
    poly([[0,-51],[-26,-16],[0,5],[27,-14]],"#e2ffff");poly([[-26,-16],[0,5],[0,51],[-28,34]],"#98e2f4");
    poly([[0,5],[27,-14],[25,35],[0,51]],"#43a5d2");
  }else if(type==="Si"){
    g.shadowColor="#b99afa";g.shadowBlur=22;
    poly([[-32,33],[-27,-20],[-8,-4],[0,-56],[19,-16],[30,-32],[34,32],[0,52]],"#b6a0ef","#eadcff",2);g.shadowBlur=0;
    poly([[0,-56],[-8,-4],[0,25],[19,-16]],"#f8efff");poly([[-32,33],[-27,-20],[-8,-4],[0,52]],"#d4c2f8");
    poly([[0,25],[30,-32],[34,32],[0,52]],"#8f77c5");
  }else{
    g.shadowColor="#e99f59";g.shadowBlur=18;
    poly([[-37,-23],[2,-48],[40,-20],[37,28],[0,49],[-42,23]],"#b97d5c","#ffd9a5",2);g.shadowBlur=0;
    poly([[-37,-23],[2,-48],[13,-4],[-42,23]],"#f2a868");poly([[2,-48],[40,-20],[37,28],[13,-4]],"#56616b");
    poly([[-42,23],[13,-4],[37,28],[0,49]],"#cf8958");
  }g.restore();
}
function ship(p,t){
  if(!p)return;
  // Nose follows the input immediately; the rear rolls into each turn.
  tailY+=(p.y-tailY)*(reduced?1:.1);
  const lag=clamp(tailY-p.y,-22,22),bank=clamp((p.y-tailY)*.006,-.15,.15);
  g.save();g.translate(p.x,p.y);g.rotate(bank);
  if(p.invuln>0)g.globalAlpha=reduced?.65:.65+.2*Math.sin(t*.02);
  if(shipImage.complete&&shipImage.naturalWidth){
    g.shadowColor="#62d9f3";g.shadowBlur=10;
    g.drawImage(shipImage,-90,lag*.28-38,164,76);
    g.shadowBlur=0;
  }else{
    poly([[-37,-30],[-24,-3],[-44,15],[-36,34],[-10,16],[52,0],[-10,-15]],"#397aa8","#8adff0",2);
    poly([[52,0],[-9,-12],[-1,0],[-9,12]],"#aeffea");
  }
  g.restore();
}
function rock(r,color,t){
  const y=r.y+(state.stage===3&&!reduced?Math.sin(r.phase)*18:0),n=7,points=[];
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n+r.phase*.12,rad=r.r*(.85+.19*Math.sin(i*8.17+r.x));points.push([r.x+Math.cos(a)*rad,y+Math.sin(a)*rad]);}
  poly(points,color,color==="#79caec"?"#c1f6ff":"#ffd4ac",1.3);
  poly([points[0],points[1],points[2],[r.x+3,y-2]],color==="#79caec"?"#dcffff9c":"#ffe3c187");
  poly([[r.x+3,y-2],points[2],points[3],points[4]],"#112f5380");
}
function bullets(t){
  for(const b of shots){const grad=g.createLinearGradient(b.x-24,b.y,b.x+20,b.y);grad.addColorStop(0,"#64eaff00");grad.addColorStop(.5,"#6ce8f8");grad.addColorStop(1,"#e8fff8");
    g.shadowColor="#6debf2";g.shadowBlur=15;poly([[b.x-27,b.y-3],[b.x+14,b.y-3],[b.x+23,b.y],[b.x+14,b.y+3],[b.x-27,b.y+3]],grad);g.shadowBlur=0;}
}
function flight(s,t){
  const color=tint[s.stage-1],p=s.player,beacon=s.route_end;
  const camera=clamp(p.x-270,0,beacon-800);
  if(s.stage===3){box(385,78,285,439,"#eda86b0b","#ffbf7d6a",27);txt("MAGNETIC FIELD",526,113,13,"#ffd39e");}
  g.save();g.translate(-camera,0);
  for(const r of s.rocks)if(r.x>camera-85&&r.x<camera+1080)rock(r,color,t);
  for(const d of s.drones){if(d.hp<=0||d.x<camera-70||d.x>camera+1080)continue;
    g.save();g.translate(d.x,d.y);g.shadowColor="#f5ae73";g.shadowBlur=15;
    poly([[-30,0],[-9,-18],[21,-20],[33,0],[21,20],[-9,18]],"#303e55","#ffb370",1.5);
    poly([[2,-12],[25,0],[2,12]],"#ffb96a");g.restore();
    if(d.bullet){g.shadowColor="#ffb77f";g.shadowBlur=15;disc(d.bullet.x,d.bullet.y,9,"#f8b37b","#ffe3ab");g.shadowBlur=0;}
  }
  const by=300+(s.stage===2&&!reduced?Math.sin(t*.001)*13:0);
  if(beacon>camera-80&&beacon<camera+1080){
    g.save();g.shadowColor=color;g.shadowBlur=24;
    disc(beacon,by,64,"#0000",`${color}b0`,2);disc(beacon,by,48,"#0000",`${color}77`,1.5);g.restore();
    crystal(beacon,by,.8,s.stage===1?"O":s.stage===2?"Si":"Fe",t);
  }
  if(s.stage===1&&s.tutorial<3){const x=s.tutorial===0?190:s.tutorial===1?340:500,y=s.tutorial===0?235:s.tutorial===1?365:300;
    disc(x,y,28,"#0000","#ffe2a0",3);txt(s.tutorial<2?"FLY HERE":"FIRE AT TARGET",x,y-43,14,"#ffe9b9");}
  ship(p,t);bullets(t);g.restore();
  if(p.x>beacon-160){box(735,405,225,39,"#041827dd","#a6edceae",11);txt(`SCAN SIGNAL · ${kb("Q","X")}`,847,431,15,"#caffed");}
  // A route indicator stays legible while the environment scrolls.
  box(395,20,210,8,"#0b314b","#4c9dbb",4);
  box(395,20,210*clamp((p.x-80)/(beacon-80),0,1),8,color,"",4);
}
function scan(s,t){
  box(175,163,650,279,"#061829e7","#a6edce91",22);
  txt("SPECTRAL SIGNAL · ALIGN AND HOLD",500,207,22,"#dbfff1");
  box(235,287,530,22,"#16405b","#78c7d4",10);
  const target=500+s.scan_target*205,cursor=500+s.scan_cursor*205;
  g.save();g.shadowColor="#a6edce";g.shadowBlur=24;box(target-46,267,92,62,"#8ef3d95c","#caffef",12);g.restore();
  line([[cursor,255],[cursor,341]],"#ffdc94",7);disc(cursor,298,6,"#fff2c4");
  box(290,377,420,14,"#123750","#66aebf",8);box(290,377,420*clamp(s.scan_meter/.8,0,1),14,"#a6edce","",8);
  txt("SIGNAL LOCK",500,421,15,"#b8e8dc");
}
function energized(board){
  const lit=new Set(),q=[[1,0]];
  for(let k=0;k<q.length;k++){const [r,c]=q[k],key=`${r},${c}`;if(lit.has(key))continue;lit.add(key);
    for(const [dr,dc,out,back] of [[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]]){
      const nr=r+dr,nc=c+dc;if((board[r][c]&out)&&nr>=0&&nr<4&&nc>=0&&nc<4&&(board[nr][nc]&back))q.push([nr,nc]);
    }
  }return lit;
}
function pipes(s,t){
  const board=s.board;if(!board)return;const cell=104,ox=292,oy=91,lit=energized(board);
  box(275,77,450,449,"#041a2bcd","#8fdfdd62",17);
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const mask=board[r][c],x=ox+c*cell,y=oy+r*cell,selected=s.cursor[0]===r&&s.cursor[1]===c,energ=lit.has(`${r},${c}`);
    g.save();g.shadowColor=selected?"#ffd889":"#70d9e6";g.shadowBlur=selected?20:3;
    box(x+3,y+3,cell-8,cell-8,mask?"#0b3346e5":"#0a273ad8",selected?"#ffda91":"#80d9e28c",11);g.restore();
    if(!mask)continue;
    const cx=x+cell/2,cy=y+cell/2,tileColor=energ?"#a6ffec":"#699abd";
    for(const [bit,ex,ey] of [[1,cx,y+11],[2,x+cell-11,cy],[4,cx,y+cell-11],[8,x+11,cy]]){
      if(!(mask&bit))continue;
      // Three strokes create translucent crystal edges and an illuminated inner channel.
      g.lineCap="butt";g.shadowColor=tileColor;g.shadowBlur=energ?15:2;
      line([[cx,cy],[ex,ey]],"#7ba3bc",32);
      line([[cx,cy],[ex,ey]],"#cdeaf6b0",22);
      line([[cx,cy],[ex,ey]],energ?"#b2ffef":"#5893bf",13);
      g.shadowBlur=0;
    }
    disc(cx,cy,10,energ?"#c5fff1":"#85b2d1");
  }
  crystal(267,oy+cell*1.5,.32,s.stage===1?"O":s.stage===2?"Si":"Fe",t);
  crystal(736,oy+cell*2.5,.32,"Fe",t);
  line([[268,oy+cell*1.5],[ox+6,oy+cell*1.5]],"#a6ffef",11);
  line([[ox+cell*4-5,oy+cell*2.5],[736,oy+cell*2.5]],"#ffd889",11);
  txt("INLET",220,oy+cell*1.5+53,15,"#b5fff0");txt("OUTLET",780,oy+cell*2.5+53,15,"#ffda91");
}
function mining(s,t){
  const x=500,y=292,r=121,phase=s.mine_elapsed%1.25/1.25,angle=phase*Math.PI*2-Math.PI/2;
  box(221,120,558,393,"#061a2bdc","#83dfd278",25);
  txt("THREE-LAYER MINERAL EXTRACTION",500,165,24,"#dffff2");
  g.strokeStyle="#679db4";g.lineWidth=18;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();
  g.shadowColor="#a9ffdf";g.shadowBlur=18;g.beginPath();g.arc(x,y,r,Math.PI/2-s.mine_tolerance/1.25*Math.PI*2,Math.PI/2+s.mine_tolerance/1.25*Math.PI*2);
  g.strokeStyle="#9efdd8";g.lineWidth=21;g.stroke();g.shadowBlur=0;
  const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;
  line([[x+Math.cos(angle)*(r-28),y+Math.sin(angle)*(r-28)],[px,py]],"#ffe19b",7);
  disc(px,py,9,"#fff2c4","#ffd889",2);
  crystal(x,y,.9,s.stage===1?"O":s.stage===2?"Si":"Fe",t);
  for(let i=0;i<3;i++){const xx=439+i*60;box(xx,449,45,9,i<s.mine_good?"#a6ffdf":"#477087",i<s.mine_good?"#e4fff7":"",5);}
  txt(s.mine_cooldown>0?"COOLING · WAIT":`TAP ${kb("SPACE","A")} IN THE GREEN ARC`,500,492,16,s.mine_cooldown>0?"#ffd889":"#d3ffee");
}
function guardian(s,t){
  const b=s.boss,p=s.player;if(!b){ship(p,t);return;}
  const open=b.phase===2&&b.window>0&&b.transition===0;
  g.save();g.translate(826,300);
  for(let i=0;i<3;i++)disc(0,0,185+i*26,"#0000",`rgba(106,191,215,${.15-i*.035})`,1.5);
  g.restore();
  const img=b.phase===2?bossPhase2Image:bossImage;
  if(img.complete&&img.naturalWidth){
    g.save();g.shadowColor=b.phase===2?"#f9ae59":"#d89255";g.shadowBlur=open?29:17;
    if(b.transition>0){
      const portion=1-b.transition/2.7;
      g.globalAlpha=.85;
      g.translate(826,300);g.rotate((reduced?0:Math.sin(t*.008)*.02));
      if(b.phase===2)g.drawImage(img,230,0,1040,1070,-176-portion*21,-208-portion*10,380+portion*42,416+portion*20);
      else g.drawImage(img,-176-portion*21,-195-portion*10,352+portion*42,390+portion*20);
      for(let i=0;i<8;i++){const angle=i*Math.PI/4,dist=32+portion*125;
        poly([[Math.cos(angle)*dist,Math.sin(angle)*dist-12],
              [Math.cos(angle)*dist+18,Math.sin(angle)*dist+6],
              [Math.cos(angle)*dist-12,Math.sin(angle)*dist+10]],"#e7a576b8");}
    }else if(b.phase===2)g.drawImage(img,230,0,1040,1070,650,92,380,416);
    else g.drawImage(img,650,105,352,390);
    g.restore();
  }
  if(b.phase===1)for(const [i,y] of [[0,210],[1,390]]){
    if(b.nodes[i]>0){g.save();g.shadowColor=b.scanned?"#ffbd69":"#5e7079";g.shadowBlur=b.scanned?23:3;
      disc(826,y,22,b.scanned?"#ffd18a":"#66747c",b.scanned?"#fff1b9":"#8c9aaa",2);g.restore();
      if(b.scanned){line([[798,y-28],[806,y-28],[806,y-19]],"#a6f5e4",3);line([[846,y+19],[846,y+28],[854,y+28]],"#a6f5e4",3);}
    }else disc(826,y,22,"#26313b","#58636c",2);
  }
  if(b.phase===2&&!open&&b.transition===0){
    poly([[826,263],[857,281],[857,319],[826,337],[795,319],[795,281]],"#1d2c3be8","#9eacb6",2);
    txt("SEALED",826,305,11,"#c1d4d9");
  }
  if(open){g.save();g.shadowColor="#ffc874";g.shadowBlur=24;disc(826,300,29,"#e9ae65a8","#fff2bf",3);g.restore();}
  if(b.scanned&&b.transition===0&&b.clock%(b.phase===1?4.8:4.4)<1.15){
    if(b.phase===2){for(const yy of [180,240,300,360,420])line([[760,300],[160,300+(yy-300)*1.7]],"#f5a46a8c",1.4);
      txt("AMBER VOLLEY INCOMING · MOVE BETWEEN THE LANES",475,145,15,"#ffe2b9");}
    else{const yy=b.aim_y||300;box(0,yy-22,735,44,"#f0a27630","#f5b77d7d",4);
      txt("MOVE FROM THE WARNING LANE",500,yy-29,15,"#ffe0b2");}
  }
  if(b.beam_time>0)box(0,b.beam_y-15,735,30,"#ffac6ea8","#ffe0a5",3);
  for(const q of b.projectiles){
    if(q.kind==="ember"){g.save();g.shadowColor="#ffb45c";g.shadowBlur=18;
      poly([[q.x,q.y-11],[q.x+11,q.y],[q.x,q.y+11],[q.x-11,q.y]],"#ffd68d","#fff2bb",1.5);g.restore();}
    else rock({x:q.x,y:q.y,r:19,phase:0},"#e7a576",t);
  }
  ship(p,t);bullets(t);
}
function bossExplosion(s,t){
  const progress=clamp(1-s.defeat_time/3,0,1),cx=826,cy=300;
  if(bossPhase2Image.complete&&bossPhase2Image.naturalWidth){
    g.save();g.globalAlpha=Math.max(0,1-progress*2);
    g.drawImage(bossPhase2Image,230,0,1040,1070,650,92,380,416);g.restore();}
  for(let i=0;i<18;i++){
    const angle=i*2.399,dist=18+progress*(140+(i%5)*34),x=cx+Math.cos(angle)*dist,y=cy+Math.sin(angle)*dist;
    g.save();g.globalAlpha=1-progress*.8;g.shadowColor="#ffaf69";g.shadowBlur=23;
    poly([[x,y-15],[x+13,y],[x-4,y+14]],i%3?"#a7755d":"#ffe1a5");g.restore();
  }
  g.save();g.globalAlpha=(1-progress)*.7;g.shadowColor="#ffcf91";g.shadowBlur=45;
  disc(cx,cy,40+progress*220,"#f6a4651a","#ffdc9a",4);g.restore();
  ship(s.player,t);txt("CORE WARDEN DEFEATED",500,115,31,"#ffe2b0");
}
function sceneArt(img,t,loading=false){
  if(!img.complete||!img.naturalWidth)return;
  const drift=loading&&!reduced?Math.sin(t*.0014)*9:0;
  g.drawImage(img,-12+drift,-5,1024,610);
}
function draw(t){
  try{
    resize();background(state,t);
    if(state){const phase=state.phase,shown=phase==="paused"?state.paused_from:phase;
      if(shown==="flight")flight(state,t);
      else if(shown==="scan")scan(state,t);
      else if(shown==="pipes"||shown==="pipes_success"){
        pipes(state,t);
        if(shown==="pipes_success"){
          g.save();g.shadowColor="#a6ffdf";g.shadowBlur=24;
          box(367,533,266,52,"#072e3bdc","#b5ffe9",14);g.restore();
          txt("✓  CIRCUIT CONNECTED",500,568,22,"#d5fff0");
        }
      }
      else if(shown==="mine")mining(state,t);
      else if(shown==="boss")guardian(state,t);
      else if(shown==="boss_defeat")bossExplosion(state,t);
      else if(shown==="loading")sceneArt(sceneImages.loading,t,true);
      else if(shown==="death")sceneArt(sceneImages.failure,t);
      else if(shown==="victory")sceneArt(sceneImages.victory,t);
      else if(shown==="identify"||shown==="upgrade"){
        g.fillStyle="#020a17a5";g.fillRect(0,0,1000,600);
      }
    }
  }catch(error){E("toast").textContent=`Display error: ${error.message}`;}
  finally{requestAnimationFrame(draw);}
}
fetch("/api/state").then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();})
  .then(s=>{state=s;window.GameAudio?.sync(state);renderUI();tick();requestAnimationFrame(draw);})
  .catch(e=>{E("toast").textContent=`Cannot start: ${e.message}. Run python main.py and refresh.`;});
