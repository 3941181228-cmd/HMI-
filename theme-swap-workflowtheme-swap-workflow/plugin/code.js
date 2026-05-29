// Theme Color Swapper — Main Thread (Figma Sandbox)
// Scans colors from selected nodes and applies theme swaps.

// ─── State ───────────────────────────────────────────────
let localPaintStyles = [];
let localVariableMap = new Map(); // variableId → name
let styleColorMap = new Map();   // styleId → {r,g,b,a}

// ─── Plugin Init ─────────────────────────────────────────
figma.showUI(__html__, { width: 380, height: 600 });

async function preloadStylesAndVariables() {
  localPaintStyles = figma.getLocalPaintStyles();
  styleColorMap.clear();

  for (var si = 0; si < localPaintStyles.length; si++) {
    var s = localPaintStyles[si];
    try {
      var paints = s.paints;
      if (paints && paints.length > 0 && paints[0].type === 'SOLID') {
        styleColorMap.set(s.id, {
          r: paints[0].color.r,
          g: paints[0].color.g,
          b: paints[0].color.b,
          a: paints[0].color.a !== undefined ? paints[0].color.a : 1
        });
      }
    } catch (_) { /* some styles may not expose paints */ }
  }

  try {
    var vars = await figma.variables.getLocalVariablesAsync();
    if (vars && Array.isArray(vars)) {
      for (var vi = 0; vi < vars.length; vi++) {
        if (vars[vi].resolvedType === 'COLOR') {
          localVariableMap.set(vars[vi].id, vars[vi].name);
        }
      }
    }
  } catch (_) { /* variables API may not be available */ }
}

preloadStylesAndVariables();

// ─── Color Utilities ────────────────────────────────────

function roundTo4(n) {
  return Math.round(n * 10000) / 10000;
}

function colorToKey(color) {
  const r = roundTo4(color.r);
  const g = roundTo4(color.g);
  const b = roundTo4(color.b);
  const a = color.a !== undefined ? roundTo4(color.a) : 1;
  if (a === 1) return 'rgb(' + r + ',' + g + ',' + b + ')';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function colorToHex(color) {
  var toHex = function (v) {
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  var hex = '#' + toHex(color.r) + toHex(color.g) + toHex(color.b);
  if (color.a !== undefined && color.a < 0.999) {
    hex += toHex(color.a);
  }
  return hex.toUpperCase();
}

function colorsMatch(c1, c2) {
  var tolerance = 0.01;
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance &&
    Math.abs((c1.a || 1) - (c2.a || 1)) <= tolerance
  );
}

function resolveStyleName(styleId) {
  if (!styleId || styleId === '') return null;
  for (var i = 0; i < localPaintStyles.length; i++) {
    if (localPaintStyles[i].id === styleId) return localPaintStyles[i].name;
  }
  return 'External library style';
}

function resolveVariableName(boundVars, property) {
  if (!boundVars) return null;
  var binding = boundVars[property];
  if (!binding) return null;
  var aliases = Array.isArray(binding) ? binding : [binding];
  var names = [];
  for (var i = 0; i < aliases.length; i++) {
    if (aliases[i] && aliases[i].type === 'VARIABLE_ALIAS' && aliases[i].id) {
      var name = localVariableMap.get(aliases[i].id);
      if (name) names.push(name);
    }
  }
  return names.length > 0 ? names.join(', ') : null;
}

// ─── Color Scanner ──────────────────────────────────────

/**
 * @typedef {Object} CollectedColor
 * @property {string} colorKey
 * @property {{r:number,g:number,b:number,a?:number}} color
 * @property {string} hex
 * @property {string} source - 'fill'|'stroke'|'effect'|'text-fill'|'gradient-stop'
 * @property {string|null} styleName
 * @property {string|null} styleId
 * @property {string|null} variableName
 * @property {number} count
 */

function registerColor(color, node, property, paintIndex, gradientStopIndex, effectIndex, styleId, boundVars, collected) {
  var key = colorToKey(color);
  var entry = collected.get(key);

  if (!entry) {
    var styleName = resolveStyleName(styleId);
    var varName = resolveVariableName(boundVars, property === 'text-range' ? 'fills' : (property === 'gradient-stop' ? 'fills' : property));
    // Determine source category
    var source = property;
    if (property === 'text-range') source = 'text-fill';
    if (property === 'gradient-stop') source = 'gradient-stop';

    entry = {
      colorKey: key,
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      hex: colorToHex(color),
      source: source,
      styleName: styleName,
      styleId: styleId || null,
      variableName: varName,
      count: 0,
      // Store paths for targeted replacement
      occurrences: []
    };
    collected.set(key, entry);
  }

  entry.count++;
  entry.occurrences.push({
    nodeId: node.id,
    property: property,
    paintIndex: paintIndex,
    gradientStopIndex: gradientStopIndex,
    effectIndex: effectIndex
  });
}

function extractColorsFromPaint(paint, node, property, paintIndex, styleId, boundVars, collected) {
  if (!paint || paint.visible === false) return;

  if (paint.type === 'SOLID') {
    registerColor(paint.color, node, property, paintIndex, undefined, undefined, styleId, boundVars, collected);
  } else if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    var stops = paint.gradientStops;
    for (var si = 0; si < stops.length; si++) {
      registerColor(stops[si].color, node, 'gradient-stop', paintIndex, si, undefined, styleId, boundVars, collected);
    }
  }
}

