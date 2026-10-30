const $ = (selector) => document.querySelector(selector);

let audio = null;
let master = null;
let analyser = null;
let destination = null;
let mediaRecorder = null;

let wave = "sine";
let active = {};
let recording = false;
let demoTimers = [];

const settings = {
  attack: 0.08,
  decay: 0.25,
  sustain: 0.65,
  release: 0.4,
  cutoff: 5000,
  resonance: 1,
};

// AUDIO ENGINE
function initAudio() {
  if (audio) return;

  audio = new (window.AudioContext || window.webkitAudioContext)();

  master = audio.createGain();
  master.gain.value = 0.22;

  analyser = audio.createAnalyser();
  analyser.fftSize = 2048;

  destination = audio.createMediaStreamDestination();

  master.connect(analyser);
  analyser.connect(audio.destination);
  master.connect(destination);
}

// KNOBS
const controls = [
  ["adsr", "attack", "ATTACK", 0, 2, 0.08, "s"],
  ["adsr", "decay", "DECAY", 0, 2, 0.25, "s"],
  ["adsr", "sustain", "SUSTAIN", 0, 1, 0.65, "%"],
  ["adsr", "release", "RELEASE", 0, 3, 0.4, "s"],
  ["filters", "cutoff", "CUTOFF", 100, 12000, 5000, "Hz"],
  ["filters", "resonance", "RESONANCE", 0.1, 20, 1, "Q"],
];

controls.forEach(([group, id, label, min, max, value, unit]) => {
  const root = document.createElement("div");
  root.className = "knob-wrap";

  root.innerHTML = `
    <div class="knob">
      <i></i>
      <input
        type="range"
        min="${min}"
        max="${max}"
        step="${(max - min) / 200}"
        value="${value}"
        aria-label="${label}"
      >
    </div>
    <div class="knob-label">${label}</div>
    <div class="knob-value"></div>
  `;

  const input = root.querySelector("input");
  const pointer = root.querySelector("i");

  function update() {
    const v = Number(input.value);

    settings[id] = v;

    pointer.style.transform = `rotate(${-135 + ((v - min) / (max - min)) * 270}deg)`;

    const display =
      id === "sustain"
        ? (v * 100).toFixed(0)
        : v.toFixed(id === "cutoff" ? 0 : 2);

    root.querySelector(".knob-value").textContent = display + unit;
  }

  input.addEventListener("input", update);

  update();

  $("#" + group).append(root);
});

// WAVEFORM SELECTOR
document.querySelectorAll(".wave").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".wave").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    wave = button.dataset.wave;
  });
});

// PIANO KEYBOARD
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const keyboard = $("#keyboard");
const base = 48;
const octaves = 2;
const whitePositions = {};

let whiteCount = 0;

// White keys
for (let n = 0; n < octaves * 12; n++) {
  const pitch = base + n;
  const name = notes[n % 12];
  const octave = Math.floor(pitch / 12) - 1;

  if (!name.includes("#")) {
    const element = document.createElement("div");

    element.className = "white-key";
    element.dataset.note = name + octave;
    element.dataset.midi = pitch;
    element.style.left = whiteCount * 68 + "px";

    keyboard.append(element);

    whitePositions[n] = whiteCount * 68;

    whiteCount++;
  }
}

keyboard.style.width = whiteCount * 68 + "px";

// Black keys
for (let n = 0; n < octaves * 12; n++) {
  const pitch = base + n;
  const name = notes[n % 12];

  if (name.includes("#")) {
    const previous = whitePositions[n - 1];

    const element = document.createElement("div");

    element.className = "black-key";
    element.dataset.note = name + (Math.floor(pitch / 12) - 1);

    element.dataset.midi = pitch;
    element.style.left = previous + 68 + "px";

    keyboard.append(element);
  }
}

// PLAY NOTE
function startNote(midi, element) {
  if (active[midi]) return;

  initAudio();
  audio.resume();

  const osc = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();

  osc.type = wave;

  osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);

  filter.type = "lowpass";
  filter.frequency.value = settings.cutoff;
  filter.Q.value = settings.resonance;

  const now = audio.currentTime;

  amp.gain.setValueAtTime(0.0001, now);

  amp.gain.exponentialRampToValueAtTime(
    0.8,
    now + Math.max(0.005, settings.attack),
  );

  amp.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, settings.sustain * 0.8),
    now + settings.attack + settings.decay,
  );

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(master);

  osc.start();

  active[midi] = {
    osc,
    amp,
    filter,
    element,
  };

  if (element) {
    element.classList.add("active");
  }

  const frequency = 440 * Math.pow(2, (midi - 69) / 12);

  $("#frequency").textContent = Math.round(frequency) + " HZ";

  $("#status").innerHTML =
    "SYNTH ACTIVE <span>●</span> PLAYING NOTE " + notes[midi % 12];
}

