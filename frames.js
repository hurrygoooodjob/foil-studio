/* One photo placement and one frame selection for the editor, thumbnails and exports. */
(() => {
  'use strict';
  const designs = {
    chrome: {name:'银铬典藏卡', stock:'银铬镭射箔', stockEn:'CHROME HOLOFOIL', particle:'银箔星片', renderer:ChromeCard},
    collage: {name:'千禧拼贴卡', stock:'拼贴贴纸与彩箔', stockEn:'CUT & PASTE', particle:'糖果纸屑', renderer:CollageCard},
    denim: {name:'丹宁应援卡', stock:'靛蓝斜纹丹宁', stockEn:'INDIGO TWILL', particle:'透光珠片', renderer:DenimCard},
    editorial: {name:'套色版画', stock:'原图套色印刷', stockEn:'OVERPRINT', particle:'银箔星片', renderer:StyleFrames.renderers.editorial, fromImage:true},
    prism: {name:'折光棱镜', stock:'折射彩箔', stockEn:'PRISM FOIL', particle:'银箔星片', renderer:StyleFrames.renderers.prism, fromImage:true},
    echo: {name:'原图回纹', stock:'图纹采样织带', stockEn:'IMAGE ECHO', particle:'银箔星片', renderer:StyleFrames.renderers.echo, fromImage:true}
  };
  function get(id) { return designs[id] || designs.chrome; }
  function draw(ctx, state, particles) {
    const renderer=get(state.frame).renderer;
    renderer.draw(ctx,state,particles);
    if(state.material && state.material!=='original' && state.materialStrength>0){
      CardMaterials.finish(ctx,state,renderer.geometry(state));
    }
    CardStickers.draw(ctx,state);
  }
  // bounds stay in the 720 × 1000 card coordinate system, including any overhang.
  function paint(ctx,state,particles,bounds,scale=1) {
    const width=Math.ceil((bounds.right-bounds.left)*scale);
    const height=Math.ceil((bounds.bottom-bounds.top)*scale);
    if(ctx.canvas.width!==width)ctx.canvas.width=width;
    if(ctx.canvas.height!==height)ctx.canvas.height=height;
    ctx.resetTransform();
    ctx.clearRect(0,0,width,height);
    ctx.setTransform(scale,0,0,scale,-bounds.left*scale,-bounds.top*scale);
    draw(ctx,state,particles);
    ctx.resetTransform();
  }
  function filename(state) {
    const title=(state.name.trim() || '').replace(/[\\/:*?"<>|]/g,'_');
    return (title ? title+'-' : '')+get(state.frame).name;
  }
  window.CardFrames = Object.freeze({ids:Object.keys(designs),get,draw,paint,filename});
})();
