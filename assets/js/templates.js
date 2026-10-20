/*!
 * Dijital Davetiye — şablon kaydı ve süsleme (SVG) üreticileri
 * MIT Lisansı
 *
 * Yeni şablon eklemek için: docs/sablon-ekleme.md
 *  1) templates/<id>.css dosyasını oluşturun
 *  2) Aşağıdaki DV.TEMPLATES listesine bir kayıt ekleyin
 */
(function (global) {
  'use strict';
  var DV = global.DV;

  /* ------------------------------------------------------------------ *
   *  SVG yardımcıları
   * ------------------------------------------------------------------ */

  function r(n) { return Math.round(n * 100) / 100; }

  function svg(vb, inner, extra) {
    return '<svg viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (extra || '') + '>' + inner + '</svg>';
  }

  function mirror(inner, width) {
    return '<g>' + inner + '</g><g transform="translate(' + width + ' 0) scale(-1 1)">' + inner + '</g>';
  }

  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  var LEAF = {
    almond: 'M0 0C.3-.24.7-.24 1 0 .7.24.3.24 0 0Z',
    round: 'M0 0C0-.46.86-.52.86 0 .86.52 0 .46 0 0Z',
    olive: 'M0 0C.35-.14.75-.14 1 0 .75.14.35.14 0 0Z',
    slim: 'M0 0C.4-.1.8-.06 1 0 .8.06.4.1 0 0Z'
  };

  /** Kuadratik eğri boyunca yapraklı dal üretir. */
  function branch(o) {
    var s = '<path d="M' + o.x0 + ' ' + o.y0 + 'Q' + o.cx + ' ' + o.cy + ' ' + o.x1 + ' ' + o.y1 + '" stroke-width="' + (o.sw || 1.1) + '"/>';
    var leaf = LEAF[o.leaf || 'almond'];
    var ops = o.ops || [1];
    for (var i = 1; i <= o.n; i++) {
      var t = i / (o.n + 0.7), mt = 1 - t;
      var x = mt * mt * o.x0 + 2 * mt * t * o.cx + t * t * o.x1;
      var y = mt * mt * o.y0 + 2 * mt * t * o.cy + t * t * o.y1;
      var dx = 2 * mt * (o.cx - o.x0) + 2 * t * (o.x1 - o.cx);
      var dy = 2 * mt * (o.cy - o.y0) + 2 * t * (o.y1 - o.cy);
      var a = Math.atan2(dy, dx) * 180 / Math.PI;
      var sides = o.pairs ? [1, -1] : [i % 2 ? 1 : -1];
      for (var k = 0; k < sides.length; k++) {
        var side = sides[k];
        var sc = o.size * (1 - t * (o.taper == null ? 0.4 : o.taper));
        var op = ops[(i + k) % ops.length];
        s += '<path d="' + leaf + '" transform="translate(' + r(x) + ' ' + r(y) + ') rotate(' + r(a + side * (o.angle || 50)) + ') scale(' + r(sc) + ')" fill="currentColor" stroke="none" opacity="' + op + '"/>';
        if (o.berries && i % 3 === 0 && k === 0) {
          var ba = (a - side * 70) * Math.PI / 180;
          s += '<ellipse cx="' + r(x + Math.cos(ba) * sc * 0.45) + '" cy="' + r(y + Math.sin(ba) * sc * 0.45) + '" rx="' + r(sc * 0.17) + '" ry="' + r(sc * 0.22) + '" style="fill:var(--accent)" stroke="none"/>';
        }
      }
    }
    var ta = Math.atan2(o.y1 - o.cy, o.x1 - o.cx) * 180 / Math.PI;
    s += '<path d="' + leaf + '" transform="translate(' + o.x1 + ' ' + o.y1 + ') rotate(' + r(ta) + ') scale(' + r(o.size * 0.62) + ')" fill="currentColor" stroke="none"/>';
    return s;
  }

  function star4(x, y, s) {
    var k = s * 0.22;
    return 'M' + r(x) + ' ' + r(y - s) + 'L' + r(x + k) + ' ' + r(y - k) + 'L' + r(x + s) + ' ' + r(y) + 'L' + r(x + k) + ' ' + r(y + k) +
      'L' + r(x) + ' ' + r(y + s) + 'L' + r(x - k) + ' ' + r(y + k) + 'L' + r(x - s) + ' ' + r(y) + 'L' + r(x - k) + ' ' + r(y - k) + 'Z';
  }

  function flower(cx, cy, R, petals, rot, inner) {
    var s = '<g transform="translate(' + r(cx) + ' ' + r(cy) + ') rotate(' + (rot || 0) + ')">';
    for (var i = 0; i < petals; i++) {
      s += '<ellipse cx="0" cy="' + r(-R * 0.52) + '" rx="' + r(R * 0.36) + '" ry="' + r(R * 0.55) + '" transform="rotate(' + r(i * 360 / petals) + ')" style="fill:var(--accent)" stroke="none" opacity=".9"/>';
    }
    if (inner !== false) {
      for (var j = 0; j < petals; j++) {
        s += '<ellipse cx="0" cy="' + r(-R * 0.3) + '" rx="' + r(R * 0.22) + '" ry="' + r(R * 0.34) + '" transform="rotate(' + r(j * 360 / petals + 180 / petals) + ')" fill="currentColor" stroke="none" opacity=".55"/>';
      }
    }
    s += '<circle r="' + r(R * 0.16) + '" fill="currentColor" stroke="none"/></g>';
    return s;
  }

  function snowflake(x, y, L, rot) {
    var s = '<g transform="translate(' + r(x) + ' ' + r(y) + ') rotate(' + (rot || 0) + ')">';
    for (var i = 0; i < 6; i++) {
      s += '<g transform="rotate(' + i * 60 + ')"><path d="M0 0V' + r(-L) + 'M0 ' + r(-L * 0.55) + 'l' + r(L * 0.22) + ' ' + r(-L * 0.2) + 'M0 ' + r(-L * 0.55) + 'l' + r(-L * 0.22) + ' ' + r(-L * 0.2) + 'M0 ' + r(-L * 0.8) + 'l' + r(L * 0.14) + ' ' + r(-L * 0.12) + 'M0 ' + r(-L * 0.8) + 'l' + r(-L * 0.14) + ' ' + r(-L * 0.12) + '"/></g>';
    }
    return s + '</g>';
  }

  function tulip(x, y, sc, rot) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ') scale(' + sc + ') translate(-30 -98)">' +
      '<path d="M30 98C30 82 31 66 30 52" stroke-width="1.4"/>' +
      '<path d="M30 92C18 86 10 72 8 56 18 64 26 74 30 86Z" fill="currentColor" stroke="none" opacity=".75"/>' +
      '<path d="M30 84C42 78 50 64 52 50 42 58 34 66 30 78Z" fill="currentColor" stroke="none" opacity=".6"/>' +
      '<path d="M30 53C17 51 11 36 15 13 20 24 25 28 30 30 35 28 40 24 45 13 49 36 43 51 30 53Z" fill="currentColor" stroke="none"/>' +
      '<path d="M30 47C24 39 24 21 30 5 36 21 36 39 30 47Z" style="fill:var(--accent)" stroke="none"/>' +
      '</g>';
  }

  function lavender(x, y, len, rot, seed) {
    var rand = rng(seed || 7);
    var s = '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')">';
    s += '<path d="M0 0V' + (-len) + '" stroke-width="1.1"/>';
    s += '<path d="' + LEAF.slim + '" transform="translate(0 ' + r(-len * 0.12) + ') rotate(-120) scale(' + r(len * 0.28) + ')" fill="currentColor" stroke="none" opacity=".7"/>';
    s += '<path d="' + LEAF.slim + '" transform="translate(0 ' + r(-len * 0.2) + ') rotate(-60) scale(' + r(len * 0.24) + ')" fill="currentColor" stroke="none" opacity=".7"/>';
    var n = 13;
    for (var i = 0; i < n; i++) {
      var t = 0.45 + (i / n) * 0.55;
      var by = -len * t;
      var side = i % 2 ? 1 : -1;
      var bs = 2.6 * (1 - (i / n) * 0.45);
      s += '<ellipse cx="' + r(side * bs * 0.9) + '" cy="' + r(by) + '" rx="' + r(bs * 0.75) + '" ry="' + r(bs * 1.25) + '" transform="rotate(' + r(side * 28) + ' ' + r(side * bs * 0.9) + ' ' + r(by) + ')" style="fill:var(--accent)" stroke="none" opacity="' + r(0.7 + rand() * 0.3) + '"/>';
    }
    return s + '</g>';
  }

  /* ------------------------------------------------------------------ *
   *  Süslemeler — her biri SVG metni döndürür.
   *  Renkler: currentColor = --primary, style="fill:var(--accent)" = vurgu
   * ------------------------------------------------------------------ */

  var D = (DV.decor = {});

  D.flourishTop = function () {
    var half =
      '<path d="M120 46C134 46 139 35 151 33 165 31 171 43 163 47 157 50 153 43 158 40"/>' +
      '<path d="M120 46C150 48 178 41 198 27 208 20 221 19 227 26 231 31 226 37 221 34"/>' +
      '<path d="M140 52C160 55 186 53 204 45"/>' +
      '<path d="M172 38C176 30 184 27 190 29" opacity=".7"/>' +
      '<circle cx="232" cy="44" r="1.6" fill="currentColor" stroke="none"/>';
    return svg('0 0 240 60', mirror(half, 240) +
      '<path d="M120 22L127 31 120 40 113 31Z" fill="currentColor" stroke="none"/>' +
      '<path d="M120 8C123 13 123 17 120 20 117 17 117 13 120 8Z" fill="currentColor" stroke="none" opacity=".8"/>' +
      '<circle cx="120" cy="48" r="2" fill="currentColor" stroke="none"/>');
  };

  D.flourish = function () {
    var half =
      '<path d="M129 15H168"/>' +
      '<path d="M168 15C180 15 184 6 192 8 200 10 198 20 191 19 186 18 187 12 192 12"/>' +
      '<path d="M200 15H230"/><circle cx="235" cy="15" r="1.6" fill="currentColor" stroke="none"/>';
    return svg('0 0 240 30', mirror(half, 240) + '<path d="M120 8L127 15 120 22 113 15Z" fill="currentColor" stroke="none"/>');
  };

  D.goldCorner = function () {
    return svg('0 0 100 100',
      '<path d="M4 98V32C4 15 15 4 32 4H98"/>' +
      '<path d="M11 98V38C11 23 23 11 38 11H98" opacity=".6"/>' +
      '<path d="M4 32C20 32 32 20 32 4" opacity=".8"/>' +
      '<path d="M18 18C24 22 30 22 34 18M18 18C22 24 22 30 18 34" opacity=".8"/>' +
      '<circle cx="18" cy="18" r="2.4" fill="currentColor" stroke="none"/>' +
      '<circle cx="52" cy="11" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="52" r="1.4" fill="currentColor" stroke="none"/>');
  };

  D.line = function () {
    return svg('0 0 240 20', '<path d="M90 10H150" stroke-width="1"/>');
  };

  D.eucalyptusTop = function () {
    var left = branch({ x0: 150, y0: 92, cx: 72, cy: 98, x1: 14, y1: 34, n: 9, size: 21, leaf: 'round', pairs: true, angle: 62, ops: [0.95, 0.65, 0.8, 0.5], taper: 0.45 });
    return svg('0 0 300 110', mirror(left, 300) + '<circle cx="150" cy="92" r="3.2" style="fill:var(--accent)" stroke="none"/>');
  };

  D.eucalyptusCorner = function () {
    return svg('0 0 170 170',
      branch({ x0: 6, y0: 164, cx: 18, cy: 40, x1: 150, y1: 10, n: 11, size: 22, leaf: 'round', pairs: true, angle: 58, ops: [0.9, 0.55, 0.75, 0.45] }) +
      branch({ x0: 26, y0: 110, cx: 60, cy: 76, x1: 96, y1: 78, n: 4, size: 15, leaf: 'almond', pairs: false, angle: 45, ops: [0.6, 0.8] }));
  };

  D.sprig = function () {
    var right = branch({ x0: 132, y0: 15, cx: 160, cy: 15, x1: 196, y1: 12, n: 4, size: 11, leaf: 'almond', angle: 48, ops: [0.9, 0.6] });
    return svg('0 0 240 30', mirror(right, 240) + '<circle cx="120" cy="15" r="3" style="fill:var(--accent)" stroke="none"/><circle cx="120" cy="15" r="6.5" stroke-width=".9"/>');
  };

  D.oliveTop = function () {
    var left = branch({ x0: 150, y0: 96, cx: 70, cy: 100, x1: 16, y1: 40, n: 10, size: 26, leaf: 'olive', pairs: true, angle: 42, ops: [0.95, 0.7], berries: true, taper: 0.35 });
    return svg('0 0 300 110', mirror(left, 300));
  };

  D.oliveSprig = function () {
    return svg('0 0 240 34', branch({ x0: 70, y0: 22, cx: 120, cy: 4, x1: 172, y1: 20, n: 7, size: 15, leaf: 'olive', pairs: true, angle: 40, berries: true, ops: [0.9, 0.65], taper: 0.2 }));
  };

  D.starsTop = function () {
    var rand = rng(42), s = '';
    for (var i = 0; i < 16; i++) {
      var x = 18 + rand() * 264, y = 8 + rand() * 96;
      if (Math.abs(x - 150) < 40 && y < 90) continue;
      var sz = 2 + rand() * 5.5;
      s += '<path d="' + star4(x, y, sz) + '" fill="currentColor" stroke="none" opacity="' + r(0.45 + rand() * 0.55) + '"/>';
    }
    for (var j = 0; j < 14; j++) s += '<circle cx="' + r(10 + rand() * 280) + '" cy="' + r(6 + rand() * 100) + '" r="' + r(0.6 + rand() * 0.9) + '" fill="currentColor" stroke="none" opacity=".7"/>';
    s += '<path d="M163 26A30 30 0 1 0 170 72 24 24 0 1 1 163 26Z" fill="currentColor" stroke="none"/>';
    s += '<path d="' + star4(138, 40, 5) + '" style="fill:var(--accent)" stroke="none"/>';
    return svg('0 0 300 110', s);
  };

  D.starLine = function () {
    return svg('0 0 240 30', '<path d="M40 15H100M140 15H200" opacity=".6"/>' +
      '<path d="' + star4(120, 15, 9) + '" fill="currentColor" stroke="none"/>' +
      '<path d="' + star4(104, 15, 3) + '" fill="currentColor" stroke="none"/><path d="' + star4(136, 15, 3) + '" fill="currentColor" stroke="none"/>');
  };

  D.floralTop = function () {
    var s = '';
    s += branch({ x0: 150, y0: 70, cx: 100, cy: 92, x1: 40, y1: 70, n: 5, size: 20, leaf: 'almond', angle: 45, ops: [0.55, 0.8] });
    s += branch({ x0: 150, y0: 70, cx: 200, cy: 92, x1: 260, y1: 70, n: 5, size: 20, leaf: 'almond', angle: 45, ops: [0.55, 0.8] });
    s += flower(150, 58, 30, 6, 0);
    s += flower(104, 72, 19, 5, 20);
    s += flower(196, 72, 19, 5, -20);
    s += flower(66, 80, 11, 5, 10, false);
    s += flower(234, 80, 11, 5, -10, false);
    s += '<circle cx="124" cy="34" r="3" style="fill:var(--accent)" stroke="none"/><circle cx="178" cy="32" r="2.4" style="fill:var(--accent)" stroke="none"/><circle cx="84" cy="56" r="2" fill="currentColor" stroke="none" opacity=".5"/><circle cx="218" cy="56" r="2" fill="currentColor" stroke="none" opacity=".5"/>';
    return svg('0 0 300 110', s);
  };

  D.floralCorner = function () {
    var s = branch({ x0: 8, y0: 150, cx: 14, cy: 40, x1: 130, y1: 10, n: 7, size: 20, leaf: 'almond', angle: 48, ops: [0.5, 0.75] });
    s += flower(40, 44, 24, 6, 15);
    s += flower(84, 26, 14, 5, -10, false);
    s += flower(22, 92, 13, 5, 30, false);
    return svg('0 0 160 160', s);
  };

  D.flowerLine = function () {
    return svg('0 0 240 30', '<path d="M50 15H102M138 15H190" opacity=".5"/>' + flower(120, 15, 12, 5, 0));
  };

  D.tulipTop = function () {
    var s = tulip(150, 104, 0.92, 0) + tulip(118, 106, 0.66, -26) + tulip(182, 106, 0.66, 26);
    s += '<path d="M60 100C80 100 90 88 104 90M240 100C220 100 210 88 196 90" opacity=".7"/>';
    s += '<circle cx="56" cy="100" r="2" fill="currentColor" stroke="none"/><circle cx="244" cy="100" r="2" fill="currentColor" stroke="none"/>';
    return svg('0 0 300 110', s);
  };

  D.tulipLine = function () {
    return svg('0 0 240 40', '<path d="M40 30H100M140 30H200" opacity=".6"/><circle cx="36" cy="30" r="1.8" fill="currentColor" stroke="none"/><circle cx="204" cy="30" r="1.8" fill="currentColor" stroke="none"/>' + tulip(120, 38, 0.36, 0));
  };

  D.archesTop = function () {
    var s = '';
    var radii = [86, 68, 50, 32];
    var fills = ['currentColor', 'var(--accent)', 'var(--muted)', 'currentColor'];
    for (var i = 0; i < radii.length; i++) {
      var R = radii[i];
      s += '<path d="M' + (150 - R) + ' 104A' + R + ' ' + R + ' 0 0 1 ' + (150 + R) + ' 104" style="stroke:' + fills[i] + '" stroke-width="11" stroke-linecap="butt" opacity="' + (i === 2 ? 0.55 : 0.9) + '"/>';
    }
    s += '<path d="M30 104H270" stroke-width="1"/>';
    var rand = rng(9);
    for (var j = 0; j < 7; j++) s += '<circle cx="' + r(30 + rand() * 50) + '" cy="' + r(30 + rand() * 60) + '" r="' + r(1 + rand() * 1.4) + '" fill="currentColor" stroke="none" opacity=".5"/><circle cx="' + r(220 + rand() * 50) + '" cy="' + r(30 + rand() * 60) + '" r="' + r(1 + rand() * 1.4) + '" fill="currentColor" stroke="none" opacity=".5"/>';
    return svg('0 0 300 110', s);
  };

  D.bohoLine = function () {
    return svg('0 0 240 30', '<path d="M108 22A12 12 0 0 1 132 22" stroke-width="3"/><path d="M113 22A7 7 0 0 1 127 22" style="stroke:var(--accent)" stroke-width="3"/>' +
      '<circle cx="80" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="92" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="148" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="160" cy="20" r="1.8" fill="currentColor" stroke="none"/>');
  };

  D.decoFan = function () {
    var s = '', cx = 120, cy = 118;
    for (var a = 180; a <= 360; a += 12) {
      var rad = a * Math.PI / 180;
      s += '<path d="M' + r(cx + Math.cos(rad) * 34) + ' ' + r(cy + Math.sin(rad) * 34) + 'L' + r(cx + Math.cos(rad) * 96) + ' ' + r(cy + Math.sin(rad) * 96) + '" opacity="' + (a % 24 === 0 ? 1 : 0.55) + '"/>';
    }
    s += '<path d="M' + (cx - 34) + ' ' + cy + 'A34 34 0 0 1 ' + (cx + 34) + ' ' + cy + '"/>';
    s += '<path d="M' + (cx - 24) + ' ' + cy + 'A24 24 0 0 1 ' + (cx + 24) + ' ' + cy + '" fill="currentColor" stroke="none" opacity=".25"/>';
    s += '<path d="M' + (cx - 96) + ' ' + cy + 'A96 96 0 0 1 ' + (cx + 96) + ' ' + cy + '"/>';
    s += '<path d="M' + (cx - 104) + ' ' + cy + 'A104 104 0 0 1 ' + (cx + 104) + ' ' + cy + '" opacity=".5"/>';
    s += '<path d="M2 118H240M8 112H16M224 112H232" />';
    s += '<path d="M120 2L126 9 120 16 114 9Z" fill="currentColor" stroke="none"/>';
    return svg('0 0 240 122', s);
  };

  D.decoCorner = function () {
    return svg('0 0 90 90',
      '<path d="M3 87V3H87"/><path d="M10 87V10H87" opacity=".65"/><path d="M17 60V17H60" opacity=".5"/>' +
      '<path d="M3 30H10M30 3V10" />' +
      '<path d="M26 20L32 26 26 32 20 26Z" fill="currentColor" stroke="none"/>');
  };

  D.decoLine = function () {
    return svg('0 0 240 30',
      '<path d="M30 15H98M142 15H210M60 9H98M142 9H180M60 21H98M142 21H180" opacity=".75"/>' +
      '<path d="M120 4L131 15 120 26 109 15Z"/><path d="M120 9L126 15 120 21 114 15Z" fill="currentColor" stroke="none"/>');
  };

  D.snowTop = function () {
    var s = snowflake(150, 52, 30, 0) + snowflake(96, 70, 15, 15) + snowflake(204, 70, 15, -10) +
      snowflake(60, 34, 9, 5) + snowflake(240, 34, 9, 20) + snowflake(118, 20, 7, 0) + snowflake(184, 22, 6, 0);
    var rand = rng(5);
    for (var i = 0; i < 18; i++) s += '<circle cx="' + r(20 + rand() * 260) + '" cy="' + r(6 + rand() * 100) + '" r="' + r(0.8 + rand() * 1.4) + '" fill="currentColor" stroke="none" opacity=".5"/>';
    return svg('0 0 300 110', s);
  };

  D.snowLine = function () {
    return svg('0 0 240 30', '<path d="M50 15H102M138 15H190" opacity=".5"/>' + snowflake(120, 15, 11, 0));
  };

  D.lightsTop = function () {
    var s = '<path d="M-4 10Q75 62 150 18Q225 62 304 10" stroke-width="1.1"/>';
    var segs = [[-4, 10, 75, 62, 150, 18], [150, 18, 225, 62, 304, 10]];
    segs.forEach(function (g) {
      for (var t = 0.12; t < 0.95; t += 0.15) {
        var mt = 1 - t;
        var x = mt * mt * g[0] + 2 * mt * t * g[2] + t * t * g[4];
        var y = mt * mt * g[1] + 2 * mt * t * g[3] + t * t * g[5];
        s += '<path d="M' + r(x) + ' ' + r(y) + 'v5" stroke-width="1"/>';
        s += '<circle cx="' + r(x) + '" cy="' + r(y + 10) + '" r="9" style="fill:var(--accent)" stroke="none" opacity=".22"/>';
        s += '<ellipse cx="' + r(x) + '" cy="' + r(y + 10) + '" rx="3.4" ry="4.4" style="fill:var(--accent)" stroke="none"/>';
      }
    });
    return svg('0 0 300 80', s);
  };

  D.heartLine = function () {
    var h = 'M120 24C112 18 106 14 106 9A5 5 0 0 1 120 6 5 5 0 0 1 134 9C134 14 128 18 120 24Z';
    return svg('0 0 240 30', '<path d="M30 15C55 10 75 20 98 15M142 15C165 10 185 20 210 15" stroke-dasharray="1 4" stroke-width="1.6"/><path d="' + h + '" fill="currentColor" stroke="none"/>');
  };

  D.lavenderTop = function () {
    var s = lavender(150, 104, 92, 0, 3) + lavender(146, 104, 82, -22, 5) + lavender(154, 104, 82, 22, 8) + lavender(144, 104, 66, -42, 11) + lavender(156, 104, 66, 42, 13);
    s += '<path d="M150 92C140 84 128 86 132 94 136 100 146 96 150 92ZM150 92C160 84 172 86 168 94 164 100 154 96 150 92Z" stroke-width="1.2"/><path d="M150 92L142 108M150 92L158 108" stroke-width="1.2"/>';
    return svg('0 0 300 112', s);
  };

  D.lavenderLine = function () {
    return svg('0 0 240 36', '<path d="M40 30H96M144 30H200" opacity=".5"/>' + lavender(120, 34, 30, -30, 2) + lavender(120, 34, 30, 30, 4));
  };

  /** Pazen/kağıt dokusu (şablon CSS'lerinde kullanılabilir) */
  DV.paperTexture = function (opacity) {
    return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 " + (opacity || 0.06) + " 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  };

  /* ------------------------------------------------------------------ *
   *  Şablonlar
   *  hero:   frame | arch | circle | full | split
   *  events: cards | timeline
   *  effect: none | sparkle | petals | leaves | stars | snow | hearts | confetti | fireflies
   * ------------------------------------------------------------------ */

  DV.TEMPLATES = [
    {
      id: 'klasik-altin', name: 'Klasik Altın', desc: 'Krem kağıt üzerinde altın varak süslemeler',
      colors: { bg: '#f7f1e6', surface: '#fffcf6', text: '#3b3226', muted: '#86796a', primary: '#a8834a', accent: '#e4d2ac' },
      fonts: { script: 'Great Vibes', heading: 'Cormorant Garamond', body: 'Montserrat' },
      hero: 'frame', events: 'cards', effect: 'sparkle',
      decor: { top: 'flourishTop', divider: 'flourish', corner: 'goldCorner' }
    },
    {
      id: 'botanik', name: 'Botanik', desc: 'Okaliptüs dalları, adaçayı yeşili ve doğal tonlar',
      colors: { bg: '#f3f4ee', surface: '#fbfcf8', text: '#2f3a2c', muted: '#7a8573', primary: '#6f8a62', accent: '#c9d5bd' },
      fonts: { script: 'Allura', heading: 'Cormorant', body: 'Lato' },
      hero: 'arch', events: 'timeline', effect: 'leaves',
      decor: { top: 'eucalyptusTop', divider: 'sprig', corner: 'eucalyptusCorner' }
    },
    {
      id: 'minimal', name: 'Minimal Modern', desc: 'Siyah-beyaz, bol boşluk, güçlü tipografi',
      colors: { bg: '#ffffff', surface: '#f6f6f4', text: '#121212', muted: '#6d6d6a', primary: '#121212', accent: '#d8d6d0' },
      fonts: { script: 'Bodoni Moda', heading: 'Bodoni Moda', body: 'Jost' },
      hero: 'split', events: 'timeline', effect: 'none',
      decor: { divider: 'line' }
    },
    {
      id: 'gece-mavisi', name: 'Gece Mavisi', desc: 'Lacivert gece, altın yıldızlar ve hilal',
      colors: { bg: '#0f1a31', surface: '#16233f', text: '#efe8d8', muted: '#a8a596', primary: '#d6b46c', accent: '#f3e3b5' },
      fonts: { script: 'Pinyon Script', heading: 'Cinzel', body: 'Raleway' },
      hero: 'circle', events: 'cards', effect: 'stars', dark: true,
      decor: { top: 'starsTop', divider: 'starLine' }
    },
    {
      id: 'pudra', name: 'Pudra Pembe', desc: 'Romantik pudra tonları ve suluboya çiçekler',
      colors: { bg: '#fbf1ee', surface: '#fffaf8', text: '#5a3d3d', muted: '#9a7b78', primary: '#c48686', accent: '#f0c9c4' },
      fonts: { script: 'Parisienne', heading: 'Playfair Display', body: 'Quicksand' },
      hero: 'circle', events: 'cards', effect: 'petals',
      decor: { top: 'floralTop', divider: 'flowerLine', corner: 'floralCorner' }
    },
    {
      id: 'lale-devri', name: 'Lale Devri', desc: 'Osmanlı lalesi, çini desenleri ve yakut kırmızısı',
      colors: { bg: '#faf4ea', surface: '#fffbf4', text: '#3a2523', muted: '#8a6e66', primary: '#9e2235', accent: '#1f7a8c' },
      fonts: { script: 'Alex Brush', heading: 'Marcellus', body: 'EB Garamond' },
      hero: 'frame', events: 'cards', effect: 'petals',
      decor: { top: 'tulipTop', divider: 'tulipLine', corner: 'goldCorner' }
    },
    {
      id: 'boho', name: 'Boho Terrakota', desc: 'Toprak tonları, kemerler ve bohem ruh',
      colors: { bg: '#f5ece2', surface: '#fbf6f0', text: '#4a3326', muted: '#957a68', primary: '#c0653d', accent: '#e2a77d' },
      fonts: { script: 'Sacramento', heading: 'Fraunces', body: 'Josefin Sans' },
      hero: 'arch', events: 'timeline', effect: 'none',
      decor: { top: 'archesTop', divider: 'bohoLine' }
    },
    {
      id: 'ege', name: 'Ege Mavisi', desc: 'Akdeniz beyazı, kobalt mavi ve zeytin dalları',
      colors: { bg: '#f7f9fb', surface: '#ffffff', text: '#1d2b3a', muted: '#6b7a89', primary: '#1f5f99', accent: '#8a9a4b' },
      fonts: { script: 'Dancing Script', heading: 'Libre Baskerville', body: 'Nunito' },
      hero: 'circle', events: 'cards', effect: 'none',
      decor: { top: 'oliveTop', divider: 'oliveSprig' }
    },
    {
      id: 'art-deco', name: 'Art Deco', desc: '1920\'ler ihtişamı: siyah, altın ve geometri',
      colors: { bg: '#111111', surface: '#1a1a1a', text: '#f1e8d6', muted: '#a59c88', primary: '#caa45d', accent: '#e9d6a6' },
      fonts: { script: 'Limelight', heading: 'Poiret One', body: 'Josefin Sans' },
      hero: 'frame', events: 'cards', effect: 'sparkle', dark: true,
      decor: { top: 'decoFan', divider: 'decoLine', corner: 'decoCorner' }
    },
    {
      id: 'kis-masali', name: 'Kış Masalı', desc: 'Buz mavisi, gümüş ve yağan kar',
      colors: { bg: '#eef3f8', surface: '#fbfdff', text: '#253447', muted: '#73859a', primary: '#5b7fa6', accent: '#c6d6e8' },
      fonts: { script: 'Allura', heading: 'Cormorant Garamond', body: 'Mulish' },
      hero: 'circle', events: 'cards', effect: 'snow',
      decor: { top: 'snowTop', divider: 'snowLine' }
    },
    {
      id: 'rustik', name: 'Rustik Kraft', desc: 'Kraft kağıt, ip ışıklar ve sıcak kır düğünü havası',
      colors: { bg: '#e9dcc5', surface: '#f4ead8', text: '#3f2f22', muted: '#7d6650', primary: '#6b4a2f', accent: '#e8b45a' },
      fonts: { script: 'Caveat', heading: 'Amatic SC', body: 'Karla' },
      hero: 'arch', events: 'timeline', effect: 'fireflies',
      decor: { top: 'lightsTop', divider: 'heartLine' }
    },
    {
      id: 'lavanta', name: 'Lavanta Bahçesi', desc: 'Provence lavantaları ve yumuşak lila tonlar',
      colors: { bg: '#f5f2f8', surface: '#fdfbff', text: '#3c3350', muted: '#827a94', primary: '#6f5a9c', accent: '#a58fd0' },
      fonts: { script: 'Ephesis', heading: 'Gilda Display', body: 'Outfit' },
      hero: 'circle', events: 'cards', effect: 'petals',
      decor: { top: 'lavenderTop', divider: 'lavenderLine' }
    }
  ];

  DV.HERO_LAYOUTS = [
    { id: 'frame', label: 'Çerçeveli' },
    { id: 'arch', label: 'Kemer fotoğraf' },
    { id: 'circle', label: 'Yuvarlak fotoğraf' },
    { id: 'full', label: 'Tam ekran fotoğraf' },
    { id: 'split', label: 'Yan yana (modern)' }
  ];

  DV.EVENT_LAYOUTS = [
    { id: 'cards', label: 'Kartlar' },
    { id: 'timeline', label: 'Zaman çizelgesi' }
  ];

  DV.EFFECTS = [
    { id: 'auto', label: 'Şablona göre' },
    { id: 'none', label: 'Efekt yok' },
    { id: 'petals', label: 'Gül yaprakları' },
    { id: 'leaves', label: 'Yapraklar' },
    { id: 'sparkle', label: 'Işıltı' },
    { id: 'stars', label: 'Yıldızlar' },
    { id: 'snow', label: 'Kar' },
    { id: 'hearts', label: 'Kalpler' },
    { id: 'confetti', label: 'Konfeti' },
    { id: 'fireflies', label: 'Ateş böcekleri' }
  ];

  DV.getTemplate = function (id) {
    for (var i = 0; i < DV.TEMPLATES.length; i++) if (DV.TEMPLATES[i].id === id) return DV.TEMPLATES[i];
    return null;
  };

  DV.template = function (id) { return DV.getTemplate(id) || DV.TEMPLATES[0]; };

  DV.renderDecor = function (name) {
    return name && D[name] ? D[name]() : '';
  };

  /** Şablon + kullanıcı ayarlarından nihai tasarım değerleri */
  DV.resolveDesign = function (data) {
    var tpl = DV.template(data.design.template);
    var c = data.design.colors || {}, f = data.design.fonts || {};
    var e = data.design.effect;
    return {
      tpl: tpl,
      colors: {
        bg: c.bg || tpl.colors.bg,
        text: c.text || tpl.colors.text,
        primary: c.primary || tpl.colors.primary,
        accent: c.accent || tpl.colors.accent
      },
      overridden: { bg: !!c.bg, text: !!c.text, primary: !!c.primary, accent: !!c.accent },
      fonts: {
        script: f.script || tpl.fonts.script,
        heading: f.heading || tpl.fonts.heading,
        body: f.body || tpl.fonts.body
      },
      hero: data.design.hero || tpl.hero,
      events: data.design.eventsLayout || tpl.events,
      effect: !e || e === 'auto' ? tpl.effect : e,
      dark: c.bg ? DV.luminance(c.bg) < 0.2 : !!tpl.dark
    };
  };
})(typeof window !== 'undefined' ? window : this);
