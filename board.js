/* The camera transforms one world layer. Card coordinates and exports stay local. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clampZoom = scale => Math.max(.2, Math.min(4, scale));

  function install({onTool,hitOverhang}) {
    const viewport = $('boardViewport'), shell = $('boardShell');
    const origin = $('boardOrigin'), world = $('boardWorld'), surface = $('surface');
    const zoomValue = $('boardZoomValue'), handButton = $('handMode');
    const tabs = Array.from(shell.querySelectorAll('[role=tab]'));
    const pointers = new Map();
    let x = 0, y = 0, scale = 1, hand = false, space = false;
    let drag = null, pinch = null;

    function draw() {
      world.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
      const center = origin.getBoundingClientRect();
      const spacing = 20 * scale;
      viewport.style.setProperty('--grid-x', ((center.x + x) % spacing) + 'px');
      viewport.style.setProperty('--grid-y', ((center.y + y) % spacing) + 'px');
      viewport.style.setProperty('--grid-size', spacing + 'px');
      zoomValue.value = Math.round(scale * 100) + '%';
      $('boardZoomOut').disabled = scale <= .2;
      $('boardZoomIn').disabled = scale >= 4;
    }

    function fit() {
      x = 0; y = 0; scale = 1;
      draw();
    }

    // Keep the world point underneath the previous screen position at the
    // new position, for both cursor-centred zoom and translating a pinch.
    function zoomAround(previous, next, nextScale) {
      const center = origin.getBoundingClientRect();
      const ratio = clampZoom(nextScale) / scale;
      x = next.x - center.x - (previous.x - center.x - x) * ratio;
      y = next.y - center.y - (previous.y - center.y - y) * ratio;
      scale = clampZoom(nextScale);
      draw();
    }

    function setHand(enabled) {
      hand = Boolean(enabled);
      viewport.dataset.hand = String(hand);
      handButton.setAttribute('aria-pressed', String(hand));
    }

    function setInspector(open) {
      shell.dataset.inspector = open ? 'open' : 'closed';
      $('inspector').hidden = !open;
      $('inspectorOpen').hidden = open;
      $('inspectorOpen').setAttribute('aria-expanded', String(open));
      draw();
    }

    function showTab(id) {
      const selected = $('tab-' + id);
      if (!selected) return;
      for (const tab of tabs) {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        $(tab.getAttribute('aria-controls')).hidden = !active;
      }
      shell.querySelector('.panel-body').scrollTop = 0;
      if (shell.dataset.focus === 'true') focusMode(false);
      setInspector(true);
    }

    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener('click', () => showTab(tab.id.slice(4)));
      tab.addEventListener('keydown', event => {
        const direction = {ArrowLeft:-1, ArrowRight:1}[event.key];
        if (!direction) return;
        event.preventDefault();
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        next.click(); next.focus();
      });
    }
    $('inspectorClose').onclick = () => {setInspector(false); $('inspectorOpen').focus();};
    $('inspectorOpen').onclick = () => {setInspector(true); tabs.find(tab => tab.tabIndex === 0).focus();};
    $('quickPhoto').onclick = () => $('file').click();
    handButton.onclick = () => {setHand(true); onTool('hand');};
    $('boardFit').onclick = fit;
    for (const [id, factor] of [['boardZoomOut',1/1.25], ['boardZoomIn',1.25]]) {
      $(id).onclick = () => {
        const center = origin.getBoundingClientRect();
        zoomAround(center, center, scale * factor);
      };
    }

    function focusMode(active) {
      shell.dataset.focus = String(active);
      const button = $('expand');
      button.setAttribute('aria-pressed', String(active));
      button.title = active ? '退出专注预览' : '专注预览';
      button.setAttribute('aria-label', button.title);
      button.querySelector('use').setAttribute('href', active ? '#i-close' : '#i-full');
      draw();
    }
    $('expand').onclick = () => focusMode(shell.dataset.focus !== 'true');

    viewport.addEventListener('wheel', event => {
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const cursor = {x:event.clientX, y:event.clientY};
      if (event.shiftKey && !event.ctrlKey) {
        x -= (event.deltaX || event.deltaY) * units;
        draw();
      } else {
        zoomAround(cursor, cursor, scale * Math.exp(-event.deltaY * units * .002));
      }
    }, {passive:false});

    function stopEvent(event) {
      event.preventDefault();
      event.stopPropagation();
    }
    function point(event) {return {x:event.clientX,y:event.clientY};}
    function capture(id) {
      if (!viewport.hasPointerCapture(id)) viewport.setPointerCapture(id);
    }
    function touchIds() {
      return [...pointers].filter(([,p]) => p.type === 'touch').map(([id]) => id);
    }
    function fingers(ids) {
      const a = pointers.get(ids[0]), b = pointers.get(ids[1]);
      return {x:(a.x+b.x)/2, y:(a.y+b.y)/2, distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
    }
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.button !== 1) return;
      pointers.set(event.pointerId,{...point(event),type:event.pointerType});
      const ids = touchIds();
      if (ids.length > 1) {
        onTool('cancelDrag');
        drag = null;
        const pair = ids.slice(0,2);
        for (const id of pair) capture(id);
        pinch = {ids:pair,last:fingers(pair)};
        viewport.classList.add('dragging');
        stopEvent(event);
      } else if (hand || space || event.button === 1 || (!surface.contains(event.target) && !hitOverhang?.(event))) {
        drag = {id:event.pointerId,last:point(event)};
        capture(event.pointerId);
        viewport.classList.add('dragging');
        stopEvent(event);
      }
    },true);
    viewport.addEventListener('pointermove', event => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      Object.assign(pointer,point(event));
      if (pinch) {
        const next = fingers(pinch.ids);
        zoomAround(pinch.last, next, scale * next.distance / pinch.last.distance);
        pinch.last = next;
        stopEvent(event);
      } else if (drag?.id === event.pointerId) {
        x += pointer.x - drag.last.x;
        y += pointer.y - drag.last.y;
        drag.last = point(event);
        draw();
        stopEvent(event);
      }
    },true);

    function endPointer(event) {
      const cameraOwned = Boolean(pinch || drag?.id === event.pointerId);
      pointers.delete(event.pointerId);
      if (pinch?.ids.includes(event.pointerId)) {
        const ids = touchIds();
        if (ids.length >= 2) {
          const pair=ids.slice(0,2);
          for (const id of pair) capture(id);
          pinch={ids:pair,last:fingers(pair)};
        } else {
          pinch = null;
          drag = ids.length ? {id:ids[0],last:{...pointers.get(ids[0])}} : null;
        }
      } else if (drag?.id === event.pointerId) {
        drag = null;
      }
      if (!drag && !pinch) viewport.classList.remove('dragging');
      if (cameraOwned) stopEvent(event);
    }
    window.addEventListener('pointerup', endPointer, true);
    window.addEventListener('pointercancel', endPointer, true);
    function setSpace(active) {
      space = active;
      viewport.classList.toggle('space-pan',space);
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && shell.dataset.focus === 'true') focusMode(false);
      if (event.code !== 'Space' || event.target.closest('input,textarea,button,select,a,dialog,[contenteditable=true]')) return;
      event.preventDefault();
      setSpace(true);
    });
    document.addEventListener('keyup', event => {if (event.code === 'Space') setSpace(false);});
    window.addEventListener('blur', () => {
      setSpace(false);
      pointers.clear(); drag = null; pinch = null;
      viewport.classList.remove('dragging');
    });
    window.addEventListener('resize', draw);
    setInspector(true);
    setHand(false);
    return {setHand,showTab,fit};
  }
  window.BoardView = Object.freeze({install});
})();
