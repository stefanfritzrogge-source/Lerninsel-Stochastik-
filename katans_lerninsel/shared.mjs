/** Gemeinsame, deterministische Spiellogik – wird von Browser und Server verwendet. */
export const RESOURCE_INFO = {
  wheat: { label: 'Getreide', icon: '🌾', short: 'Weizen' },
  forest: { label: 'Holz', icon: '🌲', short: 'Holz' },
  clay: { label: 'Lehm', icon: '🧱', short: 'Lehm' },
  pasture: { label: 'Wolle', icon: '🐑', short: 'Schaf' },
  ore: { label: 'Erz', icon: '⛰️', short: 'Erz' },
  desert: { label: 'Wüste', icon: '🏜️', short: 'Wüste' }
};
export const COLORS = ['#e95c58', '#4678e9', '#19a78a', '#a45ddc', '#e59c22', '#dd5293', '#158fc0', '#8b6c57'];
export const LAYOUT_ROWS = [
  [['forest', 6], ['wheat', 3], ['clay', 8]],
  [['ore', 2], ['wheat', 4], ['pasture', 5], ['pasture', 10]],
  [['wheat', 5], ['pasture', 9], ['clay', 11], ['wheat', 6], ['forest', 9]],
  [['clay', 10], ['desert', null], ['pasture', 3], ['forest', 12]],
  [['ore', 8], ['forest', 4], ['ore', 11]]
];
const X_ROWS = [[568,748,928],[478,658,838,1018],[388,568,748,928,1108],[478,658,838,1018],[568,748,928]];
export const TILES = LAYOUT_ROWS.flatMap((row, r) => row.map(([type, number], c) => ({id:`f${r}-${c}`, row:r, col:c, x:X_ROWS[r][c], y:225+155*r, type, number})));
// Die Eckpunkte sind mathematisch auf die originale Bildvorlage eingepasst.
const HEX_OFFSETS = [[0,-103.333333],[90,-51.666667],[90,51.666667],[0,103.333333],[-90,51.666667],[-90,-51.666667]];
const vertices = new Map();
for (const tile of TILES) {
  for (const [dx,dy] of HEX_OFFSETS) {
    const x = Math.round(tile.x+dx), y=Math.round(tile.y+dy);
    const id = `e${x}-${y}`;
    if (!vertices.has(id)) vertices.set(id,{id,x,y,tiles:[]});
    vertices.get(id).tiles.push(tile.id);
  }
}
export const VERTICES = [...vertices.values()].filter(v=>v.tiles.length>=2).sort((a,b)=>a.y-b.y || a.x-b.x);
export const ALL_VERTICES = [...vertices.values()];
export const TILE_MAP = Object.fromEntries(TILES.map(t=>[t.id,t]));
export const VERTEX_MAP = Object.fromEntries(VERTICES.map(v=>[v.id,v]));
const adjacentById = {};
for (const vertex of VERTICES) {
  adjacentById[vertex.id] = VERTICES.filter(other=>other.id!==vertex.id && Math.hypot(vertex.x-other.x,vertex.y-other.y) < 112).map(v=>v.id);
}
export const ADJACENT_VERTICES = adjacentById;
export const WAYS = Object.fromEntries(Array.from({length:11},(_,i)=>[i+2,6-Math.abs(i+2-7)]));
export const safeRoomCode = code => String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const freshPlayer = n=>({id:`p${n}`,name:`Team ${n+1}`,color:COLORS[n%COLORS.length]});
export const initialState = (count=4) => ({
  players: Array.from({length:Math.max(1,Math.min(8,count))},(_,i)=>freshPlayer(i)),
  currentPlayerId: 'p0',
  revision: 0,
  settlements: [],
  maxSettlements:2,
  distanceRule:true,
  rollCount:0,
  histogram:Object.fromEntries(Object.keys(WAYS).map(s=>[s,0])),
  latestRolls:[],
  lastBatch:0,
  updatedAt:Date.now()
});
export function canPlace(state, vertexId, playerId) {
  const v=VERTEX_MAP[vertexId];
  if (!v) return {ok:false,reason:'Wähle einen Kreuzungspunkt zwischen mindestens zwei Feldern.'};
  if (!state.players.some(p=>p.id===playerId)) return {ok:false,reason:'Wähle zuerst ein Team.'};
  if (state.settlements.some(s=>s.vertexId===vertexId)) return {ok:false,reason:'Dieser Platz ist schon belegt.'};
  if (state.maxSettlements && state.settlements.filter(s=>s.playerId===playerId).length>=state.maxSettlements) return {ok:false,reason:'Dieses Team hat sein Siedlungslimit erreicht.'};
  if (state.distanceRule && ADJACENT_VERTICES[vertexId].some(id=>state.settlements.some(s=>s.vertexId===id))) return {ok:false,reason:'Abstandsregel: Zu einer anderen Siedlung muss mindestens eine Kante frei bleiben.'};
  return {ok:true};
}
export function getVertexTiles(vertexId) { return (VERTEX_MAP[vertexId]?.tiles||[]).map(id=>TILE_MAP[id]); }
export function numberProbability(sum) { return (WAYS[sum]||0)/36; }
export function vertexProbability(vertexId) {
  const fields=getVertexTiles(vertexId).filter(t=>t.number);
  const numbers=[...new Set(fields.map(f=>f.number))];
  const ways=numbers.reduce((a,n)=>a+WAYS[n],0);
  const expected=fields.reduce((a,f)=>a+WAYS[f.number],0)/36;
  return {ways,probability:ways/36,expected,numbers,fields};
}
export function bundleOutcomes(vertexId) {
  const fields=getVertexTiles(vertexId);
  const groups=new Map();
  for (let sum=2;sum<=12;sum++) {
    const wins=fields.filter(f=>f.number===sum && f.type!=='desert');
    const types=Object.keys(RESOURCE_INFO).filter(type=>type!=='desert');
    const resources=types.map(type=>({type,count:wins.filter(t=>t.type===type).length})).filter(x=>x.count>0);
    const key=resources.map(x=>`${x.type}:${x.count}`).join('|')||'none';
    if (!groups.has(key))groups.set(key,{key,resources,ways:0,sums:[]});
    const g=groups.get(key);g.ways+=WAYS[sum];g.sums.push(sum);
  }
  return [...groups.values()].filter(g=>g.ways>0).sort((a,b)=>a.key==='none'?1:b.key==='none'?-1:b.ways-a.ways);
}
export function applyAction(current, action, dice=()=>1+Math.floor(Math.random()*6)) {
  const state=JSON.parse(JSON.stringify(current));
  const payload=action?.payload||{};
  const type=action?.type;
  let message='';
  state.currentPlayerId ||= state.players[0].id;
  state.revision ||= 0;
  const playing=['addSettlement','roll','endTurn'].includes(type);
  if (action.revision !== undefined && action.revision !== state.revision) throw Error('Der Spielstand hat sich geändert. Bitte warte auf die Aktualisierung.');
  if (playing && action.actorId !== undefined && action.actorId !== state.currentPlayerId) throw Error('Bitte warten: Ein anderes Team ist am Zug.');
  if (type==='addSettlement' && payload.playerId !== state.currentPlayerId) throw Error('Dieses Team ist gerade nicht am Zug.');
  const advance=()=>{
    const building=!state.maxSettlements || state.players.some(p=>state.settlements.filter(s=>s.playerId===p.id).length<state.maxSettlements);
    const candidates=building?state.players.filter(p=>!state.maxSettlements || state.settlements.filter(s=>s.playerId===p.id).length<state.maxSettlements):state.players;
    const index=state.players.findIndex(p=>p.id===state.currentPlayerId);
    for(let n=1;n<=state.players.length;n++){
      const next=state.players[(index+n)%state.players.length];
      if(candidates.some(p=>p.id===next.id)){state.currentPlayerId=next.id;break;}
    }
  };

  if (type==='setPlayerCount') {
    const count=Number(payload.count);
    if (!Number.isInteger(count)||count<1||count>8) throw Error('Erlaubt sind 1 bis 8 Teams.');
    if (state.settlements.length||state.rollCount) throw Error('Teamzahl kann nur vor Beginn geändert werden. Setze dafür zunächst das Spiel zurück.');
    state.players=Array.from({length:count},(_,i)=>state.players[i]||freshPlayer(i));
  } else if (type==='renamePlayer') {
    const player=state.players.find(p=>p.id===payload.playerId);
    if (!player) throw Error('Team nicht gefunden.');
    const name=String(payload.name||'').trim().slice(0,24);
    if (!name) throw Error('Bitte einen Teamnamen eingeben.');
    player.name=name;
  } else if (type==='setSettings') {
    if ('distanceRule' in payload) state.distanceRule=!!payload.distanceRule;
    if ('maxSettlements' in payload) {
      const lim=Number(payload.maxSettlements);
      if (![0,1,2,3,4,5,6].includes(lim))throw Error('Ungültiges Siedlungslimit.');
      state.maxSettlements=lim;
    }
  } else if (type==='addSettlement') {
    const result=canPlace(state,payload.vertexId,payload.playerId);
    if (!result.ok)throw Error(result.reason);
    state.settlements.push({id:`s${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,vertexId:payload.vertexId,playerId:payload.playerId,resources:{forest:0,wheat:0,clay:0,pasture:0,ore:0},total:0});
    advance();
    message='Siedlung gesetzt. Nächstes Team ist am Zug.';
  } else if (type==='removeSettlement') {
    const index=state.settlements.findIndex(s=>s.id===payload.settlementId);
    if (index===-1)throw Error('Siedlung nicht gefunden.');
    state.settlements.splice(index,1);
  } else if (type==='endTurn') {
    advance();
  } else if (type==='roll') {
    const rounds=Number(payload.rounds);
    if (!Number.isInteger(rounds)||rounds<1||rounds>10000)throw Error('Bitte 1 bis 10.000 Würfelrunden wählen.');
    if (!state.settlements.length)throw Error('Setze zuerst mindestens eine Siedlung.');
    for (let i=0;i<rounds;i++) {
      const d1=dice(),d2=dice();
      if (![d1,d2].every(d=>Number.isInteger(d)&&d>=1&&d<=6))throw Error('Ungültiger Würfel.');
      const sum=d1+d2;
      const gains=[];
      for (const s of state.settlements) {
        for (const t of getVertexTiles(s.vertexId)) {
          if (t.number===sum && t.type!=='desert') {
            s.resources[t.type]++;
            s.total++;
            gains.push({settlementId:s.id,resource:t.type,tileId:t.id});
          }
        }
      }
      state.rollCount++;
      state.histogram[sum]++;
      state.latestRolls.unshift({round:state.rollCount,d1,d2,sum,gains});
      if (state.latestRolls.length>80) state.latestRolls.length=80;
    }
    state.latestRolls=state.latestRolls.slice(0,80);
    state.lastBatch=rounds;
    advance();
    message=`${rounds} Würfelrunde${rounds===1?'':'n'} simuliert.`;
  } else if (type==='resetRolls') {
    state.rollCount=0;
    state.histogram=Object.fromEntries(Object.keys(WAYS).map(s=>[s,0]));
    state.latestRolls=[];
    state.lastBatch=0;
    state.settlements.forEach(s=>{s.total=0;s.resources={forest:0,wheat:0,clay:0,pasture:0,ore:0};});
  } else if (type==='resetBoard') {
    state.currentPlayerId=state.players[0].id;
    state.settlements=[];
    state.rollCount=0;
    state.histogram=Object.fromEntries(Object.keys(WAYS).map(s=>[s,0]));
    state.latestRolls=[];state.lastBatch=0;
  } else {
    throw Error('Aktion nicht unterstützt.');
  }
  if(!state.players.some(p=>p.id===state.currentPlayerId))state.currentPlayerId=state.players[0].id;
  state.revision++;
  state.updatedAt=Date.now();
  return {state,message};
}
