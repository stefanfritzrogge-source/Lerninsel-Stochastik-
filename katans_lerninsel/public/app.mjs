import {
  RESOURCE_INFO, COLORS, TILES, VERTICES, VERTEX_MAP, TILE_MAP, WAYS,
  initialState, applyAction, canPlace, getVertexTiles, vertexProbability, bundleOutcomes, safeRoomCode
} from '/shared.mjs';

const el=id=>document.getElementById(id);
const escapeHTML=str=>String(str??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const titleOf=tile=>tile.number?`${RESOURCE_INFO[tile.type].label} (${tile.number})`:'Wüste';
const fieldPills=tiles=>`<div class="chip-row">${tiles.map(t=>`<span class="field-chip">${RESOURCE_INFO[t.type].icon} ${RESOURCE_INFO[t.type].label} <b>${t.number??'–'}</b></span>`).join('')}</div>`;
const numberFormat=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n);
const percent=p=>numberFormat(p*100)+' %';
const diceGlyph=['','⚀','⚁','⚂','⚃','⚄','⚅'];
const STAGES=[['Entdecken','⌂'],['Ergebnismenge','Ω'],['Ereignisse','∈'],['Laplace','P'],['Baumdiagramm','⑂'],['Entscheiden','✓']];
let state=initialState(4), roomCode='', stream=null, connected=false, activePlayerId='p0', focusSettlementId=null, stage=0, rounds=1, savedAnswers={}, questionBank={}, busy=false, toastTimer;
try{const cache=localStorage.getItem('lerninsel-demo-v1');if(cache){const parsed=JSON.parse(cache);if(parsed?.players?.length)state=parsed;}}catch{}

