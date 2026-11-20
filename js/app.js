import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    // =========================================================================
    // 1. GLOBAL STATE & CONFIGURATION
    // =========================================================================
    const state = {
      isNightMode: false,
      hudCollapsed: false,
      activeCameraPreset: 'overview',
      selectedObject: null,
      hoveredObject: null,
      followCharacter: null,
      cameraLockedToAvatar: false,
      isPaused: false,
      simSpeed: 1,
      showTags: true,
      autoSlideMeeting: true,
      soundEnabled: true,
      masterVolume: 0.75,
      musicVolume: 0.28,
      karaokeMode: 'beat', // 'beat' | 'video3d' | 'iframe'
      ytEmbedDomain: 'youtube', // 'youtube' | 'nocookie' (also switches Dailymotion geo/classic)
      currentEmbedUrl: '',
      currentVideoId: 'https://drive.google.com/file/d/1uCPSPQ-lVG61zPZA4Ibvb7lD1Fc5xDjf/view?usp=sharing',
      beatPlaying: false,
      currentSongKey: 'cat-doi',
      youtubePlaying: false,
      isTvExpanded: false,
      currentSongTitle: 'Cắt Đôi Nỗi Sầu - Tăng Duy Tân',
      karaokeScore: null,
      karaokeScoreTimer: 0,
      karaokeScoreComment: '',
      karaokeLightMode: 'party', // 'party' | 'strobe' | 'chill' | 'off'
      donationTotal: 500000,
      donationCount: 3,
      activeEvent: null, // null | 'crash' | 'pizza' | 'disco' | 'nhau' | 'karaoke' | 'chua'
      isBossUnlocked: false, // Exclusive Boss Minh Đăng RBAC state
      lights: {
        dev: true,
        meeting: true,
        reception: true,
        pantry: true,
        karaoke: true,
        boss: true
      }
    };

    const CAMERA_PRESETS = {
      overview: { pos: new THREE.Vector3(24.5, 22.5, 29.0), target: new THREE.Vector3(6.5, 0.5, 2.0) },
      boss:     { pos: new THREE.Vector3(-10.8, 5.2, 4.6),  target: new THREE.Vector3(-15.8, 1.1, -0.8) },
      dev:      { pos: new THREE.Vector3(-1.5, 6.2, 10.5),  target: new THREE.Vector3(-7.2, 1.0, 3.2) },
      meeting:  { pos: new THREE.Vector3(-1.6, 4.85, 1.2),  target: new THREE.Vector3(-7.2, 1.45, -5.8) },
      server:   { pos: new THREE.Vector3(3.2, 4.8, 10.5),   target: new THREE.Vector3(8.8, 1.3, 5.8) },
      pantry:   { pos: new THREE.Vector3(2.2, 5.6, 2.5),    target: new THREE.Vector3(7.4, 1.1, -5.2) },
      reception:{ pos: new THREE.Vector3(6.8, 5.8, 11.8),   target: new THREE.Vector3(1.2, 0.9, 3.5) },
      karaoke:  { pos: new THREE.Vector3(13.4, 2.05, -4.0), target: new THREE.Vector3(18.81, 2.05, -4.0) },
      nhau:     { pos: new THREE.Vector3(-1.2, 5.6, 18.2),  target: new THREE.Vector3(-2.5, 0.8, 11.8) },
      chua:     { pos: new THREE.Vector3(24.0, 8.8, 16.8),  target: new THREE.Vector3(30.5, 1.8, 3.8) }
    };

    const camTransition = {
      active: false,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      startTarget: new THREE.Vector3(),
      endTarget: new THREE.Vector3(),
      progress: 0,
      duration: 0.9
    };

    // =========================================================================
    // 1.1 EXCLUSIVE BOSS MINH ĐĂNG RBAC & PIN AUTHENTICATION MANAGER
    // =========================================================================
    const BOSS_AUTH_STORAGE_KEY = 'van_phong_it_3d_boss_unlocked_v1';
    const BOSS_PIN_STORAGE_KEY  = 'van_phong_it_3d_boss_pin_v1';
    const BOSS_NETWORK_SIG      = 'MINHDANG_BOSS_SIG_2026';
    let pendingBossActionCallback = null;

    function getValidBossPins() {
      let customPin = '';
      try { customPin = (localStorage.getItem(BOSS_PIN_STORAGE_KEY) || '').trim().toLowerCase(); } catch (e) {}
      const valid = new Set(['minhdang', '2026', 'dangcntt']);
      if (customPin) valid.add(customPin);
      return valid;
    }

    function initBossAuthState() {
      try {
        const params = new URLSearchParams(window.location.search);
        const bossParam = (params.get('boss') || '').trim().toLowerCase();
        if (bossParam && getValidBossPins().has(bossParam)) {
          localStorage.setItem(BOSS_AUTH_STORAGE_KEY, 'true');
          params.delete('boss');
          const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
        state.isBossUnlocked = localStorage.getItem(BOSS_AUTH_STORAGE_KEY) === 'true';
      } catch (e) {
        state.isBossUnlocked = false;
      }
    }
    initBossAuthState();

    window.isBossAuthorized = function() {
      return !!state.isBossUnlocked;
    };

    window.updateBossAuthUI = function() {
      const badge = document.getElementById('boss-auth-badge');
      const btnToggle = document.getElementById('btn-boss-auth-toggle');
      const btnChangePin = document.getElementById('btn-boss-change-pin');
      const grid = document.getElementById('boss-events-grid');

      if (state.isBossUnlocked) {
        if (badge) {
          badge.className = 'px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/60 text-[9px] text-amber-200 font-extrabold';
          badge.textContent = '👑 Sếp Minh Đăng';
        }
        if (btnToggle) {
          btnToggle.className = 'flex-1 px-2 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-500/25 hover:bg-rose-500/30 border border-emerald-400/50 text-emerald-200 transition cursor-pointer flex items-center justify-center gap-1';
          btnToggle.textContent = '👑 Đã Mở Quyền Sếp (Bấm Để Khóa)';
        }
        if (btnChangePin) btnChangePin.classList.remove('hidden');
        if (grid) grid.classList.remove('opacity-60');
      } else {
        if (badge) {
          badge.className = 'px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[9px] text-rose-300 font-bold';
          badge.textContent = '🔒 Chế độ Khách';
        }
        if (btnToggle) {
          btnToggle.className = 'flex-1 px-2 py-1.5 rounded-xl text-[10px] font-extrabold bg-gradient-to-r from-amber-500/25 to-yellow-500/20 hover:from-amber-500/40 hover:to-yellow-500/35 border border-amber-400/50 text-amber-200 transition cursor-pointer flex items-center justify-center gap-1';
          btnToggle.textContent = '🔑 Mở Khóa Quyền Sếp Đăng';
        }
        if (btnChangePin) btnChangePin.classList.add('hidden');
        if (grid) grid.classList.add('opacity-60');
      }
      if (typeof updateInspectorUI === 'function') updateInspectorUI();
    };

    window.requireBossAuth = function(reasonText, onSuccess) {
      if (state.isBossUnlocked) {
        if (typeof onSuccess === 'function') onSuccess();
        return true;
      }
      pendingBossActionCallback = typeof onSuccess === 'function' ? onSuccess : null;
      const modal = document.getElementById('boss-pin-modal');
      const reasonEl = document.getElementById('boss-pin-reason');
      const inputEl = document.getElementById('boss-pin-input');
      const errEl = document.getElementById('boss-pin-error');
      if (reasonEl) {
        reasonEl.textContent = `🔒 Chỉ Trưởng Phòng Minh Đăng mới có quyền: ${reasonText}`;
      }
      if (errEl) errEl.classList.add('hidden');
      if (inputEl) inputEl.value = '';
      if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => { if (inputEl) inputEl.focus(); }, 60);
      }
      if (typeof showToast === 'function') {
        showToast(`🔒 Chỉ Trưởng Phòng Minh Đăng mới có quyền ${reasonText}!`);
      }
      return false;
    };

    // Scene & Three.js references
    let scene, camera, renderer, controls;
    let karaokeTvDom, karaokeTvIframe, karaokeTvVideo;
    let lastTvRect = { left: -1, top: -1, width: -1, height: -1 };
    const tvScreenCorners = [
      new THREE.Vector3(18.81, 3.04, -6.0), // Top-Left
      new THREE.Vector3(18.81, 3.04, -2.0), // Top-Right
      new THREE.Vector3(18.81, 1.06, -6.0), // Bottom-Left
      new THREE.Vector3(18.81, 1.06, -2.0)  // Bottom-Right
    ];
    let tvScreenStream = null;
    let ambientLight, hemiLight, dirLight, serverPointLight;
    const interactiveObjects = [];
    const animatedDoors = [];
    const devMonitors = [];
    const serverLeds = [];
    const ceilingLightZones = { dev: [], meeting: [], reception: [], pantry: [], karaoke: [], boss: [] };
    const confettiParticles = [];
    const bellWaveRings = [];
    let templeBellMesh = null;
    let templeBellSwing = 0;
    let templeAutoBellTimer = 0;
    let tvVideoTexture = null;
    let bossScreenObj = null;
    const bossScreenMeshes = [];
    let bossShareStream = null;
    let bossShareVideo = null;
    let bossVideoTexture = null;
    let bossScreenSharing = false;
    let wasdControlBoss = false;
    let embodiedCharacter = null; // Currently embodied character (any of the 14 staff!)
    let embodyCamMode = 'tps';    // 'tps' (3rd-person follow) | 'fps' (1st-person eye view)
    let nearestPeerChar = null;   // Closest colleague within 2.1m for Key E interaction
    const followerCharacters = new Set(); // Colleagues currently following the player
    let officeCorgi = null;       // 3D Office Pet Corgi ("Boss Corgi • Giám Đốc Tinh Thần")
    // Realtime Online Multiplayer State
    const myPeerId = 'peer_' + Math.random().toString(36).slice(2, 10) + '_' + (Date.now() % 10000);
    const remotePeersMap = new Map(); // peerId -> { lastSeen, charIdx, name, role }
    let mqttClient = null;
    let localBroadcastChan = null;
    let netSyncTimer = 0;
    let presenceSyncTimer = 0;
    let isHandlingRemotePacket = false;
    const REALTIME_TOPIC = 'minhdang_it_office_3d/v1/room_live';
    const keysPressed = {};
    const bbqSmokeParticles = [];
    const steamParticles = [];
    let coffeeBrewingTimer = 0;
    let meetingScreenObj = null;
    let meetingSlideTimer = 0;
    let arcadeScreenObj = null;
    let turboCooling = false;
    let pizzaPartyGroup = null;
    let discoGroup = null;
    const discoLights = [];
    let deliveryBot = null;
    let karaokeScreenObj = null;
    const karaokeLights = [];
    const incenseParticles = [];
    let incenseActiveTimer = 12;
    let nhauNeonLight = null;
    let templeQueueRotationTimer = 0;
    let templeSpeechTimer = 0;
    let templeQueueOrder = [];
    const donationNotes = [];
    let audioCtx = null;
    let discoBeatTimer = 0;
    let discoStep = 0;
    let karaokeBeatTimer = 0;
    let karaokeStep = 0;
    let speechCycleTimer = 0;
    let selectionBox = null;
    let hoverBox = null;
    const officeCharacters = [];
    let simElapsed = 0;
    let canvasRedrawTimer = 0;

    const SONG_PRESETS = {
      'cat-doi': {
        title: 'Cắt Đôi Nỗi Sầu - Tăng Duy Tân',
        ytId: 'iIsfYYw4b2A',
        tempo: 0.27,
        melody: [440, 493.9, 523.3, 493.9, 440, 392, 329.6, 392],
        bass: [110, 110, 130.8, 130.8, 98, 98, 110, 110],
        lyrics: [
          ['Cắt đôi nỗi sầu, anh buông tay...', 'Cắt luôn bug prod đang chạy đêm nay!'],
          ['Anh đã thức trắng bao đêm dài...', 'Chỉ mong sáng mai Server không die!']
        ]
      },
      'dap-mo': {
        title: 'Đắp Mộ Cuộc Tình - Nhạc Sống',
        ytId: 'VAHjzL_gvxg',
        tempo: 0.36,
        melody: [329.6, 392, 440, 523.3, 493.9, 440, 392, 329.6],
        bass: [110, 164.8, 130.8, 164.8, 146.8, 110, 123.5, 110],
        lyrics: [
          ['Say giấc mộng ban đầu, yêu code thuở mới vào...', 'Đâu biết rằng deadline dí tới tận đêm thâu!'],
          ['Đắp mộ cho bug cũ, nào ngờ bug mới lại về...', 'Thôi rót thêm ly bia rồi mai ta fix tiếp!']
        ]
      },
      'noi-vong': {
        title: 'Nối Vòng Tay Lớn - Karaoke',
        ytId: 'UZbexDJTG6g',
        tempo: 0.24,
        melody: [392, 392, 440, 493.9, 587.3, 587.3, 493.9, 440],
        bass: [196, 196, 146.8, 146.8, 164.8, 164.8, 146.8, 196],
        lyrics: [
          ['Rừng núi dang tay nối lại biển xa...', 'Từ Frontend sang Backend chung một nhà!'],
          ['Nối vòng tay lớn Dev, Tester, PM...', 'Deploy thứ sáu mượt mà không cần OT!']
        ]
      },
      'lac-troi': {
        title: 'Lạc Trôi - Sơn Tùng M-TP (IT Ver)',
        ytId: 'ONKG2BRAr20',
        tempo: 0.29,
        melody: [523.3, 587.3, 659.2, 587.3, 523.3, 440, 392, 440],
        bass: [130.8, 130.8, 146.8, 146.8, 110, 110, 123.5, 130.8],
        lyrics: [
          ['Người theo hương hoa mây mù giăng lối...', 'Làn sương khói phôi phai đưa bug xa rồi!'],
          ['Ta đang lạc trôi giữa hàng ngàn dòng log...', 'Tìm hoài không thấy lỗi nằm ở đâu!']
        ]
      },
      'code-xong': {
        title: 'Code Xong Chưa Anh - Bản Hit Deadline',
        ytId: 'iIsfYYw4b2A',
        tempo: 0.25,
        melody: [587.3, 659.2, 784.0, 659.2, 587.3, 523.3, 440.0, 523.3],
        bass: [146.8, 146.8, 174.6, 174.6, 130.8, 130.8, 146.8, 146.8],
        lyrics: [
          ['Code xong chưa anh? Tester đang chờ...', 'Mà sao API vẫn báo lỗi Năm Trăm (500)!'],
          ['Đừng giục anh nữa, để anh uống ngụm trà...', 'Build xong bản này mình kéo nhau đi ca!']
        ]
      },
      'do-toc': {
        title: 'Độ Tộc Fix Bug - Rap IT Cực Cháy',
        ytId: 'UZbexDJTG6g',
        tempo: 0.21,
        melody: [440.0, 523.3, 587.3, 659.2, 587.3, 523.3, 440.0, 392.0],
        bass: [110.0, 110.0, 146.8, 146.8, 130.8, 130.8, 98.0, 110.0],
        lyrics: [
          ['Anh em Độ Tộc IT lên đồ đi hát...', 'Gác lại bàn phím, gác luôn chuyện tiền bạc!'],
          ['Fullstack, Backend, Frontend quẩy hết mình...', 'Sáng mai lên sở code mượt khỏi cần trình!']
        ]
      }
    };

    const TEMPLE_PRAYERS = [
      'Nam mô cầu Deploy thứ 6 không sập! 🙏',
      'Cầu năm nay tăng lương x2, thưởng 6 tháng 💰',
      'Xin bề trên độ hết bug Production! 🐛❌',
      'Cầu khách hàng đừng đổi requirement phút 89 😭',
      'Nam mô cầu năm nay thoát ế có người yêu ❤️',
      'Cầu Server Uptime 99.9999% quanh năm! 🖥️',
      'Xin cho Git merge không bao giờ conflict! 🙏',
      'Cầu Trưởng phòng Minh Đăng duyệt thưởng nóng! ✨',
      'Cầu code 1 lần ăn ngay khỏi cần debug! 🔥',
      'Xin độ cho mắt hết thâm, lưng hết đau! 🧘',
      'Bỏ chút công đức tích phước chống bug! 💵',
      'Cầu deadline tự lùi, tiền tự về ví! 💸',
      'Nam mô cầu dotnet build 0 Warning 0 Error! ⚙️',
      'Xin độ cho MongoDB truy vấn 1ms không nghẽn! 🍃',
      'Cầu Redis Cache không bao giờ bị tràn RAM! ⚡',
      'Xin phù hộ xuất file Word Mẫu 2C không lệch bảng! 📄',
      'Cầu giao diện Vue 3 lên phát khách khen đẹp luôn! 🎨',
      'Nam mô cầu Docker build 1 phát ăn ngay! 🐳',
      'Xin cho API gọi trăm phát trăm trúng 200 OK! 🚀',
      'Cầu đừng bao giờ gặp lỗi NullReferenceException! 🛡️',
      'Xin bề trên độ cho CORS không bao giờ chặn FE! 🌐',
      'Cầu Sếp Minh Đăng chiều nay bao cả phòng đi nhậu! 🍻',
      'Nam mô cầu chữ ký số ký phát ăn liền! ✍️',
      'Xin cho hệ thống Đồng Tháp chạy mượt xuyên năm! 🪷',
      'Cầu Tester hôm nay hiền dịu không bắt bug giao diện! 😇',
      'Xin độ cho kết nối LGSP/NGSP thông suốt 24/7! 🔗',
      'Cầu tối nay ngủ ngon không bị gọi dậy hotfix! 😴',
      'Nam mô cầu chứng chỉ SSL tự gia hạn không bao giờ hết! 🔒',
      'Xin phù hộ cho backup DB lúc nào cũng nguyên vẹn! 💾',
      'Cầu năm nay đạt Chiến sĩ thi đua cấp cơ sở! 🏆',
      'Xin độ cho đường truyền cáp quang biển đừng đứt! 🌊',
      'Cầu phân quyền CR_UNIT_ROLE chuẩn không lệch 1 user! 🔑',
      'Nam mô cầu Postman test toàn màu xanh Pass 100%! ✅',
      'Xin cho anh em phòng IT luôn đoàn kết, giàu sang! 💎',
      'Cầu Sếp Minh Đăng trúng mánh dự án lớn thưởng to! 👑',
      'Thành tâm thỉnh tiếng Đại Hồng Chung giải trừ tà bug! 🔔',
      'Nam mô Zero-Bug Đại Vương độ cho sprint này về đích sớm! 🏁',
      'Xin bề trên phù hộ 26.000 user đăng nhập cùng lúc vẫn mượt! ⚡',
      'Cầu cho file Excel xuất ra không bao giờ bị lỗi font! 📊',
      'Xin độ cho máy chủ không bao giờ báo Full Disk 100%! 💽',
      'Cầu cho khách hàng nghiệm thu ký biên bản cái rẹt! 🖊️',
      'Nam mô cầu đừng ai lỡ tay chạy lệnh DELETE không có WHERE! 😱',
      'Xin cho RAM máy dev luôn dư dả khi mở 50 tab Chrome! 🧠',
      'Cầu cho cuộc họp chiều nay kết thúc trong 15 phút! ⏱️',
      'Xin phù hộ anh em code đâu thắng đó, bug tự tiêu tan! 🌟',
      'Cầu cho Wi-Fi văn phòng căng đét 5 vạch mọi góc phòng! 📶',
      'Nam mô cầu cho thư viện npm update không bị breaking change! 📦',
      'Xin độ cho câu lệnh Aggregate MongoDB chạy nhanh như gió! 🌪️',
      'Cầu cho năm nay cả phòng IT ai cũng mua được nhà, tậu được xe! 🚗',
      'Xin bề trên ban cho trí tuệ sáng suốt, nhìn log là biết bug ở đâu! 👁️',
      'Cầu cho Sếp luôn vui vẻ, duyệt phép nhanh như chớp! 🌴',
      'Nam mô cầu cho hệ thống Thi Đua Khen Thưởng chạy êm ru! 🏅',
      'Xin phù hộ cho phần mềm Quản lý Điều Xe định vị chuẩn từng mét! 🚐',
      'Cầu cho Kho Giấy Tờ Số Hóa đồng bộ 100% không rớt gói tin nào! 📁',
      'Xin độ cho anh em tối nay đi hát Karaoke ai cũng được 100 điểm! 🎤',
      'Cầu cho bia lúc nào cũng lạnh, mồi nướng BBQ lúc nào cũng thơm! 🍢',
      'Nam mô cầu cho gia đình bình an, vạn sự hanh thông, tâm an vạn sự an! 🪷',
      'Xin cho con rút được quẻ Thượng Thượng Đại Cát dưới gốc Đào Tiên! 🎋',
      'Cầu cho mỗi dòng code viết ra đều mang lại phước lành cho người dùng! 💻',
      'Thành tâm kính lễ trước Đại Hùng Bảo Điện, nguyện một lòng viết Clean Code! 🙏',
      'Nam mô Đại Hùng Bảo Điện, cầu cho bản release tuần này mượt như lụa! ✨',
      'Xin độ cho hệ thống HSCBCC không bao giờ bị treo session lúc cao điểm! 🏛️',
      'Cầu cho phần mềm Đo Lường Chất Lượng xuất biên bản chuẩn từng con số! ⚖️',
      'Nam mô cầu cho hệ thống Truy Xuất Nguồn Gốc quét mã QR phát nào ăn phát đó! 📱',
      'Xin bề trên phù hộ cho Hồ Sơ Lưu Trữ 3in1 tra cứu triệu hồ sơ trong nháy mắt! 🗂️',
      'Cầu cho Engine Xceed DocX và OpenXml thay thế thẻ tag không bao giờ sót! 📄',
      'Xin độ cho bảng lương lặp ngang Mẫu 2C/TCTW-98 căn khung đẹp như in! 📊',
      'Cầu cho ảnh thẻ 4x6 chèn vào lý lịch cán bộ không bao giờ bị méo khung! 🖼️',
      'Nam mô cầu cho file Excel xuất bằng ClosedXML mở trên mọi máy đều nét! 📗',
      'Xin cho script cắt trang PDF dấu đỏ lúc nào cũng căn chuẩn từng milimet! 📕',
      'Cầu cho bộ nhớ đệm Redis Hash đồng bộ CR_DONVI và CR_USERS trong 0.5ms! ⚡',
      'Xin bề trên độ cho cây đơn vị đệ quy 5 cấp không bao giờ bị vòng lặp vô tận! 🌳',
      'Cầu cho JWT Token không bao giờ hết hạn đúng lúc lãnh đạo đang thuyết trình! 🔑',
      'Nam mô cầu cho thuộc tính [DataAccess] lọc đúng quyền đơn vị không sai một ly! 🛡️',
      'Xin phù hộ cho Pinia Store bên Vue 3 giữ state chuẩn chỉnh khi chuyển trang! 💚',
      'Cầu cho Vite build bundle sản phẩm nhẹ tênh, tải trang dưới 0.3 giây! 🚀',
      'Xin độ cho CSS Tailwind lên mọi màn hình từ điện thoại tới TV 120 inch đều đẹp! 🎨',
      'Cầu cho WebRTC Call Video trong Phòng Họp kết nối 10 người vẫn nét căng! 📹',
      'Nam mô cầu cho MQTT Broker đồng bộ nhân vật đi bộ không trễ một khung hình! 🌐',
      'Xin cho mỗi lần khách hàng gọi điện đều là gọi khen phần mềm dễ dùng! 📞😊',
      'Cầu cho đừng bao giờ có yêu cầu "Sửa gấp cho anh trước 5 giờ chiều nay"! 🕔',
      'Xin bề trên hóa giải mọi xung đột giữa Developer và Tester thành tình đồng chí! 🤝',
      'Cầu cho bàn phím cơ gõ trăm triệu lần không bị double-click phím nào! ⌨️',
      'Nam mô cầu cho con chuột không bao giờ hết pin đúng lúc đang demo! 🖱️',
      'Xin độ cho màn hình đôi ở bàn làm việc luôn dịu mắt, chống mỏi mắt! 🖥️',
      'Cầu cho ly cà phê sáng nào pha ở Pantry cũng thơm ngon đúng điệu! ☕',
      'Xin phù hộ cho tủ lạnh văn phòng lúc nào cũng đầy ắp trà sữa và hoa quả! 🧋🍉',
      'Cầu cho đốt sống cổ và đốt sống lưng của anh em IT luôn dẻo dai khỏe mạnh! 🧘‍♂️',
      'Nam mô cầu cho tối nay về nhà ngủ một mạch 8 tiếng sâu giấc không mơ thấy bug! 🌙',
      'Xin cho năm nay anh em độc thân trong phòng đều tìm được ý trung nhân! 💑',
      'Cầu cho người yêu của coder luôn thông cảm mỗi khi phải trực chiến deploy! ❤️',
      'Xin bề trên ban lộc cho ví tiền anh em lúc nào cũng rủng rỉnh như quỹ công đức! 💰',
      'Cầu cho cuối năm tổng kết ai cũng đạt Lao động tiên tiến, Chiến sĩ thi đua! 🏅',
      'Nam mô cầu cho tiền thưởng Tết năm nay dày gấp ba năm ngoái! 🧧',
      'Xin độ cho cổ phiếu công nghệ xanh bát ngát, đầu tư đâu thắng đó! 📈',
      'Cầu cho mỗi lần mở ví điện tử đều thấy tin nhắn cộng tiền thưởng dự án! 💳',
      'Xin phù hộ cho Sếp Minh Đăng luôn mạnh khỏe, dẫn dắt phòng IT lập kỷ lục mới! 👑',
      'Cầu cho các anh chị đồng nghiệp luôn vui tươi, tương trợ nhau hết mình! 🌟',
      'Nam mô cầu cho máy điều hòa văn phòng luôn mát mẻ 24 độ quanh năm! ❄️',
      'Xin độ cho máy in văn phòng không bao giờ bị kẹt giấy lúc đang in gấp! 🖨️',
      'Cầu cho chữ ký số USB Token cắm vào máy là nhận ngay không cần cài lại driver! 🔐',
      'Xin bề trên phù hộ cho cổng thanh toán trực tuyến đối soát khớp 100% từng đồng! 💵',
      'Cầu cho hệ thống thông báo Zalo OA gửi tin nhắn tới cán bộ trong 1 giây! 💬',
      'Nam mô cầu cho App Mobile trên iOS và Android được duyệt lên Store ngay trong ngày! 📲',
      'Xin độ cho cơ sở dữ liệu MongoDB không bao giờ bị phân mảnh index! 🍃',
      'Cầu cho câu lệnh Lookup và Unwind chạy mượt trên hàng triệu document! ⚡',
      'Xin phù hộ cho tiến trình Background Service chạy định kỳ chuẩn như đồng hồ Thụy Sĩ! ⏱️',
      'Cầu cho log hệ thống lúc nào cũng sạch sẽ, chỉ toàn mức INFO không có ERROR! 📋',
      'Nam mô cầu cho ổ cứng Server luôn xanh tươi, tốc độ đọc ghi 7000MB/s! 💽',
      'Xin độ cho hệ thống cân bằng tải Load Balancer chia tải đều tăm tắp! ⚖️',
      'Cầu cho tường lửa chặn đứng mọi đợt quét bot, giữ bình yên cho máy chủ! 🛡️',
      'Xin bề trên ban phước cho cáp quang nội bộ và quốc tế luôn thông suốt! 🌐',
      'Cầu cho mỗi dòng comment trong code đều rõ ràng như kinh văn chỉ lối! 📖',
      'Nam mô cầu cho code cũ từ 3 năm trước đọc lại vẫn hiểu ngay trong 5 giây! 💡',
      'Xin độ cho thư viện bên thứ ba không bao giờ ngừng hỗ trợ giữa chừng! 📦',
      'Cầu cho Unit Test và Integration Test lúc nào cũng phủ kín 100% nghiệp vụ! ✅',
      'Xin phù hộ cho buổi nghiệm thu tuần tới lãnh đạo vỗ tay khen ngợi nồng nhiệt! 👏',
      'Cầu cho hồ sơ thanh quyết toán dự án đi qua các phòng ban thuận buồm xuôi gió! ⛵',
      'Nam mô cầu cho hương trầm trước Đại Hùng Bảo Điện tỏa ngát mang lại bình an! 🕯️',
      'Xin độ cho tiếng chuông Tháp Đại Hồng Chung ngân vang đánh thức mọi ý tưởng hay! 🔔',
      'Cầu cho tiếng Trống Bát Nhã tiếp thêm hào khí để anh em chinh phục công nghệ mới! 🥁',
      'Xin cho hoa sen trong hai hồ trước sân chùa luôn nở rộ thanh tịnh! 🪷',
      'Cầu cho cá Koi trong Vườn Thiền bơi lội tung tăng mang lại đại cát đại lợi! 🐟',
      'Nam mô cầu cho ai bước qua Cổng Tam Quan này tâm cũng sáng, trí cũng minh! ⛩️',
      'Xin bề trên chứng giám lòng thành của anh em phòng IT, ban cho một năm 0 Bug! 🙏',
      'Cầu cho con lắc ống xăm dưới gốc Đào Tiên rút được quẻ Thượng Thượng Cát! 🎋',
      'Xin độ cho mọi lời ước nguyện trên thẻ đỏ treo cây Đào Tiên đều thành hiện thực! 🌸',
      'Cầu cho cha mẹ và gia đình của toàn thể anh em trong phòng luôn mạnh khỏe, trường thọ! ❤️',
      'Nam mô cầu cho mưa thuận gió hòa, quê hương Đồng Tháp Sen Hồng ngày càng phát triển! 🪷',
      'Xin phù hộ cho công cuộc chuyển đổi số tỉnh nhà gặt hái nhiều thành tựu rực rỡ! 🏆',
      'Cầu cho anh em đi làm mỗi ngày đều là một ngày vui, ngập tràn tiếng cười! 😊',
      'Xin độ cho những buổi chiều tan tầm ngồi quán nhậu vỉa hè luôn rôm rả tình anh em! 🍻',
      'Cầu cho mỗi lần vào phòng Karaoke VIP ca hát đều xả sạch 100% căng thẳng! 🎤',
      'Nam mô cầu cho chú chó Boss Corgi của văn phòng luôn béo tròn, ngoan ngoãn! 🐶',
      'Xin cho robot IT-Bot Mini chạy giao trà sữa quanh năm không bao giờ tuột pin! 🤖',
      'Cầu cho mỗi khi gặp bài toán hóc búa đều có quý nhân chỉ điểm thuật toán tối ưu! 🧠',
      'Xin bề trên độ cho trí nhớ minh mẫn, nhớ hết mọi phím tắt và câu lệnh CLI! ⌨️',
      'Cầu cho tài khoản GitHub của anh em phủ kín một màu xanh lá cây chăm chỉ! 🟩',
      'Nam mô cầu cho mọi nhánh code đều hội tụ bình an về nhánh main không chút gợn! 🌿',
      'Xin phù hộ cho bản cập nhật đẩy lên GitHub Pages hiển thị tức thì không dính cache! ⚡',
      'Cầu cho ai vào thăm Văn Phòng IT 3D này cũng nhận được thật nhiều niềm vui và may mắn! ✨',
      'Xin độ cho phúc lộc thọ toàn, công danh thăng tiến, code mượt như nước chảy mây trôi! 🌊',
      'Cầu cho tâm bất biến giữa dòng đời vạn biến, requirement có đổi vẫn mỉm cười xử đẹp! 😌',
      'Nam mô A Di Đà Phật, cầu cho toàn thể anh em IT bình an, hạnh phúc và đại thành công! 🙏🪷'
    ];

    // =========================================================================
    // 1.2 STRICT ROOM-SPECIFIC DIALOGUE BANKS (9 ZONES - NO CROSS-ROOM QUOTES!)
    // =========================================================================
    const ZONE_QUOTES = {
      // 1. Phòng Trưởng Phòng VIP (boss)
      boss: [
        'Hệ thống .NET 9 + Vue 3 + MongoDB + Redis của phòng mình tuần này đạt 100% KPI! 👑',
        'Màn hình điều hành 100 inch này theo dõi kiến trúc Microservices rõ từng chỉ số! 🖥️',
        'Chuẩn bị duyệt kế hoạch Go-Live và ký quyết định thưởng nóng cho toàn bộ anh em! 💰',
        'Kiến trúc phân quyền CR_UNIT_ROLE & đồng bộ Redis Hash phải thật chuẩn chỉ nhé! 🔑',
        'Engine xuất báo cáo Word Mẫu 2C bằng OpenXml đã sẵn sàng bàn giao nghiệm thu! 📄',
        'Anh em cứ yên tâm cống hiến, cuối tháng Trưởng phòng Minh Đăng thưởng lớn! 👑✨',
        'Báo cáo tiến độ chuyển đổi số tháng này vượt chỉ tiêu trước hạn 5 ngày! 🚀',
        'Trà chiều ở bàn Sofa VIP thơm quá, vừa thưởng trà vừa duyệt Pull Request! 🍵',
        'Đảm bảo hệ thống chịu tải mượt 26.000+ user truy cập đồng thời không độ trễ! ⚡',
        'Tài liệu HDSD xuất chuẩn Nghị định 30 Times New Roman 14pt rất chuyên nghiệp! 📘',
        'Hôm nay ký duyệt xong 3 dự án trọng điểm, tinh thần anh em quá tuyệt vời! 🏆',
        'Phòng Trưởng phòng lúc nào cũng mở cửa đón anh em vào trao đổi giải pháp kỹ thuật! 🤝'
      ],
      // 2. Phòng Họp Kính 120" (meeting)
      meeting: [
        'Mời anh em nhìn lên màn hình 120 inch để chốt sơ đồ kiến trúc Microservices nhé! 📊',
        'Biểu đồ Sprint Burndown tuần này đang bám rất sát kế hoạch bàn giao! 📈',
        'Anh em bật Call Video & Mic WebRTC lên để trao đổi trực tiếp trong Phòng Họp nào! 📹',
        'Bảng Kanban hôm nay đã kéo được 12 task từ In-Progress sang Done rồi! ✅',
        'Thống nhất chuẩn RESTful API trả về JSON đồng nhất cho cả Web và Mobile nha! 🔗',
        'Share màn hình trực tiếp lên TV 120 inch trong phòng họp nhìn nét căng! 🖥️',
        'Sprint này mình ưu tiên tối ưu tốc độ phản hồi API xuống dưới 15ms nhé! ⚡',
        'Ghi biên bản cuộc họp xong nhớ gửi lên nhóm cho cả team cùng nắm tiến độ! 📝',
        'Giải pháp đồng bộ dữ liệu thời gian thực qua WebSockets này quá hợp lý! 🌐',
        'Cuộc họp hôm nay ngắn gọn 15 phút, chốt xong giải pháp là ra code ngay! ⏱️',
        'Các chỉ số KPI Uptime 99.99% trên slide báo cáo nhìn thuyết phục thực sự! 🏆',
        'Anh em Product Manager với Solution Architect chốt xong luồng nghiệp vụ chưa? 🤝',
        'Phòng họp kính cách âm tốt thật, thảo luận kiến trúc hệ thống cực kỳ tập trung! 💡',
        'Đổi sang Slide tiếp theo để xem thống kê hiệu năng cụm Database tuần qua nào! ⏭️'
      ],
      // 3. Khu Lập Trình / Dev Zone (dev)
      dev: [
        'Code chạy trên máy tui ngon lành, build .NET 9 sạch bóng 0 Warning 0 Error! 💻',
        'Ai rảnh vào review Pull Request giùm tui với, mới tối ưu lại tầng Service gọn lắm! 🙏',
        'Cấu trúc .NET 9 kết hợp MongoDB với Redis Hash chạy nhanh xé gió! ⚡',
        'Mới đánh lại cái Compound Index trên MongoDB, tốc độ query giảm từ 2s xuống 3ms! 🍃',
        'Kiểm tra kỹ Dependency Injection trong Program.cs rồi, chạy lên mượt mà! ⚙️',
        'Xuất báo cáo Word Mẫu 2C bằng OpenXml chuẩn từng dòng, không lệch 1 milimet! 📄',
        'Giao diện Vue 3 Vite mới lên hiệu ứng Glassmorphism nhìn sang xịn mịn quá! ✨',
        'Đừng sửa trực tiếp trên nhánh main nha, tạo feature branch đàng hoàng đi! 🌿',
        'Hôm nay chạy bộ test Postman xanh lè 100% Pass ngay lần đầu, sướng rơn! ✅',
        'Quyết tâm viết Clean Code, tách riêng Interface và Service rõ ràng! 🛡️',
        'Docker container build xong rồi, chuẩn bị đẩy bản mới lên môi trường Staging! 🐳',
        'Nhớ cập nhật lại Postman Collection sau khi thêm API mới nha anh em! 📮',
        'Màn hình đôi ở bàn Dev vừa mở VS Code vừa xem log Terminal tiện thật sự! 🖥️',
        'Phân quyền DataAccess với Authorize trên Controller đã rào kín mọi trường hợp! 🔒',
        'Anh em nhớ Clear Cache trình duyệt Ctrl+F5 sau khi pull bản Frontend mới nhé! 🔄',
        'Viết câu truy vấn Aggregation Pipeline xử lý 26.000 bản ghi chạy trong chớp mắt! 🚀',
        'Fix xong cái bug bất đồng bộ async/await này là hoàn thành trọn vẹn task hôm nay! 🔥',
        'Bàn phím cơ gõ êm tay quá, code một mạch từ sáng tới giờ không biết mệt! ⌨️'
      ],
      // 4. Phòng Server / Data Center (server)
      server: [
        'Nhiệt độ 4 tủ Rack Server đang duy trì ổn định ở mức 18°C mát lạnh! ❄️',
        'Cụm MongoDB ReplicaSet và Redis Cluster đang đồng bộ 100% không rớt gói tin nào! 🖥️',
        'Đèn LED xanh trên tủ Rack #01 và #02 nhấp nháy đều đặn, băng thông rất mượt! 🟢',
        'Bật chế độ Turbo Cooling làm mát máy chủ để đảm bảo Uptime 99.9999%! ⚡',
        'Đã kiểm tra xong bản sao lưu Backup Database tự động sáng nay, an toàn tuyệt đối! 💾',
        'Tường lửa Firewall và chứng chỉ bảo mật SSL trên cụm Server hoạt động hoàn hảo! 🔒',
        'Ổ cứng NVMe RAID 10 trên tủ Rack #03 tốc độ đọc ghi IOPS cao ngất ngưởng! 💽',
        'Đường truyền cáp quang专线 vào phòng Server hôm nay ping chỉ có 1ms! 🌐',
        'CPU và RAM của 16 node máy chủ Production vẫn còn dư hơn 65% tài nguyên! 📊',
        'Cửa kính bảo mật phòng Server luôn kiểm soát chặt chẽ, mát rượi cả căn phòng! 🔐'
      ],
      // 5. Khu Pantry & Lounge / Arcade (pantry)
      pantry: [
        'Cà phê Espresso mới pha thơm lừng cả góc Pantry, uống một ngụm tỉnh táo hẳn! ☕',
        'Làm ly trà sữa mát lạnh nạp lại 100% năng lượng trước khi quay về bàn code! 🧋',
        'Ra ghế Sofa khu Lounge ngả lưng 5 phút cho giãn cột sống êm quá anh em ơi! 🛋️',
        'Máy game thùng Arcade cổ điển này chơi cuốn thật, sắp phá kỷ lục điểm cao rồi! 🕹️',
        'Tủ lạnh Pantry hôm nay đầy ắp nước trái cây với bánh ngọt luôn! 🍰',
        'Ngồi ở quầy Bar gỗ uống cà phê ngắm cây xanh trong văn phòng thư thái ghê! 🌿',
        'Ai uống Espresso hay Cappuccino để tui bấm máy pha luôn một thể nào! ☕✨',
        'Giải lao 10 phút ở khu Lounge nói chuyện phiếm xong tinh thần phấn chấn hẳn! 😊',
        'Bánh Pizza nóng hổi ở bàn Pantry thơm quá, làm một miếng lấy sức nào! 🍕',
        'Góc Pantry & Lounge thiết kế sàn gỗ ấm cúng như quán cà phê thứ thiệt! 🏡'
      ],
      // 6. Sảnh Lễ Tân & Hành Lang Trung Tâm (central)
      central: [
        'Chào mừng mọi người đến với Văn Phòng IT 3D Interactive Studio! 👋✨',
        'Chú chó Boss Corgi chạy lon ton ở sảnh trung tâm nhìn cưng xỉu luôn kìa! 🐶',
        'Robot IT-Bot Mini đang đi tuần tra giao trà sữa quanh hành lang trung tâm! 🤖🧋',
        'Sảnh lễ tân hôm nay sáng sủa, cây xanh tươi mát tràn đầy sinh khí! 🏢',
        'Từ sảnh trung tâm này đi sang Phòng Họp, Khu Dev hay Phòng Server đều tiện! 🚶',
        'Quầy lễ tân lúc nào cũng sẵn sàng đón tiếp khách hàng và đối tác đến làm việc! 🤝',
        'Anh em đi ngang qua sảnh nhớ vẫy tay chào nhau một câu cho ngày mới rộn ràng nhé! 😊',
        'Không gian mở ở sảnh trung tâm thoáng đãng thật, đi bộ dạo quanh rất thích! 🌟'
      ],
      // 7. Phòng Hát Karaoke VIP (karaoke)
      karaoke: [
        'Cho tui xin bài Cắt Đôi Nỗi Sầu, cắt luôn nỗi đau fix bug! 🎤',
        'Giọng ca vàng làng lập trình lên sân khấu lĩnh xướng đây! 🎶',
        'Bấm ưu tiên bài Đắp Mộ Cuộc Tình nhạc sống Beat 3D giùm tui với! 🎵',
        'Quẩy nhiệt lên anh em ơi, bật đèn Strobe chớp chớp cho cháy! 🔥',
        'Bấm chấm điểm 100đ và bắn pháo giấy cổ vũ ca sĩ trên sân khấu đi! 💯🎉',
        'Hát cho quên hết mọi ưu phiền, mai lên văn phòng tinh thần phơi phới! 🎤✨',
        'Ai bấm còi hơi DJ Pờ Rèn Pờ Rèn trong phòng hát nghe sung quá vậy! 📢',
        'Lên sân khấu song ca bài Nối Vòng Tay Lớn nào anh em ơi! 🤝🎶',
        'Dàn loa KTV VIP 999 này đập bass căng đét, cách âm tuyệt đối! 🔊',
        'Chiếu video lên màn hình TV Karaoke 3D hát nhạc trẻ cực mượt luôn! 📺',
        'Đứng trên bục sân khấu tròn có vòng đèn Neon hồng nhìn như ca sĩ chuyên nghiệp! 🌟',
        'Bấm chọn bài trên Đầu Cảm Ứng KTV Pro nhạy thật, đủ cả 6 bài Hit! 🎵'
      ],
      // 8. Quán Nhậu Vỉa Hè & Lò BBQ (nhau)
      nhau: [
        '1... 2... 3... DZÔ!! Không say không về anh em ơi! 🍻',
        'Trưởng phòng Minh Đăng bao hết tăng này nha!! 100% nào! 👑🍺',
        'Mực nướng BBQ than hồng thơm nức mũi, làm miếng mồi bén đi! 🦑🔥',
        'Uống cốc bia hơi mát lạnh cho sảng khoái sau giờ làm việc! 😋',
        'Chủ quán ơi cho thêm 1 tháp bia lạnh và 2 đĩa bò tảng nướng nữa! 🥩',
        'Ngồi bàn inox ghế nhựa vỉa hè cụng ly là chuẩn bài nhất! 🥂',
        'Chúc mừng hệ thống vận hành mượt mà, nâng ly chúc sức khỏe cả bàn! 🎉',
        'Ai đang ngồi ở bàn bia hơi chưa hết ly thì tự giác trăm phần trăm nhé! 🍺',
        'Bia hơi hôm nay mát lạnh ngọt lịm, đúng là bia Sếp khao có khác! 🍻',
        'Trở tay xiên thịt trên lò nướng BBQ kẻo cháy xiên ba chỉ bò kìa! 🍢',
        'Gió vỉa hè mát rượi, tiếng cụng ly KENG KENG nghe vui tai thực sự! 🌬️',
        'KENG!! Chúc anh em năm nay lương thưởng gấp đôi, dự án nào cũng thắng lớn! 💰'
      ],
      // 9. Quần Thể Chùa Linh Ứng & Hồ Koi (chua)
      chua: TEMPLE_PRAYERS
    };

    const IT_QUOTES = ZONE_QUOTES.dev;
    const NHAU_QUOTES = ZONE_QUOTES.nhau;
    const KARAOKE_QUOTES = ZONE_QUOTES.karaoke;

    const quoteShuffleBags = {};
    function pickNextQuote(list, bagKey = 'default') {
      if (!list || list.length === 0) return '';
      if (!quoteShuffleBags[bagKey] || quoteShuffleBags[bagKey].length === 0) {
        const indices = list.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        quoteShuffleBags[bagKey] = indices;
      }
      return list[quoteShuffleBags[bagKey].pop()];
    }

    function pickZoneQuoteForCharacter(charObj) {
      if (!charObj || !charObj.rig || !charObj.rig.root) {
        return pickNextQuote(ZONE_QUOTES.central, 'zone_central');
      }
      const pos = charObj.rig.root.position;
      const zn = getRoomZone(pos.x, pos.z);
      const bank = ZONE_QUOTES[zn] || ZONE_QUOTES.central;
      return pickNextQuote(bank, 'zone_' + zn);
    }

    // =========================================================================
    // 2. AUDIO SYNTHESIS & PROCEDURAL CANVAS TEXTURES
    // =========================================================================
    function playSynthTone(freq, duration = 0.12, type = 'sine', volume = 0.08) {
      if (!state.soundEnabled || state.masterVolume <= 0.001) return;
      try {
        if (!audioCtx) {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (AudioCtor) audioCtx = new AudioCtor();
        }
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const effectiveVol = Math.min(0.65, volume * state.masterVolume);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(effectiveVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {
        // Ignore audio errors on restricted devices
      }
    }

    function playDonationSound() {
      playSynthTone(880, 0.09, 'sine', 0.16);
      setTimeout(() => playSynthTone(1318.5, 0.18, 'triangle', 0.18), 80);
      setTimeout(() => playSynthTone(1760, 0.25, 'sine', 0.16), 160);
    }

    function playWoodenFishSound() {
      // Tiếng mõ gỗ chùa (Cốc... cốc...)
      playSynthTone(740, 0.045, 'triangle', 0.18);
      playSynthTone(1480, 0.025, 'sine', 0.10);
    }

    function playTempleBellSound(silentToast = false) {
      // Tiếng Đại Hồng Chung (Chuông đồng chùa ngân trầm ấm đa họa âm)
      if (state.soundEnabled && state.masterVolume > 0.001) {
        try {
          if (!audioCtx) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (AudioCtor) audioCtx = new AudioCtor();
          }
          if (audioCtx) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const now = audioCtx.currentTime;
            // Fundamental + Metallic Bronze Harmonics
            const partials = [
              { freq: 196.0, amp: 0.28, decay: 2.8 },
              { freq: 392.0, amp: 0.18, decay: 2.2 },
              { freq: 587.3, amp: 0.12, decay: 1.6 },
              { freq: 830.6, amp: 0.08, decay: 1.1 },
              { freq: 1174.7, amp: 0.05, decay: 0.65 }
            ];
            partials.forEach(p => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(p.freq, now);
              const vol = Math.min(0.65, p.amp * state.masterVolume);
              gain.gain.setValueAtTime(vol, now);
              gain.gain.exponentialRampToValueAtTime(0.0008, now + p.decay);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start(now);
              osc.stop(now + p.decay);
            });
          }
        } catch (e) {}
      }

      // Kèm 2 nhịp gõ mõ gỗ sau tiếng chuông
      setTimeout(() => playWoodenFishSound(), 420);
      setTimeout(() => playWoodenFishSound(), 820);

      // Lắc quả chuông 3D và tạo vòng sóng âm ánh vàng lan tỏa
      templeBellSwing = 1.0;
      incenseActiveTimer = Math.max(incenseActiveTimer, 22);

      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.03, 8, 32),
          new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.88 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(25.2, 2.25, 3.8);
        ring.userData = { age: -i * 0.22, maxAge: 1.6 };
        scene.add(ring);
        bellWaveRings.push(ring);
      }

      if (!silentToast) {
        showToast('🔔 BOONG...!! Tiếng Đại Hồng Chung ngân vang, xua tan mọi Bug Production! 🙏');
      }
    }

    function triggerMassTemplePrayers() {
      playWoodenFishSound();
      setTimeout(() => playWoodenFishSound(), 240);
      officeCharacters.forEach((c, idx) => {
        const z = getRoomZone(c.rig.root.position.x, c.rig.root.position.z);
        if (z === 'chua' || idx < 8) {
          const line = TEMPLE_PRAYERS[Math.floor(Math.random() * TEMPLE_PRAYERS.length)];
          showCharacterSpeech(c, line, 5.5);
        }
      });
      showToast('🙏 Cả đoàn đồng thanh dâng lời cầu khấn tâm linh!');
    }

    function playAirhornSound() {
      [587.3, 622.3, 880].forEach(f => playSynthTone(f, 0.18, 'sawtooth', 0.12));
      setTimeout(() => [587.3, 622.3, 880].forEach(f => playSynthTone(f, 0.18, 'sawtooth', 0.12)), 160);
      setTimeout(() => [587.3, 622.3, 880].forEach(f => playSynthTone(f, 0.42, 'sawtooth', 0.15)), 320);
      showToast('📢 PỜ RÈN PỜ RÈN!! Còi hơi DJ khuấy động Phòng Hát VIP! 🔥');
    }

    function spawnKaraokeConfetti(count = 36) {
      const colors = [0xec4899, 0x38bdf8, 0xfacc15, 0x4ade80, 0xa855f7, 0xf43f5e];
      for (let i = 0; i < count; i++) {
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.015, 0.05),
          new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
        );
        piece.position.set(
          15.9 + (Math.random() - 0.5) * 3.8,
          3.4 + Math.random() * 0.8,
          -3.6 + (Math.random() - 0.5) * 3.8
        );
        piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        piece.userData = {
          vx: (Math.random() - 0.5) * 0.9,
          vy: 0.7 + Math.random() * 0.8,
          vz: (Math.random() - 0.5) * 0.9,
          life: 2.6 + Math.random() * 1.2
        };
        scene.add(piece);
        confettiParticles.push(piece);
      }
    }

    function triggerKaraokeScore() {
      const scores = [96, 98, 99, 100];
      const comments = [
        'GIỌNG CA VÀNG LÀNG CODE! Hát hay hơn cả lúc fix bug!',
        'CA SĨ CHUYÊN NGHIỆP! Sếp thưởng nóng 1 thùng bia!',
        'ĐỈNH KOUT 100 ĐIỂM! Quên hết mọi deadline!',
        'TUYỆT ĐỈNH SONG CA! Cả phòng vỗ tay rần rần!'
      ];
      const idx = Math.floor(Math.random() * scores.length);
      state.karaokeScore = scores[idx];
      state.karaokeScoreComment = comments[idx];
      state.karaokeScoreTimer = 5.5;

      // Fanfare celebration sound
      [523.3, 659.3, 784.0, 1046.5].forEach((freq, i) => {
        setTimeout(() => playSynthTone(freq, 0.22, 'triangle', 0.16), i * 110);
      });
      spawnKaraokeConfetti(48);

      officeCharacters.forEach((c, i) => {
        if (getRoomZone(c.rig.root.position.x, c.rig.root.position.z) === 'karaoke' && i % 2 === 0) {
          showCharacterSpeech(c, `Trời ơi ${state.karaokeScore} điểm luôn!! Quá đỉnh! 🏆👏`, 4.5);
        }
      });

      if (karaokeScreenObj) {
        drawKaraokeCanvas(karaokeScreenObj.ctx, 512, 256, true, simElapsed);
        karaokeScreenObj.tex.needsUpdate = true;
      }
      showToast(`💯 Máy chấm điểm KTV: ${state.karaokeScore}/100 ĐIỂM! ${state.karaokeScoreComment}`);
    }

    function formatVND(amount) {
      return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
    }

    function spawnDonationMoney(amount = 500000, donorName = 'Trưởng phòng Minh Đăng') {
      state.donationTotal += amount;
      state.donationCount += 1;
      playDonationSound();
      if (amount >= 2000000) {
        playTempleBellSound(true);
      }
      incenseActiveTimer = Math.max(incenseActiveTimer, 22);

      // Spawn 3D falling banknotes & gold ingots dropping into the Donation Box slot (17.85, 0.94, 5.2)
      const billColors = [0x06b6d4, 0x22c55e, 0xfacc15, 0xf59e0b];
      const count = amount >= 5000000 ? 22 : (amount >= 1000000 ? 12 : 6);
      for (let i = 0; i < count; i++) {
        const isGoldBar = amount >= 2000000 && i % 3 === 0;
        const note = new THREE.Mesh(
          isGoldBar ? new THREE.BoxGeometry(0.14, 0.045, 0.07) : new THREE.BoxGeometry(0.18, 0.014, 0.09),
          new THREE.MeshStandardMaterial({
            color: isGoldBar ? 0xfacc15 : billColors[i % billColors.length],
            emissive: isGoldBar ? 0xd97706 : billColors[i % billColors.length],
            emissiveIntensity: isGoldBar ? 0.65 : 0.38,
            metalness: isGoldBar ? 0.85 : 0.1,
            roughness: isGoldBar ? 0.2 : 0.6
          })
        );
        const spread = amount >= 5000000 ? 0.65 : 0.25;
        note.position.set(33.6 + (Math.random() - 0.5) * spread, 1.65 + i * 0.11, 5.2 + (Math.random() - 0.5) * spread);
        note.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);
        note.userData = { vy: 0.75 + Math.random() * 0.45, life: 1.8 };
        scene.add(note);
        donationNotes.push(note);
      }
      showToast(`💵 ${donorName} vừa công đức ${formatVND(amount)}! (Tổng quỹ Chùa: ${formatVND(state.donationTotal)}) 🙏`);
      updateInspectorUI();
    }

    function createConcreteTexture() {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(100,116,139,0.08)' : 'rgba(255,255,255,0.09)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.14)';
      ctx.lineWidth = 1;
      for (let p = 0; p < 256; p += 64) {
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 6);
      return tex;
    }

    function createWoodFloorTexture() {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#b08968';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32) {
        ctx.fillStyle = y % 64 === 0 ? 'rgba(127, 85, 57, 0.18)' : 'rgba(230, 204, 178, 0.12)';
        ctx.fillRect(0, y, 256, 30);
        ctx.strokeStyle = 'rgba(88, 54, 34, 0.25)';
        ctx.strokeRect(0, y, 256, 32);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      return tex;
    }

    function createServerFloorTexture() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
      ctx.strokeRect(65, 65, 62, 62);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      return tex;
    }

    function createSignTexture(title, subtitle, bg = '#0f172a', titleCol = '#facc15', subCol = '#f8fafc') {
      const c = document.createElement('canvas');
      c.width = 768; c.height = 190;
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 768, 190);
      ctx.strokeStyle = titleCol;
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 752, 174);
      ctx.textAlign = 'center';

      // Auto-scale title font so long Vietnamese text NEVER gets clipped at left/right edges
      let tSize = 44;
      ctx.font = `bold ${tSize}px Inter, sans-serif`;
      while (ctx.measureText(title).width > 704 && tSize > 20) {
        tSize -= 2;
        ctx.font = `bold ${tSize}px Inter, sans-serif`;
      }
      ctx.fillStyle = titleCol;
      ctx.fillText(title, 384, 88, 708);

      let sSize = 24;
      ctx.font = `bold ${sSize}px Inter, sans-serif`;
      while (ctx.measureText(subtitle).width > 704 && sSize > 13) {
        sSize -= 1;
        ctx.font = `bold ${sSize}px Inter, sans-serif`;
      }
      ctx.fillStyle = subCol;
      ctx.fillText(subtitle, 384, 142, 708);
      return new THREE.CanvasTexture(c);
    }

    function drawBossMonitorCanvas(ctx, w, h, t) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Header
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, 40);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('👑 TRUNG TÂM ĐIỀU HÀNH • TRƯỞNG PHÒNG MINH ĐĂNG', 14, 25);

      // 3 KPI Cards (.NET 9 API, MongoDB Cluster, Redis Cache)
      const cards = [
        { title: '.NET 9 WEB API', val: '99.99% UP', sub: '1,420 req/s', col: '#38bdf8' },
        { title: 'MONGODB CLUSTER', val: '26,907 USERS', sub: 'Query: 0.8ms', col: '#4ade80' },
        { title: 'REDIS HASH CACHE', val: 'CR_UNIT_ROLE', sub: 'Hit: 99.4%', col: '#f472b6' }
      ];
      cards.forEach((c, i) => {
        const cx = 14 + i * 164;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(cx, 52, 152, 74);
        ctx.strokeStyle = c.col;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, 52, 152, 74);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(c.title, cx + 10, 72);
        ctx.fillStyle = c.col;
        ctx.font = 'bold 17px Inter, sans-serif';
        ctx.fillText(c.val, cx + 10, 96);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px monospace';
        ctx.fillText(c.sub, cx + 10, 115);
      });

      // Live Real-time Traffic Wave Chart
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(14, 138, w - 28, 104);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const px = 22 + i * 19.5;
        const py = 195 + Math.sin(t * 3.2 + i * 0.45) * 26 + Math.cos(t * 1.8 + i) * 10;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('🖥️ Bấm "Share Màn Hình Máy Tính" để chiếu trực tiếp màn hình PC của bạn lên đây!', 22, 230);
    }

    async function startBossScreenShare() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showToast('⚠️ Trình duyệt không hỗ trợ chia sẻ màn hình trực tiếp!');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true
        });
        if (bossShareStream) {
          bossShareStream.getTracks().forEach(tr => tr.stop());
        }
        bossShareStream = stream;
        if (!bossShareVideo) {
          bossShareVideo = document.createElement('video');
          bossShareVideo.muted = true;
          bossShareVideo.playsInline = true;
        }
        bossShareVideo.srcObject = stream;
        await bossShareVideo.play().catch(() => {});

        bossVideoTexture = new THREE.VideoTexture(bossShareVideo);
        bossVideoTexture.colorSpace = THREE.SRGBColorSpace;
        const liveMat = new THREE.MeshBasicMaterial({ map: bossVideoTexture });
        bossScreenMeshes.forEach(mesh => {
          mesh.material = liveMat;
        });
        bossScreenSharing = true;

        stream.getVideoTracks()[0].addEventListener('ended', () => {
          stopBossScreenShare();
        });

        goToCameraPreset('boss');
        showToast('🖥️ Đã chiếu trực tiếp màn hình máy tính bên ngoài lên toàn bộ màn hình Phòng Sếp Minh Đăng!');
        updateInspectorUI();
      } catch (err) {
        showToast('ℹ️ Đã hủy chọn màn hình chia sẻ.');
      }
    }

    function stopBossScreenShare() {
      if (bossShareStream) {
        bossShareStream.getTracks().forEach(tr => tr.stop());
        bossShareStream = null;
      }
      if (bossShareVideo) {
        bossShareVideo.pause();
        bossShareVideo.srcObject = null;
      }
      bossScreenSharing = false;
      if (bossScreenObj && bossScreenObj.mat) {
        bossScreenMeshes.forEach(mesh => {
          mesh.material = bossScreenObj.mat;
        });
      }
      showToast('⏹ Đã tắt chiếu màn hình ngoài, quay về Dashboard điều hành của Sếp Đăng.');
      updateInspectorUI();
    }

    function drawDevMonitorCanvas(ctx, w, h, mode, t, seed) {
      if (state.activeEvent === 'crash') {
        const flash = Math.sin(t * 14 + seed) > 0;
        ctx.fillStyle = flash ? '#450a0a' : '#1f0505';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('502 BAD GATEWAY', 18, 46);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '12px monospace';
        ctx.fillText('FATAL: PROD DB DOWN', 18, 72);
        ctx.fillText('RETRYING CLUSTER...', 18, 92);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(18, 108, ((t * 90 + seed * 30) % (w - 36)), 10);
        return;
      }

      if (mode === 3) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);
        return;
      }

      if (mode === 0) {
        // Live VS Code IDE
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 32, h);
        ctx.fillRect(0, 0, w, 16);
        const colors = ['#38bdf8', '#a78bfa', '#4ade80', '#f472b6', '#fbbf24'];
        const scroll = Math.floor(t * 2.5 + seed * 5);
        for (let i = 0; i < 8; i++) {
          const lineIdx = (i + scroll) % 12;
          const indent = (lineIdx % 3) * 14;
          const len = 35 + ((lineIdx * 27 + seed * 19) % 110);
          ctx.fillStyle = colors[(lineIdx + seed) % colors.length];
          ctx.fillRect(42 + indent, 26 + i * 13, len, 6);
        }
        // Blinking cursor
        if (Math.floor(t * 3) % 2 === 0) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(42 + ((scroll % 3) * 14) + 55, 26 + 5 * 13, 6, 8);
        }
      } else if (mode === 1) {
        // Live Telemetry Dashboard
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('LIVE K8S METRICS', 12, 20);
        for (let i = 0; i < 10; i++) {
          const bh = 20 + Math.abs(Math.sin(t * 3 + i * 0.7 + seed)) * 68;
          ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#818cf8';
          ctx.fillRect(14 + i * 22, h - 18 - bh, 14, bh);
        }
      } else {
        // Terminal Build Logs
        ctx.fillStyle = '#05080f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#4ade80';
        ctx.font = '11px monospace';
        const step = Math.floor(t * 2 + seed) % 4;
        ctx.fillText('$ npm run deploy:prod', 10, 24);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('> Building bundles...', 10, 44);
        ctx.fillText(`> Tests passed: ${42 + step}/42`, 10, 64);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('> Docker image pushed', 10, 84);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(step % 2 === 0 ? '> Status: HEALTHY ✔' : '> Status: LIVE 🚀', 10, 108);
      }
    }

    function drawMeetingCanvas(ctx, w, h, slideIdx, t) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, 40);

      const titles = [
        'KIẾN TRÚC MICROSERVICES (LIVE)',
        'SPRINT 24 BURNDOWN CHART',
        'BẢNG KANBAN TEAM IT LAB',
        'KPI HỆ THỐNG & UPTIME 99.99%'
      ];
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText(titles[slideIdx % 4], 20, 26);

      if (slideIdx % 4 === 0) {
        // Microservices nodes + moving packets
        const nodes = [
          { x: 80, y: 140, label: 'API GW', col: '#0284c7' },
          { x: 240, y: 95, label: 'Auth Svc', col: '#7c3aed' },
          { x: 240, y: 185, label: 'Order Svc', col: '#059669' },
          { x: 410, y: 140, label: 'Postgres', col: '#d97706' }
        ];
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        [[0,1],[0,2],[1,3],[2,3]].forEach(([a,b]) => {
          ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke();
          const p = (t * 0.7) % 1;
          const px = nodes[a].x + (nodes[b].x - nodes[a].x) * p;
          const py = nodes[a].y + (nodes[b].y - nodes[a].y) * p;
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        });
        nodes.forEach(n => {
          ctx.fillStyle = n.col;
          ctx.fillRect(n.x - 44, n.y - 22, 88, 44);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + 5);
        });
        ctx.textAlign = 'left';
      } else if (slideIdx % 4 === 1) {
        // Sprint chart
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(50, 60); ctx.lineTo(50, 220); ctx.lineTo(470, 220); ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const x = 50 + i * 50;
          const y = 75 + i * 16 + Math.sin(t * 2 + i) * 6;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (slideIdx % 4 === 2) {
        // Kanban columns
        ['TO DO', 'IN PROGRESS', 'REVIEW', 'DONE'].forEach((col, i) => {
          const cx = 22 + i * 120;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(cx, 56, 108, 180);
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(col, cx + 10, 74);
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = i === 3 ? '#10b981' : (i === 1 ? '#38bdf8' : '#6366f1');
            ctx.fillRect(cx + 8, 86 + k * 44, 92, 34);
          }
        });
      } else {
        // KPI Bars
        const kpis = [
          { label: 'CPU', val: 0.45 + Math.sin(t * 2) * 0.1, col: '#38bdf8' },
          { label: 'RAM', val: 0.68 + Math.cos(t * 1.5) * 0.06, col: '#a855f7' },
          { label: 'SLA', val: 0.99, col: '#22c55e' },
          { label: 'DEPLOY', val: 0.86, col: '#f59e0b' }
        ];
        kpis.forEach((k, i) => {
          const bx = 55 + i * 110;
          const bh = k.val * 140;
          ctx.fillStyle = k.col;
          ctx.fillRect(bx, 210 - bh, 56, bh);
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(k.label, bx + 4, 232);
        });
      }
    }

    function drawArcadeCanvas(ctx, w, h, isPlaying, t) {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      if (!isPlaying) {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INSERT COIN', w / 2, h / 2);
        ctx.textAlign = 'left';
        return;
      }
      // Space invaders style animation
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          const ax = 20 + c * 26 + Math.sin(t * 2.5) * 10;
          const ay = 18 + r * 20;
          ctx.fillStyle = r === 0 ? '#f43f5e' : (r === 1 ? '#facc15' : '#38bdf8');
          ctx.fillRect(ax, ay, 14, 10);
        }
      }
      const px = w / 2 + Math.sin(t * 3.2) * 48;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(px - 10, h - 22, 20, 10);
      const ly = h - 30 - ((t * 160) % (h - 35));
      ctx.fillRect(px - 2, ly, 4, 10);
    }

    function drawKaraokeCanvas(ctx, w, h, isSinging, t) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e0b36');
      grad.addColorStop(0.5, '#3b0764');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Top Header Bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, 0, w, 46);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 46); ctx.lineTo(w, 46); ctx.stroke();

      const bars = 28;
      for (let i = 0; i < bars; i++) {
        const activeMusic = isSinging || state.beatPlaying || state.youtubePlaying;
        const bh = activeMusic ? (16 + Math.abs(Math.sin(t * 7.2 + i * 0.55)) * 74) : (8 + Math.abs(Math.sin(t * 2 + i)) * 16);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(236, 72, 153, 0.48)' : (i % 3 === 1 ? 'rgba(56, 189, 248, 0.48)' : 'rgba(250, 204, 21, 0.42)');
        ctx.fillRect(10 + i * 17.6, h - bh, 12, bh);
      }

      // Score Celebration Overlay (when user clicks "💯 Chấm điểm")
      if (state.karaokeScoreTimer > 0 && state.karaokeScore) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        ctx.fillRect(28, 54, w - 56, h - 74);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 54, w - 56, h - 74);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText('🏆 KẾT QUẢ CHẤM ĐIỂM KARAOKE VIP 🏆', w / 2, 88);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 54px Inter, sans-serif';
        ctx.fillText(`${state.karaokeScore} ĐIỂM`, w / 2, 146);

        ctx.fillStyle = '#f472b6';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText(state.karaokeScoreComment, w / 2, 178);
        ctx.textAlign = 'left';
        return;
      }

      const preset = SONG_PRESETS[state.currentSongKey] || SONG_PRESETS['cat-doi'];
      const displayTitle = state.karaokeMode === 'beat' ? preset.title : state.currentSongTitle;

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🎤 KTV VIP 3D • ${displayTitle.slice(0, 32)}`, w / 2, 29);

      if (state.youtubePlaying && state.karaokeMode === 'iframe') {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 21px Inter, sans-serif';
        ctx.fillText(state.currentSongTitle.slice(0, 34), w / 2, 112);
        ctx.fillStyle = '#f472b6';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(`🔊 Âm lượng ${Math.round(state.masterVolume * 100)}% • Đang phát trình chiếu ngoài`, w / 2, 152);
        ctx.textAlign = 'left';
        return;
      }

      const lyrics = preset.lyrics;
      const idx = Math.floor(t / 4.2) % lyrics.length;
      const line1 = lyrics[idx][0];
      const line2 = lyrics[idx][1];

      // Line 1 with real-time karaoke color fill sweep
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(line1, w / 2, 114);

      const sweep = ((t % 4.2) / 4.2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(24, 88, (w - 48) * sweep, 38);
      ctx.clip();
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(line1, w / 2, 114);
      ctx.restore();

      // Line 2
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillStyle = '#f472b6';
      ctx.fillText(line2, w / 2, 156);

      // Bottom status ticker
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(state.beatPlaying || isSinging ? '🎶 ĐANG PHÁT BEAT NHẠC SỐNG • BẤM CHẤM ĐIỂM ĐỂ NHẬN 100Đ' : '⏸ BẤM CHỌN BÀI ĐỂ LÊN NHẠC', w / 2, 194);
      ctx.textAlign = 'left';
    }

    // =========================================================================
    // 3. SHARED MATERIALS & HELPERS
    // =========================================================================
    let mats = {};

    function initMaterials() {
      mats = {
        concreteFloor: new THREE.MeshStandardMaterial({ map: createConcreteTexture(), roughness: 0.78, metalness: 0.05 }),
        woodFloor: new THREE.MeshStandardMaterial({ map: createWoodFloorTexture(), roughness: 0.65 }),
        serverFloor: new THREE.MeshStandardMaterial({ map: createServerFloorTexture(), roughness: 0.5, metalness: 0.2 }),
        wallLight: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 }),
        wallDark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }),
        wallYellow: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.75 }),
        woodDesk: new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.55 }),
        darkMetal: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 }),
        matteBlack: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.85 }),
        ceramicWhite: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
        glass: new THREE.MeshPhysicalMaterial({
          color: 0xbae6fd, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide
        }),
        fabricGray: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }),
        plantGreen: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }),
        potTerra: new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 })
      };
    }

    function enableShadows(group) {
      group.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }

    function registerInteractive(object3D, meta) {
      object3D.userData.interactiveMeta = meta;
      object3D.traverse(child => {
        if (child.isMesh) {
          child.userData.interactiveRoot = object3D;
        }
      });
      interactiveObjects.push(object3D);
    }

    function createPlant(x, z, scale = 1) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.2 * scale, 0.42 * scale, 12), mats.potTerra);
      pot.position.y = 0.21 * scale;
      g.add(pot);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * scale, 0), mats.plantGreen);
        const ang = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(ang) * 0.14 * scale, (0.58 + (i % 2) * 0.22) * scale, Math.sin(ang) * 0.14 * scale);
        g.add(leaf);
      }
      return g;
    }

    function createOfficeChair(x, z, rotY = 0) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8), mats.darkMetal);
      base.position.y = 0.05;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8), mats.chrome);
      stem.position.y = 0.26;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), mats.matteBlack);
      seat.position.y = 0.46;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.07), mats.fabricGray);
      back.position.set(0, 0.78, -0.22);
      g.add(base, stem, seat, back);
      return g;
    }

    // =========================================================================
    // 4. BUILD ARCHITECTURE & OFFICE ZONES
    // =========================================================================
    function buildArchitecture() {
      const arch = new THREE.Group();

      // Main Concrete Floor (24 x 18, centered at 0,0)
      const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 18), mats.concreteFloor);
      mainFloor.position.set(0, -0.15, 0);
      arch.add(mainFloor);

      // Wood Floor for Pantry & Lounge (X: 2 -> 11.8, Z: -8.8 -> 1.0)
      const pantryFloor = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.04, 9.8), mats.woodFloor);
      pantryFloor.position.set(6.9, 0.02, -3.9);
      arch.add(pantryFloor);

      // Dark Raised Floor for Server Room (X: 5.5 -> 11.8, Z: 2.2 -> 8.8)
      const srvFloor = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.04, 6.6), mats.serverFloor);
      srvFloor.position.set(8.65, 0.02, 5.5);
      arch.add(srvFloor);

      // Back Wall (Meeting + Pantry)
      const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(14.6, 4.2, 0.3), mats.wallLight);
      backWallLeft.position.set(-4.7, 2.1, -9);
      const backWallPantry = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.2, 0.3), mats.wallYellow);
      backWallPantry.position.set(7.25, 2.1, -9);
      arch.add(backWallLeft, backWallPantry);

      // Split Right Wall with doorway passage (Z: -4.4 to -2.2) into Karaoke VIP Room
      const rightWallBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 4.6), mats.wallDark);
      rightWallBack.position.set(12, 2.1, -6.7);
      const rightWallFront = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 11.4), mats.wallDark);
      rightWallFront.position.set(12, 2.1, 3.4);
      const rightWallDoorHeader = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 2.4), mats.wallDark);
      rightWallDoorHeader.position.set(12, 3.5, -3.3);
      arch.add(rightWallBack, rightWallFront, rightWallDoorHeader);

      // Left Window Wall with Doorway Passage (Z: -2.0 to 0.4) into Boss Minh Đăng's Executive Office
      const leftWallBackLow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 7.0), mats.wallLight);
      leftWallBackLow.position.set(-12, 0.425, -5.5);
      const leftWallFrontLow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 8.6), mats.wallLight);
      leftWallFrontLow.position.set(-12, 0.425, 4.7);
      const leftWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 18), mats.wallLight);
      leftWallTop.position.set(-12, 3.92, 0);
      const leftGlassBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 6.8), mats.glass);
      leftGlassBack.position.set(-12, 2.25, -5.5);
      const leftGlassFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 8.4), mats.glass);
      leftGlassFront.position.set(-12, 2.25, 4.7);
      arch.add(leftWallBackLow, leftWallFrontLow, leftWallTop, leftGlassBack, leftGlassFront);

      [-8.8, -4.4, 0.6, 4.6, 8.8].forEach(z => {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.2, 0.18), mats.darkMetal);
        mullion.position.set(-12, 2.1, z);
        arch.add(mullion);
      });

      // Decorative Industrial HVAC Pipes along ceiling back
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 23, 10), mats.matteBlack);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 3.85, -8.5);
      arch.add(pipe);

      // Green Plants in corners
      arch.add(createPlant(-11.2, 7.8, 1.25));
      arch.add(createPlant(-11.2, -2.5, 1.1));
      arch.add(createPlant(1.2, -8.2, 1.2));

      enableShadows(arch);
      scene.add(arch);
    }

    function buildBossOffice() {
      const bGroup = new THREE.Group();

      // Executive Office Wing at X: -18.8 -> -12.15, Z: -4.8 -> +3.2 (center X = -15.5, Z = -0.8)
      const execWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
      const walnutMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.42, metalness: 0.1 });
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.8 });
      const royalCarpetMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.85 });
      const leatherChairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 });

      const floor = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.3, 8.2), mats.woodFloor);
      floor.position.set(-15.5, -0.15, -0.8);
      const carpet = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.03, 5.4), royalCarpetMat);
      carpet.position.set(-15.6, 0.02, -0.8);
      const carpetBorder = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.02, 5.55), goldTrimMat);
      carpetBorder.position.set(-15.6, 0.015, -0.8);
      bGroup.add(floor, carpetBorder, carpet);

      // Brighter Executive Walls + Gold Waist Trim: Back Wall (Z = -4.85), West Wall (X = -18.85), Front Glass Wall (Z = 3.25)
      const backW = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.0, 0.28), execWallMat);
      backW.position.set(-15.5, 2.0, -4.85);
      const westW = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.0, 8.2), execWallMat);
      westW.position.set(-18.85, 2.0, -0.8);
      const westGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 7.8), goldTrimMat);
      westGoldTrim.position.set(-18.69, 3.65, -0.8);
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.6, 0.08), mats.glass);
      frontGlass.position.set(-15.5, 1.8, 3.25);
      const frontHeader = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 0.24), mats.darkMetal);
      frontHeader.position.set(-15.5, 3.8, 3.25);
      bGroup.add(backW, westW, westGoldTrim, frontGlass, frontHeader);

      // Dedicated Warm Interior PointLight so Boss Minh Đăng's Office is always bright and crisp
      const bossAmbientPt = new THREE.PointLight(0xfffbeb, 3.2, 11, 1.4);
      bossAmbientPt.position.set(-15.2, 3.2, -0.8);
      bGroup.add(bossAmbientPt);

      // Golden Executive Nameplate mounted high at Y = 3.22 (Full unclipped text!)
      const bossWallSign = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.68, 0.08),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('TRƯỞNG PHÒNG • NGUYỄN MINH ĐĂNG', '.NET 9 • VUE 3 • MONGODB • REDIS ARCHITECT', '#1e1b4b', '#facc15', '#38bdf8'),
          emissive: 0x1e1b4b,
          emissiveIntensity: 0.5
        })
      );
      bossWallSign.position.set(-18.68, 3.22, -0.8);
      bossWallSign.rotation.y = Math.PI / 2;
      bGroup.add(bossWallSign);

      const doorArchSign = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.54, 0.1),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('PHÒNG TRƯỞNG PHÒNG', 'NGUYỄN MINH ĐĂNG (VIP)', '#451a03', '#fde047', '#ffffff')
        })
      );
      doorArchSign.position.set(-11.82, 3.15, -0.8);
      doorArchSign.rotation.y = Math.PI / 2;
      bGroup.add(doorArchSign);

      // Shared Live Canvas / Screen-Share Material for Boss Minh Đăng's Command Display & 3 Desk Monitors
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 512; bCanvas.height = 256;
      const bCtx = bCanvas.getContext('2d');
      const bTex = new THREE.CanvasTexture(bCanvas);
      const bScreenMat = new THREE.MeshStandardMaterial({
        map: bTex,
        emissiveMap: bTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.88
      });
      bossScreenObj = { canvas: bCanvas, ctx: bCtx, tex: bTex, mat: bScreenMat };
      drawBossMonitorCanvas(bCtx, 512, 256, 0);
      bTex.needsUpdate = true;

      // Giant 100-inch Executive Command Wall Monitor mounted right behind Boss Desk (Y = 2.02)
      const wallTvGroup = new THREE.Group();
      wallTvGroup.position.set(-18.66, 2.02, -0.8);
      wallTvGroup.rotation.y = Math.PI / 2;
      const wallTvBezel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.55, 0.08), mats.darkMetal);
      const wallTvFace = new THREE.Mesh(new THREE.PlaneGeometry(3.34, 1.42), bScreenMat);
      wallTvFace.position.z = 0.048;
      wallTvGroup.add(wallTvBezel, wallTvFace);
      bGroup.add(wallTvGroup);
      bossScreenMeshes.push(wallTvFace);

      // L-Shaped Executive Desk at (X = -16.1, Z = -0.8) facing East (+X)
      const deskGroup = new THREE.Group();
      deskGroup.position.set(-16.1, 0, -0.8);
      const mainTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 2.5), walnutMat);
      mainTop.position.set(0, 0.76, 0);
      const sideTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.85), walnutMat);
      sideTop.position.set(-0.45, 0.74, -1.35);
      const frontModesty = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 2.35), walnutMat);
      frontModesty.position.set(0.5, 0.38, 0);
      const goldFrontStrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 2.38), goldTrimMat);
      goldFrontStrip.position.set(0.51, 0.55, 0);
      deskGroup.add(mainTop, sideTop, frontModesty, goldFrontStrip);

      // Golden Desk Nameplate properly rotated (rotation.y = Math.PI / 2) so the front text faces the doorway (+X)
      const deskPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.16, 0.08),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('TRƯỞNG PHÒNG', 'NGUYỄN MINH ĐĂNG', '#78350f', '#fde047', '#ffffff')
        })
      );
      deskPlate.position.set(0.42, 0.88, 0.72);
      deskPlate.rotation.y = Math.PI / 2;
      deskGroup.add(deskPlate);

      // Triple UltraWide Curved Monitors on Boss Desk (Dual-sided live display so visible from both doorway & chair!)
      [-0.62, 0, 0.62].forEach((mz, mIdx) => {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 8), goldTrimMat);
        stand.position.set(0.15, 0.9, mz);
        const monHolder = new THREE.Group();
        monHolder.position.set(0.18, 1.08, mz);
        monHolder.rotation.y = mIdx === 0 ? 0.2 : (mIdx === 2 ? -0.2 : 0);

        const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.58), mats.matteBlack);
        const faceFront = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.36), bScreenMat);
        faceFront.position.x = 0.024;
        faceFront.rotation.y = Math.PI / 2;
        const faceBack = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.36), bScreenMat);
        faceBack.position.x = -0.024;
        faceBack.rotation.y = -Math.PI / 2;

        monHolder.add(bezel, faceFront, faceBack);
        deskGroup.add(stand, monHolder);
        bossScreenMeshes.push(faceFront, faceBack);
      });
      bGroup.add(deskGroup);

      // High-Back Executive Chairman Chair at (X = -17.0, Z = -0.8) facing East (+X)
      const chairG = new THREE.Group();
      chairG.position.set(-17.0, 0, -0.8);
      chairG.rotation.y = Math.PI / 2;
      const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), goldTrimMat);
      cBase.position.y = 0.05;
      const cStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), goldTrimMat);
      cStem.position.y = 0.26;
      const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.6), leatherChairMat);
      cSeat.position.y = 0.48;
      const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.92, 0.1), leatherChairMat);
      cBack.position.set(0, 0.95, -0.26);
      chairG.add(cBase, cStem, cSeat, cBack);
      bGroup.add(chairG);

      // VIP Guest Leather Sofa & Coffee Table along North Wall (Z = -4.0)
      const vipSofa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.48, 0.85), leatherChairMat);
      vipSofa.position.set(-15.2, 0.24, -4.1);
      const vipSofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 0.2), leatherChairMat);
      vipSofaBack.position.set(-15.2, 0.52, -4.45);
      const vipTable = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 0.65), mats.glass);
      vipTable.position.set(-15.2, 0.2, -3.0);
      bGroup.add(vipSofa, vipSofaBack, vipTable);

      // Illuminated Golden Trophy Pedestal safely placed at South-West Corner (X = -17.8, Z = 2.0)
      const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 16), mats.ceramicWhite);
      pedBase.position.set(-17.8, 0.525, 2.0);
      const pedTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16), goldTrimMat);
      pedTrim.position.set(-17.8, 1.06, 2.0);
      const trophyCup = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), goldTrimMat);
      trophyCup.position.set(-17.8, 1.32, 2.0);
      bGroup.add(pedBase, pedTrim, trophyCup);
      bGroup.add(createPlant(-13.2, -4.1, 1.25));
      bGroup.add(createPlant(-13.2, 2.3, 1.25));

      const bossInspectorMeta = {
        id: 'boss-minhdang-desk',
        type: 'boss',
        icon: '👑',
        zone: 'Phòng Trưởng Phòng VIP',
        title: 'Phòng Trưởng Phòng Nguyễn Minh Đăng',
        desc: 'Trung tâm chỉ huy hệ thống .NET 9, Vue 3, MongoDB & Redis! Hỗ trợ chiếu trực tiếp màn hình máy tính ngoài của bạn lên cụm màn hình 3D của Sếp Đăng.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Chủ nhân:</span><span class="text-amber-300 font-bold">Trưởng phòng Minh Đăng 👑</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Màn hình 3D:</span><span class="${bossScreenSharing ? 'text-fuchsia-300' : 'text-emerald-400'} font-semibold">${bossScreenSharing ? '🖥️ Đang chiếu Màn hình PC thật' : '📊 Live Command Dashboard'}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">4 Phím Mũi Tên:</span><span class="${wasdControlBoss ? 'text-sky-300' : 'text-slate-400'} font-semibold">${wasdControlBoss ? '🎮 Đang bật (⬆️ ⬇️ ⬅️ ➡️)' : 'Bấm ⬆️⬇️⬅️➡️ để đi ngay'}</span></div>
        `,
        getActions: () => [
          {
            label: bossScreenSharing ? '⏹ Tắt Share Màn Hình Máy Tính' : '🖥️ Share Màn Hình Máy Tính Lên Phòng Sếp!',
            primary: true,
            run: () => {
              if (bossScreenSharing) stopBossScreenShare();
              else startBossScreenShare();
            }
          },
          {
            label: (embodiedCharacter === officeCharacters[0]) ? '⏹ Thoát Hóa Thân Sếp Đăng' : '🕹️ Hóa Thân Thành Sếp Minh Đăng (4 Phím ⬆️⬇️⬅️➡️)',
            primary: false,
            run: () => {
              if (embodiedCharacter === officeCharacters[0]) {
                stopEmbodyCharacter();
              } else if (officeCharacters[0]) {
                startEmbodyCharacter(officeCharacters[0]);
              }
            }
          },
          {
            label: '🚀 Go-Live Dự Án & Thưởng Nóng (+100% Vui)',
            primary: false,
            run: () => {
              playDonationSound();
              spawnKaraokeConfetti(50);
              officeCharacters.forEach((c, i) => {
                c.mood = 100;
                c.energy = 100;
                if (i % 2 === 0) showCharacterSpeech(c, 'Go-Live thành công!! Đa tạ Trưởng phòng Minh Đăng thưởng lớn! 🚀💸', 5.0);
              });
              showToast('🚀 GO-LIVE DỰ ÁN THÀNH CÔNG 100%! Trưởng phòng Minh Đăng ký thưởng nóng toàn phòng!');
            }
          },
          { label: '🍻 Sếp Đăng bao đi nhậu!', primary: false, run: () => triggerOfficeEvent('nhau') },
          { label: '🎤 Sếp Đăng dẫn đi hát Karaoke!', primary: false, run: () => triggerOfficeEvent('karaoke') },
          {
            label: '🛕 Dẫn team đi Chùa & Công đức 10 Triệu',
            primary: false,
            run: () => {
              triggerOfficeEvent('chua');
              setTimeout(() => spawnDonationMoney(10000000, 'Trưởng phòng Minh Đăng'), 800);
            }
          }
        ]
      };

      registerInteractive(deskGroup, bossInspectorMeta);
      registerInteractive(wallTvGroup, bossInspectorMeta);

      enableShadows(bGroup);
      scene.add(bGroup);
    }

    function buildDevZone() {
      const devGroup = new THREE.Group();
      const rows = [
        { z: 1.5, seats: [-9.2, -6.8, -4.4] },
        { z: 5.5, seats: [-9.2, -6.8, -4.4] }
      ];

      let monIdx = 0;
      rows.forEach((row, rIdx) => {
        // Long shared desk
        const deskTop = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 1.45), mats.woodDesk);
        deskTop.position.set(-6.8, 0.74, row.z);
        devGroup.add(deskTop);

        [-10.2, -6.8, -3.4].forEach(lx => {
          [-0.6, 0.6].forEach(lz => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), mats.darkMetal);
            leg.position.set(lx, 0.36, row.z + lz);
            devGroup.add(leg);
          });
        });

        row.seats.forEach((sx, sIdx) => {
          // Ergonomic chair facing desk (-Z)
          devGroup.add(createOfficeChair(sx, row.z + 0.85, Math.PI));

          // Dual Monitors per Developer
          const monitorGroup = new THREE.Group();
          monitorGroup.position.set(sx, 0.78, row.z - 0.15);

          const mCanvas = document.createElement('canvas');
          mCanvas.width = 256; mCanvas.height = 144;
          const mCtx = mCanvas.getContext('2d');
          const mTex = new THREE.CanvasTexture(mCanvas);
          const screenMat = new THREE.MeshStandardMaterial({
            map: mTex, emissiveMap: mTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.75
          });

          [-0.3, 0.3].forEach((offsetX, mSide) => {
            const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.06), mats.darkMetal);
            stand.position.set(offsetX, 0.12, -0.04);
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.03), mats.matteBlack);
            bezel.position.set(offsetX, 0.32, 0);
            bezel.rotation.y = mSide === 0 ? 0.12 : -0.12;
            const face = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.30), screenMat);
            face.position.set(0, 0, 0.018);
            bezel.add(face);
            monitorGroup.add(stand, bezel);
          });

          // Keyboard & Mouse
          const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), mats.matteBlack);
          kb.position.set(0, 0.01, 0.34);
          monitorGroup.add(kb);

          devGroup.add(monitorGroup);

          const monObj = {
            id: `dev-mon-${monIdx}`,
            seed: monIdx + 1,
            mode: monIdx % 3, // 0: Code, 1: Dashboard, 2: Terminal, 3: Off
            canvas: mCanvas,
            ctx: mCtx,
            tex: mTex,
            mat: screenMat
          };
          devMonitors.push(monObj);
          drawDevMonitorCanvas(mCtx, 256, 144, monObj.mode, 0, monObj.seed);
          mTex.needsUpdate = true;

          const modeNames = ['Code IDE (VS Code)', 'Dashboard K8s', 'Terminal Deploy', 'Đã tắt màn hình'];
          const stationNum = rIdx * 3 + sIdx + 1;
          registerInteractive(monitorGroup, {
            id: monObj.id,
            type: 'monitor',
            icon: '💻',
            zone: 'Khu Lập Trình (Dev Zone)',
            title: `Máy trạm Dev #${stationNum}`,
            desc: 'Cụm 2 màn hình chuyên dụng hiển thị code, log build và biểu đồ giám sát thời gian thực.',
            getMetrics: () => `
              <div class="flex justify-between"><span class="text-slate-400">Hiển thị:</span><span class="text-sky-300 font-semibold">${state.activeEvent === 'crash' ? '🚨 502 BAD GATEWAY' : modeNames[monObj.mode]}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="${monObj.mode === 3 ? 'text-slate-400' : 'text-emerald-400'} font-semibold">${monObj.mode === 3 ? 'Standby' : 'Đang hoạt động'}</span></div>
            `,
            getActions: () => [
              {
                label: '🔄 Chuyển chế độ màn hình',
                primary: true,
                run: () => {
                  monObj.mode = (monObj.mode + 1) % 4;
                  monObj.mat.emissiveIntensity = monObj.mode === 3 ? 0.0 : 0.75;
                  drawDevMonitorCanvas(monObj.ctx, 256, 144, monObj.mode, simElapsed, monObj.seed);
                  monObj.tex.needsUpdate = true;
                  showToast(`Máy trạm #${stationNum}: ${modeNames[monObj.mode]}`);
                  updateInspectorUI();
                }
              }
            ]
          });
          monIdx++;
        });
      });

      enableShadows(devGroup);
      scene.add(devGroup);
    }

    function buildMeetingRoom() {
      const mGroup = new THREE.Group();

      // Glass Walls enclosing X: -11.8 -> -2.2, Z: -8.8 -> -2.2
      const frontGlassLeft = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.6, 0.08), mats.glass);
      frontGlassLeft.position.set(-8.4, 1.8, -2.2);
      const rightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 6.6), mats.glass);
      rightGlass.position.set(-2.2, 1.8, -5.5);
      mGroup.add(frontGlassLeft, rightGlass);

      // Door Frame & Hinged Glass Door (X: -5.0 -> -2.2, door width 1.6 at X: -4.3 -> -2.7)
      const doorPivot = new THREE.Group();
      doorPivot.position.set(-4.3, 0, -2.2);
      const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.5, 0.07), mats.glass);
      doorGlass.position.set(0.775, 1.25, 0);
      const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), mats.chrome);
      doorHandle.position.set(1.38, 1.15, 0.07);
      doorPivot.add(doorGlass, doorHandle);
      mGroup.add(doorPivot);

      const meetingDoorObj = { id: 'meeting', pivot: doorPivot, isOpen: false, targetAngle: 0, autoCloseTimer: 0 };
      animatedDoors.push(meetingDoorObj);

      registerInteractive(doorPivot, {
        id: 'door-meeting',
        type: 'door',
        icon: '🚪',
        zone: 'Phòng Họp Kính',
        title: 'Cửa kính Phòng họp',
        desc: 'Cửa kính cường lực cách âm có thể đóng/mở linh hoạt.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="text-sky-300 font-semibold">${meetingDoorObj.isOpen ? 'Đang mở' : 'Đang đóng'}</span></div>
        `,
        getActions: () => [
          {
            label: meetingDoorObj.isOpen ? '🚪 Đóng cửa' : '🚪 Mở cửa',
            primary: true,
            run: () => {
              meetingDoorObj.isOpen = !meetingDoorObj.isOpen;
              meetingDoorObj.targetAngle = meetingDoorObj.isOpen ? Math.PI * 0.48 : 0;
              meetingDoorObj.autoCloseTimer = 0;
              playSynthTone(meetingDoorObj.isOpen ? 520 : 340, 0.08);
              updateInspectorUI();
            }
          }
        ]
      });

      // Grand Executive Conference Table (5.4m x 1.95m) & 8 Chairs
      const mTable = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 1.95), mats.woodDesk);
      mTable.position.set(-7.1, 0.75, -5.5);
      const tableInlay = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.11, 0.45), mats.darkMetal);
      tableInlay.position.set(-7.1, 0.755, -5.5);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 1.3), mats.darkMetal);
      leg1.position.set(-9.1, 0.36, -5.5);
      const leg2 = leg1.clone();
      leg2.position.x = -5.1;
      mGroup.add(mTable, tableInlay, leg1, leg2);

      // 6 Side Chairs + 2 Head-of-Table Chairs & Laptops around Conference Table
      [-8.6, -7.2, -5.8].forEach(cx => {
        mGroup.add(createOfficeChair(cx, -4.25, Math.PI));
        mGroup.add(createOfficeChair(cx, -6.75, 0));
        const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.26), mats.chrome);
        laptop.position.set(cx, 0.81, -4.92);
        mGroup.add(laptop);
      });
      mGroup.add(createOfficeChair(-10.15, -5.5, Math.PI / 2));
      mGroup.add(createOfficeChair(-4.05, -5.5, -Math.PI / 2));

      // 120" Ultra-Wide Presentation & Live WebRTC Video Call Screen on Back Wall (Unobstructed by ceiling light!)
      const sCanvas = document.createElement('canvas');
      sCanvas.width = 512; sCanvas.height = 256;
      const sCtx = sCanvas.getContext('2d');
      const sTex = new THREE.CanvasTexture(sCanvas);
      const sMat = new THREE.MeshStandardMaterial({
        map: sTex, emissiveMap: sTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.85
      });

      const screenGroup = new THREE.Group();
      screenGroup.position.set(-7.1, 2.18, -8.78);
      const sBezel = new THREE.Mesh(new THREE.BoxGeometry(4.55, 2.24, 0.1), mats.matteBlack);
      const sFace = new THREE.Mesh(new THREE.PlaneGeometry(4.36, 2.08), sMat);
      sFace.position.z = 0.06;
      screenGroup.add(sBezel, sFace);
      mGroup.add(screenGroup);

      meetingScreenObj = { canvas: sCanvas, ctx: sCtx, tex: sTex, slideIndex: 0 };
      drawMeetingCanvas(sCtx, 512, 256, 0, 0);
      sTex.needsUpdate = true;

      registerInteractive(screenGroup, {
        id: 'meeting-screen',
        type: 'screen',
        icon: '📊',
        zone: 'Phòng Họp Kính',
        title: 'Màn hình Trình chiếu 98"',
        desc: 'Tự động trình chiếu ngẫu nhiên sơ đồ Microservices, Sprint Burndown, Kanban và KPI trực tiếp.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Slide hiện tại:</span><span class="text-sky-300 font-semibold">#${(meetingScreenObj.slideIndex % 4) + 1} / 4</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Tự động chuyển:</span><span class="text-emerald-400 font-semibold">${state.autoSlideMeeting ? 'Bật (mỗi 6s)' : 'Tắt'}</span></div>
        `,
        getActions: () => [
          {
            label: '📹 Tham Gia Call Video & Mic Phòng Họp!',
            primary: true,
            run: () => {
              goToCameraPreset('meeting');
              if (window.MeetingCallManager) {
                window.MeetingCallManager.joinMeetingCall(true);
              }
            }
          },
          {
            label: '🎤 Chỉ Bật Mic Đàm Thoại (Voice Call)',
            primary: false,
            run: () => {
              goToCameraPreset('meeting');
              if (window.MeetingCallManager) {
                window.MeetingCallManager.joinMeetingCall(false);
              }
            }
          },
          {
            label: '⏭ Đổi Slide ngay',
            primary: false,
            run: () => {
              meetingScreenObj.slideIndex = (meetingScreenObj.slideIndex + 1) % 4;
              drawMeetingCanvas(meetingScreenObj.ctx, 512, 256, meetingScreenObj.slideIndex, simElapsed);
              meetingScreenObj.tex.needsUpdate = true;
              updateInspectorUI();
            }
          },
          {
            label: state.autoSlideMeeting ? '⏸ Tắt tự chuyển' : '▶ Bật tự chuyển',
            primary: false,
            run: () => {
              state.autoSlideMeeting = !state.autoSlideMeeting;
              updateInspectorUI();
            }
          }
        ]
      });

      enableShadows(mGroup);
      scene.add(mGroup);
    }

    function buildServerRoom() {
      const sGroup = new THREE.Group();

      // Glass enclosure X: 5.5 -> 11.8, Z: 2.2 -> 8.8
      const backGlass = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.6, 0.08), mats.glass);
      backGlass.position.set(8.65, 1.8, 2.2);
      const leftGlassBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 2.6), mats.glass);
      leftGlassBack.position.set(5.5, 1.8, 3.5);
      const leftGlassFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 2.2), mats.glass);
      leftGlassFront.position.set(5.5, 1.8, 7.7);
      sGroup.add(backGlass, leftGlassBack, leftGlassFront);

      // Hinged Server Door at X=5.5, Z from 4.8 to 6.6
      const srvDoorPivot = new THREE.Group();
      srvDoorPivot.position.set(5.5, 0, 4.8);
      const srvDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.5, 1.75), mats.glass);
      srvDoorMesh.position.set(0, 1.25, 0.875);
      const srvHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), mats.chrome);
      srvHandle.position.set(-0.07, 1.15, 1.55);
      srvDoorPivot.add(srvDoorMesh, srvHandle);
      sGroup.add(srvDoorPivot);

      const srvDoorObj = { id: 'server', pivot: srvDoorPivot, isOpen: false, targetAngle: 0, autoCloseTimer: 0 };
      animatedDoors.push(srvDoorObj);

      registerInteractive(srvDoorPivot, {
        id: 'door-server',
        type: 'door',
        icon: '🔐',
        zone: 'Phòng Server',
        title: 'Cửa kiểm soát Phòng Server',
        desc: 'Cửa kính bảo mật khu vực máy chủ Production.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="text-sky-300 font-semibold">${srvDoorObj.isOpen ? 'Đang mở' : 'Đã khóa'}</span></div>
        `,
        getActions: () => [
          {
            label: srvDoorObj.isOpen ? '🔒 Đóng cửa' : '🔓 Mở cửa',
            primary: true,
            run: () => {
              srvDoorObj.isOpen = !srvDoorObj.isOpen;
              srvDoorObj.targetAngle = srvDoorObj.isOpen ? -Math.PI * 0.48 : 0;
              srvDoorObj.autoCloseTimer = 0;
              updateInspectorUI();
            }
          }
        ]
      });

      // 4 Server Racks with Blinking LEDs
      const racksGroup = new THREE.Group();
      [7.4, 8.7, 10.0, 11.1].forEach((rx, rIdx) => {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.55, 1.1), mats.matteBlack);
        rack.position.set(rx, 1.275, 4.2 + (rIdx % 2) * 2.5);
        racksGroup.add(rack);

        for (let i = 0; i < 8; i++) {
          const ledMat = new THREE.MeshStandardMaterial({
            color: i % 3 === 0 ? 0x38bdf8 : 0x22c55e,
            emissive: i % 3 === 0 ? 0x38bdf8 : 0x22c55e,
            emissiveIntensity: 1.5
          });
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), ledMat);
          led.position.set(rx - 0.32 + (i % 2) * 0.2, 0.45 + i * 0.24, rack.position.z + 0.56);
          racksGroup.add(led);
          serverLeds.push({ mesh: led, mat: ledMat, phase: rIdx * 2 + i * 0.7 });
        }
      });
      sGroup.add(racksGroup);

      serverPointLight = new THREE.PointLight(0x38bdf8, 3.2, 10, 1.5);
      serverPointLight.position.set(9.0, 3.0, 5.5);
      sGroup.add(serverPointLight);

      registerInteractive(racksGroup, {
        id: 'server-racks',
        type: 'server',
        icon: '🖥️',
        zone: 'Phòng Server',
        title: 'Cụm Tủ Rack Production (4x 42U)',
        desc: 'Hệ thống máy chủ trung tâm chạy toàn bộ dịch vụ Microservices & Database.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">CPU / RAM:</span><span class="${state.activeEvent === 'crash' ? 'text-rose-400' : 'text-emerald-400'} font-semibold">${state.activeEvent === 'crash' ? '99% OVERLOAD 🔥' : '38% / 62%'}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Nhiệt độ:</span><span class="text-sky-300 font-semibold">${turboCooling ? '17.5°C (Turbo ❄️)' : '21.8°C'}</span></div>
        `,
        getActions: () => [
          {
            label: turboCooling ? '❄️ Tắt Turbo Cooling' : '❄️ Bật Turbo Cooling',
            primary: true,
            run: () => {
              turboCooling = !turboCooling;
              if (state.activeEvent !== 'crash') {
                serverPointLight.color.setHex(turboCooling ? 0x06b6d4 : 0x38bdf8);
              }
              showToast(turboCooling ? '❄️ Đã kích hoạt làm mát Turbo Phòng Server!' : 'Đã chuyển về chế độ làm mát tiêu chuẩn');
              updateInspectorUI();
            }
          }
        ]
      });

      enableShadows(sGroup);
      scene.add(sGroup);
    }

    function buildPantryAndLounge() {
      const pGroup = new THREE.Group();

      // Pantry Counter along back wall (X: 2.2 -> 6.8, Z: -8.3)
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.95, 0.85), mats.darkMetal);
      counter.position.set(4.5, 0.475, -8.35);
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.06, 0.92), mats.ceramicWhite);
      counterTop.position.set(4.5, 0.98, -8.35);
      pGroup.add(counter, counterTop);

      // Espresso Coffee Machine at (3.2, 1.0, -8.25)
      const coffeeGroup = new THREE.Group();
      coffeeGroup.position.set(3.2, 1.0, -8.25);
      const cmBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.56, 0.45), mats.matteBlack);
      cmBody.position.y = 0.28;
      const cmAccent = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.14, 0.47), mats.chrome);
      cmAccent.position.y = 0.48;
      coffeeGroup.add(cmBody, cmAccent);
      pGroup.add(coffeeGroup);

      for (let i = 0; i < 8; i++) {
        const sp = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        sp.position.set(3.2, 1.12, -8.08);
        sp.userData = { life: i * 0.2, offsetX: (Math.random() - 0.5) * 0.1 };
        steamParticles.push(sp);
        scene.add(sp);
      }

      registerInteractive(coffeeGroup, {
        id: 'coffee-machine',
        type: 'coffee',
        icon: '☕',
        zone: 'Khu Pantry',
        title: 'Máy Pha Cà Phê Espresso',
        desc: 'Nguồn năng lượng bất tận của anh em lập trình viên mỗi sáng và đêm OT.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="text-amber-300 font-semibold">${coffeeBrewingTimer > 0 ? 'Đang chiết xuất Espresso ☕' : 'Sẵn sàng pha'}</span></div>
        `,
        getActions: () => [
          {
            label: '☕ Pha ngay 1 ly Espresso',
            primary: true,
            run: () => {
              coffeeBrewingTimer = 7.0;
              playSynthTone(660, 0.12);
              showToast('☕ Đang pha Espresso thơm lừng!');
              updateInspectorUI();
            }
          }
        ]
      });

      // Pantry Island Table (4.5, -5.6) + Hidden Pizza Party Props
      const island = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.82, 1.25), mats.woodDesk);
      island.position.set(4.5, 0.41, -5.6);
      pGroup.add(island);

      pizzaPartyGroup = new THREE.Group();
      pizzaPartyGroup.position.set(4.5, 0.85, -5.6);
      [-0.65, 0, 0.65].forEach(px => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), mats.ceramicWhite);
        box.position.set(px, 0.03, 0);
        const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
        crust.position.set(px, 0.07, 0);
        const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.028, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
        sauce.position.set(px, 0.072, 0);
        pizzaPartyGroup.add(box, crust, sauce);
      });
      pizzaPartyGroup.visible = false;
      pGroup.add(pizzaPartyGroup);

      // Green Plant Wall in Lounge (X: 9.5 -> 11.6, Z: -8.78)
      const greenWall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.1, 0.15), mats.plantGreen);
      greenWall.position.set(9.8, 1.9, -8.75);
      pGroup.add(greenWall);

      // Lounge Sofa
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.95), mats.fabricGray);
      sofa.position.set(9.8, 0.24, -7.8);
      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.88, 0.22), mats.fabricGray);
      sofaBack.position.set(9.8, 0.56, -8.2);
      pGroup.add(sofa, sofaBack);

      // Retro Arcade Cabinet at (11.2, 0, -5.8) facing -X
      const arcadeGroup = new THREE.Group();
      arcadeGroup.position.set(11.15, 0, -5.8);
      arcadeGroup.rotation.y = -Math.PI / 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.75, 0.78), new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.4 }));
      cab.position.y = 0.875;
      arcadeGroup.add(cab);

      const aCanvas = document.createElement('canvas');
      aCanvas.width = 160; aCanvas.height = 128;
      const aCtx = aCanvas.getContext('2d');
      const aTex = new THREE.CanvasTexture(aCanvas);
      const aMat = new THREE.MeshStandardMaterial({
        map: aTex, emissiveMap: aTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.9
      });
      const aScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.52), aMat);
      aScreen.position.set(0, 1.28, 0.40);
      arcadeGroup.add(aScreen);
      pGroup.add(arcadeGroup);

      arcadeScreenObj = { canvas: aCanvas, ctx: aCtx, tex: aTex, isPlaying: true };
      drawArcadeCanvas(aCtx, 160, 128, true, 0);
      aTex.needsUpdate = true;

      registerInteractive(arcadeGroup, {
        id: 'arcade-machine',
        type: 'arcade',
        icon: '🕹️',
        zone: 'Khu Giải Trí Lounge',
        title: 'Máy Chơi Game Arcade Retro',
        desc: 'Góc xả stress huyền thoại của các lập trình viên sau khi fix xong bug khó.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="text-emerald-400 font-semibold">${arcadeScreenObj.isPlaying ? 'Đang chạy Game 👾' : 'Màn hình chờ'}</span></div>
        `,
        getActions: () => [
          {
            label: arcadeScreenObj.isPlaying ? '⏹ Tạm dừng Game' : '▶ Bật Game ngay',
            primary: true,
            run: () => {
              arcadeScreenObj.isPlaying = !arcadeScreenObj.isPlaying;
              drawArcadeCanvas(arcadeScreenObj.ctx, 160, 128, arcadeScreenObj.isPlaying, simElapsed);
              arcadeScreenObj.tex.needsUpdate = true;
              updateInspectorUI();
            }
          }
        ]
      });

      enableShadows(pGroup);
      scene.add(pGroup);
    }

    function buildReceptionAndCollab() {
      const rGroup = new THREE.Group();

      // Reception Desk at (1.5, 0, 5.4)
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.85), mats.ceramicWhite);
      desk.position.set(1.5, 0.525, 5.4);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.5),
        new THREE.MeshStandardMaterial({ map: createSignTexture('IT LAB', 'TECH OFFICE 3D', '#0f172a', '#38bdf8', '#e2e8f0') })
      );
      sign.position.set(1.5, 0.62, 5.84);
      rGroup.add(desk, sign);

      // Central Collab Round Table & Colorful Pouf Chairs
      const cTable = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 20), mats.woodDesk);
      cTable.position.set(0.4, 0.56, 0.2);
      const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 0.54, 12), mats.darkMetal);
      cLeg.position.set(0.4, 0.27, 0.2);
      rGroup.add(cTable, cLeg);

      const poufColors = [0x0ea5e9, 0xf59e0b, 0x10b981, 0xf43f5e];
      poufColors.forEach((col, i) => {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const pouf = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.34, 0.42, 14),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
        );
        pouf.position.set(0.4 + Math.cos(ang) * 1.25, 0.21, 0.2 + Math.sin(ang) * 1.25);
        rGroup.add(pouf);
      });

      enableShadows(rGroup);
      scene.add(rGroup);
    }

    function buildKaraokeRoom() {
      const kGroup = new THREE.Group();

      // Floor & Acoustic Dark Purple Walls (X: 12.15 -> 19.2, Z: -8.9 -> 0.5)
      const kFloorMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45, metalness: 0.25 });
      const kWallMat = new THREE.MeshStandardMaterial({ color: 0x1e1038, roughness: 0.75 });
      const neonPink = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 1.8 });
      const neonCyan = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.8 });

      const floor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 9.5), kFloorMat);
      floor.position.set(15.6, -0.15, -4.2);
      kGroup.add(floor);

      const backW = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.0, 0.28), kWallMat);
      backW.position.set(15.6, 2.0, -8.85);
      const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.0, 9.5), kWallMat);
      rightW.position.set(19.1, 2.0, -4.2);
      // South Acoustic Partition Wall separating Karaoke Room from Temple Courtyard
      const southW = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.0, 0.28), kWallMat);
      southW.position.set(15.6, 2.0, 0.45);
      kGroup.add(backW, rightW, southW);

      const strip1 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), neonPink);
      strip1.position.set(15.6, 3.5, -8.68);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 8.8), neonCyan);
      strip2.position.set(18.92, 3.5, -4.2);
      const strip3 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), neonPink);
      strip3.position.set(15.6, 3.5, 0.28);
      kGroup.add(strip1, strip2, strip3);

      const kSign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.72),
        new THREE.MeshStandardMaterial({ map: createSignTexture('KARAOKE VIP', 'HÁT CHO QUÊN BUG', '#2e1065', '#f472b6', '#38bdf8'), emissive: 0x3b0764, emissiveIntensity: 0.4 })
      );
      kSign.position.set(15.6, 3.1, -8.68);
      kGroup.add(kSign);

      // Velvet U-Shaped Sofa
      const velvetMat = new THREE.MeshStandardMaterial({ color: 0x701a75, roughness: 0.8 });
      const sofa1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.48, 0.95), velvetMat);
      sofa1.position.set(15.6, 0.24, -7.8);
      const sofa1Back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.22), velvetMat);
      sofa1Back.position.set(15.6, 0.56, -8.2);
      const sofa2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.48, 3.2), velvetMat);
      sofa2.position.set(13.9, 0.24, -6.2);
      kGroup.add(sofa1, sofa1Back, sofa2);

      // Glass Table + glowing Beer Tower + Fruit Platter + Cups + Dual Microphones
      const kTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.46, 1.1), mats.darkMetal);
      kTable.position.set(15.8, 0.23, -5.9);
      const kTableTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.2), mats.glass);
      kTableTop.position.set(15.8, 0.48, -5.9);
      const beerTowerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.12, 12), mats.darkMetal);
      beerTowerBase.position.set(15.35, 0.56, -5.9);
      const beerTowerGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.42, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.45, roughness: 0.2 })
      );
      beerTowerGlass.position.set(15.35, 0.83, -5.9);
      const fruitPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.03, 14), mats.ceramicWhite);
      fruitPlate.position.set(16.05, 0.52, -5.9);
      const fruitHeap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 }));
      fruitHeap.position.set(16.05, 0.59, -5.9);
      kGroup.add(kTable, kTableTop, beerTowerBase, beerTowerGlass, fruitPlate, fruitHeap);

      // KTV Touch-Screen Song Selector Stand next to Stage (X: 17.55, Z: -1.35)
      const ktvStand = new THREE.Group();
      ktvStand.position.set(17.55, 0, -1.35);
      const ktvBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 14), mats.darkMetal);
      ktvBase.position.y = 0.03;
      const ktvPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.05, 10), mats.chrome);
      ktvPole.position.y = 0.55;
      const ktvPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.46, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xbe185d, emissiveIntensity: 0.75 })
      );
      ktvPanel.position.set(0, 1.12, 0);
      ktvPanel.rotation.y = -Math.PI * 0.35;
      ktvPanel.rotation.x = -0.32;
      ktvStand.add(ktvBase, ktvPole, ktvPanel);
      kGroup.add(ktvStand);

      registerInteractive(ktvStand, {
        id: 'ktv-touch-stand',
        type: 'karaoke',
        icon: '🎵',
        zone: 'Phòng Hát Karaoke VIP',
        title: 'Đầu Chọn Bài Cảm Ứng KTV Pro',
        desc: 'Chọn nhanh 6 bài Hit nhạc sống IT, bấm chấm điểm 100đ, bắn pháo giấy hoặc chiếu Tab YouTube/Video lên màn hình TV 3D!',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Đang phát:</span><span class="text-fuchsia-300 font-semibold truncate ml-2">${state.currentSongTitle}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Chế độ:</span><span class="text-emerald-400 font-semibold">${state.karaokeMode === 'beat' ? '🎵 Beat Nhạc Sống 3D' : '📺 Video / Trình chiếu'}</span></div>
        `,
        getActions: () => [
          { label: '🎵 Mở bảng chọn bài KTV', primary: true, run: () => openKaraokeYouTubePanel(true) },
          { label: '💯 Chấm điểm Ca sĩ', primary: false, run: () => triggerKaraokeScore() },
          { label: '🎉 Bắn pháo giấy 3D', primary: false, run: () => { spawnKaraokeConfetti(42); playSynthTone(784, 0.15, 'triangle', 0.14); } }
        ]
      });

      // Stage & Mic Stand
      const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.14, 24), mats.matteBlack);
      stage.position.set(16.2, 0.07, -2.5);
      const stageRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.035, 8, 28), neonPink);
      stageRing.rotation.x = Math.PI / 2;
      stageRing.position.set(16.2, 0.14, -2.5);
      const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.35, 8), mats.chrome);
      micPole.position.set(16.65, 0.72, -2.5);
      const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), mats.chrome);
      micHead.position.set(16.65, 1.42, -2.5);
      kGroup.add(stage, stageRing, micPole, micHead);

      // Giant Karaoke Screen
      const kCanvas = document.createElement('canvas');
      kCanvas.width = 512; kCanvas.height = 256;
      const kCtx = kCanvas.getContext('2d');
      const kTex = new THREE.CanvasTexture(kCanvas);
      const kScreenMat = new THREE.MeshStandardMaterial({
        map: kTex, emissiveMap: kTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.9
      });
      const tvGroup = new THREE.Group();
      tvGroup.position.set(18.88, 2.05, -4.0);
      tvGroup.rotation.y = -Math.PI / 2;
      const tvBezel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.15, 0.12), mats.darkMetal);
      const tvFace = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.98), kScreenMat);
      tvFace.position.z = 0.07;
      tvGroup.add(tvBezel, tvFace);
      kGroup.add(tvGroup);

      [-6.5, -1.5].forEach(sz => {
        const spk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.55), mats.darkMetal);
        spk.position.set(18.6, 0.68, sz);
        kGroup.add(spk);
      });

      const kLight1 = new THREE.PointLight(0xec4899, 5.5, 11, 1.5);
      kLight1.position.set(15.6, 3.4, -4.5);
      const kLight2 = new THREE.PointLight(0x22d3ee, 4.5, 11, 1.5);
      kLight2.position.set(17.2, 3.4, -2.5);
      kGroup.add(kLight1, kLight2);
      karaokeLights.push(kLight1, kLight2);

      karaokeScreenObj = { canvas: kCanvas, ctx: kCtx, tex: kTex, mesh: tvFace, defaultMat: kScreenMat };
      drawKaraokeCanvas(kCtx, 512, 256, false, 0);
      kTex.needsUpdate = true;

      registerInteractive(tvGroup, {
        id: 'karaoke-screen',
        type: 'karaoke',
        icon: '🎤',
        zone: 'Phòng Hát Karaoke VIP',
        title: 'Dàn Karaoke VIP 999',
        desc: 'Phòng hát cách âm loa công suất lớn! Hỗ trợ Nhạc Sống Beat 3D chạy chữ trực tiếp, chấm điểm 100đ và chiếu Video/Màn hình thật lên mặt TV 3D.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="${(state.beatPlaying || state.youtubePlaying) ? 'text-fuchsia-300' : 'text-sky-300'} font-semibold">${state.beatPlaying ? '🎵 Đang phát Beat Nhạc Sống 3D' : (state.youtubePlaying ? '📺 Đang chiếu Video TV 3D' : 'Sẵn sàng lên nhạc')}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Bài hiện tại:</span><span class="text-amber-300 font-semibold truncate ml-2">${state.currentSongTitle}</span></div>
        `,
        getActions: () => [
          { label: '📺 Mở bảng điều khiển KTV', primary: true, run: () => openKaraokeYouTubePanel(true) },
          { label: '💯 Chấm điểm Ca sĩ (100đ)', primary: false, run: () => triggerKaraokeScore() },
          { label: '🎤 Rủ cả team vào hát!', primary: false, run: () => triggerOfficeEvent('karaoke') }
        ]
      });

      enableShadows(kGroup);
      scene.add(kGroup);
    }

    function buildKaraoke3DScreenIframe() {
      // Mount a completely flat, native 2D <iframe> & <video> projected directly over the 3D TV screen
      // (No CSS matrix3d / preserve-3d so Google Drive Play/Pause/Volume clicks work 100% natively)
      karaokeTvDom = document.createElement('div');
      karaokeTvDom.id = 'karaoke-tv-dom';
      karaokeTvDom.style.position = 'absolute';
      karaokeTvDom.style.left = '0px';
      karaokeTvDom.style.top = '0px';
      karaokeTvDom.style.width = '640px';
      karaokeTvDom.style.height = '316px';
      karaokeTvDom.style.background = '#09090b';
      karaokeTvDom.style.borderRadius = '6px';
      karaokeTvDom.style.overflow = 'hidden';
      karaokeTvDom.style.boxShadow = '0 0 22px rgba(236, 72, 153, 0.55)';
      karaokeTvDom.style.display = 'none';
      karaokeTvDom.style.pointerEvents = 'auto';

      karaokeTvIframe = document.createElement('iframe');
      karaokeTvIframe.style.width = '100%';
      karaokeTvIframe.style.height = '100%';
      karaokeTvIframe.style.border = '0';
      karaokeTvIframe.style.display = 'none';
      karaokeTvIframe.style.pointerEvents = 'auto';
      karaokeTvIframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      karaokeTvIframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      karaokeTvIframe.setAttribute('allowfullscreen', 'true');
      karaokeTvDom.appendChild(karaokeTvIframe);

      karaokeTvVideo = document.createElement('video');
      karaokeTvVideo.style.width = '100%';
      karaokeTvVideo.style.height = '100%';
      karaokeTvVideo.style.objectFit = 'contain';
      karaokeTvVideo.style.display = 'none';
      karaokeTvVideo.style.pointerEvents = 'auto';
      karaokeTvVideo.controls = true;
      karaokeTvDom.appendChild(karaokeTvVideo);

      document.getElementById('css3d-container').appendChild(karaokeTvDom);
    }

    function buildTempleZone() {
      const tGroup = new THREE.Group();

      const grassMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.92 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.78 });
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.45 });
      const redWoodMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.75 });
      const roofTileMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48 });
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.85 });
      const velvetRopeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.18, metalness: 0.15 });
      const lotusLeafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });
      const lotusPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.5 });

      // 1. IT Office Outdoor Zen Garden & Koi Pond (Between Office and Temple at X: 12.2 -> 21.0, Z: 0.8 -> 10.5)
      const gardenLawn = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 9.8), grassMat);
      gardenLawn.position.set(16.6, -0.14, 5.6);
      const koiPondRim = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.45, 0.22, 24), stoneMat);
      koiPondRim.position.set(16.5, 0.11, 4.6);
      const koiWater = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.24, 24), waterMat);
      koiWater.position.set(16.5, 0.12, 4.6);
      tGroup.add(gardenLawn, koiPondRim, koiWater);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 12), lotusLeafMat);
        pad.position.set(16.5 + Math.cos(ang) * 1.25, 0.25, 4.6 + Math.sin(ang) * 1.25);
        tGroup.add(pad);
        if (i % 2 === 0) {
          const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 8), lotusPinkMat);
          fl.position.set(pad.position.x, 0.33, pad.position.z);
          tGroup.add(fl);
        }
      }

      // Grand Stone Avenue connecting Main Office Entrance (X=4.5, Z=9.8) to the Separated Grand Temple Complex (X=30.5, Z=9.8)
      for (let i = 0; i < 16; i++) {
        const step = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.07, 14), stoneMat);
        step.position.set(6.0 + i * 1.45, 0.035, 9.8);
        tGroup.add(step);
      }

      // 2. GRAND SEPARATED TEMPLE COMPLEX (X: 21.5 -> 39.5, Z: -4.5 -> 13.5, Center X = 30.5)
      const templeLawn = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.28, 18.2), grassMat);
      templeLawn.position.set(30.5, -0.14, 4.4);
      const grandCourtyard = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.08, 15.2), stoneMat);
      grandCourtyard.position.set(30.5, 0.04, 4.4);
      const imperialCarpetPath = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.09, 10.5), marbleMat);
      imperialCarpetPath.position.set(30.5, 0.045, 6.2);
      tGroup.add(templeLawn, grandCourtyard, imperialCarpetPath);

      // 3. GRAND TAM QUAN GATE (Cổng Tam Quan 3 Mái Đao Cong tại X = 22.2, Z = 9.8 đón khách từ Văn Phòng sang)
      const gateGroup = new THREE.Group();
      gateGroup.position.set(22.2, 0, 9.8);
      gateGroup.rotation.y = -Math.PI / 2;
      [-2.4, -0.95, 0.95, 2.4].forEach((gx, gIdx) => {
        const h = (gIdx === 1 || gIdx === 2) ? 4.2 : 3.3;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.45, 12), stoneMat);
        base.position.set(gx, 0.225, 0);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 14), redWoodMat);
        col.position.set(gx, h / 2 + 0.2, 0);
        gateGroup.add(base, col);
      });
      const gateMainRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.95, 4), roofTileMat);
      gateMainRoof.rotation.y = Math.PI / 4;
      gateMainRoof.position.set(0, 4.75, 0);
      const gateLeftRoof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.72, 4), roofTileMat);
      gateLeftRoof.rotation.y = Math.PI / 4;
      gateLeftRoof.position.set(-1.75, 3.8, 0);
      const gateRightRoof = gateLeftRoof.clone();
      gateRightRoof.position.x = 1.75;
      const gatePlaque = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.58, 0.1),
        new THREE.MeshStandardMaterial({ map: createSignTexture('CHÙA LINH ỨNG ZERO-BUG', 'CỔNG TAM QUAN • TÂM TỊNH CODE MƯỢT', '#7f1d1d', '#fde047', '#fef3c7') })
      );
      gatePlaque.position.set(0, 3.78, 0);
      gateGroup.add(gateMainRoof, gateLeftRoof, gateRightRoof, gatePlaque);
      tGroup.add(gateGroup);

      // Pair of Twin Lotus Ponds flanking the Grand Courtyard (X = 25.2 and X = 35.8, Z = 10.2)
      [25.2, 35.8].forEach(px => {
        const pRim = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.4), marbleMat);
        pRim.position.set(px, 0.125, 10.4);
        const pWat = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.27, 2.05), waterMat);
        pWat.position.set(px, 0.13, 10.4);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.26, 8), lotusPinkMat);
        fl.position.set(px, 0.34, 10.4);
        tGroup.add(pRim, pWat, fl);
      });

      // 4. ĐẠI HÙNG BẢO ĐIỆN 3 TẦNG MÁI HOÀNG KIM (Main Grand Sanctuary at X: 30.5, Z: 0.2 — 2.2x Larger!)
      const shrineGroup = new THREE.Group();
      shrineGroup.position.set(30.5, 0, 0.2);

      // 3-Tiered Imperial Stone Podium
      const pod1 = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.26, 5.6), stoneMat);
      pod1.position.y = 0.13;
      const pod2 = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.26, 5.0), marbleMat);
      pod2.position.y = 0.39;
      const pod3 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 4.4), stoneMat);
      pod3.position.y = 0.61;
      shrineGroup.add(pod1, pod2, pod3);

      // 8 Grand Red-Gold Pillars
      [-3.1, -1.1, 1.1, 3.1].forEach(px => {
        [-1.8, 1.8].forEach(pz => {
          const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.3, 12), goldMat);
          pBase.position.set(px, 0.85, pz);
          const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 3.4, 14), redWoodMat);
          pil.position.set(px, 2.55, pz);
          shrineGroup.add(pBase, pil);
        });
      });

      // 3-Tiered Sweeping Pagoda Roofs reaching 7.2m height!
      const roof1 = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.35, 4), roofTileMat);
      roof1.rotation.y = Math.PI / 4;
      roof1.position.y = 4.65;
      const roof2 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.15, 4), roofTileMat);
      roof2.rotation.y = Math.PI / 4;
      roof2.position.y = 5.75;
      const roof3 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 0.95, 4), roofTileMat);
      roof3.rotation.y = Math.PI / 4;
      roof3.position.y = 6.65;
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), goldMat);
      finial.position.y = 7.28;
      shrineGroup.add(roof1, roof2, roof3, finial);

      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.85, 0.12),
        new THREE.MeshStandardMaterial({ map: createSignTexture('ĐẠI HÙNG BẢO ĐIỆN • CHÙA CẦU KHÔNG BUG', 'THẮP NHANG • QUỲ LẠY • THỈNH CHUÔNG • XIN XĂM', '#7f1d1d', '#fde047', '#fef3c7') })
      );
      plaque.position.set(0, 3.72, 1.92);
      shrineGroup.add(plaque);

      // Grand Golden Buddha Statue with Glowing Halo + 2 Guardian Statues
      const altar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.15, 1.3), redWoodMat);
      altar.position.set(0, 1.28, -0.55);
      const lotusBase = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.28, 16), goldMat);
      lotusBase.position.set(0, 1.98, -0.65);
      const goldenIdol = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), goldMat);
      goldenIdol.position.set(0, 2.48, -0.65);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.82, 0.05, 10, 28),
        new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 1.8 })
      );
      halo.position.set(0, 2.52, -0.95);
      [-1.45, 1.45].forEach(gx => {
        const guardBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.2, 12), goldMat);
        guardBase.position.set(gx, 1.92, -0.5);
        const guardStatue = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 12), goldMat);
        guardStatue.position.set(gx, 2.28, -0.5);
        shrineGroup.add(guardBase, guardStatue);
      });

      // Golden Ingots & Stacks of Offerings on the Main Altar
      [-1.1, 1.1].forEach(ox => {
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.05, 14), goldMat);
        tray.position.set(ox, 1.88, -0.2);
        for (let k = 0; k < 6; k++) {
          const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.09), goldMat);
          ingot.position.set(ox + (k % 2 - 0.5) * 0.14, 1.94 + Math.floor(k / 2) * 0.065, -0.2);
          shrineGroup.add(ingot);
        }
        shrineGroup.add(tray);
      });
      shrineGroup.add(altar, goldenIdol, lotusBase, halo);

      [-2.8, -1.1, 1.1, 2.8].forEach(lx => {
        const lanMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.6 });
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), lanMat);
        lan.scale.set(0.9, 1.28, 0.9);
        lan.position.set(lx, 3.35, 1.88);
        shrineGroup.add(lan);
      });

      const templeLight = new THREE.PointLight(0xfbbf24, 6.5, 18, 1.4);
      templeLight.position.set(0, 3.6, 2.2);
      shrineGroup.add(templeLight);
      tGroup.add(shrineGroup);

      // 5. GRAND BRONZE BELL TOWER (Tháp Đại Hồng Chung 2 Tầng Mái bên trái tại X=25.2, Z=3.8)
      const bellTowerGroup = new THREE.Group();
      bellTowerGroup.position.set(25.2, 0, 3.8);
      const bellPod = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 2.3), stoneMat);
      bellPod.position.y = 0.125;
      bellTowerGroup.add(bellPod);
      [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]].forEach(([bx, bz]) => {
        const bPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12), redWoodMat);
        bPost.position.set(bx, 1.72, bz);
        bellTowerGroup.add(bPost);
      });
      const bBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.85, 10), goldMat);
      bBeam.rotation.z = Math.PI / 2;
      bBeam.position.set(0, 3.05, 0);
      const bRoof1 = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.72, 4), roofTileMat);
      bRoof1.rotation.y = Math.PI / 4;
      bRoof1.position.set(0, 3.55, 0);
      const bRoof2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.58, 4), roofTileMat);
      bRoof2.rotation.y = Math.PI / 4;
      bRoof2.position.set(0, 4.15, 0);

      const bellPivot = new THREE.Group();
      bellPivot.position.set(0, 3.0, 0);
      const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 0.82, 20), goldMat);
      bellBody.position.y = -0.52;
      const bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 22), goldMat);
      bellRim.rotation.x = Math.PI / 2;
      bellRim.position.y = -0.92;
      bellPivot.add(bellBody, bellRim);
      templeBellMesh = bellPivot;
      bellTowerGroup.add(bBeam, bRoof1, bRoof2, bellPivot);
      tGroup.add(bellTowerGroup);

      registerInteractive(bellTowerGroup, {
        id: 'temple-bell-tower',
        type: 'chua',
        icon: '🔔',
        zone: 'Quần Thể Chùa Linh Ứng Zero-Bug',
        title: 'Tháp Đại Hồng Chung 2 Tầng Mái',
        desc: 'Thỉnh tiếng chuông chùa ngân vang kèm tiếng mõ gỗ trầm ấm giúp tâm tịnh, code mượt và xua tan mọi Bug!',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Âm thanh:</span><span class="text-amber-300 font-semibold">Chuông đồng + Mõ gỗ 3D 🔔</span></div>
        `,
        getActions: () => [
          { label: '🔔 Thỉnh Đại Hồng Chung (Gõ Chuông)', primary: true, run: () => playTempleBellSound(false) },
          { label: '🙏 Cả đoàn đồng thanh khấn nguyện', primary: false, run: () => triggerMassTemplePrayers() }
        ]
      });

      // 6. SYMMETRIC PRAJNA DRUM TOWER (Lầu Trống Bát Nhã 2 Tầng Mái đối xứng bên phải tại X=35.8, Z=3.8)
      const drumTowerGroup = new THREE.Group();
      drumTowerGroup.position.set(35.8, 0, 3.8);
      const drumPod = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 2.3), stoneMat);
      drumPod.position.y = 0.125;
      drumTowerGroup.add(drumPod);
      [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]].forEach(([bx, bz]) => {
        const dPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12), redWoodMat);
        dPost.position.set(bx, 1.72, bz);
        drumTowerGroup.add(dPost);
      });
      const dRoof1 = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.72, 4), roofTileMat);
      dRoof1.rotation.y = Math.PI / 4;
      dRoof1.position.set(0, 3.55, 0);
      const dRoof2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.58, 4), roofTileMat);
      dRoof2.rotation.y = Math.PI / 4;
      dRoof2.position.set(0, 4.15, 0);
      const bigDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.68, 20), redWoodMat);
      bigDrum.rotation.x = Math.PI / 2;
      bigDrum.position.set(0, 2.25, 0);
      const drumFaceF = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.7, 20), goldMat);
      drumFaceF.rotation.x = Math.PI / 2;
      drumFaceF.position.set(0, 2.25, 0);
      drumTowerGroup.add(dRoof1, dRoof2, bigDrum, drumFaceF);
      tGroup.add(drumTowerGroup);
      registerInteractive(drumTowerGroup, {
        id: 'temple-drum-tower',
        type: 'chua',
        icon: '🥁',
        zone: 'Quần Thể Chùa Linh Ứng Zero-Bug',
        title: 'Lầu Trống Bát Nhã Đại Cát',
        desc: 'Lầu Trống Bát Nhã đối xứng với Tháp Đại Hồng Chung, nổi trống khai lễ cầu dự án thành công vang dội!',
        getMetrics: () => `<div class="flex justify-between"><span class="text-slate-400">Nghi lễ:</span><span class="text-amber-300 font-bold">Chuông Trống Bát Nhã 🔔🥁</span></div>`,
        getActions: () => [
          { label: '🥁 Nổi Trống & Thỉnh Chuông Bát Nhã', primary: true, run: () => playTempleBellSound(false) },
          { label: '🙏 Cả đoàn đồng thanh khấn nguyện', primary: false, run: () => triggerMassTemplePrayers() }
        ]
      });

      // 7. Outdoor Giant Bronze Incense Cauldron (Đỉnh Lư Hương Đồng Đại Cát tại X=30.5, Z=5.0)
      const burnerGroup = new THREE.Group();
      burnerGroup.position.set(30.5, 0.05, 5.0);
      const bPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 0.72, 16), stoneMat);
      bPedestal.position.y = 0.36;
      const bCauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.46, 0.58, 18), goldMat);
      bCauldron.position.y = 0.98;
      const bAsh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 18), new THREE.MeshStandardMaterial({ color: 0x78716c }));
      bAsh.position.y = 1.25;
      burnerGroup.add(bPedestal, bCauldron, bAsh);

      const stickMat = new THREE.MeshStandardMaterial({ color: 0x92400e });
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2;
        const rad = 0.08 + (i % 3) * 0.12;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 6), stickMat);
        st.position.set(Math.cos(ang) * rad, 1.4, Math.sin(ang) * rad);
        st.rotation.z = (Math.random() - 0.5) * 0.14;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), emberMat);
        tip.position.y = 0.175;
        st.add(tip);
        burnerGroup.add(st);
      }
      tGroup.add(burnerGroup);

      // 4 Red Kneeling Mats & Cushions across the wide Sanctuary Courtyard (X = 28.4, 29.8, 31.2, 32.6 at Z = 6.35)
      [28.4, 29.8, 31.2, 32.6].forEach(cx => {
        const matMesh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 1.15), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 }));
        matMesh.position.set(cx, 0.08, 6.35);
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.11, 16), cushionMat);
        cushion.position.set(cx, 0.14, 6.32);
        tGroup.add(matMesh, cushion);
      });

      // Donation Box (Hòm Công Đức Đại Lộc) at (33.6, 0, 5.2)
      const donationBoxGroup = new THREE.Group();
      donationBoxGroup.position.set(33.6, 0, 5.2);
      const donationBox = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.98, 0.62), redWoodMat);
      donationBox.position.set(0, 0.52, 0);
      const slotTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.07), mats.matteBlack);
      slotTop.position.set(0, 1.03, 0);
      const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.07, 0.66), goldMat);
      goldTrim.position.set(0, 1.0, 0);
      const donLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.28),
        new THREE.MeshStandardMaterial({ map: createSignTexture('HÒM CÔNG ĐỨC', 'TÍCH PHƯỚC CHỐNG BUG', '#7f1d1d', '#fde047', '#ffffff') })
      );
      donLabel.position.set(0, 0.62, 0.32);
      donationBoxGroup.add(donationBox, slotTop, goldTrim, donLabel);
      tGroup.add(donationBoxGroup);

      registerInteractive(donationBoxGroup, {
        id: 'donation-box',
        type: 'donation',
        icon: '💵',
        zone: 'Quần Thể Chùa Linh Ứng Zero-Bug',
        title: 'Hòm Công Đức Đại Lộc "Tích Đức Chống Bug"',
        desc: 'Bỏ tiền công đức để cầu hệ thống chạy mượt, lương thưởng tăng vọt và bug tự biến mất!',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Tổng quỹ công đức:</span><span class="text-amber-300 font-bold">${formatVND(state.donationTotal)}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Số lượt cúng dường:</span><span class="text-emerald-400 font-semibold">${state.donationCount} lượt 🙏</span></div>
        `,
        getActions: () => [
          { label: '💵 Công đức 500k', primary: false, run: () => spawnDonationMoney(500000, 'Anh em IT') },
          { label: '💎 Công đức 2 Triệu (Lộc Phát)', primary: true, run: () => spawnDonationMoney(2000000, 'Phòng IT') },
          { label: '👑 Sếp Minh Đăng Công đức 10 Triệu!', primary: false, run: () => spawnDonationMoney(10000000, 'Trưởng phòng Minh Đăng') },
          { label: '🔔 Thỉnh Chuông Chùa', primary: false, run: () => playTempleBellSound(false) }
        ]
      });

      // Queue Stanchions & Red Velvet Ropes along the Grand Courtyard (X = 27.6 & 33.4, Z: 7.4 -> 10.2)
      [27.6, 33.4].forEach(rx => {
        [7.4, 8.8, 10.2].forEach(rz => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.85, 8), goldMat);
          post.position.set(rx, 0.46, rz);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), goldMat);
          knob.position.set(rx, 0.9, rz);
          tGroup.add(post, knob);
        });
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.8, 8), velvetRopeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(rx, 0.72, 8.8);
        tGroup.add(rope);
      });

      // Incense Smoke rising right from Outdoor Bronze Burner (30.5, 1.5, 5.0)
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0 })
        );
        sp.position.set(30.5, 1.5, 5.0);
        sp.userData = { life: i * 0.18, offsetX: (Math.random() - 0.5) * 0.24 };
        incenseParticles.push(sp);
        scene.add(sp);
      }

      const IT_FORTUNES = [
        'Quẻ Số 68 (ĐẠI CÁT): Hôm nay push code 1 phát ăn ngay, Trưởng phòng Minh Đăng chuẩn bị ký thưởng nóng! 💰',
        'Quẻ Số 99 (THƯỢNG THƯỢNG): Hệ thống .NET 9 + Vue 3 + MongoDB chạy mượt 0 Bug, Uptime 100%! 🚀',
        'Quẻ Số 86 (LỘC PHÁT): Tester hôm nay duyệt Pass toàn bộ tính năng ngay vòng đầu tiên! ✅',
        'Quẻ Số 79 (THẦN TÀI): Tháng này có lộc lớn từ dự án mới, tiền về đầy tài khoản! 💎',
        'Quẻ Số 100 (VIÊN MÃN): Tình duyên nở rộ, công việc hanh thông, chiều nay có kèo Sếp khao! 🍻',
        'Quẻ Số 88 (ĐẠI HỶ): Xuất báo cáo Word Mẫu 2C vạn bản như một, không lệch một dòng! 📄',
        'Quẻ Số 18 (THƯỢNG CÁT): Truy vấn MongoDB 26.000 user chạy nhanh 1ms, khách hàng tấm tắc khen! 🍃',
        'Quẻ Số 39 (THẦN TÀI NHỎ): Chiều nay có đồng nghiệp mời trà sữa full topping miễn phí! 🧋',
        'Quẻ Số 66 (SONG HỶ): Code sạch không một dòng Warning, PR được merge trong 30 giây! 🌿',
        'Quẻ Số 77 (QUÝ NHÂN): Gặp bug khó tự nhiên nhớ ra giải pháp trong 1 nốt nhạc! 💡',
        'Quẻ Số 89 (TRƯỜNG THỌ): Server chạy bền bỉ xuyên năm không cần restart! 🖥️',
        'Quẻ Số 96 (PHÚ QUÝ): Cuối năm đạt danh hiệu Chiến sĩ thi đua, thưởng Tết ngập tràn! 🏆',
        'Quẻ Số 28 (BÌNH AN): Hôm nay không có cuộc gọi khẩn nào lúc nửa đêm, ngủ ngon tới sáng! 😴',
        'Quẻ Số 55 (TẤN TÀI): Dự án chính quyền số Đồng Tháp nghiệm thu xuất sắc 100 điểm! 🪷',
        'Quẻ Số 98 (ĐẠI THẮNG): Đi hát Karaoke VIP bấm chấm điểm lên ngay 100 điểm tuyệt đối! 🎤',
        'Quẻ Số 16 (LỘC QUÝ): Sắp có quyết định nâng lương trước thời hạn và khen thưởng đột xuất! 🏅',
        'Quẻ Số 26 (THUẬN LỢI): Mọi API tích hợp qua trục LGSP đều thông suốt ngay lần gọi đầu tiên! 🔗',
        'Quẻ Số 36 (TÀI LỘC): Đầu tư đâu thắng đó, ví tiền rủng rỉnh suốt cả bốn mùa! 💵',
        'Quẻ Số 38 (HỒNG PHÚC): Gia đạo bình an, sức khỏe dồi dào, lưng hết mỏi mắt hết cay! 🧘',
        'Quẻ Số 56 (BỨT PHÁ): Thuật toán mới bạn viết giúp tăng tốc hệ thống lên gấp 10 lần! ⚡',
        'Quẻ Số 69 (NHƯ Ý): Mọi yêu cầu chỉnh sửa từ khách hàng hôm nay đều cực kỳ đơn giản! 😊',
        'Quẻ Số 78 (THẦN TỐC): Build Docker & triển khai CI/CD hoàn tất chỉ trong 15 giây! 🐳',
        'Quẻ Số 81 (ĐẠI LỢI): Hồ sơ nghiệm thu được ký duyệt thần tốc, tiền dự án về ngay trong tuần! 🖊️',
        'Quẻ Số 83 (PHÁT ĐẠT): Cây phân quyền CR_UNIT_ROLE và Redis Hash vận hành hoàn hảo 100%! 🔑',
        'Quẻ Số 90 (THƯỢNG PHẨM): Giao diện Vue 3 bạn thiết kế được chọn làm mẫu chuẩn toàn đơn vị! 🎨',
        'Quẻ Số 92 (HỶ TÍN): Người độc thân sắp gặp ý trung nhân, người có đôi càng thêm gắn kết! ❤️',
        'Quẻ Số 95 (CHÍ TÔN): Uy tín chuyên môn vang xa, đồng nghiệp và lãnh đạo hết lời tin tưởng! 👑',
        'Quẻ Số 108 (VẠN SỰ AN): Tâm tịnh như nước hồ sen, mọi bug lớn nhỏ đều tự động tiêu tan! 🪷',
        'Quẻ Số 168 (NHẤT LỘ PHÁT): Con đường sự nghiệp rộng mở thênh thang, thăng tiến vượt bậc! 🌟',
        'Quẻ Số 999 (CỬU ĐỈNH HOÀNG KIM): Đại cát đại lợi, phúc lộc song toàn, cả năm 0 Bug! 🏆💰'
      ];

      const shakeFortuneTubeAction = () => {
        playWoodenFishSound();
        setTimeout(() => playWoodenFishSound(), 120);
        setTimeout(() => playDonationSound(), 280);
        const f = pickNextQuote(IT_FORTUNES, 'fortunes');
        showToast(`🎋 ${f}`);
        const speaker = embodiedCharacter || officeCharacters[0];
        if (speaker) showCharacterSpeech(speaker, f, 6.5);
      };

      registerInteractive(shrineGroup, {
        id: 'tech-temple',
        type: 'chua',
        icon: '🛕',
        zone: 'Quần Thể Chùa Linh Ứng Zero-Bug',
        title: 'Đại Hùng Bảo Điện 3 Tầng Mái (Quần Thể Chùa Tâm Linh)',
        desc: 'Quần thể chùa hoành tráng tách biệt độc lập với Cổng Tam Quan, Hồ Sen, Đại Hùng Bảo Điện 3 tầng mái, Tháp Đại Hồng Chung & Lầu Trống Bát Nhã!',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Quy mô:</span><span class="text-amber-300 font-semibold">Đại Hùng Bảo Điện 3 Tầng • Tam Quan</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Quỹ công đức:</span><span class="text-emerald-400 font-bold">${formatVND(state.donationTotal)} (${state.donationCount} lượt)</span></div>
        `,
        getActions: () => [
          { label: '🙏 Cả team xếp hàng viếng Đại Hùng Bảo Điện!', primary: true, run: () => triggerOfficeEvent('chua') },
          { label: '🎋 Lắc Ống Xăm Xin Quẻ Đại Cát!', primary: false, run: shakeFortuneTubeAction },
          { label: '🔔 Thỉnh Đại Hồng Chung (Gõ Chuông)', primary: false, run: () => playTempleBellSound(false) },
          { label: '👑 Sếp Minh Đăng Công đức 10 Triệu', primary: false, run: () => spawnDonationMoney(10000000, 'Trưởng phòng Minh Đăng') },
          { label: '💬 Đồng thanh khấn nguyện (150+ câu khấn)', primary: false, run: () => triggerMassTemplePrayers() },
          {
            label: '🕯️ Thắp thêm nhang trầm cầu Uptime',
            primary: false,
            run: () => {
              incenseActiveTimer = 30;
              playTempleBellSound(false);
              updateInspectorUI();
            }
          }
        ]
      });

      // 8. Sacred Ancient Fortune Peach Tree & 3D Fortune Tube Altar at East Courtyard (X=35.5, Z=7.5)
      const treeGroup = new THREE.Group();
      treeGroup.position.set(35.5, 0, 7.5);
      const tPot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.72, 16), goldMat);
      tPot.position.y = 0.36;
      const tTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 12), redWoodMat);
      tTrunk.position.y = 1.65;
      treeGroup.add(tPot, tTrunk);
      const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 0.65 });
      const tagRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.6 });
      for (let i = 0; i < 11; i++) {
        const ang = (i / 11) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.78;
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), blossomMat);
        crown.position.set(Math.cos(ang) * r, 2.85 + (i % 2) * 0.38, Math.sin(ang) * r);
        treeGroup.add(crown);
        if (i > 0) {
          const wishTag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.03), tagRedMat);
          wishTag.position.set(Math.cos(ang) * 0.88, 2.28, Math.sin(ang) * 0.88);
          treeGroup.add(wishTag);
        }
      }
      const treeSign = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.48, 0.07),
        new THREE.MeshStandardMaterial({ map: createSignTexture('VƯỜN ĐÀO TIÊN', 'LẮC ỐNG XĂM ĐẠI CÁT', '#831843', '#fde047', '#fbcfe8') })
      );
      treeSign.position.set(0, 1.65, 0.62);
      const fortuneStand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.74, 0.58), redWoodMat);
      fortuneStand.position.set(-0.68, 0.37, 0.52);
      const fortuneTube = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.38, 14), goldMat);
      fortuneTube.position.set(-0.68, 0.92, 0.52);
      for (let s = 0; s < 8; s++) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 6), tagRedMat);
        stick.position.set(-0.68 + Math.cos(s) * 0.06, 1.14, 0.52 + Math.sin(s) * 0.06);
        stick.rotation.z = (s - 3.5) * 0.06;
        treeGroup.add(stick);
      }
      treeGroup.add(treeSign, fortuneStand, fortuneTube);
      tGroup.add(treeGroup);

      registerInteractive(treeGroup, {
        id: 'fortune-peach-tree',
        type: 'chua',
        icon: '🎋',
        zone: 'Quần Thể Chùa Linh Ứng Zero-Bug',
        title: 'Cây Đào Tiên Cổ Thụ & Đài Xin Xăm Tử Vi IT',
        desc: 'Cây đào tiên cổ thụ treo thẻ đỏ cầu may & bàn đặt Ống Xăm Vàng trong sân Đại Hùng Bảo Điện! Bấm lắc ống xăm để rút quẻ Đại Cát.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Linh ứng:</span><span class="text-pink-400 font-bold">30 Quẻ Đại Cát 🌸</span></div>
        `,
        getActions: () => [
          {
            label: '🎋 Lắc Ống Xăm Xin Quẻ Hôm Nay!',
            primary: true,
            run: shakeFortuneTubeAction
          },
          { label: '🔔 Thỉnh Đại Hồng Chung', primary: false, run: () => playTempleBellSound(false) }
        ]
      });

      enableShadows(tGroup);
      scene.add(tGroup);
    }

    function buildNhauZone() {
      const nGroup = new THREE.Group();

      const pavementMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88 });
      const terrace = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.26, 5.2), pavementMat);
      terrace.position.set(-2.0, -0.13, 11.8);
      nGroup.add(terrace);

      const signGroup = new THREE.Group();
      signGroup.position.set(-6.4, 0, 11.8);
      signGroup.rotation.y = Math.PI / 2;
      const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), mats.matteBlack);
      poleL.position.set(-1.1, 1.15, 0);
      const poleR = poleL.clone();
      poleR.position.x = 1.1;
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.85, 0.12),
        new THREE.MeshStandardMaterial({ map: createSignTexture('BIA HƠI IT • 1 2 3 DZÔ!', 'ĐỒ NƯỚNG • MỒI BÉN • SẾP BAO', '#14532d', '#fde047', '#ffffff'), emissive: 0x166534, emissiveIntensity: 0.45 })
      );
      board.position.y = 2.05;
      signGroup.add(poleL, poleR, board);
      nGroup.add(signGroup);

      nhauNeonLight = new THREE.PointLight(0xfacc15, 2.8, 12, 1.5);
      nhauNeonLight.position.set(-2.0, 2.8, 11.8);
      nGroup.add(nhauNeonLight);

      const beerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 });
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      const stoolRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
      const stoolBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });

      const cheersNhauAction = () => {
        playSynthTone(1568, 0.08, 'sine', 0.16);
        setTimeout(() => playSynthTone(2093, 0.18, 'triangle', 0.18), 70);
        officeCharacters.forEach((c, i) => {
          if (getRoomZone(c.rig.root.position.x, c.rig.root.position.z) === 'nhau' || i < 6) {
            showCharacterSpeech(c, i === 0 ? 'Trưởng phòng Minh Đăng bao hết!! 1-2-3 DZÔ! 🍻👑' : 'KENG!! 1... 2... 3... DZÔ 100%!! 🍻🔥', 4.5);
          }
        });
        showToast('🍻 KENG!! Cả bàn đồng thanh hô: 1... 2... 3... DZÔ!! Trưởng phòng Minh Đăng khao!');
      };

      const nhauInspectorConfig = {
        id: 'nhau-zone',
        type: 'nhau',
        icon: '🍻',
        zone: 'Quán Nhậu Vỉa Hè IT',
        title: 'Quán Bia Hơi & BBQ "1-2-3 Dzô!"',
        desc: 'Tụ điểm quen thuộc ngay trước cửa công ty sau giờ tan làm: bia lạnh, lò nướng BBQ bốc khói thơm lừng, cụng ly giải sầu!',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Không khí:</span><span class="${state.activeEvent === 'nhau' ? 'text-yellow-300' : 'text-emerald-400'} font-semibold">${state.activeEvent === 'nhau' ? 'Đang 1-2-3 DZÔ cực sung 🍻' : 'Bia lạnh & Lò BBQ đỏ lửa 🔥'}</span></div>
        `,
        getActions: () => [
          { label: '🍻 Hô hào cả team đi nhậu!', primary: true, run: () => triggerOfficeEvent('nhau') },
          { label: '🥂 Cụng ly KENG! 1-2-3 DZÔ!', primary: false, run: cheersNhauAction },
          { label: '🦑 Gọi thêm Mực Nướng & Bia Lạnh', primary: false, run: () => { cheersNhauAction(); showToast('🦑 Chủ quán vừa bưng thêm 2 đĩa Mực Nướng & 1 tháp Bia Lạnh (Ghi sổ Sếp Đăng)!'); } }
        ]
      };

      [-4.2, -0.8].forEach((tx, tIdx) => {
        const tableG = new THREE.Group();
        tableG.position.set(tx, 0, 11.8);

        const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 1.15), mats.chrome);
        top.position.y = 0.62;
        tableG.add(top);
        [[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), mats.chrome);
          leg.position.set(lx, 0.31, lz);
          tableG.add(leg);
        });

        [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([mx, mz]) => {
          const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.14, 10), beerMat);
          mug.position.set(mx, 0.72, mz);
          const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.055, 0.03, 10), foamMat);
          foam.position.set(mx, 0.80, mz);
          tableG.add(mug, foam);
        });
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.03, 14), mats.ceramicWhite);
        plate.position.set(0, 0.67, 0);
        const grill = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.7 }));
        grill.position.set(0, 0.73, 0);
        tableG.add(plate, grill);

        [[-0.55, -0.88], [0.55, -0.88], [-0.55, 0.88], [0.55, 0.88]].forEach(([sx, sz], sIdx) => {
          const stool = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.38, 0.36),
            (tIdx + sIdx) % 2 === 0 ? stoolRedMat : stoolBlueMat
          );
          stool.position.set(sx, 0.19, sz);
          tableG.add(stool);
        });

        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.36), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 }));
        crate.position.set(1.15, 0.17, 0.45);
        tableG.add(crate);

        // Register every beer table as interactive so clicking any table shows "🥂 Cụng ly KENG! 1-2-3 DZÔ!"
        registerInteractive(tableG, {
          ...nhauInspectorConfig,
          id: `nhau-table-${tIdx + 1}`,
          title: `Bàn Bia Hơi & Đồ Nướng #0${tIdx + 1}`
        });

        nGroup.add(tableG);
      });

      // Prominent Smoking Charcoal BBQ Grill Cart right beside the Beer Tables (X = 1.65, Z = 11.8)
      const bbqGroup = new THREE.Group();
      bbqGroup.position.set(1.65, 0, 11.8);
      const bbqBox = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 0.72), mats.darkMetal);
      bbqBox.position.y = 0.74;
      const coals = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 0.08, 0.58),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xf97316, emissiveIntensity: 2.2 })
      );
      coals.position.y = 0.96;
      // Sizzling BBQ Skewers on the Grill
      const meatMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
      for (let k = -2; k <= 2; k++) {
        const skewer = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.52, 8), meatMat);
        skewer.rotation.x = Math.PI / 2;
        skewer.position.set(k * 0.2, 1.03, 0);
        bbqGroup.add(skewer);
      }
      // Overhead BBQ Canopy Signboard so it's impossible to miss
      [-0.54, 0.54].forEach(px => {
        const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 8), mats.chrome);
        sPost.position.set(px, 1.55, -0.28);
        bbqGroup.add(sPost);
      });
      const bbqBanner = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.44, 0.07),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('LÒ NƯỚNG BBQ', 'MỰC NƯỚNG • BÒ TẢNG', '#7c2d12', '#fde047', '#fed7aa'),
          emissive: 0x9a3412,
          emissiveIntensity: 0.5
        })
      );
      bbqBanner.position.set(0, 2.15, -0.28);
      [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), mats.chrome);
        leg.position.set(lx, 0.35, lz);
        bbqGroup.add(leg);
      });
      const bbqFireLight = new THREE.PointLight(0xf97316, 2.5, 5, 1.5);
      bbqFireLight.position.set(0, 1.25, 0);
      bbqGroup.add(bbqBox, coals, bbqBanner, bbqFireLight);
      nGroup.add(bbqGroup);

      for (let i = 0; i < 12; i++) {
        const sm = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.45 })
        );
        sm.position.set(1.65, 1.08, 11.8);
        sm.userData = { life: i * 0.18, offsetX: (Math.random() - 0.5) * 0.32 };
        bbqSmokeParticles.push(sm);
        scene.add(sm);
      }

      registerInteractive(signGroup, nhauInspectorConfig);
      registerInteractive(bbqGroup, {
        id: 'bbq-grill',
        type: 'nhau',
        icon: '🍢',
        zone: 'Quán Nhậu Vỉa Hè IT',
        title: 'Lò Nướng BBQ Than Hồng (Mực & Bò Tảng)',
        desc: 'Lò than hồng rực bốc khói nghi ngút ngay đầu bàn nhậu! Bấm cụng ly hoặc gọi thêm mồi bén cho anh em.',
        getMetrics: () => `<div class="flex justify-between"><span class="text-slate-400">Than hồng:</span><span class="text-amber-300 font-bold">Đang bốc khói thơm lừng 🔥</span></div>`,
        getActions: () => [
          { label: '🥂 Cụng ly KENG! 1-2-3 DZÔ!', primary: true, run: cheersNhauAction },
          { label: '🦑 Gọi thêm Mực Nướng & Bia Lạnh', primary: false, run: () => { cheersNhauAction(); showToast('🦑 Chủ quán vừa bưng thêm 2 đĩa Mực Nướng & 1 tháp Bia Lạnh (Ghi sổ Sếp Đăng)!'); } },
          { label: '🍻 Hô hào cả team ra nhậu', primary: false, run: () => triggerOfficeEvent('nhau') }
        ]
      });

      enableShadows(nGroup);
      scene.add(nGroup);
    }

    function buildCeilingLights() {
      const specs = [
        { zone: 'dev', x: -6.8, y: 3.65, z: 3.5 },
        { zone: 'meeting', x: -7.1, y: 3.94, z: -4.2 },
        { zone: 'reception', x: 0.8, y: 3.65, z: 2.5 },
        { zone: 'pantry', x: 6.5, y: 3.65, z: -5.8 },
        { zone: 'karaoke', x: 15.8, y: 3.65, z: -4.2 },
        { zone: 'boss', x: -15.5, y: 3.65, z: -0.8 }
      ];

      specs.forEach(s => {
        const g = new THREE.Group();
        g.position.set(s.x, s.y || 3.65, s.z);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 1.4
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 10, 28), ringMat);
        ring.rotation.x = Math.PI / 2;
        const pt = new THREE.PointLight(0xfffbeb, 3.8, 12, 1.5);
        pt.position.y = -0.25;
        g.add(ring, pt);
        scene.add(g);
        ceilingLightZones[s.zone].push({ light: pt, mat: ringMat });
      });

      // Hidden Disco Ball & 4 Rotating RGB Lights in Center
      discoGroup = new THREE.Group();
      discoGroup.position.set(0.4, 3.3, 0.2);
      const ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.38, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1, flatShading: true })
      );
      discoGroup.add(ball);

      [0xec4899, 0x38bdf8, 0xa855f7, 0x22c55e].forEach((col, idx) => {
        const dl = new THREE.PointLight(col, 8.0, 18, 1.3);
        const ang = (idx / 4) * Math.PI * 2;
        dl.position.set(Math.cos(ang) * 2.5, -0.6, Math.sin(ang) * 2.5);
        discoGroup.add(dl);
        discoLights.push(dl);
      });
      discoGroup.visible = false;
      scene.add(discoGroup);
    }

    function buildDeliveryRobot() {
      const bot = new THREE.Group();
      bot.position.set(1.8, 0, 2.2);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 18), mats.ceramicWhite);
      base.position.y = 0.14;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 18), mats.ceramicWhite);
      body.position.y = 0.56;
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.32, 0.04, 18), mats.darkMetal);
      tray.position.y = 0.72;
      const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
      cup1.position.set(-0.1, 0.81, 0);
      const cup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0xec4899 }));
      cup2.position.set(0.1, 0.81, 0.06);

      const face = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.04), mats.matteBlack);
      face.position.set(0, 0.96, 0.2);
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      eyeL.position.set(-0.06, 0.96, 0.225);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;

      bot.add(base, body, tray, cup1, cup2, face, eyeL, eyeR);
      enableShadows(bot);
      scene.add(bot);

      deliveryBot = {
        group: bot,
        turbo: false,
        wpIndex: 0,
        waypoints: [
          { x: 1.8, z: 2.2 }, { x: -2.2, z: 3.4 }, { x: -2.2, z: -0.8 },
          { x: 3.2, z: -2.8 }, { x: 4.5, z: -4.2 }, { x: 3.0, z: 3.5 }
        ]
      };

      registerInteractive(bot, {
        id: 'it-bot-mini',
        type: 'robot',
        icon: '🤖',
        zone: 'Robot Dịch Vụ Thông Minh',
        title: 'IT-Bot Mini (Giao Trà Sữa)',
        desc: 'Robot tự hành chuyên ship trà sữa & cà phê tận bàn cho các lập trình viên chạy deadline.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Chế độ chạy:</span><span class="text-sky-300 font-semibold">${deliveryBot.turbo ? '⚡ Turbo 2.5x' : 'Tuần tra êm ái'}</span></div>
        `,
        getActions: () => [
          {
            label: '🧋 Phát trà sữa toàn team (+25% ⚡)',
            primary: true,
            run: () => {
              playSynthTone(587, 0.1);
              setTimeout(() => playSynthTone(880, 0.15), 90);
              officeCharacters.forEach((c, idx) => {
                c.energy = Math.min(100, c.energy + 25);
                c.mood = Math.min(100, c.mood + 15);
                if (idx % 3 === 0) showCharacterSpeech(c, 'Cảm ơn IT-Bot! Trà sữa ngon quá 🧋', 3.5);
              });
              showToast('🧋 IT-Bot đã phát trà sữa full topping cho cả văn phòng!');
            }
          },
          {
            label: deliveryBot.turbo ? '🐢 Tắt chế độ Turbo' : '⚡ Bật chế độ Turbo',
            primary: false,
            run: () => {
              deliveryBot.turbo = !deliveryBot.turbo;
              updateInspectorUI();
            }
          }
        ]
      });
    }

    function buildOfficeCorgi() {
      const dog = new THREE.Group();
      dog.position.set(-1.2, 0, 1.8);

      const furGold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });
      const furWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      const noseBlack = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
      const collarRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });

      // Plump Corgi Torso + White Chest
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.56), furGold);
      body.position.set(0, 0.25, 0);
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.22), furWhite);
      chest.position.set(0, 0.23, 0.2);
      const rump = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), furWhite);
      rump.position.set(0, 0.26, -0.26);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), collarRed);
      collar.position.set(0, 0.28, 0.23);

      // Corgi Head, Snout & Big Perky Ears
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.38, 0.28);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.22), furGold);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), furWhite);
      snout.position.set(0, -0.03, 0.15);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), noseBlack);
      nose.position.set(0, 0, 0.22);
      [-0.07, 0.07].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), noseBlack);
        eye.position.set(ex, 0.04, 0.11);
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 4), furGold);
        ear.position.set(ex * 1.35, 0.16, -0.02);
        ear.rotation.z = ex > 0 ? -0.2 : 0.2;
        headGroup.add(eye, ear);
      });
      headGroup.add(skull, snout, nose);

      // 4 Stubby Corgi Legs
      const legs = [];
      [[-0.09, 0.18], [0.09, 0.18], [-0.09, -0.18], [0.09, -0.18]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), furWhite);
        leg.position.set(lx, 0.08, lz);
        dog.add(leg);
        legs.push(leg);
      });

      // Wagging Tail Pivot
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0.32, -0.29);
      const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), furGold);
      tailMesh.position.set(0, 0.04, -0.04);
      tailPivot.add(tailMesh);

      dog.add(body, chest, rump, collar, headGroup, tailPivot);
      enableShadows(dog);
      scene.add(dog);

      // Floating Tag & Speech Bubble for Boss Corgi
      const tagsLayer = document.getElementById('character-tags-layer');
      const speechLayer = document.getElementById('speech-bubbles-layer');
      const tagEl = document.createElement('div');
      tagEl.className = 'char-tag px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-400/50 text-[10px] font-bold text-amber-200 whitespace-nowrap shadow-md';
      tagEl.textContent = '🐶 Boss Corgi • Giám Đốc Tinh Thần';
      tagsLayer.appendChild(tagEl);

      const speechEl = document.createElement('div');
      speechEl.className = 'speech-bubble px-2.5 py-1 rounded-xl bg-amber-100 text-slate-900 text-[11px] font-bold shadow-lg whitespace-nowrap opacity-0';
      speechLayer.appendChild(speechEl);

      officeCorgi = {
        group: dog,
        headGroup,
        tailPivot,
        legs,
        followPlayer: true,
        wpIndex: 0,
        tagEl,
        speechEl,
        speechTimer: 0,
        waypoints: [
          { x: -1.2, z: 1.8 }, { x: -14.0, z: -0.8 }, { x: -2.2, z: 3.2 },
          { x: 3.2, z: 6.5 }, { x: 15.2, z: 7.2 }, { x: -1.8, z: 11.2 }
        ]
      };

      const barkCorgi = (msg = 'Gâu gâu!! Chúc Sếp Minh Đăng & anh em IT hôm nay 0 Bug, tiền về ngập két! 🐶🦴') => {
        playSynthTone(680, 0.07, 'triangle', 0.14);
        setTimeout(() => playSynthTone(860, 0.09, 'triangle', 0.16), 95);
        officeCorgi.speechEl.textContent = msg;
        officeCorgi.speechEl.style.opacity = '1';
        officeCorgi.speechTimer = 5.0;
      };

      registerInteractive(dog, {
        id: 'office-corgi',
        type: 'pet',
        icon: '🐶',
        zone: 'Thú Cưng Văn Phòng IT',
        title: 'Boss Corgi Vàng (Giám Đốc Tinh Thần)',
        desc: 'Chú chó Corgi chân ngắn đáng yêu nhất phòng IT! Luôn chạy lon ton bám theo chân bạn để tiếp thêm 100% năng lượng tích cực.',
        getMetrics: () => `
          <div class="flex justify-between"><span class="text-slate-400">Trạng thái:</span><span class="text-amber-300 font-bold">${officeCorgi.followPlayer ? '🐾 Đang chạy bám theo chân bạn' : '🐕 Đang tự đi tuần tra'}</span></div>
        `,
        getActions: () => [
          {
            label: officeCorgi.followPlayer ? '🐕 Cho Corgi tự đi dạo' : '🐾 Gọi Boss Corgi chạy theo chân mình!',
            primary: true,
            run: () => {
              officeCorgi.followPlayer = !officeCorgi.followPlayer;
              barkCorgi(officeCorgi.followPlayer ? 'Gâu gâu!! Đợi em chạy theo chân Sếp với! 🐾🐶' : 'Gâu! Để em đi tuần tra quanh văn phòng nhé! 🐕');
              updateInspectorUI();
            }
          },
          {
            label: '🦴 Thưởng Xúc Xích Nướng (+100% Vui cả phòng)',
            primary: false,
            run: () => {
              barkCorgi('Gâu gâu!! Xúc xích BBQ ngon bá cháy! Yêu cả phòng IT! 🦴❤️');
              officeCharacters.forEach(c => { c.mood = 100; });
              showToast('🐶 Boss Corgi vừa làm trò xoay vòng, cả văn phòng tăng 100% Tâm trạng!');
            }
          }
        ]
      });
    }

    // =========================================================================
    // 5. HUMANOID 3D CHARACTERS & THE SIMS-STYLE AI
    // =========================================================================
    function createHumanoidRig(opts) {
      const root = new THREE.Group();
      const bodyPivot = new THREE.Group();
      root.add(bodyPivot);

      const skinMat = new THREE.MeshStandardMaterial({ color: opts.skin || 0xf3c693, roughness: 0.62 });
      const lipMat = new THREE.MeshStandardMaterial({ color: 0xe17065, roughness: 0.55 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirt || 0x3b82f6, roughness: 0.68 });
      const whiteShirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: opts.pants || 0x1e293b, roughness: 0.8 });
      const hairMat = new THREE.MeshStandardMaterial({ color: opts.hair || 0x1c1917, roughness: 0.72 });
      const shoeUpperMat = new THREE.MeshStandardMaterial({ color: opts.isBoss ? 0x1e1b4b : 0x334155, roughness: 0.55 });
      const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
      const goldAccentMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.8 });

      // 1. Sculpted Pelvis, Belt & Anatomical Torso
      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.142, 0.15, 16), pantsMat);
      pelvis.scale.set(1.06, 1.0, 0.8);
      pelvis.position.y = 0.82;

      // Leather Belt + Metallic Buckle
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.155, 0.04, 16), beltMat);
      belt.scale.set(1.06, 1.0, 0.82);
      belt.position.y = 0.895;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.025), opts.isBoss ? goldAccentMat : mats.chrome);
      buckle.position.set(0, 0.895, 0.125);

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.162, 0.28, 8, 16), shirtMat);
      torso.scale.set(1.12, 1.0, 0.76);
      torso.position.y = 1.08;

      // Collar & Office Attire Details (Boss Executive Suit + Tie vs IT Staff Polo Collar + Lanyard ID Badge)
      const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.08), opts.isBoss ? whiteShirtMat : shirtMat);
      collarL.position.set(-0.045, 1.32, 0.045);
      collarL.rotation.z = 0.35;
      const collarR = collarL.clone();
      collarR.position.x = 0.045;
      collarR.rotation.z = -0.35;

      bodyPivot.add(pelvis, belt, buckle, torso, collarL, collarR);

      if (opts.isBoss) {
        // Executive White Shirt Front, Red-Gold Silk Necktie & Golden Crown Lapel Pin for Boss Minh Đăng
        const dressShirt = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.03), whiteShirtMat);
        dressShirt.position.set(0, 1.17, 0.115);
        const tieMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
        const tieKnot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), tieMat);
        tieKnot.position.set(0, 1.28, 0.13);
        const tieBody = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.21, 0.025), tieMat);
        tieBody.position.set(0, 1.15, 0.132);
        const lapelPin = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), goldAccentMat);
        lapelPin.position.set(0.085, 1.23, 0.128);
        bodyPivot.add(dressShirt, tieKnot, tieBody, lapelPin);
      } else {
        // IT Staff Lanyard Strap & Glowing ID Card Badge on Chest
        const lanyardMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
        const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.18, 0.015), lanyardMat);
        strapL.position.set(-0.032, 1.22, 0.125);
        strapL.rotation.z = -0.18;
        const strapR = strapL.clone();
        strapR.position.x = 0.032;
        strapR.rotation.z = 0.18;
        const badgeHolder = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.075, 0.012), whiteShirtMat);
        badgeHolder.position.set(0, 1.10, 0.132);
        const badgePhoto = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.032, 0.014), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        badgePhoto.position.set(0, 1.115, 0.133);
        bodyPivot.add(strapL, strapR, badgeHolder, badgePhoto);
      }

      // 2. Sculpted Head, Ears, 3-Layer Expressive Eyes, Eyebrows, Nose & Smile
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 1.36, 0);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 12), skinMat);
      neck.position.y = 0.025;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.146, 22, 18), skinMat);
      head.scale.set(0.95, 1.08, 0.98);
      head.position.y = 0.165;
      headGroup.add(neck, head);

      // 3D Ears on Both Sides
      [-0.138, 0.138].forEach(earX => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), skinMat);
        ear.scale.set(0.55, 1.15, 0.75);
        ear.position.set(earX, 0.16, 0.0);
        headGroup.add(ear);
      });

      // 3-Layer Expressive Eyes (White Sclera + Dark Iris + Sparkling White Catchlight) & Eyebrows
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const irisMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });
      const browMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
      [-0.048, 0.048].forEach((ex, eIdx) => {
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), scleraMat);
        sclera.scale.set(1.15, 0.92, 0.55);
        sclera.position.set(ex, 0.172, 0.128);

        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 10, 10), irisMat);
        iris.scale.set(1.0, 1.05, 0.6);
        iris.position.set(ex, 0.172, 0.137);

        const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 6, 6), scleraMat);
        catchlight.position.set(ex + 0.005, 0.177, 0.144);

        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.0085, 0.012), browMat);
        brow.position.set(ex, 0.205, 0.134);
        brow.rotation.z = eIdx === 0 ? 0.06 : -0.06;

        headGroup.add(sclera, iris, catchlight, brow);
      });

      // 3D Sculpted Nose & Friendly Smile Lips
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.042, 8), skinMat);
      nose.rotation.x = Math.PI * 0.42;
      nose.position.set(0, 0.148, 0.146);

      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0055, 8, 14, Math.PI), lipMat);
      smile.rotation.x = Math.PI;
      smile.position.set(0, 0.118, 0.133);
      headGroup.add(nose, smile);

      // Detailed Eyeglasses with Nose Bridge & Temple Arms
      if (opts.glasses) {
        const frameMat = new THREE.MeshStandardMaterial({ color: opts.isBoss ? 0xfbbf24 : 0x0f172a, roughness: 0.25, metalness: 0.7 });
        [-0.048, 0.048].forEach(gx => {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0045, 8, 16), frameMat);
          rim.position.set(gx, 0.172, 0.142);
          const templeArm = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.13), frameMat);
          templeArm.position.set(gx > 0 ? 0.082 : -0.082, 0.174, 0.075);
          headGroup.add(rim, templeArm);
        });
        const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.036, 6), frameMat);
        bridge.rotation.z = Math.PI / 2;
        bridge.position.set(0, 0.175, 0.143);
        headGroup.add(bridge);
      }

      // 3. Sculpted Multi-Part 3D Hairstyles with Bangs & Sideburns
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.153, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
      hairCap.position.y = 0.178;
      headGroup.add(hairCap);

      if (opts.hairStyle === 0) {
        // Handsome Mens Side-Part Quiff + Sideburns
        const quiff = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 6, 10), hairMat);
        quiff.rotation.z = Math.PI / 2 - 0.18;
        quiff.position.set(0.015, 0.268, 0.105);
        [-0.132, 0.132].forEach(sx => {
          const burn = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.045), hairMat);
          burn.position.set(sx, 0.185, 0.02);
          headGroup.add(burn);
        });
        headGroup.add(quiff);
      } else if (opts.hairStyle === 1) {
        // Layered Bob Hair with Front Bangs & Cheek Locks
        const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.156, 0.19, 16, 1, false, Math.PI * 0.5, Math.PI), hairMat);
        bob.position.set(0, 0.115, -0.02);
        const bangs = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.13, 6, 10), hairMat);
        bangs.rotation.z = Math.PI / 2;
        bangs.position.set(0, 0.248, 0.112);
        [-0.125, 0.125].forEach(lx => {
          const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 6, 8), hairMat);
          lock.position.set(lx, 0.12, 0.055);
          headGroup.add(lock);
        });
        headGroup.add(bob, bangs);
      } else if (opts.hairStyle === 2) {
        // High Ponytail with Scrunchie & Swept Front Bangs
        const bangs = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.125, 6, 10), hairMat);
        bangs.rotation.z = Math.PI / 2;
        bangs.position.set(0, 0.248, 0.112);
        const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 8, 12), new THREE.MeshStandardMaterial({ color: 0xf43f5e }));
        scrunchie.position.set(0, 0.19, -0.145);
        const pony = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.17, 6, 10), hairMat);
        pony.position.set(0, 0.12, -0.185);
        pony.rotation.x = 0.42;
        headGroup.add(bangs, scrunchie, pony);
      }
      bodyPivot.add(headGroup);

      // 4. Articulated Arms with Sleeve Cuffs, Smartwatch, Thumb Hands & Interactive Props
      const buildArm = (xOffset, isRight) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(xOffset, 1.24, 0);
        const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.18, 6, 10), shirtMat);
        upperArm.position.y = -0.11;
        shoulder.add(upperArm);

        const elbow = new THREE.Group();
        elbow.position.set(0, -0.22, 0);
        const foreArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.041, 0.17, 6, 10), opts.isBoss ? shirtMat : skinMat);
        foreArm.position.y = -0.1;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 10), skinMat);
        hand.scale.set(0.88, 1.08, 0.95);
        hand.position.y = -0.21;
        const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.025, 4, 6), skinMat);
        thumb.position.set(isRight ? -0.028 : 0.028, -0.20, 0.025);
        thumb.rotation.x = 0.45;
        elbow.add(foreArm, hand, thumb);

        if (!isRight) {
          // Smartwatch / Rolex on Left Wrist
          const watchBand = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.024, 12), opts.isBoss ? goldAccentMat : beltMat);
          watchBand.position.y = -0.165;
          const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.015), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
          watchFace.position.set(0, -0.165, 0.04);
          elbow.add(watchBand, watchFace);
        }
        shoulder.add(elbow);

        let coffeeCup = null;
        let beerMug = null;
        let microphone = null;
        let incenseSticks = null;
        let banknote = null;
        if (isRight) {
          coffeeCup = new THREE.Group();
          coffeeCup.position.set(0, -0.23, 0.055);
          const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.09, 10), mats.ceramicWhite);
          const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.033, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0xea580c }));
          coffeeCup.add(cupMesh, sleeve);
          coffeeCup.visible = false;
          elbow.add(coffeeCup);

          beerMug = new THREE.Group();
          beerMug.position.set(0, -0.23, 0.065);
          const mugGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 }));
          const mugFoam = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.045, 0.032, 10), mats.ceramicWhite);
          mugFoam.position.y = 0.07;
          beerMug.add(mugGlass, mugFoam);
          beerMug.visible = false;
          elbow.add(beerMug);

          microphone = new THREE.Group();
          microphone.position.set(0, -0.22, 0.06);
          microphone.rotation.x = Math.PI / 3;
          const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.16, 8), mats.darkMetal);
          const micBall = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), mats.chrome);
          micBall.position.y = 0.095;
          microphone.add(micBody, micBall);
          microphone.visible = false;
          elbow.add(microphone);

          incenseSticks = new THREE.Group();
          incenseSticks.position.set(-0.08, -0.2, 0.09);
          incenseSticks.rotation.x = 0.25;
          [-0.016, 0, 0.016].forEach(ox => {
            const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0x92400e }));
            st.position.set(ox, 0.14, 0);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4500 }));
            tip.position.y = 0.145;
            st.add(tip);
            incenseSticks.add(st);
          });
          incenseSticks.visible = false;
          elbow.add(incenseSticks);

          banknote = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.01, 0.055),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.3 })
          );
          banknote.position.set(0, -0.22, 0.08);
          banknote.visible = false;
          elbow.add(banknote);
        }

        bodyPivot.add(shoulder);
        return { shoulder, elbow, coffeeCup, beerMug, microphone, incenseSticks, banknote };
      };
      const leftArm = buildArm(-0.235, false);
      const rightArm = buildArm(0.235, true);

      // 5. Articulated Legs with Two-Tone Sneakers (Upper + Rounded Toe + Thick White Sole)
      const buildLeg = (xOffset) => {
        const hip = new THREE.Group();
        hip.position.set(xOffset, 0.78, 0);
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.28, 6, 10), pantsMat);
        thigh.position.y = -0.18;
        hip.add(thigh);

        const knee = new THREE.Group();
        knee.position.set(0, -0.38, 0);
        const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.28, 6, 10), pantsMat);
        shin.position.y = -0.18;

        const shoeGroup = new THREE.Group();
        shoeGroup.position.set(0, -0.37, 0.038);
        const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.055, 0.19), shoeUpperMat);
        shoeUpper.position.y = 0.01;
        const shoeToe = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), shoeUpperMat);
        shoeToe.scale.set(1.0, 0.65, 1.15);
        shoeToe.position.set(0, 0.0, 0.075);
        const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.026, 0.225), shoeSoleMat);
        shoeSole.position.set(0, -0.024, 0.012);
        shoeGroup.add(shoeUpper, shoeToe, shoeSole);

        knee.add(shin, shoeGroup);
        hip.add(knee);

        bodyPivot.add(hip);
        return { hip, knee };
      };
      const leftLeg = buildLeg(-0.095);
      const rightLeg = buildLeg(0.095);

      enableShadows(root);
      return { root, bodyPivot, headGroup, leftArm, rightArm, leftLeg, rightLeg };
    }

    // 2D AABB Collision Boxes for Walls, Glass Partitions & Major Furniture (character radius ~0.35m padded in)
    // Doorways purposefully left open:
    // - Boss Office Doorway: X = -12.0, Z in [-1.85, 0.25]
    // - Meeting Room Glass Door: Z = -2.2, X in [-4.25, -2.75]
    // - Server Room Glass Door: X = 5.5, Z in [4.85, 6.55]
    // - Karaoke VIP Room Doorway: X = 12.0, Z in [-4.2, -2.35]
    // - Main Front Office Entrance (to Nhậu Zone & Temple Path): Z = 8.85, X in [0.8, 5.1]
    const WALL_COLLIDER_BOXES = [
      // 1. Boss Minh Đăng Office Outer Walls & Partition Wall (X = -12.0)
      { minX: -19.5, maxX: -18.3, minZ: -5.5, maxZ: 3.8 },     // Boss West wall
      { minX: -19.2, maxX: -11.9, minZ: -5.3, maxZ: -4.35 },   // Boss North wall
      { minX: -19.2, maxX: -11.9, minZ: 2.78, maxZ: 3.7 },     // Boss South glass wall
      { minX: -12.42, maxX: -11.58, minZ: -9.5, maxZ: -1.82 }, // West wall North of Boss doorway
      { minX: -12.42, maxX: -11.58, minZ: 0.22, maxZ: 9.2 },   // West wall South of Boss doorway

      // 2. Main Office Outer Walls (North Z = -9.0, East X = 12.0, South Z = 8.85)
      { minX: -12.5, maxX: 19.5, minZ: -9.5, maxZ: -8.42 },    // Entire North back wall (Main + Karaoke)
      { minX: 11.58, maxX: 12.42, minZ: -9.2, maxZ: -4.18 },   // East wall North of Karaoke doorway
      { minX: 11.58, maxX: 12.42, minZ: -2.38, maxZ: 9.2 },    // East wall South of Karaoke doorway (including Server Room East wall)
      { minX: -12.5, maxX: 0.85, minZ: 8.48, maxZ: 9.22 },     // South front boundary West of Main Entrance
      { minX: 5.05, maxX: 12.5, minZ: 8.48, maxZ: 9.22 },      // South front boundary East of Main Entrance (Server Room South wall)

      // 3. Meeting Room Glass Partitions (X = -2.2 and Z = -2.2, leaving door at X in [-4.25, -2.75])
      { minX: -2.58, maxX: -1.82, minZ: -9.0, maxZ: -1.85 },   // Meeting Room East glass wall
      { minX: -12.2, maxX: -4.22, minZ: -2.58, maxZ: -1.82 },   // Meeting Room South glass wall (West segment)
      { minX: -2.78, maxX: -1.82, minZ: -2.58, maxZ: -1.82 },   // Meeting Room South glass wall (East corner segment)

      // 4. Server Room Glass Partitions (Z = 2.2 and X = 5.5, leaving door at Z in [4.85, 6.55])
      { minX: 5.15, maxX: 12.2, minZ: 1.82, maxZ: 2.58 },      // Server Room North glass wall (blocks walking straight down into Server Room!)
      { minX: 5.12, maxX: 5.88, minZ: 1.85, maxZ: 4.88 },      // Server Room West glass wall (North of glass door)
      { minX: 5.12, maxX: 5.88, minZ: 6.52, maxZ: 9.1 },       // Server Room West glass wall (South of glass door)

      // 5. Karaoke VIP Room Outer Walls & Partition with Temple Courtyard (Z = 0.45)
      { minX: 18.42, maxX: 19.6, minZ: -9.2, maxZ: 0.85 },     // Karaoke East outer wall
      { minX: 11.8, maxX: 19.5, minZ: 0.05, maxZ: 0.85 },      // Solid partition wall between Karaoke VIP Room and Temple Courtyard

      // 6. Major Furniture & Obstacles (Server Racks, Desks, Conference Table, Grand Temple & Koi Pond)
      { minX: -16.75, maxX: -15.35, minZ: -2.0, maxZ: 0.5 },   // Boss Minh Đăng L-Desk
      { minX: -16.45, maxX: -13.95, minZ: -4.55, maxZ: -2.65 },// Boss VIP Sofa & Tea Table
      { minX: -9.85, maxX: -4.45, minZ: -6.55, maxZ: -4.45 },  // Enlarged Meeting Room Conference Table (5.4m x 1.95m)
      { minX: -10.35, maxX: -3.25, minZ: 0.72, maxZ: 2.18 },   // Dev Desk Cluster Row 1
      { minX: -10.35, maxX: -3.25, minZ: 4.72, maxZ: 6.18 },   // Dev Desk Cluster Row 2
      { minX: 0.15, maxX: 2.85, minZ: 4.88, maxZ: 5.92 },      // Reception Desk
      { minX: 6.9, maxX: 11.45, minZ: 3.45, maxZ: 4.85 },      // Server Racks Row 1 (Rack #01 & #02)
      { minX: 6.9, maxX: 11.45, minZ: 5.95, maxZ: 7.35 },      // Server Racks Row 2 (Rack #03 & #04)
      { minX: 14.6, maxX: 17.0, minZ: -6.55, maxZ: -5.25 },    // Karaoke Marble Table
      { minX: 13.35, maxX: 17.75, minZ: -8.35, maxZ: -7.3 },   // Karaoke North Sofa
      { minX: 14.1, maxX: 18.9, minZ: 2.2, maxZ: 7.0 },        // Outdoor Zen Garden Koi Pond
      { minX: 26.3, maxX: 34.7, minZ: -2.6, maxZ: 3.0 },       // Grand Temple Main Sanctuary (Đại Hùng Bảo Điện 3-Tiered Podium)
      { minX: 24.0, maxX: 26.4, minZ: 2.6, maxZ: 5.0 },        // Grand Temple Bell Tower (Tháp Đại Hồng Chung)
      { minX: 34.6, maxX: 37.0, minZ: 2.6, maxZ: 5.0 }         // Grand Temple Drum Tower (Lầu Trống Bát Nhã)
    ];

    function isWalkablePosition(x, z) {
      if (x < -18.35 || x > 39.2 || z < -8.45 || z > 15.2) return false;
      if (x < -12.25 && (z < -4.35 || z > 2.78)) return false;
      for (let i = 0; i < WALL_COLLIDER_BOXES.length; i++) {
        const b = WALL_COLLIDER_BOXES[i];
        if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
          return false;
        }
      }
      return true;
    }

    function moveBossWithCollision(pos, dx, dz) {
      const nextX = pos.x + dx;
      if (isWalkablePosition(nextX, pos.z)) {
        pos.x = nextX;
      }
      const nextZ = pos.z + dz;
      if (isWalkablePosition(pos.x, nextZ)) {
        pos.z = nextZ;
      }
      // Auto-open Hinged Glass Doors when approaching them
      if (Math.hypot(pos.x - (-3.5), pos.z - (-2.2)) < 1.65) {
        triggerAutoDoor('meeting');
      }
      if (Math.hypot(pos.x - 5.5, pos.z - 5.7) < 1.65) {
        triggerAutoDoor('server');
      }
    }

    function getRoomZone(x, z) {
      if (x < -12.1) return 'boss';
      if (x > 21.0 && z >= -4.5) return 'chua';
      if (x > 12.1 && z < 0.8) return 'karaoke';
      if (x > 12.1 && z >= 0.8) return 'chua';
      if (z > 9.1) return 'nhau';
      if (x < -2.2 && z < -2.2) return 'meeting';
      if (x > 5.3 && z > 2.2) return 'server';
      if (x > 1.8 && z <= 2.2) return 'pantry';
      if (x < -2.2 && z >= -2.2) return 'dev';
      return 'central';
    }

    // Exact 8 coordinates of the 8 real 3D red/blue plastic stools at the 2 Beer Tables
    const REAL_NHAU_STOOLS = [
      { x: -4.75, z: 10.92, rotY: 0, side: 'north' },
      { x: -3.65, z: 10.92, rotY: 0, side: 'north' },
      { x: -4.75, z: 12.68, rotY: Math.PI, side: 'south' },
      { x: -3.65, z: 12.68, rotY: Math.PI, side: 'south' },
      { x: -1.35, z: 10.92, rotY: 0, side: 'north' },
      { x: -0.25, z: 10.92, rotY: 0, side: 'north' },
      { x: -1.35, z: 12.68, rotY: Math.PI, side: 'south' },
      { x: -0.25, z: 12.68, rotY: Math.PI, side: 'south' }
    ];

    function isOnRealNhauStool(x, z) {
      for (let i = 0; i < REAL_NHAU_STOOLS.length; i++) {
        const st = REAL_NHAU_STOOLS[i];
        if (Math.hypot(x - st.x, z - st.z) < 0.28) return true;
      }
      return false;
    }

    function buildSmartRoute(fromX, fromZ, destType, charObj) {
      const path = [];
      const startZone = getRoomZone(fromX, fromZ);
      const stayingInTemple = (startZone === 'chua' && (destType === 'chua' || destType === 'donate'));

      if (startZone === 'boss') {
        if (fromX < -15.3) {
          path.push({ x: fromX, z: 1.25, act: 'Bước vòng qua bàn Trưởng phòng...' });
        }
        path.push({ x: -13.6, z: 1.25, act: 'Rời bàn Trưởng phòng Minh Đăng...' });
        path.push({ x: -13.2, z: -0.8, act: 'Tiến ra cửa Phòng Trưởng Phòng...' });
        path.push({ x: -10.8, z: -0.8, act: 'Bước qua cửa kính Phòng Trưởng Phòng...' });
        path.push({ x: -2.0, z: -0.8, act: 'Đi ra sảnh trung tâm...' });
      } else if (startZone === 'karaoke') {
        path.push({ x: 13.0, z: -3.3, act: 'Rời phòng hát Karaoke...' });
        path.push({ x: 10.2, z: -3.3, act: 'Đi qua khu Lounge...' });
        path.push({ x: 3.2, z: -1.8, act: 'Quay lại văn phòng chính...' });
      } else if (startZone === 'chua' && !stayingInTemple) {
        path.push({ x: 22.2, z: 9.8, act: 'Rời Cổng Tam Quan Quần Thể Chùa Linh Ứng...' });
        path.push({ x: 3.5, z: 9.8, act: 'Đi dọc đại lộ đá về văn phòng...' });
        path.push({ x: 3.5, z: 6.5, act: 'Bước vào sảnh văn phòng...' });
      } else if (startZone === 'nhau') {
        path.push({ x: 2.5, z: 9.6, act: 'Rời quán nhậu vỉa hè...' });
        path.push({ x: 2.5, z: 6.5, act: 'Quay lại văn phòng...' });
      } else if (startZone === 'meeting') {
        path.push({ x: -3.5, z: -3.4, act: 'Rời phòng họp...', trigger: 'door-meeting' });
        path.push({ x: -3.5, z: -1.0, act: 'Đi ra hành lang trung tâm...' });
      } else if (startZone === 'server') {
        path.push({ x: 6.4, z: 5.7, act: 'Mở cửa rời phòng Server...', trigger: 'door-server' });
        path.push({ x: 4.1, z: 5.7, act: 'Đi ra khu vực trung tâm...' });
      } else if (startZone === 'dev') {
        const aisleZ = fromZ > 3.5 ? 6.6 : 2.6;
        path.push({ x: fromX, z: aisleZ, act: 'Rời khỏi bàn làm việc...' });
        path.push({ x: -2.1, z: aisleZ, act: 'Đi ra lối đi chung...' });
      } else if (startZone === 'pantry') {
        path.push({ x: 3.2, z: -1.6, act: 'Rời khu Pantry & Lounge...' });
      }

      if (destType === 'work' && charObj.homeSeat) {
        const hs = charObj.homeSeat;
        if (hs.zone === 'boss') {
          path.push({ x: -2.0, z: -0.8, act: 'Đi về Phòng Trưởng Phòng VIP...' });
          path.push({ x: -11.5, z: -0.8, act: 'Bước vào Phòng Trưởng Phòng Minh Đăng 👑' });
          path.push({ x: -13.6, z: 1.25, act: 'Đi vòng qua bàn điều hành...' });
          path.push({ x: hs.x, z: 1.25, act: 'Vào ghế Chủ tịch Trưởng phòng...' });
          path.push({ x: hs.x, z: hs.z, finalPose: 'sitting-work', faceRotY: hs.rotY, act: 'Đang điều hành & kiến trúc hệ thống (.NET 9 / Vue 3 / MongoDB) 👑', emoji: '👑' });
        } else if (hs.zone === 'dev') {
          const aisleZ = hs.z > 3.5 ? 6.6 : 2.6;
          path.push({ x: -2.1, z: aisleZ, act: 'Quay lại khu Dev...' });
          path.push({ x: hs.x, z: aisleZ, act: 'Về lại chỗ ngồi...' });
          path.push({ x: hs.x, z: hs.z, finalPose: 'sitting-work', faceRotY: hs.rotY, act: 'Đang tập trung code dự án 💻', emoji: '💻' });
        } else if (hs.zone === 'meeting') {
          path.push({ x: -3.5, z: -1.0, act: 'Đi tới Phòng họp...', trigger: 'door-meeting' });
          path.push({ x: -3.5, z: -3.5, act: 'Bước vào Phòng họp...' });
          path.push({ x: hs.x, z: hs.z, finalPose: 'sitting-meeting', faceRotY: hs.rotY, act: 'Đang họp bàn kế hoạch Sprint 📊', emoji: '📊' });
        }
      } else if (destType === 'coffee') {
        path.push({ x: 2.8, z: -2.5, act: 'Đi sang khu Pantry...' });
        path.push({ x: 3.2, z: -7.5, finalPose: 'coffee', faceX: 3.2, faceZ: -8.3, act: 'Đang pha Espresso cực thơm ☕', emoji: '☕', trigger: 'coffee' });
      } else if (destType === 'arcade') {
        path.push({ x: 3.5, z: -2.8, act: 'Đi sang khu Lounge...' });
        path.push({ x: 10.2, z: -5.8, finalPose: 'arcade', faceX: 11.2, faceZ: -5.8, act: 'Đang chơi máy Arcade xả stress 🕹️', emoji: '🕹️' });
      } else if (destType === 'relax') {
        path.push({ x: 3.5, z: -2.8, act: 'Đi sang góc thư giãn Lounge...' });
        path.push({ x: 9.2 + (charObj.phase % 1.2), z: -6.8, finalPose: 'idle', faceX: 9.8, faceZ: -8.2, act: 'Đang nghỉ ngơi hồi phục năng lượng 🛋️', emoji: '🛋️' });
      } else if (destType === 'server') {
        path.push({ x: 4.1, z: 5.7, act: 'Tiến tới cửa Phòng Server...', trigger: 'door-server' });
        path.push({ x: 7.2 + (charObj.phase % 2), z: 5.5, finalPose: 'idle', faceX: 9.5, faceZ: 4.5, act: 'Đang kiểm tra tủ Rack Server 🖥️', emoji: '🖥️' });
      } else if (destType === 'meeting') {
        path.push({ x: -3.5, z: -1.0, act: 'Đi tới Phòng họp kính...', trigger: 'door-meeting' });
        path.push({ x: -5.0, z: -4.8, finalPose: 'idle', faceX: -7.2, faceZ: -8.5, act: 'Đang trao đổi trong Phòng họp 📊', emoji: '📊' });
      } else if (destType === 'pizza') {
        const angle = (charObj.phase || 0) * 1.3;
        const px = 4.5 + Math.cos(angle) * 1.45;
        const pz = -4.3 + Math.sin(angle) * 0.85;
        path.push({ x: 2.6, z: -2.6, act: 'Chạy sang Pantry ăn Pizza! 🍕' });
        path.push({ x: px, z: pz, finalPose: 'coffee', faceX: 4.5, faceZ: -5.6, act: 'Đang ăn Pizza & uống trà sữa cực đã 🍕🧋', emoji: '🍕' });
      } else if (destType === 'karaoke') {
        const slot = typeof charObj.karaokeSlot === 'number'
          ? charObj.karaokeSlot
          : (Math.floor((charObj.phase || 0) * 10) % 8);
        // 8 vị trí chuẩn trong Phòng Hát (tuyệt đối không đâm xuyên bàn kính x=15.8, z=-5.9)
        const spots = [
          { x: 16.05, z: -2.15, pose: 'sing', act: 'Đang cầm mic lĩnh xướng trên sân khấu! 🎤' },
          { x: 16.05, z: -2.85, pose: 'sing', act: 'Đang song ca cực cháy trên sân khấu! 🎤' },
          { x: 17.35, z: -3.95, pose: 'dance', act: 'Đang quẩy trước màn hình TV Karaoke! 🎶' },
          { x: 16.65, z: -4.45, pose: 'dance', act: 'Đang phiêu theo điệu nhạc sống! 🕺' },
          { x: 17.45, z: -5.25, pose: 'dance', act: 'Vỗ tay cổ vũ ca sĩ cực nhiệt! 👏' },
          { x: 14.95, z: -7.15, pose: 'dance', act: 'Đang đứng cạnh ghế Sofa nâng ly cổ vũ! 🍻' },
          { x: 16.35, z: -7.15, pose: 'dance', act: 'Đang chọn bài tiếp theo trong danh sách! 🎵' },
          { x: 14.55, z: -4.65, pose: 'dance', act: 'Đang hú hét cổ vũ đồng nghiệp! 🔥' }
        ];
        const sp = spots[slot % spots.length];
        path.push({ x: 3.5, z: -2.8, act: 'Đi về hướng phòng Hát Karaoke...' });
        path.push({ x: 10.2, z: -3.3, act: 'Băng qua khu Lounge...' });
        path.push({ x: 13.2, z: -3.3, act: 'Bước vào Phòng Karaoke VIP 🎤' });
        path.push({ x: sp.x, z: sp.z, finalPose: sp.pose, faceX: 18.8, faceZ: -4.0, act: sp.act, emoji: '🎤' });
      } else if (destType === 'nhau') {
        // Chỉ cho phép ngồi vào đúng 8 ghế đẩu nhựa 3D thật (REAL_NHAU_STOOLS), tuyệt đối không có tọa độ ngồi ảo không ghế!
        const isSeatOccupied = (seatIdx) => {
          if (seatIdx < 0 || seatIdx >= REAL_NHAU_STOOLS.length) return true;
          const seat = REAL_NHAU_STOOLS[seatIdx];
          return officeCharacters.some(other => {
            if (other === charObj) return false;
            if (typeof other.nhauSeatIdx === 'number' && other.nhauSeatIdx === seatIdx) return true;
            // Chỉ tính người đang đứng/ngồi yên tại ghế (không bị nhiễu bởi người đang đi bộ ngang qua)
            if (other.currentPose !== 'walking') {
              const d = Math.hypot(other.rig.root.position.x - seat.x, other.rig.root.position.z - seat.z);
              if (d < 0.36) return true;
            }
            return false;
          });
        };

        if (typeof charObj.nhauSeatIdx !== 'number' || charObj.nhauSeatIdx >= REAL_NHAU_STOOLS.length || isSeatOccupied(charObj.nhauSeatIdx)) {
          const freeSeats = REAL_NHAU_STOOLS.map((_, i) => i).filter(i => !isSeatOccupied(i));
          charObj.nhauSeatIdx = freeSeats.length > 0 ? freeSeats[0] : -1;
        }

        path.push({ x: 2.5, z: 7.2, act: 'Ra cửa trước đi nhậu thôi! 🍻' });
        path.push({ x: 2.5, z: 9.8, act: 'Tiến ra Quán Bia Hơi vỉa hè...' });

        if (charObj.nhauSeatIdx >= 0 && charObj.nhauSeatIdx < REAL_NHAU_STOOLS.length) {
          const sp = REAL_NHAU_STOOLS[charObj.nhauSeatIdx];
          if (sp.side === 'south') {
            path.push({ x: 2.5, z: 13.55, act: 'Đi vòng qua bàn tìm ghế nhựa...' });
            path.push({ x: sp.x, z: 13.55, act: 'Kéo ghế ngồi vào bàn nhậu...' });
          } else {
            path.push({ x: sp.x, z: 10.1, act: 'Kéo ghế ngồi vào bàn nhậu...' });
          }
          path.push({ x: sp.x, z: sp.z, finalPose: 'nhau', faceRotY: sp.rotY, act: 'Đang ngồi ghế nhựa cụng ly 1-2-3 DZÔ cực đã! 🍻', emoji: '🍻' });
        } else {
          // Khi cả 8 ghế nhựa đã kín người ngồi: Nhân sự thứ 9+ đứng thưởng thức BBQ & nâng ly bia quanh Lò Nướng (tuyệt đối không ngồi lơ lửng!)
          const standOffsets = [
            { x: 0.95, z: 10.75, fx: 1.65, fz: 11.8 },
            { x: 2.35, z: 10.75, fx: 1.65, fz: 11.8 },
            { x: 0.95, z: 12.85, fx: 1.65, fz: 11.8 },
            { x: 2.35, z: 12.85, fx: 1.65, fz: 11.8 }
          ];
          const st = standOffsets[officeCharacters.indexOf(charObj) % standOffsets.length];
          path.push({ x: st.x, z: st.z, finalPose: 'stand-beer', faceX: st.fx, faceZ: st.fz, act: 'Đang đứng cạnh Lò Nướng BBQ nâng ly 1-2-3 DZÔ! 🍻🍢', emoji: '🍻' });
        }
      } else if (destType === 'chua') {
        const slot = typeof charObj.templeSlot === 'number'
          ? charObj.templeSlot
          : (Math.floor((charObj.phase || 0) * 10) % 8);
        const templeSpots = [
          // 4 vị trí quỳ lạy trên 4 bồ đoàn nhung đỏ trước Đại Hùng Bảo Điện
          { x: 28.4, z: 6.35, pose: 'kneel-pray', fx: 30.5, fz: 0.2, act: 'Đang quỳ lạy trước Đại Hùng Bảo Điện cầu không Bug 🙏', emoji: '🙏' },
          { x: 29.8, z: 6.35, pose: 'kneel-pray', fx: 30.5, fz: 0.2, act: 'Đang quỳ lạy cầu Deploy mượt & tăng lương 🙏', emoji: '🙏' },
          { x: 31.2, z: 6.35, pose: 'kneel-pray', fx: 30.5, fz: 0.2, act: 'Đang quỳ lạy cầu Server 99.99% Uptime 🙏', emoji: '🙏' },
          { x: 32.6, z: 6.35, pose: 'kneel-pray', fx: 30.5, fz: 0.2, act: 'Đang quỳ lạy cầu PR được Merge ngay lập tức 🙏', emoji: '🙏' },
          // 1 vị trí đứng ngay trước Đỉnh Lư Hương Đồng Đại Cát (X = 30.5, Z = 5.0)
          { x: 30.5, z: 5.85, pose: 'incense', fx: 30.5, fz: 0.2, act: 'Đang thắp 3 nén nhang vái trước Đỉnh Lư Hương Đồng 🕯️', emoji: '🕯️' },
          // 1 vị trí đứng trước Hòm Công Đức Đại Lộc (X = 33.6, Z = 5.2)
          { x: 33.6, z: 6.05, pose: 'donate', fx: 33.6, fz: 5.2, act: 'Đang bỏ tiền vào Hòm Công Đức Đại Lộc tích phước 💵', emoji: '💵', trigger: 'donate' },
          // 2 vị trí xếp hàng chờ tới lượt trong sân Đại Tự
          { x: 29.6, z: 8.20, pose: 'queue-pray', fx: 30.5, fz: 0.2, act: 'Đang xếp hàng cầm nhang chờ tới lượt lạy 🕯️', emoji: '🕯️' },
          { x: 31.4, z: 8.20, pose: 'queue-pray', fx: 30.5, fz: 0.2, act: 'Đang xếp hàng khấn nhẩm cầu thoát ế 🙏', emoji: '🛕' }
        ];
        const sp = templeSpots[slot % templeSpots.length];
        if (!stayingInTemple || fromX < 21.5) {
          path.push({ x: 3.5, z: 7.2, act: 'Ra cửa đi viếng Quần Thể Chùa Linh Ứng 🛕' });
          path.push({ x: 3.5, z: 9.8, act: 'Đi qua vườn Thiền Hồ Cá Koi...' });
          path.push({ x: 22.2, z: 9.8, act: 'Bước qua Cổng Tam Quan Đại Tự ⛩️' });
          path.push({ x: 30.5, z: 9.8, act: 'Tiến vào sân Đại Hùng Bảo Điện...' });
        } else if (fromZ < 6.8 && sp.z >= 7.5) {
          path.push({ x: 27.2, z: 6.8, act: 'Lạy xong, nhường chỗ cho đồng nghiệp...' });
          path.push({ x: 27.2, z: 9.2, act: 'Vòng ra cuối hàng sân Đại Tự...' });
          path.push({ x: sp.x, z: 9.2, act: 'Vào vị trí xếp hàng...' });
        }
        path.push({ x: sp.x, z: sp.z, finalPose: sp.pose, faceX: sp.fx, faceZ: sp.fz, act: sp.act, emoji: sp.emoji, trigger: sp.trigger || 'incense' });
      } else if (destType === 'donate') {
        if (!stayingInTemple || fromX < 21.5) {
          path.push({ x: 3.5, z: 7.2, act: 'Đi sang Quần Thể Chùa Linh Ứng bỏ tiền công đức 💵' });
          path.push({ x: 3.5, z: 9.8, act: 'Đi qua Cổng Tam Quan tới Hòm Công Đức...' });
          path.push({ x: 33.6, z: 9.8, act: 'Tiến lại gần Hòm Công Đức Đại Lộc...' });
        }
        path.push({ x: 33.6, z: 6.05, finalPose: 'donate', faceX: 33.6, faceZ: 5.2, act: 'Đang bỏ tiền vào Hòm Công Đức Đại Lộc 💵🙏', emoji: '💵', trigger: 'donate' });
      }
      return path;
    }

    function showCharacterSpeech(charData, text, duration = 4.0) {
      if (!charData.speechEl) return;
      charData.speechEl.textContent = text;
      charData.speechEl.style.opacity = '1';
      charData.speechTimer = duration;
    }

    function triggerAutoDoor(doorId) {
      const d = animatedDoors.find(item => item.id === doorId);
      if (d) {
        d.isOpen = true;
        d.targetAngle = doorId === 'server' ? -Math.PI * 0.48 : Math.PI * 0.48;
        d.autoCloseTimer = 3.5;
      }
    }

    function triggerOfficeEvent(eventType, isInternalCall = false) {
      if (!isHandlingRemotePacket && !isInternalCall && !window.isBossAuthorized()) {
        window.requireBossAuth('phát lệnh điều động Sự kiện Toàn Văn Phòng', () => triggerOfficeEvent(eventType, true));
        return;
      }
      state.activeEvent = eventType;
      const banner = document.getElementById('event-banner');
      const inner = document.getElementById('event-banner-inner');
      const iconEl = document.getElementById('event-banner-icon');
      const textEl = document.getElementById('event-banner-text');

      // Reset event props
      if (pizzaPartyGroup) pizzaPartyGroup.visible = false;
      if (discoGroup) discoGroup.visible = false;
      if (nhauNeonLight) nhauNeonLight.intensity = 2.5;
      serverPointLight.color.setHex(turboCooling ? 0x06b6d4 : 0x38bdf8);
      serverPointLight.intensity = 3.2;

      if (!eventType) {
        if (!isHandlingRemotePacket && typeof window.broadcastRealtimePacket === 'function') {
          window.broadcastRealtimePacket({ type: 'office_event', eventType: null, bossSig: BOSS_NETWORK_SIG });
        }
        banner.classList.add('opacity-0', 'pointer-events-none', '-translate-y-3');
        openKaraokeYouTubePanel(false);
        setLightingMode(false);
        officeCharacters.forEach(c => {
          c.manualTask = null;
          c.templeSlot = null;
          c.nhauSeatIdx = null;
          c.taskQueue = [];
          if (c.homeSeat) {
            commandCharacter(c, 'work', true);
          } else {
            c.currentPose = 'idle';
            c.emoji = '🚶';
            c.activity = 'Đang quay lại guồng làm việc';
          }
        });
        showToast('💼 Đã kết thúc sự kiện! Cả văn phòng quay lại làm việc.');
        return;
      }

      banner.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-3');
      if (!isHandlingRemotePacket && typeof window.broadcastRealtimePacket === 'function') {
        window.broadcastRealtimePacket({ type: 'office_event', eventType, bossSig: BOSS_NETWORK_SIG });
      }

      if (eventType === 'crash') {
        playSynthTone(220, 0.25, 'sawtooth', 0.08);
        setTimeout(() => playSynthTone(180, 0.3, 'sawtooth', 0.08), 220);
        inner.className = 'px-4 py-2 rounded-2xl border border-rose-500/70 bg-rose-950/90 text-rose-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🚨';
        textEl.textContent = 'KHẨN CẤP: SẬP SERVER PRODUCTION! Toàn team lao vào cứu hệ thống!';
        serverPointLight.color.setHex(0xef4444);
        goToCameraPreset('server');

        officeCharacters.forEach((c, idx) => {
          if (idx === 9 || idx === 10) {
            commandCharacter(c, 'server', true);
            showCharacterSpeech(c, 'Toang rồi!! Ai vừa xóa DB Prod?! 😱', 5.0);
          } else if (c.homeSeat && c.homeSeat.zone === 'dev') {
            commandCharacter(c, 'work', true);
            showCharacterSpeech(c, 'Đang hotfix gấp!! Rollback mau! 🔥', 5.0);
          } else {
            showCharacterSpeech(c, 'Khách hàng đang gọi cháy máy rồi! 📞', 4.5);
          }
        });
      } else if (eventType === 'pizza') {
        playSynthTone(523, 0.12, 'triangle');
        setTimeout(() => playSynthTone(659, 0.12, 'triangle'), 120);
        setTimeout(() => playSynthTone(784, 0.2, 'triangle'), 240);
        if (pizzaPartyGroup) pizzaPartyGroup.visible = true;
        inner.className = 'px-4 py-2 rounded-2xl border border-amber-400/60 bg-amber-950/90 text-amber-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🍕';
        textEl.textContent = 'TIỆC PIZZA & TRÀ SỮA TẠI PANTRY! Cả team nạp năng lượng!';
        goToCameraPreset('pantry');

        officeCharacters.forEach((c, idx) => {
          c.energy = 100;
          c.mood = 100;
          if (idx < 7) {
            commandCharacter(c, 'pizza', true);
            showCharacterSpeech(c, idx % 2 === 0 ? 'Sếp đãi Pizza kìa anh em ơi! 🍕' : 'Ăn trước fix bug sau! 😋', 4.5);
          }
        });
      } else if (eventType === 'disco') {
        setLightingMode(true);
        if (discoGroup) discoGroup.visible = true;
        inner.className = 'px-4 py-2 rounded-2xl border border-fuchsia-400/60 bg-fuchsia-950/90 text-fuchsia-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🕺';
        textEl.textContent = 'QUẨY DISCO CUỐI TUẦN! Đèn RGB lên nhạc cực sung!';
        goToCameraPreset('overview');

        officeCharacters.forEach((c, idx) => {
          c.taskQueue = [];
          c.manualTask = 'disco';
          c.currentPose = 'dance';
          c.emoji = '🕺';
          c.activity = 'Đang quẩy cực sung mừng cuối tuần! 🎶';
          c.mood = 100;
          showCharacterSpeech(c, idx % 2 === 0 ? 'QUẨY LÊN NÀO ANH EM ƠI! 🕺🔥' : 'Không bug không về, à nhầm quẩy đã! 🎶', 5.0);
        });
      } else if (eventType === 'nhau') {
        playSynthTone(440, 0.1, 'triangle');
        setTimeout(() => playSynthTone(554, 0.1, 'triangle'), 100);
        setTimeout(() => playSynthTone(659, 0.22, 'triangle'), 200);
        inner.className = 'px-4 py-2 rounded-2xl border border-yellow-400/60 bg-amber-950/90 text-yellow-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🍻';
        textEl.textContent = 'TĂNG 1: ĐI NHẬU VỈA HÈ! 1... 2... 3... DZÔ!! Sếp bao hết!';
        if (nhauNeonLight) nhauNeonLight.intensity = 6.5;
        goToCameraPreset('nhau');

        const nhauLines = [
          '1... 2... 3... DZÔ!! 🍻',
          'Không say không về anh em ơi! 🍺',
          'Uống đi mai fix bug sau! 😂',
          'Mồi bén quá sếp ơi! 🍢'
        ];
        // Reset ghế cũ trước khi chia lại ghế mới, ưu tiên giữ nguyên ghế của nhân vật đang Hóa Thân (nếu đang ngồi ở quán nhậu)
        const reservedSeats = new Set();
        officeCharacters.forEach(c => {
          if (c === embodiedCharacter && typeof c.nhauSeatIdx === 'number') {
            reservedSeats.add(c.nhauSeatIdx);
          } else {
            c.nhauSeatIdx = null;
          }
        });
        const availableSeats = [0, 1, 2, 3, 4, 5, 6, 7].filter(s => !reservedSeats.has(s));
        for (let i = availableSeats.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableSeats[i], availableSeats[j]] = [availableSeats[j], availableSeats[i]];
        }
        const npcCandidates = officeCharacters.filter(c => c !== embodiedCharacter);
        for (let i = npcCandidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [npcCandidates[i], npcCandidates[j]] = [npcCandidates[j], npcCandidates[i]];
        }
        npcCandidates.forEach((c, idx) => {
          c.mood = 100;
          c.energy = Math.min(100, c.energy + 20);
          if (idx < availableSeats.length) {
            c.nhauSeatIdx = availableSeats[idx];
            commandCharacter(c, 'nhau', true);
            showCharacterSpeech(c, nhauLines[idx % nhauLines.length], 5.5);
          } else {
            // Những người còn lại nếu đang ngồi ở ghế nhậu cũ thì quay về văn phòng làm việc để nhường ghế, tuyệt đối không ngồi đè
            if (getRoomZone(c.rig.root.position.x, c.rig.root.position.z) === 'nhau' && c.homeSeat) {
              commandCharacter(c, 'work', true);
            }
            showCharacterSpeech(c, 'Anh em ra nhậu trước đi, tui commit nốt dòng code rồi ra! 🏃', 4.5);
          }
        });
      } else if (eventType === 'karaoke') {
        inner.className = 'px-4 py-2 rounded-2xl border border-purple-400/60 bg-purple-950/90 text-purple-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🎤';
        textEl.textContent = 'TĂNG 2: PHÒNG HÁT KARAOKE VIP! Nhạc sống Beat 3D chạy chữ trực tiếp & Chấm điểm 100đ!';
        goToCameraPreset('karaoke');
        playKaraokeBeatSong(state.currentSongKey || 'cat-doi');
        spawnKaraokeConfetti(36);

        const karLines = [
          'Cho tui xin bài Cắt Đôi Nỗi Sầu! 🎤',
          'Giọng ca vàng làng IT lên sân khấu! 🎶',
          'Bấm ưu tiên bài tui với! 🎵',
          'Quẩy nhiệt lên anh em ơi! 🔥',
          'Bấm chấm điểm 100đ cho ca sĩ đi! 💯',
          'Hát cho quên hết bug Production! 🍻'
        ];
        officeCharacters.forEach((c, idx) => {
          c.mood = 100;
          if (idx < 8) {
            c.karaokeSlot = idx;
            commandCharacter(c, 'karaoke', true);
            showCharacterSpeech(c, karLines[idx % karLines.length], 5.5);
          } else {
            showCharacterSpeech(c, 'Hát hay quá, vỗ tay!! 👏', 4.0);
          }
        });
      } else if (eventType === 'chua') {
        playTempleBellSound(true);
        inner.className = 'px-4 py-2 rounded-2xl border border-amber-400/70 bg-red-950/90 text-amber-100 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-semibold';
        iconEl.textContent = '🛕';
        textEl.textContent = 'VIẾNG CHÙA CẦU KHÔNG BUG! Tiếng Đại Hồng Chung • Xếp hàng • Quỳ lạy • Công đức!';
        incenseActiveTimer = 50;
        templeQueueRotationTimer = 0;
        templeSpeechTimer = 0;
        templeAutoBellTimer = 0;
        serverPointLight.color.setHex(0x38bdf8);
        goToCameraPreset('chua');

        templeQueueOrder = officeCharacters.slice(0, 8);
        templeQueueOrder.forEach((c, idx) => {
          c.mood = 100;
          c.energy = Math.min(100, c.energy + 30);
          c.templeSlot = idx;
          commandCharacter(c, 'chua', true);
          const randPrayer = TEMPLE_PRAYERS[(idx * 3 + Math.floor(Math.random() * TEMPLE_PRAYERS.length)) % TEMPLE_PRAYERS.length];
          showCharacterSpeech(c, randPrayer, 6.5);
        });
        officeCharacters.slice(8).forEach(c => {
          showCharacterSpeech(c, 'Xếp hàng đông quá, lát tui ra thắp nhang sau! 🙏', 4.5);
        });
      }
    }

    function commandCharacter(charData, actionType, silent = false) {
      // Exclusive Boss RBAC Guard: Only Boss Minh Đăng can dispatch employees!
      if (!isHandlingRemotePacket && !silent && !window.isBossAuthorized()) {
        window.requireBossAuth(`điều động nhân sự "${charData.name}"`, () => commandCharacter(charData, actionType, false));
        return;
      }
      const pos = charData.rig.root.position;
      charData.manualTask = actionType;
      if (actionType !== 'nhau') charData.nhauSeatIdx = null;
      charData.holdingCoffee = false;
      charData.taskQueue = buildSmartRoute(pos.x, pos.z, actionType, charData);
      charData.queueIndex = 0;
      charData.currentPose = 'walking';
      if (charData.taskQueue.length > 0) {
        charData.activity = charData.taskQueue[0].act;
      }
      if (!silent) {
        const labels = {
          work: 'về bàn làm việc 💻',
          coffee: 'đi pha cà phê ☕',
          arcade: 'đi chơi game Arcade 🕹️',
          relax: 'đi nghỉ ngơi thư giãn 🛋️',
          server: 'đi kiểm tra Phòng Server 🖥️',
          meeting: 'vào Phòng họp trao đổi 📊',
          karaoke: 'vào Phòng Hát Karaoke 🎤',
          nhau: 'ra Quán Nhậu 1-2-3 Dzô 🍻',
          chua: 'đi Viếng Chùa cầu không Bug 🛕',
          donate: 'ra bỏ tiền Hòm Công Đức 💵'
        };
        showToast(`👑 Sếp Minh Đăng đã điều động ${charData.name}: ${labels[actionType] || actionType}`);
        // Broadcast Boss's individual employee dispatch across MQTT so all online guests see the employee move!
        if (!isHandlingRemotePacket && typeof window.broadcastRealtimePacket === 'function') {
          window.broadcastRealtimePacket({
            type: 'char_command',
            bossSig: BOSS_NETWORK_SIG,
            charIdx: officeCharacters.indexOf(charData),
            customId: charData.customId || null,
            actionType
          });
        }
      }
      updateInspectorUI();
    }

    function buildOfficeCharacters() {
      const tagsLayer = document.getElementById('character-tags-layer');
      const speechLayer = document.getElementById('speech-bubbles-layer');

      const staffDefs = [
        // 0. Trưởng Phòng IT Minh Đăng in Executive VIP Office
        { name: 'Minh Đăng 👑', role: 'Trưởng Phòng IT', shirt: 0x7c3aed, hairStyle: 0, glasses: true, homeSeat: { zone: 'boss', x: -16.95, z: -0.8, rotY: Math.PI / 2 }, pose: 'sitting-work' },
        // 6 Devs seated at desks
        { name: 'Minh Quân', role: 'Senior Frontend', shirt: 0x2563eb, hairStyle: 0, glasses: true, homeSeat: { zone: 'dev', x: -9.2, z: 2.32, rotY: Math.PI }, pose: 'sitting-work' },
        { name: 'Lan Anh', role: 'Backend Go', shirt: 0xec4899, hairStyle: 2, glasses: false, homeSeat: { zone: 'dev', x: -6.8, z: 2.32, rotY: Math.PI }, pose: 'sitting-work' },
        { name: 'Hoàng Nam', role: 'Fullstack JS', shirt: 0x059669, hairStyle: 0, glasses: true, homeSeat: { zone: 'dev', x: -4.4, z: 2.32, rotY: Math.PI }, pose: 'sitting-work' },
        { name: 'Thu Hà', role: 'Mobile Flutter', shirt: 0x8b5cf6, hairStyle: 1, glasses: false, homeSeat: { zone: 'dev', x: -9.2, z: 6.32, rotY: Math.PI }, pose: 'sitting-work' },
        { name: 'Đức Anh', role: 'AI Engineer', shirt: 0xea580c, hairStyle: 0, glasses: true, homeSeat: { zone: 'dev', x: -6.8, z: 6.32, rotY: Math.PI }, pose: 'sitting-work' },
        { name: 'Bảo Trâm', role: 'QA Automation', shirt: 0x0891b2, hairStyle: 2, glasses: false, homeSeat: { zone: 'dev', x: -4.4, z: 6.32, rotY: Math.PI }, pose: 'sitting-work' },
        // 3 Staff in Meeting Room
        { name: 'Quốc Huy', role: 'Tech Lead', shirt: 0x1d4ed8, hairStyle: 0, glasses: true, homeSeat: { zone: 'meeting', x: -8.6, z: -4.3, rotY: Math.PI }, pose: 'sitting-meeting' },
        { name: 'Ngọc Mai', role: 'Product Manager', shirt: 0xdb2777, hairStyle: 1, glasses: false, homeSeat: { zone: 'meeting', x: -7.2, z: -4.3, rotY: Math.PI }, pose: 'sitting-meeting' },
        { name: 'Tuấn Kiệt', role: 'Solution Arch', shirt: 0x4f46e5, hairStyle: 0, glasses: true, homeSeat: { zone: 'meeting', x: -5.8, z: -6.7, rotY: 0 }, pose: 'sitting-meeting' },
        // 4 Roaming Staff
        { name: 'Gia Bảo', role: 'DevOps Lead', shirt: 0x0f766e, hairStyle: 0, glasses: true, startPos: { x: 4.0, z: 4.5 }, roam: ['server', 'coffee', 'meeting'] },
        { name: 'Khánh Linh', role: 'UI/UX Designer', shirt: 0xd946ef, hairStyle: 2, glasses: false, startPos: { x: 6.5, z: -4.2 }, roam: ['arcade', 'coffee', 'relax'] },
        { name: 'Văn Toàn', role: 'SysAdmin', shirt: 0xb45309, hairStyle: 0, glasses: false, startPos: { x: 2.0, z: 1.8 }, roam: ['server', 'relax', 'coffee'] },
        { name: 'Phương Thảo', role: 'HR & Admin', shirt: 0xe11d48, hairStyle: 1, glasses: false, startPos: { x: 0.2, z: 4.0 }, roam: ['coffee', 'meeting', 'relax'] }
      ];

      staffDefs.forEach((def, idx) => {
        const rig = createHumanoidRig({
          shirt: def.shirt,
          hairStyle: def.hairStyle,
          glasses: def.glasses,
          isBoss: idx === 0
        });

        if (def.homeSeat) {
          rig.root.position.set(def.homeSeat.x, 0, def.homeSeat.z);
          rig.root.rotation.y = def.homeSeat.rotY;
        } else {
          rig.root.position.set(def.startPos.x, 0, def.startPos.z);
        }
        scene.add(rig.root);

        // Floating Name Tag
        const tagEl = document.createElement('div');
        tagEl.className = 'char-tag px-2 py-0.5 rounded-full bg-slate-900/85 border border-white/15 text-[10px] font-semibold text-white whitespace-nowrap shadow-md';
        tagEl.textContent = `${def.name} • ${def.role}`;
        tagsLayer.appendChild(tagEl);

        // Floating Speech Bubble
        const speechEl = document.createElement('div');
        speechEl.className = 'speech-bubble px-2.5 py-1 rounded-xl bg-white/95 text-slate-900 text-[11px] font-bold shadow-lg whitespace-nowrap opacity-0';
        speechLayer.appendChild(speechEl);

        const charData = {
          id: `char-${idx}`,
          name: def.name,
          role: def.role,
          rig,
          homeSeat: def.homeSeat || null,
          roamCycle: def.roam || null,
          roamIdx: 0,
          roamWaitTimer: 2 + idx * 1.1,
          currentPose: def.pose || 'idle',
          manualTask: null,
          taskQueue: [],
          queueIndex: 0,
          holdingCoffee: false,
          energy: 75 + (idx * 7) % 25,
          mood: 78 + (idx * 9) % 22,
          emoji: def.pose === 'sitting-work' ? '💻' : (def.pose === 'sitting-meeting' ? '📊' : '🚶'),
          activity: def.pose === 'sitting-work' ? 'Đang code tính năng mới 💻' : (def.pose === 'sitting-meeting' ? 'Đang họp Sprint 📊' : 'Đang di chuyển trong văn phòng'),
          phase: idx * 1.17 + 0.3,
          tagEl,
          speechEl,
          speechTimer: 0
        };
        officeCharacters.push(charData);

        registerInteractive(rig.root, {
          id: charData.id,
          type: 'character',
          icon: '🧑‍💻',
          zone: def.role,
          title: def.name,
          desc: 'Bạn có thể điều khiển nhân viên này làm việc, đi pha cà phê, đi nhậu, hát Karaoke hoặc viếng chùa!',
          getMetrics: () => `
            <div class="flex justify-between"><span class="text-slate-400">Hoạt động:</span><span class="text-sky-300 font-semibold text-right ml-2">${charData.activity}</span></div>
            <div class="mt-1.5">
              <div class="flex justify-between text-[11px] mb-0.5"><span>⚡ Năng lượng</span><span>${Math.round(charData.energy)}%</span></div>
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-emerald-400 transition-all" style="width:${charData.energy}%"></div></div>
            </div>
            <div class="mt-1">
              <div class="flex justify-between text-[11px] mb-0.5"><span>😊 Tâm trạng</span><span>${Math.round(charData.mood)}%</span></div>
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-amber-400 transition-all" style="width:${charData.mood}%"></div></div>
            </div>
          `,
          getActions: () => {
            const isFollowing = state.followCharacter === charData;
            const isEmbodied = embodiedCharacter === charData;
            const isBossAuth = window.isBossAuthorized();
            const isBossAvatar = (idx === 0);
            const lockPrefix = isBossAuth ? '' : '🔒 ';
            const actions = [
              {
                label: isEmbodied
                  ? `⏹ Thoát Hóa Thân (${charData.name})`
                  : (isBossAvatar && !isBossAuth ? `🔒 Hóa Thân ${charData.name} (Chỉ Chủ Phòng)` : `🕹️ Hóa Thân Thành ${charData.name}!`),
                primary: true,
                run: () => {
                  if (isEmbodied) stopEmbodyCharacter();
                  else startEmbodyCharacter(charData);
                }
              }
            ];
            if (charData.homeSeat) {
              actions.push({ label: `${lockPrefix}💻 Làm việc`, primary: false, run: () => commandCharacter(charData, 'work') });
            }
            actions.push({ label: `${lockPrefix}☕ Pha cà phê`, primary: false, run: () => commandCharacter(charData, 'coffee') });
            actions.push({ label: `${lockPrefix}🍻 Đi nhậu`, primary: false, run: () => commandCharacter(charData, 'nhau') });
            actions.push({ label: `${lockPrefix}🎤 Hát Karaoke`, primary: false, run: () => commandCharacter(charData, 'karaoke') });
            actions.push({ label: `${lockPrefix}🛕 Viếng chùa`, primary: false, run: () => commandCharacter(charData, 'chua') });
            actions.push({ label: `${lockPrefix}💵 Bỏ công đức`, primary: false, run: () => commandCharacter(charData, 'donate') });
            actions.push({ label: `${lockPrefix}🕹️ Chơi game`, primary: false, run: () => commandCharacter(charData, 'arcade') });
            actions.push({ label: `${lockPrefix}🛋️ Nghỉ ngơi`, primary: false, run: () => commandCharacter(charData, 'relax') });
            actions.push({ label: `${lockPrefix}🖥️ Check Server`, primary: false, run: () => commandCharacter(charData, 'server') });
            actions.push({
              label: isFollowing ? '⏹ Dừng bám theo' : '🎥 Bám theo',
              primary: isFollowing,
              run: () => {
                state.followCharacter = isFollowing ? null : charData;
                showToast(state.followCharacter ? `🎥 Đang bám theo ${charData.name}` : 'Đã tắt Camera bám theo');
                updateInspectorUI();
              }
            });
            return actions;
          }
        });
      });
    }

    function applyCharacterPose(c, pose, dt, t) {
      const { rig } = c;
      const lerp = (cur, target, factor) => cur + (target - cur) * Math.min(1, factor);
      const sp = 10 * dt;

      if (rig.rightArm.coffeeCup) rig.rightArm.coffeeCup.visible = !!c.holdingCoffee;
      if (rig.rightArm.beerMug) rig.rightArm.beerMug.visible = (pose === 'nhau' || pose === 'stand-beer');
      if (rig.rightArm.microphone) rig.rightArm.microphone.visible = (pose === 'sing');
      if (rig.rightArm.incenseSticks) {
        rig.rightArm.incenseSticks.visible = (pose === 'incense' || pose === 'queue-pray');
      }
      if (rig.rightArm.banknote) {
        rig.rightArm.banknote.visible = (pose === 'donate');
      }

      // Reset body tilt unless kneeling
      if (pose !== 'kneel-pray') {
        rig.bodyPivot.rotation.x = lerp(rig.bodyPivot.rotation.x, 0, sp);
      }

      if (pose === 'sitting-work' || pose === 'sitting-meeting') {
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, -0.34, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, -1.45, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, -1.45, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 1.45, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 1.45, sp);
        const typeAnim = pose === 'sitting-work' ? Math.sin(t * 14 + c.phase) * 0.14 : Math.sin(t * 2 + c.phase) * 0.05;
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.65 + typeAnim, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.65 - typeAnim, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -0.75, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -0.75, sp);
        rig.headGroup.rotation.y = Math.sin(t * 1.4 + c.phase) * 0.22;
        rig.headGroup.rotation.x = 0.08;
      } else if (pose === 'walking') {
        const w = t * 8.5 + c.phase;
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, Math.abs(Math.sin(w)) * 0.045, sp);
        rig.leftLeg.hip.rotation.x = Math.sin(w) * 0.55;
        rig.rightLeg.hip.rotation.x = -Math.sin(w) * 0.55;
        rig.leftLeg.knee.rotation.x = Math.max(0, -Math.cos(w) * 0.55);
        rig.rightLeg.knee.rotation.x = Math.max(0, Math.cos(w) * 0.55);
        rig.leftArm.shoulder.rotation.x = -Math.sin(w) * 0.42;
        rig.rightArm.shoulder.rotation.x = c.holdingCoffee ? -0.75 : Math.sin(w) * 0.42;
        rig.leftArm.elbow.rotation.x = -0.2;
        rig.rightArm.elbow.rotation.x = c.holdingCoffee ? -0.9 : -0.2;
        rig.headGroup.rotation.y = lerp(rig.headGroup.rotation.y, 0, sp);
        rig.headGroup.rotation.x = lerp(rig.headGroup.rotation.x, 0, sp);
      } else if (pose === 'arcade') {
        const play = Math.sin(t * 12 + c.phase);
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, Math.abs(play) * 0.03, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.leftArm.shoulder.rotation.x = -0.7 + play * 0.12;
        rig.rightArm.shoulder.rotation.x = -0.7 - play * 0.12;
        rig.leftArm.elbow.rotation.x = -0.8;
        rig.rightArm.elbow.rotation.x = -0.8;
      } else if (pose === 'coffee') {
        const sip = Math.max(0, Math.sin(t * 1.8 + c.phase));
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, 0, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.6 - sip * 0.5, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -0.9 - sip * 0.45, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.1, sp);
      } else if (pose === 'dance') {
        const beat = t * 9.5 + c.phase;
        rig.bodyPivot.position.y = Math.abs(Math.sin(beat)) * 0.12;
        rig.leftLeg.hip.rotation.x = Math.sin(beat) * 0.35;
        rig.rightLeg.hip.rotation.x = -Math.sin(beat) * 0.35;
        rig.leftLeg.knee.rotation.x = Math.abs(Math.cos(beat)) * 0.35;
        rig.rightLeg.knee.rotation.x = Math.abs(Math.sin(beat)) * 0.35;
        rig.leftArm.shoulder.rotation.x = -2.2 + Math.sin(beat) * 0.55;
        rig.rightArm.shoulder.rotation.x = -2.2 - Math.sin(beat) * 0.55;
        rig.leftArm.elbow.rotation.x = -0.4;
        rig.rightArm.elbow.rotation.x = -0.4;
        rig.headGroup.rotation.y = Math.sin(beat * 0.5) * 0.3;
      } else if (pose === 'nhau' || pose === 'stand-beer') {
        // Hard Chair-Validation Guard: Only lower hips into sitting pose if standing directly on one of the 8 real 3D plastic stools!
        const cheers = Math.max(0, Math.sin(t * 2.8 + c.phase));
        const pos = rig.root.position;
        const hasRealStoolBelow = (pose === 'nhau') && isOnRealNhauStool(pos.x, pos.z);
        if (hasRealStoolBelow) {
          // Ngồi ngay ngắn trên ghế đẩu nhựa 3D thật, tay phải nâng ly bia hô 1-2-3 DZÔ!
          rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, -0.40, sp);
          rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, -1.52, sp);
          rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, -1.52, sp);
          rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 1.55, sp);
          rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 1.55, sp);
        } else {
          // Không có ghế nhựa ở dưới (đang đứng cạnh bàn/lò BBQ hoặc bấm phím 3 ở nơi khác): Đứng thẳng hai chân nâng ly bia cụng!
          rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, 0, sp);
          rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
          rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
          rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
          rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        }
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.85 - cheers * 0.75, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -0.95, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.55, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -0.65, sp);
        rig.headGroup.rotation.y = Math.sin(t * 2.0 + c.phase) * 0.25;
        rig.headGroup.rotation.x = lerp(rig.headGroup.rotation.x, -0.05, sp);
      } else if (pose === 'sing') {
        const groove = Math.sin(t * 4.5 + c.phase);
        rig.bodyPivot.position.y = Math.abs(groove) * 0.05;
        rig.leftLeg.hip.rotation.x = groove * 0.12;
        rig.rightLeg.hip.rotation.x = -groove * 0.12;
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0.08, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0.08, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -1.15 + groove * 0.1, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -1.25, sp);
        rig.leftArm.shoulder.rotation.x = -0.6 + groove * 0.4;
        rig.leftArm.elbow.rotation.x = -0.5;
        rig.headGroup.rotation.y = groove * 0.25;
      } else if (pose === 'kneel-pray') {
        // Quỳ gối thật sự trên bồ đoàn & cúi gập người lạy nhịp nhàng
        const bowCycle = Math.max(0, Math.sin(t * 1.9 + c.phase));
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, -0.46 - bowCycle * 0.08, sp);
        rig.bodyPivot.rotation.x = lerp(rig.bodyPivot.rotation.x, 0.12 + bowCycle * 0.62, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0.15, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0.15, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 2.25, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 2.25, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.95 - bowCycle * 0.4, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.95 - bowCycle * 0.4, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -1.25, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -1.25, sp);
        rig.headGroup.rotation.x = lerp(rig.headGroup.rotation.x, 0.25 + bowCycle * 0.35, sp);
        rig.headGroup.rotation.y = lerp(rig.headGroup.rotation.y, 0, sp);
      } else if (pose === 'incense') {
        // Đứng cầm 3 nén nhang đưa lên ngang trán vái 3 vái
        const vai = Math.sin(t * 3.4 + c.phase);
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, 0, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -1.05 - vai * 0.28, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -1.05 - vai * 0.28, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -1.35, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -1.35, sp);
        rig.headGroup.rotation.x = 0.12 + Math.max(0, vai) * 0.22;
        rig.headGroup.rotation.y = lerp(rig.headGroup.rotation.y, 0, sp);
      } else if (pose === 'queue-pray' || pose === 'pray') {
        // Đứng xếp hàng cầm nhang chắp tay trước ngực chờ tới lượt
        const sway = Math.sin(t * 1.6 + c.phase);
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, 0, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.72, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.72, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -1.25, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -1.25, sp);
        rig.headGroup.rotation.x = 0.08 + Math.max(0, sway) * 0.1;
        rig.headGroup.rotation.y = sway * 0.12;
      } else if (pose === 'donate') {
        // Đưa tay phải cầm tiền thả vào khe Hòm Công Đức & cúi nhẹ đầu thành kính
        const drop = Math.sin(t * 3.2 + c.phase);
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, 0, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, -0.95 - drop * 0.25, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -0.45, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, -0.25, sp);
        rig.headGroup.rotation.x = 0.15 + Math.max(0, drop) * 0.15;
        rig.headGroup.rotation.y = lerp(rig.headGroup.rotation.y, 0, sp);
      } else {
        rig.bodyPivot.position.y = lerp(rig.bodyPivot.position.y, Math.sin(t * 2.2 + c.phase) * 0.012, sp);
        rig.leftLeg.hip.rotation.x = lerp(rig.leftLeg.hip.rotation.x, 0, sp);
        rig.rightLeg.hip.rotation.x = lerp(rig.rightLeg.hip.rotation.x, 0, sp);
        rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0, sp);
        rig.rightLeg.knee.rotation.x = lerp(rig.rightLeg.knee.rotation.x, 0, sp);
        rig.leftArm.shoulder.rotation.x = lerp(rig.leftArm.shoulder.rotation.x, 0, sp);
        rig.rightArm.shoulder.rotation.x = lerp(rig.rightArm.shoulder.rotation.x, c.holdingCoffee ? -0.7 : 0, sp);
        rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -0.1, sp);
        rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, c.holdingCoffee ? -0.9 : -0.1, sp);
        rig.headGroup.rotation.y = Math.sin(t * 1.1 + c.phase) * 0.18;
        rig.headGroup.rotation.x = lerp(rig.headGroup.rotation.x, 0, sp);
      }
    }

    function updateCharacters(simDt, t) {
      const speed = 2.6;
      const projVec = new THREE.Vector3();

      officeCharacters.forEach(c => {
        // Needs drift
        if (c.currentPose === 'sitting-work') {
          c.energy = Math.max(15, c.energy - simDt * 0.35);
          c.mood = Math.max(20, c.mood - simDt * 0.18);
        } else if (c.currentPose === 'coffee' || c.currentPose === 'nhau' || c.currentPose === 'kneel-pray' || c.currentPose === 'incense' || c.currentPose === 'queue-pray') {
          c.energy = Math.min(100, c.energy + simDt * 3.5);
          c.mood = Math.min(100, c.mood + simDt * 4.0);
        } else if (c.currentPose === 'arcade' || c.currentPose === 'sing' || c.currentPose === 'dance') {
          c.mood = Math.min(100, c.mood + simDt * 5.0);
        }

        // Speech bubble countdown
        if (c.speechTimer > 0) {
          c.speechTimer -= simDt;
          if (c.speechTimer <= 0 && c.speechEl) {
            c.speechEl.style.opacity = '0';
          }
        }

        // Check if this character is currently controlled by a REMOTE ONLINE PLAYER
        const isRemoteControlled = (c !== embodiedCharacter) && c.remoteOwnerId && (performance.now() - (c.remoteLastSeen || 0) < 10000);
        if (!isRemoteControlled && c.remoteOwnerId && (performance.now() - (c.remoteLastSeen || 0) >= 10000)) {
          // Remote player timed out -> release character back to AI
          c.remoteOwnerId = null;
          if (c.tagEl) {
            c.tagEl.className = 'char-tag px-2 py-0.5 rounded-full bg-slate-900/85 border border-white/15 text-[10px] font-semibold text-white whitespace-nowrap shadow-md';
            c.tagEl.textContent = `${c.name} • ${c.role}`;
          }
        }

        if (isRemoteControlled) {
          // Smooth 60 FPS network interpolation for Remote Online Player
          const pos = c.rig.root.position;
          const lerpF = Math.min(1, 14 * simDt);
          if (typeof c.remoteTargetX === 'number' && typeof c.remoteTargetZ === 'number') {
            pos.x += (c.remoteTargetX - pos.x) * lerpF;
            pos.z += (c.remoteTargetZ - pos.z) * lerpF;
          }
          if (typeof c.remoteTargetRotY === 'number') {
            let diff = c.remoteTargetRotY - c.rig.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            c.rig.root.rotation.y += diff * Math.min(1, 14 * simDt);
          }
          c.currentPose = c.remotePose || 'idle';
          c.activity = '🟢 Đang điều khiển trực tuyến (Online Player)';
        } else if (c.taskQueue && c.queueIndex < c.taskQueue.length) {
          // Follow waypoint taskQueue
          const wp = c.taskQueue[c.queueIndex];
          const pos = c.rig.root.position;
          const dx = wp.x - pos.x;
          const dz = wp.z - pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0.14) {
            c.currentPose = 'walking';
            const step = Math.min(dist, speed * simDt);
            pos.x += (dx / dist) * step;
            pos.z += (dz / dist) * step;
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - c.rig.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            c.rig.root.rotation.y += diff * Math.min(1, 10 * simDt);
          } else {
            pos.x = wp.x;
            pos.z = wp.z;
            if (wp.trigger === 'coffee') {
              coffeeBrewingTimer = Math.max(coffeeBrewingTimer, 6.0);
              c.holdingCoffee = true;
            } else if (wp.trigger === 'incense') {
              incenseActiveTimer = Math.max(incenseActiveTimer, 14.0);
            } else if (wp.trigger === 'donate') {
              const amounts = [50000, 100000, 200000, 500000];
              const pick = amounts[Math.floor(Math.random() * amounts.length)];
              spawnDonationMoney(pick, c.name);
              showCharacterSpeech(c, `Góp ${formatVND(pick)} công đức, cầu hết bug! 💵🙏`, 4.8);
            } else if (wp.trigger === 'door-server') {
              triggerAutoDoor('server');
            } else if (wp.trigger === 'door-meeting') {
              triggerAutoDoor('meeting');
            }

            c.queueIndex++;
            if (c.queueIndex >= c.taskQueue.length) {
              c.currentPose = wp.finalPose || 'idle';
              if (wp.act) c.activity = wp.act;
              if (wp.emoji) c.emoji = wp.emoji;
              if (typeof wp.faceRotY === 'number') {
                c.rig.root.rotation.y = wp.faceRotY;
              } else if (typeof wp.faceX === 'number' && typeof wp.faceZ === 'number') {
                c.rig.root.rotation.y = Math.atan2(wp.faceX - pos.x, wp.faceZ - pos.z);
              }
            } else if (c.taskQueue[c.queueIndex].act) {
              c.activity = c.taskQueue[c.queueIndex].act;
            }
          }
        } else if (c.roamCycle && !c.manualTask && !state.activeEvent) {
          c.roamWaitTimer -= simDt;
          if (c.roamWaitTimer <= 0) {
            const nextDest = c.roamCycle[c.roamIdx % c.roamCycle.length];
            c.roamIdx++;
            c.roamWaitTimer = 9 + Math.random() * 5;
            const pos = c.rig.root.position;
            c.taskQueue = buildSmartRoute(pos.x, pos.z, nextDest, c);
            c.queueIndex = 0;
          }
        }

        // Global Anti-Overlap Separation: prevent any two stationary characters from sitting/standing on the exact same spot
        if (c !== embodiedCharacter && c.currentPose !== 'walking') {
          const pos = c.rig.root.position;
          for (let j = 0; j < officeCharacters.length; j++) {
            const other = officeCharacters[j];
            if (other === c) continue;
            // Embodied character or earlier-indexed stationary character has priority
            const otherHasPriority = (other === embodiedCharacter) || (j < officeCharacters.indexOf(c) && other.currentPose !== 'walking');
            if (!otherHasPriority) continue;
            const d = Math.hypot(pos.x - other.rig.root.position.x, pos.z - other.rig.root.position.z);
            if (d < 0.48) {
              if (getRoomZone(pos.x, pos.z) === 'nhau') {
                // Re-route to a free Nhau seat immediately
                c.nhauSeatIdx = null;
                c.taskQueue = buildSmartRoute(pos.x, pos.z, 'nhau', c);
                c.queueIndex = 0;
              } else {
                // Nudge character slightly aside
                const ang = (officeCharacters.indexOf(c) * 1.1) % (Math.PI * 2);
                moveBossWithCollision(pos, Math.cos(ang) * 0.65, Math.sin(ang) * 0.65);
              }
              break;
            }
          }
        }

        applyCharacterPose(c, c.currentPose, simDt, t);

        // Update 2D projected floating Name Tag & Speech Bubble
        projVec.copy(c.rig.root.position);
        projVec.y += 1.92;
        projVec.project(camera);
        const visible = projVec.z < 1 && projVec.x >= -1.1 && projVec.x <= 1.1 && projVec.y >= -1.1 && projVec.y <= 1.1;
        const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;

        if (c.tagEl) {
          c.tagEl.style.opacity = (visible && state.showTags) ? '1' : '0';
          if (visible && state.showTags) {
            c.tagEl.style.left = `${sx}px`;
            c.tagEl.style.top = `${sy}px`;
          }
        }
        if (c.speechEl && c.speechTimer > 0) {
          c.speechEl.style.opacity = visible ? '1' : '0';
          if (visible) {
            c.speechEl.style.left = `${sx}px`;
            c.speechEl.style.top = `${sy - 26}px`;
          }
        }
      });
    }

    // =========================================================================
    // 6. LIGHTING, CAMERA & UI INTERACTIONS
    // =========================================================================
    function setLightingMode(isNight) {
      state.isNightMode = isNight;
      const badge = document.getElementById('mode-badge');
      const btnDay = document.getElementById('btn-day-mode');
      const btnNight = document.getElementById('btn-night-mode');

      if (isNight) {
        scene.background = new THREE.Color(0x060913);
        scene.fog = new THREE.FogExp2(0x060913, 0.014);
        ambientLight.intensity = 0.25;
        hemiLight.intensity = 0.22;
        dirLight.intensity = 0.35;
        dirLight.color.setHex(0x6366f1);
        badge.textContent = 'Chế độ: Ban đêm (OT)';
        btnNight.className = 'px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-indigo-600 text-white shadow-md shadow-indigo-500/25 transition cursor-pointer';
        btnDay.className = 'px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-slate-200 transition cursor-pointer';
      } else {
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.FogExp2(0x0f172a, 0.0085);
        ambientLight.intensity = 0.65;
        hemiLight.intensity = 0.65;
        dirLight.intensity = 1.45;
        dirLight.color.setHex(0xfffbeb);
        badge.textContent = 'Chế độ: Ban ngày';
        btnDay.className = 'px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-sky-500 text-white shadow-md shadow-sky-500/25 transition cursor-pointer';
        btnNight.className = 'px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-slate-200 transition cursor-pointer';
      }
      updateCeilingLightsIntensity();
    }

    function updateCeilingLightsIntensity() {
      Object.keys(ceilingLightZones).forEach(zone => {
        const isOn = state.lights[zone];
        ceilingLightZones[zone].forEach(item => {
          item.light.intensity = isOn ? (state.isNightMode ? 6.5 : 3.8) : 0;
          item.mat.emissiveIntensity = isOn ? 1.5 : 0.08;
        });
        const btn = document.querySelector(`[data-light-zone="${zone}"]`);
        if (btn) {
          btn.className = isOn
            ? 'light-btn px-2 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 font-medium flex items-center justify-between cursor-pointer'
            : 'light-btn px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-medium flex items-center justify-between cursor-pointer';
          const dot = btn.querySelector('span:last-child');
          if (dot) dot.className = isOn ? 'w-2 h-2 rounded-full bg-amber-400' : 'w-2 h-2 rounded-full bg-slate-600';
        }
      });
    }

    function goToCameraPreset(key) {
      const preset = CAMERA_PRESETS[key];
      if (!preset) return;
      state.activeCameraPreset = key;
      // Unlock camera from embodied character so the camera flies to the selected room and stays there!
      state.cameraLockedToAvatar = false;
      state.followCharacter = null;
      if (embodiedCharacter && embodyCamMode === 'fps') {
        embodyCamMode = 'tps';
        if (embodiedCharacter.rig && embodiedCharacter.rig.headGroup) {
          embodiedCharacter.rig.headGroup.visible = true;
        }
      }
      camTransition.active = true;
      camTransition.startPos.copy(camera.position);
      camTransition.endPos.copy(preset.pos);
      camTransition.startTarget.copy(controls.target);
      camTransition.endTarget.copy(preset.target);
      camTransition.progress = 0;

      document.querySelectorAll('.cam-btn').forEach(btn => {
        const active = btn.dataset.cam === key;
        btn.className = active
          ? 'cam-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-sky-500 text-white shadow-md shadow-sky-500/25 transition cursor-pointer'
          : 'cam-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap text-slate-200 hover:bg-white/10 transition cursor-pointer';
      });
    }

    let toastTimer = null;
    function showToast(message) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = message;
      el.classList.remove('opacity-0', 'translate-y-2');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.classList.add('opacity-0', 'translate-y-2');
      }, 3200);
    }

    function extractYouTubeId(input) {
      if (!input) return null;
      const trimmed = input.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
      const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    function setMasterVolume(val) {
      const pct = Math.max(0, Math.min(100, Number(val)));
      state.masterVolume = pct / 100;
      state.soundEnabled = pct > 0;
      const volSlider = document.getElementById('volume-slider');
      const volLabel = document.getElementById('volume-label');
      const karSlider = document.getElementById('karaoke-volume-slider');
      const karLabel = document.getElementById('karaoke-volume-label');
      const btnSound = document.getElementById('btn-toggle-sound');
      if (volSlider) volSlider.value = pct;
      if (volLabel) volLabel.textContent = `${pct}%`;
      if (karSlider) karSlider.value = pct;
      if (karLabel) karLabel.textContent = `${pct}%`;
      if (btnSound) btnSound.textContent = pct > 0 ? '🔊' : '🔇';
      if (karaokeTvVideo) karaokeTvVideo.volume = state.masterVolume;
    }

    function buildYouTubeEmbedUrl(ytId) {
      const domain = state.ytEmbedDomain === 'nocookie'
        ? 'https://www.youtube-nocookie.com'
        : 'https://www.youtube.com';
      return `${domain}/embed/${ytId}?autoplay=1&rel=0`;
    }

    function restore3DTvCanvasMaterial() {
      if (karaokeScreenObj && karaokeScreenObj.mesh && karaokeScreenObj.defaultMat) {
        karaokeScreenObj.mesh.material = karaokeScreenObj.defaultMat;
      }
    }

    function applyVideoTextureTo3DTv() {
      if (!karaokeScreenObj || !karaokeScreenObj.mesh || !karaokeTvVideo) return;
      if (!tvVideoTexture) {
        tvVideoTexture = new THREE.VideoTexture(karaokeTvVideo);
        tvVideoTexture.colorSpace = THREE.SRGBColorSpace;
      }
      karaokeScreenObj.mesh.material = new THREE.MeshBasicMaterial({ map: tvVideoTexture });
    }

    function playKaraokeBeatSong(songKey) {
      const preset = SONG_PRESETS[songKey] || SONG_PRESETS['cat-doi'];
      state.currentSongKey = songKey in SONG_PRESETS ? songKey : 'cat-doi';
      state.currentSongTitle = preset.title;
      state.karaokeMode = 'beat';
      state.beatPlaying = true;
      state.youtubePlaying = false;
      karaokeBeatTimer = 0;
      karaokeStep = 0;

      // Hide 2D overlay & restore live 3D Canvas lyrics texture on the 3D TV
      if (karaokeTvIframe) {
        karaokeTvIframe.src = '';
        karaokeTvIframe.style.display = 'none';
      }
      if (karaokeTvVideo) {
        karaokeTvVideo.pause();
        karaokeTvVideo.srcObject = null;
        karaokeTvVideo.removeAttribute('src');
        karaokeTvVideo.style.display = 'none';
      }
      if (karaokeTvDom && !state.isTvExpanded) {
        karaokeTvDom.style.display = 'none';
      }
      restore3DTvCanvasMaterial();
      openKaraokeYouTubePanel(true);

      document.querySelectorAll('.beat-song-btn').forEach(btn => {
        const active = btn.dataset.beatSong === state.currentSongKey;
        btn.className = active
          ? 'beat-song-btn px-2 py-1.5 rounded-xl bg-fuchsia-600/45 border border-fuchsia-400/70 text-white text-[11px] font-semibold truncate text-left cursor-pointer transition'
          : 'beat-song-btn px-2 py-1.5 rounded-xl bg-white/10 border border-white/10 text-slate-200 text-[11px] font-medium truncate text-left cursor-pointer transition hover:bg-white/20';
      });

      const badge = document.getElementById('kar-mode-badge');
      if (badge) badge.textContent = 'Beat 3D';
      const nowPlaying = document.getElementById('yt-now-playing');
      if (nowPlaying) nowPlaying.textContent = `🎵 Đang phát Beat 3D: ${preset.title}`;

      if (karaokeScreenObj) {
        drawKaraokeCanvas(karaokeScreenObj.ctx, 512, 256, true, simElapsed);
        karaokeScreenObj.tex.needsUpdate = true;
      }
      showToast(`🎤 Đang phát nhạc sống & chạy chữ 3D: "${preset.title}"`);
      updateInspectorUI();
    }

    async function startKaraokeScreenShareTo3DTv() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showToast('⚠️ Trình duyệt không hỗ trợ chia sẻ màn hình trực tiếp!');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true
        });
        if (tvScreenStream) {
          tvScreenStream.getTracks().forEach(tr => tr.stop());
        }
        tvScreenStream = stream;
        state.karaokeMode = 'video3d';
        state.beatPlaying = false;
        state.youtubePlaying = true;
        state.currentSongTitle = 'Trình chiếu Tab YouTube / Màn hình thật 3D';

        if (karaokeTvIframe) {
          karaokeTvIframe.src = '';
          karaokeTvIframe.style.display = 'none';
        }
        if (karaokeTvDom && !state.isTvExpanded) {
          karaokeTvDom.style.display = 'none';
        }
        karaokeTvVideo.srcObject = stream;
        karaokeTvVideo.muted = false;
        karaokeTvVideo.volume = state.masterVolume;
        await karaokeTvVideo.play().catch(() => {});
        applyVideoTextureTo3DTv();

        const badge = document.getElementById('kar-mode-badge');
        if (badge) badge.textContent = 'Live 3D TV';
        const nowPlaying = document.getElementById('yt-now-playing');
        if (nowPlaying) nowPlaying.textContent = '🖥️ Đang chiếu trực tiếp Tab lên mặt TV 3D';

        stream.getVideoTracks()[0].addEventListener('ended', () => {
          playKaraokeBeatSong(state.currentSongKey);
        });
        goToCameraPreset('karaoke');
        showToast('🖥️ Đã chiếu trực tiếp hình ảnh thật lên mặt lưới TV 3D! Xoay 360° cực mượt!');
        updateInspectorUI();
      } catch (err) {
        showToast('ℹ️ Đã hủy chọn tab chia sẻ màn hình.');
      }
    }

    function loadMediaInto3DAnd2D(url, isDirectVideo) {
      if (!karaokeTvIframe || !karaokeTvVideo) return;
      if (tvScreenStream) {
        tvScreenStream.getTracks().forEach(tr => tr.stop());
        tvScreenStream = null;
      }
      if (isDirectVideo) {
        state.karaokeMode = 'video3d';
        karaokeTvIframe.src = '';
        karaokeTvIframe.style.display = 'none';
        if (karaokeTvDom && !state.isTvExpanded) karaokeTvDom.style.display = 'none';
        karaokeTvVideo.srcObject = null;
        karaokeTvVideo.src = url;
        karaokeTvVideo.volume = state.masterVolume;
        karaokeTvVideo.style.display = 'block';
        karaokeTvVideo.play().catch(() => {});
        applyVideoTextureTo3DTv();
      } else {
        state.karaokeMode = 'iframe';
        restore3DTvCanvasMaterial();
        karaokeTvVideo.pause();
        karaokeTvVideo.srcObject = null;
        karaokeTvVideo.removeAttribute('src');
        karaokeTvVideo.style.display = 'none';
        karaokeTvIframe.src = url;
        karaokeTvIframe.style.display = 'block';
      }
      const badge = document.getElementById('kar-mode-badge');
      if (badge) badge.textContent = isDirectVideo ? 'Video 3D' : 'Iframe';
      lastTvRect = { left: -1, top: -1, width: -1, height: -1 };
    }

    function resolveVideoEmbed(input) {
      if (!input) return null;
      const raw = input.trim();

      // 1. Google Drive share link -> /preview embed
      const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                         raw.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        return {
          url: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
          isDirectVideo: false,
          label: `Google Drive (${driveMatch[1].slice(0, 6)}...)`
        };
      }

      // 2. Direct video files (.mp4, .webm, .ogg, blob:)
      if (/^blob:/i.test(raw) || /\.(mp4|webm|ogg)(\?.*)?$/i.test(raw)) {
        return { url: raw, isDirectVideo: true, label: 'Video trực tiếp' };
      }

      // 3. Vimeo
      const vimeoMatch = raw.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return {
          url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
          isDirectVideo: false,
          label: `Vimeo (${vimeoMatch[1]})`
        };
      }

      // 4. Dailymotion
      const dmMatch = raw.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
      if (dmMatch) {
        return {
          url: `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`,
          isDirectVideo: false,
          label: `Dailymotion (${dmMatch[1]})`
        };
      }

      // 5. YouTube
      const ytId = extractYouTubeId(raw);
      if (ytId) {
        return {
          url: buildYouTubeEmbedUrl(ytId),
          isDirectVideo: false,
          label: `YouTube (${ytId})`
        };
      }

      // 6. Generic HTTPS URL
      if (/^https?:\/\//i.test(raw)) {
        return { url: raw, isDirectVideo: false, label: 'Link nhúng ngoài' };
      }

      return null;
    }

    function setTvExpandedMode(expanded) {
      state.isTvExpanded = expanded;
      const cssContainer = document.getElementById('css3d-container');
      const exitBtn = document.getElementById('btn-exit-tv-expand');
      if (!cssContainer || !karaokeTvDom) return;

      if (expanded) {
        if (!state.youtubePlaying) {
          playKaraokeYouTube(state.currentVideoId, state.currentSongTitle);
        }
        cssContainer.classList.add('tv-expanded-layer');
        karaokeTvDom.classList.add('tv-expanded-box');
        karaokeTvDom.style.display = 'block';
        if (exitBtn) exitBtn.classList.remove('hidden');
        if (controls) controls.enabled = false;
      } else {
        cssContainer.classList.remove('tv-expanded-layer');
        karaokeTvDom.classList.remove('tv-expanded-box');
        if (exitBtn) exitBtn.classList.add('hidden');
        if (controls && !document.fullscreenElement) controls.enabled = true;
        lastTvRect = { left: -1, top: -1, width: -1, height: -1 };
      }
    }

    function openKaraokeYouTubePanel(show) {
      const panel = document.getElementById('karaoke-yt-panel');
      if (!panel) return;
      if (show) {
        panel.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
      } else {
        panel.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
      }
    }

    function playKaraokeYouTube(inputUrlOrId, customTitle) {
      const resolved = resolveVideoEmbed(inputUrlOrId);
      if (!resolved) {
        showToast('⚠️ Link không hợp lệ! Hãy dán link Google Drive công khai hoặc file .mp4.');
        return;
      }

      state.currentVideoId = inputUrlOrId;
      state.currentEmbedUrl = resolved.url;
      state.currentSongTitle = customTitle || resolved.label;
      state.youtubePlaying = true;
      state.beatPlaying = false;

      loadMediaInto3DAnd2D(resolved.url, resolved.isDirectVideo);
      openKaraokeYouTubePanel(true);

      const nowPlaying = document.getElementById('yt-now-playing');
      if (nowPlaying) {
        nowPlaying.textContent = `Đang chiếu: ${state.currentSongTitle}`;
      }
      if (karaokeScreenObj) {
        drawKaraokeCanvas(karaokeScreenObj.ctx, 512, 256, true, simElapsed);
        karaokeScreenObj.tex.needsUpdate = true;
      }
      showToast(`📺 Đã đưa "${state.currentSongTitle}" lên TV 3D! Bấm ▶ trên màn hình để phát.`);
      updateInspectorUI();
    }

    function stopAllKaraokeMedia() {
      state.youtubePlaying = false;
      state.beatPlaying = false;
      state.karaokeMode = 'beat';
      if (state.isTvExpanded) setTvExpandedMode(false);

      if (tvScreenStream) {
        tvScreenStream.getTracks().forEach(tr => tr.stop());
        tvScreenStream = null;
      }
      if (karaokeTvIframe) {
        karaokeTvIframe.src = '';
        karaokeTvIframe.style.display = 'none';
      }
      if (karaokeTvVideo) {
        karaokeTvVideo.pause();
        karaokeTvVideo.srcObject = null;
        karaokeTvVideo.removeAttribute('src');
        karaokeTvVideo.style.display = 'none';
      }
      if (karaokeTvDom) {
        karaokeTvDom.style.display = 'none';
      }
      restore3DTvCanvasMaterial();
      const nowPlaying = document.getElementById('yt-now-playing');
      if (nowPlaying) {
        nowPlaying.textContent = 'Đã dừng phát • Chọn bài Beat 3D hoặc chiếu Video';
      }
      if (karaokeScreenObj) {
        drawKaraokeCanvas(karaokeScreenObj.ctx, 512, 256, false, simElapsed);
        karaokeScreenObj.tex.needsUpdate = true;
      }
      showToast('⏹ Đã dừng phát TV Karaoke 3D');
      updateInspectorUI();
    }

    function updateKaraokeTvOverlay() {
      if (!karaokeTvDom) return;

      // Never overwrite DOM geometry while in native Fullscreen or Expanded TV mode
      if (document.fullscreenElement || document.webkitFullscreenElement || state.isTvExpanded) {
        karaokeTvDom.style.display = 'block';
        return;
      }

      // Only overlay the 2D iframe box when in 'iframe' mode (Beat 3D and VideoTexture render directly on the 3D TV mesh!)
      if (!state.youtubePlaying || state.karaokeMode !== 'iframe') {
        karaokeTvDom.style.display = 'none';
        return;
      }

      // Check if camera is in front of the TV screen (X < 18.81) and reasonably close
      const tvCenter = new THREE.Vector3(18.81, 2.05, -4.0);
      const dist = camera.position.distanceTo(tvCenter);
      const inFront = camera.position.x < 18.7;

      if (!inFront || dist > 16.5) {
        karaokeTvDom.style.display = 'none';
        return;
      }

      // Project all 4 TV corners to 2D viewport coordinates
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let anyBehind = false;
      const tmp = new THREE.Vector3();

      for (let i = 0; i < tvScreenCorners.length; i++) {
        tmp.copy(tvScreenCorners[i]).project(camera);
        if (tmp.z > 1) {
          anyBehind = true;
          break;
        }
        const sx = (tmp.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }

      const w = maxX - minX;
      const h = maxY - minY;
      if (anyBehind || w < 40 || h < 25 || maxX < 0 || minX > window.innerWidth || maxY < 0 || minY > window.innerHeight) {
        karaokeTvDom.style.display = 'none';
        return;
      }

      karaokeTvDom.style.display = 'block';

      // Only mutate DOM styles when rect changed significantly so native iframe clicks are never interrupted
      const rLeft = Math.round(minX);
      const rTop = Math.round(minY);
      const rWidth = Math.round(w);
      const rHeight = Math.round(h);

      if (
        Math.abs(rLeft - lastTvRect.left) > 1 ||
        Math.abs(rTop - lastTvRect.top) > 1 ||
        Math.abs(rWidth - lastTvRect.width) > 1 ||
        Math.abs(rHeight - lastTvRect.height) > 1
      ) {
        karaokeTvDom.style.left = `${rLeft}px`;
        karaokeTvDom.style.top = `${rTop}px`;
        karaokeTvDom.style.width = `${rWidth}px`;
        karaokeTvDom.style.height = `${rHeight}px`;
        lastTvRect = { left: rLeft, top: rTop, width: rWidth, height: rHeight };
      }
    }

    function selectObject(obj) {
      state.selectedObject = obj;
      if (selectionBox) {
        if (obj) {
          selectionBox.setFromObject(obj);
          selectionBox.visible = true;
        } else {
          selectionBox.visible = false;
        }
      }
      updateInspectorUI();
    }

    function updateInspectorUI() {
      const card = document.getElementById('inspector-card');
      if (!card) return;
      if (!state.selectedObject || !state.selectedObject.userData.interactiveMeta) {
        card.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
        return;
      }

      const meta = state.selectedObject.userData.interactiveMeta;
      document.getElementById('inspector-icon').textContent = meta.icon || '✨';
      document.getElementById('inspector-zone').textContent = meta.zone || 'Văn phòng IT';
      document.getElementById('inspector-title').textContent = meta.title || 'Đối tượng';
      document.getElementById('inspector-desc').textContent = meta.desc || '';
      document.getElementById('inspector-metrics').innerHTML = meta.getMetrics ? meta.getMetrics() : '';

      const actionsEl = document.getElementById('inspector-actions');
      actionsEl.innerHTML = '';
      if (meta.getActions) {
        meta.getActions().forEach(act => {
          const btn = document.createElement('button');
          btn.className = act.primary
            ? 'px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition cursor-pointer'
            : 'px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-medium transition cursor-pointer';
          btn.textContent = act.label;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            act.run();
          });
          actionsEl.appendChild(btn);
        });
      }

      card.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
    }

    function bindEvents() {
      // HUD Collapse Toggle
      const toggleHudBtn = document.getElementById('toggle-hud-btn');
      if (toggleHudBtn) {
        toggleHudBtn.addEventListener('click', () => {
          state.hudCollapsed = !state.hudCollapsed;
          const body = document.getElementById('hud-body');
          const chev = document.getElementById('hud-chevron');
          if (body) body.classList.toggle('hidden', state.hudCollapsed);
          if (chev) chev.style.transform = state.hudCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        });
      }

      // Master Sound Toggle & Volume Sliders
      const btnSound = document.getElementById('btn-toggle-sound');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          setMasterVolume(state.masterVolume > 0 ? 0 : 75);
        });
      }
      const volSlider = document.getElementById('volume-slider');
      if (volSlider) {
        volSlider.addEventListener('input', (e) => setMasterVolume(e.target.value));
      }
      const karSlider = document.getElementById('karaoke-volume-slider');
      if (karSlider) {
        karSlider.addEventListener('input', (e) => setMasterVolume(e.target.value));
      }

      // Day / Night Lighting Mode
      const btnDay = document.getElementById('btn-day-mode');
      const btnNight = document.getElementById('btn-night-mode');
      if (btnDay) btnDay.addEventListener('click', () => setLightingMode(false));
      if (btnNight) btnNight.addEventListener('click', () => setLightingMode(true));

      // Ceiling Lights Per Zone & Toggle All
      document.querySelectorAll('[data-light-zone]').forEach(btn => {
        btn.addEventListener('click', () => {
          const z = btn.dataset.lightZone;
          state.lights[z] = !state.lights[z];
          updateCeilingLightsIntensity();
        });
      });
      const btnAllLights = document.getElementById('btn-toggle-all-lights');
      if (btnAllLights) {
        btnAllLights.addEventListener('click', () => {
          const anyOn = Object.values(state.lights).some(Boolean);
          Object.keys(state.lights).forEach(z => { state.lights[z] = !anyOn; });
          updateCeilingLightsIntensity();
        });
      }

      // Simulation Controls
      const btnSimPlay = document.getElementById('btn-sim-play');
      if (btnSimPlay) {
        btnSimPlay.addEventListener('click', () => {
          state.isPaused = !state.isPaused;
          btnSimPlay.textContent = state.isPaused ? '▶ Tiếp tục' : '⏸ Dừng';
          const lbl = document.getElementById('sim-status-label');
          if (lbl) {
            lbl.textContent = state.isPaused ? '● Tạm dừng' : '● Đang chạy';
            lbl.className = state.isPaused ? 'text-[10px] text-amber-400 font-semibold' : 'text-[10px] text-emerald-400 font-semibold';
          }
        });
      }
      const btnSimSpeed = document.getElementById('btn-sim-speed');
      if (btnSimSpeed) {
        btnSimSpeed.addEventListener('click', () => {
          state.simSpeed = state.simSpeed === 1 ? 2 : 1;
          btnSimSpeed.textContent = `⚡ ${state.simSpeed}x`;
        });
      }
      const btnToggleTags = document.getElementById('btn-toggle-tags');
      if (btnToggleTags) {
        btnToggleTags.addEventListener('click', () => {
          state.showTags = !state.showTags;
          btnToggleTags.className = state.showTags
            ? 'px-2 py-1.5 rounded-xl text-[11px] font-semibold bg-sky-500/25 border border-sky-400/40 text-sky-200 hover:bg-sky-500/35 transition cursor-pointer'
            : 'px-2 py-1.5 rounded-xl text-[11px] font-semibold bg-white/10 text-slate-400 hover:bg-white/20 transition cursor-pointer';
        });
      }

      // Boss Mode Event Buttons & Boss PIN Lock Modal Events
      const eventMap = [
        ['btn-event-crash', 'crash'],
        ['btn-event-pizza', 'pizza'],
        ['btn-event-disco', 'disco'],
        ['btn-event-nhau', 'nhau'],
        ['btn-event-karaoke', 'karaoke'],
        ['btn-event-chua', 'chua'],
        ['btn-event-normal', null],
        ['btn-end-event', null]
      ];
      eventMap.forEach(([id, evt]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => triggerOfficeEvent(evt));
      });

      const bossPinModal = document.getElementById('boss-pin-modal');
      const bossPinInput = document.getElementById('boss-pin-input');
      const bossPinError = document.getElementById('boss-pin-error');
      const btnBossToggle = document.getElementById('btn-boss-auth-toggle');
      const btnBossChangePin = document.getElementById('btn-boss-change-pin');
      const btnCloseBossPin = document.getElementById('btn-close-boss-pin');
      const btnCancelBossPin = document.getElementById('btn-cancel-boss-pin');
      const btnSubmitBossPin = document.getElementById('btn-submit-boss-pin');

      const closeBossPinModal = () => {
        if (bossPinModal) bossPinModal.classList.add('hidden');
        pendingBossActionCallback = null;
      };

      const submitBossPin = () => {
        if (!bossPinInput) return;
        const entered = (bossPinInput.value || '').trim().toLowerCase();
        if (getValidBossPins().has(entered)) {
          state.isBossUnlocked = true;
          try { localStorage.setItem(BOSS_AUTH_STORAGE_KEY, 'true'); } catch (e) {}
          if (bossPinModal) bossPinModal.classList.add('hidden');
          window.updateBossAuthUI();
          populateEmbodySelect();
          playDonationSound();
          showToast('👑 Đã mở khóa Quyền Trưởng Phòng Nguyễn Minh Đăng! Bạn có toàn quyền điều động nhân sự.');
          const cb = pendingBossActionCallback;
          pendingBossActionCallback = null;
          if (typeof cb === 'function') cb();
        } else {
          playSynthTone(200, 0.2, 'sawtooth', 0.14);
          if (bossPinError) bossPinError.classList.remove('hidden');
        }
      };

      if (btnBossToggle) {
        btnBossToggle.addEventListener('click', () => {
          if (state.isBossUnlocked) {
            state.isBossUnlocked = false;
            try { localStorage.removeItem(BOSS_AUTH_STORAGE_KEY); } catch (e) {}
            if (embodiedCharacter === officeCharacters[0]) {
              stopEmbodyCharacter();
            }
            window.updateBossAuthUI();
            populateEmbodySelect();
            showToast('🔒 Đã khóa lại Quyền Trưởng Phòng (Chuyển về Chế độ Khách).');
          } else {
            window.requireBossAuth('mở khóa bảng điều động Trưởng Phòng Minh Đăng');
          }
        });
      }
      if (btnBossChangePin) {
        btnBossChangePin.addEventListener('click', () => {
          if (!state.isBossUnlocked) return;
          const newPin = window.prompt('🔑 Nhập Mã PIN Trưởng Phòng mới của bạn (ít nhất 3 ký tự):', '');
          if (newPin && newPin.trim().length >= 3) {
            try { localStorage.setItem(BOSS_PIN_STORAGE_KEY, newPin.trim().toLowerCase()); } catch (e) {}
            showToast('✅ Đã lưu Mã PIN Trưởng Phòng mới trên máy của bạn!');
          }
        });
      }
      if (btnCloseBossPin) btnCloseBossPin.addEventListener('click', closeBossPinModal);
      if (btnCancelBossPin) btnCancelBossPin.addEventListener('click', closeBossPinModal);
      if (btnSubmitBossPin) btnSubmitBossPin.addEventListener('click', submitBossPin);
      if (bossPinInput) {
        bossPinInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitBossPin();
          }
        });
      }
      window.updateBossAuthUI();

      // Bottom Camera Preset Bar & Minimize / Expand Toggle
      document.querySelectorAll('.cam-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const camKey = btn.dataset.cam;
          goToCameraPreset(camKey);
          if (camKey === 'karaoke') {
            openKaraokeYouTubePanel(true);
          }
        });
      });
      const btnMinCamBar = document.getElementById('btn-minimize-cam-bar');
      const btnExpCamBar = document.getElementById('btn-expand-cam-bar');
      const bottomCamFull = document.getElementById('bottom-cam-full');
      if (btnMinCamBar && btnExpCamBar && bottomCamFull) {
        btnMinCamBar.addEventListener('click', () => {
          bottomCamFull.classList.add('hidden');
          btnExpCamBar.classList.remove('hidden');
        });
        btnExpCamBar.addEventListener('click', () => {
          btnExpCamBar.classList.add('hidden');
          bottomCamFull.classList.remove('hidden');
        });
      }

      // Close Inspector
      const closeInsp = document.getElementById('close-inspector');
      if (closeInsp) {
        closeInsp.addEventListener('click', () => selectObject(null));
      }

      // Karaoke TV 3D Panel Events
      const btnYtClose = document.getElementById('btn-yt-close');
      if (btnYtClose) btnYtClose.addEventListener('click', () => openKaraokeYouTubePanel(false));

      const btnTvExpand = document.getElementById('btn-tv-expand');
      if (btnTvExpand) btnTvExpand.addEventListener('click', () => setTvExpandedMode(true));

      const btnExitExpand = document.getElementById('btn-exit-tv-expand');
      if (btnExitExpand) btnExitExpand.addEventListener('click', () => setTvExpandedMode(false));

      const btnYtCustom = document.getElementById('btn-yt-play-custom');
      const ytInput = document.getElementById('yt-url-input');
      if (btnYtCustom && ytInput) {
        const runCustom = () => {
          const val = ytInput.value.trim();
          if (!val) {
            showToast('Hãy dán link Google Drive công khai hoặc link .mp4 vào ô!');
            return;
          }
          goToCameraPreset('karaoke');
          playKaraokeYouTube(val);
        };
        btnYtCustom.addEventListener('click', runCustom);
        ytInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') runCustom();
        });
      }

      document.querySelectorAll('.yt-song-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          goToCameraPreset('karaoke');
          playKaraokeYouTube(btn.dataset.ytId, btn.dataset.ytTitle);
        });
      });

      document.querySelectorAll('.beat-song-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          goToCameraPreset('karaoke');
          playKaraokeBeatSong(btn.dataset.beatSong);
        });
      });

      const btnKarScore = document.getElementById('btn-kar-score');
      if (btnKarScore) btnKarScore.addEventListener('click', triggerKaraokeScore);

      const btnKarConfetti = document.getElementById('btn-kar-confetti');
      if (btnKarConfetti) {
        btnKarConfetti.addEventListener('click', () => {
          spawnKaraokeConfetti(45);
          playSynthTone(659.3, 0.12, 'triangle', 0.14);
          setTimeout(() => playSynthTone(880, 0.2, 'triangle', 0.16), 100);
          showToast('🎉 Đã bắn pháo giấy 3D & vỗ tay cổ vũ ca sĩ!');
        });
      }

      const btnKarAirhorn = document.getElementById('btn-kar-airhorn');
      if (btnKarAirhorn) btnKarAirhorn.addEventListener('click', playAirhornSound);

      const btnKarLightMode = document.getElementById('btn-kar-lightmode');
      if (btnKarLightMode) {
        const modes = [
          { key: 'party', label: '🌈 Đèn: Quẩy' },
          { key: 'strobe', label: '⚡ Đèn: Chớp' },
          { key: 'chill', label: '💜 Đèn: Chill' },
          { key: 'off', label: '🌑 Đèn: Tắt' }
        ];
        btnKarLightMode.addEventListener('click', () => {
          const curIdx = modes.findIndex(m => m.key === state.karaokeLightMode);
          const next = modes[(curIdx + 1) % modes.length];
          state.karaokeLightMode = next.key;
          btnKarLightMode.textContent = next.label;
          showToast(`💡 Chế độ đèn Phòng Hát: ${next.label}`);
        });
      }

      const btnKarScreenShare = document.getElementById('btn-kar-screenshare');
      if (btnKarScreenShare) {
        btnKarScreenShare.addEventListener('click', startKaraokeScreenShareTo3DTv);
      }

      const karFileInput = document.getElementById('kar-file-input');
      if (karFileInput) {
        karFileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          goToCameraPreset('karaoke');
          playKaraokeYouTube(url, file.name);
        });
      }

      const btnKarStop = document.getElementById('btn-kar-stop');
      if (btnKarStop) btnKarStop.addEventListener('click', stopAllKaraokeMedia);

      // =======================================================================
      // AVATAR EMBODIMENT SYSTEM (HÓA THÂN THÀNH 1 NHÂN VẬT BẤT KỲ - FPS & TPS)
      // =======================================================================
      const embodyHud = document.getElementById('embodiment-hud');
      const embodySelect = document.getElementById('embody-char-select');
      const btnOpenEmbody = document.getElementById('btn-open-embody-bar');
      const btnEmbodyRename = document.getElementById('btn-embody-rename');
      const btnEmbodyCamMode = document.getElementById('btn-embody-cam-mode');
      const btnEmbodyExit = document.getElementById('btn-embody-exit');
      const btnEmbodyContext = document.getElementById('btn-embody-context-action');
      const embodyChatInput = document.getElementById('embody-chat-input');
      const btnEmbodyChatSend = document.getElementById('btn-embody-chat-send');

      function populateEmbodySelect() {
        if (!embodySelect) return;
        const isBoss = window.isBossAuthorized();
        embodySelect.innerHTML = officeCharacters
          .map((c, idx) => {
            const lockTag = (idx === 0 && !isBoss) ? '🔒 [Chỉ Chủ Phòng] ' : '';
            return `<option value="${idx}">${lockTag}${c.name} • ${c.role}</option>`;
          })
          .join('');
        if (embodiedCharacter) {
          const idx = officeCharacters.indexOf(embodiedCharacter);
          if (idx >= 0) embodySelect.value = String(idx);
        }
      }
      populateEmbodySelect();

      window.startEmbodyCharacter = function(charObj) {
        if (!charObj) return;
        // Exclusive Boss Avatar Protection: Guests cannot hijack Minh Đăng 👑 (officeCharacters[0])!
        if (charObj === officeCharacters[0] && !window.isBossAuthorized()) {
          window.requireBossAuth('Hóa thân vào nhân vật Trưởng Phòng Minh Đăng 👑', () => window.startEmbodyCharacter(officeCharacters[0]));
          populateEmbodySelect();
          return;
        }
        // Restore head visibility of previous embodied character if in FPS
        if (embodiedCharacter && embodiedCharacter.rig && embodiedCharacter.rig.headGroup) {
          embodiedCharacter.rig.headGroup.visible = true;
        }
        embodiedCharacter = charObj;
        wasdControlBoss = (charObj === officeCharacters[0]);
        charObj.taskQueue = [];
        charObj.manualTask = 'arrows';
        charObj.currentPose = 'idle';
        state.followCharacter = charObj;
        state.cameraLockedToAvatar = true;
        camTransition.active = false;

        if (embodyCamMode === 'fps' && charObj.rig && charObj.rig.headGroup) {
          charObj.rig.headGroup.visible = false;
        } else if (charObj.rig && charObj.rig.headGroup) {
          charObj.rig.headGroup.visible = true;
          // Position TPS camera nicely behind the character
          const p = charObj.rig.root.position;
          const rot = charObj.rig.root.rotation.y;
          camera.position.set(p.x - Math.sin(rot) * 4.5, 3.2, p.z - Math.cos(rot) * 4.5);
          controls.target.set(p.x, 1.25, p.z);
        }

        if (embodyHud) embodyHud.classList.remove('hidden');
        const embodyPillName = document.getElementById('embody-pill-name');
        if (embodyPillName) embodyPillName.textContent = `Hóa thân: ${charObj.name}`;
        populateEmbodySelect();
        updateEmbodyCamButton();
        showCharacterSpeech(charObj, `Tôi là ${charObj.name} (${charObj.role})! Dùng 4 phím ⬆️⬇️⬅️➡️ để đi dạo nhé! 🕹️`, 4.5);
        showToast(`🕹️ Đã hóa thân thành ${charObj.name} (${charObj.role})! Bấm ⬆️⬇️⬅️➡️ để đi, phím V đổi góc nhìn FPS/TPS, phím Space tương tác!`);
        updateInspectorUI();
        if (typeof window.syncLocalAvatarToNetwork === 'function') {
          window.syncLocalAvatarToNetwork(true);
        }
      };

      window.stopEmbodyCharacter = function() {
        if (embodiedCharacter && embodiedCharacter.rig && embodiedCharacter.rig.headGroup) {
          embodiedCharacter.rig.headGroup.visible = true;
        }
        const prev = embodiedCharacter;
        if (prev && typeof window.broadcastRealtimePacket === 'function') {
          window.broadcastRealtimePacket({
            type: 'leave_avatar',
            peerId: myPeerId,
            charIdx: officeCharacters.indexOf(prev)
          });
        }
        embodiedCharacter = null;
        wasdControlBoss = false;
        embodyCamMode = 'tps';
        state.followCharacter = null;
        state.cameraLockedToAvatar = false;
        if (embodyHud) embodyHud.classList.add('hidden');
        if (prev) {
          showToast(`Đã thoát hóa thân ${prev.name}.`);
        }
        updateInspectorUI();
      };

      function updateEmbodyCamButton() {
        if (!btnEmbodyCamMode) return;
        if (embodyCamMode === 'fps') {
          btnEmbodyCamMode.textContent = '👁️ Góc nhìn: Thứ 1 (FPS) [Phím V]';
          btnEmbodyCamMode.className = 'px-2.5 py-1 rounded-xl bg-amber-500/30 hover:bg-amber-500/45 border border-amber-400/70 text-amber-200 text-[10px] font-bold cursor-pointer transition whitespace-nowrap shrink-0';
        } else {
          btnEmbodyCamMode.textContent = '🎥 Góc nhìn: Thứ 3 (TPS) [Phím V]';
          btnEmbodyCamMode.className = 'px-2.5 py-1 rounded-xl bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-200 text-[10px] font-bold cursor-pointer transition whitespace-nowrap shrink-0';
        }
      }

      window.toggleEmbodyCamMode = function() {
        if (!embodiedCharacter) return;
        embodyCamMode = (embodyCamMode === 'tps') ? 'fps' : 'tps';
        if (embodiedCharacter.rig && embodiedCharacter.rig.headGroup) {
          embodiedCharacter.rig.headGroup.visible = (embodyCamMode !== 'fps');
        }
        if (embodyCamMode === 'tps') {
          const p = embodiedCharacter.rig.root.position;
          const rot = embodiedCharacter.rig.root.rotation.y;
          camera.position.set(p.x - Math.sin(rot) * 4.5, 3.2, p.z - Math.cos(rot) * 4.5);
          controls.target.set(p.x, 1.25, p.z);
          showToast('🎥 Đã chuyển sang Góc nhìn Thứ 3 (TPS Sau lưng nhân vật)');
        } else {
          showToast('👁️ Đã chuyển sang Góc nhìn Thứ 1 (FPS Mắt thật nhân vật)! Dùng ⬅️ ➡️ để quay đầu, ⬆️ ⬇️ để tiến/lùi!');
        }
        updateEmbodyCamButton();
      };

      window.getEmbodyContextSpec = function(c) {
        if (!c) return { label: '⚡ [Phím Space] Tương tác', run: () => {} };
        const x = c.rig.root.position.x;
        const z = c.rig.root.position.z;
        // 1. Near Fortune Peach Tree at Grand Temple Complex (X = 35.5, Z = 7.5)
        if (Math.hypot(x - 35.5, z - 7.5) < 2.8) {
          return {
            label: '🎋 [Phím Space] Lắc Ống Xăm Xin Quẻ Đại Cát!',
            run: () => {
              playWoodenFishSound();
              setTimeout(() => playDonationSound(), 180);
              const msg = pickNextQuote(IT_FORTUNES, 'fortune');
              showCharacterSpeech(c, msg, 6.0);
              showToast(`🎋 ${c.name} vừa rút được: ${msg}`);
            }
          };
        }
        // 2. Inside Grand Temple Complex or Zen Koi Garden
        if (x > 21.0 || (x > 12.1 && z >= 0.8)) {
          return {
            label: '🔔 [Phím Space] Thỉnh Đại Hồng Chung & Quỳ Lạy Khấn!',
            run: () => {
              playTempleBellSound(false);
              c.currentPose = 'kneel-pray';
              c.rig.root.rotation.y = Math.atan2(30.5 - x, 0.2 - z);
              const pr = pickNextQuote(TEMPLE_PRAYERS, 'temple');
              showCharacterSpeech(c, pr, 6.0);
            }
          };
        }
        // 3. Inside Karaoke VIP Room
        if (x > 12.1 && z < 0.8) {
          return {
            label: '🎤 [Phím Space] Cầm Mic Lĩnh Xướng & Bắn Pháo Giấy!',
            run: () => {
              c.currentPose = 'sing';
              spawnKaraokeConfetti(40);
              if (!state.beatPlaying && !state.youtubePlaying) {
                playKaraokeBeatSong(state.currentSongKey || 'cat-doi');
              }
              showCharacterSpeech(c, 'Cắt đôi nỗi sầu, cắt luôn bug Prod đêm nay!! 🎤🎶', 5.5);
            }
          };
        }
        // 4. At Nhậu Zone / BBQ Grill
        if (z > 8.6 && x < 6.5) {
          return {
            label: '🍻 [Phím Space] Nâng Ly Bia Hô "1-2-3 DZÔ!" & Ăn BBQ!',
            run: () => {
              c.currentPose = 'nhau';
              playSynthTone(1568, 0.08, 'sine', 0.16);
              setTimeout(() => playSynthTone(2093, 0.18, 'triangle', 0.18), 70);
              showCharacterSpeech(c, 'KENG!! 1... 2... 3... DZÔ 100% anh em ơi!! 🍻🦑', 5.0);
              showToast(`🍻 ${c.name} vừa nâng cốc cụng ly 1-2-3 DZÔ tại Quán Nhậu!`);
            }
          };
        }
        // 5. Inside Boss Minh Đăng Office
        if (x < -12.0) {
          return {
            label: '👑 [Phím Space] Phát Lệnh Go-Live & Thưởng Nóng Toàn Team!',
            run: () => {
              playDonationSound();
              spawnKaraokeConfetti(45);
              showCharacterSpeech(c, 'Hệ thống .NET 9 + Vue 3 + MongoDB Go-Live thành công! Thưởng nóng cả phòng!! 👑💰', 6.0);
              showToast(`👑 ${c.name} vừa phát lệnh Go-Live từ Phòng Trưởng Phòng!`);
            }
          };
        }
        // 6. Inside Server Room
        if (x > 5.3 && z > 2.2 && x <= 12.1) {
          return {
            label: '❄️ [Phím Space] Kích Hoạt Turbo Làm Mát Tủ Server!',
            run: () => {
              turboCooling = !turboCooling;
              if (state.activeEvent === 'crash') triggerOfficeEvent(null);
              playSynthTone(880, 0.15, 'sine', 0.12);
              showCharacterSpeech(c, 'Đã tối ưu MongoDB & Redis Cluster, hạ nhiệt Server về 18°C! ❄️🖥️', 5.0);
            }
          };
        }
        // 7. Near Pantry / Espresso Machine
        if (x > 1.8 && z <= 2.2 && x <= 12.1) {
          return {
            label: '☕ [Phím Space] Pha Espresso Thơm Lừng & Cầm Tay Đi Dạo!',
            run: () => {
              coffeeBrewingTimer = 6.0;
              c.holdingCoffee = true;
              c.energy = 100;
              playSynthTone(660, 0.12, 'triangle', 0.12);
              showCharacterSpeech(c, 'Làm ly Espresso nóng hổi lấy 100% năng lượng code tiếp nào! ☕⚡', 5.0);
            }
          };
        }
        // 7.5 Inside Glass Meeting Room (X < -2.2, Z < -2.2) -> Launch WebRTC Video/Voice Call!
        if (x < -2.2 && x > -12.0 && z < -2.2 && z > -9.0) {
          return {
            label: '📹 [Phím Space] Bật Call Video & Mic Nói Chuyện Trong Phòng Họp!',
            run: () => {
              if (window.MeetingCallManager) {
                if (window.MeetingCallManager.isInCall()) {
                  window.MeetingCallManager.ensureDockVisible(true);
                } else {
                  window.MeetingCallManager.joinMeetingCall(true);
                }
              }
            }
          };
        }
        // Default anywhere in Main Office / Meeting / Dev -> Speak room-specific quote
        return {
          label: '👋 [Phím Space] Chào Đồng Nghiệp & Báo Cáo Tiến Độ!',
          run: () => {
            playSynthTone(740, 0.1, 'triangle', 0.12);
            const q = pickZoneQuoteForCharacter(c);
            showCharacterSpeech(c, q, 5.0);
          }
        };
      };

      function getDefaultAvatarForLocalUser() {
        if (window.isBossAuthorized()) return officeCharacters[0];
        // For guests: prefer their own custom character if created, otherwise Minh Quân (index 1)
        const customChar = officeCharacters.find(c => !!c.customId);
        return customChar || officeCharacters[1] || officeCharacters[0];
      }

      if (btnOpenEmbody) {
        btnOpenEmbody.addEventListener('click', () => {
          if (embodiedCharacter) {
            stopEmbodyCharacter();
          } else {
            const defaultAv = getDefaultAvatarForLocalUser();
            const selectedChar = (state.selectedObject && state.selectedObject.type === 'character')
              ? officeCharacters.find(c => c.id === state.selectedObject.id)
              : null;
            const targetChar = (selectedChar && !(selectedChar === officeCharacters[0] && !window.isBossAuthorized()))
              ? selectedChar
              : defaultAv;
            startEmbodyCharacter(targetChar);
          }
        });
      }
      if (embodySelect) {
        embodySelect.addEventListener('change', (e) => {
          const idx = parseInt(e.target.value, 10);
          if (officeCharacters[idx]) {
            startEmbodyCharacter(officeCharacters[idx]);
          }
        });
      }
      if (btnEmbodyRename) {
        btnEmbodyRename.addEventListener('click', () => {
          if (!embodiedCharacter) return;
          const newName = window.prompt('Nhập tên mới cho nhân vật bạn đang hóa thân:', embodiedCharacter.name);
          if (newName && newName.trim()) {
            embodiedCharacter.name = newName.trim();
            if (embodiedCharacter.tagEl) {
              embodiedCharacter.tagEl.textContent = `${embodiedCharacter.name} • ${embodiedCharacter.role}`;
            }
            if (embodiedCharacter.rig && embodiedCharacter.rig.root && embodiedCharacter.rig.root.userData && embodiedCharacter.rig.root.userData.inspectorMeta) {
              embodiedCharacter.rig.root.userData.inspectorMeta.title = embodiedCharacter.name;
            }
            populateEmbodySelect();
            showCharacterSpeech(embodiedCharacter, `Xin chào anh em! Tôi là ${embodiedCharacter.name} đây! 👋✨`, 5.0);
            updateInspectorUI();
          }
        });
      }
      if (btnEmbodyCamMode) {
        btnEmbodyCamMode.addEventListener('click', () => toggleEmbodyCamMode());
      }
      if (btnEmbodyExit) {
        btnEmbodyExit.addEventListener('click', () => stopEmbodyCharacter());
      }
      if (btnEmbodyContext) {
        btnEmbodyContext.addEventListener('click', () => {
          if (embodiedCharacter) {
            getEmbodyContextSpec(embodiedCharacter).run();
          }
        });
      }
      document.querySelectorAll('.embody-emote-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!embodiedCharacter) return;
          const pose = btn.dataset.emotePose || 'dance';
          const msg = btn.dataset.emoteMsg || 'Quẩy lên anh em ơi!';
          embodiedCharacter.currentPose = pose;
          showCharacterSpeech(embodiedCharacter, msg, 5.0);
          playSynthTone(659.3, 0.1, 'triangle', 0.12);
          if (typeof window.syncLocalAvatarToNetwork === 'function') {
            window.syncLocalAvatarToNetwork(true);
          }
          if (typeof window.broadcastRealtimePacket === 'function') {
            window.broadcastRealtimePacket({
              type: 'chat',
              peerId: myPeerId,
              charIdx: officeCharacters.indexOf(embodiedCharacter),
              senderName: embodiedCharacter.name,
              role: embodiedCharacter.role,
              text: msg
            });
          }
        });
      });

      // =======================================================================
      // SERVERLESS REALTIME ONLINE MULTIPLAYER (MQTT over WSS + BroadcastChannel)
      // =======================================================================
      const onlineCountLabel = document.getElementById('online-count-label');
      const onlineBrokerLabel = document.getElementById('online-broker-label');
      const onlinePeersList = document.getElementById('online-peers-list');
      const onlineChatMessages = document.getElementById('online-chat-messages');
      const onlineChatDrawer = document.getElementById('online-chat-drawer');
      const btnToggleOnlineChat = document.getElementById('btn-toggle-online-chat');
      const btnCloseOnlineChat = document.getElementById('btn-close-online-chat');
      const btnMinimizeOnlineWidget = document.getElementById('btn-minimize-online-widget');
      const btnExpandOnlineWidget = document.getElementById('btn-expand-online-widget');
      const onlineFullHeader = document.getElementById('online-full-header');
      const onlineMiniCount = document.getElementById('online-mini-count');
      const btnEmbodyMinimize = document.getElementById('btn-embody-minimize');
      const btnEmbodyExpandPill = document.getElementById('btn-embody-expand-pill');
      const embodyFullCard = document.getElementById('embody-full-card');
      const embodyHudBody = document.getElementById('embody-hud-body');
      const onlineQuickChatInput = document.getElementById('online-quick-chat-input');
      const btnOnlineQuickChatSend = document.getElementById('btn-online-quick-chat-send');

      if (btnToggleOnlineChat && onlineChatDrawer) {
        btnToggleOnlineChat.addEventListener('click', () => {
          onlineChatDrawer.classList.toggle('hidden');
        });
      }
      if (btnCloseOnlineChat && onlineChatDrawer) {
        btnCloseOnlineChat.addEventListener('click', () => {
          onlineChatDrawer.classList.add('hidden');
        });
      }
      if (btnMinimizeOnlineWidget && btnExpandOnlineWidget && onlineFullHeader) {
        btnMinimizeOnlineWidget.addEventListener('click', () => {
          onlineFullHeader.classList.add('hidden');
          if (onlineChatDrawer) onlineChatDrawer.classList.add('hidden');
          btnExpandOnlineWidget.classList.remove('hidden');
        });
        btnExpandOnlineWidget.addEventListener('click', () => {
          btnExpandOnlineWidget.classList.add('hidden');
          onlineFullHeader.classList.remove('hidden');
        });
      }
      if (btnEmbodyMinimize && embodyFullCard && btnEmbodyExpandPill) {
        btnEmbodyMinimize.addEventListener('click', () => {
          embodyFullCard.classList.add('hidden');
          btnEmbodyExpandPill.classList.remove('hidden');
          const pillName = document.getElementById('embody-pill-name');
          if (pillName && embodiedCharacter) {
            pillName.textContent = `Hóa thân: ${embodiedCharacter.name}`;
          }
        });
        btnEmbodyExpandPill.addEventListener('click', () => {
          btnEmbodyExpandPill.classList.add('hidden');
          embodyFullCard.classList.remove('hidden');
        });
      }

      function appendOnlineChatLog(senderName, role, text, isSelf = false) {
        if (!onlineChatMessages) return;
        const item = document.createElement('div');
        item.className = 'leading-snug break-words';
        const badgeColor = isSelf ? 'text-amber-300' : 'text-emerald-300';
        const safeSender = senderName.replace(/[<>&]/g, '');
        const safeText = text.replace(/[<>&]/g, '');
        item.innerHTML = `<span class="font-bold ${badgeColor}">${safeSender}:</span> <span class="text-white">${safeText}</span>`;
        onlineChatMessages.appendChild(item);
        while (onlineChatMessages.children.length > 30) {
          onlineChatMessages.removeChild(onlineChatMessages.firstChild);
        }
        onlineChatMessages.scrollTop = onlineChatMessages.scrollHeight;
      }

      window.broadcastRealtimePacket = function(payload) {
        const pkt = { ...payload, peerId: myPeerId, ts: Date.now() };
        const raw = JSON.stringify(pkt);
        if (localBroadcastChan) {
          try { localBroadcastChan.postMessage(raw); } catch (e) {}
        }
        if (mqttClient && mqttClient.connected) {
          try { mqttClient.publish(REALTIME_TOPIC, raw, { qos: 0 }); } catch (e) {}
        }
      };

      window.syncLocalAvatarToNetwork = function(force = false) {
        const av = embodiedCharacter || (wasdControlBoss ? officeCharacters[0] : null);
        if (!av) return;
        const idx = officeCharacters.indexOf(av);
        if (idx < 0) return;
        const p = av.rig.root.position;
        window.broadcastRealtimePacket({
          type: 'avatar',
          charIdx: idx,
          customId: av.customId || null,
          customCfg: av.customCfg || null,
          name: av.name,
          role: av.role,
          x: Number(p.x.toFixed(3)),
          z: Number(p.z.toFixed(3)),
          rotY: Number(av.rig.root.rotation.y.toFixed(3)),
          pose: av.currentPose || 'idle',
          holdingCoffee: !!av.holdingCoffee
        });
      };

      function refreshOnlinePeersUI() {
        const now = performance.now();
        for (const [pid, info] of remotePeersMap.entries()) {
          if (now - info.lastSeen > 11000) {
            remotePeersMap.delete(pid);
          }
        }
        const totalOnline = 1 + remotePeersMap.size;
        if (onlineCountLabel) {
          onlineCountLabel.textContent = `🟢 ONLINE: ${totalOnline} người`;
        }
        if (onlineMiniCount) {
          onlineMiniCount.textContent = `🟢 ${totalOnline} Online`;
        }
        if (onlinePeersList) {
          const myLabel = embodiedCharacter ? `🟢 Bạn (${embodiedCharacter.name})` : '🟢 Bạn (Khách)';
          const others = Array.from(remotePeersMap.values()).map(p => `🟢 ${p.name || 'Đồng nghiệp'}`);
          onlinePeersList.textContent = [myLabel, ...others].join(' • ');
        }
      }

      window.showOfficeToast = showToast;
      window.getEmbodiedAvatarInfo = function() {
        const av = embodiedCharacter || officeCharacters[0] || { name: 'Minh Đăng 👑', role: 'Trưởng Phòng IT' };
        return {
          peerId: myPeerId,
          name: av.name,
          role: av.role
        };
      };

      function handleIncomingRealtimeRaw(rawStr) {
        let pkt = null;
        try {
          pkt = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
        } catch (e) {
          return;
        }
        if (!pkt || !pkt.peerId || pkt.peerId === myPeerId) return;

        if (pkt.type === 'webrtc_sig' && window.MeetingCallManager) {
          window.MeetingCallManager.handleSignalPacket(pkt);
          return;
        }

        const now = performance.now();
        const prevInfo = remotePeersMap.get(pkt.peerId) || {};
        remotePeersMap.set(pkt.peerId, {
          lastSeen: now,
          charIdx: typeof pkt.charIdx === 'number' ? pkt.charIdx : prevInfo.charIdx,
          name: pkt.name || pkt.senderName || prevInfo.name || 'Đồng nghiệp Online',
          role: pkt.role || prevInfo.role || 'IT Staff'
        });
        refreshOnlinePeersUI();

        if (pkt.type === 'avatar') {
          let c = null;
          if (pkt.customId) {
            c = officeCharacters.find(item => item.customId === pkt.customId);
            if (!c && pkt.customCfg && typeof window.spawnCustomCharacter === 'function') {
              c = window.spawnCustomCharacter({ ...pkt.customCfg, customId: pkt.customId }, false);
            }
          } else if (typeof pkt.charIdx === 'number' && officeCharacters[pkt.charIdx]) {
            c = officeCharacters[pkt.charIdx];
          }
          if (!c || c === embodiedCharacter) return; // Don't overwrite local player's own avatar
          c.remoteOwnerId = pkt.peerId;
          c.remoteLastSeen = now;
          c.remoteTargetX = pkt.x;
          c.remoteTargetZ = pkt.z;
          c.remoteTargetRotY = pkt.rotY;
          c.remotePose = pkt.pose || 'idle';
          c.holdingCoffee = !!pkt.holdingCoffee;
          c.taskQueue = [];
          if (pkt.name && c.name !== pkt.name) {
            c.name = pkt.name;
          }
          if (c.tagEl) {
            c.tagEl.className = 'char-tag px-2.5 py-0.5 rounded-full bg-emerald-950/95 border border-emerald-400 text-[10px] font-extrabold text-emerald-200 whitespace-nowrap shadow-lg shadow-emerald-500/30';
            c.tagEl.textContent = `🟢 [ONLINE] ${c.name} • ${c.role}`;
          }
        } else if (pkt.type === 'leave_avatar' && typeof pkt.charIdx === 'number' && officeCharacters[pkt.charIdx]) {
          const c = officeCharacters[pkt.charIdx];
          if (c.remoteOwnerId === pkt.peerId) {
            c.remoteOwnerId = null;
            if (c.tagEl) {
              c.tagEl.className = 'char-tag px-2 py-0.5 rounded-full bg-slate-900/85 border border-white/15 text-[10px] font-semibold text-white whitespace-nowrap shadow-md';
              c.tagEl.textContent = `${c.name} • ${c.role}`;
            }
          }
        } else if (pkt.type === 'chat' && pkt.text) {
          const c = (typeof pkt.charIdx === 'number' && officeCharacters[pkt.charIdx])
            ? officeCharacters[pkt.charIdx]
            : officeCharacters[0];
          if (c) {
            showCharacterSpeech(c, pkt.text, 6.5);
          }
          playSynthTone(880, 0.08, 'sine', 0.12);
          appendOnlineChatLog(pkt.senderName || (c ? c.name : 'Online'), pkt.role || '', pkt.text, false);
        } else if (pkt.type === 'office_event' && pkt.bossSig === BOSS_NETWORK_SIG) {
          isHandlingRemotePacket = true;
          triggerOfficeEvent(pkt.eventType, true);
          isHandlingRemotePacket = false;
        } else if (pkt.type === 'char_command' && pkt.bossSig === BOSS_NETWORK_SIG) {
          let targetChar = null;
          if (pkt.customId) {
            targetChar = officeCharacters.find(item => item.customId === pkt.customId);
          } else if (typeof pkt.charIdx === 'number' && officeCharacters[pkt.charIdx]) {
            targetChar = officeCharacters[pkt.charIdx];
          }
          if (targetChar && targetChar !== embodiedCharacter) {
            isHandlingRemotePacket = true;
            commandCharacter(targetChar, pkt.actionType, false);
            isHandlingRemotePacket = false;
          }
        }
      }

      function initRealtimeMultiplayer() {
        // 1. Instant 0ms Local Multi-Tab Sync via BroadcastChannel
        if (typeof BroadcastChannel !== 'undefined') {
          localBroadcastChan = new BroadcastChannel('van_phong_it_3d_realtime_v1');
          localBroadcastChan.onmessage = (ev) => handleIncomingRealtimeRaw(ev.data);
        }

        // 2. Global Internet Realtime Sync via MQTT over Secure WebSockets (WSS)
        const brokers = [
          'wss://broker.emqx.io:8084/mqtt',
          'wss://broker.hivemq.com:8884/mqtt'
        ];
        let brokerIdx = 0;

        const connectBroker = (url) => {
          if (typeof window.mqtt === 'undefined') {
            if (onlineBrokerLabel) onlineBrokerLabel.textContent = '🟢 Đồng bộ Đa Tab (Local Realtime)';
            return;
          }
          try {
            mqttClient = window.mqtt.connect(url, {
              clientId: 'it3d_' + myPeerId,
              clean: true,
              connectTimeout: 5000,
              reconnectPeriod: 4000
            });
            mqttClient.on('connect', () => {
              if (onlineBrokerLabel) onlineBrokerLabel.textContent = '🌐 Server Cloud Realtime: Đã kết nối';
              mqttClient.subscribe(REALTIME_TOPIC, { qos: 0 });
              window.broadcastRealtimePacket({
                type: 'presence',
                charIdx: embodiedCharacter ? officeCharacters.indexOf(embodiedCharacter) : -1,
                name: embodiedCharacter ? embodiedCharacter.name : 'Khách Online'
              });
            });
            mqttClient.on('message', (topic, message) => {
              if (topic === REALTIME_TOPIC && message) {
                handleIncomingRealtimeRaw(message.toString());
              }
            });
            mqttClient.on('error', () => {
              if (brokerIdx === 0) {
                brokerIdx = 1;
                try { mqttClient.end(true); } catch (e) {}
                connectBroker(brokers[1]);
              }
            });
          } catch (err) {}
        };
        connectBroker(brokers[0]);

        window.addEventListener('beforeunload', () => {
          if (typeof window.saveProgressToStorage === 'function') {
            window.saveProgressToStorage();
          }
          if (embodiedCharacter) {
            window.broadcastRealtimePacket({
              type: 'leave_avatar',
              charIdx: officeCharacters.indexOf(embodiedCharacter)
            });
          }
        });
      }
      initRealtimeMultiplayer();

      // =======================================================================
      // 3D CUSTOM CHARACTER CREATOR & LOCALSTORAGE AUTO-SAVE PERSISTENCE
      // =======================================================================
      const SAVE_STORAGE_KEY = 'van_phong_it_3d_saved_progress_v2';
      const customCharactersList = []; // Stores customCfg objects created by local user

      window.spawnCustomCharacter = function(cfg, autoEmbody = true, isRestoring = false) {
        if (!cfg) return null;
        const customId = cfg.customId || ('custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        // Prevent duplicate customId
        const existing = officeCharacters.find(item => item.customId === customId);
        if (existing) {
          if (autoEmbody) startEmbodyCharacter(existing);
          return existing;
        }

        const shirtHex = typeof cfg.shirt === 'string' ? parseInt(cfg.shirt, 16) : (cfg.shirt || 0x64748b);
        const hairHex = typeof cfg.hair === 'string' ? parseInt(cfg.hair, 16) : (cfg.hair || 0x1c1917);
        const skinHex = typeof cfg.skin === 'string' ? parseInt(cfg.skin, 16) : (cfg.skin || 0xf3c693);
        const hairStyleNum = parseInt(cfg.hairStyle, 10) || 0;
        const hasGlasses = cfg.glasses === true || cfg.glasses === 'true';
        const isBossSuit = cfg.outfitType === 'boss';

        const rig = createHumanoidRig({
          shirt: shirtHex,
          hair: hairHex,
          hairStyle: hairStyleNum,
          skin: skinHex,
          glasses: hasGlasses,
          isBoss: isBossSuit
        });

        // Determine spawn coordinates based on spawnZone or saved x/z
        let spawnX = 30.5, spawnZ = 6.05, spawnRotY = Math.PI, initialPose = 'incense';
        if (typeof cfg.x === 'number' && typeof cfg.z === 'number') {
          // Migrate old saved temple coordinates (inside new Koi Pond X: 13.5..19.5) to the new Grand Temple Courtyard (X = 30.5)
          if (cfg.x >= 13.2 && cfg.x <= 19.8 && cfg.z >= 1.5 && cfg.z <= 8.5) {
            spawnX = 30.5 + (Math.random() - 0.5) * 1.4;
            spawnZ = 6.05;
          } else {
            spawnX = cfg.x;
            spawnZ = cfg.z;
          }
          spawnRotY = typeof cfg.rotY === 'number' ? cfg.rotY : 0;
          initialPose = cfg.pose || 'idle';
        } else if (cfg.spawnZone === 'office') {
          spawnX = 0.5; spawnZ = 3.2; spawnRotY = 0; initialPose = 'idle';
        } else if (cfg.spawnZone === 'meeting') {
          spawnX = -5.2; spawnZ = -4.5; spawnRotY = Math.PI; initialPose = 'idle';
        } else if (cfg.spawnZone === 'nhau') {
          spawnX = -2.2; spawnZ = 10.2; spawnRotY = 0; initialPose = 'nhau';
        } else if (cfg.spawnZone === 'karaoke') {
          spawnX = 16.05; spawnZ = -2.5; spawnRotY = Math.PI / 2; initialPose = 'sing';
        } else {
          // Default: Grand Temple Courtyard holding 3 burning incense sticks!
          spawnX = 30.5 + (Math.random() - 0.5) * 1.4;
          spawnZ = 6.05;
          spawnRotY = Math.PI;
          initialPose = 'incense';
        }

        rig.root.position.set(spawnX, 0, spawnZ);
        rig.root.rotation.y = spawnRotY;
        scene.add(rig.root);

        const tagsLayer = document.getElementById('character-tags-layer');
        const speechLayer = document.getElementById('speech-bubbles-layer');

        const tagEl = document.createElement('div');
        tagEl.className = 'char-tag px-2.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-400/70 text-[10px] font-extrabold text-amber-200 whitespace-nowrap shadow-md';
        tagEl.textContent = `✨ ${cfg.name} • ${cfg.role}`;
        tagsLayer.appendChild(tagEl);

        const speechEl = document.createElement('div');
        speechEl.className = 'speech-bubble px-2.5 py-1 rounded-xl bg-white/95 text-slate-900 text-[11px] font-bold shadow-lg whitespace-nowrap opacity-0';
        speechLayer.appendChild(speechEl);

        const idx = officeCharacters.length;
        const normalizedCfg = {
          customId,
          name: cfg.name || 'Phật Tử Tâm An',
          role: cfg.role || 'Phật Tử Đi Lễ Chùa 🙏',
          shirt: shirtHex,
          hair: hairHex,
          hairStyle: hairStyleNum,
          skin: skinHex,
          glasses: hasGlasses,
          outfitType: cfg.outfitType || 'temple',
          spawnZone: cfg.spawnZone || 'chua'
        };

        const charData = {
          id: `char-custom-${idx}`,
          customId,
          customCfg: normalizedCfg,
          name: normalizedCfg.name,
          role: normalizedCfg.role,
          rig,
          homeSeat: null,
          roamCycle: ['chua', 'coffee', 'relax'],
          roamIdx: 0,
          roamWaitTimer: 8,
          currentPose: initialPose,
          manualTask: 'arrows',
          taskQueue: [],
          queueIndex: 0,
          holdingCoffee: false,
          energy: 100,
          mood: 100,
          emoji: '🛕',
          activity: 'Đang thành tâm lễ chùa Cầu Không Bug 🙏',
          phase: idx * 1.13 + 0.5,
          tagEl,
          speechEl,
          speechTimer: 0
        };
        officeCharacters.push(charData);

        registerInteractive(rig.root, {
          id: charData.id,
          type: 'character',
          icon: '✨',
          zone: charData.role,
          title: charData.name,
          desc: 'Nhân vật 3D do người chơi tự thiết kế! Bạn có thể Hóa Thân, đi lễ chùa, thắp nhang, gõ chuông hoặc đi nhậu.',
          getMetrics: () => `
            <div class="flex justify-between"><span class="text-slate-400">Hoạt động:</span><span class="text-amber-300 font-semibold text-right ml-2">${charData.activity}</span></div>
          `,
          getActions: () => {
            const isEmbodied = embodiedCharacter === charData;
            return [
              {
                label: isEmbodied ? `⏹ Thoát Hóa Thân (${charData.name})` : `🕹️ Hóa Thân Thành ${charData.name}!`,
                primary: true,
                run: () => {
                  if (isEmbodied) stopEmbodyCharacter();
                  else startEmbodyCharacter(charData);
                }
              },
              { label: '🛕 Đi Viếng Chùa Thắp Nhang', primary: false, run: () => commandCharacter(charData, 'chua') },
              { label: '💵 Bỏ Tiền Hòm Công Đức', primary: false, run: () => commandCharacter(charData, 'donate') },
              { label: '🍻 Đi Nhậu 1-2-3 Dzô', primary: false, run: () => commandCharacter(charData, 'nhau') },
              { label: '🎤 Vào Phòng Hát Karaoke', primary: false, run: () => commandCharacter(charData, 'karaoke') },
              { label: '📊 Vào Phòng Họp Video Call', primary: false, run: () => commandCharacter(charData, 'meeting') }
            ];
          }
        });

        populateEmbodySelect();

        if (autoEmbody) {
          customCharactersList.push(normalizedCfg);
          startEmbodyCharacter(charData);
          charData.currentPose = initialPose;
          if (!isRestoring) {
            if (cfg.spawnZone === 'chua' || !cfg.spawnZone) {
              incenseActiveTimer = 35;
              playTempleBellSound(false);
              showCharacterSpeech(charData, `Con tên là ${charData.name}, thành tâm dâng hương cầu bình an & 0 Bug! 🙏🕯️`, 6.5);
            }
            window.saveProgressToStorage();
          }
        }
        return charData;
      };

      window.saveProgressToStorage = function() {
        try {
          const av = embodiedCharacter;
          const saveObj = {
            ts: Date.now(),
            donationTotal: state.donationTotal,
            donationCount: state.donationCount,
            isNightMode: state.isNightMode,
            masterVolume: state.masterVolume,
            embodyCamMode,
            customCharacters: customCharactersList.map(cfg => {
              const found = officeCharacters.find(c => c.customId === cfg.customId);
              if (found) {
                return {
                  ...cfg,
                  name: found.name,
                  role: found.role,
                  x: Number(found.rig.root.position.x.toFixed(3)),
                  z: Number(found.rig.root.position.z.toFixed(3)),
                  rotY: Number(found.rig.root.rotation.y.toFixed(3)),
                  pose: found.currentPose
                };
              }
              return cfg;
            }),
            embodiedState: av ? {
              customId: av.customId || null,
              charIdx: officeCharacters.indexOf(av),
              name: av.name,
              role: av.role,
              x: Number(av.rig.root.position.x.toFixed(3)),
              z: Number(av.rig.root.position.z.toFixed(3)),
              rotY: Number(av.rig.root.rotation.y.toFixed(3)),
              pose: av.currentPose,
              holdingCoffee: !!av.holdingCoffee
            } : null
          };
          localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveObj));
        } catch (e) {}
      };

      window.loadProgressFromStorage = function() {
        try {
          const raw = localStorage.getItem(SAVE_STORAGE_KEY);
          if (!raw) return;
          const data = JSON.parse(raw);
          if (!data) return;

          if (typeof data.donationTotal === 'number') state.donationTotal = data.donationTotal;
          if (typeof data.donationCount === 'number') state.donationCount = data.donationCount;
          if (typeof data.isNightMode === 'boolean' && data.isNightMode !== state.isNightMode) {
            setLightingMode(data.isNightMode);
          }

          // Restore any custom-created characters
          if (Array.isArray(data.customCharacters)) {
            data.customCharacters.forEach(cfg => {
              customCharactersList.push(cfg);
              window.spawnCustomCharacter(cfg, false, true);
            });
          }

          // Restore embodied character & exact position/pose
          if (data.embodiedState) {
            const es = data.embodiedState;
            let target = null;
            if (es.customId) {
              target = officeCharacters.find(c => c.customId === es.customId);
            } else if (typeof es.charIdx === 'number' && officeCharacters[es.charIdx]) {
              target = officeCharacters[es.charIdx];
            }
            if (target) {
              // Do not auto-embody Boss Minh Đăng (index 0) on page load if user is in Guest mode
              if (target === officeCharacters[0] && !window.isBossAuthorized()) {
                return;
              }
              if (es.name) {
                target.name = es.name;
                if (target.tagEl) target.tagEl.textContent = `${target.name} • ${target.role}`;
              }
              if (typeof es.x === 'number' && typeof es.z === 'number') {
                let rx = es.x, rz = es.z;
                if (rx >= 13.2 && rx <= 19.8 && rz >= 1.5 && rz <= 8.5) {
                  rx = 30.5;
                  rz = 6.05;
                }
                target.rig.root.position.set(rx, 0, rz);
              }
              if (typeof es.rotY === 'number') {
                target.rig.root.rotation.y = es.rotY;
              }
              target.holdingCoffee = !!es.holdingCoffee;
              startEmbodyCharacter(target);
              if (es.pose) target.currentPose = es.pose;
              if (data.embodyCamMode === 'fps' && embodyCamMode !== 'fps') {
                toggleEmbodyCamMode();
              }
              showToast(`💾 Đã tự động khôi phục nhân vật "${target.name}" & tiến trình lần trước của bạn!`);
            }
          }
        } catch (e) {}
      };

      // Bind Character Creator Modal UI Events
      const ccModal = document.getElementById('char-creator-modal');
      const btnOpenCC = document.getElementById('btn-open-char-creator');
      const btnEmbodyCreateNew = document.getElementById('btn-embody-create-new');
      const btnCloseCC = document.getElementById('btn-close-char-creator');
      const btnSubmitCC = document.getElementById('btn-cc-submit');
      const btnResetSave = document.getElementById('btn-reset-save');

      const openCharCreatorModal = () => {
        if (ccModal) ccModal.classList.remove('hidden');
      };
      const closeCharCreatorModal = () => {
        if (ccModal) ccModal.classList.add('hidden');
      };
      if (btnOpenCC) btnOpenCC.addEventListener('click', openCharCreatorModal);
      if (btnEmbodyCreateNew) btnEmbodyCreateNew.addEventListener('click', openCharCreatorModal);
      if (btnCloseCC) btnCloseCC.addEventListener('click', closeCharCreatorModal);
      if (btnSubmitCC) {
        btnSubmitCC.addEventListener('click', () => {
          const nameVal = (document.getElementById('cc-name')?.value || '').trim() || 'Phật Tử Tâm An';
          const roleVal = document.getElementById('cc-role')?.value || 'Phật Tử Đi Lễ Chùa 🙏';
          const hairStyleVal = document.getElementById('cc-hair-style')?.value || '0';
          const hairColorVal = document.getElementById('cc-hair-color')?.value || '0x1c1917';
          const outfitTypeVal = document.getElementById('cc-outfit-type')?.value || 'temple';
          const shirtColorVal = document.getElementById('cc-shirt-color')?.value || '0x64748b';
          const skinColorVal = document.getElementById('cc-skin-color')?.value || '0xf3c693';
          const glassesVal = document.getElementById('cc-glasses')?.value === 'true';
          const spawnZoneVal = document.getElementById('cc-spawn-zone')?.value || 'chua';

          closeCharCreatorModal();
          window.spawnCustomCharacter({
            name: nameVal,
            role: roleVal,
            hairStyle: parseInt(hairStyleVal, 10),
            hair: parseInt(hairColorVal, 16),
            outfitType: outfitTypeVal,
            shirt: parseInt(shirtColorVal, 16),
            skin: parseInt(skinColorVal, 16),
            glasses: glassesVal,
            spawnZone: spawnZoneVal
          }, true, false);
        });
      }
      if (btnResetSave) {
        btnResetSave.addEventListener('click', () => {
          localStorage.removeItem(SAVE_STORAGE_KEY);
          showToast('🔄 Đã xóa dữ liệu lưu tiến trình! Tải lại trang sẽ về mặc định ban đầu.');
        });
      }

      const dispatchMultiplayerChat = (rawText) => {
        const msg = (rawText || '').trim();
        if (!msg) return;
        if (!embodiedCharacter && officeCharacters[0]) {
          startEmbodyCharacter(officeCharacters[0]);
        }
        const sender = embodiedCharacter || officeCharacters[0];
        const charIdx = officeCharacters.indexOf(sender);
        showCharacterSpeech(sender, msg, 6.5);
        playSynthTone(784, 0.09, 'sine', 0.12);
        appendOnlineChatLog(sender.name, sender.role, msg, true);
        window.broadcastRealtimePacket({
          type: 'chat',
          charIdx,
          senderName: sender.name,
          role: sender.role,
          text: msg
        });
      };

      if (btnEmbodyChatSend && embodyChatInput) {
        const sendLiveChat = () => {
          const msg = embodyChatInput.value.trim();
          if (!msg) return;
          dispatchMultiplayerChat(msg);
          embodyChatInput.value = '';
          embodyChatInput.blur();
        };
        btnEmbodyChatSend.addEventListener('click', sendLiveChat);
        embodyChatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendLiveChat();
          }
        });
      }
      if (btnOnlineQuickChatSend && onlineQuickChatInput) {
        const sendQuick = () => {
          const msg = onlineQuickChatInput.value.trim();
          if (!msg) return;
          dispatchMultiplayerChat(msg);
          onlineQuickChatInput.value = '';
          onlineQuickChatInput.blur();
        };
        btnOnlineQuickChatSend.addEventListener('click', sendQuick);
        onlineQuickChatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendQuick();
          }
        });
      }

      const btnEmbodyPeer = document.getElementById('btn-embody-peer-action');
      window.runPeerSocialAction = function() {
        const actor = embodiedCharacter || getDefaultAvatarForLocalUser();
        if (!actor || !nearestPeerChar) return;
        const peer = nearestPeerChar;
        // Face each other
        actor.rig.root.rotation.y = Math.atan2(peer.rig.root.position.x - actor.rig.root.position.x, peer.rig.root.position.z - actor.rig.root.position.z);
        peer.rig.root.rotation.y = Math.atan2(actor.rig.root.position.x - peer.rig.root.position.x, actor.rig.root.position.z - peer.rig.root.position.z);

        if (!window.isBossAuthorized()) {
          // Guests can only greet colleagues politely, NOT dispatch/recruit them to follow!
          playSynthTone(740, 0.08, 'triangle', 0.12);
          showCharacterSpeech(actor, `Chào ${peer.name} nhé! Chúc hôm nay code mượt 0 Bug! 👋`, 4.5);
          showCharacterSpeech(peer, `Chào ${actor.name}! Em đang trực vị trí, chỉ Trưởng Phòng Minh Đăng mới điều động em đi theo được thôi ạ! 😊`, 5.0);
          showToast(`🔒 Đã chào ${peer.name}! (Chỉ Trưởng Phòng Minh Đăng mới có quyền điều động nhân viên đi theo)`);
          return;
        }

        if (actor === officeCharacters[0] && !followerCharacters.has(peer)) {
          // Boss Minh Đăng rewards colleague + invites them along!
          playDonationSound();
          spawnKaraokeConfetti(30);
          peer.energy = 100;
          peer.mood = 100;
          peer.taskQueue = [];
          peer.currentPose = 'dance';
          followerCharacters.add(peer);
          showCharacterSpeech(actor, `Thưởng nóng ${peer.name} 500k vì code tốt! Đi theo anh thị sát văn phòng nào! 👑💰`, 5.5);
          showCharacterSpeech(peer, `Đa tạ Trưởng phòng Minh Đăng thưởng nóng 500k!! Em đi theo Sếp ngay! 🕺👑`, 5.5);
          showToast(`💰 Sếp Minh Đăng vừa thưởng nóng 500k & gọi ${peer.name} đi theo hộ tống!`);
        } else if (followerCharacters.has(peer)) {
          followerCharacters.delete(peer);
          peer.currentPose = 'idle';
          showCharacterSpeech(peer, `Oke ${actor.name}, để tui quay lại vị trí làm việc nhé! 👋`, 4.0);
          showToast(`Đã cho ${peer.name} dừng đi theo.`);
        } else {
          playSynthTone(740, 0.1, 'triangle', 0.14);
          setTimeout(() => playSynthTone(987.8, 0.15, 'triangle', 0.15), 90);
          peer.taskQueue = [];
          peer.mood = 100;
          followerCharacters.add(peer);
          showCharacterSpeech(actor, `Ê ${peer.name}, đi dạo qua Quán Nhậu / Phòng Hát với tui không? 🍻`, 4.5);
          showCharacterSpeech(peer, `Chốt luôn ${actor.name} ơi! Bạn đi đâu tui nối đuôi theo đó! 🤝🔥`, 5.0);
          showToast(`🤝 ${peer.name} đã gia nhập đội đi theo sau lưng ${actor.name}!`);
        }
      };
      if (btnEmbodyPeer) {
        btnEmbodyPeer.addEventListener('click', () => window.runPeerSocialAction());
      }

      // Photo Mode (Screenshot with Official Watermark -> PNG Download)
      const btnPhotoMode = document.getElementById('btn-photo-mode');
      window.take3DOfficeScreenshot = function() {
        if (!renderer || !scene || !camera) return;
        playSynthTone(1200, 0.05, 'sine', 0.15);
        setTimeout(() => playSynthTone(1600, 0.08, 'triangle', 0.16), 60);
        renderer.render(scene, camera);

        const srcCanvas = renderer.domElement;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = srcCanvas.width;
        outCanvas.height = srcCanvas.height;
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(srcCanvas, 0, 0);

        // Draw Sleek Bottom-Left Watermark Banner
        const pad = 24;
        const boxW = Math.min(outCanvas.width - 48, 640);
        const boxH = 74;
        const bx = pad;
        const by = outCanvas.height - boxH - pad;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText('🏢 VĂN PHÒNG IT 3D • TRƯỞNG PHÒNG NGUYỄN MINH ĐĂNG 👑', bx + 18, by + 30);

        const who = embodiedCharacter ? `Đang hóa thân: ${embodiedCharacter.name} (${embodiedCharacter.role})` : 'Góc nhìn Toàn cảnh 3D Interactive Studio';
        const nowStr = new Date().toLocaleString('vi-VN');
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText(`${who}  •  📸 ${nowStr}`, bx + 18, by + 55);

        const link = document.createElement('a');
        link.download = `Van_Phong_IT_3D_Minh_Dang_${Date.now()}.png`;
        link.href = outCanvas.toDataURL('image/png');
        link.click();
        showToast('📸 Đã chụp & tải ảnh Check-in 3D chất lượng cao (.PNG) về máy để gửi Zalo!');
      };
      if (btnPhotoMode) {
        btnPhotoMode.addEventListener('click', () => window.take3DOfficeScreenshot());
      }

      // 2D Mini-Map Radar & Click-to-Teleport
      const minimapWidget = document.getElementById('minimap-widget');
      const minimapCanvas = document.getElementById('minimap-canvas');
      const btnToggleMinimap = document.getElementById('btn-toggle-minimap');
      const btnCloseMinimap = document.getElementById('btn-close-minimap');
      if (btnToggleMinimap && minimapWidget) {
        btnToggleMinimap.addEventListener('click', () => minimapWidget.classList.toggle('hidden'));
      }
      if (btnCloseMinimap && minimapWidget) {
        btnCloseMinimap.addEventListener('click', () => minimapWidget.classList.add('hidden'));
      }
      if (minimapCanvas) {
        minimapCanvas.addEventListener('click', (e) => {
          const rect = minimapCanvas.getBoundingClientRect();
          const u = (e.clientX - rect.left) / rect.width;
          const v = (e.clientY - rect.top) / rect.height;
          // Map (u, v) in [0..1] to World X [-19.2..39.5], World Z [-9.5..14.8]
          let wx = -19.2 + u * (39.5 - (-19.2));
          let wz = -9.5 + v * (14.8 - (-9.5));

          // Find closest walkable point near (wx, wz)
          if (!isWalkablePosition(wx, wz)) {
            let found = false;
            for (let r = 0.4; r <= 2.8 && !found; r += 0.4) {
              for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                const tx = wx + Math.cos(a) * r;
                const tz = wz + Math.sin(a) * r;
                if (isWalkablePosition(tx, tz)) {
                  wx = tx;
                  wz = tz;
                  found = true;
                  break;
                }
              }
            }
          }

          if (!embodiedCharacter) {
            startEmbodyCharacter(getDefaultAvatarForLocalUser());
          }
          const targetChar = embodiedCharacter || getDefaultAvatarForLocalUser();
          if (targetChar) {
            const pos = targetChar.rig.root.position;
            const dx = wx - pos.x;
            const dz = wz - pos.z;
            pos.x = wx;
            pos.z = wz;
            camera.position.x += dx;
            camera.position.z += dz;
            controls.target.x += dx;
            controls.target.z += dz;
            playSynthTone(523.3, 0.07, 'sine', 0.14);
            setTimeout(() => playSynthTone(1046.5, 0.12, 'triangle', 0.16), 70);
            showCharacterSpeech(targetChar, '⚡ Dịch chuyển tức thời (Teleport) thành công!', 3.5);
            showToast(`⚡ Đã Teleport ${targetChar.name} tới tọa độ (${wx.toFixed(1)}, ${wz.toFixed(1)})!`);
          }
        });
      }

      window.drawMiniMapRadar = function() {
        if (!minimapCanvas || (minimapWidget && minimapWidget.classList.contains('hidden'))) return;
        const ctx = minimapCanvas.getContext('2d');
        const W = minimapCanvas.width;
        const H = minimapCanvas.height;
        const minX = -19.2, maxX = 39.5, minZ = -9.5, maxZ = 14.8;
        const toX = (x) => ((x - minX) / (maxX - minX)) * W;
        const toY = (z) => ((z - minZ) / (maxZ - minZ)) * H;
        const toW = (w) => (w / (maxX - minX)) * W;
        const toH = (h) => (h / (maxZ - minZ)) * H;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, W, H);

        // Draw 9 Zones on Mini-Map (including Zen Koi Garden & Standalone Grand Temple Complex)
        const zones = [
          { x: -18.8, z: -4.8, w: 6.8, h: 8.0, fill: 'rgba(124, 58, 237, 0.32)', stroke: '#a855f7', label: '👑 SẾP' },
          { x: -12.0, z: -9.0, w: 9.8, h: 6.8, fill: 'rgba(56, 189, 248, 0.18)', stroke: '#38bdf8', label: 'HỌP 120"' },
          { x: -12.0, z: -2.2, w: 9.8, h: 11.0, fill: 'rgba(30, 41, 59, 0.7)', stroke: '#64748b', label: 'KHU DEV' },
          { x: -2.2,  z: -9.0, w: 14.2, h: 11.2, fill: 'rgba(51, 65, 85, 0.5)', stroke: '#64748b', label: 'PANTRY' },
          { x: 5.5,   z: 2.2,  w: 6.5, h: 6.65, fill: 'rgba(6, 182, 212, 0.22)', stroke: '#22d3ee', label: 'SERVER' },
          { x: 12.0,  z: -8.85,w: 7.1, h: 9.3,  fill: 'rgba(217, 70, 239, 0.25)', stroke: '#e879f9', label: '🎤 KTV' },
          { x: 12.1,  z: 0.8,  w: 8.8, h: 8.5,  fill: 'rgba(22, 163, 74, 0.22)', stroke: '#4ade80', label: '🌳 HỒ KOI' },
          { x: 21.5,  z: -4.2, w: 17.5,h: 17.2, fill: 'rgba(220, 38, 38, 0.28)', stroke: '#f59e0b', label: '🛕 ĐẠI TỰ CHÙA' },
          { x: -7.1,  z: 9.3,  w: 10.2,h: 5.0,  fill: 'rgba(22, 163, 74, 0.28)', stroke: '#4ade80', label: '🍻 NHẬU' }
        ];
        ctx.font = 'bold 7.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        zones.forEach(zn => {
          const rx = toX(zn.x), ry = toY(zn.z), rw = toW(zn.w), rh = toH(zn.h);
          ctx.fillStyle = zn.fill;
          ctx.strokeStyle = zn.stroke;
          ctx.lineWidth = 1;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(zn.label, rx + rw / 2, ry + rh / 2 + 2.5);
        });

        // Draw Office Corgi dot
        if (officeCorgi) {
          const cx = toX(officeCorgi.group.position.x);
          const cy = toY(officeCorgi.group.position.z);
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw 14 Characters on Radar
        const activeAv = embodiedCharacter || (wasdControlBoss ? officeCharacters[0] : null);
        officeCharacters.forEach((c, idx) => {
          const px = toX(c.rig.root.position.x);
          const py = toY(c.rig.root.position.z);
          const isMe = (c === activeAv);
          if (isMe) {
            // Direction cone
            const rot = c.rig.root.rotation.y;
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.sin(rot) * 9, py + Math.cos(rot) * 9);
            ctx.stroke();

            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(px, py, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.fillStyle = idx === 0 ? '#c084fc' : (followerCharacters.has(c) ? '#34d399' : '#38bdf8');
            ctx.beginPath();
            ctx.arc(px, py, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      };

      // Native Fullscreen & ESC Handling
      const onFullscreenChange = () => {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (controls) controls.enabled = !fsEl && !state.isTvExpanded;
        if (!fsEl) {
          lastTvRect = { left: -1, top: -1, width: -1, height: -1 };
        }
      };
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.isTvExpanded) {
          setTvExpandedMode(false);
        }
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA')) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
          e.preventDefault();
          keysPressed[k] = true;
          if (!embodiedCharacter) {
            startEmbodyCharacter(getDefaultAvatarForLocalUser());
          }
        } else if (embodiedCharacter) {
          if (k === 'v') {
            e.preventDefault();
            toggleEmbodyCamMode();
          } else if (k === 'e') {
            e.preventDefault();
            window.runPeerSocialAction();
          } else if (e.code === 'Space') {
            e.preventDefault();
            getEmbodyContextSpec(embodiedCharacter).run();
          } else if (k === '1' || k === '2' || k === '3' || k === '4') {
            const btns = document.querySelectorAll('.embody-emote-btn');
            const b = btns[parseInt(k, 10) - 1];
            if (b) b.click();
          }
        }
      });
      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
          keysPressed[k] = false;
        }
      });

      // 3D Raycasting (Hover Tooltip & Click Selection)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const tooltip = document.getElementById('hover-tooltip');
      const tooltipText = document.getElementById('tooltip-text');
      let pointerDownPos = { x: 0, y: 0 };

      const getIntersectedRoot = (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactiveObjects, true);
        for (const hit of hits) {
          if (hit.object.userData && hit.object.userData.interactiveRoot) {
            return hit.object.userData.interactiveRoot;
          }
        }
        return null;
      };

      renderer.domElement.addEventListener('pointermove', (e) => {
        const root = getIntersectedRoot(e.clientX, e.clientY);
        state.hoveredObject = root;
        if (root && root.userData.interactiveMeta) {
          renderer.domElement.style.cursor = 'pointer';
          if (hoverBox) {
            hoverBox.setFromObject(root);
            hoverBox.visible = true;
          }
          if (tooltip && tooltipText) {
            tooltipText.textContent = `${root.userData.interactiveMeta.icon} ${root.userData.interactiveMeta.title}`;
            tooltip.style.left = `${e.clientX + 14}px`;
            tooltip.style.top = `${e.clientY - 12}px`;
            tooltip.style.opacity = '1';
          }
        } else {
          renderer.domElement.style.cursor = 'grab';
          if (hoverBox) hoverBox.visible = false;
          if (tooltip) tooltip.style.opacity = '0';
        }
      });

      renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        camTransition.active = false;
      });

      renderer.domElement.addEventListener('pointerup', (e) => {
        const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (moved > 6) return; // Ignore orbit drag
        const root = getIntersectedRoot(e.clientX, e.clientY);
        if (root) {
          selectObject(root);
          playSynthTone(620, 0.06, 'sine', 0.05);
        } else {
          selectObject(null);
        }
      });

      // Responsive Resize
      window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        if (!container || !camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        lastTvRect = { left: -1, top: -1, width: -1, height: -1 };
      });
    }

    // =========================================================================
    // 7. INITIALIZATION & MAIN ANIMATION LOOP
    // =========================================================================
    const clock = new THREE.Clock();

    function init() {
      const container = document.getElementById('canvas-container');

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a);
      scene.fog = new THREE.FogExp2(0x0f172a, 0.0085);

      camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 140);
      camera.position.copy(CAMERA_PRESETS.overview.pos);

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.minDistance = 2.4;
      controls.maxDistance = 68;
      controls.target.copy(CAMERA_PRESETS.overview.target);

      // Core Scene Lights
      ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
      hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.65);
      dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
      dirLight.position.set(18, 30, 20);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 85;
      dirLight.shadow.camera.left = -24;
      dirLight.shadow.camera.right = 42;
      dirLight.shadow.camera.top = 24;
      dirLight.shadow.camera.bottom = -22;
      dirLight.shadow.bias = -0.0005;
      scene.add(ambientLight, hemiLight, dirLight);

      // Selection & Hover Highlight Boxes
      selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x38bdf8);
      selectionBox.visible = false;
      hoverBox = new THREE.BoxHelper(new THREE.Object3D(), 0xfacc15);
      hoverBox.visible = false;
      scene.add(selectionBox, hoverBox);

      // Build All 3D Office Zones & Staff
      initMaterials();
      buildArchitecture();
      buildBossOffice();
      buildDevZone();
      buildMeetingRoom();
      buildServerRoom();
      buildPantryAndLounge();
      buildReceptionAndCollab();
      buildKaraokeRoom();
      buildKaraoke3DScreenIframe();
      buildTempleZone();
      buildNhauZone();
      buildCeilingLights();
      buildDeliveryRobot();
      buildOfficeCorgi();
      buildOfficeCharacters();

      setLightingMode(false);
      bindEvents();
      try {
        if (typeof window.loadProgressFromStorage === 'function') {
          window.loadProgressFromStorage();
        }
      } catch (e) {}

      // Fade out Loading Screen immediately
      const loading = document.getElementById('loading-screen');
      if (loading) {
        loading.style.opacity = '0';
        loading.style.pointerEvents = 'none';
        setTimeout(() => { try { loading.remove(); } catch (e) {} }, 400);
      }

      animate();
    }

    function animate() {
      requestAnimationFrame(animate);

      const rawDt = Math.min(0.05, clock.getDelta());
      const simDt = state.isPaused ? 0 : rawDt * state.simSpeed;
      simElapsed += simDt;

      // Smooth Camera Preset Transition
      if (camTransition.active) {
        camTransition.progress += rawDt / camTransition.duration;
        const p = Math.min(1, camTransition.progress);
        const ease = 1 - Math.pow(1 - p, 3);
        camera.position.lerpVectors(camTransition.startPos, camTransition.endPos, ease);
        controls.target.lerpVectors(camTransition.startTarget, camTransition.endTarget, ease);
        if (p >= 1) camTransition.active = false;
      }

      // Animate Hinged Glass Doors
      animatedDoors.forEach(d => {
        if (d.autoCloseTimer > 0 && !state.isPaused) {
          d.autoCloseTimer -= simDt;
          if (d.autoCloseTimer <= 0) {
            d.isOpen = false;
            d.targetAngle = 0;
          }
        }
        d.pivot.rotation.y += (d.targetAngle - d.pivot.rotation.y) * Math.min(1, 8 * rawDt);
      });

      // Server LEDs & Crash Alarm
      serverLeds.forEach(led => {
        if (state.activeEvent === 'crash') {
          const alarm = Math.sin(simElapsed * 16 + led.phase) > 0;
          led.mat.color.setHex(0xef4444);
          led.mat.emissive.setHex(0xef4444);
          led.mat.emissiveIntensity = alarm ? 2.4 : 0.2;
        } else {
          const speed = turboCooling ? 10 : 4;
          const blink = Math.sin(simElapsed * speed + led.phase) > -0.2;
          const col = turboCooling ? 0x06b6d4 : (led.phase % 2 > 1 ? 0x38bdf8 : 0x22c55e);
          led.mat.color.setHex(col);
          led.mat.emissive.setHex(col);
          led.mat.emissiveIntensity = blink ? 1.6 : 0.35;
        }
      });
      if (state.activeEvent === 'crash' && serverPointLight) {
        serverPointLight.intensity = 2.5 + Math.abs(Math.sin(simElapsed * 10)) * 5.0;
      }

      // Espresso Coffee Steam Particles
      if (coffeeBrewingTimer > 0 && !state.isPaused) coffeeBrewingTimer -= simDt;
      steamParticles.forEach(sp => {
        if (coffeeBrewingTimer > 0) {
          sp.userData.life = (sp.userData.life + simDt * 0.9) % 1.4;
          const l = sp.userData.life;
          sp.position.set(3.2 + sp.userData.offsetX + Math.sin(simElapsed * 3 + l * 5) * 0.04, 1.15 + l * 0.55, -8.08);
          sp.scale.setScalar(0.6 + l * 1.1);
          sp.material.opacity = Math.max(0, (1 - l / 1.4) * 0.55);
        } else {
          sp.material.opacity = 0;
        }
      });

      // Temple Incense Smoke Particles (at Grand Bronze Incense Burner X = 30.5, Z = 5.0)
      if (incenseActiveTimer > 0 && !state.isPaused) incenseActiveTimer -= simDt;
      incenseParticles.forEach(sp => {
        if (incenseActiveTimer > 0 || state.activeEvent === 'chua') {
          sp.userData.life = (sp.userData.life + simDt * 0.55) % 2.2;
          const l = sp.userData.life;
          sp.position.set(30.5 + sp.userData.offsetX + Math.sin(simElapsed * 1.8 + l * 3) * 0.12, 1.52 + l * 0.78, 5.0);
          sp.scale.setScalar(0.65 + l * 0.9);
          sp.material.opacity = Math.max(0, (1 - l / 2.2) * 0.42);
        } else {
          sp.material.opacity = 0;
        }
      });

      // Falling 3D Donation Banknotes & Gold Ingots
      for (let i = donationNotes.length - 1; i >= 0; i--) {
        const note = donationNotes[i];
        note.userData.life -= rawDt;
        note.position.y -= note.userData.vy * rawDt;
        note.rotation.y += rawDt * 4.5;
        if (note.position.y <= 0.94 || note.userData.life <= 0) {
          scene.remove(note);
          donationNotes.splice(i, 1);
        }
      }

      // Temple Bronze Bell Swing & Expanding 3D Golden Sound Wave Rings
      if (templeBellMesh && templeBellSwing > 0.001) {
        templeBellSwing = Math.max(0, templeBellSwing - rawDt * 0.45);
        templeBellMesh.rotation.z = Math.sin(simElapsed * 11.0) * 0.24 * templeBellSwing;
      } else if (templeBellMesh) {
        templeBellMesh.rotation.z = 0;
      }

      for (let i = bellWaveRings.length - 1; i >= 0; i--) {
        const ring = bellWaveRings[i];
        ring.userData.age += rawDt;
        const a = ring.userData.age;
        if (a < 0) {
          ring.visible = false;
          continue;
        }
        ring.visible = true;
        const progress = a / ring.userData.maxAge;
        if (progress >= 1) {
          scene.remove(ring);
          bellWaveRings.splice(i, 1);
        } else {
          const s = 1 + progress * 6.5;
          ring.scale.set(s, s, 1);
          ring.material.opacity = (1 - progress) * 0.78;
        }
      }

      // Falling 3D Karaoke Stage Confetti
      for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const cp = confettiParticles[i];
        cp.userData.life -= rawDt;
        cp.position.x += cp.userData.vx * rawDt;
        cp.position.y -= cp.userData.vy * rawDt;
        cp.position.z += cp.userData.vz * rawDt;
        cp.rotation.x += rawDt * 6.0;
        cp.rotation.y += rawDt * 5.0;
        if (cp.position.y <= 0.1 || cp.userData.life <= 0) {
          scene.remove(cp);
          confettiParticles.splice(i, 1);
        }
      }

      if (state.karaokeScoreTimer > 0 && !state.isPaused) {
        state.karaokeScoreTimer = Math.max(0, state.karaokeScoreTimer - simDt);
      }

      // Disco Ball Rotation & Synth Beat
      if (state.activeEvent === 'disco' && discoGroup && !state.isPaused) {
        discoGroup.rotation.y += simDt * 2.2;
        discoBeatTimer += simDt;
        if (discoBeatTimer >= 0.28) {
          discoBeatTimer = 0;
          const notes = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6, 293.7, 349.2];
          playSynthTone(notes[discoStep % notes.length], 0.14, 'triangle', 0.12);
          discoStep++;
        }
      }

      // Live Karaoke 3D Beat Synthesizer (Plays Melody + Bassline from SONG_PRESETS)
      if ((state.beatPlaying || (state.activeEvent === 'karaoke' && state.karaokeMode === 'beat')) && !state.isPaused) {
        const preset = SONG_PRESETS[state.currentSongKey] || SONG_PRESETS['cat-doi'];
        karaokeBeatTimer += simDt;
        if (karaokeBeatTimer >= (preset.tempo || 0.26)) {
          karaokeBeatTimer = 0;
          const leadNote = preset.melody[karaokeStep % preset.melody.length];
          const bassNote = preset.bass[karaokeStep % preset.bass.length];
          playSynthTone(leadNote, 0.18, 'triangle', 0.11);
          if (karaokeStep % 2 === 0) {
            playSynthTone(bassNote, 0.22, 'sine', 0.09);
          }
          karaokeStep++;
        }
      }

      // Karaoke Club Lights Pulse & 4 Lighting Modes
      karaokeLights.forEach((kl, i) => {
        if (state.karaokeLightMode === 'off') {
          kl.intensity = 0;
          return;
        }
        const active = state.activeEvent === 'karaoke' || state.beatPlaying || state.youtubePlaying;
        if (state.karaokeLightMode === 'strobe') {
          kl.intensity = Math.sin(simElapsed * 18 + i * 2) > 0 ? 8.5 : 0.4;
          kl.color.setHex(i % 2 === 0 ? 0xfacc15 : 0x38bdf8);
        } else if (state.karaokeLightMode === 'chill') {
          kl.intensity = 3.2 + Math.sin(simElapsed * 2 + i) * 1.0;
          kl.color.setHex(i % 2 === 0 ? 0xa855f7 : 0x6366f1);
        } else {
          kl.color.setHex(i % 2 === 0 ? 0xec4899 : 0x22d3ee);
          kl.intensity = active ? (4.8 + Math.sin(simElapsed * (5 + i * 2)) * 2.6) : 2.5;
        }
      });

      // Temple Queue Auto-Rotation, Periodic Bell Tolling & Multi-Character Prayers (150+ Non-Repeating Prayers)
      if (state.activeEvent === 'chua' && !state.isPaused && templeQueueOrder.length > 0) {
        templeSpeechTimer += simDt;
        if (templeSpeechTimer >= 1.5) {
          templeSpeechTimer = 0;
          // Have 2 distinct temple worshippers pray non-repeating lines from the 150+ TEMPLE_PRAYERS bank
          const n = templeQueueOrder.length;
          const i1 = Math.floor(Math.random() * n);
          const i2 = (i1 + 2 + Math.floor(Math.random() * Math.max(1, n - 2))) % n;
          [templeQueueOrder[i1], templeQueueOrder[i2]].forEach(w => {
            if (w && w.speechTimer <= 0.4) {
              showCharacterSpeech(w, pickNextQuote(TEMPLE_PRAYERS, 'zone_chua'), 4.6);
            }
          });
        }
        templeAutoBellTimer += simDt;
        if (templeAutoBellTimer >= 7.5) {
          templeAutoBellTimer = 0;
          playTempleBellSound(true);
        }
        // Chỉ đếm thời gian luân phiên đổi lượt sau khi mọi người đã vào đứng/quỳ ổn định trong sân chùa
        const allSettledAtTemple = templeQueueOrder.every(c => c.currentPose !== 'walking');
        if (allSettledAtTemple) {
          templeQueueRotationTimer += simDt;
          if (templeQueueRotationTimer >= 9.0) {
            templeQueueRotationTimer = 0;
            templeQueueOrder.forEach(c => {
              c.templeSlot = ((c.templeSlot || 0) - 1 + 8) % 8;
              commandCharacter(c, 'chua', true);
            });
          }
        }
      }

      // Rich Ambient Dialogue Cycle strictly bound to each Character's Current Room Zone (9 Zones)
      if (!state.isPaused) {
        speechCycleTimer += simDt;
        if (speechCycleTimer >= 2.8) {
          speechCycleTimer = 0;
          // Pick 2 distinct stationary characters to speak strictly room-specific non-repeating lines
          const count = officeCharacters.length;
          if (count > 0) {
            const idx1 = Math.floor(Math.random() * count);
            const idx2 = (idx1 + 3 + Math.floor(Math.random() * Math.max(1, count - 3))) % count;
            [officeCharacters[idx1], officeCharacters[idx2]].forEach(ch => {
              if (!ch || ch.speechTimer > 0.5) return;
              const quote = pickZoneQuoteForCharacter(ch);
              if (quote) showCharacterSpeech(ch, quote, 4.5);
            });
          }
        }
      }

      // Delivery Robot Patrol
      if (deliveryBot && !state.isPaused) {
        const wp = deliveryBot.waypoints[deliveryBot.wpIndex];
        const pos = deliveryBot.group.position;
        const dx = wp.x - pos.x;
        const dz = wp.z - pos.z;
        const dist = Math.hypot(dx, dz);
        const botSpeed = deliveryBot.turbo ? 3.8 : 1.45;
        if (dist > 0.15) {
          const step = Math.min(dist, botSpeed * simDt);
          pos.x += (dx / dist) * step;
          pos.z += (dz / dist) * step;
          deliveryBot.group.rotation.y = Math.atan2(dx, dz);
        } else {
          deliveryBot.wpIndex = (deliveryBot.wpIndex + 1) % deliveryBot.waypoints.length;
        }
      }

      // BBQ Grill Smoke Particles (rising prominently from X=1.65, Z=11.8)
      bbqSmokeParticles.forEach(sm => {
        sm.userData.life = (sm.userData.life + simDt * 0.75) % 2.1;
        const l = sm.userData.life;
        sm.position.set(1.65 + sm.userData.offsetX + Math.sin(simElapsed * 2.6 + l * 3) * 0.1, 1.05 + l * 0.72, 11.8);
        sm.scale.setScalar(0.75 + l * 1.05);
        sm.material.opacity = Math.max(0, (1 - l / 2.1) * 0.52);
      });

      // 4 Arrow Keys (⬆️ ⬇️ ⬅️ ➡️) Direct Walking Control with Wall Collision for ANY Embodied Character
      const activeAvatar = embodiedCharacter || (wasdControlBoss ? officeCharacters[0] : null);
      let isAvatarArrowMoving = false;
      if (activeAvatar) {
        let inputRight = 0, inputForward = 0;
        if (keysPressed['arrowup']) inputForward += 1;
        if (keysPressed['arrowdown']) inputForward -= 1;
        if (keysPressed['arrowleft']) inputRight -= 1;
        if (keysPressed['arrowright']) inputRight += 1;

        // Update contextual Spacebar button text dynamically
        const ctxBtn = document.getElementById('btn-embody-context-action');
        if (ctxBtn && typeof window.getEmbodyContextSpec === 'function') {
          const spec = window.getEmbodyContextSpec(activeAvatar);
          if (ctxBtn.textContent !== spec.label) ctxBtn.textContent = spec.label;
        }

        if (embodyCamMode === 'fps') {
          // First-Person Mode: Left/Right arrows turn head yaw, Up/Down walk forward/backward
          if (inputRight !== 0) {
            isAvatarArrowMoving = true;
            state.cameraLockedToAvatar = true;
            activeAvatar.rig.root.rotation.y -= inputRight * 2.25 * rawDt;
          }
          if (inputForward !== 0) {
            isAvatarArrowMoving = true;
            state.cameraLockedToAvatar = true;
            const rot = activeAvatar.rig.root.rotation.y;
            const speed = 3.5 * rawDt * inputForward;
            const dx = Math.sin(rot) * speed;
            const dz = Math.cos(rot) * speed;
            moveBossWithCollision(activeAvatar.rig.root.position, dx, dz);
            activeAvatar.currentPose = 'walking';
            activeAvatar.activity = 'Đang đi bộ nhập vai Góc nhìn Thứ 1 (FPS) 👁️';
          } else if (activeAvatar.currentPose === 'walking') {
            activeAvatar.currentPose = 'idle';
          }
        } else {
          // Third-Person Mode (TPS): Move relative to current horizontal camera view
          if (inputRight !== 0 || inputForward !== 0) {
            isAvatarArrowMoving = true;
            camTransition.active = false;
            state.followCharacter = activeAvatar;
            state.cameraLockedToAvatar = true;

            const camFwdX = controls.target.x - camera.position.x;
            const camFwdZ = controls.target.z - camera.position.z;
            const camLen = Math.hypot(camFwdX, camFwdZ) || 1;
            const fwdX = camFwdX / camLen;
            const fwdZ = camFwdZ / camLen;
            const rightX = -fwdZ;
            const rightZ = fwdX;

            const moveX = fwdX * inputForward + rightX * inputRight;
            const moveZ = fwdZ * inputForward + rightZ * inputRight;
            const len = Math.hypot(moveX, moveZ) || 1;
            const speed = 3.8 * rawDt;
            const dx = (moveX / len) * speed;
            const dz = (moveZ / len) * speed;

            const pos = activeAvatar.rig.root.position;
            moveBossWithCollision(pos, dx, dz);

            activeAvatar.rig.root.rotation.y = Math.atan2(moveX, moveZ);
            activeAvatar.currentPose = 'walking';
            activeAvatar.activity = 'Đang nhập vai đi dạo văn phòng (4 phím ⬆️⬇️⬅️➡️) 🕹️';
          } else if (activeAvatar.currentPose === 'walking') {
            activeAvatar.currentPose = 'idle';
          }
        }
        // Spatial Trigger: Auto-prompt Video Call Dock when walking inside Glass Meeting Room
        if (window.MeetingCallManager && typeof window.MeetingCallManager.checkSpatialMeetingZone === 'function') {
          window.MeetingCallManager.checkSpatialMeetingZone(activeAvatar.rig.root.position.x, activeAvatar.rig.root.position.z);
        }
      }

      // Update Characters & Floating Tags
      updateCharacters(simDt, simElapsed);

      // Realtime Online Multiplayer Sync (14Hz while embodying/moving + 3s presence heartbeat)
      netSyncTimer += rawDt;
      if (netSyncTimer >= 0.075) {
        netSyncTimer = 0;
        if (embodiedCharacter && typeof window.syncLocalAvatarToNetwork === 'function') {
          window.syncLocalAvatarToNetwork(false);
        }
      }
      presenceSyncTimer += rawDt;
      if (presenceSyncTimer >= 3.0) {
        presenceSyncTimer = 0;
        if (typeof window.saveProgressToStorage === 'function') {
          window.saveProgressToStorage();
        }
        if (typeof window.broadcastRealtimePacket === 'function') {
          window.broadcastRealtimePacket({
            type: 'presence',
            charIdx: embodiedCharacter ? officeCharacters.indexOf(embodiedCharacter) : -1,
            name: embodiedCharacter ? embodiedCharacter.name : 'Khách Online'
          });
        }
      }

      // True 3rd-Person Chase Camera & 1st-Person FPS Camera Sync (Only when cameraLockedToAvatar or explicit followCharacter is active!)
      const trackedChar = state.followCharacter || (state.cameraLockedToAvatar ? (embodiedCharacter || (wasdControlBoss ? officeCharacters[0] : null)) : null);
      if (trackedChar && !camTransition.active) {
        const p = trackedChar.rig.root.position;
        const rot = trackedChar.rig.root.rotation.y;
        if (embodiedCharacter && embodyCamMode === 'fps') {
          const eyeY = 1.56 + (embodiedCharacter.currentPose === 'walking' ? Math.sin(simElapsed * 11) * 0.025 : 0);
          camera.position.set(p.x, eyeY, p.z);
          controls.target.set(p.x + Math.sin(rot) * 3.5, eyeY - 0.08, p.z + Math.cos(rot) * 3.5);
        } else {
          // 1. Physically translate BOTH camera.position and controls.target with the character's exact displacement
          const desiredTarget = new THREE.Vector3(p.x, 1.25, p.z);
          const moveDelta = desiredTarget.clone().sub(controls.target);
          controls.target.add(moveDelta);
          camera.position.add(moveDelta);

          // 2. If moving with Arrow Keys (or camera is too far out in Overview), smoothly pull camera to ideal 3rd-person chase distance (~4.6m) behind character
          const offsetX = camera.position.x - p.x;
          const offsetZ = camera.position.z - p.z;
          const horizDist = Math.hypot(offsetX, offsetZ) || 0.001;
          if (isAvatarArrowMoving) {
            const idealDist = 4.6;
            const idealHeight = 2.95;
            // Smoothly pull distance to 4.6m if zoomed out far
            const newDist = horizDist + (idealDist - horizDist) * Math.min(1, 5.5 * rawDt);
            // Gently swing camera behind character's back while turning left/right
            const curCamAngle = Math.atan2(offsetX, offsetZ);
            const behindCharAngle = Math.atan2(-Math.sin(rot), -Math.cos(rot));
            let angleDiff = behindCharAngle - curCamAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const swingRate = (keysPressed['arrowleft'] || keysPressed['arrowright']) ? 2.4 : 1.1;
            const newAngle = curCamAngle + angleDiff * Math.min(1, swingRate * rawDt);

            camera.position.x = p.x + Math.sin(newAngle) * newDist;
            camera.position.z = p.z + Math.cos(newAngle) * newDist;
            camera.position.y += (idealHeight - camera.position.y) * Math.min(1, 4.5 * rawDt);
          } else if (horizDist > 8.5) {
            // Even when autonomous walking in Follow Mode, keep camera within 6.2m so walls don't block view
            const pullDist = horizDist + (5.5 - horizDist) * Math.min(1, 3.5 * rawDt);
            camera.position.x = p.x + (offsetX / horizDist) * pullDist;
            camera.position.z = p.z + (offsetZ / horizDist) * pullDist;
            camera.position.y += (3.2 - camera.position.y) * Math.min(1, 3.5 * rawDt);
          }
        }
      }

      controls.update();

      // Update Office Corgi ("Boss Corgi • Giám Đốc Tinh Thần") & Floating Tag
      if (officeCorgi && !state.isPaused) {
        officeCorgi.tailPivot.rotation.y = Math.sin(simElapsed * 18) * 0.45;
        const cPos = officeCorgi.group.position;
        const leader = embodiedCharacter || officeCharacters[0];
        let targetX, targetZ, stopDist = 0.15;
        if (officeCorgi.followPlayer && leader) {
          const lPos = leader.rig.root.position;
          const lRot = leader.rig.root.rotation.y;
          targetX = lPos.x - Math.sin(lRot) * 1.15;
          targetZ = lPos.z - Math.cos(lRot) * 1.15;
          stopDist = 0.45;
        } else {
          const wp = officeCorgi.waypoints[officeCorgi.wpIndex];
          targetX = wp.x;
          targetZ = wp.z;
        }
        const dx = targetX - cPos.x;
        const dz = targetZ - cPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > stopDist) {
          const step = Math.min(dist, 3.2 * simDt);
          moveBossWithCollision(cPos, (dx / dist) * step, (dz / dist) * step);
          officeCorgi.group.rotation.y = Math.atan2(dx, dz);
          officeCorgi.legs.forEach((leg, li) => {
            leg.rotation.x = Math.sin(simElapsed * 16 + li * Math.PI * 0.5) * 0.45;
          });
        } else if (!officeCorgi.followPlayer) {
          officeCorgi.wpIndex = (officeCorgi.wpIndex + 1) % officeCorgi.waypoints.length;
        }
        if (officeCorgi.speechTimer > 0) {
          officeCorgi.speechTimer -= simDt;
          if (officeCorgi.speechTimer <= 0) officeCorgi.speechEl.style.opacity = '0';
        }
        // Project Corgi 2D Tag & Speech Bubble
        const corgiProj = new THREE.Vector3(cPos.x, 0.85, cPos.z).project(camera);
        if (corgiProj.z < 1 && state.showTags) {
          const sx = (corgiProj.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-corgiProj.y * 0.5 + 0.5) * window.innerHeight;
          officeCorgi.tagEl.style.display = 'block';
          officeCorgi.tagEl.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`;
          officeCorgi.speechEl.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy - 24}px)`;
        } else {
          officeCorgi.tagEl.style.display = 'none';
        }
      }

      // Update Colleagues Following Player & Detect Nearest Peer for Key E Social Action
      const currentLeader = embodiedCharacter || (wasdControlBoss ? officeCharacters[0] : null);
      if (currentLeader) {
        let bestPeer = null;
        let bestDist = 2.2;
        const lPos = currentLeader.rig.root.position;
        officeCharacters.forEach(other => {
          if (other === currentLeader) return;
          const d = Math.hypot(other.rig.root.position.x - lPos.x, other.rig.root.position.z - lPos.z);
          if (d < bestDist) {
            bestDist = d;
            bestPeer = other;
          }
        });
        nearestPeerChar = bestPeer;
        const peerBtn = document.getElementById('btn-embody-peer-action');
        if (peerBtn) {
          if (bestPeer) {
            peerBtn.classList.remove('hidden');
            // Gently turn nearby colleague toward player
            bestPeer.rig.root.rotation.y = Math.atan2(lPos.x - bestPeer.rig.root.position.x, lPos.z - bestPeer.rig.root.position.z);
            if (followerCharacters.has(bestPeer)) {
              peerBtn.textContent = `👋 [Phím E] Cho ${bestPeer.name} dừng đi theo`;
            } else if (currentLeader === officeCharacters[0]) {
              peerBtn.textContent = `💰 [Phím E] Thưởng nóng 500k & Gọi ${bestPeer.name} đi theo`;
            } else {
              peerBtn.textContent = `🤝 [Phím E] Rủ ${bestPeer.name} đi cùng mình!`;
            }
          } else {
            peerBtn.classList.add('hidden');
          }
        }

        // Move Follower Colleagues smoothly behind Leader
        let followIdx = 0;
        followerCharacters.forEach(fc => {
          if (fc === currentLeader) return;
          followIdx++;
          const offsetDist = 1.15 + followIdx * 0.85;
          const lRot = currentLeader.rig.root.rotation.y;
          const tx = lPos.x - Math.sin(lRot) * offsetDist;
          const tz = lPos.z - Math.cos(lRot) * offsetDist;
          const fPos = fc.rig.root.position;
          const fdx = tx - fPos.x;
          const fdz = tz - fPos.z;
          const fDist = Math.hypot(fdx, fdz);
          if (fDist > 0.35) {
            const step = Math.min(fDist, 3.3 * simDt);
            moveBossWithCollision(fPos, (fdx / fDist) * step, (fdz / fDist) * step);
            fc.rig.root.rotation.y = Math.atan2(fdx, fdz);
            fc.currentPose = 'walking';
            fc.activity = `Đang đi theo ${currentLeader.name} 🤝`;
          } else if (fc.currentPose === 'walking') {
            fc.currentPose = 'idle';
          }
        });
      }

      // Update Live Dynamic Canvas Textures (~12 FPS to stay buttery smooth)
      canvasRedrawTimer += rawDt;
      if (canvasRedrawTimer >= 0.085) {
        canvasRedrawTimer = 0;
        if (typeof window.drawMiniMapRadar === 'function') {
          window.drawMiniMapRadar();
        }
        if (bossScreenObj && !bossScreenSharing) {
          drawBossMonitorCanvas(bossScreenObj.ctx, 512, 256, simElapsed);
          bossScreenObj.tex.needsUpdate = true;
        }
        devMonitors.forEach(m => {
          drawDevMonitorCanvas(m.ctx, 256, 144, m.mode, simElapsed, m.seed);
          m.tex.needsUpdate = true;
        });
        if (meetingScreenObj) {
          // If WebRTC Meeting Room Video Call is active, project Live Video Grid onto 98" 3D Meeting Room Screen!
          const drewLiveCall = (window.MeetingCallManager && typeof window.MeetingCallManager.drawMeetingCallTo3DScreen === 'function')
            ? window.MeetingCallManager.drawMeetingCallTo3DScreen(meetingScreenObj.ctx, 512, 256, simElapsed)
            : false;
          if (!drewLiveCall) {
            if (state.autoSlideMeeting && !state.isPaused) {
              meetingSlideTimer += 0.085 * state.simSpeed;
              if (meetingSlideTimer >= 6.0) {
                meetingSlideTimer = 0;
                meetingScreenObj.slideIndex = (meetingScreenObj.slideIndex + 1) % 4;
              }
            }
            drawMeetingCanvas(meetingScreenObj.ctx, 512, 256, meetingScreenObj.slideIndex, simElapsed);
          }
          meetingScreenObj.tex.needsUpdate = true;
        }
        if (arcadeScreenObj) {
          drawArcadeCanvas(arcadeScreenObj.ctx, 160, 128, arcadeScreenObj.isPlaying, simElapsed);
          arcadeScreenObj.tex.needsUpdate = true;
        }
        if (karaokeScreenObj) {
          drawKaraokeCanvas(karaokeScreenObj.ctx, 512, 256, state.activeEvent === 'karaoke' || state.youtubePlaying, simElapsed);
          karaokeScreenObj.tex.needsUpdate = true;
        }
      }

      // Keep Selection / Hover Box synced with moving objects
      if (selectionBox && selectionBox.visible && state.selectedObject) {
        selectionBox.setFromObject(state.selectedObject);
      }

      // Sync Flat 2D Karaoke TV Iframe over 3D TV Screen
      updateKaraokeTvOverlay();

      renderer.render(scene, camera);
    }

    // Execute init() immediately once DOM is parsed (do not wait for slow window.onload external assets!)
    let hasInitialized3D = false;
    function safeStartInit() {
      if (hasInitialized3D) return;
      hasInitialized3D = true;
      try {
        init();
      } catch (err) {
        console.error('Init error:', err);
        const loading = document.getElementById('loading-screen');
        if (loading) loading.remove();
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', safeStartInit);
    } else {
      safeStartInit();
    }
