const audioFiles = {
  kick: "./assets/audio/bass-drum.mp3",
  snare: "./assets/audio/snare-drum.mp3",
  hihat: "./assets/audio/hi-hat.mp3",
  "hihat foot": "./assets/audio/hi-hat-foot.mp3",
  tom: "./assets/audio/tom-tom.mp3",
  "floor tom": "./assets/audio/floor-tom.mp3",
  ride: "./assets/audio/ride-cymbal.mp3",
  perc: "./assets/audio/perc-808.mp3",
};

const MAX_STEPS = 20;

let ctx, gainNode;

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = ctx.createGain();
  gainNode.gain.value = volumeSlider.value;
  gainNode.connect(ctx.destination);
}

const buffers = {};
const rawBuffers = {};

const sequencer = document.getElementById("sequencer");
const controls = document.getElementById("controls");
const beatBar = document.getElementById("beat-bar");
const timeSelect = document.getElementById("timeSignature");
const bpmInput = document.getElementById("bpm");
const bpmSlider = document.getElementById("bpmSlider");
const playBtn = document.getElementById("play");
const clearBtn = document.getElementById("clear");
const bpmDown = document.getElementById("bpmDown");
const bpmUp = document.getElementById("bpmUp");
const volumeSlider = document.getElementById("volume");

let activeSteps = 16;
let currentStep = 0;
let timer = null;
let audioReady = false;

async function fetchAll() {
  for (const key in audioFiles) {
    const response = await fetch(audioFiles[key]);
    rawBuffers[key] = await response.arrayBuffer();
  }
}

async function decodeAll() {
  for (const key in rawBuffers) {
    buffers[key] = await ctx.decodeAudioData(rawBuffers[key]);
  }
}

async function ensureAudio() {
  initAudio();
  if (ctx.state === "suspended") await ctx.resume();
  if (!audioReady) {
    await decodeAll();
    audioReady = true;
  }
}

function play(name) {
  const source = ctx.createBufferSource();
  source.buffer = buffers[name];
  source.connect(gainNode);
  source.start();
}

function syncBPM() {
  const bpmInput = document.getElementById("bpm");

  function setBPM(value) {
    const v = Math.min(240, Math.max(40, value));
    bpmInput.textContent = v;
    bpmSlider.value = v;
  }

  bpmSlider.addEventListener("input", () => setBPM(Number(bpmSlider.value)));
  bpmDown.addEventListener("click", () =>
    setBPM(Number(bpmInput.textContent) - 1),
  );
  bpmUp.addEventListener("click", () =>
    setBPM(Number(bpmInput.textContent) + 1),
  );
}

function syncVolume() {
  volumeSlider.addEventListener("input", () => {
    gainNode.gain.value = volumeSlider.value;
  });
}

function highlight(stepIndex) {
  beatBar
    .querySelectorAll(".active")
    .forEach((el) => el.classList.remove("active"));
  sequencer
    .querySelectorAll('input[type="checkbox"].col-active')
    .forEach((el) => el.classList.remove("col-active"));

  if (stepIndex >= 0) {
    beatBar
      .querySelector(`[data-step="${stepIndex}"]`)
      ?.classList.add("active");
    sequencer
      .querySelectorAll(
        `input[type="checkbox"][data-step="${stepIndex}"]:not(:disabled)`,
      )
      .forEach((el) => el.classList.add("col-active"));
  }
}

function updateActiveSteps() {
  activeSteps = Number(timeSelect.value) * 4;

  sequencer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    const step = parseInt(cb.dataset.step);
    const isActive = step < activeSteps;
    cb.disabled = !isActive;
    if (!isActive) cb.checked = false;
  });

  beatBar.querySelectorAll("[data-step]").forEach((el) => {
    el.style.visibility =
      parseInt(el.dataset.step) < activeSteps ? "" : "hidden";
  });

  if (currentStep >= activeSteps) currentStep = 0;
  if (!timer) highlight(-1);
}

function clearAll() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
    playBtn.innerHTML = '<img src="./assets/icons/play.svg" alt="Play" />';
    highlight(-1);
  }
  sequencer
    .querySelectorAll('input[type="checkbox"]:not(:disabled)')
    .forEach((cb) => {
      cb.checked = false;
    });
}

function initNameButtons() {
  sequencer.querySelectorAll(".name-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".row");
      const activeBoxes = [
        ...row.querySelectorAll('input[type="checkbox"]:not(:disabled)'),
      ];
      const allChecked =
        activeBoxes.length > 0 && activeBoxes.every((cb) => cb.checked);

      if (!allChecked) {
        await ensureAudio();
        const instrument = row.querySelector('input[type="checkbox"]')?.dataset
          .instrument;
        if (instrument && buffers[instrument]) play(instrument);
      }

      activeBoxes.forEach((cb) => (cb.checked = !allChecked));
    });
  });
}

function initCheckboxPreview() {
  sequencer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async () => {
      if (!cb.checked) return;
      await ensureAudio();
      if (buffers[cb.dataset.instrument]) play(cb.dataset.instrument);
    });
  });
}

function tick() {
  const duration = (60 / Number(bpmInput.textContent) / 2) * 1000;

  highlight(currentStep);

  sequencer
    .querySelectorAll(`[data-step="${currentStep}"]:checked:not(:disabled)`)
    .forEach((el) => play(el.dataset.instrument));

  currentStep = (currentStep + 1) % activeSteps;

  timer = setTimeout(tick, duration);
}

async function toggle() {
  await ensureAudio();

  if (timer) {
    clearTimeout(timer);
    timer = null;
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
    playBtn.innerHTML = '<img src="./assets/icons/play.svg" alt="Play" />';
    highlight(-1);
    return;
  }

  currentStep = 0;
  tick();
  playBtn.textContent = "Pause";
  playBtn.classList.add("active");
  playBtn.innerHTML = '<img src="./assets/icons/pause.svg" alt="Pause" />';
}

playBtn.addEventListener("click", toggle);
clearBtn.addEventListener("click", clearAll);

timeSelect.addEventListener("change", () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
    playBtn.innerHTML = '<img src="./assets/icons/play.svg" alt="Play" />';
  }
  updateActiveSteps();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    toggle();
  }
});

window.addEventListener("load", async () => {
  fetchAll();
  updateActiveSteps();
  initNameButtons();
  initCheckboxPreview();
  syncBPM();
  syncVolume();

  setTimeout(() => {
    controls.classList.remove("hidden");
    controls.classList.add("fade-in");
    setTimeout(() => {
      sequencer.classList.remove("hidden");
      sequencer.classList.add("fade-in");
    }, 100);
  }, 50);
});