function toast(message,bad=false){const t=el('toast');t.textContent=message;t.classList.toggle('bad',bad);t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3800);}
function remember(){if(roomCode)return;try{localStorage.setItem('lerninsel-demo-v1',JSON.stringify(state));}catch{}}
function ensureSelections(){if(!state.players.some(p=>p.id===activePlayerId))activePlayerId=state.players[0]?.id||'p0';if(focusSettlementId&&!state.settlements.some(s=>s.id===focusSettlementId))focusSettlementId=state.settlements[state.settlements.length-1]?.id??null;}
async function api(path,options={}) {const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw Error(data.error||'Verbindung fehlgeschlagen.');return data;}
function watchRoom(code){if(stream){stream.close();stream=null;}connected=false;stream=new EventSource(`/api/rooms/${code}/events`);stream.addEventListener('state',ev=>{if(code!==roomCode)return;try{state=JSON.parse(ev.data);ensureSelections();render();}catch(err){console.error(err);}});stream.onopen=()=>{connected=true;renderRoom();};stream.onerror=()=>{connected=false;renderRoom();};}
async function createRoom(){if(busy)return;busy=true;try{const r=await api('/api/rooms/create',{method:'POST',body:'{}'});roomCode=r.code;state=r.state;activePlayerId='p0';focusSettlementId=null;updateURL();watchRoom(roomCode);render();toast(`Raum ${roomCode} gestartet. Teile jetzt den Link mit der Klasse.`);}catch(err){toast('Ein gemeinsamer Raum benötigt den gestarteten Webserver. '+err.message,true);}finally{busy=false;}}
async function joinRoom(raw){const code=safeRoomCode(raw);if(!code){toast('Bitte den Raumcode eingeben.',true);return;}try{const r=await api(`/api/rooms/${code}`);roomCode=r.code;state=r.state;activePlayerId='p0';focusSettlementId=null;updateURL();watchRoom(roomCode);render();el('roomDialog').close();toast(`Mit Raum ${roomCode} verbunden.`);}catch(err){toast(err.message,true);}}
function leaveRoom(){stream?.close();stream=null;connected=false;roomCode='';state=initialState(4);focusSettlementId=null;activePlayerId='p0';updateURL();remember();render();toast('Du bist wieder im Einzelgerät-Modus.');}
function updateURL(){try{const u=new URL(window.location.href);if(roomCode)u.searchParams.set('raum',roomCode);else u.searchParams.delete('raum');history.replaceState({},'',u);}catch{}}
async function copyLink(){if(['localhost','127.0.0.1'].includes(location.hostname)){toast('Der localhost-Link funktioniert auf anderen iPads nicht. Öffne die App über die WLAN-IP des Computers und kopiere dann den Link.',true);return;}const link=new URL(window.location.href);link.searchParams.set('raum',roomCode);try{await navigator.clipboard.writeText(link.href);toast('Einladungslink kopiert. Auf den iPads öffnen!');}catch{toast(`Link zum Teilen: ${link.href}`);}}
async function action(type,payload={}){
  if(busy)return;
  busy=true;
  const prevIds=state.settlements.map(s=>s.id);
  try{
    let message='';
    if(roomCode){const r=await api(`/api/rooms/${roomCode}/actions`,{method:'POST',body:JSON.stringify({type,payload})});state=r.state;message=r.message;}
    else{const r=applyAction(state,{type,payload});state=r.state;message=r.message;remember();}
    if(type==='addSettlement'){const newer=state.settlements.find(s=>!prevIds.includes(s.id));if(newer)focusSettlementId=newer.id;}
    ensureSelections();render();if(message)toast(message);
  }catch(err){toast(err.message,true);}finally{busy=false;}
}
function renderRoom(){
  el('roomDisplay').textContent=roomCode?`Raum ${roomCode}`:'Einzelgerät · Probemodus';
  const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
  el('roomHelp').textContent=roomCode?(isLocal?'Für iPads zuerst die WLAN-IP statt localhost in der Adresszeile öffnen.':'Alle Geräte mit diesem Code bearbeiten denselben Spielstand.'):'Für die Zusammenarbeit einen gemeinsamen Raum starten.';
  const badge=el('connectionBadge');badge.className='connection-badge '+(roomCode?(connected?'online':'offline'):'');badge.innerHTML=`<span class="status-dot"></span>${roomCode?(connected?'Live verbunden':'Verbindung wird hergestellt'):'Lokal'}`;
  el('roomControls').innerHTML=roomCode?
    `<button class="btn btn-soft" data-action="copy-link">↗ Link kopieren</button><button class="btn btn-ghost" data-action="show-code">Code: <strong>${roomCode}</strong></button><button class="btn btn-ghost" data-action="leave-room">Verlassen</button>`:
    `<button class="btn btn-primary" data-action="create-room">＋ Gemeinsamen Raum starten</button><button class="btn btn-ghost" data-action="join-dialog">Raum beitreten</button>`;
}
function renderNav(){el('lessonNav').innerHTML=STAGES.map(([label,symbol],i)=>`<button class="step-button ${stage===i?'active':i<stage?'done':''}" data-action="stage" data-value="${i}" ${stage===i?'aria-current="step"':''}><span class="step-num">${stage===i?symbol:i+1}</span>${label}</button>`).join('');}
function hexPoints(tile,scale=1){const o=[[0,-103.333],[90,-51.667],[90,51.667],[0,103.333],[-90,51.667],[-90,-51.667]];return o.map(([x,y])=>`${tile.x+x*scale},${tile.y+y*scale}`).join(' ');}
function renderBoard(){
  const selected=state.settlements.find(s=>s.id===focusSettlementId);
  const focusVertex=selected&&VERTEX_MAP[selected.vertexId];
  const focusTiles=focusVertex?.tiles.map(id=>TILE_MAP[id])||[];
  const hilite=focusTiles.map(t=>`<polygon class="highlight-hex" points="${hexPoints(t,.94)}"/>`).join('');
  const settlements=state.settlements.map(s=>{
    const v=VERTEX_MAP[s.vertexId],p=state.players.find(p=>p.id===s.playerId),c=p?.color||'#6a8fa3';if(!v)return'';
    return `<g class="settlement ${focusSettlementId===s.id?'focus':''}" data-action="focus" data-id="${s.id}" role="button" tabindex="0" aria-label="${escapeHTML(p?.name)} Siedlung: ${s.total} Rohstoffe" transform="translate(${v.x} ${v.y})">
      <title>${escapeHTML(p?.name)} · ${s.total} Rohstoffe. Antippen für Details.</title>
      <circle class="house-bg" r="31"/><path class="home-shape" d="M-21 -3 0 -22 21 -3v23h-42z" fill="${c}"/><rect x="-6" y="5" width="12" height="15" rx="2" fill="#fff9"/>
      <circle class="count-bubble" cx="25" cy="-26" r="19"/><text class="count-text" x="25" y="-19" text-anchor="middle">${s.total}</text><circle class="hitarea" r="40"/>
    </g>`;
  }).join('');
  const dots=VERTICES.filter(v=>!state.settlements.some(s=>s.vertexId===v.id)).map(v=>{
    const ok=canPlace(state,v.id,activePlayerId).ok;
    return `<g class="vertex ${ok?'':'blocked'}" data-action="place" data-id="${v.id}" role="button" tabindex="0" aria-label="Kreuzung mit ${v.tiles.length} Feldern, ${ok?'frei':'gesperrt'}"><title>${v.tiles.map(id=>titleOf(TILE_MAP[id])).join(', ')} · ${ok?'Hier siedeln':'Nicht verfügbar'}</title><circle class="target-dot" cx="${v.x}" cy="${v.y}" r="${ok?10:7}"/><circle class="hitarea" cx="${v.x}" cy="${v.y}" r="35"/></g>`;
  }).join('');
  const transferMarks=stage===5?[[VERTEX_MAP['e838-277'],'A'],[VERTEX_MAP['e928-742'],'B']].map(([v,label])=>`<g pointer-events="none"><circle cx="${v.x}" cy="${v.y}" r="46" stroke="#ffce59" stroke-width="8" fill="#ffde5940"/><text x="${v.x}" y="${v.y-55}" font-family="Outfit" font-size="38" font-weight="900" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="8" fill="#154755">${label}</text></g>`).join(''):'';
  el('board').innerHTML=`<image href="/assets/spielfeld.jpg" x="0" y="0" width="1376" height="1088" preserveAspectRatio="none"/>${hilite}<g id="freeVertices">${dots}</g><g id="placedHomes">${settlements}</g>${transferMarks}`;
  el('boardCounter').textContent=`${state.settlements.length} Siedlung${state.settlements.length===1?'':'en'}`;
  el('boardHint').textContent=stage===5?'Vergleicht die mit A und B markierten Standorte.':selected?'Goldene Umrandung: angrenzende Felder der ausgewählten Siedlung.':'Team wählen und auf einen leuchtenden Kreuzungspunkt tippen.';
}
function liveStats(){return {total:state.settlements.reduce((s,x)=>s+x.total,0),rolls:state.rollCount,homes:state.settlements.length};}
function buttonNext(next=stage+1){return `<button class="btn btn-primary activity-next" data-action="stage" data-value="${next}">${next<STAGES.length?'Nächste Station: '+STAGES[next][0]+' →':'Zurück zum Spiel →'}</button>`;}
function renderTeams(){return `<div class="section-label">TEAMS UND SIEDLUNGEN</div><div class="team-selector">${state.players.map(p=>`<button class="team-chip ${activePlayerId===p.id?'active':''}" data-action="team" data-id="${p.id}" style="--team-color:${p.color}"><span class="color-dot"></span><span>${escapeHTML(p.name)}</span></button>`).join('')}</div>`;}
function lastRollBox(){const r=state.latestRolls[0];if(!r)return'';return `<div class="dice-result"><div class="die-face" aria-label="Erster Würfel ${r.d1}">${diceGlyph[r.d1]}</div><div class="die-face" aria-label="Zweiter Würfel ${r.d2}">${diceGlyph[r.d2]}</div><div><div class="dice-total">= ${r.sum}</div><span>Wurf ${r.round} · ${r.gains.length} Rohstoff${r.gains.length===1?'':'e'} verteilt</span></div></div>`;}
function renderExplore(){
  const stats=liveStats(),active=state.players.find(p=>p.id===activePlayerId);
  const started=state.settlements.length>0||state.rollCount>0;
  const currentFocus=state.settlements.find(s=>s.id===focusSettlementId);
  const focusData=currentFocus?vertexProbability(currentFocus.vertexId):null;
  return `<div class="panel-head"><div class="micro-label">MISSION 01 · AUSPROBIEREN</div><h2>Baue deine Strategie.</h2><p>Jedes Team platziert seine Siedlungen auf den Eckpunkten der Spielfelder. Danach entscheidet der Würfel über eure Rohstoffe.</p></div>
    ${renderTeams()}
    <div class="soft-panel"><h3>✦ ${escapeHTML(active?.name)} ist am Zug</h3><p>Tippe links auf eine <strong>helle Kreuzung</strong>, um eine Siedlung zu bauen. Bereits gesetzte Häuser kannst du antippen und untersuchen.</p></div>
    <div class="section-label">WÜRFEL-EXPERIMENT</div><div class="label-row"><span>Wie viele Runden?</span><small>Pro Runde: 2 Würfel</small></div>
    <div class="roll-row"><input id="roundInput" class="number-input" type="number" inputmode="numeric" min="1" max="10000" value="${rounds}" aria-label="Anzahl der Würfelrunden"><button class="roll-button" data-action="roll">🎲 Jetzt würfeln!</button></div>
    <div class="quick-rounds">${[1,2,3,10,100,1000].map(n=>`<button class="small-button ${rounds===n?'active':''}" data-action="quick-rounds" data-value="${n}">${n}×</button>`).join('')}</div>
    <div class="explain">1 Runde = zwei faire sechsseitige Würfel zusammen werfen. Die Augensumme bestimmt, welche Felder Rohstoffe produzieren.</div>
    ${lastRollBox()}
    <div class="data-strip"><div class="data-card"><b>${stats.rolls}</b><span>Würfelrunden</span></div><div class="data-card"><b>${stats.homes}</b><span>Siedlungen</span></div><div class="data-card"><b>${stats.total}</b><span>Rohstoffe</span></div></div>
    ${focusData?`<div class="soft-panel"><h3>🔎 Ausgewählte Siedlung</h3>${fieldPills(focusData.fields)}<p style="margin-top:11px">Bisher <b>${currentFocus.total}</b> Rohstoffe. Wahrscheinlichkeit für <em>mindestens einen</em> Rohstoff pro Wurf: <b>${focusData.ways}/36 = ${percent(focusData.probability)}</b>.</p><button class="tiny-btn danger" data-action="delete-settlement" data-id="${currentFocus.id}" style="margin-top:10px">Siedlung entfernen</button></div>`:''}
    <div class="section-label">SPIELREGELN ANPASSEN</div>
    <div class="settings-row"><label for="playerCount">Anzahl der Teams</label><select id="playerCount" data-change="player-count" ${started?'disabled title="Zum Ändern erst das Spielfeld zurücksetzen"':''}>${Array.from({length:8},(_,i)=>`<option value="${i+1}" ${state.players.length===i+1?'selected':''}>${i+1}</option>`).join('')}</select></div>
    <div class="settings-row"><label for="distanceCheck">Catan-Abstandsregel</label><input id="distanceCheck" type="checkbox" data-change="distance" ${state.distanceRule?'checked':''}></div>
    <div class="settings-row"><label for="settlementLimit">Siedlungen pro Team</label><select id="settlementLimit" data-change="max-settlements">${[[2,'2 (klassisch)'],[3,'3'],[4,'4'],[6,'6'],[0,'Unbegrenzt']].map(([v,label])=>`<option value="${v}" ${state.maxSettlements===v?'selected':''}>${label}</option>`).join('')}</select></div>
    <div class="tiny-controls"><button class="tiny-btn" data-action="rename-team">✎ Team umbenennen</button><button class="tiny-btn" data-action="reset-rolls">↺ Zähler nullen</button><button class="tiny-btn danger" data-action="reset-board">Siedlungen löschen</button></div>
    <div class="reflection"><h3>Schon etwas beobachtet?</h3><p>Die Zahlen auf den Feldern werden nicht gleich häufig gewürfelt. Warum ist das so?</p><button class="btn" data-action="stage" data-value="1">Zur Ergebnismenge →</button></div>`;
}
let questionBankNext={};
function renderQuestion(id,title,choices,correct,feedback){
  questionBankNext[id]={correct,feedback};
  const answer=savedAnswers[id];
  return `<div class="question-card"><div class="question-label">✍️ DEINE ENTSCHEIDUNG</div><h3>${title}</h3><div class="answer-list">${choices.map((ch,i)=>`<button class="answer-choice ${answer===i?(i===correct?'correct':'incorrect'):''}" data-action="answer" data-id="${id}" data-index="${i}">${escapeHTML(ch)}</button>`).join('')}</div>${answer===undefined?'':`<div class="answer-feedback ${answer===correct?'':'bad'}">${answer===correct?'✓ Richtig! '+feedback:'Noch nicht. Denke an die geordneten Würfelpaare (1,1) bis (6,6) und versuche es erneut.'}</div>`}</div>`;
}
function matrix(activated=[]){const hit=new Set(activated);let cells='<div class="matrix-cell heading">+ </div>';for(let i=1;i<=6;i++)cells+=`<div class="matrix-cell heading">${i}</div>`;for(let a=1;a<=6;a++){cells+=`<div class="matrix-cell heading">${a}</div>`;for(let b=1;b<=6;b++){const s=a+b;cells+=`<div class="matrix-cell ${hit.has(s)?'hit':''}" title="(${a},${b}) ergibt ${s}">${s}</div>`;}}return `<div class="dice-matrix" aria-label="6 mal 6 Würfeltabelle, Zeile ist Würfel 1, Spalte Würfel 2">${cells}</div>`;}
function renderResults(){return `<div class="panel-head"><div class="micro-label">MISSION 02 · DIE MÖGLICHKEITEN</div><h2>Was kann passieren?</h2><p>Ein Würfel zeigt sechs mögliche Augenzahlen. Mit zwei Würfeln können wir alle geordneten Paare aufschreiben.</p></div>
  <div class="math-card"><div class="micro-label">ERGEBNISMENGE Ω</div><div class="formula">6 × 6 = 36</div><p>Ω = {(1,1), (1,2), …, (6,6)}. Jeder der 36 geordneten Ausgänge ist gleich wahrscheinlich.</p></div>
  <div class="section-label">ALLE WÜRFELPAARE · AUGENSUMMEN</div>${matrix()}
  <p class="math-footnote">In der Tabelle stehen nur die <strong>Summen</strong>. Dahinter stecken 36 unterschiedliche Würfelpaare, aber lediglich 11 verschiedene Summen (2 bis 12).</p>
  ${renderQuestion('outcomes','Wie viele gleich wahrscheinliche Elementarergebnisse gibt es bei zwei Würfeln?',['11 Ergebnisse','36 Ergebnisse','12 Ergebnisse'],1,'Sechs Möglichkeiten für Würfel 1 und für jede davon sechs für Würfel 2: 6 · 6 = 36.')}
  ${buttonNext()}</div>`;}
