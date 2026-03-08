import { Room, RoomEvent, Track } from 'livekit-client';

let room = null;
const segments = new Map();

const $ = id => document.getElementById(id);

function log(msg, level = 'info') {
  const t = new Date().toLocaleTimeString();
  const c = { error: '#ef4444', warn: '#e88a20', ok: '#4ade80', info: '#888' }[level] || '#888';
  $('log').innerHTML += `<span style="color:${c}">[${t}] ${msg}</span>\n`;
  $('log').scrollTop = $('log').scrollHeight;
}

function updateParticipants() {
  if (!room) return;
  const ps = Array.from(room.remoteParticipants.values()).map(p => p.identity);
  $('participants').textContent = ps.length ? ps.join(', ') : '(none)';
}

window.doConnect = async function () {
  const url = $('lk-url').value.trim();
  const token = $('lk-token').value.trim();
  if (!url || !token) { log('Enter URL and token', 'error'); return; }

  log('Connecting to ' + url);
  $('status').textContent = 'Connecting...';

  room = new Room();

  room.on(RoomEvent.Connected, () => {
    log('Connected as ' + room.localParticipant.identity, 'ok');
    $('status').textContent = 'Connected: ' + room.localParticipant.identity;
    $('status').className = 'panel ok';
    updateParticipants();
  });

  room.on(RoomEvent.Disconnected, () => {
    log('Disconnected', 'error');
    $('status').textContent = 'Disconnected';
    $('status').className = 'panel err';
  });

  room.on(RoomEvent.ParticipantConnected, p => {
    log('Joined: ' + p.identity, 'ok');
    updateParticipants();
  });

  room.on(RoomEvent.ParticipantDisconnected, p => {
    log('Left: ' + p.identity, 'warn');
    updateParticipants();
  });

  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    log(`Track: ${track.kind} from ${participant.identity}`, 'ok');
    if (track.kind === Track.Kind.Video) {
      track.attach($('video'));
    }
    // Only play agent audio, not phone audio
    if (track.kind === Track.Kind.Audio && participant.identity !== 'phone-user') {
      const el = document.createElement('audio');
      el.autoplay = true;
      document.body.appendChild(el);
      track.attach(el);
      log('Agent audio playing', 'ok');
    }
  });

  room.on(RoomEvent.DataReceived, (payload, participant) => {
    try {
      const cmd = JSON.parse(new TextDecoder().decode(payload));
      log(`Data [${cmd.type}] from ${participant?.identity}: ${JSON.stringify(cmd)}`, 'info');
      $('data').textContent = JSON.stringify(cmd, null, 2);
      $('data').className = 'panel ok';
    } catch (e) {
      log('Bad data: ' + e, 'error');
    }
  });

  room.on(RoomEvent.TranscriptionReceived, (segs, participant, pub) => {
    log(`TRANSCRIPT from ${participant?.identity}: ${segs.length} segs`, 'ok');
    for (const s of segs) {
      log(`  [${s.id}] "${s.text}" final=${s.final}`, 'ok');
      segments.set(s.id, s.text);
    }
    $('transcript').textContent = Array.from(segments.values()).join(' ');
  });

  try {
    await room.connect(url, token);
  } catch (e) {
    log('Failed: ' + e, 'error');
    $('status').textContent = 'Failed: ' + e.message;
    $('status').className = 'panel err';
  }
};

window.sendMsg = function (type) {
  if (!room || room.state !== 'connected') { log('Not connected', 'error'); return; }
  const data = new TextEncoder().encode(JSON.stringify({ type }));
  room.localParticipant.publishData(data, { reliable: true })
    .then(() => log('Sent: ' + type, 'ok'))
    .catch(e => log('Send failed: ' + e, 'error'));
};

window.doMic = async function () {
  if (!room) { log('Not connected', 'error'); return; }
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
    log('Mic enabled', 'ok');
  } catch (e) {
    log('Mic failed: ' + e, 'error');
  }
};

// Auto-fill from URL params or hardcoded defaults
const params = new URLSearchParams(window.location.search);
$('lk-url').value = params.get('livekit_url') || 'wss://storybox-y-r0yjunub.livekit.cloud';
if (params.get('livekit_token')) $('lk-token').value = params.get('livekit_token');

// Auto-connect if both URL and token are provided via params
if ($('lk-url').value && $('lk-token').value) {
  log('Auto-connecting with URL params...', 'ok');
  setTimeout(() => doConnect(), 500);
} else if (!$('lk-token').value) {
  log('No token. Run: cd agent && python start.py — it prints a test page URL with token.', 'warn');
}
