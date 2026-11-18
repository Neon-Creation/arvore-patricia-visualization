/* =====================================================================
   Árvore PATRICIA · interface
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------- helpers ------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function formatTime() {
    try {
      return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) { return ''; }
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ----------------------------- constantes ------------------------------ */
  var TOP = 46;
  var LABEL_W = 88;
  var LEAF_H = 46;
  var INT_MIN_W = 76;
  var GAP = 22;
  var VB = { w: 1200, h: 760 };

  var WORD_TOP = 58;
  var WORD_ROW_H = 82;
  var WORD_GAP = 30;
  var WORD_INT_H = 34;
  var WORD_LEAF_H = 40;

  var EXAMPLES = {
    3: ['000', '001', '010', '100', '101', '111'],
    4: ['0000', '0011', '0101', '1000', '1010', '1111'],
    5: ['00000', '00011', '01010', '10001', '10101', '11110'],
    6: ['000000', '000111', '001010', '100001', '101010', '111111'],
    7: ['0000000', '0001111', '0010100', '1000011', '1010101', '1111110'],
    8: ['00000000', '00011111', '00101010', '10000110', '10101010', '11111100']
  };

  var WORD_EXAMPLE = ['casa', 'carro', 'cama', 'casaco', 'cão', 'mar', 'mata'];
  var WORD_POOL = [
    'casa', 'cama', 'carro', 'casaco', 'cão', 'mar', 'mata', 'pato', 'prato', 'prata',
    'porta', 'porto', 'dado', 'dados', 'dia', 'dias', 'rua', 'ruas', 'rio', 'rios',
    'sol', 'solo', 'sala', 'salas', 'mesa', 'mesas', 'livro', 'livros', 'folha', 'folhas',
    'mapa', 'mapas', 'ponte', 'pontes', 'fada', 'fadas', 'vila', 'vilas', 'novo', 'nova'
  ];

  /* -------------------------------- estado ------------------------------- */
  var state = {
    mode: 'words',
    bits: 4,
    bitTree: new Patricia.PatriciaTree(4),
    wordTree: new Patricia.RadixTree(),
    tree: null,
    input: '0000',
    word: 'casa',
    animate: true,
    playback: null,
    history: [],
    layout: null,
    suppressClick: false
  };
  state.tree = state.wordTree;

  var cam = { x: 0, y: 0, k: 1 };
  var camTween = null;
  var userAdjusted = false;
  var toastTimer = null;
  var el = {};

  function cacheEls() {
    el.world = $('#world');
    el.svg = $('#tree');
    el.canvas = $('#canvas');
    el.emptyState = $('#emptyState');
    el.emptyTitle = $('#emptyTitle');
    el.emptyText = $('#emptyText');
    el.stageSubtitle = $('#stageSubtitle');
    el.legend = $('#legend');
    el.modeButtons = document.querySelectorAll('.mode-btn');
    el.bitInput = $('#bitInput');
    el.wordEditor = $('#wordEditor');
    el.wordInput = $('#wordInput');
    el.wordError = $('#wordError');
    el.wordCount = $('#wordCount');
    el.wordField = $('.word-field');
    el.inputPill = $('#inputPill');
    el.editorHint = $('#editorHint');
    el.bitsWidthWrap = $('#bitsWidthWrap');
    el.bitsSelect = $('#bitsSelect');
    el.statsKeysLabel = $('#statsKeysLabel');
    el.keysTitle = $('#keysTitle');
    el.keysHint = $('#keysHint');
    el.execIdle = $('#execIdle');
    el.themeToggle = $('#themeToggle');
    el.btnExample = $('#btnExample');
    el.btnEmptyExample = $('#btnEmptyExample');
    el.btnRandom = $('#btnRandom');
    el.btnClear = $('#btnClear');
    el.btnInsert = $('#btnInsert');
    el.btnSearch = $('#btnSearch');
    el.btnDelete = $('#btnDelete');
    el.animToggle = $('#animToggle');
    el.execTitle = $('#execTitle');
    el.execBadge = $('#execBadge');
    el.stepsList = $('#stepsList');
    el.execCounter = $('#execCounter');
    el.btnSkip = $('#btnSkip');
    el.statsKeys = $('#statsKeys');
    el.statsInternal = $('#statsInternal');
    el.statsHeight = $('#statsHeight');
    el.compactNote = $('#compactNote');
    el.keysList = $('#keysList');
    el.keysCount = $('#keysCount');
    el.historyList = $('#historyList');
    el.historyCount = $('#historyCount');
    el.historyEmpty = $('#historyEmpty');
    el.zoomIn = $('#zoomIn');
    el.zoomOut = $('#zoomOut');
    el.zoomFit = $('#zoomFit');
    el.toast = $('#toast');
    el.btnDemoInsert = $('#btnDemoInsert');
    el.btnDemoSearch = $('#btnDemoSearch');
  }

  function rowHeight() {
    if (state.bits >= 8) return 60;
    if (state.bits === 7) return 68;
    if (state.bits === 6) return 76;
    if (state.bits === 5) return 82;
    return 88;
  }
  function rowY(bit) { return TOP + bit * rowHeight(); }
  function leafY() { return TOP + state.bits * rowHeight(); }
  function leafWidth() { return Math.max(88, Math.round(state.bits * 11.6 + 10)); }

  /* -------------------------------- toast -------------------------------- */
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2600);
  }

  /* -------------------------------- tema --------------------------------- */
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('patricia-theme'); } catch (e) { /* ignore */ }
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  }

  function toggleTheme() {
    var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('patricia-theme', next); } catch (e) { /* ignore */ }
  }

  /* ------------------------------ câmera --------------------------------- */
  function applyCam() {
    el.world.setAttribute('transform',
      'translate(' + cam.x.toFixed(2) + ' ' + cam.y.toFixed(2) + ') scale(' + cam.k.toFixed(4) + ')');
  }

  function cancelCam() {
    if (camTween) {
      cancelAnimationFrame(camTween.raf);
      camTween = null;
    }
  }

  function tweenCam(target, duration) {
    cancelCam();
    var start = { x: cam.x, y: cam.y, k: cam.k };
    var t0 = null;
    var dur = duration || 520;
    camTween = { raf: 0 };
    function frame(now) {
      if (!t0) t0 = now;
      var p = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      cam.x = start.x + (target.x - start.x) * e;
      cam.y = start.y + (target.y - start.y) * e;
      cam.k = start.k + (target.k - start.k) * e;
      applyCam();
      if (p < 1) camTween.raf = requestAnimationFrame(frame);
      else camTween = null;
    }
    camTween.raf = requestAnimationFrame(frame);
  }

  function fitView(layout, animate) {
    if (!layout) return;
    var pad = VB.w < 700 ? 26 : 48;
    var k = Math.min((VB.w - pad * 2) / layout.w, (VB.h - pad * 2) / layout.h);
    k = clamp(k, 0.3, 1.1);
    var target = {
      k: k,
      x: (VB.w - layout.w * k) / 2,
      y: (VB.h - layout.h * k) / 2
    };
    userAdjusted = false;
    if (animate === false) {
      cancelCam();
      cam.x = target.x; cam.y = target.y; cam.k = target.k;
      applyCam();
    } else {
      tweenCam(target);
    }
  }

  function toSvgPoint(clientX, clientY) {
    var pt = el.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    var ctm = el.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  /** Mantém o viewBox igual ao tamanho real do canvas (texto legível em qualquer tela). */
  function updateViewport() {
    var rect = el.canvas.getBoundingClientRect();
    VB.w = Math.max(320, Math.round(rect.width));
    VB.h = Math.max(260, Math.round(rect.height));
    el.svg.setAttribute('viewBox', '0 0 ' + VB.w + ' ' + VB.h);
  }

  function zoomAt(factor, cx, cy) {
    cancelCam();
    var k = clamp(cam.k * factor, 0.25, 2.8);
    var wx = (cx - cam.x) / cam.k;
    var wy = (cy - cam.y) / cam.k;
    cam.k = k;
    cam.x = cx - wx * k;
    cam.y = cy - wy * k;
    applyCam();
    userAdjusted = true;
  }

  function bindCamera() {
    el.svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = toSvgPoint(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });

    var drag = null;
    el.svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var p = toSvgPoint(e.clientX, e.clientY);
      drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false, id: e.pointerId };
      try { el.svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      el.svg.classList.add('dragging');
    });

    el.svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = toSvgPoint(e.clientX, e.clientY);
      var dx = p.x - drag.sx;
      var dy = p.y - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
        drag.moved = true;
        cancelCam();
      }
      if (drag.moved) {
        cam.x = drag.cx + dx;
        cam.y = drag.cy + dy;
        applyCam();
        userAdjusted = true;
      }
    });

    function endDrag() {
      if (!drag) return;
      if (drag.moved) {
        state.suppressClick = true;
        setTimeout(function () { state.suppressClick = false; }, 60);
      }
      drag = null;
      el.svg.classList.remove('dragging');
    }
    el.svg.addEventListener('pointerup', endDrag);
    el.svg.addEventListener('pointercancel', endDrag);

    el.zoomIn.addEventListener('click', function () { zoomAt(1.22, VB.w / 2, VB.h / 2); });
    el.zoomOut.addEventListener('click', function () { zoomAt(1 / 1.22, VB.w / 2, VB.h / 2); });
    el.zoomFit.addEventListener('click', function () { fitView(state.layout, true); });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        updateViewport();
        fitView(state.layout, false);
      }, 140);
    });
  }

  /* ----------------------------- entrada de bits ------------------------- */
  function setInput(key) {
    state.input = key;
    renderBitInput();
  }

  function renderBitInput() {
    el.bitInput.innerHTML = '';
    for (var pos = 0; pos < state.bits; pos++) {
      var bitIndex = pos;
      var value = state.input.charAt(bitIndex) || '0';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bit-box';
      btn.dataset.bit = String(bitIndex);
      btn.dataset.value = value;
      btn.setAttribute('aria-label', 'Bit ' + bitIndex + ', valor ' + value);
      btn.setAttribute('aria-pressed', value === '1' ? 'true' : 'false');
      btn.innerHTML = '<span class="bit-index">' + bitIndex + '</span>' +
        '<span class="bit-value">' + value + '</span>';
      btn.addEventListener('click', onBitClick);
      el.bitInput.appendChild(btn);
    }
    if (state.mode === 'bits') el.inputPill.textContent = state.bits + ' bits';
  }

  function onBitClick(e) {
    var btn = e.currentTarget;
    var idx = Number(btn.dataset.bit);
    var next = state.input.charAt(idx) === '1' ? '0' : '1';
    state.input = state.input.slice(0, idx) + next + state.input.slice(idx + 1);
    btn.dataset.value = next;
    btn.setAttribute('aria-pressed', next === '1' ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Bit ' + idx + ', valor ' + next);
    btn.querySelector('.bit-value').textContent = next;
  }

  function randomKey() {
    var present = {};
    state.tree.keys().forEach(function (k) { present[k] = true; });
    var total = Math.pow(2, state.bits);
    for (var attempt = 0; attempt < 80; attempt++) {
      var key = '';
      for (var i = 0; i < state.bits; i++) key += Math.random() < 0.5 ? '0' : '1';
      if (!present[key]) return key;
    }
    for (var n = 0; n < total; n++) {
      var candidate = n.toString(2);
      while (candidate.length < state.bits) candidate = '0' + candidate;
      if (!present[candidate]) return candidate;
    }
    return null;
  }

  /* ---------------------------- entrada de palavras ---------------------- */
  function normalizeWord(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR');
  }

  function validateWord(word) {
    if (!word) return 'Digite uma palavra antes de executar a operação.';
    if (word.length > 24) return 'Use no máximo 24 caracteres.';
    if (!/^[a-zà-öø-ÿ0-9_-]+$/i.test(word)) {
      return 'Use apenas letras, números, hífen ou sublinhado (sem espaços).';
    }
    return null;
  }

  function updateWordCount() {
    var length = el.wordInput.value.length;
    el.wordCount.textContent = length + '/24';
  }

  function clearWordError() {
    el.wordError.textContent = '';
    el.wordError.classList.add('hidden');
    el.wordField.classList.remove('invalid');
  }

  function showWordError(message) {
    el.wordError.textContent = message;
    el.wordError.classList.remove('hidden');
    el.wordField.classList.add('invalid');
  }

  function setWord(word) {
    state.word = word;
    el.wordInput.value = word;
    updateWordCount();
    clearWordError();
  }

  function renderWordInput() {
    setWord(state.word || '');
  }

  function readWord() {
    var word = normalizeWord(el.wordInput.value);
    var error = validateWord(word);
    if (error) {
      showWordError(error);
      showToast(error);
      el.wordInput.focus();
      return null;
    }
    setWord(word);
    return word;
  }

  function randomWord() {
    var present = {};
    state.wordTree.keys().forEach(function (key) { present[key] = true; });
    var available = WORD_POOL.filter(function (word) { return !present[word]; });
    if (available.length) return available[Math.floor(Math.random() * available.length)];

    var syllables = ['ca', 'co', 'cu', 'ma', 'me', 'mi', 'pa', 'pe', 'pi', 'ra', 're', 'ri', 'sa', 'se', 'si', 'ta', 'te', 'ti', 'la', 'le', 'li'];
    for (var attempt = 0; attempt < 120; attempt++) {
      var parts = 1 + Math.floor(Math.random() * 3);
      var word = '';
      for (var i = 0; i < parts; i++) {
        word += syllables[Math.floor(Math.random() * syllables.length)];
      }
      if (!present[word]) return word;
    }
    return null;
  }

  function randomKeyForMode() {
    return state.mode === 'words' ? randomWord() : randomKey();
  }

  /* ------------------------------- layout -------------------------------- */
  function computeBitLayout() {
    var lY = leafY();
    var leafW = leafWidth();
    var treeLeft = LABEL_W + 26;
    var height = lY + LEAF_H / 2 + 48;
    var root = state.tree.root;

    if (!root) {
      return { pos: new Map(), w: 1000, h: height, leafY: lY, treeLeft: treeLeft, empty: true };
    }

    var widths = new Map();
    function measure(node) {
      var w;
      if (node.type === 'leaf') {
        w = leafW;
      } else {
        var leftW = measure(node.left);
        var rightW = measure(node.right);
        w = Math.max(leftW + rightW + GAP, INT_MIN_W);
      }
      widths.set(node.id, w);
      return w;
    }
    measure(root);

    var pos = new Map();
    function place(node, left, depth) {
      var w = widths.get(node.id);
      var x = treeLeft + left + w / 2;
      var y = node.type === 'leaf' ? lY : rowY(node.bit);
      pos.set(node.id, { x: x, y: y, w: w, depth: depth });
      if (node.type === 'internal') {
        var leftW = widths.get(node.left.id);
        var total = leftW + widths.get(node.right.id) + GAP;
        var offset = left + (w - total) / 2;
        place(node.left, offset, depth + 1);
        place(node.right, offset + leftW + GAP, depth + 1);
      }
    }
    place(root, 0, 0);

    var width = Math.max(treeLeft + widths.get(root.id) + 36, 720);
    return { pos: pos, w: width, h: height, leafY: lY, treeLeft: treeLeft, empty: false };
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
  }

  /* ------------------------------- desenho ------------------------------- */
  function renderBitTree(layout, animateIds) {
    var parts = [];
    var width = layout.w;
    var bits = state.bits;

    for (var b = 0; b < bits; b++) {
      var gy = rowY(b);
      parts.push(
        '<g class="guide">' +
          '<line x1="' + layout.treeLeft + '" y1="' + gy + '" x2="' + (width - 26) + '" y2="' + gy + '"/>' +
          '<text x="' + (layout.treeLeft - 18) + '" y="' + (gy + 4) + '" text-anchor="end">bit ' + b + '</text>' +
        '</g>'
      );
    }
    var ly = layout.leafY;
    parts.push(
      '<g class="guide leaf-guide">' +
        '<line x1="' + layout.treeLeft + '" y1="' + ly + '" x2="' + (width - 26) + '" y2="' + ly + '"/>' +
        '<text x="' + (layout.treeLeft - 18) + '" y="' + (ly + 4) + '" text-anchor="end">folhas</text>' +
      '</g>'
    );

    var root = state.tree.root;
    var lw = leafWidth();
    if (root) {
      var edges = [];
      var nodes = [];
      (function collect(node, depth) {
        nodes.push({ node: node, depth: depth });
        if (node.type === 'internal') {
          edges.push({ parent: node, child: node.left, dir: 0 });
          edges.push({ parent: node, child: node.right, dir: 1 });
          collect(node.left, depth + 1);
          collect(node.right, depth + 1);
        }
      })(root, 0);

      edges.forEach(function (edge) {
        var p = layout.pos.get(edge.parent.id);
        var c = layout.pos.get(edge.child.id);
        if (!p || !c) return;
        var childTop = edge.child.type === 'leaf' ? c.y - LEAF_H / 2 : c.y - 21;
        var dy = childTop - p.y;
        var c1 = { x: p.x, y: p.y + dy * 0.55 };
        var c2 = { x: c.x, y: childTop - dy * 0.45 };
        var d = 'M ' + p.x + ' ' + p.y +
          ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y +
          ', ' + c.x + ' ' + childTop;
        var branch = edge.dir ? 'one' : 'zero';
        parts.push('<path class="edge ' + branch + '" data-edge="' +
          edge.parent.id + '-' + edge.child.id + '" d="' + d + '"/>');
        var lp = cubicPoint({ x: p.x, y: p.y }, c1, c2, { x: c.x, y: childTop }, 0.38);
        parts.push(
          '<g class="edge-badge ' + branch + '">' +
            '<circle cx="' + lp.x.toFixed(1) + '" cy="' + lp.y.toFixed(1) + '" r="8.5"/>' +
            '<text x="' + lp.x.toFixed(1) + '" y="' + (lp.y + 3.4).toFixed(1) + '">' + edge.dir + '</text>' +
          '</g>'
        );
      });

      nodes.forEach(function (item) {
        var node = item.node;
        var p = layout.pos.get(node.id);
        if (!p) return;
        var appear = animateIds && animateIds.has(node.id);
        var cls = 'node node-' + node.type + (appear ? ' appear' : '');
        var delay = Math.min(item.depth * 80, 420);

        if (node.type === 'internal') {
          parts.push(
            '<g class="' + cls + '" data-id="' + node.id + '" style="--delay:' + delay + 'ms">' +
              '<title>Nó interno: testa o bit ' + node.bit + '</title>' +
              '<circle class="halo" cx="' + p.x + '" cy="' + p.y + '" r="31"/>' +
              '<circle class="shape" cx="' + p.x + '" cy="' + p.y + '" r="21"/>' +
              '<text class="bit-caption" x="' + p.x + '" y="' + (p.y - 8) + '">bit</text>' +
              '<text class="node-label" x="' + p.x + '" y="' + (p.y + 8) + '">' + node.bit + '</text>' +
            '</g>'
          );
        } else {
          var lx = p.x - lw / 2;
          var lyy = p.y - LEAF_H / 2;
          parts.push(
            '<g class="' + cls + '" data-id="' + node.id + '" data-key="' + node.key + '" style="--delay:' + delay + 'ms">' +
              '<title>Folha: chave ' + node.key + ' · clique para buscar</title>' +
              '<rect class="halo" x="' + (lx - 7) + '" y="' + (lyy - 7) + '" width="' + (lw + 14) + '" height="' + (LEAF_H + 14) + '" rx="19"/>' +
              '<rect class="shape" x="' + lx + '" y="' + lyy + '" width="' + lw + '" height="' + LEAF_H + '" rx="13"/>' +
              '<text class="leaf-key" x="' + p.x + '" y="' + (p.y + 5) + '">' + node.key + '</text>' +
            '</g>'
          );
        }
      });
    }

    el.world.innerHTML = parts.join('');
  }

  /* --------------------------- layout de palavras ------------------------ */
  function wordPillWidth(text) {
    return Math.max(58, String(text || 'raiz').length * 8.4 + 26);
  }

  function wordLeafWidth(word) {
    return Math.max(66, word.length * 8.6 + 28);
  }

  function computeWordLayout() {
    var root = state.tree.root;
    var treeLeft = LABEL_W + 26;
    var rowH = WORD_ROW_H;

    if (!root) {
      return {
        mode: 'words', pos: new Map(), w: 900, h: WORD_TOP + rowH + 90,
        treeLeft: treeLeft, top: WORD_TOP, rowH: rowH, maxDepth: 1, empty: true
      };
    }

    var widths = new Map();
    var maxDepth = 0;

    function measure(node, depth) {
      if (depth > maxDepth) maxDepth = depth;
      var width;
      if (node.type === 'leaf') {
        width = wordLeafWidth(node.word);
      } else {
        var sum = 0;
        node.children.forEach(function (child, index) {
          if (index) sum += WORD_GAP;
          sum += measure(child, depth + 1);
        });
        width = Math.max(sum, wordPillWidth(node.prefix));
      }
      widths.set(node.id, width);
      return width;
    }
    measure(root, 0);

    var pos = new Map();
    function place(node, left, depth) {
      var width = widths.get(node.id);
      var pillWidth = node.type === 'leaf' ? width : wordPillWidth(node.prefix);
      var height = node.type === 'leaf' ? WORD_LEAF_H : WORD_INT_H;
      pos.set(node.id, {
        x: treeLeft + left + width / 2,
        y: WORD_TOP + depth * rowH,
        w: width,
        pw: pillWidth,
        h: height,
        depth: depth
      });
      if (node.type === 'internal') {
        var total = 0;
        node.children.forEach(function (child, index) {
          if (index) total += WORD_GAP;
          total += widths.get(child.id);
        });
        var offset = left + (width - total) / 2;
        node.children.forEach(function (child) {
          place(child, offset, depth + 1);
          offset += widths.get(child.id) + WORD_GAP;
        });
      }
    }
    place(root, 0, 0);

    var height = WORD_TOP + maxDepth * rowH + WORD_LEAF_H / 2 + 54;
    var width = Math.max(treeLeft + widths.get(root.id) + 40, 760);
    return {
      mode: 'words', pos: pos, w: width, h: height,
      treeLeft: treeLeft, top: WORD_TOP, rowH: rowH, maxDepth: maxDepth, empty: false
    };
  }

  function renderWordTree(layout, animateIds) {
    var parts = [];
    var root = state.tree.root;

    if (root) {
      for (var d = 0; d <= layout.maxDepth; d++) {
        var gy = layout.top + d * layout.rowH;
        parts.push(
          '<g class="guide">' +
            '<line x1="' + layout.treeLeft + '" y1="' + gy + '" x2="' + (layout.w - 26) + '" y2="' + gy + '"/>' +
            '<text x="' + (layout.treeLeft - 18) + '" y="' + (gy + 4) + '" text-anchor="end">nível ' + d + '</text>' +
          '</g>'
        );
      }
    }

    if (root) {
      var edges = [];
      var nodes = [];
      (function collect(node, depth) {
        nodes.push({ node: node, depth: depth });
        if (node.type === 'internal') {
          node.children.forEach(function (child) {
            edges.push({ parent: node, child: child });
            collect(child, depth + 1);
          });
        }
      })(root, 0);

      edges.forEach(function (edge) {
        var p = layout.pos.get(edge.parent.id);
        var c = layout.pos.get(edge.child.id);
        if (!p || !c) return;

        var pBottom = p.y + p.h / 2;
        var cTop = c.y - c.h / 2;
        var dy = cTop - pBottom;
        var c1 = { x: p.x, y: pBottom + dy * 0.5 };
        var c2 = { x: c.x, y: cTop - dy * 0.5 };
        var d = 'M ' + p.x + ' ' + pBottom +
          ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y +
          ', ' + c.x + ' ' + cTop;
        parts.push('<path class="edge word" data-edge="' +
          edge.parent.id + '-' + edge.child.id + '" d="' + d + '"/>');

        var charIndex = edge.parent.prefix.length;
        var ch = Patricia.radixCharAt(edge.child, charIndex);
        var label = ch === '\0' ? 'fim' : ch;
        var badgeW = ch === '\0' ? 29 : 19;
        var lp = cubicPoint({ x: p.x, y: pBottom }, c1, c2, { x: c.x, y: cTop }, 0.42);
        parts.push(
          '<g class="edge-badge word ' + (ch === '\0' ? 'fim' : 'char') + '">' +
            '<rect x="' + (lp.x - badgeW / 2).toFixed(1) + '" y="' + (lp.y - 9).toFixed(1) +
              '" width="' + badgeW + '" height="18" rx="8"/>' +
            '<text x="' + lp.x.toFixed(1) + '" y="' + (lp.y + 3.4).toFixed(1) + '">' + esc(label) + '</text>' +
          '</g>'
        );
      });

      nodes.forEach(function (item) {
        var node = item.node;
        var p = layout.pos.get(node.id);
        if (!p) return;
        var appear = animateIds && animateIds.has(node.id);
        var cls = 'node node-' + node.type + (node.type === 'leaf' ? ' node-word-leaf' : ' node-word') +
          (appear ? ' appear' : '');
        var delay = Math.min(item.depth * 70, 420);

        if (node.type === 'internal') {
          var prefixLabel = node.prefix ? esc(node.prefix) : 'raiz';
          var rootClass = node.prefix ? '' : ' root-prefix';
          parts.push(
            '<g class="' + cls + '" data-id="' + node.id + '" style="--delay:' + delay + 'ms">' +
              '<title>Nó interno: prefixo comum ' + (node.prefix ? '“' + esc(node.prefix) + '”' : '(raiz)') + '</title>' +
              '<rect class="halo" x="' + (p.x - p.pw / 2 - 7) + '" y="' + (p.y - p.h / 2 - 7) +
                '" width="' + (p.pw + 14) + '" height="' + (p.h + 14) + '" rx="17"/>' +
              '<rect class="shape" x="' + (p.x - p.pw / 2) + '" y="' + (p.y - p.h / 2) +
                '" width="' + p.pw + '" height="' + p.h + '" rx="12"/>' +
              '<text class="node-label' + rootClass + '" x="' + p.x + '" y="' + (p.y + 4.5) + '">' + prefixLabel + '</text>' +
            '</g>'
          );
        } else {
          var lx = p.x - p.pw / 2;
          var lyy = p.y - p.h / 2;
          parts.push(
            '<g class="' + cls + '" data-id="' + node.id + '" data-key="' + esc(node.word) + '" style="--delay:' + delay + 'ms">' +
              '<title>Folha: palavra ' + esc(node.word) + ' · clique para buscar</title>' +
              '<rect class="halo" x="' + (lx - 7) + '" y="' + (lyy - 7) + '" width="' + (p.pw + 14) + '" height="' + (p.h + 14) + '" rx="18"/>' +
              '<rect class="shape" x="' + lx + '" y="' + lyy + '" width="' + p.pw + '" height="' + p.h + '" rx="12"/>' +
              '<text class="leaf-key" x="' + p.x + '" y="' + (p.y + 4.5) + '">' + esc(node.word) + '</text>' +
            '</g>'
          );
        }
      });
    }

    el.world.innerHTML = parts.join('');
  }

  function computeLayout() {
    return state.mode === 'words' ? computeWordLayout() : computeBitLayout();
  }

  function renderTree(layout, animateIds) {
    if (state.mode === 'words') renderWordTree(layout, animateIds);
    else renderBitTree(layout, animateIds);
  }

  function applyHighlight(nodeIds, edgeIds, activeId) {
    var nodeEls = el.world.querySelectorAll('.node');
    for (var i = 0; i < nodeEls.length; i++) {
      var id = Number(nodeEls[i].dataset.id);
      nodeEls[i].classList.toggle('visited', nodeIds.indexOf(id) !== -1);
      nodeEls[i].classList.toggle('active', activeId != null && id === Number(activeId));
    }
    var edgeEls = el.world.querySelectorAll('.edge');
    for (var j = 0; j < edgeEls.length; j++) {
      edgeEls[j].classList.toggle('visited', edgeIds.indexOf(edgeEls[j].dataset.edge) !== -1);
    }
  }

  /* ---------------------------- estatísticas ----------------------------- */
  function updateStats() {
    var stats = state.tree.stats();
    el.statsKeys.textContent = String(stats.keys);
    el.statsInternal.textContent = String(stats.internal);
    el.statsHeight.textContent = String(stats.height);
    var unit = state.mode === 'words' ? 'palavras' : 'chaves';
    if (stats.keys > 0) {
      el.compactNote.innerHTML = '<b>' + stats.keys + '</b> ' + unit + ' ocupam <b>' +
        (stats.internal + stats.leaves) + '</b> nós · limite teórico <b>2k − 1 = ' +
        (2 * stats.keys - 1) + '</b>';
    } else {
      el.compactNote.innerHTML = 'Com <b>k</b> ' + unit + ', a árvore usa no máximo <b>2k − 1</b> nós.';
    }
  }

  function renderKeys() {
    var keys = state.tree.keys();
    el.keysCount.textContent = String(keys.length);
    el.keysList.innerHTML = '';
    keys.forEach(function (key) {
      var chip = document.createElement('span');
      chip.className = 'chip';

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'chip-key';
      main.setAttribute('data-key', key);
      main.title = 'Buscar a chave ' + key;
      main.textContent = key;

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-x';
      remove.setAttribute('data-remove', key);
      remove.setAttribute('aria-label', 'Remover a chave ' + key);
      remove.title = 'Remover ' + key;
      remove.textContent = '×';

      chip.appendChild(main);
      chip.appendChild(remove);
      el.keysList.appendChild(chip);
    });
  }

  function refresh(options) {
    options = options || {};
    var layout = computeLayout();
    state.layout = layout;
    renderTree(layout, options.animateIds || null);
    updateStats();
    renderKeys();
    el.emptyState.classList.toggle('hidden', !!state.tree.root);
    if (!userAdjusted) fitView(layout, options.animateCam !== false);
  }

  /* ------------------------------ histórico ------------------------------ */
  var OP_LABEL = { insert: 'Inserir', search: 'Buscar', delete: 'Remover' };
  var OP_ICON = { insert: '+', search: '?', delete: '−' };

  function resultText(result) {
    switch (result) {
      case 'inserted': return 'inserida';
      case 'deleted': return 'removida';
      case 'found': return 'encontrada';
      case 'duplicate': return 'já existia';
      default: return 'não encontrada';
    }
  }

  function resultPositive(result) {
    return result === 'inserted' || result === 'deleted' || result === 'found';
  }

  function recordHistory(op, key, result) {
    state.history.unshift({ op: op, key: key, result: result, time: formatTime() });
    if (state.history.length > 40) state.history.length = 40;
    renderHistory();
  }

  function renderHistory() {
    el.historyCount.textContent = String(state.history.length);
    el.historyList.innerHTML = '';
    el.historyEmpty.classList.toggle('hidden', state.history.length > 0);

    state.history.slice(0, 20).forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'history-item';

      var icon = document.createElement('span');
      icon.className = 'hist-icon ' + entry.op;
      if (entry.op === 'search') {
        icon.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="5" cy="5" r="3.1"/><path d="M7.4 7.4 10 10"/></svg>';
      } else {
        icon.textContent = OP_ICON[entry.op] || '·';
      }

      var key = document.createElement('span');
      key.className = 'hist-key';
      key.textContent = entry.key;

      var label = document.createElement('span');
      label.className = 'hist-label' + (resultPositive(entry.result) ? ' ok' : '');
      label.textContent = resultText(entry.result);

      var time = document.createElement('span');
      time.className = 'hist-time';
      time.textContent = entry.time;

      li.title = OP_LABEL[entry.op] + ' ' + entry.key + ' · ' + resultText(entry.result);
      li.appendChild(icon);
      li.appendChild(key);
      li.appendChild(label);
      li.appendChild(time);
      el.historyList.appendChild(li);
    });
  }

  /* ----------------------------- modos e cópia --------------------------- */
  function renderLegend() {
    if (state.mode === 'words') {
      el.legend.innerHTML =
        '<span class="legend-item"><i class="dot internal"></i>nó interno <small>(prefixo)</small></span>' +
        '<span class="legend-item"><i class="dot leaf"></i>folha <small>(palavra)</small></span>' +
        '<span class="legend-item"><i class="badge-key">a</i>próxima letra</span>' +
        '<span class="legend-item"><i class="badge-key fim">fim</i>fim da palavra</span>';
    } else {
      el.legend.innerHTML =
        '<span class="legend-item"><i class="dot internal"></i>nó interno <small>(testa um bit)</small></span>' +
        '<span class="legend-item"><i class="dot leaf"></i>folha <small>(chave)</small></span>' +
        '<span class="legend-item"><i class="line zero"></i>aresta 0</span>' +
        '<span class="legend-item"><i class="line one"></i>aresta 1</span>';
    }
  }

  function syncModeUI() {
    var words = state.mode === 'words';

    for (var i = 0; i < el.modeButtons.length; i++) {
      var btn = el.modeButtons[i];
      var active = btn.dataset.mode === state.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    el.wordEditor.hidden = !words;
    el.bitInput.hidden = words;
    el.bitsWidthWrap.hidden = words;
    el.stageSubtitle.textContent = words
      ? 'Nós internos mostram o prefixo comum · as arestas revelam a próxima letra'
      : 'Eixo vertical = bit testado · nós internos testam um bit, folhas guardam a chave';
    el.inputPill.textContent = words ? 'palavras' : state.bits + ' bits';
    el.editorHint.innerHTML = words
      ? 'Digite uma palavra e escolha uma operação. Prefixos compartilhados viram nós internos.'
      : 'Monte a chave clicando nos bits. O <b>bit 0</b> — testado primeiro, no topo da árvore — fica à esquerda.';
    el.statsKeysLabel.textContent = words ? 'palavras' : 'chaves';
    el.keysTitle.textContent = words ? 'Palavras na árvore' : 'Chaves na árvore';
    el.keysHint.textContent = words
      ? 'Clique em uma palavra para buscá-la.'
      : 'Clique em uma chave para buscá-la.';
    el.emptyTitle.textContent = 'Sua árvore está vazia';
    el.emptyText.textContent = words
      ? 'Digite a primeira palavra ou carregue um exemplo para começar.'
      : 'Insira a primeira chave ou carregue um exemplo para começar.';
    el.execIdle.innerHTML = words
      ? 'Escolha <b>Inserir</b>, <b>Buscar</b> ou <b>Remover</b> para acompanhar cada prefixo comparado, com o caminho destacado na árvore.'
      : 'Escolha <b>Inserir</b>, <b>Buscar</b> ou <b>Remover</b> para acompanhar cada bit testado, com o caminho destacado na árvore.';
    el.btnRandom.title = words
      ? 'Inserir uma palavra aleatória ainda não presente'
      : 'Inserir uma chave binária aleatória ainda não presente';
    el.svg.setAttribute('aria-label', words ? 'Árvore Patricia de palavras' : 'Árvore Patricia binária');
    el.keysList.classList.toggle('word-keys', words);
    el.historyList.classList.toggle('word-keys', words);
    renderLegend();
  }

  function setMode(mode) {
    if (mode !== 'words' && mode !== 'bits') return;
    if (state.mode === mode) return;
    if (state.playback) finishPlayback();

    state.mode = mode;
    state.tree = mode === 'words' ? state.wordTree : state.bitTree;
    state.history = [];
    userAdjusted = false;

    syncModeUI();
    if (mode === 'words') renderWordInput();
    else renderBitInput();
    renderHistory();
    renderExecutionIdle();
    refresh({ animateCam: false });
    showToast(mode === 'words' ? 'Modo palavras ativado.' : 'Modo bits ativado.');
  }

  /* -------------------------------- planos ------------------------------- */
  function buildWalkSteps(key) {
    var tree = state.tree;
    var steps = [];
    var visited = [];
    var edges = [];
    var node = tree.root;

    while (node && node.type === 'internal') {
      var bit = key.charAt(node.bit);
      var child = bit === '1' ? node.right : node.left;
      var edgeId = node.id + '-' + child.id;
      steps.push({
        kind: 'visit',
        nodeId: node.id,
        edgeId: edgeId,
        text: 'Testa o <b>bit ' + node.bit + '</b>: em <span class="mono">' + key +
          '</span> vale <b>' + bit + '</b> → ' + (bit === '1' ? 'desce à direita' : 'desce à esquerda') + '.'
      });
      visited.push(node.id);
      edges.push(edgeId);
      node = child;
    }

    return { steps: steps, leaf: node, visited: visited, edges: edges };
  }

  function buildPlan(op, key) {
    var tree = state.tree;
    var walk = buildWalkSteps(key);
    var steps = walk.steps.slice();

    if (!tree.root) {
      var emptyPlan = {
        op: op, key: key, steps: steps, visited: [], edges: [], leafId: null
      };
      if (op === 'insert') {
        steps.push({ kind: 'success', text: 'Árvore vazia: a chave vira a folha raiz.' });
        emptyPlan.result = 'inserted';
        emptyPlan.commit = function () { return tree.insert(key); };
      } else {
        steps.push({
          kind: 'fail',
          text: 'A árvore está vazia — nada para ' + (op === 'search' ? 'buscar' : 'remover') + '.'
        });
        emptyPlan.result = 'notfound';
      }
      return emptyPlan;
    }

    var leaf = walk.leaf;
    var found = leaf.key === key;
    var plan = {
      op: op,
      key: key,
      steps: steps,
      visited: walk.visited.slice(),
      edges: walk.edges.slice(),
      leafId: leaf.id
    };

    if (op === 'search') {
      steps.push({
        kind: found ? 'success' : 'fail',
        nodeId: leaf.id,
        text: found
          ? 'Chegou à folha <span class="mono">' + leaf.key + '</span>, igual à chave procurada. <b>Encontrada!</b>'
          : 'Chegou à folha <span class="mono">' + leaf.key + '</span>, que difere da chave procurada. <b>Não está na árvore.</b>'
      });
      plan.result = found ? 'found' : 'notfound';
      return plan;
    }

    if (op === 'delete') {
      if (!found) {
        steps.push({
          kind: 'fail',
          nodeId: leaf.id,
          text: 'A folha alcançada é <span class="mono">' + leaf.key +
            '</span>, diferente da chave. <b>Nada a remover.</b>'
        });
        plan.result = 'notfound';
        return plan;
      }
      steps.push({
        kind: 'success',
        nodeId: leaf.id,
        text: 'Folha <span class="mono">' + leaf.key + '</span> encontrada.'
      });
      if (leaf.parent) {
        steps.push({
          kind: 'delete',
          text: 'O nó interno do <b>bit ' + leaf.parent.bit +
            '</b> deixa de existir e o <b>irmão sobe</b> para o lugar dele.'
        });
      } else {
        steps.push({ kind: 'delete', text: 'Era a única chave da árvore: ela ficará vazia.' });
      }
      plan.result = 'deleted';
      plan.commit = function () { return tree.remove(key); };
      return plan;
    }

    /* inserção */
    if (found) {
      steps.push({
        kind: 'fail',
        nodeId: leaf.id,
        text: 'A chave <span class="mono">' + key + '</span> já está na árvore. <b>Nada a inserir.</b>'
      });
      plan.result = 'duplicate';
      return plan;
    }

    var diff = Patricia.firstDiff(key, leaf.key);
    steps.push({
      kind: 'compare',
      nodeId: leaf.id,
      text: 'A folha mais parecida é <span class="mono">' + leaf.key +
        '</span>. Primeiro bit diferente: <b>bit ' + diff + '</b>.'
    });
    steps.push({
      kind: 'insert',
      text: 'Novo nó interno no <b>bit ' + diff + '</b>: a chave entra à <b>' +
        (key.charAt(diff) === '1' ? 'direita' : 'esquerda') + '</b>.'
    });
    plan.result = 'inserted';
    plan.diff = diff;
    plan.commit = function () { return tree.insert(key); };
    return plan;
  }

  /* --------------------------- planos de palavras ------------------------ */
  function wordChild(node, ch) {
    var pos = node.prefix.length;
    for (var i = 0; i < node.children.length; i++) {
      if (Patricia.radixCharAt(node.children[i], pos) === ch) return node.children[i];
    }
    return null;
  }

  function wordPrefixTag(prefix) {
    return prefix ? '<span class="mono">' + esc(prefix) + '</span>' : '<b>raiz</b>';
  }

  function wordCharLabel(ch) {
    return ch === '\0' ? '<b>fim</b>' : '<b>' + esc(ch) + '</b>';
  }

  function buildWordWalk(word) {
    var steps = [];
    var visited = [];
    var edges = [];
    var node = state.tree.root;

    while (node && node.type === 'internal') {
      var prefix = node.prefix;
      var common = Patricia.radixCommonPrefix(word, prefix);

      if (common < prefix.length) {
        var wordChar = common < word.length ? word.charAt(common) : '\0';
        var prefixChar = prefix.charAt(common);
        steps.push({
          kind: 'compare',
          nodeId: node.id,
          text: 'O prefixo ' + wordPrefixTag(prefix) + ' diverge: ' +
            (wordChar === '\0' ? 'a palavra termina (<b>fim</b>)' : 'a palavra traz ' + wordCharLabel(wordChar)) +
            ', mas o nó espera ' + wordCharLabel(prefixChar) + '.'
        });
        visited.push(node.id);
        return {
          steps: steps, leaf: null, visited: visited, edges: edges,
          divergedAt: node, divergedIndex: common, wordChar: wordChar
        };
      }

      var pos = prefix.length;
      var ch = pos < word.length ? word.charAt(pos) : '\0';
      var child = wordChild(node, ch);
      if (!child) {
        steps.push({
          kind: 'compare',
          nodeId: node.id,
          text: (prefix
            ? 'O prefixo ' + wordPrefixTag(prefix) + ' confere, mas'
            : 'Na raiz,') + ' não há aresta com ' +
            wordCharLabel(ch) + '. O caminho para a palavra termina aqui.'
        });
        visited.push(node.id);
        return {
          steps: steps, leaf: null, visited: visited, edges: edges,
          missingAt: node, missingChar: ch
        };
      }

      var edgeId = node.id + '-' + child.id;
      var action = ch === '\0'
        ? 'A palavra termina aqui (<b>fim</b>) → desce pela aresta de término.'
        : 'A próxima letra é ' + wordCharLabel(ch) + ' → desce pela aresta correspondente.';
      steps.push({
        kind: 'visit',
        nodeId: node.id,
        edgeId: edgeId,
        text: prefix
          ? 'O prefixo ' + wordPrefixTag(prefix) + ' aparece no início da palavra. ' + action
          : 'Na raiz, ' + action.charAt(0).toLowerCase() + action.slice(1)
      });
      visited.push(node.id);
      edges.push(edgeId);
      node = child;
    }

    return { steps: steps, leaf: node, visited: visited, edges: edges };
  }

  function addWordAnimation(plan, result) {
    var ids = new Set();
    if (result && result.leaf) ids.add(result.leaf.id);
    if (result && result.internal) ids.add(result.internal.id);
    plan.animateIds = ids;
    plan.newLeafId = result && result.leaf ? result.leaf.id : null;
  }

  function buildWordPlan(op, word) {
    var tree = state.tree;
    var walk = buildWordWalk(word);
    var steps = walk.steps.slice();
    var plan = {
      op: op,
      key: word,
      steps: steps,
      visited: walk.visited.slice(),
      edges: walk.edges.slice(),
      leafId: walk.leaf ? walk.leaf.id : null,
      animateIds: new Set()
    };

    if (!tree.root) {
      if (op === 'insert') {
        var emptyResult = tree.insert(word);
        addWordAnimation(plan, emptyResult);
        steps.push({ kind: 'success', text: 'Árvore vazia: a palavra vira a folha raiz.' });
        plan.result = 'inserted';
        plan.newLeafId = emptyResult.leaf.id;
      } else {
        steps.push({
          kind: 'fail',
          text: 'A árvore está vazia — nada para ' + (op === 'search' ? 'buscar' : 'remover') + '.'
        });
        plan.result = 'notfound';
      }
      return plan;
    }

    if (op === 'search') {
      if (!walk.leaf) {
        steps.push({
          kind: 'fail',
          text: walk.divergedAt
            ? 'O caminho já divergiu do prefixo existente. <b>A palavra não está na árvore.</b>'
            : 'Não existe aresta para a próxima letra. <b>A palavra não está na árvore.</b>'
        });
        plan.result = 'notfound';
        return plan;
      }

      var found = walk.leaf.word === word;
      plan.leafId = walk.leaf.id;
      steps.push({
        kind: found ? 'success' : 'fail',
        nodeId: walk.leaf.id,
        text: found
          ? 'Chegou à folha <span class="mono">' + esc(walk.leaf.word) + '</span>, igual à palavra procurada. <b>Encontrada!</b>'
          : 'Chegou à folha <span class="mono">' + esc(walk.leaf.word) + '</span>, que difere da palavra procurada. <b>Não está na árvore.</b>'
      });
      plan.result = found ? 'found' : 'notfound';
      return plan;
    }

    if (op === 'delete') {
      if (!walk.leaf || walk.leaf.word !== word) {
        steps.push({
          kind: 'fail',
          text: walk.leaf
            ? 'A folha alcançada é <span class="mono">' + esc(walk.leaf.word) + '</span>, diferente da palavra. <b>Nada a remover.</b>'
            : 'A palavra não foi encontrada. <b>Nada a remover.</b>'
        });
        plan.result = 'notfound';
        return plan;
      }

      var leaf = walk.leaf;
      var parent = leaf.parent;
      steps.push({
        kind: 'success',
        nodeId: leaf.id,
        text: 'Folha <span class="mono">' + esc(leaf.word) + '</span> encontrada.'
      });
      if (parent) {
        steps.push({
          kind: parent.children.length === 2 ? 'delete' : 'compare',
          text: parent.children.length === 2
            ? 'O nó do prefixo ' + wordPrefixTag(parent.prefix) +
              ' ficaria com um único filho: ele é <b>contraído</b> e o irmão sobe.'
            : 'A folha é removida; o nó do prefixo ' + wordPrefixTag(parent.prefix) +
              ' continua com os outros filhos.'
        });
      } else {
        steps.push({ kind: 'delete', text: 'Era a única palavra da árvore: ela ficará vazia.' });
      }

      tree.remove(word);
      plan.result = 'deleted';
      return plan;
    }

    /* inserção */
    if (walk.leaf && walk.leaf.word === word) {
      steps.push({
        kind: 'fail',
        nodeId: walk.leaf.id,
        text: 'A palavra <span class="mono">' + esc(word) + '</span> já está na árvore. <b>Nada a inserir.</b>'
      });
      plan.result = 'duplicate';
      return plan;
    }

    if (walk.leaf) {
      var diff = Patricia.radixCommonPrefix(word, walk.leaf.word);
      steps.push({
        kind: 'compare',
        nodeId: walk.leaf.id,
        text: 'A folha mais parecida é <span class="mono">' + esc(walk.leaf.word) +
          '</span>. O maior prefixo comum é ' +
          (diff ? '<span class="mono">' + esc(word.slice(0, diff)) + '</span>' : '<b>nenhum caractere</b>') + '.'
      });
      steps.push({
        kind: 'insert',
        text: 'Um novo nó interno guardará o prefixo ' +
          (diff ? '<span class="mono">' + esc(word.slice(0, diff)) + '</span>' : '<b>vazio</b>') +
          '; a nova palavra entra como folha.'
      });
    } else if (walk.divergedAt) {
      steps.push({
        kind: 'insert',
        text: 'O nó do prefixo será dividido: o novo nó interno fica com ' +
          (walk.divergedIndex ? '<span class="mono">' + esc(word.slice(0, walk.divergedIndex)) + '</span>' : '<b>prefixo vazio</b>') +
          ' e a palavra entra como folha.'
      });
    } else {
      steps.push({
        kind: 'insert',
        text: 'Não existe aresta para ' + wordCharLabel(walk.missingChar) +
          '. Uma nova folha será pendurada no nó do prefixo.'
      });
    }

    var insertResult = tree.insert(word);
    addWordAnimation(plan, insertResult);
    steps.push({
      kind: 'success',
      text: 'Palavra <span class="mono">' + esc(word) + '</span> inserida. <b>Compactação preservada.</b>'
    });
    plan.result = 'inserted';
    return plan;
  }

  /* ---------------------------- execução / UI ---------------------------- */
  function renderExecutionIdle() {
    el.execTitle.textContent = 'Aguardando operação';
    el.execBadge.className = 'badge hidden';
    el.execBadge.textContent = '';
    el.stepsList.innerHTML = '';
    el.execIdle.classList.remove('hidden');
    el.execCounter.textContent = '';
    el.btnSkip.classList.add('hidden');
  }

  function renderExecutionStart(plan) {
    el.execIdle.classList.add('hidden');
    el.stepsList.innerHTML = '';
    el.execBadge.className = 'badge hidden';
    el.execBadge.textContent = '';
    el.execTitle.innerHTML = OP_LABEL[plan.op] + ' <span class="mono">' + esc(plan.key) + '</span>';
    el.execCounter.textContent = 'Preparando…';
    el.btnSkip.classList.toggle('hidden', !state.animate);
  }

  function addStep(step, index) {
    var previous = el.stepsList.querySelector('.step.active');
    if (previous) previous.classList.remove('active');

    var li = document.createElement('li');
    var kindClass = step.kind === 'success' ? ' success' : step.kind === 'fail' ? ' fail' : '';
    li.className = 'step' + kindClass + ' active';

    var marker = document.createElement('span');
    marker.className = 'step-marker';
    marker.textContent = String(index + 1);

    var text = document.createElement('div');
    text.className = 'step-text';
    text.innerHTML = step.text;

    li.appendChild(marker);
    li.appendChild(text);
    el.stepsList.appendChild(li);
    el.stepsList.scrollTop = el.stepsList.scrollHeight;
    return li;
  }

  function setBadge(plan) {
    var map = {
      inserted: ['Inserida', 'ok'],
      deleted: ['Removida', 'ok'],
      found: ['Encontrada', 'ok'],
      duplicate: ['Já existe', 'warn'],
      notfound: ['Não encontrada', 'err']
    };
    var info = map[plan.result] || ['—', 'warn'];
    el.execBadge.textContent = info[0];
    el.execBadge.className = 'badge ' + info[1];
  }

  function finalizePlan(plan) {
    if (plan._done) return;
    plan._done = true;

    var result = plan.commit ? plan.commit() : null;
    var animateIds = new Set(plan.animateIds || []);
    if (result && result.created) {
      animateIds.add(result.leaf.id);
      if (result.internal) animateIds.add(result.internal.id);
    }
    if (plan.newLeafId != null) animateIds.add(plan.newLeafId);

    refresh({ animateIds: animateIds });

    var nodeIds = (plan.visited || []).slice();
    var active = plan.leafId;
    if (plan.op === 'insert' && (plan.newLeafId != null || (result && result.created))) {
      nodeIds.push(plan.newLeafId != null ? plan.newLeafId : result.leaf.id);
      active = null;
    } else if (plan.leafId != null) {
      nodeIds.push(plan.leafId);
    }
    applyHighlight(nodeIds, plan.edges || [], active);

    setBadge(plan);
    recordHistory(plan.op, plan.key, plan.result);
  }

  function stepPlayback() {
    var pb = state.playback;
    if (!pb || pb._finished) return;
    var plan = pb.plan;

    if (pb.index >= plan.steps.length) {
      finishPlayback();
      return;
    }

    var step = plan.steps[pb.index];
    if (step.nodeId != null && pb.visited.indexOf(step.nodeId) === -1) {
      pb.visited.push(step.nodeId);
    }
    if (step.edgeId) pb.edges.push(step.edgeId);

    addStep(step, pb.index);
    applyHighlight(pb.visited, pb.edges, step.nodeId != null ? step.nodeId : null);
    el.execCounter.textContent = 'Passo ' + (pb.index + 1) + ' de ' + plan.steps.length;

    pb.index++;
    var delay = pb.index >= plan.steps.length ? 1000 : 820;
    pb.timer = setTimeout(stepPlayback, delay);
  }

  function startPlayback(plan) {
    renderExecutionStart(plan);
    state.playback = {
      plan: plan,
      index: 0,
      visited: [],
      edges: [],
      timer: null,
      _finished: false
    };
    el.btnSkip.classList.remove('hidden');
    stepPlayback();
  }

  function finishPlayback() {
    var pb = state.playback;
    if (!pb || pb._finished) return;
    pb._finished = true;
    if (pb.timer) clearTimeout(pb.timer);
    state.playback = null;

    for (var i = pb.index; i < pb.plan.steps.length; i++) {
      addStep(pb.plan.steps[i], i);
    }
    finalizePlan(pb.plan);
    el.btnSkip.classList.add('hidden');
    el.execCounter.textContent = 'Concluído · ' + pb.plan.steps.length + ' passos';
    var last = el.stepsList.lastElementChild;
    if (last) last.classList.add('active');
  }

  function runInstant(plan) {
    renderExecutionStart(plan);
    finalizePlan(plan);
    plan.steps.forEach(function (step, index) { addStep(step, index); });
    el.execCounter.textContent = 'Concluído · ' + plan.steps.length + ' passos';
    el.btnSkip.classList.add('hidden');
  }

  function runOperation(op) {
    if (state.playback) finishPlayback();

    var key;
    if (state.mode === 'words') {
      key = readWord();
      if (!key) return;
    } else {
      key = state.input;
      if (!key || key.length !== state.bits) {
        showToast('Monte a chave antes de executar a operação.');
        return;
      }
    }

    var plan = state.mode === 'words' ? buildWordPlan(op, key) : buildPlan(op, key);
    if (state.animate) startPlayback(plan);
    else runInstant(plan);
  }

  /* ------------------------------ ações gerais --------------------------- */
  function loadExample(silent) {
    if (state.playback) finishPlayback();
    var animateIds = new Set();
    var keys;

    if (state.mode === 'words') {
      keys = WORD_EXAMPLE.slice();
      state.wordTree = new Patricia.RadixTree();
      state.tree = state.wordTree;
      keys.forEach(function (key) {
        var result = state.tree.insert(key);
        if (result.created) {
          animateIds.add(result.leaf.id);
          if (result.internal) animateIds.add(result.internal.id);
        }
      });
      state.word = keys[0] || '';
      renderWordInput();
    } else {
      keys = EXAMPLES[state.bits] || [];
      state.bitTree = new Patricia.PatriciaTree(state.bits);
      state.tree = state.bitTree;
      keys.forEach(function (key) {
        var result = state.tree.insert(key);
        if (result.created) {
          animateIds.add(result.leaf.id);
          if (result.internal) animateIds.add(result.internal.id);
        }
      });
      state.input = keys[0] || new Array(state.bits + 1).join('0');
      renderBitInput();
    }

    state.history = [];
    renderHistory();
    renderExecutionIdle();
    userAdjusted = false;
    refresh({ animateIds: animateIds, animateCam: !silent });

    if (!silent) {
      showToast('Exemplo carregado com ' + keys.length + ' ' +
        (state.mode === 'words' ? 'palavras.' : 'chaves.'));
    }
  }

  function clearAll() {
    if (state.playback) finishPlayback();
    state.tree.clear();
    state.history = [];
    renderHistory();
    renderExecutionIdle();
    refresh({});
    showToast(state.mode === 'words' ? 'Árvore de palavras limpa.' : 'Árvore binária limpa.');
  }

  function changeBits(bits) {
    if (bits === state.bits) return;
    if (state.playback) finishPlayback();

    state.bits = bits;
    state.bitTree = new Patricia.PatriciaTree(bits);
    if (state.mode === 'bits') state.tree = state.bitTree;
    state.input = new Array(bits + 1).join('0');
    state.history = [];
    userAdjusted = false;

    renderBitInput();
    if (state.mode === 'bits') {
      renderHistory();
      renderExecutionIdle();
      refresh({ animateCam: false });
    }
    showToast('Largura alterada para ' + bits + ' bits · árvore binária reiniciada.');
  }

  function removeKeyDirect(key) {
    if (state.playback) finishPlayback();
    var result = state.tree.remove(key);
    if (!result.removed) return;
    recordHistory('delete', key, 'deleted');
    renderExecutionIdle();
    refresh({});
    showToast((state.mode === 'words' ? 'Palavra ' : 'Chave ') + key + ' removida.');
  }

  function scrollToStage() {
    try {
      el.canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { /* ignore */ }
  }

  /* -------------------------------- eventos ------------------------------ */
  function bindEvents() {
    el.themeToggle.addEventListener('click', toggleTheme);

    for (var m = 0; m < el.modeButtons.length; m++) {
      el.modeButtons[m].addEventListener('click', function (e) {
        setMode(e.currentTarget.dataset.mode);
      });
    }

    el.wordInput.addEventListener('input', function () {
      state.word = el.wordInput.value;
      updateWordCount();
      clearWordError();
    });
    el.wordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runOperation('insert');
      }
    });

    el.animToggle.addEventListener('change', function () {
      state.animate = el.animToggle.checked;
      if (!state.animate && state.playback) finishPlayback();
    });

    el.btnInsert.addEventListener('click', function () { runOperation('insert'); });
    el.btnSearch.addEventListener('click', function () { runOperation('search'); });
    el.btnDelete.addEventListener('click', function () { runOperation('delete'); });
    el.btnSkip.addEventListener('click', finishPlayback);

    el.btnExample.addEventListener('click', function () { loadExample(false); });
    el.btnEmptyExample.addEventListener('click', function () { loadExample(false); });

    el.btnRandom.addEventListener('click', function () {
      var key = randomKeyForMode();
      if (!key) {
        showToast(state.mode === 'words'
          ? 'Não encontrei uma palavra nova para sugerir.'
          : 'Todas as chaves possíveis já estão na árvore.');
        return;
      }
      if (state.mode === 'words') setWord(key);
      else setInput(key);
      runOperation('insert');
    });

    el.btnClear.addEventListener('click', clearAll);

    el.bitsSelect.addEventListener('change', function () {
      changeBits(Number(el.bitsSelect.value));
    });

    el.keysList.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        removeKeyDirect(removeBtn.getAttribute('data-remove'));
        return;
      }
      var keyBtn = e.target.closest('[data-key]');
      if (keyBtn) {
        var key = keyBtn.getAttribute('data-key');
        if (state.mode === 'words') setWord(key);
        else setInput(key);
        runOperation('search');
      }
    });

    el.svg.addEventListener('click', function (e) {
      if (state.suppressClick) return;
      var leaf = e.target.closest('.node-leaf');
      if (!leaf) return;
      var key = leaf.getAttribute('data-key');
      if (!key) return;
      if (state.mode === 'words') setWord(key);
      else setInput(key);
      runOperation('search');
    });

    el.btnDemoInsert.addEventListener('click', function () {
      var key = randomKeyForMode();
      if (!key) key = state.mode === 'words' ? state.word : state.input;
      if (state.mode === 'words') setWord(key);
      else setInput(key);
      scrollToStage();
      runOperation('insert');
    });

    el.btnDemoSearch.addEventListener('click', function () {
      var keys = state.tree.keys();
      if (!keys.length) {
        showToast(state.mode === 'words'
          ? 'Carregue um exemplo ou insira palavras primeiro.'
          : 'Carregue um exemplo ou insira chaves primeiro.');
        return;
      }
      var key = keys[Math.floor(Math.random() * keys.length)];
      if (state.mode === 'words') setWord(key);
      else setInput(key);
      scrollToStage();
      runOperation('search');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.playback) finishPlayback();
    });
  }

  /* --------------------------------- boot -------------------------------- */
  function init() {
    cacheEls();
    initTheme();
    bindEvents();
    bindCamera();
    updateViewport();

    el.bitsSelect.value = String(state.bits);

    state.bitTree = new Patricia.PatriciaTree(state.bits);
    (EXAMPLES[state.bits] || []).forEach(function (key) { state.bitTree.insert(key); });
    state.input = (EXAMPLES[state.bits] || ['0000'])[0];

    state.wordTree = new Patricia.RadixTree();
    WORD_EXAMPLE.forEach(function (word) { state.wordTree.insert(word); });
    state.word = WORD_EXAMPLE[0];
    state.tree = state.wordTree;

    renderBitInput();
    renderWordInput();
    syncModeUI();
    renderHistory();
    renderExecutionIdle();
    userAdjusted = false;
    refresh({ animateCam: false });
  }

  init();
})();