async function scanNode(node, collected, lockedNodes) {
  if (node.locked) {
    lockedNodes.add(node.id);
  }

  // 1. Fills
  if ('fills' in node && node.fills !== figma.mixed) {
    var fills = node.fills;
    for (var i = 0; i < fills.length; i++) {
      extractColorsFromPaint(fills[i], node, 'fills', i, node.fillStyleId, node.boundVariables, collected);
    }
  }

  // 2. Strokes
  if ('strokes' in node && node.strokes !== figma.mixed) {
    var strokes = node.strokes;
    for (var i = 0; i < strokes.length; i++) {
      extractColorsFromPaint(strokes[i], node, 'strokes', i, node.strokeStyleId, node.boundVariables, collected);
    }
  }

  // 3. Effects
  if ('effects' in node && node.effects !== figma.mixed) {
    var effects = node.effects;
    for (var i = 0; i < effects.length; i++) {
      var effect = effects[i];
      if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.color) {
        registerColor(
          effect.color, node, 'effect', undefined, undefined, i,
          node.effectStyleId, node.boundVariables, collected
        );
      }
    }
  }

  // 4. Text
  if (node.type === 'TEXT') {
    await scanTextNode(node, collected);
  }

  // 5. Recurse children
  if ('children' in node) {
    for (var ci = 0; ci < node.children.length; ci++) {
      await scanNode(node.children[ci], collected, lockedNodes);
    }
  }
}

async function scanTextNode(textNode, collected) {
  try {
    var segments = textNode.getStyledTextSegments(['fills', 'fillStyleId']);
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var sfills = seg.fills;
      if (sfills && sfills !== figma.mixed) {
        for (var j = 0; j < sfills.length; j++) {
          var entry = extractColorsFromPaintWithRange(
            sfills[j], textNode, 'text-range', j, seg.fillStyleId,
            textNode.boundVariables, collected, seg.start, seg.end
          );
        }
      }
    }
  } catch (e) {
    console.warn('Skipping text node due to missing fonts: ' + textNode.id);
  }
}

function extractColorsFromPaintWithRange(paint, node, property, paintIndex, styleId, boundVars, collected, rangeStart, rangeEnd) {
  if (!paint || paint.visible === false) return;

  if (paint.type === 'SOLID') {
    var key = colorToKey(paint.color);
    var styleName = resolveStyleName(styleId);
    var varName = resolveVariableName(boundVars, 'fills');
    var entry = collected.get(key);

    if (!entry) {
      entry = {
        colorKey: key,
        color: { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: paint.color.a },
        hex: colorToHex(paint.color),
        source: 'text-fill',
        styleName: styleName,
        styleId: styleId || null,
        variableName: varName,
        count: 0,
        occurrences: []
      };
      collected.set(key, entry);
    }
    entry.count++;
    entry.occurrences.push({
      nodeId: node.id,
      property: property,
      paintIndex: paintIndex,
      gradientStopIndex: undefined,
      effectIndex: undefined,
      textRangeStart: rangeStart,
      textRangeEnd: rangeEnd
    });
  }
}

