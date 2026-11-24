/* An original printed mixtape sleeve. The photo stays on the studio's common card plane. */
(() => {
  'use strict';
  const W = 720, H = 1000;
  const ink = '#25112b', pink = '#ff459c', lemon = '#e1fc45', paper = '#fff6de';
  const sans = '"Arial Black","Helvetica Neue","PingFang SC",sans-serif';
  const mono = 'Menlo,Consolas,monospace';
  const serif = 'Georgia,"Songti SC",serif';
  const shell = new Path2D();
  shell.roundRect(5, 4, 710, 990, 27);
  const printArea = new Path2D();
  printArea.roundRect(15, 15, 690, 965, 18);
  const aperture = new Path2D(
    'M 95 142 Q 107 117 150 113 L 241 110 Q 277 118 319 105 ' +
    'L 514 96 Q 588 90 622 127 Q 651 156 653 205 L 647 386 ' +
    'Q 636 466 652 550 L 650 708 Q 644 792 574 803 L 381 819 ' +
    'Q 301 813 237 829 L 142 828 Q 68 815 64 744 L 67 565 ' +
    'Q 73 508 65 444 L 65 242 Q 65 182 95 142 Z');
  const bottomStrip = new Path2D('M 19 883 L 148 878 L 160 883 L 405 876 L 697 884 L 698 944 L 19 951 Z');
  const titleStrip = new Path2D('M 112 809 L 244 794 L 251 797 L 344 785 L 354 788 L 514 774 L 524 777 L 679 761 L 670 846 L 611 850 L 604 855 L 318 879 L 311 876 L 116 892 Z');
  const serialPatch = new Path2D('M 530 861 L 659 850 L 671 874 L 539 885 Z');

  function polygon(coords) {
    const p = new Path2D();
    coords.forEach(([x,y],i) => i ? p.lineTo(x,y) : p.moveTo(x,y));
    p.closePath(); return p;
  }
  function paint(c,p,fill,line,width=1) {
    if(fill){c.fillStyle=fill;c.fill(p);}
    if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke(p);}
  }
  function type(c,txt,x,y,font,color) {
    c.font=font;c.fillStyle=color;c.fillText(txt,x,y);
  }
  function burst(x,y,outer,inner,n,rotation=0,stretch=1) {
    return polygon(Array.from({length:n*2},(_,i)=>{
      const a=rotation-Math.PI/2+i*Math.PI/n, r=i%2?inner:outer;
      return [x+Math.cos(a)*r*stretch,y+Math.sin(a)*r];
    }));
  }
  function ellipse(x,y,rx,ry,rot=0) {
    const p=new Path2D();p.ellipse(x,y,rx,ry,rot,0,2*Math.PI);return p;
  }
  function gradient(c,x,y,ex,ey,colors) {
    const g=c.createLinearGradient(x,y,ex,ey);
    colors.forEach(([p,s])=>g.addColorStop(p,s));return g;
  }
  function inkedSticker(c,shape,fill) {
    c.lineJoin='round';c.save();c.translate(2.5,4);
    paint(c,shape,'#522745','rgba(58,27,47,.65)',9);c.restore();
    paint(c,shape,fill,'#fff9e9',11);
    paint(c,shape,null,ink,2.6);
  }
  function texture(c) {
    const tile=document.createElement('canvas');tile.width=tile.height=192;
    const g=tile.getContext('2d');let n=7777;
    const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    for (let i=0;i<6500;i++){
      g.fillStyle=i%3?'rgba(63,32,55,.073)':'rgba(255,253,229,.34)';
      g.fillRect(rand()*192,rand()*192,.4+rand()*1.9,.3+rand()*1.5);
    }
    c.fillStyle=c.createPattern(tile,'repeat');c.fillRect(12,12,696,968);
  }
  function newsprint(c) {
    const torn = polygon([[8,13],[365,12],[351,38],[336,40],[322,55],[305,59],[295,76],[280,78],[269,91],[229,98],[222,112],[179,123],[173,134],[141,139],[126,156],[104,161],[100,176],[73,189],[62,209],[37,222],[22,252],[12,248]]);
    paint(c,torn,paper,'#cfb8aa',2);
    c.save();c.clip(torn);c.rotate(-.16);
    for(let y=14;y<268;y+=11) {
      const row=Math.round(y/11);
      for(let x=-55;x<380;x+=67){
        c.fillStyle='rgba(41,24,42,.61)';c.fillRect(x,y,23+(row*7+x)%23,1.9);
        c.fillRect(x+41,y,15,1.8);
      }
    }
    type(c,'STEREO',23,110,'italic 900 36px '+serif,ink);c.restore();
  }
  function base(c) {
    paint(c,shell,'#80264e','#623646',3);
    paint(c,printArea,pink,'#fff5ed',2);
    c.save();c.clip(printArea);
    const limePatch = polygon([[560,13],[706,12],[712,973],[367,978],[383,951],[374,935],[403,924],[402,898],[437,874],[426,862],[453,837],[485,820],[486,791],[501,771],[495,756],[528,721],[520,700],[559,665],[551,648],[589,602],[579,588],[618,545],[608,518],[639,468],[624,445],[661,411],[648,383],[675,354],[660,324],[681,289],[656,259],[666,227],[645,218],[659,186],[635,167],[645,138],[616,128],[629,100],[605,87],[618,63],[587,53],[592,33]]);
    paint(c,limePatch,lemon);
    c.save();c.clip(limePatch);
    c.fillStyle='rgba(46,68,30,.20)';
    for(let y=2;y<985;y+=8)for(let x=375+(y%16<8?0:4);x<712;x+=8){
      c.beginPath();c.arc(x,y,1.05,0,Math.PI*2);c.fill();
    }
    c.restore();
    newsprint(c);
    c.fillStyle=ink;c.fillRect(14,947,690,34);
    for(let x=21;x<168;x+=10){
      c.fillStyle=(x%20===1)?paper:'#f16fa8';
      c.save();c.transform(1,0,-.38,1,x,949);c.fillRect(2,0,6,27);c.restore();
    }
    type(c,'MIXTAPE CLUB',183,970,'900 19px '+sans,paper);
    type(c,'//',357,970,'bold 18px '+mono,pink);
    type(c,'SIDE A',401,970,'bold 17px '+mono,lemon);
    for(let i=0;i<4;i++) paint(c,ellipse(571+i*22,964,7,7),['#66d3ef','#f48bbc',lemon,paper][i]);
    paint(c,bottomStrip,gradient(c,40,880,664,955,[[0,'#ffc5cd'],[.5,'#ffcde8'],[1,'#e4d9f5']]),'#642e54',2);
    c.save();c.clip(bottomStrip);
    for(let x=9;x<720;x+=17){
      c.strokeStyle='#ffdbe8';c.lineWidth=2;c.beginPath();c.moveTo(x,951);c.lineTo(x+54,878);c.stroke();
    }
    type(c,'STICKER  •  POCKET',35,902,'bold 11px '+mono,'#9e5173');
    c.restore();
    texture(c);
    paint(c,aperture,'#352a43','#35142e',15);
    paint(c,aperture,null,paper,10);
    paint(c,aperture,null,'#e94b9c',2);
    c.restore();
  }

  // Cropped individual paper sorts; each letter keeps its own stock and baseline.
  function masthead(c) {
    const blocks=[
      ['M',-6,79,64,lemon,ink,'900',sans],
      ['i',5,31,65,ink,'#ffbef3','italic bold',serif],
      ['X',-2,67,59,'#ffd6e9','#323e9c','900',sans],
      ['t',6,40,60,'#7955f6',paper,'italic bold',serif],
      ['a',-3,51,59,'#ff7455',ink,'bold',serif],
      ['p',3,54,66,paper,'#16624f','italic bold',serif],
      ['e',-6,53,63,'#67d9f1',ink,'bold',serif]
    ];
    let x=144;
    for(const [letter,degrees,w,fontSize,stock,color,weight,family] of blocks) {
      c.save();c.translate(x,54);c.rotate(degrees*Math.PI/180);
      c.fillStyle='rgba(42,22,48,.4)';c.fillRect(-1,-26,w,61);
      const four=polygon([[-2,-31],[w-4,-30],[w,28],[0,31]]);
      paint(c,four,stock);
      c.font=weight+' '+fontSize+'px '+family;
      c.fillStyle=color;c.textAlign='center';c.fillText(letter,(w-2)/2,20,w-4);
      c.restore();x+=w-1;
    }
  }
  const disc=ellipse(69,104,55,55);
  function compactDisc(c) {
    c.save();c.translate(69,104);c.rotate(-.16);
    const rim=ellipse(0,0,55,55);
    inkedSticker(c,rim,'#c9c5d1');
    const ring=new Path2D();ring.arc(0,0,53,0,Math.PI*2);ring.arc(0,0,13,0,Math.PI*2,true);
    c.save();c.clip(ring);
    const colors=['#6b6a85','#aabfe8','#a5f4e1','#fee08d','#fb9fd0','#b897db','#a0a3bb','#e6e0e2','#a798ed','#85e9e2','#e8e6a2','#d8c4de'];
    for(let i=0;i<72;i++){
      const a=i*Math.PI/36,b=(i+1.06)*Math.PI/36;
      c.fillStyle=colors[Math.floor(i/6)%colors.length];
      c.beginPath();c.moveTo(0,0);c.arc(0,0,58,a,b);c.closePath();c.fill();
    }
    for(let r=17;r<=50;r+=3.5)paint(c,ellipse(0,0,r,r),null,'rgba(255,255,255,.48)',.8);
    c.restore();
    paint(c,ellipse(0,0,14,14),'#c0abc3',ink,1.2);
    paint(c,ellipse(0,0,7,7),'#fa86bb','#fff6e9',2);
    c.rotate(-.12);type(c,'mini mix',-31,34,'italic bold 15px '+serif,ink);
    c.restore();
  }
  const foilStar=burst(630,221,52,23,5,.19);
  function margins(c) {
    inkedSticker(c,foilStar,'#8fc9ff');
    paint(c,burst(630,221,42,18,5,.19),'#ff86b5','#544c92',2);
    paint(c,burst(630,221,27,12,5,.19),lemon,ink,2.4);
    paint(c,burst(630,221,10,4.3,5,.19),paper);
    c.save();c.translate(32,428);c.rotate(-Math.PI/2);
    type(c,'✦  HIGH FIDELITY',0,13,'900 15px '+sans,ink);c.restore();
    c.save();c.translate(680,364);c.rotate(Math.PI/2);
    for(let i=0;i<12;i++) for(let j=0;j<2;j++) {
      c.fillStyle=(i+j)%2?ink:paper;c.fillRect(i*12,j*12,12,12);
    }
    c.restore();
    c.save();c.translate(651,61);c.rotate(.20);
    inkedSticker(c,ellipse(0,0,40,22),'#fe96b5');
    c.font='italic 900 21px '+sans;c.textAlign='center';c.fillStyle=ink;c.fillText('Y2K',0,8);
    c.restore();
  }
  function cassette(c) {
    c.save();c.translate(91,781);c.rotate(-.20);
    const shape=new Path2D();shape.roundRect(-70,-45,140,90,10);
    inkedSticker(c,shape,'#6952ce');
    const face=new Path2D();face.roundRect(-64,-40,128,78,6);
    paint(c,face,'#b3a1ff',ink,2.4);
    const label=new Path2D();label.roundRect(-57,-31,114,48,7);
    paint(c,label,'#fff6da',ink,2);
    c.fillStyle='#ff65ac';c.fillRect(-55,-26,109,7);
    c.fillStyle='#58cfd3';c.fillRect(-55,-18,109,4);
    const slot=new Path2D();slot.roundRect(-44,-11,88,24,12);
    paint(c,slot,'#6c637e',ink,1.6);
    paint(c,polygon([[-13,-5],[13,-5],[12,6],[-13,6]]),'#e5b88a',ink,1.3);
    for(const x of [-31,31]) {
      paint(c,ellipse(x,1,10,10),'#ecebda',ink,2);
      paint(c,burst(x,1,7,4.4,8,.13),'#33283b');
    }
    paint(c,polygon([[-28,22],[28,22],[36,38],[-36,38]]),'#9581ec',ink,1.7);
    for(const x of [-16,16])paint(c,ellipse(x,30,3.8,3.8),ink);
    for(const x of [-58,58])for(const y of [-34,32])paint(c,ellipse(x,y,2.4,2.4),ink);
    c.restore();
  }
  function foreground(c) {
    masthead(c);compactDisc(c);margins(c);
    c.save();c.translate(2,5);paint(c,titleStrip,'#602848');c.restore();
    paint(c,titleStrip,lemon,ink,3);
    paint(c,serialPatch,'#ff9cc8',ink,2);
    cassette(c);
    c.save();c.translate(83,164);c.rotate(-.55);
    const tape=polygon([[-31,-9],[31,-11],[29,-5],[33,1],[30,9],[-32,10],[-30,4],[-34,1]]);
    paint(c,tape,'rgba(234,218,167,.86)','rgba(104,82,57,.5)',1);
    for(let x=-25;x<30;x+=7){c.fillStyle='#7b694c55';c.fillRect(x,-7,1,13);}
    c.restore();
    c.save();c.translate(49,577);c.rotate(-.22);
    paint(c,burst(0,0,26,9,4,0,.66),paper,ink,3.2);
    paint(c,burst(15,-29,8,3,4),'#ffca19',ink,1.3);
    c.restore();
  }
  let stock,stickers;
  function layer(painter) {
    const c=document.createElement('canvas');c.width=W*1.25;c.height=H*1.25;
    const g=c.getContext('2d');g.scale(1.25,1.25);painter(g);return c;
  }
  const shineMask=new Path2D(foilStar);shineMask.addPath(disc);shineMask.addPath(serialPatch);
  function stickerFlash(c,state) {
    if(!state.light)return;
    const mid=315+(state.tiltX||0)*315+(state.tiltY||0)*89;
    c.save();c.clip(shineMask);
    c.globalAlpha=Math.max(0,Math.min(1,state.light));
    c.globalCompositeOperation='screen';
    const g=gradient(c,mid-112,103,mid+103,160,[
      [0,'#b674ff00'],[.21,'#e174db49'],[.40,'#5be2eba6'],[.49,'#fff8f0ef'],
      [.55,'#eaff9c9c'],[.70,'#ff85cb74'],[1,'#8275ff00']
    ]);
    c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();
  }
  function personalized(c,state) {
    c.save();c.translate(146,865);c.rotate(-.091);
    const name=(String(state.name||'').trim()||'ASTRA').slice(0,40);
    c.font='italic 900 76px '+serif;
    c.scale(Math.min(1,500/Math.max(1,c.measureText(name).width)),1);
    c.fillStyle='#f07097';c.fillText(name,3.6,2.8);
    c.fillStyle=ink;c.fillText(name,0,0);c.restore();
    c.save();c.translate(542,880);c.rotate(-.076);c.font='bold 14px '+mono;
    c.fillStyle=ink;c.fillText('NO. '+(String(state.serial||'').trim()||'001'),0,-2,115);c.restore();
  }
  function draw(c,state,drawParticles) {
    stock ||= layer(base);stickers ||= layer(foreground);
    c.save();c.drawImage(stock,0,0,W,H);
    c.save();c.clip(aperture);ChromeCard.drawPhoto(c,state);c.restore();
    c.save();c.clip(printArea);if(drawParticles)drawParticles(c);c.restore();
    c.drawImage(stickers,0,0,W,H);
    stickerFlash(c,state);personalized(c,state);c.restore();
  }
  window.CollageCard=Object.freeze({draw,geometry:()=>({shell,aperture})});
})();
