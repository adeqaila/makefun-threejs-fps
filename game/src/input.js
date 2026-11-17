// input.js — one job: keyboard + mouse + pointer lock, turned into one input object.
// The sim reads `input` each fixed step; nothing else touches the DOM events.
// Pointer lock: click the canvas to lock; Esc unlocks (the game pauses while unlocked).
export function createInput(canvas) {
  const input = {
    forward: false, back: false, left: false, right: false,
    crouch: false, slowWalk: false, interact: false,
    firing: false, reload: false, buyToggle: false,
    slot: 0, // 1/2/3/4 pressed this frame
    lookDX: 0, lookDY: 0,
    locked: false,
    everLocked: false, // the pointer was locked at least once: only then does
    // losing the lock pause the game (a lock that never engaged never pauses)
    onKey: null, // hud buy-menu handler (set by main.js)
    onLockChange: null,
    onCanvasClick: null,
  };
  const keyMap = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyC: 'crouch', ControlLeft: 'crouch',
    ShiftLeft: 'slowWalk', ShiftRight: 'slowWalk',
    KeyE: 'interact',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const name = keyMap[e.code];
    if (name) { input[name] = true; e.preventDefault(); return; }
    if (e.code === 'KeyR') input.reload = true;
    if (e.code === 'KeyB') input.buyToggle = true;
    if (e.code === 'Digit1') input.slot = 1;
    if (e.code === 'Digit2') input.slot = 2;
    if (e.code === 'Digit3') input.slot = 3;
    if (e.code === 'Digit4') input.slot = 4;
    if (e.code === 'Digit5') input.slot = 5;
    if (e.code === 'Digit6') input.slot = 6;
    if (e.code === 'Digit7') input.slot = 7;
    if (input.onKey) input.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => {
    const name = keyMap[e.code];
    if (name) input[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keyMap)) input[keyMap[k]] = false;
    input.firing = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.lookDX += e.movementX || 0;
    input.lookDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.firing = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (input.locked) input.everLocked = true;
    if (input.onLockChange) input.onLockChange(input.locked);
  });
  input.lock = () => {
    try { canvas.requestPointerLock(); } catch (e) { /* headless: no-op */ }
  };
  input.unlock = () => {
    try { document.exitPointerLock(); } catch (e) { /* no-op */ }
  };
  // Consume one-frame flags after the sim step.
  input.consumeFrame = () => {
    input.reload = false;
    input.buyToggle = false;
    input.slot = 0;
    input.lookDX = 0;
    input.lookDY = 0;
  };
  return input;
}
