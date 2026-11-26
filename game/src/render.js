// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. A pseudo-3D chase view: the sky, layered mountain ridges, the
// valley floor with its river and fields, the rings and the strip projected from
// world space, the plane in frame, and a lit instrument HUD.
import { FIELD, FOCAL, FONT, HORIZON_Y, MISSIONS, PALETTE, PLANE, RING, TRACK } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 720, top: 150, line: 32, bottom: 72 };
const PLANE_X = 640;
const PLANE_Y = 505;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const altLabel = cachedLabel('ALT ');
  const spdLabel = cachedLabel('SPD ');
  const hdgLabel = cachedLabel('HDG ');
  const fuelLabel = cachedLabel('FUEL ');
  const scoreLabel = cachedLabel('SKOR ');
  const ringLabel = cachedLabel('RING ');
  const distLabel = cachedLabel('STRIP ');
  const finalLabel = cachedLabel('Skor ');
  const bestLabel = cachedLabel('Terbaik ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function ridgeLine(noiseFn, shift, baseY, amp, color, snow) {
    // noiseFn already returns [-amp, amp] (its amplitude is applied inside), so
    // (n + amp) maps the ridge top into [baseY - 2*amp, baseY].
    context.beginPath();
    context.moveTo(-4, FIELD.height);
    let prevY = baseY;
    const peaks = [];
    for (let sx = -4; sx <= FIELD.width + 4; sx += 16) {
      const n = noiseFn(sx * 2.2 + shift);
      const y = baseY - (n + amp);
      context.lineTo(sx, y);
      if (y < prevY - 14) peaks.push([sx, y]);
      prevY = y;
    }
    context.lineTo(FIELD.width + 4, FIELD.height);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    if (snow) {
      context.fillStyle = PALETTE.ridgeFarSnow;
      for (const [px, py] of peaks) {
        context.beginPath();
        context.moveTo(px - 16, py + 16);
        context.lineTo(px, py - 4);
        context.lineTo(px + 16, py + 16);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawSky(state, world) {
    const grad = context.createLinearGradient(0, 0, 0, HORIZON_Y + 40);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, HORIZON_Y + 40);
    // Sun, low over the ridge.
    const sunX = 980 - state.plane.x * 0.06;
    const sunY = 118 - state.plane.alt * 0.05;
    const glow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255, 217, 122, 0.9)');
    glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 90, sunY - 90, 180, 180);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 26, 0, Math.PI * 2);
    context.fill();
    // Clouds drift with the plane.
    context.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of state.cloudSeed) {
      const cx = ((c.x * 1600 - state.plane.x * 0.25 - state.z * 0.02) % 1500 + 1500) % 1500 - 110;
      const cy = 40 + c.y * 130 - state.plane.alt * 0.04;
      const s = c.s;
      context.beginPath();
      context.ellipse(cx, cy, 46 * s, 14 * s, 0, 0, Math.PI * 2);
      context.ellipse(cx + 30 * s, cy + 4 * s, 34 * s, 11 * s, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawValleyFloor(state, world) {
    const grad = context.createLinearGradient(0, HORIZON_Y, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.valley);
    grad.addColorStop(1, '#2c4a24');
    context.fillStyle = grad;
    context.fillRect(0, HORIZON_Y + 6, FIELD.width, FIELD.height - HORIZON_Y - 6);
    // Fields: seeded patches on the floor.
    for (const f of state.fields) {
      const a = world.project(f.x - f.w / 2, 0, f.z);
      const b = world.project(f.x + f.w / 2, 0, f.z);
      const c = world.project(f.x + f.w / 2, 0, f.z + 70);
      const d = world.project(f.x - f.w / 2, 0, f.z + 70);
      if (!a || !b || !c || !d) continue;
      context.fillStyle = f.tone === 0 ? PALETTE.fieldA : PALETTE.fieldB;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.lineTo(d.x, d.y);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }
    // River: a winding band along the centreline.
    const startZ = Math.max(40, Math.floor((state.z + 30) / 80) * 80);
    let prevL = null;
    let prevR = null;
    for (let z = startZ; z <= Math.min(TRACK.stripZ + 260, state.z + 3200); z += 80) {
      const cx = world.centreAt(z);
      const l = world.project(cx - 15, 0, z);
      const r = world.project(cx + 15, 0, z);
      if (l && r && prevL && prevR) {
        context.fillStyle = PALETTE.river;
        context.beginPath();
        context.moveTo(prevL.x, prevL.y);
        context.lineTo(prevR.x, prevR.y);
        context.lineTo(r.x, r.y);
        context.lineTo(l.x, l.y);
        context.closePath();
        context.fill();
        context.strokeStyle = PALETTE.riverLight;
        context.lineWidth = Math.max(1, 2.2 * l.s);
        context.beginPath();
        context.moveTo((prevL.x + prevR.x) / 2, (prevL.y + prevR.y) / 2);
        context.lineTo((l.x + r.x) / 2, (l.y + r.y) / 2);
        context.stroke();
      }
      prevL = l;
      prevR = r;
    }
  }

  function drawStrip(state, world) {
    const cz = world.centreAt(TRACK.stripZ);
    for (let z = TRACK.stripZ - 60; z < TRACK.stripZ + 220; z += 40) {
      const a = world.project(cz - 26, 0, z);
      const b = world.project(cz + 26, 0, z);
      const c = world.project(cz + 26, 0, z + 40);
      const d = world.project(cz - 26, 0, z + 40);
      if (!a || !b || !c || !d) continue;
      context.fillStyle = PALETTE.strip;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.lineTo(d.x, d.y);
      context.closePath();
      context.fill();
      // Centreline dashes.
      const m1 = world.project(cz, 0, z + 8);
      const m2 = world.project(cz, 0, z + 32);
      if (m1 && m2) {
        context.strokeStyle = PALETTE.stripMark;
        context.lineWidth = Math.max(1, 2.4 * m1.s);
        context.beginPath();
        context.moveTo(m1.x, m1.y);
        context.lineTo(m2.x, m2.y);
        context.stroke();
      }
    }
    // Windsock beside the threshold.
    const sock = world.project(cz + 34, 0, TRACK.stripZ - 20);
    if (sock) {
      context.strokeStyle = '#d8dee6';
      context.lineWidth = Math.max(1, 2 * sock.s);
      context.beginPath();
      context.moveTo(sock.x, sock.y);
      context.lineTo(sock.x, sock.y - 26 * sock.s);
      context.stroke();
      context.fillStyle = '#ff7a2f';
      context.beginPath();
      context.moveTo(sock.x, sock.y - 26 * sock.s);
      context.lineTo(sock.x + 16 * sock.s, sock.y - 22 * sock.s);
      context.lineTo(sock.x, sock.y - 18 * sock.s);
      context.closePath();
      context.fill();
    }
  }

  function drawTrees(state, world) {
    for (const t of state.trees) {
      if (t.z < state.z + 10 || t.z > state.z + 2400) continue;
      const base = world.project(t.x, 0, t.z);
      if (!base || base.x < -20 || base.x > FIELD.width + 20 || base.y > FIELD.height + 10) continue;
      const h = 16 * t.s * base.s;
      if (h < 2) continue;
      context.fillStyle = '#5d3a1e';
      context.fillRect(base.x - 1.5 * base.s, base.y - h * 0.25, 3 * base.s, h * 0.25);
      context.fillStyle = '#2c5a26';
      context.beginPath();
      context.moveTo(base.x, base.y - h);
      context.lineTo(base.x - h * 0.45, base.y - h * 0.2);
      context.lineTo(base.x + h * 0.45, base.y - h * 0.2);
      context.closePath();
      context.fill();
    }
  }

  function drawRings(state, world) {
    let next = null;
    for (const ring of state.rings) {
      if (ring.active && !ring.passed) {
        next = ring;
        break;
      }
    }
    for (const ring of state.rings) {
      if (!ring.active) continue;
      const p = world.project(ring.x, ring.y, ring.z);
      if (!p || p.x < -80 || p.x > FIELD.width + 80 || p.y < -40 || p.y > FIELD.height + 40) continue;
      const radius = RING.radius * p.s;
      if (radius < 2) continue;
      const isNext = ring === next;
      context.save();
      context.translate(p.x, p.y);
      context.lineWidth = isNext ? 5 : 3;
      context.strokeStyle = ring.passed ? PALETTE.ringPassed : isNext ? PALETTE.ring : 'rgba(242, 201, 76, 0.55)';
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = isNext ? 14 : 6;
      context.beginPath();
      context.ellipse(0, 0, radius, radius * 0.92, 0, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.beginPath();
      context.ellipse(0, 0, radius * 0.72, radius * 0.66, 0, 0, Math.PI * 2);
      context.stroke();
      if (ring.passed) {
        context.strokeStyle = PALETTE.ringPassed;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-radius * 0.4, 0);
        context.lineTo(-radius * 0.1, radius * 0.35);
        context.lineTo(radius * 0.45, -radius * 0.35);
        context.stroke();
      }
      context.restore();
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    // Shadow on the ground below the plane.
    const groundY = HORIZON_Y + plane.alt * (FOCAL / 90);
    if (groundY < FIELD.height + 40) {
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.beginPath();
      context.ellipse(PLANE_X, Math.min(groundY, FIELD.height - 8), 46, 10, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.save();
    context.translate(PLANE_X, PLANE_Y);
    context.rotate((plane.bank * Math.PI) / 180);
    // Prop blur at the nose (top, away from the camera).
    context.fillStyle = 'rgba(232, 238, 245, 0.35)';
    context.beginPath();
    context.ellipse(0, -62, 26, 7, 0, 0, Math.PI * 2);
    context.fill();
    // Wings.
    context.fillStyle = PALETTE.planeWing;
    context.beginPath();
    context.moveTo(-14, -18);
    context.lineTo(-86, 6);
    context.lineTo(-86, 18);
    context.lineTo(-12, 8);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(14, -18);
    context.lineTo(86, 6);
    context.lineTo(86, 18);
    context.lineTo(12, 8);
    context.closePath();
    context.fill();
    // Tailplane.
    context.fillStyle = PALETTE.planeTrim;
    context.beginPath();
    context.moveTo(-8, 34);
    context.lineTo(-34, 46);
    context.lineTo(-34, 54);
    context.lineTo(-6, 46);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(8, 34);
    context.lineTo(34, 46);
    context.lineTo(34, 54);
    context.lineTo(6, 46);
    context.closePath();
    context.fill();
    // Fuselage.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.roundRect(-11, -58, 22, 112, 10);
    context.fill();
    context.fillStyle = PALETTE.planeTrim;
    context.fillRect(-11, -6, 22, 7);
    // Canopy.
    context.fillStyle = '#1d3a5f';
    context.beginPath();
    context.ellipse(0, -34, 7, 16, 0, 0, Math.PI * 2);
    context.fill();
    // Fin.
    context.fillStyle = PALETTE.planeWing;
    context.beginPath();
    context.moveTo(0, 40);
    context.lineTo(-7, 58);
    context.lineTo(7, 58);
    context.closePath();
    context.fill();
    // Nav lights.
    context.fillStyle = '#ff4d4d';
    context.beginPath();
    context.arc(-86, 12, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#4dff88';
    context.beginPath();
    context.arc(86, 12, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(0, 56, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHud(state, world) {
    const plane = state.plane;
    const mission = MISSIONS[state.mission];
    const speedKmh = Math.round(plane.speed * 3.6);
    const hdg = Math.round(((plane.heading % 360) + 360) % 360);
    const distToStrip = Math.max(0, Math.round(TRACK.stripZ - state.z));

    // Top bar.
    context.fillStyle = 'rgba(13, 21, 38, 0.55)';
    context.fillRect(0, 0, FIELD.width, 64);
    context.textBaseline = 'top';
    text(altLabel(`${Math.round(plane.alt)} m`), 24, 12, 30, PALETTE.text, 'left', true);
    text(`VSI ${plane.vspeed >= 0 ? '+' : ''}${plane.vspeed.toFixed(1)} m/s`, 24, 40, 15, PALETTE.muted, 'left');
    text(hdgLabel(`${String(hdg).padStart(3, '0')}°`), FIELD.width / 2, 12, 30, PALETTE.text, 'center', true);
    // Compass ticks.
    for (let d = -60; d <= 60; d += 15) {
      const a = ((hdg + d) % 360 + 360) % 360;
      const x = FIELD.width / 2 + d * 2.1;
      context.fillStyle = d === 0 ? PALETTE.ring : PALETTE.muted;
      context.fillRect(x - 1, 46, 2, d % 45 === 0 ? 10 : 6);
      if (d % 45 === 0) text(String(a).padStart(3, '0'), x, 52, 10, PALETTE.muted, 'center');
    }
    text(spdLabel(`${speedKmh} km/h`), FIELD.width - 24, 12, 30, PALETTE.text, 'right', true);
    // Throttle bar.
    context.fillStyle = '#22304a';
    context.fillRect(FIELD.width - 184, 44, 160, 8);
    context.fillStyle = PALETTE.good;
    context.fillRect(FIELD.width - 184, 44, 160 * plane.throttle, 8);
    text('THR', FIELD.width - 192, 40, 13, PALETTE.muted, 'right');

    // Score and mission line.
    text(scoreLabel(Math.round(state.score)), 24, 76, 24, PALETTE.ring, 'left', true);
    text(`${mission.name}  ·  ${ringLabel(`${state.ringsPassed}/${state.ringsTotal}`)}  ·  ${distLabel(`${distToStrip} m`)}`, FIELD.width / 2, 76, 20, PALETTE.text, 'center');

    // Fuel gauge, bottom left.
    context.fillStyle = 'rgba(13, 21, 38, 0.55)';
    context.fillRect(16, FIELD.height - 56, 220, 40);
    text(fuelLabel(`${Math.round(plane.fuel)}%`), 28, FIELD.height - 48, 18, plane.fuel < 25 ? PALETTE.warn : PALETTE.text, 'left', true);
    context.fillStyle = '#22304a';
    context.fillRect(28, FIELD.height - 26, 196, 10);
    context.fillStyle = plane.fuel < 25 ? PALETTE.warn : plane.fuel < 50 ? PALETTE.ring : PALETTE.good;
    context.fillRect(28, FIELD.height - 26, 196 * (plane.fuel / 100), 10);

    // Artificial horizon, bottom right.
    const ax = FIELD.width - 64;
    const ay = FIELD.height - 64;
    context.save();
    context.beginPath();
    context.arc(ax, ay, 44, 0, Math.PI * 2);
    context.clip();
    context.translate(ax, ay);
    context.rotate((-plane.bank * Math.PI) / 180);
    context.translate(0, clamp(plane.vspeed * 1.6, -26, 26));
    context.fillStyle = '#7fb0d8';
    context.fillRect(-48, -48, 96, 48);
    context.fillStyle = '#6b4a2a';
    context.fillRect(-48, 0, 96, 48);
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(ax, ay, 44, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.text;
    context.beginPath();
    context.moveTo(ax - 16, ay);
    context.lineTo(ax + 16, ay);
    context.lineTo(ax, ay + 8);
    context.closePath();
    context.fill();

    // Warnings.
    const blink = Math.floor(state.elapsed * 3) % 2 === 0;
    if (blink) {
      if (plane.fuel > 0 && plane.fuel < 20) {
        text('LOW FUEL', FIELD.width / 2, 150, 34, PALETTE.warn, 'center', true);
      } else if (plane.fuel <= 0) {
        text('BAHAN BAKAR HABIS — MELUNCUR', FIELD.width / 2, 150, 30, PALETTE.warn, 'center', true);
      }
      const ground = world.terrainHeight(plane.x, state.z);
      if (plane.alt - ground < 34 && plane.alt > ground + 2) {
        text('TERRAIN — TARIK KE ATAS', FIELD.width / 2, 190, 30, PALETTE.warn, 'center', true);
      }
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(16, 24, 39, 0.92)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.ring, 'center', true);
  }

  function titleLines(best) {
    return [
      'Terbang menyusuri lembah Puncak — lewati ring, ikuti sungai,',
      'dan mendarat di strip. Pilih misi, lalu terbang!',
      '',
      'Misi 1 — Ring Run: 8 ring emas',
      'Misi 2 — River Run: terbang rendah, di bawah 70 m',
      'Misi 3 — Strip Landing: mendarat di ujung lembah',
      '',
      '← → belok  ·  ↑ ↓ naik/turun  ·  Shift/Q gas  ·  P jeda',
      '',
      bestLabel(best),
    ];
  }

  /** Paint one frame: the valley, then the HUD or a panel for the screen the game is on. */
  function draw(state, world, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const plane = state.plane;
    const altShift = plane.alt * 0.12;
    drawSky(state, world);
    ridgeLine(world.ridgeFar, state.plane.x * 0.12 + state.z * 0.05, HORIZON_Y - 8 - altShift, 90, PALETTE.ridgeFar, true);
    ridgeLine(world.ridgeNear, state.plane.x * 0.3 + state.z * 0.12, HORIZON_Y + 26 - altShift * 0.6, 46, PALETTE.ridgeNear, false);
    drawValleyFloor(state, world);
    drawStrip(state, world);
    drawTrees(state, world);
    drawRings(state, world);
    drawPlane(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('PUNCAK RIDGE RUN', titleLines(best), 'Tekan 1, 2 atau 3 untuk memilih misi — Spasi untuk terbang');
      return;
    }
    drawHud(state, world);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', ['Lembah menunggumu.'], 'Tekan P untuk lanjut');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        state.reason || '',
        finalLabel(Math.round(state.score)),
        `${ringLabel(`${state.ringsPassed}/${state.ringsTotal}`)}   ·   ${bestLabel(best)}`,
      ];
      drawPanel(state.landed || state.status === 'won' ? 'Misi Selesai!' : 'Penerbangan Berakhir', lines, 'Tekan Spasi untuk terbang lagi');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