async function scanSelection(nodeIds) {
  var collected = new Map();
  var lockedNodes = new Set();

  for (var i = 0; i < nodeIds.length; i++) {
    var node = await figma.getNodeByIdAsync(nodeIds[i]);
    if (node) {
      await scanNode(node, collected, lockedNodes);
    }
  }

  var results = [];
  collected.forEach(function (entry) {
    results.push({
      colorKey: entry.colorKey,
      hex: entry.hex,
      source: entry.source,
      styleName: entry.styleName,
      styleId: entry.styleId,
      variableName: entry.variableName,
      count: entry.count,
      occurrences: entry.occurrences
    });
  });

  return { colors: results, lockedNodeIds: Array.from(lockedNodes) };
}

// ─── Color Replacer ─────────────────────────────────────

function replaceColorInPaint(paint, mappingMap) {
  if (!paint || paint.visible === false) return false;
  var modified = false;

  if (paint.type === 'SOLID') {
    var key = colorToKey(paint.color);
    var mapping = mappingMap.get(key);
    if (mapping) {
      paint.color.r = mapping.targetColor.r;
      paint.color.g = mapping.targetColor.g;
      paint.color.b = mapping.targetColor.b;
      if (mapping.targetAlpha !== undefined) {
        paint.color.a = mapping.targetAlpha;
      }
      modified = true;
    }
  } else if (paint.type && paint.type.indexOf('GRADIENT_') === 0) {
    var stops = paint.gradientStops;
    for (var si = 0; si < stops.length; si++) {
      var key = colorToKey(stops[si].color);
      var mapping = mappingMap.get(key);
      if (mapping) {
        stops[si].color.r = mapping.targetColor.r;
        stops[si].color.g = mapping.targetColor.g;
        stops[si].color.b = mapping.targetColor.b;
        if (mapping.targetAlpha !== undefined) {
          stops[si].color.a = mapping.targetAlpha;
        }
        modified = true;
      }
    }
  }

  return modified;
}

async function applyReplacements(nodeIds, mappings, skipLocked) {
  var mappingMap = new Map();

  // Pre-resolve style/variable mappings to raw colors
  for (var i = 0; i < mappings.length; i++) {
    var m = mappings[i];
    var resolved = { sourceColorKey: m.sourceColorKey };

    if (m.strategy === 'style' && m.targetStyleId) {
      var styleColor = styleColorMap.get(m.targetStyleId);
      if (styleColor) {
        resolved.targetColor = { r: styleColor.r, g: styleColor.g, b: styleColor.b };
        resolved.targetAlpha = styleColor.a;
        resolved.strategy = 'raw';
      }
    } else if (m.strategy === 'variable' && m.targetVariableId) {
      try {
        var v = await figma.variables.getVariableByIdAsync(m.targetVariableId);
        if (v && v.valuesByMode) {
          var firstMode = Object.keys(v.valuesByMode)[0];
          if (firstMode) {
            var val = v.valuesByMode[firstMode];
            if (val && typeof val.r === 'number') {
              resolved.targetColor = { r: val.r, g: val.g, b: val.b };
              resolved.targetAlpha = val.a !== undefined ? val.a : 1;
              resolved.strategy = 'raw';
            }
          }
        }
      } catch (_) { /* variable not accessible */ }
    } else {
      resolved.targetColor = m.targetColor;
      resolved.targetAlpha = m.targetAlpha;
      resolved.strategy = 'raw';
    }

    if (resolved.targetColor) {
      mappingMap.set(resolved.sourceColorKey, resolved);
    }
  }

  var changedNodes = 0;

  for (var i = 0; i < nodeIds.length; i++) {
    var node = await figma.getNodeByIdAsync(nodeIds[i]);
    if (node) {
      changedNodes += await replaceInNode(node, mappingMap, skipLocked);
    }
  }

  return changedNodes;
}