function lessonExample(){const chosen=state.settlements.find(s=>s.id===focusSettlementId)||state.settlements[0];return {vertexId:chosen?.vertexId||'e838-277',isExample:!chosen};}
function renderEvents(){const ex=lessonExample(),info=vertexProbability(ex.vertexId);return `<div class="panel-head"><div class="micro-label">MISSION 03 · EREIGNISSE</div><h2>Welche Ergebnisse zählen?</h2><p>Ein <b>Ereignis</b> E besteht aus allen Elementarergebnissen, die eine Bedingung erfüllen.</p></div>
  <div class="math-card"><div class="micro-label">BEISPIEL: SUMME 7</div><div class="formula">E = { (1,6), (2,5), … }</div><p>Zur Summe 7 gehören genau 6 Paare: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1).</p></div>
  ${matrix([7])}
  ${renderQuestion('events','Wie viele der 36 Ergebnisse gehören zum Ereignis „Augensumme 7“?',['Nur 1 Ergebnis','7 Ergebnisse','6 Ergebnisse'],2,'Auch (1,6) und (6,1) sind zwei unterschiedliche Elementarergebnisse.')}
  <div class="soft-panel"><h3>🌱 Ereignis auf der Insel</h3><p>${ex.isExample?'Am Beispielknoten':'An der ausgewählten Siedlung'} sind die Zahlen ${info.numbers.join(', ')} wichtig. „Mindestens ein Rohstoff“ tritt auf, wenn eine dieser Zahlen gewürfelt wird. Das sind <strong>${info.ways} von 36</strong> Würfelpaaren.</p></div>
  ${buttonNext()}</div>`;}
