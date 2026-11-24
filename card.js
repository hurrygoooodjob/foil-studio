/* Silver-chrome collectible face. Coordinates describe the printed card, in logical pixels. */
(() => {
  "use strict";

  const WIDTH = 720;
  const HEIGHT = 1000;
  const FONT = '"Avenir Next", "Helvetica Neue", Arial, "PingFang SC", sans-serif';
  const MONO = '"SFMono-Regular", Menlo, Consolas, monospace';
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function polygon(points) {
    const shape = new Path2D();
    shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point);
    shape.closePath();
    return shape;
  }

  function cutRect(x, y, w, h, cut) {
    return polygon([[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],
      [x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]]);
  }

  const shell = cutRect(3, 3, 714, 994, 29);
  const shellInside = cutRect(11, 11, 698, 977, 24);
  const foil = cutRect(19, 18, 682, 961, 23);
  const aperture = polygon([[64,72],[465,72],[476,63],[640,63],[676,98],[676,717],
    [660,734],[660,862],[643,880],[57,880],[43,866],[43,94]]);
  const well = polygon([[41,850],[676,850],[676,930],[654,951],[58,951],[41,935]]);
  const metalBorder = new Path2D(foil);
  metalBorder.addPath(aperture);
  metalBorder.addPath(cutRect(46, 885, 628, 62, 12));
  const plaque = polygon([[46,757],[256,757],[267,750],[529,750],[564,778],
    [564,846],[540,872],[69,872],[46,851]]);
  const numberPlate = polygon([[574,774],[649,752],[675,752],[675,856],[658,873],
    [556,873],[574,852]]);

  function grad(ctx, x1, y1, x2, y2, stops) {
    const result = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [at, color] of stops) result.addColorStop(at, color);
    return result;
  }

  function paint(ctx, path, fill, line, width = 1) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = width; ctx.stroke(path); }
  }

  function rule(ctx, points, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  }

  function label(ctx, text, x, y, font, ink, tracking = 0) {
    ctx.font = font;
    ctx.fillStyle = ink;
    if (!tracking) { ctx.fillText(text, x, y); return; }
    for (const ch of text) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + tracking;
    }
  }

  function star(ctx, x, y, r, ink) {
    const p = polygon([[x,y-r],[x+r*.19,y-r*.17],[x+r,y],
      [x+r*.19,y+r*.17],[x,y+r],[x-r*.19,y+r*.17],[x-r,y],[x-r*.19,y-r*.17]]);
    paint(ctx, p, ink);
  }

  function drawGuilloche(ctx) {
    ctx.save();
    ctx.clip(metalBorder, "evenodd");
    ctx.lineWidth = .68;
    ctx.strokeStyle = "rgba(43,48,80,.29)";
    ctx.beginPath();
    for (let i = -5; i < 21; i++) {
      for (let x = 0; x <= WIDTH; x += 5) {
        const y = 39 + i*2.5 + 12*Math.sin(x/22 + i*.35) + 10*Math.sin(x/38 - i*.15);
        if (x === 0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.beginPath();
    for (let i = 0; i < 13; i++) {
      ctx.moveTo(5+i*4.6,140);
      ctx.bezierCurveTo(53+i*5.2,300, -21+i*6.7,463,19+i*2.7,698);
      ctx.moveTo(709-i*4.5,248);
      ctx.bezierCurveTo(655-i*3.8,405, 737-i*5.8,563,669-i*2.4,809);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBase(ctx) {
    const edge = grad(ctx,10,0,664,1000,[[0,"#fff"],[.10,"#86939a"],[.22,"#d9f5f4"],
      [.37,"#4b5b69"],[.53,"#d9e0e5"],[.67,"#849396"],[.85,"#f1f5fa"],[1,"#484f67"]]);
    paint(ctx,shell,edge,"#e4e8f0",1.5);
    paint(ctx,shellInside,"#535966","#29323c",2.0);
    const silver = grad(ctx,0,120,690,810,[[0,"#626d84"],[.09,"#ebedf0"],[.19,"#bac6d8"],
      [.31,"#edf5f6"],[.43,"#a0a6b7"],[.51,"#d1cddd"],[.55,"#e1dee7"],[.71,"#838fa4"],
      [.80,"#d7dfe6"],[.90,"#b5b0c5"],[1,"#e6e7ed"]]);
    paint(ctx,foil,silver,"#172930",2);
    ctx.save();
    ctx.clip(foil);
    // Microruling breaks broad reflections into the individual lines of stamped foil.
    ctx.beginPath();
    for (let y = -750; y < HEIGHT+180; y += 5) {
      ctx.moveTo(0,y); ctx.lineTo(WIDTH,y+440);
    }
    ctx.strokeStyle = "rgba(250,254,255,.18)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    drawGuilloche(ctx);
    paint(ctx,aperture,"#171a26","#1b2231",7);
    paint(ctx,aperture,null,"rgba(247,254,255,.89)",2.2);
    paint(ctx,well,grad(ctx,0,843,0,952,[[0,"#343c47"],[.28,"#17212d"],
      [.70,"#263541"],[.96,"#425360"],[1,"#6f7d89"]]),"#eef1f3",1.6);
    ctx.save();
    ctx.clip(well);
    ctx.beginPath();
    for (let x = 43; x < 687; x += 6) {
      const h = x % 4 === 1 ? 9 : 4;
      ctx.moveTo(x,947); ctx.lineTo(x,947-h);
    }
    ctx.strokeStyle="rgba(211,230,238,.4)"; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }

  let baseImage;
  function substrate() {
    if (baseImage) return baseImage;
    baseImage = document.createElement("canvas");
    baseImage.width = WIDTH * 1.5; baseImage.height = HEIGHT * 1.5;
    const layer = baseImage.getContext("2d");
    layer.scale(1.5,1.5);
    drawBase(layer);
    return baseImage;
  }

  function fitPhoto(img, zoom) {
    const iw=img.naturalWidth || img.width, ih=img.naturalHeight || img.height;
    // Overscan keeps the photo behind the inner bevel when the camera tilts.
    const w=663, h=845;
    const scale=Math.max(w/iw,h/ih)*clamp(zoom || 1,1,3);
    return {w,h,dw:iw*scale,dh:ih*scale};
  }

  // All face designs share these exact photo coordinates. Only the window mask changes.
  function drawPhoto(ctx, state) {
    const img = state.image;
    if (img && (img.naturalWidth || img.width)) {
      const {w,h,dw,dh}=fitPhoto(img,state.zoom);
      const px = (clamp(state.panX||0,-1,1)+1)*.5;
      const py = (clamp(state.panY||0,-1,1)+1)*.5;
      const x = 29 - (dw-w)*px - state.tiltX*9;
      const y = 50 - (dh-h)*py - state.tiltY*6;
      ctx.drawImage(img,x,y,dw,dh);
    } else {
      ctx.fillStyle = grad(ctx,0,0,550,900,[[0,"#354559"],[.45,"#21273d"],[1,"#101a2e"]]);
      ctx.fillRect(25,38,674,851);
    }
  }

  function drawImage(ctx, state) {
    ctx.save();
    ctx.clip(aperture);
    drawPhoto(ctx, state);
    // The matte stock carries only edge shading, so uploaded portraits keep their colour.
    ctx.fillStyle = grad(ctx,0,728,0,882,[[0,"rgba(8,13,24,0)"],[1,"rgba(8,13,24,.30)"]]);
    ctx.fillRect(36,728,647,155);
    ctx.fillStyle = grad(ctx,41,0,67,0,[[0,"rgba(1,7,17,.35)"],[1,"rgba(1,7,17,0)"]]);
    ctx.fillRect(39,56,31,828);
    ctx.restore();
  }

  function foilReflection(ctx, state, path, strength) {
    if (strength < .005) return;
    const travel = state.tiltX*345 + state.tiltY*165;
    const focus = 338 + travel;
    const spectrum = grad(ctx,focus-343,207,focus+343,611,[[0,"rgba(73,91,158,0)"],
      [.12,"rgba(100,126,244,.18)"],[.22,"rgba(131,131,254,.49)"],[.32,"rgba(235,134,241,.67)"],
      [.40,"rgba(255,198,181,.65)"],[.47,"rgba(252,250,206,.82)"],[.52,"rgba(207,255,227,.85)"],
      [.60,"rgba(101,236,246,.81)"],[.69,"rgba(105,170,255,.65)"],[.80,"rgba(172,152,245,.55)"],
      [1,"rgba(121,136,223,0)"]]);
    ctx.save(); ctx.clip(path,"evenodd");
    ctx.globalAlpha = strength; ctx.fillStyle=spectrum; ctx.fillRect(0,0,WIDTH,HEIGHT);
    const pos = 355 + travel*1.19;
    ctx.fillStyle=grad(ctx,pos-174,377,pos+174,590,[[0,"rgba(255,255,255,0)"],
      [.40,"rgba(255,255,255,0)"],[.48,"rgba(250,251,255,.25)"],[.51,"rgba(255,255,255,.85)"],
      [.54,"rgba(252,253,255,.09)"],[.69,"rgba(255,255,255,0)"],[1,"rgba(255,255,255,0)"]]);
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.restore();
  }

  function drawEngraving(ctx, serial, state) {
    // Top legend and small optical alignment marks are printed on the front plate.
    paint(ctx,polygon([[42,32],[257,32],[275,48],[260,58],[42,58],[32,48]]),"#242a39");
    star(ctx,55,45,10,"#e7edf1");
    label(ctx,"CHROME EDITION",74,50,'bold 14px '+MONO,"#f6f9fa",1.9);
    rule(ctx,[[281,45],[371,45],[383,34],[466,34]],"#4b4f61",1.8);
    rule(ctx,[[282,49],[373,49],[385,38],[441,38]],"rgba(255,255,255,.9)",1.3);
    label(ctx,"SERIES 01",489,46,'bold 12px '+MONO,"#2c3545",1.0);
    for (let i=0;i<6;i++) {
      rule(ctx,[[601+i*9,49],[611+i*9,34]],i%2?"#414859":"#f8ffff",3);
    }
    // An overlapping glass edge creates foreground occlusion as the print shifts beneath it.
    paint(ctx,aperture,null,"rgba(9,15,28,.90)",3.8);
    rule(ctx,[[44,367],[44,94],[65,73],[219,73]],"#f1fdff",2.1);
    rule(ctx,[[677,509],[677,717],[661,735],[661,840]],"rgba(235,248,255,.87)",1.8);
    ctx.save(); ctx.translate(692,145); ctx.rotate(Math.PI/2);
    label(ctx,"HOLOGRAPHIC COLLECTION",0,0,'bold 10px '+MONO,"#263044",2.2);
    ctx.restore();

    // Silver undercut on a dark, die-cut nameplate. Text stays legible at both extremes.
    paint(ctx,plaque,"#111622","#d8e2ec",3);
    ctx.save();
    ctx.clip(plaque);
    ctx.fillStyle=grad(ctx,54,735,557,906,[[0,"#434c5d"],[.26,"#242c39"],[.60,"#151b27"],[1,"#353b4b"]]);
    ctx.fillRect(42,745,534,134);
    rule(ctx,[[45,765],[252,765],[263,758],[525,758],[550,779]],"rgba(236,246,252,.59)",1.3);
    ctx.restore();
    label(ctx,"COLLECTOR SERIES",70,786,'600 13px '+MONO,"#c2cada",2.6);
    const name = (String(state.name || "").trim() || "ASTRA").slice(0,70);
    ctx.save();
    ctx.translate(69,850);
    ctx.font = 'italic 900 78px '+FONT;
    const fit = Math.min(1,464/Math.max(1,ctx.measureText(name).width));
    ctx.scale(fit,1);
    const sheen = clamp(.51 + state.tiltX*.23 + state.tiltY*.09,.17,.83);
    ctx.fillStyle = grad(ctx,0,-62,0,3,[[0,"#fff"],[sheen-.12,"#e4f1f7"],[sheen,"#fff"],
      [sheen+.06,"#c6cfdf"],[1,"#aabacd"]]);
    ctx.fillText(name,0,0);
    ctx.restore();
    paint(ctx,numberPlate,grad(ctx,558,760,679,866,[[0,"#faf9f5"],[.4,"#e5e9ed"],[.56,"#d4cde3"],[1,"#a3b6cc"]]),"#323b4b",2);
    foilReflection(ctx,state,numberPlate,state.light*.67);
    label(ctx,"NO.",588,806,'bold 15px '+MONO,"#232b38",1);
    ctx.save();
    ctx.translate(585,845); ctx.font='italic 900 43px '+FONT;
    ctx.scale(Math.min(1,73/Math.max(1,ctx.measureText(serial).width)),1);
    ctx.fillStyle="#131f30"; ctx.fillText(serial,0,0); ctx.restore();
    // Short machine-readable foil stamp, contained inside the bottom aluminium rim.
    const pattern=[2,1,5,2,3,1,1,4,2,4,1,2,3,2,1,4,2,3,2,1];
    ctx.fillStyle="#343e51"; let bx=56;
    for (const width of pattern) { ctx.fillRect(bx,957,width,11); bx += width+2; }
    label(ctx,"SILVER CHROME",180,967,'600 11px '+MONO,"#263544",2);
    rule(ctx,[[347,963],[530,963],[538,956],[618,956]],"#555b68",1.3);
    star(ctx,645,963,8,"#273744");
    star(ctx,662,963,4,"#424e61");
  }

  function drawGlass(ctx, state) {
    const tx=state.tiltX, ty=state.tiltY;
    paint(ctx,shellInside,null,"rgba(232,249,255,.66)",1.25);
    const ridge=grad(ctx,0,0,720,1000,[[0,"#fff"],[.29,"#c1f9fc"],[.6,"#7d858e"],[1,"#eef5ff"]]);
    rule(ctx,[[9,248],[9,37],[37,9],[241,9]],ridge,2.8);
    rule(ctx,[[711,778],[711,958],[685,985],[478,985]],ridge,2.4);
    for (const [x,y,dx,dy] of [[27,29,1,1],[691,29,-1,1],[27,967,1,-1],[691,967,-1,-1]]) {
      rule(ctx,[[x,y+dy*13],[x+dx*12,y],[x+dx*25,y]],"rgba(236,251,255,.84)",1.8);
    }
    // Front cover flashes can cross the image only at the grazing angles.
    ctx.save();
    ctx.clip(foil);
    const amount=state.light*(.02+.15*Math.max(0,Math.abs(tx)*.8+Math.abs(ty)*.55-.25));
    const loc=160+tx*570+ty*140;
    ctx.fillStyle=grad(ctx,loc-82,260,loc+45,320,[[0,"rgba(255,255,255,0)"],
      [.47,'rgba(244,251,255,'+amount+')'],[.51,'rgba(255,255,255,'+amount*1.16+')'],[1,"rgba(255,255,255,0)"]]);
    ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.restore();
  }

  function draw(ctx, state, drawParticles) {
    ctx.save();
    ctx.drawImage(substrate(),0,0,WIDTH,HEIGHT);
    drawImage(ctx,state);
    foilReflection(ctx,state,metalBorder,clamp(state.light || 0,0,1));
    if (typeof drawParticles === "function") {
      ctx.save();
      ctx.clip(foil);
      drawParticles(ctx);
      ctx.restore();
    }
    const serial = String(state.serial || "001").trim().slice(0,20) || "001";
    drawEngraving(ctx,serial,state);
    drawGlass(ctx,state);
    ctx.restore();
  }

  window.ChromeCard=Object.freeze({width:WIDTH,height:HEIGHT,fitPhoto,drawPhoto,draw,geometry:()=>({shell,aperture})});
})();