async function replaceInNode(node, mappingMap, skipLocked) {
  if (skipLocked && node.locked) return 0;

  var changes = 0;

  // 1. Replace fills
  if ('fills' in node && node.fills !== figma.mixed) {
    var fills;
    try {
      fills = JSON.parse(JSON.stringify(node.fills));
    } catch (_) { fills = []; }
    var fillModified = false;
    for (var i = 0; i < fills.length; i++) {
      if (replaceColorInPaint(fills[i], mappingMap)) {
        fillModified = true;
        changes++;
      }
    }
    if (fillModified) {
      try { node.fills = fills; } catch (_) { /* read-only */ }
    }
  }

  // 2. Replace strokes
  if ('strokes' in node && node.strokes !== figma.mixed) {
    var strokes;
    try {
      strokes = JSON.parse(JSON.stringify(node.strokes));
    } catch (_) { strokes = []; }
    var strokeModified = false;
    for (var i = 0; i < strokes.length; i++) {
      if (replaceColorInPaint(strokes[i], mappingMap)) {
        strokeModified = true;
        changes++;
      }
    }
    if (strokeModified) {
      try { node.strokes = strokes; } catch (_) { /* read-only */ }
    }
  }

  // 3. Replace effects
  if ('effects' in node && node.effects !== figma.mixed) {
    var effects;
    try {
      effects = JSON.parse(JSON.stringify(node.effects));
    } catch (_) { effects = []; }
    var effectModified = false;
    for (var i = 0; i < effects.length; i++) {
      var effect = effects[i];
      if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.color) {
        var key = colorToKey(effect.color);
        var mapping = mappingMap.get(key);
        if (mapping) {
          effect.color.r = mapping.targetColor.r;
          effect.color.g = mapping.targetColor.g;
          effect.color.b = mapping.targetColor.b;
          if (mapping.targetAlpha !== undefined) {
            effect.color.a = mapping.targetAlpha;
          }
          effectModified = true;
          changes++;
        }
      }
    }
    if (effectModified) {
      try { node.effects = effects; } catch (_) { /* read-only */ }
    }
  }

  // 4. Replace text fills
  if (node.type === 'TEXT') {
    try {
      var segments = node.getStyledTextSegments(['fills']);
      for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var segFills = JSON.parse(JSON.stringify(seg.fills));
        var segModified = false;
        for (var j = 0; j < segFills.length; j++) {
          if (replaceColorInPaint(segFills[j], mappingMap)) {
            segModified = true;
          }
        }
        if (segModified) {
          node.setRangeFills(seg.start, seg.end, segFills);
          changes++;
        }
      }
    } catch (e) {
      // Missing fonts, skip this text node
    }
  }

  // 5. Recurse children
  if ('children' in node) {
    var children = node.children;
    for (var ci = 0; ci < children.length; ci++) {
      changes += await replaceInNode(children[ci], mappingMap, skipLocked);
    }
  }

  return changes;
}

// ─── Light/Dark Mode Detection ─────────────────────────

function detectModeFromSelection(selection) {
  var lightCount = 0;
  var darkCount = 0;

  for (var si = 0; si < selection.length; si++) {
    var node = selection[si];
    if (!('fills' in node) || node.fills === figma.mixed) continue;

    var fills = node.fills;
    for (var fi = 0; fi < fills.length; fi++) {
      var paint = fills[fi];
      if (paint.type === 'SOLID' && paint.visible !== false) {
        var r = paint.color.r;
        var g = paint.color.g;
        var b = paint.color.b;

        // HSL lightness L = (max(r,g,b) + min(r,g,b)) / 2
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var lightness = (max + min) / 2;

        if (lightness > 0.5) {
          lightCount++;
        } else if (lightness < 0.5) {
          darkCount++;
        }
        break; // Only check first solid fill per node
      }
    }
  }

  if (lightCount > darkCount) return 'light';
  if (darkCount > lightCount) return 'dark';
  return '';
}