function renderLaplace(){const ex=lessonExample(),p=vertexProbability(ex.vertexId);return `<div class="panel-head"><div class="micro-label">MISSION 04 · LAPLACE</div><h2>Wie wahrscheinlich?</h2><p>Bei einem fairen Würfelpaar sind die <b>36 geordneten Würfelpaare</b> gleich wahrscheinlich – nicht die elf Augensummen.</p></div>
  <div class="math-card"><div class="micro-label">LAPLACE-WAHRSCHEINLICHKEIT</div><div class="formula">P(E) = |E| / |Ω|</div><p>Günstige Elementarergebnisse geteilt durch alle gleich wahrscheinlichen Elementarergebnisse.</p></div>
  <div class="section-label">UNTERSCHIEDLICHE HÄUFIGKEITEN</div>${matrix([6])}
  <p class="math-footnote">Die 6 entsteht durch (1,5), (2,4), (3,3), (4,2), (5,1). Also fünf günstige Würfelpaare.</p>
  ${renderQuestion('laplace','Wie groß ist P(Augensumme = 6)?',['1/11','6/36','5/36'],2,'Fünf günstige Paare von 36 möglichen. Die Summen 2 bis 12 sind nicht gleich wahrscheinlich.')}
  <div class="soft-panel"><h3>📐 Deine Siedlung berechnen</h3>${fieldPills(p.fields)}<p style="margin-top:11px">P(mindestens ein Rohstoff) = <b>${p.ways}/36 = ${percent(p.probability)}</b>. Gleich nummerierte Felder werden für dieses Ereignis nur <em>einmal</em> gezählt.</p></div>
  ${buttonNext()}</div>`;}
