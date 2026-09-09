const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

// Monthly challenge boundaries are defined in UK local time.
process.env.TZ = 'Europe/London';
const SteamUser = require('steam-user');
const protobuf = require('protobufjs');

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'config');
const ACTIVE_FILE = path.join(CONFIG, 'active_challenge.json');
const PENDING_FILE = path.join(CONFIG, 'pending_challenge.json');
const PARTICIPANTS_FILE = path.join(CONFIG, 'participants.json');

const PUBLIC_ROOT = path.join(ROOT, 'public-site');
const PUBLIC_DATA = path.join(PUBLIC_ROOT, 'data');
const CURRENT_CHALLENGE = path.join(PUBLIC_DATA, 'current_challenge.json');
const CURRENT_FILTERED = path.join(PUBLIC_DATA, 'leaderboard_filtered.json');
const ARCHIVE_INDEX = path.join(PUBLIC_DATA, 'archive', 'index.json');

const OUTPUT = path.join(ROOT, 'shadow_month_end_output');
const PROPOSED = path.join(OUTPUT, 'proposed_public');
const PROPOSED_DATA = path.join(PROPOSED, 'data');
const PROPOSED_ARCHIVE = path.join(PROPOSED_DATA, 'archive');

const EMSG_FIND = 5416;
const EMSG_ENTRIES = 5418;
const CHUNK_SIZE = 250;

fs.mkdirSync(PROPOSED_ARCHIVE, {recursive: true});

const PROTO = `
syntax = "proto2";

message CMsgClientLBSFindOrCreateLB {
  optional uint32 app_id = 1;
  optional int32 leaderboard_sort_method = 2;
  optional int32 leaderboard_display_type = 3;
  optional bool create_if_not_found = 4;
  optional string leaderboard_name = 5;
}

message CMsgClientLBSFindOrCreateLBResponse {
  optional int32 eresult = 1 [default = 2];
  optional int32 leaderboard_id = 2;
  optional int32 leaderboard_entry_count = 3;
  optional int32 leaderboard_sort_method = 4 [default = 0];
  optional int32 leaderboard_display_type = 5 [default = 0];
  optional string leaderboard_name = 6;
}

message CMsgClientLBSGetLBEntries {
  optional int32 app_id = 1;
  optional int32 leaderboard_id = 2;
  optional int32 range_start = 3;
  optional int32 range_end = 4;
  optional int32 leaderboard_data_request = 5;
  repeated fixed64 steamids = 6;
}

message CMsgClientLBSGetLBEntriesResponse {
  optional int32 eresult = 1 [default = 2];
  optional int32 leaderboard_entry_count = 2;
  repeated CMsgClientLBSGetLBEntriesResponse_Entry entries = 3;
}

message CMsgClientLBSGetLBEntriesResponse_Entry {
  optional fixed64 steam_id_user = 1;
  optional int32 global_rank = 2;
  optional int32 score = 3;
  optional bytes details = 4;
  optional fixed64 ugc_id = 5;
}
`;

