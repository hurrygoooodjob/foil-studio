/* Indigo twill photocard sleeve. The fabric and embroidery are printed once;
   only the photo, loose particles, lettering, and polished hardware redraw. */
(() => {
  'use strict';

  const W = 720, H = 1000;
  const SANS = '"Avenir Next", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
  const SERIF = 'Georgia, "Songti SC", "STSong", serif';
  const MONO = '"SFMono-Regular", Menlo, Consolas, monospace';
  const TAU = 2 * Math.PI;

  function rounded(x, y, width, height, radius) {
    const p = new Path2D();
    p.roundRect(x, y, width, height, radius);
    return p;
  }

  const body = rounded(7, 6, 706, 987, 44);
  const topFabric = rounded(13, 11, 694, 972, 40);
  const perimeterSeam = rounded(27, 25, 666, 943, 31);

  // A soft arch above the portrait and rounded lower corners leave room
  // for the fan patches while using precisely the studio's photo transform.
  function windowPath(inset) {
    const p = new Path2D();
    const l = 83 + inset, r = 637 - inset, t = 112 + inset, b = 838 - inset;
    p.moveTo(l, t + 156);
    p.bezierCurveTo(l, t + 48, l + 74, t, l + 168, t);
    p.lineTo(r - 168, t);
    p.bezierCurveTo(r - 71, t, r, t + 50, r, t + 156);
    p.lineTo(r, b - 78);
    p.bezierCurveTo(r, b - 31, r - 29, b, r - 83, b);
    p.lineTo(l + 83, b);
    p.bezierCurveTo(l + 31, b, l, b - 28, l, b - 78);
    p.closePath();
    return p;
  }
  const windowCut = windowPath(0);

  function linear(ctx, x1, y1, x2, y2, stops) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    return g;
  }

  function trace(ctx, path, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(path);
  }

  function stitches(ctx, path, width, dash, color) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.setLineDash(dash);
    trace(ctx, path, '#132c52', width + 2.4);
    ctx.translate(-.45, -.8);
    trace(ctx, path, color, width);
    ctx.restore();
  }

  function seededRandom() {
    let seed = 6251;
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function denimPattern(ctx) {
    const tile = document.createElement('canvas'); tile.width = tile.height = 192;
    const t = tile.getContext('2d'), im = t.createImageData(192, 192);
    const random = seededRandom();
    const yarn = Array.from({length:64}, () => random() * 18 - 9);
    for (let y = 0; y < 192; y++) {
      for (let x = 0; x < 192; x++) {
        const col = Math.floor(x / 3), row = Math.floor(y / 3);
        // Indigo warp floats over two cream weft picks, then passes underneath.
        const weft = (col + row) % 3 === 0;
        const ridge = weft ? (y % 3 === 1 ? 22 : 0) : (x % 3 === 1 ? 14 : -5);
        const shade = yarn[weft ? row : col] + (weft ? 22 : -7) + ridge + (random()-.5)*27;
        const i = (y * 192 + x) * 4;
        im.data[i] = 37 + shade; im.data[i+1] = 79 + shade; im.data[i+2] = 133 + shade;
        im.data[i+3] = 255;
      }
    }
    t.putImageData(im, 0, 0);
    t.lineCap = 'round';
    for (let i=0; i<250; i++) {
      const x=random()*192, y=random()*192, length=random()*9+1;
      t.strokeStyle=i%6===0?'rgba(247,245,212,.40)':'rgba(160,199,221,.24)';
      t.lineWidth=.4+random()*.9;
      t.beginPath(); t.moveTo(x,y); t.lineTo(x+length*.7,y-length); t.stroke();
    }
    return ctx.createPattern(tile, 'repeat');
  }

  function paintBacking(ctx) {
    ctx.fillStyle='#152947';ctx.fill(body);
    trace(ctx,body,'#a7bfd4',1.3);
    ctx.save();ctx.clip(topFabric);
    ctx.fillStyle=denimPattern(ctx);ctx.fillRect(0,0,W,H);
    const wash=ctx.createRadialGradient(182,48,12,200,62,760);
    wash.addColorStop(0,'rgba(202,228,243,.53)'); wash.addColorStop(.5,'rgba(131,180,215,.14)');
    wash.addColorStop(1,'rgba(31,54,101,.08)');ctx.fillStyle=wash;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(193,219,233,.21)';ctx.lineWidth=6;ctx.stroke(topFabric);
    ctx.restore();
    stitches(ctx,perimeterSeam,1.65,[6,4.5],'#dfd1b2');
    ctx.save();ctx.lineCap='round';
    trace(ctx, windowCut, 'rgba(14,36,62,.62)',20);
    trace(ctx, windowCut, '#617d99',12);
    trace(ctx, windowCut, '#bbc3c2',7);
    trace(ctx, windowCut, '#1e344c',3.7);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(249,238,207,.80)';ctx.setLineDash([.7,4.6,1.2,3.9]); ctx.stroke(windowPath(-4));
    ctx.restore();
    stitches(ctx, windowPath(-12), 2.6, [7.3,5.5], '#f5d69b');
    stitches(ctx, windowPath(-20), 1.55, [7.3,5.5], '#e0bc87');
    // A deep indigo binding on the bottom edge catches the light like real piping.
    const hem=new Path2D();hem.moveTo(35,951);hem.quadraticCurveTo(311,980,664,940);
    trace(ctx,hem,'#1a3458',4);
    stitches(ctx,hem,1.6,[6,5],'#d8be90');
  }

  function puffyStar(x,y,r,rotation) {
    const points=[];
    for(let i=0;i<10;i++) {
      const angle=rotation+i*Math.PI/5-Math.PI/2, size=i%2 ? r*.49 : r;
      points.push([x+Math.cos(angle)*size,y+Math.sin(angle)*size]);
    }
    const p=new Path2D();
    const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
    p.moveTo(...mid(points[9],points[0]));
    for(let i=0;i<10;i++) p.quadraticCurveTo(...points[i],...mid(points[i],points[(i+1)%10]));
    p.closePath();return p;
  }
  function heart(x,y,size){
    const p=new Path2D(), s=size;
    p.moveTo(x,y+s*.70);
    p.bezierCurveTo(x-s*.14,y+s*.58,x-s*.90,y+s*.12,x-s*.80,y-s*.34);
    p.bezierCurveTo(x-s*.71,y-s*.76,x-s*.19,y-s*.83,x,y-s*.47);
    p.bezierCurveTo(x+s*.32,y-s*.85,x+s*.86,y-s*.64,x+s*.84,y-s*.19);
    p.bezierCurveTo(x+s*.83,y+s*.12,x+s*.36,y+s*.56,x,y+s*.70);
    p.closePath(); return p;
  }

  function enamel(ctx, shape, fill) {
    ctx.save();
    ctx.lineJoin='round';ctx.translate(1,5);
    trace(ctx,shape,'rgba(12,32,58,.79)',12);
    ctx.translate(-1,-5);
    trace(ctx,shape,'#56708d',11);trace(ctx,shape,'#fff4e5',7);
    ctx.fillStyle=fill;ctx.fill(shape);ctx.restore();
  }

  function ribbon(ctx){
    ctx.save();ctx.translate(565,106);ctx.rotate(.095);
    const tail=new Path2D('M-120 10L-145 23L-133 31L-146 43L-108 39L-65 28Z');
    ctx.fillStyle='#ef99a9';ctx.fill(tail);trace(ctx,tail,'#344d69',3);
    const band=rounded(-117,-24,236,52,7);
    ctx.shadowColor='rgba(7,29,55,.42)';ctx.shadowOffsetY=3;ctx.shadowBlur=3;
    ctx.fillStyle='#d9e8a9';ctx.fill(band);ctx.shadowColor='transparent';
    trace(ctx,band,'#516b68',2.3);
    ctx.save();ctx.lineWidth=1.35;ctx.strokeStyle='#7e9470';ctx.setLineDash([4,3]);
    ctx.stroke(rounded(-110,-18,222,40,4));ctx.restore();
    ctx.font='italic bold 28px '+SERIF;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#284c47';
    ctx.fillText('Fan Club',0,2);
    ctx.restore();
  }

  function namePatch(ctx) {
    const plate=rounded(-216,-50,432,100,35);
    ctx.shadowColor='rgba(16,35,62,.64)';ctx.shadowBlur=6;ctx.shadowOffsetY=4;
    ctx.fillStyle='#d9bbc2';ctx.fill(plate);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    trace(ctx,plate,'#344660',6);trace(ctx,plate,'#e7e0ca',3);
    ctx.save();ctx.clip(plate);
    ctx.fillStyle=linear(ctx,0,-50,0,49,[[0,'#fff3dc'],[.62,'#f8e0d5'],[1,'#ebcec7']]);ctx.fillRect(-218,-51,436,103);
    ctx.lineWidth=.8;ctx.strokeStyle='rgba(149,89,111,.20)';ctx.beginPath();
    for(let i=-269;i<269;i+=3.5){ctx.moveTo(i,-52);ctx.lineTo(i+45,52);}
    ctx.stroke();ctx.restore();
    stitches(ctx,rounded(-207,-42,414,84,28),1.7,[5,3.7],'#d4859e');
  }

  function brushedButton(ctx,x,y,r){
    const rim=ctx.createLinearGradient(x-r,y-r,x+r,y+r);
    [[0,'#273f56'],[.14,'#e4f1fb'],[.24,'#fffdf2'],[.43,'#93aabb'],[.65,'#4b6278'],[.82,'#d2dfe4'],[1,'#758b9e']].forEach(([a,b])=>rim.addColorStop(a,b));
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=rim;ctx.fill();ctx.lineWidth=1.7;ctx.strokeStyle='#2c425b';ctx.stroke();
  }

  const metalHole={x:328,y:56,r:18};
  function hardware(ctx){
    const {x,y,r}=metalHole;
    brushedButton(ctx,x,y,r);
    ctx.beginPath();ctx.arc(x,y,r*.65,0,TAU);ctx.fillStyle='#18283a';ctx.fill();
    ctx.lineWidth=1.7;ctx.strokeStyle='#c5d5de';ctx.stroke();
    // Short loop of nickel ball-chain resting on the cloth.
    const chain=[];
    for(let i=0;i<=38;i++){
      const t=i/38;
      chain.push([x-2 - 117*Math.sin(t*Math.PI*.97), y-2-16*Math.sin(t*TAU) -11*Math.sin(t*Math.PI)]);
    }
    ctx.beginPath();ctx.moveTo(...chain[0]);for(const point of chain.slice(1))ctx.lineTo(...point);
    ctx.strokeStyle='#3f5063';ctx.lineWidth=2;ctx.stroke();
    let distance=0;
    for(let i=1;i<chain.length;i++){
      const a=chain[i-1],b=chain[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let k=6.6-distance;k<=length;k+=6.6){
        const bx=a[0]+(b[0]-a[0])*k/length,by=a[1]+(b[1]-a[1])*k/length;
        ctx.beginPath();ctx.arc(bx+.6,by+1.4,3,0,TAU);ctx.fillStyle='#334554';ctx.fill();
        const g=ctx.createRadialGradient(bx-1.2,by-1.3,.1,bx,by,3.1);
        g.addColorStop(0,'#fffced');g.addColorStop(.36,'#d7deda');g.addColorStop(.68,'#96a7af');g.addColorStop(1,'#4f6775');
        ctx.beginPath();ctx.arc(bx,by,3,0,TAU);ctx.fillStyle=g;ctx.fill();
      }
      distance=(distance+length)%6.6;
    }
  }

  const bigStar=puffyStar(81,184,56,-.13);
  const heartBadge=heart(605,809,75);
  function faceDetails(ctx) {
    hardware(ctx);ribbon(ctx);
    enamel(ctx,bigStar,linear(ctx,47,146,98,216,[[0,'#fffbd1'],[.48,'#ffe895'],[.81,'#ffc4ad'],[1,'#e7a3a7']]));
    ctx.save();ctx.translate(80,185);ctx.rotate(-.13);
    ctx.beginPath();ctx.moveTo(-8,-8);ctx.quadraticCurveTo(-5,-13,-1,-8);ctx.moveTo(5,-8);ctx.quadraticCurveTo(9,-13,12,-8);
    ctx.moveTo(-6,3);ctx.quadraticCurveTo(2,12,10,1);ctx.lineWidth=2.8;ctx.strokeStyle='#84675c';ctx.lineCap='round';ctx.stroke();ctx.restore();
    enamel(ctx,heartBadge,linear(ctx,563,756,638,859,[[0,'#fff5ed'],[.24,'#ffc6cb'],[.55,'#f5a2c0'],[.84,'#da7aa1'],[1,'#bf719f']]));
    ctx.save();ctx.translate(604,801);ctx.rotate(-.10);
    ctx.lineJoin='round';const spark=puffyStar(0,0,23,.06);
    trace(ctx,spark,'#b35a88',4.5);ctx.fillStyle='#fff0b9';ctx.fill(spark);ctx.restore();
    // A small side tag is caught into the binding rather than printed on the photo.
    ctx.save();ctx.translate(661,489);ctx.rotate(Math.PI/2);
    const tab=rounded(-44,-13,88,26,3);
    ctx.fillStyle='#eee0c4';ctx.fill(tab);trace(ctx,tab,'#324867',2);
    ctx.font='bold 12px '+MONO;ctx.fillStyle='#35547b';ctx.textAlign='center';ctx.fillText('DENIM',0,4);
    ctx.restore();
    ctx.save();ctx.translate(268,829);ctx.rotate(-.056);namePatch(ctx);ctx.restore();
  }

  let backing, front;
  function cachedLayer(draw) {
    const canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    draw(canvas.getContext('2d'));return canvas;
  }

  function letterPatch(ctx,state) {
    const name=(String(state.name || '').trim()||'ASTRA').slice(0,70);
    ctx.save();ctx.translate(268,829);ctx.rotate(-.056);
    ctx.font='italic bold 73px '+SERIF;ctx.textAlign='center';ctx.textBaseline='middle';
    const fit=Math.min(1,360/Math.max(1,ctx.measureText(name).width));
    ctx.scale(fit,1);ctx.lineJoin='round';ctx.lineWidth=5.5;ctx.strokeStyle='#fffae8';ctx.strokeText(name,0,7);
    ctx.fillStyle='#264467';ctx.fillText(name,0,7);
    ctx.restore();
    const serial=(String(state.serial||'').trim()||'001').slice(0,20);
    ctx.save();ctx.translate(614,958);ctx.rotate(-.045);
    ctx.textAlign='right';ctx.font='bold 14px '+MONO;ctx.fillStyle='#f5eed7';
    ctx.fillText('NO. '+serial,0,0,145);ctx.restore();
  }

  function polish(ctx,state){
    const tx=Number(state.tiltX)||0, ty=Number(state.tiltY)||0;
    const strength=Math.max(0,Math.min(1,Number(state.light)||0));
    if(!strength)return;
    ctx.save();ctx.lineCap='round';ctx.lineWidth=3.2;
    // The textile stays matte. Only the lacquer and nickel catch the travelling key light.
    for(const [shape,x,y,width] of [[bigStar,81,184,57],[heartBadge,605,809,76]]){
      ctx.save();ctx.clip(shape);
      const offset=x+tx*width*.96+ty*width*.34;
      const light=linear(ctx,offset-13,y-4,offset+13,y+4,[[0,'rgba(255,255,255,0)'],[.42,'rgba(255,255,255,.19)'],[.55,'rgba(255,255,255,.85)'],[1,'rgba(255,255,255,0)']]);
      ctx.globalAlpha=strength*.63;ctx.fillStyle=light;ctx.fillRect(x-width,y-width,width*2,width*2);ctx.restore();
    }
    ctx.strokeStyle='rgba(255,255,248,'+(.34+.64*strength)+')';
    const angle=-2.16+tx*.92+ty*.25;
    ctx.beginPath();ctx.arc(metalHole.x,metalHole.y,metalHole.r-3,angle-.47,angle+.47);ctx.stroke();
    ctx.restore();
  }

  function draw(ctx,state,drawParticles){
    if(!backing)backing=cachedLayer(paintBacking);
    if(!front)front=cachedLayer(faceDetails);
    ctx.save();
    ctx.drawImage(backing,0,0,W,H);
    ctx.save();ctx.clip(windowCut);ChromeCard.drawPhoto(ctx,state);ctx.restore();
    if(drawParticles){ctx.save();ctx.clip(topFabric);drawParticles(ctx);ctx.restore();}
    ctx.drawImage(front,0,0,W,H);
    letterPatch(ctx,state);polish(ctx,state);ctx.restore();
  }

  window.DenimCard=Object.freeze({draw,geometry:()=>({shell:body,aperture:windowCut})});
})();
