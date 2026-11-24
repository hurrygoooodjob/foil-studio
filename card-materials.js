/* Finishes sit on the printed card underneath the editable sticker layers. */
(() => {
  'use strict';
  const W=720,H=1000;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  let frostGrain,softened;

  function canvas(w,h){
    const c=document.createElement('canvas');c.width=w;c.height=h;return c;
  }
  function gradient(g,x,y,u,v,stops){
    const color=g.createLinearGradient(x,y,u,v);
    for(const [at,value] of stops)color.addColorStop(at,value);
    return color;
  }
  function line(g,path,color,width){
    g.strokeStyle=color;g.lineWidth=width;g.stroke(path);
  }
  function coat(g,color){
    g.fillStyle=color;g.fillRect(0,0,W,H);
  }

  // Remove a measured portion of the existing ink. The rim and portrait are
  // independent so the backing can show through while the subject stays legible.
  function transmission(g,shell,window,amount,rimLoss,photoLoss) {
    const rim=new Path2D(shell);rim.addPath(window);
    g.save();g.globalCompositeOperation='destination-out';
    g.fillStyle='rgba(0,0,0,'+(rimLoss*amount)+')';g.fill(rim,'evenodd');
    g.fillStyle='rgba(0,0,0,'+(photoLoss*amount)+')';g.fill(window);g.restore();
  }

  function film(g,shell,window,k,tx,ty) {
    transmission(g,shell,window,k,.79,.34);
    g.globalCompositeOperation='source-atop';g.globalAlpha=k;
    const drift=tx*220+ty*100;
    coat(g,gradient(g,60+drift,20,650+drift,630,[
      [0,'#b2eeff03'],[.19,'#d5edff08'],[.28,'#eafaff30'],
      [.32,'#ddf5ff0c'],[.54,'#a1d7da03'],[.78,'#c0ecea1b'],[1,'#dce1ff06']
    ]));
    // Two slim optical contours leave most of the material visibly transparent.
    line(g,shell,'#b8effee0',3.8);
    line(g,window,'#a6eef5c4',2.1);
  }

  function acrylic(g,shell,window,k,tx,ty,lit) {
    transmission(g,shell,window,k,.24,.075);
    g.globalCompositeOperation='source-atop';g.globalAlpha=k;
    const shift=tx*190+ty*85;
    const bevel=gradient(g,32+shift,0,W+shift,H,[
      [0,'#fcffff'],[.13,'#b4effa'],[.28,'#244e76'],[.38,'#82b4c9'],
      [.52,'#f1ffff'],[.57,'#4ca6bd'],[.69,'#304e71'],[.80,'#a69bd3'],[1,'#fff2ff']
    ]);
    line(g,shell,'#1b3247',27);
    line(g,shell,bevel,21);
    line(g,shell,'#f5ffffed',3);
    g.save();g.translate(W/2,H/2);g.scale(.969,.978);g.translate(-W/2,-H/2);
    line(g,shell,'#172d467f',4.6);line(g,shell,'#dafaffbc',1.5);g.restore();
    line(g,window,'#1c354fbb',14);
    line(g,window,bevel,8);
    // The bevel refracts light on both sides of the window lip.
    const inner=new Path2D();
    inner.addPath(window,new DOMMatrix([.970,0,0,.975,10.8,10.5]));
    const lip=new Path2D(window);lip.addPath(inner);
    g.save();g.clip(lip,'evenodd');g.globalAlpha=k*.52;
    coat(g,bevel);g.restore();
    line(g,inner,'#d4f8ff57',1.6);
    g.save();g.translate(1.5+2*tx,2.2+ty);
    line(g,window,'#ebffffc9',2.2);g.restore();
    // A broad softbox and its narrow secondary reflection move together.
    const x=132+tx*350-ty*60, y=245+ty*90;
    g.globalAlpha=k*lit;
    coat(g,gradient(g,x-190,y-64,x+190,y+64,[
      [0,'#ffffff00'],[.25,'#d8f5ff02'],[.41,'#eaffff11'],[.475,'#f6ffff42'],
      [.488,'#ffffff9c'],[.499,'#ffffff26'],[.515,'#efffff09'],
      [.54,'#ffffff05'],[.55,'#eaffff53'],[.56,'#eaffff04'],[.76,'#eaffff00'],[1,'#ffffff00']
    ]));
  }

  function grain(){
    if(frostGrain)return frostGrain;
    frostGrain=canvas(157,151);
    const gc=frostGrain.getContext('2d'), im=gc.createImageData(frostGrain.width,frostGrain.height);
    let seed=14599;
    for(let i=0;i<im.data.length;i+=4){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const bright=Boolean(seed&0x100000), strength=(seed>>>23)/511;
      im.data[i]=bright?244:41;im.data[i+1]=bright?251:53;im.data[i+2]=bright?253:64;
      im.data[i+3]=Math.round(12+76*strength*strength);
    }
    gc.putImageData(im,0,0);return frostGrain;
  }

  function diffuseBase(g,k) {
    // Take the base in card-local coordinates even in a padded or scaled PNG.
    // The small intermediate image mixes nearby colours with no pixel readback.
    const step=3+8*k, w=Math.ceil(W/step),h=Math.ceil(H/step);
    if(!softened || softened.width!==w || softened.height!==h)softened=canvas(w,h);
    const sg=softened.getContext('2d'), inv=g.getTransform().inverse();
    sg.resetTransform();sg.clearRect(0,0,w,h);
    sg.setTransform(w/W,0,0,h/H,0,0);
    sg.transform(inv.a,inv.b,inv.c,inv.d,inv.e,inv.f);
    sg.imageSmoothingEnabled=true;sg.imageSmoothingQuality='medium';sg.drawImage(g.canvas,0,0);
    g.globalAlpha=.83*k;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='medium';
    g.drawImage(softened,0,0,W,H);
  }

  function frosted(g,shell,window,k,tx,ty,lit) {
    transmission(g,shell,window,k,.47,.13);
    g.globalCompositeOperation='source-atop';
    diffuseBase(g,k);
    g.globalAlpha=k;coat(g,'rgba(222,239,245,.20)');
    const cx=210+tx*165,cy=180+ty*125;
    const diffusion=g.createRadialGradient(cx,cy,18,cx,cy,825);
    diffusion.addColorStop(0,'#f6ffff55');diffusion.addColorStop(.48,'#daedf415');
    diffusion.addColorStop(1,'#c1d7ea03');
    g.globalAlpha=k*lit;coat(g,diffusion);
    g.globalAlpha=k*.28;coat(g,g.createPattern(grain(),'repeat'));
    g.globalAlpha=k*.86;line(g,shell,'#dfedf1a6',5);line(g,window,'#d4e2e65c',2.5);
  }

  const finishes={translucent:film,acrylic,frosted};
  function finish(g,state,geometry) {
    const apply=finishes[state.material];
    const k=clamp(state.materialStrength??.75,0,1);
    if(!apply || !k || !geometry?.shell || !geometry.aperture)return;
    g.save();g.clip(geometry.shell);
    const tx=state.tiltX||0,ty=state.tiltY||0,lit=.68+.32*clamp(state.light??.75,0,1);
    apply(g,geometry.shell,geometry.aperture,k,tx,ty,lit);
    g.restore();
  }
  window.CardMaterials=Object.freeze({finish});
})();
