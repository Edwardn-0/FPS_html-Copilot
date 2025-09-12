// server.js
// Render-ready Node.js WebSocket game server (simple in-memory implementation)
// Usage: node server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from ./public (put your index.html there)
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function uid(len=10){ return crypto.randomBytes(len).toString('hex'); }

// In-memory rooms map: code -> room
const rooms = new Map();

function makeRoom(code, name, hostId){
  return {
    code,
    name,
    hostId,
    mode: 'dm',
    settings: { dm:{kills:20,minutes:10}, dom:{score:150,minutes:10} },
    players: new Map(), // clientId -> { id, name, color, ws, pos, hp, kills, team }
    started: false,
    tickInterval: null,
    startTime: null,
    timeLeftSec: 0,
    scoreBlue: 0,
    scoreRed: 0,
    points: [ {progress:0},{progress:0},{progress:0} ]
  };
}

function broadcastRoom(room, msg){
  const s = JSON.stringify(msg);
  for(const p of room.players.values()){
    try{ p.ws.send(s); }catch(e){}
  }
}

function roomToLobbyInfo(room){
  return {
    code: room.code,
    name: room.name,
    mode: room.mode,
    settings: room.settings
  };
}

function buildStateForClients(room){
  const players = [];
  for(const p of room.players.values()){
    players.push({ id: p.id, name: p.name, color: p.color, pos: p.pos || {x:0,y:0,z:0}, hp: p.hp, kills: p.kills, team: p.team || 'blue' });
  }
  return {
    type: 'state',
    time: formatTime(room.timeLeftSec),
    kills: Object.fromEntries(Array.from(room.players.values()).map(p=>[p.id, p.kills])),
    players,
    scoreBlue: room.scoreBlue,
    scoreRed: room.scoreRed,
    points: room.points
  };
}