// RELEASE NOTE
function stopNote(midi) {
  const voice = active[midi];

  if (!voice) return;

  const now = audio.currentTime;

  voice.amp.gain.cancelScheduledValues(now);

  voice.amp.gain.setValueAtTime(Math.max(0.0001, voice.amp.gain.value), now);

  voice.amp.gain.exponentialRampToValueAtTime(0.0001, now + settings.release);

  voice.osc.stop(now + settings.release + 0.03);

  if (voice.element) {
    voice.element.classList.remove("active");
  }

  delete active[midi];
}

// KEYBOARD INTERACTION
keyboard.querySelectorAll("[data-midi]").forEach((element) => {
  const midi = Number(element.dataset.midi);

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    element.setPointerCapture(event.pointerId);

    startNote(midi, element);
  });

  element.addEventListener("pointerup", () => {
    stopNote(midi);
  });

  element.addEventListener("pointercancel", () => {
    stopNote(midi);
  });

  element.addEventListener("lostpointercapture", () => {
    stopNote(midi);
  });
});

// OSCILLOSCOPE
const canvas = $("#scope");
const ctx = canvas.getContext("2d");

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = "#39224f";
  ctx.lineWidth = 1;

  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((width * i) / 8, 0);
    ctx.lineTo((width * i) / 8, height);
    ctx.stroke();
  }

  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (height * i) / 4);
    ctx.lineTo(width, (height * i) / 4);
    ctx.stroke();
  }

  if (analyser) {
    const data = new Uint8Array(analyser.fftSize);

    analyser.getByteTimeDomainData(data);

    ctx.beginPath();

    data.forEach((value, i) => {
      const x = (i / data.length) * width;
      const y = (value / 128 - 0.5) * height * 0.8 + height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#00ffff";
    ctx.stroke();
  } else {
    const time = performance.now() / 500;

    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const y =
        height / 2 +
        Math.sin(x * 0.035 + time) *
          Math.sin(x * 0.008 + time * 0.4) *
          height *
          0.23;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff00ff";
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  requestAnimationFrame(draw);
}

draw();

// DEMO MELODY
const melody = [
  [60, 0],
  [64, 0.25],
  [67, 0.5],
  [72, 0.75],
  [67, 1.15],
  [64, 1.4],
  [62, 1.8],
  [65, 2.05],
  [69, 2.3],
  [74, 2.55],
  [69, 2.95],
  [65, 3.2],
  [60, 3.6],
  [64, 3.85],
  [67, 4.1],
  [72, 4.35],
  [76, 4.8],
  [72, 5.1],
];

function clearDemo() {
  demoTimers.forEach((timer) => clearTimeout(timer));
  demoTimers = [];
}

$("#demo").addEventListener("click", () => {
  initAudio();
  audio.resume();

  clearDemo();

  $("#status").innerHTML = "DEMO PLAYING <span>●</span> SYNTHWAVE SEQUENCE";

  melody.forEach(([midi, time]) => {
    const timer = setTimeout(() => {
      startNote(midi, null);

      setTimeout(() => stopNote(midi), 230);
    }, time * 1000);

    demoTimers.push(timer);
  });

  demoTimers.push(
    setTimeout(() => {
      $("#status").innerHTML = "DEMO COMPLETE <span>●</span> READY";
    }, 5900),
  );
});

// RECORDING
$("#record").addEventListener("click", () => {
  initAudio();
  audio.resume();

  if (recording) {
    stopRecording();
    return;
  }

  const chunks = [];

  try {
    mediaRecorder = new MediaRecorder(destination.stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: mediaRecorder.mimeType || "audio/webm",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "neon-synth-recording.webm";

      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 3000);
    };

    mediaRecorder.start();

    recording = true;

    $("#record").classList.add("recording");
    $("#record").textContent = "● RECORDING";

    $("#status").innerHTML = "RECORDING <span>●</span> AUDIO CAPTURE ACTIVE";
  } catch (error) {
    $("#status").textContent = "RECORDING NOT SUPPORTED IN THIS BROWSER";
  }
});

// STOP RECORDING
function stopRecording() {
  if (recording && mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  recording = false;

  $("#record").classList.remove("recording");
  $("#record").textContent = "● REC";
}

// STOP ALL
$("#stop").addEventListener("click", () => {
  clearDemo();

  Object.keys(active).forEach((midi) => {
    stopNote(Number(midi));
  });

  stopRecording();

  $("#status").innerHTML = "SYSTEM READY <span>●</span> AUDIO ENGINE STANDBY";
});
