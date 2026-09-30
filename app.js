(function () {
  'use strict';

  var DATA = null;
  var COMMENTS = null;
  var state = {
    dimType: 'General',
    dimValue: null
  };

  var fmtInt = function (n) { return (n === null || n === undefined) ? '—' : n.toLocaleString('es-AR'); };
  var fmtPct = function (n) { return (n === null || n === undefined) ? '—' : n.toFixed(1).replace('.', ',') + '%'; };

  function band(fav) {
    if (fav === null || fav === undefined) return { cls: 'na', label: 'Sin datos' };
    if (fav >= 75) return { cls: 'good', label: 'Favorable' };
    if (fav >= 60) return { cls: 'watch', label: 'A mejorar' };
    return { cls: 'risk', label: 'Crítico' };
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function renderKpis() {
    var g = DATA.general;
    var p = g.participacion || {};
    var enps = enpsFor(g);
    var row = document.getElementById('kpiRow');
    row.innerHTML = '';
    row.appendChild(el('div', { class: 'kpi-card kpi-primary' }, [
      el('div', { class: 'kpi-label', text: 'Favorabilidad general' }),
      el('div', { class: 'kpi-value', text: fmtPct(g.favorabilidad_total) })
    ]));
    row.appendChild(el('div', { class: 'kpi-card kpi-primary' }, [
      el('div', { class: 'kpi-label', text: 'eNPS' }),
      el('div', { class: 'kpi-value', text: enps === null ? '—' : fmtPct(enps) })
    ]));
    row.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Participación' }),
      el('div', { class: 'kpi-value', text: fmtPct(p.tasa) }),
      el('div', { class: 'kpi-sub', text: fmtInt(p.respondieron) + ' de ' + fmtInt(p.asignados) + ' invitados' })
    ]));
    row.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Respuestas analizadas' }),
      el('div', { class: 'kpi-value', text: fmtInt(g.n_users) }),
      el('div', { class: 'kpi-sub', text: 'personas que finalizaron la encuesta' })
    ]));
    row.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Dimensiones de clima' }),
      el('div', { class: 'kpi-value', text: String(DATA.topics.length) }),
      el('div', { class: 'kpi-sub', text: DATA.questions.length + ' preguntas relevadas' })
    ]));
  }

  function dimList() {
    var order = ['General', 'Departamento', 'Jefe Directo', 'DIVISION', 'GENERO', 'SUCURSAL'];
    return order.filter(function (d) { return d === 'General' || (DATA.dimensions[d] && DATA.dimensions[d].length); });
  }

  function enpsFor(entry) {
    if (!entry || !entry.byTopic) return null;
    var e = entry.byTopic['eNPS'];
    return e ? e.favorabilidad : null;
  }

  function dimLabel(d) {
    if (d === 'General') return 'General';
    return DATA.dimLabels[d] || d;
  }

  function renderChips() {
    var box = document.getElementById('dimChips');
    box.innerHTML = '';
    dimList().forEach(function (d) {
      var chip = el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(d === state.dimType) }, [document.createTextNode(dimLabel(d))]);
      chip.addEventListener('click', function () {
        state.dimType = d;
        state.dimValue = null;
        onFilterChange();
      });
      box.appendChild(chip);
    });
  }

  function renderValuePicker() {
    var row = document.getElementById('valueRow');
    var select = document.getElementById('valueSelect');
    var search = document.getElementById('valueSearch');
    var label = document.getElementById('valueLabel');

    if (state.dimType === 'General') {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    label.textContent = dimLabel(state.dimType) + ':';
    var items = (DATA.dimensions[state.dimType] || []).slice();

    function populate(filterText) {
      select.innerHTML = '';
      var placeholder = el('option', { value: '' }, [document.createTextNode('— Seleccionar (' + items.length + ') —')]);
      select.appendChild(placeholder);
      items
        .filter(function (it) { return !filterText || it.value.toLowerCase().indexOf(filterText.toLowerCase()) !== -1; })
        .forEach(function (it) {
          var opt = el('option', { value: it.value }, [document.createTextNode(it.value + '  ·  ' + fmtPct(it.favorabilidad_total))]);
          select.appendChild(opt);
        });
      select.value = state.dimValue || '';
    }
    populate('');
    search.oninput = function () { populate(search.value); };
    select.onchange = function () {
      state.dimValue = select.value || null;
      onFilterChange();
    };
  }

  function currentEntry() {
    if (state.dimType === 'General') return { value: 'Todos', byTopic: DATA.general.byTopic, favorabilidad_total: DATA.general.favorabilidad_total, n_users: DATA.general.n_users, participacion: DATA.general.participacion };
    if (!state.dimValue) return null;
    var list = DATA.dimensions[state.dimType] || [];
    for (var i = 0; i < list.length; i++) if (list[i].value === state.dimValue) return list[i];
    return null;
  }

  function renderSelectionPanel() {
    var panel = document.getElementById('selectionPanel');
    var title = document.getElementById('selectionTitle');
    var badgeEl = document.getElementById('selectionBadge');
    var kpis = document.getElementById('selectionKpis');

    if (state.dimType === 'General') { panel.hidden = true; return; }
    var entry = currentEntry();
    if (!entry) { panel.hidden = true; return; }
    panel.hidden = false;
    title.textContent = dimLabel(state.dimType) + ': ' + entry.value;
    var b = band(entry.favorabilidad_total);
    badgeEl.className = 'badge ' + b.cls;
    badgeEl.textContent = b.label;

    kpis.innerHTML = '';
    var p = entry.participacion || {};
    var enps = enpsFor(entry);
    kpis.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Favorabilidad' }),
      el('div', { class: 'kpi-value', text: fmtPct(entry.favorabilidad_total) })
    ]));
    kpis.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'eNPS' }),
      el('div', { class: 'kpi-value', text: enps === null ? '—' : fmtPct(enps) })
    ]));
    kpis.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Participación' }),
      el('div', { class: 'kpi-value', text: fmtPct(p.tasa) }),
      el('div', { class: 'kpi-sub', text: fmtInt(p.respondieron) + ' de ' + fmtInt(p.asignados) })
    ]));
    kpis.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'vs. General' }),
      el('div', { class: 'kpi-value', text: (entry.favorabilidad_total - DATA.general.favorabilidad_total >= 0 ? '+' : '') + (entry.favorabilidad_total !== null ? (entry.favorabilidad_total - DATA.general.favorabilidad_total).toFixed(1).replace('.', ',') + ' pp' : '—') })
    ]));

    var dlBtn = document.getElementById('btnDownloadPdf');
    dlBtn.onclick = function () { downloadPdfFor(state.dimType, entry); };
  }

  function sanitizeFileName(s) {
    return String(s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function pdfHeader(subtitle) {
    return el('div', { class: 'pe-header' }, [
      el('img', { class: 'pe-mark', src: 'assets/agronorte-logo.png', alt: '' }),
      el('div', {}, [
        el('div', { class: 'pe-title', text: 'Encuesta de Clima · FY26' }),
        el('div', { class: 'pe-subtitle', text: DATA.meta.instanceName + ' · ' + DATA.meta.surveyName + (subtitle ? ' · ' + subtitle : '') })
      ])
    ]);
  }

  function buildKpiRow(entry) {
    var p = entry.participacion || {};
    var enps = enpsFor(entry);
    var kpiRow = el('div', { class: 'pe-kpis' });
    kpiRow.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Favorabilidad' }),
      el('div', { class: 'kpi-value', text: fmtPct(entry.favorabilidad_total) })
    ]));
    kpiRow.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'eNPS' }),
      el('div', { class: 'kpi-value', text: enps === null ? '—' : fmtPct(enps) })
    ]));
    kpiRow.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Participación' }),
      el('div', { class: 'kpi-value', text: fmtPct(p.tasa) }),
      el('div', { class: 'kpi-sub', text: fmtInt(p.respondieron) + ' de ' + fmtInt(p.asignados) })
    ]));
    return kpiRow;
  }

  function pdfFooter(extra) {
    return el('div', { class: 'pe-foot' }, [
      document.createTextNode('Se listan todos los cortes de segmentación; los resultados de favorabilidad se muestran solo para grupos con ' + (DATA.meta.anonimato_minimo || 3) + ' o más respuestas ("Sin datos" en los demás). Favorabilidad = % de respuestas "de acuerdo" / "totalmente de acuerdo" (positivo); Negativo = "en desacuerdo" / "totalmente en desacuerdo"; el resto es Neutral. ' + (extra || '') + ' Generado el ' + DATA.meta.generatedAt + ' · Humand CX.')
    ]);
  }

  function runPdfExport(root, btn, filenameBase, scaleOverride) {
    var libsReady = window.html2canvas && window.jspdf && window.jspdf.jsPDF;
    if (!libsReady) {
      alert('No se pudieron cargar las librerías de PDF (revisá tu conexión). Probá recargar la página.');
      return;
    }
    btn.disabled = true;
    var originalLabel = btn.textContent;
    btn.textContent = 'Generando...';
    document.body.appendChild(root);

    var imgs = root.querySelectorAll('img');
    var waitImgs = Array.prototype.map.call(imgs, function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(function () {});
      return new Promise(function (resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });

    Promise.all(waitImgs).then(function () {
      return window.html2canvas(root, { scale: scaleOverride || 2, backgroundColor: '#ffffff' });
    }).then(function (canvas) {
      document.body.removeChild(root);
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = window.jspdf.jsPDF;
      var pageWidth = 595.28; // A4 pt
      var imgWidth = pageWidth - 48;
      var imgHeight = canvas.height * (imgWidth / canvas.width);
      var pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      var y = 24;
      var srcY = 0;
      var pageHeight = 841.89 - 48;
      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'JPEG', 24, y, imgWidth, imgHeight);
      } else {
        // paginate: slice canvas into page-sized chunks
        var pxPerPt = canvas.width / imgWidth;
        var pageHeightPx = pageHeight * pxPerPt;
        var pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        var first = true;
        // Loop on the pixel offset (not a decremented float) so rounding drift
        // can never produce a trailing zero-height slice / invalid image.
        while (srcY < canvas.height) {
          var sliceHeightPx = Math.min(pageHeightPx, canvas.height - srcY);
          if (sliceHeightPx < 1) break;
          pageCanvas.height = sliceHeightPx;
          var ctx = pageCanvas.getContext('2d');
          ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          if (!first) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 24, 24, imgWidth, sliceHeightPx / pxPerPt);
          srcY += sliceHeightPx;
          first = false;
        }
      }
      pdf.save(filenameBase + '.pdf');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }).catch(function (err) {
      document.body.contains(root) && document.body.removeChild(root);
      btn.disabled = false;
      btn.textContent = originalLabel;
      alert('No se pudo generar el PDF: ' + err);
    });
  }

  function downloadPdfFor(dimType, entry) {
    var btn = document.getElementById('btnDownloadPdf');
    var b = band(entry.favorabilidad_total);
    var vsGeneral = entry.favorabilidad_total !== null
      ? (entry.favorabilidad_total - DATA.general.favorabilidad_total >= 0 ? '+' : '') + (entry.favorabilidad_total - DATA.general.favorabilidad_total).toFixed(1).replace('.', ',') + ' pp vs. general'
      : '';

    var root = el('div', { class: 'pdf-export-root' });
    root.appendChild(pdfHeader(dimLabel(dimType) + ': ' + entry.value));
    root.appendChild(el('h1', { text: dimLabel(dimType) + ': ' + entry.value }));
    root.appendChild(el('span', { class: 'badge ' + b.cls, text: b.label }));
    var kpiRow = buildKpiRow(entry);
    kpiRow.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'vs. General' }),
      el('div', { class: 'kpi-value', text: vsGeneral || '—' })
    ]));
    root.appendChild(kpiRow);
    root.appendChild(el('h2', { text: 'Favorabilidad por dimensión', style: 'margin-bottom:12px;' }));
    var barsBox = el('div', { class: 'bars' });
    barsBox.appendChild(buildBarRows(entry, true));
    root.appendChild(barsBox);
    root.appendChild(pdfFooter());

    runPdfExport(root, btn, 'Reporte_Clima_' + sanitizeFileName(dimType) + '_' + sanitizeFileName(entry.value));
  }

  function downloadTopicsPdf() {
    var btn = document.getElementById('btnDownloadTopics');
    var entry = currentEntry();
    if (!entry) { alert('Elegí un valor de segmentación para poder descargar este cuadro, o volvé a General.'); return; }
    var label = state.dimType === 'General' ? 'General' : (dimLabel(state.dimType) + ': ' + entry.value);
    var root = el('div', { class: 'pdf-export-root' });
    root.appendChild(pdfHeader('Favorabilidad por dimensión · ' + label));
    root.appendChild(el('h1', { text: 'Favorabilidad por dimensión de clima' }));
    root.appendChild(el('span', { class: 'badge', text: label, style: 'background:var(--humand-50);color:var(--humand-700);' }));
    if (state.dimType !== 'General') {
      root.appendChild(buildKpiRow(entry));
    }
    var barsBox = el('div', { class: 'bars', style: 'margin-top:16px;' });
    barsBox.appendChild(buildBarRows(entry, true));
    root.appendChild(barsBox);
    root.appendChild(pdfFooter());
    runPdfExport(root, btn, 'Reporte_Clima_Dimensiones_' + sanitizeFileName(state.dimType) + '_' + sanitizeFileName(entry.value || 'General'));
  }

  function downloadRankingPdf() {
    var btn = document.getElementById('btnDownloadRanking');
    var dt = state.dimType === 'General' ? 'Departamento' : state.dimType;
    var list = (DATA.dimensions[dt] || []).slice().sort(function (a, b) {
      if (a.favorabilidad_total === null) return 1;
      if (b.favorabilidad_total === null) return -1;
      return b.favorabilidad_total - a.favorabilidad_total;
    });
    var root = el('div', { class: 'pdf-export-root' });
    root.appendChild(pdfHeader('Ranking · ' + dimLabel(dt)));
    root.appendChild(el('h1', { text: 'Ranking · ' + dimLabel(dt) }));
    root.appendChild(el('span', { class: 'badge', text: 'Ordenado por favorabilidad', style: 'background:var(--humand-50);color:var(--humand-700);' }));
    if (state.dimType !== 'General' && state.dimValue) {
      var selEntry = currentEntry();
      if (selEntry) {
        root.appendChild(el('div', { class: 'hint', style: 'margin-top:10px;', text: 'Selección actual: ' + dimLabel(state.dimType) + ': ' + selEntry.value }));
        root.appendChild(buildKpiRow(selEntry));
      }
    }
    var table = el('table', { class: 'rank-table', style: 'margin-top:16px;width:100%;border-collapse:collapse;' });
    var thead = el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Nombre' }), el('th', { text: 'Participación' }), el('th', { text: 'Favorabilidad' })
    ])]);
    table.appendChild(thead);
    var tbody = el('tbody');
    list.forEach(function (it) {
      var p = it.participacion || {};
      var tr = el('tr');
      tr.appendChild(el('td', { text: it.value }));
      tr.appendChild(el('td', { text: fmtPct(p.tasa) + ' (' + fmtInt(p.respondieron) + '/' + fmtInt(p.asignados) + ')' }));
      var favTd = el('td');
      var cell = el('div', { class: 'cell-fav' });
      cell.appendChild(buildMiniTrack(it.negativo_total, it.neutral_total, it.favorabilidad_total));
      cell.appendChild(el('span', { text: fmtPct(it.favorabilidad_total) }));
      favTd.appendChild(cell);
      tr.appendChild(favTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
    root.appendChild(pdfFooter());
    runPdfExport(root, btn, 'Reporte_Clima_Ranking_' + sanitizeFileName(dt));
  }

  function downloadQuestionsPdf() {
    var btn = document.getElementById('btnDownloadQuestions');
    var filterText = document.getElementById('questionSearch').value || '';
    var ft = filterText.toLowerCase();
    var list = DATA.questions.filter(function (q) {
      return !ft || q.pregunta.toLowerCase().indexOf(ft) !== -1 || q.topic.toLowerCase().indexOf(ft) !== -1;
    });
    var root = el('div', { class: 'pdf-export-root', style: 'width:900px;' });
    root.appendChild(pdfHeader('Detalle por pregunta (general)'));
    root.appendChild(el('h1', { text: 'Detalle por pregunta' }));
    root.appendChild(el('span', { class: 'badge', text: filterText ? ('Filtro: "' + filterText + '"') : 'Todas las preguntas · datos generales', style: 'background:var(--humand-50);color:var(--humand-700);' }));
    var table = el('table', { class: 'rank-table questions-table', style: 'margin-top:16px;width:100%;border-collapse:collapse;' });
    var thead = el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Dimensión' }), el('th', { text: 'Pregunta' }), el('th', { text: 'Favorabilidad' })
    ])]);
    table.appendChild(thead);
    var tbody = el('tbody');
    list.forEach(function (q) {
      var tr = el('tr');
      tr.appendChild(el('td', { class: 'qtopic', text: q.topic }));
      tr.appendChild(el('td', { class: 'qtext', text: q.pregunta }));
      var favTd = el('td');
      var cell = el('div', { class: 'cell-fav' });
      cell.appendChild(buildMiniTrack(q.negativo, q.neutral, q.favorabilidad));
      cell.appendChild(el('span', { text: fmtPct(q.favorabilidad) }));
      favTd.appendChild(cell);
      tr.appendChild(favTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
    root.appendChild(pdfFooter());
    runPdfExport(root, btn, 'Reporte_Clima_Preguntas' + (filterText ? '_' + sanitizeFileName(filterText) : ''));
  }

  function downloadComentariosPdf() {
    var btn = document.getElementById('btnDownloadComments');
    if (!COMMENTS || !COMMENTS.preguntasAbiertas || !COMMENTS.preguntasAbiertas.length) {
      alert('No se pudieron cargar los comentarios.');
      return;
    }
    var root = el('div', { class: 'pdf-export-root', style: 'width:760px;' });
    root.appendChild(pdfHeader('Comentarios · preguntas abiertas'));
    root.appendChild(el('h1', { text: 'Comentarios de la encuesta' }));
    root.appendChild(el('span', { class: 'badge', text: 'Respuestas abiertas, sin editar', style: 'background:var(--humand-50);color:var(--humand-700);' }));
    COMMENTS.preguntasAbiertas.forEach(function (q) {
      root.appendChild(el('h2', { text: q.pregunta, style: 'margin-top:24px;font-size:14px;' }));
      root.appendChild(el('div', { class: 'hint', text: q.n + ' respuestas', style: 'display:block;margin-bottom:8px;' }));
      var list = el('ul', { style: 'margin:0;padding-left:18px;' });
      q.comentarios.forEach(function (c) {
        list.appendChild(el('li', { text: c, style: 'margin-bottom:6px;font-size:11px;line-height:1.5;' }));
      });
      root.appendChild(list);
    });
    root.appendChild(pdfFooter('Las respuestas se muestran de forma anónima, sin datos de la persona que las escribió.'));
    // scale 1: el volumen de texto es grande, un canvas a escala 2 puede ser demasiado pesado para el navegador.
    runPdfExport(root, btn, 'Reporte_Clima_Comentarios', 1);
  }

  function buildSegTrack(cell, compact) {
    var track = el('div', { class: 'seg-track' + (compact ? ' compact' : '') });
    if (!cell || cell.favorabilidad === null || cell.favorabilidad === undefined) {
      track.title = 'Sin datos (grupo menor al mínimo de anonimato)';
      return track;
    }
    var neg = cell.negativo || 0;
    var neu = cell.neutral || 0;
    var fav = cell.favorabilidad || 0;
    var segs = [
      { cls: 'seg-neg', val: neg, label: 'Negativo' },
      { cls: 'seg-neu', val: neu, label: 'Neutral' },
      { cls: 'seg-fav', val: fav, label: 'Positivo' }
    ];
    var fill = el('div', { class: 'seg-fill' });
    var labels = el('div', { class: 'seg-labels' });
    var cum = 0;
    segs.forEach(function (s) {
      if (s.val <= 0) return;
      var seg = el('div', { class: 'seg ' + s.cls, style: 'width:' + s.val + '%', title: s.label + ': ' + fmtPct(s.val) });
      fill.appendChild(seg);
      if (!compact) {
        var center = cum + s.val / 2;
        center = Math.max(4, Math.min(96, center));
        labels.appendChild(el('span', { class: 'seg-label', style: 'left:' + center + '%', text: s.val.toFixed(0) + '%' }));
      }
      cum += s.val;
    });
    track.appendChild(fill);
    if (!compact) track.appendChild(labels);
    return track;
  }

  function buildBarRows(entry, showLegend) {
    var frag = document.createDocumentFragment();
    if (showLegend) {
      var legend = el('div', { class: 'seg-legend' }, [
        el('span', {}, [el('i', { class: 'lg-neg' }), document.createTextNode('Negativo')]),
        el('span', {}, [el('i', { class: 'lg-neu' }), document.createTextNode('Neutral')]),
        el('span', {}, [el('i', { class: 'lg-fav' }), document.createTextNode('Positivo (favorabilidad)')])
      ]);
      frag.appendChild(legend);
    }
    var topics = DATA.topics.slice().sort(function (a, b2) {
      var fa = (entry.byTopic[a] || {}).favorabilidad;
      var fb = (entry.byTopic[b2] || {}).favorabilidad;
      if (fa === null || fa === undefined) return 1;
      if (fb === null || fb === undefined) return -1;
      return fb - fa;
    });
    topics.forEach(function (t) {
      var cell = entry.byTopic[t];
      var fav = cell ? cell.favorabilidad : null;
      var row = el('div', { class: 'bar-row' });
      row.appendChild(el('div', { class: 'bar-label', text: t }));
      row.appendChild(buildSegTrack(cell, false));
      row.appendChild(el('div', { class: 'bar-value' }, [
        el('span', { class: 'bar-value-tag', text: 'Puntaje' }),
        document.createTextNode(fmtPct(fav))
      ]));
      frag.appendChild(row);
    });
    return frag;
  }

  function renderTopicBars() {
    var box = document.getElementById('topicBars');
    var hint = document.getElementById('topicHint');
    box.innerHTML = '';
    var entry = currentEntry();
    hint.textContent = state.dimType === 'General' ? 'General' : (entry ? dimLabel(state.dimType) + ': ' + entry.value : 'Seleccioná un valor arriba');
    if (!entry) {
      box.appendChild(el('div', { class: 'empty-note', text: 'Elegí un valor de ' + dimLabel(state.dimType) + ' para ver el detalle por dimensión.' }));
      return;
    }
    box.appendChild(buildBarRows(entry, true));
  }

  function renderRankTable() {
    var title = document.getElementById('rankingTitle');
    var tbody = document.getElementById('rankTableBody');
    tbody.innerHTML = '';

    if (state.dimType === 'General') {
      title.textContent = 'Ranking · Departamento';
      renderRankRows(DATA.dimensions['Departamento'] || [], tbody);
      return;
    }
    title.textContent = 'Ranking · ' + dimLabel(state.dimType);
    renderRankRows(DATA.dimensions[state.dimType] || [], tbody);
  }

  function buildMiniTrack(negativo, neutral, favorabilidad) {
    var mtrack = el('div', { class: 'mini-track' });
    if (favorabilidad === null || favorabilidad === undefined) return mtrack;
    if (negativo) mtrack.appendChild(el('div', { class: 'mini-seg-neg', style: 'width:' + negativo + '%' }));
    if (neutral) mtrack.appendChild(el('div', { class: 'mini-seg-neu', style: 'width:' + neutral + '%' }));
    if (favorabilidad) mtrack.appendChild(el('div', { class: 'mini-seg-fav', style: 'width:' + favorabilidad + '%' }));
    return mtrack;
  }

  function renderRankRows(list, tbody) {
    var sorted = list.slice().sort(function (a, b) {
      if (a.favorabilidad_total === null) return 1;
      if (b.favorabilidad_total === null) return -1;
      return b.favorabilidad_total - a.favorabilidad_total;
    });
    sorted.forEach(function (it) {
      var p = it.participacion || {};
      var tr = el('tr');
      tr.appendChild(el('td', { text: it.value }));
      tr.appendChild(el('td', { text: fmtPct(p.tasa) + ' (' + fmtInt(p.respondieron) + '/' + fmtInt(p.asignados) + ')' }));
      var favTd = el('td');
      var favCell = el('div', { class: 'cell-fav' });
      favCell.appendChild(buildMiniTrack(it.negativo_total, it.neutral_total, it.favorabilidad_total));
      favCell.appendChild(el('span', { text: fmtPct(it.favorabilidad_total) }));
      favTd.appendChild(favCell);
      tr.appendChild(favTd);
      tr.addEventListener('click', function () {
        state.dimValue = it.value;
        onFilterChange();
        document.getElementById('selectionPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tbody.appendChild(tr);
    });
  }

  function renderQuestions(filterText) {
    var tbody = document.getElementById('questionsTableBody');
    tbody.innerHTML = '';
    var ft = (filterText || '').toLowerCase();
    DATA.questions
      .filter(function (q) { return !ft || q.pregunta.toLowerCase().indexOf(ft) !== -1 || q.topic.toLowerCase().indexOf(ft) !== -1; })
      .forEach(function (q) {
        var comments = q.comentarios || [];
        var tr = el('tr');
        tr.appendChild(el('td', { class: 'qtopic', text: q.topic }));
        tr.appendChild(el('td', { class: 'qtext', text: q.pregunta }));
        var favTd = el('td');
        var cell = el('div', { class: 'cell-fav' });
        cell.appendChild(buildMiniTrack(q.negativo, q.neutral, q.favorabilidad));
        cell.appendChild(el('span', { text: fmtPct(q.favorabilidad) }));
        favTd.appendChild(cell);
        tr.appendChild(favTd);

        var detailTr = el('tr', { class: 'q-detail-row', hidden: 'hidden' });
        var detailTd = el('td', { colspan: '4' });
        if (comments.length) {
          var list = el('ul', { class: 'comments-list' });
          comments.forEach(function (c) { list.appendChild(el('li', { class: 'comment-item', text: c })); });
          detailTd.appendChild(list);
        } else {
          detailTd.appendChild(el('div', { class: 'comments-empty', text: 'Sin comentarios registrados para esta pregunta.' }));
        }
        detailTr.appendChild(detailTd);

        var toggleTd = el('td', { class: 'qtoggle-cell' });
        var toggleBtn = el('button', {
          class: 'q-toggle',
          type: 'button',
          'aria-expanded': 'false'
        }, [document.createTextNode('Comentarios (' + comments.length + ') ▾')]);
        toggleBtn.addEventListener('click', function () {
          var willShow = detailTr.hidden;
          detailTr.hidden = !willShow;
          toggleBtn.setAttribute('aria-expanded', String(willShow));
          toggleBtn.textContent = 'Comentarios (' + comments.length + ') ' + (willShow ? '▴' : '▾');
        });
        toggleTd.appendChild(toggleBtn);
        tr.appendChild(toggleTd);

        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
      });
  }

  function renderComentarios() {
    var box = document.getElementById('commentsBlocks');
    if (!box) return;
    box.innerHTML = '';
    if (!COMMENTS || !COMMENTS.preguntasAbiertas || !COMMENTS.preguntasAbiertas.length) {
      box.appendChild(el('div', { class: 'empty-note', text: 'No se pudieron cargar los comentarios.' }));
      return;
    }
    COMMENTS.preguntasAbiertas.forEach(function (q) {
      var block = el('div', { class: 'comments-block' });
      var head = el('div', { class: 'comments-block-head' });
      head.appendChild(el('h3', { text: q.pregunta }));
      head.appendChild(el('span', { class: 'comments-count-badge', text: q.n + ' respuestas' }));
      block.appendChild(head);

      var searchWrap = el('div', { class: 'qfilter' });
      var searchInput = el('input', { type: 'text', class: 'value-search', placeholder: 'Buscar en las respuestas...' });
      searchWrap.appendChild(searchInput);
      var shownHint = el('span', { class: 'hint comments-shown-hint' });
      searchWrap.appendChild(shownHint);
      block.appendChild(searchWrap);

      var list = el('ul', { class: 'comments-list scroll' });
      q.comentarios.forEach(function (c) {
        list.appendChild(el('li', { class: 'comment-item', text: c }));
      });
      block.appendChild(list);

      searchInput.addEventListener('input', function () {
        var ft = searchInput.value.toLowerCase().trim();
        var shown = 0;
        Array.prototype.forEach.call(list.children, function (li) {
          var match = !ft || li.textContent.toLowerCase().indexOf(ft) !== -1;
          li.hidden = !match;
          if (match) shown++;
        });
        shownHint.textContent = ft ? ('Mostrando ' + shown + ' de ' + q.comentarios.length) : '';
      });

      box.appendChild(block);
    });
  }

  function onFilterChange() {
    renderChips();
    renderValuePicker();
    renderSelectionPanel();
    renderTopicBars();
    renderRankTable();
  }

  function init(data) {
    DATA = data;
    document.getElementById('instanceName').textContent = data.meta.instanceName;
    document.getElementById('generatedAt').textContent = data.meta.generatedAt;
    document.getElementById('topbarMeta').textContent = data.meta.surveyName + ' · Lanzada ' + data.meta.launchDate;
    var footerNote = document.getElementById('footerAnonimatoNote');
    if (footerNote) {
      footerNote.textContent = footerNote.textContent.replace(/con \d+ o más respuestas/, 'con ' + (data.meta.anonimato_minimo || 3) + ' o más respuestas');
    }
    document.getElementById('btnClearFilter').addEventListener('click', function () {
      state.dimType = 'General'; state.dimValue = null; onFilterChange();
    });
    document.getElementById('questionSearch').addEventListener('input', function (e) {
      renderQuestions(e.target.value);
    });
    document.getElementById('btnDownloadTopics').addEventListener('click', downloadTopicsPdf);
    document.getElementById('btnDownloadRanking').addEventListener('click', downloadRankingPdf);
    document.getElementById('btnDownloadQuestions').addEventListener('click', downloadQuestionsPdf);
    document.getElementById('btnDownloadComments').addEventListener('click', downloadComentariosPdf);
    renderKpis();
    onFilterChange();
    renderQuestions('');
    renderComentarios();
  }

  Promise.all([
    fetch('data.json').then(function (r) { return r.json(); }),
    fetch('comentarios.json').then(function (r) { return r.json(); }).catch(function () { return null; })
  ])
    .then(function (results) {
      COMMENTS = results[1];
      init(results[0]);
    })
    .catch(function (err) {
      document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#942020">No se pudo cargar data.json: ' + err + '</div>';
    });
})();
