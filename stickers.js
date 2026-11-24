/* Editable raster layers in the coordinate system of the printed card. */
(() => {
  'use strict';
  const WIDTH = 720, HEIGHT = 1000, radians = Math.PI / 180;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const corners = [[.83,.1],[.16,.84],[.17,.12],[.82,.85]];

  function dimensions(layer) {
    const image = layer.image;
    const scale = Math.min(WIDTH / image.width, HEIGHT / image.height) * layer.size / 100;
    return {width:image.width * scale, height:image.height * scale};
  }

  function draw(ctx, state) {
    for (const layer of state.stickers || []) {
      const {width, height} = dimensions(layer);
      StickerFX.draw(ctx,layer,width,height);
    }
  }

  function bounds(state) {
    const area={left:0,top:0,right:WIDTH,bottom:HEIGHT};
    for (const layer of state.stickers || []) {
      if (layer.opacity===0) continue;
      const {width,height}=dimensions(layer);
      const rect=StickerFX.bounds(layer,width,height);
      area.left=Math.min(area.left,Math.floor(rect.left));
      area.top=Math.min(area.top,Math.floor(rect.top));
      area.right=Math.max(area.right,Math.ceil(rect.right));
      area.bottom=Math.max(area.bottom,Math.ceil(rect.bottom));
    }
    return area;
  }

  function fittedCanvas(image, limit) {
    const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
    const scale = Math.min(1, limit / Math.max(w,h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }

  function makeAsset(image) {
    const small=fittedCanvas(image,96);
    // Keep a finer hit mask than the thumbnail for thin outlines and lettering.
    const maskImage=fittedCanvas(image,384);
    const pixels=maskImage.getContext('2d').getImageData(0,0,maskImage.width,maskImage.height).data;
    const alpha=new Uint8Array(maskImage.width*maskImage.height);
    for(let i=0;i<alpha.length;i++) alpha[i]=pixels[i*4+3];
    return {image,thumbnail:small.toDataURL('image/png'),mask:{width:maskImage.width,height:maskImage.height,alpha}};
  }

  async function readAsset(file) {
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type) &&
        (file.type || !/\.(png|jpe?g|webp)$/i.test(file.name))) throw new Error('format');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve,reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      return makeAsset(fittedCanvas(img,3000));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function contains(layer, point) {
    const {width,height} = dimensions(layer);
    const dx=point.x-layer.x, dy=point.y-layer.y;
    const cos=Math.cos(layer.angle*radians), sin=Math.sin(layer.angle*radians);
    const u=(dx*cos+dy*sin)/width+.5, v=(-dx*sin+dy*cos)/height+.5;
    if (u<0 || u>=1 || v<0 || v>=1) return false;
    const mask = layer.mask;
    return !mask || mask.alpha[Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width)] > 10;
  }

  function hit(state,point) {
    const layers=state.stickers || [];
    for(let i=layers.length-1;i>=0;i--) {
      if(layers[i].opacity!==0 && contains(layers[i],point)) return layers[i];
    }
    return null;
  }

  function styleRange(key,title,min,max,unit) {
    const id='sticker'+key[0].toUpperCase()+key.slice(1);
    return '<label class="sticker-range"><span>'+title+'</span><input type="range" id="'+id+'" data-style="'+key+'" data-unit="'+unit+'" min="'+min+'" max="'+max+'" step="1"><output for="'+id+'"></output></label>';
  }

  function styleEffect(key,title,ranges) {
    const id='sticker'+key[0].toUpperCase()+key.slice(1);
    return '<div class="sticker-effect"><div class="sticker-effect-head"><label><input id="'+id+'On" type="checkbox" data-style="'+key+'On" aria-controls="'+id+'Detail">'+title+'</label><input id="'+id+'Color" type="color" aria-label="'+title+'颜色" data-style="'+key+'Color"></div><div class="sticker-effect-controls" id="'+id+'Detail" hidden>'+ranges+'</div></div>';
  }

  function install({panel,surface,state,onChange,enterStickerMode,notify}) {
    state.stickers ||= [];
    const section = document.createElement('div');
    section.className='sticker-editor';
    section.innerHTML = `
      <input type="file" id="stickerFiles" accept="image/png,image/jpeg,image/webp" multiple hidden>
      <button type="button" id="addSticker" class="sticker-upload"><svg aria-hidden="true"><use href="#i-upload"/></svg><span>上传贴纸素材<small>透明 PNG、WebP 或 JPG · 可多选</small></span></button>
      <div id="stickerLayers" class="sticker-layers" role="group" aria-label="贴纸图层" hidden></div>
      <div class="sticker-properties" hidden>
        <label class="sticker-name">图层名称<input id="stickerName" type="text" maxlength="48" autocomplete="off"></label>
        <label class="sticker-range"><span>大小</span><input type="range" id="stickerScale" min="3" max="200" step="1"><output for="stickerScale"></output></label>
        <label class="sticker-range"><span>角度</span><input type="range" id="stickerAngle" min="-180" max="180" step="1"><output for="stickerAngle"></output></label>
        <div class="sticker-order"><button type="button" id="stickerFit" title="素材居中，按比例适配整个卡面">适配整卡</button><button type="button" id="stickerForward" title="上移一层">上移一层</button><button type="button" id="stickerBackward" title="下移一层">下移一层</button><button type="button" id="stickerRemove">移除</button></div>
        <label class="sticker-cutout" title="去除与图片边缘相连的白色背景，保留独立的白色细节"><input id="stickerRemoveWhite" type="checkbox">去除白底</label>
        <div class="sticker-styles">
          <h3>图层样式</h3>
          <label class="sticker-blend">混合模式<select id="stickerBlend" data-style="blend">
            <option value="source-over">正常</option><option value="multiply">正片叠底</option><option value="screen">滤色</option><option value="overlay">叠加</option><option value="soft-light">柔光</option><option value="hard-light">强光</option><option value="darken">变暗</option><option value="lighten">变亮</option><option value="difference">差值</option>
          </select></label>
          ${styleRange('opacity','不透明度',0,100,'%')}
          ${styleEffect('stroke','描边',styleRange('strokeWidth','宽度',0,20,' px'))}
          ${styleEffect('glow','外发光',styleRange('glowRadius','半径',0,40,' px'))}
          ${styleEffect('shadow','投影',styleRange('shadowBlur','模糊',0,32,' px')+styleRange('shadowX','水平偏移',-36,36,' px')+styleRange('shadowY','垂直偏移',-36,36,' px'))}
        </div>
      </div>`;
    panel.append(section);
    const byId = id => section.querySelector('#'+id);
    const files=byId('stickerFiles'), upload=byId('addSticker'), list=byId('stickerLayers');
    const name=byId('stickerName'), size=byId('stickerScale'), angle=byId('stickerAngle');
    const properties=section.querySelector('.sticker-properties');
    const styleInputs=Array.from(section.querySelectorAll('[data-style]'));
    const cutoutAssets=new WeakMap();
    const viewport=surface.closest('#boardViewport') || surface;
    const selection=document.createElement('div');
    selection.className='sticker-outline'; selection.hidden=true; selection.setAttribute('aria-hidden','true');
    surface.append(selection);
    let selected=null, drag=null, nextId=state.stickers.reduce((id,layer)=>Math.max(id,Number(layer.id)||0),0);
    let importQueue=Promise.resolve();

    function showSelection() {
      selection.hidden=!selected;
      if (!selected) return;
      const box=dimensions(selected);
      selection.style.left=selected.x/WIDTH*100+'%';
      selection.style.top=selected.y/HEIGHT*100+'%';
      selection.style.width=box.width/WIDTH*100+'%';
      selection.style.height=box.height/HEIGHT*100+'%';
      selection.style.transform='translate(-50%, -50%) rotate('+selected.angle+'deg)';
    }

    function showTransform() {
      properties.hidden=!selected;
      if (!selected) return;
      if (document.activeElement!==name || name.value!==selected.name) name.value=selected.name;
      size.value=selected.size; angle.value=selected.angle;
      showRange(size,'%'); showRange(angle,'°');
      byId('stickerRemoveWhite').checked=Boolean(selected.removeWhite);
      for(const input of styleInputs) {
        const key=input.dataset.style, value=selected[key] ?? StickerFX.defaults[key];
        if(input.type==='checkbox'){
          input.checked=value;
          byId(input.getAttribute('aria-controls')).hidden=!value;
          byId(input.id.replace('On','Color')).disabled=!value;
        }else{
          input.value=value;
          if(input.type==='range') showRange(input,input.dataset.unit);
        }
      }
      const i=state.stickers.indexOf(selected);
      byId('stickerBackward').disabled=i<=0;
      byId('stickerForward').disabled=i===state.stickers.length-1;
    }

    function showRange(input,unit) {
      const value=input.value+unit;
      section.querySelector('output[for="'+input.id+'"]').textContent=value;
      input.setAttribute('aria-valuetext',value);
      input.style.setProperty('--fill',((input.value-input.min)/(input.max-input.min))*100+'%');
    }

    function refresh() {
      if (!state.stickers.includes(selected)) selected=null;
      list.hidden=!state.stickers.length;
      const rows=Array.from(state.stickers).reverse().map(layer=>{
        const row=document.createElement('button');
        row.type='button'; row.dataset.sticker=String(layer.id);
        row.setAttribute('aria-pressed',String(layer===selected));
        const thumb=document.createElement('img'); thumb.alt=''; thumb.src=layer.thumbnail;
        const title=document.createElement('span'); title.textContent=layer.name || '未命名贴纸';
        row.append(thumb,title);
        row.onclick=()=>{enterStickerMode();choose(layer);};
        return row;
      });
      list.replaceChildren(...rows);
      showSelection();
      showTransform();
    }

    function choose(layer) {
      selected=layer;
      for(const btn of list.children)btn.setAttribute('aria-pressed',String(Boolean(selected) && btn.dataset.sticker===String(selected.id)));
      showSelection();
      showTransform();
    }

    async function addFiles(selection) {
      const additions=[];
      for(const file of selection) {
        try {
          const asset=await readAsset(file);
          const anchor=corners[(state.stickers.length + additions.length) % corners.length];
          additions.push({...asset,id:++nextId,name:file.name.replace(/\.[^.]+$/,'').slice(0,48),
            x:WIDTH*anchor[0],y:HEIGHT*anchor[1],size:23,angle:0});
        } catch { /* Report an unsupported or undecodable file without discarding siblings. */ }
      }
      if(additions.length) {
        state.stickers.push(...additions);
        enterStickerMode(); selected=additions[additions.length-1];
        refresh(); onChange();
      }
      if(additions.length!==selection.length) notify(additions.length
        ? '已添加 '+additions.length+' 张贴纸，其他文件无法读取。'
        : '无法读取贴纸，请选用 PNG、WebP 或 JPG 图片。');
    }
    function queueFiles(filesToAdd) {
      const selection=Array.from(filesToAdd);
      if(selection.length)importQueue=importQueue.then(()=>addFiles(selection),()=>addFiles(selection));
      return importQueue;
    }
    upload.onclick=()=>files.click();
    files.onchange=()=>{const selection=Array.from(files.files);files.value='';queueFiles(selection);};
    for(const event of ['dragenter','dragover'])upload.addEventListener(event,e=>{
      e.preventDefault();e.stopPropagation();upload.classList.add('over');
    });
    upload.addEventListener('dragleave',e=>{if(!upload.contains(e.relatedTarget))upload.classList.remove('over');});
    upload.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();upload.classList.remove('over');queueFiles(Array.from(e.dataTransfer.files));
    });

    name.oninput=()=>{
      if(!selected)return;
      selected.name=name.value;
      const row=Array.from(list.children).find(button=>button.dataset.sticker===String(selected.id));
      if(row) row.querySelector('span').textContent=selected.name||'未命名贴纸';
      onChange();
    };
    byId('stickerRemoveWhite').onchange=e=>{
      if(!selected)return;
      const source=selected.originalAsset ||= {image:selected.image,thumbnail:selected.thumbnail,mask:selected.mask};
      let asset=source;
      if(e.target.checked){
        if(!cutoutAssets.has(source.image)){
          cutoutAssets.set(source.image,makeAsset(StickerCutout.removeWhite(source.image)));
        }
        asset=cutoutAssets.get(source.image);
      }
      Object.assign(selected,asset,{removeWhite:e.target.checked});
      enterStickerMode();refresh();onChange();
    };
    for(const input of styleInputs) {
      const event=input.type==='checkbox'||input.tagName==='SELECT'?'change':'input';
      input.addEventListener(event,()=>{
        if(!selected)return;
        const value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
        selected[input.dataset.style]=value;
        enterStickerMode();showTransform();onChange();
      });
    }
    for(const [input,key] of [[size,'size'],[angle,'angle']])input.oninput=()=>{
      if(!selected)return;
      enterStickerMode();
      selected[key]=Number(input.value);showTransform();showSelection();onChange();
    };

    function reorder(delta) {
      const i=state.stickers.indexOf(selected),next=i+delta;
      if(i<0 || next<0 || next>=state.stickers.length)return;
      [state.stickers[i],state.stickers[next]]=[state.stickers[next],state.stickers[i]];
      enterStickerMode();refresh();onChange();
    }
    function removeSelected() {
      const i=state.stickers.indexOf(selected);
      if(i<0)return;
      state.stickers.splice(i,1);
      selected=state.stickers[Math.min(i,state.stickers.length-1)]||null;
      refresh();onChange();
    }
    byId('stickerForward').onclick=()=>reorder(1);
    byId('stickerBackward').onclick=()=>reorder(-1);
    byId('stickerRemove').onclick=removeSelected;
    byId('stickerFit').onclick=()=>{
      if(!selected)return;
      enterStickerMode();
      Object.assign(selected,{x:WIDTH/2,y:HEIGHT/2,size:100,angle:0});
      showTransform();showSelection();onChange();
    };

    function cardPoint(e) {
      const rect=surface.getBoundingClientRect();
      return {x:(e.clientX-rect.left)*WIDTH/rect.width,y:(e.clientY-rect.top)*HEIGHT/rect.height};
    }
    function moveTo(layer,x,y) {
      const {width,height}=dimensions(layer);
      const cos=Math.abs(Math.cos(layer.angle*radians)),sin=Math.abs(Math.sin(layer.angle*radians));
      // Keep a small attachment to the base card, while allowing a protruding
      // tab, die-cut border or large rotated sticker to cross every edge.
      const slackX=Math.max(0,(width*cos+height*sin)/2-12);
      const slackY=Math.max(0,(width*sin+height*cos)/2-12);
      layer.x=clamp(x,-slackX,WIDTH+slackX); layer.y=clamp(y,-slackY,HEIGHT+slackY);
      showSelection();onChange();
    }
    function endDrag() {
      if(!drag)return;
      const id=drag.id;drag=null;
      if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
    }
    viewport.addEventListener('pointerdown',e=>{
      if(e.defaultPrevented || surface.dataset.tool!=='sticker' || e.button!==0 || !e.isPrimary)return;
      const point=cardPoint(e);
      const target=hit(state,point);
      if(!target && !surface.contains(e.target))return;
      e.preventDefault(); e.stopImmediatePropagation(); surface.focus({preventScroll:true});
      choose(target||null);
      if(!target)return;
      drag={id:e.pointerId,layer:target,offsetX:point.x-target.x,offsetY:point.y-target.y};
      surface.setPointerCapture(e.pointerId);
    },true);
    surface.addEventListener('pointermove',e=>{
      if(!drag || drag.id!==e.pointerId)return;
      if(surface.dataset.tool!=='sticker'){endDrag();return;}
      e.preventDefault();e.stopImmediatePropagation();
      const point=cardPoint(e);moveTo(drag.layer,point.x-drag.offsetX,point.y-drag.offsetY);
    },true);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{
      if(!drag || drag.id!==e.pointerId)return;
      e.stopImmediatePropagation();endDrag();
    },true);
    surface.addEventListener('keydown',e=>{
      if(surface.dataset.tool!=='sticker' || !selected || e.ctrlKey || e.metaKey || e.altKey)return;
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(directions[e.key]) {
        e.preventDefault();e.stopImmediatePropagation();
        const [dx,dy]=directions[e.key],step=e.shiftKey?10:1;
        moveTo(selected,selected.x+dx*step,selected.y+dy*step);
      }else if(e.key==='Delete' || e.key==='Backspace'){
        e.preventDefault();e.stopImmediatePropagation();removeSelected();
      }
    },true);
    window.addEventListener('blur',endDrag);
    refresh();
    return {refresh,addFiles:queueFiles,cancelDrag:endDrag};
  }

  window.CardStickers=Object.freeze({draw,bounds,hit,install});
})();
