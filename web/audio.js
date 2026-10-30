"use strict";
// The Python server packages every sound locally. Browser media waits for a user gesture.
(() => {
  const root = "/assets/audio/";
  const files = {
    sector: "sector_mix.ogg", airy: "airy_mix.ogg", pulse: "pulse_mix.mp3",
    boss1: "final_stand_phase_1.3_0.ogg", boss2: "final_stand_phase_2.2_0.ogg",
    victory: "victory_5.ogg", hover: "hover_0.ogg",
    click: "sfx_ui_click_1.mp3", scan: "sonar_ping_0.mp3",
    shoot: "alienshoot1.ogg", mining: "mining_tap.ogg",
    powerup: "powerup.wav", hit: "hit.wav", powerdown: "powerdown.wav",
    shield: "shieldhit.wav", charge: "charge.wav", explosion: "deathboom.wav",
    transition: "teleport_1.wav"
  };
  const musicKeys = ["sector", "airy", "pulse", "boss1", "boss2"];
  const tracks = new Map();
  const pendingPlay = new WeakSet();
  const playingEffects = new Set();
  const lastEffect = new Map();
  let unlocked = false, muted = false, desired = null, targetVolume = 0;
  let lastPhase = "", raf = 0;
  const button = () => document.getElementById("sound-button");
  function buttonState() {
    const b = button(); if (!b) return;
    b.textContent = muted ? "SOUND OFF · M" : unlocked ? "SOUND ON · M" : "ENABLE SOUND · M";
    b.setAttribute("aria-label", muted ? "Unmute sound" : unlocked ? "Mute sound" : "Enable sound");
    b.setAttribute("aria-pressed", String(unlocked && !muted));
  }
  function track(key) {
    if (!tracks.has(key)) {
      const a = new Audio(root + files[key]);
      a.preload = "auto"; a.loop = true; a.volume = 0;
      tracks.set(key, a);
    }
    return tracks.get(key);
  }
  function envelope() {
    let moving = false;
    for (const [key, a] of tracks) {
      const goal = unlocked && !muted && !document.hidden && key === desired ? targetVolume : 0;
      const delta = goal - a.volume;
      if (Math.abs(delta) > .012) {
        // Approximately half a second from silence to the selected music.
        a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(delta) * Math.min(Math.abs(delta), .022)));
        moving = true;
      } else a.volume = goal;
      if (!goal && a.volume === 0 && !a.paused) a.pause();
    }
    raf = moving ? requestAnimationFrame(envelope) : 0;
  }
  function fade() { if (!raf) raf = requestAnimationFrame(envelope); }
  function startDesired() {
    if (!unlocked || muted || document.hidden || !desired) return;
    const a = track(desired);
    if (a.paused && !pendingPlay.has(a)) {
      pendingPlay.add(a);
      a.play().catch(error => {
        if (error?.name === "NotAllowedError") { unlocked = false; buttonState(); fade(); }
      }).finally(() => pendingPlay.delete(a));
    }
    fade();
  }
  function unlock() {
    if (muted) return;
    unlocked = true; buttonState(); startDesired();
  }
  function toggle() {
    if (!unlocked && !muted) unlock();
    else { muted = !muted; if (!muted) unlock(); else fade(); buttonState(); }
  }
  function effect(name, volume = .3, cooldown = 0) {
    if (!unlocked || muted || document.hidden || !files[name]) return;
    const now = performance.now();
    if (now - (lastEffect.get(name) ?? -Infinity) < cooldown) return;
    lastEffect.set(name, now);
    const a = new Audio(root + files[name]);
    a.volume = Math.max(0, Math.min(1, volume));
    playingEffects.add(a);
    a.addEventListener("ended", () => playingEffects.delete(a), {once:true});
    a.addEventListener("error", () => playingEffects.delete(a), {once:true});
    a.play().catch(() => playingEffects.delete(a));
    // Cap lifetime even if an audio file stalls or the page loses focus.
    setTimeout(() => { a.pause(); playingEffects.delete(a); }, name === "explosion" ? 7500 : 4400);
  }
  function sync(s) {
    if (!s) return;
    const phase = s.phase, stage = s.stage;
    const old = desired;
    if (phase === "paused" || phase === "loading" || phase === "death" || phase === "boss_defeat") {
      desired = null;
    } else if (phase === "boss") desired = s.boss?.phase === 2 ? "boss2" : "boss1";
    else if (phase === "victory") desired = "airy";
    else desired = ["sector", "airy", "pulse"][Math.max(0, Math.min(2, stage - 1))];

    const quieter = ["scan", "identify", "pipes", "pipes_success", "mine", "upgrade"].includes(phase);
    // Route assets are loudness-matched to the Boss music before packaging.
    const routeLevel = desired === "pulse" ? .85 : desired === "sector" ? .62 : .58;
    targetVolume = phase === "menu" ? .38 : phase === "victory" ? .30 :
      phase === "boss" ? .58 : quieter ? routeLevel * .8 : routeLevel;
    if (old !== desired) {
      if (desired && tracks.has(desired) && old !== null) {
        try { track(desired).currentTime = 0; } catch (_) {}
      }
      startDesired(); fade();
    } else if (desired) { startDesired(); fade(); }

    if (lastPhase && phase !== lastPhase) {
      if (phase === "loading") effect("transition", .31, 900);
      if (phase === "scan") effect("scan", .25, 900);
      if (phase === "pipes_success") effect("powerup", .31, 700);
    }
    lastPhase = phase;
  }
  const eventSounds = {
    shoot: ["shoot", .15, 105], hit: ["hit", .18, 135], damage: ["shield", .42, 350],
    scan_complete: ["scan", .38, 600], correct: ["click", .33, 160], wrong: ["powerdown", .21, 300],
    rotate: ["click", .20, 105], mining_good: ["mining", .42, 230], mining_miss: ["powerdown", .22, 350],
    collected: ["powerup", .42, 450], upgrade: ["powerup", .30, 450],
    boss_phase: ["charge", .41, 950], boss_defeated: ["explosion", .62, 1200],
    defeat: ["powerdown", .48, 750], victory: ["victory", .52, 1000],
    enemy_shoot: ["shoot", .07, 340]
  };
  function event(name) {
    const spec = eventSounds[name]; if (spec) effect(...spec);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      for (const a of playingEffects) a.pause(); playingEffects.clear();
      for (const a of tracks.values()) a.pause();
      fade();
    }
    else startDesired();
  });
  window.GameAudio = {unlock, toggle, sync, event, effect, buttonState};
  buttonState();
})();
