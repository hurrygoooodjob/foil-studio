(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const surface = $('surface'), canvas = $('card'), preview = $('preview');
  const ctx = canvas.getContext('2d');
  const chamber = new StarChamber();
  const state = {frame:'chrome',particles:true,image:null,name:'ASTRA',serial:'001',light:.75,tiltX:0,tiltY:0,zoom:1,panX:0,panY:0,styleProfile:null,stickers:[],material:'original',materialStrength:.75};
  const clamp = (v,low,high) => Math.max(low,Math.min(high,v));
  let aimX=0, aimY=0, roll=-4.5, aimRoll=roll, mode='tilt', drag=null;
  let frame=0, dirty=true, lastTime=0, loadSequence=0, currentUrl=null;
  let shakeTime=0, toastTimer=0, photoLoading=false;
  const dustLayer=$('dustLayer'), dustContext=dustLayer.getContext('2d');
  let dust=null;
  let photoProfile=null, referenceProfile=null, referenceName='', referenceSequence=0, frameChosen=false;
  let stickerEditor=null;
  const board=BoardView.install({hitOverhang(event){
    if(mode!=='sticker'||dust)return false;
    const box=surface.getBoundingClientRect();
    return CardStickers.hit(state,{x:(event.clientX-box.left)*720/box.width,y:(event.clientY-box.top)*1000/box.height});
  },onTool(tool){
    if(tool==='cancelDrag'){finishDrag();stickerEditor?.cancelDrag();}
    else selectMode(tool);
  }});
  surface.dataset.tool=mode;
  function updateExportButton(){
    $('exportVideo').disabled=photoLoading || !state.image;
    $('dissolve').disabled=photoLoading || !state.image;
  }
  FoilVideoDialog.install(() => ({
    state:{...state,stickers:state.stickers.map(layer=>({...layer}))}, flakes:state.particles ? chamber.flakes.map(f=>({...f})) : [],
    effect:dust?'dust':'tilt', face:dust?.face
  }));
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const hintText={
    tilt:'拖动卡片试光，拖动空白处平移画布。',
    crop:'拖动照片取景，用缩放滑杆调整照片大小。',
    sticker:'拖动贴纸摆放位置，用浮动面板调整大小和角度。',
    hand:'拖动画布平移，点「找回卡片」恢复视图。'
  };
  function drawParticles(context) {
    if(state.particles) chamber.draw(context,state.tiltX,state.tiltY,state.frame);
  }

  // Render the actual available frames with the same crop, even before selection.
  const choices = CardFrames.ids.map(id => {
    const design=CardFrames.get(id);
    const button=document.createElement('button'), thumb=document.createElement('canvas');
    button.type='button';button.dataset.frame=id;button.dataset.family=design.fromImage?'generated':'classic';button.setAttribute('aria-label',design.name);
    thumb.width=108;thumb.height=150;thumb.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=design.name;
    button.append(thumb,text);$('frameChoices').append(button);
    button.addEventListener('click',()=>{frameChosen=true;selectFrame(id);});
    return {id,button,thumb};
  });
  let thumbnailTimer=0;
  function refreshChoices() {
    clearTimeout(thumbnailTimer);
    thumbnailTimer=setTimeout(()=>{
      const b=CardStickers.bounds(state);
      for (const {id,thumb} of choices) {
        const gc=thumb.getContext('2d');
        gc.resetTransform();
        gc.clearRect(0,0,thumb.width,thumb.height);
        const scale=Math.min(thumb.width/(b.right-b.left),thumb.height/(b.bottom-b.top));
        gc.setTransform(scale,0,0,scale,(thumb.width-(b.right+b.left)*scale)/2,(thumb.height-(b.bottom+b.top)*scale)/2);
        const sample={...state,frame:id,tiltX:0,tiltY:0};
        CardFrames.draw(gc,sample,c=>{if(state.particles) chamber.draw(c,0,0,id);});
      }
    },80);
  }
  function selectFrame(id) {
    restoreCard();
    state.frame=id;
    const design=CardFrames.get(id);
    document.body.dataset.design=id;
    for(const item of choices) item.button.setAttribute('aria-pressed',String(item.id===id));
    $('designName').textContent=design.name;
    $('stockName').textContent=design.stock;
    $('stockEn').textContent=design.stockEn;
    $('particleLabel').textContent=design.particle;
    updatePhotoStyleAction();
    canvas.setAttribute('aria-label',design.name+'实时卡面');
    requestDraw();
  }
  $('particlesEnabled').addEventListener('change',e=>{
    restoreCard();
    state.particles=e.target.checked;
    $('count').disabled=!state.particles;
    refreshChoices();requestDraw();
  });
  function notify(message) {
    $('status').textContent=message;
    $('status').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>$('status').classList.remove('show'),2600);
  }
  function requestDraw() {
    dirty=true;
    if (!frame) {lastTime=0;frame=requestAnimationFrame(paint);}
  }
  function cameraDepth(bounds) {
    const reachX=Math.max(360-bounds.left,bounds.right-360);
    const reachY=Math.max(500-bounds.top,bounds.bottom-500);
    // The furthest corner must stay in front of the camera even at maximum tilt.
    return Math.max(940*720/Math.max(1,surface.clientWidth),2*(.40*reachX+.31*reachY));
  }
  function approach(current,target,alpha) {
    const next=current+(target-current)*alpha;
    return Math.abs(next-target)<.0005?target:next;
  }
  function startDust() {
    if(photoLoading || !state.image)return;
    finishDrag();
    if(!dust){
      const face=renderProjectedCard(.75,true);
      dust={face,field:CardDust.create(face),elapsed:0};
    }
    dust.elapsed=0;
    lastTime=0;
    preview.dataset.dust='playing';
    dustLayer.hidden=false;
    $('dissolve').querySelector('span').textContent='重播消散';
    $('restoreCard').hidden=false;
    $('previewStatus').textContent='正在消散';
    $('videoAction').textContent='导出消散视频';
    $('save').querySelector('span').textContent='保存原卡';
    $('hint').textContent='导出的 4 秒循环会在消散后重新聚合。';
    requestDraw();
  }
  function paintDust(time) {
    dust.elapsed+=lastTime?time-lastTime:0;
    lastTime=time;
    const progress=FoilLoopScene.dustProgress(Math.min(61,dust.elapsed*.03));
    dustContext.clearRect(0,0,dustLayer.width,dustLayer.height);
    dust.field.draw(dustContext,progress);
    preview.style.setProperty('--card-presence',String(1-progress));
    if(progress<1){
      frame=requestAnimationFrame(paint);
    }else if(preview.dataset.dust!=='gone'){
      preview.dataset.dust='gone';
      $('previewStatus').textContent='已消散';
    }
  }
  function restoreCard() {
    if(!dust)return;
    dust=null;
    delete preview.dataset.dust;
    preview.style.removeProperty('--card-presence');
    dustLayer.hidden=true;
    $('dissolve').querySelector('span').textContent='粒子消散';
    $('restoreCard').hidden=true;
    $('previewStatus').textContent='实时预览';
    $('videoAction').textContent='导出循环视频';
    $('save').querySelector('span').textContent='保存卡面';
    $('hint').textContent=hintText[mode];
    lastTime=0;
    requestDraw();
  }
  $('dissolve').onclick=startDust;
  $('restoreCard').onclick=()=>{
    restoreCard();
    $('dissolve').focus({preventScroll:true});
  };
  function paint(time) {
    frame=0;
    if(dust){paintDust(time);return;}
    const dt=lastTime?Math.min((time-lastTime)/1000,.05):1/60;
    lastTime=time;
    const alpha=reduced.matches?1:1-Math.exp(-dt*18);
    shakeTime=Math.max(0,shakeTime-dt);
    const shake=shakeTime&&!reduced.matches?Math.sin(shakeTime*47)*shakeTime*.42:0;
    const before=[state.tiltX,state.tiltY,roll];
    state.tiltX=approach(state.tiltX,mode==='crop'?0:clamp(aimX+shake,-1,1),alpha);
    state.tiltY=approach(state.tiltY,mode==='crop'?0:aimY,alpha);
    roll=approach(roll,mode==='crop'?0:aimRoll,alpha);
    const changed=before[0]!==state.tiltX||before[1]!==state.tiltY||before[2]!==roll;
    const moving=state.particles && chamber.step(dt,state.tiltX,state.tiltY,state.frame);
    if(changed||dirty||moving){
      const b=CardStickers.bounds(state);
      const width=b.right-b.left,height=b.bottom-b.top;
      const density=Math.min(1,2400/Math.max(width,height));
      CardFrames.paint(ctx,state,drawParticles,b,density);
      surface.style.perspective=(cameraDepth(b)*surface.clientWidth/720)+'px';
      canvas.style.left=(b.left/720*100)+'%';
      canvas.style.top=(b.top/1000*100)+'%';
      canvas.style.width=(width/720*100)+'%';
      canvas.style.height=(height/1000*100)+'%';
      surface.style.setProperty('--lean-x',(state.tiltX*23)+'deg');
      surface.style.setProperty('--lean-y',(-state.tiltY*18)+'deg');
      surface.style.setProperty('--roll',roll+'deg');
    }
    dirty=false;
    if(changed||moving||shakeTime) frame=requestAnimationFrame(paint);
  }
  function finishDrag() {
    if(!drag)return;
    const id=drag.id;
    drag=null;
    if(mode==='crop')refreshChoices();
    surface.classList.remove('is-dragging');
    if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
  }
  function selectMode(next) {
    if(next!=='hand')restoreCard();
    if(next!=='sticker')stickerEditor?.cancelDrag();
    finishDrag();mode=next;
    const crop=mode==='crop',sticker=mode==='sticker';
    surface.dataset.tool=mode;
    board.setHand(mode==='hand');
    $('cropMode').setAttribute('aria-pressed',String(crop));
    $('tiltMode').setAttribute('aria-pressed',String(mode==='tilt'));
    $('stickerMode').setAttribute('aria-pressed',String(sticker));
    $('cropControls').hidden=!crop;
    surface.classList.toggle('cropping',crop);
    if(sticker || crop){
      aimX=aimY=aimRoll=0;
      state.tiltX=state.tiltY=roll=0;
      shakeTime=0;
      surface.style.setProperty('--lean-x','0deg');
      surface.style.setProperty('--lean-y','0deg');
      surface.style.setProperty('--roll','0deg');
    }
    if(sticker&&($('tab-stickers').getAttribute('aria-selected')!=='true'||$('inspector').hidden))board.showTab('stickers');
    surface.setAttribute('aria-label',hintText[mode]);
    $('hint').textContent=hintText[mode];
    requestDraw();
  }
  function center() {restoreCard();finishDrag();aimX=0;aimY=0;aimRoll=0;shakeTime=0;requestDraw();}
  function shake() {
    restoreCard();
    if(!state.particles || !chamber.flakes.length){notify('显示夹层装饰并增加数量后即可摇动');return;}
    if(mode!=='tilt')selectMode('tilt');
    chamber.shake(reduced.matches ? .55 : 1);
    shakeTime=.43;requestDraw();
  }
  function cropTravel() {
    const i=state.image;
    if(!i)return {x:0,y:0};
    const fit=ChromeCard.fitPhoto(i,state.zoom);
    return {x:fit.dw-fit.w,y:fit.dh-fit.h};
  }
  surface.addEventListener('pointerdown',e=>{
    if(drag||!e.isPrimary||e.button!==0||(mode!=='tilt'&&mode!=='crop'))return;
    restoreCard();
    e.preventDefault();surface.classList.add('pointer-focus');surface.focus({preventScroll:true});
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,tiltX:aimX,tiltY:aimY,panX:state.panX,panY:state.panY};
    surface.setPointerCapture(e.pointerId);surface.classList.add('is-dragging');
  });
  surface.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    const {width:w,height:h}=surface.getBoundingClientRect();
    if(mode==='tilt'){
      aimX=clamp(drag.tiltX+dx/(w*.55),-1,1);
      aimY=clamp(drag.tiltY+dy/(h*.5),-1,1);
      aimRoll=aimX*3.8;
    }else{
      const travel=cropTravel();
      state.panX=travel.x>.01?clamp(drag.panX-2*dx*720/(w*travel.x),-1,1):0;
      state.panY=travel.y>.01?clamp(drag.panY-2*dy*1000/(h*travel.y),-1,1):0;
    }
    requestDraw();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    surface.addEventListener(event,e=>{if(drag?.id===e.pointerId)finishDrag();});
  }
  window.addEventListener('blur',finishDrag);
  window.addEventListener('resize',requestDraw);
  document.addEventListener('keydown',()=>surface.classList.remove('pointer-focus'));
  surface.addEventListener('blur',()=>surface.classList.remove('pointer-focus'));
  surface.addEventListener('keydown',e=>{
    if(mode==='sticker'||mode==='hand')return;
    if(e.key==='Home'){e.preventDefault();center();return;}
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(!directions[e.key])return;
    e.preventDefault();
    restoreCard();
    const [dx,dy]=directions[e.key];
    if(mode==='tilt'){
      aimX=clamp(aimX+dx*.22,-1,1);aimY=clamp(aimY+dy*.22,-1,1);aimRoll=aimX*3.8;
    }else{
      state.panX=clamp(state.panX-dx*.14,-1,1);state.panY=clamp(state.panY-dy*.14,-1,1);refreshChoices();
    }
    requestDraw();
  });
  $('tiltMode').onclick=()=>selectMode('tilt');
  $('cropMode').onclick=()=>selectMode('crop');
  $('stickerMode').onclick=()=>selectMode('sticker');
  $('tab-stickers').addEventListener('click',()=>selectMode('sticker'));
  $('center').onclick=center;
  $('shake').onclick=shake;
  stickerEditor=CardStickers.install({
    panel:$('stickerPanel'),surface,state,notify,
    enterStickerMode:()=>selectMode('sticker'),
    onChange(){restoreCard();refreshChoices();requestDraw();}
  });
  for(const field of ['name','serial']){
    $(field).addEventListener('input',()=>{restoreCard();state[field]=$(field).value;refreshChoices();requestDraw();});
  }
  function range(id,format,apply){
    const el=$(id);
    function update(){
      restoreCard();
      const n=Number(el.value);
      el.style.setProperty('--fill',((n-Number(el.min))*100/(Number(el.max)-Number(el.min)))+'%');
      $(id+'Value').textContent=format(n);el.setAttribute('aria-valuetext',format(n));apply(n);refreshChoices();requestDraw();
    }
    el.addEventListener('input',update);update();return update;
  }
  range('light',v=>v+'%',v=>state.light=v/100);
  range('materialStrength',v=>v+'%',v=>state.materialStrength=v/100);
  $('cardMaterial').onchange=e=>{
    restoreCard();
    state.material=e.target.value;
    $('surfaceFinishControls').hidden=state.material==='original';
    refreshChoices();requestDraw();
  };
  range('count',v=>v+' 枚',v=>chamber.setCount(v));
  const updateZoom=range('zoom',v=>(v/100).toFixed(2)+'×',v=>state.zoom=v/100);
  function decodeImage(src) {
    return new Promise((resolve,reject)=>{
      const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('image decode'));i.src=src;
    });
  }
  function updatePhotoStyleAction() {
    $('usePhotoStyle').textContent=referenceProfile?'使用卡面照片':'应用照片风格';
    $('usePhotoStyle').disabled=!state.image || (!referenceProfile&&CardFrames.get(state.frame).fromImage);
  }
  function syncStyleProfile() {
    state.styleProfile=referenceProfile||photoProfile;
    const profile=state.styleProfile;
    const source=referenceProfile?'参考图 · '+referenceName:'卡面照片';
    $('styleDescription').textContent=profile?source+' · '+profile.description:source;
    $('styleSwatches').replaceChildren();
    for(const color of profile?.palette||[]){
      const swatch=document.createElement('i');
      swatch.style.backgroundColor=color;
      swatch.title=color;
      $('styleSwatches').append(swatch);
    }
    updatePhotoStyleAction();
    refreshChoices();requestDraw();
  }
  async function loadReference(file) {
    if(!file)return;
    const token=++referenceSequence;
    const url=URL.createObjectURL(file);
    try{
      const img=await decodeImage(url);
      if(token!==referenceSequence)return;
      const profile=StyleFrames.analyze(img);
      restoreCard();
      referenceName=file.name;
      referenceProfile=profile;
      syncStyleProfile();
      if(!CardFrames.get(state.frame).fromImage)selectFrame('editorial');
      notify('已根据参考图生成三款边框');
    }catch{
      if(token===referenceSequence)notify('参考图读取失败，请选择可打开的图片');
    }finally{URL.revokeObjectURL(url);}
  }
  $('uploadReference').onclick=()=>$('styleReference').click();
  $('styleReference').onchange=e=>{
    const file=e.target.files[0];e.target.value='';loadReference(file);
  };
  $('usePhotoStyle').onclick=()=>{
    referenceSequence++;
    referenceProfile=null;referenceName='';
    restoreCard();syncStyleProfile();
    if(!CardFrames.get(state.frame).fromImage)selectFrame('editorial');
  };
  async function loadPhoto(file) {
    if(!file)return;
    if(file.type&&!file.type.startsWith('image/')){notify('请选择照片文件，例如 JPG、PNG 或 WebP');return;}
    const token=++loadSequence;
    photoLoading=true;updateExportButton();
    const url=URL.createObjectURL(file);
    try{
      const img=await decodeImage(url);
      if(token!==loadSequence){URL.revokeObjectURL(url);return;}
      const profile=StyleFrames.analyze(img);
      if(currentUrl)URL.revokeObjectURL(currentUrl);
      currentUrl=url;state.image=img;$('thumb').src=url;
      photoProfile=profile;syncStyleProfile();
      state.panX=0;state.panY=0;$('zoom').value=100;updateZoom();
      if(!frameChosen&&!CardFrames.get(state.frame).fromImage)selectFrame('editorial');
      selectMode('tilt');center();requestDraw();
      notify(referenceProfile?'已更换卡面照片，沿用参考图风格':'照片已装入，原图风格边框已更新');
    }catch{URL.revokeObjectURL(url);if(token===loadSequence)notify('无法读取这张照片，请试试 JPG、PNG 或 WebP');}
    finally{if(token===loadSequence){photoLoading=false;updateExportButton();}}
  }
  $('upload').onclick=()=>$('file').click();
  $('file').addEventListener('change',()=>{const f=$('file').files[0];$('file').value='';loadPhoto(f);});
  for(const zone of [$('upload'),$('boardViewport')]){
    for(const ev of ['dragenter','dragover'])zone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();$('upload').classList.add('over');});
    zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))$('upload').classList.remove('over');});
    zone.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();$('upload').classList.remove('over');
      if(zone===$('boardViewport')&&mode==='sticker')stickerEditor.addFiles(e.dataTransfer.files);
      else loadPhoto(e.dataTransfer.files[0]);
    });
  }
  decodeImage(window.DEFAULT_PORTRAIT).then(img=>{
    if(!state.image){photoProfile=StyleFrames.analyze(img);state.image=img;$('thumb').src=img.src;updateExportButton();syncStyleProfile();}
  }).catch(()=>notify('可上传自己的照片开始制作'));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTime=0;finishDrag();}
    else requestDraw();
  });

  // Invert the same camera projection as the CSS preview. A saved card keeps
  // its current tilt, foil highlight and individual flakes on a transparent canvas.
  function renderProjectedCard(preferredScale, framed=false) {
    // Project relative to the card's original centre, even if a layer extends
    // the artwork asymmetrically. Board zoom and pan are deliberately absent.
    const b=CardStickers.bounds(state), rad=Math.PI/180;
    const pitch=-state.tiltY*18*rad,yaw=state.tiltX*23*rad,twist=roll*rad;
    const cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const cz=Math.cos(twist),sz=Math.sin(twist);
    const ax=cz*cy-sz*sx*sy,bx=-sz*cx,ay=sz*cy+cz*sx*sy,by=cz*cx;
    const depth=cameraDepth(b),az=-cx*sy/depth,bz=sx/depth;
    function projected(x,y){
      const u=x-360,v=y-500,den=1-az*u-bz*v;
      return [(ax*u+bx*v)/den,(ay*u+by*v)/den];
    }
    const corners=[projected(b.left,b.top),projected(b.right,b.top),projected(b.right,b.bottom),projected(b.left,b.bottom)];
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const spanX=maxX-minX,spanY=maxY-minY;
    const out=document.createElement('canvas');
    let scale=preferredScale, left, top;
    if(framed){
      // Fit the complete design and reserve a margin for the drifting dust.
      out.width=dustLayer.width;out.height=dustLayer.height;
      scale=Math.min(scale,(out.width-80)/spanX,(out.height-96)/spanY);
      left=clamp(-out.width/(2*scale),maxX-(out.width-40)/scale,minX-40/scale);
      top=clamp(-out.height/(2*scale),maxY-(out.height-48)/scale,minY-48/scale);
      // In the editor the fitted movie frame must still overlay the actual card.
      dustLayer.style.left=((left+360)/720*100)+'%';
      dustLayer.style.top=((top+500)/1000*100)+'%';
      dustLayer.style.width=(out.width/scale/720*100)+'%';
      dustLayer.style.height=(out.height/scale/1000*100)+'%';
      dustLayer.style.transform='none';
    }else{
      // Bound memory for several very large rotated assets while retaining the whole silhouette.
      scale=Math.min(scale,4094/Math.max(spanX,spanY),Math.sqrt(10000000/(spanX*spanY)));
      const leftPixel=Math.floor(minX*scale),topPixel=Math.floor(minY*scale);
      left=leftPixel/scale;top=topPixel/scale;
      out.width=Math.ceil(maxX*scale)-leftPixel;out.height=Math.ceil(maxY*scale)-topPixel;
    }
    const flat=document.createElement('canvas');
    const fc=flat.getContext('2d',{willReadFrequently:true});
    const density=Math.min(scale,4094/Math.max(b.right-b.left,b.bottom-b.top));
    CardFrames.paint(fc,state,drawParticles,b,density);
    const w=flat.width,h=flat.height,src=fc.getImageData(0,0,w,h).data;
    const oc=out.getContext('2d'),image=oc.createImageData(out.width,out.height),dest=image.data;
    for(let row=0;row<out.height;row++){
      const py=top+(row+.5)/scale,c=ay+py*az,d=by+py*bz;
      for(let col=0;col<out.width;col++){
        const px=left+(col+.5)/scale,a=ax+px*az,m=bx+px*bz,det=a*d-m*c;
        const u=((px*d-m*py)/det+360-b.left)*density-.5;
        const v=((a*py-px*c)/det+500-b.top)*density-.5;
        if(u<0 || u>=w-1 || v<0 || v>=h-1)continue;
        const ux=Math.floor(u),vy=Math.floor(v),fx=u-ux,fy=v-vy;
        const i=(vy*w+ux)*4,k=(row*out.width+col)*4;
        // Interpolate premultiplied colour for clean translucent edges and shadows.
        const a0=(1-fx)*(1-fy)*src[i+3],a1=fx*(1-fy)*src[i+7];
        const a2=(1-fx)*fy*src[i+w*4+3],a3=fx*fy*src[i+w*4+7];
        const sum=a0+a1+a2+a3;
        if(!sum)continue;
        dest[k+3]=sum;
        for(let ch=0;ch<3;ch++){
          dest[k+ch]=(src[i+ch]*a0+src[i+ch+4]*a1+src[i+w*4+ch]*a2+src[i+w*4+ch+4]*a3)/sum;
        }
      }
    }
    oc.putImageData(image,0,0);return out;
  }
  $('save').onclick=()=>{
    const button=$('save');button.disabled=true;
    try{
      const out=renderProjectedCard(1.5);
      const filename=CardFrames.filename(state);
      out.toBlob(blob=>{
        button.disabled=false;
        if(!blob){notify('保存失败，请重试');return;}
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=filename+'.png';document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),15000);notify('已生成透明 PNG 卡面');
      },'image/png');
    }catch{button.disabled=false;notify('保存失败，请重试');}
  };
  selectFrame('chrome');
  const initialMaterial=new URLSearchParams(location.search).get('material');
  if (Array.from($('cardMaterial').options).some(option=>option.value===initialMaterial)) {
    $('cardMaterial').value=initialMaterial;
    $('cardMaterial').dispatchEvent(new Event('change'));
    board.showTab('photo');
  }
})();