const protoRoot = protobuf.parse(PROTO, {keepCase: true}).root;
const FindReq = protoRoot.lookupType('CMsgClientLBSFindOrCreateLB');
const FindResp = protoRoot.lookupType('CMsgClientLBSFindOrCreateLBResponse');
const EntriesReq = protoRoot.lookupType('CMsgClientLBSGetLBEntries');
const EntriesResp = protoRoot.lookupType('CMsgClientLBSGetLBEntriesResponse');

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const ARCHIVE_MONTH_ALIASES = {
  JANUARY:1, JAN:1,
  FEBRUARY:2, FEB:2,
  MARCH:3, MAR:3,
  APRIL:4, APR:4,
  MAY:5,
  JUNE:6, JUN:6,
  JULY:7, JUL:7,
  AUGUST:8, AUG:8,
  SEPTEMBER:9, SEPT:9, SEP:9,
  OCTOBER:10, OCT:10,
  NOVEMBER:11, NOV:11,
  DECEMBER:12, DEC:12
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function normalizedChallenge(obj) {
  return {
    month: String(obj.month || '').trim(),
    year: Number(obj.year),
    track: String(obj.track || '').trim(),
    variant: String(obj.variant || '').trim(),
    car: String(obj.car || '').trim()
  };
}

function sameChallenge(a, b) {
  const x = normalizedChallenge(a), y = normalizedChallenge(b);
  return x.month.toLowerCase() === y.month.toLowerCase()
    && x.year === y.year
    && x.track.toLowerCase() === y.track.toLowerCase()
    && x.variant.toLowerCase() === y.variant.toLowerCase()
    && x.car.toLowerCase() === y.car.toLowerCase();
}

function nextMonth(ch) {
  const x = normalizedChallenge(ch);
  const i = MONTHS.findIndex(m => m.toLowerCase() === x.month.toLowerCase());
  assert(i >= 0, `Unrecognised month ${x.month}`);
  return i === 11
    ? {month:'January', year:x.year + 1}
    : {month:MONTHS[i + 1], year:x.year};
}

function tokenStatus(token) {
  const out = {present:Boolean(token), expiry_iso:null, days_remaining:null, status:'UNKNOWN'};
  if (!token) { out.status='MISSING'; return out; }
  try {
    const part = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const padded = part.padEnd(Math.ceil(part.length/4)*4, '=');
    const payload = JSON.parse(Buffer.from(padded,'base64').toString('utf8'));
    if (payload.exp) {
      const ms = Number(payload.exp)*1000;
      out.expiry_iso = new Date(ms).toISOString();
      out.days_remaining = Math.floor((ms-Date.now())/86400000);
      if (out.days_remaining < 0) out.status='EXPIRED';
      else if (out.days_remaining < 14) out.status='BLOCK_PRODUCTION';
      else if (out.days_remaining < 30) out.status='WARNING';
      else out.status='OK';
    }
  } catch (_) {}
  return out;
}

function boardName(identity, vehicleId) {
  return `cars2_autoevent_${identity.board_id}_${identity.track_id}_${vehicleId}_${identity.version}`;
}

function encode(Type, obj) {
  const err = Type.verify(obj);
  if (err) throw new Error(`${Type.name}: ${err}`);
  return Buffer.from(Type.encode(Type.create(obj)).finish());
}

function asBuffer(v) {
  if (!v) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (v.buffer && v.offset !== undefined && v.limit !== undefined) {
    try { return Buffer.from(v.buffer.slice(v.offset, v.limit)); } catch (_) {}
  }
  if (typeof v.toBuffer === 'function') {
    try { return Buffer.from(v.toBuffer()); } catch (_) {}
  }
  return null;
}

function toObject(Type, decoded) {
  return Type.toObject(decoded, {longs:String, bytes:Buffer, defaults:true});
}

function sendRaw(user, appId, emsg, body, ResponseType, timeoutMs=30000) {
  return new Promise((resolve,reject) => {
    let done=false;
    const timer=setTimeout(() => {
      if (!done) { done=true; reject(new Error(`No Steam response for EMsg ${emsg}`)); }
    }, timeoutMs);

    try {
      user._send({msg:emsg, proto:{routing_appid:appId}}, body, (...args) => {
        if (done) return;
        done=true; clearTimeout(timer);
        try {
          let buf=null;
          for (const arg of args) { buf=asBuffer(arg); if (buf) break; }
          if (!buf) throw new Error('Steam callback contained no response buffer');
          resolve(toObject(ResponseType, ResponseType.decode(buf)));
        } catch (err) { reject(err); }
      });
    } catch (err) {
      if (!done) { done=true; clearTimeout(timer); reject(err); }
    }
  });
}

function decodeDetails(v) {
  const buf=asBuffer(v)||Buffer.alloc(0);
  const ints=[], pairs={};
  if (buf.length && buf.length%4===0) {
    for (let i=0;i<buf.length;i+=4) ints.push(buf.readInt32LE(i));
  }
  if (ints.length%2===0) {
    for (let i=0;i<ints.length;i+=2) pairs[String(ints[i])]=ints[i+1];
  }
  return {ints,pairs};
}

function login(refreshToken) {
  const user=new SteamUser({renewRefreshTokens:false,autoRelogin:false});
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('Steam login timed out')),60000);
    user.once('loggedOn',()=>{clearTimeout(timer);resolve(user);});
    user.once('error',err=>{clearTimeout(timer);reject(err);});
    user.logOn({refreshToken,machineName:'ABC Racing Rollover Simulation'});
  });
}

async function findBoard(user, identity, vehicleId) {
  const appId=1066890;
  const name=boardName(identity,vehicleId);
  const body=encode(FindReq,{app_id:appId,create_if_not_found:false,leaderboard_name:name});
  const r=await sendRaw(user,appId,EMSG_FIND,body,FindResp);
  assert(Number(r.eresult)===1, `Find board failed for ${name}: EResult ${r.eresult}`);
  assert(Number(r.leaderboard_id)>0, `Steam returned no leaderboard ID for ${name}`);
  return {
    name,
    id:Number(r.leaderboard_id),
    count:Number(r.leaderboard_entry_count||0)
  };
}

