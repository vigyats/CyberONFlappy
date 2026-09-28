const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const readyPanel = document.getElementById('readyPanel');
const gameOverPanel = document.getElementById('gameOverPanel');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore');
const soundToggle = document.getElementById('soundToggle');
const bootScreen = document.getElementById('bootScreen');
const bootText = document.getElementById('bootText');

let W = canvas.width, H = canvas.height, gameScale = 1;
let bird, pipes, score, best = Number(localStorage.getItem('cyberonBest') || 0);
let running = false, gameOver = false, last = 0, spawnTimer = 0;
let soundEnabled = localStorage.getItem('cyberonSfx') !== 'off';
let audioContext;
bestEl.textContent = best;

function playTone(startFrequency, endFrequency, duration, waveform = 'sine', volume = 0.035, delay = 0) {
  if (!soundEnabled) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return;
  audioContext ||= new AudioContextType();
  if (audioContext.state === 'suspended') audioContext.resume();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const startTime = audioContext.currentTime + delay;
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + duration);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playStatic(duration = 0.16) {
  if (!soundEnabled) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return;
  audioContext ||= new AudioContextType();
  if (audioContext.state === 'suspended') audioContext.resume();

  const frameCount = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index++) samples[index] = Math.random() * 2 - 1;
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = 1100;
  gain.gain.setValueAtTime(0.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
}

function playSound(event) {
  if (event === 'start') {
    playTone(420, 620, 0.11, 'square', 0.025);
    playTone(620, 940, 0.14, 'triangle', 0.03, 0.1);
  } else if (event === 'flap') {
    playTone(760, 430, 0.07, 'triangle', 0.018);
  } else if (event === 'score') {
    playTone(660, 880, 0.08, 'square', 0.025);
    playTone(880, 1180, 0.1, 'triangle', 0.03, 0.07);
  } else if (event === 'crash') {
    playTone(190, 48, 0.32, 'sawtooth', 0.055);
    playStatic();
  }
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? 'SFX ON' : 'SFX OFF';
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', `Turn sound effects ${soundEnabled ? 'off' : 'on'}`);
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const previousWidth = W;
  const previousHeight = H;
  const previousScale = gameScale;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  W = bounds.width;
  H = bounds.height;
  gameScale = Math.max(W / 900, 0.82);
  canvas.width = Math.round(W * pixelRatio);
  canvas.height = Math.round(H * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  if (bird) {
    bird.x = W * 0.21;
    bird.y = Math.max(17 * gameScale, Math.min(H - 17 * gameScale, bird.y * H / previousHeight));
    bird.r = 17 * gameScale;
  }
  if (pipes && previousWidth && previousHeight) {
    for (const pipe of pipes) {
      pipe.x *= W / previousWidth;
      pipe.w *= gameScale / previousScale;
      pipe.gap *= gameScale / previousScale;
      pipe.top = Math.min(Math.max(60 * gameScale, pipe.top * H / previousHeight), H - 80 * gameScale - pipe.gap);
    }
  }
}

function reset() {
  bird = { x: W * 0.21, y: H/2, vy: 0, r: 17 * gameScale, rot: 0 };
  pipes = [];
  score = 0;
  spawnTimer = 0;
  scoreEl.textContent = '0';
  gameOver = false;
}

function start() {
  reset();
  running = true;
  readyPanel.hidden = true;
  gameOverPanel.hidden = true;
  overlay.style.display = 'none';
  playSound('start');
  flap();
  last = performance.now();
  requestAnimationFrame(loop);
}

function flap() {
  if (!running || gameOver) return;
  bird.vy = -390 * gameScale;
  playSound('flap');
}

function spawnPipe() {
  const difficulty = Math.min(score / 30, 1);
  const gap = (180 - difficulty * 36) * gameScale;
  const minTop = 60 * gameScale, maxTop = H - 80 * gameScale - gap;
  const top = minTop + Math.random() * Math.max(1, maxTop - minTop);
  pipes.push({ x: W + 30 * gameScale, w: 72 * gameScale, top, gap, passed:false });
}

function circleRectCollision(c, r) {
  const cx = Math.max(r.x, Math.min(c.x, r.x+r.w));
  const cy = Math.max(r.y, Math.min(c.y, r.y+r.h));
  return Math.hypot(c.x-cx, c.y-cy) < c.r;
}

function update(dt) {
  bird.vy += 1080 * gameScale * dt;
  bird.y += bird.vy * dt;
  bird.rot = Math.min(1.0, Math.max(-0.5, bird.vy / 550));
  const difficulty = Math.min(score / 30, 1);
  spawnTimer += dt;
  if (spawnTimer > 1.45 - difficulty * 0.25) { spawnPipe(); spawnTimer = 0; }

  for (const p of pipes) {
    p.x -= (260 + difficulty * 100) * gameScale * dt;
    if (!p.passed && p.x + p.w < bird.x) {
      p.passed = true;
      score++;
      playSound('score');
      scoreEl.textContent = score;
      if (score > best) { best = score; bestEl.textContent = best; localStorage.setItem('cyberonBest', best); }
    }
    if (circleRectCollision(bird, {x:p.x,y:0,w:p.w,h:p.top}) ||
        circleRectCollision(bird, {x:p.x,y:p.top+p.gap,w:p.w,h:H-(p.top+p.gap)})) endGame();
  }
  pipes = pipes.filter(p => p.x + p.w > -20);
  if (bird.y-bird.r < 0 || bird.y+bird.r > H) endGame();
}

function endGame() {
  if (!running) return;
  running = false;
  gameOver = true;
  playSound('crash');
  finalScoreEl.textContent = score;
  readyPanel.hidden = true;
  gameOverPanel.hidden = false;
  overlay.style.display = 'grid';
}

function drawBackground(t) {
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#061318'); g.addColorStop(1,'#020608');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(0,255,169,.055)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=45*gameScale){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=0;y<H;y+=45*gameScale){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  for(let i=0;i<30;i++){
    const x=(i*83*gameScale + t*.015*gameScale)%W, y=(i*47*gameScale)%H;
    ctx.fillStyle='rgba(0,255,169,.22)'; ctx.fillRect(x,y,2*gameScale,2*gameScale);
  }
}

