// HMI Theme Swapper — Figma Plugin API
// The configure command stores a local color mapping. Direction commands run
// headlessly against the current selection and close when finished.

var STORAGE_KEY = 'hmi-theme-mapping-v1';

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function parseHex(value) {
  if (typeof value !== 'string') return null;
  var match = value.trim().match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1].slice(0, 2), 16) / 255,
    g: parseInt(match[1].slice(2, 4), 16) / 255,
    b: parseInt(match[1].slice(4, 6), 16) / 255,
    a: match[2] ? parseInt(match[2], 16) / 255 : 1
  };
}

function normalizeColor(value) {
  if (typeof value === 'string') return parseHex(value);
  if (!value || typeof value !== 'object') return null;
  if (typeof value.r !== 'number' || typeof value.g !== 'number' || typeof value.b !== 'number') {
    return parseHex(value.hex);
  }
  return {
    r: clamp(value.r > 1 ? value.r / 255 : value.r),
    g: clamp(value.g > 1 ? value.g / 255 : value.g),
    b: clamp(value.b > 1 ? value.b / 255 : value.b),
    a: clamp(value.a === undefined ? 1 : value.a)
  };
}

function normalizeMapping(input) {
  var source = Array.isArray(input) ? input : input && (input.mapping || input.rules);
  if (!Array.isArray(source)) return [];
  var output = [];
  for (var i = 0; i < source.length && output.length < 500; i++) {
    var item = source[i] || {};
    var light = normalizeColor(item.light);
    var dark = normalizeColor(item.dark);
    if (light && dark) output.push({ name: item.name || 'Color ' + (i + 1), light: light, dark: dark });
  }
  return output;
}

function colorsMatch(first, second) {
  var tolerance = 1.6 / 255;
  var alphaTolerance = 0.015;
  return Math.abs(first.r - second.r) <= tolerance &&
    Math.abs(first.g - second.g) <= tolerance &&
    Math.abs(first.b - second.b) <= tolerance &&
    Math.abs((first.a === undefined ? 1 : first.a) - (second.a === undefined ? 1 : second.a)) <= alphaTolerance;
}

