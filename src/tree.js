/* =====================================================================
   Árvores digitais compactas
   ---------------------------------------------------------------------
   PatriciaTree: PATRICIA binária — nós internos guardam o índice do bit.
   RadixTree:    radix tree de palavras — nós internos guardam prefixos.
   Modelos puros, sem dependências de DOM. Podem ser testados no Node.
   ===================================================================== */

(function (global, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.Patricia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var nextId = 1;

  function makeLeaf(key, parent) {
    return { id: nextId++, type: 'leaf', key: key, parent: parent || null };
  }

  function makeInternal(bit, parent) {
    return {
      id: nextId++,
      type: 'internal',
      bit: bit,
      left: null,
      right: null,
      parent: parent || null
    };
  }

  /** Primeiro bit em que duas chaves diferem (-1 se iguais). */
  function firstDiff(a, b) {
    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; i++) {
      if (a[i] !== b[i]) return i;
    }
    return -1;
  }

  function PatriciaTree(bits) {
    this.bits = bits;
    this.root = null;
  }

  PatriciaTree.prototype.clear = function () {
    this.root = null;
  };

  /** Desce pelos bits até uma folha. Devolve o caminho percorrido. */
  PatriciaTree.prototype.descend = function (key) {
    var nodes = [];
    var edges = [];
    var node = this.root;
    while (node && node.type === 'internal') {
      var bit = key[node.bit] === '1' ? 1 : 0;
      var child = bit === 1 ? node.right : node.left;
      nodes.push(node.id);
      edges.push([node.id, child.id]);
      node = child;
    }
    return { leaf: node, nodes: nodes, edges: edges };
  };

  /** Busca uma chave. */
  PatriciaTree.prototype.find = function (key) {
    var walk = this.descend(key);
    return {
      found: !!walk.leaf && walk.leaf.key === key,
      leaf: walk.leaf,
      nodes: walk.nodes,
      edges: walk.edges
    };
  };

  /**
   * Insere uma chave.
   * 1. desce até uma folha;
   * 2. acha o primeiro bit diferente entre a nova chave e a folha;
   * 3. sobe enquanto o pai testar um bit maior que esse;
   * 4. cria um nó interno no bit divergente.
   */
  PatriciaTree.prototype.insert = function (key) {
    var walk = this.descend(key);
    var leaf = walk.leaf;

    if (!leaf) {
      var rootLeaf = makeLeaf(key, null);
      this.root = rootLeaf;
      return { created: true, wasEmpty: true, leaf: rootLeaf, diff: -1, nodes: walk.nodes, edges: walk.edges };
    }

    if (leaf.key === key) {
      return { created: false, duplicate: true, leaf: leaf, nodes: walk.nodes, edges: walk.edges };
    }

    var diff = firstDiff(key, leaf.key);
    var anchor = leaf;
    while (anchor.parent && anchor.parent.bit > diff) {
      anchor = anchor.parent;
    }

    var parent = anchor.parent;
    var internal = makeInternal(diff, parent);
    var newLeaf = makeLeaf(key, null);

    if (key[diff] === '0') {
      internal.left = newLeaf;
      internal.right = anchor;
    } else {
      internal.left = anchor;
      internal.right = newLeaf;
    }
    newLeaf.parent = internal;
    anchor.parent = internal;

    if (!parent) {
      this.root = internal;
    } else if (parent.left === anchor) {
      parent.left = internal;
    } else {
      parent.right = internal;
    }

    return {
      created: true,
      wasEmpty: false,
      leaf: newLeaf,
      diff: diff,
      internal: internal,
      previousLeaf: leaf,
      nodes: walk.nodes,
      edges: walk.edges
    };
  };

  /** Remove uma chave, promovendo o irmão da folha removida. */
  PatriciaTree.prototype.remove = function (key) {
    var walk = this.descend(key);
    var leaf = walk.leaf;

    if (!leaf || leaf.key !== key) {
      return { removed: false, leaf: leaf, nodes: walk.nodes, edges: walk.edges };
    }

    var parent = leaf.parent;
    if (!parent) {
      this.root = null;
      return { removed: true, promoted: null, removedLeaf: leaf, nodes: walk.nodes, edges: walk.edges };
    }

    var sibling = parent.left === leaf ? parent.right : parent.left;
    var grand = parent.parent;
    sibling.parent = grand;

    if (!grand) {
      this.root = sibling;
    } else if (grand.left === parent) {
      grand.left = sibling;
    } else {
      grand.right = sibling;
    }

    return {
      removed: true,
      promoted: sibling,
      removedLeaf: leaf,
      centerBit: parent.bit,
      nodes: walk.nodes,
      edges: walk.edges
    };
  };

  /** Chaves em ordem crescente. */
  PatriciaTree.prototype.keys = function () {
    var out = [];
    (function walk(node) {
      if (!node) return;
      if (node.type === 'leaf') out.push(node.key);
      else {
        walk(node.left);
        walk(node.right);
      }
    })(this.root);
    return out.sort();
  };

  /** Estatísticas para a interface. */
  PatriciaTree.prototype.stats = function () {
    var internal = 0;
    var leaves = 0;
    var height = 0;
    (function walk(node, depth) {
      if (!node) return;
      if (node.type === 'leaf') {
        leaves++;
        return;
      }
      internal++;
      if (depth + 1 > height) height = depth + 1;
      walk(node.left, depth + 1);
      walk(node.right, depth + 1);
    })(this.root, 0);
    return { internal: internal, leaves: leaves, height: height, keys: leaves };
  };

  /** Percorre todos os nós (para testes/depuração). */
  PatriciaTree.prototype.forEach = function (fn) {
    (function walk(node, depth) {
      if (!node) return;
      fn(node, depth);
      if (node.type === 'internal') {
        walk(node.left, depth + 1);
        walk(node.right, depth + 1);
      }
    })(this.root, 0);
  };

  /* =====================================================================
     RadixTree — árvore digital compacta de palavras
     ---------------------------------------------------------------------
     Nós internos guardam um prefixo comum (string absoluta, começando na
     raiz). Folhas guardam a palavra completa. O terminador '\0' representa
     o fim de uma palavra e permite que "casa" seja prefixo de "casaco".
     ===================================================================== */

  function makeRadixLeaf(word, parent) {
    return { id: nextId++, type: 'leaf', word: word, parent: parent || null };
  }

  function makeRadixInternal(prefix, parent) {
    return {
      id: nextId++,
      type: 'internal',
      prefix: prefix,
      children: [],
      parent: parent || null
    };
  }

  /** Maior prefixo comum entre duas strings. */
  function radixCommonPrefix(a, b) {
    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; i++) {
      if (a.charAt(i) !== b.charAt(i)) return i;
    }
    return len;
  }

  /**
   * Caractere que rotula a aresta que chega ao nó.
   * Índice = tamanho do prefixo do pai. '\0' significa fim de palavra.
   */
  function radixCharAt(node, index) {
    var text = node.type === 'leaf' ? node.word : node.prefix;
    return index < text.length ? text.charAt(index) : '\0';
  }

  function sortRadixChildren(node) {
    var pos = node.prefix.length;
    node.children.sort(function (a, b) {
      var ca = radixCharAt(a, pos);
      var cb = radixCharAt(b, pos);
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
  }

  function findRadixChild(node, ch) {
    var pos = node.prefix.length;
    for (var i = 0; i < node.children.length; i++) {
      if (radixCharAt(node.children[i], pos) === ch) return node.children[i];
    }
    return null;
  }

  function replaceRadixChild(tree, parent, oldChild, newChild) {
    if (!parent) {
      tree.root = newChild;
      return;
    }
    var index = parent.children.indexOf(oldChild);
    if (index === -1) parent.children.push(newChild);
    else parent.children[index] = newChild;
    sortRadixChildren(parent);
  }

  function RadixTree() {
    this.root = null;
  }

  RadixTree.prototype.clear = function () {
    this.root = null;
  };

  /** Desce pelos prefixos até uma folha (ou até faltar um filho). */
  RadixTree.prototype.descend = function (word) {
    var nodes = [];
    var edges = [];
    var node = this.root;
    while (node && node.type === 'internal') {
      var ch = radixCharAt({ type: 'leaf', word: word }, node.prefix.length);
      var child = findRadixChild(node, ch);
      nodes.push(node.id);
      if (!child) return { leaf: null, nodes: nodes, edges: edges, missingAt: node.id, missingChar: ch };
      edges.push(node.id + '-' + child.id);
      node = child;
    }
    return { leaf: node, nodes: nodes, edges: edges, missingAt: null };
  };

  RadixTree.prototype.find = function (word) {
    var walk = this.descend(word);
    return {
      found: !!walk.leaf && walk.leaf.word === word,
      leaf: walk.leaf,
      nodes: walk.nodes,
      edges: walk.edges,
      missingAt: walk.missingAt,
      missingChar: walk.missingChar
    };
  };

  /**
   * Insere uma palavra.
   * - divergência dentro de um prefixo interno: o nó é dividido;
   * - caminho completo até uma folha: divide a folha no maior prefixo comum;
   * - filho ausente: basta pendurar uma nova folha.
   */
  RadixTree.prototype.insert = function (word) {
    word = String(word);
    var walkNodes = [];
    var walkEdges = [];

    if (!this.root) {
      var rootLeaf = makeRadixLeaf(word, null);
      this.root = rootLeaf;
      return { created: true, wasEmpty: true, leaf: rootLeaf, nodes: walkNodes, edges: walkEdges };
    }

    var node = this.root;
    var parent = null;

    while (node.type === 'internal') {
      walkNodes.push(node.id);
      var common = radixCommonPrefix(word, node.prefix);

      if (common < node.prefix.length) {
        var oldInternal = node;
        var splitInternal = makeRadixInternal(word.slice(0, common), parent);
        var splitLeaf = makeRadixLeaf(word, splitInternal);
        oldInternal.parent = splitInternal;
        splitInternal.children = [oldInternal, splitLeaf];
        sortRadixChildren(splitInternal);
        replaceRadixChild(this, parent, oldInternal, splitInternal);

        return {
          created: true,
          wasEmpty: false,
          leaf: splitLeaf,
          internal: splitInternal,
          splitInside: true,
          splitPos: common,
          nodes: walkNodes.slice(0, -1),
          edges: walkEdges
        };
      }

      var ch = radixCharAt({ type: 'leaf', word: word }, node.prefix.length);
      var child = findRadixChild(node, ch);
      if (!child) {
        var addedLeaf = makeRadixLeaf(word, node);
        node.children.push(addedLeaf);
        sortRadixChildren(node);
        return {
          created: true,
          wasEmpty: false,
          leaf: addedLeaf,
          parent: node,
          nodes: walkNodes,
          edges: walkEdges
        };
      }

      walkEdges.push(node.id + '-' + child.id);
      parent = node;
      node = child;
    }

    if (node.word === word) {
      return { created: false, duplicate: true, leaf: node, nodes: walkNodes, edges: walkEdges };
    }

    var lcp = radixCommonPrefix(word, node.word);
    var leafInternal = makeRadixInternal(word.slice(0, lcp), parent);
    var newLeaf = makeRadixLeaf(word, leafInternal);
    node.parent = leafInternal;
    leafInternal.children = [node, newLeaf];
    sortRadixChildren(leafInternal);
    replaceRadixChild(this, parent, node, leafInternal);

    return {
      created: true,
      wasEmpty: false,
      leaf: newLeaf,
      internal: leafInternal,
      previousLeaf: node,
      splitPos: lcp,
      nodes: walkNodes,
      edges: walkEdges
    };
  };

  /** Remove uma palavra e contrai o pai quando ele fica com um só filho. */
  RadixTree.prototype.remove = function (word) {
    var walk = this.descend(word);
    var leaf = walk.leaf;

    if (!leaf || leaf.word !== word) {
      return { removed: false, leaf: leaf, nodes: walk.nodes, edges: walk.edges };
    }

    var parent = leaf.parent;
    if (!parent) {
      this.root = null;
      return { removed: true, promoted: null, removedLeaf: leaf, nodes: walk.nodes, edges: walk.edges };
    }

    var index = parent.children.indexOf(leaf);
    if (index !== -1) parent.children.splice(index, 1);

    if (parent.children.length === 1) {
      var sibling = parent.children[0];
      var grand = parent.parent;
      sibling.parent = grand;
      replaceRadixChild(this, grand, parent, sibling);
      return {
        removed: true,
        promoted: sibling,
        removedLeaf: leaf,
        contractedPrefix: parent.prefix,
        nodes: walk.nodes,
        edges: walk.edges
      };
    }

    return {
      removed: true,
      promoted: null,
      removedLeaf: leaf,
      parent: parent,
      nodes: walk.nodes,
      edges: walk.edges
    };
  };

  RadixTree.prototype.keys = function () {
    var out = [];
    (function walk(node) {
      if (!node) return;
      if (node.type === 'leaf') out.push(node.word);
      else node.children.forEach(walk);
    })(this.root);
    out.sort();
    return out;
  };

  RadixTree.prototype.stats = function () {
    var internal = 0;
    var leaves = 0;
    var height = 0;
    (function walk(node, depth) {
      if (!node) return;
      if (node.type === 'leaf') {
        leaves++;
        return;
      }
      internal++;
      if (depth + 1 > height) height = depth + 1;
      node.children.forEach(function (child) { walk(child, depth + 1); });
    })(this.root, 0);
    return { internal: internal, leaves: leaves, height: height, keys: leaves };
  };

  RadixTree.prototype.forEach = function (fn) {
    (function walk(node, depth) {
      if (!node) return;
      fn(node, depth);
      if (node.type === 'internal') {
        node.children.forEach(function (child) { walk(child, depth + 1); });
      }
    })(this.root, 0);
  };

  return {
    PatriciaTree: PatriciaTree,
    firstDiff: firstDiff,
    RadixTree: RadixTree,
    radixCharAt: radixCharAt,
    radixCommonPrefix: radixCommonPrefix
  };
});
