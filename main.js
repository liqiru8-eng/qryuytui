// Global custom confirm - replaces window.confirm() for WebView compatibility
window.appConfirm = function(msg, onOk, onCancel) {
  var ov  = document.getElementById('appConfirmOverlay');
  var txt = document.getElementById('appConfirmContent');
  var ok  = document.getElementById('appConfirmOk');
  var cn  = document.getElementById('appConfirmCancel');
  if (!ov || !txt || !ok || !cn) {
    // Fallback to native confirm if elements missing (shouldn't happen)
    if (window.confirm(msg)) { if (onOk) onOk(); } else { if (onCancel) onCancel(); }
    return;
  }
  txt.textContent = msg;
  ov.classList.add('show');
  function cleanup() { ov.classList.remove('show'); ok.onclick = null; cn.onclick = null; }
  ok.onclick = function() { cleanup(); if (onOk) onOk(); };
  cn.onclick = function() { cleanup(); if (onCancel) onCancel(); };
};
// Also expose showAppAlert globally for use before window.onload
window.showAppAlert = window.showAppAlert || function(msg) {
  var ov  = document.getElementById('msgOverlay');
  var txt = document.getElementById('msgContent');
  var ok  = document.getElementById('msgOk');
  if (ov && txt) { txt.textContent = msg; ov.classList.add('show'); }
  if (ok) ok.onclick = function() { ov.classList.remove('show'); };
};

  var coverSupport = 'CSS' in window && typeof CSS.supports === 'function' && (CSS.supports('top: env(a)') ||

CSS.supports('top: constant(a)'))

document.write(

'<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0' +

(coverSupport ? ', viewport-fit=cover' : '') + '" />')
let audioCtx = null;
let currentInst = "piano";
let keyHintEnabled = true;
const INST_LIST = [
  {v:"piano",t:"钢琴"},{v:"guitar",t:"吉他"},{v:"violin",t:"小提琴"},{v:"cello",t:"大提琴"},
  {v:"xiao",t:"箫"},{v:"dizi",t:"笛子"},{v:"guzheng",t:"古筝"},{v:"erhu",t:"二胡"},
  {v:"pipa",t:"琵琶"},{v:"drumkit",t:"架子鼓"},
  {v:"suona",t:"唢呐"},{v:"bass",t:"贝斯"},{v:"saxophone",t:"萨克斯"}
];
let instOrder = null;
const activeNodes = new Map();
const touchMap = new Map();

const defaultToneParams = {
  piano: { 
    waveType: 'triangle', attack: 0.005, decay: 0.5, sustain: 0.0, release: 1.5,
    harm2: 0.5, harm3: 0.3, harm4: 0.15, harm5: 0.08, harm6: 0.04,
    filterType: 'lowpass', filterFreq: 8000, filterQ: 0.5,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.7
  },
  guitar: { 
    waveType: 'noise', attack: 0.002, decay: 0.3, sustain: 0.0, release: 3.0,
    harm2: 0, harm3: 0, harm4: 0, harm5: 0, harm6: 0,
    filterType: 'lowpass', filterFreq: 5000, filterQ: 1.0,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 1, noiseDecay: 0.8, blendFactor: 0.5,
    brightness: 0.6
  },
  violin: { 
    waveType: 'sawtooth', attack: 0.15, decay: 0.1, sustain: 0.8, release: 0.3,
    harm2: 0.5, harm3: 0.25, harm4: 0.12, harm5: 0.06, harm6: 0.03,
    filterType: 'highpass', filterFreq: 150, filterQ: 0.7,
    vibrato: 5.5, vibratoDepth: 0.008, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.5
  },
  cello: { 
    waveType: 'sawtooth', attack: 0.2, decay: 0.15, sustain: 0.7, release: 0.5,
    harm2: 0.4, harm3: 0.2, harm4: 0.1, harm5: 0.05, harm6: 0.02,
    filterType: 'lowpass', filterFreq: 2500, filterQ: 0.5,
    vibrato: 4.5, vibratoDepth: 0.01, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.4
  },
  xiao: { 
    waveType: 'sine', attack: 0.25, decay: 0.3, sustain: 0.4, release: 1.0,
    harm2: 0.15, harm3: 0.08, harm4: 0.03, harm5: 0.01, harm6: 0,
    filterType: 'lowpass', filterFreq: 5000, filterQ: 0.3,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0.1, noiseDecay: 0.3,
    brightness: 0.5
  },
  dizi: { 
    waveType: 'sine', attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.6,
    harm2: 0.6, harm3: 0.3, harm4: 0.12, harm5: 0.05, harm6: 0.02,
    filterType: 'lowpass', filterFreq: 7000, filterQ: 0.6,
    vibrato: 6, vibratoDepth: 0.006, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.6
  },
  guzheng: { 
    waveType: 'noise', attack: 0.005, decay: 1.5, sustain: 0.0, release: 6.0,
    harm2: 0, harm3: 0, harm4: 0, harm5: 0, harm6: 0,
    filterType: 'lowpass', filterFreq: 3500, filterQ: 0.4,
    vibrato: 5, vibratoDepth: 0.008, noiseLevel: 1, noiseDecay: 0.95, blendFactor: 0.496,
    brightness: 0.5
  },
  pipa: { 
    waveType: 'triangle', attack: 0.005, decay: 0.3, sustain: 0.0, release: 1.5,
    harm2: 0.15, harm3: 0.35, harm4: 0.15, harm5: 0.08, harm6: 0.04,
    filterType: 'lowpass', filterFreq: 6000, filterQ: 0.6,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.55
  },
  erhu: { 
    waveType: 'sawtooth', attack: 0.15, decay: 0.2, sustain: 0.6, release: 0.4,
    harm2: 0.35, harm3: 0.15, harm4: 0.06, harm5: 0.02, harm6: 0.01,
    filterType: 'lowpass', filterFreq: 2000, filterQ: 0.8,
    vibrato: 5, vibratoDepth: 0.006, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.45
  },
  drum: { 
    waveType: 'sine', attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.4,
    harm2: 0, harm3: 0, harm4: 0, harm5: 0, harm6: 0,
    filterType: 'lowpass', filterFreq: 1500, filterQ: 1.5,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0.5, noiseDecay: 0.1,
    brightness: 0.3
  },
  drumkit: { 
    waveType: 'noise', attack: 0.001, decay: 0.1, sustain: 0.0, release: 0.5,
    harm2: 0, harm3: 0, harm4: 0, harm5: 0, harm6: 0,
    filterType: 'bandpass', filterFreq: 2000, filterQ: 1.0,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 1, noiseDecay: 0.5, blendFactor: 0.45,
    brightness: 0.4
  },
  bell: { 
    waveType: 'sine', attack: 0.001, decay: 1.0, sustain: 0.5, release: 4.0,
    harm2: 0.6, harm3: 0.35, harm4: 0.2, harm5: 0.1, harm6: 0.05,
    filterType: 'lowpass', filterFreq: 10000, filterQ: 0.3,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.8
  },
  suona: { 
    waveType: 'square', attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.2,
    harm2: 0.5, harm3: 0.3, harm4: 0.15, harm5: 0.08, harm6: 0.04,
    filterType: 'bandpass', filterFreq: 2000, filterQ: 2.0,
    vibrato: 4, vibratoDepth: 0.004, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.6
  },
  bass: { 
    waveType: 'sawtooth', attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.0,
    harm2: 0.3, harm3: 0.12, harm4: 0.05, harm5: 0.02, harm6: 0.01,
    filterType: 'lowpass', filterFreq: 1200, filterQ: 0.6,
    vibrato: 0, vibratoDepth: 0, noiseLevel: 0, noiseDecay: 0,
    brightness: 0.3
  },
  saxophone: { 
    waveType: 'square', attack: 0.08, decay: 0.15, sustain: 0.7, release: 0.3,
    harm2: 0.45, harm3: 0.22, harm4: 0.1, harm5: 0.05, harm6: 0.02,
    filterType: 'lowpass', filterFreq: 4500, filterQ: 1.2,
    vibrato: 4, vibratoDepth: 0.004, noiseLevel: 0.03, noiseDecay: 0.15,
    brightness: 0.5
  }
};
let toneParams = JSON.parse(JSON.stringify(defaultToneParams));

function loadToneParams() {
  try {
    const saved = localStorage.getItem('toneParams');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(inst => {
        if (toneParams[inst]) {
          Object.assign(toneParams[inst], parsed[inst]);
        }
      });
    }
  } catch(e) {
    localStorage.removeItem('toneParams');
  }
}
loadToneParams();

function saveToneParams() {
  try {
    localStorage.setItem('toneParams', JSON.stringify(toneParams));
  } catch(e) {}
}

function getToneParam(inst, param) {
  if (toneParams[inst] && toneParams[inst][param] !== undefined) {
    return toneParams[inst][param];
  }
  if (defaultToneParams[inst] && defaultToneParams[inst][param] !== undefined) {
    return defaultToneParams[inst][param];
  }
  return null;
}

let scrollRAF = null;
let canvasOffX = 20;
let isScrolling = false;
let currentSong = null;
let currentPlayTime = 0;
let lastFrameTime = 0;
let playSpeed = 1.0;
let isMutedTemporarily = false;

let isDraggingScore = false;
let wasTupuScrolling = false;
let dragStartX = 0;
let dragStartOffX = 0;

let isMuted = false;
let isScoreFullscreen = false;
let autoIdx = -1;
let highlightNoteIdx = -1;

// 切换播放按钮图标（播放/暂停）
function togglePlayBtnIcon(isPlaying) {
  const playIcon = playBtn.querySelector('.play-icon');
  const pauseIcon = playBtn.querySelector('.pause-icon');
  if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

let canvas, ctx;
let tokens = []; 
let currentTupu = null; 

let isFollowing = false;
let currentFollowIdx = 0;
let scoreWrap = null;
let testTimer = null;
let isLayoutMode = false;
let isAutoPlaying = false;
// 每行的乐器和配色配置（布局模式可独立设置）
let rowInstMap = {}; // rowIdx -> inst string
let rowColorMap = {}; // rowIdx -> {white: '#fff', black: '#000'}
let rowDynamicMap = {}; // rowIdx -> boolean (true=动态, false=静态)
let rowOctaveOffsetMap = {}; // rowIdx -> number (八度偏移量)

let currentWidthScale = 1;

let noteAnimStartTime = 0;
let animRAF = null;
let animNoteIdx = -1;
const ANIM_DURATION = 300;

// =====================================================
// 【修复1】pcKeyMap 提升到全局作用域，确保 playNoteByKey 可访问
// =====================================================
const DEFAULT_PC_KEY_MAP = {
  'base': {
    'C': ['KeyS'], 'D': ['KeyD'], 'E': ['KeyF'], 'F': ['KeyG'], 'G': ['KeyH'], 'A': ['KeyJ'], 'B': ['KeyK'],
    'C#': ['KeyW'], 'D#': ['KeyE'], 'F#': ['KeyT'], 'G#': ['KeyY'], 'A#': ['KeyU']
  },
  'control': {
    'prevOctave': ['KeyA'],
    'nextOctave': ['KeyL'],
    'playPause': ['Space']
  },
  'fixed': {
    'octave5': {
      'C': ['KeyW'], 'D': ['KeyE'], 'E': ['KeyR'], 'F': ['KeyT'], 'G': ['KeyY'], 'A': ['KeyU'], 'B': ['KeyI']
    },
    'octave3': {
      'C': ['KeyZ'], 'D': ['KeyX'], 'E': ['KeyC'], 'F': ['KeyV'], 'G': ['KeyB'], 'A': ['KeyN'], 'B': ['KeyM']
    }
  },
  'extra': [],
  'chord': []
};
let pcKeyMap = {};

function loadKeyMap() {
  try {
    const storedMap = localStorage.getItem('pcKeyMap');
    if (storedMap) {
      pcKeyMap = JSON.parse(storedMap);
      if (!pcKeyMap.base) {
        pcKeyMap = JSON.parse(JSON.stringify(DEFAULT_PC_KEY_MAP));
      }
      if (!pcKeyMap.instSwitch) pcKeyMap.instSwitch = {};
      // 修复旧配置：把 [" "] 改成 ["Space"]
      if (pcKeyMap.control && pcKeyMap.control.playPause) {
        pcKeyMap.control.playPause = pcKeyMap.control.playPause.map(function(k) {
          return (k === ' ' ? 'Space' : k);
        });
      }
    } else {
      pcKeyMap = JSON.parse(JSON.stringify(DEFAULT_PC_KEY_MAP));
    }
  } catch (e) {
    pcKeyMap = JSON.parse(JSON.stringify(DEFAULT_PC_KEY_MAP));
  }
}

function saveKeyMap() {
  try {
    localStorage.setItem('pcKeyMap', JSON.stringify(pcKeyMap));
  } catch (e) {}
}

// 初始加载按键配置（全局调用，确保 playNoteByKey 可使用）
loadKeyMap();

const BUILT_IN = [
{
  key:"songbie", name:"送别", custom:false,
  keySig: "1=C", timeSig: "4/4",
  display:[
    "5 3_5 【高1】 - | 6 【高1】 5 - | 5 1_2 3 2_1 | 2 - 0 0 |",
    "5 3_5 【高1】 - | 6 【高1】 5 - | 5 2_3 4 【低7】 | 1 - 0 0 |",
    "6 【高1】 【高1】 - | 7 6_7 【高1】 - | 6_7 【高1】_6 6_5 3_1 | 2 - 0 0 |",
    "5 3_5 【高1】 - | 6 【高1】 5 - | 5 2_3 4 【低7】 | 1 - 0 0 |"
  ]
},
{
  key:"huanlesong", name:"欢乐颂", custom:false,
  keySig: "1=C", timeSig: "4/4",
  display:[
    "3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3. 2_2 - |",
    "3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 2. 1_1 - |",
    "2 2 3 1 | 2 3_4 3 1 | 2 3_4 3 2 | 1 2 【低5】 3 |",
    "3 3 4 5 | 5 4 3 4_2 | 1 1 2 3 | 2. 1_1 - |"
  ]
},
{
  key:"chongerfei", name:"虫儿飞", custom:false,
  keySig: "1=C", timeSig: "4/4",
  display:[
    "3 3_3 4 5 | 3. 2 2 - | 1 1_1 2 3 | 3. 【低7】 【低7】 - |",
    "【低6】 3 2 - | 【低6】 3 2 - | 【低6】 3 2. 1_ | 1 - - - ||",
    "0 0 3 2 | 5 - - 4_3 | 3_2 2 - | 5_4 |",
    "3 4 5. 3 | 2 - - 0_1 | 【低6】 3 2. 1 | 【低5】 2_1 1 - |",
    "4_3 4_3 1 - | 4_3 4_3 1. 2 | 1 - - - | 0 0 0 0 ||"
  ]
}
];

let customSongs = [];
try{ customSongs = JSON.parse(localStorage.getItem("pianoCustomSongs")||"[]"); }catch(e){}
function saveCustom(){ try{ localStorage.setItem("pianoCustomSongs",JSON.stringify(customSongs)); }catch(e){} }
function allSongs(){ return [...BUILT_IN, ...customSongs]; }

let customTupus = [];
try{ customTupus = JSON.parse(localStorage.getItem("pianoCustomTupus")||"[]"); }catch(e){}
function saveTupus(){ try{ localStorage.setItem("pianoCustomTupus",JSON.stringify(customTupus)); }catch(e){} }
function allTupus(){ return [...customTupus]; }

const FS = 14;     
const FONT_STR = FS+"px 'PingFang SC',Arial,sans-serif";
const GAP = 12;     
const FIXED_X = 20; 

function buildTokensAndNotes(song, addDelay = false) {
  if(!song) return { tokens: [], totalW: 0, autoNotes: [] };
  const cv = document.createElement("canvas");
  const c2 = cv.getContext("2d");
  c2.font = FONT_STR;
  
  let toks = [];
  let autoNotes = [];
  let noteCount = 0;
  let lastNoteObj = null;
  let underscoreCount = 0;

  let keyStr = (song.keySig || "1=C").replace("1=", "");
  let keyOffset = {"C":0,"C#":1,"Db":1,"D":2,"Eb":3,"E":4,"F":5,"F#":6,"Gb":6,"G":7,"Ab":8,"A":9,"Bb":10,"B":11}[keyStr] || 0;

  let beatParts = (song.timeSig || "4/4").split('/');
  let bpmBase = 85; 
  if(beatParts.length === 2) {
      let molecular = parseInt(beatParts[0]) || 4;
      let denominator = parseInt(beatParts[1]) || 4;
      bpmBase = (85 * (4/denominator)) * (molecular/4 + 0.5);
  }

  let lines = Array.isArray(song.display) ? song.display : (song.display ? song.display.split('\n') : []);
  if (addDelay && lines.length > 0) {
    lines = ["0000 " + lines[0], ...lines.slice(1)];
  }
  
  lines.forEach(line => {
      let i = 0;
      while (i < line.length) {
          let text = '';
          let isNote = false;
          let matched = false;
          
          let noteMatch = line.substr(i).match(/^【[高低][1-7]】|^[0-7]/);
          if (noteMatch) {
              text = noteMatch[0];
              isNote = true;
              i += text.length;
              matched = true;
          } else if (line[i] === '-' || line[i] === '·' || line[i] === '.' || line[i] === '|' || line[i] === '_') {
              text = line[i];
              i++;
              matched = true;
          } else if (line[i] === ' ' || line[i] === '\t') {
              i++;
              continue;
          } else {
              text = line[i];
              i++;
              matched = true;
          }
          
          if (!matched) continue;
          
          let w = c2.measureText(text).width;
          let nIdx = -1;

          if (isNote) {
             nIdx = noteCount++;
             let numStr = text.replace(/【|】|高|低/g, "");
             let octaveMod = text.includes("高") ? 1 : (text.includes("低") ? -1 : 0);
             let nName = "R";
             if (numStr !== "0") {
                 let baseIntervals = [0, 2, 4, 5, 7, 9, 11];
                 let halfSteps = keyOffset + baseIntervals[parseInt(numStr)-1] + (octaveMod * 12);
                 let oct = 4 + Math.floor(halfSteps / 12);
                 let noteIndex = (halfSteps % 12 + 12) % 12;
                 let names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
                 nName = names[noteIndex] + oct;
             }
             
             let baseDur = 1;
             if (underscoreCount > 0) {
                 baseDur = 1 / (2 ** underscoreCount);
                 if (lastNoteObj) {
                     lastNoteObj.baseDur = 1 / (2 ** underscoreCount);
                     lastNoteObj.d = lastNoteObj.baseDur * (1.5 ** lastNoteObj.dotCount);
                 }
                 underscoreCount = 0;
             }

             lastNoteObj = { 
                 n: nName, 
                 baseDur: baseDur, 
                 dotCount: 0,
                 d: baseDur, 
                 tokenIdx: toks.length, 
                 startTime: 0 
             };
             autoNotes.push(lastNoteObj);
          } else if (text === '-') {
             if(lastNoteObj) lastNoteObj.d += 1;
          } else if (text === '·' || text === '.') {
             if(lastNoteObj) {
                 lastNoteObj.dotCount += 1;
                 lastNoteObj.d = lastNoteObj.baseDur * (1.5 ** lastNoteObj.dotCount);
             }
          } else if (text === '|') {
             underscoreCount = 0;
          } else if (text === '_') {
             underscoreCount += 1;
          } else {
             underscoreCount = 0;
          }
          toks.push({ text, x: 0, w, isNote, noteIdx: nIdx });
      }
  });

  let currentX = 0;
  for(let i=0; i<toks.length; i++) {
    const t = toks[i];
    t.x = currentX;
    const nextTok = toks[i+1];
    if(t.text === "_" || (nextTok && nextTok.text === "_")) {
      currentX += t.w;
    } else {
      currentX += t.w + GAP;
    }
  }

  let currentTime = 0;
  const beatMs = 60000 / bpmBase;
  autoNotes.forEach(an => {
      an.startTime = currentTime;
      an.durationMs = an.d * beatMs;
      currentTime += an.durationMs;
  });
  
  return { tokens: toks, totalW: currentX + 400, autoNotes };
}

function updateTupuScale(){
  if (!currentTupu || !currentTupu.scaledMasks) return;
  
  const canvasHeight = canvas.height;
  if (canvasHeight <= 0) return;
  
  let currentX = 0;
  let hasValidMask = false;
  
  currentTupu.scaledMasks.forEach((pageMasks) => {
    pageMasks.forEach((mask) => {
      const srcHeight = mask.srcHeight;
      if (!srcHeight || srcHeight <= 0) return;
      
      hasValidMask = true;
      const maskScaleRatio = canvasHeight / srcHeight;
      const scaledMaskWidth = mask.srcWidth * maskScaleRatio;
      
      mask.x = currentX;
      mask.width = scaledMaskWidth;
      mask.height = canvasHeight;
      currentX += scaledMaskWidth;
    });
  });
  
  if (hasValidMask) {
    currentTupu.totalWidth = currentX;
    canvas.width = currentX;
    canvas.style.width = currentX + "px";
  } else {
    canvas.width = scoreWrap ? scoreWrap.clientWidth : 100;
    canvas.style.width = canvas.width + "px";
  }
}

function getScoreMetrics() {
  if (!canvas) return { fontSize: 14, gap: 12 };
  const canvasHeight = canvas.height;
  const fontSize = Math.max(14, Math.round(canvasHeight * 0.45));
  const gap = Math.max(8, Math.round(fontSize * 0.85));
  return { fontSize, gap };
}

function drawRainbowGridBackground() {
  // Draw onto the fixed background canvas (does NOT scroll with content)
  var bgCanvas = document.getElementById('scoreBgCanvas');
  if (!bgCanvas || !scoreWrap) return;
  var bctx = bgCanvas.getContext('2d');
  if (!bctx) return;
  var scoreW = scoreWrap.clientWidth;
  var h = scoreWrap.offsetHeight || 34;
  // Sync bg canvas pixel dimensions to scoreWrap
  if (bgCanvas.width !== scoreW)  bgCanvas.width  = scoreW;
  if (bgCanvas.height !== h)      bgCanvas.height = h;
  // Use bctx as ctx for the drawing code below
  var ctx = bctx;
  var w = scoreW;

  // --- Gradient background (smooth, no texture) ---

  // 1. Deep dark base
  ctx.fillStyle = _SCORE_BG_GRADIENT.baseColor;
  ctx.fillRect(0, 0, w, h);

  // 2. Horizontal gradient from left to right (4 color stops)
  var hGrd = ctx.createLinearGradient(0, 0, w, 0);
  hGrd.addColorStop(0, _SCORE_BG_GRADIENT.horizontalGradient.left);
  hGrd.addColorStop(0.33, _SCORE_BG_GRADIENT.horizontalGradient.middle1);
  hGrd.addColorStop(0.66, _SCORE_BG_GRADIENT.horizontalGradient.middle2);
  hGrd.addColorStop(1, _SCORE_BG_GRADIENT.horizontalGradient.right);
  ctx.fillStyle = hGrd;
  ctx.fillRect(0, 0, w, h);

  // 3. Vertical gradient from top to bottom (smooth)
  var vGrd = ctx.createLinearGradient(0, 0, 0, h);
  vGrd.addColorStop(0, _SCORE_BG_GRADIENT.verticalGradient.top);
  vGrd.addColorStop(0.3, _SCORE_BG_GRADIENT.verticalGradient.middle1);
  vGrd.addColorStop(0.7, _SCORE_BG_GRADIENT.verticalGradient.middle2);
  vGrd.addColorStop(1, _SCORE_BG_GRADIENT.verticalGradient.bottom);
  ctx.fillStyle = vGrd;
  ctx.fillRect(0, 0, w, h);

  // 4. Top & bottom edge neon lines
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = _SCORE_BG_GRADIENT.edgeLines.top;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(scoreW, 0); ctx.stroke();
  ctx.strokeStyle = _SCORE_BG_GRADIENT.edgeLines.bottom;
  ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(scoreW, h - 1); ctx.stroke();

  // 9. Fixed string line at 1/4 width — only visible during recording playback (including paused/follow mode)
  // String will be drawn AFTER lane dividers (see below)
  if (typeof _recPlayState !== 'undefined' && _recPlayState) {
    var playheadBgX = Math.round(scoreW / 4);
    
    // Draw lane gradient effects (from string to 2/3 of scroll bar)
    var nowPerfGrad = performance.now();
    var currentH2 = scoreWrap ? scoreWrap.offsetHeight : 170;
    var LANE_COUNT2 = 7;
    var laneH2 = currentH2 / LANE_COUNT2;
    var gradDuration = 500; // 渐变持续时间
    var gradStartX = playheadBgX; // 起点：琴弦位置
    var gradEndX = scoreW * 2 / 2; // 终点：滚动栏2/3位置
    
    _laneGradientFx = _laneGradientFx.filter(function(gfx) {
      var age = nowPerfGrad - gfx.t0;
      if (age > gradDuration) return false;
      if (age < 0) return true;
      var prog = age / gradDuration;
      
      // 计算轨道位置
      var laneTop = gfx.lane * laneH2;
      var laneHeight = laneH2;
      
      // 琴弦是中点，右边渐变距离保持不变，左边渐变距离是左边的全部
      var rightEndX = gradEndX; // 右边界
      var leftEndX = 0; // 左边界
      var currentRightEndX = gradStartX + (rightEndX - gradStartX) * Math.min(1, prog * 1.5);
      var currentLeftEndX = gradStartX - (gradStartX - leftEndX) * Math.min(1, prog * 1.5);
      
      // 将颜色调亮（增加亮度）
      var brightColor = gfx.color;
      // 解析hex颜色并调亮
      if (brightColor.charAt(0) === '#') {
        var hex = brightColor.slice(1);
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        // 增加亮度（向白色靠近）
        r = Math.min(255, Math.round(r + (255 - r) * 0.4));
        g = Math.min(255, Math.round(g + (255 - g) * 0.4));
        b = Math.min(255, Math.round(b + (255 - b) * 0.4));
        brightColor = 'rgba(' + r + ',' + g + ',' + b + ', 1)';
      }
      
      var alpha = (1 - prog) * 1.0; // 透明度随时间衰减
      
      // 跳过几乎不可见的渐变
      if (alpha < 0.05) return true;
      
      // 右边渐变（从琴弦向右）
      var gradRight = ctx.createLinearGradient(gradStartX, 0, currentRightEndX, 0);
      gradRight.addColorStop(0, brightColor);
      gradRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradRight;
      ctx.fillRect(gradStartX, laneTop, currentRightEndX - gradStartX, laneHeight);
      ctx.restore();
      
      // 左边渐变（从琴弦向左）
      var gradLeft = ctx.createLinearGradient(gradStartX, 0, currentLeftEndX, 0);
      gradLeft.addColorStop(0, brightColor);
      gradLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradLeft;
      ctx.fillRect(currentLeftEndX, laneTop, gradStartX - currentLeftEndX, laneHeight);
      ctx.restore();
      
      return true;
    });
    
    // Draw lane dividers (fixed, doesn't scroll)
    var LANE_COUNT_DIV = 7;
    var laneHDiv = h / LANE_COUNT_DIV;
    ctx.strokeStyle = 'rgba(42, 68, 107, 0.77)';
    ctx.lineWidth = 1;
    for (var i = 1; i < LANE_COUNT_DIV; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * laneHDiv); ctx.lineTo(scoreW, i * laneHDiv); ctx.stroke();
    }
    
    // Draw string line AFTER lane dividers (on top of dividers, below note blocks)
    // String width: 20 pixels, no glow effect
    var vibrationX = 0;
    var isVibrating = _playheadVibration.active;
    if (isVibrating) {
      var elapsed = performance.now() - _playheadVibration.startTime;
      if (elapsed < _playheadVibration.duration) {
        var decay = 1 - (elapsed / _playheadVibration.duration);
        var frequency = 0.05;
        vibrationX = Math.sin(elapsed * frequency) * _playheadVibration.amplitude * decay;
      } else {
        _playheadVibration.active = false;
        isVibrating = false;
      }
    }
    var finalX = playheadBgX + vibrationX;
    // String: 20 pixels wide, no glow
    if (isVibrating) {
      ctx.fillStyle = 'rgba(85, 129, 160, 0.6)';
    } else {
      ctx.fillStyle = 'rgba(55, 56, 83, 0.6)';
    }
    ctx.fillRect(finalX - 10, 0, 20, h);
    ctx.strokeStyle = 'rgba(69, 105, 131, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(finalX - 10, 0, 20, h);
    
    // Draw effect texts (Perfect, Great, Right) - fixed position, doesn't scroll
    if (_recPlayState.effectTexts && !_recPlayState.scoreAnimStart) {
      var nowT2 = performance.now();
      var playheadX = scoreW / 4;
      var effectTextX = playheadX / 3;
      var effectFs = Math.round(h * 0.12);
      var scoreFs = Math.round(h * 0.09);
      
      _recPlayState.effectTexts = _recPlayState.effectTexts.filter(function(effect) {
        var age = nowT2 - effect.t0;
        var DUR = 800;
        if (age > DUR) return false;
        var prog = age / DUR;
        var textAlpha = 1 - prog * 0.8;
        var fontSize = effectFs;
        var yOffset = prog * (scoreFs * 1.5);
        
        if (textAlpha > 0) {
          ctx.save();
          ctx.font = 'bold italic ' + fontSize + 'px Arial, sans-serif';
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillStyle = effect.col;
          ctx.globalAlpha = textAlpha;
          ctx.shadowColor = effect.col;
          ctx.shadowBlur = 8;
          ctx.fillText(effect.text, effectTextX, 3 + yOffset);
          ctx.restore();
        }
        return true;
      });
    }
    
    // Draw score on overlay canvas (above notes)
    var overlayCanvas = document.getElementById('scoreOverlayCanvas');
    if (overlayCanvas) {
      var octx = overlayCanvas.getContext('2d');
      if (octx) {
        // Sync overlay canvas dimensions to scoreWrap
        if (overlayCanvas.width !== scoreW) overlayCanvas.width = scoreW;
        if (overlayCanvas.height !== h) overlayCanvas.height = h;
        octx.clearRect(0, 0, scoreW, h);
        
        // Only draw score if currently playing recording (录制乐谱)
        // Check if the recording tab is active
        var recordTab = document.querySelector('.song-tab[data-tab="record"]');
        var isRecordTabActive = recordTab && recordTab.classList.contains('active');
        
        if (!isRecordTabActive) {
          octx.clearRect(0, 0, scoreW, h);
          return;
        }
        
        // Draw hit statistics on the right side - 横排版，右上角
        // 统计字体大小比分数小很多，限制在12-18像素
        var statsFs = Math.round(h * 0.08);
        statsFs = Math.max(12, Math.min(18, statsFs));
        var statsMargin = 10; // 固定右边间距为10像素
        var statsTopMargin = 8; // 顶部间距
        var shapeR = statsFs * 0.35; // 统一图形半径
        var lineWidth = 1; // 描边宽度
        var itemGap = statsFs * 1.5; // 每项之间的间距
        var textColor = '#a0a0a0'; // 文字颜色，暗一点
        var iconValueGap = 3; // 图标和数值之间的间距
        
        octx.save();
        octx.font = statsFs + 'px Arial, sans-serif';
        octx.textBaseline = 'middle';
        octx.textAlign = 'center';
        octx.fillStyle = textColor;
        octx.strokeStyle = '#a0a0a0'; // 统一描边颜色
        octx.lineWidth = lineWidth;
        
        var currentX = scoreW - statsMargin - shapeR; // 起始X位置（图标中心，从右边开始）
        var iconY = statsTopMargin + shapeR; // 图标Y位置
        var valueY = iconY + shapeR + iconValueGap + statsFs / 2; // 数值Y位置
        
        // Miss - 空心圆形（中间描边）- 最右边
        octx.beginPath();
        octx.arc(currentX, iconY, shapeR, 0, Math.PI * 2);
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.missCount.toString(), currentX, valueY);
        currentX -= shapeR * 2 + itemGap;
        
        // Right - 空心菱形（中间描边）
        octx.beginPath();
        octx.moveTo(currentX, iconY - shapeR);
        octx.lineTo(currentX + shapeR, iconY);
        octx.lineTo(currentX, iconY + shapeR);
        octx.lineTo(currentX - shapeR, iconY);
        octx.closePath();
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.rightCount.toString(), currentX, valueY);
        currentX -= shapeR * 2 + itemGap;
        
        // Great - 实心菱形 + 中间描边
        octx.beginPath();
        octx.moveTo(currentX, iconY - shapeR);
        octx.lineTo(currentX + shapeR, iconY);
        octx.lineTo(currentX, iconY + shapeR);
        octx.lineTo(currentX - shapeR, iconY);
        octx.closePath();
        octx.fillStyle = '#a0a0a0';
        octx.fill();
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.greatCount.toString(), currentX, valueY);
        currentX -= shapeR * 2 + itemGap;
        
        // Perfect - 实心圆形 + 中间描边 - 最左边
        octx.beginPath();
        octx.arc(currentX, iconY, shapeR, 0, Math.PI * 2);
        octx.fillStyle = '#a0a0a0';
        octx.fill();
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.perfectCount.toString(), currentX, valueY);
        
        octx.restore();
        
        // Draw score text - fixed position, doesn't scroll
        // 分数显示在滚动栏中上下居中，与右边对齐，间距为滚动栏长度的20分之1
        var scoreRightMargin = scoreW / 20;
        var scoreTextX = scoreW - scoreRightMargin;
        var scoreTextY = h / 2;
        var scoreTextFs = Math.round(h * 0.18);
        // 限制分数字体大小在28-46像素范围内（不包括播放完成后的放大效果）
        scoreTextFs = Math.max(28, Math.min(46, scoreTextFs));
        
        // Score animation when finished
        var scoreAnimFs = scoreTextFs;
        var scoreAnimX = scoreTextX;
        var scoreAnimY = scoreTextY;
        var scoreAnimAlpha = 0.95;
        
        if (_recPlayState.scoreAnimStart) {
          var animElapsed = performance.now() - _recPlayState.scoreAnimStart;
          var animDur = 900;
          var displayDur = 2000; // Display for 2 seconds after animation
          
          var animProg = Math.min(1, animElapsed / animDur);
          var easeOut = 1 - Math.pow(1 - animProg, 3);
          // Target: center of scroll bar (滚动栏中间)
          var targetX = scoreW / 2;
          var targetY = h / 2;
          var targetFs = scoreTextFs * 1.5;
          // Animate from saved starting position to center
          var startX = _recPlayState.scoreAnimStartX || scoreTextX;
          var startY = _recPlayState.scoreAnimStartY || scoreTextY;
          scoreAnimX = startX + (targetX - startX) * easeOut;
          scoreAnimY = startY + (targetY - startY) * easeOut;
          scoreAnimFs = scoreTextFs + (targetFs - scoreTextFs) * easeOut;
          scoreAnimAlpha = 0.95;
        }
        
        // Draw score text
        var comboText = 'COMBO';
        var scoreValue = Math.round(_recPlayState.currentScore).toString();
        
        // Score scale animation when score increases (centered scaling) - only for score value
        var scoreScale = 1;
        if (typeof _scoreAnim !== 'undefined' && _scoreAnim.active) {
          var scoreAnimElapsed = performance.now() - _scoreAnim.startTime;
          if (scoreAnimElapsed < _scoreAnim.duration) {
            var scoreProg = scoreAnimElapsed / _scoreAnim.duration;
            // Scale up then down: peak at 0.3 progress
            if (scoreProg < 0.3) {
              scoreScale = 1 + (scoreProg / 0.3) * 0.6; // scale up to 1.6x
            } else {
              scoreScale = 1.6 - ((scoreProg - 0.3) / 0.7) * 0.6; // scale down to 1x
            }
          } else {
            _scoreAnim.active = false;
          }
        }
        
        // COMBO字体小一点，分数值字体不变
        var comboFs = Math.round(scoreAnimFs * 0.5); // COMBO字体是分数的一半
        var scoreValueFs = scoreAnimFs * scoreScale; // 分数值有动画
        
        // 计算位置 - 同一行，分数值在左，COMBO在右
        var textY = scoreAnimY;
        
        octx.save();
        octx.textBaseline = 'middle';
        octx.globalAlpha = scoreAnimAlpha;
        
        // 先测量COMBO宽度
        octx.font = 'bold italic ' + Math.round(comboFs) + 'px Arial, sans-serif';
        var comboWidth = octx.measureText(comboText).width;
        
        // 绘制COMBO（不参与动画，描边效果弱化）
        if (_recPlayState.scoreAnimStart) {
          octx.textAlign = 'center';
        } else {
          octx.textAlign = 'right';
        }
        // 弱化的描边效果
        octx.strokeStyle = '#ffd700';
        octx.lineWidth = 1;
        octx.shadowColor = '#ffd700';
        octx.shadowBlur = 2;
        octx.strokeText(comboText, scoreAnimX, textY);
        // 再绘制白色填充
        octx.fillStyle = '#fffef0';
        octx.shadowBlur = 0;
        octx.fillText(comboText, scoreAnimX, textY);
        
        // 绘制分数值（参与动画，在COMBO左边）
        octx.font = 'bold italic ' + Math.round(scoreValueFs) + 'px Arial, sans-serif';
        var scoreValueWidth = octx.measureText(scoreValue).width;
        // 分数值位置 = COMBO左边位置 - COMBO宽度 - 间距
        var scoreValueX = scoreAnimX - comboWidth - scoreAnimFs * 0.2;
        
        if (_recPlayState.scoreAnimStart) {
          octx.textAlign = 'center';
        } else {
          octx.textAlign = 'right';
        }
        // 先绘制金色描边
        octx.strokeStyle = '#ffd700';
        octx.lineWidth = 2;
        octx.shadowColor = '#ffd700';
        octx.shadowBlur = 4;
        octx.strokeText(scoreValue, scoreValueX, textY);
        // 再绘制白色填充
        octx.fillStyle = '#fffef0';
        octx.shadowBlur = 0;
        octx.fillText(scoreValue, scoreValueX, textY);
        
        octx.restore();
      }
    }
  }
}

function drawTupuScore() {
  if (!ctx || !currentTupu || !currentTupu.scaledMasks) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (canvas.width <= 0 || canvas.height <= 0) return;
  
  currentTupu.scaledMasks.forEach((pageMasks) => {
    pageMasks.forEach((mask) => {
      const img = currentTupu.pageImgs[mask.pageIdx];
      if (!img) return;
      ctx.save();
      ctx.drawImage(
        img,
        mask.srcX, mask.srcY, mask.srcWidth, mask.srcHeight,
        mask.x, 0, mask.width, mask.height
      );
      ctx.restore();
    });
  });
}

function drawScore() {
  if (!ctx) return;
  // Sync canvas height to scoreWrap (prevents white canvas on resize/fullscreen) — DO NOT REMOVE
  if (scoreWrap) {
    const _wh = scoreWrap.offsetHeight || 34;
    if (canvas.height !== _wh) { canvas.height = _wh; canvas.style.height = _wh + "px"; }
  }
  // Always refresh fixed background (fixes distortion on resize)
  drawRainbowGridBackground();
  if (!tokens || tokens.length === 0) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
  
  const { fontSize, gap } = getScoreMetrics();
  
  const cv = document.createElement("canvas");
  const c2 = cv.getContext("2d");
  c2.font = fontSize + "px 'PingFang SC',Arial,sans-serif";
  
  let totalW = 0;
  for(let i=0; i<tokens.length; i++) {
    const t = tokens[i];
    const scaledW = c2.measureText(t.text).width;
    const nextTok = tokens[i+1];
    if(t.text === "_" || (nextTok && nextTok.text === "_")) {
      totalW += scaledW;
    } else {
      totalW += scaledW + gap;
    }
  }
  
  if(totalW <= 0) totalW = 100;
  
  canvas.width = totalW;
  canvas.style.width = totalW + "px";
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = fontSize + "px 'PingFang SC', 'Hiragino Sans GB', Arial, sans-serif";
  ctx.textBaseline = "middle";
  
  const y = canvas.height / 2;

  const now = performance.now();
  const animElapsed = now - noteAnimStartTime;
  let animProgress = 0;
  if (animElapsed < ANIM_DURATION) {
    animProgress = animElapsed / ANIM_DURATION;
  } else {
    animNoteIdx = -1;
  }
  const easeInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const scale = animProgress > 0 ? 1 + 0.4 * Math.sin(easeInOut(animProgress) * Math.PI) : 1;

  let scaledX = 0;
  tokens.forEach((tok, i) => {
    const scaledW = c2.measureText(tok.text).width;
    const isCurrentHighlight = tok.isNote && tok.noteIdx === highlightNoteIdx;
    const isAnimNote = tok.isNote && tok.noteIdx === animNoteIdx;

    if (isAnimNote) {
      ctx.save();
      const textCenterX = scaledX + scaledW / 2;
      const textCenterY = y;
      ctx.translate(textCenterX, textCenterY);
      ctx.scale(scale, scale);
      ctx.translate(-textCenterX, -textCenterY);
      ctx.fillStyle = "#0099ff";
      const displayText = tok.text === "0" ? " " : tok.text;
      ctx.fillText(displayText, scaledX, y);
      ctx.restore();
    } else if (isCurrentHighlight) {
      ctx.fillStyle = "#0099ff";
      const displayText = tok.text === "0" ? " " : tok.text;
      ctx.fillText(displayText, scaledX, y);
    } else {
      ctx.fillStyle = (tok.text === "|" || tok.text === "-" || tok.text === "_") ? "#888" : "#ddd";
      const displayText = tok.text === "0" ? " " : tok.text;
      ctx.fillText(displayText, scaledX, y);
    }
    
    const nextTok = tokens[i+1];
    if(tok.text === "_" || (nextTok && nextTok.text === "_")) {
      scaledX += scaledW;
    } else {
      scaledX += scaledW + gap;
    }
  });
}


// ─── 多轨录制播放系统 ───────────────────────────────────────────────

var _TRACK_COLORS = ['#4fc3f7','#81c784','#ffb74d','#f06292','#ce93d8'];


var _INST_EN = {
  '\u94a2\u7434':'piano','\u5409\u4ed6':'guitar','\u5c0f\u63d0\u7434':'violin','\u5927\u63d0\u7434':'cello',
  '\u7b2d':'xiao','\u7b1b\u5b50':'dizi','\u53e4\u7b5d':'guzheng','\u4e8c\u80e1':'erhu',
  '\u7435\u7436':'pipa','\u9f13':'drum','\u67b6\u5b50\u9f13':'drumkit','\u949f\u58f0':'bell',
  '\u5520\u5443':'suona','\u8d1d\u65af':'bass','\u8428\u514b\u65af':'saxophone'
};

var _OCT_COLORS = [
  '#a855f7','#6366f1','#3b82f6','#22c55e','#eab308','#f97316','#ef4444'
];
// Note name -> color: C=red, D=orange, E=yellow, F=green, G=cyan, A=blue, B=violet
var _NOTE_COLORS = {
  'C':'#ef4444', 'C#':'#f97316',
  'D':'#f97316', 'D#':'#eab308',
  'E':'#eab308',
  'F':'#22c55e', 'F#':'#06b6d4',
  'G':'#06b6d4', 'G#':'#3b82f6',
  'A':'#3b82f6', 'A#':'#8b5cf6',
  'B':'#8b5cf6'
};
// CDEFGAB -> red, orange, yellow, green, cyan, blue, violet
var _SCALE_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6'];
var _SCALE_NAMES  = ['C','D','E','F','G','A','B'];

// 根据音符名获取轨道号 (从下到上: C=6, D=5, E=4, F=3, G=2, A=1, B=0)
function _getNoteLane(note) {
  var noteStr = (typeof note === 'string') ? note : String(note);
  var noteName = noteStr ? noteStr.replace(/[0-9]/g, '').replace('#', '') : 'C';
  var idx = _SCALE_NAMES.indexOf(noteName);
  return idx >= 0 ? (6 - idx) : 6;
}

// 滚动栏背景渐变配置
var _SCORE_BG_GRADIENT = {
  baseColor: '#070b0fff',
  horizontalGradient: {
    left: 'rgba(9, 74, 104, 0.31)',
    middle1: 'rgba(19, 29, 54, 0.21)',
    middle2: 'rgba(19, 16, 46, 0.32)',
    right: 'rgba(70, 25, 82, 0.28)'
  },
  verticalGradient: {
    top: 'rgba(48, 56, 58, 0.14)',
    middle1: 'rgba(143, 126, 156, 0.1)',
    middle2: 'rgba(138, 126, 165, 0.14)',
    bottom: 'rgba(76, 65, 78, 0.14)'
  },
  edgeLines: {
    top: 'rgba(128, 242, 255, 0.5)',
    bottom: 'rgba(236, 204, 255, 0.25)'
  }
};

// 视觉速度系数：音符块在滚动栏中的移动速度倍数（发音时间不变，只是视觉移动更快）
// 值越大，音符块移动越快，到达琴弦的时间越短
var _VISUAL_SPEED_MULT = 1.5;

// Gradient colors for each note: [leftBarColor, blockColor1, blockColor2, blockColor3, blockColor4]
var _NOTE_GRADIENTS = {
  // C: 红色 - 柔和绯红 (Dusty Rose to Crimson)
  'C': ['hsla(0, 38%, 32%, 1.00)', 'hsla(0, 40%, 35%, 1.00)', 'hsla(0, 45%, 41%, 1.00)', 'hsla(0, 48%, 48%, 1.00)', 'hsla(0, 50%, 55%, 1.00)'],
  
  // D: 橙色 - 琥珀色调 (Amber)
  'D': ['hsla(28, 40%, 32%, 1.00)', 'hsla(30, 42%, 35%, 1.00)', 'hsla(32, 45%, 41%, 1.00)', 'hsla(35, 50%, 48%, 1.00)', 'hsla(38, 55%, 55%, 1.00)'],
  
  // E: 黄色 - 软金黄 (Soft Gold)
  'E': ['hsla(50, 45%, 31%, 1.00)', 'hsla(52, 48%, 34%, 1.00)', 'hsla(54, 52%, 41%, 1.00)', 'hsla(56, 58%, 48%, 1.00)', 'hsla(60, 65%, 55%, 1.00)'],
  
  // F: 绿色 - 森林绿 (Forest Green)
  'F': ['hsla(135, 35%, 31%, 1.00)', 'hsla(140, 38%, 34%, 1.00)', 'hsla(145, 42%, 41%, 1.00)', 'hsla(150, 48%, 48%, 1.00)', 'hsla(155, 52%, 55%, 1.00)'],
  
  // G: 青色 - 绿松石 (Turquoise)
  'G': ['hsla(185, 42%, 31%, 1.00)', 'hsla(190, 45%, 34%, 1.00)', 'hsla(195, 48%, 41%, 1.00)', 'hsla(200, 52%, 48%, 1.00)', 'hsla(205, 55%, 55%, 1.00)'],
  
  // A: 蓝色 - 暮色蓝 (Twilight Blue)
  'A': ['hsla(225, 38%, 35%, 1.00)', 'hsla(230, 42%, 38%, 1.00)', 'hsla(235, 45%, 45%, 1.00)', 'hsla(240, 50%, 53%, 1.00)', 'hsla(245, 55%, 60%, 1.00)'],
  
  // B: 紫色 - 灰紫罗兰 (Dusty Violet)
  'B': ['hsla(285, 32%, 35%, 1.00)', 'hsla(295, 35%, 38%, 1.00)', 'hsla(305, 40%, 45%, 1.00)', 'hsla(315, 45%, 53%, 1.00)', 'hsla(325, 50%, 60%, 1.00)']
};

function _noteOctColor(note) {
  var noteStr = (typeof note === 'string') ? note : String(note);
  var name = noteStr.replace(/[0-9#]/g, '').replace(/#/,'');
  // Extract base note name (C, D, E, F, G, A, B) ignoring sharps for color
  var base = noteStr.match(/^([A-G])/);
  var idx  = base ? _SCALE_NAMES.indexOf(base[1]) : 3;
  return _SCALE_COLORS[Math.max(0, Math.min(6, idx))];
}

// Rotate a hex color's hue by `deg` degrees, return new hex
function _rotateHue(hex, deg) {
  // Parse hex
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  // RGB → HSL
  var max=Math.max(r,g,b), min=Math.min(r,g,b), h2=0, s2=0, l2=(max+min)/2;
  if(max!==min){
    var d=max-min;
    s2=l2>0.5?d/(2-max-min):d/(max+min);
    if(max===r) h2=(g-b)/d+(g<b?6:0);
    else if(max===g) h2=(b-r)/d+2;
    else h2=(r-g)/d+4;
    h2=h2/6;
  }
  // Rotate hue
  h2 = ((h2*360 + deg) % 360 + 360) % 360 / 360;
  // HSL → RGB
  function hue2rgb(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}
  var r2,g2,b2;
  if(s2===0){r2=g2=b2=l2;}else{
    var q2=l2<0.5?l2*(1+s2):l2+s2-l2*s2, p2=2*l2-q2;
    r2=hue2rgb(p2,q2,h2+1/3);
    g2=hue2rgb(p2,q2,h2);
    b2=hue2rgb(p2,q2,h2-1/3);
  }
  var toHex=function(v){var s=Math.round(v*255).toString(16);return s.length===1?'0'+s:s;};
  return '#'+toHex(r2)+toHex(g2)+toHex(b2);
}

function _parseRecTrack(str) {
  return str.trim().split('_').filter(Boolean).map(function(seg) {
    var p = seg.split('|');
    var isNewFormat = p.length >= 5 && !isNaN(parseInt(p[2])) && String(p[2]).indexOf('ms') === -1;
    if (isNewFormat) {
      return {
        inst:   p[0] || '\u94a2\u7434',
        note:   p[1] || 'C4',
        volume: parseInt(p[2]) || 100,
        holdMs: parseInt(p[3]) || 200,
        atMs:   parseInt(p[4]) || 0
      };
    } else {
      return {
        inst:   p[0] || '\u94a2\u7434',
        note:   p[1] || 'C4',
        volume: 100,
        holdMs: parseInt((p[2]||'200ms').replace('ms',''))||200,
        atMs:   parseInt((p[3]||'0ms').replace('ms',''))||0
      };
    }
  });
}

// ── measure canvas for text width ──────────────────────────────────
var _mC = document.createElement('canvas');
var _mX = _mC.getContext('2d');

function _textWidth(note, fs) {
  _mX.font = 'bold ' + fs + 'px "PingFang SC",Arial,sans-serif';
  return _mX.measureText(note).width;
}

// ── hit effects ─────────────────────────────────────────────────────
var _hitFx = [];

// ── note hit scale effect (放大缩小动画) ─────────────────────────────
var _noteHitScaleFx = [];

// ── lane gradient effects (from string to 2/3 of scroll bar) ────────
var _laneGradientFx = [];

// ── play state ──────────────────────────────────────────────────────
var _recPlayState = null;

// ── playhead vibration effect ───────────────────────────────────────
var _playheadVibration = { active: false, startTime: 0, amplitude: 0, duration: 300 };

// ── score animation effect ───────────────────────────────────────────
var _scoreAnim = { active: false, startTime: 0, duration: 300 };

function triggerScoreAnimation() {
  _scoreAnim.active = true;
  _scoreAnim.startTime = performance.now();
}

function triggerPlayheadVibration(amplitude) {
  _playheadVibration.active = true;
  _playheadVibration.startTime = performance.now();
  _playheadVibration.amplitude = amplitude || 3;
}

// ── paused vibration loop ────────────────────────────────────────────
var _pausedVibrationRaf = null;

function _startPausedVibrationLoop() {
  if (_pausedVibrationRaf) return; // Already running
  
  function loop() {
    if (!_recPlayState || !_recPlayState.paused) {
      _pausedVibrationRaf = null;
      return;
    }
    
    // Continue looping while vibration is active, explosions exist, gradient effects exist, hit effects exist, touch effects exist, or scale animations exist
    var hasVibration = _playheadVibration.active;
    var hasExplosions = _playheadExplosions.length > 0;
    var hasGradientFx = _laneGradientFx.length > 0;
    var hasHitFx = _hitFx.length > 0;
    var hasTouchFx = _touchFx.length > 0;
    var hasScaleAnim = _noteHitScaleFx.length > 0;
    
    if (hasVibration || hasExplosions || hasGradientFx || hasHitFx || hasTouchFx || hasScaleAnim) {
      drawRecordScore(_recPlayState.pausedElapsed || 0, performance.now());
      _pausedVibrationRaf = requestAnimationFrame(loop);
    } else {
      _pausedVibrationRaf = null;
    }
  }
  
  _pausedVibrationRaf = requestAnimationFrame(loop);
}

// ── playhead collision explosions ───────────────────────────────────
var _playheadExplosions = [];
// Track which notes have triggered explosion to avoid duplicates
var _playheadExplosionTriggered = {};

// ── 碰触特效：用户弹奏时音符块与琴弦碰撞的特效 ───────────────────────────────────
var _touchFx = [];

function addTouchExplosion(screenX, lane, laneH, color) {
  var directions = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },                   { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
  ];
  directions.forEach(function(dir) {
    var randomDx = dir.dx + (Math.random() - 0.5) * 0.8;
    var randomDy = dir.dy + (Math.random() - 0.5) * 0.8;
    var randomSize = 1.0 + Math.random() * 1.0;
    var randomRotation = Math.random() * Math.PI * 2;
    var randomRotationSpeed = (Math.random() - 0.5) * 0.2;
    
    _touchFx.push({
      screenX: screenX,
      lane: lane,
      dx: randomDx,
      dy: randomDy,
      sizeMultiplier: randomSize,
      rotation: randomRotation,
      rotationSpeed: randomRotationSpeed,
      color: color,
      startTime: performance.now(),
      duration: 500
    });
  });
  
  // 添加两层圆形描边扩散效果，一先一后出现
  // 第一层圆形描边（先出现）
  _touchFx.push({
    screenX: screenX,
    lane: lane,
    isRipple: true,
    rippleLayer: 1,
    color: color,
    startTime: performance.now(),
    duration: 400
  });
  // 第二层圆形描边（后出现，延迟100ms）
  _touchFx.push({
    screenX: screenX,
    lane: lane,
    isRipple: true,
    rippleLayer: 2,
    color: color,
    startTime: performance.now() + 100,
    duration: 400
  });
}

// 检查琴弦位置是否有音符块经过，用于触发碰触特效
function checkTouchCollision() {
  // 在播放模式和跟弹模式下都可以触发
  if (!_recPlayState || _recPlayState.finished) return;
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var LANE_COUNT = 7;
  var laneH = currentH / LANE_COUNT;
  var blockH = Math.round(_recPlayState.baseBlockH * scale);
  var base_bw = blockH * 1.5; // 与drawRecordScore保持一致
  // 琴弦在主canvas上的X坐标
  var playheadX = scoreW / 4 - canvasOffX;
  // 琴弦的屏幕坐标（固定位置）
  var screenPlayheadX = scoreW / 4;
  
  // Check all notes for collision with playhead
  _recPlayState.tracks.forEach(function(track, ti) {
    // 检查该旋律是否显示
    var melodyId = track.melodyId || (ti === 0 ? 'main' : 'accomp');
    var melody = window._melodyList ? window._melodyList.find(function(m) { return m.id === melodyId; }) : null;
    if (melody && melody.showNotes === false) return;
    
    track.notes.forEach(function(n, ni) {
      var noteLane = _getNoteLane(n.note);
      var noteX = n._x * scale; // Canvas coordinate
      var hold_bw = (n._hold_bw || 0) * scale;
      var noteW = base_bw + hold_bw; // 与drawRecordScore保持一致
      var noteRightX = noteX + noteW;
      
      // Check if note block is touching playhead (琴弦穿过音符块)
      var isTouching = (noteX <= playheadX && noteRightX >= playheadX);
      
      if (isTouching) {
        var noteCol = _noteOctColor(n.note);
        // 琴弦和音符块交集的中心点：X=琴弦位置，Y=音符块轨道中心
        // 存储屏幕坐标，绘制时转换为canvas坐标
        addTouchExplosion(screenPlayheadX, noteLane, laneH, noteCol);
      }
    });
  });
}

function checkPlayheadCollision() {
  if (!_recPlayState || _recPlayState.paused) return;
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var playheadX = scoreW / 4 - canvasOffX; // Canvas coordinate (consistent with draw)
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var LANE_COUNT = 7;
  var laneH = currentH / LANE_COUNT;
  
  // Check all notes for collision with playhead
  _recPlayState.tracks.forEach(function(track, ti) {
    // 检查该旋律是否显示
    var melodyId = track.melodyId || (ti === 0 ? 'main' : 'accomp');
    var melody = window._melodyList ? window._melodyList.find(function(m) { return m.id === melodyId; }) : null;
    if (melody && melody.showNotes === false) return;
    
    track.notes.forEach(function(n, ni) {
      var noteKey = ti + '-' + ni;
      var noteLane = _getNoteLane(n.note);
      var noteX = n._x * scale; // Canvas coordinate
      var noteW = (n._base_bw + n._hold_bw) * scale;
      
      // Check if note block is touching playhead (both in canvas coordinates)
      var isTouching = Math.abs(noteX - playheadX) < 10 || 
                       (noteX <= playheadX && noteX + noteW >= playheadX);
      
      // Trigger explosion if touching and not already triggered for this note
      if (isTouching && !_playheadExplosionTriggered[noteKey]) {
        _playheadExplosionTriggered[noteKey] = true;
        
        // Explosion position: centered on playhead X, at the note's lane Y
        // This ensures squares spread from the playhead line position
        addPlayheadExplosion(playheadX, noteLane, laneH, n._color || '#4fc3f7');
      }
      
      // Reset trigger when note moves away from playhead
      if (!isTouching && _playheadExplosionTriggered[noteKey]) {
        delete _playheadExplosionTriggered[noteKey];
      }
    });
  });
}

function addPlayheadExplosion(playheadX, lane, laneH, color) {
  // Create multiple squares that spread in different directions from playhead
  var directions = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },                   { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
  ];
  directions.forEach(function(dir) {
    // Add random offset to direction (-0.3 to +0.3)
    var randomDx = dir.dx + (Math.random() - 0.5) * 0.6;
    var randomDy = dir.dy + (Math.random() - 0.5) * 0.6;
    // Add random size multiplier (0.7 to 1.3)
    var randomSize = 0.7 + Math.random() * 0.6;
    
    _playheadExplosions.push({
      lane: lane,
      dx: randomDx,
      dy: randomDy,
      sizeMultiplier: randomSize,
      color: color,
      startTime: performance.now(),
      duration: 500
    });
  });
  
  // Add double ring ripple effect
  _playheadExplosions.push({
    lane: lane,
    dx: 0,
    dy: 0,
    sizeMultiplier: 1,
    color: color,
    startTime: performance.now(),
    duration: 500,
    drawRipple: true
  });
}

// Called by startNote hook to check timing accuracy
// Called with (note, instEn, nowMs) — instEn is the actual instrument played
window._checkRecHit = function(note, instEn, nowMs) {
  // Only triggers when rec is actively playing (not paused, not finished)
  if (!_recPlayState || _recPlayState.paused || _recPlayState.finished) return;
  var elapsed = (nowMs - _recPlayState.startTime) * _recPlayState.speed;

  _recPlayState.tracks.forEach(function(track, ti) {
    // 检查该旋律是否显示
    var melodyId = track.melodyId || (ti === 0 ? 'main' : 'accomp');
    var melody = window._melodyList ? window._melodyList.find(function(m) { return m.id === melodyId; }) : null;
    if (melody && melody.showNotes === false) return;
    
    track.notes.forEach(function(n, ni) {
      // Must match BOTH note and instrument
      if (n.note !== note) return;
      var nInstEn = _INST_EN[n.inst] || n.inst; // convert Chinese inst name to English
      if (nInstEn !== instEn) return;
      // Timing window: note must be coming up or just started
      var diff = elapsed - n.atMs;
      if (diff < -300 || diff > n.holdMs + 300) return;
      var absDiff = Math.abs(diff);
      // Tier thresholds: 0-40% = gold(1), 40-55% = blue(2), 55-70% = green(3)
      // Base window is holdMs with a minimum floor
      var base  = Math.max(100, n.holdMs);
      var g40 = base * 0.40;
      var g55 = base * 0.55;
      var g70 = base * 0.70;
      var tier = absDiff <= g40 ? 1 : absDiff <= g55 ? 2 : absDiff <= g70 ? 3 : 0;
      if (!tier) return;
      
      var noteKey = ti + '-' + ni;
      if (_recPlayState.scoredNotes[noteKey]) return;
      
      var h = canvas ? canvas.height : 170;
      var scale = h / (_recPlayState.baseLaneH * 5);
      var bh   = Math.round(_recPlayState.baseBlockH * scale);
      var base_bw = bh * 1.5; // Base width (1:1.5 ratio with bh)
      var hold_bw = (n._hold_bw || 0) * scale; // Extra width from hold time
      var bw   = base_bw + hold_bw; // Total width
      var laneH = h / 7;
      var lane  = _getNoteLane(n.note);
      var x     = n._x * scale;
      var y     = lane * laneH + (laneH - bh) / 2;
      var noteCol = _noteOctColor(n.note); // 音符块的颜色
      
      // Add lane gradient effect (from string to 2/3 of scroll bar)
      var noteCol = _noteOctColor(n.note); // 使用音符块的颜色
      _laneGradientFx.push({
        lane: lane,
        color: noteCol,
        t0: performance.now()
      });
      
      // Add note hit scale animation (放大缩小动画)
      _noteHitScaleFx.push({
        noteKey: noteKey,
        t0: performance.now(),
        duration: 600
      });
      
      // Calculate score
      var scoreMultiplier = tier === 1 ? 1 : tier === 2 ? 0.8 : 0.6;
      var noteScore = _recPlayState.perNoteScore * scoreMultiplier;
      _recPlayState.currentScore += noteScore;
      _recPlayState.scoredNotes[noteKey] = true;
      
      // Update hit count
      if (tier === 1) _recPlayState.perfectCount++;
      else if (tier === 2) _recPlayState.greatCount++;
      else _recPlayState.rightCount++;
      
      // Trigger score animation
      triggerScoreAnimation();
      
      // Add effect text
      var text = tier === 1 ? 'Perfect' : tier === 2 ? 'Great' : 'Right';
      var col  = tier === 1 ? '#ffd700' : tier === 2 ? '#4fc3f7' : '#4caf50';
      _recPlayState.effectTexts.push({
        text: text,
        col: col,
        t0: performance.now()
      });
    });
  });
};

function startRecordPlay(recObj) {
  // Stop ALL other playback modes before starting recording playback
  stopRecordPlay();
  // Stop jianpu auto-scroll (scrollRAF loop)
  if (typeof cancelAnimationFrame !== 'undefined' && typeof scrollRAF !== 'undefined') {
    cancelAnimationFrame(scrollRAF);
  }
  if (typeof isScrolling !== 'undefined') isScrolling = false;
  if (typeof stopAutoPlay === 'function') try { stopAutoPlay(); } catch(e) {}
  // Stop tupu scrolling and clear currentTupu
  if (typeof stopTupuScrolling === 'function') try { stopTupuScrolling(); } catch(e) {}
  currentTupu = null;
  // Stop any active notes from previous playback
  if (typeof activeNodes !== 'undefined') {
    activeNodes.forEach(function(v, k) {
      if (k === 'auto' || String(k).indexOf('rec_') === 0) {
        try { stopNote(k); } catch(e) {}
      }
    });
  }
  if (!recObj || !recObj.display) return;
  var lines = recObj.display.split('\n').filter(function(s){ return s.trim(); });
  if (!lines.length) return;

  var showNotesList = recObj.showNotesList || [true, true];
  if (!window._melodyList) {
    window._melodyList = [];
  }
  lines.forEach(function(line, i) {
    var melodyId = (i === 0) ? 'main' : 'accomp';
    if (!window._melodyList[i]) {
      window._melodyList[i] = { id: melodyId, name: i === 0 ? '主旋律' : '伴奏', text: '', showNotes: true };
    }
    window._melodyList[i].showNotes = showNotesList[i] !== false;
  });

  var speed  = parseFloat(recObj.speed) || 1;
  var tracks = lines.map(function(line, i) {
    var melodyId = (i === 0) ? 'main' : 'accomp';
    var trackObj = { notes: _parseRecTrack(line), idx: i, melodyId: melodyId };
    trackObj.notes.forEach(function(n) {
      n.melodyId = melodyId;
    });
    return trackObj;
  });

  var totalDur = 0;
  tracks.forEach(function(t) {
    t.notes.forEach(function(n) {
      totalDur = Math.max(totalDur, n.atMs + n.holdMs + 800);
    });
  });

  // 同类录制切换保持高度，否则默认 5×34=170px
  var keepRec = (_scoreBarType === 'rec');
  var targetH = keepRec ? (scoreWrap ? scoreWrap.offsetHeight || 170 : 170) : 170;
  if (scoreWrap) scoreWrap.style.setProperty('--score-height', targetH + 'px');
  _scoreBarType = 'rec';
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas) { canvas.height = targetH; canvas.style.height = targetH + 'px'; }
  drawRainbowGridBackground();

  var h         = targetH;
  var LANE_COUNT = 7;
  var laneH     = h / LANE_COUNT;

  // Base block dimensions (fixed ratio 1:1.5 for width:height)
  // Base values for 170px total height (7 lanes)
  var baseBlockH = 20; // Base block height (fixed)
  var baseBlockW = baseBlockH * 1.5; // Base block width (ratio 1:1.5)
  
  var PX_PER_MS = 0.18; // Base pixel per ms, speed is handled in elapsed
  var scoreW    = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX    = scoreW / 4;

  // Pre-compute per-note geometry (base values, will be scaled during draw)
  var totalNotes = 0;
  tracks.forEach(function(t) {
    totalNotes += t.notes.length;
    t.notes.forEach(function(n) {
      n._x     = n.atMs * PX_PER_MS * _VISUAL_SPEED_MULT;
      n._base_bw = baseBlockW; // Base width (1:2 ratio)
      n._hold_bw = n.holdMs * PX_PER_MS * _VISUAL_SPEED_MULT; // Extra width from hold time
      n._bw     = n._base_bw + n._hold_bw; // Total base width
      n._color    = _noteOctColor(n.note);
      n._adjColor = _rotateHue(n._color, 10);
    });
  });

  var perNoteScore = totalNotes > 0 ? 100 / totalNotes : 0;

  var totalW = fixedX + 100;
  tracks.forEach(function(t) {
    t.notes.forEach(function(n) {
      totalW = Math.max(totalW, n._x + n._bw + 200);
    });
  });

  // Store base total width for scaling
  var baseTotalW = totalW;

  if (canvas) {
    canvas.width  = Math.ceil(totalW);
    canvas.style.width  = Math.ceil(totalW) + 'px';
    canvas.style.left   = fixedX + 'px';
    canvasOffX = fixedX;
  }

  _recPlayState = {
    tracks: tracks, totalDur: totalDur,
    PX_PER_MS: PX_PER_MS, totalW: totalW, speed: speed,
    startTime: performance.now(), raf: null,
    scheduled: {}, fixedX: fixedX,
    baseLaneH: 34, baseBlockH: 25, baseFs: 14,
    baseTotalW: baseTotalW,
    laneH: laneH, fs: 14, blockH: 25,
    paused: false, pausedElapsed: 0, pausedAt: undefined,
    recObj: recObj,
    totalNotes: totalNotes,
    perNoteScore: perNoteScore,
    currentScore: 0,
    effectTexts: [],
    scoredNotes: {},
    perfectCount: 0,
    greatCount: 0,
    rightCount: 0,
    missCount: 0
  };
  _hitFx = [];
  _laneGradientFx = [];

  playBtn.classList.add("on");
  togglePlayBtnIcon(true);
  _startRingLoop();
  _recLoop();
}

function _recLoop() {
  if (!_recPlayState) return;
  _recPlayState.raf = requestAnimationFrame(function(now) {
    if (!_recPlayState) return;
    if (_recPlayState.paused) return; // frozen
    var elapsed = (now - _recPlayState.startTime) * _recPlayState.speed;
    _recPlayState.pausedElapsed = elapsed;

    // Schedule notes
    _recPlayState.tracks.forEach(function(track, ti) {
      track.notes.forEach(function(n, ni) {
        var key = ti + '-' + ni;
        if (_recPlayState.scheduled[key]) return;
        // Fire sound when block left edge is within 60ms of the playhead (accounts for rAF latency)
        if (elapsed >= n.atMs - 60) {
          _recPlayState.scheduled[key] = true;
          var instEn = _INST_EN[n.inst] || n.inst;
          var noteVolume = n.volume || 100;
          // Note: playhead vibration is only triggered by user key presses, not auto-playback
          // Delay slightly if we're early so sound lands at visual crossing
          var fireDelay = Math.max(0, (n.atMs - elapsed) / _recPlayState.speed);
          (function(k, note, inst, hms, sp, delay, vol) {
            setTimeout(function(){
              if (!_recPlayState || _recPlayState.paused) return;
              startNote('rec_' + k, note, inst, vol);
              setTimeout(function(){ try{ stopNote('rec_' + k); }catch(e){} }, hms / sp);
            }, delay);
          })(key, n.note, instEn, n.holdMs, _recPlayState.speed, fireDelay, noteVolume);
        }
      });
    });

    // Scroll - 视觉速度与音符块同步缩放
    var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
    var fixedX = scoreW / 4;
    var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
    var scale = currentH / (_recPlayState.baseLaneH * 5);
    // 视觉滚动偏移：与音符块同步缩放
    var nowX = elapsed * 0.18 * _VISUAL_SPEED_MULT * scale;
    canvasOffX = fixedX - nowX;
    if (canvas) canvas.style.left = canvasOffX + 'px';
    
    // Update canvas height and width based on current scoreWrap height
    var scaledTotalW = Math.ceil(_recPlayState.baseTotalW * scale);
    if (canvas) {
      if (canvas.height !== currentH) {
        canvas.height = currentH;
        canvas.style.height = currentH + 'px';
      }
      if (canvas.width !== scaledTotalW) {
        canvas.width = scaledTotalW;
        canvas.style.width = scaledTotalW + 'px';
      }
    }

    var scoreFinished = drawRecordScore(elapsed, now);

    if (elapsed < _recPlayState.totalDur) {
      _recLoop();
    } else if (!scoreFinished) {
      // Playback finished but score animation still running
      if (!_recPlayState.finished) {
        // First frame after playback finished - reset canvas position and size
        _recPlayState.finished = true;
        canvasOffX = 0;
        if (canvas) {
          canvas.style.left = '0px';
          // Reset canvas width and height to match scoreWrap
          var scoreW2 = scoreWrap ? scoreWrap.clientWidth : 300;
          var scoreH2 = scoreWrap ? scoreWrap.offsetHeight : 170;
          if (canvas.width !== scoreW2) {
            canvas.width = scoreW2;
            canvas.style.width = scoreW2 + 'px';
          }
          if (canvas.height !== scoreH2) {
            canvas.height = scoreH2;
            canvas.style.height = scoreH2 + 'px';
          }
        }
      }
      _recLoop();
    } else {
      // Score display finished - fully end playback
      // Calculate miss count before finishing
      _recPlayState.missCount = _recPlayState.totalNotes - _recPlayState.perfectCount - _recPlayState.greatCount - _recPlayState.rightCount;
      _recPlayState.finished = true;
      _recPlayState.paused   = true;
      playBtn.classList.remove("on");
      togglePlayBtnIcon(false);
    }
  });
}

function pauseRecordPlay() {
  if (!_recPlayState || _recPlayState.paused) return;
  cancelAnimationFrame(_recPlayState.raf);
  _stopRingLoop();
  // Stop ALL currently playing rec notes immediately
  _recPlayState.tracks.forEach(function(t, ti) {
    t.notes.forEach(function(n, ni) {
      try { stopNote('rec_' + ti + '-' + ni); } catch(e) {}
    });
  });
  _recPlayState.paused       = true;
  _recPlayState.pausedAt     = performance.now();
  // Enter follow mode: user must play correct note to advance
  _recPlayState.followMode   = true;
  // Build follow index: find the next note at or after current elapsed
  var elapsed = _recPlayState.pausedElapsed || 0;
  _recPlayState.followIdx    = 0;
  outer: for (var ti = 0; ti < _recPlayState.tracks.length; ti++) {
    for (var ni = 0; ni < _recPlayState.tracks[ti].notes.length; ni++) {
      var n = _recPlayState.tracks[ti].notes[ni];
      if (n.atMs >= elapsed) {
        _recPlayState.followIdx = { ti: ti, ni: ni };
        break outer;
      }
    }
  }
  // Flatten all notes sorted by atMs for follow mode (只包含显示的音符)
  var allNotes = [];
  _recPlayState.tracks.forEach(function(t, ti) {
    // 检查该旋律是否显示
    var melodyId = t.melodyId || (ti === 0 ? 'main' : 'accomp');
    var melody = window._melodyList ? window._melodyList.find(function(m) { return m.id === melodyId; }) : null;
    if (melody && melody.showNotes === false) return;
    
    t.notes.forEach(function(n, ni) {
      allNotes.push({ note: n.note, atMs: n.atMs, holdMs: n.holdMs, ti: ti, ni: ni,
                      inst: n.inst, melodyId: melodyId });
    });
  });
  allNotes.sort(function(a, b) { return a.atMs - b.atMs; });
  _recPlayState.followNotes  = allNotes;
  // Start from the note at/after current elapsed
  _recPlayState.followPos    = 0;
  for (var i = 0; i < allNotes.length; i++) {
    if (allNotes[i].atMs >= elapsed) { _recPlayState.followPos = i; break; }
    _recPlayState.followPos = i + 1;
  }
  playBtn.classList.remove("on");
  togglePlayBtnIcon(false);
  // 跟弹模式下启动琴键提示绘制循环
  _startRingLoop();
  // Update canvas position to ensure it stays at the correct place
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX = scoreW / 4;
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var nowX = elapsed * 0.18 * _VISUAL_SPEED_MULT * scale;
  canvasOffX = fixedX - nowX;
  if (canvas) canvas.style.left = canvasOffX + 'px';
  drawRecordScore(elapsed, performance.now());
}

function resumeRecordPlay() {
  if (!_recPlayState || !_recPlayState.paused) return;
  if (_recPlayState.finished) {
    // Replay from start
    var obj = _recPlayState.recObj;
    stopRecordPlay();
    startRecordPlay(obj);
    return;
  }
  // Exit follow mode
  _recPlayState.followMode   = false;
  _recPlayState.followNotes  = null;
  // Shift startTime forward by pause duration so elapsed stays continuous
  var pauseDur = performance.now() - _recPlayState.pausedAt;
  _recPlayState.startTime += pauseDur;
  _recPlayState.pausedAt  = undefined;
  _recPlayState.paused    = false;
  // Update canvas position immediately based on current elapsed
  var elapsed = _recPlayState.pausedElapsed || 0;
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX = scoreW / 4;
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var nowX = elapsed * 0.18 * _VISUAL_SPEED_MULT * scale;
  canvasOffX = fixedX - nowX;
  if (canvas) canvas.style.left = canvasOffX + 'px';
  playBtn.classList.add("on");
  togglePlayBtnIcon(true);
  _startRingLoop();
  _recLoop();
}

function stopRecordPlay() {
  if (!_recPlayState) return;
  cancelAnimationFrame(_recPlayState.raf);
  _recPlayState.tracks.forEach(function(t, ti) {
    t.notes.forEach(function(n, ni) {
      try { stopNote('rec_' + ti + '-' + ni); } catch(e) {}
    });
  });
  _recPlayState = null;
  _hitFx = [];
  _laneGradientFx = [];
  _touchFx = [];
  _stopRingLoop();
  if (typeof playBtn !== 'undefined') { playBtn.classList.remove("on"); togglePlayBtnIcon(false); }
  if (canvas) { canvas.style.left = '20px'; canvasOffX = 20; }
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRainbowGridBackground();
}

// ── Key-edge anticipation rings ─────────────────────────────────────
// Drawn on the piano container overlay, NOT on the score canvas.
// We use a separate <canvas> overlay on top of the piano container.
var _ringCanvas = null;
var _ringCtx    = null;
var _ringRAF    = null;

function _ensureRingCanvas() {
  var existing = document.getElementById('_recRingCanvas');
  if (existing) { _ringCanvas = existing; _ringCtx = existing.getContext('2d');
    // Ensure it's on documentElement
    if (existing.parentNode !== document.documentElement) document.documentElement.appendChild(existing);
    return; }
  var c = document.createElement('canvas');
  c.id = '_recRingCanvas';
  // Fixed positioning covers the entire viewport, correctly tracking all elements
  c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:11;';
  // Append to <html> not <body>, so position:fixed is relative to true viewport
  // (CSS: position:fixed inside transformed element uses that element as container)
  document.documentElement.appendChild(c);
  _ringCanvas = c; _ringCtx = c.getContext('2d');
}

function _startRingLoop() {
  if (_ringRAF) return;
  _ensureRingCanvas();
  function loop() {
    _drawRings();
    _ringRAF = requestAnimationFrame(loop);
  }
  _ringRAF = requestAnimationFrame(loop);
}

function _stopRingLoop() {
  cancelAnimationFrame(_ringRAF);
  _ringRAF = null;
  if (_ringCanvas && _ringCtx) {
    _ringCtx.clearRect(0, 0, _ringCanvas.width, _ringCanvas.height);
  }
}

function _drawRings() {
  if (!_ringCanvas || !_ringCtx || !_recPlayState) { _stopRingLoop(); return; }
  if (!keyHintEnabled) { _stopRingLoop(); return; }
  if (isScoreFullscreen) { _stopRingLoop(); return; }
  var cont = document.getElementById('container');
  if (!cont) return;

  // Canvas is position:fixed, so it covers the full viewport
  // Use CSS pixel viewport size - works correctly even with body CSS transform rotation
  var vw = document.documentElement.clientWidth  || window.innerWidth;
  var vh = document.documentElement.clientHeight || window.innerHeight;
  if (_ringCanvas.width !== vw)  _ringCanvas.width  = vw;
  if (_ringCanvas.height !== vh) _ringCanvas.height = vh;
  _ringCtx.clearRect(0, 0, vw, vh);

  // 跟弹模式下显示当前要弹的音符
  if (_recPlayState.paused && _recPlayState.followMode && _recPlayState.followNotes) {
    var followNotes = _recPlayState.followNotes;
    var followPos = _recPlayState.followPos;
    
    // 跳过隐藏的音符，找到下一个可见的音符
    while (followPos < followNotes.length) {
      var fn = followNotes[followPos];
      var fnMelodyId = fn.melodyId || (fn.ti === 0 ? 'main' : 'accomp');
      var fnMelody = window._melodyList ? window._melodyList.find(function(m) { return m.id === fnMelodyId; }) : null;
      if (fnMelody && fnMelody.showNotes === false) {
        // 该旋律隐藏了，自动跳过这个音符
        followPos++;
        _recPlayState.followPos = followPos;
      } else {
        break;
      }
    }
    
    // 只显示当前要弹的音符（用户按了之后会立刻消失）
    if (followPos < followNotes.length) {
      var fn = followNotes[followPos];
      
      var nInstEn = _INST_EN[fn.inst] || fn.inst;
      var allKeys = cont.querySelectorAll('[data-note="' + fn.note + '"]');
      var matchKeys = Array.prototype.filter.call(allKeys, function(k) {
        var row = k.closest('.octave-row');
        if (!row) return true;
        var ri = parseInt(row.dataset.rowIdx);
        var rowInst = (typeof rowInstMap !== 'undefined' && rowInstMap[ri]) || null;
        return !rowInst || rowInst === nInstEn;
      });
      var keys = matchKeys.length ? matchKeys : allKeys;
      keys.forEach(function(key) {
        var kr = key.getBoundingClientRect();
        var kx = kr.left, ky = kr.top, kw = kr.width, kh = kr.height;
        if (kw <= 0 || kh <= 0) return;
        if (kr.bottom < 0 || kr.top > vh || kr.right < 0 || kr.left > vw) return;
        var centerX = kx + kw / 2;
        var centerY = ky + kh / 2;
        var ringCanvas = document.getElementById('_recRingCanvas');
        if (ringCanvas) ringCanvas.style.display = 'none';
        var elAtPoint = document.elementFromPoint(centerX, centerY);
        if (ringCanvas) ringCanvas.style.display = '';
        if (elAtPoint && !key.contains(elAtPoint) && !elAtPoint.contains(key) && elAtPoint !== key) return;

        // 根据音符确定音阶颜色（红橙黄绿青蓝紫）
        var noteStr = fn.note ? ((typeof fn.note === 'string') ? fn.note : String(fn.note)) : 'C';
        var noteName = noteStr.replace(/[0-9]/g, '');
        var scaleColors = {
          'C': { r: 255, g: 100, b: 100 },   // 1 Do - 红
          'D': { r: 255, g: 165, b: 80 },    // 2 Re - 橙
          'E': { r: 255, g: 220, b: 80 },    // 3 Mi - 黄
          'F': { r: 100, g: 220, b: 100 },   // 4 Fa - 绿
          'G': { r: 80, g: 220, b: 200 },    // 5 Sol - 青
          'A': { r: 100, g: 150, b: 255 },   // 6 La - 蓝
          'B': { r: 180, g: 120, b: 255 }    // 7 Si - 紫
        };
        var color = scaleColors[noteName] || scaleColors['C'];

        // 跟弹模式下：只显示当前要弹的音符，透明度为1
        var alpha = 1;

        // 始终贴着琴键边缘的圆角矩形
        var rectX = kx;
        var rectY = ky;
        var rectW = kw;
        var rectH = kh;
        var rectRadius = Math.min(6, kh * 0.15);

        // 画圆角矩形提示（单层，浅色）
        _ringCtx.beginPath();
        _ringCtx.roundRect
          ? _ringCtx.roundRect(rectX, rectY, rectW, rectH, rectRadius)
          : _ringCtx.rect(rectX, rectY, rectW, rectH);
        _ringCtx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.7) + ')';
        _ringCtx.lineWidth = 2;
        _ringCtx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.5) + ')';
        _ringCtx.shadowBlur = 8;
        _ringCtx.stroke();
        _ringCtx.shadowBlur = 0;
      });
    }
    return;
  }

  if (_recPlayState.paused) return;

  var elapsed = (performance.now() - _recPlayState.startTime) * _recPlayState.speed;

  _recPlayState.tracks.forEach(function(track, ti) {
    var melodyId = track.melodyId || (ti === 0 ? 'main' : 'accomp');
    var melody = window._melodyList ? window._melodyList.find(function(m) { return m.id === melodyId; }) : null;
    if (melody && melody.showNotes === false) return;

    track.notes.forEach(function(n) {
      var ahead = n.atMs - elapsed;
      if (ahead < 0 || ahead > 500) return;
      var prog = 1 - (ahead / 500); // 0=far away, 1=exactly now

      // Show ring only on keys in rows matching this note's instrument
      var nInstEn = _INST_EN[n.inst] || n.inst;
      var allKeys = cont.querySelectorAll('[data-note="' + n.note + '"]');
      // Filter: prefer rows whose rowInstMap matches; fall back to all visible if none match
      var matchKeys = Array.prototype.filter.call(allKeys, function(k) {
        var row = k.closest('.octave-row');
        if (!row) return true;
        var ri = parseInt(row.dataset.rowIdx);
        var rowInst = (typeof rowInstMap !== 'undefined' && rowInstMap[ri]) || null;
        return !rowInst || rowInst === nInstEn;
      });
      var keys = matchKeys.length ? matchKeys : allKeys;
      keys.forEach(function(key) {
        var kr = key.getBoundingClientRect();
        var kx = kr.left, ky = kr.top, kw = kr.width, kh = kr.height;
        if (kw <= 0 || kh <= 0) return;
        // Skip keys scrolled completely out of view
        if (kr.bottom < 0 || kr.top > vh || kr.right < 0 || kr.left > vw) return;
        // Check if key is obscured by other elements (e.g., modal overlay, instrument bar)
        // Temporarily hide the ring canvas to check what's underneath
        var centerX = kx + kw / 2;
        var centerY = ky + kh / 2;
        var ringCanvas = document.getElementById('_recRingCanvas');
        if (ringCanvas) ringCanvas.style.display = 'none';
        var elAtPoint = document.elementFromPoint(centerX, centerY);
        if (ringCanvas) ringCanvas.style.display = '';
        if (elAtPoint && !key.contains(elAtPoint) && !elAtPoint.contains(key) && elAtPoint !== key) {
          // Key is obscured, skip drawing ring
          return;
        }

        // 琴键提示：始终贴着琴键边缘，只有透明度变化
        // prog=0~0.3：淡入，透明度从0到1
        // prog=0.3~0.7：保持，透明度为1
        // prog=0.7~1：淡出，透明度从1到0

        // 根据音符确定音阶颜色（红橙黄绿青蓝紫）
        var noteStr = n.note ? ((typeof n.note === 'string') ? n.note : String(n.note)) : 'C';
        var noteName = noteStr.replace(/[0-9]/g, '');
        var scaleColors = {
          'C': { r: 255, g: 100, b: 100 },   // 1 Do - 红
          'D': { r: 255, g: 165, b: 80 },    // 2 Re - 橙
          'E': { r: 255, g: 220, b: 80 },    // 3 Mi - 黄
          'F': { r: 100, g: 220, b: 100 },   // 4 Fa - 绿
          'G': { r: 80, g: 220, b: 200 },    // 5 Sol - 青
          'A': { r: 100, g: 150, b: 255 },   // 6 La - 蓝
          'B': { r: 180, g: 120, b: 255 }    // 7 Si - 紫
        };
        var color = scaleColors[noteName] || scaleColors['C'];

        // 计算透明度：淡入 -> 保持 -> 淡出
        var alpha;
        if (prog < 0.3) {
          // 淡入：0 -> 1
          alpha = prog / 0.3;
        } else if (prog < 0.7) {
          // 保持：1
          alpha = 1;
        } else {
          // 淡出：1 -> 0
          alpha = 1 - (prog - 0.7) / 0.3;
        }

        // 始终贴着琴键边缘的圆角矩形
        var rectX = kx;
        var rectY = ky;
        var rectW = kw;
        var rectH = kh;
        var rectRadius = Math.min(6, kh * 0.15);

        // 画圆角矩形提示（单层，浅色）
        _ringCtx.beginPath();
        _ringCtx.roundRect
          ? _ringCtx.roundRect(rectX, rectY, rectW, rectH, rectRadius)
          : _ringCtx.rect(rectX, rectY, rectW, rectH);
        _ringCtx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.7) + ')';
        _ringCtx.lineWidth = 2;
        _ringCtx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.5) + ')';
        _ringCtx.shadowBlur = 8;
        _ringCtx.stroke();
        _ringCtx.shadowBlur = 0;
      });
    });
  });
  _ringCtx.globalAlpha = 1;
  _ringCtx.shadowBlur = 0;
}

var _jianpuRingRAF = null;

function _startJianpuRingLoop() {
  if (_jianpuRingRAF) return;
  _ensureRingCanvas();
  function loop() {
    _drawJianpuRings();
    _jianpuRingRAF = requestAnimationFrame(loop);
  }
  _jianpuRingRAF = requestAnimationFrame(loop);
}

function _stopJianpuRingLoop() {
  cancelAnimationFrame(_jianpuRingRAF);
  _jianpuRingRAF = null;
  if (_ringCanvas && _ringCtx) {
    _ringCtx.clearRect(0, 0, _ringCanvas.width, _ringCanvas.height);
  }
}

function _drawJianpuRings() {
  if (!_ringCanvas || !_ringCtx || !currentSong || !keyHintEnabled || !isScrolling) { _stopJianpuRingLoop(); return; }
  // 全屏模式下琴键被隐藏，跳过绘制避免性能问题
  if (isScoreFullscreen) { _stopJianpuRingLoop(); return; }
  var cont = document.getElementById('container');
  if (!cont) return;

  var vw = document.documentElement.clientWidth  || window.innerWidth;
  var vh = document.documentElement.clientHeight || window.innerHeight;
  if (_ringCanvas.width !== vw)  _ringCanvas.width  = vw;
  if (_ringCanvas.height !== vh) _ringCanvas.height = vh;
  _ringCtx.clearRect(0, 0, vw, vh);

  var notes = currentSong.autoNotes;
  if (!notes || notes.length === 0) return;

  for (var i = 0; i < notes.length; i++) {
    var n = notes[i];
    var ahead = n.startTime - currentPlayTime;
    if (ahead < 0 || ahead > 500) continue;
    var prog = 1 - (ahead / 500);

    if (n.n === "R") continue;

    var allKeys = cont.querySelectorAll('[data-note="' + n.n + '"]');
    var visibleKeys = Array.prototype.filter.call(allKeys, function(k) {
      var kr = k.getBoundingClientRect();
      return kr.width > 0 && kr.height > 0 && kr.bottom > 0 && kr.top < vh && kr.right > 0 && kr.left < vw;
    });

    visibleKeys.forEach(function(key) {
      var kr = key.getBoundingClientRect();
      var kx = kr.left, ky = kr.top, kw = kr.width, kh = kr.height;
      if (kw <= 0 || kh <= 0) return;
      // Check if key is obscured by other elements (e.g., modal overlay, instrument bar)
      // Temporarily hide the ring canvas to check what's underneath
      var centerX = kx + kw / 2;
      var centerY = ky + kh / 2;
      var ringCanvas = document.getElementById('_recRingCanvas');
      if (ringCanvas) ringCanvas.style.display = 'none';
      var elAtPoint = document.elementFromPoint(centerX, centerY);
      if (ringCanvas) ringCanvas.style.display = '';
      if (elAtPoint && !key.contains(elAtPoint) && !elAtPoint.contains(key) && elAtPoint !== key) {
        // Key is obscured, skip drawing ring
        return;
      }

      // 琴键提示：始终贴着琴键边缘，只有透明度变化
      // prog=0~0.3：淡入，透明度从0到1
      // prog=0.3~0.7：保持，透明度为1
      // prog=0.7~1：淡出，透明度从1到0

      // 根据音符确定音阶颜色（红橙黄绿青蓝紫）
      var noteName = n.n ? n.n.replace(/[0-9]/g, '') : 'C';
      var scaleColors = {
        'C': { r: 255, g: 100, b: 100 },   // 1 Do - 红
        'D': { r: 255, g: 165, b: 80 },    // 2 Re - 橙
        'E': { r: 255, g: 220, b: 80 },    // 3 Mi - 黄
        'F': { r: 100, g: 220, b: 100 },   // 4 Fa - 绿
        'G': { r: 80, g: 220, b: 200 },    // 5 Sol - 青
        'A': { r: 100, g: 150, b: 255 },   // 6 La - 蓝
        'B': { r: 180, g: 120, b: 255 }    // 7 Si - 紫
      };
      var color = scaleColors[noteName] || scaleColors['C'];

      // 计算透明度：淡入 -> 保持 -> 淡出
      var alpha;
      if (prog < 0.3) {
        // 淡入：0 -> 1
        alpha = prog / 0.3;
      } else if (prog < 0.7) {
        // 保持：1
        alpha = 1;
      } else {
        // 淡出：1 -> 0
        alpha = 1 - (prog - 0.7) / 0.3;
      }

      // 始终贴着琴键边缘的圆角矩形
      var rectX = kx;
      var rectY = ky;
      var rectW = kw;
      var rectH = kh;
      var rectRadius = Math.min(6, kh * 0.15);

      // 画圆角矩形提示（单层，浅色）
      _ringCtx.beginPath();
      _ringCtx.roundRect
        ? _ringCtx.roundRect(rectX, rectY, rectW, rectH, rectRadius)
        : _ringCtx.rect(rectX, rectY, rectW, rectH);
      _ringCtx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.7) + ')';
      _ringCtx.lineWidth = 2;
      _ringCtx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.5) + ')';
      _ringCtx.shadowBlur = 8;
      _ringCtx.stroke();
      _ringCtx.shadowBlur = 0;
    });
  }
  _ringCtx.globalAlpha = 1;
  _ringCtx.shadowBlur = 0;
}

// ── Main draw function ───────────────────────────────────────────────
function drawRecordScore(elapsedMs, nowPerf) {
  if (!ctx || !canvas || !_recPlayState) return false;
  ctx.globalAlpha = 1.0;
  var h          = canvas.height;
  var w          = canvas.width;
  var LANE_COUNT = 7;
  
  // Dynamic scaling based on current height
  var scale = h / (_recPlayState.baseLaneH * 5);
  var laneH = h / LANE_COUNT;
  // 整个音符块高度（包括左边高亮条）适应轨道高度，留一点间距
  var leftBarH = laneH * 0.85;
  var blockH = Math.round(leftBarH / 1.2);
  var fs = Math.round(blockH * 0.56);
  var baseHighlightW = Math.round(scale);
  var base_bw = blockH * 1.5;
  var radius = blockH / 5;
  var halfBlockH = blockH / 2;
  var shimmerH = blockH * 0.55;
  var shimmerH2 = blockH * 0.5;

  ctx.clearRect(0, 0, w, h);

  // Check for playhead collision with notes (when playhead is vibrating)
  if (_playheadVibration.active) {
    checkPlayheadCollision();
  }

  // Draw rainbow grid background (fixed, doesn't scroll)
  drawRainbowGridBackground();

  // Playhead is drawn on the fixed background canvas (drawRainbowGridBackground).
  // We only keep scoreW / fixedX for score text positioning below.
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX = scoreW / 4;

  // Note blocks - scale positions based on current height
  ctx.font = 'bold ' + fs + 'px "PingFang SC",Arial,sans-serif';
  ctx.textBaseline = 'middle';

  _recPlayState.tracks.forEach(function(track, ti) {
    track.notes.forEach(function(n, ni) {
      // 使用 melodyId 查找旋律对象，而不是使用索引
      var noteMelodyId = n.melodyId || track.melodyId || (ti === 0 ? 'main' : 'accomp');
      var noteMelody = window._melodyList ? window._melodyList.find(function(m) { return m.id === noteMelodyId; }) : null;
      if (noteMelody && noteMelody.showNotes === false) return;
      
      var lane     = _getNoteLane(n.note);
      var x        = n._x * scale;
      var hold_bw  = (n._hold_bw || 0) * scale;
      var bw       = base_bw + hold_bw;
      var laneTop  = lane * laneH;
      var by       = laneTop + (laneH - blockH) / 2;
      var isActive = (elapsedMs >= n.atMs && elapsedMs < n.atMs + n.holdMs);
      var isPast   = elapsedMs > n.atMs + n.holdMs;
      // Follow mode: highlight recently-hit blocks
      var followKey = ti + '-' + ni;
      if (!isActive && _recPlayState.followHits && _recPlayState.followHits[followKey]) {
        var hitAge = (nowPerf || performance.now()) - _recPlayState.followHits[followKey];
        if (hitAge < 600) isActive = true; // show as active for 600ms after correct hit
      }

      // 检查是否有放大缩小动画
      var hitScaleAnim = null;
      var nowPerfTime = nowPerf || performance.now();
      _noteHitScaleFx = _noteHitScaleFx.filter(function(anim) {
        if (anim.noteKey === followKey) {
          var age = nowPerfTime - anim.t0;
          if (age < anim.duration) {
            hitScaleAnim = { age: age, duration: anim.duration };
            return true;
          }
          return false;
        }
        return true;
      });
      
      // 计算缩放比例：平滑放大到1.5倍，然后缩小回1倍
      var hitScale = 1.0;
      if (hitScaleAnim) {
        var prog = hitScaleAnim.age / hitScaleAnim.duration;
        // 使用缓动函数让动画更平滑
        var easeOut = function(t) { return 1 - Math.pow(1 - t, 3); };
        var easeIn = function(t) { return t * t * t; };
        
        if (prog < 0.4) {
          // 0-40%时间：快速放大到1.5倍
          var t = prog / 0.4;
          hitScale = 1 + 0.5 * easeOut(t);
        } else {
          // 40-100%时间：缓慢缩小回1倍
          var t = (prog - 0.4) / 0.6;
          hitScale = 1.5 - 0.5 * easeIn(t);
        }
      }

      // Block fill
      // 透明度状态：未弹奏前100%，正在弹奏100%，过了琴弦15%
      // 如果有放大缩小动画正在进行，保持不透明，等动画结束后再变暗
      var baseAlpha = (isPast && !hitScaleAnim) ? 0.15 : 1.0;
      var noteStr = (typeof n.note === 'string') ? n.note : String(n.note);
      var baseNote = noteStr.match(/^([A-G])/);
      var baseNoteName = baseNote ? baseNote[1] : 'C';
      var gradients = _NOTE_GRADIENTS[baseNoteName] || _NOTE_GRADIENTS['C'];
      
      // 弹奏中状态：亮度+30%，饱和度+20%
      // 如果有放大缩小动画正在进行，也保持高亮状态
      var activeGradients = gradients;
      if (isActive || hitScaleAnim) {
        activeGradients = gradients.map(function(col) {
          var match = col.match(/hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?/i);
          if (match) {
            var h = parseInt(match[1]);
            var s = Math.min(100, parseInt(match[2]) + 20);
            var l = Math.min(100, parseInt(match[3]) + 30);
            return 'hsla(' + h + ', ' + s + '%, ' + l + '%, 1.00)';
          }
          return col;
        });
      }
      
      var hGrd = ctx.createLinearGradient(x, by, x + bw, by);
      hGrd.addColorStop(0,    activeGradients[1]);
      hGrd.addColorStop(0.33, activeGradients[2]);
      hGrd.addColorStop(0.66, activeGradients[3]);
      hGrd.addColorStop(1,    activeGradients[4]);
      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = hGrd;
      
      // 应用放大缩小动画（整个音符块）
      if (hitScale !== 1.0) {
        ctx.save();
        var centerX = x + bw / 2;
        var centerY = by + blockH / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(hitScale, hitScale);
        ctx.translate(-centerX, -centerY);
      }
      
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, by, bw, blockH, radius);
      else ctx.rect(x, by, bw, blockH);
      ctx.fill();
      
      // Left edge highlight bar variables (使用外部定义的 leftBarH)
      var leftBarW = blockH / 3;
      var leftBarRadius = blockH / 10;
      var leftBarY = by - (leftBarH - blockH) / 2;

      // Label — clip to block, perfectly centered
      ctx.font = 'bold ' + fs + 'px "PingFang SC",Arial,sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = isActive ? 1.0 : isPast ? 0.5 : 0.92;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + leftBarW + 2, by, bw - leftBarW - 4, blockH);
      ctx.clip();
      var displayNote = (typeof n.note === 'string') ? n.note : String(n.note);
      ctx.fillText(displayNote, x + leftBarW + 4, by + halfBlockH);
      ctx.restore();
      ctx.globalAlpha = 1.0;

      // Left edge highlight bar (rounded rectangle) - draw LAST to be on top
      // 先清除该区域的音符块主体，避免层叠效果
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0; // 清除阴影，避免描边效果
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, leftBarY, leftBarW, leftBarH, leftBarRadius);
      else ctx.rect(x, leftBarY, leftBarW, leftBarH);
      ctx.fill();
      ctx.restore();

      // 然后绘制左边高亮条
      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = activeGradients[0];
      ctx.shadowBlur = 0; // 清除阴影，避免描边效果
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, leftBarY, leftBarW, leftBarH, leftBarRadius);
      else ctx.rect(x, leftBarY, leftBarW, leftBarH);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      
      // 结束放大缩小动画
      if (hitScale !== 1.0) {
        ctx.restore();
      }
    });
  });

  // Hit effects - draw AFTER blocks so they appear on top
  var nowT = nowPerf || performance.now();
  _hitFx = _hitFx.filter(function(fx) {
    var age  = nowT - fx.t0;
    var DUR  = 650;
    if (age > DUR) return false;
    if (age < 0) return true;
    var prog = age / DUR;
    var tierCol = fx.tier === 1 ? '#ffd700' : fx.tier === 2 ? '#4fc3f7' : '#4caf50'; // 后备颜色

    // Block scale animation: grow then shrink
    var scaleProg = prog < 0.25 ? (prog / 0.25) : (1 - (prog - 0.25) / 0.75);
    var scale = 1 + scaleProg * 0.7; // max scale 1.7 (增大)
    var sw = fx.bw * scale;
    var sh = fx.bh * scale;
    var sx = fx.x - (sw - fx.bw) / 2;
    var sy = fx.y - (sh - fx.bh) / 2;

    // 将音符块颜色调亮（亮度最大，饱和度稍微增加）
    var blockCol = fx.noteColor || tierCol;
    if (blockCol.charAt(0) === '#') {
      var hex = blockCol.slice(1);
      var r = parseInt(hex.substr(0, 2), 16);
      var g = parseInt(hex.substr(2, 2), 16);
      var b = parseInt(hex.substr(4, 2), 16);
      // 亮度调到最大，饱和度稍微增加
      r = Math.min(255, Math.round(r + (255 - r) * 0.7));
      g = Math.min(255, Math.round(g + (255 - g) * 0.7));
      b = Math.min(255, Math.round(b + (255 - b) * 0.7));
      blockCol = 'rgba(' + r + ',' + g + ',' + b + ', 1)';
    }

    // Draw scaled block with glow (使用音符块的高亮颜色)
    ctx.fillStyle = blockCol;
    ctx.globalAlpha = 0.5 * (1 - prog * 0.3);
    ctx.shadowColor = blockCol;
    ctx.shadowBlur = 10 * scaleProg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(sx, sy, sw, sh, 4);
    else ctx.rect(sx, sy, sw, sh);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Center fill (使用音符块的高亮颜色)
    var fa = Math.max(0, 0.5 - prog * 0.7);
    if (fa > 0) {
      ctx.fillStyle = blockCol; ctx.globalAlpha = fa;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(fx.x, fx.y, fx.bw, fx.bh, 4);
      else ctx.rect(fx.x, fx.y, fx.bw, fx.bh);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    
    return true;
  });

  // Draw playhead explosion effects (squares and ripples) - AFTER blocks so they appear on top
  var nowPerf2 = nowPerf || performance.now();
  var baseHeight = 170;
  var scaleFactor = h > 0 ? h / baseHeight : 1;
  if (scaleFactor < 0) scaleFactor = 1;
  var playheadX = scoreW / 4 - canvasOffX;
  
  _playheadExplosions = _playheadExplosions.filter(function(exp) {
    var age = nowPerf2 - exp.startTime;
    if (age > exp.duration) return false;
    if (age < 0) return true;
    var prog = age / exp.duration;
    
    var expY = exp.lane * laneH + laneH / 2;
    
    if (exp.drawRipple) {
      var rippleCenterX = playheadX;
      var rippleCenterY = expY;
      var maxRippleRadius = 60 * scaleFactor;
      
      var outerRadius = prog * maxRippleRadius;
      if (outerRadius < 0) outerRadius = 0;
      var outerAlpha = (1 - prog) * 0.6;
      ctx.save();
      ctx.globalAlpha = outerAlpha;
      ctx.strokeStyle = exp.color;
      ctx.lineWidth = 2 * scaleFactor;
      ctx.shadowColor = exp.color;
      ctx.shadowBlur = 10 * scaleFactor;
      ctx.beginPath();
      ctx.arc(rippleCenterX, rippleCenterY, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      var innerRadius = prog * maxRippleRadius * 0.6;
      if (innerRadius < 0) innerRadius = 0;
      var innerAlpha = (1 - prog) * 0.8;
      ctx.save();
      ctx.globalAlpha = innerAlpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * scaleFactor;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6 * scaleFactor;
      ctx.beginPath();
      ctx.arc(rippleCenterX, rippleCenterY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      return true;
    }
    
    var distance = prog * 50 * scaleFactor;
    var baseSize = 12 * (1 - prog * 0.6) * scaleFactor;
    var size = baseSize * (exp.sizeMultiplier || 1);
    var alpha = 1 - prog;
    
    var x = playheadX + exp.dx * distance - size / 2;
    var y = expY + exp.dy * distance - size / 2;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = exp.color;
    ctx.shadowColor = exp.color;
    ctx.shadowBlur = 8 * alpha * scaleFactor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, size, size, 2 * scaleFactor);
    else ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.restore();
    
    return true;
  });

  // Draw touch explosion effects (user triggered) - AFTER blocks so they appear on top
  _touchFx = _touchFx.filter(function(exp) {
    var age = nowPerf2 - exp.startTime;
    if (age > exp.duration) return false;
    if (age < 0) return true;
    var prog = age / exp.duration;
    
    var expY = exp.lane * laneH + laneH / 2;
    // 将屏幕坐标转换为当前canvas坐标
    var expX = (exp.screenX || scoreW / 4) - canvasOffX;
    
    if (exp.isRipple) {
      var rippleRadius = prog * 40 * scaleFactor;
      if (rippleRadius < 0) rippleRadius = 0;
      var rippleAlpha = 1 - prog;
      var brightRippleColor = exp.color;
      if (brightRippleColor.charAt(0) === '#') {
        var hex = brightRippleColor.slice(1);
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        r = Math.min(255, Math.round(r + (255 - r) * 0.6));
        g = Math.min(255, Math.round(g + (255 - g) * 0.6));
        b = Math.min(255, Math.round(b + (255 - b) * 0.6));
        brightRippleColor = 'rgba(' + r + ',' + g + ',' + b + ', 1)';
      }
      
      ctx.save();
      ctx.globalAlpha = rippleAlpha;
      ctx.strokeStyle = brightRippleColor;
      ctx.lineWidth = 2 * scaleFactor;
      ctx.shadowColor = brightRippleColor;
      ctx.shadowBlur = 6 * rippleAlpha * scaleFactor;
      ctx.beginPath();
      ctx.arc(expX, expY, rippleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      return true;
    }
    
    var distance = prog * 80 * scaleFactor;
    var baseSize = 8 * (1 - prog * 0.5) * scaleFactor;
    var size = baseSize * (exp.sizeMultiplier || 1);
    var alpha = 1 - prog;
    
    var currentRotation = (exp.rotation || 0) + prog * (exp.rotationSpeed || 0) * 50;
    
    var x = expX + exp.dx * distance;
    var y = expY + exp.dy * distance;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(currentRotation);
    ctx.fillStyle = exp.color;
    ctx.shadowColor = exp.color;
    ctx.shadowBlur = 10 * alpha * scaleFactor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-size / 2, -size / 2, size, size, 3 * scaleFactor);
    else ctx.rect(-size / 2, -size / 2, size, size);
    ctx.fill();
    ctx.restore();
    
    return true;
  });

  // Draw score and effect texts in top-right corner of visible area
  // Calculate font size with min/max limits
  var defaultScoreH = 34;
  var minFs = defaultScoreH * 1.0;
  var maxFs = laneH * 1.2;
  var scoreFs = Math.min(maxFs, Math.max(minFs, fs * 1.2));
  var effectFs = Math.min(maxFs * 1.3, Math.max(minFs * 1.3, scoreFs * 1.3));
  
  // Calculate position in canvas coordinates
  // 分数显示在滚动栏中上下居中，与右边对齐，间距为滚动栏长度的20分之1
  // 使用滚动栏的宽度（可视区域宽度），而不是canvas的宽度
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var rightMargin = scoreW / 20; // 滚动栏长度的20分之1
  // 计算分数在canvas坐标系中的位置（考虑canvas的left偏移）
  var textX = scoreW - rightMargin;
  var textY = h / 2; // 上下居中
  
  // Check if playback finished - trigger score animation
  if (_recPlayState.finished && !_recPlayState.scoreAnimStart) {
    _recPlayState.scoreAnimStart = performance.now();
    // Save the starting position for animation (right edge of scoreWrap)
    _recPlayState.scoreAnimStartX = textX;
    _recPlayState.scoreAnimStartY = textY;
  }
  
  // Score animation when finished
  var isScoreFinished = false;
  
  if (_recPlayState.scoreAnimStart) {
    var animElapsed = (nowPerf || performance.now()) - _recPlayState.scoreAnimStart;
    var animDur = 900;
    var displayDur = 2000; // Display for 2 seconds after animation
    
    // Check if finished displaying
    if (animElapsed > animDur + displayDur) {
      isScoreFinished = true;
    }
    
    // Hide effect texts during animation
    _recPlayState.effectTexts = [];
  }
  
  // Score is now drawn on the background canvas (drawRainbowGridBackground)
  // This ensures it stays fixed and visible even when the main canvas scrolls
  
  // Return whether score display is finished (for ending the playback)
  return isScoreFinished;
}

function startScrollingSync() {
  if(!currentSong) return;
  
  const notes = currentSong.autoNotes;
  const lastAn = notes[notes.length - 1];
  const isAtEnd = currentFollowIdx >= notes.length || (lastAn && currentPlayTime > lastAn.startTime + lastAn.durationMs);

  if(isAtEnd) {
    currentPlayTime = 0;
    autoIdx = -1;
    highlightNoteIdx = -1;
    currentFollowIdx = 0;
    const fixedX = scoreWrap.clientWidth / 4 || 20;
    canvasOffX = fixedX;
    canvas.style.left = canvasOffX + "px";
  }

  isFollowing = false;
  cancelAnimationFrame(animRAF);
  cancelAnimationFrame(scrollRAF);
  isScrolling = true;
  lastFrameTime = performance.now();
  isMutedTemporarily = false;
  playSpeed = 1.0;

  drawScore();
  if (keyHintEnabled) _startJianpuRingLoop();

  let lastHighlightIdx = -1;
  let lastCanvasOffX = canvasOffX;

  const { fontSize, gap } = getScoreMetrics();
  const cv = document.createElement("canvas");
  const c2 = cv.getContext("2d");
  c2.font = fontSize + "px 'PingFang SC',Arial,sans-serif";
  
  let totalW = 0;
  for(let i=0; i<tokens.length; i++) {
    const t = tokens[i];
    const scaledW = c2.measureText(t.text).width;
    const nextTok = tokens[i+1];
    if(t.text === "_" || (nextTok && nextTok.text === "_")) {
      totalW += scaledW;
    } else {
      totalW += scaledW + gap;
    }
  }
  
  const bpmBase = 85;
  const beatMs = 60000 / bpmBase;
  const estimatedDuration = Math.max(
    notes.length > 0 ? (notes[notes.length - 1].startTime + notes[notes.length - 1].durationMs + 500) : 1000,
    (totalW / 100) * beatMs * 2
  );

  function step(now) {
    if(!isScrolling) return;
    let deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    
    if(!isDraggingScore) {
      currentPlayTime += deltaTime * playSpeed;
    }
    
    let activeAn = null;
    let currentHL = -1;
    for(let i=0; i<notes.length; i++){
        if(currentPlayTime >= notes[i].startTime){
            activeAn = notes[i];
            currentHL = i;
        } else break;
    }

    let targetX = 0;
    if(activeAn && !isDraggingScore){
        highlightNoteIdx = currentHL;
        currentFollowIdx = currentHL;
        
        let scaledX = 0;
        for(let i = 0; i < activeAn.tokenIdx; i++) {
          const tok = tokens[i];
          const scaledW = c2.measureText(tok.text).width;
          const nextTok = tokens[i+1];
          if(tok.text === "_" || (nextTok && nextTok.text === "_")) {
            scaledX += scaledW;
          } else {
            scaledX += scaledW + gap;
          }
        }
        targetX = scaledX;
        
        if(autoIdx !== highlightNoteIdx){
            playAutoNote(activeAn);
            autoIdx = highlightNoteIdx;
        }
    } else if (!isDraggingScore && notes.length === 0) {
        const progress = currentPlayTime / estimatedDuration;
        targetX = Math.min(progress * totalW, totalW);
    } else if (!isDraggingScore) {
        const progress = currentPlayTime / estimatedDuration;
        if (progress > 1) {
            targetX = totalW;
        }
    }
    
    if (targetX > 0 || !isDraggingScore) {
        const fixedX = scoreWrap.clientWidth / 4 || 20;
        canvasOffX = fixedX - targetX;
        canvas.style.left = canvasOffX + "px";
    }

    if(highlightNoteIdx !== lastHighlightIdx || canvasOffX !== lastCanvasOffX) {
      drawScore();
      lastHighlightIdx = highlightNoteIdx;
      lastCanvasOffX = canvasOffX;
    }
    
    if (currentPlayTime > estimatedDuration) {
      currentFollowIdx = notes.length;
      stopAutoPlay();
      return;
    }
    scrollRAF = requestAnimationFrame(step);
  }
  scrollRAF = requestAnimationFrame(step);
}

function isKeyVisible(el) {
  if (!el || !container) return false;
  const rect = el.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  const isVertVisible = rect.top < contRect.bottom && rect.bottom > contRect.top;
  const isHorizVisible = rect.left < contRect.right && rect.right > contRect.left;
  return isVertVisible && isHorizVisible;
}

function playAutoNote(an) {
  container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
  stopNote("auto");
  if (an.n === "R") return;

  let allMatchingKeys = container.querySelectorAll(`[data-note="${an.n}"]`);
  let visibleKeys = Array.from(allMatchingKeys).filter(isKeyVisible);

  if (visibleKeys.length === 0) {
    const noteMatch = an.n.match(/^([A-G]#?)(\d)$/);
    if (noteMatch) {
      const noteName = noteMatch[1];
      const octave = parseInt(noteMatch[2]);
      for (let altOct = 3; altOct <= 5; altOct++) {
        if (altOct === octave) continue;
        const altNote = noteName + altOct;
        const altKeys = container.querySelectorAll(`[data-note="${altNote}"]`);
        const altVisible = Array.from(altKeys).filter(isKeyVisible);
        if (altVisible.length > 0) {
          allMatchingKeys = altKeys;
          visibleKeys = altVisible;
          break;
        }
      }
    }
  }

  if (visibleKeys.length > 0) {
    if (!isMuted && !isMutedTemporarily) {
      startNote("auto", an.n);
      visibleKeys.forEach(k => k.classList.add("auto-hi"));
      var holdMs = an.durationMs || 200;
      setTimeout(function() {
        visibleKeys.forEach(function(k) {
          k.classList.remove("auto-hi");
        });
      }, holdMs);
    }
  }
}

function pauseAutoPlay() {
  cancelAnimationFrame(scrollRAF);
  isScrolling = false;
  isFollowing = true;
  stopNote("auto");
  container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
  togglePlayBtnIcon(false);
  drawScore();
  _stopJianpuRingLoop();
}

function stopAutoPlay() {
  cancelAnimationFrame(scrollRAF);
  cancelAnimationFrame(animRAF);
  isScrolling = false;
  isFollowing = true; 
  autoIdx = -1;
  animNoteIdx = -1;
  container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
  stopNote("auto");
  togglePlayBtnIcon(false);
  drawScore();
  _stopJianpuRingLoop();
}

function clearAutoPlayInterval() {
  // 预留：清理定时器（当前版本使用 requestAnimationFrame，此函数保持兼容）
}

const octaveList=[
  {num:1,name:"倍低音"},{num:2,name:"低音"},
  {num:3,name:"中低音"},{num:4,name:"中音"},
  {num:5,name:"中高音"},{num:6,name:"高音"},{num:7,name:"倍高音"}
];
const whiteKeys=["C","D","E","F","G","A","B"];
const blackKeys=[{note:"C#",after:0},{note:"D#",after:1},{note:"F#",after:3},{note:"G#",after:4},{note:"A#",after:5}];
const noteMap={C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11};

function initAudio(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==="suspended") audioCtx.resume();
  
  if (typeof SimpleSampler !== 'undefined' && !SimpleSampler.getIsLoaded()) {
    console.log('[DEBUG] initAudio: loading samples...');
    SimpleSampler.setAudioContext(audioCtx);
    SimpleSampler.loadAllSamples(
      function(progress) {
        console.log('[DEBUG] Sample loading progress:', Math.round(progress * 100) + '%');
      },
      function() {
        console.log('[DEBUG] All samples loaded!');
      },
      function(error) {
        console.log('[DEBUG] Sample loading error:', error);
      }
    );
  } else {
    console.log('[DEBUG] initAudio: samples already loaded or SimpleSampler not available');
  }
}

function checkServerAndInit() {
  initAudio();
}
// 缓存频率计算值
const freqCache = new Map();
const A4 = 440;
const C4 = A4 * Math.pow(2, -9/12);

function getFreq(s){
  if (freqCache.has(s)) {
    return freqCache.get(s);
  }
  
  const n=s.replace(/\d/g,""), o=parseInt(s.match(/\d+/)[0]);
  const freq = C4 * Math.pow(2,(noteMap[n]+(o-4)*12)/12);
  
  freqCache.set(s, freq);
  return freq;
}

function startInstrumentNote(freq, autoVolume = 1, overrideInst = null){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (autoVolume <= 0) return {nodes:[], gain:null, env:null};
  
  var instName = overrideInst || currentInst;
  console.log('[DEBUG] startInstrumentNote:', instName, 'freq:', freq);
  console.log('[DEBUG] SAMPLES_DATA exists:', !!window.SAMPLES_DATA);
  if (window.SAMPLES_DATA) {
    console.log('[DEBUG] SAMPLES_DATA instruments:', Object.keys(window.SAMPLES_DATA));
    console.log('[DEBUG] drumkit in SAMPLES_DATA:', !!window.SAMPLES_DATA['drumkit']);
    if (window.SAMPLES_DATA['drumkit']) {
      console.log('[DEBUG] drumkit notes:', Object.keys(window.SAMPLES_DATA['drumkit']));
    }
  }
  
  if (typeof SimpleSampler !== 'undefined') {
    SimpleSampler.setAudioContext(audioCtx);
    console.log('[DEBUG] SimpleSampler.isLoaded:', SimpleSampler.getIsLoaded());
    var midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    var velocity = Math.round(autoVolume * 127);
    console.log('[DEBUG] Calling playNote with instName:', instName, 'midiNote:', midiNote);
    var result = SimpleSampler.playNote(instName, midiNote, velocity);
    console.log('[DEBUG] playNote result:', result ? 'HAS BUFFER' : 'NULL');
    if (result) {
      var samplerGain = audioCtx.createGain();
      samplerGain.gain.value = autoVolume;
      result.source.disconnect();
      result.source.connect(samplerGain);
      samplerGain.connect(audioCtx.destination);
      console.log('[DEBUG] Playing SAMPLE sound for', instName);
      return { nodes: [result.source], gain: samplerGain, env: samplerGain, samplerResult: result };
    }
  }
  
  console.log('[DEBUG] No sample available, using SYNTHESIS for', instName);
  const now = audioCtx.currentTime;
  const m = audioCtx.createGain();
  m.connect(audioCtx.destination);
  
  const p = toneParams[instName] || defaultToneParams[instName] || {};
  const waveType = p.waveType || 'sine';
  const attack = Math.max(0.001, p.attack || 0.01);
  const decay = Math.max(0.05, p.decay || 0.3);
  const sustain = Math.max(0, Math.min(1, p.sustain || 0.4));
  const release = Math.max(0.1, p.release || 1.0);
  const harm2 = p.harm2 || 0;
  const harm3 = p.harm3 || 0;
  const harm4 = p.harm4 || 0;
  const harm5 = p.harm5 || 0;
  const harm6 = p.harm6 || 0;
  const filterType = p.filterType || 'lowpass';
  const filterFreq = Math.max(50, p.filterFreq || 5000);
  const filterQ = Math.max(0.1, Math.min(20, p.filterQ || 0.5));
  const vibrato = p.vibrato || 0;
  const vibratoDepth = p.vibratoDepth || 0;
  const noiseLevel = p.noiseLevel || 0;
  const noiseDecay = p.noiseDecay || 0;
  const blendFactor = p.blendFactor || 0.5;
  const brightness = p.brightness !== undefined ? p.brightness : 0.5;
  
  const oscillators = [];
  const totalDur = attack + decay + release + 1;
  
  const g1 = audioCtx.createGain();
  
  const mainFilter = audioCtx.createBiquadFilter();
  const validFilterTypes = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking'];
  mainFilter.type = validFilterTypes.includes(filterType) ? filterType : 'lowpass';
  const adjustedFilterFreq = filterFreq * (0.2 + brightness * 3);
  mainFilter.frequency.value = Math.min(20000, Math.max(50, adjustedFilterFreq));
  mainFilter.Q.value = Math.max(0.1, filterQ - brightness * 0.3);
  
  if (waveType === 'noise') {
    const sampleRate = audioCtx.sampleRate;
    const duration = Math.max(0.5, release + decay);
    const bufferSize = Math.ceil(sampleRate * duration);
    let delayLength = Math.round(sampleRate / freq);
    delayLength = Math.max(1, Math.min(delayLength, bufferSize - 1));
    
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < delayLength && i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    for (let i = delayLength; i < bufferSize; i++) {
      const idx1 = i - delayLength;
      const idx2 = i - delayLength + 1;
      if (idx2 >= 0 && idx2 < i) {
        data[i] = blendFactor * (data[idx1] + data[idx2]);
      }
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    source.connect(mainFilter);
    mainFilter.connect(g1);
    
    source.start(now);
    source.stop(now + duration);
    
    oscillators.push(source);
    
    g1.gain.setValueAtTime(0.7 * autoVolume, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
  } else {
    const o1 = audioCtx.createOscillator();
    o1.type = waveType;
    o1.frequency.value = freq;
    
    o1.connect(mainFilter);
    oscillators.push(o1);
    
    if (harm2 > 0.01) {
      const o2 = audioCtx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 2;
      const g2 = audioCtx.createGain();
      g2.gain.value = harm2 * 0.8;
      o2.connect(g2);
      g2.connect(mainFilter);
      o2.start(now);
      o2.stop(now + totalDur);
      oscillators.push(o2);
    }
    
    if (harm3 > 0.01) {
      const o3 = audioCtx.createOscillator();
      o3.type = 'sine';
      o3.frequency.value = freq * 3;
      const g3 = audioCtx.createGain();
      g3.gain.value = harm3 * 0.6;
      o3.connect(g3);
      g3.connect(mainFilter);
      o3.start(now);
      o3.stop(now + totalDur);
      oscillators.push(o3);
    }
    
    if (harm4 > 0.01) {
      const o4 = audioCtx.createOscillator();
      o4.type = 'sine';
      o4.frequency.value = freq * 4;
      const g4 = audioCtx.createGain();
      g4.gain.value = harm4 * 0.4;
      o4.connect(g4);
      g4.connect(mainFilter);
      o4.start(now);
      o4.stop(now + totalDur);
      oscillators.push(o4);
    }
    
    if (harm5 > 0.01) {
      const o5 = audioCtx.createOscillator();
      o5.type = 'sine';
      o5.frequency.value = freq * 5;
      const g5 = audioCtx.createGain();
      g5.gain.value = harm5 * 0.3;
      o5.connect(g5);
      g5.connect(mainFilter);
      o5.start(now);
      o5.stop(now + totalDur);
      oscillators.push(o5);
    }
    
    if (harm6 > 0.01) {
      const o6 = audioCtx.createOscillator();
      o6.type = 'sine';
      o6.frequency.value = freq * 6;
      const g6 = audioCtx.createGain();
      g6.gain.value = harm6 * 0.2;
      o6.connect(g6);
      g6.connect(mainFilter);
      o6.start(now);
      o6.stop(now + totalDur);
      oscillators.push(o6);
    }
    
    if (vibrato > 0.1 && vibratoDepth > 0.001) {
      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = vibrato;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = freq * vibratoDepth * 2;
      lfo.connect(lfoGain);
      lfoGain.connect(o1.frequency);
      lfo.start(now);
      lfo.stop(now + totalDur);
      oscillators.push(lfo);
    }
    
    if (noiseLevel > 0.01) {
      const noiseLen = Math.floor(audioCtx.sampleRate * Math.max(0.05, noiseDecay));
      const nBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
      const nD = nBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        nD[i] = (Math.random() * 2 - 1);
      }
      const nSrc = audioCtx.createBufferSource();
      nSrc.buffer = nBuf;
      const nGain = audioCtx.createGain();
      nGain.gain.setValueAtTime(noiseLevel * 0.5 * autoVolume, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDecay);
      nSrc.connect(nGain);
      nGain.connect(g1);
      nSrc.start(now);
      oscillators.push(nSrc);
    }
    
    mainFilter.connect(g1);
    
    o1.start(now);
    o1.stop(now + totalDur);
    
    const peakVol = 0.6 * autoVolume;
    const sustainVol = peakVol * sustain;
    
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(peakVol, now + attack);
    g1.gain.linearRampToValueAtTime(sustainVol, now + attack + decay);
    g1.gain.setValueAtTime(sustainVol, now + attack + decay);
    g1.gain.exponentialRampToValueAtTime(0.001, now + attack + decay + release);
  }
  
  g1.connect(m);
  
  return { nodes: oscillators, gain: m, env: g1 };
}

// =====================================================
// 【修复2】playNoteByKey 现在可以正确访问全局 pcKeyMap
// =====================================================
function playNoteByKey(keyCode) {
  if (!keyCode) return;
  const trimmedKey = String(keyCode).trim();
  
  if (!pcKeyMap) return;
  
  // 1. 检查和弦
  if (pcKeyMap.chord && Array.isArray(pcKeyMap.chord)) {
    for (const row of pcKeyMap.chord) {
      if (!row || !row.notes || !row.keys) continue;
      if (row.keys.some(k => k && k.trim() === trimmedKey)) {
        triggerChordDirect(keyCode, row.notes);
        return;
      }
    }
  }

  // 2. 检查自定义固定音
  if (pcKeyMap.extra && Array.isArray(pcKeyMap.extra)) {
    for (const row of pcKeyMap.extra) {
      if (!row || !row.note || !row.keys) continue;
      if (row.keys.some(k => k && k.trim() === trimmedKey)) {
        triggerNoteDirect(keyCode, row.note);
        return;
      }
    }
  }
}

function triggerNoteDirect(keyCode, noteStr) {
  initAudio();
  const keyId = "vk_" + keyCode;
  startNote(keyId, noteStr);
  container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
    if (isKeyVisible(k)) k.classList.add("active");
  });
  setTimeout(() => {
    stopNote(keyId);
    container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
      k.classList.remove("active");
    });
  }, 100);
}

function triggerChordDirect(keyCode, notes) {
  initAudio();
  const keyId = "vk_" + keyCode;
  // notes 可以是 [{n, delay}, ...] 或旧格式字符串数组
  notes.forEach(noteItem => {
    const noteStr = (typeof noteItem === "string") ? noteItem : noteItem.n;
    const delayMs = (typeof noteItem === "object" && noteItem.delay) ? noteItem.delay : 0;
    const doPlay = () => {
      startNote(keyId + "_" + noteStr, noteStr);
      container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
        if (isKeyVisible(k)) k.classList.add("active");
      });
      setTimeout(() => {
        stopNote(keyId + "_" + noteStr);
        container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
          k.classList.remove("active");
        });
      }, 300);
    };
    if (delayMs > 0) setTimeout(doPlay, delayMs);
    else doPlay();
  });
}

function startNote(tid, ns, overrideInst, noteVolume){
  if (isLayoutMode) return;
  initAudio(); 
  const freq = getFreq(ns);
  stopNote(tid);
  const isAutoOrRec = (tid === "auto") || String(tid).startsWith("rec_");
  var volume = isAutoOrRec ? (isMuted || isMutedTemporarily ? 0 : 1) : 1;
  
  if (noteVolume !== undefined && noteVolume !== null) {
    volume = volume * (noteVolume / 100);
  }
  
  console.log('startNote:', {tid, ns, overrideInst, currentInst, volume, noteVolume});
  
  if (volume > 0) {
    const prevInst = currentInst;
    if (overrideInst) currentInst = overrideInst;
    console.log('设置currentInst:', currentInst);
    activeNodes.set(tid, startInstrumentNote(freq, volume));
    if (overrideInst) currentInst = prevInst;
  }

  // 跟弹模式：只有用户手动弹奏才触发，排除自动播放(auto)和测试音(test)和录制播放(rec_)
  const isUserPlay = (tid !== "auto" && tid !== "test" && !String(tid).startsWith("rec_"));
  if(isUserPlay && window._REC && window._REC.active) window._REC.onPress(tid, ns, overrideInst || currentInst, 80);
  if(isUserPlay && window._checkRecHit) window._checkRecHit(ns, overrideInst || currentInst, performance.now());
  // 用户弹奏时检查琴弦位置是否有音符块经过，触发碰触特效
  if(isUserPlay && typeof checkTouchCollision === 'function') checkTouchCollision();
  // 用户弹奏时触发琴弦振动效果
  if(isUserPlay && typeof triggerPlayheadVibration === 'function') triggerPlayheadVibration(3);
  // 跟弹模式下启动特效绘制循环
  if(isUserPlay && typeof _recPlayState !== "undefined" && _recPlayState && _recPlayState.paused) {
    if(typeof _startPausedVibrationLoop === 'function') _startPausedVibrationLoop();
  }
  // ── Rec follow mode: user plays correct note to advance rec score ──
  if (isUserPlay && typeof _recPlayState !== "undefined" && _recPlayState &&
      _recPlayState.paused && _recPlayState.followMode && _recPlayState.followNotes) {
    var fn = _recPlayState.followNotes;
    var fp = _recPlayState.followPos;
    if (fp < fn.length) {
      var expected = fn[fp];
      if (expected.note === ns) {
        // Correct note: mark it scheduled, advance elapsed to its atMs, scroll canvas
        var key = expected.ti + '-' + expected.ni;
        _recPlayState.scheduled[key] = true;
        // Highlight this block in follow mode
        if (!_recPlayState.followHits) _recPlayState.followHits = {};
        _recPlayState.followHits[key] = performance.now();
        
        // Add note hit scale animation for follow mode
        _noteHitScaleFx.push({
          noteKey: key,
          t0: performance.now(),
          duration: 600
        });
        
        // Add lane gradient effect for follow mode
        var h = canvas ? canvas.height : 170;
        var scale = h / (_recPlayState.baseLaneH * 5);
        var lane = _getNoteLane(expected.note);
        var noteCol = _noteOctColor(expected.note);
        _laneGradientFx.push({
          lane: lane,
          color: noteCol,
          t0: performance.now()
        });
        
        // Add hit effect (block highlight with outline) for follow mode
        // 注释掉_hitFx特效，避免音符块发红光
        // var bh = Math.round(_recPlayState.baseBlockH * scale);
        // var base_bw = bh * 1.5;
        // // Get the full note object from tracks to access _x and _hold_bw
        // var fullNote = _recPlayState.tracks[expected.ti].notes[expected.ni];
        // var hold_bw = (fullNote._hold_bw || 0) * scale;
        // var bw = base_bw + hold_bw;
        // var laneH = h / 5;
        // var x = fullNote._x * scale;
        // var y = lane * laneH + (laneH - bh) / 2;
        // var noteCol = _noteOctColor(expected.note); // 音符块的颜色
        // _hitFx.push({ x:x, y:y, bw:bw, bh:bh, tier:1, noteColor:noteCol, t0:performance.now() });
        
        // Update pausedElapsed to this note's time so display advances
        _recPlayState.pausedElapsed = expected.atMs + (expected.holdMs || 0);
        // Update startTime so if user resumes, playback continues from here
        _recPlayState.startTime = performance.now() - _recPlayState.pausedElapsed / _recPlayState.speed;
        _recPlayState.pausedAt  = performance.now();
        // Advance follow pointer (skip to next distinct note time)
        _recPlayState.followPos = fp + 1;
        
        // 跳过隐藏的音符
        while (_recPlayState.followPos < _recPlayState.followNotes.length) {
          var nextFn = _recPlayState.followNotes[_recPlayState.followPos];
          var nextMelodyId = nextFn.melodyId || (nextFn.ti === 0 ? 'main' : 'accomp');
          var nextMelody = window._melodyList ? window._melodyList.find(function(m) { return m.id === nextMelodyId; }) : null;
          if (nextMelody && nextMelody.showNotes === false) {
            _recPlayState.followPos++;
          } else {
            break;
          }
        }
        
        // Scroll canvas to show this note at playhead
        var scoreW2 = scoreWrap ? scoreWrap.clientWidth : 300;
        var fixedX2 = scoreW2 / 4;
        var currentH2 = scoreWrap ? scoreWrap.offsetHeight : 170;
        var scale2 = currentH2 / (_recPlayState.baseLaneH * 5);
        var nowX2 = _recPlayState.pausedElapsed * 0.18 * _VISUAL_SPEED_MULT * scale2;
        canvasOffX = fixedX2 - nowX2;
        if (canvas) canvas.style.left = canvasOffX + 'px';
        // Play the note sound
        var instEn2 = (typeof _INST_EN !== 'undefined' && _INST_EN[expected.inst]) || expected.inst;
        startNote('rec_' + key, expected.note, instEn2);
        (function(k2, hms2, sp2) {
          setTimeout(function() { try { stopNote('rec_' + k2); } catch(e) {} }, hms2 / sp2);
        })(key, expected.holdMs || 200, _recPlayState.speed);
        // Redraw score at new position
        drawRecordScore(_recPlayState.pausedElapsed, performance.now());
      }
    }
  }

  if(isUserPlay && isFollowing && currentSong && currentSong.autoNotes && (typeof _recPlayState === "undefined" || !_recPlayState)) {
    const notes = currentSong.autoNotes;
    // currentFollowIdx 指向当前需要弹的音符，只有弹对才推进
    if(currentFollowIdx < notes.length) {
      const expected = notes[currentFollowIdx];
      // 弹对了：推进到下一个音符并滚动
      if(expected.n === ns) {
        const matchedIdx = currentFollowIdx;
        highlightNoteIdx = matchedIdx;
        currentFollowIdx = matchedIdx + 1;

        // 跳过紧接着的休止符(0)，让指针停在下一个真实音符上
        while(currentFollowIdx < notes.length && notes[currentFollowIdx].n === "R") {
          currentFollowIdx++;
        }

        // 滚动乐谱到当前音符
        const matchedNote = notes[matchedIdx];
        if(matchedNote && matchedNote.tokenIdx !== undefined) {
          const { fontSize, gap } = getScoreMetrics();
          const cv = document.createElement("canvas");
          const c2 = cv.getContext("2d");
          c2.font = fontSize + "px 'PingFang SC',Arial,sans-serif";
          
          let scaledX = 0;
          for(let i = 0; i < matchedNote.tokenIdx; i++) {
            const tok = tokens[i];
            const scaledW = c2.measureText(tok.text).width;
            const nextTok = tokens[i+1];
            if(tok.text === "_" || (nextTok && nextTok.text === "_")) {
              scaledX += scaledW;
            } else {
              scaledX += scaledW + gap;
            }
          }
          
          const targetX = scaledX;
          const fixedX = scoreWrap.clientWidth / 4 || 20;
          canvasOffX = fixedX - targetX;
          canvas.style.left = canvasOffX + "px";
          if(matchedNote.startTime !== undefined) {
            currentPlayTime = matchedNote.startTime;
          }
        }

        // 音符动画
        animNoteIdx = matchedIdx;
        noteAnimStartTime = performance.now();
        cancelAnimationFrame(animRAF);
        function runAnim() {
          drawScore();
          if(performance.now() - noteAnimStartTime < ANIM_DURATION) {
            animRAF = requestAnimationFrame(runAnim);
          }
        }
        runAnim();

        // 检查是否弹完
        if(currentFollowIdx >= notes.length) {
          isFollowing = false;
          highlightNoteIdx = -1;
        }
        drawScore();
      }
      // 弹错了：不滚动，不推进，仅发音（什么都不做）
    }
  }
}

function stopNote(tid){
  const d=activeNodes.get(tid); if(!d) return;
  const now=audioCtx.currentTime;
  
  if (d.samplerResult) {
    // 采样声音：根据释放时间延迟停止
    var release = 1.5;
    if (toneParams[currentInst] && toneParams[currentInst].release) {
      release = toneParams[currentInst].release;
    }
    // 使用 fadeOut 方式平滑停止，而不是立即 stop()
    if (d.gain && d.gain.gain) {
      try {
        d.gain.gain.cancelScheduledValues(audioCtx.currentTime);
        d.gain.gain.setValueAtTime(d.gain.gain.value, audioCtx.currentTime);
        d.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + release);
      } catch(e) {}
    }
    try {
      var nodes = d.nodes || [d.samplerResult.source];
      nodes.forEach(n => {
        try {
          n.stop(audioCtx.currentTime + release + 0.1);
        } catch(e) {}
      });
    } catch(e) {}
    activeNodes.delete(tid);
    if(tid!=="auto"&&tid!=="test"&&window._REC&&window._REC.active) window._REC.onRelease(tid);
    return;
  }
  
  try{
    d.env.gain.cancelScheduledValues(now);
    d.env.gain.setValueAtTime(d.env.gain.value, now);

    // 所有乐器都使用音色调整中的释放值
    var release = 1.5;
    if (toneParams[currentInst] && toneParams[currentInst].release) {
      release = toneParams[currentInst].release;
    }
    release = Math.max(0.1, release);

    d.env.gain.exponentialRampToValueAtTime(0.001, now + release);
    d.nodes.forEach(n=>{try{n.stop(now + release + 0.1);}catch(e){}});
  }catch(e){}
  activeNodes.delete(tid);
  if(tid!=="auto"&&tid!=="test"&&window._REC&&window._REC.active) window._REC.onRelease(tid);
}

// 获取某个琴键元素所在行的乐器配置
function getKeyRowInst(keyEl) {
  if (!keyEl) return null;
  const row = keyEl.closest('.octave-row');
  if (!row) return null;
  const rowIdx = parseInt(row.dataset.rowIdx);
  if (isNaN(rowIdx)) return null;
  return rowInstMap[rowIdx] || null;
}

function isKeyRowDynamic(keyEl) {
  if (!keyEl) return true;
  const row = keyEl.closest('.octave-row');
  if (!row) return true;
  const rowIdx = parseInt(row.dataset.rowIdx);
  if (isNaN(rowIdx)) return true;
  return rowDynamicMap[rowIdx] !== false;
}

function adjustNoteByOctave(noteStr, octaveOffset) {
  const match = noteStr.match(/^([A-G]#?)(\d)$/);
  if (!match) return noteStr;
  const baseNote = match[1];
  const currentOctave = parseInt(match[2]);
  // 不限制音域范围，允许超出1-7
  const newOctave = currentOctave + octaveOffset;
  return baseNote + newOctave;
}

// 只高亮/取消高亮 同行的同音符键（避免跨行干扰）
function highlightSameRowNote(keyEl, noteStr, add) {
  if (!keyEl) return;
  const row = keyEl.closest('.octave-row');
  if (!row) {
    // 找不到行就退回全局
    if (add) {
      container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => { if (isKeyVisible(k)) k.classList.add("active"); });
    } else {
      container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => k.classList.remove("active"));
    }
    return;
  }
  // 只在该行内操作
  row.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
    if (add) { if (isKeyVisible(k)) k.classList.add("active"); }
    else k.classList.remove("active");
  });
}



var _INST_ZH_MAP = {
  piano:'\u94a2\u7434',guitar:'\u5409\u4ed6',violin:'\u5c0f\u63d0\u7434',cello:'\u5927\u63d0\u7434',
  xiao:'\u7b2d',dizi:'\u7b1b\u5b50',guzheng:'\u53e4\u7b5d',erhu:'\u4e8c\u80e1',
  pipa:'\u7435\u7436',drum:'\u9f13',drumkit:'\u67b6\u5b50\u9f13',bell:'\u949f\u58f0',
  suona:'\u5520\u5443',bass:'\u8d1d\u65af',saxophone:'\u8428\u514b\u65af'
};

// Note name -> octave number for rainbow color
function _noteToOctave(note) {
  var m = note.match(/(\d)/);
  return m ? parseInt(m[1]) : 4;
}
// Rainbow 7 colors by octave 1-7 (low->high: violet->red)
var _RAINBOW = [
  '#9b59b6', // 1 - violet
  '#3498db', // 2 - blue
  '#1abc9c', // 3 - teal
  '#2ecc71', // 4 - green
  '#f1c40f', // 5 - yellow
  '#e67e22', // 6 - orange
  '#e74c3c'  // 7 - red
];
function _noteColor(note) {
  var oct = _noteToOctave(note);
  return _RAINBOW[Math.max(0, Math.min(6, oct - 1))];
}

// ====================================================================
//  Recording system
// ====================================================================
(function() {
  var customRecordings = [];
  try { customRecordings = JSON.parse(localStorage.getItem('pianoRecordings')||'[]'); } catch(e){}
  function saveRecs(){ try{ localStorage.setItem('pianoRecordings', JSON.stringify(customRecordings)); }catch(e){} }

  window._REC = {
    active: false,
    events: [],
    pending: {},
    startAt: 0,
    onPress: function(tid, note, instEn, volume) {
      if (this.pending[tid]) return;
      this.pending[tid] = {
        note: note,
        instEn: instEn,
        instZh: _INST_ZH_MAP[instEn] || instEn,
        pressAt: performance.now(),
        volume: volume || 100
      };
    },
    onRelease: function(tid) {
      var p = this.pending[tid];
      if (!p) return;
      var now = performance.now();
      this.events.push({
        note:   p.note,
        instEn: p.instEn,
        instZh: p.instZh,
        holdMs: Math.max(1, Math.round(now - p.pressAt)),
        atMs:   Math.round(p.pressAt - this.startAt),
        volume: p.volume || 100
      });
      delete this.pending[tid];
    }
  };

  function eventsToTrack(events) {
    var sorted = events.slice().sort(function(a,b){ return a.atMs - b.atMs; });
    return sorted.map(function(e) {
      return e.instZh + '|' + e.note + '|' + (e.volume || 100) + '|' + e.holdMs + 'ms|' + e.atMs + 'ms';
    }).join('_');
  }

  // ── Render record list (same style as song-item) ──────────────────
  function renderRecList() {
    var list = document.getElementById('recordList');
    if (!list) return;
    list.innerHTML = '';
    // "无" 选项
    var noneEl = document.createElement('div');
    noneEl.className = 'song-item';
    noneEl.style.minHeight = 'auto';
    noneEl.style.padding = '10px 16px';
    noneEl.innerHTML = '<div class="song-info" style="padding:0;"><div class="song-name">无</div></div>';
    noneEl.onclick = function() {
      if (typeof stopRecordPlay === 'function') stopRecordPlay();
      if (typeof _stopRingLoop === 'function') _stopRingLoop();
      document.getElementById('modalOverlay').classList.remove('show');
    };
    list.appendChild(noneEl);
    if (!customRecordings.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'color:#555;font-size:13px;text-align:center;padding:20px 0;';
      empty.textContent = '还没有录制记录';
      list.appendChild(empty);
      return;
    }
    customRecordings.forEach(function(rec, idx) {
      var el = document.createElement('div');
      el.className = 'song-item';
      el.innerHTML =
        '<div class="song-info">' +
          '<div class="song-name">' + rec.name + '</div>' +
        '</div>' +
        '<div class="item-actions">' +
          '<button class="edit-opt">\u7f16\u8f91</button>' +
          '<button class="del-opt">\u5220\u9664</button>' +
        '</div>';
      // Click item body -> play immediately
      el.querySelector('.song-info').onclick = function() {
        document.getElementById('modalOverlay').classList.remove('show');
        if (typeof startRecordPlay === 'function') startRecordPlay(rec);
      };
      (function(recIdx) {
        var editBtn = el.querySelector('.edit-opt');
        if (editBtn) {
          editBtn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (e && e.preventDefault) e.preventDefault();
            document.getElementById('modalOverlay').classList.remove('show');
            openRecEdit(recIdx);
            return false;
          };
        }
      })(idx);
      (function(recIdx, recName) {
        var delBtn = el.querySelector('.del-opt');
        if (delBtn) {
          delBtn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (e && e.preventDefault) e.preventDefault();
            customRecordings.splice(recIdx, 1);
            saveRecs();
            renderRecList();
            return false;
          };
        }
      })(idx, rec.name);
      list.appendChild(el);
    });
  }
  window._renderRecList = renderRecList;

  // ── Open record edit overlay ──────────────────────────────────────
  function openRecEdit(idx, events) {
    var modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.classList.remove('show');
    }
    var overlay = document.getElementById('recEditOverlay');
    var isNew   = (idx === -1);
    document.getElementById('recEditName').value  = isNew ? '' : customRecordings[idx].name;
    document.getElementById('recEditSpeed').value = isNew ? '1' : (customRecordings[idx].speed||1);
    
    var fullText = isNew ? eventsToTrack(events||[]) : (customRecordings[idx].display||'');
    var lines = fullText.split('\n');
    var savedShowNotes = (!isNew && customRecordings[idx].showNotesList) ? customRecordings[idx].showNotesList : [true, true];
    
    _melodyList = [
      { id: 'main', name: '主旋律', text: lines[0] || '', showNotes: savedShowNotes[0] !== false },
      { id: 'accomp', name: '伴奏', text: lines[1] || '', showNotes: savedShowNotes[1] !== false }
    ];
    window._melodyList = _melodyList;
    _melodyIdCounter = 2;
    _recVisualTextTrack = 'main';
    
    var scoreTextEl = document.getElementById('recEditScoreText');
    if (scoreTextEl) scoreTextEl.value = _melodyList[0].text;
    
    _recVisualPlayTracks = { main: true, accomp: true };
    
    overlay._editIdx   = idx;
    overlay._newEvents = events || null;
    overlay._origScoreMain = _melodyList[0].text;
    overlay._origScoreAccomp = _melodyList[1] ? _melodyList[1].text : '';
    overlay._origName = document.getElementById('recEditName').value;
    overlay._origSpeed = document.getElementById('recEditSpeed').value;
    
    _recVisualNotes = [];
    _recVisualSelected = null;
    _recVisualSelectedNotes = [];
    _recVisualPlaying = false;
    _recVisualPlayTime = 0;
    _recVisualHistory = [];
    _recVisualHistoryIdx = -1;
    _recVisualClipboard = [];
    _recVisualActiveTrack = 'main';
    _recVisualTextTrack = 'main';
    
    var playBtn = document.getElementById('recVisualPlay');
    if (playBtn) playBtn.textContent = '▶ 播放';
    
    var visualBtn = document.getElementById('recVisualEditBtn');
    var textLabel = document.getElementById('recTextEditLabel');
    var textEditor = document.getElementById('recTextEditor');
    var visualEditor = document.getElementById('recVisualEditor');
    if (visualBtn) visualBtn.classList.add('active');
    if (textLabel) textLabel.classList.remove('active');
    if (textEditor) textEditor.style.display = 'none';
    if (visualEditor) visualEditor.style.display = 'flex';
    
    overlay.classList.add('show');
    initRecVisualEditor();
    loadVisualEditorSettings();
    applyVisualEditorSettings();
    parseTextToVisual();
    saveVisualHistory();
    
    var wrap = document.getElementById('recVisualCanvasWrap');
    var w = wrap.clientWidth;
    
    var hasSaved = false;
    try {
      var saved = localStorage.getItem('visualEditorSettings');
      if (saved) hasSaved = true;
    } catch(e) {}
    
    if (!hasSaved) {
      _recVisualZoom = w / _recVisualMaxTime;
      _recVisualScrollX = 0;
    }
    
    renderRecVisual();
    setTimeout(function() {
      adjustToolbarResponsive();
      updateRangeBar();
      if (typeof ensurePlayButtonWorks === 'function') {
        ensurePlayButtonWorks();
      }
    }, 300);
  }
  window._openRecEdit = openRecEdit;

  var _recVisualNotes = [];
  var _recVisualMainTrackCount = 21;
  var _recVisualAccompTrackCount = 21;
  var _recVisualDrag = null;
  var _recVisualCanvas = null;
  var _recVisualCtx = null;
  var _recVisualScale = 1;
  var _recVisualMaxTime = 10000;
  var _recVisualRegionTime = 10000;
  var _recVisualZoom = 1;
  var _recVisualScrollX = 0;
  var _recVisualScrollY = 0;
  var _recVisualStartTrack = 0;
  var _recVisualEndTrack = 14;
  var _recVisualMaxTracks = 49;
  var _recVisualSelected = null;
  var _recVisualSelectedNotes = [];
  var _recVisualDragMode = null;
  var _recVisualClipboard = [];
  var _recVisualHistory = [];
  var _recVisualHistoryIdx = -1;
  var _recVisualPlaying = false;
  var _recVisualPlayTime = 0;
  var _recVisualPlayStart = 0;
  var _recVisualPlayAnimId = null;
  var _recVisualSelectBox = null;
  var _recVisualMousePos = null;
  var _recVisualPianoScroll = null;
  var _recVisualAllKeys = []; // 保存所有琴键元素
  var _recVisualPianoContent = null; // 保存琴键容器元素
  var _isSyncingFromCanvas = false; // 防止从代码控制滚动时触发循环
  var _recVisualTrackIndexMap = {};
  var _recVisualDisplayToTrackMap = {};
  var _recVisualTrackToDisplayMap = {};
  var _recVisualTrackToNoteMap = {};
  var _recVisualNoteToTrackMap = {};
  var _recVisualBPM = 120;
  var _recVisualTimeSig = "4/4";
  var _recVisualSnapEnabled = false;
  var _recVisualTimelineDrag = false;
  var _recVisualActiveTrack = 'main';
  var _recVisualTempSelectedTrack = null;
  var _recVisualTempShowMelodies = [];
  var _recVisualShowMelodies = ['main', 'accomp'];
  var _recVisualPlayTracks = { main: true, accomp: true };
  var _recVisualTextTrack = 'main';
  var _recVisualEditorInited = false;
  var _recVisualMainSectionH = null;
  var _recVisualDividerDrag = false;
  var _recVisualDividerDragStartY = 0;
  var _recVisualDividerDragOrigH = 0;
  var _recVisualMiddleDrag = false;
  var _recVisualMiddleDragStartX = 0;
  var _recVisualMiddleDragStartY = 0;
  var _recVisualMiddleDragRAF = null;
  var _recVisualMiddleDragStartScrollX = 0;
  var _recVisualMiddleDragStartStartTrack = 0;
  var _recVisualMiddleDragStartEndTrack = 0;
  var _recVisualTwoFingerDrag = false;
  var _recVisualTwoFingerStartX = 0;
  var _recVisualTwoFingerStartY = 0;
  var _recVisualTwoFingerStartScrollX = 0;
  var _recVisualTwoFingerStartStartTrack = 0;
  var _recVisualTwoFingerStartEndTrack = 0;
  
  // 统一的琴键滚动同步函数 - 即时同步，无延迟
  function syncPianoScrollImmediate() {
    if (!_recVisualPianoScroll) return;
    
    var totalTracks = 49;
    var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
    visibleTracks = Math.max(7, Math.min(49, visibleTracks));
    
    var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
    var trackH = pianoViewH / visibleTracks;
    trackH = Math.max(12, Math.min(100, trackH));
    
    var totalContentHeight = totalTracks * trackH;
    var maxScrollTop = Math.max(0, totalContentHeight - _recVisualPianoScroll.clientHeight);
    
    var scrollRatio = 0;
    if (totalTracks > visibleTracks) {
      scrollRatio = _recVisualStartTrack / (totalTracks - visibleTracks);
    }
    scrollRatio = Math.max(0, Math.min(1, scrollRatio));
    
    var newScrollTop = scrollRatio * maxScrollTop;
    
    _isSyncingFromCanvas = true;
    _recVisualPianoScroll.scrollTop = newScrollTop;
    // 使用 RAF 而不是 setTimeout 来释放标志，确保在同一帧内完成
    requestAnimationFrame(function() {
      _isSyncingFromCanvas = false;
    });
  }
  
  var _melodyList = [
    { id: 'main', name: '主旋律', text: '', showNotes: true },
    { id: 'accomp', name: '伴奏', text: '', showNotes: true }
  ];
  window._melodyList = _melodyList;
  var _melodyIdCounter = 2;
  
  function getMelodyText(melodyId) {
    var melody = _melodyList.find(function(m) { return m.id === melodyId; });
    return melody ? melody.text : '';
  }
  
  function setMelodyText(melodyId, text) {
    var melody = _melodyList.find(function(m) { return m.id === melodyId; });
    if (melody) {
      melody.text = text;
    }
  }
  
  function getMelodyName(melodyId) {
    var melody = _melodyList.find(function(m) { return m.id === melodyId; });
    return melody ? melody.name : melodyId;
  }
  
  function getMelodyTrackIndex(melodyId) {
    var idx = _melodyList.findIndex(function(m) { return m.id === melodyId; });
    if (idx <= 0) return 0;
    return -(idx);
  }
  
  function scrollToMelodyNotes(melodyId) {
    var melodyNotes = _recVisualNotes.filter(function(n) {
      return n.melodyId === melodyId;
    });
    
    if (melodyNotes.length === 0) return;
    
    var minTime = Infinity, maxTime = -Infinity;
    var minTrack = Infinity, maxTrack = -Infinity;
    
    melodyNotes.forEach(function(n) {
      minTime = Math.min(minTime, n.timeMs);
      maxTime = Math.max(maxTime, n.timeMs + n.holdMs);
      
      var trackInfo = parseInt(n.track);
      if (isNaN(trackInfo)) trackInfo = 0;
      
      var displayIdx;
      if (trackInfo < 0) {
        displayIdx = Math.abs(trackInfo) % 49;
      } else {
        displayIdx = trackInfo;
        if (_recVisualTrackToDisplayMap[trackInfo] !== undefined) {
          displayIdx = _recVisualTrackToDisplayMap[trackInfo];
        }
      }
      
      minTrack = Math.min(minTrack, displayIdx);
      maxTrack = Math.max(maxTrack, displayIdx);
    });
    
    var wrap = document.getElementById('recVisualCanvasWrap');
    var container = document.getElementById('recVisualCanvasContainer');
    var viewW = wrap ? wrap.clientWidth : 600;
    var viewH = container ? container.clientHeight : (wrap ? wrap.clientHeight : 400);
    
    var displayTracks = _recVisualEndTrack - _recVisualStartTrack;
    displayTracks = Math.max(7, Math.min(49, displayTracks));
    var trackH = (viewH - 28) / displayTracks;
    trackH = Math.max(12, Math.min(100, trackH));
    var whiteKeyHeight = trackH;
    
    var timeRange = maxTime - minTime;
    var trackRange = maxTrack - minTrack + 1;
    
    if (timeRange > 0) {
      var targetScale = (viewW * 0.6) / timeRange;
      targetScale = Math.max(0.05, Math.min(2, targetScale));
      _recVisualScale = targetScale;
    }
    
    var centerTime = (minTime + maxTime) / 2;
    _recVisualScrollX = Math.max(0, centerTime * _recVisualScale - viewW / 2);
    
    var totalContentHeight = displayTracks * trackH;
    var maxScrollY = Math.max(0, totalContentHeight - viewH);
    
    var centerTrack = (minTrack + maxTrack) / 2;
    _recVisualScrollY = Math.max(0, Math.min(maxScrollY, centerTrack * trackH - viewH / 2));
    
    if (_recVisualPianoScroll && _recVisualPianoScroll.scrollTop !== undefined) {
      _recVisualPianoScroll.scrollTop = _recVisualScrollY;
    }
    
    updateVScrollbar();
    updateHScrollbar();
  }
  
  function renderTextTrackButtons() {
    var container = document.getElementById('textTrackBtnContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    _melodyList.forEach(function(melody) {
      var btn = document.createElement('button');
      btn.className = 'rec-text-track-btn';
      btn.dataset.track = melody.id;
      btn.textContent = melody.name;
      btn.style.cssText = 'padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;';
      
      if (_recVisualTextTrack === melody.id) {
        btn.style.background = '#0099ff';
        btn.style.border = '1px solid #0099ff';
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#222';
        btn.style.border = '1px solid #444';
        btn.style.color = '#888';
      }
      
      btn.onclick = function() {
        var scoreTextArea = document.getElementById('recEditScoreText');
        if (scoreTextArea) {
          if (_recVisualTextTrack === melody.id) return;
          setMelodyText(_recVisualTextTrack, scoreTextArea.value);
          _recVisualTextTrack = melody.id;
          scoreTextArea.value = getMelodyText(melody.id);
          renderTextTrackButtons();
        }
      };
      
      container.appendChild(btn);
    });
  }
  
  function renderMelodyListModal() {
    var container = document.getElementById('melodyListContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    _melodyList.forEach(function(melody, index) {
      var isActive = _recVisualTempSelectedTrack === melody.id;
      var isPlayEnabled = _recVisualPlayTracks[melody.id] !== false;
      var isShowNotes = melody.showNotes !== false;
      var isShowInEditor = _recVisualTempShowMelodies.indexOf(melody.id) !== -1;
      
      var card = document.createElement('div');
      card.className = 'melody-card';
      card.dataset.track = melody.id;
      
      var bgColor = isShowInEditor ? '#1a4a2a' : '#2a2a2a';
      var borderColor = isShowInEditor ? '#00cc66' : '#444';
      card.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;cursor:pointer;width:100%;box-sizing:border-box;background:' + bgColor + ';border:2px solid ' + borderColor + ';';
      
      var editDot = document.createElement('span');
      editDot.title = '点击切换编辑状态';
      editDot.style.cssText = 'width:14px;height:14px;border-radius:50%;cursor:pointer;flex-shrink:0;border:2px solid #666;background:' + (isActive ? '#00ff00' : 'transparent') + ';';
      
      editDot.onclick = function(e) {
        e.stopPropagation();
        _recVisualTempSelectedTrack = melody.id;
        renderMelodyListModal();
      };
      
      var nameSpan = document.createElement('span');
      nameSpan.textContent = melody.name;
      nameSpan.style.cssText = 'flex:1;min-width:60px;color:#aaa;font-size:14px;font-weight:' + (isActive || isShowInEditor ? 'bold' : 'normal') + ';';
      
      var showBtn = document.createElement('button');
      showBtn.className = 'melody-show-toggle';
      showBtn.dataset.track = melody.id;
      showBtn.title = '主窗口显示音符块';
      showBtn.textContent = '显';
      showBtn.style.cssText = 'padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;min-width:36px;';
      
      if (isShowNotes) {
        showBtn.style.background = '#0099ff';
        showBtn.style.color = '#fff';
        showBtn.style.border = 'none';
      } else {
        showBtn.style.background = '#222';
        showBtn.style.color = '#888';
        showBtn.style.border = '1px solid #444';
      }
      
      showBtn.onclick = (function(m) {
        return function(e) {
          e.stopPropagation();
          e.preventDefault();
          
          m.showNotes = !m.showNotes;
          
          renderMelodyListModal();
          
          setTimeout(function() {
            try {
              if (drawRecordScore && _recPlayState) {
                drawRecordScore(_recPlayState.pausedElapsed || 0, performance.now());
              }
            } catch(ex) {}
          }, 10);
        };
      })(melody);
      
      var toggleBtn = document.createElement('button');
      toggleBtn.className = 'melody-play-toggle';
      toggleBtn.dataset.track = melody.id;
      toggleBtn.title = '轨道显示/播放开关';
      toggleBtn.textContent = '轨';
      toggleBtn.style.cssText = 'padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;min-width:36px;';
      
      if (isPlayEnabled) {
        toggleBtn.style.background = '#0099ff';
        toggleBtn.style.color = '#fff';
        toggleBtn.style.border = 'none';
      } else {
        toggleBtn.style.background = '#222';
        toggleBtn.style.color = '#888';
        toggleBtn.style.border = '1px solid #444';
      }
      
      toggleBtn.onclick = (function(m) {
        return function(e) {
          e.stopPropagation();
          e.preventDefault();
          
          var current = _recVisualPlayTracks[m.id];
          _recVisualPlayTracks[m.id] = (current === false);
          
          renderMelodyListModal();
        };
      })(melody);
      
      card.appendChild(editDot);
      card.appendChild(nameSpan);
      card.appendChild(showBtn);
      card.appendChild(toggleBtn);
      
      card.onclick = function(e) {
        if (e.target.tagName === 'BUTTON') return;
        
        var idx = _recVisualTempShowMelodies.indexOf(melody.id);
        if (idx !== -1) {
          _recVisualTempShowMelodies.splice(idx, 1);
        } else {
          _recVisualTempShowMelodies.push(melody.id);
        }
        
        _recVisualShowMelodies = _recVisualTempShowMelodies.slice();
        
        renderMelodyListModal();
        renderRecVisual();
      };
      
      container.appendChild(card);
    });
  }
  
  function openMelodyControlModal() {
    var modal = document.getElementById('melodyControlModal');
    if (modal) {
      _recVisualTempSelectedTrack = _recVisualActiveTrack;
      _recVisualTempShowMelodies = _recVisualShowMelodies.slice();
      modal.style.display = 'flex';
      renderMelodyListModal();
    }
  }
  
  function closeMelodyControlModal() {
    var modal = document.getElementById('melodyControlModal');
    if (modal) {
      _recVisualTempSelectedTrack = null;
      _recVisualTempShowMelodies = [];
      modal.style.display = 'none';
    }
  }
  
  function confirmMelodySelection() {
    var scoreTextArea = document.getElementById('recEditScoreText');
    if (scoreTextArea) {
      setMelodyText(_recVisualActiveTrack, scoreTextArea.value.trim());
    }
    
    if (_recVisualTempSelectedTrack) {
      _recVisualActiveTrack = _recVisualTempSelectedTrack;
      _recVisualTextTrack = _recVisualTempSelectedTrack;
      
      if (scoreTextArea) {
        scoreTextArea.value = getMelodyText(_recVisualTempSelectedTrack);
      }
    }
    
    _recVisualShowMelodies = _recVisualTempShowMelodies.slice();
    
    renderTextTrackButtons();
    renderRecVisual();
    closeMelodyControlModal();
  }
  
  function addMelody() {
    _melodyIdCounter++;
    var newId = 'melody_' + _melodyIdCounter;
    var newName = '旋律' + (_melodyList.length + 1);
    _melodyList.push({ id: newId, name: newName, text: '', showNotes: true });
    _recVisualPlayTracks[newId] = true;
    _recVisualShowMelodies.push(newId);
    _recVisualTempShowMelodies.push(newId);
    renderMelodyListModal();
    renderTextTrackButtons();
  }
  
  function removeMelody() {
    if (_melodyList.length <= 1) {
      alert('至少需要保留一个旋律');
      return;
    }
    if (_recVisualActiveTrack === 'main') {
      alert('主旋律不能删除');
      return;
    }
    
    var idx = _melodyList.findIndex(function(m) { return m.id === _recVisualActiveTrack; });
    if (idx > -1) {
      var removedId = _recVisualActiveTrack;
      _melodyList.splice(idx, 1);
      delete _recVisualPlayTracks[removedId];
      
      var showIdx = _recVisualShowMelodies.indexOf(removedId);
      if (showIdx !== -1) {
        _recVisualShowMelodies.splice(showIdx, 1);
      }
      var tempShowIdx = _recVisualTempShowMelodies.indexOf(removedId);
      if (tempShowIdx !== -1) {
        _recVisualTempShowMelodies.splice(tempShowIdx, 1);
      }
      
      _recVisualActiveTrack = _melodyList[0].id;
      _recVisualTextTrack = _melodyList[0].id;
      
      renderMelodyListModal();
      renderTextTrackButtons();
      
      var scoreTextArea = document.getElementById('recEditScoreText');
      if (scoreTextArea) {
        scoreTextArea.value = getMelodyText(_recVisualTextTrack);
      }
      renderRecVisual();
    }
  }
  
  function saveVisualEditorSettings() {
    var settings = {
      bpm: _recVisualBPM,
      timeSig: _recVisualTimeSig,
      snapEnabled: _recVisualSnapEnabled,
      zoom: _recVisualZoom,
      scrollX: _recVisualScrollX,
      scrollY: _recVisualScrollY,
      scale: _recVisualScale,
      startTrack: _recVisualStartTrack,
      endTrack: _recVisualEndTrack,
      maxTime: _recVisualMaxTime,
      regionTime: _recVisualRegionTime,
      mainTrackCount: _recVisualMainTrackCount,
      accompTrackCount: _recVisualAccompTrackCount
    };
    try {
      localStorage.setItem('visualEditorSettings', JSON.stringify(settings));
    } catch(e) {}
  }
  
  function loadVisualEditorSettings() {
    try {
      var saved = localStorage.getItem('visualEditorSettings');
      if (saved) {
        var settings = JSON.parse(saved);
        _recVisualBPM = settings.bpm || 120;
        _recVisualTimeSig = settings.timeSig || "4/4";
        _recVisualSnapEnabled = settings.snapEnabled || false;
        _recVisualZoom = settings.zoom || 1;
        _recVisualScrollX = settings.scrollX || 0;
        _recVisualScrollY = settings.scrollY || 0;
        _recVisualScale = settings.scale || 0.2;
        _recVisualStartTrack = settings.startTrack || 0;
        _recVisualEndTrack = settings.endTrack || 14;
        _recVisualMaxTime = settings.maxTime || 10000;
        _recVisualRegionTime = settings.regionTime || 10000;
        _recVisualMainTrackCount = settings.mainTrackCount || 1;
        _recVisualAccompTrackCount = settings.accompTrackCount || 1;
      }
    } catch(e) {}
  }
  
  function applyVisualEditorSettings() {
    var bpmInput = document.getElementById('recVisualBPM');
    if (bpmInput) bpmInput.value = _recVisualBPM;
    
    var timeSigInput = document.getElementById('recVisualTimeSig');
    if (timeSigInput) timeSigInput.value = _recVisualTimeSig;
    
    var snapBtn = document.getElementById('recVisualSnap');
    if (snapBtn) {
      snapBtn.style.background = _recVisualSnapEnabled ? '#0099ff' : '#222';
      snapBtn.style.color = _recVisualSnapEnabled ? '#fff' : '#eee';
      snapBtn.style.borderColor = _recVisualSnapEnabled ? '#0099ff' : '#444';
    }
    
    var maxTimeInput = document.getElementById('recVisualMaxTimeInput');
    if (maxTimeInput) maxTimeInput.value = Math.round(_recVisualMaxTime / 1000) + 's';
    
    if (_recVisualPianoScroll && _recVisualPianoScroll.scrollTop !== undefined) {
      _recVisualPianoScroll.scrollTop = _recVisualScrollY;
    }
    
    updateVScrollbar();
    updateHScrollbar();
  }

  function getBeatDuration() {
    return 60000 / _recVisualBPM;
  }

  function snapToBeat(timeMs) {
    if (!_recVisualSnapEnabled) return timeMs;
    var beatMs = getBeatDuration();
    var snapGrid = beatMs / 8;
    return Math.round(timeMs / snapGrid) * snapGrid;
  }
  
  function snapToBeatForCreation(timeMs) {
    if (!_recVisualSnapEnabled) return timeMs;
    var beatMs = getBeatDuration();
    var snapGrid = beatMs / 2;
    return Math.round(timeMs / snapGrid) * snapGrid;
  }

  function beatsToMs(beats) {
    return Math.round(beats * getBeatDuration());
  }

  function saveVisualHistory() {
    _recVisualHistory = _recVisualHistory.slice(0, _recVisualHistoryIdx + 1);
    _recVisualHistory.push(JSON.stringify(_recVisualNotes));
    _recVisualHistoryIdx = _recVisualHistory.length - 1;
    if (_recVisualHistory.length > 50) {
      _recVisualHistory.shift();
      _recVisualHistoryIdx--;
    }
  }

  function undoVisual() {
    if (_recVisualHistoryIdx > 0) {
      _recVisualHistoryIdx--;
      _recVisualNotes = JSON.parse(_recVisualHistory[_recVisualHistoryIdx]);
      _recVisualSelected = null;
      _recVisualSelectedNotes = [];
      updatePropsPanel();
      renderRecVisual();
    }
  }

  function redoVisual() {
    if (_recVisualHistoryIdx < _recVisualHistory.length - 1) {
      _recVisualHistoryIdx++;
      _recVisualNotes = JSON.parse(_recVisualHistory[_recVisualHistoryIdx]);
      _recVisualSelected = null;
      _recVisualSelectedNotes = [];
      updatePropsPanel();
      renderRecVisual();
    }
  }

  function copyVisualNotes() {
    if (_recVisualSelectedNotes.length > 0) {
      _recVisualClipboard = _recVisualSelectedNotes.map(function(n) {
        return { inst: n.inst, note: n.note, volume: n.volume || 100, holdMs: n.holdMs, timeMs: n.timeMs, track: n.track };
      });
    } else if (_recVisualSelected) {
      _recVisualClipboard = [{ inst: _recVisualSelected.inst, note: _recVisualSelected.note, volume: _recVisualSelected.volume || 100, holdMs: _recVisualSelected.holdMs, timeMs: _recVisualSelected.timeMs, track: _recVisualSelected.track }];
    }
  }

  function pasteVisualNotes() {
    if (_recVisualClipboard.length === 0) return;
    saveVisualHistory();
    
    var padding = 0;
    var timelineH = 28;
    
    var scrollTime = _recVisualScrollX / _recVisualScale;
    var pasteTimeMs = 0;
    var pasteTrack = 0;
    
    var wrap = document.getElementById('recVisualCanvasWrap');
    if (wrap) {
      var noteAreaH = wrap.clientHeight - timelineH;
      var mainSectionH = _recVisualMainSectionH;
      var gap = 4;
      var mainSectionTop = timelineH;
      var mainSectionBottom = mainSectionTop + mainSectionH;
      var accompSectionTop = mainSectionBottom + gap;
      
      if (_recVisualMousePos) {
        var mouseY = _recVisualMousePos.y;
        pasteTimeMs = Math.round(scrollTime + (_recVisualMousePos.x - padding) / _recVisualScale);
        pasteTimeMs = Math.max(0, pasteTimeMs);
        
        if (mouseY >= mainSectionTop && mouseY < accompSectionTop) {
          pasteTrack = 0;
        } else if (mouseY >= accompSectionTop) {
          pasteTrack = -1;
        } else {
          pasteTrack = 0;
        }
      } else {
        if (_recVisualActiveTrack === 'main') {
          pasteTrack = 0;
        } else if (_recVisualActiveTrack === 'accomp') {
          pasteTrack = -1;
        } else {
          pasteTrack = 0;
        }
      }
    } else {
      if (_recVisualActiveTrack === 'main') {
        pasteTrack = 0;
      } else if (_recVisualActiveTrack === 'accomp') {
        pasteTrack = -1;
      } else {
        pasteTrack = 0;
      }
    }
    
    var minTime = Math.min.apply(null, _recVisualClipboard.map(function(n) { return n.timeMs; }));
    var minTrack = Math.min.apply(null, _recVisualClipboard.map(function(n) { return n.track; }));
    var maxTrack = Math.max.apply(null, _recVisualClipboard.map(function(n) { return n.track; }));
    var trackRange = maxTrack - minTrack;
    
    var copiedIsAccomp = minTrack < 0;
    var pastedNotes = [];
    
    var targetIsAccomp = false;
    if (_recVisualMousePos && wrap) {
      var noteAreaH = wrap.clientHeight - timelineH;
      var mainSectionH = _recVisualMainSectionH;
      var gap = 4;
      var mainSectionTop = timelineH;
      var mainSectionBottom = mainSectionTop + mainSectionH;
      var accompSectionTop = mainSectionBottom + gap;
      var mouseY = _recVisualMousePos.y;
      targetIsAccomp = (mouseY >= accompSectionTop);
    } else {
      targetIsAccomp = (_recVisualActiveTrack === 'accomp');
    }
    
    _recVisualClipboard.forEach(function(n) {
      var newTrack = n.track;
      
      var newNote = {
        inst: n.inst,
        note: n.note,
        volume: n.volume || 100,
        holdMs: n.holdMs,
        timeMs: pasteTimeMs + (n.timeMs - minTime),
        track: newTrack,
        melodyId: n.melodyId || (n.track < 0 ? 'accomp' : 'main')
      };
      _recVisualNotes.push(newNote);
      pastedNotes.push(newNote);
    });
    
    _recVisualSelected = null;
    _recVisualSelectedNotes = pastedNotes;
    renderRecVisual();
  }

  function deleteVisualNotes() {
    if (_recVisualSelectedNotes.length > 0) {
      saveVisualHistory();
      _recVisualSelectedNotes.forEach(function(n) {
        var idx = _recVisualNotes.indexOf(n);
        if (idx > -1) _recVisualNotes.splice(idx, 1);
      });
      _recVisualSelectedNotes = [];
      _recVisualSelected = null;
      updatePropsPanel();
      renderRecVisual();
    } else if (_recVisualSelected) {
      saveVisualHistory();
      var idx = _recVisualNotes.indexOf(_recVisualSelected);
      if (idx > -1) _recVisualNotes.splice(idx, 1);
      _recVisualSelected = null;
      updatePropsPanel();
      renderRecVisual();
    }
  }

  var _recVisualPressedKeys = {};
  var _recVisualUpdatingSelectedNote = false;
  var _recVisualStartAt = 0;
  var _recVisualBaseOctave = 4;
  var _recVisualHoldUpdateTimer = null;

  function updateHeldNotesHoldMs() {
    var now = performance.now();
    for (var keyNote in _recVisualPressedKeys) {
      var pressedInfo = _recVisualPressedKeys[keyNote];
      if (pressedInfo && pressedInfo.noteIndex !== undefined) {
        var holdMs = Math.max(1, Math.round(now - pressedInfo.pressedAt));
        _recVisualNotes[pressedInfo.noteIndex].holdMs = holdMs;
      }
    }
    renderRecVisual();
  }

  function handleRecVisualPianoKey(note, instZh, instEn, keyElement, trackIndex) {
    function getTrackIndexFromNote(noteStr) {
      if (_recVisualNoteToTrackMap && _recVisualNoteToTrackMap[noteStr] !== undefined) {
        return _recVisualNoteToTrackMap[noteStr];
      }
      return 0;
    }
    
    var noteKey = 'visEdit_' + note + '_' + Date.now();
    startNote(noteKey, note, instEn);
    
    var newTrack = trackIndex;
    if (newTrack === undefined || newTrack === null) {
      newTrack = getTrackIndexFromNote(note);
    }
    
    var melodyIndex = _melodyList.findIndex(function(m) { return m.id === _recVisualActiveTrack; });
    if (melodyIndex > 0) {
      newTrack = -(melodyIndex * 49 + Math.abs(newTrack));
    } else {
      newTrack = Math.abs(newTrack);
    }
    
    var newTimeMs = _recVisualPlayTime;
    if (newTimeMs < 0) newTimeMs = 0;
    
    var finalTrack = newTrack;
    
    saveVisualHistory();
    
    _recVisualNotes.push({
      inst: instZh,
      note: note,
      volume: 100,
      holdMs: 1,
      timeMs: newTimeMs,
      track: finalTrack,
      melodyId: _recVisualActiveTrack
    });
    
    var newNoteIndex = _recVisualNotes.length - 1;
    
    _recVisualPressedKeys[note] = {
      pressedAt: performance.now(),
      noteKey: noteKey,
      inst: instZh,
      keyElement: keyElement,
      noteIndex: newNoteIndex
    };
    
    if (!_recVisualHoldUpdateTimer) {
      _recVisualHoldUpdateTimer = setInterval(updateHeldNotesHoldMs, 50);
    }
    
    renderRecVisual();
  }

  function createRecVisualPiano() {
    var container = document.getElementById('recVisualPiano');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 获取琴键wrap高度作为琴键区域高度的基准
    var pianoWrap = document.getElementById('recVisualPianoWrap');
    var trackContainer = document.getElementById('recVisualCanvasContainer');
    var wrap = document.getElementById('recVisualCanvasWrap');
    
    var canvasHeight = trackContainer ? trackContainer.clientHeight : (wrap ? wrap.clientHeight : 300);
    var pianoWrapHeight = pianoWrap ? pianoWrap.clientHeight : 0;
    
    // 琴键容器高度应该等于琴键wrap高度减去28px的header
    var containerHeight = pianoWrapHeight - 28;
    if (!containerHeight || containerHeight < 100) {
      containerHeight = canvasHeight - 28; // 后备方案
    }
    
    // 设置琴键容器高度与画布音符区域一致
    container.style.height = containerHeight + 'px';
    container.style.flex = 'none';
    
    // 使用与 renderRecVisual 完全相同的高度计算逻辑
    var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
    visibleTracks = Math.max(7, Math.min(49, visibleTracks));
    // 琴键高度 = 琴键容器高度 / 可见轨道数（不是visibleTracks，而是与画布一致的计算）
    var pianoViewH = containerHeight; // 使用与画布相同的高度
    var whiteKeyHeight = pianoViewH / visibleTracks;
    whiteKeyHeight = Math.max(12, Math.min(100, whiteKeyHeight));
    var blackKeyHeight = whiteKeyHeight * 0.6;
    
    var displayOrder = [7, 6, 5, 4, 3, 2, 1];
    var reversedWhiteKeys = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
    var reversedBlackKeys = [
      {note: 'A#', after: 0},
      {note: 'G#', after: 1},
      {note: 'F#', after: 3},
      {note: 'D#', after: 4},
      {note: 'C#', after: 5}
    ];
    
    _recVisualTrackIndexMap = {};
    _recVisualDisplayToTrackMap = {};
    _recVisualTrackToDisplayMap = {};
    _recVisualTrackToNoteMap = {};
    _recVisualNoteToTrackMap = {};
    
    var noteIndex = 0;
    var displayIndex = 0;
    displayOrder.forEach(function(octNum) {
      reversedWhiteKeys.forEach(function(n) {
        var noteName = n + octNum;
        var tIdx = noteIndex;
        _recVisualTrackIndexMap[noteName] = tIdx;
        _recVisualDisplayToTrackMap[displayIndex] = tIdx;
        _recVisualTrackToDisplayMap[tIdx] = displayIndex;
        _recVisualTrackToNoteMap[noteIndex] = noteName;
        _recVisualNoteToTrackMap[noteName] = noteIndex;
        noteIndex++;
        displayIndex++;
      });
    });
    
    var outerDiv = document.createElement('div');
    outerDiv.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;';
    
    var pianoScroll = document.createElement('div');
    pianoScroll.style.cssText = 'overflow-x:hidden;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;flex:1;';
    pianoScroll.style.msOverflowStyle = 'none';
    pianoScroll.style.WebkitOverflowScrolling = 'touch';
    _recVisualPianoScroll = pianoScroll;
    
    var keyIndex = 0;
    var allKeys = [];
    
    var pianoContent = document.createElement('div');
    pianoContent.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex-shrink:0;position:relative;width:100%;';
    // 设置琴键容器总高度为49个白键的高度
    pianoContent.style.height = (49 * whiteKeyHeight) + 'px';
    
    displayOrder.forEach(function(octNum, octIdx) {
      reversedWhiteKeys.forEach(function(n, i) {
        var k = document.createElement('div');
        k.className = 'key white';
        k.dataset.note = n + octNum;
        k.dataset.trackIndex = keyIndex;
        // 使用绝对定位来确保琴键位置正确
        k.style.cssText = 'position:absolute;width:100%;height:' + whiteKeyHeight + 'px;top:' + (keyIndex * whiteKeyHeight) + 'px;left:0;display:flex;align-items:center;justify-content:center;';
        
        var label = document.createElement('span');
        label.textContent = n + octNum;
        label.style.cssText = 'font-size:10px;color:#333;user-select:none;pointer-events:none;position:absolute;right:4px;top:50%;transform:translateY(-50%);';
        k.appendChild(label);
        
        pianoContent.appendChild(k);
        allKeys.push({
          element: k,
          note: n + octNum,
          trackIndex: keyIndex,
          isBlack: false
        });
        keyIndex++;
      });
    });
    
    displayOrder.forEach(function(octNum, octIdx) {
      reversedBlackKeys.forEach(function(b) {
        var kb = document.createElement('div');
        kb.className = 'key black';
        kb.dataset.note = b.note + octNum;
        var whiteKeyPos = octIdx * 7 + b.after;
        var topPos = whiteKeyPos * whiteKeyHeight + whiteKeyHeight / 2 - blackKeyHeight / 2;
        kb.style.cssText = 'position:absolute;top:' + topPos + 'px;left:0;width:60%;height:' + blackKeyHeight + 'px;z-index:2;';
        
        pianoContent.appendChild(kb);
        allKeys.push({
          element: kb,
          note: b.note + octNum,
          trackIndex: whiteKeyPos,
          isBlack: true
        });
      });
    });
    
    pianoScroll.appendChild(pianoContent);
    
    // 保存琴键到全局变量
    _recVisualAllKeys = allKeys;
    _recVisualPianoContent = pianoContent;
    
    allKeys.forEach(function(keyInfo) {
      var keyElement = keyInfo.element;
      var note = keyInfo.note;
      var trackIndex = keyInfo.trackIndex;
      var keyNote = note;
      
      keyElement.onmousedown = function(e) {
        e.preventDefault();
        if (e.button !== 0) return;
        
        if (_recVisualPressedKeys[keyNote]) return;
        
        keyElement.classList.add('active');
        
        var pianoInstSelect = document.getElementById('recVisualPianoInst');
        var instEn = pianoInstSelect ? pianoInstSelect.value : 'piano';
        var instZh = _INST_ZH_MAP[instEn] || instEn;
        
        handleRecVisualPianoKey(keyNote, instZh, instEn, keyElement, trackIndex);
      };
      
      keyElement.onmouseup = function() { 
        releasePianoKey(keyNote);
      };
      
      keyElement.onmouseleave = function() { 
        if (_recVisualPressedKeys[keyNote]) {
          releasePianoKey(keyNote);
        }
      };
    });
    
    document.addEventListener('mouseup', function(e) {
      for (var keyNote in _recVisualPressedKeys) {
        var pressedInfo = _recVisualPressedKeys[keyNote];
        if (pressedInfo && pressedInfo.keyElement) {
          releasePianoKey(keyNote);
        }
      }
    });
    
    outerDiv.appendChild(pianoScroll);
    container.appendChild(outerDiv);
    
    var isDragging = false;
    var startY = 0;
    var startScrollTop = 0;
    var dragTimeout = null;
    
    pianoScroll.addEventListener('mousedown', function(e) {
      startY = e.pageY;
      startScrollTop = pianoScroll.scrollTop;
      
      dragTimeout = setTimeout(function() {
        isDragging = true;
        pianoScroll.style.cursor = 'grabbing';
      }, 1000);
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dy = e.pageY - startY;
      var newScrollTop = startScrollTop - dy;
      pianoScroll.scrollTop = newScrollTop;
      _recVisualScrollY = newScrollTop;
      
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      visibleTracks = Math.max(7, Math.min(49, visibleTracks));
      // 使用琴键容器的可见高度来计算轨道高度，与滚动事件一致
      var pianoViewH = pianoScroll.clientHeight;
      var trackH = pianoViewH / visibleTracks;
      trackH = Math.max(12, Math.min(100, trackH));
      
      var newStartTrack = Math.round(_recVisualScrollY / trackH);
      newStartTrack = Math.max(0, Math.min(49 - visibleTracks, newStartTrack));
      
      if (_recVisualStartTrack !== newStartTrack) {
        _recVisualStartTrack = newStartTrack;
        _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
      }
      
      renderRecVisual();
    });
    
    document.addEventListener('mouseup', function() {
      if (dragTimeout) clearTimeout(dragTimeout);
      isDragging = false;
      pianoScroll.style.cursor = 'default';
    });
    
    // 使用 RAF 合并渲染，避免频繁重绘导致闪烁
    var _scrollRenderPending = false;
    
    pianoScroll.addEventListener('scroll', function() {
      if (_isSyncingFromCanvas) return;
      
      var totalTracks = 49;
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      visibleTracks = Math.max(7, Math.min(49, visibleTracks));
      
      // 使用琴键容器的可见高度来计算轨道高度，确保与琴键同步
      var pianoViewH = pianoScroll.clientHeight;
      var trackH = pianoViewH / visibleTracks;
      trackH = Math.max(12, Math.min(100, trackH));
      
      var totalContentHeight = totalTracks * trackH;
      var maxScrollTop = Math.max(0, totalContentHeight - pianoScroll.clientHeight);
      
      var scrollRatio = maxScrollTop > 0 ? pianoScroll.scrollTop / maxScrollTop : 0;
      scrollRatio = Math.max(0, Math.min(1, scrollRatio));
      
      var maxStartTrack = totalTracks - visibleTracks;
      var newStartTrack = Math.round(scrollRatio * maxStartTrack);
      newStartTrack = Math.max(0, Math.min(maxStartTrack, newStartTrack));
      
      if (_recVisualStartTrack !== newStartTrack) {
        _recVisualStartTrack = newStartTrack;
        _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
      }
      
      _recVisualScrollY = pianoScroll.scrollTop;
      
      // 使用 RAF 合并多次 scroll 事件为一次渲染
      if (!_scrollRenderPending) {
        _scrollRenderPending = true;
        requestAnimationFrame(function() {
          _scrollRenderPending = false;
          renderRecVisual();
          updateVScrollbar();
        });
      }
    });
    
    // 暴露给外部使用的函数：当需要从代码控制滚动时调用
    window.syncPianoScrollFromCanvas = function(targetStartTrack) {
      if (!_recVisualPianoScroll || _isSyncingFromCanvas) return;
      
      var totalTracks = 49;
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      visibleTracks = Math.max(7, Math.min(49, visibleTracks));
      
      var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
      var trackH = pianoViewH / visibleTracks;
      trackH = Math.max(12, Math.min(100, trackH));
      
      var totalContentHeight = totalTracks * trackH;
      var maxScrollTop = Math.max(0, totalContentHeight - _recVisualPianoScroll.clientHeight);
      
      var scrollRatio = 0;
      if (totalTracks > visibleTracks && targetStartTrack !== undefined) {
        scrollRatio = targetStartTrack / (totalTracks - visibleTracks);
      } else if (totalTracks > visibleTracks) {
        scrollRatio = _recVisualStartTrack / (totalTracks - visibleTracks);
      }
      scrollRatio = Math.max(0, Math.min(1, scrollRatio));
      
      var targetScrollTop = scrollRatio * maxScrollTop;
      
      // 只在差值较大时才更新，避免微小变化导致循环
      if (Math.abs(_recVisualPianoScroll.scrollTop - targetScrollTop) < 1) return;
      
      _isSyncingFromCanvas = true;
      _recVisualPianoScroll.scrollTop = targetScrollTop;
      // 使用 RAF 解锁，确保 scroll 事件处理完毕后再解锁
      requestAnimationFrame(function() { 
        _isSyncingFromCanvas = false; 
      });
    };
    
    // 触摸滚动支持
    var touchStartY = 0;
    var touchStartScrollTop = 0;
    
    pianoScroll.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchStartScrollTop = pianoScroll.scrollTop;
      }
    }, { passive: true });
    
    pianoScroll.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1) {
        var touchY = e.touches[0].clientY;
        var dy = touchStartY - touchY;
        var newScrollTop = touchStartScrollTop + dy;
        pianoScroll.scrollTop = newScrollTop;
      }
    }, { passive: true });
    
    setTimeout(function() {
      var c4NoteName = 'C4';
      var c4TrackIndex = _recVisualNoteToTrackMap[c4NoteName];
      if (c4TrackIndex === undefined) c4TrackIndex = 24;
      
      var totalTracks = 49;
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      visibleTracks = Math.max(7, Math.min(49, visibleTracks));
      
      var pianoViewH = pianoScroll ? pianoScroll.clientHeight : 300;
      var trackH = pianoViewH / visibleTracks;
      trackH = Math.max(12, Math.min(100, trackH));
      
      var totalContentHeight = totalTracks * trackH;
      var maxScrollTop = Math.max(0, totalContentHeight - pianoScroll.clientHeight);
      
      // 将 C4 显示在中间位置
      var c4Position = c4TrackIndex * trackH;
      var targetScroll = c4Position - (pianoScroll.clientHeight / 2) + (trackH / 2);
      targetScroll = Math.max(0, Math.min(maxScrollTop, targetScroll));
      
      pianoScroll.scrollTop = targetScroll;
      _recVisualScrollY = targetScroll;
      renderRecVisual();
    }, 50);
    
    // 琴键创建完成后，立即调用renderRecVisual()确保琴键和轨道完全同步
    setTimeout(function() {
      renderRecVisual();
    }, 150);
  }
  
  function releasePianoKey(keyNote) {
    var pressedInfo = _recVisualPressedKeys[keyNote];
    if (!pressedInfo) return;
    
    var keyElement = pressedInfo.keyElement;
    if (keyElement) {
      keyElement.classList.remove('active');
    }
    
    try {
      stopNote(pressedInfo.noteKey);
    } catch (e) {}
    
    var now = performance.now();
    var holdMs = Math.max(1, Math.round(now - pressedInfo.pressedAt));
    if (pressedInfo.noteIndex !== undefined && _recVisualNotes[pressedInfo.noteIndex]) {
      _recVisualNotes[pressedInfo.noteIndex].holdMs = holdMs;
      renderRecVisual();
    }
    
    delete _recVisualPressedKeys[keyNote];
    
    var hasPressedKeys = false;
    for (var k in _recVisualPressedKeys) {
      hasPressedKeys = true;
      break;
    }
    if (!hasPressedKeys && _recVisualHoldUpdateTimer) {
      clearInterval(_recVisualHoldUpdateTimer);
      _recVisualHoldUpdateTimer = null;
    }
  }
  
  function addNoteFromPianoKeyWithRecRule(instZh, note, holdMs, atMs) {
    saveVisualHistory();
    
    var newTrack;
    var trackFromNote = _recVisualNoteToTrackMap[note];
    if (trackFromNote !== undefined) {
      newTrack = trackFromNote;
    } else {
      if (_recVisualActiveTrack === 'main') {
        newTrack = 0;
      } else if (_recVisualActiveTrack === 'accomp') {
        newTrack = -1;
      } else {
        newTrack = 0;
      }
    }
    
    var newTimeMs = _recVisualPlayTime;
    if (newTimeMs < 0) newTimeMs = 0;
    
    _recVisualNotes.push({
      inst: instZh,
      note: note,
      volume: 100,
      holdMs: holdMs,
      timeMs: newTimeMs,
      track: newTrack
    });
    
    var newNoteIndex = _recVisualNotes.length - 1;
    _recVisualSelected = _recVisualNotes[newNoteIndex];
    _recVisualSelectedNotes = [];
    renderRecVisual();
    
    return newNoteIndex;
  }
  
  function addNoteFromPianoKey(note, holdMs, inst) {
    saveVisualHistory();
    
    var newTrack;
    var trackFromNote = _recVisualNoteToTrackMap[note];
    if (trackFromNote !== undefined) {
      newTrack = trackFromNote;
    } else {
      if (_recVisualActiveTrack === 'main') {
        newTrack = 0;
      } else if (_recVisualActiveTrack === 'accomp') {
        newTrack = -1;
      } else {
        newTrack = 0;
      }
    }
    
    var lastEndTime = 0;
    _recVisualNotes.forEach(function(n) {
      if (n.track === newTrack) {
        var noteEnd = n.timeMs + n.holdMs;
        if (noteEnd > lastEndTime) {
          lastEndTime = noteEnd;
        }
      }
    });
    
    var newTimeMs = snapToBeat(lastEndTime);
    
    _recVisualNotes.push({
      inst: inst,
      note: note,
      volume: 100,
      holdMs: holdMs,
      timeMs: newTimeMs,
      track: newTrack
    });
    _recVisualSelected = _recVisualNotes[_recVisualNotes.length - 1];
    _recVisualSelectedNotes = [];
    updatePropsPanel();
    renderRecVisual();
  }
  
  function findAvailableTrack(baseTrack, startTime, holdMs) {
    var isMainRegion = baseTrack >= 0;
    var usedTracks = {};
    
    _recVisualNotes.forEach(function(n) {
      if ((isMainRegion && n.track >= 0) || (!isMainRegion && n.track < 0)) {
        var trackNum = isMainRegion ? n.track : -n.track - 1;
        if (!usedTracks[trackNum]) usedTracks[trackNum] = [];
        usedTracks[trackNum].push({
          start: n.timeMs,
          end: n.timeMs + n.holdMs
        });
      }
    });
    
    var maxTrackNum = 0;
    for (var t in usedTracks) {
      maxTrackNum = Math.max(maxTrackNum, parseInt(t));
    }
    
    for (var i = 0; i <= maxTrackNum + 1; i++) {
      var trackToCheck = isMainRegion ? i : -(i + 1);
      var existingNotes = usedTracks[i] || [];
      var isOverlapping = false;
      
      for (var j = 0; j < existingNotes.length; j++) {
        var en = existingNotes[j];
        if (!(startTime + holdMs <= en.start || startTime >= en.end)) {
          isOverlapping = true;
          break;
        }
      }
      
      if (!isOverlapping) {
        return trackToCheck;
      }
    }
    
    return isMainRegion ? (maxTrackNum + 1) : -(maxTrackNum + 2);
  }
  
  var _recVisualToolbarOriginalHTML = '';
  
  function saveToolbarOriginalContent() {
    var toolbar = document.getElementById('recVisualToolbar');
    if (toolbar && !_recVisualToolbarOriginalHTML) {
      _recVisualToolbarOriginalHTML = toolbar.innerHTML;
    }
  }
  
  function restoreToolbarOriginalContent() {
    var toolbar = document.getElementById('recVisualToolbar');
    if (toolbar && _recVisualToolbarOriginalHTML) {
      // 先隐藏属性面板
      var propsContainer = document.getElementById('propsPanelContainer');
      if (propsContainer) {
        propsContainer.style.display = 'none';
      }
      // 确保播放按钮事件绑定正常
      ensurePlayButtonWorks();
    }
  }
  
  function rebindToolbarEvents() {
    var copyBtn = document.getElementById('recVisualCopy');
    var pasteBtn = document.getElementById('recVisualPaste');
    var delBtn = document.getElementById('recVisualDel');
    if (copyBtn) copyBtn.onclick = copyVisualNotes;
    if (pasteBtn) pasteBtn.onclick = pasteVisualNotes;
    if (delBtn) delBtn.onclick = deleteVisualNotes;
  }

  function updatePropsPanel() {
    var toolbar = document.getElementById('recVisualToolbar');
    if (!toolbar) return;
    
    saveToolbarOriginalContent();
    
    var hasSelection = _recVisualSelected || _recVisualSelectedNotes.length > 0;
    
    // 查找功能区的各个区域
    var playBtns = document.getElementById('recVisualPlayBtns');
    var editBtns = document.getElementById('recVisualEditBtns');
    var bpmArea = document.getElementById('recVisualBPMArea');
    var timeArea = document.getElementById('recVisualTimeArea');
    var propsContainer = document.getElementById('propsPanelContainer');
    
    if (!hasSelection) {
      restoreToolbarOriginalContent();
      
      // 取消选择时：显示播放、BPM、时长区域，隐藏编辑按钮区域
      if (playBtns) playBtns.style.display = 'flex';
      if (editBtns) editBtns.style.display = 'none';
      if (bpmArea) bpmArea.style.display = 'flex';
      if (timeArea) timeArea.style.display = 'flex';
      
      if (propsContainer) {
        propsContainer.style.display = 'none';
      }
      return;
    }
    
    var note = _recVisualSelected || _recVisualSelectedNotes[0];
    if (!note) {
      if (propsContainer) propsContainer.style.display = 'none';
      return;
    }
    
    // 选中音符时：隐藏所有功能区，显示属性面板（包含编辑按钮）
    if (playBtns) playBtns.style.display = 'none';
    if (editBtns) editBtns.style.display = 'none';
    if (bpmArea) bpmArea.style.display = 'none';
    if (timeArea) timeArea.style.display = 'none';
    
    var inst = note.inst || '钢琴';
    var noteName = note.note || 'C4';
    var volume = note.volume || 100;
    var melodyId = note.melodyId;
    if (!melodyId) {
      if (typeof note.track === 'number') {
        melodyId = note.track < 0 ? 'accomp' : 'main';
      } else {
        melodyId = 'main';
      }
    }
    
    // 如果属性面板容器不存在，创建它
    if (!propsContainer) {
      propsContainer = document.createElement('div');
      propsContainer.id = 'propsPanelContainer';
      toolbar.appendChild(propsContainer);
    }
    
    // 响应式布局：检测屏幕宽度
    var isNarrowScreen = window.innerWidth < 500;
    var isVeryNarrowScreen = window.innerWidth < 380;
    
    // 根据屏幕宽度设置间距和尺寸
    var gap = isVeryNarrowScreen ? '2px' : (isNarrowScreen ? '4px' : '6px');
    var btnPadding = isVeryNarrowScreen ? '0 4px' : '0 8px';
    var fontSize = isVeryNarrowScreen ? '10px' : (isNarrowScreen ? '10px' : '11px');
    var btnHeight = isVeryNarrowScreen ? '24px' : '28px';
    var selectPadding = isVeryNarrowScreen ? '2px 4px' : '4px 6px';
    var volumeWidth = isVeryNarrowScreen ? '50px' : (isNarrowScreen ? '60px' : '70px');
    
    // 显示属性面板（包含编辑按钮和音符属性）
    propsContainer.style.display = '';
    
    var html = '<div style="display:flex;align-items:center;gap:' + gap + ';white-space:nowrap;flex-wrap:nowrap;height:36px;">';
    
    // 编辑按钮：复制、粘贴、删除、最大化
    html += '<button id="propCopy" class="toolbar-btn" title="复制 (Ctrl+C)" style="background:#222;border:1px solid #444;color:#eee;padding:' + btnPadding + ';border-radius:4px;cursor:pointer;font-size:' + fontSize + ';height:' + btnHeight + ';">复制</button>';
    html += '<button id="propPaste" class="toolbar-btn" title="粘贴 (Ctrl+V)" style="background:#222;border:1px solid #444;color:#eee;padding:' + btnPadding + ';border-radius:4px;cursor:pointer;font-size:' + fontSize + ';height:' + btnHeight + ';">粘贴</button>';
    html += '<button id="propDel" class="toolbar-btn" title="删除 (Delete)" style="background:#222;border:1px solid #444;color:#eee;padding:' + btnPadding + ';border-radius:4px;cursor:pointer;font-size:' + fontSize + ';height:' + btnHeight + ';">删除</button>';
    html += '<button id="propFit" class="toolbar-btn" title="最大化显示 (Shift+Z)" style="background:#222;border:1px solid #444;color:#eee;padding:' + btnPadding + ';border-radius:4px;cursor:pointer;font-size:' + fontSize + ';height:' + btnHeight + ';">🔍</button>';
    
    html += '<div style="width:1px;height:' + (isVeryNarrowScreen ? '16px' : '20px') + ';background:#444;margin:0 2px;"></div>';
    
    // 旋律轨道选择 - 根据屏幕宽度设置最小宽度（确保三个字完整显示）
    var melodyMinWidth = isVeryNarrowScreen ? '62px' : (isNarrowScreen ? '68px' : '75px');
    html += '<select id="propMelody" class="toolbar-input" style="background:#222;border:1px solid #444;color:#eee;border-radius:4px;font-size:' + fontSize + ';padding:' + selectPadding + ';flex-shrink:0;height:' + btnHeight + ';min-width:' + melodyMinWidth + ';text-align:left;" title="旋律轨道">';
    if (window._melodyList && window._melodyList.length > 0) {
      var foundMelody = false;
      window._melodyList.forEach(function(m) {
        if (m.id === melodyId) foundMelody = true;
        html += '<option value="' + m.id + '"' + (m.id === melodyId ? ' selected' : '') + '>' + m.name + '</option>';
      });
      if (!foundMelody && melodyId) {
        html += '<option value="' + melodyId + '" selected>' + melodyId + '</option>';
      }
    } else {
      html += '<option value="main"' + (melodyId === 'main' ? ' selected' : '') + '>主旋律</option>';
      html += '<option value="accomp"' + (melodyId === 'accomp' ? ' selected' : '') + '>伴奏</option>';
    }
    html += '</select>';
    
    // 乐器选择 - 根据屏幕宽度设置最小宽度（确保三个字完整显示）
    var instMinWidth = isVeryNarrowScreen ? '58px' : (isNarrowScreen ? '62px' : '68px');
    html += '<select id="propInst" class="toolbar-input" style="background:#222;border:1px solid #444;color:#eee;border-radius:4px;font-size:' + fontSize + ';padding:' + selectPadding + ';flex-shrink:0;height:' + btnHeight + ';min-width:' + instMinWidth + ';text-align:left;">';
    var instruments = ['钢琴', '吉他', '小提琴', '大提琴', '箫', '笛子', '古筝', '二胡', '琵琶', '萨克斯'];
    instruments.forEach(function(i) {
      html += '<option value="' + i + '"' + (i === inst ? ' selected' : '') + '>' + i + '</option>';
    });
    html += '</select>';
    
    // 音量：窄屏时用数值输入框+喇叭图标，宽屏时用滑块+喇叭图标
    var iconSize = isVeryNarrowScreen ? '12' : (isNarrowScreen ? '14' : '16');
    html += '<svg width="' + iconSize + '" height="' + iconSize + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#888;flex-shrink:0;">';
    html += '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>';
    html += '<path d="M14 8a4 4 0 0 1 0 8"></path>';
    html += '<path d="M18 6a7 7 0 0 1 0 12"></path>';
    html += '</svg>';
    
    if (isNarrowScreen) {
      html += '<input type="number" id="propVolume" class="toolbar-input" min="30" max="100" value="' + volume + '" style="width:' + (isVeryNarrowScreen ? '36px' : '42px') + ';background:#222;border:1px solid #444;color:#eee;padding:0 2px;border-radius:4px;font-size:' + fontSize + ';height:' + btnHeight + ';text-align:center;flex-shrink:0;">';
    } else {
      html += '<input type="range" id="propVolume" class="toolbar-input" min="30" max="100" value="' + volume + '" style="width:' + volumeWidth + ';vertical-align:middle;flex-shrink:0;">';
      html += '<span id="propVolumeVal" style="min-width:28px;text-align:right;font-size:' + fontSize + ';color:#aaa;flex-shrink:0;">' + volume + '</span>';
    }
    
    html += '</div>';
    
    propsContainer.innerHTML = html;
    
    // 绑定编辑按钮事件
    var propCopy = document.getElementById('propCopy');
    var propPaste = document.getElementById('propPaste');
    var propDel = document.getElementById('propDel');
    var propFit = document.getElementById('propFit');
    
    if (propCopy) propCopy.onclick = copyVisualNotes;
    if (propPaste) propPaste.onclick = pasteVisualNotes;
    if (propDel) propDel.onclick = deleteVisualNotes;
    if (propFit) propFit.onclick = function() { fitRecVisual(); };
    
    var propMelody = document.getElementById('propMelody');
    var propInst = document.getElementById('propInst');
    var propVolume = document.getElementById('propVolume');
    var propVolumeVal = document.getElementById('propVolumeVal');
    
    if (propMelody) {
      propMelody.onchange = function() {
        var newMelodyId = this.value;
        
        if (_recVisualSelectedNotes.length > 0) {
          saveVisualHistory();
          _recVisualSelectedNotes.forEach(function(n) {
            n.melodyId = newMelodyId;
          });
        } else if (_recVisualSelected) {
          saveVisualHistory();
          _recVisualSelected.melodyId = newMelodyId;
        }
        renderRecVisual();
      };
    }
    
    if (propInst) {
      propInst.onchange = function() {
        var newInst = this.value;
        if (_recVisualSelectedNotes.length > 0) {
          _recVisualSelectedNotes.forEach(function(n) {
            n.inst = newInst;
          });
        } else if (_recVisualSelected) {
          _recVisualSelected.inst = newInst;
        }
        renderRecVisual();
      };
    }
    
    if (propVolume) {
      propVolume.oninput = function() {
        var newVolume = parseInt(this.value) || 80;
        if (newVolume < 30) newVolume = 30;
        if (newVolume > 100) newVolume = 100;
        if (propVolumeVal) propVolumeVal.textContent = newVolume + '%';
        if (_recVisualSelectedNotes.length > 0) {
          _recVisualSelectedNotes.forEach(function(n) {
            n.volume = newVolume;
          });
        } else if (_recVisualSelected) {
          _recVisualSelected.volume = newVolume;
        }
        renderRecVisual();
      };
      propVolume.onchange = propVolume.oninput;
    }
  }
  
  function updateRangeBar() {
    var rangeBar = document.getElementById('recVisualRangeBar');
    var rangeSel = document.getElementById('recVisualRangeSel');
    var rangeHandleLeft = document.getElementById('recVisualRangeHandleLeft');
    var rangeHandleRight = document.getElementById('recVisualRangeHandleRight');
    if (!rangeBar || !rangeSel || !rangeHandleLeft || !rangeHandleRight) return;
    var wrap = document.getElementById('recVisualCanvasWrap');
    if (!wrap) return;
    var w = wrap.clientWidth;

    var totalTime = _recVisualMaxTime;
    var visibleTime = w / _recVisualZoom;
    var startTime = _recVisualScrollX / _recVisualZoom;
    var endTime = startTime + visibleTime;

    var rangeStart = startTime / totalTime;
    var rangeEndPos = endTime / totalTime;

    rangeStart = Math.max(0, Math.min(1, rangeStart));
    rangeEndPos = Math.max(0, Math.min(1, rangeEndPos));

    var barW = rangeBar.clientWidth;

    var leftPos = rangeStart * barW;
    var rightPos = rangeEndPos * barW;

    rangeHandleLeft.style.left = leftPos + 'px';
    rangeSel.style.left = leftPos + 'px';
    rangeSel.style.width = Math.max(2, rightPos - leftPos) + 'px';
    rangeHandleRight.style.left = (rightPos - 6) + 'px';
  }

  function initRecVisualEditor() {
    
    _recVisualStartAt = performance.now();
    
    var _recVisualKeydownHandler = null;
    var _recVisualKeyupHandler = null;
    
    window.addEventListener('resize', function() {
      var visualEditor = document.getElementById('recVisualEditor');
      if (visualEditor && visualEditor.style.display !== 'none') {
        createRecVisualPiano();
      }
      adjustToolbarResponsive();
    });
    
    function setupRecVisualKeyboardEvents() {
      _recVisualKeydownHandler = function(e) {
        var visualEditor = document.getElementById('recVisualEditor');
        var recEditOverlay = document.getElementById('recEditOverlay');
        if (!visualEditor || visualEditor.style.display === 'none') return;
        if (!recEditOverlay || !recEditOverlay.classList.contains('show')) return;
        
        if (e.repeat) return;
        
        if (e.ctrlKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          saveVisualEditorWithoutClose();
          return;
        }
        
        // 播放/暂停快捷键处理
        if ((pcKeyMap.control.playPause && pcKeyMap.control.playPause.includes(e.code)) || (e.key === ' ' || e.code === 'Space')) {
          e.preventDefault();
          e.stopPropagation();
          const playBtn = document.getElementById('recVisualPlay');
          if (playBtn) playBtn.click();
          return;
        }
        
        if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        const code = e.code;
        
        if (typeof pcKeyMap !== 'undefined' && pcKeyMap.control && pcKeyMap.control.prevOctave && pcKeyMap.control.prevOctave.includes(code)) {
          _recVisualBaseOctave = Math.max(1, _recVisualBaseOctave - 1);
          e.preventDefault();
          return;
        }
        
        if (typeof pcKeyMap !== 'undefined' && pcKeyMap.control && pcKeyMap.control.nextOctave && pcKeyMap.control.nextOctave.includes(code)) {
          _recVisualBaseOctave = Math.min(7, _recVisualBaseOctave + 1);
          e.preventDefault();
          return;
        }
        
        var foundNote = null;
        
        const BASE_NOTE_ORDER = ["C","D","E","F","G","A","B","C#","D#","F#","G#","A#"];
        for (const note of BASE_NOTE_ORDER) {
          if (typeof pcKeyMap !== 'undefined' && pcKeyMap.base && pcKeyMap.base[note] && pcKeyMap.base[note].includes(code)) {
            foundNote = note + _recVisualBaseOctave;
            break;
          }
        }
        
        if (!foundNote && typeof pcKeyMap !== 'undefined' && pcKeyMap.fixed && pcKeyMap.fixed.octave5) {
          for (const note in pcKeyMap.fixed.octave5) {
            if (pcKeyMap.fixed.octave5[note].includes(code)) {
              foundNote = note + (_recVisualBaseOctave + 1);
              break;
            }
          }
        }
        
        if (!foundNote && typeof pcKeyMap !== 'undefined' && pcKeyMap.fixed && pcKeyMap.fixed.octave3) {
          for (const note in pcKeyMap.fixed.octave3) {
            if (pcKeyMap.fixed.octave3[note].includes(code)) {
              foundNote = note + (_recVisualBaseOctave - 1);
              break;
            }
          }
        }
        
        if (foundNote && !_recVisualPressedKeys[foundNote]) {
          e.preventDefault();
          
          var pianoInstSelect = document.getElementById('recVisualPianoInst');
          var instEn = pianoInstSelect ? pianoInstSelect.value : 'piano';
          var instZh = _INST_ZH_MAP[instEn] || instEn;
          
          handleRecVisualPianoKey(foundNote, instZh, instEn, null);
        }
      };
      
      _recVisualKeyupHandler = function(e) {
        var visualEditor = document.getElementById('recVisualEditor');
        var recEditOverlay = document.getElementById('recEditOverlay');
        if (!visualEditor || visualEditor.style.display === 'none') return;
        if (!recEditOverlay || !recEditOverlay.classList.contains('show')) return;
        
        if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        const code = e.code;
        
        var foundNote = null;
        
        const BASE_NOTE_ORDER = ["C","D","E","F","G","A","B","C#","D#","F#","G#","A#"];
        for (const note of BASE_NOTE_ORDER) {
          if (typeof pcKeyMap !== 'undefined' && pcKeyMap.base && pcKeyMap.base[note] && pcKeyMap.base[note].includes(code)) {
            foundNote = note + _recVisualBaseOctave;
            break;
          }
        }
        
        if (!foundNote && typeof pcKeyMap !== 'undefined' && pcKeyMap.fixed && pcKeyMap.fixed.octave5) {
          for (const note in pcKeyMap.fixed.octave5) {
            if (pcKeyMap.fixed.octave5[note].includes(code)) {
              foundNote = note + (_recVisualBaseOctave + 1);
              break;
            }
          }
        }
        
        if (!foundNote && typeof pcKeyMap !== 'undefined' && pcKeyMap.fixed && pcKeyMap.fixed.octave3) {
          for (const note in pcKeyMap.fixed.octave3) {
            if (pcKeyMap.fixed.octave3[note].includes(code)) {
              foundNote = note + (_recVisualBaseOctave - 1);
              break;
            }
          }
        }
        
        if (foundNote) {
          releasePianoKey(foundNote);
        }
      };
      
      document.addEventListener('keydown', _recVisualKeydownHandler, true);
      document.addEventListener('keyup', _recVisualKeyupHandler, true);
    }
    
    function removeRecVisualKeyboardEvents() {
      if (_recVisualKeydownHandler) {
        document.removeEventListener('keydown', _recVisualKeydownHandler, true);
      }
      if (_recVisualKeyupHandler) {
        document.removeEventListener('keyup', _recVisualKeyupHandler, true);
      }
    }
    
    loadVisualEditorSettings();
    
    createRecVisualPiano();
    
    var visualBtn = document.getElementById('recVisualEditBtn');
    var textLabel = document.getElementById('recTextEditLabel');
    var textEditor = document.getElementById('recTextEditor');
    var visualEditor = document.getElementById('recVisualEditor');
    
    if (!visualBtn || !textLabel) {
      console.warn('initRecVisualEditor: visualBtn or textLabel not found');
    }

    if (visualBtn) {
      visualBtn.onclick = function() {
      visualBtn.classList.add('active');
      textLabel.classList.remove('active');
      textEditor.style.display = 'none';
      visualEditor.style.display = 'flex';
      parseTextToVisual();
      saveVisualHistory();
      _recVisualSelected = null;
      _recVisualSelectedNotes = [];
      updatePropsPanel();
      applyVisualEditorSettings();
      
      setTimeout(function() {
        createRecVisualPiano();
      }, 100);
      
      setupRecVisualKeyboardEvents();
      
      var wrap = document.getElementById('recVisualCanvasWrap');
      var w = wrap.clientWidth;
      
      var hasSaved = false;
      try {
        var saved = localStorage.getItem('visualEditorSettings');
        if (saved) hasSaved = true;
      } catch(e) {}
      
      if (!hasSaved) {
        _recVisualZoom = w / _recVisualMaxTime;
        _recVisualScrollX = 0;
      }
      
      renderRecVisual();
      setTimeout(function() {
        updateRangeBar();
      }, 300);
    };
    }
    
    textLabel.onclick = function() {
      textLabel.classList.add('active');
      visualBtn.classList.remove('active');
      textEditor.style.display = 'block';
      visualEditor.style.display = 'none';
      parseVisualToText();
      removeRecVisualKeyboardEvents();
    };
    
    _recVisualCanvas = document.getElementById('recVisualCanvas');
    if (_recVisualCanvas) {
      _recVisualCtx = _recVisualCanvas.getContext('2d');
      setupRecVisualEvents();
    }
    
    var fitBtn = document.getElementById('recVisualFit');
    if (fitBtn) {
      fitBtn.onclick = function() {
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        
        var notesToConsider = [];
        
        if (_recVisualSelectedNotes.length > 0) {
          notesToConsider = _recVisualSelectedNotes;
        } else if (_recVisualSelected) {
          notesToConsider = [_recVisualSelected];
        } else {
          notesToConsider = _recVisualNotes;
        }
        
        if (notesToConsider.length === 0) {
          var newZoom = w / _recVisualMaxTime;
          _recVisualZoom = Math.max(0.1, newZoom);
          _recVisualScrollX = 0;
        } else {
          var minTime = Infinity;
          var maxTime = 0;
          
          notesToConsider.forEach(function(n) {
            if (n.timeMs < minTime) minTime = n.timeMs;
            if (n.timeMs + n.holdMs > maxTime) maxTime = n.timeMs + n.holdMs;
          });
          
          var timeSpan = maxTime - minTime;
          if (timeSpan <= 0) timeSpan = 1000;
          
          var padding = 50;
          var newZoom = (w - padding * 2) / timeSpan;
          _recVisualZoom = Math.max(0.1, newZoom);
          _recVisualScrollX = Math.max(0, minTime * _recVisualZoom - padding);
        }
        
        renderRecVisual();
        updateRangeBar();
      };
    }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Z' && e.shiftKey) {
        var fitBtn = document.getElementById('recVisualFit');
        if (fitBtn) fitBtn.click();
      }
    });
    
    var addMainTrackBtn = document.getElementById('recVisualAddMainTrack');
    if (addMainTrackBtn) {
      addMainTrackBtn.onclick = function() {
        _recVisualMainTrackCount++;
        saveVisualEditorSettings();
        renderRecVisual();
      };
    }
    
    var delMainTrackBtn = document.getElementById('recVisualDelMainTrack');
    if (delMainTrackBtn) {
      delMainTrackBtn.onclick = function() {
        if (_recVisualMainTrackCount > 1) {
          _recVisualMainTrackCount--;
          saveVisualEditorSettings();
          renderRecVisual();
        }
      };
    }
    
    var melodyControlBtn = document.getElementById('melodyControlBtn');
    if (melodyControlBtn) {
      melodyControlBtn.onclick = function() {
        openMelodyControlModal();
      };
    }
    
    var melodyAddBtn = document.getElementById('melodyAddBtn');
    if (melodyAddBtn) {
      melodyAddBtn.onclick = function(e) {
        e.stopPropagation();
        addMelody();
      };
    }
    
    var melodyRemoveBtn = document.getElementById('melodyRemoveBtn');
    if (melodyRemoveBtn) {
      melodyRemoveBtn.onclick = function(e) {
        e.stopPropagation();
        removeMelody();
      };
    }
    
    var melodyModal = document.getElementById('melodyControlModal');
    var melodyModalContent = document.getElementById('melodyModalContent');
    if (melodyModal) {
      melodyModal.onclick = function(e) {
        closeMelodyControlModal();
      };
    }
    if (melodyModalContent) {
      melodyModalContent.onclick = function(e) {
        e.stopPropagation();
      };
    }
    
    var melodyCancelBtn = document.getElementById('melodyCancelBtn');
    if (melodyCancelBtn) {
      melodyCancelBtn.onclick = function(e) {
        e.stopPropagation();
        closeMelodyControlModal();
      };
    }
    
    var melodyConfirmBtn = document.getElementById('melodyConfirmBtn');
    if (melodyConfirmBtn) {
      melodyConfirmBtn.onclick = function(e) {
        e.stopPropagation();
        confirmMelodySelection();
      };
    }
    
    renderTextTrackButtons();
    
    var pianoInstSelect = document.getElementById('recVisualPianoInst');
    if (pianoInstSelect) {
      pianoInstSelect.onchange = function() {
      };
    }
    
    var rangeBar = document.getElementById('recVisualRangeBar');
    var rangeSel = document.getElementById('recVisualRangeSel');
    var rangeHandleLeft = document.getElementById('recVisualRangeHandleLeft');
    var rangeHandleRight = document.getElementById('recVisualRangeHandleRight');
    
    if (rangeBar) {
    var _rangeDrag = null;
    
    if (rangeHandleLeft) {
      rangeHandleLeft.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(0, 170, 255, 1)';
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var endTime = startTime + w / _recVisualZoom;
        _rangeDrag = {
          type: 'left',
          startX: e.clientX,
          startTime: startTime,
          endTime: endTime
        };
      });
      rangeHandleLeft.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(0, 170, 255, 1)';
        var touch = e.touches[0];
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var endTime = startTime + w / _recVisualZoom;
        _rangeDrag = {
          type: 'left',
          startX: touch.clientX,
          startTime: startTime,
          endTime: endTime
        };
      });
    }

    if (rangeHandleRight) {
      rangeHandleRight.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(0, 170, 255, 1)';
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var endTime = startTime + w / _recVisualZoom;
        _rangeDrag = {
          type: 'right',
          startX: e.clientX,
          startTime: startTime,
          endTime: endTime
        };
      });
      rangeHandleRight.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(0, 170, 255, 1)';
        var touch = e.touches[0];
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var endTime = startTime + w / _recVisualZoom;
        _rangeDrag = {
          type: 'right',
          startX: touch.clientX,
          startTime: startTime,
          endTime: endTime
        };
      });
    }

    if (rangeSel) {
      rangeSel.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(100, 150, 200, 0.7)';
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var visibleTime = w / _recVisualZoom;
        _rangeDrag = {
          type: 'drag',
          startX: e.clientX,
          startTime: startTime,
          visibleTime: visibleTime
        };
      });
      rangeSel.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.background = 'rgba(100, 150, 200, 0.7)';
        var touch = e.touches[0];
        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var startTime = _recVisualScrollX / _recVisualZoom;
        var visibleTime = w / _recVisualZoom;
        _rangeDrag = {
          type: 'drag',
          startX: touch.clientX,
          startTime: startTime,
          visibleTime: visibleTime
        };
      });
    }

    if (rangeBar) {
      rangeBar.addEventListener('mousedown', function(e) {
        if (e.target !== rangeBar) return;
        var rect = rangeBar.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var ratio = x / rect.width;

        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var visibleTime = w / _recVisualZoom;
        var newStartTime = ratio * _recVisualMaxTime - visibleTime / 2;
        newStartTime = Math.max(0, Math.min(_recVisualMaxTime - visibleTime, newStartTime));

        _recVisualScrollX = newStartTime * _recVisualZoom;

        renderRecVisual();
        updateRangeBar();
      });
      rangeBar.addEventListener('touchstart', function(e) {
        if (e.target !== rangeBar) return;
        var touch = e.touches[0];
        var rect = rangeBar.getBoundingClientRect();
        var x = touch.clientX - rect.left;
        var ratio = x / rect.width;

        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;
        var visibleTime = w / _recVisualZoom;
        var newStartTime = ratio * _recVisualMaxTime - visibleTime / 2;
        newStartTime = Math.max(0, Math.min(_recVisualMaxTime - visibleTime, newStartTime));

        _recVisualScrollX = newStartTime * _recVisualZoom;

        renderRecVisual();
        updateRangeBar();
      });
    }
    
    document.addEventListener('mousemove', function(e) {
      if (!_rangeDrag) return;
      
      var barW = rangeBar.clientWidth;
      var dx = e.clientX - _rangeDrag.startX;
      var wrap = document.getElementById('recVisualCanvasWrap');
      var w = wrap.clientWidth;
      
      if (_rangeDrag.type === 'drag') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newStartTime = _rangeDrag.startTime + timeDelta;
        var visibleTime = _rangeDrag.visibleTime;
        newStartTime = Math.max(0, Math.min(_recVisualMaxTime - visibleTime, newStartTime));
        _recVisualScrollX = newStartTime * _recVisualZoom;
      } else if (_rangeDrag.type === 'left') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newStartTime = _rangeDrag.startTime + timeDelta;
        var endTime = _rangeDrag.endTime;
        
        newStartTime = Math.max(0, newStartTime);
        
        var newVisibleTime = endTime - newStartTime;
        newVisibleTime = Math.max(4000, newVisibleTime);
        var newZoom = w / newVisibleTime;
        _recVisualZoom = newZoom;
        _recVisualScrollX = newStartTime * newZoom;
      } else if (_rangeDrag.type === 'right') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newEndTime = _rangeDrag.endTime + timeDelta;
        var startTime = _rangeDrag.startTime;
        
        newEndTime = Math.min(_recVisualMaxTime, newEndTime);
        
        var newVisibleTime = newEndTime - startTime;
        newVisibleTime = Math.max(4000, newVisibleTime);
        var newZoom = w / newVisibleTime;
        _recVisualZoom = newZoom;
        _recVisualScrollX = startTime * newZoom;
      }
      
      renderRecVisual();
      updateRangeBar();
    });
    
    document.addEventListener('mouseup', function() {
      if (rangeHandleLeft) rangeHandleLeft.style.background = 'rgba(150,180,210,0.9)';
      if (rangeHandleRight) rangeHandleRight.style.background = 'rgba(150,180,210,0.9)';
      if (rangeSel) rangeSel.style.background = 'rgba(100,140,180,0.6)';
      _rangeDrag = null;
    });

    document.addEventListener('touchmove', function(e) {
      if (!_rangeDrag) return;
      var touch = e.touches[0];

      var barW = rangeBar.clientWidth;
      var dx = touch.clientX - _rangeDrag.startX;
      var wrap = document.getElementById('recVisualCanvasWrap');
      var w = wrap.clientWidth;

      if (_rangeDrag.type === 'drag') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newStartTime = _rangeDrag.startTime + timeDelta;
        var visibleTime = _rangeDrag.visibleTime;
        newStartTime = Math.max(0, Math.min(_recVisualMaxTime - visibleTime, newStartTime));
        _recVisualScrollX = newStartTime * _recVisualZoom;
      } else if (_rangeDrag.type === 'left') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newStartTime = _rangeDrag.startTime + timeDelta;
        var endTime = _rangeDrag.endTime;

        newStartTime = Math.max(0, newStartTime);

        var newVisibleTime = endTime - newStartTime;
        newVisibleTime = Math.max(4000, newVisibleTime);
        var newZoom = w / newVisibleTime;
        _recVisualZoom = newZoom;
        _recVisualScrollX = newStartTime * newZoom;
      } else if (_rangeDrag.type === 'right') {
        var timeDelta = dx / barW * _recVisualMaxTime;
        var newEndTime = _rangeDrag.endTime + timeDelta;
        var startTime = _rangeDrag.startTime;

        newEndTime = Math.min(_recVisualMaxTime, newEndTime);

        var newVisibleTime = newEndTime - startTime;
        newVisibleTime = Math.max(4000, newVisibleTime);
        var newZoom = w / newVisibleTime;
        _recVisualZoom = newZoom;
        _recVisualScrollX = startTime * newZoom;
      }

      renderRecVisual();
      updateRangeBar();
    });

    document.addEventListener('touchend', function() {
      if (rangeHandleLeft) rangeHandleLeft.style.background = 'rgba(150,180,210,0.9)';
      if (rangeHandleRight) rangeHandleRight.style.background = 'rgba(150,180,210,0.9)';
      if (rangeSel) rangeSel.style.background = 'rgba(100,140,180,0.6)';
      _rangeDrag = null;
    });
    }
    
    var maxTimeInput = document.getElementById('recVisualMaxTimeInput');
    if (maxTimeInput) {
      maxTimeInput.value = Math.round(_recVisualMaxTime / 1000) + 's';
      maxTimeInput.onchange = function() {
        var val = this.value.replace(/s$/, '');
        var seconds = Math.max(1, Math.min(300, parseInt(val) || 10));
        this.value = seconds + 's';
        _recVisualMaxTime = seconds * 1000;

        var wrap = document.getElementById('recVisualCanvasWrap');
        var w = wrap.clientWidth;

        var newZoom = w / _recVisualMaxTime;
        _recVisualZoom = Math.max(0.1, newZoom);
        _recVisualScrollX = 0;

        if (_recVisualPlayTime > _recVisualMaxTime) {
          _recVisualPlayTime = _recVisualMaxTime;
        }

        saveVisualEditorSettings();
        renderRecVisual();
        updateRangeBar();
      };
    }

    var bpmInput = document.getElementById('recVisualBPM');
    if (bpmInput) {
      bpmInput.onchange = function() {
        _recVisualBPM = Math.max(30, Math.min(240, parseInt(this.value) || 120));
        this.value = _recVisualBPM;
        saveVisualEditorSettings();
        renderRecVisual();
      };
    }
    
    var timeSigInput = document.getElementById('recVisualTimeSig');
    if (timeSigInput) {
      timeSigInput.oninput = function() {
        var val = this.value.trim();
        if (val && /^\d+\/\d+$/.test(val)) {
          _recVisualTimeSig = val;
          _recVisualMainSectionH = null;
          saveVisualEditorSettings();
          renderRecVisual();
        }
      };
    }
    
    var snapBtn = document.getElementById('recVisualSnap');
    if (snapBtn) {
      snapBtn.onclick = function() {
        _recVisualSnapEnabled = !_recVisualSnapEnabled;
        this.style.background = _recVisualSnapEnabled ? '#0099ff' : '#222';
        this.style.color = _recVisualSnapEnabled ? '#fff' : '#eee';
        this.style.borderColor = _recVisualSnapEnabled ? '#0099ff' : '#444';
        saveVisualEditorSettings();
      };
    }
    
    var durationSelect = document.getElementById('recVisualDuration');
    if (durationSelect) {
      durationSelect.onchange = function() {
        if (_recVisualSelectedNotes.length > 0) {
          saveVisualHistory();
          var newHoldMs = beatsToMs(parseFloat(this.value));
          _recVisualSelectedNotes.forEach(function(n) { n.holdMs = newHoldMs; });
          renderRecVisual();
        } else if (_recVisualSelected) {
          saveVisualHistory();
          _recVisualSelected.holdMs = beatsToMs(parseFloat(this.value));
          renderRecVisual();
        }
      };
    }
    
    var playBtn = document.getElementById('recVisualPlay');
    console.log('[DEBUG] initRecVisualEditor: playBtn found:', !!playBtn);
    if (playBtn) {
      playBtn.onclick = function(e) {
        console.log('▶ recVisualPlay CLICKED! _recVisualPlaying:', _recVisualPlaying, 'notes:', _recVisualNotes.length);
        e.preventDefault();
        e.stopPropagation();
        
        if (_recVisualPlaying) {
          _recVisualPlaying = false;
          playBtn.textContent = '▶ 播放';
          if (_recVisualPlayAnimId) {
            cancelAnimationFrame(_recVisualPlayAnimId);
            _recVisualPlayAnimId = null;
          }
          for (var i = 0; i < _recVisualNotes.length; i++) {
            try { stopNote('visPlay_' + i); } catch(ex) {}
            _recVisualNotes[i]._playing = false;
          }
          renderRecVisual();
        } else {
          if (_recVisualPlayTime >= _recVisualMaxTime) {
            _recVisualPlayTime = 0;
          }
          initAudio();
          _recVisualPlaying = true;
          _recVisualPlayStart = performance.now() - _recVisualPlayTime;
          playBtn.textContent = '⏸ 暂停';
          visualPlayLoop();
        }
      };
    }
    
    var copyBtn = document.getElementById('recVisualCopy');
    var pasteBtn = document.getElementById('recVisualPaste');
    var delBtn = document.getElementById('recVisualDel');
    
    if (copyBtn) copyBtn.onclick = copyVisualNotes;
    if (pasteBtn) pasteBtn.onclick = pasteVisualNotes;
    if (delBtn) delBtn.onclick = deleteVisualNotes;
    
    var instSelect = document.getElementById('recVisualInst');
    var noteSelect = document.getElementById('recVisualNote');
    if (instSelect) {
      instSelect.onchange = function() {
        if (_recVisualSelectedNotes.length > 0) {
          saveVisualHistory();
          _recVisualSelectedNotes.forEach(function(n) { n.inst = this.value; }.bind(this));
          renderRecVisual();
        } else if (_recVisualSelected) {
          saveVisualHistory();
          _recVisualSelected.inst = this.value;
          renderRecVisual();
        }
      };
    }
    if (noteSelect) {
      noteSelect.onchange = function() {
        if (_recVisualSelectedNotes.length > 0) {
          saveVisualHistory();
          _recVisualSelectedNotes.forEach(function(n) { n.note = this.value; }.bind(this));
          renderRecVisual();
        } else if (_recVisualSelected) {
          saveVisualHistory();
          _recVisualSelected.note = this.value;
          renderRecVisual();
        }
      };
    }
    
    document.removeEventListener('keydown', handleVisualKeydown);
    document.addEventListener('keydown', handleVisualKeydown);
    
    setupRecVisualKeyboardEvents();
    
    console.log('[DEBUG] initRecVisualEditor completed successfully');
  }
  
  // 防护性绑定：确保播放按钮一定能工作
  function ensurePlayButtonWorks() {
    var btn = document.getElementById('recVisualPlay');
    if (btn) {
      btn.onclick = function(e) {
        console.log('▶▶▶ recVisualPlay button clicked!');
        e.preventDefault();
        e.stopPropagation();
        
        if (_recVisualPlaying) {
          _recVisualPlaying = false;
          btn.textContent = '▶ 播放';
          if (_recVisualPlayAnimId) {
            cancelAnimationFrame(_recVisualPlayAnimId);
            _recVisualPlayAnimId = null;
          }
          for (var i = 0; i < _recVisualNotes.length; i++) {
            try { stopNote('visPlay_' + i); } catch(ex) {}
            if (_recVisualNotes[i]) _recVisualNotes[i]._playing = false;
          }
          renderRecVisual();
        } else {
          if (_recVisualPlayTime >= _recVisualMaxTime) {
            _recVisualPlayTime = 0;
          }
          initAudio();
          _recVisualPlaying = true;
          _recVisualPlayStart = performance.now() - _recVisualPlayTime;
          btn.textContent = '⏸ 暂停';
          visualPlayLoop();
        }
      };
      console.log('[DEBUG] Play button binding applied');
    }
  }
  
  setTimeout(ensurePlayButtonWorks, 500);

  function handleVisualKeydown(e) {
    var visualEditor = document.getElementById('recVisualEditor');
    var recEditOverlay = document.getElementById('recEditOverlay');
    if (!visualEditor || visualEditor.style.display === 'none') return;
    if (!recEditOverlay || !recEditOverlay.classList.contains('show')) return;
    
    if (e.key === 'Delete') {
      deleteVisualNotes();
    } else if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undoVisual();
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      redoVisual();
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      copyVisualNotes();
    } else if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      pasteVisualNotes();
    } else if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      _recVisualSelectedNotes = _recVisualNotes.slice();
      _recVisualSelected = null;
      updatePropsPanel();
      renderRecVisual();
    } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveVisualEditorWithoutClose();
    }
  }
  
  function saveVisualEditorWithoutClose() {
    var overlay = document.getElementById('recEditOverlay');
    var name = document.getElementById('recEditName').value.trim() || '未命名录制';
    parseVisualToText();
    var mainText = _melodyList[0] ? _melodyList[0].text : '';
    var accompText = _melodyList[1] ? _melodyList[1].text : '';
    var display = mainText;
    if (accompText) {
      display = mainText + '\n' + accompText;
    }
    var speed = parseFloat(document.getElementById('recEditSpeed').value) || 1;
    var idx = overlay._editIdx;
    var dateStr = new Date().toLocaleDateString('zh-CN');
    
    if (idx === -1) {
      customRecordings.push({ key: Date.now(), name: name, display: display, speed: speed, date: dateStr, showNotesList: _melodyList.map(function(m) { return m.showNotes !== false; }) });
      overlay._editIdx = customRecordings.length - 1;
    } else {
      customRecordings[idx].name = name;
      customRecordings[idx].display = display;
      customRecordings[idx].speed = speed;
      customRecordings[idx].showNotesList = _melodyList.map(function(m) { return m.showNotes !== false; });
    }
    saveRecs();
    renderRecList();
    
    saveVisualEditorSettings();
  }

  function visualPlayLoop() {
    if (!_recVisualPlaying) return;
    
    _recVisualPlayTime = performance.now() - _recVisualPlayStart;
    console.log('visualPlayLoop running, playTime:', _recVisualPlayTime, 'notes:', _recVisualNotes.length);
    
    for (var i = 0; i < _recVisualNotes.length; i++) {
      var n = _recVisualNotes[i];
      var noteKey = 'visPlay_' + i;
      var trackInfo = parseInt(n.track);
      if (isNaN(trackInfo)) trackInfo = 0;
      
      var melodyId = n.melodyId || (trackInfo >= 0 ? 'main' : 'accomp');
      var shouldPlay = _recVisualPlayTracks[melodyId] !== false;
      
      if (!shouldPlay) {
        if (n._playing) {
          try { stopNote(noteKey); } catch(e) {}
          n._playing = false;
        }
        continue;
      }
      
      if (_recVisualPlayTime >= n.timeMs && _recVisualPlayTime < n.timeMs + n.holdMs) {
        if (!n._playing) {
          var instEn = _INST_EN[n.inst] || n.inst;
          var noteVolume = n.volume || 100;
          startNote(noteKey, n.note, instEn, noteVolume);
          n._playing = true;
        }
      } else {
        if (n._playing) {
          try { stopNote(noteKey); } catch(e) {}
          n._playing = false;
        }
      }
    }
    
    var wrap = document.getElementById('recVisualCanvasWrap');
    if (wrap) {
      var centerX = wrap.clientWidth / 2;
      var targetScrollTime = _recVisualPlayTime - (centerX - 0) / _recVisualScale;
      targetScrollTime = Math.max(0, targetScrollTime);
      var maxScrollTime = _recVisualMaxTime - wrap.clientWidth / _recVisualScale;
      targetScrollTime = Math.min(targetScrollTime, maxScrollTime);
      _recVisualScrollX = targetScrollTime * _recVisualScale;
      updateHScrollbar();
      updateRangeBar();
    }
    
    renderRecVisual();
    
    var maxNoteTime = 0;
    for (var j = 0; j < _recVisualNotes.length; j++) {
      var trackInfo2 = parseInt(_recVisualNotes[j].track);
      if (isNaN(trackInfo2)) trackInfo2 = 0;
      var melodyId2 = _recVisualNotes[j].melodyId || (trackInfo2 >= 0 ? 'main' : 'accomp');
      var shouldCount = _recVisualPlayTracks[melodyId2] !== false;
      if (!shouldCount) continue;
      
      var noteEnd = _recVisualNotes[j].timeMs + _recVisualNotes[j].holdMs;
      if (noteEnd > maxNoteTime) {
        maxNoteTime = noteEnd;
      }
    }
    var stopTime = Math.max(maxNoteTime + 500, _recVisualMaxTime);
    
    if (_recVisualPlayTime >= stopTime) {
      _recVisualPlaying = false;
      for (var k = 0; k < _recVisualNotes.length; k++) {
        try { stopNote('visPlay_' + k); } catch(e) {}
        _recVisualNotes[k]._playing = false;
      }
      var playBtn = document.getElementById('recVisualPlay');
      if (playBtn) playBtn.textContent = '▶ 播放';
      return;
    }
    
    _recVisualPlayAnimId = requestAnimationFrame(visualPlayLoop);
  }

  function playNoteImmediate(inst, note, duration) {
    initAudio();
    var freq = noteToFreq(note);
    if (!freq) return;
    
    var instType = getInstType(inst);
    var savedInst = currentInst;
    currentInst = instType;
    
    var result = startInstrumentNote(freq);
    if (result && result.env) {
      var now = audioCtx.currentTime;
      var dur = Math.min(duration / 1000, 3);
      result.env.gain.cancelScheduledValues(now);
      result.env.gain.setValueAtTime(result.env.gain.value, now);
      result.env.gain.exponentialRampToValueAtTime(0.001, now + dur);
      result.nodes.forEach(function(osc) {
        if (osc.stop) osc.stop(now + dur + 0.1);
      });
    }
    
    currentInst = savedInst;
  }

  function noteToFreq(note) {
    var notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    var match = note.match(/([A-G])(#?)(\d)/);
    if (!match) return null;
    var n = match[1];
    var sharp = match[2] === '#';
    var octave = parseInt(match[3]);
    var idx = notes.indexOf(n);
    var semitones = idx + (sharp ? 1 : 0);
    var midi = 12 + (octave * 12) + semitones;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function getInstType(inst) {
    var map = {
      '钢琴': 'piano',
      '吉他': 'guitar',
      '小提琴': 'violin',
      '大提琴': 'cello',
      '箫': 'xiao',
      '笛子': 'dizi',
      '古筝': 'guzheng',
      '二胡': 'erhu',
      '琵琶': 'pipa',
      '鼓': 'drum',
      '架子鼓': 'drumkit',
      '钟声': 'bell',
      '唢呐': 'suona',
      '贝斯': 'bass',
      '萨克斯': 'saxophone'
    };
    return map[inst] || 'piano';
  }

  function parseTextToVisual() {
    _recVisualNotes = [];
    _recVisualHistory = [];
    _recVisualHistoryIdx = -1;
    _recVisualSelected = null;
    _recVisualSelectedNotes = [];
    _recVisualPlayTime = 0;
    updatePropsPanel();
    
    var scoreTextArea = document.getElementById('recEditScoreText');
    if (scoreTextArea) {
      setMelodyText(_recVisualTextTrack, scoreTextArea.value.trim());
    }
    
    function getTrackFromNote(note) {
      if (_recVisualNoteToTrackMap && _recVisualNoteToTrackMap[note] !== undefined) {
        return _recVisualNoteToTrackMap[note];
      }
      return 0;
    }
    
    _melodyList.forEach(function(melody, melodyIndex) {
      var text = melody.text;
      if (!text) return;
      
      var notes = text.split('_');
      notes.forEach(function(noteStr) {
        if (!noteStr.trim()) return;
        var parts = noteStr.split('|');
        if (parts.length >= 4) {
          var inst = parts[0];
          var note = parts[1];
          var volume = 100;
          var holdMs, timeMs, trackFromText;
          
          var isNewFormat = parts.length >= 5 && !isNaN(parseInt(parts[2])) && String(parts[2]).indexOf('ms') === -1;
          if (isNewFormat) {
            volume = parseInt(parts[2]) || 100;
            holdMs = parseInt(parts[3]) || 200;
            timeMs = parseInt(parts[4]) || 0;
            trackFromText = parseInt(parts[5]);
          } else {
            holdMs = parseInt(parts[2]) || 200;
            timeMs = parseInt(parts[3]) || 0;
            trackFromText = parseInt(parts[4]);
          }
          
          volume = Math.max(30, Math.min(100, volume));
          
          var trackFromNote = getTrackFromNote(note);
          
          var trackValue;
          if (melodyIndex === 0) {
            trackValue = trackFromNote;
          } else {
            trackValue = -(melodyIndex * 49 + trackFromNote);
          }
          
          _recVisualNotes.push({
            inst: inst,
            note: note,
            volume: volume,
            holdMs: holdMs,
            timeMs: timeMs,
            track: trackValue,
            melodyId: melody.id
          });
        }
      });
    });
    
    var maxTimeInput = document.getElementById('recVisualMaxTimeInput');
    if (maxTimeInput) {
      maxTimeInput.value = Math.round(_recVisualMaxTime / 1000) + 's';
    }
  }

  function parseVisualToText() {
    _melodyList.forEach(function(melody) {
      melody.text = '';
    });
    
    var melodyNotesMap = {};
    _melodyList.forEach(function(melody) {
      melodyNotesMap[melody.id] = [];
    });
    
    _recVisualNotes.forEach(function(n) {
      var melodyId = n.melodyId || 'main';
      if (!melodyNotesMap[melodyId]) {
        melodyNotesMap[melodyId] = [];
      }
      
      var t = parseInt(n.track);
      if (isNaN(t)) t = 0;
      
      var displayTrack = t;
      if (t < 0) {
        displayTrack = Math.abs(t) % 49;
      }
      
      var volume = n.volume || 100;
      volume = Math.max(30, Math.min(100, volume));
      
      var noteName = (typeof n.note === 'string') ? n.note : String(n.note);
      var noteStr = n.inst + '|' + noteName + '|' + volume + '|' + n.holdMs + '|' + n.timeMs + '|' + displayTrack;
      melodyNotesMap[melodyId].push(noteStr);
    });
    
    _melodyList.forEach(function(melody) {
      var notes = melodyNotesMap[melody.id] || [];
      notes.sort(function(a, b) {
        var aParts = a.split('|');
        var bParts = b.split('|');
        var aTime = parseInt(aParts[4]) || 0;
        var bTime = parseInt(bParts[4]) || 0;
        return aTime - bTime;
      });
      melody.text = notes.join('_');
    });
    
    var scoreTextArea = document.getElementById('recEditScoreText');
    if (scoreTextArea) {
      scoreTextArea.value = getMelodyText(_recVisualTextTrack);
    }
    
    renderMelodyListModal();
  }

  var _recVisualVScrollbarDragging = false;
  var _recVisualVScrollbarDragStartY = 0;
  var _recVisualVScrollbarDragStartScrollY = 0;
  var _recVisualVScrollbarDragType = null;
  var _recVisualVScrollbarDragStartThumbTop = 0;
  var _recVisualVScrollbarDragStartThumbHeight = 0;
  var _recVisualVScrollbarDragStartZoom = 0;
  var _recVisualVScrollbarDragStartStartTime = 0;
  var _recVisualVScrollbarDragStartEndTime = 0;
  var _recVisualVScrollbarDragStartStartTrack = 0;
  var _recVisualVScrollbarDragStartEndTrack = 0;
  
  var _recVisualHScrollbarDragging = false;
  var _recVisualHScrollbarDragStartX = 0;
  var _recVisualHScrollbarDragStartScrollX = 0;
  var _recVisualHScrollbarDragType = null;
  var _recVisualHScrollbarDragStartThumbLeft = 0;
  var _recVisualHScrollbarDragStartThumbWidth = 0;
  var _recVisualHScrollbarDragStartZoom = 0;
  var _recVisualHScrollbarDragStartStartTime = 0;
  var _recVisualHScrollbarDragStartEndTime = 0;

  // 辅助函数：获取事件坐标，同时支持鼠标和触摸
  function getEventCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  }

  function updateVScrollbar() {
    var thumb = document.getElementById('recVisualVThumb');
    var handleTop = document.getElementById('recVisualVHandleTop');
    var handleBottom = document.getElementById('recVisualVHandleBottom');
    var wrap = document.getElementById('recVisualCanvasWrap');
    var container = document.getElementById('recVisualCanvasContainer');
    var scrollbar = document.getElementById('recVisualVScrollbar');
    if (!thumb || !wrap || !scrollbar) return;
    
    var h = container ? container.clientHeight : wrap.clientHeight;
    var barH = scrollbar.clientHeight;
    var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
    var totalContentHeight = _recVisualMaxTracks;
    var maxScrollY = Math.max(0, totalContentHeight - visibleTracks);
    
    var thumbHeight, thumbTop;
    
    if (maxScrollY <= 0) {
      // 当完全占满时，滑块占满整个滚动条，但留出一点边距
      thumbHeight = Math.max(20, barH - 4);
      thumbTop = 2;
    } else {
      thumbHeight = Math.max(20, Math.floor((visibleTracks / totalContentHeight) * barH));
      thumbTop = Math.floor((_recVisualStartTrack / maxScrollY) * (barH - thumbHeight));
    }
    
    thumb.style.display = 'block';
    thumb.style.height = thumbHeight + 'px';
    thumb.style.top = thumbTop + 'px';
    
    if (handleTop) {
      handleTop.style.display = 'block';
      handleTop.style.top = thumbTop + 'px';
    }
    if (handleBottom) {
      handleBottom.style.display = 'block';
      handleBottom.style.top = (thumbTop + thumbHeight - 10) + 'px';
    }
  }

  function onVScrollbarDrag(e) {
    e.preventDefault();
    var wrap = document.getElementById('recVisualCanvasWrap');
    var container = document.getElementById('recVisualCanvasContainer');
    var scrollbar = document.getElementById('recVisualVScrollbar');
    if (!wrap || !container || !scrollbar) return;
    
    var coords = getEventCoords(e);
    var barH = scrollbar.clientHeight;
    var dy = coords.y - _recVisualVScrollbarDragStartY;
    var h = container ? container.clientHeight : wrap.clientHeight;
    
    if (_recVisualVScrollbarDragType === 'resize-top') {
      // 拖动上端点，下端点保持不动 - 完全照着功能映射区
      var trackDelta = dy / barH * _recVisualMaxTracks;
      var newStartTrack = _recVisualVScrollbarDragStartStartTrack + trackDelta;
      var endTrack = _recVisualVScrollbarDragStartEndTrack;
      
      newStartTrack = Math.max(0, newStartTrack);
      
      var newVisibleTracks = endTrack - newStartTrack;
      newVisibleTracks = Math.max(7, newVisibleTracks); // 一个音域最少7个轨道
      
      _recVisualStartTrack = newStartTrack;
      _recVisualEndTrack = _recVisualStartTrack + newVisibleTracks;
    } else if (_recVisualVScrollbarDragType === 'resize-bottom') {
      // 拖动下端点，上端点保持不动 - 完全照着功能映射区
      var trackDelta = dy / barH * _recVisualMaxTracks;
      var newEndTrack = _recVisualVScrollbarDragStartEndTrack + trackDelta;
      var startTrack = _recVisualVScrollbarDragStartStartTrack;
      
      newEndTrack = Math.min(_recVisualMaxTracks, newEndTrack);
      
      var newVisibleTracks = newEndTrack - startTrack;
      newVisibleTracks = Math.max(7, newVisibleTracks); // 一个音域最少7个轨道
      
      _recVisualEndTrack = newEndTrack;
      _recVisualStartTrack = _recVisualEndTrack - newVisibleTracks;
    } else {
      // 拖动滑块中间，实现滚动
      var thumb = document.getElementById('recVisualVThumb');
      var thumbHeight = parseInt(thumb.style.height) || 30;
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      var totalContentHeight = _recVisualMaxTracks;
      var maxScrollY = Math.max(0, totalContentHeight - visibleTracks);
      var scrollRange = barH - thumbHeight;
      var scrollDelta = (dy / scrollRange) * maxScrollY;
      var newStartTrack = _recVisualVScrollbarDragStartStartTrack + scrollDelta;
      newStartTrack = Math.max(0, Math.min(maxScrollY, newStartTrack));
      _recVisualStartTrack = newStartTrack;
      _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
    }
    
    renderRecVisual();
    updateRangeBar();
    updateVScrollbar();
    
    // 同步琴键滚动位置
    syncPianoScrollImmediate();
  }

  function onVScrollbarDragEnd() {
    _recVisualVScrollbarDragging = false;
    _recVisualVScrollbarDragType = null;
    saveVisualEditorSettings();
    // 移除高亮效果
    var thumb = document.getElementById('recVisualVThumb');
    var handleTop = document.getElementById('recVisualVHandleTop');
    var handleBottom = document.getElementById('recVisualVHandleBottom');
    if (thumb) {
      thumb.style.boxShadow = '';
    }
    if (handleTop) {
      handleTop.style.boxShadow = '';
    }
    if (handleBottom) {
      handleBottom.style.boxShadow = '';
    }
    document.removeEventListener('mousemove', onVScrollbarDrag);
    document.removeEventListener('mouseup', onVScrollbarDragEnd);
    document.removeEventListener('touchmove', onVScrollbarDrag);
    document.removeEventListener('touchend', onVScrollbarDragEnd);
  }
  
  function updateHScrollbar() {
    var thumb = document.getElementById('recVisualHThumb');
    var handleLeft = document.getElementById('recVisualHHandleLeft');
    var handleRight = document.getElementById('recVisualHHandleRight');
    var wrap = document.getElementById('recVisualCanvasWrap');
    var scrollbar = document.getElementById('recVisualHScrollbar');
    if (!thumb || !wrap || !scrollbar) return;
    
    var w = wrap.clientWidth;
    var barW = scrollbar.clientWidth;
    var visibleTime = w / _recVisualZoom;
    var totalContentWidth = _recVisualMaxTime * _recVisualZoom;
    var maxScrollX = Math.max(0, totalContentWidth - w);
    
    var thumbWidth, thumbLeft;
    
    if (maxScrollX <= 0) {
      // 当完全占满时，滑块占满整个滚动条，但留出一点边距
      thumbWidth = Math.max(30, barW - 4);
      thumbLeft = 2;
    } else {
      thumbWidth = Math.max(30, Math.floor((w / totalContentWidth) * barW));
      thumbLeft = Math.floor((_recVisualScrollX / maxScrollX) * (barW - thumbWidth));
    }
    
    thumb.style.display = 'block';
    thumb.style.width = thumbWidth + 'px';
    thumb.style.left = thumbLeft + 'px';
    
    if (handleLeft) {
      handleLeft.style.display = 'block';
      handleLeft.style.left = thumbLeft + 'px';
    }
    if (handleRight) {
      handleRight.style.display = 'block';
      handleRight.style.left = (thumbLeft + thumbWidth - 10) + 'px';
    }
  }
  
  function onHScrollbarDrag(e) {
    e.preventDefault();
    var wrap = document.getElementById('recVisualCanvasWrap');
    var scrollbar = document.getElementById('recVisualHScrollbar');
    if (!wrap || !scrollbar) return;
    
    var coords = getEventCoords(e);
    var barW = scrollbar.clientWidth;
    var dx = coords.x - _recVisualHScrollbarDragStartX;
    var w = wrap.clientWidth;
    
    if (_recVisualHScrollbarDragType === 'resize-left') {
      // 拖动左端点，右端点保持不动 - 完全照着功能映射区
      var timeDelta = dx / barW * _recVisualMaxTime;
      var newStartTime = _recVisualHScrollbarDragStartStartTime + timeDelta;
      var endTime = _recVisualHScrollbarDragStartEndTime;
      
      newStartTime = Math.max(0, newStartTime);
      
      var newVisibleTime = endTime - newStartTime;
      newVisibleTime = Math.max(4000, newVisibleTime);
      var newZoom = w / newVisibleTime;
      _recVisualZoom = newZoom;
      _recVisualScrollX = newStartTime * newZoom;
    } else if (_recVisualHScrollbarDragType === 'resize-right') {
      // 拖动右端点，左端点保持不动 - 完全照着功能映射区
      var timeDelta = dx / barW * _recVisualMaxTime;
      var newEndTime = _recVisualHScrollbarDragStartEndTime + timeDelta;
      var startTime = _recVisualHScrollbarDragStartStartTime;
      
      newEndTime = Math.min(_recVisualMaxTime, newEndTime);
      
      var newVisibleTime = newEndTime - startTime;
      newVisibleTime = Math.max(4000, newVisibleTime);
      var newZoom = w / newVisibleTime;
      _recVisualZoom = newZoom;
      _recVisualScrollX = startTime * newZoom;
    } else {
      // 拖动滑块中间，实现滚动
      var thumb = document.getElementById('recVisualHThumb');
      var thumbWidth = parseInt(thumb.style.width) || 30;
      var visibleTime = w / _recVisualZoom;
      var totalContentWidth = _recVisualMaxTime * _recVisualZoom;
      var maxScrollX = Math.max(0, totalContentWidth - w);
      var scrollRange = barW - thumbWidth;
      var scrollDelta = (dx / scrollRange) * maxScrollX;
      var newScrollX = _recVisualHScrollbarDragStartScrollX + scrollDelta;
      newScrollX = Math.max(0, Math.min(maxScrollX, newScrollX));
      _recVisualScrollX = newScrollX;
    }
    
    renderRecVisual();
    updateRangeBar();
    updateHScrollbar();
  }
  
  function onHScrollbarDragEnd() {
    _recVisualHScrollbarDragging = false;
    _recVisualHScrollbarDragType = null;
    saveVisualEditorSettings();
    // 移除高亮效果
    var thumb = document.getElementById('recVisualHThumb');
    var handleLeft = document.getElementById('recVisualHHandleLeft');
    var handleRight = document.getElementById('recVisualHHandleRight');
    if (thumb) {
      thumb.style.boxShadow = '';
    }
    if (handleLeft) {
      handleLeft.style.boxShadow = '';
    }
    if (handleRight) {
      handleRight.style.boxShadow = '';
    }
    document.removeEventListener('mousemove', onHScrollbarDrag);
    document.removeEventListener('mouseup', onHScrollbarDragEnd);
    document.removeEventListener('touchmove', onHScrollbarDrag);
    document.removeEventListener('touchend', onHScrollbarDragEnd);
  }

  function adjustToolbarResponsive() {
    var toolbar = document.getElementById('recVisualToolbar');
    if (!toolbar) return;
    
    var width = window.innerWidth;
    var isNarrow = width < 500;
    var isVeryNarrow = width < 380;
    
    var gap = isVeryNarrow ? '4px' : (isNarrow ? '6px' : '8px');
    var btnGap = isVeryNarrow ? '2px' : (isNarrow ? '3px' : '4px');
    var fontSize = isVeryNarrow ? '10px' : (isNarrow ? '10px' : '11px');
    var btnHeight = isVeryNarrow ? '24px' : '28px';
    var inputWidth = isVeryNarrow ? '40px' : (isNarrow ? '45px' : '50px');
    var labelSize = isVeryNarrow ? '9px' : (isNarrow ? '10px' : '11px');
    
    toolbar.style.gap = gap;
    
    var playBtns = document.getElementById('recVisualPlayBtns');
    if (playBtns) playBtns.style.gap = btnGap;
    
    var editBtns = document.getElementById('recVisualEditBtns');
    if (editBtns) editBtns.style.gap = btnGap;
    
    var bpmArea = document.getElementById('recVisualBPMArea');
    if (bpmArea) bpmArea.style.gap = btnGap;
    
    var timeArea = document.getElementById('recVisualTimeArea');
    if (timeArea) timeArea.style.gap = btnGap;
    
    document.querySelectorAll('.toolbar-btn').forEach(function(btn) {
      btn.style.fontSize = fontSize;
      btn.style.height = btnHeight;
      if (isVeryNarrow) {
        btn.style.padding = '0 4px';
      } else if (isNarrow) {
        btn.style.padding = '0 6px';
      }
    });
    
    document.querySelectorAll('.toolbar-input').forEach(function(input) {
      input.style.fontSize = fontSize;
      input.style.height = btnHeight;
      input.style.width = inputWidth;
    });
    
    document.querySelectorAll('.toolbar-label').forEach(function(label) {
      label.style.fontSize = labelSize;
    });
    
    document.querySelectorAll('.toolbar-area').forEach(function(area) {
      area.style.fontSize = labelSize;
    });
    
    document.querySelectorAll('.toolbar-btns').forEach(function(div) {
      div.style.gap = btnGap;
    });
  }

  function renderRecVisual() {
    if (!_recVisualCanvas || !_recVisualCtx) {
      return;
    }
    
    var wrap = document.getElementById('recVisualCanvasWrap');
    var container = document.getElementById('recVisualCanvasContainer');
    var w = container ? container.clientWidth : wrap.clientWidth;
    var baseH = container ? container.clientHeight : wrap.clientHeight;
    
    if (w <= 0 || baseH <= 0) return;
    
    var displayTracks = _recVisualEndTrack - _recVisualStartTrack;
    displayTracks = Math.max(7, Math.min(49, displayTracks));
    
    var h = baseH;
    
    if (_recVisualCanvas.width !== w) _recVisualCanvas.width = w;
    if (_recVisualCanvas.height !== h) _recVisualCanvas.height = h;
    
    var ctx = _recVisualCtx;
    ctx.fillStyle = '#1e1e22';
    ctx.fillRect(0, 0, w, h);
    
    var padding = 0;
    var timelineH = 28;
    // 使用可见轨道数来计算轨道高度（支持垂直缩放）
    var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
    visibleTracks = Math.max(7, Math.min(49, visibleTracks));
    // 使用琴键容器的可见高度来计算轨道高度，确保与琴键完全同步
    var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : (h - timelineH);
    var trackH = pianoViewH / visibleTracks;
    trackH = Math.max(12, Math.min(100, trackH));
    var whiteKeyHeight = trackH;
    var blackKeyHeight = whiteKeyHeight * 0.6;
    
    // 更新琴键高度以匹配轨道缩放（带缓存，避免不必要的DOM操作）
    if (_recVisualAllKeys && _recVisualAllKeys.length > 0) {
      _recVisualAllKeys.forEach(function(keyInfo) {
        if (keyInfo.isBlack) {
          var newH = blackKeyHeight + 'px';
          var whiteKeyPos = keyInfo.trackIndex;
          var newTop = (whiteKeyPos * whiteKeyHeight + whiteKeyHeight / 2 - blackKeyHeight / 2) + 'px';
          // 只在值变化时才更新
          if (keyInfo.element.style.height !== newH) keyInfo.element.style.height = newH;
          if (keyInfo.element.style.top !== newTop) keyInfo.element.style.top = newTop;
        } else {
          var newH2 = whiteKeyHeight + 'px';
          var newTop2 = (keyInfo.trackIndex * whiteKeyHeight) + 'px';
          if (keyInfo.element.style.height !== newH2) keyInfo.element.style.height = newH2;
          if (keyInfo.element.style.top !== newTop2) keyInfo.element.style.top = newTop2;
        }
      });
    }
    
    // 更新琴键容器总高度（带缓存）
    if (_recVisualPianoContent) {
      var totalHeight = 49 * whiteKeyHeight;
      var totalHeightStr = totalHeight + 'px';
      if (_recVisualPianoContent.style.height !== totalHeightStr) {
        _recVisualPianoContent.style.height = totalHeightStr;
      }
    }
    
    if (_recVisualZoom <= 0) _recVisualZoom = 1;
    var visibleTime = w / _recVisualZoom;
    _recVisualScale = w / visibleTime;
    if (_recVisualScale <= 0) _recVisualScale = 1;
    
    var scrollTime = _recVisualScrollX / _recVisualScale;
    
    var endX = padding + (_recVisualMaxTime - scrollTime) * _recVisualScale;
    if (endX >= 0 && endX <= w) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(endX, timelineH);
      ctx.lineTo(endX, h);
      ctx.stroke();
      
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((_recVisualMaxTime / 1000).toFixed(1) + 's', endX, timelineH - 2);
    }
    
    var beatMs = getBeatDuration();
    if (typeof _recVisualTimeSig !== 'string') {
      _recVisualTimeSig = "4/4";
    }
    var timeSigParts = _recVisualTimeSig.split('/');
    var beatsPerMeasure = parseInt(timeSigParts[0]) || 4;
    var beatUnit = parseInt(timeSigParts[1]) || 4;
    var measureMs = beatMs * beatsPerMeasure * (4 / beatUnit);
    var quarterMs = beatMs;
    var eighthMs = beatMs / 2;
    var sixteenthMs = beatMs / 4;
    var thirtySecondMs = beatMs / 8;
    
    function drawTimelineMark(x, height, color) {
      if (x < -10 || x > w + 10) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 时间轴背景：深蓝灰色，符合主题配色
    ctx.fillStyle = '#1e1e28';
    ctx.fillRect(0, 0, w, timelineH);
    
    // 时间轴底部边界线：主题色，清晰区分时间轴和轨道
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, timelineH);
    ctx.lineTo(w, timelineH);
    ctx.stroke();
    
    var startTick = Math.floor(scrollTime / thirtySecondMs);
    var totalTicks = Math.ceil((scrollTime + visibleTime) / thirtySecondMs);
    for (var t = startTick; t <= totalTicks; t++) {
      var tickTime = t * thirtySecondMs;
      var tx = padding + (tickTime - scrollTime) * _recVisualScale;
      if (tx < -10) continue;
      if (tx > w + 10) break;
      
      var isMeasureStart = (t % (beatsPerMeasure * 8) === 0);
      var isQuarter = (t % 8 === 0);
      var isEighth = (t % 4 === 0);
      var isSixteenth = (t % 2 === 0);
      
      if (isMeasureStart) {
        ctx.strokeStyle = '#7080a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH);
        ctx.stroke();
        
        ctx.fillStyle = '#c0c8d8';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var measureNum = Math.floor(t / (beatsPerMeasure * 8));
        ctx.fillText(measureNum, tx, timelineH / 2);
      } else if (isQuarter) {
        drawTimelineMark(tx, timelineH, '#506070');
      } else if (isEighth) {
        drawTimelineMark(tx, timelineH * 0.7, '#404858');
      } else if (isSixteenth) {
        drawTimelineMark(tx, timelineH * 0.4, '#303848');
      } else {
        drawTimelineMark(tx, timelineH * 0.25, '#303848');
      }
    }
    
    // ========== 音符绘制（时间轴层级之下）==========
    
    ctx.strokeStyle = 'rgba(60, 60, 80, 0.3)';
    ctx.lineWidth = 1;
    // 轨道线使用与音符完全相同的计算逻辑，绘制所有49条轨道的顶部边界线
    for (var lineIdx = 0; lineIdx < 49; lineIdx++) {
      var relativeIdx = lineIdx - _recVisualStartTrack;
      var trackY = timelineH + relativeIdx * trackH;
      // 只绘制在画布可见范围内的轨道线
      if (trackY < -trackH || trackY > h + trackH) continue;
      ctx.beginPath();
      ctx.moveTo(0, trackY);
      ctx.lineTo(w, trackY);
      ctx.stroke();
    }
    

    
    var measureMs = beatMs * beatsPerMeasure;
    var startMeasure = Math.floor(scrollTime / measureMs);
    var totalMeasures = Math.ceil((scrollTime + visibleTime) / measureMs);
    for (var m = startMeasure; m <= totalMeasures; m++) {
      var measureTime = m * measureMs;
      var mx = padding + (measureTime - scrollTime) * _recVisualScale;
      if (mx < -w) continue;
      if (mx > w * 2) break;
      
      if (m % 2 === 1) {
        var nextMx = mx + measureMs * _recVisualScale;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(mx, timelineH, Math.min(nextMx - mx, w - mx), h - timelineH);
      }
    }
    
    var startTick2 = Math.floor(scrollTime / thirtySecondMs);
    var totalTicks2 = Math.ceil((scrollTime + visibleTime) / thirtySecondMs);
    for (var t = startTick2; t <= totalTicks2; t++) {
      var tickTime = t * thirtySecondMs;
      var tx2 = padding + (tickTime - scrollTime) * _recVisualScale;
      if (tx2 < -10) continue;
      if (tx2 > w + 10) break;
      
      var isMeasureStart = (t % (beatsPerMeasure * 8) === 0);
      var isQuarter = (t % 8 === 0);
      var isEighth = (t % 4 === 0);
      var isSixteenth = (t % 2 === 0);
      
      ctx.lineWidth = 1;
      if (isMeasureStart) {
        ctx.strokeStyle = '#444466';
      } else if (isQuarter) {
        ctx.strokeStyle = '#333355';
      } else if (isEighth) {
        ctx.strokeStyle = 'rgba(40, 40, 60, 0.5)';
      } else if (isSixteenth) {
        ctx.strokeStyle = 'rgba(30, 30, 50, 0.4)';
      } else {
        ctx.strokeStyle = 'rgba(25, 25, 40, 0.25)';
      }
      ctx.beginPath();
      ctx.moveTo(tx2, timelineH);
      ctx.lineTo(tx2, h);
      ctx.stroke();
    }
    
    _recVisualNotes.forEach(function(n, idx) {
      var trackInfo = parseInt(n.track);
      if (isNaN(trackInfo)) trackInfo = 0;
      
      var noteMelodyId = n.melodyId || (trackInfo >= 0 ? 'main' : 'accomp');
      var isShowInEditor = _recVisualShowMelodies.indexOf(noteMelodyId) !== -1;
      
      // 先计算音符位置属性（用于点击检测）
      var x = padding + (n.timeMs - scrollTime) * _recVisualScale;
      var noteW = Math.max(n.holdMs * _recVisualScale, 2);
      
      var trackIdx = trackInfo;
      var displayIdx;
      
      if (trackIdx < 0) {
        displayIdx = Math.abs(trackIdx) % 49;
      } else {
        displayIdx = trackIdx;
        if (_recVisualTrackToDisplayMap[trackIdx] !== undefined) {
          displayIdx = _recVisualTrackToDisplayMap[trackIdx];
        }
      }
      
      var relativeDisplayIdx = displayIdx - _recVisualStartTrack;
      var y = timelineH + relativeDisplayIdx * trackH;
      var noteH = trackH;
      
      // 设置位置属性（用于点击检测）
      n._x = x;
      n._y = y;
      n._w = noteW;
      n._h = noteH;
      n._track = trackInfo;
      n._idx = idx;
      
      // 只有旋律不显示时才跳过，其他任何情况都绘制音符
      if (!isShowInEditor) return;
      
      var isSelected = (_recVisualSelected === n);
      var isMultiSelected = _recVisualSelectedNotes.indexOf(n) !== -1;
      
      var noteColors = {
        'C': 'rgba(255, 80, 80, 0.3)',
        'D': 'rgba(255, 165, 0, 0.3)',
        'E': 'rgba(255, 255, 0, 0.3)',
        'F': 'rgba(0, 200, 0, 0.3)',
        'G': 'rgba(0, 200, 200, 0.3)',
        'A': 'rgba(80, 80, 255, 0.3)',
        'B': 'rgba(180, 80, 255, 0.3)'
      };
      
      var noteStr = (typeof n.note === 'string') ? n.note : String(n.note);
      var noteKey = noteStr.charAt(0).toUpperCase();
      var noteColor = noteColors[noteKey] || 'rgba(100, 150, 200, 0.3)';
      
      if (isSelected || isMultiSelected) {
        ctx.strokeStyle = '#0099ff';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
      }
      ctx.strokeRect(x, y, noteW, noteH);
      
      ctx.fillStyle = noteColor;
      ctx.fillRect(x, y, noteW, noteH);

      ctx.fillStyle = isSelected || isMultiSelected ? '#fff' : '#bbb';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (noteW >= 30) {
        ctx.fillText(noteStr, x + 4, y + noteH / 2);
      }
    });
    
    // ========== 时间轴重新绘制（覆盖在音符之上）==========
    // 时间轴背景：深蓝灰色，无描边
    ctx.fillStyle = '#252535';
    ctx.fillRect(0, 0, w, timelineH);
    
    // 绘制时间刻度 - 使用与前面相同的 thirtySecondMs 基准
    for (var t = startTick; t <= totalTicks; t++) {
      var tickTime = t * thirtySecondMs;
      var tx = padding + (tickTime - scrollTime) * _recVisualScale;
      if (tx < -10) continue;
      if (tx > w + 10) break;
      
      var isMeasureStart = (t % (beatsPerMeasure * 8) === 0);
      var isQuarter = (t % 8 === 0);
      var isEighth = (t % 4 === 0);
      var isSixteenth = (t % 2 === 0);
      
      if (isMeasureStart) {
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH);
        ctx.stroke();
        
        ctx.fillStyle = '#778899';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var measureNum = Math.floor(t / (beatsPerMeasure * 8));
        ctx.fillText(measureNum, tx, timelineH / 2);
      } else if (isQuarter) {
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH * 0.6);
        ctx.stroke();
      } else if (isEighth) {
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH * 0.4);
        ctx.stroke();
      } else if (isSixteenth) {
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH * 0.3);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, timelineH * 0.2);
        ctx.stroke();
      }
    }
    
    // 时间刻度线一直显示
    var playX = padding + (_recVisualPlayTime - scrollTime) * _recVisualScale;
    if (playX >= 0 && playX <= w) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
      
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(playX - 6, 0);
      ctx.lineTo(playX + 6, 0);
      ctx.lineTo(playX, 10);
      ctx.closePath();
      ctx.fill();
    }
    
    if (_recVisualSelectBox) {
      ctx.strokeStyle = '#0099ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(_recVisualSelectBox.x, _recVisualSelectBox.y, _recVisualSelectBox.w, _recVisualSelectBox.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0, 153, 255, 0.1)';
      ctx.fillRect(_recVisualSelectBox.x, _recVisualSelectBox.y, _recVisualSelectBox.w, _recVisualSelectBox.h);
    }
    
    ctx.strokeStyle = 'rgba(80, 80, 100, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
    
    updateVScrollbar();
    updateHScrollbar();
  }

  function setupRecVisualEvents() {
    if (!_recVisualCanvas) return;
    
    var _recVisualClickCount = 0;
    var _recVisualClickTimer = null;
    
    // 通用的处理画布点击/触摸的函数
    function handleCanvasInteraction(e, isTouch) {
      e.preventDefault();
      var rect = _recVisualCanvas.getBoundingClientRect();
      var coords = getEventCoords(e);
      var x = coords.x - rect.left;
      var y = coords.y - rect.top;
      
      var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
      var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
      visibleTracks = Math.max(7, Math.min(49, visibleTracks));
      var trackH = pianoViewH / visibleTracks;
      trackH = Math.max(12, Math.min(100, trackH));
      
      var timelineH = 28;
      
      if (!isTouch && e.button === 1) {
        _recVisualMiddleDrag = true;
        _recVisualMiddleDragStartX = x;
        _recVisualMiddleDragStartY = y;
        _recVisualMiddleDragStartScrollX = _recVisualScrollX;
        _recVisualMiddleDragStartStartTrack = _recVisualStartTrack;
        _recVisualMiddleDragStartEndTrack = _recVisualEndTrack;
        _recVisualCanvas.style.cursor = 'grabbing';
        return;
      }
      
      var scrollTime = _recVisualScrollX / _recVisualScale;
      var padding = 0;
      
      var clickedNote = null;
      for (var i = _recVisualNotes.length - 1; i >= 0; i--) {
        var n = _recVisualNotes[i];
        if (x >= n._x && x <= n._x + n._w && y >= n._y && y <= n._y + n._h) {
          clickedNote = n;
          break;
        }
      }
      
      if (clickedNote) {
        if (e.ctrlKey) {
          var idx = _recVisualSelectedNotes.indexOf(clickedNote);
          if (idx !== -1) {
            _recVisualSelectedNotes.splice(idx, 1);
          } else {
            _recVisualSelectedNotes.push(clickedNote);
          }
          _recVisualSelected = null;
          updatePropsPanel();
          renderRecVisual();
          return;
        }
        
        var isInSelection = _recVisualSelectedNotes.indexOf(clickedNote) !== -1;
        
        if (!isInSelection) {
          _recVisualSelected = clickedNote;
          _recVisualSelectedNotes = [clickedNote];
          updatePropsPanel();
        }
        
        var isRightEdge = (x >= clickedNote._x + clickedNote._w - 10);
        
        if (isRightEdge) {
          saveVisualHistory();
          _recVisualDrag = {
            note: clickedNote,
            startX: x,
            startY: y,
            origHoldMs: clickedNote.holdMs
          };
          _recVisualDragMode = 'resize';
        } else {
          saveVisualHistory();
          var clickOffsetTime = (x - clickedNote._x) / _recVisualScale;
          var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
          visibleTracks = Math.max(7, Math.min(49, visibleTracks));
          var actualTrackH = pianoViewH / visibleTracks;
          actualTrackH = Math.max(12, Math.min(100, actualTrackH));
          var timelineH = 28;
          
          // 计算原始显示索引
          var origTrackIdx = parseInt(clickedNote.track) || 0;
          var origDisplayIdx;
          if (origTrackIdx < 0) {
            origDisplayIdx = Math.abs(origTrackIdx) % 49;
          } else {
            origDisplayIdx = _recVisualTrackToDisplayMap[origTrackIdx] !== undefined ? _recVisualTrackToDisplayMap[origTrackIdx] : origTrackIdx;
          }
          
          _recVisualDrag = {
            note: clickedNote,
            startX: x,
            startY: y,
            origTime: clickedNote.timeMs,
            origTrack: parseInt(clickedNote.track) || 0,
            origDisplayIdx: origDisplayIdx,
            clickOffsetTime: clickOffsetTime,
            trackH: actualTrackH,
            multiNotes: _recVisualSelectedNotes.slice()
          };
          _recVisualDrag.multiOrig = _recVisualSelectedNotes.map(function(n) {
            return { note: n, origTime: n.timeMs, origTrack: parseInt(n.track) || 0 };
          });
          _recVisualDragMode = 'move';
        }
        renderRecVisual();
      } else if (e.shiftKey) {
        saveVisualHistory();
        var newTimeMs = Math.round(scrollTime + (x - padding) / _recVisualScale);
        newTimeMs = Math.max(0, Math.min(_recVisualMaxTime - 50, newTimeMs));
        newTimeMs = snapToBeatForCreation(newTimeMs);
        
        var newTrack = Math.floor((y - timelineH) / trackH) + _recVisualStartTrack;
        newTrack = Math.max(_recVisualStartTrack, Math.min(_recVisualEndTrack - 1, newTrack));
        newTrack = Math.round(newTrack);
        
        // 获取音符名称，优先使用映射表
        var note = _recVisualTrackToNoteMap[newTrack];
        if (!note || typeof note !== 'string') {
          // 备用算法：根据显示索引计算音符名称
          var allNotes2 = ['B','A','G','F','E','D','C'];
          var octaves2 = [7, 6, 5, 4, 3, 2, 1];
          var noteInOctave2 = newTrack % 7;
          var octaveIndex2 = Math.floor(newTrack / 7);
          note = allNotes2[noteInOctave2] + octaves2[octaveIndex2];
        }
        
        var melodyIndex = _melodyList.findIndex(function(m) { return m.id === _recVisualActiveTrack; });
        if (melodyIndex > 0) {
          newTrack = -(melodyIndex * 49 + newTrack);
        }
        
        var durationVal = 0.5;
        var durSelect = document.getElementById('recVisualDuration');
        if (durSelect) durationVal = parseFloat(durSelect.value) || 0.5;
        var newHoldMs = beatsToMs(durationVal);
        
        var instSelect = document.getElementById('recVisualInst');
        var inst = instSelect ? instSelect.value : '钢琴';
        
        _recVisualNotes.push({
          inst: inst,
          note: note,
          volume: 100,
          holdMs: newHoldMs,
          timeMs: newTimeMs,
          track: newTrack,
          melodyId: _recVisualActiveTrack
        });
        _recVisualSelected = _recVisualNotes[_recVisualNotes.length - 1];
        _recVisualSelectedNotes = [];
        updatePropsPanel();
        renderRecVisual();
      } else {
        var timelineH = 28;
        
        if (y < timelineH) {
          _recVisualTimelineDrag = true;
          var newTime = scrollTime + (x - padding) / _recVisualScale;
          newTime = Math.max(0, Math.min(_recVisualMaxTime, newTime));
          newTime = snapToBeat(newTime);
          _recVisualPlayTime = newTime;
          renderRecVisual();
        } else {
          _recVisualClickCount++;
          
          var clickX = x;
          var clickY = y;
          var clickTrackH = trackH;
          var clickScrollY = _recVisualScrollY || 0;
          
          if (_recVisualClickTimer) {
            clearTimeout(_recVisualClickTimer);
          }
          
          _recVisualClickTimer = setTimeout(function() {
            if (_recVisualClickCount === 2) {
              saveVisualHistory();
              var padding = 0;
              var newTimeMs = Math.round(scrollTime + (clickX - padding) / _recVisualScale);
              newTimeMs = Math.max(0, Math.min(_recVisualMaxTime - 50, newTimeMs));
              newTimeMs = snapToBeatForCreation(newTimeMs);
            
              var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
              var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
              visibleTracks = Math.max(7, Math.min(49, visibleTracks));
              var actualTrackH = pianoViewH / visibleTracks;
              actualTrackH = Math.max(12, Math.min(100, actualTrackH));
            
              var newTrack = Math.floor((clickY - 28) / actualTrackH) + _recVisualStartTrack;
              newTrack = Math.max(_recVisualStartTrack, Math.min(_recVisualEndTrack - 1, newTrack));
              newTrack = Math.round(newTrack);
            
              // 获取音符名称，优先使用映射表
              var note = _recVisualTrackToNoteMap[newTrack];
              if (!note || typeof note !== 'string') {
                // 备用算法：根据显示索引计算音符名称
                var allNotes3 = ['B','A','G','F','E','D','C'];
                var octaves3 = [7, 6, 5, 4, 3, 2, 1];
                var noteInOctave3 = newTrack % 7;
                var octaveIndex3 = Math.floor(newTrack / 7);
                note = allNotes3[noteInOctave3] + octaves3[octaveIndex3];
              }
            
              var melodyIndex = _melodyList.findIndex(function(m) { return m.id === _recVisualActiveTrack; });
              if (melodyIndex > 0) {
                newTrack = -(melodyIndex * 49 + newTrack);
              }
            
              var durationVal = 0.5;
              var durSelect = document.getElementById('recVisualDuration');
              if (durSelect) durationVal = parseFloat(durSelect.value) || 0.5;
              var newHoldMs = beatsToMs(durationVal);
            
              var instSelect = document.getElementById('recVisualInst');
              var inst = instSelect ? instSelect.value : '钢琴';
            
              _recVisualNotes.push({
                inst: inst,
                note: note,
                volume: 100,
                holdMs: newHoldMs,
                timeMs: newTimeMs,
                track: newTrack,
                melodyId: _recVisualActiveTrack
              });
              _recVisualSelected = _recVisualNotes[_recVisualNotes.length - 1];
              _recVisualSelectedNotes = [];
              updatePropsPanel();
              renderRecVisual();
            }
            _recVisualClickCount = 0;
          }, 300);
        
        _recVisualSelectBox = { startX: x, startY: y, x: x, y: y, w: 0, h: 0 };
        _recVisualDragMode = 'select';
        _recVisualSelected = null;
        _recVisualSelectedNotes = [];
        updatePropsPanel();
        }
      }
    };
    
    _recVisualCanvas.onmousedown = function(e) {
      handleCanvasInteraction(e, false);
    };
    
    // 添加触摸事件支持
    _recVisualCanvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.touches.length === 2) {
        var rect = _recVisualCanvas.getBoundingClientRect();
        var touch1 = e.touches[0];
        var touch2 = e.touches[1];
        var centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        var centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        _recVisualTwoFingerDrag = true;
        _recVisualTwoFingerStartX = centerX;
        _recVisualTwoFingerStartY = centerY;
        _recVisualTwoFingerStartScrollX = _recVisualScrollX;
        _recVisualTwoFingerStartStartTrack = _recVisualStartTrack;
        _recVisualTwoFingerStartEndTrack = _recVisualEndTrack;
        _recVisualCanvas.style.cursor = 'grabbing';
      } else {
        handleCanvasInteraction(e, true);
      }
    }, { passive: false });
    
    _recVisualCanvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (_recVisualTwoFingerDrag && e.touches.length === 2) {
        var rect = _recVisualCanvas.getBoundingClientRect();
        var touch1 = e.touches[0];
        var touch2 = e.touches[1];
        var centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        var centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        
        var dx = centerX - _recVisualTwoFingerStartX;
        var dy = centerY - _recVisualTwoFingerStartY;
        
        var newScrollX = _recVisualTwoFingerStartScrollX - dx;
        _recVisualScrollX = Math.max(0, newScrollX);
        
        var visibleTracks = _recVisualTwoFingerStartEndTrack - _recVisualTwoFingerStartStartTrack;
        var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
        var trackH = pianoViewH / visibleTracks;
        var trackDelta = dy / trackH;
        var maxStartTrack = _recVisualMaxTracks - visibleTracks;
        var newStartTrack = _recVisualTwoFingerStartStartTrack - trackDelta;
        newStartTrack = Math.max(0, Math.min(maxStartTrack, newStartTrack));
        _recVisualStartTrack = newStartTrack;
        _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
        
        renderRecVisual();
        updateRangeBar();
        updateVScrollbar();
        
        // 同步琴键滚动位置
        syncPianoScrollImmediate();
      } else {
        var rect = _recVisualCanvas.getBoundingClientRect();
        var x = e.touches[0].clientX - rect.left;
        var y = e.touches[0].clientY - rect.top;
        
        _recVisualMousePos = { x: x, y: y };
        
        var scrollTime = _recVisualScrollX / _recVisualScale;
        
        if (_recVisualTimelineDrag) {
          var padding = 0;
          var newTime = scrollTime + (x - padding) / _recVisualScale;
          newTime = Math.max(0, Math.min(_recVisualMaxTime, newTime));
          newTime = snapToBeat(newTime);
          _recVisualPlayTime = newTime;
          renderRecVisual();
          return;
        }
        
        if (_recVisualDragMode === 'select' && _recVisualSelectBox) {
          _recVisualSelectBox.x = Math.min(x, _recVisualSelectBox.startX);
          _recVisualSelectBox.y = Math.min(y, _recVisualSelectBox.startY);
          _recVisualSelectBox.w = Math.abs(x - _recVisualSelectBox.startX);
          _recVisualSelectBox.h = Math.abs(y - _recVisualSelectBox.startY);
          renderRecVisual();
          return;
        }
        
        if (!_recVisualDrag) return;
        var dx = x - _recVisualDrag.startX;
        var dy = y - _recVisualDrag.startY;
        
        if (_recVisualDragMode === 'move') {
          var dTime = dx / _recVisualScale;
          var newTime = Math.max(0, Math.min(_recVisualMaxTime - 50, Math.round(_recVisualDrag.origTime + dTime)));
          newTime = snapToBeat(newTime);
          
          _recVisualDrag.note.timeMs = newTime;
          
          var displayTracks = _recVisualEndTrack - _recVisualStartTrack;
          displayTracks = Math.max(7, Math.min(49, displayTracks));
          var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
          var trackH = pianoViewH / displayTracks;
          trackH = Math.max(12, Math.min(100, trackH));
          
          var origDisplayIdx = _recVisualDrag.origDisplayIdx || 0;
          var trackDelta = Math.round(dy / trackH);
          var newDisplayIdx = origDisplayIdx + trackDelta;
          newDisplayIdx = Math.max(0, Math.min(48, newDisplayIdx));
          
          var noteName = _recVisualTrackToNoteMap[newDisplayIdx];
          if (!noteName) {
            var allNotes = ['B','A','G','F','E','D','C'];
            var octaves = [7, 6, 5, 4, 3, 2, 1];
            var noteInOctave = newDisplayIdx % 7;
            var octaveIndex = Math.floor(newDisplayIdx / 7);
            noteName = allNotes[noteInOctave] + octaves[octaveIndex];
          }
          
          _recVisualDrag.note.track = newDisplayIdx;
          if (typeof noteName === 'string') {
            _recVisualDrag.note.note = noteName;
          }
          
          if (_recVisualDrag.multiOrig) {
            var timeDelta = newTime - _recVisualDrag.origTime;
            _recVisualDrag.multiOrig.forEach(function(item) {
              if (item.note !== _recVisualDrag.note) {
                item.note.timeMs = Math.max(0, Math.min(_recVisualMaxTime - 50, item.origTime + timeDelta));
                
                var itemOrigDisplayIdx = parseInt(item.origTrack) || 0;
                var itemNewDisplayIdx = itemOrigDisplayIdx + trackDelta;
                itemNewDisplayIdx = Math.max(0, Math.min(48, itemNewDisplayIdx));
                
                var itemNoteName = _recVisualTrackToNoteMap[itemNewDisplayIdx];
                if (!itemNoteName) {
                  var allNotes2 = ['B','A','G','F','E','D','C'];
                  var octaves2 = [7, 6, 5, 4, 3, 2, 1];
                  var itemNoteInOctave = itemNewDisplayIdx % 7;
                  var itemOctaveIndex = Math.floor(itemNewDisplayIdx / 7);
                  itemNoteName = allNotes2[itemNoteInOctave] + octaves2[itemOctaveIndex];
                }
                
                item.note.track = itemNewDisplayIdx;
                if (typeof itemNoteName === 'string') {
                  item.note.note = itemNoteName;
                }
              }
            });
          }
        } else if (_recVisualDragMode === 'resize') {
          var dHoldMs = dx / _recVisualScale;
          var maxHoldMs = _recVisualMaxTime - _recVisualDrag.note.timeMs;
          var newHoldMs = Math.max(50, Math.min(maxHoldMs, Math.round(_recVisualDrag.origHoldMs + dHoldMs)));
          newHoldMs = snapToBeat(newHoldMs);
          _recVisualDrag.note.holdMs = newHoldMs;
        }
        renderRecVisual();
      }
    }, { passive: false });
    
    _recVisualCanvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (_recVisualTwoFingerDrag) {
        if (e.touches.length < 2) {
          _recVisualTwoFingerDrag = false;
          _recVisualCanvas.style.cursor = 'default';
          saveVisualEditorSettings();
        }
      } else {
        if (_recVisualTimelineDrag || _recVisualMiddleDrag) {
          saveVisualEditorSettings();
        }
        _recVisualTimelineDrag = false;
        _recVisualMiddleDrag = false;
        _recVisualTwoFingerDrag = false;
        _recVisualDividerDrag = false;
        _recVisualCanvas.style.cursor = 'default';
        
        if (_recVisualDragMode === 'select' && _recVisualSelectBox) {
          var box = _recVisualSelectBox;
          _recVisualSelectedNotes = [];
          _recVisualNotes.forEach(function(n) {
            if (box.x < n._x + n._w && box.x + box.w > n._x &&
                box.y < n._y + n._h && box.y + box.h > n._y) {
              _recVisualSelectedNotes.push(n);
            }
          });
          _recVisualSelectBox = null;
          updatePropsPanel();
          renderRecVisual();
        }
        
        if (_recVisualDrag) {
          if (_recVisualDrag.note) {
            var track = _recVisualDrag.note.track;
            if (track >= 0) {
              _recVisualActiveTrack = 'main';
            } else {
              _recVisualActiveTrack = 'accomp';
            }
          }
          _recVisualDrag = null;
          _recVisualDragMode = null;
        }
      }
    });
    
    _recVisualCanvas.onmousemove = function(e) {
      var rect = _recVisualCanvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      
      if (_recVisualMiddleDrag) {
        var dx = x - _recVisualMiddleDragStartX;
        var dy = y - _recVisualMiddleDragStartY;
        
        var newScrollX = _recVisualMiddleDragStartScrollX - dx;
        _recVisualScrollX = Math.max(0, newScrollX);
        
        var visibleTracks = _recVisualMiddleDragStartEndTrack - _recVisualMiddleDragStartStartTrack;
        var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
        var trackH = pianoViewH / visibleTracks;
        var trackDelta = dy / trackH;
        var maxStartTrack = _recVisualMaxTracks - visibleTracks;
        var newStartTrack = _recVisualMiddleDragStartStartTrack - trackDelta;
        newStartTrack = Math.max(0, Math.min(maxStartTrack, newStartTrack));
        _recVisualStartTrack = newStartTrack;
        _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
        
        // 使用 requestAnimationFrame 优化渲染
        if (!_recVisualMiddleDragRAF) {
          _recVisualMiddleDragRAF = requestAnimationFrame(function() {
            _recVisualMiddleDragRAF = null;
            renderRecVisual();
            updateRangeBar();
            updateVScrollbar();
            
            // 同步琴键滚动位置
            syncPianoScrollImmediate();
          });
        }
        return;
      }
      
      _recVisualMousePos = { x: x, y: y };
      
      var isOnResizeEdge = false;
      for (var i = 0; i < _recVisualNotes.length; i++) {
        var n = _recVisualNotes[i];
        if (x >= n._x + n._w - 10 && x <= n._x + n._w && y >= n._y && y <= n._y + n._h) {
          isOnResizeEdge = true;
          break;
        }
      }
      
      if (isOnResizeEdge) {
        _recVisualCanvas.style.cursor = 'ew-resize';
      } else {
        _recVisualCanvas.style.cursor = 'default';
      }
      
      var scrollTime = _recVisualScrollX / _recVisualScale;
      
      if (_recVisualTimelineDrag) {
        var padding = 0;
        var newTime = scrollTime + (x - padding) / _recVisualScale;
        newTime = Math.max(0, Math.min(_recVisualMaxTime, newTime));
        newTime = snapToBeat(newTime);
        _recVisualPlayTime = newTime;
        renderRecVisual();
        return;
      }
      
      if (_recVisualDragMode === 'select' && _recVisualSelectBox) {
        _recVisualSelectBox.x = Math.min(x, _recVisualSelectBox.startX);
        _recVisualSelectBox.y = Math.min(y, _recVisualSelectBox.startY);
        _recVisualSelectBox.w = Math.abs(x - _recVisualSelectBox.startX);
        _recVisualSelectBox.h = Math.abs(y - _recVisualSelectBox.startY);
        renderRecVisual();
        return;
      }
      
      if (!_recVisualDrag) return;
      var dx = x - _recVisualDrag.startX;
      var dy = y - _recVisualDrag.startY;
      
      if (_recVisualDragMode === 'move') {
        var dTime = dx / _recVisualScale;
        var newTime = Math.max(0, Math.min(_recVisualMaxTime - 50, Math.round(_recVisualDrag.origTime + dTime)));
        newTime = snapToBeat(newTime);
        
        _recVisualDrag.note.timeMs = newTime;
        
        var displayTracks = _recVisualEndTrack - _recVisualStartTrack;
        displayTracks = Math.max(7, Math.min(49, displayTracks));
        var pianoViewH = _recVisualPianoScroll ? _recVisualPianoScroll.clientHeight : 300;
        var trackH = pianoViewH / displayTracks;
        trackH = Math.max(12, Math.min(100, trackH));
        
        var origDisplayIdx = _recVisualDrag.origDisplayIdx || 0;
        var trackDelta = Math.round(dy / trackH);
        var newDisplayIdx = origDisplayIdx + trackDelta;
        newDisplayIdx = Math.max(0, Math.min(48, newDisplayIdx));
        
        // 使用 _recVisualTrackToNoteMap 获取正确的音符名称
        var noteName = _recVisualTrackToNoteMap[newDisplayIdx];
        if (!noteName) {
          var allNotes = ['B','A','G','F','E','D','C'];
          var octaves = [7, 6, 5, 4, 3, 2, 1];
          var noteInOctave = newDisplayIdx % 7;
          var octaveIndex = Math.floor(newDisplayIdx / 7);
          noteName = allNotes[noteInOctave] + octaves[octaveIndex];
        }
        
        _recVisualDrag.note.track = newDisplayIdx;
        if (typeof noteName === 'string') {
          _recVisualDrag.note.note = noteName;
        }
        
        if (_recVisualDrag.multiOrig) {
          var timeDelta = newTime - _recVisualDrag.origTime;
          _recVisualDrag.multiOrig.forEach(function(item) {
            if (item.note !== _recVisualDrag.note) {
              item.note.timeMs = Math.max(0, Math.min(_recVisualMaxTime - 50, item.origTime + timeDelta));
              
              var itemOrigDisplayIdx = parseInt(item.origTrack) || 0;
              var itemNewDisplayIdx = itemOrigDisplayIdx + trackDelta;
              itemNewDisplayIdx = Math.max(0, Math.min(48, itemNewDisplayIdx));
              
              var itemNoteName = _recVisualTrackToNoteMap[itemNewDisplayIdx];
              if (!itemNoteName) {
                var allNotes2 = ['B','A','G','F','E','D','C'];
                var octaves2 = [7, 6, 5, 4, 3, 2, 1];
                var itemNoteInOctave = itemNewDisplayIdx % 7;
                var itemOctaveIndex = Math.floor(itemNewDisplayIdx / 7);
                itemNoteName = allNotes2[itemNoteInOctave] + octaves2[itemOctaveIndex];
              }
              
              item.note.track = itemNewDisplayIdx;
              if (typeof itemNoteName === 'string') {
                item.note.note = itemNoteName;
              }
            }
          });
        }
      } else if (_recVisualDragMode === 'resize') {
        var dHoldMs = dx / _recVisualScale;
        var maxHoldMs = _recVisualMaxTime - _recVisualDrag.note.timeMs;
        var newHoldMs = Math.max(50, Math.min(maxHoldMs, Math.round(_recVisualDrag.origHoldMs + dHoldMs)));
        newHoldMs = snapToBeat(newHoldMs);
        _recVisualDrag.note.holdMs = newHoldMs;
      }
      renderRecVisual();
    };
    
    _recVisualCanvas.onmouseup = function() {
      if (_recVisualTimelineDrag || _recVisualMiddleDrag) {
        saveVisualEditorSettings();
      }
      _recVisualTimelineDrag = false;
      _recVisualMiddleDrag = false;
      _recVisualTwoFingerDrag = false;
      _recVisualDividerDrag = false;
      _recVisualCanvas.style.cursor = 'default';
      
      if (_recVisualDragMode === 'select' && _recVisualSelectBox) {
        var box = _recVisualSelectBox;
        _recVisualSelectedNotes = [];
        _recVisualNotes.forEach(function(n) {
          if (box.x < n._x + n._w && box.x + box.w > n._x &&
              box.y < n._y + n._h && box.y + box.h > n._y) {
            _recVisualSelectedNotes.push(n);
          }
        });
        _recVisualSelectBox = null;
        updatePropsPanel();
        renderRecVisual();
      }
      
      if (_recVisualDrag) {
        if (_recVisualDrag.note) {
          var track = _recVisualDrag.note.track;
          if (track >= 0) {
            _recVisualActiveTrack = 'main';
          } else {
            _recVisualActiveTrack = 'accomp';
          }
        }
        _recVisualDrag = null;
        _recVisualDragMode = null;
      }
    };
    
    _recVisualCanvas.onmouseleave = function() {
      _recVisualMiddleDrag = false;
      _recVisualTwoFingerDrag = false;
      _recVisualDividerDrag = false;
      _recVisualCanvas.style.cursor = 'default';
      if (_recVisualDrag) {
        _recVisualDrag = null;
        _recVisualDragMode = null;
      }
    };
    
    _recVisualCanvas.onwheel = function(e) {
      e.preventDefault();
      var wrap = document.getElementById('recVisualCanvasWrap');
      var container = document.getElementById('recVisualCanvasContainer');
      var w = container ? container.clientWidth : wrap.clientWidth;
      var h = container ? container.clientHeight : wrap.clientHeight;
      
      if (e.shiftKey) {
        var delta = e.deltaY;
        var scrollDelta = delta * _recVisualScale * 0.5;
        var visibleTime = w / _recVisualZoom;
        var maxScroll = Math.max(0, (_recVisualMaxTime - visibleTime) * _recVisualZoom);
        _recVisualScrollX = Math.max(0, Math.min(maxScroll, _recVisualScrollX + scrollDelta));
      } else {
        var delta = e.deltaY;
        var visibleTracks = _recVisualEndTrack - _recVisualStartTrack;
        var maxScrollY = Math.max(0, _recVisualMaxTracks - visibleTracks);
        var trackDelta = delta * 0.1;
        var newStartTrack = _recVisualStartTrack + trackDelta;
        newStartTrack = Math.max(0, Math.min(maxScrollY, newStartTrack));
        _recVisualStartTrack = newStartTrack;
        _recVisualEndTrack = _recVisualStartTrack + visibleTracks;
      }
      saveVisualEditorSettings();
      renderRecVisual();
      updateRangeBar();
      
      // 同步琴键滚动位置
      syncPianoScrollImmediate();
    };
    
    var vThumb = document.getElementById('recVisualVThumb');
    var vHandleTop = document.getElementById('recVisualVHandleTop');
    var vHandleBottom = document.getElementById('recVisualVHandleBottom');
    
    // 通用的开始垂直拖动函数（同时支持鼠标和触摸）
    function startVScrollbarDrag(e, type) {
      e.preventDefault();
      e.stopPropagation();
      
      var coords = getEventCoords(e);
      
      // 保存初始数据状态
      _recVisualVScrollbarDragStartStartTrack = _recVisualStartTrack;
      _recVisualVScrollbarDragStartEndTrack = _recVisualEndTrack;
      
      _recVisualVScrollbarDragging = true;
      _recVisualVScrollbarDragType = type;
      _recVisualVScrollbarDragStartY = coords.y;
      
      document.addEventListener('mousemove', onVScrollbarDrag);
      document.addEventListener('mouseup', onVScrollbarDragEnd);
      document.addEventListener('touchmove', onVScrollbarDrag, { passive: false });
      document.addEventListener('touchend', onVScrollbarDragEnd);
    }
    
    // 垂直滑块中间拖动
    vThumb.addEventListener('mousedown', function(e) { startVScrollbarDrag(e, 'scroll'); });
    vThumb.addEventListener('touchstart', function(e) { startVScrollbarDrag(e, 'scroll'); });
    
    // 垂直滑块上端点拖动
    if (vHandleTop) {
      vHandleTop.addEventListener('mousedown', function(e) {
        startVScrollbarDrag(e, 'resize-top');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      vHandleTop.addEventListener('touchstart', function(e) {
        startVScrollbarDrag(e, 'resize-top');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      
      // 上端点鼠标悬停事件
      vHandleTop.addEventListener('mouseenter', function() {
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.6)';
      });
      
      vHandleTop.addEventListener('mouseleave', function() {
        if (!_recVisualVScrollbarDragging || _recVisualVScrollbarDragType !== 'resize-top') {
          this.style.boxShadow = '';
        }
      });
    }
    
    // 垂直滑块下端点拖动
    if (vHandleBottom) {
      vHandleBottom.addEventListener('mousedown', function(e) {
        startVScrollbarDrag(e, 'resize-bottom');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      vHandleBottom.addEventListener('touchstart', function(e) {
        startVScrollbarDrag(e, 'resize-bottom');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      
      // 下端点鼠标悬停事件
      vHandleBottom.addEventListener('mouseenter', function() {
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.6)';
      });
      
      vHandleBottom.addEventListener('mouseleave', function() {
        if (!_recVisualVScrollbarDragging || _recVisualVScrollbarDragType !== 'resize-bottom') {
          this.style.boxShadow = '';
        }
      });
    }
    
    var hThumb = document.getElementById('recVisualHThumb');
    var hHandleLeft = document.getElementById('recVisualHHandleLeft');
    var hHandleRight = document.getElementById('recVisualHHandleRight');
    
    // 通用的开始水平拖动函数（同时支持鼠标和触摸）
    function startHScrollbarDrag(e, type) {
      e.preventDefault();
      e.stopPropagation();
      
      var coords = getEventCoords(e);
      var wrap = document.getElementById('recVisualCanvasWrap');
      var w = wrap.clientWidth;
      
      // 保存初始数据状态
      var startTime = _recVisualScrollX / _recVisualZoom;
      var endTime = startTime + w / _recVisualZoom;
      _recVisualHScrollbarDragStartZoom = _recVisualZoom;
      _recVisualHScrollbarDragStartStartTime = startTime;
      _recVisualHScrollbarDragStartEndTime = endTime;
      _recVisualHScrollbarDragStartScrollX = _recVisualScrollX || 0;
      
      _recVisualHScrollbarDragging = true;
      _recVisualHScrollbarDragType = type;
      _recVisualHScrollbarDragStartX = coords.x;
      
      document.addEventListener('mousemove', onHScrollbarDrag);
      document.addEventListener('mouseup', onHScrollbarDragEnd);
      document.addEventListener('touchmove', onHScrollbarDrag, { passive: false });
      document.addEventListener('touchend', onHScrollbarDragEnd);
    }
    
    // 水平滑块中间拖动
    hThumb.addEventListener('mousedown', function(e) { startHScrollbarDrag(e, 'scroll'); });
    hThumb.addEventListener('touchstart', function(e) { startHScrollbarDrag(e, 'scroll'); });
    
    // 水平滑块左端点拖动
    if (hHandleLeft) {
      hHandleLeft.addEventListener('mousedown', function(e) {
        startHScrollbarDrag(e, 'resize-left');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      hHandleLeft.addEventListener('touchstart', function(e) {
        startHScrollbarDrag(e, 'resize-left');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      
      // 左端点鼠标悬停事件
      hHandleLeft.addEventListener('mouseenter', function() {
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.6)';
      });
      
      hHandleLeft.addEventListener('mouseleave', function() {
        if (!_recVisualHScrollbarDragging || _recVisualHScrollbarDragType !== 'resize-left') {
          this.style.boxShadow = '';
        }
      });
    }
    
    // 水平滑块右端点拖动
    if (hHandleRight) {
      hHandleRight.addEventListener('mousedown', function(e) {
        startHScrollbarDrag(e, 'resize-right');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      hHandleRight.addEventListener('touchstart', function(e) {
        startHScrollbarDrag(e, 'resize-right');
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.8)';
      });
      
      // 右端点鼠标悬停事件
      hHandleRight.addEventListener('mouseenter', function() {
        this.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.6)';
      });
      
      hHandleRight.addEventListener('mouseleave', function() {
        if (!_recVisualHScrollbarDragging || _recVisualHScrollbarDragType !== 'resize-right') {
          this.style.boxShadow = '';
        }
      });
    }


  }

  // ── Event delegation ──────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    if (!e.target) return;
    var tgt = e.target;

    if (tgt.id === 'startRecordBtn') {
      document.getElementById('modalOverlay').classList.remove('show');
      createRecFloat();
      return;
    }
    if (tgt.dataset && tgt.dataset.tab === 'record') {
      setTimeout(renderRecList, 50);
      return;
    }
    if (tgt.id === 'recEditOk') {
      var overlay = document.getElementById('recEditOverlay');
      var name    = document.getElementById('recEditName').value.trim() || '\u672a\u547d\u540d\u5f55\u5236';
      
      var scoreTextArea = document.getElementById('recEditScoreText');
      if (scoreTextArea) {
        setMelodyText(_recVisualTextTrack, scoreTextArea.value.trim());
      }
      parseVisualToText();
      saveVisualEditorSettings();
      
      var display = _melodyList.map(function(m) { return m.text; }).join('\n');
      var speed   = parseFloat(document.getElementById('recEditSpeed').value) || 1;
      var idx2    = overlay._editIdx;
      var dateStr = new Date().toLocaleDateString('zh-CN');
      if (idx2 === -1) {
        customRecordings.push({ key: Date.now(), name:name, display:display, speed:speed, date:dateStr, showNotesList: _melodyList.map(function(m) { return m.showNotes !== false; }) });
        overlay._editIdx = customRecordings.length - 1;
      } else {
        customRecordings[idx2].name    = name;
        customRecordings[idx2].display = display;
        customRecordings[idx2].speed   = speed;
        customRecordings[idx2].showNotesList = _melodyList.map(function(m) { return m.showNotes !== false; });
      }
      saveRecs();
      renderRecList();
      return;
    }
    if (tgt.id === 'recEditCancel') {
      var overlay2 = document.getElementById('recEditOverlay');
      _recVisualPlaying = false;
      saveVisualEditorSettings();
      if (_recVisualPlayAnimId) {
        cancelAnimationFrame(_recVisualPlayAnimId);
        _recVisualPlayAnimId = null;
      }
      if (overlay2._origScoreMain !== undefined) {
        _melodyList[0].text = overlay2._origScoreMain;
      }
      if (overlay2._origScoreAccomp !== undefined) {
        if (_melodyList[1]) {
          _melodyList[1].text = overlay2._origScoreAccomp;
        }
      }
      if (overlay2._origName !== undefined) {
        document.getElementById('recEditName').value = overlay2._origName;
      }
      if (overlay2._origSpeed !== undefined) {
        document.getElementById('recEditSpeed').value = overlay2._origSpeed;
      }
      _recVisualNotes = [];
      _recVisualSelected = null;
      _recVisualSelectedNotes = [];
      updatePropsPanel();
      overlay2.classList.remove('show');
      overlay2._editIdx = undefined;
      return;
    }
  });

  // ── Float record button ───────────────────────────────────────────
  var recFloat = null, rfDrag = false, rfDX = 0, rfDY = 0, rfSX = 0, rfSY = 0;

  function createRecFloat() {
    if (recFloat) return;
    recFloat = document.createElement('button');
    recFloat.id = 'recFloatBtn';
    recFloat.className = 'idle';
    recFloat.innerHTML = '<span class="ri">&#127897;</span><span class="rl">\u5f55\u5236</span>';
    recFloat.style.right  = '16px';
    recFloat.style.bottom = '80px';
    document.body.appendChild(recFloat);

    recFloat.addEventListener('click', function() { if (!rfDrag) toggleRec(); });

    function dStart(e) {
      rfDrag = false;
      var t  = e.touches ? e.touches[0] : e;
      rfDX   = parseFloat(recFloat.style.right)  || 16;
      rfDY   = parseFloat(recFloat.style.bottom) || 80;
      rfSX   = t.clientX; rfSY = t.clientY;
      document.addEventListener('mousemove', dMove);
      document.addEventListener('mouseup',   dEnd);
      document.addEventListener('touchmove', dMove, {passive:false});
      document.addEventListener('touchend',  dEnd);
    }
    function dMove(e) {
      var t  = e.touches ? e.touches[0] : e;
      var dx = t.clientX - rfSX, dy = t.clientY - rfSY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) rfDrag = true;
      if (!rfDrag) return;
      if (e.preventDefault) e.preventDefault();
      recFloat.style.right  = Math.max(0, Math.min(window.innerWidth  - 64, rfDX - dx)) + 'px';
      recFloat.style.bottom = Math.max(0, Math.min(window.innerHeight - 64, rfDY - dy)) + 'px';
      recFloat.style.left = ''; recFloat.style.top = '';
    }
    function dEnd() {
      document.removeEventListener('mousemove', dMove);
      document.removeEventListener('mouseup',   dEnd);
      document.removeEventListener('touchmove', dMove);
      document.removeEventListener('touchend',  dEnd);
      setTimeout(function(){ rfDrag = false; }, 50);
    }
    recFloat.addEventListener('mousedown',  dStart);
    recFloat.addEventListener('touchstart', dStart, {passive:true});
  }

  function toggleRec() {
    if (!window._REC.active) {
      window._REC.active  = true;
      window._REC.events  = [];
      window._REC.pending = {};
      window._REC.startAt = performance.now();
      recFloat.className  = 'recording';
      recFloat.innerHTML  = '<span class="ri">&#9209;</span><span class="rl">\u505c\u6b62</span>';
    } else {
      window._REC.active = false;
      window._REC.pending = {};
      var events = window._REC.events.slice();
      recFloat.remove(); recFloat = null;
      if (events.length > 0) {
        window._openRecEdit(-1, events);
      } else {
        if (typeof showAppAlert === 'function') showAppAlert('\u6ca1\u6709\u5f55\u5236\u5230\u4efb\u4f55\u97f3\u7b26');
      }
    }
  }

  setTimeout(renderRecList, 600);
})();


// Current score bar type tracker for height persistence
var _scoreBarType = null;

window.onload = function(){
  canvas = document.getElementById("scoreCanvas");
  ctx = canvas.getContext("2d");
  scoreWrap = document.getElementById("scoreWrap");
  container = document.getElementById("container");
  const musicBtn  = document.getElementById("musicBtn");
  const playBtn   = document.getElementById("playBtn");
  const autoBtn   = document.getElementById("autoBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  const songListEl   = document.getElementById("songList");
  const modalCancel  = document.getElementById("modalCancel");
  const addSongBtn   = document.getElementById("addSongBtn");
  const editOverlay  = document.getElementById("editOverlay");
  const editCancel   = document.getElementById("editCancel");
  const editOk       = document.getElementById("editOk");

  const settingOverlay = document.getElementById("settingOverlay");
  const mainSettingBtn = document.getElementById("mainSettingBtn");
  const layoutBtn = document.getElementById("layoutBtn");
  const feedbackBtn = document.getElementById("feedbackBtn");
  const keybindingBtn = document.getElementById("keybindingBtn");
  const keyHintToggle = document.getElementById("keyHintToggle");
  const keybindingOverlay = document.getElementById("keybindingOverlay");
  const keybindingBody = document.getElementById("keybindingBody");
  const keybindingRestore = document.getElementById("keybindingRestore");
  const keybindingCancel = document.getElementById("keybindingCancel");
  const keybindingSave = document.getElementById("keybindingSave");
  let keybindingCaptureHandler = null;
  let keybindingBackup = null;

  const msgOverlay = document.getElementById("msgOverlay");
  const msgContent = document.getElementById("msgContent");
  const msgOk = document.getElementById("msgOk");

  function showAppAlert(text) {
    msgContent.textContent = text;
    msgOverlay.classList.add("show");
  }
  msgOk.onclick = () => { msgOverlay.classList.remove("show"); };
  msgOverlay.onclick = (e) => { if (e.target === msgOverlay) msgOverlay.classList.remove("show"); };

  const virtualKeyBtn = document.getElementById("virtualKeyBtn");
  const virtualKeyOverlay = document.getElementById("virtualKeyOverlay");
  const virtualKeyClose = document.getElementById("virtualKeyClose");
  const vkSize = document.getElementById("vkSize");
  const vkSizeInput = document.getElementById("vkSizeInput");
  const vkOpacity = document.getElementById("vkOpacity");
  const vkOpacityInput = document.getElementById("vkOpacityInput");
  const vkColor = document.getElementById("vkColor");
  const vkText = document.getElementById("vkText");
  const vkKey = document.getElementById("vkKey");
  const vkAddBtn = document.getElementById("vkAddBtn");
  const vkUpdateBtn = document.getElementById("vkUpdateBtn");
  const vkCancelBtn = document.getElementById("vkCancelBtn");
  const vkList = document.getElementById("vkList");
  
  let virtualKeys = [];
  let editingVkIndex = -1;
  let vkKeyCaptureHandler = null;
  
  // 内置示例虚拟按键（低八度、高八度）
  const defaultVirtualKeys = [
    { text: "低8度", key: "octaveDown", size: 50, opacity: 40, color: "#00ff00", xPercent: 2, yPercent: 15, hidden: true },
    { text: "高8度", key: "octaveUp", size: 50, opacity: 40, color: "#00bfff", xPercent: 92, yPercent: 15, hidden: true }
  ];
  
  try {
    const storedVk = localStorage.getItem("virtualKeys");
    if (storedVk) {
      const parsed = JSON.parse(storedVk);
      // 如果存储的是空数组，添加默认示例
      if (Array.isArray(parsed) && parsed.length === 0) {
        virtualKeys = JSON.parse(JSON.stringify(defaultVirtualKeys));
        saveVirtualKeys();
      } else {
        virtualKeys = parsed;
      }
    } else {
      // 首次使用，添加默认示例按键
      virtualKeys = JSON.parse(JSON.stringify(defaultVirtualKeys));
      saveVirtualKeys();
    }
  } catch (e) {
    // 出错时使用默认示例
    virtualKeys = JSON.parse(JSON.stringify(defaultVirtualKeys));
  }
  
  function saveVirtualKeys() {
    try { localStorage.setItem("virtualKeys", JSON.stringify(virtualKeys)); } catch (e) {}
  }
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 153, b: 255 };
  }
  
  // 缓存虚拟按键元素
  const virtualKeyElements = new Map();
  
  function renderVirtualKeys() {
    const existingKeys = new Set(virtualKeyElements.keys());
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    virtualKeys.forEach((vk, idx) => {
      if (vk.hidden === true) {
        // 隐藏的按键，移除元素
        if (virtualKeyElements.has(idx)) {
          const btn = virtualKeyElements.get(idx);
          btn.remove();
          virtualKeyElements.delete(idx);
        }
        return;
      }
      
      let btn;
      if (virtualKeyElements.has(idx)) {
        // 复用现有元素
        btn = virtualKeyElements.get(idx);
      } else {
        // 创建新元素
        btn = document.createElement("div");
        btn.className = "virtual-key";
        
        // 绑定事件监听器（只绑定一次）
        setupVirtualKeyEvents(btn, idx);
        
        document.body.appendChild(btn);
        virtualKeyElements.set(idx, btn);
      }
      
      // 更新元素属性
      btn.style.width = vk.size + "px";
      btn.style.height = vk.size + "px";
      const xPercent = vk.xPercent !== undefined ? vk.xPercent : (vk.x / screenW * 100);
      const yPercent = vk.yPercent !== undefined ? vk.yPercent : (vk.y / screenH * 100);
      btn.style.left = xPercent + "%";
      btn.style.top = yPercent + "%";
      const rgb = hexToRgb(vk.color || "#0099ff");
      btn.style.setProperty('--vk-bg', `rgba(${rgb.r},${rgb.g},${rgb.b},${vk.opacity / 100})`);
      btn.style.fontSize = Math.max(10, vk.size / 4) + "px";
      btn.textContent = vk.text || vk.key;
      btn.dataset.index = idx;
      
      // 标记为已处理
      existingKeys.delete(idx);
    });
    
    // 移除不再需要的按键
    existingKeys.forEach(idx => {
      const btn = virtualKeyElements.get(idx);
      btn.remove();
      virtualKeyElements.delete(idx);
    });
  }
  
  function setupVirtualKeyEvents(btn, idx) {
    let isDraggingVk = false;
    let vkDragStartX = 0;
    let vkDragStartY = 0;
    let vkBtnStartXPercent = 0;
    let vkBtnStartYPercent = 0;
    let vkHasMoved = false;
    const VK_DRAG_THRESHOLD = 8; // 超过8px才算拖动
    
    const triggerVirtualKey = () => {
      initAudio();
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      const vk = virtualKeys[idx];
      if (vk && vk.key) {
        const key = String(vk.key).trim();
        // Handle function keys - same as keyboard shortcuts in pcKeyMap.control
        if (key === 'octaveDown') {
          // 低8度：所有动态琴键行的音域偏移量减1
          const rowCount = parseInt(sliderRows.value) || 7;
          for (let i = 0; i < rowCount; i++) {
            if (rowDynamicMap[i] !== false) {
              rowOctaveOffsetMap[i] = (rowOctaveOffsetMap[i] || 0) - 1;
            }
          }
          // 同时更新currentBaseOctave用于键盘快捷键映射
          currentBaseOctave = Math.max(1, currentBaseOctave - 1);
          saveRowConfig(); saveSettings(); renderPiano();
        } else if (key === 'octaveUp') {
          // 高8度：所有动态琴键行的音域偏移量加1
          const rowCount = parseInt(sliderRows.value) || 7;
          for (let i = 0; i < rowCount; i++) {
            if (rowDynamicMap[i] !== false) {
              rowOctaveOffsetMap[i] = (rowOctaveOffsetMap[i] || 0) + 1;
            }
          }
          // 同时更新currentBaseOctave用于键盘快捷键映射
          currentBaseOctave = Math.min(7, currentBaseOctave + 1);
          saveRowConfig(); saveSettings(); renderPiano();
        } else if (key === 'playPause') {
          // Same as pcKeyMap.control.playPause - simulate play button click
          const playBtn = document.getElementById('playBtn');
          if (playBtn) playBtn.click();
        } else {
          playNoteByKey(key);
        }
      }
    };
    
    const startVkDrag = (clientX, clientY) => {
      isDraggingVk = true;
      vkHasMoved = false;
      vkDragStartX = clientX;
      vkDragStartY = clientY;
      vkBtnStartXPercent = parseFloat(btn.style.left) || 0;
      vkBtnStartYPercent = parseFloat(btn.style.top) || 0;
    };
    
    const moveVkDrag = (clientX, clientY) => {
      if (!isDraggingVk) return;
      const dx = clientX - vkDragStartX;
      const dy = clientY - vkDragStartY;
      if (Math.abs(dx) > VK_DRAG_THRESHOLD || Math.abs(dy) > VK_DRAG_THRESHOLD) {
        vkHasMoved = true;
        btn.classList.add("dragging");
      }
      if (vkHasMoved) {
        const vk = virtualKeys[idx];
        if (!vk) return;
        
        const dxPercent = (dx / window.innerWidth) * 100;
        const dyPercent = (dy / window.innerHeight) * 100;
        const sizePercent = (vk.size / window.innerWidth) * 100;
        const newXPercent = Math.max(0, Math.min(100 - sizePercent, vkBtnStartXPercent + dxPercent));
        const newYPercent = Math.max(0, Math.min(100 - (vk.size / window.innerHeight) * 100, vkBtnStartYPercent + dyPercent));
        vk.xPercent = newXPercent;
        vk.yPercent = newYPercent;
        btn.style.left = newXPercent + "%";
        btn.style.top = newYPercent + "%";
      }
    };
    
    const endVkDrag = (shouldTrigger) => {
      if (!isDraggingVk) return;
      isDraggingVk = false;
      btn.classList.remove("dragging");
      btn.style.transform = "scale(1)";
      if (vkHasMoved) {
        saveVirtualKeys();
      } else if (shouldTrigger) {
        // 没有移动，触发按键
        triggerVirtualKey();
      }
    };

    // 电脑端事件
    btn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      btn.style.transform = "scale(0.9)";
      startVkDrag(e.clientX, e.clientY);
    });

    // 使用捕获阶段的 mousemove/mouseup 确保拖出按钮范围也能响应
    const onMouseMove = (e) => {
      if (!isDraggingVk) return;
      moveVkDrag(e.clientX, e.clientY);
    };
    const onMouseUp = (e) => {
      if (!isDraggingVk) return;
      endVkDrag(!vkHasMoved);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    btn.addEventListener("mousedown", () => {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // 移动端事件 - 支持多点触控
    btn.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      btn.style.transform = "scale(0.9)";
      const touch = e.touches[0];
      startVkDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    btn.addEventListener("touchmove", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const touch = e.touches[0];
      moveVkDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    btn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      endVkDrag(!vkHasMoved);
    });

    btn.addEventListener("touchcancel", (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingVk = false;
      btn.classList.remove("dragging");
      btn.style.transform = "scale(1)";
    });
  }
  
  function populateVkKeyOptions() {
    const vkKeySelect = document.getElementById('vkKey');
    const customKeysGroup = document.getElementById('vkCustomKeysGroup');
    if (!vkKeySelect || !customKeysGroup) return;
    
    // Clear custom keys group
    customKeysGroup.innerHTML = '';
    
    const customKeys = new Set();
    if (pcKeyMap.extra && Array.isArray(pcKeyMap.extra)) {
      pcKeyMap.extra.forEach((row) => {
        if (row && row.keys && Array.isArray(row.keys)) {
          row.keys.forEach((key) => {
            if (key && key.trim()) customKeys.add(key.trim());
          });
        }
      });
    }
    if (pcKeyMap.chord && Array.isArray(pcKeyMap.chord)) {
      pcKeyMap.chord.forEach((row) => {
        if (row && row.keys && Array.isArray(row.keys)) {
          row.keys.forEach((key) => {
            if (key && key.trim()) customKeys.add(key.trim());
          });
        }
      });
    }
    customKeys.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      customKeysGroup.appendChild(option);
    });
  }

  // 保存虚拟按键设置到本地存储
  function saveVkSettings() {
    try {
      const vkSettings = {
        size: parseInt(vkSize.value) || 50,
        opacity: parseInt(vkOpacity.value) || 60
      };
      localStorage.setItem('vkSettings', JSON.stringify(vkSettings));
    } catch (e) {
      console.error('保存虚拟按键设置失败:', e);
    }
  }
  
  // 从本地存储加载虚拟按键设置
  function loadVkSettings() {
    try {
      const stored = localStorage.getItem('vkSettings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.size) {
          vkSize.value = settings.size;
          vkSizeInput.value = settings.size;
        }
        if (settings.opacity) {
          vkOpacity.value = settings.opacity;
          vkOpacityInput.value = settings.opacity;
        }
      }
    } catch (e) {
      console.error('加载虚拟按键设置失败:', e);
    }
  }
  
  function resetVkForm() {
    editingVkIndex = -1;
    // 加载保存的设置，如果没有则使用默认值
    loadVkSettings();
    vkColor.value = "#0099ff";
    vkText.value = "";
    vkKey.value = "";
    populateVkKeyOptions();
    vkAddBtn.style.display = "";
    vkUpdateBtn.style.display = "none";
    vkCancelBtn.style.display = "none";
    renderVkList();
  }
  
  function editVk(index) {
    if (editingVkIndex === index) { resetVkForm(); return; }
    const vk = virtualKeys[index];
    if (!vk) return;
    editingVkIndex = index;
    vkSize.value = vk.size;
    vkSizeInput.value = vk.size;
    vkOpacity.value = vk.opacity;
    vkOpacityInput.value = vk.opacity;
    vkColor.value = vk.color || "#0099ff";
    vkText.value = vk.text || "";
    populateVkKeyOptions();
    vkKey.value = vk.key || "";
    vkAddBtn.style.display = "none";
    vkUpdateBtn.style.display = "";
    vkCancelBtn.style.display = "";
    renderVkList();
  }
  
  function renderVkList() {
    vkList.innerHTML = "";
    virtualKeys.forEach((vk, idx) => {
      const item = document.createElement("div");
      item.className = "vk-list-item";
      if (editingVkIndex === idx) item.classList.add("editing");
      item.style.cursor = "pointer";
      const rgb = hexToRgb(vk.color || "#0099ff");
      const isHidden = vk.hidden === true;
      item.innerHTML = `<span style="width:16px;height:16px;border-radius:50%;background:rgba(${rgb.r},${rgb.g},${rgb.b},${vk.opacity/100});margin-right:6px;display:inline-block;"></span><span class="vk-item-text"${isHidden?' style="opacity:0.5;text-decoration:line-through;"':''}>${vk.text || "无文字"}</span><button class="vk-item-toggle" data-idx="${idx}">${isHidden?'👁':'👁'}</button><button class="vk-item-del" data-idx="${idx}">-</button>`;
      const toggleBtn = item.querySelector(".vk-item-toggle");
      toggleBtn.style.cssText = "background:#333;border:none;color:#aaa;width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;";
      toggleBtn.style.opacity = isHidden ? "0.5" : "1";
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        virtualKeys[idx].hidden = !virtualKeys[idx].hidden;
        saveVirtualKeys(); renderVkList(); renderVirtualKeys();
      };
      const delBtn = item.querySelector(".vk-item-del");
      delBtn.style.cssText = "background:#333;border:none;color:#aaa;width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        virtualKeys.splice(idx, 1);
        saveVirtualKeys(); renderVkList(); renderVirtualKeys();
        if (editingVkIndex === idx) resetVkForm();
        else if (editingVkIndex > idx) editingVkIndex--;
      };
      item.onclick = (e) => {
        if (e.target.classList.contains("vk-item-del") || e.target.classList.contains("vk-item-toggle")) return;
        editVk(idx);
      };
      vkList.appendChild(item);
    });
  }
  
  vkSize.oninput = () => { 
    vkSizeInput.value = vkSize.value;
    saveVkSettings();
  };
  vkSizeInput.onblur = () => { 
    let v = Math.min(300, Math.max(30, parseInt(vkSizeInput.value) || 30));
    vkSize.value = v; vkSizeInput.value = v;
    saveVkSettings();
  };
  vkSizeInput.onkeydown = (e) => { if (e.key === "Enter") vkSizeInput.blur(); };
  vkOpacity.oninput = () => { 
    vkOpacityInput.value = vkOpacity.value;
    saveVkSettings();
  };
  vkOpacityInput.onblur = () => { 
    let v = Math.min(100, Math.max(10, parseInt(vkOpacityInput.value) || 10));
    vkOpacity.value = v; vkOpacityInput.value = v;
    saveVkSettings();
  };
  vkOpacityInput.onkeydown = (e) => { if (e.key === "Enter") vkOpacityInput.blur(); };
  
  vkAddBtn.onclick = () => {
    const size = parseInt(vkSize.value) || 50;
    const opacity = parseInt(vkOpacity.value) || 60;
    const color = vkColor.value || "#0099ff";
    const text = vkText.value.trim();
    const key = vkKey.value;
    if (!key) { showAppAlert("请先选择对应的按键"); return; }
    const sizePercent = (size / window.innerWidth) * 100;
    virtualKeys.push({
      size, opacity, color, text, key,
      xPercent: Math.random() * (100 - sizePercent),
      yPercent: Math.random() * (100 - (size / window.innerHeight) * 100)
    });
    saveVirtualKeys(); renderVkList(); renderVirtualKeys(); resetVkForm();
  };
  
  vkUpdateBtn.onclick = () => {
    if (editingVkIndex < 0 || editingVkIndex >= virtualKeys.length) return;
    const vk = virtualKeys[editingVkIndex];
    vk.size = parseInt(vkSize.value) || 50;
    vk.opacity = parseInt(vkOpacity.value) || 60;
    vk.color = vkColor.value || "#0099ff";
    vk.text = vkText.value.trim();
    vk.key = vkKey.value.trim();
    saveVirtualKeys(); renderVkList(); renderVirtualKeys(); resetVkForm();
  };
  
  vkCancelBtn.onclick = () => { resetVkForm(); };
  
  virtualKeyBtn.onclick = (e) => {
    settingOverlay.classList.remove("show");
    
    const modal = virtualKeyOverlay.querySelector('.modal');
    if (modal) {
      const rect = e.target.getBoundingClientRect();
      const gap = 10;
      
      const modalWidth = modal.offsetWidth;
      
      const isRotated = document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
      const isLandscape = document.body.classList.contains('landscape-mode');
      const screenWidth = (isRotated || isLandscape) ? window.innerHeight : window.innerWidth;
      const screenHeight = (isRotated || isLandscape) ? window.innerWidth : window.innerHeight;
      
      let left = rect.left;
      let top = rect.bottom + gap;
      
      if (left + modalWidth > screenWidth - gap) {
        left = screenWidth - modalWidth - gap;
      }
      if (left < gap) left = gap;
      
      let availableHeight = screenHeight - top - gap;
      
      // 如果下方空间不够，尝试放在上方
      if (availableHeight < 200) {
        top = rect.top - gap - 100; // 先设置一个初始值
        availableHeight = rect.top - gap;
        // 如果上方空间也不够，就从屏幕顶部开始
        if (availableHeight < 200) {
          top = gap;
          availableHeight = screenHeight - gap * 2;
        }
      }
      
      modal.style.position = 'fixed';
      modal.style.left = left + 'px';
      modal.style.top = top + 'px';
      modal.style.bottom = 'auto';
      modal.style.right = 'auto';
      modal.style.transform = 'none';
      modal.style.maxWidth = (screenWidth - gap * 2) + 'px';
      modal.style.maxHeight = Math.max(200, availableHeight) + 'px';
      modal.style.overflowY = 'auto';
    }
    
    virtualKeyOverlay.classList.add("show");
    populateVkKeyOptions();
    renderVkList();
    resetVkForm();
  };
  
  virtualKeyClose.onclick = () => {
    virtualKeyOverlay.classList.remove("show");
    resetVkForm();
  };
  
  virtualKeyOverlay.onclick = (e) => {
    if (e.target === virtualKeyOverlay) {
      virtualKeyOverlay.classList.remove("show");
      resetVkForm();
    }
  };
  
  renderVirtualKeys();

  const layoutToolbar = document.getElementById("layoutToolbar");
  const sliderRows = document.getElementById("sliderRows");
  const inputRows = document.getElementById("inputRows");
  const sliderWidth = document.getElementById("sliderWidth");
  const inputWidth = document.getElementById("inputWidth");
  const sliderHeight = document.getElementById("sliderHeight");
  const inputHeight = document.getElementById("inputHeight");
  const sliderGap = document.getElementById("sliderGap");
  const inputGap = document.getElementById("inputGap");
  const btnToolbarPos = document.getElementById("btnToolbarPos");
  const instScroll = document.getElementById("instScroll");

  function renderInstButtons() {
    instScroll.innerHTML = "";
    const order = instOrder || INST_LIST.map(i => i.v);
    order.forEach(instKey => {
      const inst = INST_LIST.find(i => i.v === instKey);
      if (!inst) return;
      const btn = document.createElement("button");
      btn.className = "btn" + (currentInst === instKey ? " active" : "");
      btn.dataset.inst = instKey;
      btn.textContent = inst.t;
      btn.addEventListener("click", function() {
        if (instDragging) return;
        document.querySelectorAll(".control .btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currentInst = this.dataset.inst;
        
        // 同步到音色调整窗口
        currentToneInst = currentInst;
        if (typeof renderToneTabs === 'function') renderToneTabs();
        if (typeof renderToneControls === 'function') renderToneControls();
        
        saveSettings();
      });
      btn.addEventListener("mousedown", function(e) { startInstDrag(e, this); });
      btn.addEventListener("touchstart", function(e) { startInstDrag(e, this); }, { passive: false });
      instScroll.appendChild(btn);
    });
  }

  let instDragBtn = null;
  let instDragStartX = 0;
  let instDragStartY = 0;
  let instDragging = false;
  let instDragClone = null;
  let instLongPressTimer = null;
  let instInsertLine = null;
  let instHasMoved = false;

  function startInstDrag(e, btn) {
    const touch = e.touches ? e.touches[0] : e;
    instDragBtn = btn;
    instDragStartX = touch.clientX;
    instDragStartY = touch.clientY;
    instDragging = false;
    instHasMoved = false;
    clearTimeout(instLongPressTimer);
    instLongPressTimer = setTimeout(() => {
      if (!instHasMoved) {
        instDragging = true;
        instDragBtn.style.opacity = "0.3";
        const rect = instDragBtn.getBoundingClientRect();
        instDragClone = instDragBtn.cloneNode(true);
        instDragClone.style.position = "fixed";
        instDragClone.style.width = rect.width + "px";
        instDragClone.style.height = rect.height + "px";
        instDragClone.style.left = rect.left + "px";
        instDragClone.style.top = rect.top + "px";
        instDragClone.style.opacity = "0.8";
        instDragClone.style.zIndex = "1000";
        instDragClone.style.pointerEvents = "none";
        instDragClone.style.background = instDragBtn.classList.contains("active") ? "#0099ff" : "#222";
        instDragClone.style.borderColor = instDragBtn.classList.contains("active") ? "#0099ff" : "#444";
        instDragClone.style.color = instDragBtn.classList.contains("active") ? "#fff" : "#aaa";
        document.body.appendChild(instDragClone);
        instDragBtn.style.visibility = "hidden";
        instInsertLine = document.createElement("div");
        instInsertLine.style.cssText = "position:absolute;width:2px;background:#0099ff;top:0;bottom:0;z-index:999;pointer-events:none;";
        instScroll.style.position = "relative";
        instScroll.appendChild(instInsertLine);
      }
    }, 400);
  }

  function checkInstDragMove(e) {
    if (!instDragBtn || instDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - instDragStartX;
    const dy = touch.clientY - instDragStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(instLongPressTimer);
      instHasMoved = true;
    }
  }

  function updateInstDrag(e) {
    if (!instDragging || !instDragClone) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX;
    const y = touch.clientY;
    instDragClone.style.left = x - instDragClone.offsetWidth / 2 + "px";
    instDragClone.style.top = y - instDragClone.offsetHeight / 2 + "px";
    
    const isRotated = document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
    const isToolbarVertical = document.body.classList.contains('toolbar-rotated-90') || document.body.classList.contains('toolbar-rotated-270');
    const isLandscape = document.body.classList.contains('landscape-mode');
    const useVertical = isRotated || isToolbarVertical || isLandscape;
    
    const btns = Array.from(instScroll.children).filter(b => b !== instDragBtn && b !== instInsertLine);
    let insertIdx = btns.length;
    
    if (useVertical) {
      for (let i = 0; i < btns.length; i++) {
        const rect = btns[i].getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        if (y < center) {
          insertIdx = i;
          break;
        }
      }
      if (insertIdx < btns.length) {
        const rect = btns[insertIdx].getBoundingClientRect();
        instInsertLine.style.top = (rect.top - instScroll.getBoundingClientRect().top) + "px";
        instInsertLine.style.left = "0";
        instInsertLine.style.right = "0";
        instInsertLine.style.width = "100%";
        instInsertLine.style.height = "2px";
      } else {
        const lastBtn = btns[btns.length - 1];
        if (lastBtn) {
          const rect = lastBtn.getBoundingClientRect();
          instInsertLine.style.top = (rect.bottom - instScroll.getBoundingClientRect().top) + "px";
          instInsertLine.style.left = "0";
          instInsertLine.style.right = "0";
          instInsertLine.style.width = "100%";
          instInsertLine.style.height = "2px";
        }
      }
    } else {
      for (let i = 0; i < btns.length; i++) {
        const rect = btns[i].getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        if (x < center) {
          insertIdx = i;
          break;
        }
      }
      if (insertIdx < btns.length) {
        const rect = btns[insertIdx].getBoundingClientRect();
        instInsertLine.style.left = (rect.left - instScroll.getBoundingClientRect().left) + "px";
        instInsertLine.style.top = "0";
        instInsertLine.style.bottom = "0";
        instInsertLine.style.width = "2px";
        instInsertLine.style.height = "auto";
      } else {
        const lastBtn = btns[btns.length - 1];
        if (lastBtn) {
          const rect = lastBtn.getBoundingClientRect();
          instInsertLine.style.left = (rect.right - instScroll.getBoundingClientRect().left) + "px";
          instInsertLine.style.top = "0";
          instInsertLine.style.bottom = "0";
          instInsertLine.style.width = "2px";
          instInsertLine.style.height = "auto";
        }
      }
    }
  }

  function endInstDrag() {
    clearTimeout(instLongPressTimer);
    if (!instDragBtn) return;
    if (instDragging && instDragClone && instInsertLine) {
      const btns = Array.from(instScroll.children).filter(b => b !== instDragBtn && b !== instInsertLine);
      let insertIdx = btns.length;
      
      const isRotated = document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
      const isToolbarVertical = document.body.classList.contains('toolbar-rotated-90') || document.body.classList.contains('toolbar-rotated-270');
      const isLandscape = document.body.classList.contains('landscape-mode');
      const useVertical = isRotated || isToolbarVertical || isLandscape;
      
      if (useVertical) {
        const insertY = parseInt(instInsertLine.style.top) || 0;
        for (let i = 0; i < btns.length; i++) {
          const rect = btns[i].getBoundingClientRect();
          const center = rect.top - instScroll.getBoundingClientRect().top + rect.height / 2;
          if (insertY < center) {
            insertIdx = i;
            break;
          }
        }
      } else {
        const insertX = parseInt(instInsertLine.style.left) || 0;
        for (let i = 0; i < btns.length; i++) {
          const rect = btns[i].getBoundingClientRect();
          const center = rect.left - instScroll.getBoundingClientRect().left + rect.width / 2;
          if (insertX < center) {
            insertIdx = i;
            break;
          }
        }
      }
      
      if (insertIdx < btns.length) {
        instScroll.insertBefore(instDragBtn, btns[insertIdx]);
      } else {
        instScroll.appendChild(instDragBtn);
      }
      const order = Array.from(instScroll.children).filter(b => b.classList.contains("btn")).map(b => b.dataset.inst);
      instOrder = order;
      try { localStorage.setItem('instOrder', JSON.stringify(order)); } catch(e) {}
    }
    instDragBtn.style.visibility = "";
    instDragBtn.style.opacity = "";
    if (instDragClone) {
      instDragClone.remove();
      instDragClone = null;
    }
    if (instInsertLine) {
      instInsertLine.remove();
      instInsertLine = null;
    }
    instScroll.style.position = "";
    instDragBtn = null;
    instDragging = false;
    instHasMoved = false;
  }

  document.addEventListener("mousemove", updateInstDrag);
  document.addEventListener("touchmove", checkInstDragMove, { passive: true });
  document.addEventListener("touchmove", updateInstDrag, { passive: false });
  document.addEventListener("mouseup", endInstDrag);
  document.addEventListener("touchend", endInstDrag);
  document.addEventListener("touchcancel", endInstDrag);

  mainSettingBtn.onclick = (e) => {
    _positionModalNearBtn(settingOverlay, e.target);
    settingOverlay.classList.add("show");
    keyHintToggle.checked = keyHintEnabled;
  };
  settingOverlay.onclick = (e) => { if (e.target === settingOverlay) settingOverlay.classList.remove("show"); };
  keyHintToggle.onchange = () => {
    keyHintEnabled = keyHintToggle.checked;
    saveSettings();
    if (!keyHintEnabled) {
      _stopRingLoop();
      _stopJianpuRingLoop();
    }
  };
  feedbackBtn.onclick = () => {
    msgContent.innerHTML = '抖音搜索 <span style="color:#0099ff;font-weight:600;">OA</span>啊 留言即可';
    msgOverlay.classList.add("show");
    settingOverlay.classList.remove("show");
  };
  keybindingBtn.onclick = () => {
    keybindingBackup = JSON.parse(JSON.stringify(pcKeyMap));
    renderKeybindings();
    keybindingOverlay.classList.add("show");
    settingOverlay.classList.remove("show");
  };

  const toneAdjustBtn = document.getElementById('toneAdjustBtn');
  const toneOverlay = document.getElementById('toneOverlay');
  const toneTabsContainer = document.getElementById('toneTabsContainer');
  const toneControls = document.getElementById('toneControls');
  const toneCloseBtn = document.getElementById('toneCloseBtn');
  const tonePreviewBtn = document.getElementById('tonePreviewBtn');
  const toneResetBtn = document.getElementById('toneResetBtn');
  const toneSaveBtn = document.getElementById('toneSaveBtn');

  let currentToneInst = 'piano';
  let customInstruments = [];
  
  function loadCustomInstruments() {
    try {
      const saved = localStorage.getItem('customInstruments');
      if (saved) {
        customInstruments = JSON.parse(saved);
      }
    } catch(e) {
      customInstruments = [];
    }
  }
  loadCustomInstruments();
  
  function saveCustomInstruments() {
    try {
      localStorage.setItem('customInstruments', JSON.stringify(customInstruments));
    } catch(e) {}
  }
  
  function updateInstButtons() {
    document.querySelectorAll(".control .btn").forEach(function(b) {
      b.classList.toggle("active", b.dataset.inst === currentInst);
    });
  }

  function renderToneTabs() {
    toneTabsContainer.innerHTML = '';
    INST_LIST.forEach(inst => {
      const tab = document.createElement('button');
      tab.className = 'tone-tab' + (currentToneInst === inst.v ? ' active' : '');
      tab.textContent = inst.t;
      tab.dataset.inst = inst.v;
      tab.onclick = () => {
        currentToneInst = inst.v;
        renderToneTabs();
        renderToneControls();
        
        // 切换全局乐器，作用到主窗口琴键
        currentInst = inst.v;
        updateInstButtons();
        
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        startInstrumentNote(440, 1);
      };
      toneTabsContainer.appendChild(tab);
    });
    
    customInstruments.forEach(inst => {
      const tab = document.createElement('button');
      tab.className = 'tone-tab' + (currentToneInst === inst.v ? ' active' : '');
      tab.textContent = inst.t;
      tab.dataset.inst = inst.v;
      tab.onclick = () => {
        currentToneInst = inst.v;
        renderToneTabs();
        renderToneControls();
        
        // 切换全局乐器，作用到主窗口琴键
        currentInst = inst.v;
        updateInstButtons();
        
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        startInstrumentNote(440, 1);
      };
      toneTabsContainer.appendChild(tab);
    });
    
    const addTab = document.createElement('button');
    addTab.className = 'tone-tab tone-add-tab';
    addTab.innerHTML = '+';
    addTab.style.fontSize = '18px';
    addTab.style.fontWeight = 'bold';
    addTab.style.minWidth = '36px';
    addTab.style.padding = '4px 8px';
    addTab.onclick = () => {
      showAddInstrumentDialog();
    };
    toneTabsContainer.appendChild(addTab);
  }
  
  function showAddInstrumentDialog() {
    const name = prompt('请输入新乐器名称：');
    if (!name || !name.trim()) return;
    
    const v = 'custom_' + Date.now();
    const newInst = {
      v: v,
      t: name.trim()
    };
    
    customInstruments.push(newInst);
    saveCustomInstruments();
    
    const defaultParams = {
      waveType: 'sine',
      attack: 0.01,
      decay: 0.3,
      sustain: 0.4,
      release: 1.0,
      harm2: 0.3,
      harm3: 0.15,
      harm4: 0.08,
      harm5: 0.04,
      harm6: 0.02,
      filterType: 'lowpass',
      filterFreq: 5000,
      filterQ: 0.5,
      vibrato: 0,
      vibratoDepth: 0,
      noiseLevel: 0,
      noiseDecay: 0,
      brightness: 0.5
    };
    
    toneParams[v] = defaultParams;
    saveToneParams();
    
    currentToneInst = v;
    renderToneTabs();
    renderToneControls();
  }

  function renderToneControls() {
    const params = toneParams[currentToneInst] || {};
    const defaults = defaultToneParams[currentToneInst] || {};
    
    let html = '';
    
    // 采样上传区域 - 每个音阶一个独立上传框
    html += '<div class="tone-control-group">';
    html += '<div class="sample-upload-area">';
    html += '<p style="font-size:11px;color:#888;margin-bottom:8px;">单击试听 | 双击上传采样</p>';
    
    // 生成所有音阶的上传框（C1到C7）
    var allNotes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var loadedSamples = typeof SimpleSampler !== 'undefined' ? SimpleSampler.getLoadedSamples(currentToneInst) : [];
    var configSamples = (typeof SimpleSampler !== 'undefined' && SimpleSampler.SAMPLE_CONFIG && SimpleSampler.SAMPLE_CONFIG[currentToneInst]) 
      ? SimpleSampler.SAMPLE_CONFIG[currentToneInst].notes : [];
    
    for (var octave = 1; octave <= 7; octave++) {
      html += '<div style="display:flex;flex-wrap:nowrap;margin-bottom:4px;">';
      for (var n = 0; n < allNotes.length; n++) {
        var noteName = allNotes[n] + octave;
        var isLoaded = loadedSamples.indexOf(noteName) !== -1;
        var hasConfig = configSamples.indexOf(noteName) !== -1;
        var bgColor, borderColor;
        if (isLoaded) {
          bgColor = 'rgba(100,180,100,0.6)';
          borderColor = 'rgba(100,180,100,0.9)';
        } else if (hasConfig) {
          bgColor = 'rgba(80,150,200,0.6)';
          borderColor = 'rgba(80,150,200,0.9)';
        } else {
          bgColor = 'rgba(60,60,60,0.8)';
          borderColor = 'rgba(80,80,80,0.9)';
        }
        var shortName = allNotes[n].replace('#', '#');
        html += '<div class="sample-note-box" data-note="' + noteName + '" style="width:28px;height:28px;background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:4px;margin-right:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:#eee;flex-shrink:0;">' + shortName + octave + '</div>';
      }
      html += '</div>';
    }
    
    html += '<div style="margin-top:8px;display:flex;gap:8px;">';
    html += '<button id="batchLoadSamplesBtn" style="flex:1;background:#2a5a8a;border:1px solid #3a6a9a;color:#eee;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">批量加载采样</button>';
    html += '</div>';
    html += '<input type="file" id="sampleFileInput" accept="audio/*" style="display:none;">';
    html += '<input type="file" id="batchFileInput" accept="audio/*" multiple style="display:none;">';
    html += '<div id="uploadProgress" style="margin-top:8px;font-size:11px;color:#aaa;"></div>';
    html += '</div>';
    html += '</div>';
    
    html += '<div class="tone-control-group"><div class="tone-control-group-title">包络控制</div>';
    html += createSliderRow('起音', 'attack', params.attack || defaults.attack || 0.01, 0.001, 1.0, 0.001, '秒', '');
    html += createSliderRow('衰减', 'decay', params.decay || defaults.decay || 0.3, 0.1, 8, 0.1, '秒', '');
    html += createSliderRow('延音', 'sustain', params.sustain || defaults.sustain || 0.4, 0, 1, 0.01, '', '');
    html += createSliderRow('释放', 'release', params.release || defaults.release || 1.0, 0.1, 15, 0.1, '秒', '');
    html += '</div>';
    
    html += '<div class="tone-control-group"><div class="tone-control-group-title">音色特性</div>';
    html += createSliderRow('通透感', 'brightness', params.brightness !== undefined ? params.brightness : (defaults.brightness || 0.5), 0, 3, 0.01, '', '');
    html += '</div>';
    
    toneControls.innerHTML = html;
    
    // 控制底部删除按钮的显示/隐藏（仅自定义乐器显示）
    var toneDeleteBtn = document.getElementById('toneDeleteBtn');
    var isCustomInst = customInstruments.some(inst => inst.v === currentToneInst);
    if (toneDeleteBtn) {
      toneDeleteBtn.style.display = isCustomInst ? 'block' : 'none';
      toneDeleteBtn.onclick = function() {
        var instIndex = customInstruments.findIndex(inst => inst.v === currentToneInst);
        if (instIndex !== -1) {
          customInstruments.splice(instIndex, 1);
          saveCustomInstruments();
          
          // 删除对应的音色参数
          delete toneParams[currentToneInst];
          saveToneParams();
          
          // 切换到第一个内置乐器
          currentToneInst = INST_LIST[0].v;
          currentInst = currentToneInst;
          
          renderToneTabs();
          renderToneControls();
          updateInstButtons();
        }
      };
    }
    
    // 绑定每个音阶框的上传事件
    var fileInput = document.getElementById('sampleFileInput');
    var progressEl = document.getElementById('uploadProgress');
    var currentUploadNote = null;
    
    var noteBoxes = toneControls.querySelectorAll('.sample-note-box');
    
    // 用于区分单击和双击（手机端双击会被当成两次单击）
    var clickTimers = {};
    var CLICK_DELAY = 300;
    
    noteBoxes.forEach(function(box) {
      var boxNote = box.dataset.note;
      
      // 单击试听播放采样音色 - 延迟执行，等待判断是否为双击
      box.onclick = function(e) {
        if (clickTimers[boxNote]) {
          clearTimeout(clickTimers[boxNote]);
          delete clickTimers[boxNote];
          return;
        }
        
        clickTimers[boxNote] = setTimeout(function() {
          delete clickTimers[boxNote];
          
          var noteName = boxNote;
          progressEl.innerHTML = '♪ 试听: ' + noteName;
          
          // 用全局的 startInstrumentNote 播放（与主窗口琴键完全一致）
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          
          var freq = getFreq(noteName);
          var result = startInstrumentNote(freq, 0.6, currentToneInst);
          
          if (result && result.env) {
            result.env.gain.setValueAtTime(result.env.gain.value || 0.6, audioCtx.currentTime);
            result.env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
            
            setTimeout(function() {
              if (progressEl.innerHTML === '♪ 试听: ' + noteName) {
                progressEl.innerHTML = '';
              }
              if (result.gain) { try { result.gain.disconnect(); } catch(e) {} }
              if (result.nodes) { result.nodes.forEach(function(n) { try { n.disconnect(); } catch(e) {} }); }
            }, 2100);
          }
          
          // 同时尝试加载采样到SimpleSampler供后续使用
          // 注意：本地文件无法通过fetch加载，只使用已嵌入的数据
          // loadSampleToSampler(noteName);
          
          function loadSampleToSampler(note) {
            // 检查是否已有嵌入数据
            if (window.SAMPLES_DATA && window.SAMPLES_DATA[currentToneInst]) {
              var instData = window.SAMPLES_DATA[currentToneInst];
              if (instData[note]) {
                console.log('[DEBUG] Using embedded sample for', currentToneInst, note);
              }
            }
            // 不再尝试fetch本地文件，避免CORS错误
          }
        }, CLICK_DELAY);
      };
      
      // 双击上传自己的采样音色
      box.ondblclick = function(e) {
        e.preventDefault();
        
        var noteName = this.dataset.note;
        if (clickTimers[noteName]) {
          clearTimeout(clickTimers[noteName]);
          delete clickTimers[noteName];
        }
        
        currentUploadNote = noteName;
        fileInput.click();
      };
    });
    
    function noteToMidiLocal(noteName) {
      var match = noteName.match(/^([A-G])(#?)(\d+)$/);
      if (!match) return 60;
      var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      var noteName2 = match[1] + match[2];
      var octave = parseInt(match[3]);
      var noteIndex = noteNames.indexOf(noteName2);
      if (noteIndex === -1) return 60;
      return (octave + 1) * 12 + noteIndex;
    }
    
    if (fileInput) {
      fileInput.onchange = function() {
        var file = this.files[0];
        if (!file || !currentUploadNote) return;
        
        var noteName = currentUploadNote;
        progressEl.innerHTML = '正在加载 ' + noteName + '...';
        
        if (typeof SimpleSampler !== 'undefined') {
          SimpleSampler.uploadSample(currentToneInst, noteName, file,
            function() {
              var box = toneControls.querySelector('.sample-note-box[data-note="' + noteName + '"]');
              if (box) {
                box.style.background = 'rgba(100,180,100,0.6)';
                box.style.borderColor = 'rgba(100,180,100,0.9)';
              }
              
              var midiNote = noteToMidiLocal(noteName);
              var result = SimpleSampler.playNote(currentToneInst, midiNote, 100);
              if (result) {
                progressEl.innerHTML = '♪ 试听: ' + noteName;
                result.source.onended = function() {
                  if (progressEl.innerHTML === '♪ 试听: ' + noteName) {
                    progressEl.innerHTML = '';
                  }
                };
              }
              fileInput.value = '';
            },
            function(err) {
              progressEl.innerHTML = '✗ ' + noteName + ' 加载失败';
              fileInput.value = '';
            }
          );
        }
      };
    }
    
    // 批量加载采样
    var batchBtn = document.getElementById('batchLoadSamplesBtn');
    var batchInput = document.getElementById('batchFileInput');
    
    if (batchBtn && batchInput) {
      batchBtn.onclick = function() {
        batchInput.click();
      };
      
      batchInput.onchange = function() {
        var files = this.files;
        if (!files || files.length === 0) return;
        
        var totalFiles = files.length;
        var loadedCount = 0;
        var failedCount = 0;
        
        progressEl.innerHTML = '正在加载 ' + totalFiles + ' 个采样...';
        
        Array.from(files).forEach(function(file) {
          var fileName = file.name.replace(/\.[^/.]+$/, '');
          var noteMatch = fileName.match(/([A-Ga-g][#b]?[0-9])/);
          var noteName;
          
          if (noteMatch) {
            noteName = noteMatch[0].toUpperCase();
          } else {
            failedCount++;
            return;
          }
          
          if (typeof SimpleSampler !== 'undefined') {
            SimpleSampler.uploadSample(currentToneInst, noteName, file,
              function() {
                loadedCount++;
                var box = toneControls.querySelector('.sample-note-box[data-note="' + noteName + '"]');
                if (box) {
                  box.style.background = 'rgba(100,180,100,0.6)';
                  box.style.borderColor = 'rgba(100,180,100,0.9)';
                }
                progressEl.innerHTML = '已加载 ' + loadedCount + '/' + totalFiles + ' 个采样';
                if (loadedCount + failedCount === totalFiles) {
                  progressEl.innerHTML = '✓ 加载完成：成功 ' + loadedCount + ' 个' + (failedCount > 0 ? '，失败 ' + failedCount + ' 个' : '');
                }
              },
              function(err) {
                failedCount++;
                if (loadedCount + failedCount === totalFiles) {
                  progressEl.innerHTML = '加载完成：成功 ' + loadedCount + ' 个，失败 ' + failedCount + ' 个';
                }
              }
            );
          }
        });
        
        batchInput.value = '';
      };
    }
    
    toneControls.querySelectorAll('.tone-control-slider').forEach(slider => {
      slider.oninput = function() {
        const param = this.dataset.param;
        const value = parseFloat(this.value);
        if (!toneParams[currentToneInst]) toneParams[currentToneInst] = {};
        toneParams[currentToneInst][param] = value;
        this.nextElementSibling.textContent = formatParamValue(param, value);
      };
    });
  }

  function createSliderRow(label, param, value, min, max, step, unit, hint) {
    return '<div class="tone-control-item">' +
      '<div class="tone-control-row">' +
      '<span class="tone-control-label">' + label + '</span>' +
      '<input type="range" class="tone-control-slider" data-param="' + param + '" ' +
      'min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '<span class="tone-control-value">' + formatParamValue(param, value) + '</span>' +
      '</div>' +
      (hint ? '<div class="tone-control-hint">' + hint + '</div>' : '') +
      '</div>';
  }

  function formatParamValue(param, value) {
    if (param === 'vibrato') return value.toFixed(1) + ' Hz';
    if (param === 'filterFreq') return Math.round(value) + ' Hz';
    if (param === 'attack' || param === 'decay' || param === 'release' || param === 'noiseDecay') return value.toFixed(1) + 's';
    if (param === 'vibratoDepth' || param === 'blendFactor') return value.toFixed(3);
    if (param === 'filterQ') return value.toFixed(1);
    if (param === 'brightness') return (value * 100).toFixed(0) + '%';
    return value.toFixed(2);
  }

  if (toneAdjustBtn) {
    toneAdjustBtn.onclick = () => {
      loadToneParams();
      currentToneInst = currentInst;
      renderToneTabs();
      renderToneControls();
      toneOverlay.classList.add('show');
      settingOverlay.classList.remove('show');
    };
  }

  if (toneCloseBtn) {
    toneCloseBtn.onclick = () => {
      toneOverlay.classList.remove('show');
    };
  }

  if (toneResetBtn) {
    toneResetBtn.onclick = () => {
      delete toneParams[currentToneInst];
      saveToneParams();
      renderToneControls();
    };
  }

  if (toneSaveBtn) {
    toneSaveBtn.onclick = () => {
      saveToneParams();
      toneOverlay.classList.remove('show');
    };
  }

  if (tonePreviewBtn) {
    var previewTimeout = null;
    var previewKeyId = 'tone_preview_' + Date.now();
    
    var startPreview = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.AudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const freq = 440;
      const prevInst = currentInst;
      currentInst = currentToneInst;
      activeNodes.set(previewKeyId, startInstrumentNote(freq, 1));
      currentInst = prevInst;
    };
    
    var stopPreview = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      const prevInst = currentInst;
      currentInst = currentToneInst;
      stopNote(previewKeyId);
      currentInst = prevInst;
    };
    
    tonePreviewBtn.onmousedown = startPreview;
    tonePreviewBtn.onmouseup = stopPreview;
    tonePreviewBtn.onmouseleave = stopPreview;
    tonePreviewBtn.ontouchstart = function(e) {
      startPreview(e);
    };
    tonePreviewBtn.ontouchend = function(e) {
      stopPreview(e);
    };
  }

  keybindingCancel.onclick = () => {
    if (keybindingBackup) { pcKeyMap = keybindingBackup; keybindingBackup = null; }
    keybindingOverlay.classList.remove("show");
    stopKeybindingCapture();
  };

  function stopKeybindingCapture() {
    if (keybindingCaptureHandler) {
      window.removeEventListener("keydown", keybindingCaptureHandler, true);
      keybindingCaptureHandler = null;
    }
    keybindingBody.querySelectorAll(".kb-key-chip.capturing").forEach(el => el.classList.remove("capturing"));
  }

  function startKeybindingCapture(targetChip, onKeySelected) {
    stopKeybindingCapture();
    if (!targetChip) return;
    targetChip.classList.add("capturing");
    keybindingCaptureHandler = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.classList && activeEl.classList.contains("input-mode")) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { stopKeybindingCapture(); return; }
      onKeySelected(e.code);
      stopKeybindingCapture();
    };
    window.addEventListener("keydown", keybindingCaptureHandler, true);
  }

  function renderKeyChip(list, idx, onChange, onRemove, showRemoveBtn = true) {
    const code = list[idx] || "";
    const container2 = document.createElement("div");
    container2.style.display = "flex";
    container2.style.alignItems = "center";
    container2.style.gap = "4px";
    
    const chip = document.createElement("input");
    chip.className = "kb-key-chip" + (code ? "" : " empty");
    chip.type = "text";
    chip.value = code;
    chip.placeholder = "录入";
    chip.style.width = "50px";
    chip.style.textAlign = "center";
    
    const modeBtn = document.createElement("button");
    modeBtn.className = "kb-mode-btn";
    modeBtn.textContent = "⌨";
    
    let isCaptureMode = true;
    
    const updateMode = () => {
      if (isCaptureMode) {
        chip.readOnly = true;
        chip.classList.remove("input-mode");
        chip.classList.add("capture-mode");
        modeBtn.textContent = "⌨";
      } else {
        stopKeybindingCapture();
        chip.readOnly = false;
        chip.classList.add("input-mode");
        chip.classList.remove("capture-mode");
        modeBtn.textContent = "✎";
      }
    };
    updateMode();
    
    modeBtn.onclick = (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      isCaptureMode = !isCaptureMode;
      updateMode();
      if (!isCaptureMode) setTimeout(() => { chip.focus(); chip.select(); }, 10);
    };
    
    chip.onfocus = () => {
      if (isCaptureMode) {
        chip.classList.add("capturing");
        startKeybindingCapture(chip, (newCode) => {
          chip.value = newCode; list[idx] = newCode; onChange();
          chip.classList.remove("capturing");
        });
      }
    };
    chip.onblur = () => {
      if (isCaptureMode) stopKeybindingCapture();
      else { list[idx] = chip.value.trim(); onChange(); }
      chip.classList.remove("capturing");
    };
    chip.oninput = () => { if (!isCaptureMode) list[idx] = chip.value.trim(); };
    chip.onkeydown = (ev) => { if (!isCaptureMode) ev.stopPropagation(); };
    chip.onkeyup = (ev) => { if (!isCaptureMode) ev.stopPropagation(); };

    // 只有 showRemoveBtn 为 true 时才显示减号按钮
    if (showRemoveBtn) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "kb-remove-key-btn";
      removeBtn.textContent = "-";
      removeBtn.onclick = (ev) => { ev.stopPropagation(); list.splice(idx, 1); onRemove(); };
      container2.appendChild(removeBtn);
    }
    
    container2.appendChild(chip);
    container2.appendChild(modeBtn);
    return container2;
  }

  function renderKeyRow(container2, labelStr, list, showAddBtn = true, showRemoveBtn = true) {
    const row = document.createElement("div");
    row.className = "kb-row";
    const rowLabel = document.createElement("div");
    rowLabel.className = "kb-row-label";
    rowLabel.textContent = labelStr;
    row.appendChild(rowLabel);
    const keyList = document.createElement("div");
    keyList.className = "kb-key-list";
    row.appendChild(keyList);
    const rerenderKeys = () => {
      keyList.innerHTML = "";
      list.forEach((_, idx) => {
        keyList.appendChild(renderKeyChip(list, idx, rerenderKeys, rerenderKeys, showRemoveBtn));
      });
      // 只有 showAddBtn 为 true 时才显示加减按钮
      if (showAddBtn) {
        const addBtn = document.createElement("button");
        addBtn.className = "kb-add-key-btn";
        addBtn.textContent = "+";
        addBtn.onclick = () => { list.push(""); rerenderKeys(); };
        keyList.appendChild(addBtn);
      }
    };
    rerenderKeys();
    container2.appendChild(row);
  }

  function renderKeybindings() {
    keybindingBody.innerHTML = "";
    const addSectionTitle = (txt) => {
      const h = document.createElement("div");
      h.className = "kb-section-title";
      h.textContent = txt;
      keybindingBody.appendChild(h);
    };

    const ctrlWrap = document.createElement("div");
    ctrlWrap.style.display = "flex";
    ctrlWrap.style.gap = "16px";
    ctrlWrap.style.alignItems = "flex-start";
    const prevOctaveRow = document.createElement("div");
    prevOctaveRow.style.flex = "1";
    renderKeyRow(prevOctaveRow, "切换低八度", pcKeyMap.control.prevOctave || (pcKeyMap.control.prevOctave = []), false, false);
    ctrlWrap.appendChild(prevOctaveRow);
    const nextOctaveRow = document.createElement("div");
    nextOctaveRow.style.flex = "1";
    renderKeyRow(nextOctaveRow, "切换高八度", pcKeyMap.control.nextOctave || (pcKeyMap.control.nextOctave = []), false, false);
    ctrlWrap.appendChild(nextOctaveRow);
    // 添加播放暂停键设置
    if (!pcKeyMap.control.playPause) pcKeyMap.control.playPause = ["Space"];
    const playPauseRow = document.createElement("div");
    playPauseRow.style.flex = "1";
    renderKeyRow(playPauseRow, "播放/暂停", pcKeyMap.control.playPause, false, false);
    ctrlWrap.appendChild(playPauseRow);
    keybindingBody.appendChild(ctrlWrap);

    const descText = document.createElement("div");
    descText.style.cssText = "font-size:11px;color:#666;margin-top:4px;margin-bottom:12px;";
    descText.textContent = "提示：WERTYUI（高音）和 ZXCVBNM（低音）会随当前八度动态变化";
    keybindingBody.appendChild(descText);

    addSectionTitle("音阶控制");
    const scaleCols = document.createElement("div");
    scaleCols.className = "kb-scale-columns";
    const colCurrent = document.createElement("div");
    colCurrent.className = "kb-scale-col";
    const colHigh = document.createElement("div");
    colHigh.className = "kb-scale-col";
    const colLow = document.createElement("div");
    colLow.className = "kb-scale-col";

    const titles = ["当前八度 1~7", "高音 1~7 (当前+1)", "低音 1~7 (当前-1)"];
    [colCurrent, colHigh, colLow].forEach((col, i) => {
      const t = document.createElement("div");
      t.className = "kb-scale-col-title"; t.textContent = titles[i];
      col.appendChild(t);
    });

    const baseNotes = ["C","D","E","F","G","A","B"];
    const nameMap = ["1 (Do)","2 (Re)","3 (Mi)","4 (Fa)","5 (Sol)","6 (La)","7 (Si)"];
    baseNotes.forEach((n, idx) => {
      if (!pcKeyMap.base[n]) pcKeyMap.base[n] = [];
      renderKeyRow(colCurrent, nameMap[idx], pcKeyMap.base[n]);
    });
    baseNotes.forEach((n, idx) => {
      if (!pcKeyMap.fixed.octave5) pcKeyMap.fixed.octave5 = {};
      if (!pcKeyMap.fixed.octave5[n]) pcKeyMap.fixed.octave5[n] = [];
      renderKeyRow(colHigh, "高音 " + (idx + 1), pcKeyMap.fixed.octave5[n]);
    });
    baseNotes.forEach((n, idx) => {
      if (!pcKeyMap.fixed.octave3) pcKeyMap.fixed.octave3 = {};
      if (!pcKeyMap.fixed.octave3[n]) pcKeyMap.fixed.octave3[n] = [];
      renderKeyRow(colLow, "低音 " + (idx + 1), pcKeyMap.fixed.octave3[n]);
    });
    scaleCols.appendChild(colCurrent);
    scaleCols.appendChild(colHigh);
    scaleCols.appendChild(colLow);
    keybindingBody.appendChild(scaleCols);

    if (!pcKeyMap.extra) pcKeyMap.extra = [];
    const extraWrap = document.createElement("div");
    extraWrap.className = "kb-extra-wrap";
    const header = document.createElement("div");
    header.className = "kb-extra-header";
    const title = document.createElement("div");
    title.className = "kb-section-title"; title.style.margin = "0"; title.textContent = "其他音阶按键";
    header.appendChild(title);
    const addBtn = document.createElement("button");
    addBtn.className = "kb-add-key-btn"; addBtn.textContent = "+"; addBtn.title = "增加其他音阶按键";
    header.appendChild(addBtn);
    extraWrap.appendChild(header);
    const listWrap = document.createElement("div");
    extraWrap.appendChild(listWrap);

    const octaveNames = {1:"倍低音",2:"低音",3:"中低音",4:"中音",5:"中高音",6:"高音",7:"倍高音"};
    const notesOrder = [
      {n:"C",name:"1 (Do)"},{n:"C#",name:"#1 (Do#)"},{n:"D",name:"2 (Re)"},{n:"D#",name:"#2 (Re#)"},
      {n:"E",name:"3 (Mi)"},{n:"F",name:"4 (Fa)"},{n:"F#",name:"#4 (Fa#)"},{n:"G",name:"5 (Sol)"},
      {n:"G#",name:"#5 (Sol#)"},{n:"A",name:"6 (La)"},{n:"A#",name:"#6 (La#)"},{n:"B",name:"7 (Si)"}
    ];
    const opts = [];
    for (let oct = 1; oct <= 7; oct++) {
      notesOrder.forEach(ni => opts.push({ v: ni.n + oct, t: `${octaveNames[oct]} ${ni.name}` }));
    }

    const renderExtra = () => {
      listWrap.innerHTML = "";
      pcKeyMap.extra.forEach((row, idx) => {
        const r = document.createElement("div");
        r.className = "kb-extra-row";
        const sel = document.createElement("select");
        sel.className = "kb-extra-select";
        opts.forEach(o => {
          const op = document.createElement("option");
          op.value = o.v; op.textContent = o.t;
          if (row.note === o.v) op.selected = true;
          sel.appendChild(op);
        });
        sel.onchange = () => { row.note = sel.value; };
        r.appendChild(sel);
        if (!row.keys) row.keys = [];
        const keyList2 = document.createElement("div");
        keyList2.className = "kb-key-list";
        const rerenderKeys = () => {
          keyList2.innerHTML = "";
          row.keys.forEach((_, kIdx) => keyList2.appendChild(renderKeyChip(row.keys, kIdx, rerenderKeys, rerenderKeys)));
          const ab = document.createElement("button");
          ab.className = "kb-add-key-btn"; ab.textContent = "+";
          ab.onclick = () => { row.keys.push(""); rerenderKeys(); };
          keyList2.appendChild(ab);
        };
        rerenderKeys();
        r.appendChild(keyList2);
        const delBtn = document.createElement("button");
        delBtn.className = "kb-extra-remove"; delBtn.textContent = "-";
        delBtn.onclick = () => { pcKeyMap.extra.splice(idx, 1); renderExtra(); };
        r.appendChild(delBtn);
        listWrap.appendChild(r);
      });
    };
    addBtn.onclick = () => { pcKeyMap.extra.push({note:"C3",keys:[]}); renderExtra(); };
    renderExtra();
    keybindingBody.appendChild(extraWrap);

    if (!pcKeyMap.chord) pcKeyMap.chord = [];
    const chordWrap = document.createElement("div");
    chordWrap.className = "kb-extra-wrap";
    const chordHeader = document.createElement("div");
    chordHeader.className = "kb-extra-header";
    const chordTitle = document.createElement("div");
    chordTitle.className = "kb-section-title"; chordTitle.style.margin = "0"; chordTitle.textContent = "组合按键设置（和弦）";
    chordHeader.appendChild(chordTitle);
    const chordAddBtn = document.createElement("button");
    chordAddBtn.className = "kb-extra-btn"; chordAddBtn.textContent = "+";
    chordAddBtn.onclick = () => { 
      pcKeyMap.chord.push({
        notes:[{n:"C4",delay:0},{n:"E4",delay:0},{n:"G4",delay:0}], 
        keys:[]
      }); 
      renderChord(); 
    };
    chordHeader.appendChild(chordAddBtn);
    chordWrap.appendChild(chordHeader);
    const chordListWrap = document.createElement("div");
    chordWrap.appendChild(chordListWrap);

    // 每个组合键纵向排布；组合键内音符每3个一列横向滚动
    const renderChord = () => {
      chordListWrap.innerHTML = "";

      if (pcKeyMap.chord.length === 0) {
        const hint = document.createElement("div");
        hint.style.cssText = "font-size:12px;color:#555;padding:8px 0;";
        hint.textContent = "暂无组合键，点击 + 添加";
        chordListWrap.appendChild(hint);
        return;
      }

      pcKeyMap.chord.forEach((row, idx) => {
        // 兼容旧格式：notes 可能是字符串数组，转换为对象数组
        if (!row.notes) row.notes = [];
        row.notes = row.notes.map(n => (typeof n === "string") ? {n, delay:0} : n);

        const card = document.createElement("div");
        card.style.cssText = "background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:10px;margin-bottom:10px;";

        // ── 顶部：快捷键 + 删除 ──
        const topRow = document.createElement("div");
        topRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
        const keyLabel = document.createElement("span");
        keyLabel.textContent = "触发键:"; keyLabel.style.cssText = "font-size:11px;color:#888;flex-shrink:0;";
        topRow.appendChild(keyLabel);
        const keyListWrap = document.createElement("div");
        keyListWrap.className = "kb-key-list"; keyListWrap.style.flex = "1";
        const rerenderKeys = () => {
          keyListWrap.innerHTML = "";
          if (!row.keys || row.keys.length === 0) row.keys = [""];
          row.keys.forEach((_, kIdx) => keyListWrap.appendChild(renderKeyChip(row.keys, kIdx, rerenderKeys, rerenderKeys)));
          const ab = document.createElement("button"); ab.className = "kb-add-key-btn"; ab.textContent = "+";
          ab.onclick = () => { row.keys.push(""); rerenderKeys(); };
          keyListWrap.appendChild(ab);
        };
        rerenderKeys();
        topRow.appendChild(keyListWrap);
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕"; delBtn.style.cssText = "width:26px;height:26px;border-radius:5px;border:1px solid #444;background:#2a2a2a;color:#ccc;font-size:12px;cursor:pointer;flex-shrink:0;";
        delBtn.onclick = () => { pcKeyMap.chord.splice(idx, 1); renderChord(); };
        topRow.appendChild(delBtn);
        card.appendChild(topRow);

        // ── 音符区：每3个音符为一列，横向滚动 ──
        const notesArea = document.createElement("div");
        notesArea.style.cssText = "display:flex;flex-direction:row;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;";

        const NOTE_COL = 3;
        const rerenderNotes = () => {
          notesArea.innerHTML = "";
          // 按每3个分列
          const totalCols = Math.max(1, Math.ceil(row.notes.length / NOTE_COL));
          for (let ci = 0; ci < totalCols; ci++) {
            const colEl = document.createElement("div");
            colEl.style.cssText = "flex-shrink:0;display:flex;flex-direction:column;gap:4px;min-width:220px;";
            for (let ri = 0; ri < NOTE_COL; ri++) {
              const nIdx = ci * NOTE_COL + ri;
              if (nIdx >= row.notes.length) break;
              const noteObj = row.notes[nIdx];
              const noteRow2 = document.createElement("div");
              noteRow2.style.cssText = "display:flex;align-items:center;gap:4px;";
              // 音符选择
              const noteSel = document.createElement("select");
              noteSel.className = "kb-extra-select"; noteSel.style.flex = "1";
              opts.forEach(o => {
                const op = document.createElement("option");
                op.value = o.v; op.textContent = o.t;
                if (noteObj.n === o.v) op.selected = true;
                noteSel.appendChild(op);
              });
              noteSel.onchange = () => { row.notes[nIdx].n = noteSel.value; };
              noteRow2.appendChild(noteSel);
              const dInputWrap = document.createElement("div");
              dInputWrap.style.cssText = "display:flex;align-items:center;gap:3px;";
              // 延迟输入
              const dInput = document.createElement("input");
              dInput.type = "number"; dInput.min = "0"; dInput.max = "5000"; dInput.step = "50";
              dInput.value = noteObj.delay || 0;
              dInput.title = "延迟(ms)";
              dInput.placeholder = "延迟";
              dInput.style.cssText = "width:56px;padding:3px 5px;border-radius:5px;border:1px solid #444;background:#111;color:#eee;font-size:11px;";
              dInput.onchange = () => { row.notes[nIdx].delay = parseInt(dInput.value) || 0; };
              dInputWrap.appendChild(dInput);
              const dUnit = document.createElement("span");
              dUnit.textContent = "ms";
              dUnit.style.cssText = "font-size:11px;color:#888;";
              dInputWrap.appendChild(dUnit);
              noteRow2.appendChild(dInputWrap);
              // 删除音符
              const rmBtn = document.createElement("button");
              rmBtn.className = "kb-remove-key-btn"; rmBtn.textContent = "-";
              rmBtn.onclick = () => { row.notes.splice(nIdx, 1); rerenderNotes(); };
              noteRow2.appendChild(rmBtn);
              colEl.appendChild(noteRow2);
            }
            notesArea.appendChild(colEl);
          }
          // 添加音符按钮（放在末尾单独一列）
          const addCol = document.createElement("div");
          addCol.style.cssText = "flex-shrink:0;display:flex;align-items:center;";
          const addNoteBtn = document.createElement("button");
          addNoteBtn.className = "kb-add-key-btn"; addNoteBtn.style.height = "28px"; addNoteBtn.textContent = "+";
          addNoteBtn.title = "添加音符";
          addNoteBtn.onclick = () => { row.notes.push({n:"C4",delay:0}); rerenderNotes(); };
          addCol.appendChild(addNoteBtn);
          notesArea.appendChild(addCol);
        };
        rerenderNotes();
        card.appendChild(notesArea);
        chordListWrap.appendChild(card);
      });
    };
    renderChord();
    keybindingBody.appendChild(chordWrap);

    // ---- 乐器切换快捷键 ----
    if (!pcKeyMap.instSwitchList) pcKeyMap.instSwitchList = [];
    const instSwitchWrap = document.createElement("div");
    instSwitchWrap.className = "kb-extra-wrap";
    const instSwitchHeader = document.createElement("div");
    instSwitchHeader.className = "kb-extra-header";
    const instSwitchTitle = document.createElement("div");
    instSwitchTitle.className = "kb-section-title"; instSwitchTitle.style.margin = "0"; instSwitchTitle.textContent = "切换乐器快捷键";
    instSwitchHeader.appendChild(instSwitchTitle);
    instSwitchWrap.appendChild(instSwitchHeader);
    const instSwitchDesc = document.createElement("div");
    instSwitchDesc.style.cssText = "font-size:11px;color:#666;margin-bottom:8px;";
    instSwitchDesc.textContent = "为乐器绑定快捷键，按下后立即切换（不影响当前播放）";
    instSwitchWrap.appendChild(instSwitchDesc);

    const INST_LIST_KB = [
      {v:"piano",t:"钢琴"},{v:"guitar",t:"吉他"},{v:"violin",t:"小提琴"},{v:"cello",t:"大提琴"},
      {v:"xiao",t:"箫"},{v:"dizi",t:"笛子"},{v:"guzheng",t:"古筝"},{v:"erhu",t:"二胡"},
      {v:"pipa",t:"琵琶"},{v:"drum",t:"鼓"},{v:"drumkit",t:"架子鼓"},{v:"bell",t:"钟声"},
      {v:"suona",t:"唢呐"},{v:"bass",t:"贝斯"},{v:"saxophone",t:"萨克斯"}
    ];

    // 容器：横向排列，自动换行
    const instSwitchList = document.createElement("div");
    instSwitchList.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";

    // 渲染所有乐器快捷键项
    const renderInstSwitchList = () => {
      instSwitchList.innerHTML = "";
      pcKeyMap.instSwitchList.forEach((item, idx) => {
        const itemWrap = document.createElement("div");
        itemWrap.style.cssText = "display:flex;align-items:center;gap:4px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:4px 6px;";

        // 乐器选择下拉框（宽度为4个中文字符）
        const instSelect = document.createElement("select");
        instSelect.style.cssText = "min-width:5.5em;padding:4px 6px;background:#111;border:1px solid #333;border-radius:4px;color:#eee;font-size:12px;cursor:pointer;";
        INST_LIST_KB.forEach(inst => {
          const opt = document.createElement("option");
          opt.value = inst.v;
          opt.textContent = inst.t;
          if (inst.v === item.inst) opt.selected = true;
          instSelect.appendChild(opt);
        });
        instSelect.onchange = () => {
          item.inst = instSelect.value;
        };
        itemWrap.appendChild(instSelect);

        // 快捷键输入框
        const keyInput = document.createElement("input");
        keyInput.className = "kb-key-chip" + (item.key ? "" : " empty");
        keyInput.type = "text";
        keyInput.readOnly = true;
        keyInput.value = item.key || "";
        keyInput.placeholder = "录入";
        keyInput.style.cssText = "width:60px;text-align:center;cursor:pointer;font-size:12px;";
        keyInput.onfocus = () => {
          keyInput.classList.add("capturing");
          startKeybindingCapture(keyInput, (newCode) => {
            item.key = newCode;
            keyInput.value = newCode;
            keyInput.classList.remove("empty", "capturing");
          });
        };
        keyInput.onblur = () => {
          stopKeybindingCapture();
          keyInput.classList.remove("capturing");
        };
        itemWrap.appendChild(keyInput);

        // 删除按钮
        const delBtn = document.createElement("button");
        delBtn.className = "kb-remove-key-btn";
        delBtn.textContent = "-";
        delBtn.onclick = (ev) => {
          ev.stopPropagation();
          pcKeyMap.instSwitchList.splice(idx, 1);
          renderInstSwitchList();
        };
        itemWrap.appendChild(delBtn);

        instSwitchList.appendChild(itemWrap);
      });

      // 添加按钮
      const addBtn = document.createElement("button");
      addBtn.className = "kb-add-key-btn";
      addBtn.textContent = "+";
      addBtn.style.marginLeft = "4px";
      addBtn.onclick = () => {
        pcKeyMap.instSwitchList.push({ inst: "piano", key: "" });
        renderInstSwitchList();
      };
      instSwitchList.appendChild(addBtn);
    };

    renderInstSwitchList();
    instSwitchWrap.appendChild(instSwitchList);
    keybindingBody.appendChild(instSwitchWrap);
  }

  keybindingSave.onclick = () => {
    let conflictMsg = "";
    const checkArray = (arr, label) => {
      const used = new Set();
      for (const k of arr) {
        if (!k) continue;
        if (used.has(k)) { conflictMsg = `按键 '${k}' 在 ${label} 中重复使用。`; return true; }
        used.add(k);
      }
      return false;
    };
    const checkMapArrays = (obj, prefix) => {
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const v = obj[key];
        const label = prefix ? `${prefix} ${key}` : key;
        if (Array.isArray(v)) { if (checkArray(v, label)) return true; }
        else if (typeof v === "object" && v) { if (checkMapArrays(v, label)) return true; }
      }
      return false;
    };
    if (checkMapArrays(pcKeyMap, "")) { showAppAlert(conflictMsg); return; }
    saveKeyMap();
    keybindingOverlay.classList.remove('show');
    stopKeybindingCapture();
    renderVirtualKeys();
  };

  keybindingRestore.onclick = () => {
    pcKeyMap = JSON.parse(JSON.stringify(DEFAULT_PC_KEY_MAP));
    renderKeybindings();
  };

  // 保存乐谱状态
  let savedScoreState = {
    tokens: [],
    currentSong: null,
    isFollowing: false,
    isAutoPlaying: false,
    highlightNoteIdx: -1,
    animNoteIdx: -1
  };
  
  layoutBtn.onclick = () => {
    if (!isLayoutMode) {
      // 进入布局模式前保存滚动位置
      const _savedScrolls = [];
      container.querySelectorAll('.octave-row').forEach((row, i) => {
        const kw = row.querySelector('.octave-row-keys');
        _savedScrolls[i] = kw ? kw.scrollLeft : 0;
      });

      // 进入布局模式
      isLayoutMode = true;
      layoutBtn.classList.add("active");
      layoutToolbar.classList.add("active");
      container.classList.add("layout-mode-active");
      document.body.classList.add("layout-mode-active");
      
      // 保存乐谱状态并隐藏乐谱
      savedScoreState = {
        tokens: [...tokens],
        currentSong: currentSong,
        isFollowing: isFollowing,
        isAutoPlaying: isAutoPlaying,
        highlightNoteIdx: highlightNoteIdx,
        animNoteIdx: animNoteIdx
      };
      
      // 停止自动播放
      stopAutoPlay();
      clearAutoPlayInterval();
      
      // 清除动画
      cancelAnimationFrame(animRAF);
      cancelAnimationFrame(scrollRAF);
      
      // 隐藏乐谱画布，只显示提示
      canvas.style.display = "none";
      
      settingOverlay.classList.remove("show");
      renderPiano(); // 重新渲染以显示控制条
      enableOctaveDragging();
      updateLayoutToolbarPosition();

      // 恢复滚动位置（在 renderPiano 的默认滚动之后）
      setTimeout(() => {
        container.querySelectorAll('.octave-row').forEach((row, i) => {
          const kw = row.querySelector('.octave-row-keys');
          if (kw && _savedScrolls[i] > 0) kw.scrollLeft = _savedScrolls[i];
        });
        container.querySelectorAll('.octave-gap-row').forEach((gapRow, i) => {
          if (_savedScrolls[i] > 0) gapRow.scrollLeft = _savedScrolls[i];
        });
      }, 350);
    } else {
      // 退出布局模式
      exitLayoutMode(true);
    }
  };

  function exitLayoutMode(doSave) {
    if (!isLayoutMode) return;
    
    if (doSave) saveLayoutSettings();

    // Capture scroll positions before renderPiano resets them
    const _savedScrolls = [];
    container.querySelectorAll('.octave-row').forEach((row, i) => {
      const kw = row.querySelector('.octave-row-keys');
      _savedScrolls[i] = kw ? kw.scrollLeft : 0;
    });

    isLayoutMode = false;
    layoutBtn.classList.remove("active");
    layoutToolbar.classList.remove("active");
    container.classList.remove("layout-mode-active");
    document.body.classList.remove("layout-mode-active");
    settingOverlay.classList.remove("show");
    
    // 退出布局模式：恢复乐谱状态
    tokens = [...savedScoreState.tokens];
    currentSong = savedScoreState.currentSong;
    isFollowing = savedScoreState.isFollowing;
    isAutoPlaying = savedScoreState.isAutoPlaying;
    highlightNoteIdx = savedScoreState.highlightNoteIdx;
    animNoteIdx = savedScoreState.animNoteIdx;
    
    // 显示乐谱画布
    canvas.style.display = "block";
    
    // 重新绘制乐谱
    canvas.width = scoreWrap.clientWidth;
    drawScore();
    
    renderPiano(); // 重新渲染以隐藏控制条（isLayoutMode=false时renderPiano不渲染行设置面板）
    // 注意：不调用 updateLayout()，因为它会干扰滚动位置
    // 直接设置 CSS 变量确保布局正确
    const widthLevel = parseFloat(sliderWidth.value) || 1;
    const height = sliderHeight.value;
    const gap = sliderGap.value;
    document.documentElement.style.setProperty('--key-width-scale', widthLevel);
    document.documentElement.style.setProperty('--key-height', height + 'px');
    document.documentElement.style.setProperty('--row-gap', gap + 'px');
    const octaveWidthPercent = (widthLevel * 100 / 7);
    document.documentElement.style.setProperty('--octave-width', octaveWidthPercent + 'vw');
    currentWidthScale = widthLevel;
    disableOctaveDragging();

    // Restore scroll positions after renderPiano's default scroll timer (300ms)
    if (doSave) {
      setTimeout(() => {
        container.querySelectorAll('.octave-row').forEach((row, i) => {
          const kw = row.querySelector('.octave-row-keys');
          if (kw && _savedScrolls[i] > 0) kw.scrollLeft = _savedScrolls[i];
        });
        container.querySelectorAll('.octave-gap-row').forEach((gapRow, i) => {
          if (_savedScrolls[i] > 0) gapRow.scrollLeft = _savedScrolls[i];
        });
      }, 350);
    }
  }

  const btnSaveLayout = document.getElementById("btnSaveLayout");
  btnSaveLayout.onclick = () => {
    exitLayoutMode(true); // saves settings, restores scroll, closes overlay
  };

  function saveLayoutSettings() {
    const settings = {
      rows: parseInt(sliderRows.value),
      width: parseFloat(sliderWidth.value),
      height: parseInt(sliderHeight.value),
      gap: parseInt(sliderGap.value),
      screenRotation: '',
      screenMode: document.body.classList.contains('landscape-mode') ? 'landscape' : 'portrait',
      toolbarRotation: '',
      rowScrollPositions: []
    };
    const screenRotations = ['', 'rotated-90', 'rotated-180', 'rotated-270'];
    const toolbarRotations = ['', 'toolbar-rotated-90', 'toolbar-rotated-180', 'toolbar-rotated-270'];
    for (const r of screenRotations) {
      if (document.body.classList.contains(r)) { settings.screenRotation = r; break; }
    }
    for (const r of toolbarRotations) {
      if (document.body.classList.contains(r)) { settings.toolbarRotation = r; break; }
    }
    // Save each row's horizontal scroll position
    container.querySelectorAll('.octave-row').forEach((row, i) => {
      const kw = row.querySelector('.octave-row-keys');
      settings.rowScrollPositions[i] = kw ? kw.scrollLeft : 0;
    });
    try {
      localStorage.setItem("pianoLayoutSettings", JSON.stringify(settings));
    } catch (e) {}
  }

  function loadLayoutSettings() {
    try {
      const saved = localStorage.getItem("pianoLayoutSettings");
      if (saved) {
        const settings = JSON.parse(saved);
        // 根据横屏/竖屏模式设置默认值
        const isLandscapeMode = settings.screenMode === 'landscape';
        const defaultRows = isLandscapeMode ? 3 : 7;
        const defaultWidth = isLandscapeMode ? 1 : 7;
        const defaultHeight = 80;
        const defaultGap = isLandscapeMode ? 28 : 0;
        
        sliderRows.value = settings.rows || defaultRows; inputRows.value = settings.rows || defaultRows;
        sliderWidth.value = settings.width || defaultWidth; inputWidth.value = settings.width || defaultWidth;
        sliderHeight.value = settings.height || defaultHeight; inputHeight.value = settings.height || defaultHeight;
        sliderGap.value = settings.gap || defaultGap; inputGap.value = settings.gap || defaultGap;
        if (settings.screenRotation) {
          const screenRotations = ['', 'rotated-90', 'rotated-180', 'rotated-270'];
          for (const r of screenRotations) {
            document.body.classList.remove(r);
          }
          document.body.classList.add(settings.screenRotation);
        }
        if (settings.screenMode === 'landscape') {
          document.body.classList.add('landscape-mode');
        }
        if (settings.toolbarRotation) {
          const toolbarRotations = ['', 'toolbar-rotated-90', 'toolbar-rotated-180', 'toolbar-rotated-270'];
          for (const r of toolbarRotations) {
            document.body.classList.remove(r);
          }
          document.body.classList.add(settings.toolbarRotation);
          const labels = ['⬆ 顶栏', '⬅ 右边', '⬇ 底栏', '➡ 左边'];
          const idx = toolbarRotations.indexOf(settings.toolbarRotation);
          if (idx >= 0 && idx < labels.length && btnToolbarPos) {
            btnToolbarPos.textContent = labels[idx];
          }
        }
        // 先设置CSS变量，再渲染琴键
        const settingsRows = settings.rows || (settings.screenMode === 'landscape' ? 3 : 7);
        const settingsWidth = settings.width || (settings.screenMode === 'landscape' ? 1 : 7);
        const settingsHeight = settings.height || 80;
        const settingsGap = settings.gap || (settings.screenMode === 'landscape' ? 28 : 0);
        document.documentElement.style.setProperty('--key-width-scale', settingsWidth);
        document.documentElement.style.setProperty('--key-height', settingsHeight + 'px');
        document.documentElement.style.setProperty('--row-gap', settingsGap + 'px');
        const octaveWidthPercent = (settingsWidth * 100 / 7);
        document.documentElement.style.setProperty('--octave-width', octaveWidthPercent + 'vw');
        currentWidthScale = settingsWidth;

        renderPiano();
        // 注意：不调用 updateLayout()，因为 renderPiano() 已经会设置默认滚动位置
        // Restore row scroll positions after render
        // Must use setTimeout > 300ms to run AFTER renderPiano's default scroll timer
        if (settings.rowScrollPositions && settings.rowScrollPositions.length) {
          setTimeout(() => {
            container.querySelectorAll('.octave-row').forEach((row, i) => {
              const kw = row.querySelector('.octave-row-keys');
              if (kw && settings.rowScrollPositions[i] != null && settings.rowScrollPositions[i] > 0) {
                kw.scrollLeft = settings.rowScrollPositions[i];
              }
            });
            container.querySelectorAll('.octave-gap-row').forEach((gapRow, i) => {
              if (settings.rowScrollPositions[i] != null && settings.rowScrollPositions[i] > 0) {
                gapRow.scrollLeft = settings.rowScrollPositions[i];
              }
            });
          }, 350);
        }
      }
    } catch (e) {}
  }
  loadLayoutSettings();

  const btnPortrait = document.getElementById("btnPortrait");
  const btnLandscape = document.getElementById("btnLandscape");
  
  function setScreenMode(isLandscape) {
    document.body.classList.remove('rotated-90', 'rotated-180', 'rotated-270');
    document.body.classList.remove('toolbar-rotated-90', 'toolbar-rotated-180', 'toolbar-rotated-270');
    
    // 横屏/竖屏按钮使用固定的初始设置，不受用户保存的设置影响
    const defaultRows = isLandscape ? 3 : 7;
    const defaultWidth = isLandscape ? 6 : 7;
    const defaultHeight = 80;
    const defaultGap = isLandscape ? 28 : 40;
    
    if (isLandscape) {
      document.body.classList.add('landscape-mode');
      try { localStorage.setItem('screenMode', 'landscape'); } catch(e) {}
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {});
      } else if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      document.body.classList.remove('landscape-mode');
      try { localStorage.setItem('screenMode', 'portrait'); } catch(e) {}
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
    
    // 直接使用固定的默认值，不读取用户保存的设置
    sliderRows.value = defaultRows; inputRows.value = defaultRows;
    sliderWidth.value = defaultWidth; inputWidth.value = defaultWidth;
    sliderHeight.value = defaultHeight; inputHeight.value = defaultHeight;
    sliderGap.value = defaultGap; inputGap.value = defaultGap;

    // 先设置CSS变量，再渲染琴键
    document.documentElement.style.setProperty('--key-width-scale', defaultWidth);
    document.documentElement.style.setProperty('--key-height', defaultHeight + 'px');
    document.documentElement.style.setProperty('--row-gap', defaultGap + 'px');
    const octaveWidthPercent = (defaultWidth * 100 / 7);
    document.documentElement.style.setProperty('--octave-width', octaveWidthPercent + 'vw');
    currentWidthScale = defaultWidth;

    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
    updateLayoutToolbarPosition();
    renderPiano();
    // 注意：不调用 updateLayout()，因为 renderPiano() 已经会设置默认滚动位置
    // updateLayout() 的滚动恢复逻辑会干扰 renderPiano() 的默认滚动设置
  }
  
  btnPortrait.onclick = () => setScreenMode(false);
  btnLandscape.onclick = () => setScreenMode(true);

  if (btnToolbarPos) {
    btnToolbarPos.onclick = () => {
      const rotations = ['', 'toolbar-rotated-90', 'toolbar-rotated-180', 'toolbar-rotated-270'];
      let currentIdx = 0;
      for (let i = 1; i < rotations.length; i++) {
        if (document.body.classList.contains(rotations[i])) {
          currentIdx = i;
          break;
        }
      }
      if (rotations[currentIdx]) {
        document.body.classList.remove(rotations[currentIdx]);
      }
      const nextIdx = (currentIdx + 1) % rotations.length;
      if (rotations[nextIdx]) {
        document.body.classList.add(rotations[nextIdx]);
      }
      const labels = ['⬆ 顶栏', '⬅ 右边', '⬇ 底栏', '➡ 左边'];
      btnToolbarPos.textContent = labels[nextIdx];
      try { localStorage.setItem('toolbarRotation', nextIdx.toString()); } catch(e) {}
      
      updateLayoutToolbarPosition();
    };
  }
  
  function updateLayoutToolbarPosition() {
    const layoutToolbar = document.getElementById('layoutToolbar');
    const settingBtnWrap = document.querySelector('.setting-btn-wrap');
    if (!layoutToolbar || !settingBtnWrap) return;
    
    layoutToolbar.style.marginLeft = '';
    layoutToolbar.style.marginRight = '';
    
    void layoutToolbar.offsetHeight;
  }
  
  try {
    const savedMode = localStorage.getItem('screenMode');
    if (savedMode === 'landscape') {
      document.body.classList.add('landscape-mode');
      // 横屏模式默认值：排数3，宽度6，高度80，间隙0
      const savedSettings = localStorage.getItem('pianoSettings');
      if (!savedSettings) {
        sliderRows.value = 3; inputRows.value = 3;
        sliderWidth.value = 6; inputWidth.value = 6;
        sliderHeight.value = 80; inputHeight.value = 80;
        sliderGap.value = 0; inputGap.value = 0;
      }
    } else {
      // 竖屏模式默认值：排数7，宽度7，高度80，间隙40
      const savedSettings = localStorage.getItem('pianoSettings');
      if (!savedSettings) {
        sliderRows.value = 7; inputRows.value = 7;
        sliderWidth.value = 7; inputWidth.value = 7;
        sliderHeight.value = 80; inputHeight.value = 80;
        sliderGap.value = 40; inputGap.value = 40;
      }
    }
  } catch(e) {}
  
  try {
    const savedRotation = parseInt(localStorage.getItem('toolbarRotation') || '0');
    if (savedRotation > 0 && btnToolbarPos) {
      document.body.classList.add('toolbar-rotated-' + (savedRotation * 90));
      const labels = ['⬆ 顶栏', '⬅ 右边', '⬇ 底栏', '➡ 左边'];
      btnToolbarPos.textContent = labels[savedRotation];
      updateLayoutToolbarPosition();
    }
  } catch(e) {}

  // 注意：不调用 setTimeout(updateLayout, 100)，因为 loadLayoutSettings 已经会设置 CSS 变量
  // updateLayout() 的滚动恢复逻辑会干扰 renderPiano() 的默认滚动设置

  function updateLayout() {
    const oldWidthLevel = currentWidthScale || 1;
    const newWidthLevel = parseFloat(sliderWidth.value) || 1;
    const height = sliderHeight.value;
    const gap = sliderGap.value;
    
    // 记录每行当前的滚动中心比例
    const scrollCenterRatios = [];
    container.querySelectorAll('.octave-row').forEach(row => {
      const kw = row.querySelector('.octave-row-keys');
      if (kw) {
        const scrollLeft = kw.scrollLeft;
        const clientWidth = kw.clientWidth;
        const scrollWidth = kw.scrollWidth;
        // 计算当前可视中心相对于总宽度的比例
        const centerRatio = (scrollLeft + clientWidth / 2) / scrollWidth;
        scrollCenterRatios.push(centerRatio);
      }
    });
    
    document.documentElement.style.setProperty('--key-width-scale', newWidthLevel);
    document.documentElement.style.setProperty('--key-height', height + 'px');
    document.documentElement.style.setProperty('--row-gap', gap + 'px');
    // 宽度值决定每个音域的宽度
    // 宽度=1：每个音域占1/7屏幕宽度，7个音域刚好占满整个琴键区域（从倍低音到倍高音）
    // 宽度=7：每个音域占100%屏幕宽度，1个音域占满整个琴键区域（音阶1234567）
    // 每个音域宽度 = (widthLevel / 7) * 100%
    const octaveWidthPercent = (newWidthLevel * 100 / 7);
    document.documentElement.style.setProperty('--octave-width', octaveWidthPercent + 'vw');
    inputWidth.value = newWidthLevel; inputHeight.value = height; inputGap.value = gap; inputRows.value = sliderRows.value;
    // 更新当前宽度值（宽度通过CSS变量控制，不需要重新渲染琴键）
    currentWidthScale = newWidthLevel;
    
    // 使用requestAnimationFrame确保DOM更新后再恢复滚动位置
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.querySelectorAll('.octave-row').forEach((row, i) => {
          const kw = row.querySelector('.octave-row-keys');
          const gapRow = container.querySelectorAll('.octave-gap-row')[i];
          if (kw && scrollCenterRatios[i] != null) {
            const newScrollWidth = kw.scrollWidth;
            const newClientWidth = kw.clientWidth;
            // 根据之前记录的中心比例计算新的滚动位置
            const newScrollLeft = scrollCenterRatios[i] * newScrollWidth - newClientWidth / 2;
            kw.scrollLeft = Math.max(0, newScrollLeft);
            if (gapRow) gapRow.scrollLeft = Math.max(0, newScrollLeft);
          }
        });
      });
    });
    
    // 更新音域名称字体大小
    updateOctaveNameFontSize();
    saveSettings();
  }

  function updateOctaveNameFontSize() {
    const widthLevel = parseFloat(sliderWidth.value) || 1;
    const gap = parseInt(sliderGap.value) || 0;
    const octaveWidthPx = window.innerWidth * widthLevel / 7;
    // 根据间隙高度计算缩放比例（基准间隙20px）
    const gapScale = gap > 0 ? gap / 20 : 0;
    // 字体大小：最大12px，随间隙缩放
    const baseFontSize = Math.min(12, octaveWidthPx / 8);
    const fontSize = Math.min(12, Math.max(0, baseFontSize * gapScale));
    // padding-top：固定8px
    const paddingTop = 8;
    document.querySelectorAll('.octave-name').forEach(el => {
      el.style.fontSize = fontSize + 'px';
      el.style.paddingTop = paddingTop + 'px';
    });
  }

  window.addEventListener('resize', updateOctaveNameFontSize);

  function bindSync(slider, input, callback) {
    // 滑块拖动时，实时更新输入框并触发回调（始终有效）
    slider.oninput = () => {
      input.value = slider.value;
      if(callback) callback();
    };
    // 输入框只在失焦或按回车时同步到滑块并触发回调
    const commitInput = () => {
      let v = parseFloat(input.value);
      if (isNaN(v)) v = parseFloat(slider.value);
      v = Math.min(parseFloat(input.max), Math.max(parseFloat(input.min), v));
      slider.value = v;
      input.value = v;
      if(callback) callback();
    };
    input.onblur = commitInput;
    input.onkeydown = (e) => { if (e.key === "Enter") { input.blur(); } };
    input.oninput = () => {};
  }
  bindSync(sliderRows, inputRows, renderPiano);
  bindSync(sliderWidth, inputWidth, updateLayout);
  bindSync(sliderHeight, inputHeight, updateLayout);
  bindSync(sliderGap, inputGap, updateLayout);

  let dragOctave = null;
  let dragRow = null;
  let startX = 0;
  let offsetX = 0;

  function enableOctaveDragging() {
    container.querySelectorAll(".octave-group").forEach(oct => {
      oct.onmousedown = onOctaveDragStart;
      oct.ontouchstart = onOctaveDragStart;
    });
  }
  function disableOctaveDragging() {
    container.querySelectorAll(".octave-group").forEach(oct => {
      oct.onmousedown = null; oct.ontouchstart = null;
    });
  }
  function _isScreenRotated() {
    return document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
  }
  function onOctaveDragStart(e) {
    if (!isLayoutMode) return;
    dragOctave = this;
    // 找到 keysWrap（键盘滚动容器）
    dragRow = this.closest(".octave-row-keys") || this.parentElement;
    const touch = e.touches ? e.touches[0] : e;
    // When body rotated 90/270, horizontal screen motion = vertical body motion
    // Use clientY as the drag axis when rotated (rows are now horizontal on screen)
    startX = _isScreenRotated() ? touch.clientY : touch.clientX;
    offsetX = dragRow.scrollLeft;
    dragOctave.classList.add("dragging");
    document.onmousemove = onOctaveDragMove;
    document.ontouchmove = onOctaveDragMove;
    document.onmouseup = onOctaveDragEnd;
    document.ontouchend = onOctaveDragEnd;
    e.preventDefault(); e.stopPropagation();
  }
  function onOctaveDragMove(e) {
    if (!dragOctave || !isLayoutMode) return;
    const touch = e.touches ? e.touches[0] : e;
    const pos = _isScreenRotated() ? touch.clientY : touch.clientX;
    dragRow.scrollLeft = offsetX - (pos - startX);
  }
  function onOctaveDragEnd() {
    if (dragOctave) {
      dragOctave.classList.remove("dragging");
      dragOctave = null; dragRow = null;
      document.onmousemove = null; document.ontouchmove = null;
      document.onmouseup = null; document.ontouchend = null;
    }
  }

  function applyRowColors(rowEl, rowIdx) {
    const cfg = rowColorMap[rowIdx];
    if (!cfg) return;
    rowEl.querySelectorAll('.key.white').forEach(k => {
      k.style.background = cfg.white || '';
    });
    rowEl.querySelectorAll('.key.black').forEach(k => {
      k.style.background = cfg.black || '';
    });
  }

  function createFullVerticalPiano(options) {
    var opt = options || {};
    var octaveOrder = opt.octaveOrder || [1, 2, 3, 4, 5, 6, 7];
    var keyHeight = opt.keyHeight || 40;
    var blackKeyHeight = opt.blackKeyHeight || Math.floor(keyHeight * 0.6);
    var container = opt.container;
    
    if (!container) {
      container = document.createElement('div');
    }
    
    container.innerHTML = '';
    
    var pianoContent = document.createElement('div');
    pianoContent.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;flex-shrink:0;position:relative;width:100%;';
    
    var keyIndex = 0;
    var allKeys = [];
    
    octaveOrder.forEach(function(octNum, octIdx) {
      whiteKeys.forEach(function(n, i) {
        var k = document.createElement('div');
        k.className = 'key white';
        k.dataset.note = n + octNum;
        k.dataset.trackIndex = keyIndex;
        k.dataset.octave = octNum;
        k.dataset.keyName = n;
        k.style.cssText = 'position:relative;width:100%;height:' + keyHeight + 'px;flex:none;';
        pianoContent.appendChild(k);
        allKeys.push({
          element: k,
          note: n + octNum,
          trackIndex: keyIndex,
          isBlack: false
        });
        keyIndex++;
      });
    });
    
    octaveOrder.forEach(function(octNum, octIdx) {
      blackKeys.forEach(function(b) {
        var kb = document.createElement('div');
        kb.className = 'key black';
        kb.dataset.note = b.note + octNum;
        var whiteKeyPos = octIdx * 7 + b.after;
        var topPos = whiteKeyPos * keyHeight + keyHeight / 2;
        kb.style.cssText = 'position:absolute;top:' + topPos + 'px;left:0;width:60%;height:' + blackKeyHeight + 'px;z-index:2;';
        pianoContent.appendChild(kb);
        allKeys.push({
          element: kb,
          note: b.note + octNum,
          trackIndex: whiteKeyPos,
          isBlack: true
        });
      });
    });
    
    container.appendChild(pianoContent);
    
    return {
      container: container,
      pianoContent: pianoContent,
      allKeys: allKeys,
      totalWhiteKeys: keyIndex
    };
  }

  function renderPiano() {
    const rowCount = parseInt(sliderRows.value);
    container.innerHTML = "";
    // 默认模式下，每列从低到高显示：倍低音(1) -> 低音(2) -> 中低音(3) -> 中音(4) -> 中高音(5) -> 高音(6) -> 倍高音(7)
    let focusOctaves = [];
    if (rowCount === 7) {
      focusOctaves = [1, 2, 3, 4, 5, 6, 7];
    } else if (rowCount === 6) {
      focusOctaves = [1, 2, 3, 4, 5, 6];
    } else if (rowCount === 5) {
      focusOctaves = [1, 2, 3, 4, 5];
    } else if (rowCount === 4) {
      focusOctaves = [1, 2, 3, 4];
    } else if (rowCount === 3) {
      focusOctaves = [1, 2, 3];
    } else if (rowCount === 2) {
      focusOctaves = [1, 2];
    } else if (rowCount === 1) {
      focusOctaves = [4]; // 中音
    } else {
      for(let r=0; r<rowCount; r++) {
        let octave = Math.max(1, Math.min(7, r + 1));
        focusOctaves.push(octave);
      }
    }
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowEl = document.createElement("div");
      rowEl.className = "octave-row";
      rowEl.style.position = "relative";
      rowEl.dataset.rowIdx = rowIdx;
      const currentFocusOctave = focusOctaves[rowIdx];

      // 布局模式：行左侧设置面板（乐器+配色+动态/静态）
      if (isLayoutMode) {
        const rowCtrl = document.createElement("div");
        rowCtrl.className = "row-ctrl-bar";
        rowCtrl.style.cssText = "flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-start;gap:4px;padding:4px 6px;background:#1a1a1a;border-right:1px solid #333;z-index:15;width:78px;box-sizing:border-box;";
        
        // 重置按钮（长方形，单独一行）
        const resetBtn2 = document.createElement("button");
        resetBtn2.innerHTML = "重置 <b>↺</b>"; resetBtn2.style.cssText = "width:100%;padding:4px 2px;border-radius:4px;border:1px solid #333;background:#222;color:#888;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:2px;";
        resetBtn2.onclick = () => { delete rowInstMap[rowIdx]; delete rowColorMap[rowIdx]; delete rowDynamicMap[rowIdx]; delete rowOctaveOffsetMap[rowIdx]; saveRowConfig(); renderPiano(); };
        rowCtrl.appendChild(resetBtn2);
        
        // 动态/静态切换按钮
        const modeRow = document.createElement("div");
        modeRow.style.cssText = "display:flex;gap:2px;width:100%;";
        const isDynamic = rowDynamicMap[rowIdx] !== false; // 默认动态
        const dynBtn = document.createElement("button");
        dynBtn.textContent = "动态";
        dynBtn.style.cssText = "flex:1;padding:5px 2px;border-radius:4px;border:1px solid #444;font-size:11px;cursor:pointer;" + (isDynamic ? "background:#0099ff;color:#fff;" : "background:#222;color:#888;");
        dynBtn.onclick = () => { rowDynamicMap[rowIdx] = true; saveRowConfig(); renderPiano(); };
        const staticBtn = document.createElement("button");
        staticBtn.textContent = "静态";
        staticBtn.style.cssText = "flex:1;padding:5px 2px;border-radius:4px;border:1px solid #444;font-size:11px;cursor:pointer;" + (!isDynamic ? "background:#0099ff;color:#fff;" : "background:#222;color:#888;");
        staticBtn.onclick = () => { rowDynamicMap[rowIdx] = false; saveRowConfig(); renderPiano(); };
        modeRow.appendChild(dynBtn); modeRow.appendChild(staticBtn);
        rowCtrl.appendChild(modeRow);
        
        // 乐器选择（单独一行）
        const instRow = document.createElement("div");
        instRow.style.cssText = "display:flex;align-items:center;width:100%;";
        const instSel2 = document.createElement("select");
        instSel2.style.cssText = "flex:1;padding:2px 4px;border-radius:4px;border:1px solid #444;background:#111;color:#eee;font-size:10px;min-width:0;";
        const defOpt2 = document.createElement("option");
        defOpt2.value = ""; defOpt2.textContent = "全局";
        instSel2.appendChild(defOpt2);
        INST_LIST.forEach(inst => {
          const opt = document.createElement("option");
          opt.value = inst.v; opt.textContent = inst.t;
          if ((rowInstMap[rowIdx] || "") === inst.v) opt.selected = true;
          instSel2.appendChild(opt);
        });
        instSel2.onchange = () => { rowInstMap[rowIdx] = instSel2.value || null; saveRowConfig(); };
        instRow.appendChild(instSel2);
        rowCtrl.appendChild(instRow);
        
        // 颜色行（两个颜色选择器）
        const colorRow = document.createElement("div");
        colorRow.style.cssText = "display:flex;align-items:center;gap:3px;width:100%;";
        const wColor2 = document.createElement("input"); wColor2.type = "color";
        wColor2.value = (rowColorMap[rowIdx] && rowColorMap[rowIdx].white) || "#f5f5f5";
        wColor2.style.cssText = "flex:1;height:24px;border:none;cursor:pointer;padding:0;background:transparent;";
        wColor2.oninput = () => { if(!rowColorMap[rowIdx]) rowColorMap[rowIdx]={}; rowColorMap[rowIdx].white=wColor2.value; applyRowColors(rowEl, rowIdx); saveRowConfig(); };
        const bColor2 = document.createElement("input"); bColor2.type = "color";
        bColor2.value = (rowColorMap[rowIdx] && rowColorMap[rowIdx].black) || "#222222";
        bColor2.style.cssText = "flex:1;height:24px;border:none;cursor:pointer;padding:0;background:transparent;";
        bColor2.oninput = () => { if(!rowColorMap[rowIdx]) rowColorMap[rowIdx]={}; rowColorMap[rowIdx].black=bColor2.value; applyRowColors(rowEl, rowIdx); saveRowConfig(); };
        colorRow.appendChild(wColor2); colorRow.appendChild(bColor2);
        rowCtrl.appendChild(colorRow);
        rowEl.appendChild(rowCtrl);
      }

      // 键盘包裹层（支持横向滚动）
      const keysWrap = document.createElement("div");
      keysWrap.className = "octave-row-keys";

      // 创建空隙容器（用于放置音域名称）
      const gapRow = document.createElement("div");
      gapRow.className = "octave-gap-row";
      // 布局模式下添加左侧控制面板宽度
      if (isLayoutMode) {
        gapRow.style.cssText = "display:flex;flex-direction:row;height:var(--row-gap);overflow-x:auto;margin-left:78px;scrollbar-width:none;";
      } else {
        gapRow.style.cssText = "display:flex;flex-direction:row;height:var(--row-gap);overflow-x:auto;scrollbar-width:none;";
      }

      // 始终渲染7个音域，从左到右：倍低音(1) -> 低音(2) -> 中低音(3) -> 中音(4) -> 中高音(5) -> 高音(6) -> 倍高音(7)
      // 宽度值通过CSS变量--octave-width控制每个音域的宽度
      const octaveOrder = [1, 2, 3, 4, 5, 6, 7]; // 从倍低音到倍高音
      const rowOctaveOffset = rowOctaveOffsetMap[rowIdx] || 0; // 该行的音域偏移量
      const isDynamic = rowDynamicMap[rowIdx] !== false; // 该行是否是动态的
      const octaveNames = {1:"倍低音",2:"低音",3:"中低音",4:"中音",5:"中高音",6:"高音",7:"倍高音"};
      octaveOrder.forEach(function(octaveNum) {
        const oct = octaveList[octaveNum - 1];
        const group = document.createElement("div");
        group.className = "octave-group";
        // 宽度由CSS变量--octave-width控制，不在这里设置
        
        const pianoRow = document.createElement("div");
        pianoRow.className = "piano-row";
        whiteKeys.forEach(n => {
          const k = document.createElement("div");
          k.className = "key white"; k.dataset.note = n + octaveNum;
          pianoRow.appendChild(k);
        });
        blackKeys.forEach(b => {
          const kb = document.createElement("div");
          kb.className = "key black"; kb.dataset.note = b.note + octaveNum;
          kb.style.left = ((b.after + 1) * 100 / 7) + "%";
          pianoRow.appendChild(kb);
        });
        group.appendChild(pianoRow);
        keysWrap.appendChild(group);
        
        // 在空隙容器中添加音域名称
        const gapGroup = document.createElement("div");
        gapGroup.className = "octave-gap-group";
        gapGroup.style.cssText = "flex-shrink:0;width:var(--octave-width);display:flex;align-items:center;justify-content:center;";
        const nameEl = document.createElement("div");
        nameEl.className = "octave-name";
        // 动态琴键行：根据偏移量计算实际音域名字
        if (isDynamic) {
          const actualOctave = octaveNum + rowOctaveOffset;
          // 音域名字显示实际发音的音域（可以是任意整数，不限制在1-7范围）
          let displayName;
          if (actualOctave <= 1) {
            displayName = "倍低音";
          } else if (actualOctave >= 7) {
            displayName = "倍高音";
          } else {
            displayName = octaveNames[actualOctave] || oct.name;
          }
          nameEl.textContent = displayName;
        } else {
          nameEl.textContent = oct.name;
        }
        gapGroup.appendChild(nameEl);
        gapRow.appendChild(gapGroup);
      });
      rowEl.appendChild(keysWrap);
      container.appendChild(rowEl);
      // 在每排琴键后添加空隙容器
      container.appendChild(gapRow);
      // 双向同步空隙容器和琴键行的滚动
      let isSyncingScroll = false;
      keysWrap.addEventListener('scroll', function() {
        if (isSyncingScroll) return;
        isSyncingScroll = true;
        gapRow.scrollLeft = keysWrap.scrollLeft;
        isSyncingScroll = false;
      });
      gapRow.addEventListener('scroll', function() {
        if (isSyncingScroll) return;
        isSyncingScroll = true;
        keysWrap.scrollLeft = gapRow.scrollLeft;
        isSyncingScroll = false;
      });
      // 应用行配色
      applyRowColors(rowEl, rowIdx);
    }
    // 设置所有行的默认滚动位置（在 for 循环外部统一处理）
    // 音域顺序（从左到右）：倍低音(索引0)、低音(索引1)、中低音(索引2)、中音(索引3)、中高音(索引4)、高音(索引5)、倍高音(索引6)
    const isLandscape = document.body.classList.contains('landscape-mode');
    setTimeout(function() {
      container.querySelectorAll('.octave-row').forEach((row, rowIdx) => {
        const keysWrap = row.querySelector('.octave-row-keys');
        const gapRow = container.querySelectorAll('.octave-gap-row')[rowIdx];
        if (!keysWrap || !gapRow) return;
        
        let targetOctaveIndex;
        if (isLandscape) {
          // 横屏模式：第1排中高音(索引4)、第2排中音(索引3)、第3排中低音(索引2)
          targetOctaveIndex = 4 - rowIdx;
        } else {
          // 竖屏模式：第1排倍高音(索引6)、第2排高音(索引5)...第7排倍低音(索引0)
          targetOctaveIndex = 6 - rowIdx;
        }
        // 获取实际的滚动内容总宽度（7个音域的总宽度）
        const totalWidth = keysWrap.scrollWidth;
        // 每个音域的实际宽度
        const octaveWidth = totalWidth / 7;
        // 可视区域宽度
        const visibleWidth = keysWrap.clientWidth;
        // 计算滚动位置，让目标音域居中显示在屏幕中间
        const scrollLeft = targetOctaveIndex * octaveWidth - (visibleWidth / 2) + (octaveWidth / 2);
        keysWrap.scrollLeft = Math.max(0, scrollLeft);
        gapRow.scrollLeft = Math.max(0, scrollLeft);
        // 根据容器宽度和间隙高度设置音域名称样式
        const gap = parseInt(sliderGap.value) || 0;
        const gapScale = gap > 0 ? gap / 20 : 0;
        const baseFontSize = Math.min(12, octaveWidth / 8);
        const fontSize = Math.min(12, Math.max(0, baseFontSize * gapScale));
        const paddingTop = 8;
        const nameEls = gapRow.querySelectorAll('.octave-name');
        nameEls.forEach(el => {
          el.style.fontSize = fontSize + 'px';
          el.style.paddingTop = paddingTop + 'px';
        });
      });
    }, 300);
    if (isLayoutMode) enableOctaveDragging();
  }

  function syncCanvasHeight() {
    const h = scoreWrap ? scoreWrap.offsetHeight : 34;
    canvas.height = h;
  }
  
  syncCanvasHeight();
  setTimeout(syncCanvasHeight, 100);

  document.querySelectorAll(".control .btn").forEach(btn => {
    btn.onclick = function(){
      document.querySelectorAll(".control .btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active"); 
      currentInst = this.dataset.inst;
      
      // 同步到音色调整窗口
      currentToneInst = currentInst;
      if (typeof renderToneTabs === 'function') renderToneTabs();
      if (typeof renderToneControls === 'function') renderToneControls();
      
      saveSettings();
    };
  });

  // Position a modal overlay's inner .modal near a button element.
  // Works correctly even when body has CSS transform:rotate().
  // Uses element.getBoundingClientRect() which returns VISUAL viewport coords.
  function _positionModalNearBtn(overlay, btn) {
    const modal = overlay.querySelector('.modal');
    if (!modal || !btn) return;
    // getBoundingClientRect gives visual-viewport coords (post-CSS-transform)
    // These match position:fixed coordinates directly.
    const r   = btn.getBoundingClientRect();
    const vw  = document.documentElement.clientWidth  || window.innerWidth;
    const vh  = document.documentElement.clientHeight || window.innerHeight;
    const gap = 8;
    const mw  = modal.offsetWidth  || 200;
    const mh  = modal.offsetHeight || 300;

    let left, top;
    const modalGap = 20;

    const isLandscape = document.body.classList.contains('landscape-mode');

    if (isLandscape) {
      // In landscape mode (body rotated 90deg), place modal at fixed position
      // Button is on the left side of screen, place modal to the right
      left = 72 + modalGap; // 52px (control width) + 20px gap
      top = gap;
      // Ensure modal stays within viewport
      left = Math.min(left, vw - mw - gap);
    } else {
      if (r.right > vw / 2) {
        left = Math.max(gap, r.right - mw);
      } else {
        left = Math.max(gap, r.left);
      }

      if (r.top > vh / 2) {
        top = Math.max(gap, r.top - mh - modalGap);
      } else {
        top = r.bottom + modalGap;
      }
    }

    left = Math.max(gap, Math.min(left, vw - mw - gap));
    top  = Math.max(gap, Math.min(top,  vh - mh - gap));

    modal.style.cssText = (modal.style.cssText || '') +
      ';position:fixed;left:' + left + 'px;top:' + top +
      'px;margin:0;transform:none;max-width:' + (vw - gap*2) +
      'px;max-height:' + (vh - gap*2) + 'px;overflow-y:auto;';
  }

  function renderSongList(){
    songListEl.innerHTML = "";
    const noneItem = document.createElement("div");
    noneItem.className = "song-item";
    noneItem.style.minHeight = "auto";
    noneItem.style.padding = "10px 16px";
    noneItem.innerHTML = `<div class="song-info" style="padding:0;"><div class="song-name">无</div></div>`;
    noneItem.onclick = () => {
      if (typeof stopRecordPlay === 'function' && typeof _recPlayState !== 'undefined' && _recPlayState) stopRecordPlay();
      if (typeof _stopRingLoop === 'function') _stopRingLoop();
      stopAutoPlay(); currentSong = null; tokens = [];
      _scoreBarType = null;
      canvas.width = 0; drawScore(); closeModal();
    };
    songListEl.appendChild(noneItem);
    allSongs().forEach((song, globalIdx) => {
      const isCur = currentSong && currentSong.key === song.key;
      const item = document.createElement("div");
      item.className = "song-item" + (isCur ? " selected" : "");
      item.innerHTML = `<div class="song-info"><div class="song-name">${song.name}</div><div class="song-meta"><span>${song.keySig}</span><span>${song.timeSig}</span></div></div><div class="item-actions"><button class="edit-opt">编辑</button><button class="del-opt">删除</button></div>`;
      item.onclick = (e) => {
        if (e.target.closest(".item-actions")) return;
        loadSongWithDelay(song); closeModal(); startScrollingSync();
      };
      item.querySelector(".edit-opt").onclick = (e) => { e.stopPropagation(); closeModal(); openEditDialog(song, globalIdx); };
      item.querySelector(".del-opt").onclick = (e) => {
        e.stopPropagation();
        if (globalIdx < BUILT_IN.length) showAppAlert("内置歌曲无法删除");
        else {
          customSongs.splice(globalIdx - BUILT_IN.length, 1); saveCustom(); renderSongList();
        }
      };
      songListEl.appendChild(item);
    });
  }

  function loadSong(song) {
    if (typeof stopRecordPlay === 'function' && typeof _recPlayState !== 'undefined' && _recPlayState) stopRecordPlay();
    if (typeof _stopRingLoop === 'function') _stopRingLoop();
    stopAutoPlay();
    // 始终清空画布内容；同类（jianpu→jianpu）保持高度，否则重置为 34
    const keepH = (_scoreBarType === 'jianpu');
    const h = keepH ? (scoreWrap ? scoreWrap.offsetHeight || 34 : 34) : 34;
    if (!keepH && scoreWrap) scoreWrap.style.setProperty("--score-height", h + "px");
    _scoreBarType = 'jianpu';
    currentSong = song;
    currentTupu = null;
    const built = buildTokensAndNotes(song);
    tokens = built.tokens; currentSong.autoNotes = built.autoNotes;
    canvas.height = h;
    canvas.style.height = h + "px";
    currentPlayTime = 0; canvasOffX = 20; canvas.style.left = "20px";
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRainbowGridBackground();
    isFollowing = true; currentFollowIdx = 0;
    highlightNoteIdx = (currentSong.autoNotes && currentSong.autoNotes.length > 0) ? 0 : -1;
    animNoteIdx = -1; drawScore();
  }

  function loadSongWithDelay(song) {
    if (typeof stopRecordPlay === 'function' && typeof _recPlayState !== 'undefined' && _recPlayState) stopRecordPlay();
    if (typeof _stopRingLoop === 'function') _stopRingLoop();
    stopAutoPlay();
    const keepH = (_scoreBarType === 'jianpu');
    const h = keepH ? (scoreWrap ? scoreWrap.offsetHeight || 34 : 34) : 34;
    if (!keepH && scoreWrap) scoreWrap.style.setProperty("--score-height", h + "px");
    _scoreBarType = 'jianpu';
    currentSong = song;
    currentTupu = null;
    const built = buildTokensAndNotes(song, true);
    tokens = built.tokens; currentSong.autoNotes = built.autoNotes;
    canvas.height = h;
    canvas.style.height = h + "px";
    currentPlayTime = 0; canvasOffX = 20; canvas.style.left = "20px";
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRainbowGridBackground();
    isFollowing = true;
    currentFollowIdx = 0;
    while(currentFollowIdx < currentSong.autoNotes.length && currentSong.autoNotes[currentFollowIdx].n === "R") {
      currentFollowIdx++;
    }
    highlightNoteIdx = currentFollowIdx < currentSong.autoNotes.length ? currentFollowIdx : -1;
    animNoteIdx = -1; drawScore();
  }

  function openModal(e){ 
    if (e) _positionModalNearBtn(modalOverlay, e.target);
    modalOverlay.classList.add("show"); 
    renderSongList(); 
    renderTupuList(); 
  }
  function closeModal(){ modalOverlay.classList.remove("show"); }
  
  // Click outside modal to close
  modalOverlay.onclick = function(e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  };
  
  musicBtn.onclick = function(e) {
    if (isLayoutMode) {
      // 布局模式下，将歌曲设置为无
      autoBtn.classList.remove("active");
      isAutoPlaying = false;
      isFollowing = false;
      cancelAnimationFrame(animRAF);
      animRAF = null;
      stopAutoPlay();
      clearAutoPlayInterval();
      highlightNoteIdx = -1;
      drawScore();
      showAppAlert("布局模式下不能选择歌曲");
      return;
    }
    openModal(e);
  };
  modalCancel.onclick = closeModal;

  document.querySelectorAll('.song-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.song-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.song-tab-content').forEach(c => c.style.display = 'none');
      const tabName = tab.dataset.tab;
      document.getElementById(tabName + 'Content').style.display = 'flex';
      // Clear score overlay when switching away from record tab
      if (tabName !== 'record') {
        var overlayCanvas = document.getElementById('scoreOverlayCanvas');
        if (overlayCanvas) {
          var octx = overlayCanvas.getContext('2d');
          if (octx) octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      }
    });
  });

  // Tab drag and drop sorting
  var songTabsContainer = document.getElementById('songTabsContainer');
  var draggedTab = null;
  var draggedClone = null;
  var insertLine = null;
  var isDragging = false;
  var longPressTimer = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var dragStartY = 0;

  function createInsertLine() {
    var line = document.createElement('div');
    line.style.cssText = 'position:absolute;top:0;bottom:0;width:2px;background:#0099ff;pointer-events:none;z-index:100;transition:left 0.1s ease;';
    return line;
  }

  function startDrag(tab, clientX, clientY) {
    isDragging = true;
    draggedTab = tab;
    
    var rect = tab.getBoundingClientRect();
    dragStartX = clientX;
    dragStartY = clientY;
    
    // Create clone for dragging
    draggedClone = tab.cloneNode(true);
    draggedClone.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;opacity:0.9;z-index:1000;pointer-events:none;transform:scale(1.05);box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(draggedClone);
    
    // Hide original
    tab.style.opacity = '0';
    
    // Create insert line
    insertLine = createInsertLine();
    songTabsContainer.style.position = 'relative';
    songTabsContainer.appendChild(insertLine);
    updateInsertLine(clientX);
  }

  function updateDrag(clientX, clientY) {
    if (!draggedClone) return;
    
    // Move clone with cursor
    var rect = draggedTab.getBoundingClientRect();
    var offsetX = clientX - dragStartX;
    var offsetY = clientY - dragStartY;
    draggedClone.style.left = (parseFloat(draggedClone.style.left) + (clientX - (parseFloat(draggedClone.style.left) + rect.width/2)) * 0.5) + 'px';
    draggedClone.style.top = (rect.top + offsetY) + 'px';
    
    // Update insert line
    updateInsertLine(clientX);
  }

  function updateInsertLine(clientX) {
    if (!insertLine) return;
    
    var tabs = Array.from(songTabsContainer.querySelectorAll('.song-tab')).filter(function(t) { return t !== draggedTab; });
    var containerRect = songTabsContainer.getBoundingClientRect();
    var relativeX = clientX - containerRect.left;
    
    var insertIdx = 0;
    for (var i = 0; i < tabs.length; i++) {
      var tabRect = tabs[i].getBoundingClientRect();
      var tabCenterX = tabRect.left + tabRect.width / 2 - containerRect.left;
      if (relativeX > tabCenterX) {
        insertIdx = i + 1;
      }
    }
    
    // Position insert line
    if (insertIdx === 0) {
      insertLine.style.left = '0px';
    } else if (insertIdx >= tabs.length) {
      var lastTab = tabs[tabs.length - 1];
      var lastRect = lastTab.getBoundingClientRect();
      insertLine.style.left = (lastRect.right - containerRect.left) + 'px';
    } else {
      var nextTab = tabs[insertIdx];
      var nextRect = nextTab.getBoundingClientRect();
      insertLine.style.left = (nextRect.left - containerRect.left) + 'px';
    }
  }

  function endDrag() {
    if (draggedClone) {
      document.body.removeChild(draggedClone);
      draggedClone = null;
    }
    if (insertLine) {
      songTabsContainer.removeChild(insertLine);
      insertLine = null;
    }
    if (draggedTab) {
      draggedTab.style.opacity = '';
    }
    
    isDragging = false;
    draggedTab = null;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function doMoveTab(clientX) {
    if (!isDragging || !draggedTab) return;
    
    var tabs = Array.from(songTabsContainer.querySelectorAll('.song-tab'));
    var draggedIdx = tabs.indexOf(draggedTab);
    var containerRect = songTabsContainer.getBoundingClientRect();
    var relativeX = clientX - containerRect.left;
    
    var insertIdx = 0;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i] === draggedTab) continue;
      var tabRect = tabs[i].getBoundingClientRect();
      var tabCenterX = tabRect.left + tabRect.width / 2 - containerRect.left;
      if (relativeX > tabCenterX) {
        insertIdx = i + 1;
      }
    }
    
    // Adjust for the dragged tab being removed
    if (insertIdx > draggedIdx) insertIdx--;
    
    var currentTabs = Array.from(songTabsContainer.querySelectorAll('.song-tab'));
    var currentIdx = currentTabs.indexOf(draggedTab);
    
    if (insertIdx !== currentIdx) {
      if (insertIdx >= currentTabs.length) {
        songTabsContainer.appendChild(draggedTab);
      } else {
        songTabsContainer.insertBefore(draggedTab, currentTabs[insertIdx]);
      }
    }
  }

  songTabsContainer.querySelectorAll('.song-tab').forEach(function(tab) {
    // Mouse events
    tab.addEventListener('mousedown', function(e) {
      touchStartX = e.clientX;
      touchStartY = e.clientY;
      dragStartX = e.clientX;
      longPressTimer = setTimeout(function() {
        startDrag(tab, touchStartX, touchStartY);
      }, 250);
    });

    document.addEventListener('mousemove', function(e) {
      if (longPressTimer) {
        var dx = Math.abs(e.clientX - touchStartX);
        var dy = Math.abs(e.clientY - touchStartY);
        if (dx > 5 || dy > 5) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
      if (isDragging) {
        e.preventDefault();
        updateDrag(e.clientX, e.clientY);
        doMoveTab(e.clientX);
      }
    });

    document.addEventListener('mouseup', function(e) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (isDragging) {
        endDrag();
      }
    });

    // Touch events
    tab.addEventListener('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      dragStartX = e.touches[0].clientX;
      longPressTimer = setTimeout(function() {
        startDrag(tab, touchStartX, touchStartY);
      }, 250);
    });

    document.addEventListener('touchmove', function(e) {
      if (longPressTimer) {
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        var dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 5 || dy > 5) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
      if (isDragging) {
        e.preventDefault();
        updateDrag(e.touches[0].clientX, e.touches[0].clientY);
        doMoveTab(e.touches[0].clientX);
      }
    }, { passive: false });

    document.addEventListener('touchend', function() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (isDragging) {
        endDrag();
      }
    });
  });

  const tupuSpeed = document.getElementById('tupuSpeed');
  const tupuImageInput = document.getElementById('tupuImageInput');
  const tupuPreview = document.getElementById('tupuPreview');
  const tupuAddRow = document.getElementById('tupuAddRow');
  const tupuDelRow = document.getElementById('tupuDelRow');
  const tupuList = document.getElementById('tupuList');
  const addTupuBtn = document.getElementById('addTupuBtn');
  const tupuEditOverlay = document.getElementById('tupuEditOverlay');
  const tupuEditCancel = document.getElementById('tupuEditCancel');
  const tupuEditOk = document.getElementById('tupuEditOk');
  const tupuName = document.getElementById('tupuName');
  const tupuPrevBtn = document.getElementById('tupuPrevBtn');
  const tupuNextBtn = document.getElementById('tupuNextBtn');
  const tupuDeleteBtn = document.getElementById('tupuDeleteBtn');
  const tupuAddBtn = document.getElementById('tupuAddBtn');
  const tupuNavInfo = document.getElementById('tupuNavInfo');

  let tupuImageData = null;
  let tupuMasks = [];
  let selectedMaskIdx = -1;
  let tupuPlaying = false;
  let tupuPlayIdx = 0;
  let tupuPlayTimer = null;
  let editingTupuIdx = -1;
  let editingPageIdx = 0;
  let editingPages = [];
  let originalTupuData = null; // 保存原始图谱数据，用于取消时恢复
  let currentImgLeft = 0;
  let currentImgWidth = 0;
  let currentImgTop = 0;
  let currentImgHeight = 0;
  let currentImgNaturalWidth = 0;
  let currentImgNaturalHeight = 0;

  function renderTupuList() {
    if (!tupuList) return;
    tupuList.innerHTML = "";
    const noneItem = document.createElement("div");
    noneItem.className = "song-item";
    noneItem.style.minHeight = "auto";
    noneItem.style.padding = "10px 16px";
    noneItem.innerHTML = `<div class="song-info" style="padding:0;"><div class="song-name">无</div></div>`;
    noneItem.onclick = () => {
      stopAutoPlay();
      stopTupuScrolling();
      currentSong = null;
      currentTupu = null;
      tokens = [];
      canvas.width = 0;
      canvas.style.width = "0px";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      closeModal();
    };
    tupuList.appendChild(noneItem);
    allTupus().forEach((tupu, idx) => {
      const item = document.createElement("div");
      item.className = "song-item tupu-item";
      item.innerHTML = `<div class="song-info"><div class="song-name">${tupu.name}</div></div><div class="item-actions"><button class="edit-opt">编辑</button><button class="del-opt">删除</button></div>`;
      item.onclick = (e) => {
        if (e.target.closest(".item-actions")) return;
        loadTupuWithDelay(tupu);
        closeModal();
        startTupuScrolling();
      };
      item.querySelector(".edit-opt").onclick = (e) => { e.stopPropagation(); closeModal(); openTupuEditDialog(tupu, idx); };
      item.querySelector(".del-opt").onclick = (e) => {
        e.stopPropagation();
        customTupus.splice(idx, 1);
        saveTupus();
        renderTupuList();
      };
      tupuList.appendChild(item);
    });
  }

  let tupuScrollX = 0;
  let tupuScrollRAF = null;
  let tupuLastFrameTime = 0;
  let isTupuScrolling = false;
  let currentTupuSpeed = 1.0;
  
  function loadTupu(tupu) {
    const pages = tupu.pages || (tupu.image ? [{ image: tupu.image, masks: tupu.masks }] : []);
    if (pages.length === 0) return;
    if (typeof stopRecordPlay === 'function' && typeof _recPlayState !== 'undefined' && _recPlayState) stopRecordPlay();
    if (typeof _stopRingLoop === 'function') _stopRingLoop();
    stopAutoPlay();
    stopTupuScrolling();
    currentSong = null;
    tokens = [];
    currentTupu = tupu;
    tupuScrollX = 0;
    canvasOffX = 20;
    canvas.style.left = "20px";
    
    // 同类图谱切换保持高度，不同类型切换重置
    const keepTupu = (_scoreBarType === 'tupu');
    const defaultHeight = keepTupu ? (scoreWrap ? scoreWrap.offsetHeight || 34*2.5 : 34*2.5) : 34*2.5;
    if (!keepTupu && scoreWrap) scoreWrap.style.setProperty("--score-height", defaultHeight + "px");
    _scoreBarType = 'tupu';
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRainbowGridBackground();
    canvas.height = defaultHeight;
    canvas.style.height = defaultHeight + "px";
    const canvasHeight = canvas.height;
    
    currentTupu.pageImgs = [];
    currentTupu.scaledMasks = [];
    let totalWidth = 0;
    let totalOriginalWidth = 0;
    let loadedCount = 0;
    
    pages.forEach((page, pageIdx) => {
      const img = new Image();
      img.onload = function() {
        currentTupu.pageImgs[pageIdx] = img;
        
        const pageMasks = [];
        (page.masks || []).forEach(mask => {
          const srcX = mask.left || 0;
          const srcY = mask.top || 0;
          const srcWidth = mask.width || img.width;
          const srcHeight = mask.height || 0;
          
          if (srcHeight <= 0) return;
          
          const maskScaleRatio = canvasHeight / srcHeight;
          const scaledMaskWidth = srcWidth * maskScaleRatio;
          
          pageMasks.push({
            pageIdx: pageIdx,
            srcX: srcX,
            srcY: srcY,
            srcWidth: srcWidth,
            srcHeight: srcHeight,
            x: 0,
            width: scaledMaskWidth,
            height: canvasHeight
          });
        });
        
        currentTupu.scaledMasks[pageIdx] = pageMasks;
        loadedCount++;
        
        if (loadedCount === pages.length) {
          let currentX = 0;
          let currentOriginalX = 0;
          currentTupu.scaledMasks.forEach(pageMasks => {
            pageMasks.forEach(mask => {
              mask.x = currentX;
              currentX += mask.width;
              currentOriginalX += mask.srcWidth;
            });
          });
          
          currentTupu.totalWidth = currentX;
          currentTupu.originalTotalWidth = currentOriginalX;
          currentTupu.baseHeight = canvasHeight;
          
          canvas.width = currentX;
          canvas.style.width = currentX + "px";
          canvasOffX = 20;
          canvas.style.left = "20px";
          tupuScrollX = 0;
          
          drawTupuScore();
        }
      };
      img.src = page.image;
    });
  }
  
  function loadTupuWithDelay(tupu) {
    const pages = tupu.pages || (tupu.image ? [{ image: tupu.image, masks: tupu.masks }] : []);
    if (pages.length === 0) return;
    
    if (typeof stopRecordPlay === 'function' && typeof _recPlayState !== 'undefined' && _recPlayState) stopRecordPlay();
    if (typeof _stopRingLoop === 'function') _stopRingLoop();
    stopAutoPlay();
    stopTupuScrolling();
    currentSong = null;
    tokens = [];
    currentTupu = tupu;
    tupuScrollX = 0;
    canvasOffX = 20;
    canvas.style.left = "20px";
    
    // 同类图谱切换保持高度，不同类型切换重置
    const keepTupu = (_scoreBarType === 'tupu');
    const defaultHeight = keepTupu ? (scoreWrap ? scoreWrap.offsetHeight || 34*2.5 : 34*2.5) : 34*2.5;
    if (!keepTupu && scoreWrap) scoreWrap.style.setProperty("--score-height", defaultHeight + "px");
    _scoreBarType = 'tupu';
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRainbowGridBackground();
    canvas.height = defaultHeight;
    canvas.style.height = defaultHeight + "px";
    const canvasHeight = canvas.height;
    
    currentTupu.pageImgs = [];
    currentTupu.scaledMasks = [];
    let totalWidth = 0;
    let totalOriginalWidth = 0;
    let loadedCount = 0;
    
    pages.forEach((page, pageIdx) => {
      const img = new Image();
      img.onload = function() {
        currentTupu.pageImgs[pageIdx] = img;
        
        const pageMasks = [];
        (page.masks || []).forEach(mask => {
          const srcX = mask.left || 0;
          const srcY = mask.top || 0;
          const srcWidth = mask.width || img.width;
          const srcHeight = mask.height || 0;
          
          if (srcHeight <= 0) return;
          
          const maskScaleRatio = canvasHeight / srcHeight;
          const scaledMaskWidth = srcWidth * maskScaleRatio;
          
          pageMasks.push({
            pageIdx: pageIdx,
            srcX: srcX,
            srcY: srcY,
            srcWidth: srcWidth,
            srcHeight: srcHeight,
            x: 0,
            width: scaledMaskWidth,
            height: canvasHeight
          });
        });
        
        currentTupu.scaledMasks[pageIdx] = pageMasks;
        loadedCount++;
        
        if (loadedCount === pages.length) {
          let currentX = 0;
          let currentOriginalX = 0;
          currentTupu.scaledMasks.forEach(pageMasks => {
            pageMasks.forEach(mask => {
              mask.x = currentX;
              currentX += mask.width;
              currentOriginalX += mask.srcWidth;
            });
          });
          
          currentTupu.totalWidth = currentX;
          currentTupu.originalTotalWidth = currentOriginalX;
          currentTupu.baseHeight = canvasHeight;
          
          canvas.width = currentX;
          canvas.style.width = currentX + "px";
          canvasOffX = 20;
          canvas.style.left = "20px";
          tupuScrollX = 0;
          
          drawTupuScore();
        }
      };
      img.src = page.image;
    });
  }

  function updateTupuNavInfo() {
    const totalPages = editingPages.length;
    if (totalPages > 0) {
      tupuNavInfo.textContent = `${editingPageIdx + 1} / ${totalPages}`;
      tupuPrevBtn.disabled = editingPageIdx <= 0;
      tupuNextBtn.disabled = editingPageIdx >= totalPages - 1;
      tupuDeleteBtn.style.display = 'inline-block';
    } else {
      tupuNavInfo.textContent = '新建';
      tupuPrevBtn.disabled = true;
      tupuNextBtn.disabled = true;
      tupuDeleteBtn.style.display = 'none';
    }
  }

  function openTupuEditDialog(tupu, idx) {
    editingTupuIdx = idx;
    // 保存原始图谱数据的深拷贝，用于取消时恢复
    if (tupu) {
      originalTupuData = JSON.parse(JSON.stringify({
        name: tupu.name || '',
        speed: tupu.speed || 80,
        pages: tupu.pages || [{ image: tupu.image || null, masks: tupu.masks || [] }]
      }));
      if (tupuName) tupuName.value = tupu.name || '';
      if (tupuSpeed) tupuSpeed.value = tupu.speed || 80;
      editingPages = tupu.pages || [{ image: tupu.image || null, masks: tupu.masks || [] }];
      editingPageIdx = 0;
    } else {
      originalTupuData = null;
      if (tupuName) tupuName.value = '';
      if (tupuSpeed) tupuSpeed.value = 80;
      editingPages = [];
      editingPageIdx = 0;
    }
    loadCurrentPage();
    updateTupuNavInfo();
    
    const modal = tupuEditOverlay ? tupuEditOverlay.querySelector('.tupu-edit-modal') : null;
    if (modal) {
      modal.classList.remove('tupu-portrait-mode');
      if (!document.body.classList.contains('landscape-mode')) {
        modal.classList.add('tupu-portrait-mode');
      }
    }
    
    if (tupuEditOverlay) tupuEditOverlay.classList.add("show");
  }

  function loadCurrentPage() {
    if (editingPages.length > 0 && editingPageIdx >= 0 && editingPageIdx < editingPages.length) {
      const page = editingPages[editingPageIdx];
      tupuImageData = page.image || null;
      tupuMasks = page.masks || [];
    } else {
      tupuImageData = null;
      tupuMasks = [];
    }
    selectedMaskIdx = -1;
    updateMaskPropsPanel();
    renderTupuPreview();
  }

  function saveCurrentPage() {
    if (editingPages.length > 0 && editingPageIdx >= 0 && editingPageIdx < editingPages.length) {
      editingPages[editingPageIdx] = {
        image: tupuImageData,
        masks: tupuMasks
      };
    }
  }

  function closeTupuEditDialog() {
    // 如果是编辑现有图谱且有原始数据，恢复原始数据
    if (editingTupuIdx >= 0 && originalTupuData) {
      customTupus[editingTupuIdx] = originalTupuData;
      saveTupus();
      renderTupuList();
    }
    if (tupuEditOverlay) tupuEditOverlay.classList.remove("show");
    editingTupuIdx = -1;
    originalTupuData = null;
  }

  if (tupuPrevBtn) {
    tupuPrevBtn.onclick = () => {
      if (editingPageIdx > 0) {
        saveCurrentPage();
        editingPageIdx--;
        loadCurrentPage();
        updateTupuNavInfo();
      }
    };
  }

  if (tupuNextBtn) {
    tupuNextBtn.onclick = () => {
      if (editingPageIdx < editingPages.length - 1) {
        saveCurrentPage();
        editingPageIdx++;
        loadCurrentPage();
        updateTupuNavInfo();
      }
    };
  }

  if (tupuDeleteBtn) {
    tupuDeleteBtn.onclick = () => {
      if (editingPages.length > 1) {
        editingPages.splice(editingPageIdx, 1);
        if (editingPageIdx >= editingPages.length) {
          editingPageIdx = editingPages.length - 1;
        }
        loadCurrentPage();
        updateTupuNavInfo();
      } else if (editingPages.length === 1) {
        editingPages = [];
        editingPageIdx = 0;
        tupuImageData = null;
        tupuMasks = [];
        renderTupuPreview();
        updateTupuNavInfo();
      }
    };
  }

  if (tupuAddBtn) {
    tupuAddBtn.onclick = () => {
      saveCurrentPage();
      editingPages.push({ image: null, masks: [] });
      editingPageIdx = editingPages.length - 1;
      tupuImageData = null;
      tupuMasks = [];
      renderTupuPreview();
      updateTupuNavInfo();
    };
  }

  if (addTupuBtn) {
    addTupuBtn.onclick = () => openTupuEditDialog(null, -1);
  }
  if (tupuEditCancel) {
    tupuEditCancel.onclick = closeTupuEditDialog;
  }
  if (tupuEditOk) {
    tupuEditOk.onclick = () => {
      saveCurrentPage();
      
      const name = tupuName ? tupuName.value.trim() : '未命名图谱';
      
      const validPages = editingPages.filter(p => p.image);
      if (validPages.length === 0) {
        showAppAlert('请至少上传一张图片');
        return;
      }
      
      const tupuData = {
        name: name,
        speed: parseFloat(tupuSpeed ? tupuSpeed.value : 80),
        pages: validPages.map(page => ({
          image: page.image,
          masks: page.masks || []
        }))
      };
      
      if (editingTupuIdx >= 0) {
        customTupus[editingTupuIdx] = tupuData;
      } else {
        customTupus.push(tupuData);
      }
      saveTupus();
      renderTupuList();
      // 保存成功后清除原始数据，避免关闭时恢复
      originalTupuData = null;
      closeTupuEditDialog();
    };
  }
  
  if (tupuImageInput) {
    tupuImageInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        tupuImageData = ev.target.result;
        if (editingPages.length === 0) { editingPages.push({ image: null, masks: [] }); editingPageIdx = 0; }
        editingPages[editingPageIdx] = { image: tupuImageData, masks: (tupuMasks || []).slice() };
        renderTupuPreview();
      };
      reader.readAsDataURL(file);
    };
  }

  if (tupuAddRow) {
    tupuAddRow.onclick = () => {
      if (!tupuImageData) {
        showAppAlert('请先上传图片');
        return;
      }
      
      const widthPct = parseFloat(globalWidth.value) / 100;
      const heightPct = parseFloat(globalHeight.value) / 100;
      const gapPct = parseFloat(globalGap.value) / 100;
      const newWidth = currentImgNaturalWidth * widthPct;
      const newHeight = currentImgNaturalHeight * heightPct;
      const newGap = currentImgNaturalHeight * gapPct;
      const newLeft = (currentImgNaturalWidth - newWidth) / 2;
      
      let newTop = 0;
      if (tupuMasks.length > 0) {
        const lastMask = tupuMasks[tupuMasks.length - 1];
        newTop = lastMask.top + lastMask.height + newGap;
      }
      
      tupuMasks.push({
        top: newTop,
        height: newHeight,
        left: newLeft,
        width: newWidth
      });
      renderTupuPreview();
    };
  }

  if (tupuDelRow) {
    tupuDelRow.onclick = () => {
      if (tupuMasks.length > 0) {
        if (selectedMaskIdx >= 0 && selectedMaskIdx < tupuMasks.length) {
          tupuMasks.splice(selectedMaskIdx, 1);
        } else {
          tupuMasks.pop();
        }
        selectedMaskIdx = -1;
        updateMaskPropsPanel();
        renderTupuPreview();
      }
    };
  }

  // Global sliders: width%, height px, gap px
  const globalWidth = document.getElementById('globalWidth');
  const globalWidthVal = document.getElementById('globalWidthVal');
  const globalHeight = document.getElementById('globalHeight');
  const globalHeightVal = document.getElementById('globalHeightVal');
  const globalGap = document.getElementById('globalGap');
  const globalGapVal = document.getElementById('globalGapVal');
  
  const maskPropsPanel = document.getElementById('maskPropsPanel');
  const maskLeftPct = document.getElementById('maskLeftPct');
  const maskRightPct = document.getElementById('maskRightPct');
  const maskTopPct = document.getElementById('maskTopPct');
  const maskBottomPct = document.getElementById('maskBottomPct');

  function updateMaskPropsPanel() {
    if (selectedMaskIdx >= 0 && selectedMaskIdx < tupuMasks.length && currentImgNaturalWidth > 0 && currentImgNaturalHeight > 0) {
      const mask = tupuMasks[selectedMaskIdx];
      const leftPct = (mask.left / currentImgNaturalWidth) * 100;
      const rightPct = ((mask.left + mask.width) / currentImgNaturalWidth) * 100;
      const topPct = (mask.top / currentImgNaturalHeight) * 100;
      const bottomPct = ((mask.top + mask.height) / currentImgNaturalHeight) * 100;
      
      maskLeftPct.value = leftPct.toFixed(2);
      maskRightPct.value = rightPct.toFixed(2);
      maskTopPct.value = topPct.toFixed(2);
      maskBottomPct.value = bottomPct.toFixed(2);
      
      maskPropsPanel.style.display = 'block';
    } else {
      maskPropsPanel.style.display = 'none';
    }
  }

  function applyMaskPropsFromPanel() {
    if (selectedMaskIdx < 0 || selectedMaskIdx >= tupuMasks.length) return;
    if (currentImgNaturalWidth <= 0 || currentImgNaturalHeight <= 0) return;
    
    const mask = tupuMasks[selectedMaskIdx];
    const leftPct = parseFloat(maskLeftPct.value) || 0;
    const rightPct = parseFloat(maskRightPct.value) || 100;
    const topPct = parseFloat(maskTopPct.value) || 0;
    const bottomPct = parseFloat(maskBottomPct.value) || 100;
    
    mask.left = (leftPct / 100) * currentImgNaturalWidth;
    mask.width = (rightPct / 100) * currentImgNaturalWidth - mask.left;
    mask.top = (topPct / 100) * currentImgNaturalHeight;
    mask.height = (bottomPct / 100) * currentImgNaturalHeight - mask.top;
    
    renderTupuPreview();
  }

  if (maskLeftPct) maskLeftPct.oninput = applyMaskPropsFromPanel;
  if (maskRightPct) maskRightPct.oninput = applyMaskPropsFromPanel;
  if (maskTopPct) maskTopPct.oninput = applyMaskPropsFromPanel;
  if (maskBottomPct) maskBottomPct.oninput = applyMaskPropsFromPanel;

  function applyGlobalSliders() {
    if (!tupuImageData || tupuMasks.length === 0) return;
    const imgEl = tupuPreview.querySelector('img');
    if (!imgEl) return;
    
    const imgWidth = imgEl.offsetWidth;
    const imgHeight = imgEl.offsetHeight;
    const imgLeft = (tupuPreview.offsetWidth - imgWidth) / 2;
    const imgTop = (tupuPreview.offsetHeight - imgHeight) / 2;
    
    const rx = currentImgNaturalWidth > 0 ? imgWidth / currentImgNaturalWidth : 1;
    const ry = currentImgNaturalHeight > 0 ? imgHeight / currentImgNaturalHeight : 1;
    
    const widthPct = parseFloat(globalWidth.value) / 100;
    const heightPct = parseFloat(globalHeight.value) / 100;
    const gapPct = parseFloat(globalGap.value) / 100;
    
    const newWidth = currentImgNaturalWidth * widthPct;
    const newHeight = currentImgNaturalHeight * heightPct;
    const newGap = currentImgNaturalHeight * gapPct;
    
    let curTop = 0;
    tupuMasks.forEach((mask, i) => {
      mask.top = curTop;
      mask.height = newHeight;
      mask.left = (currentImgNaturalWidth - newWidth) / 2;
      mask.width = newWidth;
      curTop += newHeight + newGap;
    });
    
    const maskEls = tupuPreview.querySelectorAll('.tupu-mask');
    maskEls.forEach((el, i) => {
      if (tupuMasks[i]) {
        const displayTop = tupuMasks[i].top * ry + imgTop;
        const displayHeight = tupuMasks[i].height * ry;
        const displayLeft = tupuMasks[i].left * rx + imgLeft;
        const displayWidth = tupuMasks[i].width * rx;
        el.style.top = displayTop + 'px';
        el.style.height = displayHeight + 'px';
        el.style.left = displayLeft + 'px';
        el.style.width = displayWidth + 'px';
      }
    });
    
    updateMaskOverlay();
    updateMaskPropsPanel();
  }

  if (globalWidth) {
    globalWidth.oninput = () => {
      globalWidthVal.textContent = globalWidth.value + '%';
      applyGlobalSliders();
    };
  }
  if (globalHeight) {
    globalHeight.oninput = () => {
      globalHeightVal.textContent = globalHeight.value + '%';
      applyGlobalSliders();
    };
  }
  if (globalGap) {
    globalGap.oninput = () => {
      globalGapVal.textContent = globalGap.value + '%';
      applyGlobalSliders();
    };
  }

  function renderTupuPreview() {
    if (!tupuPreview) return;
    tupuPreview.innerHTML = '';
    
    const isLandscape = document.body.classList.contains('landscape-mode');
    const modal = tupuEditOverlay ? tupuEditOverlay.querySelector('.tupu-edit-modal') : null;
    const isPortraitMode = modal && modal.classList.contains('tupu-portrait-mode');
    const isMobileMode = isLandscape || isPortraitMode;
    
    if (!tupuImageData) {
      const placeholder = document.createElement('div');
      placeholder.className = 'tupu-placeholder';
      placeholder.style.whiteSpace = 'nowrap';
      placeholder.textContent = '上传图片乐谱，逐行播放';
      tupuPreview.appendChild(placeholder);
      
      tupuPreview.onclick = () => tupuImageInput.click();
      selectedMaskIdx = -1;
      updateMaskPropsPanel();
      return;
    }

    const img = new Image();
    img.src = tupuImageData;
    img.onload = function() {
      tupuPreview.innerHTML = '';
      
      const imgWrapper = document.createElement('div');
      imgWrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      
      const imgEl = document.createElement('img');
      imgEl.src = tupuImageData;
      imgEl.className = 'tupu-preview-image';
      imgEl.style.cssText = 'max-width:100%;max-height:100%;display:block;object-fit:contain;';
      imgEl.draggable = false;
      imgWrapper.appendChild(imgEl);
      tupuPreview.appendChild(imgWrapper);
      
      let currentScale = 1;
      let currentTranslateX = 0;
      let currentTranslateY = 0;
      
      const updateImageTransform = () => {
        imgWrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentScale})`;
      };
      
      if (isMobileMode) {
        let lastTouchDistance = 0;
        let isPinching = false;
        
        tupuPreview.addEventListener('touchstart', (e) => {
          if (e.touches.length === 2) {
            isPinching = true;
            isPinchingMasks = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            e.preventDefault();
          }
        }, { passive: false });
        
        tupuPreview.addEventListener('touchmove', (e) => {
          if (isPinching && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (lastTouchDistance > 0) {
              const scaleDelta = distance / lastTouchDistance;
              currentScale = Math.max(0.5, Math.min(5, currentScale * scaleDelta));
              updateImageTransform();
            }
            lastTouchDistance = distance;
            e.preventDefault();
          }
        }, { passive: false });
        
        tupuPreview.addEventListener('touchend', (e) => {
          if (e.touches.length < 2) {
            isPinching = false;
            isPinchingMasks = false;
            lastTouchDistance = 0;
          }
        }, { passive: false });
      }
      
      tupuPreview.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        currentScale = Math.max(0.5, Math.min(5, currentScale * delta));
        updateImageTransform();
      }, { passive: false });
      
      imgEl.onload = function() {
        const imgWidth = imgEl.offsetWidth;
        const imgHeight = imgEl.offsetHeight;
        const imgLeft = (tupuPreview.offsetWidth - imgWidth) / 2;
        const imgTop = (tupuPreview.offsetHeight - imgHeight) / 2;
        
        currentImgLeft = imgLeft;
        currentImgWidth = imgWidth;
        currentImgTop = imgTop;
        currentImgHeight = imgHeight;
        currentImgNaturalWidth = img.naturalWidth;
        currentImgNaturalHeight = img.naturalHeight;
        
        const rx = img.naturalWidth > 0 ? imgWidth / img.naturalWidth : 1;
        const ry = img.naturalHeight > 0 ? imgHeight / img.naturalHeight : 1;
        
        const displayMasks = tupuMasks.map(mask => ({
          top: (mask.top || 0) * ry + imgTop,
          height: (mask.height || 60) * ry,
          left: (mask.left || 0) * rx + imgLeft,
          width: (mask.width || img.naturalWidth) * rx
        }));
        
        if (tupuMasks.length === 0) {
          const initialMaskHeight = Math.min(60, imgHeight / 3);
          const initialMaskWidth = imgWidth * 0.8;
          const initialMaskLeft = imgLeft + (imgWidth - initialMaskWidth) / 2;
          displayMasks.push(
            { top: imgTop, height: initialMaskHeight, left: initialMaskLeft, width: initialMaskWidth },
            { top: imgTop + initialMaskHeight + 10, height: initialMaskHeight, left: initialMaskLeft, width: initialMaskWidth },
            { top: imgTop + (initialMaskHeight + 10) * 2, height: initialMaskHeight, left: initialMaskLeft, width: initialMaskWidth }
          );
          tupuMasks = displayMasks.map(m => ({
            top: (m.top - imgTop) / ry,
            height: m.height / ry,
            left: (m.left - imgLeft) / rx,
            width: m.width / rx
          }));
        }
        
        const maskContainer = document.createElement('div');
        maskContainer.className = 'tupu-mask-container';
        maskContainer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
        
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = tupuPreview.offsetWidth;
        overlayCanvas.height = tupuPreview.offsetHeight;
        overlayCanvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
        maskContainer.appendChild(overlayCanvas);
        
        function redrawOverlay() {
          const ctx = overlayCanvas.getContext('2d');
          ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          ctx.fillStyle = 'rgba(0,0,0,0.72)';
          ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          ctx.globalCompositeOperation = 'destination-out';
          displayMasks.forEach(mask => {
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(mask.left || currentImgLeft, mask.top, mask.width || currentImgWidth, mask.height);
          });
          ctx.globalCompositeOperation = 'source-over';
        }
        
        maskContainer.redrawOverlay = redrawOverlay;
        redrawOverlay();
        
        displayMasks.forEach((mask, idx) => {
          const maskEl = document.createElement('div');
          maskEl.className = 'tupu-mask';
          maskEl.dataset.idx = idx;
          maskEl.style.cssText = `position:absolute;left:${mask.left !== undefined ? mask.left : imgLeft}px;top:${mask.top}px;width:${mask.width || imgWidth}px;height:${mask.height}px;background:transparent;border:2px dashed rgba(0,153,255,0.8);cursor:move;pointer-events:auto;z-index:10;box-sizing:border-box;`;
          
          const topEdge = document.createElement('div');
          topEdge.className = 'tupu-mask-edge top';
          topEdge.dataset.edge = 'top';
          topEdge.dataset.idx = idx;
          
          const bottomEdge = document.createElement('div');
          bottomEdge.className = 'tupu-mask-edge bottom';
          bottomEdge.dataset.edge = 'bottom';
          bottomEdge.dataset.idx = idx;
          
          const leftEdge = document.createElement('div');
          leftEdge.className = 'tupu-mask-edge left';
          leftEdge.dataset.edge = 'left';
          leftEdge.dataset.idx = idx;
          
          const rightEdge = document.createElement('div');
          rightEdge.className = 'tupu-mask-edge right';
          rightEdge.dataset.edge = 'right';
          rightEdge.dataset.idx = idx;
          
          maskEl.appendChild(topEdge);
          maskEl.appendChild(bottomEdge);
          maskEl.appendChild(leftEdge);
          maskEl.appendChild(rightEdge);
          maskContainer.appendChild(maskEl);
          
          mask.el = maskEl;
          
          maskEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectMask(idx);
          });
          
          maskEl.addEventListener('mousedown', startMaskDrag);
          maskEl.addEventListener('touchstart', startMaskDrag, { passive: false });
        });
        
        imgWrapper.appendChild(maskContainer);
        
        if (selectedMaskIdx >= 0 && selectedMaskIdx < tupuMasks.length) {
          highlightSelectedMask();
        }
      };
    };
  }

  function selectMask(idx) {
    selectedMaskIdx = idx;
    highlightSelectedMask();
    updateMaskPropsPanel();
  }

  function highlightSelectedMask() {
    const maskEls = tupuPreview.querySelectorAll('.tupu-mask');
    maskEls.forEach((el, i) => {
      if (i === selectedMaskIdx) {
        el.style.borderColor = 'rgba(255, 200, 0, 1)';
        el.style.borderWidth = '3px';
      } else {
        el.style.borderColor = 'rgba(0, 153, 255, 0.8)';
        el.style.borderWidth = '2px';
      }
    });
  }

  let maskDragData = null;
  let isPinchingMasks = false;

  function startMaskDrag(e) {
    if (e.touches && e.touches.length >= 2) {
      isPinchingMasks = true;
      return;
    }
    if (isPinchingMasks) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const target = e.target;
    const mask = target.closest('.tupu-mask');
    if (!mask) return;

    const idx = parseInt(mask.dataset.idx);
    const isTopEdge = target.classList.contains('tupu-mask-edge') && target.dataset.edge === 'top';
    const isBottomEdge = target.classList.contains('tupu-mask-edge') && target.dataset.edge === 'bottom';
    const isLeftEdge = target.classList.contains('tupu-mask-edge') && target.dataset.edge === 'left';
    const isRightEdge = target.classList.contains('tupu-mask-edge') && target.dataset.edge === 'right';

    let mode = 'move';
    if (isTopEdge) mode = 'top';
    else if (isBottomEdge) mode = 'bottom';
    else if (isLeftEdge) mode = 'left';
    else if (isRightEdge) mode = 'right';

    const el = mask;
    maskDragData = {
      idx: idx,
      startX: touch.clientX,
      startY: touch.clientY,
      startTop: parseFloat(el.style.top) || 0,
      startHeight: parseFloat(el.style.height) || 60,
      startLeft: parseFloat(el.style.left) || currentImgLeft,
      startWidth: parseFloat(el.style.width) || currentImgWidth,
      mode: mode,
      el: el
    };

    document.addEventListener('mousemove', doMaskDrag);
    document.addEventListener('mouseup', endMaskDrag);
    document.addEventListener('touchmove', doMaskDrag, { passive: false });
    document.addEventListener('touchend', endMaskDrag);
  }

  function doMaskDrag(e) {
    if (!maskDragData) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const deltaX = touch.clientX - maskDragData.startX;
    const deltaY = touch.clientY - maskDragData.startY;
    const previewHeight = tupuPreview.offsetHeight;
    const previewWidth = tupuPreview.offsetWidth;
    const el = maskDragData.el;

    if (maskDragData.mode === 'move') {
      let newTop = maskDragData.startTop + deltaY;
      let newLeft = maskDragData.startLeft + deltaX;
      newTop = Math.max(0, Math.min(previewHeight - parseFloat(el.style.height), newTop));
      newLeft = Math.max(0, Math.min(previewWidth - parseFloat(el.style.width), newLeft));
      el.style.top = newTop + 'px';
      el.style.left = newLeft + 'px';
    } else if (maskDragData.mode === 'top') {
      let newTop = maskDragData.startTop + deltaY;
      let newHeight = maskDragData.startHeight - deltaY;
      if (newTop >= 0 && newHeight >= 20) {
        el.style.top = newTop + 'px';
        el.style.height = newHeight + 'px';
      }
    } else if (maskDragData.mode === 'bottom') {
      let newHeight = maskDragData.startHeight + deltaY;
      newHeight = Math.max(20, Math.min(previewHeight - parseFloat(el.style.top), newHeight));
      el.style.height = newHeight + 'px';
    } else if (maskDragData.mode === 'left') {
      let newLeft = maskDragData.startLeft + deltaX;
      let newWidth = maskDragData.startWidth - deltaX;
      if (newLeft >= 0 && newWidth >= 20) {
        el.style.left = newLeft + 'px';
        el.style.width = newWidth + 'px';
      }
    } else if (maskDragData.mode === 'right') {
      let newWidth = maskDragData.startWidth + deltaX;
      newWidth = Math.max(20, Math.min(previewWidth - parseFloat(el.style.left), newWidth));
      el.style.width = newWidth + 'px';
    }
    
    updateMaskOverlay();
  }

  function updateMaskOverlay() {
    const maskContainer = tupuPreview.querySelector('.tupu-mask-container');
    if (maskContainer && maskContainer.redrawOverlay) {
      const maskEls = tupuPreview.querySelectorAll('.tupu-mask');
      const displayMasks = [];
      maskEls.forEach(el => {
        displayMasks.push({
          top: parseFloat(el.style.top) || 0,
          height: parseFloat(el.style.height) || 60,
          left: parseFloat(el.style.left) || currentImgLeft,
          width: parseFloat(el.style.width) || currentImgWidth
        });
      });
      
      const ctx = maskContainer.querySelector('canvas').getContext('2d');
      ctx.clearRect(0, 0, maskContainer.querySelector('canvas').width, maskContainer.querySelector('canvas').height);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, maskContainer.querySelector('canvas').width, maskContainer.querySelector('canvas').height);
      ctx.globalCompositeOperation = 'destination-out';
      displayMasks.forEach(mask => {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(mask.left, mask.top, mask.width, mask.height);
      });
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function endMaskDrag() {
    if (maskDragData) {
      const el = maskDragData.el;
      const idx = maskDragData.idx;
      
      const displayTop = parseFloat(el.style.top) || 0;
      const displayHeight = parseFloat(el.style.height) || 60;
      const displayLeft = parseFloat(el.style.left) || currentImgLeft;
      const displayWidth = parseFloat(el.style.width) || currentImgWidth;
      
      const rx = currentImgNaturalWidth > 0 ? currentImgWidth / currentImgNaturalWidth : 1;
      const ry = currentImgNaturalHeight > 0 ? currentImgHeight / currentImgNaturalHeight : 1;
      
      tupuMasks[idx] = {
        top: (displayTop - currentImgTop) / ry,
        height: displayHeight / ry,
        left: (displayLeft - currentImgLeft) / rx,
        width: displayWidth / rx
      };
      
      selectedMaskIdx = idx;
      updateMaskPropsPanel();
    }
    
    maskDragData = null;
    isPinchingMasks = false;
    document.removeEventListener('mousemove', doMaskDrag);
    document.removeEventListener('mouseup', endMaskDrag);
    document.removeEventListener('touchmove', doMaskDrag);
    document.removeEventListener('touchend', endMaskDrag);
  }

  function startTupuScrolling() {
    if (!currentTupu) return;
    
    isTupuScrolling = false;
    cancelAnimationFrame(tupuScrollRAF);
    
    tupuScrollX = 0;
    canvasOffX = 20;
    canvas.style.left = "20px";
    
    isTupuScrolling = true;
    tupuLastFrameTime = performance.now();
    
    currentTupuSpeed = (currentTupu.speed || 80) / 80;
    
    drawTupuScore();
    stepTupuScrolling();
  }

  function stepTupuScrolling() {
    if (!isTupuScrolling || !currentTupu) return;
    
    const now = performance.now();
    const deltaTime = now - tupuLastFrameTime;
    tupuLastFrameTime = now;
    
    if (!isDraggingScore) {
      const bpm = currentTupu.speed || 80;
      const pixelsPerBeat = 30;
      const beatsPerSecond = bpm / 60;
      const baseScrollSpeed = pixelsPerBeat * beatsPerSecond * currentTupuSpeed;
      
      const originalWidth = currentTupu.originalTotalWidth || currentTupu.totalWidth;
      const currentWidth = currentTupu.totalWidth;
      const scaleRatio = currentWidth / originalWidth;
      const scrollSpeed = baseScrollSpeed * scaleRatio;
      
      tupuScrollX += deltaTime * scrollSpeed / 1000;
      
      if (tupuScrollX >= currentTupu.totalWidth) {
        tupuScrollX = 0;
      }
      
      canvasOffX = 20 - tupuScrollX;
      canvas.style.left = canvasOffX + "px";
    }
    
    tupuScrollRAF = requestAnimationFrame(stepTupuScrolling);
  }

  function stopTupuScrolling() {
    isTupuScrolling = false;
    cancelAnimationFrame(tupuScrollRAF);
    tupuScrollRAF = null;
  }
  function openEditDialog(song, idx){
    editingIdx = idx;
    document.getElementById("editName").value = song ? song.name : "";
    document.getElementById("editKeySig").value = song ? song.keySig : "1=C";
    document.getElementById("editTimeSig").value = song ? song.timeSig : "4/4";
    document.getElementById("editScore").value = song ? (Array.isArray(song.display)?song.display.join("\n"):song.display) : "";
    editOverlay.classList.add("show");
  }

  addSongBtn.onclick = () => openEditDialog(null, -1);
  var addRecBtn = document.getElementById("addRecBtn");
  if (addRecBtn) addRecBtn.onclick = function() { if (window._openRecEdit) window._openRecEdit(-1, []); };
  editCancel.onclick = () => editOverlay.classList.remove("show");
  editOk.onclick = () => {
    const name = document.getElementById("editName").value || "未命名";
    const keySig = document.getElementById("editKeySig").value || "1=C";
    const timeSig = document.getElementById("editTimeSig").value || "4/4";
    const score = document.getElementById("editScore").value;
    const songData = { key: Date.now(), name, keySig, timeSig, display: score, custom: editingIdx >= BUILT_IN.length };
    if(editingIdx === -1) { customSongs.push(songData); }
    else {
      if(editingIdx < BUILT_IN.length) BUILT_IN[editingIdx] = songData;
      else customSongs[editingIdx - BUILT_IN.length] = songData;
    }
    saveCustom();
    if(currentSong && (editingIdx !== -1)) loadSong(songData);
    editOverlay.classList.remove("show"); renderSongList();
  };

  playBtn.onclick = () => {
    // 优先检查图谱播放状态
    if (currentTupu) {
      if (isTupuScrolling) {
        // 暂停图谱播放（保持位置）
        stopTupuScrolling();
        playBtn.classList.remove("on");
        togglePlayBtnIcon(false);
      } else {
        // 没在播放：检查是否已播完（tupuScrollX 到末尾）
        const atEnd = currentTupu.totalWidth && tupuScrollX >= currentTupu.totalWidth - 1;
        if (atEnd) {
          // 已播完，重播
          tupuScrollX = 0;
          canvasOffX = 20;
          canvas.style.left = "20px";
        }
        // 继续/开始播放（不重置 tupuScrollX，继续上次位置）
        isTupuScrolling = true;
        tupuLastFrameTime = performance.now();
        currentTupuSpeed = (currentTupu.speed || 80) / 80;
        stepTupuScrolling();
        playBtn.classList.add("on");
        togglePlayBtnIcon(true);
      }
      return;
    }
    
    // 然后检查录制播放状态
    if (typeof _recPlayState !== "undefined" && _recPlayState) {
      if (_recPlayState.paused) { resumeRecordPlay(); }
      else                      { pauseRecordPlay(); }
      return;
    }
    
    if(!currentSong) return;
    if(isScrolling) pauseAutoPlay();
    else startScrollingSync();
  };

  autoBtn.onclick = () => {
    isMuted = !isMuted;
    autoBtn.classList.toggle("on", isMuted);
    // 切换 SVG 图标显示
    const waves = autoBtn.querySelectorAll('.volume-wave');
    const muteX = autoBtn.querySelectorAll('.mute-x');
    waves.forEach(el => el.style.display = isMuted ? 'none' : 'block');
    muteX.forEach(el => el.style.display = isMuted ? 'block' : 'none');
    saveSettings();
    if(isMuted) {
      stopNote("auto");
      container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
    }
  };

  const startScoreDrag = (x) => {
    // Block drag when recording playback is active (prevents switching to jianpu)
    if (typeof _recPlayState !== "undefined" && _recPlayState) return;
    if(!currentSong && !currentTupu) return;
    isDraggingScore = true; dragStartX = x; dragStartOffX = canvasOffX;
    playSpeed = 0; isMutedTemporarily = true;
    cancelAnimationFrame(scrollRAF); isScrolling = false;
    wasTupuScrolling = isTupuScrolling;
    cancelAnimationFrame(tupuScrollRAF); isTupuScrolling = false;
    stopNote("auto");
    container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
    cancelAnimationFrame(animRAF);
  };
  const moveScoreDrag = (x) => {
    if(!isDraggingScore) return;
    if(!currentSong && !currentTupu) return;
    
    const dx = x - dragStartX;
    canvasOffX = dragStartOffX + dx;
    canvas.style.left = canvasOffX + "px";
    
    if (currentSong) {
      const { fontSize, gap } = getScoreMetrics();
      const cv = document.createElement("canvas");
      const c2 = cv.getContext("2d");
      c2.font = fontSize + "px 'PingFang SC',Arial,sans-serif";
      
      const fixedX = scoreWrap.clientWidth / 4 || 20;
      const targetTokenX = fixedX - canvasOffX;
      let closestAn = currentSong.autoNotes[0];
      let minDiff = Infinity, closestIdx = 0;
      currentSong.autoNotes.forEach((an, i) => {
        let scaledX = 0;
        for(let j = 0; j < an.tokenIdx; j++) {
          const tok = tokens[j];
          const scaledW = c2.measureText(tok.text).width;
          const nextTok = tokens[j+1];
          if(tok.text === "_" || (nextTok && nextTok.text === "_")) {
            scaledX += scaledW;
          } else {
            scaledX += scaledW + gap;
          }
        }
        let diff = Math.abs(scaledX - targetTokenX);
        if(diff < minDiff) { minDiff = diff; closestAn = an; closestIdx = i; }
      });
      highlightNoteIdx = closestIdx; currentFollowIdx = closestIdx;
      currentPlayTime = closestAn ? closestAn.startTime : 0;
      drawScore();
    }
  };
  const endScoreDrag = () => {
    if (!isDraggingScore) return;
    isDraggingScore = false; isMutedTemporarily = false;
    isScrolling = false; cancelAnimationFrame(scrollRAF);
    isTupuScrolling = false; cancelAnimationFrame(tupuScrollRAF);
    
    if (currentSong) {
      isFollowing = true; currentFollowIdx = highlightNoteIdx;
    }
    
    if (currentTupu && wasTupuScrolling) {
      tupuScrollX = 20 - canvasOffX;
      if (tupuScrollX < 0) tupuScrollX = 0;
      if (tupuScrollX >= currentTupu.totalWidth) tupuScrollX = 0;
      isTupuScrolling = true;
      tupuLastFrameTime = performance.now();
      stepTupuScrolling();
    }
    
    stopNote("auto");
    container.querySelectorAll(".auto-hi").forEach(k => k.classList.remove("auto-hi"));
  };

  // 获取滚动栏拖动坐标
  const getScoreDragCoord = (e) => {
    return e.clientX;
  };
  const getScoreDragCoordTouch = (e) => {
    return e.touches[0].clientX;
  };

  scoreWrap.onmousedown = (e) => startScoreDrag(getScoreDragCoord(e));
  window.onmousemove = (e) => moveScoreDrag(getScoreDragCoord(e));
  window.onmouseup = endScoreDrag;
  scoreWrap.ontouchstart = (e) => startScoreDrag(getScoreDragCoordTouch(e));
  scoreWrap.ontouchmove = (e) => moveScoreDrag(getScoreDragCoordTouch(e));
  scoreWrap.ontouchend = endScoreDrag;

  function handleTouchStart(e){
    for(const t of e.changedTouches){
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if(el && el.classList.contains("key")){
        e.preventDefault();
        const ns = el.dataset.note;
        const isDynamic = isKeyRowDynamic(el);
        const row = el.closest('.octave-row');
        const rowIdx = row ? parseInt(row.dataset.rowIdx) : -1;
        const rowOctaveOffset = (isDynamic && rowIdx >= 0) ? (rowOctaveOffsetMap[rowIdx] || 0) : 0;
        const adjustedNs = isDynamic ? adjustNoteByOctave(ns, rowOctaveOffset) : ns;
        highlightSameRowNote(el, ns, true);
        const rowInstForTouch = getKeyRowInst(el);
        startNote(t.identifier, adjustedNs, rowInstForTouch);
        touchMap.set(t.identifier, {ns, rowEl: el, inst: rowInstForTouch});
      }
    }
  }
  function handleTouchMove(e){
    for(const t of e.touches){
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if(el && el.classList.contains("key")){
        const newNs = el.dataset.note;
        const touchEntryMove = touchMap.get(t.identifier);
        const oldNs = touchEntryMove ? (touchEntryMove.ns || touchEntryMove) : undefined;
        if(newNs !== oldNs){
          if(oldNs){
            stopNote(t.identifier);
            const oldRowEl = touchEntryMove && touchEntryMove.rowEl;
            if (oldRowEl) highlightSameRowNote(oldRowEl, oldNs, false);
            else container.querySelectorAll(`[data-note="${oldNs}"]`).forEach(k => k.classList.remove("active"));
          }
          const isDynamic = isKeyRowDynamic(el);
          const row = el.closest('.octave-row');
          const rowIdx = row ? parseInt(row.dataset.rowIdx) : -1;
          const rowOctaveOffset = (isDynamic && rowIdx >= 0) ? (rowOctaveOffsetMap[rowIdx] || 0) : 0;
          const adjustedNs = isDynamic ? adjustNoteByOctave(newNs, rowOctaveOffset) : newNs;
          highlightSameRowNote(el, newNs, true);
          const rowInstForMove = getKeyRowInst(el);
          startNote(t.identifier, adjustedNs, rowInstForMove);
          touchMap.set(t.identifier, {ns: newNs, rowEl: el, inst: rowInstForMove});
        }
      } else {
        const tmEntry2 = touchMap.get(t.identifier);
        const oldNs2 = tmEntry2 ? (tmEntry2.ns || tmEntry2) : undefined;
        if(oldNs2){
          stopNote(t.identifier);
          const oldRowEl2 = tmEntry2 && tmEntry2.rowEl;
          if (oldRowEl2) highlightSameRowNote(oldRowEl2, oldNs2, false);
          else container.querySelectorAll(`[data-note="${oldNs2}"]`).forEach(k => k.classList.remove("active"));
          touchMap.delete(t.identifier);
        }
      }
    }
  }
  function handleTouchEnd(e){
    for(const t of e.changedTouches){
      const touchEntry = touchMap.get(t.identifier);
      const teNs = touchEntry ? (touchEntry.ns || touchEntry) : undefined;
      if(teNs){
        stopNote(t.identifier);
        const teRowEl = touchEntry && touchEntry.rowEl;
        if (teRowEl) highlightSameRowNote(teRowEl, teNs, false);
        else container.querySelectorAll(`[data-note="${teNs}"]`).forEach(k => k.classList.remove("active"));
        touchMap.delete(t.identifier);
      }
    }
    if(e.touches.length === 0){
      container.querySelectorAll(".key.active").forEach(k => k.classList.remove("active"));
      activeNodes.forEach((v,k) => { if(typeof k === 'number' || k === "auto") stopNote(k); });
      touchMap.clear();
    }
  }

  document.addEventListener("touchstart", handleTouchStart, {passive:false});
  document.addEventListener("touchmove", handleTouchMove, {passive:false});
  document.addEventListener("touchend", handleTouchEnd);
  document.addEventListener("touchcancel", handleTouchEnd);
  
  let currentBaseOctave = 4;
  const pressedKeysMap = new Map();

  let mouseNote = null;
  let mouseRowEl = null;

  container.addEventListener("mousedown", (e) => {
    if (isLayoutMode) return;
    const el = e.target;
    if (!el || !el.classList.contains("key")) return;
    e.preventDefault();
    const ns = el.dataset.note;
    mouseNote = ns; mouseRowEl = el;
    const isDynamic = isKeyRowDynamic(el);
    const row = el.closest('.octave-row');
    const rowIdx = row ? parseInt(row.dataset.rowIdx) : -1;
    const rowOctaveOffset = (isDynamic && rowIdx >= 0) ? (rowOctaveOffsetMap[rowIdx] || 0) : 0;
    const adjustedNs = isDynamic ? adjustNoteByOctave(ns, rowOctaveOffset) : ns;
    highlightSameRowNote(el, ns, true);
    const rowInstForMouse = getKeyRowInst(el);
    startNote("mouse", adjustedNs, rowInstForMouse);
  });
  container.addEventListener("mousemove", (e) => {
    if (!mouseNote || isLayoutMode) return;
    const el = e.target;
    if (!el || !el.classList.contains("key")) return;
    const newNs = el.dataset.note;
    if (newNs === mouseNote) return;
    if (mouseRowEl) highlightSameRowNote(mouseRowEl, mouseNote, false);
    else container.querySelectorAll(`[data-note="${mouseNote}"]`).forEach(k => k.classList.remove("active"));
    stopNote("mouse"); mouseNote = newNs;
    const isDynamic = isKeyRowDynamic(el);
    const row = el.closest('.octave-row');
    const rowIdx = row ? parseInt(row.dataset.rowIdx) : -1;
    const rowOctaveOffset = (isDynamic && rowIdx >= 0) ? (rowOctaveOffsetMap[rowIdx] || 0) : 0;
    const adjustedNs = isDynamic ? adjustNoteByOctave(newNs, rowOctaveOffset) : newNs;
    highlightSameRowNote(el, newNs, true);
    const rowInstForMouseMove = getKeyRowInst(el);
    mouseRowEl = el;
    startNote("mouse", adjustedNs, rowInstForMouseMove);
  });
  const clearMouseNote = () => {
    if (!mouseNote) return;
    stopNote("mouse");
    if (mouseRowEl) highlightSameRowNote(mouseRowEl, mouseNote, false);
    else container.querySelectorAll(`[data-note="${mouseNote}"]`).forEach(k => k.classList.remove("active"));
    mouseNote = null; mouseRowEl = null;
  };
  container.addEventListener("mouseup", clearMouseNote);
  container.addEventListener("mouseleave", clearMouseNote);
  window.addEventListener("mouseup", clearMouseNote);

  function getOctaveHeight() {
    const firstOctave = container.querySelector('.octave-group');
    if (firstOctave) {
      return firstOctave.offsetHeight + (parseInt(window.getComputedStyle(firstOctave).marginBottom) || 0) + 10;
    }
    return 160;
  }

  function scrollToOctave(octNum) {
    const octaveHeight = getOctaveHeight();
    const totalOctaves = 7;
    const targetTop = (totalOctaves - octNum) * octaveHeight + (octaveHeight / 2) - (container.clientHeight / 2);
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }

  document.addEventListener("keydown", (e) => {
    var visualEditor = document.getElementById('recVisualEditor');
    var recEditOverlay = document.getElementById('recEditOverlay');
    if (visualEditor && visualEditor.style.display !== 'none' && recEditOverlay && recEditOverlay.classList.contains('show')) return;
    
    if (e.repeat) return;
    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
    const code = e.code;
    // 乐器切换快捷键（不影响乐谱播放）
    if (pcKeyMap.instSwitchList && Array.isArray(pcKeyMap.instSwitchList)) {
      for (const item of pcKeyMap.instSwitchList) {
        if (item.key === code) {
          currentInst = item.inst;
          document.querySelectorAll('.control .btn').forEach(b => {
            b.classList.toggle('active', b.dataset.inst === item.inst);
          });
          saveSettings();
          e.preventDefault(); return;
        }
      }
    }
    if (pcKeyMap.control.prevOctave.includes(code)) {
      // 低8度：所有动态琴键行的音域偏移量减1
      const rowCount = parseInt(sliderRows.value) || 7;
      for (let i = 0; i < rowCount; i++) {
        if (rowDynamicMap[i] !== false) { // 只影响动态琴键行
          rowOctaveOffsetMap[i] = (rowOctaveOffsetMap[i] || 0) - 1;
        }
      }
      // 同时更新currentBaseOctave用于键盘快捷键映射
      currentBaseOctave = Math.max(1, currentBaseOctave - 1);
      saveRowConfig(); saveSettings(); renderPiano(); return;
    }
    if (pcKeyMap.control.nextOctave.includes(code)) {
      // 高8度：所有动态琴键行的音域偏移量加1
      const rowCount = parseInt(sliderRows.value) || 7;
      for (let i = 0; i < rowCount; i++) {
        if (rowDynamicMap[i] !== false) { // 只影响动态琴键行
          rowOctaveOffsetMap[i] = (rowOctaveOffsetMap[i] || 0) + 1;
        }
      }
      // 同时更新currentBaseOctave用于键盘快捷键映射
      currentBaseOctave = Math.min(7, currentBaseOctave + 1);
      saveRowConfig(); saveSettings(); renderPiano(); return;
    }
    // 播放暂停键处理 - 同时支持 e.code("Space") 和 e.key(" ")
    if ((pcKeyMap.control.playPause && pcKeyMap.control.playPause.includes(code)) || (e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      // 模拟点击播放按钮
      const playBtn = document.getElementById('playBtn');
      if (playBtn) playBtn.click();
      return;
    }
    for (const note in pcKeyMap.fixed.octave5) {
      if (pcKeyMap.fixed.octave5[note].includes(code)) {
        triggerNote(code, note + Math.min(7, currentBaseOctave + 1)); return;
      }
    }
    for (const note in pcKeyMap.fixed.octave3) {
      if (pcKeyMap.fixed.octave3[note].includes(code)) {
        triggerNote(code, note + Math.max(1, currentBaseOctave - 1)); return;
      }
    }
    if (pcKeyMap.extra && Array.isArray(pcKeyMap.extra)) {
      for (const row of pcKeyMap.extra) {
        if (!row || !row.note || !row.keys) continue;
        if (row.keys.includes(code)) { triggerNote(code, row.note); return; }
      }
    }
    if (pcKeyMap.chord && Array.isArray(pcKeyMap.chord)) {
      for (const row of pcKeyMap.chord) {
        if (!row || !row.notes || !row.keys) continue;
        if (row.keys.includes(code)) { triggerChord(code, row.notes); return; }
      }
    }
    // 按固定顺序检查 base 音符，避免 for...in 顺序不确定
    const BASE_NOTE_ORDER = ["C","D","E","F","G","A","B","C#","D#","F#","G#","A#"];
    for (const note of BASE_NOTE_ORDER) {
      if (pcKeyMap.base[note] && pcKeyMap.base[note].includes(code)) {
        triggerNote(code, note + currentBaseOctave); return;
      }
    }

    function triggerNote(keyCode, noteStr) {
      const keyId = "key_" + keyCode;
      // 找当前音符对应的可见键元素，取其行乐器
      const visKey = Array.from(container.querySelectorAll(`[data-note="${noteStr}"]`)).find(isKeyVisible);
      const rowInst = getKeyRowInst(visKey || null);
      startNote(keyId, noteStr, rowInst);
      pressedKeysMap.set(keyCode, noteStr);
      // 键盘无法确定行，找第一个可见键的行
      const visKeyForHi = Array.from(container.querySelectorAll(`[data-note="${noteStr}"]`)).find(isKeyVisible);
      highlightSameRowNote(visKeyForHi || null, noteStr, true);
    }
    function triggerChord(keyCode, notes) {
      const keyId = "key_" + keyCode;
      // notes 可以是 [{n, delay}, ...] 或旧格式字符串数组
      const noteStrings = notes.map(n => (typeof n === "string") ? n : n.n);
      pressedKeysMap.set(keyCode, noteStrings);
      notes.forEach(noteItem => {
        const noteStr = (typeof noteItem === "string") ? noteItem : noteItem.n;
        const delayMs = (typeof noteItem === "object" && noteItem.delay) ? noteItem.delay : 0;
        const doOne = () => {
          const visKey = Array.from(container.querySelectorAll(`[data-note="${noteStr}"]`)).find(isKeyVisible);
          const rowInst = getKeyRowInst(visKey || null);
          startNote(keyId + "_" + noteStr, noteStr, rowInst);
          container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => {
            if (isKeyVisible(k)) k.classList.add("active");
          });
        };
        if (delayMs > 0) setTimeout(doOne, delayMs);
        else doOne();
      });
    }
  });

  document.addEventListener("keyup", (e) => {
    var visualEditor = document.getElementById('recVisualEditor');
    var recEditOverlay = document.getElementById('recEditOverlay');
    if (visualEditor && visualEditor.style.display !== 'none' && recEditOverlay && recEditOverlay.classList.contains('show')) return;
    
    const code = e.code;
    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
      pressedKeysMap.forEach((value, keyCode) => {
        const keyId = "key_" + keyCode;
        if (Array.isArray(value)) {
          value.forEach(noteStr => {
            stopNote(keyId + "_" + noteStr);
            const visKeyUpC = Array.from(container.querySelectorAll(`[data-note="${noteStr}"]`)).find(k => k.classList.contains("active"));
          highlightSameRowNote(visKeyUpC || null, noteStr, false);
          });
        } else {
          stopNote(keyId);
          const visKeyUp = Array.from(container.querySelectorAll(`[data-note="${value}"]`)).find(k => k.classList.contains("active"));
          highlightSameRowNote(visKeyUp || null, value, false);
        }
      });
      pressedKeysMap.clear(); return;
    }
    const value = pressedKeysMap.get(code);
    if (value) {
      const keyId = "key_" + code;
      if (Array.isArray(value)) {
        value.forEach(noteStr => {
          stopNote(keyId + "_" + noteStr);
          container.querySelectorAll(`[data-note="${noteStr}"]`).forEach(k => k.classList.remove("active"));
        });
      } else {
        stopNote(keyId);
        container.querySelectorAll(`[data-note="${value}"]`).forEach(k => k.classList.remove("active"));
      }
      pressedKeysMap.delete(code);
    }
  });

  function loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('pianoSettings') || '{}');
      if (settings.currentInst) {
        currentInst = settings.currentInst;
      }
      if (settings.keyHintEnabled !== undefined) {
        keyHintEnabled = settings.keyHintEnabled;
      }
      try {
        const savedOrder = localStorage.getItem('instOrder');
        if (savedOrder) instOrder = JSON.parse(savedOrder);
      } catch(e) {}
      renderInstButtons();
      if (settings.isMuted !== undefined) {
        isMuted = settings.isMuted;
        autoBtn.classList.toggle("on", isMuted);
        // 初始化 SVG 图标显示
        const waves = autoBtn.querySelectorAll('.volume-wave');
        const muteX = autoBtn.querySelectorAll('.mute-x');
        waves.forEach(el => el.style.display = isMuted ? 'none' : 'block');
        muteX.forEach(el => el.style.display = isMuted ? 'block' : 'none');
      }
      // 根据横屏/竖屏模式设置默认值
      const isLandscapeMode = document.body.classList.contains('landscape-mode');
      const defaultKeyHeight = 80;
      const defaultRowGap = 0;
      const defaultWidthScale = isLandscapeMode ? 6 : 7;
      const defaultRows = isLandscapeMode ? 3 : 7;
      
      const savedKeyHeight = parseInt(settings.keyHeight !== undefined ? settings.keyHeight : defaultKeyHeight);
      const savedRowGap = parseInt(settings.rowGap !== undefined ? settings.rowGap : defaultRowGap);
      const savedWidthScale = parseFloat(settings.keyWidthScale !== undefined ? settings.keyWidthScale : defaultWidthScale);
      const savedRows = parseInt(settings.sliderRows !== undefined ? settings.sliderRows : defaultRows);
      document.documentElement.style.setProperty('--key-height', savedKeyHeight + 'px');
      document.documentElement.style.setProperty('--row-gap', savedRowGap + 'px');
      document.documentElement.style.setProperty('--key-width-scale', savedWidthScale);
      // 宽度值决定每个音域的宽度
      // 宽度=1：每个音域占1/7屏幕宽度，7个音域刚好占满整个琴键区域（从倍低音到倍高音）
      // 宽度=7：每个音域占100%屏幕宽度，1个音域占满整个琴键区域（音阶1234567）
      const octaveWidthPercent = (savedWidthScale * 100 / 7);
      document.documentElement.style.setProperty('--octave-width', octaveWidthPercent + 'vw');
      sliderRows.value = savedRows; inputRows.value = savedRows;
      sliderWidth.value = savedWidthScale; inputWidth.value = savedWidthScale;
      sliderHeight.value = savedKeyHeight; inputHeight.value = savedKeyHeight;
      sliderGap.value = savedRowGap; inputGap.value = savedRowGap;
      currentWidthScale = savedWidthScale;
      if (settings.currentBaseOctave) currentBaseOctave = settings.currentBaseOctave;

      loadRowConfig();
      renderPiano();
    } catch (e) {
      renderPiano();
    }
  }

  function saveRowConfig() {
    try { localStorage.setItem('rowInstMap', JSON.stringify(rowInstMap)); } catch(e){}
    try { localStorage.setItem('rowColorMap', JSON.stringify(rowColorMap)); } catch(e){}
    try { localStorage.setItem('rowDynamicMap', JSON.stringify(rowDynamicMap)); } catch(e){}
    try { localStorage.setItem('rowOctaveOffsetMap', JSON.stringify(rowOctaveOffsetMap)); } catch(e){}
  }
  function loadRowConfig() {
    try { const r = localStorage.getItem('rowInstMap'); if(r) rowInstMap = JSON.parse(r); } catch(e){}
    try { const r = localStorage.getItem('rowColorMap'); if(r) rowColorMap = JSON.parse(r); } catch(e){}
    try { const r = localStorage.getItem('rowDynamicMap'); if(r) rowDynamicMap = JSON.parse(r); } catch(e){}
    try { const r = localStorage.getItem('rowOctaveOffsetMap'); if(r) rowOctaveOffsetMap = JSON.parse(r); } catch(e){}
  }

  function saveSettings() {
    try {
      const computedStyle = getComputedStyle(document.documentElement);
      let currentKeyHeight = parseInt(computedStyle.getPropertyValue('--key-height').trim()) || parseInt(sliderHeight.value);
      let currentRowGap = parseInt(computedStyle.getPropertyValue('--row-gap').trim()) || parseInt(sliderGap.value);
      let localWidthScale = parseInt(computedStyle.getPropertyValue('--key-width-scale').trim()) || parseInt(sliderWidth.value);
      currentWidthScale = localWidthScale;
      localStorage.setItem('pianoSettings', JSON.stringify({
        currentInst, isMuted, keyHintEnabled,
        keyHeight: currentKeyHeight, rowGap: currentRowGap, keyWidthScale: currentWidthScale,
        currentBaseOctave,
        sliderRows: parseInt(sliderRows.value), sliderWidth: parseInt(sliderWidth.value),
        sliderHeight: parseInt(sliderHeight.value), sliderGap: parseInt(sliderGap.value)
      }));
      saveKeyMap();
      saveRowConfig();
    } catch (e) {}
  }

  loadSettings();
  window.addEventListener('beforeunload', saveSettings);
  window.addEventListener('resize', () => { renderVirtualKeys(); });
  window.addEventListener('orientationchange', () => { setTimeout(() => renderVirtualKeys(), 300); });

  setTimeout(() => {
    if (container.children.length > 0) {
      const containerRect = container.getBoundingClientRect();
      const midRow = container.children[Math.floor(container.children.length / 2)];
      if (midRow) {
        container.scrollTop = midRow.offsetTop - (containerRect.height / 2) + (midRow.offsetHeight / 2);
      }
    }
  }, 100);

  tokens = [];
  // 注意：不调用 renderPiano()，因为 loadLayoutSettings() 已经调用过了
  drawScore();
  
  // 检测服务器并初始化音频
  checkServerAndInit();
};
(function(){

const wrap=document.querySelector(".score-wrap");
const musicBar=document.querySelector(".music-bar");
if(!wrap || !musicBar) return;

const bar=document.createElement("div");
bar.className="score-resize-bar";
wrap.appendChild(bar);

let resizing=false;
let startY=0;
let startH=0;
let savedScoreHeight = 34;

let _fullBtnRect=null;
function _snapAutoBtn(){
 var ab=document.getElementById("autoBtn");
 if(ab&&ab.style.display!=="none"&&ab.offsetParent!==null){
   var r=ab.getBoundingClientRect();
   _fullBtnRect={left:r.left,top:r.top,width:r.width,height:r.height};
 }
}
function _applyFullPos(full){
 var settingBtn = document.getElementById('mainSettingBtn');
 if(settingBtn){
   var r = settingBtn.getBoundingClientRect();
   var btnSize = 36;
   full.style.left = (r.left + r.width/2 - btnSize/2) + "px";
   full.style.top = (r.top + r.height/2 - btnSize/2) + "px";
   full.style.width = btnSize + "px";
   full.style.height = btnSize + "px";
 }
}
function updateFullscreenBtn(h){
 var full=document.getElementById("scoreFullscreenBtn");
 var settingBtn=document.getElementById("mainSettingBtn");
 var halfHeight=window.innerHeight/2;
 var shouldShow=h>halfHeight||isScoreFullscreen;
 if(shouldShow){
   // 先获取设置按钮位置
   var rect=null;
   if(settingBtn) rect=settingBtn.getBoundingClientRect();
   // 立即隐藏设置按钮
   if(settingBtn) settingBtn.style.visibility="hidden";
   
   if(!full){
     full=document.createElement("button");
     full.id="scoreFullscreenBtn";
     full.style.cssText="position:fixed;border-radius:9px;border:1px solid rgba(140,140,140,0.25);background:rgba(255,255,255,0.05);color:rgba(140,140,140,0.85);cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;padding:0;touch-action:manipulation;transition:background 0.2s ease, color 0.2s ease, border-color 0.2s ease;";
     full.onmouseover=function(){this.style.background='rgba(255,255,255,0.12)';this.style.borderColor='rgba(100,100,100,0.4)';this.style.color='rgba(100,100,100,0.95)';};
     full.onmouseout=function(){this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(140,140,140,0.25)';this.style.color='rgba(140,140,140,0.85)';};
     full.onclick=toggleScoreFullscreen;
     full.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
     document.body.appendChild(full);
   }
   // 定位到设置按钮位置
   if(rect){
     full.style.left=rect.left+"px";
     full.style.top=rect.top+"px";
     full.style.width=rect.width+"px";
     full.style.height=rect.height+"px";
   }
 }else{
   // 先恢复设置按钮
   if(settingBtn) settingBtn.style.visibility="";
   // 再移除全屏按钮
   if(full)full.remove();
 }
}

function toggleScoreFullscreen(){
 const playBtn = document.getElementById('playBtn');
 const autoBtn = document.getElementById('autoBtn');
 
 if(isScoreFullscreen){
   musicBar.style.position = '';
   musicBar.style.top = '';
   musicBar.style.left = '';
   musicBar.style.right = '';
   musicBar.style.bottom = '';
   musicBar.style.width = '';
   musicBar.style.height = '';
   musicBar.style.zIndex = '';
   musicBar.style.background = '';
   musicBar.style.backgroundColor = '';
   musicBar.style.padding = '';
   musicBar.style.paddingTop = '';
   musicBar.style.paddingBottom = '';
   musicBar.style.margin = '';
   musicBar.style.border = '';
   musicBar.style.borderBottom = '';
   
   const control = document.querySelector('.control');
   const instScroll = document.getElementById('instScroll');
   if (control) {
     control.style.display = '';
     control.style.position = '';
     control.style.top = '';
     control.style.left = '';
     control.style.height = '';
     control.style.background = '';
     control.style.backgroundColor = '';
     control.style.border = '';
     control.style.padding = '';
     control.style.zIndex = '';
     
     var settingBtnWrap = control.querySelector('.setting-btn-wrap');
     if(settingBtnWrap){
       settingBtnWrap.style.height = '';
       settingBtnWrap.style.background = '';
       settingBtnWrap.style.backgroundColor = '';
       settingBtnWrap.style.borderRight = '';
     }
   }
   if(instScroll) instScroll.style.display = '';
   
   wrap.style.position = '';
   wrap.style.margin = '';
   wrap.style.left = '';
   wrap.style.right = '';
   wrap.style.top = '';
   wrap.style.bottom = '';
   wrap.style.width = '';
   wrap.style.height = '';
   wrap.style.zIndex = '';
   
   if(playBtn) {
     playBtn.style.display = '';
     playBtn.style.background = '';
   }
   if(autoBtn) {
     autoBtn.style.display = '';
     autoBtn.style.background = '';
   }
   
   // 退出全屏时恢复按钮背景
   if (control) {
     var musicBtn = control.querySelector('.music-btn');
     if(musicBtn) musicBtn.style.background = '';
   }
   
   // 退出全屏时恢复钢琴键盘和布局工具栏
   var pianoWrap = document.querySelector('.piano-wrap');
   var layoutToolbar = document.getElementById('layoutToolbar');
   if(pianoWrap) pianoWrap.style.display = '';
   if(layoutToolbar) layoutToolbar.style.display = '';
   
   // 退出全屏时恢复 inst-fade-right
   var instFadeRight = document.querySelector('.inst-fade-right');
   if(instFadeRight) instFadeRight.style.display = '';
   
   wrap.style.setProperty("--score-height", savedScoreHeight + "px");
   if (canvas && scoreWrap) {
     canvas.height = savedScoreHeight;
     canvas.style.height = savedScoreHeight + "px";
     if (currentTupu && currentTupu.scaledMasks) {
       updateTupuScale();
       drawTupuScore();
     } else if (typeof _recPlayState !== "undefined" && _recPlayState) {
      var _h = canvas.height;
      var _lH = _h / 7;
      var _fsB = Math.max(10, Math.round(_lH * 0.62));
       _recPlayState.laneH  = _lH;
       _recPlayState.fs     = Math.max(8, Math.round(_fsB * 2/3));
       _recPlayState.blockH = Math.round(_fsB * 1.2);
       _recPlayState.tracks.forEach(function(t) { t.notes.forEach(function(n) {
         n._bw = Math.max(_textWidth(n.note, _recPlayState.fs)+10, Math.max(1, n.holdMs*_recPlayState.PX_PER_MS-2));
       }); });
       var _el = _recPlayState.paused ? _recPlayState.pausedElapsed : (performance.now()-_recPlayState.startTime)*_recPlayState.speed;
       drawRecordScore(_el, performance.now());
     } else if (tokens && tokens.length > 0) {
       drawScore();
     } else {
       canvas.width = scoreWrap.clientWidth;
       canvas.style.width = canvas.width + "px";
       drawRainbowGridBackground();
     }
   }
   isScoreFullscreen = false;
   requestAnimationFrame(function(){_snapAutoBtn();var f=document.getElementById("scoreFullscreenBtn");if(f)_applyFullPos(f);});
   
   // 退出全屏后重新渲染虚拟按键，确保位置正确
   if (typeof renderVirtualKeys === 'function') {
     renderVirtualKeys();
   }
 }else{
   savedScoreHeight = wrap.offsetHeight;
   
   musicBar.style.position = 'fixed';
   musicBar.style.top = '0';
   musicBar.style.left = '0';
   musicBar.style.right = '0';
   musicBar.style.bottom = '0';
   musicBar.style.width = '';
   musicBar.style.height = '';
   musicBar.style.zIndex = '9997';
   musicBar.style.background = 'transparent';
   musicBar.style.padding = '0';
   musicBar.style.margin = '0';
   musicBar.style.border = 'none';
   
   const control = document.querySelector('.control');
   const instScroll = document.getElementById('instScroll');
   
   wrap.style.position = 'fixed';
   wrap.style.left = '0';
   wrap.style.right = '0';
   wrap.style.top = '0';
   wrap.style.bottom = '0';
   wrap.style.margin = '0';
   wrap.style.width = '100%';
   wrap.style.height = '100%';
   wrap.style.zIndex = '9998';
   
   // 全屏模式下隐藏乐器栏，按钮悬浮在滚动栏上面
   if(instScroll) instScroll.style.display = 'none';
   if(playBtn) {
     playBtn.style.display = '';
     playBtn.style.background = 'transparent';
   }
   if(autoBtn) {
     autoBtn.style.display = '';
     autoBtn.style.background = 'transparent';
   }
   if (control) {
     control.style.display = '';
     control.style.position = 'fixed';
     control.style.top = '0';
     control.style.left = '0';
     control.style.height = '';
     control.style.background = 'transparent';
     control.style.border = 'none';
     control.style.padding = '';
     control.style.zIndex = '9999';
     
     var settingBtnWrap = control.querySelector('.setting-btn-wrap');
     if(settingBtnWrap){
       settingBtnWrap.style.height = 'auto';
       settingBtnWrap.style.background = 'transparent';
       settingBtnWrap.style.borderRight = 'none';
     }
     
     // 全屏模式下按钮背景透明
     var musicBtn = control.querySelector('.music-btn');
     if(musicBtn) musicBtn.style.background = 'transparent';
   }
   
   // 全屏模式下隐藏钢琴键盘和布局工具栏
   var pianoWrap = document.querySelector('.piano-wrap');
   var layoutToolbar = document.getElementById('layoutToolbar');
   if(pianoWrap) pianoWrap.style.display = 'none';
   if(layoutToolbar) layoutToolbar.style.display = 'none';
   
   // 全屏模式下隐藏 inst-fade-right
   var instFadeRight = document.querySelector('.inst-fade-right');
   if(instFadeRight) instFadeRight.style.display = 'none';
   
   // 全屏模式下设置所有可能显示背景的元素完全透明
   if (control) {
     control.style.background = 'transparent';
     control.style.backgroundColor = 'transparent';
   }
   musicBar.style.background = 'transparent';
   musicBar.style.backgroundColor = 'transparent';
   musicBar.style.margin = '0';
   musicBar.style.padding = '0';
   musicBar.style.borderBottom = 'none';
   
   var settingBtnWrap = document.querySelector('.setting-btn-wrap');
   if(settingBtnWrap){
     settingBtnWrap.style.background = 'transparent';
     settingBtnWrap.style.backgroundColor = 'transparent';
   }
   
   const maxH = window.innerHeight;
   wrap.style.setProperty("--score-height", maxH + "px");
   if (canvas && scoreWrap) {
     canvas.height = maxH;
     canvas.style.height = maxH + "px";
     if (currentTupu && currentTupu.scaledMasks) {
       updateTupuScale();
       drawTupuScore();
     } else if (typeof _recPlayState !== "undefined" && _recPlayState) {
      // Recalculate rec metrics for fullscreen height
      var _fsH = maxH;
      var _fsLH = _fsH / 7;
      var _fsFsBase = Math.max(10, Math.round(_fsLH * 0.62));
       _recPlayState.laneH  = _fsLH;
       _recPlayState.fs     = Math.round(_fsFsBase * 2/3);
       _recPlayState.blockH = Math.round(_fsFsBase * 1.2);
       _recPlayState.tracks.forEach(function(t) { t.notes.forEach(function(n) {
         n._bw = Math.max(_textWidth(n.note, _recPlayState.fs)+10, Math.max(1, n.holdMs*_recPlayState.PX_PER_MS-2));
       }); });
       var _fsEl = _recPlayState.paused ? _recPlayState.pausedElapsed : (performance.now()-_recPlayState.startTime)*_recPlayState.speed;
       drawRecordScore(_fsEl, performance.now());
     } else if (tokens && tokens.length > 0) {
       drawScore();
     } else {
       canvas.width = scoreWrap.clientWidth;
       canvas.style.width = canvas.width + "px";
       drawRainbowGridBackground();
     }
   }
   isScoreFullscreen = true;
   
   // 全屏后重新渲染虚拟按键，确保位置正确
   if (typeof renderVirtualKeys === 'function') {
     renderVirtualKeys();
   }
 }
 updateFullscreenBtn(wrap.offsetHeight);
}

function startResize(e){
 resizing=true;
 const touch = e.touches ? e.touches[0] : e;
 const isRotated90 = document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
 startY = isRotated90 ? touch.clientX : touch.clientY;
 startH=wrap.offsetHeight;
 document.body.style.userSelect = "none";
 document.body.style.cursor = "ns-resize";
 if(e.preventDefault) e.preventDefault();
 if(e.stopPropagation) e.stopPropagation();
}

function moveResize(e){
 if(!resizing) return;
 e.preventDefault();
 const touch = e.touches ? e.touches[0] : e;
 const isRotated90 = document.body.classList.contains('rotated-90') || document.body.classList.contains('rotated-270');
 let deltaY = isRotated90 ? (touch.clientX - startY) : (touch.clientY - startY);
 let h=startH+deltaY;
 if(h<34)h=34;
 
 const margin = 7;
 let maxH = window.innerHeight - margin;
 if (document.body.classList.contains('toolbar-rotated-180')) {
   maxH = window.innerHeight - 52 - margin;
 }
 if(h>maxH)h=maxH;
 
 wrap.style.setProperty("--score-height",h+"px");
 
 if (canvas && scoreWrap) {
   canvas.height = h;
   canvas.style.height = h + "px";
   
   if (currentTupu && currentTupu.scaledMasks) {
     updateTupuScale();
     drawTupuScore();
   } else if (typeof _recPlayState !== "undefined" && _recPlayState) {
    // Resize rec score: recompute laneH, blockH, fs, then redraw
    var newLaneH  = h / 7;
     var newFsBase = Math.max(10, Math.round(newLaneH * 0.62));
     var newFs     = Math.max(8, Math.round(newFsBase * 2/3)); // 1/3 smaller
     var newBlockH = Math.round(newFsBase * 1.2); // block unchanged
     _recPlayState.laneH  = newLaneH;
     _recPlayState.fs     = newFs;
     _recPlayState.blockH = newBlockH;
     // Recompute block widths
     _recPlayState.tracks.forEach(function(t) {
       t.notes.forEach(function(n) {
         var tw = _textWidth(n.note, newFs) + 10;
         n._bw  = Math.max(tw, Math.max(1, n.holdMs * _recPlayState.PX_PER_MS - 2));
       });
     });
     var elapsed = _recPlayState.paused ? _recPlayState.pausedElapsed : (performance.now() - _recPlayState.startTime) * _recPlayState.speed;
     drawRecordScore(elapsed, performance.now());
   } else if (tokens && tokens.length > 0) {
     drawScore();
   } else {
     canvas.width = scoreWrap.clientWidth;
     canvas.style.width = canvas.width + "px";
     drawRainbowGridBackground();
   }
 }
 
 updateFullscreenBtn(h);
}

function endResize(){
 if(!resizing) return;
 resizing=false;
 document.body.style.userSelect = "";
 document.body.style.cursor = "";
}

bar.addEventListener("mousedown",startResize);
bar.addEventListener("touchstart",startResize, {passive:false});
document.addEventListener("mousemove",moveResize);
document.addEventListener("touchmove",moveResize, {passive:false});
document.addEventListener("mouseup",endResize);
document.addEventListener("touchend",endResize);
document.addEventListener("touchcancel",endResize);

updateFullscreenBtn(wrap.offsetHeight);

// 节流优化：避免频繁调用导致卡顿
var _resizeTimer=null;
window.addEventListener("resize",function(){
  if(_resizeTimer) return;
  _resizeTimer=setTimeout(function(){
    _resizeTimer=null;
    _snapAutoBtn();
    updateFullscreenBtn(wrap.offsetHeight);
    if(typeof _recPlayState!=='undefined'&&_recPlayState)drawRainbowGridBackground();
  },100);
});
if(window.ResizeObserver){
  var _resizeObsTimer=null;
  new ResizeObserver(function(){
    if(_resizeObsTimer) return;
    _resizeObsTimer=setTimeout(function(){
      _resizeObsTimer=null;
      _snapAutoBtn();
      var f=document.getElementById("scoreFullscreenBtn");
      if(f)_applyFullPos(f);
    },100);
  }).observe(musicBar);
}

})();