// ─── Message Handlers ───────────────────────────────────

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'scan-colors') {
    try {
      var selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.ui.postMessage({ type: 'scan-error', message: '请先选择至少一个画板或分组。' });
        return;
      }
      var detectedMode = detectModeFromSelection(selection);
      var nodeIds = selection.map(function (n) { return n.id; });
      var result = await scanSelection(nodeIds);
      var collected = result.colors;
      var lockedNodeIds = result.lockedNodeIds;

      var styles = [];
      for (var i = 0; i < localPaintStyles.length; i++) {
        var s = localPaintStyles[i];
        var sc = styleColorMap.get(s.id);
        styles.push({
          id: s.id,
          name: s.name,
          hex: sc ? colorToHex(sc) : null
        });
      }

      var variables = [];
      localVariableMap.forEach(function (name, id) {
        variables.push({ id: id, name: name });
      });

      figma.ui.postMessage({
        type: 'scan-results',
        colors: collected,
        availableStyles: styles,
        availableVariables: variables,
        nodeIds: nodeIds,
        lockedNodeIds: lockedNodeIds,
        detectedMode: detectedMode
      });
    } catch (e) {
      figma.ui.postMessage({ type: 'scan-error', message: e.message || 'Unknown error during scan.' });
    }
  }

  if (msg.type === 'apply-swap') {
    try {
      var changed = await applyReplacements(msg.nodeIds, msg.mappings, msg.skipLocked);
      figma.ui.postMessage({ type: 'swap-done', changed: changed });
    } catch (e) {
      figma.ui.postMessage({ type: 'swap-error', message: e.message || 'Unknown error during replacement.' });
    }
  }

  if (msg.type === 'refresh-styles') {
    await preloadStylesAndVariables();
    figma.ui.postMessage({ type: 'styles-refreshed' });
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }

  // ─── WS 驱动指令 ───────────────────────────────────
  if (msg.type === 'ws-execute') {
    (async function () {
      try {
        var wsId = msg.wsId;
        var action = msg.action;
        var data = msg.data || {};
        var result = {};

        if (action === 'scan-nodes') {
          // 扫描指定节点颜色
          var nodeIds = data.nodeIds;
          if (!nodeIds || nodeIds.length === 0) {
            figma.ui.postMessage({
              type: 'ws-result',
              wsId: wsId,
              error: '未提供 nodeIds'
            });
            return;
          }
          var scanResult = await scanSelection(nodeIds);
          result = {
            colors: scanResult.colors,
            lockedNodeIds: scanResult.lockedNodeIds,
            paintStyles: localPaintStyles.map(function (s) {
              var sc = styleColorMap.get(s.id);
              return { id: s.id, name: s.name, hex: sc ? colorToHex(sc) : null };
            })
          };

        } else if (action === 'apply-swap') {
          // 应用颜色映射替换
          var changed = await applyReplacements(
            data.nodeIds,
            data.mappings,
            data.skipLocked !== false
          );
          result = { changed: changed };

        } else if (action === 'detect-mode') {
          // 检测当前文件的颜色模式
          var modeNodeIds = data.nodeIds;
          var modeSelection;
          if (modeNodeIds && modeNodeIds.length > 0) {
            modeSelection = [];
            for (var di = 0; di < modeNodeIds.length; di++) {
              var modeNode = await figma.getNodeByIdAsync(modeNodeIds[di]);
              if (modeNode) modeSelection.push(modeNode);
            }
          } else {
            modeSelection = figma.currentPage.selection;
          }
          var detectedMode = modeSelection.length > 0 ? detectModeFromSelection(modeSelection) : '';
          result = { mode: detectedMode || 'unknown' };

        } else if (action === 'rename-file') {
          // 重命名文件
          var newName = data.newName;
          if (!newName) {
            figma.ui.postMessage({
              type: 'ws-result',
              wsId: wsId,
              error: '未提供 newName'
            });
            return;
          }
          var oldName = figma.root.name;
          figma.root.name = newName;
          // 触发自动保存：找一个实体节点做一次可逆修改
          try {
            var targetNode = null;
            // 遍历找第一个有可见 fills 的 FRAME
            for (var pi = 0; pi < figma.root.children.length; pi++) {
              var page = figma.root.children[pi];
              for (var ci = 0; ci < page.children.length; ci++) {
                if (page.children[ci].type === 'FRAME' || page.children[ci].type === 'RECTANGLE') {
                  targetNode = page.children[ci];
                  break;
                }
              }
              if (targetNode) break;
            }
            if (targetNode && targetNode.opacity !== undefined) {
              var origOpacity = targetNode.opacity;
              targetNode.opacity = origOpacity + 0.001;
              targetNode.opacity = origOpacity;
            }
          } catch (_) {}
          result = {
            oldName: oldName,
            newName: newName,
            success: true
          };

        } else if (action === 'ping') {
          result = { status: 'ok', timestamp: new Date().toISOString() };

        } else {
          figma.ui.postMessage({
            type: 'ws-result',
            wsId: wsId,
            error: '未知 action: ' + action
          });
          return;
        }

        // 发送结果回 UI（UI 会转发到 WS Server）
        figma.ui.postMessage({
          type: 'ws-result',
          wsId: wsId,
          data: result
        });
      } catch (e) {
        figma.ui.postMessage({
          type: 'ws-result',
          wsId: msg.wsId,
          error: e.message || '执行异常'
        });
      }
    })();
  }
};
