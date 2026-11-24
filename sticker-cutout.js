/* Make only the light background connected to the outside of a sticker transparent. */
(() => {
  'use strict';
  const cache = new WeakMap();

  function removeWhite(image) {
    if (cache.has(image)) return cache.get(image);
    const canvas = document.createElement('canvas');
    const w = canvas.width = image.width, h = canvas.height = image.height;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h), rgba = pixels.data;
    const visited = new Uint8Array(w * h);
    const queue = new Uint32Array(w * h);
    let read = 0, write = 0;
    function enqueue(i) {
      if (visited[i]) return;
      visited[i] = 1;
      const k = i * 4;
      const min = Math.min(rgba[k],rgba[k+1],rgba[k+2]);
      const max = Math.max(rgba[k],rgba[k+1],rgba[k+2]);
      if (rgba[k+3] < 12 || (min >= 228 && max-min <= 23)) queue[write++] = i;
    }
    for (let x=0;x<w;x++) { enqueue(x); enqueue((h-1)*w+x); }
    for (let y=0;y<h;y++) { enqueue(y*w); enqueue(y*w+w-1); }
    while (read < write) {
      const i = queue[read++], k = i*4;
      const min = Math.min(rgba[k],rgba[k+1],rgba[k+2]);
      const keep = rgba[k+3] < 12 ? 0 : Math.min(1,Math.max(0,(248-min)/20));
      rgba[k+3] = Math.round(rgba[k+3]*keep);
      if (keep > 0 && keep < 1) {
        for (let channel=0;channel<3;channel++) {
          rgba[k+channel] = 255-(255-rgba[k+channel])/keep;
        }
      }
      const x = i%w;
      if (x > 0) enqueue(i-1);
      if (x < w-1) enqueue(i+1);
      if (i >= w) enqueue(i-w);
      if (i < w*(h-1)) enqueue(i+w);
    }
    ctx.putImageData(pixels,0,0);
    cache.set(image,canvas);
    return canvas;
  }
  window.StickerCutout = Object.freeze({removeWhite});
})();
