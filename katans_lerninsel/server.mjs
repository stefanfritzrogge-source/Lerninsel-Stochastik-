import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyAction, initialState, safeRoomCode } from './shared.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.join(ROOT,'public');
const PORT=Number(process.env.PORT||3000);
const DATA_FILE=process.env.DATA_FILE||path.join(ROOT,'data','rooms.json');
const clients=new Map();
let rooms={};
try { rooms=JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); console.log(`Räume geladen: ${Object.keys(rooms).length}`); }
catch { rooms={}; }

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});
    fs.writeFileSync(`${DATA_FILE}.tmp`,JSON.stringify(rooms));
    fs.renameSync(`${DATA_FILE}.tmp`,DATA_FILE);
  } catch(err) { console.error('Speichern fehlgeschlagen:',err.message); }
}
function sendJSON(res,status,obj) {
  const body=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body),'X-Content-Type-Options':'nosniff'});
  res.end(body);
}
function getBody(req) { return new Promise((resolve,reject)=>{
  let data='',finished=false;
  req.on('data',chunk=>{if(finished)return;data+=chunk;if(data.length>32000){finished=true;reject(Error('Anfrage zu groß.'));req.destroy();}});
  req.on('end',()=>{if(finished)return;try{resolve(data?JSON.parse(data):{});}catch{reject(Error('Ungültiges JSON.'));}});
  req.on('error',reject);
}); }
function announce(code) {
  const set=clients.get(code);
  if(!set)return;
  const msg=`event: state\ndata: ${JSON.stringify(rooms[code])}\n\n`;
  for(const res of set){try{res.write(msg);}catch{set.delete(res);}}
}
function newCode(){
  const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {code=Array.from({length:6},()=>letters[crypto.randomInt(letters.length)]).join('');}
  while(rooms[code]);
  return code;
}
const FILES={
  '/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.mjs':'app.mjs',
  '/manifest.webmanifest':'manifest.webmanifest','/favicon.svg':'favicon.svg',
  '/assets/spielfeld.jpg':'assets/spielfeld.jpg'
};
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const pathname=url.pathname;
  try {
    if(req.method==='GET'&&pathname==='/healthz')return sendJSON(res,200,{ok:true,rooms:Object.keys(rooms).length});
    if(req.method==='POST'&&pathname==='/api/rooms/create'){
      const code=newCode();rooms[code]=initialState(4);save();return sendJSON(res,201,{code,state:rooms[code]});
    }
    const match=pathname.match(/^\/api\/rooms\/([A-Z0-9]{1,8})(?:\/(events|actions))?$/i);
    if(match){
      const code=safeRoomCode(match[1]);
      if(!rooms[code])return sendJSON(res,404,{error:'Raum nicht gefunden. Prüfe den Code oder erstelle einen neuen Raum.'});
      if(req.method==='GET'&&!match[2])return sendJSON(res,200,{code,state:rooms[code]});
      if(req.method==='GET'&&match[2]==='events'){
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        res.write(`retry: 1800\nevent: state\ndata: ${JSON.stringify(rooms[code])}\n\n`);
        if(!clients.has(code))clients.set(code,new Set());
        clients.get(code).add(res);
        req.on('close',()=>{clients.get(code)?.delete(res);});
        return;
      }
      if(req.method==='POST'&&match[2]==='actions'){
        const action=await getBody(req);
        try {
          const {state,message}=applyAction(rooms[code],action,()=>crypto.randomInt(1,7));
          rooms[code]=state;save();announce(code);
          return sendJSON(res,200,{ok:true,message,state});
        }catch(err){return sendJSON(res,400,{error:err.message});}
      }
    }
    if(req.method==='GET'&&(FILES[pathname]||pathname==='/shared.mjs')){
      const file=pathname==='/shared.mjs'?path.join(ROOT,'shared.mjs'):path.join(PUBLIC,FILES[pathname]);
      const mime=MIME[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':pathname.includes('spielfeld')?'public,max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'});
      fs.createReadStream(file).pipe(res);return;
    }
    return sendJSON(res,404,{error:'Seite nicht gefunden.'});
  } catch(err){console.error(err);if(!res.headersSent)return sendJSON(res,500,{error:'Serverfehler.'});res.end();}
});
setInterval(()=>{for(const set of clients.values())for(const res of set){try{res.write(': ping\n\n');}catch{set.delete(res);}}},20000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`KATAN-Lerninsel: http://localhost:${PORT}`));
