/* Four-second compositions sampled independently of rendering speed. */
(() => {
  'use strict';

  const FRAMES = 120;
  const TAU = 2 * Math.PI;
  const VIEW_W = 720, VIEW_H = 960;
  const CARD_W = ChromeCard.width, CARD_H = ChromeCard.height;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function canvasOf(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // The flakes follow the U-shaped pocket along the bottom and the two sides.
  // All distances use the same card coordinates as the interactive chamber.
  const SIDE_X = 68, TOP_Y = 92, BASE_Y = 916, BEND = 64;
  const SIDE_LENGTH = BASE_Y - BEND - TOP_Y;
  const ARC_LENGTH = Math.PI * BEND / 2;
  const BASE_LENGTH = CARD_W - 2 * (SIDE_X + BEND);
  const RAIL_LENGTH = 2 * (SIDE_LENGTH + ARC_LENGTH) + BASE_LENGTH;

  function trackPosition(distance, offset) {
    // Mirror the right half about the centre, including its rounded corner.
    const right = distance > RAIL_LENGTH / 2;
    const s = right ? RAIL_LENGTH - distance : distance;
    let x, y;
    if (s < SIDE_LENGTH) {
      x = SIDE_X + offset;
      y = TOP_Y + s;
    } else if (s < SIDE_LENGTH + ARC_LENGTH) {
      const t = (s - SIDE_LENGTH) / BEND;
      x = SIDE_X + BEND - (BEND - offset) * Math.cos(t);
      y = BASE_Y - BEND + (BEND - offset) * Math.sin(t);
    } else {
      x = SIDE_X + BEND + s - SIDE_LENGTH - ARC_LENGTH;
      y = BASE_Y - offset;
    }
    return [right ? CARD_W - x : x, y];
  }

  function closestDistance(flake) {
    const x = Math.min(flake.x, CARD_W - flake.x);
    const y = flake.y;
    let distance;
    if (y < BASE_Y - BEND && x < SIDE_X + BEND) {
      distance = clamp(y - TOP_Y, 0, SIDE_LENGTH);
    } else if (x > SIDE_X + BEND) {
      distance = SIDE_LENGTH + ARC_LENGTH + x - SIDE_X - BEND;
    } else {
      const angle = Math.atan2(y - BASE_Y + BEND, SIDE_X + BEND - x);
      distance = SIDE_LENGTH + BEND * clamp(angle, 0, Math.PI / 2);
    }
    return flake.x > CARD_W / 2 ? RAIL_LENGTH - distance : distance;
  }

  function starMotion(flakes, frame) {
    const material=StarChamber.motion(frame);
    const chamber = new StarChamber();
    const pieces = flakes.map((flake) => {
      const copy = {...flake};
      return {
        copy, original: flake, home: closestDistance(flake),
        range: (86 + 77 * flake.depth) * material.travel,
        delay: (.31 + .34 * (1 - flake.depth)) * material.delay,
        offset: (flake.depth - .5) * 23
      };
    }).sort((a, b) => a.home - b.home);
    chamber.flakes = pieces.map(piece => piece.copy);
    chamber.order = chamber.flakes.slice().sort((a, b) => a.depth - b.depth);

    // Ordered piece-to-piece contacts keep a dense group from merging at a turn.
    function fitPocket() {
      let limit = 12;
      for (const piece of pieces) {
        piece.distance = Math.max(piece.distance, limit + piece.copy.radius);
        limit = piece.distance + piece.copy.radius;
      }
      limit = RAIL_LENGTH - 12;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const piece = pieces[i];
        piece.distance = Math.min(piece.distance, limit - piece.copy.radius);
        limit = piece.distance - piece.copy.radius;
      }
    }
    pieces.forEach(piece => { piece.distance = piece.home; });
    fitPocket();
    for (const piece of pieces) piece.home = piece.distance;

    return {
      update(phase) {
        for (const piece of pieces) {
          // Tilt supplies the acceleration. Sliding velocity peaks later, with
          // deeper, lighter pieces leading the heavier foreground foil.
          piece.distance = piece.home - piece.range * Math.cos(phase - piece.delay);
        }
        fitPocket();
        for (const piece of pieces) {
          const f = piece.copy;
          [f.x, f.y] = trackPosition(piece.distance, piece.offset);
          const travel = piece.distance - piece.home;
          const axle = f.handedness * travel * material.tumble / Math.max(17, f.radius * 1.85);
          f.roll = piece.original.roll + axle;
          f.angle = piece.original.angle + axle * .26;
          f.pitch = piece.original.pitch + .18 * Math.sin(phase - piece.delay);
        }
      },
      draw(ctx, tx, ty) { chamber.draw(ctx, tx, ty, frame); }
    };
  }

  function studioBackdrop() {
    const surface = canvasOf(VIEW_W, VIEW_H);
    const ctx = surface.getContext('2d', {alpha:false});
    const gradient = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    gradient.addColorStop(0, '#161620');
    gradient.addColorStop(.56, '#302b3a');
    gradient.addColorStop(1, '#18171e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const halo = ctx.createRadialGradient(331, 434, 50, 331, 434, 550);
    halo.addColorStop(0, 'rgba(125,111,160,.40)');
    halo.addColorStop(.75, 'rgba(98,84,127,.11)');
    halo.addColorStop(1, 'rgba(98,84,127,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(208,198,229,.10)';
    for (let y = 13; y < VIEW_H; y += 20) {
      for (let x = 11; x < VIEW_W; x += 20) ctx.fillRect(x, y, 1, 1);
    }
    return surface;
  }

  const DISPLAY_SCALE = .78, CAMERA = 1750;
  // Perspective varies across columns for a camera orbit about the vertical
  // axis. Warp directly into integral two-pixel strips before adding the roll.
  // This keeps the image and lettering continuous without a GPU dependency.
  function projectCard(face, dest, yaw, bounds, fit, density) {
    const ctx = dest.getContext('2d');
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const display=DISPLAY_SCALE*fit,camera=CAMERA/fit;
    const projectX = u => display * u * cos / (1 + u * sin / camera);
    const unprojectX = x => x / (display * cos - x * sin / camera);
    const begin = VIEW_W / 2 + projectX(bounds.left-CARD_W/2);
    const end = VIEW_W / 2 + projectX(bounds.right-CARD_W/2);
    const first = Math.floor(begin), last = Math.ceil(end);
    for (let x = first; x < last; x += 2) {
      const l = Math.max(x, begin), r = Math.min(x + 2, end);
      const left = unprojectX(l - VIEW_W/2);
      const right = unprojectX(r - VIEW_W/2);
      const middle = (left + right) * .5;
      const columnScale=display/(1+middle*sin/camera);
      const top=VIEW_H/2+(bounds.top-CARD_H/2)*columnScale;
      const height=(bounds.bottom-bounds.top)*columnScale;
      ctx.drawImage(face,(left+CARD_W/2-bounds.left)*density,0,(right-left)*density,(bounds.bottom-bounds.top)*density,
        l,top,r-l,height);
    }
  }

  function drawShadow(ctx, offset, opacity) {
    ctx.save();
    ctx.translate(VIEW_W/2 + offset, 905);
    ctx.scale(1, .115);
    ctx.globalAlpha = opacity;
    const shadow = ctx.createRadialGradient(0, 0, 12, 0, 0, 219);
    shadow.addColorStop(0, 'rgba(5,4,14,.48)');
    shadow.addColorStop(1, 'rgba(5,4,14,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(-220, -220, 440, 440);
    ctx.restore();
  }

  function createOrbit({state, flakes}) {
    const canvas = canvasOf(VIEW_W, VIEW_H);
    const ctx = canvas.getContext('2d', {alpha:false});
    const bounds=CardStickers.bounds(state);
    // Keep the same scale throughout the orbit and leave room for the rotation.
    const radiusX=Math.max(CARD_W/2-bounds.left,bounds.right-CARD_W/2);
    const radiusY=Math.max(CARD_H/2-bounds.top,bounds.bottom-CARD_H/2);
    const fit=Math.min(1,CARD_W/(2*radiusX),CARD_H/(2*radiusY));
    const density=Math.min(1,1600/Math.max(bounds.right-bounds.left,bounds.bottom-bounds.top));
    const face = canvasOf(1,1);
    const faceContext = face.getContext('2d');
    const projected = canvasOf(VIEW_W, VIEW_H);
    const backdrop = studioBackdrop();
    const stars = starMotion(state.particles === false ? [] : flakes, state.frame);
    const shot = {...state};

    function renderFrame(index) {
      const phase = ((index % FRAMES + FRAMES) % FRAMES) * TAU / FRAMES;
      const sway = Math.sin(phase);
      shot.tiltX = .98 * sway;
      shot.tiltY = .11 * Math.sin(phase * 2 - .3);
      const yaw = shot.tiltX * 23 * Math.PI / 180;
      const roll = (-2.4 + 4.2 * sway) * Math.PI / 180;
      stars.update(phase);
      CardFrames.paint(faceContext,shot,c=>stars.draw(c,shot.tiltX,shot.tiltY),bounds,density);
      projectCard(face,projected,yaw,bounds,fit,density);

      ctx.drawImage(backdrop, 0, 0);
      drawShadow(ctx, 10 * sway, 1);

      ctx.save();
      ctx.translate(VIEW_W/2, 466);
      ctx.rotate(roll);
      ctx.drawImage(projected, -VIEW_W/2, -VIEW_H/2);
      ctx.restore();
      return canvas;
    }
    return {canvas, renderFrame};
  }

  function dustProgress(index) {
    const frame = ((index % FRAMES) + FRAMES) % FRAMES;
    // A longer outward sweep gives the fragments room to travel. Leave a beat
    // of empty stage, then gather them back along the same paths for the seam.
    const outward = clamp((frame - 4) / 57, 0, 1);
    const returning = clamp((frame - 68) / 47, 0, 1);
    const t = outward - returning;
    return t * t * (3 - 2 * t);
  }

  function createDust(face) {
    const canvas = canvasOf(VIEW_W, VIEW_H);
    const ctx = canvas.getContext('2d', {alpha:false});
    const backdrop = studioBackdrop();
    const dust = CardDust.create(face);

    function renderFrame(index) {
      const progress = dustProgress(index);
      ctx.drawImage(backdrop, 0, 0);
      drawShadow(ctx, 0, 1 - progress);
      dust.draw(ctx, progress);
      return canvas;
    }
    return {canvas, renderFrame};
  }

  function create(composition) {
    return composition.effect === 'dust' ? createDust(composition.face) : createOrbit(composition);
  }

  window.FoilLoopScene = Object.freeze({create, dustProgress});
})();
