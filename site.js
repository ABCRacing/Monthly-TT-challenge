'use strict';
/* Presentation only. Steam collection, challenge switching and archive generation remain server-side. */
const $ = id => document.getElementById(id);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_LABELS = {JAN:'January', FEB:'February', MAR:'March', APR:'April', JUN:'June', JUL:'July', AUG:'August', SEP:'September', SEPT:'September', OCT:'October', NOV:'November', DEC:'December'};
function safe(v) { return String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function milliseconds(v) {
  const raw = String(v ?? '').trim();
  const match = raw.match(/^(?:(\d+):)?(\d{1,2})\.(\d{1,3})$/);
  if (match) return ((Number(match[1] || 0)*60 + Number(match[2]))*1000)+Number(match[3].padEnd(3,'0'));
  const n = Number(raw);
  return Number.isFinite(n) && raw !== '' && n >= 0 ? Math.round(n*1000) : NaN;
}
function signedGap(delta) { return Number.isFinite(delta) && delta >= 0 ? `+${(delta/1000).toFixed(3)}s` : '—'; }
function formatDate(v) {
  const match = String(v || '').match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return v ? String(v) : 'Not recorded';
  const dt = new Date(Date.UTC(2000+Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5])));
  if (!Number.isFinite(dt.getTime())) return String(v);
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt);
}
function parseSteamUtcDate(value) {
  const m = String(value || '').match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  return m ? new Date(Date.UTC(2000 + Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]))) : null;
}
function isMonthlyPB(entry, challenge) {
  if (typeof entry.pb === 'boolean') return entry.pb;
  const time = parseSteamUtcDate(entry.date);
  if (!time || !challenge) return null;
  const month = MONTHS.findIndex(m=>m.toLowerCase()===String(challenge.month||'').toLowerCase()) + 1;
  if (!month) return null;
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'numeric'}).formatToParts(time);
  const vals = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return Number(vals.month)===month && Number(vals.year)===Number(challenge.year);
}
function normaliseCurrent(data, challenge) {
  return data.map(x=>({name:x.Name ?? 'Unknown driver',lap:String(x.LapTime ?? '—'),sectors:[x.Sector1,x.Sector2,x.Sector3],date:x.Date,pb:x.PBSetDuringChallenge,steamGap:x.Gap,globalPosition:x.Position})).map(x=>({...x,pb:isMonthlyPB(x,challenge)}));
}
function normaliseArchive(data, challenge) {
  return (data.results||[]).map(x=>({name:x.name ?? 'Unknown driver',lap:String(x.laptime ?? '—'),sectors:[x.sector1,x.sector2,x.sector3],date:x.timestamp,pb:x.pb_during_challenge,steamGap:null,globalPosition:x.position})).map(x=>({...x,pb:isMonthlyPB(x,challenge)}));
}
function renderStandings(drivers, options={}) {
  const sorted=drivers.slice().sort((a,b)=>milliseconds(a.lap)-milliseconds(b.lap));
  const valid=sorted.filter(x=>Number.isFinite(milliseconds(x.lap)));
  const bestLap=valid.length ? milliseconds(valid[0].lap) : NaN;
  const sectors=[0,1,2].map(i=>Math.min(...sorted.map(x=>milliseconds(x.sectors[i])).filter(Number.isFinite)));
  const showSteam=Boolean(options.showSteam);
  $('driver-count').textContent=String(drivers.length);
  $('leader-lap').textContent=valid.length ? valid[0].lap : '—';
  $('leader-name').textContent=valid.length ? valid[0].name : 'No valid lap yet';
  $('first-gap').textContent=valid.length>1 ? signedGap(milliseconds(valid[1].lap)-bestLap) : '—';
  $('pb-note').hidden=!sorted.some(x=>x.pb===false);
  const b=$('battle-panel');
  b.hidden=valid.length<2;
  if(valid.length>=2){$('battle-first').textContent=`P1 · ${valid[0].name}`;$('battle-second').textContent=`P2 · ${valid[1].name}`;$('battle-gap').textContent=signedGap(milliseconds(valid[1].lap)-bestLap);}
  const thSteam=showSteam?'<th class="num" scope="col">Steam gap</th>':'';
  const desktopRows=sorted.map((x,i)=>{
    const lapMs=milliseconds(x.lap), abc=i===0 && Number.isFinite(lapMs) ? 'LEADER' : signedGap(lapMs-bestLap);
    const ss=x.sectors.map((s,j)=>`<td class="num ${milliseconds(s)===sectors[j]?'sector-best':''}">${safe(s ?? '—')}</td>`).join('');
    return `<tr><td class="rank">${String(i+1).padStart(2,'0')}</td><td><span class="driver-name">${safe(x.name)}</span></td><td class="lap num">${safe(x.lap)}${x.pb===false?'<span class="pb-flag" title="PB set outside this challenge">*</span>':''}</td>${ss}<td class="num ${i===0?'abc-leader':''}">${abc}</td>${showSteam?`<td class="num steam-gap">${safe(x.steamGap || '—')}</td>`:''}</tr>`;
  }).join('');
  $('desktop-standings').innerHTML=`<table class="timing-table"><thead><tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col" class="num">Best lap</th><th scope="col" class="num">S1</th><th scope="col" class="num">S2</th><th scope="col" class="num">S3</th><th scope="col" class="num">ABC gap</th>${thSteam}</tr></thead><tbody>${desktopRows}</tbody></table>`;
  const chevron='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
  $('mobile-standings').innerHTML=sorted.map((x,i)=>{
    const lapMs=milliseconds(x.lap),abc=i===0 && Number.isFinite(lapMs) ? 'Leader' : signedGap(lapMs-bestLap);
    const mobileAbcLabel=i===0?'P1 · ABC leader':`${abc} behind P1`;
    const sectorBoxes=x.sectors.map((s,j)=>`<div class="sector-box ${milliseconds(s)===sectors[j]?'best':''}"><span>SECTOR ${j+1}</span><strong>${safe(s||'—')}</strong>${milliseconds(s)===sectors[j]?'<em>Fastest</em>':''}</div>`).join('');
    const pbText=x.pb===true?'Monthly PB confirmed':x.pb===false?'PB outside challenge':'PB date not recorded';
    return `<details class="driver-card" ${i===0?'open':''}><summary><span class="rank-bubble">${String(i+1).padStart(2,'0')}</span><span class="driver-summary-name"><strong>${safe(x.name)}</strong><small>${safe(mobileAbcLabel)}</small></span><span class="driver-summary-time"><strong>${safe(x.lap)}${x.pb===false?'*':''}</strong><small>View sectors ${chevron}</small></span></summary><div class="driver-details"><div class="sector-grid">${sectorBoxes}</div><div class="driver-extra"><div><span>Lap recorded</span><strong>${safe(formatDate(x.date))}</strong></div><div><span>PB status</span><strong class="${x.pb===true?'text-accent':''}">${safe(pbText)}</strong></div><div><span>ABC gap</span><strong>${abc}</strong></div><div><span>${showSteam?'Steam leader gap':'Steam gap'}</span><strong>${showSteam?safe(x.steamGap||'—'):'Not archived'}</strong></div></div></div></details>`;
  }).join('');
  if(!sorted.length){$('mobile-standings').innerHTML='<p class="text-muted">No results recorded for this challenge.</p>';$('desktop-standings').innerHTML='<p class="text-muted">No results recorded for this challenge.</p>';}
}
function showError(message) {$('error-message').textContent=message;}
async function loadCurrent() {
  try {
    const [res,challengeRes]=await Promise.all([fetch('data/leaderboard_filtered.json',{cache:'no-store'}),fetch('data/current_challenge.json',{cache:'no-store'})]);
    if(!res.ok||!challengeRes.ok)throw Error('Could not retrieve the current challenge or leaderboard.');
    const [data,challenge]=await Promise.all([res.json(),challengeRes.json()]);
    if(!Array.isArray(data))throw Error('Unexpected leaderboard data format.');
    $('challenge-month').textContent=`${String(challenge.month||'').toUpperCase()} ${challenge.year||''} · MONTHLY TT`;
    $('challenge-car').textContent=challenge.car||'Current challenge';
    $('challenge-track').textContent=[challenge.track,challenge.variant,'Automobilista 2'].filter(Boolean).join(' · ');
    renderStandings(normaliseCurrent(data,challenge),{showSteam:true});
  }catch(err){console.error(err);showError('The leaderboard is temporarily unavailable. Please refresh the page.');}
}
let archiveIndex=[];
function parseArchiveFilename(filename){
  const base=String(filename).split('/').pop();
  const m=/^([a-z]+)(\d{4})_RESULTS\.json$/i.exec(base);
  if(!m)return null;
  const raw=m[1],month=MONTHS.find(x=>x.toLowerCase()===raw.toLowerCase())||MONTH_LABELS[raw.toUpperCase()];
  return month?{name:base,year:Number(m[2]),month,order:MONTHS.indexOf(month)}:null;
}
function populateYears(){
  const years=[...new Set(archiveIndex.map(x=>x.year))].sort((a,b)=>b-a);
  $('yearSelect').replaceChildren(...years.map(y=>new Option(String(y),String(y))));
  populateMonths();
}
function populateMonths(){
  const year=Number($('yearSelect').value);
  const months=archiveIndex.filter(x=>x.year===year).sort((a,b)=>b.order-a.order);
  $('monthSelect').replaceChildren(...months.map(x=>new Option(x.month,x.name)));
}
async function loadArchive(event){
  if(event)event.preventDefault();
  const file=$('monthSelect').value;
  if(!archiveIndex.some(x=>x.name===file)){showError('Choose a valid archived month.');return;}
  showError('');
  try{
    const res=await fetch(`data/archive/${encodeURIComponent(file)}`,{cache:'no-store'});
    if(!res.ok)throw Error('Could not fetch the archived results.');
    const data=await res.json();
    const archive=archiveIndex.find(x=>x.name===file);
    const challenge={month:archive.month,year:archive.year,track:data.track,variant:data.variant,car:data.car};
    $('challenge-car').textContent=data.car||'Archived challenge';
    $('challenge-track').textContent=[archive.month+' '+archive.year,data.track,data.variant].filter(Boolean).join(' · ');
    $('results-heading').textContent=`${archive.month} ${archive.year} · Final standings`;
    renderStandings(normaliseArchive(data,challenge),{showSteam:false});
  }catch(err){console.error(err);showError('Could not load the archived results. Please try again.');}
}
async function initArchive(){
  try{
    const res=await fetch('data/archive/index.json',{cache:'no-store'});
    if(!res.ok)throw Error('Archive index unavailable');
    const raw=await res.json();
    const files=Array.isArray(raw)?raw:Array.isArray(raw?.files)?raw.files:Object.values(raw||{}).flat();
    archiveIndex=files.map(parseArchiveFilename).filter(Boolean).sort((a,b)=>b.year-a.year||b.order-a.order);
    if(!archiveIndex.length)throw Error('No archives found');
    populateYears();
    $('yearSelect').addEventListener('change',populateMonths);
    $('archive-form').addEventListener('submit',loadArchive);
    await loadArchive();
  }catch(err){console.error(err);showError('The archive list is unavailable at the moment.');}
}
if(document.body.dataset.page==='current') loadCurrent();
else if(document.body.dataset.page==='archive') initArchive();