async function getRange(user, identity, found, vehicleId, start, end) {
  const appId=1066890;
  const body=encode(EntriesReq,{
    app_id:appId,
    leaderboard_id:found.id,
    range_start:start,
    range_end:end,
    leaderboard_data_request:0,
    steamids:[]
  });
  const r=await sendRaw(user,appId,EMSG_ENTRIES,body,EntriesResp);
  assert(Number(r.eresult)===1, `${found.name}: Get entries EResult ${r.eresult}`);
  let entries=r.entries||[];
  if (!Array.isArray(entries)) entries=entries?[entries]:[];
  return {
    total:Number(r.leaderboard_entry_count||0),
    rows:entries.map(e=>{
      const d=decodeDetails(e.details);
      const score=Number(e.score||0);
      const s1=Number(d.pairs['4867']);
      const s2=Number(d.pairs['4868']);
      return {
        steam_id:String(e.steam_id_user||''),
        global_rank:Number(e.global_rank||0),
        score_ms:score,
        details:d.ints,
        detail_pairs:d.pairs,
        sector1_ms:s1,
        sector2_ms:s2,
        sector3_ms:score-s1-s2,
        vehicle_id:Number(vehicleId)
      };
    })
  };
}

async function downloadBoard(user, identity, vehicleId, allowZero=false) {
  const found=await findBoard(user,identity,vehicleId);
  if (found.count===0) {
    assert(allowZero, `${found.name}: zero entries unexpectedly`);
    return {vehicle_id:Number(vehicleId), leaderboard_id:found.id, count:0, rows:[]};
  }

  const rows=[];
  let observed=found.count;
  for (let start=1;start<=found.count;start+=CHUNK_SIZE) {
    const end=Math.min(found.count,start+CHUNK_SIZE-1);
    const part=await getRange(user,identity,found,vehicleId,start,end);
    if (part.total>0) observed=part.total;
    rows.push(...part.rows);
  }

  assert(observed===found.count, `${found.name}: count changed during download`);
  assert(rows.length===found.count, `${found.name}: incomplete full download`);

  const ids=new Set(), ranks=new Set();
  for (const row of rows) {
    assert(row.steam_id, `${found.name}: blank Steam ID`);
    assert(!ids.has(row.steam_id), `${found.name}: duplicate Steam ID ${row.steam_id}`);
    ids.add(row.steam_id);
    assert(!ranks.has(row.global_rank), `${found.name}: duplicate rank ${row.global_rank}`);
    ranks.add(row.global_rank);

    assert(Number(row.detail_pairs['4865'])===Number(identity.board_id),
      `${found.name}: board identity mismatch at rank ${row.global_rank}`);
    assert((Number(row.detail_pairs['4871'])>>>0)===(Number(vehicleId)>>>0),
      `${found.name}: vehicle identity mismatch at rank ${row.global_rank}`);
    assert(row.sector1_ms>0 && row.sector2_ms>0 && row.sector3_ms>0,
      `${found.name}: incomplete sectors at rank ${row.global_rank}`);
  }

  return {vehicle_id:Number(vehicleId),leaderboard_id:found.id,count:found.count,rows};
}

function mergeBoards(boards) {
  const best=new Map();
  for (const b of boards) {
    for (const row of b.rows) {
      const old=best.get(row.steam_id);
      if (!old || row.score_ms<old.score_ms ||
          (row.score_ms===old.score_ms && row.global_rank<old.global_rank)) {
        best.set(row.steam_id,row);
      }
    }
  }
  return [...best.values()]
    .sort((a,b)=>(a.score_ms-b.score_ms)||(a.global_rank-b.global_rank))
    .map((r,i)=>({...r,combined_position:i+1}));
}

function formatTime(ms) {
  const n=Number(ms), mins=Math.floor(n/60000), sec=(n%60000)/1000;
  return mins ? `${mins}:${sec.toFixed(3).padStart(6,'0')}` : sec.toFixed(3);
}

function formatGap(ms) {
  return Number(ms)===0?'':`+${(Number(ms)/1000).toFixed(3)}`;
}

function dateUtc(ts) {
  const n=Number(ts);
  if (!Number.isFinite(n)||n<=0) return '';
  const d=new Date(n*1000);
  return [
    String(d.getUTCFullYear()).slice(-2),
    String(d.getUTCMonth()+1).padStart(2,'0'),
    String(d.getUTCDate()).padStart(2,'0')
  ].join('-')+' '+
  String(d.getUTCHours()).padStart(2,'0')+':'+
  String(d.getUTCMinutes()).padStart(2,'0');
}

function decodeFlags(value) {
  const n=Number(value);
  if (!Number.isFinite(n)) return '';
  const parts=[(n&(1<<2))?'W':((n&(1<<1))?'P':'K'),(n&1)?'+':'-'];
  if (n&(1<<9)) parts.push('G');
  if (n&(1<<10)) parts.push('C');
  if (n&(1<<15)) parts.push('D');
  return parts.join('|');
}

function participantFor(row, registry) {
  const sid=String(row.steam_id);
  return registry.participants.find(p=>String(p.steam_id||'').trim()===sid)||null;
}

