(() => {
  'use strict';

  function install(snapshot) {
    const byId = id => document.getElementById(id);
    const dialog = byId('loopDialog');
    const stage = byId('movieStage');
    const player = byId('loopPlayer');
    const progress = byId('movieProgress');
    const status = byId('movieStatus');
    const download = byId('downloadVideo');
    const retry = byId('retryVideo');
    const trigger = byId('exportVideo');
    let job = null;
    let clipUrl = null;
    let composition = null;

    function release() {
      if (job) job.abort();
      job = null;
      player.pause();
      if (player.hasAttribute('src')) {
        player.removeAttribute('src');
        player.load();
      }
      player.hidden = true;
      stage.querySelector('canvas')?.remove();
      download.removeAttribute('href');
      download.hidden = true;
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      clipUrl = null;
    }

    async function generate() {
      release();
      const controller = new AbortController();
      job = controller;
      retry.hidden = true;
      progress.hidden = false;
      progress.value = 0;
      const isDust = composition.effect === 'dust';
      status.textContent = isDust ? '正在生成消散与重聚…' : '正在生成 4 秒动效…';
      try {
        const scene = FoilLoopScene.create(composition);
        const {canvas} = scene;
        canvas.setAttribute('aria-label', isDust ? '正在生成的粒子消散视频' : '正在生成的循环视频');
        stage.append(canvas);
        scene.renderFrame(0);
        // Let the modal paint before allocating the encoder.
        await new Promise(resolve => setTimeout(resolve, 35));
        if (controller.signal.aborted) return;
        const {blob, extension} = await FoilVideo.encode({
          canvas, frameCount:120, fps:30, renderFrame:scene.renderFrame,
          onProgress: ratio => {
            if (job === controller) progress.value = ratio;
          },
          signal:controller.signal
        });
        if (job !== controller || controller.signal.aborted) return;
        clipUrl = URL.createObjectURL(blob);
        download.href = clipUrl;
        const suffix = isDust ? '-粒子消散-4s.' : '-循环-4s.';
        download.download = CardFrames.filename(composition.state) + suffix + extension;
        player.src = clipUrl;
        player.hidden = false;
        canvas.remove();
        download.hidden = false;
        download.querySelector('span').textContent = '保存 ' + extension.toUpperCase();
        progress.hidden = true;
        status.textContent = '已生成 · ' + (blob.size / 1048576).toFixed(1) + ' MB';
        player.play().catch(() => { /* Native controls also allow manual playback. */ });
      } catch (error) {
        if (job !== controller || controller.signal.aborted) return;
        console.error('循环视频生成失败', error);
        status.textContent = '视频生成失败，可以重试或用新版浏览器打开。';
        progress.hidden = true;
        retry.hidden = false;
      } finally {
        if (job === controller) job = null;
      }
    }

    trigger.addEventListener('click', () => {
      if (dialog.open) return;
      composition = snapshot();
      if (!composition.state.image) return;
      const name = CardFrames.get(composition.state.frame).name;
      const title = composition.effect === 'dust' ? name + ' · 粒子消散' : name;
      player.setAttribute('aria-label', title + '四秒循环成片');
      byId('movieTitle').textContent = title + ' · 4 秒循环';
      dialog.showModal();
      generate();
    });
    retry.addEventListener('click', generate);
    byId('closeVideo').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      release();
      composition = null;
    });
  }

  window.FoilVideoDialog = Object.freeze({install});
})();
