export function createChatVoice({ language, onState, onTranscript }) {
  let session = null;
  const update = (state, detail = '') => onState(state, detail);
  const stop = (detail = '') => {
    const previous = session;
    session = null;
    if (previous) {
      clearTimeout(previous.timer);
      clearTimeout(previous.limit);
      previous.controller.abort();
      previous.stream?.getTracks().forEach(track => track.stop());
      previous.channel?.close();
      previous.peer?.close();
      previous.audio.pause();
      previous.audio.srcObject = null;
      previous.audio.remove();
    }
    update('idle', detail);
  };
  const send = (current, event) => {
    if (session !== current || current.channel?.readyState !== 'open') return false;
    current.channel.send(JSON.stringify(event));
    return true;
  };
  const drain = async current => {
    if (current.processing || session !== current) return;
    current.processing = true;
    try {
      while (session === current && current.turns.length && current.transcripts.has(current.turns[0])) {
        const id = current.turns.shift();
        const transcript = current.transcripts.get(id);
        current.transcripts.delete(id);
        if (!transcript.trim()) { update('listening'); continue; }
        const version = current.version;
        update('thinking');
        const reply = await onTranscript(transcript);
        if (session !== current) return;
        if (!reply) { stop('replyFailed'); return; }
        if (version !== current.version || current.turns.length) continue;
        send(current, {
          type: 'response.create',
          response: {
            conversation: 'auto',
            output_modalities: ['audio'],
            input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: reply }] }],
          },
        });
        update('thinking');
      }
    } catch {
      if (session === current) stop('connectionFailed');
    } finally {
      current.processing = false;
    }
  };
  const start = async () => {
    if (session) { stop(); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      update('idle', 'unsupported');
      return;
    }
    const current = {
      controller: new AbortController(), audio: document.createElement('audio'),
      turns: [], transcripts: new Map(), seen: new Set(), version: 0, processing: false,
    };
    session = current;
    update('connecting');
    current.timer = setTimeout(() => { if (session === current) stop('connectionFailed'); }, 30000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (session !== current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      stream.getTracks().forEach(track => track.addEventListener('ended', () => { if (session === current) stop('microphoneLost'); }));
      const peer = new RTCPeerConnection();
      current.peer = peer;
      current.audio.autoplay = true;
      current.audio.hidden = true;
      document.body.append(current.audio);
      peer.ontrack = event => {
        if (session !== current) return;
        current.audio.srcObject = event.streams[0];
        current.audio.play().catch(() => { if (session === current) stop('playbackBlocked'); });
      };
      peer.onconnectionstatechange = () => {
        if (session === current && ['failed', 'disconnected', 'closed'].includes(peer.connectionState)) stop('connectionFailed');
      };
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const channel = peer.createDataChannel('oai-events');
      current.channel = channel;
      channel.onopen = () => {
        if (session !== current) return;
        clearTimeout(current.timer);
        current.limit = setTimeout(() => { if (session === current) stop('sessionEnded'); }, 15 * 60 * 1000);
        update('listening');
      };
      channel.onclose = channel.onerror = () => { if (session === current) stop('connectionFailed'); };
      channel.onmessage = event => {
        if (session !== current) return;
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'error' || data.type === 'conversation.item.input_audio_transcription.failed') {
          stop('connectionFailed');
        } else if (data.type === 'input_audio_buffer.speech_started') {
          current.version += 1;
          update('listening');
        } else if (data.type === 'input_audio_buffer.committed') {
          if (!current.seen.has(data.item_id)) {
            current.seen.add(data.item_id);
            current.turns.push(data.item_id);
          }
          void drain(current);
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          current.transcripts.set(data.item_id, String(data.transcript || ''));
          void drain(current);
        } else if (data.type === 'output_audio_buffer.started') {
          update('speaking');
        } else if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared'].includes(data.type)) {
          update(current.processing ? 'thinking' : 'listening');
        } else if (data.type === 'response.done' && data.response?.status === 'failed') {
          stop('connectionFailed');
        }
      };
      const offer = await peer.createOffer();
      if (session !== current) return;
      await peer.setLocalDescription(offer);
      const answer = await window.DealettNetwork.fetchJson('/api/voice/session', {
        method: 'POST', timeoutMs: 25000, signal: current.controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: offer.sdp, language: language() }),
      });
      if (session !== current) return;
      await peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    } catch (error) {
      if (session !== current) return;
      stop(error.name === 'NotAllowedError' ? 'permissionDenied'
        : error.name === 'NotFoundError' ? 'microphoneLost'
          : error.status === 429 ? 'rateLimited'
            : error.status === 423 ? 'previewOnly' : 'connectionFailed');
    }
  };
  window.addEventListener('pagehide', () => stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { start, stop, get active() { return Boolean(session); } };
}
