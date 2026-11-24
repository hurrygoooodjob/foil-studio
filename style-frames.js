/* Build printable frame materials from the colour and spatial structure of a local image. */
(() => {
  'use strict';

  const W=720,H=1000;
  const SANS='"Avenir Next",Arial,"PingFang SC",sans-serif';
  const SERIF='Georgia,"Times New Roman","Songti SC",serif';
  const MONO='Menlo,Consolas,monospace';
  const PAPER=[255,249,236], INK=[15,19,27];
  const neutral=[126,127,148];
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
  const css=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
  const luma=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
  const chroma=c=>Math.max(...c)-Math.min(...c);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const images=new WeakMap(), stocks=new WeakMap();
  let emptyProfile;

  function canvas(w,h) {
    const c=document.createElement('canvas');c.width=w;c.height=h;return c;
  }
  function path(points) {
    const p=new Path2D();
    p.moveTo(...points[0]);for(let i=1;i<points.length;i++)p.lineTo(...points[i]);
    p.closePath();return p;
  }
  function roundRect(x,y,w,h,r) {
    const p=new Path2D();p.roundRect(x,y,w,h,r);return p;
  }
  function stroke(c,p,colour,width=1) { c.lineWidth=width;c.strokeStyle=colour;c.stroke(p); }
  function fill(c,p,colour) {c.fillStyle=colour;c.fill(p);}
  function text(c,value,x,y,font,colour,maxWidth) {
    c.font=font;c.fillStyle=colour;c.fillText(value,x,y,maxWidth);
  }
  function linear(c,x,y,u,v,stops) {
    const g=c.createLinearGradient(x,y,u,v);
    stops.forEach((color,i)=>g.addColorStop(i/(stops.length-1),color));return g;
  }
  function random(seed) {
    return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }
  function hue(colour) {
    const max=Math.max(...colour),min=Math.min(...colour),delta=max-min;
    if(!delta)return 0;
    const [r,g,b]=colour;
    let sector=max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
    if(sector<0)sector+=6;
    return sector;
  }
  function toneName(colour) {
    if(chroma(colour)<24)return '银灰调';
    const names=['朱红调','琥珀调','草木绿调','青碧调','靛蓝调','莓紫调','玫红调'];
    return names[Math.round(hue(colour))];
  }

  // A small thumbnail preserves the entire reference. Weight saturated ink over
  // large white margins in a scanned contact sheet; ignore transparent padding.
  function sample(image) {
    const iw=image?.naturalWidth||image?.width,ih=image?.naturalHeight||image?.height;
    const k=iw&&ih?112/Math.max(iw,ih):1;
    const w=iw?Math.max(3,Math.round(iw*k)):8,h=ih?Math.max(3,Math.round(ih*k)):8;
    const tiny=canvas(w,h),gc=tiny.getContext('2d',{willReadFrequently:true});
    if(iw&&ih)gc.drawImage(image,0,0,w,h);
    const data=gc.getImageData(0,0,w,h).data;
    return {w,h,data};
  }
  function analyze(image) {
    if(!image&&emptyProfile)return emptyProfile;
    const src=image?.currentSrc||image?.src;
    if(src && images.get(image)?.src===src)return images.get(image).profile;
    const {w,h,data}=sample(image);
    const bins=new Map(),field=new Float32Array(w*h);
    const hueMass=new Float32Array(24);
    const sums=[0,0,0];
    let total=0,sx=0,sy=0,mass=0,seed=1975;
    for(let i=0;i<w*h;i++){
      const j=4*i,r=data[j],g=data[j+1],b=data[j+2],a=data[j+3]/255;
      const colour=[r,g,b],light=luma(colour),rich=chroma(colour);
      const weight=a*(light>225&&rich<27?.12:1);
      field[i]=(light+.23*(r-b))*a+176*(1-a);
      if(weight<.02)continue;
      total+=weight;
      for(let k=0;k<3;k++)sums[k]+=colour[k]*weight;
      const importance=weight*(.22+(255-light)/255+rich/270);
      sx+=(i%w+.5)/w*importance;sy+=(Math.floor(i/w)+.5)/h*importance;mass+=importance;
      if(rich>22){
        const position=.35+.65*Math.sin(Math.PI*(i%w+.5)/w)*Math.sin(Math.PI*(Math.floor(i/w)+.5)/h);
        hueMass[Math.floor(4*hue(colour))%24]+=weight*(rich/140)**.85*(1.1-.3*Math.max(r,g,b)/255)*position;
      }
      const key=(r>>5)*64+(g>>5)*8+(b>>5);
      const bin=bins.get(key)||{n:0,s:[0,0,0]};
      bin.n+=weight;for(let k=0;k<3;k++)bin.s[k]+=colour[k]*weight;
      bins.set(key,bin);
      if(i%17===0)seed=(Math.imul(seed,31)+key)>>>0;
    }
    const mean=total?sums.map(v=>v/total):neutral;
    const candidates=[...bins.values()].map(({n,s})=>({colour:s.map(v=>v/n),n}));
    function pick(score,fallback) {
      let result=fallback,best=0;
      for(const item of candidates){const value=score(item);if(value>best){best=value;result=item.colour;}}
      return result;
    }
    // Pool neighbouring hues before picking a pigment so a tiny bright logo
    // cannot displace the repeated indigo of a photographed denim surface.
    const density=Array.from(hueMass,(n,i)=>n+.62*(hueMass[(i+23)%24]+hueMass[(i+1)%24]));
    const strongest=Math.max(...density),mainHue=density.indexOf(strongest)+.5;
    function hueMatch(c){
      if(strongest<total*.014)return 1;
      const d=Math.abs(4*hue(c)-mainHue);
      return .025+.975*Math.exp(-.55*(Math.min(d,24-d)/1.55)**2);
    }
    const primary=pick(({colour:c,n})=>Math.sqrt(n)*((chroma(c)/48)**1.35+.36)
        *(.35+Math.sin(Math.PI*clamp(luma(c)/255,0,1)))*hueMatch(c),mean);
    const second=pick(({colour:c,n})=>Math.sqrt(n)*distance(c,primary)**1.55
        *(.15+chroma(c)/38),mix(primary,PAPER,.65));
    const ink=mix(mix(mean,primary,.35),INK,.78);
    const paper=mix(mean,PAPER,.85);
    const count=field.length;
    let xx=0,yy=0,xy=0,edgeSum=0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,dx=(field[i+1]-field[i-1])*.5,dy=(field[i+w]-field[i-w])*.5;
      xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;edgeSum+=Math.hypot(dx,dy);
    }
    const sorted=Array.from(field).sort((a,b)=>a-b);
    const low=sorted[Math.floor(count*.08)],high=sorted[Math.floor(count*.92)];
    const span=Math.max(14,high-low);
    for(let i=0;i<count;i++)field[i]=clamp((field[i]-low)/span,0,1);
    const detail=clamp(edgeSum/Math.max(1,(w-2)*(h-2))/32,0,1);
    const profile={palette:[primary,second,ink,paper].map(css),primary,second,ink,paper,field,w,h,
      x:mass?sx/mass:.5,y:mass?sy/mass:.5,angle:Math.atan2(2*xy,xx-yy)*.5+Math.PI/2,
      detail,contrast:clamp(span/230,0,1),seed,
      description:toneName(primary)+' · '+(detail>.49?'细密纹理':detail>.22?'疏密交错':'舒缓块面')};
    if(src)images.set(image,{src,profile});else if(!image)emptyProfile=profile;
    return profile;
  }
  function valueAt(p,u,v){
    return p.field[Math.round(clamp(v,0,1)*(p.h-1))*p.w+Math.round(clamp(u,0,1)*(p.w-1))];
  }
  const shell=roundRect(4,4,712,992,29);
  const inner=roundRect(16,16,688,968,20);

  function windowFor(id,p) {
    if(id==='editorial'){
      const notch=55+104*p.x;
      return path([[49,123],[720-notch,123],[671,137+30*p.detail],[671,761],[652,784],[49,784]]);
    }
    if(id==='prism'){
      const cut=43+Math.round(p.contrast*26);
      return path([[56+cut,101],[664-cut,101],[664,101+cut],[664,728],[664-cut,788],[56+cut,788],[56,728],[56,101+cut]]);
    }
    const pth=new Path2D(),rise=38+50*(1-p.y);
    pth.moveTo(58,758);pth.lineTo(58,194);
    pth.bezierCurveTo(58,118,100,113,165,113);
    pth.bezierCurveTo(234,113,241,160-rise,360,136-rise);
    pth.bezierCurveTo(479,160-rise,486,113,555,113);
    pth.bezierCurveTo(620,113,662,118,662,194);
    pth.lineTo(662,758);pth.quadraticCurveTo(662,801,618,801);pth.lineTo(102,801);
    pth.quadraticCurveTo(58,801,58,758);pth.closePath();return pth;
  }

  function circle(c,x,y,r,colour) {
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=colour;c.fill();
  }
  function speckle(c,p,colour,n) {
    const rnd=random(p.seed||9871);
    c.fillStyle=colour;c.globalAlpha=.17;
    for(let i=0;i<n;i++){
      const x=rnd()*W,y=rnd()*H,rad=.5+rnd()*1.25;c.fillRect(x,y,rad,rad*.74);
    }
    c.globalAlpha=1;
  }
  function poster(c,p) {
    const [accent,second,ink,paper]=p.palette;
    fill(c,shell,paper);stroke(c,inner,ink,2);
    // The shape and line-screen density are sampled independently of palette.
    const slope=(p.x-.5)*155+Math.cos(p.angle)*31;
    fill(c,path([[14,12],[280+slope,12],[168+slope,120],[14,161]]),accent);
    fill(c,path([[694,40],[694,156],[483-slope,155]]),second);
    c.save();c.beginPath();c.rect(14,168,692,633);c.clip();
    const spacing=8+Math.round((1-p.detail)*9);
    c.fillStyle=ink;
    for(let y=177;y<803;y+=spacing)for(let x=23;x<702;x+=spacing){
      if(x>54&&x<663)continue;
      const radius=1+(1-valueAt(p,x/W,y/H))*spacing*.37;
      circle(c,x+(Math.floor(y/spacing)%2)*spacing*.33,y,radius,ink);
    }
    c.restore();
    const bottom=path([[17,787],[705,767+slope*.22],[705,979],[17,979]]);
    fill(c,bottom,accent);stroke(c,bottom,ink,2.2);
    const bands=4+Math.round(p.detail*4);
    for(let i=0;i<bands;i++){
      const y=923+i*6;
      fill(c,path([[373+i*10,y],[703,y-11-slope*.17],[703,y-8-slope*.17],[375+i*10,y+3]]),ink);
    }
    c.fillStyle=paper;c.fillRect(36,37,354,66);
    text(c,'Impression',45,87,'italic bold 61px '+SERIF,ink,329);
    text(c,'SCREEN PRINT',473,69,'700 18px '+MONO,ink,179);
    stroke(c,roundRect(461,38,207,50,1),ink,2.1);
    for(let i=0;i<3;i++)circle(c,50+i*24,952,7,[ink,second,paper][i]);
    speckle(c,p,ink,24000);
  }
  function prism(c,p) {
    const {primary,second,ink,paper}=p;
    fill(c,shell,linear(c,0,0,W,H,[css(paper),css(ink),css(primary),css(paper)]));
    fill(c,inner,css(ink));
    const rnd=random(p.seed||1921),facetColours=[primary,second,paper,mix(primary,ink,.46)];
    const tipX=W*(.25+p.x*.55),tipY=H*(.23+p.y*.49);
    const ring=[[19,20],[700,20],[700,980],[19,980],[19,20]];
    for(let side=0;side<4;side++){
      const [x1,y1]=ring[side],[x2,y2]=ring[side+1];
      const count=Math.round((side%2?15:10)+p.detail*7);
      const splits=[0];
      for(let i=1;i<count;i++)splits.push((i+(rnd()-.5)*.6)/count);
      splits.push(1);
      for(let i=0;i<count;i++){
        const t=splits[i],s=splits[i+1];
        const x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
        const u=x1+(x2-x1)*s,v=y1+(y2-y1)*s;
        const colour=facetColours[Math.floor(rnd()*4)];
        const bright=.2+rnd()*.65;
        fill(c,path([[x,y],[u,v],[tipX,tipY]]),
          linear(c,x,y,tipX,tipY,[css(mix(colour,paper,bright)),css(mix(colour,ink,.59)),css(colour)]));
      }
    }
    const cap=path([[174,32],[546,32],[525,75],[195,75]]);
    fill(c,cap,css(ink));stroke(c,cap,css(paper),1.6);
    c.textAlign='center';text(c,'P R I S M',360,63,'600 25px '+SANS,css(paper),270);c.textAlign='left';
    const plate=path([[52,844],[107,794],[613,794],[668,844],[592,946],[127,946]]);
    fill(c,plate,linear(c,0,790,0,957,[css(mix(ink,primary,.22)),css(ink),css(mix(ink,second,.18))]));
    stroke(c,plate,css(paper),2.5);
    for(let j=0;j<3;j++){
      const x=312+48*j;
      fill(c,path([[x-9,945],[x,936],[x+9,945],[x,954]]),j===1?css(paper):css(second));
    }
  }
  // Trace actual source-derived iso-contours in a square, then mirror them
  // around the rim like an engraved textile repeat.
  function engravingTile(p) {
    const size=212,c=canvas(size,size),g=c.getContext('2d');
    const cells=28,step=size/cells;
    const grid=new Float32Array((cells+1)**2);
    for(let y=0;y<=cells;y++)for(let x=0;x<=cells;x++)
      grid[y*(cells+1)+x]=valueAt(p,x/cells,y/cells);
    const levels=[.14,.26,.39,.52,.65,.79,.89];
    const colours=[css(mix(p.ink,p.primary,.32)),css(p.second),css(mix(p.ink,p.primary,.6))];
    levels.forEach((level,index)=>{
      g.beginPath();g.strokeStyle=colours[index%3];g.lineWidth=index%3===0?2.15:1.35;
      for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){
        const i=y*(cells+1)+x;
        const vals=[grid[i],grid[i+1],grid[i+cells+2],grid[i+cells+1]];
        const pts=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],cross=[];
        for(let e=0;e<4;e++){
          const b=(e+1)%4;
          if((vals[e]>=level)===(vals[b]>=level))continue;
          const f=(level-vals[e])/(vals[b]-vals[e]);
          cross.push([(pts[e][0]+(pts[b][0]-pts[e][0])*f)*step,(pts[e][1]+(pts[b][1]-pts[e][1])*f)*step]);
        }
        for(let s=1;s<cross.length;s+=2){g.moveTo(...cross[s-1]);g.lineTo(...cross[s]);}
      }
      g.stroke();
    });
    return c;
  }
  function echo(c,p) {
    const [a,b,ink,paper]=p.palette;
    fill(c,shell,css(mix(p.primary,p.paper,.77)));
    const tile=engravingTile(p),pitch=108+Math.round(38*(1-p.detail));
    c.save();c.globalAlpha=.8;
    for(let j=0;j*pitch<H;j++)for(let i=0;i*pitch<W;i++){
      c.save();c.translate((i+(i%2))*pitch,(j+(j%2))*pitch);
      c.scale(i%2?-1:1,j%2?-1:1);c.drawImage(tile,0,0,pitch,pitch);c.restore();
    }
    c.restore();
    stroke(c,inner,ink,3);stroke(c,roundRect(24,24,672,952,17),paper,2);
    const cap=roundRect(131,28,458,42,21);fill(c,cap,paper);stroke(c,cap,ink,1.65);
    c.textAlign='center';text(c,'E C H O    ✳    A T L A S',360,56,'600 18px '+MONO,ink,394);c.textAlign='left';
    const label=new Path2D();
    label.moveTo(85,850);label.bezierCurveTo(112,852,119,836,119,820);
    label.bezierCurveTo(254,820,268,806,360,806);label.bezierCurveTo(452,806,466,820,601,820);
    label.quadraticCurveTo(601,851,635,850);label.lineTo(635,918);
    label.quadraticCurveTo(601,916,599,941);label.quadraticCurveTo(360,973,121,941);
    label.quadraticCurveTo(118,918,85,918);label.closePath();
    fill(c,label,paper);stroke(c,label,ink,4);stroke(c,label,b,1.5);
    for(const x of [102,618]){
      fill(c,path([[x,868],[x+7,882],[x,896],[x-7,882]]),a);
      circle(c,x,882,2.4,ink);
    }
    speckle(c,p,ink,14000);
  }

  const drawers={editorial:poster,prism,echo};
  function stock(id,p) {
    let set=stocks.get(p);
    if(!set){set=new Map();stocks.set(p,set);}
    if(set.has(id))return set.get(id);
    const substrate=canvas(W,H),c=substrate.getContext('2d');
    const aperture=windowFor(id,p);
    c.save();c.clip(shell);drawers[id](c,p);c.restore();
    const result={aperture,substrate};
    set.set(id,result);return result;
  }
  function draw(id,c,state,particles) {
    const p=state.styleProfile||analyze(state.image);
    const {substrate,aperture}=stock(id,p);
    c.save();c.drawImage(substrate,0,0);
    c.save();c.clip(aperture);ChromeCard.drawPhoto(c,state);c.restore();
    stroke(c,aperture,p.palette[2],id==='echo'?7:5);
    stroke(c,aperture,p.palette[3],1.45);
    // Keep specular light off the shared photo window.
    if(state.light>0){
      c.save();c.clip(shell);const rim=new Path2D(shell);rim.addPath(aperture);c.clip(rim,'evenodd');
      const focus=220+state.tiltX*450+state.tiltY*150;
      const shine=c.createLinearGradient(focus-110,300,focus+100,367);
      for(const [v,alpha] of [[0,0],[.38,.03],[.49,.67],[.52,.18],[.61,.065],[1,0]])
        shine.addColorStop(v,'rgba(255,254,246,'+alpha+')');
      c.globalAlpha=state.light*(id==='prism'?.96:id==='echo'?.26:.19);
      c.fillStyle=shine;c.fillRect(0,0,W,H);c.restore();
    }
    if(particles){c.save();c.clip(inner);particles(c);c.restore();}
    const name=String(state.name||'ASTRA'),serial=String(state.serial||'001');
    const ink=p.palette[2],paper=p.palette[3];
    if(id==='editorial'){
      // A contrasting band carries the name even when a reference is monochrome.
      c.fillStyle=paper;c.fillRect(30,807,660,109);
      text(c,name,43,891,'900 84px '+SANS,ink,624);
      c.fillStyle=ink;c.fillRect(482,942,195,31);
      text(c,'Nº '+serial,496,965,'600 19px '+MONO,paper,158);
    }else{
      c.textAlign='center';
      if(id==='prism'){
        text(c,name,360,888,'bold 72px '+SANS,paper,514);
        text(c,'FACET   /   '+serial,360,924,'500 18px '+MONO,paper,395);
      }else{
        text(c,name,360,898,'italic bold 78px '+SERIF,ink,479);
        text(c,'NO.   '+serial,360,932,'600 17px '+MONO,ink,394);
      }
    }
    c.restore();
  }
  const renderers=Object.fromEntries(Object.keys(drawers).map(id=>[id,{
    draw:(c,state,particles)=>draw(id,c,state,particles),
    geometry:state=>({shell,aperture:stock(id,state.styleProfile||analyze(state.image)).aperture})
  }]));
  window.StyleFrames=Object.freeze({analyze,renderers});
})();
