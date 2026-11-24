/* Loose stamped-foil stars in the sleeve. All lengths use the 720 × 1000 card face. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const perimeter = Array.from({length: 10}, (_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 ? 0.46 : 1;
    return {x: radius * Math.cos(angle), y: radius * Math.sin(angle)};
  });

  // A slightly embossed centre gives each spoke its own specular normal.
  const normals = perimeter.map((a, i) => {
    const b = perimeter[(i + 1) % 10];
    const nx = 0.24 * (b.y - a.y);
    const ny = 0.24 * (a.x - b.x);
    const nz = a.x * b.y - a.y * b.x;
    const length = Math.hypot(nx, ny, nz);
    return [nx / length, ny / length, nz / length];
  });

  function generator(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function makeFlake(index, random) {
    const depth = random();
    const radius = index % 5 === 4 ? 6 + 4 * random() : 13 + 10 * depth;
    const slot = index % 5;
    const side = slot === 0 || slot === 2;
    let x;
    let y;
    if (side) {
      x = slot === 0 ? 54 + 38 * random() : 632 + 36 * random();
      y = 170 + 580 * ((0.23 + Math.floor(index / 5) * 0.382 + random() * 0.13 + slot * 0.19) % 1);
    } else {
      // Low-discrepancy positions keep a few large pieces readable even at low densities.
      x = 56 + 608 * ((index * 0.618 + 0.03 + random() * 0.035) % 1);
      y = 900 + random() * 28;
    }
    return {
      x, y, vx: 0, vy: 0, depth, radius,
      angle: random() * TAU, roll: index % 3 === 0 ? 0.1 : (random() - 0.48) * 2.2,
      pitch: (random() - 0.5) * 0.8, spin: 0, tumble: 0,
      handedness: random() < 0.5 ? -1 : 1,
      tint: [204, 260, 316, 198, 234][index % 5],
      mobility: 0.76 + depth * 0.53
    };
  }

  function pushOut(flake, nx, ny, penetration) {
    flake.x += nx * penetration;
    flake.y += ny * penetration;
    const speed = flake.vx * nx + flake.vy * ny;
    if (speed >= 0) return;
    const impulse = -speed * 1.32;
    flake.vx += impulse * nx;
    flake.vy += impulse * ny;
    if (impulse > 25) flake.tumble += flake.handedness * Math.min(2.4, impulse * 0.01);
  }

  function confine(flake) {
    const padding = 0.7 * flake.radius;
    if (flake.x < 31 + padding) pushOut(flake, 1, 0, 31 + padding - flake.x);
    if (flake.x > 687 - padding) pushOut(flake, -1, 0, flake.x - 687 + padding);
    if (flake.y < 41 + padding) pushOut(flake, 0, 1, 41 + padding - flake.y);
    if (flake.y > 947 - padding) pushOut(flake, 0, -1, flake.y - 947 + padding);

    // The clear recess around the portrait forms one continuous rounded channel.
    const cx = clamp(flake.x, 219, 502);
    const cy = clamp(flake.y, 112, 601);
    const dx = flake.x - cx;
    const dy = flake.y - cy;
    const distance = Math.hypot(dx, dy);
    const recess = 94 + padding;
    if (distance > 0 && distance < recess) {
      pushOut(flake, dx / distance, dy / distance, recess - distance);
    }
  }

  function separate(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const spacing = (a.radius + b.radius) * 0.65;
    if (Math.abs(dx) >= spacing || Math.abs(dy) >= spacing) return;
    const distance = Math.hypot(dx, dy);
    if (distance >= spacing) return;
    const nx = distance ? dx / distance : 1;
    const ny = distance ? dy / distance : 0;
    const correction = (spacing - distance) * 0.5;
    a.x -= nx * correction;
    a.y -= ny * correction;
    b.x += nx * correction;
    b.y += ny * correction;
    const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (speed >= 0) return;
    const impulse = -0.58 * speed;
    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
  }

  function polygon(ctx, vertices) {
    ctx.beginPath();
    ctx.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i][0], vertices[i][1]);
    ctx.closePath();
  }

  function particleBasis(f, tiltX, tiltY) {
    const yaw = f.roll + tiltX * 0.42;
    const pitch = f.pitch + tiltY * 0.32;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    // Three axes of the thin metal stamping after rotation. The last row is camera depth.
    const xx = ca * c - sa * sp * s, xy = -sa * cp, xz = ca * s + sa * sp * c;
    const yx = sa * c + ca * sp * s, yy = ca * cp, yz = sa * s - ca * sp * c;
    const zx = -cp * s, zy = sp, zz = cp * c;
    const side = zz >= 0 ? 1 : -1;
    const r = f.radius;
    const x = f.x + tiltX * (f.depth - 0.3) * 9;
    const y = f.y + tiltY * (f.depth - 0.3) * 9;
    return {xx, xy, xz, yx, yy, yz, zx, zy, zz, side, r, x, y};
  }

  function drawFlake(ctx, f, tiltX, tiltY) {
    const {xx, xy, xz, yx, yy, yz, zx, zy, zz, side, r, x, y} = particleBasis(f, tiltX, tiltY);
    const halfThickness = r * 0.065;
    const top = [];
    const back = [];
    for (const vertex of perimeter) {
      const px = x + r * (xx * vertex.x + xy * vertex.y);
      const py = y + r * (yx * vertex.x + yy * vertex.y);
      top.push([px + xz * halfThickness * side, py + yz * halfThickness * side]);
      back.push([px - xz * halfThickness * side, py - yz * halfThickness * side]);
    }

    ctx.save();
    ctx.translate(1.1 + f.depth * 1.4, 2.2 + f.depth * 2.3);
    polygon(ctx, top);
    ctx.fillStyle = 'rgba(9,13,33,0.43)';
    ctx.fill();
    ctx.restore();

    // The rim joins the two sheets and stays visible as a line at a grazing angle.
    for (let i = 0; i < 10; i++) {
      const j = (i + 1) % 10;
      polygon(ctx, [back[i], back[j], top[j], top[i]]);
      ctx.fillStyle = i % 2 ? '#a9b6d2' : '#596c8f';
      ctx.fill();
    }

    polygon(ctx, top);
    ctx.fillStyle = side > 0 ? '#b9c4d4' : '#8b95ad';
    ctx.fill();

    const peakX = x + xz * (halfThickness + r * 0.24) * side;
    const peakY = y + yz * (halfThickness + r * 0.24) * side;
    const lightX = -0.37 - tiltX * 0.23;
    const lightY = -0.47 - tiltY * 0.2;
    const lightZ = 0.81;
    let brightest = 0;
    let brightPoint = top[0];
    for (let i = 0; i < 10; i++) {
      const n = normals[i];
      const nzLocal = n[2] * side;
      const nx = xx * n[0] + xy * n[1] + xz * nzLocal;
      const ny = yx * n[0] + yy * n[1] + yz * nzLocal;
      const nz = zx * n[0] + zy * n[1] + zz * nzLocal;
      const diffuse = Math.max(0, nx * lightX + ny * lightY + nz * lightZ);
      const specular = Math.pow(clamp(nx * lightX * 0.6 + ny * lightY * 0.6 + nz * 0.93, 0, 1), 19);
      const lightness = clamp((side > 0 ? 48 : 39) + diffuse * 40 + specular * 26, 35, 99);
      const tint = f.tint + 42 * nx - 24 * ny;
      const saturation = (side > 0 ? 26 : 19) + 22 * (1 - diffuse);
      const j = (i + 1) % 10;
      polygon(ctx, [[peakX, peakY], top[i], top[j]]);
      ctx.fillStyle = 'hsl(' + tint + ' ' + saturation + '% ' + lightness + '%)';
      ctx.fill();
      if (specular > brightest) {
        brightest = specular;
        brightPoint = top[i % 2 === 0 ? i : j];
      }
    }
    polygon(ctx, top);
    ctx.strokeStyle = 'rgba(229,239,255,' + (0.28 + 0.35 * (1 - Math.abs(zz))) + ')';
    ctx.lineWidth = 0.95;
    ctx.stroke();

    if (brightest > 0.70 && f.radius > 16) {
      ctx.save();
      ctx.translate(brightPoint[0], brightPoint[1]);
      const length = 2.2 + (brightest - 0.70) * 15;
      polygon(ctx, [[0, -length], [0.8, -0.7], [length * 0.7, 0], [0.7, 0.8], [0, length], [-0.7, 0.8], [-length * 0.7, 0], [-0.7, -0.7]]);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.restore();
    }
  }

  const paperCuts = [
    [[-.70,-.92],[.73,-.72],[.52,1],[-.75,.76]],
    [[.08,-1],[.32,-.32],[.94,-.04],[.28,.24],[-.06,1],[-.29,.32],[-1,.08],[-.31,-.23]],
    [[-.62,-.98],[.72,-.98],[.16,-.15],[.77,-.12],[-.61,1],[.01,.19],[-.65,.21]]
  ];
  const candyHues = [326,72,183,23,275];
  const beadHues = [201,309,182,249,342];
  const sequinRim = Array.from({length:12}, (_,i) => {
    const a=i*TAU/12;
    return [Math.cos(a),Math.sin(a)];
  });
  const motion = {
    chrome: {travel:1, tumble:1, friction:1, delay:1},
    collage:{travel:1.12, tumble:1.24, friction:.93, delay:.85},
    denim:  {travel:.86, tumble:.81, friction:1.09, delay:1.2}
  };

  // Extrude an actual edge so paper and drilled sequins remain visible edge-on.
  function chipSides(ctx, outline, b, thickness, ink) {
    const dx=b.xz*thickness*b.side, dy=b.yz*thickness*b.side;
    const top=[],back=[];
    for (const [u,v] of outline) {
      const x=b.x+b.r*(u*b.xx+v*b.xy),y=b.y+b.r*(u*b.yx+v*b.yy);
      top.push([x+dx,y+dy]);back.push([x-dx,y-dy]);
    }
    ctx.fillStyle=ink;
    for(let i=0;i<top.length;i++){
      const j=(i+1)%top.length;
      polygon(ctx,[back[i],back[j],top[j],top[i]]);ctx.fill();
    }
    ctx.translate(b.x+dx,b.y+dy);
    ctx.transform(b.r*b.xx,b.r*b.yx,b.r*b.xy,b.r*b.yy,0,0);
  }

  function drawPaper(ctx,f,tx,ty) {
    const b=particleBasis(f,tx,ty),index=Math.max(0,[204,260,316,198,234].indexOf(f.tint));
    const hue=candyHues[index],shape=paperCuts[index%paperCuts.length];
    ctx.save();
    chipSides(ctx,shape,b,b.r*.027,'hsl('+hue+' 64% 27%)');
    polygon(ctx,shape);
    const front=b.side>0,lit=Math.abs(b.zz);
    const fold=ctx.createLinearGradient(-.7,-.7,.8,.7);
    fold.addColorStop(0,'hsl('+hue+' 96% '+(front?67:43)+'%)');
    fold.addColorStop(.55,'hsl('+(hue+10)+' 100% '+((front?53:37)+14*lit)+'%)');
    fold.addColorStop(.57,'hsl('+(hue+22)+' 95% '+(front?80:65)+'%)');
    fold.addColorStop(1,'hsl('+hue+' 88% '+(front?60:45)+'%)');
    ctx.fillStyle=fold;ctx.fill();ctx.clip();
    ctx.strokeStyle='rgba(255,255,249,'+(.20+.45*lit)+')';ctx.lineWidth=.09;
    ctx.beginPath();ctx.moveTo(-.72,-.83);ctx.lineTo(.52,-.62);ctx.stroke();
    ctx.restore();
  }

  function drawSequin(ctx,f,tx,ty) {
    const b=particleBasis(f,tx,ty),index=Math.max(0,[204,260,316,198,234].indexOf(f.tint));
    const hue=beadHues[index],inner=.19;
    ctx.save();
    chipSides(ctx,sequinRim,b,b.r*.14,'hsla('+hue+' 54% 34% / .8)');
    // The central bore is open to the denim or photograph below it.
    const ring=new Path2D();
    ring.moveTo(1,0);for(const [x,y] of sequinRim.slice(1))ring.lineTo(x,y);
    ring.closePath();ring.moveTo(inner,0);ring.arc(0,0,inner,0,TAU);ring.closePath();
    const pearl=ctx.createLinearGradient(-.83,-.8,.82,.83);
    pearl.addColorStop(0,'hsla('+hue+' 86% 97% / .94)');
    pearl.addColorStop(.27,'hsla('+(hue+18)+' 83% 82% / .84)');
    pearl.addColorStop(.64,'hsla('+hue+' 59% '+(b.side>0?66:53)+'% / .72)');
    pearl.addColorStop(1,'hsla('+(hue-25)+' 80% 91% / .92)');
    ctx.fillStyle=pearl;ctx.fill(ring,'evenodd');
    for(let n=0;n<sequinRim.length;n++){
      const a=sequinRim[n],c=sequinRim[(n+1)%sequinRim.length];
      const shine=Math.max(0,-.45*(b.xx*a[0]+b.xy*a[1])-.55*(b.yx*a[0]+b.yy*a[1])+.22*b.zz);
      polygon(ctx,[a,c,[c[0]*.73,c[1]*.73],[a[0]*.73,a[1]*.73]]);
      ctx.fillStyle='rgba(250,253,255,'+(.06+.72*shine)+')';ctx.fill();
    }
    ctx.beginPath();ctx.arc(0,0,inner+.025,0,TAU);
    ctx.lineWidth=.07;ctx.strokeStyle='rgba(39,56,96,.56)';ctx.stroke();
    ctx.beginPath();ctx.arc(-.12,-.08,.55,3.65,4.94);
    ctx.lineWidth=.075;ctx.strokeStyle='rgba(255,255,255,.86)';ctx.stroke();
    ctx.restore();
  }

  const drawParticle = {chrome:drawFlake,collage:drawPaper,denim:drawSequin};

  class StarChamber {
    static motion(frame) { return motion[frame] || motion.chrome; }

    constructor() {
      this.flakes = [];
      this.random = generator(240811);
      this.active = false;
      this.timeMoving = 0;
      this.tiltX = 0;
      this.tiltY = 0;
      this.setCount(18);
    }

    setCount(value) {
      const count = clamp(Math.round(Number(value) || 0), 0, 70);
      while (this.flakes.length < count) this.flakes.push(makeFlake(this.flakes.length, this.random));
      this.flakes.length = count;
      if (count === 0) {
        this.active = false;
        this.timeMoving = 0;
      }
      this.order = this.flakes.slice().sort((a, b) => a.depth - b.depth);
    }

    shake(strength = 1) {
      const power = clamp(Number(strength) || 1, 0.2, 2);
      this.timeMoving = 4;
      this.active = this.flakes.length > 0;
      for (const f of this.flakes) {
        f.vx += (this.random() - 0.5) * 1050 * power;
        f.vy -= (465 + this.random() * 580) * power;
        f.spin += (this.random() - 0.5) * 11 * power;
        f.tumble += f.handedness * (10 + this.random() * 9) * power;
      }
    }

    step(dt, tiltX = 0, tiltY = 0, frame = 'chrome') {
      const material=StarChamber.motion(frame);
      if (!Number.isFinite(dt) || dt <= 0) return this.active;
      dt = Math.min(dt, 0.075);
      const tx = clamp(Number(tiltX) || 0, -1, 1);
      const ty = clamp(Number(tiltY) || 0, -1, 1);
      const dx = tx - this.tiltX, dy = ty - this.tiltY;
      this.tiltX = tx;
      this.tiltY = ty;
      // Static friction takes over once the tilt is held in place.
      if (Math.abs(dx) + Math.abs(dy) > 0.0003) this.timeMoving = 3.2;
      this.timeMoving = Math.max(0, this.timeMoving - dt);
      if (!this.flakes.length || (!this.timeMoving && !this.active)) return false;
      for (const f of this.flakes) {
        f.vx += dx * 115 * f.mobility;
        f.vy += dy * 105 * f.mobility - Math.min(0.20, Math.hypot(dx, dy)) * 55;
        f.tumble += (dx + dy * 0.47) * 4.4 * f.handedness;
      }
      const steps = Math.ceil(dt * 100);
      const h = dt / steps;
      const drag = Math.exp(-2.48 * h * material.friction);
      const spinDrag = Math.exp(-2.55 * h);
      const flow = Math.min(this.timeMoving, 1);
      const down = 48 * flow;
      let fastest = 0;
      for (let i = 0; i < steps; i++) {
        for (const f of this.flakes) {
          f.vx = (f.vx + tx * 1070 * material.travel * f.mobility * flow * h) * drag;
          f.vy = (f.vy + (ty * 920 * material.travel * f.mobility * flow + down) * h) * drag;
          f.x += f.vx * h;
          f.y += f.vy * h;
          const travel = Math.hypot(f.vx, f.vy);
          f.tumble = f.tumble * spinDrag + f.handedness * travel * 0.033 * material.tumble * h;
          f.spin = f.spin * spinDrag + f.handedness * (f.vx - 0.32 * f.vy) * 0.014 * h;
          f.roll = (f.roll + f.tumble * h) % TAU;
          f.angle = (f.angle + f.spin * h) % TAU;
          confine(f);
        }
        for (let a = 0; a < this.flakes.length; a++) {
          for (let b = a + 1; b < this.flakes.length; b++) separate(this.flakes[a], this.flakes[b]);
        }
        for (const f of this.flakes) {
          confine(f);
          fastest = Math.max(fastest, Math.abs(f.vx), Math.abs(f.vy), 13 * Math.abs(f.tumble), 13 * Math.abs(f.spin));
        }
      }
      this.active = this.timeMoving > 0 || fastest > 0.35;
      return this.active;
    }

    draw(ctx, tiltX = this.tiltX, tiltY = this.tiltY, frame = 'chrome') {
      const render=drawParticle[frame] || drawFlake;
      ctx.save();
      for (const f of this.order) render(ctx, f, tiltX, tiltY);
      ctx.restore();
    }
  }

  window.StarChamber = StarChamber;
})();