function drawPipe(p) {
  const grad = ctx.createLinearGradient(p.x,0,p.x+p.w,0);
  grad.addColorStop(0,'#087657'); grad.addColorStop(.5,'#00c987'); grad.addColorStop(1,'#07513f');
  ctx.fillStyle=grad;
  ctx.fillRect(p.x,0,p.w,p.top);
  ctx.fillRect(p.x,p.top+p.gap,p.w,H-(p.top+p.gap));
  ctx.fillStyle='#00f0a0';
  ctx.fillRect(p.x-7*gameScale,p.top-13*gameScale,p.w+14*gameScale,13*gameScale);
  ctx.fillRect(p.x-7*gameScale,p.top+p.gap,p.w+14*gameScale,13*gameScale);
  ctx.fillStyle='rgba(255,255,255,.12)';
  ctx.fillRect(p.x+10*gameScale,0,5*gameScale,p.top-13*gameScale);
  ctx.fillRect(p.x+10*gameScale,p.top+p.gap+13*gameScale,5*gameScale,H-(p.top+p.gap+13*gameScale));
}

function drawBird() {
  ctx.save(); ctx.translate(bird.x,bird.y); ctx.rotate(bird.rot);
  ctx.scale(gameScale,gameScale);
  ctx.shadowBlur=22; ctx.shadowColor='#00ffa9';
  ctx.fillStyle='#00ffa9'; ctx.beginPath(); ctx.arc(0,0,17,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#dffff4'; ctx.beginPath();ctx.ellipse(-3,5,10,6,-.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#061014'; ctx.beginPath();ctx.arc(7,-6,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(8,-7,1.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffcf5a'; ctx.beginPath();ctx.moveTo(16,-1);ctx.lineTo(29,3);ctx.lineTo(16,7);ctx.closePath();ctx.fill();
  ctx.restore();
}

function draw(t) {
  drawBackground(t);
  pipes.forEach(drawPipe);
  drawBird();
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(0,0,W,45*gameScale);
  ctx.font=`700 ${14*gameScale}px Space Mono, monospace`; ctx.fillStyle='#72ffe0'; ctx.fillText('CYBERON // PIPE FLIGHT',20*gameScale,28*gameScale);
}

function loop(now) {
  const dt=Math.min((now-last)/1000,.035); last=now;
  update(dt); draw(now);
  if(running) requestAnimationFrame(loop); else draw(now);
}

canvas.addEventListener('pointerdown', event => { event.preventDefault(); flap(); });
document.addEventListener('keydown', e => { if(e.code==='Space'){e.preventDefault(); if(!running) start(); else flap();} });
startBtn.addEventListener('click', start);
retryBtn.addEventListener('click', start);
soundToggle.addEventListener('pointerdown', event => event.stopPropagation());
soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('cyberonSfx', soundEnabled ? 'on' : 'off');
  updateSoundToggle();
});
window.addEventListener('resize', resizeCanvas);

const bootMessage = 'CYBERON26 IS LIVE';
let bootIndex = 0;
const typeBootMessage = () => {
  if (bootIndex < bootMessage.length) {
    bootText.textContent += bootMessage[bootIndex++];
    window.setTimeout(typeBootMessage, 95);
  } else {
    window.setTimeout(() => bootScreen.classList.add('boot-complete'), 800);
  }
};
window.setTimeout(typeBootMessage, 450);

resizeCanvas();
updateSoundToggle();
reset(); draw(0);