function validateParticipantRegistry(registry) {
  assert(registry && Array.isArray(registry.participants),
    'participants.json must contain a participants array.');

  const seenIds=new Set();
  const seenNames=new Set();

  for (const p of registry.participants) {
    const name=String(p.friendly_name||'').trim();
    const sid=String(p.steam_id||'').trim();

    assert(name, 'Every participant must have a friendly_name.');
    assert(sid, `Participant ${name} has no permanent Steam ID. Production dry run requires permanent IDs.`);
    assert(/^\d{17}$/.test(sid), `Participant ${name} has an invalid Steam ID: ${sid}`);

    const folded=name.toLowerCase();
    assert(!seenNames.has(folded), `Duplicate participant name: ${name}`);
    seenNames.add(folded);

    assert(!seenIds.has(sid), `Duplicate participant Steam ID: ${sid}`);
    seenIds.add(sid);
  }
}

function challengeWindow(challenge) {
  const c=normalizedChallenge(challenge);
  const monthIndex=MONTHS.findIndex(m=>m.toLowerCase()===c.month.toLowerCase());
  assert(monthIndex>=0, `Unrecognised challenge month: ${c.month}`);

  // Date constructor uses Europe/London because process.env.TZ is set above.
  // This correctly handles BST/GMT at the monthly boundaries.
  const start=new Date(c.year,monthIndex,1,0,0,0,0);
  const end=new Date(c.year,monthIndex+1,1,0,0,0,0);

  return {
    timezone:'Europe/London',
    start_unix:Math.floor(start.getTime()/1000),
    end_unix_exclusive:Math.floor(end.getTime()/1000),
    start_iso:start.toISOString(),
    end_iso_exclusive:end.toISOString()
  };
}

function pbStatus(timestamp, challenge) {
  const ts=Number(timestamp);
  const window=challengeWindow(challenge);

  if (!Number.isFinite(ts) || ts<=0) {
    return {
      during:null,
      status:'PB date unavailable',
      warning:'PB date unavailable',
      window
    };
  }

  const during=ts>=window.start_unix && ts<window.end_unix_exclusive;
  return {
    during,
    status:during
      ? 'PB set during this Monthly TT'
      : 'PB not set during this Monthly TT',
    warning:during ? '' : 'PB not set during this Monthly TT',
    window
  };
}

function activeVehiclePublicName(active, vehicleId) {
  const v=(active.steam.vehicles||[]).find(x=>Number(x.vehicle_id)===Number(vehicleId));
  return v ? String(v.public_name||v.name||'') : '';
}

function pendingVehiclePublicName(pending, vehicleId) {
  const ids=(pending.private_identity.vehicle_ids||[]).map(Number);
  if (ids.length===1 && ids[0]===Number(vehicleId)) {
    return normalizedChallenge(pending.public_challenge).car;
  }
  return normalizedChallenge(pending.public_challenge).car;
}

function buildPublicRows(merged, challenge, registry, vehicleNameFn) {
  if (!merged.length) return [];

  const fastest=Math.min(...merged.map(x=>x.score_ms));
  const rows=[];

  for (const row of merged) {
    const p=participantFor(row,registry);
    if (!p) continue;

    const pb=pbStatus(row.detail_pairs['4872'],challenge);

    rows.push({
      Position:String(row.combined_position),
      Name:p.friendly_name,
      SteamID:row.steam_id,
      LapTime:formatTime(row.score_ms),
      Sector1:formatTime(row.sector1_ms),
      Sector2:formatTime(row.sector2_ms),
      Sector3:formatTime(row.sector3_ms),
      Gap:formatGap(row.score_ms-fastest),
      Car:vehicleNameFn(row.vehicle_id),
      Date:dateUtc(row.detail_pairs['4872']),
      Flags:decodeFlags(row.detail_pairs['4869']),
      PBSetDuringChallenge:pb.during,
      PBStatus:pb.status,
      PBWarning:pb.warning
    });
  }

  return rows.sort((a,b)=>Number(a.Position)-Number(b.Position));
}

function legacyProjection(rows) {
  return rows.map(r=>({
    Position:r.Position,
    Name:r.Name,
    SteamID:r.SteamID,
    LapTime:r.LapTime,
    Sector1:r.Sector1,
    Sector2:r.Sector2,
    Sector3:r.Sector3,
    Gap:r.Gap,
    Car:r.Car,
    Date:r.Date,
    Flags:r.Flags
  }));
}