function bundleLabel(group){if(!group.resources.length)return'Kein Rohstoff';return group.resources.map(x=>`${RESOURCE_INFO[x.type].icon} ${x.count>1?x.count+' × ':''}${RESOURCE_INFO[x.type].label}`).join(' + ');}
function renderTree(branches){return `<div class="tree-diagram"><div class="tree-root">🎲<br>Wurf<br>2W6</div><div class="tree-branches">${branches.map(b=>`<div class="tree-branch ${b.none?'branch-none':''}"><div class="branch-label">${b.label}</div><div class="branch-prob">${b.ways}/36</div></div>`).join('')}</div></div>`;}
function renderTrees(){const ex=lessonExample(),p=vertexProbability(ex.vertexId),bundles=bundleOutcomes(ex.vertexId);
  const sumPerTile=p.fields.reduce((s,f)=>s+WAYS[f.number],0),dup=sumPerTile!==p.ways;
  const distr=[p.ways, Math.min(35,Math.max(1,36-p.ways)), Math.min(35,p.ways+5)].filter((v,i,a)=>a.indexOf(v)===i);
  if(distr.length<3)distr.push(1); // edge case
  const perm=[distr[1],distr[0],distr[2]];
  return `<div class="panel-head"><div class="micro-label">MISSION 05 · BAUMDIAGRAMME</div><h2>Vom Rohstoff zum Ja/Nein.</h2><p>Wir betrachten einen <b>einzigen</b> Wurf mit zwei Würfeln. Zunächst unterscheiden wir, <em>welche Rohstoffe</em> entstehen.</p></div>
  <div class="section-label">${ex.isExample?'BEISPIELKREUZUNG: WOLLE · LEHM · GETREIDE':'EURE AUSGEWÄHLTE SIEDLUNG'}</div>${fieldPills(p.fields)}
  <div class="tree-panel"><div class="tree-title">1. Detailliertes Baumdiagramm</div>${renderTree(bundles.map(b=>({label:bundleLabel(b),ways:b.ways,none:!b.resources.length})))}<p class="tree-note">Bei drei unterschiedlichen Rohstoffzahlen gibt es drei Rohstoffäste <b>und zusätzlich „kein Rohstoff“</b>. Diese vier Ausgänge sind disjunkt und ergeben zusammen 36/36. ${dup?'Gleiche Zahlen können gleichzeitig mehrere Felder auslösen – darum zeigt ein Ast ggf. ein Rohstoffbündel.':''}</p></div>
  <div class="tree-panel"><div class="tree-title">2. Reduziertes Baumdiagramm · ein Ereignis</div>${renderTree([{label:'✅ Mindestens ein Rohstoff',ways:p.ways},{label:'○ Kein Rohstoff',ways:36-p.ways,none:true}])}<p class="tree-note">Alle erfolgreichen Rohstoff-Ausgänge werden zu <b>einem</b> Ereignis zusammengefasst. Erfolgswahrscheinlichkeit ${p.ways}/36 = ${percent(p.probability)}.</p></div>
  ${renderQuestion('trees',`Wie groß ist die Wahrscheinlichkeit, an diesem Kreuzungspunkt mindestens einen Rohstoff zu bekommen?`,perm.map(x=>`${x}/36`),1,`Alle unterschiedlichen gewinnbringenden Augensummen liefern zusammen ${p.ways} günstige Paare. Doppelte Zahlen nicht doppelt zählen!`)}
  ${buttonNext()}</div>`;
}
function renderDecision(){const a=vertexProbability('e838-277'),b=vertexProbability('e928-742'),exp=lessonExample(),p=vertexProbability(exp.vertexId);return `<div class="panel-head"><div class="micro-label">MISSION 06 · ANWENDEN</div><h2>Triff eine gute Entscheidung.</h2><p>Stochastik hilft, Standorte zu vergleichen. Schaut auf das Spielfeld: Wo würdet ihr eure nächste Siedlung setzen?</p></div>
  <div class="math-card"><div class="micro-label">VERGLEICH ZWEIER KREUZUNGEN</div><p><strong>Standort A:</strong> ${a.fields.map(f=>f.number).join(' · ')} &nbsp;→&nbsp; ${a.ways} günstige Paare</p><p><strong>Standort B:</strong> ${b.fields.map(f=>f.number).join(' · ')} &nbsp;→&nbsp; ${b.ways} günstige Paare</p></div>
  ${renderQuestion('choice','Welcher Standort hat die größere Chance auf mindestens einen Rohstoff?',['Standort A','Standort B','Beide gleich wahrscheinlich'],0,`A hat ${a.ways}/36, B nur ${b.ways}/36. Mehr bzw. günstigere Augensummen erhöhen die Erfolgswahrscheinlichkeit.`)}
  <div class="soft-panel"><h3>🧠 Eine wichtige Unterscheidung</h3><p>Bei eurer Siedlung gilt <b>P(mindestens ein Rohstoff) = ${p.ways}/36</b>. Aber die erwartete <b>Anzahl</b> der Rohstoffe pro Wurf ist <b>E(X) = ${numberFormat(p.expected)}</b>. Wenn mehrere angrenzende Felder dieselbe Zahl tragen, kann ein einzelner Wurf zwei oder sogar drei Rohstoffe bringen. Dann unterscheiden sich Erfolgswahrscheinlichkeit und Erwartungswert.</p></div>
  <div class="reflection"><h3>Diskussion im Team</h3><p>Wählt zwei echte Siedlungen aus eurem Spiel. Wer hat bisher mehr gesammelt? Muss diese Siedlung auch langfristig die bessere sein? Begründet anhand von Wahrscheinlichkeiten und experimentellen Häufigkeiten.</p><button class="btn" data-action="stage" data-value="0">Zurück zum Experiment ↺</button></div>`;
}
function renderSide(){questionBankNext={};const content=[renderExplore,renderResults,renderEvents,renderLaplace,renderTrees,renderDecision][stage]();questionBank=questionBankNext;el('sidePanel').innerHTML=content;}
function histogram(){const max=Math.max(1,Math.max(...Object.values(WAYS))*Math.max(1,state.rollCount)/36,...Object.values(state.histogram));const bars=Object.entries(WAYS).map(([key,w])=>{const expected=state.rollCount*w/36,observed=state.histogram[key]||0;return `<div class="hist-item"><div class="hist-bars"><span class="hist-theory" title="Summe ${key}: Erwartung ${numberFormat(expected)}" style="height:${Math.max(2,expected/max*100)}%"></span><span class="hist-observed" title="Summe ${key}: Beobachtet ${observed}" style="height:${Math.max(2,observed/max*100)}%"></span></div><label>${key}</label></div>`;}).join('');return `<div class="histogram">${bars}</div><div class="hist-legend"><span><i class="hist-dot theory"></i>Erwartete Häufigkeit</span><span><i class="hist-dot observed"></i>Tatsächliche Häufigkeit</span></div>`;}
function renderScore(){const tiles=state.players.map(p=>{const settlements=state.settlements.filter(s=>s.playerId===p.id),total=settlements.reduce((a,b)=>a+b.total,0),resources=Object.keys(RESOURCE_INFO).filter(type=>type!=='desert').map(type=>({type,count:settlements.reduce((x,s)=>x+(s.resources[type]||0),0)}));return `<div class="score-tile"><div class="score-top"><div class="score-name"><i class="color-dot" style="--team-color:${p.color}"></i><span>${escapeHTML(p.name)}</span></div><div class="score-number">${total}</div></div><div class="score-resources">${resources.map(x=>`<span class="resource-token">${RESOURCE_INFO[x.type].icon} ${x.count}</span>`).join('')}</div><div class="settlement-stack">${settlements.length?settlements.map((s,i)=>`<button class="settlement-line" data-action="focus" data-id="${s.id}"><span>⌂ Siedlung ${i+1}</span><strong>${s.total} Rohstoffe ↗</strong></button>`).join(''):'<div class="score-note">Noch keine Siedlung gebaut</div>'}</div></div>`;}).join('');
  el('scorePanel').innerHTML=`<div class="wide-head"><h2>🏅 Rohstoff-Barometer</h2><span>Alle Siedlungen · live synchronisiert</span></div><div class="score-grid">${tiles}</div><div class="section-label">WÜRFELSUMMEN: THEORIE ↔ EXPERIMENT (${state.rollCount} RUNDE${state.rollCount===1?'':'N'})</div>${histogram()}<p class="math-footnote">Grün zeigt eure beobachteten Würfe. Grau zeigt, wie viele Würfe bei ${state.rollCount} Runden theoretisch zu erwarten wären. Größere Stichproben nähern sich oft den theoretischen Anteilen an; einzelne Stichproben können abweichen.</p>`;
}
function render(){ensureSelections();renderRoom();renderNav();renderBoard();renderSide();renderScore();}

