(() => {
  'use strict';
  const base = document.currentScript?.src || document.baseURI;
  const libraries = new Map();
  let nextFile = 0;

  function localLibrary(file, name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!libraries.has(file)) {
      const loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('vendor/' + file, base).href;
        script.onload = () => window[name] ? resolve(window[name]) : reject(new Error('编码组件无法初始化'));
        script.onerror = () => reject(new Error('找不到本机视频编码组件，请保留完整的 Demo 文件夹'));
        document.head.append(script);
      }).catch(error => {
        libraries.delete(file);
        throw error;
      });
      libraries.set(file, loading);
    }
    return libraries.get(file);
  }

  function checkAbort(signal) {
    if (signal?.aborted) throw new DOMException('视频导出已取消', 'AbortError');
  }

  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

  async function nativeConfig({width, height}, fps) {
    if (!window.VideoEncoder || !window.VideoFrame) return null;
    // Baseline AVC has no presentation/decode reordering. Each submitted
    // frame maps to exactly one entry at its authored presentation time.
    const config = {
      codec: 'avc1.42001f', width, height, bitrate: 7_500_000, framerate: fps,
      avc: {format: 'avc'}, latencyMode: 'quality'
    };
    return (await VideoEncoder.isConfigSupported(config)).supported ? config : null;
  }

  async function nativeEncode(job, config) {
    const lib = await localLibrary('mp4-muxer-5.2.2.js', 'Mp4Muxer');
    checkAbort(job.signal);
    const target = new lib.ArrayBufferTarget();
    const muxer = new lib.Muxer({
      target, video: {codec:'avc', width:config.width, height:config.height, frameRate:job.fps},
      fastStart:'in-memory'
    });
    let outputFrames = 0;
    let outputError;
    const encoder = new VideoEncoder({
      output(chunk, metadata) {
        if (outputError) return;
        try {
          muxer.addVideoChunk(chunk, metadata);
          outputFrames++;
        } catch(error) { outputError = error; }
      },
      error(error) { outputError = error; }
    });
    const close = () => { if (encoder.state !== 'closed') encoder.close(); };
    job.signal?.addEventListener('abort', close, {once:true});
    try {
      encoder.configure(config);
      for (let i=0; i<job.frameCount; i++) {
        checkAbort(job.signal);
        if (outputError) throw outputError;
        await job.draw(i);
        checkAbort(job.signal);
        const timestamp = Math.round(i * 1_000_000 / job.fps);
        const duration = Math.round((i+1) * 1_000_000 / job.fps) - timestamp;
        const frame = new VideoFrame(job.canvas, {timestamp, duration});
        try { encoder.encode(frame, {keyFrame:i % job.fps === 0}); }
        finally { frame.close(); }
        // Bound the number of outstanding GPU buffers when rendering faster
        // than the machine can encode. No frames are dropped to achieve this.
        if (encoder.encodeQueueSize >= 8) await encoder.flush();
        job.progress(i+1);
        if (i % 4 === 3) await yieldToUI();
      }
      await encoder.flush();
      checkAbort(job.signal);
      if (outputError) throw outputError;
      if (outputFrames !== job.frameCount) throw new Error('浏览器编码器缺少视频帧');
      muxer.finalize();
      return new Blob([target.buffer], {type:'video/mp4'});
    } finally {
      job.signal?.removeEventListener('abort', close);
      close();
    }
  }

  async function softwareEncode(job) {
    const lib = await localLibrary('h264-mp4-encoder-1.0.12.js', 'HME');
    checkAbort(job.signal);
    const encoder = await lib.createH264MP4Encoder();
    // The WASM build exposes a shared in-memory filesystem. Give every job
    // its own file, including a new export following a cancelled one.
    const filename = 'foil-loop-' + (++nextFile) + '.mp4';
    const reader = document.createElement('canvas');
    let initialized = false, finalized = false;
    try {
      checkAbort(job.signal);
      reader.width = encoder.width = job.canvas.width;
      reader.height = encoder.height = job.canvas.height;
      encoder.outputFilename = filename;
      encoder.frameRate = job.fps;
      encoder.groupOfPictures = job.fps;
      encoder.speed = 5;
      encoder.quantizationParameter = 23;
      encoder.initialize();
      initialized = true;
      const ctx = reader.getContext('2d', {alpha:false, willReadFrequently:true});
      for (let i=0; i<job.frameCount; i++) {
        checkAbort(job.signal);
        await job.draw(i);
        checkAbort(job.signal);
        ctx.drawImage(job.canvas,0,0);
        encoder.addFrameRgba(ctx.getImageData(0,0,reader.width,reader.height).data);
        job.progress(i+1);
        // A software encode can occupy an appreciable part of an input frame.
        await yieldToUI();
      }
      checkAbort(job.signal);
      encoder.finalize();
      finalized = true;
      return new Blob([encoder.FS.readFile(filename)], {type:'video/mp4'});
    } finally {
      try {
        if (initialized && !finalized) encoder.finalize();
      } finally {
        try { if (initialized) encoder.FS.unlink(filename); }
        finally { encoder.delete(); reader.width = reader.height = 1; }
      }
    }
  }

  async function encode({canvas, frameCount, fps, renderFrame, onProgress, signal}) {
    if (!canvas?.width || !canvas.height || canvas.width % 2 || canvas.height % 2 ||
        !Number.isInteger(frameCount) || frameCount < 1 || !Number.isInteger(fps) || fps < 1 ||
        typeof renderFrame !== 'function') throw new Error('视频画面或帧率设置无效');
    checkAbort(signal);
    let renderFailure;
    const job = {
      canvas, frameCount, fps, signal,
      async draw(i) {
        try { await renderFrame(i); }
        catch(error) { renderFailure = error; throw error; }
      },
      progress(done) { onProgress?.(done / (frameCount+1)); }
    };
    let blob;
    try {
      const config = await nativeConfig(canvas,fps);
      if (config) blob = await nativeEncode(job,config);
    } catch(error) {
      checkAbort(signal);
      if (renderFailure) throw renderFailure;
      // Unsupported hardware, an unavailable codec or encoder failure can
      // restart deterministically with the bundled H.264 software encoder.
    }
    checkAbort(signal);
    if (!blob) blob = await softwareEncode(job);
    checkAbort(signal);
    onProgress?.(1);
    return {blob, extension:'mp4'};
  }

  window.FoilVideo = Object.freeze({encode});
})();