function targetFor(color, mapping, direction) {
  for (var i = 0; i < mapping.length; i++) {
    var source = direction === 'dark-to-light' ? mapping[i].dark : mapping[i].light;
    if (colorsMatch(color, source)) return direction === 'dark-to-light' ? mapping[i].light : mapping[i].dark;
  }
  return null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replacePaint(paint, mapping, direction) {
  if (!paint || paint.visible === false) return false;
  var changed = false;
  if (paint.type === 'SOLID') {
    var solidTarget = targetFor({
      r: paint.color.r,
      g: paint.color.g,
      b: paint.color.b,
      a: paint.opacity === undefined ? 1 : paint.opacity
    }, mapping, direction);
    if (solidTarget) {
      paint.color = { r: solidTarget.r, g: solidTarget.g, b: solidTarget.b };
      paint.opacity = solidTarget.a;
      if (paint.boundVariables) delete paint.boundVariables;
      changed = true;
    }
  } else if (paint.type && paint.type.indexOf('GRADIENT_') === 0 && Array.isArray(paint.gradientStops)) {
    for (var i = 0; i < paint.gradientStops.length; i++) {
      var stop = paint.gradientStops[i];
      var gradientTarget = targetFor(stop.color, mapping, direction);
      if (gradientTarget) {
        stop.color = { r: gradientTarget.r, g: gradientTarget.g, b: gradientTarget.b, a: gradientTarget.a };
        if (stop.boundVariables) delete stop.boundVariables;
        changed = true;
      }
    }
  }
  return changed;
}

function clearStyle(node, property) {
  try {
    if (property === 'fills' && 'fillStyleId' in node && node.fillStyleId !== figma.mixed) node.fillStyleId = '';
    if (property === 'strokes' && 'strokeStyleId' in node && node.strokeStyleId !== figma.mixed) node.strokeStyleId = '';
    if (property === 'effects' && 'effectStyleId' in node && node.effectStyleId !== figma.mixed) node.effectStyleId = '';
  } catch (_) {}
}

async function replaceInNode(node, mapping, direction, visited) {
  if (!node || visited.has(node.id)) return 0;
  visited.add(node.id);
  if (node.locked) return 0;
  var changes = 0;

  if ('fills' in node && node.fills !== figma.mixed) {
    try {
      var fills = clone(node.fills);
      var fillChanged = false;
      for (var fi = 0; fi < fills.length; fi++) {
        if (replacePaint(fills[fi], mapping, direction)) { fillChanged = true; changes++; }
      }
      if (fillChanged) { clearStyle(node, 'fills'); node.fills = fills; }
    } catch (_) {}
  }

  if ('strokes' in node && node.strokes !== figma.mixed) {
    try {
      var strokes = clone(node.strokes);
      var strokeChanged = false;
      for (var si = 0; si < strokes.length; si++) {
        if (replacePaint(strokes[si], mapping, direction)) { strokeChanged = true; changes++; }
      }
      if (strokeChanged) { clearStyle(node, 'strokes'); node.strokes = strokes; }
    } catch (_) {}
  }

  if ('effects' in node && node.effects !== figma.mixed) {
    try {
      var effects = clone(node.effects);
      var effectChanged = false;
      for (var ei = 0; ei < effects.length; ei++) {
        var effect = effects[ei];
        if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.color) {
          var effectTarget = targetFor(effect.color, mapping, direction);
          if (effectTarget) {
            effect.color = { r: effectTarget.r, g: effectTarget.g, b: effectTarget.b, a: effectTarget.a };
            if (effect.boundVariables) delete effect.boundVariables;
            effectChanged = true;
            changes++;
          }
        }
      }
      if (effectChanged) { clearStyle(node, 'effects'); node.effects = effects; }
    } catch (_) {}
  }

  if (node.type === 'TEXT') {
    try {
      var segments = node.getStyledTextSegments(['fills']);
      for (var ti = 0; ti < segments.length; ti++) {
        var segmentFills = clone(segments[ti].fills);
        var textChanged = false;
        for (var pi = 0; pi < segmentFills.length; pi++) {
          if (replacePaint(segmentFills[pi], mapping, direction)) textChanged = true;
        }
        if (textChanged) {
          node.setRangeFills(segments[ti].start, segments[ti].end, segmentFills);
          changes++;
        }
      }
    } catch (_) {}
  }

  if ('children' in node) {
    for (var ci = 0; ci < node.children.length; ci++) {
      changes += await replaceInNode(node.children[ci], mapping, direction, visited);
    }
  }
  return changes;
}

async function runSwap(direction) {
  var stored = await figma.clientStorage.getAsync(STORAGE_KEY);
  var mapping = normalizeMapping(stored || []);
  if (!mapping.length) {
    figma.notify('请先运行“配置颜色映射”并保存规则', { error: true, timeout: 5000 });
    figma.closePlugin();
    return;
  }
  var selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify('请先选择一个或多个画板、分组或组件', { error: true, timeout: 5000 });
    figma.closePlugin();
    return;
  }
  var notification = figma.notify('正在换色…', { timeout: 30000 });
  try {
    var changes = 0;
    var visited = new Set();
    for (var i = 0; i < selection.length; i++) {
      changes += await replaceInNode(selection[i], mapping, direction, visited);
    }
    notification.cancel();
    if (changes) {
      figma.notify('换色完成：已更新 ' + changes + ' 处颜色', { timeout: 5000 });
    } else {
      figma.notify('没有找到与映射规则匹配的颜色', { timeout: 5000 });
    }
  } catch (error) {
    notification.cancel();
    figma.notify('换色失败：' + (error && error.message ? error.message : '未知错误'), { error: true, timeout: 6000 });
  }
  figma.closePlugin();
}

