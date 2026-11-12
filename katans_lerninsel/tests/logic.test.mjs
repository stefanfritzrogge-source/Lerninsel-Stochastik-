import test from 'node:test';
import assert from 'node:assert/strict';
import {TILES,VERTICES,WAYS,initialState,canPlace,applyAction,vertexProbability,bundleOutcomes,ADJACENT_VERTICES,getVertexTiles} from '../shared.mjs';

const SAMPLE='e838-277';
const rollWith=(sequence)=>{let i=0;return ()=>sequence[i++];};

test('Originalspielbrett: 19 Felder, 36 gültige Kreuzungen mit je 2-3 Feldern',()=>{
  assert.equal(TILES.length,19);
  assert.equal(TILES.filter(t=>t.type==='desert').length,1);
  assert.equal(VERTICES.length,36);
  for(const vertex of VERTICES)assert.ok([2,3].includes(vertex.tiles.length));
});
test('Die Ergebnismenge der zwei Würfel hat 36 gleich wahrscheinliche Paare',()=>{
  assert.equal(Object.values(WAYS).reduce((a,b)=>a+b,0),36);
  assert.equal(WAYS[7],6);assert.equal(WAYS[6],5);assert.equal(WAYS[2],1);
});
test('Drei Ressourcenarten plus kein Gewinn bilden korrekte disjunkte Äste',()=>{
  const fields=getVertexTiles(SAMPLE);
  assert.deepEqual(new Set(fields.map(f=>f.type)),new Set(['wheat','clay','pasture']));
  const b=bundleOutcomes(SAMPLE);
  assert.equal(b.length,4);
  assert.equal(b.reduce((a,x)=>a+x.ways,0),36);
  assert.equal(b.find(x=>x.key==='none').ways,25);
  const p=vertexProbability(SAMPLE);
  assert.equal(p.ways,11);assert.equal(p.probability,11/36);
});
test('Würfeln addiert passende Rohstoffe pro Siedlung; sieben gibt nichts',()=>{
  let s=initialState(2);
  s=applyAction(s,{type:'addSettlement',payload:{playerId:'p0',vertexId:SAMPLE}}).state;
  s=applyAction(s,{type:'roll',payload:{rounds:3}},rollWith([2,3,3,4,4,4])).state;
  const home=s.settlements[0];
  assert.equal(s.rollCount,3);assert.equal(s.histogram[5],1);assert.equal(s.histogram[7],1);assert.equal(s.histogram[8],1);
  assert.equal(home.total,2);assert.equal(home.resources.pasture,1);assert.equal(home.resources.clay,1);assert.equal(home.resources.wheat,0);
  assert.equal(s.latestRolls[1].sum,7);assert.equal(s.latestRolls[1].gains.length,0);
  s=applyAction(s,{type:'resetRolls'}).state;
  assert.equal(s.rollCount,0);assert.equal(s.settlements[0].total,0);
});
test('Ein belegter Knoten und direkt benachbarte Knoten sind gesperrt',()=>{
  let s=initialState(2);
  s=applyAction(s,{type:'addSettlement',payload:{playerId:'p0',vertexId:SAMPLE}}).state;
  assert.equal(canPlace(s,SAMPLE,'p1').ok,false);
  const neighbor=ADJACENT_VERTICES[SAMPLE][0];
  assert.ok(neighbor);
  assert.equal(canPlace(s,neighbor,'p1').ok,false);
  s=applyAction(s,{type:'setSettings',payload:{distanceRule:false}}).state;
  assert.equal(canPlace(s,neighbor,'p1').ok,true);
});
test('Ungültige Rundenanzahl und Teamzahl sind gesperrt',()=>{
  assert.throws(()=>applyAction(initialState(),{type:'roll',payload:{rounds:0}}),/1 bis 10/);
  assert.throws(()=>applyAction(initialState(),{type:'setPlayerCount',payload:{count:9}}),/1 bis 8/);
  assert.equal(applyAction(initialState(),{type:'setPlayerCount',payload:{count:6}}).state.players.length,6);
});

test('Zugwechsel ist gemeinsam; falsche Teams und veraltete gleichzeitige Aktionen werden abgewiesen',()=>{
  const first=initialState(2);
  const request={type:'addSettlement',actorId:'p0',revision:0,payload:{playerId:'p0',vertexId:SAMPLE}};
  const next=applyAction(first,request).state;
  assert.equal(next.currentPlayerId,'p1');
  assert.equal(next.revision,1);
  assert.throws(()=>applyAction(next,request),/Spielstand hat sich geändert/);
  assert.throws(()=>applyAction(next,{type:'endTurn',actorId:'p0',revision:1}),/anderes Team/);
  assert.equal(applyAction(next,{type:'endTurn',actorId:'p1',revision:1}).state.currentPlayerId,'p0');
});

test('Volle Teams werden beim Bauen übersprungen; nach dem Aufbau wechselt der Würfelzug',()=>{
  let s=initialState(2);s.maxSettlements=1;s.distanceRule=false;
  s=applyAction(s,{type:'addSettlement',actorId:'p0',revision:0,payload:{playerId:'p0',vertexId:VERTICES[0].id}}).state;
  s=applyAction(s,{type:'addSettlement',actorId:'p1',revision:1,payload:{playerId:'p1',vertexId:VERTICES[1].id}}).state;
  assert.equal(s.currentPlayerId,'p0');
  s=applyAction(s,{type:'roll',actorId:'p0',revision:2,payload:{rounds:1}},()=>3).state;
  assert.equal(s.currentPlayerId,'p1');assert.equal(s.rollCount,1);
});
