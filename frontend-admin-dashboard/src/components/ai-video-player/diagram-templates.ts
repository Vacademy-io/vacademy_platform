/**
 * Diagram Templates — Self-contained JS that renders data-attribute-based diagrams
 * with GSAP animations. Only depends on GSAP (already loaded).
 *
 * Usage in HTML: <div data-diagram="timeline" data-items='[...]'></div>
 * The initDiagramTemplates() function scans for [data-diagram] and renders each.
 */

export const DIAGRAM_TEMPLATES_SCRIPT = `
(function() {
  'use strict';

  // ── Helpers ──
  function parseJSON(str, fallback) {
    try { return JSON.parse(str); } catch(e) { return fallback; }
  }
  function getColor(name, fallback) {
    var root = document.documentElement;
    var val = getComputedStyle(root).getPropertyValue(name).trim();
    return val || fallback;
  }
  function animateIn(els, opts) {
    if (!window.gsap) return;
    try {
      gsap.fromTo(els,
        { opacity: 0, y: opts.y || 20 },
        { opacity: 1, y: 0, duration: opts.duration || 0.5, stagger: opts.stagger || 0.15, delay: opts.delay || 0.3, ease: opts.ease || 'power2.out' }
      );
    } catch(e) {
      // Fallback: just show them
      Array.from(els).forEach(function(el) { el.style.opacity = '1'; });
    }
  }

  // ── 1. Timeline ──
  function renderTimeline(container) {
    var items = parseJSON(container.getAttribute('data-items'), []);
    if (!items.length) return;
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');
    var vertical = container.getAttribute('data-layout') === 'vertical';

    var html = '<div class="dg-timeline" style="display:flex;' + (vertical ? 'flex-direction:column;gap:24px;padding:20px;' : 'align-items:flex-start;gap:0;overflow-x:auto;padding:20px 0;') + '">';
    items.forEach(function(item, i) {
      if (vertical) {
        html += '<div class="dg-tl-item" style="display:flex;align-items:flex-start;gap:16px;opacity:0">'
          + '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
          + '<div style="width:14px;height:14px;border-radius:50%;background:' + primary + ';border:3px solid ' + primary + '30"></div>'
          + (i < items.length - 1 ? '<div style="width:3px;flex:1;min-height:40px;background:' + primary + '30"></div>' : '')
          + '</div>'
          + '<div>'
          + '<div style="font-family:Fira Code,monospace;font-size:14px;color:' + primary + ';font-weight:600">' + (item.year || item.date || '') + '</div>'
          + '<div style="font-family:Montserrat,sans-serif;font-size:22px;font-weight:700;color:' + textColor + '">' + (item.label || '') + '</div>'
          + (item.desc ? '<div style="font-family:Inter,sans-serif;font-size:16px;color:' + textColor + '99;margin-top:4px">' + item.desc + '</div>' : '')
          + '</div></div>';
      } else {
        var w = Math.max(140, 800 / items.length);
        html += '<div class="dg-tl-item" style="display:flex;flex-direction:column;align-items:center;min-width:' + w + 'px;text-align:center;opacity:0;position:relative">'
          + '<div style="font-family:Fira Code,monospace;font-size:13px;color:' + primary + ';font-weight:600;margin-bottom:8px">' + (item.year || item.date || '') + '</div>'
          + '<div style="width:16px;height:16px;border-radius:50%;background:' + primary + ';z-index:2"></div>'
          + '<div style="font-family:Montserrat,sans-serif;font-size:18px;font-weight:700;color:' + textColor + ';margin-top:8px">' + (item.label || '') + '</div>'
          + (item.desc ? '<div style="font-family:Inter,sans-serif;font-size:14px;color:' + textColor + '99;margin-top:4px;max-width:' + (w - 20) + 'px">' + item.desc + '</div>' : '')
          + '</div>';
      }
    });
    html += '</div>';
    container.innerHTML = html;
    animateIn(container.querySelectorAll('.dg-tl-item'), { stagger: 0.2, y: vertical ? 20 : 30 });
  }

  // ── 2. Comparison ──
  function renderComparison(container) {
    var left = parseJSON(container.getAttribute('data-left'), { title: '', items: [] });
    var right = parseJSON(container.getAttribute('data-right'), { title: '', items: [] });
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');

    function renderCol(data, accent) {
      var h = '<div style="flex:1;padding:24px;border:2px solid ' + accent + '40;border-radius:12px;background:' + accent + '08">';
      h += '<div style="font-family:Montserrat,sans-serif;font-size:24px;font-weight:700;color:' + accent + ';margin-bottom:16px">' + (data.title || '') + '</div>';
      (data.items || []).forEach(function(item) {
        h += '<div class="dg-cmp-item" style="font-family:Inter,sans-serif;font-size:18px;color:' + textColor + ';padding:8px 0;border-bottom:1px solid ' + accent + '15;opacity:0">' + item + '</div>';
      });
      h += '</div>';
      return h;
    }
    container.innerHTML = '<div style="display:flex;gap:32px;width:100%">'
      + renderCol(left, primary)
      + renderCol(right, '#10b981')
      + '</div>';
    animateIn(container.querySelectorAll('.dg-cmp-item'), { stagger: 0.12 });
  }

  // ── 3. Cycle ──
  function renderCycle(container) {
    var items = parseJSON(container.getAttribute('data-items'), []);
    if (!items.length) return;
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');
    var n = items.length;
    var cx = 200, cy = 200, r = 150;

    var svg = '<svg viewBox="0 0 400 400" width="100%" style="max-width:500px;margin:0 auto;display:block">';
    // Draw arrow arcs
    items.forEach(function(_, i) {
      var a1 = (2 * Math.PI * i / n) - Math.PI / 2;
      var a2 = (2 * Math.PI * (i + 1) / n) - Math.PI / 2;
      var mid = (a1 + a2) / 2;
      var x1 = cx + r * Math.cos(a1 + 0.15);
      var y1 = cy + r * Math.sin(a1 + 0.15);
      var x2 = cx + r * Math.cos(a2 - 0.15);
      var y2 = cy + r * Math.sin(a2 - 0.15);
      var mx = cx + (r + 15) * Math.cos(mid);
      var my = cy + (r + 15) * Math.sin(mid);
      svg += '<path d="M' + x1 + ',' + y1 + ' Q' + mx + ',' + my + ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + primary + '40" stroke-width="2" stroke-dasharray="6,4"/>';
    });
    // Draw nodes
    items.forEach(function(item, i) {
      var angle = (2 * Math.PI * i / n) - Math.PI / 2;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      svg += '<g class="dg-cyc-node" style="opacity:0">'
        + '<circle cx="' + x + '" cy="' + y + '" r="36" fill="' + primary + '" opacity="0.15"/>'
        + '<circle cx="' + x + '" cy="' + y + '" r="30" fill="' + primary + '"/>'
        + '<text x="' + x + '" y="' + (y + 1) + '" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="11" font-family="Inter,sans-serif" font-weight="600">' + (typeof item === 'string' ? item.substring(0, 12) : '') + '</text>'
        + '</g>';
    });
    svg += '</svg>';
    container.innerHTML = svg;
    animateIn(container.querySelectorAll('.dg-cyc-node'), { stagger: 0.2, y: 0 });
  }

  // ── 4. Hierarchy ──
  function renderHierarchy(container) {
    var root = parseJSON(container.getAttribute('data-root'), { label: '', children: [] });
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');

    function renderNode(node, depth) {
      var bg = depth === 0 ? primary : (depth === 1 ? primary + 'cc' : primary + '80');
      var fontSize = Math.max(14, 22 - depth * 4);
      var h = '<div class="dg-hier-node" style="display:flex;flex-direction:column;align-items:center;opacity:0">'
        + '<div style="background:' + bg + ';color:#fff;padding:10px 20px;border-radius:8px;font-family:Montserrat,sans-serif;font-size:' + fontSize + 'px;font-weight:700;text-align:center;white-space:nowrap">' + (node.label || '') + '</div>';
      if (node.children && node.children.length) {
        h += '<div style="width:2px;height:20px;background:' + primary + '40"></div>';
        h += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">';
        node.children.forEach(function(child) { h += renderNode(child, depth + 1); });
        h += '</div>';
      }
      h += '</div>';
      return h;
    }
    container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center">' + renderNode(root, 0) + '</div>';
    animateIn(container.querySelectorAll('.dg-hier-node'), { stagger: 0.15, y: -15 });
  }

  // ── 5. Venn ──
  function renderVenn(container) {
    var sets = parseJSON(container.getAttribute('data-sets'), []);
    var overlap = parseJSON(container.getAttribute('data-overlap'), []);
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');
    var n = Math.min(sets.length, 3);
    if (n < 2) return;

    var w = 500, h = 340;
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:600px;margin:0 auto;display:block">';
    var positions = n === 2
      ? [{ x: 180, y: 170 }, { x: 320, y: 170 }]
      : [{ x: 200, y: 150 }, { x: 300, y: 150 }, { x: 250, y: 230 }];
    var colors = [primary, '#10b981', '#f59e0b'];

    positions.forEach(function(pos, i) {
      if (i >= n) return;
      svg += '<circle class="dg-venn-circle" cx="' + pos.x + '" cy="' + pos.y + '" r="100" fill="' + colors[i] + '" opacity="0" style="mix-blend-mode:multiply"/>';
      var labelY = i < 2 ? pos.y - 110 : pos.y + 115;
      svg += '<text x="' + pos.x + '" y="' + labelY + '" text-anchor="middle" fill="' + textColor + '" font-size="16" font-family="Montserrat,sans-serif" font-weight="700">' + (sets[i] ? sets[i].label || '' : '') + '</text>';
    });
    // Overlap text
    var overlapX = n === 2 ? 250 : 250;
    var overlapY = n === 2 ? 170 : 180;
    overlap.forEach(function(item, i) {
      svg += '<text x="' + overlapX + '" y="' + (overlapY + i * 18) + '" text-anchor="middle" fill="#fff" font-size="13" font-family="Inter,sans-serif" font-weight="600">' + item + '</text>';
    });
    svg += '</svg>';
    container.innerHTML = svg;

    if (window.gsap) {
      try {
        gsap.to(container.querySelectorAll('.dg-venn-circle'), { opacity: 0.25, duration: 0.8, stagger: 0.3, delay: 0.3, ease: 'power2.out' });
      } catch(e) {
        container.querySelectorAll('.dg-venn-circle').forEach(function(c) { c.setAttribute('opacity', '0.25'); });
      }
    }
  }

  // ── 6. Labeled Diagram ──
  function renderLabeledDiagram(container) {
    var labels = parseJSON(container.getAttribute('data-labels'), []);
    var imgPrompt = container.getAttribute('data-image-prompt') || '';
    var textColor = getColor('--text-color', '#1e293b');
    var primary = getColor('--primary-color', '#2563eb');

    var html = '<div style="position:relative;width:100%;height:100%">';
    // Image placeholder (the LLM should also include an actual <img> with data-img-prompt)
    if (imgPrompt && !container.querySelector('img')) {
      html += '<img class="generated-image" data-img-prompt="' + imgPrompt.replace(/"/g, '&quot;') + '" src="placeholder.png" style="width:100%;height:100%;object-fit:contain"/>';
    }
    labels.forEach(function(label) {
      var x = label.x || 50;
      var y = label.y || 50;
      html += '<div class="dg-label" style="position:absolute;left:' + x + '%;top:' + y + '%;transform:translate(-50%,-100%);opacity:0">'
        + '<div style="background:' + primary + ';color:#fff;padding:6px 12px;border-radius:6px;font-family:Inter,sans-serif;font-size:14px;font-weight:600;white-space:nowrap">' + (label.text || '') + '</div>'
        + '<div style="width:2px;height:20px;background:' + primary + ';margin:0 auto"></div>'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + primary + ';margin:0 auto"></div>'
        + '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    animateIn(container.querySelectorAll('.dg-label'), { stagger: 0.25, y: -10 });
  }

  // ── 7. Data Chart ──
  function renderDataChart(container) {
    var type = container.getAttribute('data-type') || 'bar';
    var values = parseJSON(container.getAttribute('data-values'), []);
    if (!values.length) return;
    var primary = getColor('--primary-color', '#2563eb');
    var textColor = getColor('--text-color', '#1e293b');
    var maxVal = Math.max.apply(null, values.map(function(v) { return v.value || 0; })) || 1;

    if (type === 'bar') {
      var barW = Math.min(60, 600 / values.length);
      var gap = Math.min(16, 200 / values.length);
      var chartH = 200;
      var html = '<div style="display:flex;align-items:flex-end;gap:' + gap + 'px;height:' + chartH + 'px;padding:20px;justify-content:center">';
      values.forEach(function(v) {
        var h = Math.max(8, (v.value / maxVal) * (chartH - 40));
        html += '<div class="dg-bar-col" style="display:flex;flex-direction:column;align-items:center;opacity:0">'
          + '<div style="font-family:Montserrat,sans-serif;font-size:14px;font-weight:700;color:' + textColor + ';margin-bottom:4px">' + v.value + '</div>'
          + '<div style="width:' + barW + 'px;height:0px;background:' + primary + ';border-radius:4px 4px 0 0" data-target-height="' + h + '"></div>'
          + '<div style="font-family:Inter,sans-serif;font-size:12px;color:' + textColor + '99;margin-top:6px;text-align:center;max-width:' + (barW + 20) + 'px">' + (v.label || '') + '</div>'
          + '</div>';
      });
      html += '</div>';
      container.innerHTML = html;

      // Animate bar heights
      if (window.gsap) {
        try {
          var bars = container.querySelectorAll('[data-target-height]');
          bars.forEach(function(bar, i) {
            var targetH = parseInt(bar.getAttribute('data-target-height'));
            gsap.to(bar, { height: targetH, duration: 0.6, delay: 0.3 + i * 0.1, ease: 'power2.out' });
          });
          gsap.to(container.querySelectorAll('.dg-bar-col'), { opacity: 1, duration: 0.3, stagger: 0.08, delay: 0.2 });
        } catch(e) {
          container.querySelectorAll('.dg-bar-col').forEach(function(el) { el.style.opacity = '1'; });
        }
      }
    } else if (type === 'pie') {
      var total = values.reduce(function(s, v) { return s + (v.value || 0); }, 0) || 1;
      var colors = [primary, '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
      var r = 100, cx = 150, cy = 150;
      var svg = '<svg viewBox="0 0 300 300" width="100%" style="max-width:300px;margin:0 auto;display:block">';
      var startAngle = 0;
      values.forEach(function(v, i) {
        var angle = (v.value / total) * 2 * Math.PI;
        var endAngle = startAngle + angle;
        var x1 = cx + r * Math.cos(startAngle);
        var y1 = cy + r * Math.sin(startAngle);
        var x2 = cx + r * Math.cos(endAngle);
        var y2 = cy + r * Math.sin(endAngle);
        var large = angle > Math.PI ? 1 : 0;
        svg += '<path class="dg-pie-slice" d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + colors[i % colors.length] + '" opacity="0"/>';
        startAngle = endAngle;
      });
      svg += '</svg>';
      // Legend
      var legend = '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px">';
      values.forEach(function(v, i) {
        legend += '<div style="display:flex;align-items:center;gap:4px;font-family:Inter,sans-serif;font-size:13px;color:' + textColor + '">'
          + '<div style="width:10px;height:10px;border-radius:2px;background:' + colors[i % colors.length] + '"></div>'
          + (v.label || '') + ' (' + v.value + ')</div>';
      });
      legend += '</div>';
      container.innerHTML = svg + legend;

      if (window.gsap) {
        try {
          gsap.to(container.querySelectorAll('.dg-pie-slice'), { opacity: 1, duration: 0.5, stagger: 0.15, delay: 0.3 });
        } catch(e) {
          container.querySelectorAll('.dg-pie-slice').forEach(function(s) { s.setAttribute('opacity', '1'); });
        }
      }
    }
  }

  // ── Dispatcher ──
  var renderers = {
    timeline: renderTimeline,
    comparison: renderComparison,
    cycle: renderCycle,
    hierarchy: renderHierarchy,
    venn: renderVenn,
    'labeled-diagram': renderLabeledDiagram,
    'data-chart': renderDataChart,
  };

  window.initDiagramTemplates = function(scope) {
    var root = scope || document;
    var els = root.querySelectorAll('[data-diagram]');
    els.forEach(function(el) {
      if (el.getAttribute('data-rendered') === 'true') return;
      var type = el.getAttribute('data-diagram');
      var renderer = renderers[type];
      if (renderer) {
        try {
          renderer(el);
          el.setAttribute('data-rendered', 'true');
        } catch(e) {
          console.warn('Diagram template error (' + type + '):', e);
        }
      }
    });
  };

  // Auto-init on DOMContentLoaded and load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.initDiagramTemplates(); });
  } else {
    // DOM already ready — init after a microtask to ensure other scripts ran
    setTimeout(function() { window.initDiagramTemplates(); }, 0);
  }
})();
`;
