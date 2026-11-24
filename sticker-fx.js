/* Per-sticker alpha styles, drawn once as an isolated layer before blending. */
(() => {
  'use strict';

  const defaults = Object.freeze({
    opacity:100, blend:'source-over',
    strokeOn:false, strokeWidth:4, strokeColor:'#ffffff',
    glowOn:false, glowRadius:14, glowColor:'#bb98ff',
    shadowOn:false, shadowBlur:10, shadowColor:'#261a38', shadowX:6, shadowY:8
  });
  const textures = new WeakMap();
  const radians = Math.PI/180;

  function number(layer, key, low, high) {
    const n = Number(layer[key] ?? defaults[key]);
    return Number.isFinite(n) ? Math.min(high,Math.max(low,n)) : defaults[key];
  }

  function styles(layer) {
    return {
      stroke:layer.strokeOn ? number(layer,'strokeWidth',0,20) : 0,
      glow:layer.glowOn ? number(layer,'glowRadius',0,40) : 0,
      shadow:Boolean(layer.shadowOn),
      blur:layer.shadowOn ? number(layer,'shadowBlur',0,32) : 0,
      dx:layer.shadowOn ? number(layer,'shadowX',-36,36) : 0,
      dy:layer.shadowOn ? number(layer,'shadowY',-36,36) : 0,
      strokeColor:layer.strokeColor || defaults.strokeColor,
      glowColor:layer.glowColor || defaults.glowColor,
      shadowColor:layer.shadowColor || defaults.shadowColor
    };
  }

  // Keep a transparent guard band for filtering. All sizes and offsets are
  // sticker-local lengths in card coordinates, independent of the board zoom.
  function layout(width,height,s) {
    if (!s.stroke && !s.glow && !s.shadow) {
      return {left:-width/2,top:-height/2,right:width/2,bottom:height/2};
    }
    const edge = s.stroke + 3;
    const halo = s.glow * 2.5;
    const shadow = s.blur * 2.5;
    return {
      left:-width/2 - Math.ceil(edge+Math.max(halo,shadow-s.dx)),
      top:-height/2 - Math.ceil(edge+Math.max(halo,shadow-s.dy)),
      right:width/2 + Math.ceil(edge+Math.max(halo,shadow+s.dx)),
      bottom:height/2 + Math.ceil(edge+Math.max(halo,shadow+s.dy))
    };
  }

  function bounds(layer,width,height) {
    const r = layout(width,height,styles(layer));
    const angle = (layer.angle || 0)*radians, c=Math.cos(angle), s=Math.sin(angle);
    const cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
    const x=layer.x+cx*c-cy*s, y=layer.y+cx*s+cy*c;
    const hw=(r.right-r.left)/2, hh=(r.bottom-r.top)/2;
    const ex=Math.abs(c)*hw+Math.abs(s)*hh, ey=Math.abs(s)*hw+Math.abs(c)*hh;
    return {left:Math.floor(x-ex),top:Math.floor(y-ey),right:Math.ceil(x+ex),bottom:Math.ceil(y+ey)};
  }

  function canvas(w,h) {
    const result=document.createElement('canvas');
    result.width=w;
    result.height=h;
    return result;
  }

  // Max-filter a line with a monotone queue. Along four axes this dilates the
  // real (possibly translucent) alpha into a round, eight-sided stroke.
  function maxLine(input,output,start,stride,length,radius,queue) {
    let head=0,tail=0,added=0;
    for(let i=0;i<length;i++){
      const end=Math.min(length,i+radius+1);
      for(;added<end;added++){
        const value=input[start+added*stride];
        while(tail>head && input[start+queue[tail-1]*stride]<=value)tail--;
        queue[tail++]=added;
      }
      while(queue[head]<i-radius)head++;
      output[start+i*stride]=input[start+queue[head]*stride];
    }
  }

  function dilate(alpha,w,h,radius) {
    const scratch=new Uint8Array(alpha.length), queue=new Int32Array(Math.max(w,h));
    const diagonal=Math.round(radius*(1-Math.SQRT1_2));
    const axial=Math.max(0,Math.round(radius)-2*diagonal);
    if(axial){
      for(let y=0;y<h;y++)maxLine(alpha,scratch,y*w,1,w,axial,queue);
      for(let x=0;x<w;x++)maxLine(scratch,alpha,x,w,h,axial,queue);
    }
    if(diagonal){
      for(let x=0;x<w;x++)maxLine(alpha,scratch,x,w+1,Math.min(w-x,h),diagonal,queue);
      for(let y=1;y<h;y++)maxLine(alpha,scratch,y*w,w+1,Math.min(w,h-y),diagonal,queue);
      for(let x=0;x<w;x++)maxLine(scratch,alpha,x,w-1,Math.min(x+1,h),diagonal,queue);
      for(let y=1;y<h;y++)maxLine(scratch,alpha,y*w+w-1,w-1,Math.min(w,h-y),diagonal,queue);
    }
  }

  function strokeMask(src,w,h,left,top,width,height,radius,color) {
    const mask=canvas(w,h);
    const g=mask.getContext('2d',{willReadFrequently:true});
    g.drawImage(src,left,top,width,height);
    const image=g.getImageData(0,0,w,h), rgba=image.data;
    const alpha=new Uint8Array(w*h);
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
    const originalAlpha=new Uint8Array(alpha);
    dilate(alpha,w,h,radius);
    for(let i=0;i<alpha.length;i++)rgba[i*4+3]=alpha[i];
    g.putImageData(image,0,0);
    g.globalCompositeOperation='source-in';
    g.fillStyle=color;
    g.fillRect(0,0,w,h);
    // Keep untouched translucent ink at its original opacity. Only added
    // coverage outside an edge should receive solid stroke colour.
    return {mask,paintOutside(destination) {
      for(let i=0;i<alpha.length;i++){
        const a=originalAlpha[i];
        rgba[i*4+3]=a===255 ? 0 : 255*(alpha[i]-a)/(255-a);
      }
      g.putImageData(image,0,0);
      g.fillRect(0,0,w,h);
      destination.drawImage(mask,0,0);
    }};
  }

  // Isolate only Canvas's alpha-derived shadow. The source itself is painted
  // outside the bitmap and the shadow offset brings its silhouette back in.
  function softMask(g,image,x,y,w,h,dx,dy,blur,color) {
    const off=g.canvas.width+Math.ceil(Math.abs(x)+Math.abs(dx))+4;
    g.save();
    g.shadowColor=color; g.shadowBlur=blur;
    g.shadowOffsetX=off+dx; g.shadowOffsetY=dy;
    g.drawImage(image,x-off,y,w,h);
    g.restore();
  }

  function makeTexture(layer,width,height,s,rect) {
    const w=rect.right-rect.left,h=rect.bottom-rect.top;
    // The still exporter works at 1.5×. Keep the same sampling density across
    // preview, thumbnails and video, with a bounded bitmap for oversize assets.
    const k=Math.min(1.5,2560/Math.max(w,h));
    const tile=canvas(Math.ceil(w*k),Math.ceil(h*k));
    const g=tile.getContext('2d'), x=(-width/2-rect.left)*k,y=(-height/2-rect.top)*k;
    const w0=width*k,h0=height*k;
    const outline=s.stroke ? strokeMask(layer.image,tile.width,tile.height,x,y,w0,h0,s.stroke*k,s.strokeColor) : null;
    const mask=outline?.mask || layer.image;
    const mx=outline ? 0 : x,my=outline ? 0 : y;
    const mw=outline ? tile.width : w0,mh=outline ? tile.height : h0;
    if(s.shadow)softMask(g,mask,mx,my,mw,mh,s.dx*k,s.dy*k,s.blur*k,s.shadowColor);
    if(s.glow)softMask(g,mask,mx,my,mw,mh,0,0,s.glow*k,s.glowColor);
    if(outline)outline.paintOutside(g);
    g.drawImage(layer.image,x,y,w0,h0);
    return {tile,x:rect.left,y:rect.top,width:tile.width/k,height:tile.height/k};
  }

  function texture(layer,width,height,s) {
    const key=[width,height,s.stroke,s.strokeColor,s.glow,s.glowColor,s.shadow,
      s.blur,s.dx,s.dy,s.shadowColor].join('|');
    // A shallow export snapshot shares its decoded image with the editable
    // layer. Position, angle, opacity and blend changes reuse the same pixels.
    const cached=textures.get(layer.image);
    if(cached?.key===key)return cached.value;
    const value=makeTexture(layer,width,height,s,layout(width,height,s));
    textures.set(layer.image,{key,value});
    return value;
  }

  function draw(ctx,layer,width,height) {
    const opacity=number(layer,'opacity',0,100);
    if(!opacity || !layer.image || width<=0 || height<=0)return;
    const s=styles(layer);
    ctx.save();
    ctx.translate(layer.x,layer.y);
    ctx.rotate((layer.angle||0)*radians);
    ctx.globalAlpha*=opacity/100;
    ctx.globalCompositeOperation='source-over';
    if(layer.blend && layer.blend!=='normal')ctx.globalCompositeOperation=layer.blend;
    if(s.stroke || s.glow || s.shadow){
      const t=texture(layer,width,height,s);
      ctx.drawImage(t.tile,t.x,t.y,t.width,t.height);
    }else{
      ctx.drawImage(layer.image,-width/2,-height/2,width,height);
    }
    ctx.restore();
  }

  window.StickerFX=Object.freeze({defaults,draw,bounds});
})();