document.addEventListener('click',async event=>{
  if(event.target.closest('[data-close-dialog]')){el('roomDialog').close();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const op=target.dataset.action, val=target.dataset.value,id=target.dataset.id;
  if(op==='stage'){stage=Number(val);render();if(stage!==0){el('lessonNav').scrollIntoView({behavior:'smooth',block:'start'});}return;}
  if(op==='team'){activePlayerId=id;render();return;}
  if(op==='place'){await action('addSettlement',{vertexId:id,playerId:activePlayerId});return;}
  if(op==='focus'){focusSettlementId=id;render();return;}
  if(op==='quick-rounds'){rounds=Number(val);render();return;}
  if(op==='roll'){rounds=Number(el('roundInput')?.value||rounds);await action('roll',{rounds});return;}
  if(op==='answer'){const q=questionBank[id];if(!q)return;savedAnswers[id]=Number(target.dataset.index);renderSide();return;}
  if(op==='create-room')return createRoom();
  if(op==='join-dialog'){if(typeof el('roomDialog').showModal!=='function'){const code=prompt('Raumcode eingeben:');if(code)joinRoom(code);return;}el('roomDialog').showModal();el('joinCode').focus();return;}
  if(op==='copy-link')return copyLink();
  if(op==='show-code')return toast(`Euer Raumcode: ${roomCode}`);
  if(op==='leave-room'){if(confirm('Diesen gemeinsamen Raum verlassen? Der Spielstand bleibt im Raum erhalten.'))leaveRoom();return;}
  if(op==='rename-team'){const current=state.players.find(p=>p.id===activePlayerId);const name=prompt('Neuer Teamname:',current?.name||'');if(name!==null)action('renamePlayer',{playerId:activePlayerId,name});return;}
  if(op==='delete-settlement'){if(confirm('Diese Siedlung und ihre bisher gesammelten Rohstoffe entfernen?'))action('removeSettlement',{settlementId:id});return;}
  if(op==='reset-rolls'){if(confirm('Alle Würfelrunden und Rohstoffzähler für diesen Raum auf null setzen?'))action('resetRolls');return;}
  if(op==='reset-board'){if(confirm('Alle Siedlungen, Würfe und Rohstoffzähler im gesamten Raum löschen?'))action('resetBoard');return;}
  if(target.hasAttribute('data-close-dialog')){el('roomDialog').close();return;}
});
document.addEventListener('change',event=>{
  const target=event.target;const op=target.dataset.change;
  if(op==='player-count')action('setPlayerCount',{count:Number(target.value)});
  if(op==='distance')action('setSettings',{distanceRule:target.checked});
  if(op==='max-settlements')action('setSettings',{maxSettlements:Number(target.value)});
  if(target.id==='roundInput')rounds=Number(target.value);
});
document.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.closest('svg [data-action]')){event.preventDefault();event.target.click();}
});
el('joinForm').addEventListener('submit',event=>{event.preventDefault();joinRoom(el('joinCode').value);});
render();
const autoRoom=new URLSearchParams(window.location.search).get('raum');
if(autoRoom)joinRoom(autoRoom);
