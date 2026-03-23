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
  {v:"pipa",t:"琵琶"},{v:"drum",t:"鼓"},{v:"drumkit",t:"架子鼓"},{v:"bell",t:"钟声"},
  {v:"suona",t:"唢呐"},{v:"bass",t:"贝斯"},{v:"saxophone",t:"萨克斯"}
];
let instOrder = null;
const activeNodes = new Map();
const touchMap = new Map();

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
let autoIdx = -1;
let highlightNoteIdx = -1;

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

  // 2. Horizontal gradient from left to right
  var hGrd = ctx.createLinearGradient(0, 0, w, 0);
  hGrd.addColorStop(0, _SCORE_BG_GRADIENT.horizontalGradient.left);
  hGrd.addColorStop(0.5, _SCORE_BG_GRADIENT.horizontalGradient.middle);
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

  // 4. Subtle radial glow at center (smaller radius for smoother look)
  var grd = ctx.createRadialGradient(scoreW / 2, h / 2, 0, scoreW / 2, h / 2, Math.min(scoreW, h) * 0.6);
  grd.addColorStop(0, _SCORE_BG_GRADIENT.radialGlow.center);
  grd.addColorStop(0.5, _SCORE_BG_GRADIENT.radialGlow.middle);
  grd.addColorStop(1, _SCORE_BG_GRADIENT.radialGlow.edge);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // 5. Top & bottom edge neon lines
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = _SCORE_BG_GRADIENT.edgeLines.top;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(scoreW, 0); ctx.stroke();
  ctx.strokeStyle = _SCORE_BG_GRADIENT.edgeLines.bottom;
  ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(scoreW, h - 1); ctx.stroke();

  // 9. Fixed string line at 1/3 width — only visible during recording playback (including paused/follow mode)
  if (typeof _recPlayState !== 'undefined' && _recPlayState) {
    var playheadBgX = Math.round(scoreW / 3);
    
    // Calculate vibration offset
    var vibrationX = 0;
    var isVibrating = _playheadVibration.active;
    if (isVibrating) {
      var elapsed = performance.now() - _playheadVibration.startTime;
      if (elapsed < _playheadVibration.duration) {
        var decay = 1 - (elapsed / _playheadVibration.duration);
        var frequency = 0.05; // vibration frequency
        vibrationX = Math.sin(elapsed * frequency) * _playheadVibration.amplitude * decay;
      } else {
        _playheadVibration.active = false;
        isVibrating = false;
      }
    }
    
    var finalX = playheadBgX + vibrationX;
    
    ctx.save();
    
    // String color: dim when not vibrating, bright when vibrating (key pressed)
    if (isVibrating) {
      // Bright glowing string when key is pressed
      ctx.shadowColor = 'rgba(135, 206, 250, 0.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(135, 206, 250, 0.8)';
      ctx.fillRect(finalX - 3, 0, 6, h);
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(135, 206, 250, 1)';
      ctx.fillRect(finalX - 1.5, 0, 3, h);
    } else {
      // Dim string when no key is pressed (same width)
      ctx.shadowColor = 'rgba(100, 150, 180, 0.3)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(80, 120, 150, 0.4)';
      ctx.fillRect(finalX - 3, 0, 6, h);
      ctx.fillStyle = 'rgba(100, 140, 170, 0.5)';
      ctx.fillRect(finalX - 1.5, 0, 3, h);
    }
    
    ctx.restore();
    
    // Draw lane gradient effects (from string to 2/3 of scroll bar)
    var nowPerfGrad = performance.now();
    var currentH2 = scoreWrap ? scoreWrap.offsetHeight : 170;
    var LANE_COUNT2 = 5;
    var laneH2 = currentH2 / LANE_COUNT2;
    var gradDuration = 500; // 渐变持续时间
    var gradStartX = playheadBgX; // 起点：琴弦位置
    var gradEndX = scoreW * 2 / 2; // 终点：滚动栏2/3位置
    
    _laneGradientFx = _laneGradientFx.filter(function(gfx) {
      var age = nowPerfGrad - gfx.t0;
      if (age > gradDuration) return false;
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
    var LANE_COUNT_DIV = 5;
    var laneHDiv = h / LANE_COUNT_DIV;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var i = 1; i < LANE_COUNT_DIV; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * laneHDiv); ctx.lineTo(scoreW, i * laneHDiv); ctx.stroke();
    }
    
    // Draw effect texts (Perfect, Great, Right) - fixed position, doesn't scroll
    if (_recPlayState.effectTexts && !_recPlayState.scoreAnimStart) {
      var nowT2 = performance.now();
      var playheadX = scoreW / 3;
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
        
        // Draw hit statistics on the left side - 横排版，左上角
        // 统计字体大小比分数小很多，限制在12-18像素
        var statsFs = Math.round(h * 0.08);
        statsFs = Math.max(12, Math.min(18, statsFs));
        var statsMargin = 10; // 固定左边间距为10像素
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
        
        var currentX = statsMargin + shapeR; // 起始X位置（图标中心）
        var iconY = statsTopMargin + shapeR; // 图标Y位置
        var valueY = iconY + shapeR + iconValueGap + statsFs / 2; // 数值Y位置
        
        // Perfect - 实心圆形 + 中间描边
        octx.beginPath();
        octx.arc(currentX, iconY, shapeR, 0, Math.PI * 2);
        octx.fillStyle = '#a0a0a0';
        octx.fill();
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.perfectCount.toString(), currentX, valueY);
        currentX += shapeR * 2 + itemGap;
        
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
        currentX += shapeR * 2 + itemGap;
        
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
        currentX += shapeR * 2 + itemGap;
        
        // Miss - 空心圆形（中间描边）
        octx.beginPath();
        octx.arc(currentX, iconY, shapeR, 0, Math.PI * 2);
        octx.stroke();
        octx.fillStyle = textColor;
        octx.fillText(_recPlayState.missCount.toString(), currentX, valueY);
        
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

// 滚动栏背景渐变配置
var _SCORE_BG_GRADIENT = {
  baseColor: '#0c1218ff',
  horizontalGradient: {
    left: 'rgba(204, 241, 250, 0.15)',
    middle: 'rgba(70, 47, 77, 0.16)',
    right: 'rgba(78, 45, 83, 0.1)'
  },
  verticalGradient: {
    top: 'rgba(115, 138, 143, 0.14)',
    middle1: 'rgba(191, 170, 207, 0.05)',
    middle2: 'rgba(179, 166, 209, 0.05)',
    bottom: 'rgba(120, 105, 123, 0.08)'
  },
  radialGlow: {
    center: 'rgba(189, 189, 189, 0)',
    middle: 'rgba(212, 212, 212, 0)',
    edge: 'rgba(206, 206, 206, 0)'
  },
  edgeLines: {
    top: 'rgba(196, 249, 255, 0.5)',
    bottom: 'rgba(236, 204, 255, 0.49)'
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
  var name = note.replace(/[0-9#]/g, '').replace(/#/,'');
  // Extract base note name (C, D, E, F, G, A, B) ignoring sharps for color
  var base = note.match(/^([A-G])/);
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
    return {
      inst:   p[0] || '\u94a2\u7434',
      note:   p[1] || 'C4',
      holdMs: parseInt((p[2]||'200ms').replace('ms',''))||200,
      atMs:   parseInt((p[3]||'0ms').replace('ms',''))||0
    };
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
  var LANE_COUNT = 5;
  var laneH = currentH / LANE_COUNT;
  var blockH = Math.round(_recPlayState.baseBlockH * scale);
  var base_bw = blockH * 1.5; // 与drawRecordScore保持一致
  // 琴弦在主canvas上的X坐标
  var playheadX = scoreW / 3 - canvasOffX;
  // 琴弦的屏幕坐标（固定位置）
  var screenPlayheadX = scoreW / 3;
  
  // Check all notes for collision with playhead
  _recPlayState.tracks.forEach(function(track, ti) {
    track.notes.forEach(function(n, ni) {
      var noteLane = (ti * 3 + ni) % LANE_COUNT;
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
  var playheadX = scoreW / 3 - canvasOffX; // Canvas coordinate (consistent with draw)
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var LANE_COUNT = 5;
  var laneH = currentH / LANE_COUNT;
  
  // Check all notes for collision with playhead
  _recPlayState.tracks.forEach(function(track, ti) {
    track.notes.forEach(function(n, ni) {
      var noteKey = ti + '-' + ni;
      var noteLane = (ti * 3 + ni) % LANE_COUNT;
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
      var laneH = h / 5;
      var lane  = (ti * 3 + ni) % 5;
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

  var speed  = parseFloat(recObj.speed) || 1;
  var tracks = lines.map(function(line, i) {
    return { notes: _parseRecTrack(line), idx: i };
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
  var LANE_COUNT = 5;
  var laneH     = h / LANE_COUNT;

  // Base block dimensions (fixed ratio 1:1.5 for width:height)
  // Base values for 170px total height (5 lanes * 34px each)
  var baseBlockH = 25; // Base block height (fixed)
  var baseBlockW = baseBlockH * 1.5; // Base block width (ratio 1:1.5)
  
  var PX_PER_MS = 0.18; // Base pixel per ms, speed is handled in elapsed
  var scoreW    = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX    = scoreW / 3;

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
  playBtn.textContent = '\u23f8';
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
          // Note: playhead vibration is only triggered by user key presses, not auto-playback
          // Delay slightly if we're early so sound lands at visual crossing
          var fireDelay = Math.max(0, (n.atMs - elapsed) / _recPlayState.speed);
          (function(k, note, inst, hms, sp, delay) {
            setTimeout(function(){
              if (!_recPlayState || _recPlayState.paused) return;
              startNote('rec_' + k, note, inst);
              setTimeout(function(){ try{ stopNote('rec_' + k); }catch(e){} }, hms / sp);
            }, delay);
          })(key, n.note, instEn, n.holdMs, _recPlayState.speed, fireDelay);
        }
      });
    });

    // Scroll - 视觉速度与音符块同步缩放
    var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
    var fixedX = scoreW / 3;
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
      playBtn.textContent = '\u25b6';
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
  // Flatten all notes sorted by atMs for follow mode
  var allNotes = [];
  _recPlayState.tracks.forEach(function(t, ti) {
    t.notes.forEach(function(n, ni) {
      allNotes.push({ note: n.note, atMs: n.atMs, holdMs: n.holdMs, ti: ti, ni: ni,
                      inst: n.inst });
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
  playBtn.textContent = '\u25b6';
  // Update canvas position to ensure it stays at the correct place
  var scoreW = scoreWrap ? scoreWrap.clientWidth : 300;
  var fixedX = scoreW / 3;
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
  var fixedX = scoreW / 3;
  var currentH = scoreWrap ? scoreWrap.offsetHeight : 170;
  var scale = currentH / (_recPlayState.baseLaneH * 5);
  var nowX = elapsed * 0.18 * _VISUAL_SPEED_MULT * scale;
  canvasOffX = fixedX - nowX;
  if (canvas) canvas.style.left = canvasOffX + 'px';
  playBtn.classList.add("on");
  playBtn.textContent = '\u23f8';
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
  if (typeof playBtn !== 'undefined') { playBtn.classList.remove("on"); playBtn.textContent = '\u25b6'; }
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
  if (!_ringCanvas || !_ringCtx || !_recPlayState || !keyHintEnabled) { _stopRingLoop(); return; }
  var cont = document.getElementById('container');
  if (!cont) return;

  // Canvas is position:fixed, so it covers the full viewport
  // Use CSS pixel viewport size - works correctly even with body CSS transform rotation
  var vw = document.documentElement.clientWidth  || window.innerWidth;
  var vh = document.documentElement.clientHeight || window.innerHeight;
  if (_ringCanvas.width !== vw)  _ringCanvas.width  = vw;
  if (_ringCanvas.height !== vh) _ringCanvas.height = vh;
  _ringCtx.clearRect(0, 0, vw, vh);

  if (_recPlayState.paused) return;

  var elapsed = (performance.now() - _recPlayState.startTime) * _recPlayState.speed;

  _recPlayState.tracks.forEach(function(track) {
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

        var maxExpand = Math.min(kw * 0.9, 28);
        var expand = (1 - prog) * maxExpand;

        // Outer glow (blurry halo)
        var oe = expand + 5;
        _ringCtx.strokeStyle = 'rgba(255,255,255,' + (0.12 + prog * 0.18) + ')';
        _ringCtx.lineWidth = 5 + (1 - prog) * 3;
        _ringCtx.shadowColor = 'rgba(255,255,255,1)';
        _ringCtx.shadowBlur  = 8 + (1 - prog) * 6;
        _ringCtx.beginPath();
        _ringCtx.roundRect
          ? _ringCtx.roundRect(kx - oe, ky - oe, kw + oe*2, kh + oe*2, Math.min(10, (kh + oe*2) * 0.2))
          : _ringCtx.rect(kx - oe, ky - oe, kw + oe*2, kh + oe*2);
        _ringCtx.stroke();
        _ringCtx.shadowBlur = 0;

        // Inner crisp ring
        _ringCtx.strokeStyle = 'rgba(255,255,255,' + (0.45 + prog * 0.50) + ')';
        _ringCtx.lineWidth = 1.5;
        _ringCtx.beginPath();
        var r = Math.min(6, kh * 0.15);
        _ringCtx.roundRect
          ? _ringCtx.roundRect(kx - expand, ky - expand, kw + expand*2, kh + expand*2, r)
          : _ringCtx.rect(kx - expand, ky - expand, kw + expand*2, kh + expand*2);
        _ringCtx.stroke();
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

      var maxExpand = Math.min(kw * 0.9, 28);
      var expand = (1 - prog) * maxExpand;

      var oe = expand + 5;
      _ringCtx.strokeStyle = 'rgba(255,255,255,' + (0.12 + prog * 0.18) + ')';
      _ringCtx.lineWidth = 5 + (1 - prog) * 3;
      _ringCtx.shadowColor = 'rgba(255,255,255,0.6)';
      _ringCtx.shadowBlur  = 8 + (1 - prog) * 6;
      _ringCtx.beginPath();
      _ringCtx.roundRect
        ? _ringCtx.roundRect(kx - oe, ky - oe, kw + oe*2, kh + oe*2, Math.min(10, (kh + oe*2) * 0.2))
        : _ringCtx.rect(kx - oe, ky - oe, kw + oe*2, kh + oe*2);
      _ringCtx.stroke();
      _ringCtx.shadowBlur = 0;

      _ringCtx.strokeStyle = 'rgba(255,255,255,' + (0.45 + prog * 0.50) + ')';
      _ringCtx.lineWidth = 1.5;
      _ringCtx.beginPath();
      var r = Math.min(6, kh * 0.15);
      _ringCtx.roundRect
        ? _ringCtx.roundRect(kx - expand, ky - expand, kw + expand*2, kh + expand*2, r)
        : _ringCtx.rect(kx - expand, ky - expand, kw + expand*2, kh + expand*2);
      _ringCtx.stroke();
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
  var LANE_COUNT = 5;
  
  // Dynamic scaling based on current height
  var scale = h / (_recPlayState.baseLaneH * LANE_COUNT);
  var laneH = h / LANE_COUNT;
  var blockH = Math.round(_recPlayState.baseBlockH * scale);
  var fs = Math.round(_recPlayState.baseFs * scale);
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
  var fixedX = scoreW / 3;

  // Note blocks - scale positions based on current height
  ctx.font = 'bold ' + fs + 'px "PingFang SC",Arial,sans-serif';
  ctx.textBaseline = 'middle';

  _recPlayState.tracks.forEach(function(track, ti) {
    track.notes.forEach(function(n, ni) {
      var lane     = (ti * 3 + ni) % LANE_COUNT;
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
      // 透明度状态：未弹奏前100%，正在弹奏100%，过了琴弦30%
      // 如果有放大缩小动画正在进行，保持不透明，等动画结束后再变暗
      var baseAlpha = (isPast && !hitScaleAnim) ? 0.3 : 1.0;
      var baseNote = n.note.match(/^([A-G])/);
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
      
      // Left edge highlight bar variables
      var leftBarW = blockH / 3;
      var leftBarH = blockH * 1.2;
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
      ctx.fillText(n.note, x + leftBarW + 4, by + halfBlockH);
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
  var scaleFactor = h / baseHeight;
  var playheadX = scoreW / 3 - canvasOffX;
  
  _playheadExplosions = _playheadExplosions.filter(function(exp) {
    var age = nowPerf2 - exp.startTime;
    if (age > exp.duration) return false;
    var prog = age / exp.duration;
    
    var expY = exp.lane * laneH + laneH / 2;
    
    if (exp.drawRipple) {
      var rippleCenterX = playheadX;
      var rippleCenterY = expY;
      var maxRippleRadius = 60 * scaleFactor;
      
      var outerRadius = prog * maxRippleRadius;
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
    var expX = (exp.screenX || scoreW / 3) - canvasOffX;
    
    if (exp.isRipple) {
      var rippleRadius = prog * 40 * scaleFactor;
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
    const fixedX = scoreWrap.clientWidth / 3 || 20;
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
        const fixedX = scoreWrap.clientWidth / 3 || 20;
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
  playBtn.textContent = "▶";
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
  playBtn.textContent = "▶";
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
}
// 缓存频率计算值
const freqCache = new Map();
const A4 = 440;
const C4 = A4 * Math.pow(2, -9/12);

function getFreq(s){
  // 检查缓存
  if (freqCache.has(s)) {
    return freqCache.get(s);
  }
  
  const n=s.replace(/\d/g,""), o=parseInt(s.match(/\d/)[0]);
  const freq = C4 * Math.pow(2,(noteMap[n]+(o-4)*12)/12);
  
  // 缓存结果
  freqCache.set(s, freq);
  return freq;
}

function startInstrumentNote(freq, autoVolume = 1){
  if (autoVolume <= 0) return {nodes:[], gain:null, env:null};
  const now=audioCtx.currentTime, m=audioCtx.createGain(); m.connect(audioCtx.destination);
  let o1=audioCtx.createOscillator(), g1=audioCtx.createGain();
  const oscillators = [o1];
  let needsManualConnect = true; // 是否需要在末尾执行 o1.connect(g1)

  if(currentInst==="piano"){
    // 钢琴：多谐波叠加模拟击弦泛音，快速衰减
    o1.type="triangle"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sine"; o2.frequency.value=freq*2;
    let o3=audioCtx.createOscillator(); o3.type="sine"; o3.frequency.value=freq*3;
    let g2=audioCtx.createGain(); g2.gain.value=0.15;
    let g3=audioCtx.createGain(); g3.gain.value=0.06;
    o2.connect(g2); g2.connect(g1);
    o3.connect(g3); g3.connect(g1);
    o2.start(now); o2.stop(now+3); o3.start(now); o3.stop(now+3);
    oscillators.push(o2, o3);
    g1.gain.setValueAtTime(0.38 * autoVolume, now);
    g1.gain.exponentialRampToValueAtTime(0.18 * autoVolume, now+0.3);
    g1.gain.exponentialRampToValueAtTime(0.001, now+3.5);

  } else if(currentInst==="guitar"){
    // 吉他：Karplus-Strong 算法，优化阻尼系数
    const sampleRate=audioCtx.sampleRate;
    const period=Math.round(sampleRate/freq);
    const dur=2.5;
    const tot=Math.floor(sampleRate*dur);
    const buf=audioCtx.createBuffer(1,tot,sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<period;i++) d[i]=Math.random()*2-1;
    const damp=0.996;
    for(let i=period;i<tot;i++) d[i]=damp*0.5*(d[i-period]+d[i-period+1]);
    o1=audioCtx.createBufferSource(); o1.buffer=buf; oscillators[0]=o1;
    g1.gain.setValueAtTime(0.8 * autoVolume, now);

  } else if(currentInst==="violin"){
    // 小提琴：锯齿波+多个谐波+颤音LFO+高通滤波，模拟弦鸣感
    needsManualConnect = false;
    o1.type="sawtooth"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sawtooth"; o2.frequency.value=freq*2;
    let o3=audioCtx.createOscillator(); o3.type="sine"; o3.frequency.value=freq*3;
    let g2=audioCtx.createGain(); g2.gain.value=0.12;
    let g3=audioCtx.createGain(); g3.gain.value=0.05;
    // 颤音 LFO
    let lfo=audioCtx.createOscillator(); lfo.frequency.value=5.5;
    let lfoGain=audioCtx.createGain(); lfoGain.gain.value=freq*0.008;
    lfo.connect(lfoGain); lfoGain.connect(o1.frequency); lfoGain.connect(o2.frequency);
    lfo.start(now); lfo.stop(now+8);
    oscillators.push(o2, o3, lfo);
    // 高通滤波去除低频浑浊
    let hpf=audioCtx.createBiquadFilter(); hpf.type="highpass"; hpf.frequency.value=200;
    o1.connect(hpf); o2.connect(g2); g2.connect(hpf); o3.connect(g3); g3.connect(hpf);
    hpf.connect(g1);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.28 * autoVolume, now+0.08);
    o2.start(now); o2.stop(now+8); o3.start(now); o3.stop(now+8);

  } else if(currentInst==="cello"){
    // 大提琴：低频锯齿+谐波+慢起弓+颤音，音色浑厚
    needsManualConnect = false;
    o1.type="sawtooth"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sawtooth"; o2.frequency.value=freq*2;
    let o3=audioCtx.createOscillator(); o3.type="sine"; o3.frequency.value=freq*0.5;
    let g2=audioCtx.createGain(); g2.gain.value=0.1;
    let g3=audioCtx.createGain(); g3.gain.value=0.18;
    let lfo=audioCtx.createOscillator(); lfo.frequency.value=4.5;
    let lfoGain=audioCtx.createGain(); lfoGain.gain.value=freq*0.006;
    lfo.connect(lfoGain); lfoGain.connect(o1.frequency);
    lfo.start(now); lfo.stop(now+8);
    oscillators.push(o2, o3, lfo);
    let lpf=audioCtx.createBiquadFilter(); lpf.type="lowpass"; lpf.frequency.value=3000;
    o1.connect(lpf); o2.connect(g2); g2.connect(lpf); o3.connect(g3); g3.connect(lpf);
    lpf.connect(g1);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.32 * autoVolume, now+0.12);
    o2.start(now); o2.stop(now+8); o3.start(now); o3.stop(now+8);

  } else if(currentInst==="xiao"){
    // 箫：纯正正弦+少量二次谐波+气息噪声+慢起音
    needsManualConnect = false;
    o1.type="sine"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sine"; o2.frequency.value=freq*2;
    let g2=audioCtx.createGain(); g2.gain.value=0.08;
    // 气息噪声
    let noiseLen=audioCtx.sampleRate*0.05;
    let nBuf=audioCtx.createBuffer(1,noiseLen,audioCtx.sampleRate);
    let nD=nBuf.getChannelData(0); for(let i=0;i<noiseLen;i++) nD[i]=(Math.random()*2-1)*0.04;
    let nSrc=audioCtx.createBufferSource(); nSrc.buffer=nBuf; nSrc.loop=true;
    let nGain=audioCtx.createGain(); nGain.gain.setValueAtTime(0.06*autoVolume,now); nGain.gain.linearRampToValueAtTime(0.02*autoVolume,now+0.2);
    nSrc.connect(nGain); nGain.connect(g1); nSrc.start(now);
    oscillators.push(o2, nSrc);
    o2.connect(g2); g2.connect(g1); o1.connect(g1);
    g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.22 * autoVolume, now+0.18);
    o2.start(now); o2.stop(now+8);

  } else if(currentInst==="dizi"){
    // 笛子：明亮正弦+二三次谐波+短促气息+颤音
    needsManualConnect = false;
    o1.type="sine"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sine"; o2.frequency.value=freq*2;
    let o3=audioCtx.createOscillator(); o3.type="sine"; o3.frequency.value=freq*3;
    let g2=audioCtx.createGain(); g2.gain.value=0.35;
    let g3=audioCtx.createGain(); g3.gain.value=0.12;
    let lfo=audioCtx.createOscillator(); lfo.frequency.value=6;
    let lfoGain=audioCtx.createGain(); lfoGain.gain.value=freq*0.012;
    lfo.connect(lfoGain); lfoGain.connect(o1.frequency); lfoGain.connect(o2.frequency);
    lfo.start(now); lfo.stop(now+8);
    oscillators.push(o2, o3, lfo);
    o1.connect(g1); o2.connect(g2); g2.connect(g1); o3.connect(g3); g3.connect(g1);
    g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.28 * autoVolume, now+0.08);
    o2.start(now); o2.stop(now+8); o3.start(now); o3.stop(now+8);

  } else if(currentInst==="guzheng"){
    // 古筝：Karplus-Strong 拨弦 + 明亮谐波 + 独特衰减曲线
    // 核心：用 Karplus-Strong 模拟真实弦振动，加低通模拟弦阻尼
    const sampleRate = audioCtx.sampleRate;
    const period = Math.round(sampleRate / freq);
    const dur = 3.5;
    const tot = Math.floor(sampleRate * dur);
    const buf = audioCtx.createBuffer(1, tot, sampleRate);
    const d = buf.getChannelData(0);
    // 初始激励：短脉冲（模拟拨弦瞬间）
    for(let i = 0; i < period; i++) d[i] = (i < period * 0.5) ? (Math.random() * 2 - 1) : 0;
    // Karplus-Strong 滤波（阻尼系数模拟古筝弦材质）
    const damp = 0.995;
    for(let i = period; i < tot; i++) d[i] = damp * 0.5 * (d[i-period] + d[i-period+1 < tot ? i-period+1 : i-period]);
    o1 = audioCtx.createBufferSource(); o1.buffer = buf; oscillators[0] = o1;
    // 额外谐波增亮（古筝高频泛音特征）
    let o2 = audioCtx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 3;
    let g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.08 * autoVolume, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    o2.connect(g2); g2.connect(g1);
    o2.start(now); o2.stop(now + 0.5);
    oscillators.push(o2);
    // 整体音量包络：快速起音，优雅衰减
    g1.gain.setValueAtTime(0.9 * autoVolume, now);
    g1.gain.setValueAtTime(0.75 * autoVolume, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, now + dur);

  } else if(currentInst==="pipa"){
    // 琵琶：三角波+明亮泛音+更快衰减+Karplus微弦感
    o1.type="triangle"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sine"; o2.frequency.value=freq*3;
    let g2=audioCtx.createGain(); g2.gain.value=0.15;
    o2.connect(g2); g2.connect(g1);
    o2.start(now); o2.stop(now+1.2);
    oscillators.push(o2);
    g1.gain.setValueAtTime(0.7 * autoVolume, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now+1.2);

  } else if(currentInst==="erhu"){
    // 二胡：锯齿波+低通滤波+颤音LFO，温润鼻音感
    needsManualConnect = false;
    o1.type="sawtooth"; o1.frequency.value=freq;
    let lfo=audioCtx.createOscillator(); lfo.frequency.value=5;
    let lfoGain=audioCtx.createGain(); lfoGain.gain.value=freq*0.01;
    lfo.connect(lfoGain); lfoGain.connect(o1.frequency);
    lfo.start(now); lfo.stop(now+8);
    oscillators.push(lfo);
    let lpf=audioCtx.createBiquadFilter(); lpf.type="lowpass"; lpf.frequency.value=1800;
    o1.connect(lpf); lpf.connect(g1);
    g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.28 * autoVolume, now+0.1);

  } else if(currentInst==="drum"){
    // 鼓：频率下扫+噪声叠加，模拟底鼓
    needsManualConnect = false;
    o1.type="sine"; o1.frequency.setValueAtTime(freq*1.5, now);
    o1.frequency.exponentialRampToValueAtTime(freq*0.3, now+0.15);
    // 噪声敲击感
    let noiseLen=Math.floor(audioCtx.sampleRate*0.08);
    let nBuf=audioCtx.createBuffer(1,noiseLen,audioCtx.sampleRate);
    let nD=nBuf.getChannelData(0); for(let i=0;i<noiseLen;i++) nD[i]=Math.random()*2-1;
    let nSrc=audioCtx.createBufferSource(); nSrc.buffer=nBuf;
    let nGain=audioCtx.createGain(); nGain.gain.setValueAtTime(0.5*autoVolume,now); nGain.gain.exponentialRampToValueAtTime(0.001,now+0.08);
    nSrc.connect(nGain); nGain.connect(g1); nSrc.start(now);
    oscillators.push(nSrc);
    o1.connect(g1);
    g1.gain.setValueAtTime(1.0 * autoVolume, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now+0.35);

  } else if(currentInst==="drumkit"){
    // 架子鼓：综合踩镲+军鼓+底鼓感，根据音高区分
    needsManualConnect = false;
    const isHigh = freq > 300;
    if(isHigh){
      // 高音区 → 镲片：高频噪声
      let noiseLen=Math.floor(audioCtx.sampleRate*0.12);
      let nBuf=audioCtx.createBuffer(1,noiseLen,audioCtx.sampleRate);
      let nD=nBuf.getChannelData(0); for(let i=0;i<noiseLen;i++) nD[i]=Math.random()*2-1;
      let nSrc=audioCtx.createBufferSource(); nSrc.buffer=nBuf;
      let hpf=audioCtx.createBiquadFilter(); hpf.type="highpass"; hpf.frequency.value=6000;
      nSrc.connect(hpf); hpf.connect(g1); nSrc.start(now);
      oscillators.push(nSrc);
      g1.gain.setValueAtTime(0.6*autoVolume,now); g1.gain.exponentialRampToValueAtTime(0.001,now+0.12);
    } else {
      // 低音区 → 底鼓+军鼓
      o1.type="sine"; o1.frequency.setValueAtTime(140,now); o1.frequency.exponentialRampToValueAtTime(40,now+0.1);
      let noiseLen=Math.floor(audioCtx.sampleRate*0.15);
      let nBuf=audioCtx.createBuffer(1,noiseLen,audioCtx.sampleRate);
      let nD=nBuf.getChannelData(0); for(let i=0;i<noiseLen;i++) nD[i]=Math.random()*2-1;
      let nSrc=audioCtx.createBufferSource(); nSrc.buffer=nBuf;
      let nGain=audioCtx.createGain(); nGain.gain.setValueAtTime(0.35*autoVolume,now); nGain.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      nSrc.connect(nGain); nGain.connect(g1); nSrc.start(now);
      oscillators.push(nSrc);
      o1.connect(g1);
      g1.gain.setValueAtTime(0.9*autoVolume,now); g1.gain.exponentialRampToValueAtTime(0.001,now+0.3);
    }

  } else if(currentInst==="bell"){
    // 钟声：正弦+非谐波泛音叠加，清脆长鸣
    needsManualConnect = false;
    o1.type="sine"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sine"; o2.frequency.value=freq*2.756;
    let o3=audioCtx.createOscillator(); o3.type="sine"; o3.frequency.value=freq*5.404;
    let g2=audioCtx.createGain(); g2.gain.value=0.3;
    let g3=audioCtx.createGain(); g3.gain.value=0.1;
    o1.connect(g1); o2.connect(g2); g2.connect(g1); o3.connect(g3); g3.connect(g1);
    o2.start(now); o2.stop(now+5); o3.start(now); o3.stop(now+5);
    oscillators.push(o2, o3);
    g1.gain.setValueAtTime(0.5*autoVolume,now);
    g1.gain.exponentialRampToValueAtTime(0.001, now+5);

  } else if(currentInst==="suona"){
    // 唢呐：强锯齿+带通滤波+强二次谐波，刺耳明亮
    needsManualConnect = false;
    o1.type="sawtooth"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="square"; o2.frequency.value=freq*2;
    let g2=audioCtx.createGain(); g2.gain.value=0.25;
    let bpf=audioCtx.createBiquadFilter(); bpf.type="bandpass"; bpf.frequency.value=freq*3; bpf.Q.value=0.8;
    o1.connect(bpf); o2.connect(g2); g2.connect(bpf); bpf.connect(g1);
    g1.gain.setValueAtTime(0.35*autoVolume,now);
    o2.start(now); o2.stop(now+8);
    oscillators.push(o2);

  } else if(currentInst==="bass"){
    // 贝斯：低频正弦+方波+快速衰减，厚重弹拨感
    needsManualConnect = false;
    o1.type="sine"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="square"; o2.frequency.value=freq;
    let g2=audioCtx.createGain(); g2.gain.value=0.15;
    let lpf=audioCtx.createBiquadFilter(); lpf.type="lowpass"; lpf.frequency.value=800;
    o1.connect(lpf); o2.connect(g2); g2.connect(lpf); lpf.connect(g1);
    g1.gain.setValueAtTime(0.8*autoVolume,now);
    g1.gain.exponentialRampToValueAtTime(0.3*autoVolume,now+0.4);
    g1.gain.exponentialRampToValueAtTime(0.001,now+2.5);
    o2.start(now); o2.stop(now+2.5);
    oscillators.push(o2);

  } else if(currentInst==="saxophone"){
    // 萨克斯：方波+带通滤波+慢起音+颤音，温润铜管感
    needsManualConnect = false;
    o1.type="square"; o1.frequency.value=freq;
    let o2=audioCtx.createOscillator(); o2.type="sawtooth"; o2.frequency.value=freq;
    let g2=audioCtx.createGain(); g2.gain.value=0.3;
    let lfo=audioCtx.createOscillator(); lfo.frequency.value=5;
    let lfoGain=audioCtx.createGain(); lfoGain.gain.value=freq*0.008;
    lfo.connect(lfoGain); lfoGain.connect(o1.frequency); lfoGain.connect(o2.frequency);
    lfo.start(now); lfo.stop(now+8);
    oscillators.push(o2, lfo);
    let bpf=audioCtx.createBiquadFilter(); bpf.type="bandpass"; bpf.frequency.value=freq*2; bpf.Q.value=1.2;
    o1.connect(bpf); o2.connect(g2); g2.connect(bpf); bpf.connect(g1);
    g1.gain.setValueAtTime(0,now); g1.gain.linearRampToValueAtTime(0.32*autoVolume,now+0.1);
    o2.start(now); o2.stop(now+8);
  }

  if(needsManualConnect) o1.connect(g1); 
  g1.connect(m); o1.start(now);
  return {nodes:oscillators, gain:m, env:g1};
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

function startNote(tid, ns, overrideInst){
  if (isLayoutMode) return;
  initAudio(); 
  const freq = getFreq(ns);
  stopNote(tid);
  const isAutoOrRec = (tid === "auto") || String(tid).startsWith("rec_");
  const volume = isAutoOrRec ? (isMuted || isMutedTemporarily ? 0 : 1) : 1;
  
  if (volume > 0) {
    // 支持每行独立乐器覆盖
    const prevInst = currentInst;
    if (overrideInst) currentInst = overrideInst;
    activeNodes.set(tid, startInstrumentNote(freq, volume));
    if (overrideInst) currentInst = prevInst;
  }

  // 跟弹模式：只有用户手动弹奏才触发，排除自动播放(auto)和测试音(test)
  const isUserPlay = (tid !== "auto" && tid !== "test" && !String(tid).startsWith("rec_") && !String(tid).startsWith("vk_"));
  if(isUserPlay && window._REC && window._REC.active) window._REC.onPress(tid, ns, overrideInst || currentInst);
  if(isUserPlay && window._checkRecHit) window._checkRecHit(ns, overrideInst || currentInst, performance.now());
  // 用户弹奏时检查琴弦位置是否有音符块经过，触发碰触特效
  if(isUserPlay && typeof checkTouchCollision === 'function') checkTouchCollision();
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
        var lane = (expected.ti * 3 + expected.ni) % 5;
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
        // Scroll canvas to show this note at playhead
        var scoreW2 = scoreWrap ? scoreWrap.clientWidth : 300;
        var fixedX2 = scoreW2 / 3;
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
          const fixedX = scoreWrap.clientWidth / 3 || 20;
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
  try{
    d.env.gain.cancelScheduledValues(now);
    d.env.gain.setValueAtTime(d.env.gain.value, now);
    
    let release = 1.5;
    if (currentInst === "piano") {
      release = 2.5;
    } else if (currentInst === "guitar" || currentInst === "bass") {
      release = 1.5;
    } else if (currentInst === "guzheng") {
      release = 1.5;
    } else if (currentInst === "pipa") {
      release = 0.8;
    } else if (currentInst === "violin" || currentInst === "cello" || currentInst === "erhu") {
      release = 0.25;
    } else if (currentInst === "xiao" || currentInst === "dizi" || currentInst === "saxophone") {
      release = 0.3;
    } else if (currentInst === "bell") {
      release = 3.0;
    } else if (currentInst === "drum" || currentInst === "drumkit") {
      release = 0.1;
    } else if (currentInst === "suona") {
      release = 0.2;
    }

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
    onPress: function(tid, note, instEn) {
      if (this.pending[tid]) return;
      this.pending[tid] = {
        note: note,
        instEn: instEn,
        instZh: _INST_ZH_MAP[instEn] || instEn,
        pressAt: performance.now()
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
        atMs:   Math.round(p.pressAt - this.startAt)
      });
      delete this.pending[tid];
    }
  };

  function eventsToTrack(events) {
    var sorted = events.slice().sort(function(a,b){ return a.atMs - b.atMs; });
    return sorted.map(function(e) {
      return e.instZh + '|' + e.note + '|' + e.holdMs + 'ms|' + e.atMs + 'ms';
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
      var trackCount = (rec.display||'').split('\n').filter(function(s){ return s.trim(); }).length;
      var noteCount = 0;
      (rec.display||'').split('\n').forEach(function(l){ noteCount += l.trim().split('_').filter(Boolean).length; });
      el.innerHTML =
        '<div class="song-info">' +
          '<div class="song-name">' + rec.name + '</div>' +
          '<div class="song-meta"><span>' + trackCount + '\u8f68</span><span>' + noteCount + '\u4e2a\u97f3\u7b26</span><span>' + (rec.date||'') + '</span></div>' +
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
    var overlay = document.getElementById('recEditOverlay');
    var isNew   = (idx === -1);
    document.getElementById('recEditName').value  = isNew ? '' : customRecordings[idx].name;
    document.getElementById('recEditSpeed').value = isNew ? '1' : (customRecordings[idx].speed||1);
    document.getElementById('recEditScore').value = isNew ? eventsToTrack(events||[]) : (customRecordings[idx].display||'');
    overlay._editIdx   = idx;
    overlay._newEvents = events || null;
    overlay.classList.add('show');
  }
  window._openRecEdit = openRecEdit;

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
      var display = document.getElementById('recEditScore').value.trim();
      var speed   = parseFloat(document.getElementById('recEditSpeed').value) || 1;
      var idx2    = overlay._editIdx;
      var dateStr = new Date().toLocaleDateString('zh-CN');
      if (idx2 === -1) {
        customRecordings.push({ key: Date.now(), name:name, display:display, speed:speed, date:dateStr });
      } else {
        customRecordings[idx2].name    = name;
        customRecordings[idx2].display = display;
        customRecordings[idx2].speed   = speed;
      }
      saveRecs();
      overlay.classList.remove('show');
      overlay._editIdx = undefined;
      renderRecList();
      return;
    }
    if (tgt.id === 'recEditCancel') {
      var overlay2 = document.getElementById('recEditOverlay');
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
  feedbackBtn.onclick = () => { showAppAlert("个人开发，联系待定…"); settingOverlay.classList.remove("show"); };
  keybindingBtn.onclick = () => {
    keybindingBackup = JSON.parse(JSON.stringify(pcKeyMap));
    renderKeybindings();
    keybindingOverlay.classList.add("show");
    settingOverlay.classList.remove("show");
  };

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
    if (!pcKeyMap.control.playPause) pcKeyMap.control.playPause = [" "];
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
    updateLayout(); // 更新布局确保CSS变量正确
    disableOctaveDragging();

    // Restore scroll positions after updateLayout completes (must be after requestAnimationFrame in updateLayout)
    if (doSave) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.querySelectorAll('.octave-row').forEach((row, i) => {
              const kw = row.querySelector('.octave-row-keys');
              if (kw && _savedScrolls[i] > 0) kw.scrollLeft = _savedScrolls[i];
            });
            container.querySelectorAll('.octave-gap-row').forEach((gapRow, i) => {
              if (_savedScrolls[i] > 0) gapRow.scrollLeft = _savedScrolls[i];
            });
          });
        });
      });
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
        renderPiano();
        updateLayout();
        // Restore row scroll positions after render
        // Use triple requestAnimationFrame to run AFTER updateLayout's nested requestAnimationFrame
        if (settings.rowScrollPositions && settings.rowScrollPositions.length) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
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
              });
            });
          });
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

    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
    updateLayoutToolbarPosition();
    renderPiano();
    updateLayout();
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

  // 页面加载时更新布局（确保横屏模式下宽度正确）
  setTimeout(updateLayout, 100);

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
      // 同步空隙容器和琴键行的滚动
      keysWrap.addEventListener('scroll', function() {
        gapRow.scrollLeft = keysWrap.scrollLeft;
      });
      // 应用行配色
      applyRowColors(rowEl, rowIdx);
      
      // 设置默认滚动位置
      // 音域顺序（从左到右）：倍低音(索引0)、低音(索引1)、中低音(索引2)、中音(索引3)、中高音(索引4)、高音(索引5)、倍高音(索引6)
      const isLandscape = document.body.classList.contains('landscape-mode');
      // 使用更长的延迟确保所有元素都已渲染完成
      setTimeout(function() {
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
      }, 300);
    }
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
      item.querySelector(".edit-opt").onclick = (e) => { e.stopPropagation(); openEditDialog(song, globalIdx); };
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
      item.querySelector(".edit-opt").onclick = (e) => { e.stopPropagation(); openTupuEditDialog(tupu, idx); };
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
        playBtn.textContent = "▶";
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
        playBtn.textContent = "⏸";
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
    autoBtn.textContent = isMuted ? "🔇" : "🔊";
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
      
      const fixedX = scoreWrap.clientWidth / 3 || 20;
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
    // 播放暂停键处理
    if (pcKeyMap.control.playPause && pcKeyMap.control.playPause.includes(code)) {
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
        autoBtn.textContent = isMuted ? "🔇" : "🔊";
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
  renderPiano();
  drawScore();
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
let isScoreFullscreen = false;
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
 var halfHeight=window.innerHeight/2;
 var shouldShow=h>halfHeight||isScoreFullscreen;
 if(shouldShow){
   _snapAutoBtn();
   if(!full){
     full=document.createElement("button");
     full.id="scoreFullscreenBtn";
     full.style.cssText="position:fixed;border-radius:8px;border:1px solid #444;background:#222;color:#0099ff;font-size:18px;cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;padding:0;touch-action:manipulation;width:36px;height:36px;";
     full.onclick=toggleScoreFullscreen;
     full.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6V2h4M16 6V2h-4M2 12v4h4M16 12v4h-4"/></svg>';
     document.body.appendChild(full);
   }
   _applyFullPos(full);
 }else{
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
   
   if(playBtn) playBtn.style.display = '';
   if(autoBtn) autoBtn.style.display = '';
   
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
       var _lH = _h / 5;
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
   if(playBtn) playBtn.style.display = '';
   if(autoBtn) autoBtn.style.display = '';
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
       var _fsLH = _fsH / 5;
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
     var newLaneH  = h / 5;
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

window.addEventListener("resize",function(){_snapAutoBtn();updateFullscreenBtn(wrap.offsetHeight);if(typeof _recPlayState!=='undefined'&&_recPlayState)drawRainbowGridBackground();});
if(window.ResizeObserver){new ResizeObserver(function(){_snapAutoBtn();var f=document.getElementById("scoreFullscreenBtn");if(f)_applyFullPos(f);}).observe(musicBar);}

})();