function formatTime(sec){
  const m = Math.floor(sec/60); const s = Math.floor(sec%60);
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

// Start a match loop for a room
function startGame(room){
  if(room.started) return;
  room.started = true;
  room.startTime = Date.now();
  const totalMinutes = (room.mode==='dm')? room.settings.dm.minutes : room.settings.dom.minutes;
  room.timeLeftSec = totalMinutes*60;

  // reset scores / hp
  for(const p of room.players.values()){
    p.hp = 100; p.kills = 0; p.ready = true; p.pos = p.pos || {x:0,y:1.8,z:0};
  }
  room.scoreBlue = 0; room.scoreRed = 0; room.points = room.points.map(()=>({progress:0}));

  broadcastRoom(room, { type:'start', mode: room.mode, settings: room.settings });

  // tick 10 times per second
  room.tickInterval = setInterval(()=>{
    // countdown
    room.timeLeftSec = Math.max(0, room.timeLeftSec - 0.1);

    // simple DOM capture progression simulation (if dom mode, progress toward whichever team controls it)
    if(room.mode==='dom'){
      // naive progression: randomly nudge points for demonstration
      for(let i=0;i<room.points.length;i++){
        const p = room.points[i];
        // progress is -1 (red) .. +1 (blue), keep within [-1,1]
        p.progress += (Math.random()-0.5)*0.02;
        p.progress = Math.max(-1, Math.min(1, p.progress));
      }
      // update scores from points
      const avg = room.points.reduce((a,b)=>a+(b.progress||0),0)/room.points.length;
      if(avg>0.1) room.scoreBlue += 0.02; else if(avg<-0.1) room.scoreRed += 0.02;
    }

    // broadcast state
    broadcastRoom(room, buildStateForClients(room));

    // end condition
    if(room.timeLeftSec<=0 || (room.mode==='dm' && Array.from(room.players.values()).some(p=>p.kills>=room.settings.dm.kills))){
      clearInterval(room.tickInterval); room.tickInterval=null; room.started=false;
      const text = 'Match ended';
      broadcastRoom(room, { type:'victory', text });
    }
  }, 100);
}

function stopRoom(room){
  if(room.tickInterval){ clearInterval(room.tickInterval); room.tickInterval=null; }
  room.started=false;
}

wss.on('connection', function connection(ws, req){
  ws.id = uid(6);
  ws.isAlive = true;

  // send back assigned clientId
  ws.send(JSON.stringify({ type:'connected', clientId: ws.id }));

  ws.on('message', function incoming(raw){
    let msg;
    try{ msg = JSON.parse(raw); }catch(e){ return; }
    handleMessage(ws, msg);
  });

  ws.on('close', function(){
    // remove from rooms
    for(const room of rooms.values()){
      if(room.players.has(ws.id)){
        room.players.delete(ws.id);
        // if host left, pick another host
        if(room.hostId===ws.id){
          const next = room.players.keys().next();
          room.hostId = next.done? null : next.value;
          // if empty destroy room
          if(!room.hostId){ rooms.delete(room.code); continue; }
        }
        // notify others
        broadcastRoom(room, { type:'lobby', text:`Player left. ${room.players.size} players` });
      }
    }
  });

  ws.on('pong', ()=> ws.isAlive = true);
});

function handleMessage(ws, msg){
  switch(msg.type){
    case 'createRoom': {
      const code = (msg.code || generateRoomCode()).toUpperCase();
      if(rooms.has(code)){
        ws.send(JSON.stringify({ type:'error', text:'Room exists' }));
        return;
      }
      const room = makeRoom(code, msg.name||'Room', ws.id);
      rooms.set(code, room);
      // add host as player
      const player = { id: ws.id, name: msg.player?.name||'Player', color: msg.player?.color||'#60a5fa', ws, hp:100, kills:0, pos:{x:0,y:1.8,z:0} };
      room.players.set(ws.id, player);
      room.hostId = ws.id;
      ws.send(JSON.stringify({ type:'roomCreated', code, name: room.name, clientId: ws.id }));
      break;
    }
    case 'joinRoom': {
      const code = (msg.code||'').toUpperCase();
      const room = rooms.get(code);
      if(!room){ ws.send(JSON.stringify({ type:'error', text:'No such room' })); return; }
      const player = { id: ws.id, name: msg.player?.name||'Player', color: msg.player?.color||'#60a5fa', ws, hp:100, kills:0, pos:{x:0,y:1.8,z:0} };
      room.players.set(ws.id, player);
      ws.send(JSON.stringify({ type:'roomJoined', code: room.code, name: room.name, clientId: ws.id, mode: room.mode, settings: room.settings }));
      broadcastRoom(room, { type:'lobby', text:`방 이름: ${room.name} · 코드: ${room.code} · 플레이어: ${Array.from(room.players.values()).map(p=>p.name).join(', ')}`});
      break;
    }
    case 'setMode': {
      const room = rooms.get(msg.code);
      if(!room) return;
      if(ws.id!==room.hostId) return;
      room.mode = msg.mode;
      broadcastRoom(room, { type:'mode', mode: room.mode });
      break;
    }
    case 'setSettings': {
      const room = rooms.get(msg.code); if(!room) return; if(ws.id!==room.hostId) return;
      room.settings = msg.settings;
      broadcastRoom(room, { type:'settings', settings: room.settings });
      break;
    }
    case 'startGame': {
      const room = rooms.get(msg.code); if(!room) return; if(ws.id!==room.hostId) return;
      startGame(room);
      break;
    }
    case 'spawn': {
      const room = rooms.get(msg.code); if(!room) return; const p = room.players.get(ws.id); if(!p) return;
      p.pos = msg.pos || p.pos;
      p.color = msg.color || p.color;
      // notify lobby that player spawned
      broadcastRoom(room, { type:'lobby', text:`${p.name} spawned` });
      break;
    }
    case 'move': {
      const room = rooms.get(msg.code); if(!room) return; const p = room.players.get(ws.id); if(!p) return;
      p.pos = msg.pos || p.pos;
      break;
    }
    case 'shoot': {
      const room = rooms.get(msg.code); if(!room) return;
      // broadcast shoot so others can play effects
      broadcastRoom(room, { type:'shoot', from: ws.id });
      break;
    }
    case 'hit': {
      const room = rooms.get(msg.code); if(!room) return;
      const target = room.players.get(msg.to);
      const attacker = room.players.get(msg.from);
      if(!target || !attacker) return;
      // apply damage
      const dmg = Math.max(1, attacker?.damage || 34);
      target.hp = Math.max(0, (target.hp||100) - dmg);
      if(target.hp<=0){
        attacker.kills = (attacker.kills||0) + 1;
        // respawn target after short delay
        setTimeout(()=>{ target.hp = 100; target.pos = {x:0,y:1.8,z:0}; }, 2000);
      }
      // broadcast hit and state
      broadcastRoom(room, { type:'hit', from: attacker.id, to: target.id });
      broadcastRoom(room, buildStateForClients(room));
      break;
    }
    case 'requestRebuild': {
      const room = rooms.get(msg.code); if(!room) return; if(ws.id!==room.hostId) return;
      // simply broadcast a rebuild request; clients will rebuild
      broadcastRoom(room, { type:'rebuild' });
      break;
    }
    default:
      // ignore
  }
}

function generateRoomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s;
}

// health-check interval for websockets
setInterval(function ping(){
  wss.clients.forEach(function each(ws){
    if(ws.isAlive===false) return ws.terminate();
    ws.isAlive = false; ws.ping(()=>{});
  });
}, 30000);

server.listen(PORT, ()=>{
  console.log('Server listening on port', PORT);
});
