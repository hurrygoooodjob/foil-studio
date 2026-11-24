/* Erode a frozen RGBA card into drifting fragments of its own image. */
(() => {
  'use strict';

  const TAU = 2 * Math.PI;
  const DRY_EDGE = .012;
  const LAST_RELEASE = .65;

  function randomSequence(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function pixelsCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function noiseField() {
    const side = 128;
    const table = new Float32Array(side * side);
    const random = randomSequence(0xb74a3f9d);
    for (let i = 0; i < table.length; i++) table[i] = random() - .5;
    return (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
      const row = (iy & 127) * side, next = ((iy + 1) & 127) * side;
      const a = ix & 127, b = (ix + 1) & 127;
      const top = table[row + a] * (1 - tx) + table[row + b] * tx;
      const bottom = table[next + a] * (1 - tx) + table[next + b] * tx;
      return top * (1 - ty) + bottom * ty;
    };
  }

  function opaqueBounds(data, w, h) {
    let left = w, top = h, right = -1, bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0, index = (y * w) * 4 + 3; x < w; x++, index += 4) {
        if (data[index] < 8) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = y;
      }
    }
    return {left, top, right, bottom};
  }

  // Octaves at different scales leave winding channels, islands, and a brittle
  // stippled edge. Normalize the arrival times against the actual silhouette.
  function erosionTimes(w, h, data, bounds, scale) {
    const {left, top, right, bottom} = bounds;
    const bw = Math.max(1, right - left), bh = Math.max(1, bottom - top);
    const step = Math.max(2, Math.round(3 * scale));
    const cols = Math.ceil(bw / step) + 2, rows = Math.ceil(bh / step) + 2;
    const coarse = new Float32Array(cols * rows);
    const noise = noiseField();
    for (let j = 0; j < rows; j++) {
      const ny = j * step / bh, y = j * step / scale;
      const bend = .12 * Math.sin(ny * 7 + 1.1) + .075 * Math.sin(ny * 15.4 - .3);
      for (let i = 0; i < cols; i++) {
        const nx = i * step / bw, x = i * step / scale;
        coarse[j * cols + i] = 1 - nx + bend + .115 * (ny - .5)
          + .32 * noise(x / 77 + 40, y / 61 + 12)
          + .23 * noise(x / 29 + 7, y / 33 + 81)
          + .12 * noise(x / 12 + 78, y / 9 + 50)
          + .067 * noise(x / 5 + 24, y / 4 + 4);
      }
    }
    const times = new Uint16Array(w * h);
    const salt = randomSequence(0x346ec19b);
    let min = 65535, max = 0;
    for (let y = top; y <= bottom; y++) {
      const gy = (y - top) / step, row = Math.floor(gy) * cols, fy = gy % 1;
      for (let x = left, index = y * w + left; x <= right; x++, index++) {
        if (!data[index * 4 + 3]) continue;
        const gx = (x - left) / step, i = row + Math.floor(gx), fx = gx % 1;
        const a = coarse[i] + fx * (coarse[i + 1] - coarse[i]);
        const b = coarse[i + cols] + fx * (coarse[i + cols + 1] - coarse[i + cols]);
        const value = Math.round(20000 + 23500 * (a + (b - a) * fy + .025 * (salt() - .5)));
        times[index] = value;
        min = Math.min(min, value); max = Math.max(max, value);
      }
    }
    const multiplier = 65535 * (LAST_RELEASE - .012) / Math.max(1, max - min);
    for (let index = 0; index < times.length; index++) {
      if (times[index]) times[index] = Math.round(65535 * .012 + (times[index] - min) * multiplier);
    }
    return times;
  }

  function fragmentCloud(data, w, bounds, times, scale) {
    const {left, right, top, bottom} = bounds;
    const random = randomSequence(0x628309a1);
    const spacing = Math.max(1.6, 4.75 * scale);
    const grains = [];
    for (let y = top; y <= bottom; y += spacing) {
      for (let x = left; x <= right; x += spacing) {
        const sx = Math.min(right, Math.floor(x + spacing * random()));
        const sy = Math.min(bottom, Math.floor(y + spacing * random()));
        const index = sy * w + sx, offset = index * 4;
        if (data[offset + 3] < 24) continue;

        const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
        const luma = red * .25 + green * .57 + blue * .18;
        const size = (.6 + 1.95 * random() ** 1.4 + (random() < .07 ? 1.2 : 0)) * scale;
        const path = random() * TAU, theta = random() * TAU;
        const wind = Math.sin(sy / (88 * scale) + .9 * Math.cos(sx / (105 * scale)));
        const lift = Math.sin(sy / (57 * scale) + sx / (154 * scale));
        grains.push({
          x:sx, y:sy, start:times[index] / 65535, duration:.18 + .157 * random(),
          // Neighbouring pieces travel in ribbons, with smaller eddies inside each ribbon.
          reach:(82 + 118 * random() + 40 * wind) * scale,
          rise:(-66 - 67 * random() + 62 * lift) * scale,
          eddyX:(7 + 15 * random()) * scale, eddyY:(10 + 23 * random()) * scale,
          path, initialWave:Math.sin(path), curl:4 + 3.4 * random(),
          size, aspect:.54 + .42 * random(), theta, spin:(random() - .5) * 7.5,
          alpha:data[offset + 3] / 255, red, green, blue,
          // As a fragment turns away from the light the reverse is a desaturated
          // version of that same local paper, metal, photograph or ink colour.
          backR:red * .41 + luma * .40 + 14,
          backG:green * .41 + luma * .40 + 13,
          backB:blue * .41 + luma * .40 + 16
        });
      }
    }
    return grains;
  }

  function scatter(data, w, h, grains, time) {
    for (const g of grains) {
      const age = (time - g.start) / g.duration;
      if (age <= 0 || age >= 1) continue;
      const travel = age * (.69 + .31 * age);
      const angle = age * g.curl + g.path;
      const px = g.x + travel * g.reach + age * g.eddyX * Math.cos(angle);
      const py = g.y + travel * g.rise + age * g.eddyY * (Math.sin(angle) - g.initialWave);
      const radius = g.size * (1 - .53 * age);
      if (px < -radius || px > w + radius || py < -radius || py > h + radius) continue;
      const rotation = g.theta + age * g.spin, cs = Math.cos(rotation), sn = Math.sin(rotation);
      const face = Math.cos(g.theta + age * (g.spin + 2));
      const flatten = g.aspect * (.48 + .52 * Math.abs(face));
      const blend = (.5 - .5 * face) * (.2 + .8 * age);
      const r = g.red + (g.backR - g.red) * blend;
      const green = g.green + (g.backG - g.green) * blend;
      const b = g.blue + (g.backB - g.blue) * blend;
      const fade = Math.min(1, age * 31) * Math.min(1, (1 - age) * 2.8) * g.alpha;
      const invA = 1 / (radius + .55), invB = 1 / (radius * flatten + .55);
      const bound = radius + 1;
      const minX = Math.max(0, Math.floor(px - bound)), maxX = Math.min(w - 1, Math.ceil(px + bound));
      const minY = Math.max(0, Math.floor(py - bound)), maxY = Math.min(h - 1, Math.ceil(py + bound));
      for (let y = minY; y <= maxY; y++) {
        const dy = y + .5 - py;
        for (let x = minX; x <= maxX; x++) {
          const dx = x + .5 - px;
          const u = (dx * cs + dy * sn) * invA;
          const v = (-dx * sn + dy * cs) * invB;
          // Taper one end of the shard and antialias the rim.
          const rim = 1 - u * u - v * v * (1.09 + .44 * u);
          if (rim <= 0) continue;
          const alpha = Math.min(1, rim * 2.65) * fade;
          const i = (y * w + x) * 4;
          const base = data[i + 3] / 255 * (1 - alpha), combined = alpha + base;
          data[i] = (r * alpha + data[i] * base) / combined;
          data[i + 1] = (green * alpha + data[i + 1] * base) / combined;
          data[i + 2] = (b * alpha + data[i + 2] * base) / combined;
          data[i + 3] = 255 * combined;
        }
      }
    }
  }

  function create(sourceCanvas) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const source = pixelsCanvas(w, h);
    const sourceCtx = source.getContext('2d', {willReadFrequently:true});
    sourceCtx.drawImage(sourceCanvas, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, w, h).data;
    const bounds = opaqueBounds(pixels, w, h);
    if (bounds.right < bounds.left) return {draw() {}};
    const scale = w / 720;
    const times = erosionTimes(w, h, pixels, bounds, scale);
    const grains = fragmentCloud(pixels, w, bounds, times, scale);
    const layer = pixelsCanvas(w, h);
    const layerCtx = layer.getContext('2d');
    const image = layerCtx.createImageData(w, h), out = image.data;
    const {left, top, right, bottom} = bounds;
    return {
      draw(ctx, progress) {
        if (progress <= 0) {ctx.drawImage(source, 0, 0); return;}
        if (progress >= 1) return;
        if (progress > LAST_RELEASE + DRY_EDGE) {
          out.fill(0);
        } else {
          out.set(pixels);
          const now = progress * 65535, edgeWidth = DRY_EDGE * 65535;
          for (let y = top; y <= bottom; y++) {
            for (let index = y * w + left, end = y * w + right; index <= end; index++) {
              const elapsed = now - times[index];
              if (elapsed <= 0) continue;
              const alpha = index * 4 + 3;
              out[alpha] = elapsed >= edgeWidth ? 0 : pixels[alpha] * (1 - elapsed / edgeWidth);
            }
          }
        }
        scatter(out, w, h, grains, progress);
        layerCtx.putImageData(image, 0, 0);
        ctx.drawImage(layer, 0, 0);
      }
    };
  }

  window.CardDust = Object.freeze({create});
})();