function bounded(value, fallback, min, max) {
  var number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function solidPaint(value) {
  var color = parseHex(value);
  if (!color) return [];
  return [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
}

function createNativeNode(type) {
  if (type === 'FRAME') return figma.createFrame();
  if (type === 'COMPONENT') return figma.createComponent();
  if (type === 'RECTANGLE') return figma.createRectangle();
  if (type === 'ELLIPSE') return figma.createEllipse();
  if (type === 'LINE') return figma.createLine();
  if (type === 'TEXT') return figma.createText();
  return null;
}

function fontStyleForWeight(value) {
  var weight = bounded(value, 400, 100, 900);
  if (weight >= 700) return 'Bold';
  if (weight >= 600) return 'Semi Bold';
  if (weight >= 500) return 'Medium';
  return 'Regular';
}

async function loadInter(style) {
  var font = { family: 'Inter', style: style };
  try {
    await figma.loadFontAsync(font);
    return font;
  } catch (_) {
    var fallback = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

function validateHmiSpec(input) {
  if (!input || typeof input !== 'object' || input.version !== '1.0') throw new Error('设计数据版本无效');
  if (!input.frame || !Array.isArray(input.nodes)) throw new Error('设计数据缺少画板或图层');
  if (!input.nodes.length) throw new Error('设计数据中没有可创建的图层');
  if (input.nodes.length > 160) throw new Error('单次最多创建 160 个图层');
  return input;
}

function applyGeometry(node, source) {
  var width = bounded(source.width, 100, 1, 7680);
  var height = bounded(source.height, 100, 1, 7680);
  if (source.type === 'LINE') node.resize(width, 0);
  else node.resize(width, height);
  node.x = bounded(source.x, 0, -10000, 10000);
  node.y = bounded(source.y, 0, -10000, 10000);
  node.opacity = bounded(source.opacity, 1, 0, 1);
  node.rotation = bounded(source.rotation, 0, -360, 360);
  if ('cornerRadius' in node && source.type !== 'ELLIPSE') node.cornerRadius = bounded(source.cornerRadius, 0, 0, 999);
  if ('fills' in node) node.fills = solidPaint(source.fill);
  if ('strokes' in node) {
    node.strokes = solidPaint(source.stroke);
    node.strokeWeight = bounded(source.strokeWidth, 0, 0, 100);
  }
}

function applyLayout(node, source) {
  if (!source || !source.layout || !('layoutMode' in node)) return;
  var layout = source.layout;
  node.clipsContent = layout.clipContent === true;
  if (layout.mode !== 'HORIZONTAL' && layout.mode !== 'VERTICAL') return;
  node.layoutMode = layout.mode;
  node.primaryAxisSizingMode = 'FIXED';
  node.counterAxisSizingMode = 'FIXED';
  node.itemSpacing = bounded(layout.itemSpacing, 0, 0, 1000);
  node.paddingTop = bounded(layout.paddingTop, 0, 0, 1000);
  node.paddingRight = bounded(layout.paddingRight, 0, 0, 1000);
  node.paddingBottom = bounded(layout.paddingBottom, 0, 0, 1000);
  node.paddingLeft = bounded(layout.paddingLeft, 0, 0, 1000);
}

async function applyText(node, source) {
  if (source.type !== 'TEXT') return;
  var style = source.textStyle || {};
  var font = await loadInter(fontStyleForWeight(style.fontWeight));
  node.fontName = font;
  node.characters = String(source.text || '').slice(0, 4000);
  node.fontSize = bounded(style.fontSize, 16, 6, 240);
  node.textAlignHorizontal = ['LEFT', 'CENTER', 'RIGHT'].indexOf(style.textAlign) >= 0 ? style.textAlign : 'LEFT';
  node.textAlignVertical = ['TOP', 'CENTER', 'BOTTOM'].indexOf(style.verticalAlign) >= 0 ? style.verticalAlign : 'TOP';
  node.lineHeight = { unit: 'PIXELS', value: bounded(style.lineHeight, 20, 6, 400) };
  node.letterSpacing = { unit: 'PIXELS', value: bounded(style.letterSpacing, 0, -20, 100) };
  node.fills = solidPaint(style.color || source.fill || '#FFFFFF');
}

function createPaletteStyles(palette) {
  if (!palette || typeof palette !== 'object') return;
  var keys = ['background', 'surface', 'primary', 'secondary', 'accent', 'text', 'muted', 'warning'];
  for (var i = 0; i < keys.length; i++) {
    var paints = solidPaint(palette[keys[i]]);
    if (!paints.length) continue;
    var style = figma.createPaintStyle();
    style.name = 'Codex HMI/' + keys[i][0].toUpperCase() + keys[i].slice(1);
    style.paints = paints;
  }
}

async function importHmiDesign(raw) {
  var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  var spec = validateHmiSpec(parsed);
  var page = figma.createPage();
  page.name = String(spec.pageName || 'Codex HMI').slice(0, 120);
  if (typeof figma.setCurrentPageAsync === 'function') await figma.setCurrentPageAsync(page);
  else figma.currentPage = page;

  createPaletteStyles(spec.palette);
  var root = figma.createFrame();
  root.name = String(spec.frame.name || spec.documentName || 'Codex HMI').slice(0, 160);
  root.resize(bounded(spec.frame.width, 1920, 320, 7680), bounded(spec.frame.height, 1080, 320, 7680));
  root.fills = solidPaint(spec.frame.background || (spec.palette && spec.palette.background) || '#0B0F14');
  root.clipsContent = true;
  root.x = 0;
  root.y = 0;

  var created = new Map();
  for (var i = 0; i < spec.nodes.length; i++) {
    var source = spec.nodes[i] || {};
    var node = createNativeNode(source.type);
    if (!node) continue;
    node.name = String(source.name || source.type + ' ' + (i + 1)).slice(0, 160);
    var parent = source.parentId && created.get(String(source.parentId));
    if (!parent || !('appendChild' in parent)) parent = root;
    parent.appendChild(node);
    applyGeometry(node, source);
    await applyText(node, source);
    applyLayout(node, source);
    created.set(String(source.id || 'node-' + (i + 1)), node);
  }

  page.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.notify('已创建 Figma 原生页面：' + created.size + ' 个可编辑图层', { timeout: 6000 });
  return { page: page, root: root, count: created.size };
}

async function showHmiImporter() {
  figma.showUI(__html__, { width: 460, height: 560, themeColors: true });
  figma.ui.postMessage({ type: 'ui-mode', mode: 'hmi-import' });
  figma.ui.onmessage = async function (message) {
    if (message.type === 'import-hmi-spec') {
      try {
        await importHmiDesign(message.value);
        figma.closePlugin();
      } catch (error) {
        figma.ui.postMessage({ type: 'import-error', message: error && error.message ? error.message : '设计数据无效' });
      }
    }
    if (message.type === 'cancel') figma.closePlugin();
  };
}

async function showConfiguration() {
  figma.showUI(__html__, { width: 420, height: 470, themeColors: true });
  var stored = await figma.clientStorage.getAsync(STORAGE_KEY);
  figma.ui.postMessage({ type: 'mapping-loaded', mapping: stored || [] });
  figma.ui.onmessage = async function (message) {
    if (message.type === 'save-mapping') {
      try {
        var parsed = typeof message.value === 'string' ? JSON.parse(message.value) : message.value;
        var mapping = normalizeMapping(parsed);
        if (!mapping.length) throw new Error('没有找到有效的 light / dark 颜色对');
        await figma.clientStorage.setAsync(STORAGE_KEY, mapping);
        figma.notify('已保存 ' + mapping.length + ' 条颜色映射');
        figma.closePlugin();
      } catch (error) {
        figma.ui.postMessage({ type: 'mapping-error', message: error.message || '映射格式无效' });
      }
    }
    if (message.type === 'cancel') figma.closePlugin();
  };
}

(async function main() {
  if (figma.command === 'import-hmi') await showHmiImporter();
  else if (figma.command === 'configure') await showConfiguration();
  else if (figma.command === 'dark-to-light') await runSwap('dark-to-light');
  else await runSwap('light-to-dark');
})();
