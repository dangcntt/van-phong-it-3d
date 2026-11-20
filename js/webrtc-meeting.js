// ============================================================================
// MODULE: WEBRTC GROUP VIDEO & VOICE CALL IN 3D MEETING ROOM
// Supports 2-6 concurrent participants (Camera, Mic, Screen Share) over P2P
// WebRTC Mesh + Live 3D Projection onto the 98" Meeting Room Wall Screen
// ============================================================================

(function () {
  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  const peers = new Map(); // remotePeerId -> { pc, stream, videoEl, name, role, micOn, camOn }
  let localStream = null;
  let localVideoEl = null;
  let isInCall = false;
  let isMicEnabled = true;
  let isCamEnabled = true;
  let isScreenSharingInCall = false;
  let hasPromptedInMeetingRoom = false;

  function getMyInfo() {
    if (typeof window.getEmbodiedAvatarInfo === 'function') {
      return window.getEmbodiedAvatarInfo();
    }
    return { peerId: 'local', name: 'Minh Đăng 👑', role: 'Trưởng Phòng IT' };
  }

  function sendSignal(payload) {
    if (typeof window.broadcastRealtimePacket === 'function') {
      window.broadcastRealtimePacket({
        type: 'webrtc_sig',
        ...payload
      });
    }
  }

  function ensureDockVisible(show = true) {
    const dock = document.getElementById('meeting-call-dock');
    if (!dock) return;
    if (show) dock.classList.remove('hidden');
    else dock.classList.add('hidden');
  }

  function updateCallUI() {
    const statusLabel = document.getElementById('meeting-call-status');
    const btnJoinVideo = document.getElementById('btn-mcall-join-video');
    const btnJoinVoice = document.getElementById('btn-mcall-join-voice');
    const activeControls = document.getElementById('mcall-active-controls');
    const btnMic = document.getElementById('btn-mcall-toggle-mic');
    const btnCam = document.getElementById('btn-mcall-toggle-cam');
    const btnShare = document.getElementById('btn-mcall-share-screen');
    const grid = document.getElementById('meeting-video-grid');

    const totalParticipants = (isInCall ? 1 : 0) + peers.size;
    if (statusLabel) {
      statusLabel.textContent = isInCall
        ? `🔴 ĐANG HỌP TRỰC TUYẾN (${totalParticipants} người trong cuộc gọi)`
        : (peers.size > 0
            ? `📹 Có ${peers.size} người đang bật Call trong Phòng Họp!`
            : '📹 Phòng Họp Video & Voice Call Online');
    }

    if (btnJoinVideo) btnJoinVideo.classList.toggle('hidden', isInCall);
    if (btnJoinVoice) btnJoinVoice.classList.toggle('hidden', isInCall);
    if (activeControls) activeControls.classList.toggle('hidden', !isInCall);
    if (grid) grid.classList.toggle('hidden', !isInCall && peers.size === 0);

    if (btnMic) {
      btnMic.textContent = isMicEnabled ? '🎤 Mic: Bật' : '🔇 Mic: Tắt';
      btnMic.className = isMicEnabled
        ? 'px-2.5 py-1 rounded-xl bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 text-[11px] font-bold cursor-pointer transition'
        : 'px-2.5 py-1 rounded-xl bg-rose-500/30 border border-rose-400/60 text-rose-200 text-[11px] font-bold cursor-pointer transition';
    }
    if (btnCam) {
      btnCam.textContent = isCamEnabled ? '📷 Cam: Bật' : '🚫 Cam: Tắt';
      btnCam.className = isCamEnabled
        ? 'px-2.5 py-1 rounded-xl bg-sky-500/30 border border-sky-400/60 text-sky-200 text-[11px] font-bold cursor-pointer transition'
        : 'px-2.5 py-1 rounded-xl bg-slate-700/60 border border-white/15 text-slate-300 text-[11px] font-bold cursor-pointer transition';
    }
    if (btnShare) {
      btnShare.textContent = isScreenSharingInCall ? '⏹ Dừng Share' : '🖥️ Share Màn Hình';
    }
  }

  function createOrUpdateVideoTile(tileId, labelText, stream, isLocal = false) {
    const grid = document.getElementById('meeting-video-grid');
    if (!grid) return null;

    let tile = document.getElementById(`mcall-tile-${tileId}`);
    let vid = null;
    if (!tile) {
      tile = document.createElement('div');
      tile.id = `mcall-tile-${tileId}`;
      tile.className = 'relative rounded-xl overflow-hidden bg-slate-900 border border-sky-400/40 aspect-video flex items-center justify-center shadow-md';

      vid = document.createElement('video');
      vid.autoplay = true;
      vid.playsInline = true;
      vid.muted = isLocal;
      vid.className = 'w-full h-full object-cover';
      tile.appendChild(vid);

      const badge = document.createElement('div');
      badge.className = 'tile-name-badge absolute bottom-1 left-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-slate-950/80 text-[10px] font-bold text-white truncate border border-white/10';
      tile.appendChild(badge);

      grid.appendChild(tile);
    } else {
      vid = tile.querySelector('video');
    }

    const badge = tile.querySelector('.tile-name-badge');
    if (badge) badge.textContent = labelText;

    if (vid && stream && vid.srcObject !== stream) {
      vid.srcObject = stream;
      vid.muted = isLocal;
      vid.play().catch(() => {});
    }
    return vid;
  }

  function removeVideoTile(tileId) {
    const tile = document.getElementById(`mcall-tile-${tileId}`);
    if (tile) tile.remove();
  }

  async function acquireLocalMedia(wantVideo = true) {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }

    // 1. Try requested camera + microphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: wantVideo ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 20 } } : false,
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        isCamEnabled = wantVideo && localStream.getVideoTracks().length > 0;
        isMicEnabled = localStream.getAudioTracks().length > 0;
        return localStream;
      } catch (err) {
        // 2. Fallback to Audio-Only (Microphone only) if PC has no webcam
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true }
          });
          isCamEnabled = false;
          isMicEnabled = true;
          if (typeof window.showOfficeToast === 'function') {
            window.showOfficeToast('🎤 Máy không có Webcam -> Đã tự động kết nối chế độ Đàm thoại Mic (Voice Call)!');
          }
          return localStream;
        } catch (audioErr) {
          // Fall through to synthetic stream so user can still join & hear/see others
        }
      }
    }

    // 3. Synthetic Avatar Stream fallback if no hardware mic/cam permissions
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext('2d');
    const info = getMyInfo();
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.name, 160, 88);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(info.role, 160, 115);
    localStream = c.captureStream(10);
    isCamEnabled = false;
    isMicEnabled = false;
    return localStream;
  }

  function createPeerConnection(remotePeerId, remoteName, remoteRole) {
    if (peers.has(remotePeerId)) {
      return peers.get(remotePeerId).pc;
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    const remoteStream = new MediaStream();
    const vidEl = createOrUpdateVideoTile(
      remotePeerId,
      `🟢 ${remoteName || 'Đồng nghiệp'}`,
      remoteStream,
      false
    );

    const peerEntry = {
      pc,
      stream: remoteStream,
      videoEl: vidEl,
      name: remoteName || 'Đồng nghiệp',
      role: remoteRole || 'IT Staff',
      micOn: true,
      camOn: true
    };
    peers.set(remotePeerId, peerEntry);
    updateCallUI();

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(tr => {
          if (!remoteStream.getTracks().includes(tr)) {
            remoteStream.addTrack(tr);
          }
        });
      } else if (event.track) {
        remoteStream.addTrack(event.track);
      }
      const v = createOrUpdateVideoTile(
        remotePeerId,
        `🟢 ${peerEntry.name}`,
        remoteStream,
        false
      );
      peerEntry.videoEl = v;
      updateCallUI();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const my = getMyInfo();
        sendSignal({
          action: 'ice',
          toPeer: remotePeerId,
          fromPeer: my.peerId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(remotePeerId);
      }
    };

    return pc;
  }

  function closePeer(remotePeerId) {
    const entry = peers.get(remotePeerId);
    if (!entry) return;
    try { entry.pc.close(); } catch (e) {}
    peers.delete(remotePeerId);
    removeVideoTile(remotePeerId);
    updateCallUI();
  }

  async function joinMeetingCall(withVideo = true) {
    ensureDockVisible(true);
    await acquireLocalMedia(withVideo);
    isInCall = true;
    const my = getMyInfo();
    localVideoEl = createOrUpdateVideoTile('local', `👑 Bạn (${my.name})`, localStream, true);
    updateCallUI();

    sendSignal({
      action: 'join_call',
      fromPeer: my.peerId,
      senderName: my.name,
      role: my.role
    });

    if (typeof window.showOfficeToast === 'function') {
      window.showOfficeToast(`📹 Đã tham gia Call Phòng Họp! Hình ảnh đang được chiếu trực tiếp lên Màn hình 3D Phòng Họp!`);
    }
  }

  function leaveMeetingCall() {
    const my = getMyInfo();
    if (isInCall) {
      sendSignal({
        action: 'leave_call',
        fromPeer: my.peerId
      });
    }
    isInCall = false;
    isScreenSharingInCall = false;
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    removeVideoTile('local');
    localVideoEl = null;

    for (const pid of Array.from(peers.keys())) {
      closePeer(pid);
    }
    updateCallUI();
    if (typeof window.showOfficeToast === 'function') {
      window.showOfficeToast('📞 Đã rời cuộc gọi Video Phòng Họp.');
    }
  }

  function toggleMic() {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    isMicEnabled = !isMicEnabled;
    audioTracks.forEach(t => { t.enabled = isMicEnabled; });
    updateCallUI();
  }

  function toggleCam() {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;
    isCamEnabled = !isCamEnabled;
    videoTracks.forEach(t => { t.enabled = isCamEnabled; });
    updateCallUI();
  }

  async function toggleMeetingScreenShare() {
    if (!isInCall) {
      await joinMeetingCall(true);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return;

    if (isScreenSharingInCall) {
      isScreenSharingInCall = false;
      await acquireLocalMedia(true);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        if (screenTrack && localStream) {
          const oldVideo = localStream.getVideoTracks()[0];
          if (oldVideo) {
            localStream.removeTrack(oldVideo);
            oldVideo.stop();
          }
          localStream.addTrack(screenTrack);
          isScreenSharingInCall = true;
          isCamEnabled = true;

          // Replace video track on all active RTCPeerConnections
          for (const entry of peers.values()) {
            const sender = entry.pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack).catch(() => {});
            }
          }
          screenTrack.onended = () => {
            if (isScreenSharingInCall) toggleMeetingScreenShare();
          };
        }
      } catch (e) {
        return;
      }
    }
    const my = getMyInfo();
    localVideoEl = createOrUpdateVideoTile('local', `👑 Bạn (${my.name})`, localStream, true);
    updateCallUI();
  }

  async function handleSignalPacket(pkt) {
    const my = getMyInfo();
    if (!pkt || pkt.fromPeer === my.peerId) return;

    if (pkt.action === 'join_call') {
      ensureDockVisible(true);
      if (!isInCall) {
        if (typeof window.showOfficeToast === 'function') {
          window.showOfficeToast(`📹 ${pkt.senderName || 'Đồng nghiệp'} vừa bật Video Call trong Phòng Họp! Bấm tham gia để nói chuyện!`);
        }
        return;
      }
      // We are already in the call -> initiate WebRTC Offer to the newcomer
      const pc = createPeerConnection(pkt.fromPeer, pkt.senderName, pkt.role);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
          action: 'offer',
          toPeer: pkt.fromPeer,
          fromPeer: my.peerId,
          senderName: my.name,
          role: my.role,
          sdp: pc.localDescription
        });
      } catch (e) {}
    } else if (pkt.action === 'offer' && pkt.toPeer === my.peerId) {
      if (!isInCall) return;
      const pc = createPeerConnection(pkt.fromPeer, pkt.senderName, pkt.role);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({
          action: 'answer',
          toPeer: pkt.fromPeer,
          fromPeer: my.peerId,
          senderName: my.name,
          role: my.role,
          sdp: pc.localDescription
        });
      } catch (e) {}
    } else if (pkt.action === 'answer' && pkt.toPeer === my.peerId) {
      const entry = peers.get(pkt.fromPeer);
      if (entry && entry.pc) {
        try {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp));
        } catch (e) {}
      }
    } else if (pkt.action === 'ice' && pkt.toPeer === my.peerId) {
      const entry = peers.get(pkt.fromPeer);
      if (entry && entry.pc && pkt.candidate) {
        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(pkt.candidate));
        } catch (e) {}
      }
    } else if (pkt.action === 'leave_call') {
      closePeer(pkt.fromPeer);
    }
  }

  // Draws Live Video Call Grid directly onto the 98" 3D Meeting Room Screen!
  function drawMeetingCallTo3DScreen(ctx, w, h, t) {
    if (!isInCall && peers.size === 0) return false;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Header Bar
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(18, 17, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    const count = (isInCall ? 1 : 0) + peers.size;
    ctx.fillText(`📹 PHÒNG HỌP VIDEO CALL ONLINE • ${count} THÀNH VIÊN TRỰC TUYẾN`, 32, 22);

    const feeds = [];
    const my = getMyInfo();
    if (isInCall) {
      feeds.push({ name: `${my.name} (Bạn)`, videoEl: localVideoEl, active: isCamEnabled });
    }
    for (const entry of peers.values()) {
      feeds.push({ name: entry.name, videoEl: entry.videoEl, active: true });
    }

    const cols = feeds.length <= 1 ? 1 : 2;
    const rows = feeds.length <= 2 ? 1 : 2;
    const pad = 8;
    const cellW = (w - pad * (cols + 1)) / cols;
    const cellH = (h - 38 - pad * (rows + 1)) / rows;

    feeds.slice(0, 4).forEach((f, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = pad + c * (cellW + pad);
      const y = 38 + pad + r * (cellH + pad);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, y, cellW, cellH);

      if (f.videoEl && f.videoEl.readyState >= 2 && f.active) {
        try {
          ctx.drawImage(f.videoEl, x, y, cellW, cellH);
        } catch (e) {}
      } else {
        // Animated Voice Wave Avatar Circle
        const cx = x + cellW / 2;
        const cy = y + cellH / 2 - 6;
        const pulse = 24 + Math.sin(t * 8 + idx) * 4;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((f.name || 'IT').slice(0, 2).toUpperCase(), cx, cy + 6);
      }

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cellW, cellH);

      // Participant Label Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(x + 4, y + cellH - 22, Math.min(cellW - 8, 175), 18);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🟢 ${f.name.slice(0, 22)}`, x + 10, y + cellH - 9);
    });

    return true;
  }

  // Spatial Trigger: Check if the embodied player just walked into the Meeting Room
  function checkSpatialMeetingZone(x, z) {
    const insideMeeting = (x < -2.2 && x > -12.0 && z < -2.2 && z > -9.0);
    if (insideMeeting && !hasPromptedInMeetingRoom) {
      hasPromptedInMeetingRoom = true;
      ensureDockVisible(true);
      updateCallUI();
      if (!isInCall && typeof window.showOfficeToast === 'function') {
        window.showOfficeToast('📹 Bạn vừa bước vào Phòng Họp! Bấm "📹 Bật Cam + Mic" hoặc "🎤 Chỉ Bật Mic" để họp trực tuyến!');
      }
    } else if (!insideMeeting && hasPromptedInMeetingRoom) {
      hasPromptedInMeetingRoom = false;
      if (!isInCall && peers.size === 0) {
        ensureDockVisible(false);
      }
    }
  }

  function bindDockEvents() {
    const btnJoinVideo = document.getElementById('btn-mcall-join-video');
    const btnJoinVoice = document.getElementById('btn-mcall-join-voice');
    const btnMic = document.getElementById('btn-mcall-toggle-mic');
    const btnCam = document.getElementById('btn-mcall-toggle-cam');
    const btnShare = document.getElementById('btn-mcall-share-screen');
    const btnLeave = document.getElementById('btn-mcall-leave');
    const btnCloseDock = document.getElementById('btn-mcall-close-dock');
    const btnOpenCallHeader = document.getElementById('btn-open-meeting-call');

    if (btnJoinVideo) btnJoinVideo.addEventListener('click', () => joinMeetingCall(true));
    if (btnJoinVoice) btnJoinVoice.addEventListener('click', () => joinMeetingCall(false));
    if (btnMic) btnMic.addEventListener('click', toggleMic);
    if (btnCam) btnCam.addEventListener('click', toggleCam);
    if (btnShare) btnShare.addEventListener('click', toggleMeetingScreenShare);
    if (btnLeave) btnLeave.addEventListener('click', leaveMeetingCall);
    if (btnCloseDock) {
      btnCloseDock.addEventListener('click', () => {
        ensureDockVisible(false);
      });
    }
    if (btnOpenCallHeader) {
      btnOpenCallHeader.addEventListener('click', () => {
        const dock = document.getElementById('meeting-call-dock');
        if (dock && !dock.classList.contains('hidden') && !isInCall) {
          ensureDockVisible(false);
        } else {
          ensureDockVisible(true);
          updateCallUI();
        }
      });
    }
  }

  window.MeetingCallManager = {
    joinMeetingCall,
    leaveMeetingCall,
    toggleMic,
    toggleCam,
    toggleMeetingScreenShare,
    handleSignalPacket,
    drawMeetingCallTo3DScreen,
    checkSpatialMeetingZone,
    ensureDockVisible,
    isInCall: () => isInCall
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(bindDockEvents, 50);
  } else {
    window.addEventListener('DOMContentLoaded', bindDockEvents);
  }
})();