function buildArchive(challenge, rows) {
  const c=normalizedChallenge(challenge);
  return {
    track:c.track,
    variant:c.variant,
    car:c.car,
    month:c.month,
    year:c.year,
    results:rows.map((r,i)=>({
      position:Number(r.Position)||i+1,
      name:r.Name,
      laptime:r.LapTime,
      sector1:r.Sector1,
      sector2:r.Sector2,
      sector3:r.Sector3,
      timestamp:r.Date,
      pb_during_challenge:r.PBSetDuringChallenge,
      pb_status:r.PBStatus
    }))
  };
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

function renderPreviewSection(title, challenge, rows) {
  const c=normalizedChallenge(challenge);
  const body=rows.length
    ? rows.map(r=>`
      <tr class="${r.PBSetDuringChallenge===false?'oldpb':''}">
        <td>${htmlEscape(r.Position)}</td>
        <td>${htmlEscape(r.Name)}</td>
        <td>${htmlEscape(r.LapTime)}</td>
        <td>${htmlEscape(r.Car)}</td>
        <td>${htmlEscape(r.Date)}</td>
        <td>${r.PBSetDuringChallenge===false
          ? '<span class="warn">PB not set during this Monthly TT</span>'
          : (r.PBSetDuringChallenge===true
              ? '<span class="ok">PB set during this Monthly TT</span>'
              : '<span class="unknown">PB date unavailable</span>')}</td>
      </tr>`).join('')
    : '<tr><td colspan="6">No ABC Racing participant PBs currently present on this Steam board.</td></tr>';

  return `
    <section>
      <h2>${htmlEscape(title)}</h2>
      <p>${htmlEscape(c.month)} ${htmlEscape(c.year)} — ${htmlEscape(c.track)}${c.variant?' — '+htmlEscape(c.variant):''} — ${htmlEscape(c.car)}</p>
      <table>
        <thead><tr><th>Position</th><th>Name</th><th>PB</th><th>Vehicle</th><th>PB date (UTC)</th><th>Status</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function writePbPreview(activeChallenge, outgoingRows, pendingChallenge, pendingRows) {
  const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ABC Racing PB flag rollover preview</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;background:#111;color:#eee}
section{margin:0 0 34px;padding:18px;background:#1b1b1b;border-radius:10px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #555;padding:9px;text-align:left}
th{background:#2b2b2b}
.oldpb{background:#3a2b16}
.warn{font-weight:700;color:#ffd27a}
.ok{color:#9ee7a2}
.unknown{color:#ddd}
.note{padding:12px;background:#242424;border-left:4px solid #aaa;margin-bottom:22px}
</style>
</head>
<body>
<h1>ABC Racing — PB flag rollover preview</h1>
<div class="note">
Rows remain ranked even when their displayed Steam PB predates the Monthly TT.
The warning means only that the PB shown by Steam was not set during that challenge;
it does not claim the driver did not participate.
</div>
${renderPreviewSection('Outgoing challenge / archive preview',activeChallenge,outgoingRows)}
${renderPreviewSection('Incoming challenge / leaderboard preview',pendingChallenge,pendingRows)}
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT,'pb_flag_preview.html'),html,'utf8');
}

function archiveFilename(challenge) {
  const c=normalizedChallenge(challenge);
  return `${c.month.toUpperCase()}${c.year}_RESULTS.json`;
}

function parseArchiveName(name) {
  const m=/^([A-Z]+)(\d{4})_RESULTS\.json$/i.exec(name);
  if (!m) return null;
  const month=ARCHIVE_MONTH_ALIASES[m[1].toUpperCase()];
  if (!month) return null;
  return [Number(m[2]),month];
}

function sortedIndex(index) {
  return [...new Set(index)].sort((a,b)=>{
    const pa=parseArchiveName(a)||[0,0], pb=parseArchiveName(b)||[0,0];
    return (pb[0]-pa[0])||(pb[1]-pa[1]);
  });
}

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
}


function git(args, options={}) {
  return execFileSync('git', args, {
    cwd: PUBLIC_ROOT,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore','pipe','pipe'],
    env: {...process.env, GIT_PAGER:'cat', PAGER:'cat'}
  }).trim();
}

function normalizeRemote(value) {
  return String(value || '')
    .trim()
    .replace(/\.git$/i, '')
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .toLowerCase();
}

function gitStatusPaths() {
  const raw=git(['status','--porcelain=v1','--untracked-files=all']);
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map(line => {
    // XY<space>path; handle ordinary paths and rename "old -> new".
    const body=line.slice(3).trim();
    const arrow=body.lastIndexOf(' -> ');
    return arrow>=0 ? body.slice(arrow+4).trim() : body;
  });
}

function sortedStrings(values) {
  return [...values].sort((a,b)=>a.localeCompare(b));
}

function sameStringSet(a,b) {
  const x=sortedStrings(a), y=sortedStrings(b);
  return x.length===y.length && x.every((v,i)=>v===y[i]);
}

function fileSha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyCandidateFile(relPath) {
  const src=path.join(PUBLIC_ROOT,relPath);
  const dst=path.join(PROPOSED,relPath);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
}

async function main() {
  console.log('='.repeat(110));
  console.log('ABC RACING - SHADOW MONTH-END ROLLOVER V1');
  console.log('='.repeat(110));
  console.log('');
  console.log('PRODUCTION-SHAPED SHADOW TEST');
  console.log('A real local Git commit will be created inside the temporary public-site clone.');
  console.log('Git PUSH is disabled and GitHub workflow permissions remain contents: read.');
  console.log('');

  const active=readJson(ACTIVE_FILE);
  const pending=readJson(PENDING_FILE);
  const registry=readJson(PARTICIPANTS_FILE);
  const liveChallenge=readJson(CURRENT_CHALLENGE);
  const liveFiltered=readJson(CURRENT_FILTERED);
  const liveIndex=readJson(ARCHIVE_INDEX);

  validateParticipantRegistry(registry);

  assert(sameChallenge(active.public_challenge,liveChallenge),
    'Private ACTIVE challenge does not match the live website challenge.');

  assert(pending.locked===true && pending.approved_for_future_activation===true,
    'Pending challenge is not explicitly locked and approved.');

  const expectedNext=nextMonth(active.public_challenge);
  const p=normalizedChallenge(pending.public_challenge);
  assert(
    p.month.toLowerCase()===expectedNext.month.toLowerCase() && p.year===expectedNext.year,
    `Pending challenge must be ${expectedNext.month} ${expectedNext.year}.`
  );

  // Public-repository identity + clean clone proof before any candidate write.
  const expectedRemote='https://github.com/ABCRacing/Monthly-TT-challenge';
  const fetchRemote=git(['remote','get-url','origin']);
  assert(normalizeRemote(fetchRemote)===normalizeRemote(expectedRemote),
    `Wrong public repository remote: ${fetchRemote}`);

  const branch=git(['branch','--show-current']);
  assert(branch==='main', `Public clone must be on main, got ${branch||'(detached)'}`);

  const startingStatus=gitStatusPaths();
  assert(startingStatus.length===0,
    `Public clone is not clean before shadow rollover: ${startingStatus.join(', ')}`);

  const parentCommit=git(['rev-parse','HEAD']);

  // Defense in depth: even an accidental future "git push" cannot use this remote.
  git(['remote','set-url','--push','origin','disabled://shadow-month-end-no-push']);
  const disabledPushRemote=git(['remote','get-url','--push','origin']);
  assert(disabledPushRemote==='disabled://shadow-month-end-no-push',
    'Failed to disable push URL in shadow clone.');

  const token=String(process.env.STEAM_REFRESH_TOKEN||'').trim();
  const tokenInfo=tokenStatus(token);
  assert(token,'Missing STEAM_REFRESH_TOKEN');
  assert(tokenInfo.status!=='EXPIRED','STEAM_REFRESH_TOKEN expired');
  assert(tokenInfo.status!=='BLOCK_PRODUCTION',
    'STEAM_REFRESH_TOKEN has under 14 days remaining');

  const user=await login(token);
  console.log(`Steam authenticated: ${user.steamID}`);

  let activeBoards=[], pendingBoards=[];
  try {
    const activeIdentity={
      board_id:Number(active.steam.board_id),
      track_id:Number(active.steam.track_id),
      version:Number(active.steam.version)
    };

    for (const vehicle of active.steam.vehicles) {
      const b=await downloadBoard(user,activeIdentity,Number(vehicle.vehicle_id),false);
      activeBoards.push(b);
      console.log(`Outgoing ${vehicle.name}: ${b.count}/${b.count}`);
    }

    const pendingIdentity=pending.private_identity;
    for (const vid of pendingIdentity.vehicle_ids) {
      const b=await downloadBoard(user,pendingIdentity,Number(vid),true);
      pendingBoards.push(b);
      console.log(`Incoming board vehicle ${vid}: ${b.count}/${b.count}`);
    }
  } finally {
    try { user.logOff(); } catch (_) {}
  }

  const merged=mergeBoards(activeBoards);
  assert(merged.length>=Number(active.steam.minimum_merged_users||1),
    `Outgoing merged leaderboard suspiciously small: ${merged.length}`);

  const outgoingRows=buildPublicRows(
    merged,
    liveChallenge,
    registry,
    vehicleId=>activeVehiclePublicName(active,vehicleId)
  );
  assert(outgoingRows.length>0,'No outgoing Monthly TT participant rows matched.');

  // Preserve proof that the new collector still reconstructs every pre-existing
  // public field exactly before adding the PB metadata used by the new display.
  const legacyOutgoing=legacyProjection(outgoingRows);
  const liveLegacyExact=JSON.stringify(legacyOutgoing)===JSON.stringify(liveFiltered);
  assert(liveLegacyExact,
    'Outgoing Steam reconstruction no longer exactly matches the live public leaderboard legacy fields.');

  const outgoingArchive=buildArchive(liveChallenge,outgoingRows);
  const outgoingArchiveName=archiveFilename(liveChallenge);
  const proposedIndex=sortedIndex([...liveIndex,outgoingArchiveName]);

  const proposedCurrent=normalizedChallenge(pending.public_challenge);
  const pendingMerged=mergeBoards(pendingBoards);
  const proposedLeaderboard=buildPublicRows(
    pendingMerged,
    pending.public_challenge,
    registry,
    vehicleId=>pendingVehiclePublicName(pending,vehicleId)
  );

  // These are the ONLY public files this month-end rollover is allowed to alter.
  const archiveRel=`data/archive/${outgoingArchiveName}`;
  const allowedPaths=[
    archiveRel,
    'data/archive/index.json',
    'data/current_challenge.json',
    'data/leaderboard_filtered.json'
  ];

  // Apply the production candidate directly to the temporary clone.
  writeJson(path.join(PUBLIC_ROOT,archiveRel),outgoingArchive);
  writeJson(path.join(PUBLIC_ROOT,'data/archive/index.json'),proposedIndex);
  writeJson(path.join(PUBLIC_ROOT,'data/current_challenge.json'),{
    month:proposedCurrent.month,
    year:String(proposedCurrent.year),
    track:proposedCurrent.track,
    variant:proposedCurrent.variant,
    car:proposedCurrent.car
  });
  writeJson(path.join(PUBLIC_ROOT,'data/leaderboard_filtered.json'),proposedLeaderboard);

  const changedBeforeStage=gitStatusPaths();
  assert(
    sameStringSet(changedBeforeStage,allowedPaths),
    `Shadow rollover changed the wrong public files.\nExpected: ${sortedStrings(allowedPaths).join(', ')}\nActual: ${sortedStrings(changedBeforeStage).join(', ')}`
  );

  // Copy exact candidate bytes to the artifact before staging.
  for (const rel of allowedPaths) copyCandidateFile(rel);
  writePbPreview(liveChallenge,outgoingRows,pending.public_challenge,proposedLeaderboard);

  // Stage only the explicit allowlist.
  git(['add','--',...allowedPaths]);
  const staged=git(['diff','--cached','--name-only'])
    .split(/\r?\n/).filter(Boolean);
  assert(sameStringSet(staged,allowedPaths),
    `Wrong staged path set: ${staged.join(', ')}`);

  // Ensure there is no unstaged or untracked residue after staging.
  const unstaged=git(['diff','--name-only']).split(/\r?\n/).filter(Boolean);
  const untracked=git(['ls-files','--others','--exclude-standard'])
    .split(/\r?\n/).filter(Boolean);
  assert(unstaged.length===0,`Unexpected unstaged files remain: ${unstaged.join(', ')}`);
  assert(untracked.length===0,`Unexpected untracked public files remain: ${untracked.join(', ')}`);

  git(['config','user.name','ABC Racing Month-End Automation']);
  git(['config','user.email','actions@users.noreply.github.com']);

  const commitMessage=`Rollover Monthly TT: ${normalizedChallenge(liveChallenge).month} ${normalizedChallenge(liveChallenge).year} to ${p.month} ${p.year}`;
  git(['commit','-m',commitMessage]);

  const shadowCommit=git(['rev-parse','HEAD']);
  const commitParent=git(['rev-parse','HEAD^']);
  assert(commitParent===parentCommit,
    'Shadow commit parent is not the public main commit that was cloned.');

  const committedPaths=git(['diff-tree','--no-commit-id','--name-only','-r','HEAD'])
    .split(/\r?\n/).filter(Boolean);
  assert(sameStringSet(committedPaths,allowedPaths),
    `Shadow commit contains wrong paths: ${committedPaths.join(', ')}`);

  const afterCommitStatus=gitStatusPaths();
  assert(afterCommitStatus.length===0,
    `Shadow public clone is dirty after commit: ${afterCommitStatus.join(', ')}`);

  const treeHash=git(['rev-parse','HEAD^{tree}']);
  const commitStat=git(['show','--stat','--oneline','--decorate=no','HEAD']);
  const commitShow=git(['show','--format=fuller','--binary','--no-ext-diff','HEAD']);
  fs.writeFileSync(path.join(OUTPUT,'shadow_commit_show.txt'),commitShow+'\n','utf8');
  fs.writeFileSync(path.join(OUTPUT,'shadow_commit_stat.txt'),commitStat+'\n','utf8');

  const manifest={};
  for (const rel of allowedPaths) {
    manifest[rel]={
      sha256:fileSha256(path.join(PUBLIC_ROOT,rel)),
      bytes:fs.statSync(path.join(PUBLIC_ROOT,rel)).size
    };
  }

  const outgoingOldPb=outgoingRows.filter(r=>r.PBSetDuringChallenge===false);
  const incomingOldPb=proposedLeaderboard.filter(r=>r.PBSetDuringChallenge===false);
  const pendingRows=pendingBoards.flatMap(b=>b.rows);

  const report={
    generated_at:new Date().toISOString(),
    mode:'SHADOW_PRODUCTION_ROLLOVER_LOCAL_COMMIT_NO_PUSH',
    safety:{
      workflow_permission:'contents: read',
      public_fetch_remote:fetchRemote,
      public_push_remote_after_disable:disabledPushRemote,
      push_performed:false,
      allowed_public_paths:allowedPaths
    },
    git:{
      parent_commit:parentCommit,
      shadow_commit:shadowCommit,
      tree_hash:treeHash,
      commit_message:commitMessage,
      committed_paths:committedPaths,
      working_tree_clean_after_commit:true
    },
    steam_token:tokenInfo,
    outgoing:{
      challenge:normalizedChallenge(liveChallenge),
      merged_unique_users:merged.length,
      participant_rows:outgoingRows,
      live_legacy_fields_exact_json_match:liveLegacyExact,
      old_pb_rows:outgoingOldPb
    },
    archive:{
      filename:outgoingArchiveName,
      payload:outgoingArchive,
      proposed_index:proposedIndex
    },
    incoming:{
      challenge:proposedCurrent,
      private_identity:pending.private_identity,
      board_entry_count:pendingRows.length,
      board_ids:pendingBoards.map(x=>x.leaderboard_id),
      participant_rows:proposedLeaderboard,
      old_pb_rows:incomingOldPb
    },
    candidate_public_file_manifest:manifest,
    verdict:
      'PASS SHADOW COMMIT: the exact month-end public candidate was committed locally with only the four approved public paths; push URL was disabled and nothing was pushed.'
  };

  writeJson(path.join(OUTPUT,'shadow_month_end_report.json'),report);
  writeJson(path.join(OUTPUT,'candidate_public_file_manifest.json'),manifest);

  const s=[];
  s.push('ABC RACING - SHADOW MONTH-END ROLLOVER V1');
  s.push('='.repeat(110));
  s.push(`Generated: ${report.generated_at}`);
  s.push('');
  s.push('SAFETY');
  s.push('-'.repeat(110));
  s.push('Workflow GitHub permission: contents: read');
  s.push(`Public fetch remote: ${fetchRemote}`);
  s.push(`Public push remote after safety lock: ${disabledPushRemote}`);
  s.push('Git push performed: NO');
  s.push('');
  s.push('OUTGOING CHALLENGE');
  s.push('-'.repeat(110));
  const a=normalizedChallenge(liveChallenge);
  s.push(`${a.month} ${a.year}: ${a.track} — ${a.variant} — ${a.car}`);
  for (const b of activeBoards) s.push(`Vehicle ${b.vehicle_id}: ${b.count}/${b.count} LB=${b.leaderboard_id}`);
  s.push(`Merged unique users: ${merged.length}`);
  s.push(`ABC Racing participant rows: ${outgoingRows.length}`);
  s.push(`Live legacy fields exact JSON match: ${liveLegacyExact}`);
  for (const row of outgoingRows) {
    const marker=row.PBSetDuringChallenge===false?' * OLD PB':'';
    s.push(`  ${row.Name}: ${row.LapTime} ${row.Car}${marker}`);
  }
  s.push('');
  s.push('ARCHIVE CANDIDATE');
  s.push('-'.repeat(110));
  s.push(archiveRel);
  s.push(`PB-not-set-during-month rows: ${outgoingOldPb.length}`);
  s.push('');
  s.push('INCOMING CHALLENGE');
  s.push('-'.repeat(110));
  s.push(`${p.month} ${p.year}: ${p.track} — ${p.variant} — ${p.car}`);
  s.push(`Board ID component: ${pending.private_identity.board_id}`);
  s.push(`Track ID: ${pending.private_identity.track_id}`);
  s.push(`Vehicle IDs: ${pending.private_identity.vehicle_ids.join(', ')}`);
  s.push(`Steam entries on incoming board: ${pendingRows.length}`);
  s.push(`ABC Racing PB rows at cutover: ${proposedLeaderboard.length}`);
  for (const row of proposedLeaderboard) {
    const marker=row.PBSetDuringChallenge===false?' * OLD PB':'';
    s.push(`  ${row.Name}: ${row.LapTime}${marker}`);
  }
  s.push('');
  s.push('LOCAL SHADOW GIT COMMIT');
  s.push('-'.repeat(110));
  s.push(`Parent public commit: ${parentCommit}`);
  s.push(`Shadow commit: ${shadowCommit}`);
  s.push(`Tree hash: ${treeHash}`);
  s.push(`Message: ${commitMessage}`);
  s.push('Committed paths:');
  for (const rel of committedPaths) s.push(`  ${rel}`);
  s.push('');
  s.push('VERDICT');
  s.push('-'.repeat(110));
  s.push(report.verdict);

  fs.writeFileSync(path.join(OUTPUT,'shadow_month_end_summary.txt'),s.join('\n')+'\n','utf8');
  console.log('');
  console.log(s.join('\n'));
}

main().catch(err=>{
  fs.mkdirSync(OUTPUT,{recursive:true});
  fs.writeFileSync(
    path.join(OUTPUT,'shadow_month_end_summary.txt'),
    `SHADOW MONTH-END ROLLOVER FAILED\n\n${err.stack||err}\n`,
    'utf8'
  );
  console.error(err.stack||err);
  process.exitCode=1;
});
