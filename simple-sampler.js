var SimpleSampler = (function() {
  var audioCtx = null;
  var sampleBuffers = {};
  var isLoaded = false;
  var loadProgress = 0;
  var loadCallbacks = [];

  // 每个乐器的采样配置（使用与实际文件名匹配的大小写）
  var SAMPLE_CONFIG = {
    'piano': { prefix: 'samples/piano-', notes: ['A0','A#0','B0','C1','C#1','D1','D#1','E1','F1','F#1','G1','G#1','A1','A#1','B1','C2','C#2','D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2','C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3','C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5','C6','C#6','D6','D#6','E6','F6','F#6','G6','G#6','A6','A#6','B6','C7','C#7','D7','D#7','E7','F7','F#7','G7','G#7','A7','A#7','B7','C8'] },
    'guitar': { prefix: 'samples/guitar-', notes: ['A2','As2','B2','C3','Cs3','D3','Ds3','E3','F3','Fs3','G3','Gs3','A3','As3','B3','C4','Cs4','D4','Ds4','E4','F4','Fs4','G4','Gs4','A4','As4','B4'] },
    'violin': { prefix: 'samples/violin-', notes: ['A4'] },
    'cello': { prefix: 'samples/cello-', notes: ['C3'] },
    'flute': { prefix: 'samples/flute-', notes: ['C5'] },
    'trumpet': { prefix: 'samples/trumpet-', notes: ['C4'] },
    'saxophone': { prefix: 'samples/saxophone-', notes: ['A4'] },
    'bell': { prefix: 'samples/bell-', notes: ['C6'] },
    'drumkit': { 
      prefix: 'samples/', 
      notes: ['C4','D4','E4','F4','G4','A4','B4'],
      files: {
        'C4': 'drum-kick.mp3',
        'D4': 'drum-snare.mp3',
        'E4': 'drum-tom-high.mp3',
        'F4': 'drum-tom-mid-high.mp3',
        'G4': 'drum-tom-mid-low.mp3',
        'A4': 'drum-tom-low.mp3',
        'B4': 'drum-crash.mp3'
      },
      names: {
        'C4': '底鼓',
        'D4': '军鼓',
        'E4': '高音嗵',
        'F4': '中高嗵',
        'G4': '中低嗵',
        'A4': '落地嗵',
        'B4': '吊镲'
      }
    }
  };

  function noteToMidi(note) {
    var match = note.match(/^([A-G])(#?)(\d+)$/);
    if (!match) return 60;
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var noteName = match[1] + match[2];
    var octave = parseInt(match[3]);
    var noteIndex = noteNames.indexOf(noteName);
    if (noteIndex === -1) return 60;
    return (octave + 1) * 12 + noteIndex;
  }

  function setAudioContext(ctx) {
    audioCtx = ctx;
    
    if (window._pendingSampleData && audioCtx) {
      var instruments = Object.keys(window._pendingSampleData);
      var totalPending = 0;
      var decoded = 0;
      var failed = 0;
      
      instruments.forEach(function(inst) {
        totalPending += Object.keys(window._pendingSampleData[inst]).length;
      });
      
      if (totalPending === 0) {
        window._pendingSampleData = {};
        return;
      }
      
      instruments.forEach(function(inst) {
        var notes = Object.keys(window._pendingSampleData[inst]);
        
        if (!sampleBuffers[inst]) sampleBuffers[inst] = {};
        
        notes.forEach(function(note) {
          var buffer = window._pendingSampleData[inst][note];
          try {
            audioCtx.decodeAudioData(buffer.slice(0), function(decodedBuffer) {
              sampleBuffers[inst][note] = decodedBuffer;
              decoded++;
              
              if (decoded + failed === totalPending) {
                window._pendingSampleData = {};
              }
            }, function(e) {
              failed++;
              if (decoded + failed === totalPending) {
                window._pendingSampleData = {};
              }
            });
          } catch(e) {
            failed++;
            if (decoded + failed === totalPending) {
              window._pendingSampleData = {};
            }
          }
        });
      });
    }
  }

  function getIsLoaded() {
    return isLoaded;
  }

  function getLoadProgress() {
    return loadProgress;
  }

  function loadAllSamples(onProgress, onComplete, onError) {
    if (window.SAMPLES_DATA) {
      loadFromEmbeddedData(onProgress, onComplete);
      return;
    }
    
    isLoaded = true;
    if (onComplete) onComplete();
  }
  
  function loadMissingInstruments(onProgress, onComplete) {
    if (onComplete) onComplete();
  }
  
  function loadAllFromFetch(onProgress, onComplete, onError) {
    var instruments = Object.keys(SAMPLE_CONFIG);
    var totalFiles = 0;
    var loadedFiles = 0;

    // 计算总文件数
    instruments.forEach(function(inst) {
      totalFiles += SAMPLE_CONFIG[inst].notes.length;
    });

    function loadInstrument(instIndex) {
      if (instIndex >= instruments.length) {
        isLoaded = true;
        if (onComplete) onComplete();
        return;
      }

      var inst = instruments[instIndex];
      var config = SAMPLE_CONFIG[inst];
      sampleBuffers[inst] = {};

      var noteIndex = 0;
      function loadNextNote() {
        if (noteIndex >= config.notes.length) {
          loadInstrument(instIndex + 1);
          return;
        }

        var note = config.notes[noteIndex];
        var url;
        if (config.files && config.files[note]) {
          url = config.files[note];
          if (config.prefix && !url.startsWith('http') && !url.startsWith('samples/')) {
            url = config.prefix + url;
          }
        } else {
          url = config.prefix + note + '.mp3';
        }

        loadAudioFile(url, function(buffer) {
          sampleBuffers[inst][note] = buffer;
          loadedFiles++;
          loadProgress = loadedFiles / totalFiles;
          if (onProgress) onProgress(loadProgress);
          noteIndex++;
          loadNextNote();
        }, function() {
          // 加载失败也继续
          loadedFiles++;
          loadProgress = loadedFiles / totalFiles;
          if (onProgress) onProgress(loadProgress);
          noteIndex++;
          loadNextNote();
        });
      }

      loadNextNote();
    }

    loadInstrument(0);
  }
  
  function loadFromEmbeddedData(onProgress, onComplete) {
    var instruments = Object.keys(window.SAMPLES_DATA);
    var totalNotes = 0;
    var loadedNotes = 0;
    var failedNotes = 0;
    
    instruments.forEach(function(inst) {
      totalNotes += Object.keys(window.SAMPLES_DATA[inst]).length;
    });
    
    if (totalNotes === 0) {
      isLoaded = true;
      if (onComplete) onComplete();
      return;
    }
    
    function checkComplete() {
      if (loadedNotes + failedNotes === totalNotes) {
        isLoaded = true;
        if (onComplete) onComplete();
      }
    }
    
    instruments.forEach(function(inst) {
      sampleBuffers[inst] = {};
      var notes = Object.keys(window.SAMPLES_DATA[inst]);
      
      notes.forEach(function(note) {
        var sampleData = window.SAMPLES_DATA[inst][note];
        try {
          var binaryString = atob(sampleData.data);
          var bytes = new Uint8Array(binaryString.length);
          for (var i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          if (audioCtx) {
            audioCtx.decodeAudioData(bytes.buffer.slice(0), function(buffer) {
              sampleBuffers[inst][note] = buffer;
              loadedNotes++;
              loadProgress = loadedNotes / totalNotes;
              if (onProgress) onProgress(loadProgress);
              checkComplete();
            }, function(e) {
              failedNotes++;
              if (onProgress) onProgress(loadProgress);
              checkComplete();
            });
          } else {
            if (!window._pendingSampleData) window._pendingSampleData = {};
            if (!window._pendingSampleData[inst]) window._pendingSampleData[inst] = {};
            window._pendingSampleData[inst][note] = bytes.buffer;
            loadedNotes++;
            loadProgress = loadedNotes / totalNotes;
            if (onProgress) onProgress(loadProgress);
            checkComplete();
          }
        } catch(e) {
          failedNotes++;
          checkComplete();
        }
      });
    });
  }

  function loadAudioFile(url, onSuccess, onError) {
    fetch(url)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.arrayBuffer();
      })
      .then(function(arrayBuffer) {
        if (audioCtx) {
          audioCtx.decodeAudioData(arrayBuffer, onSuccess, onError);
        } else {
          onError('无音频上下文');
        }
      })
      .catch(function(err) {
        onError(err.message || '加载失败');
      });
  }

  function findClosestNote(instBuffers, midiNote) {
    if (!instBuffers || Object.keys(instBuffers).length === 0) return null;

    var notes = Object.keys(instBuffers);
    var closestNote = notes[0];
    var closestDiff = Math.abs(noteToMidi(closestNote) - midiNote);

    for (var i = 1; i < notes.length; i++) {
      var diff = Math.abs(noteToMidi(notes[i]) - midiNote);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestNote = notes[i];
      }
    }

    return closestNote;
  }

  function midiToNoteName(midi) {
    // 生成与实际文件名匹配的大小写格式（只有第一个字母大写）
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var octave = Math.floor(midi / 12) - 1;
    var noteIndex = midi % 12;
    return noteNames[noteIndex] + octave;
  }

  function normalizeNoteName(noteName) {
    // 标准化音符名称，处理大小写问题
    // 将 'C4', 'c4', 'C4' 统一处理
    var match = noteName.match(/^([a-gA-G])(#?)(\d+)$/);
    if (!match) return noteName;
    return match[1].toUpperCase() + match[2] + match[3];
  }

  function playNote(instName, midiNote, velocity, duration) {
    if (!audioCtx) {
      return null;
    }

    var targetNoteName = midiToNoteName(midiNote);
    
    var instBuffers = sampleBuffers[instName];
    
    var buffer = null;
    var playbackRate = 1.0;
    var usedSample = null;
    
    if (instBuffers && Object.keys(instBuffers).length > 0) {
      for (var noteKey in instBuffers) {
        if (normalizeNoteName(noteKey) === targetNoteName) {
          buffer = instBuffers[noteKey];
          usedSample = noteKey;
          playbackRate = 1.0;
          break;
        }
      }
      
      if (!buffer) {
        var closestNote = findClosestNote(instBuffers, midiNote);
        if (closestNote) {
          buffer = instBuffers[closestNote];
          usedSample = closestNote;
          var sampleMidi = noteToMidi(closestNote);
          var pitchDiff = midiNote - sampleMidi;
          playbackRate = Math.pow(2, pitchDiff / 12);
        }
      }
    }
    
    if (!buffer) {
      var pianoBuffers = sampleBuffers['piano'];
      if (pianoBuffers && Object.keys(pianoBuffers).length > 0) {
        for (var noteKey in pianoBuffers) {
          if (normalizeNoteName(noteKey) === targetNoteName) {
            buffer = pianoBuffers[noteKey];
            usedSample = 'piano:' + noteKey;
            playbackRate = 1.0;
            break;
          }
        }
        
        if (!buffer) {
          var closestNote = findClosestNote(pianoBuffers, midiNote);
          if (closestNote) {
            buffer = pianoBuffers[closestNote];
            usedSample = 'piano:' + closestNote;
            var sampleMidi = noteToMidi(closestNote);
            var pitchDiff = midiNote - sampleMidi;
            playbackRate = Math.pow(2, pitchDiff / 12);
          }
        }
      }
    }
    
    if (!buffer) {
      return null;
    }

    var source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(audioCtx.destination);
    source.start();

    return {
      source: source,
      stop: function() {
        try {
          source.stop();
        } catch(e) {}
      }
    };
  }

  // 用户上传采样
  function uploadSample(instName, noteName, file, onSuccess, onError, preDecodedBuffer) {
    if (preDecodedBuffer) {
      if (!sampleBuffers[instName]) {
        sampleBuffers[instName] = {};
      }
      sampleBuffers[instName][noteName] = preDecodedBuffer;
      if (onSuccess) onSuccess();
      return;
    }
    
    if (!audioCtx) {
      if (onError) onError('无音频上下文');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      audioCtx.decodeAudioData(e.target.result, function(buffer) {
        if (!sampleBuffers[instName]) {
          sampleBuffers[instName] = {};
        }
        sampleBuffers[instName][noteName] = buffer;
        if (onSuccess) onSuccess();
      }, function(err) {
        if (onError) onError('解码失败');
      });
    };
    reader.onerror = function() {
      if (onError) onError('读取文件失败');
    };
    reader.readAsArrayBuffer(file);
  }

  // 获取已加载的采样列表
  function getLoadedSamples(instName) {
    if (!sampleBuffers[instName]) return [];
    return Object.keys(sampleBuffers[instName]);
  }

  // 删除采样
  function removeSample(instName, noteName) {
    if (sampleBuffers[instName] && sampleBuffers[instName][noteName]) {
      delete sampleBuffers[instName][noteName];
    }
  }

  return {
    setAudioContext: setAudioContext,
    loadAllSamples: loadAllSamples,
    playNote: playNote,
    getIsLoaded: getIsLoaded,
    getLoadProgress: getLoadProgress,
    SAMPLE_CONFIG: SAMPLE_CONFIG,
    uploadSample: uploadSample,
    getLoadedSamples: getLoadedSamples,
    removeSample: removeSample
  };
})();
