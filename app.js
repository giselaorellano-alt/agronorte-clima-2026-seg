(function () {
  'use strict';

  var DATA = null;
  var COMMENTS = null;
  var state = {
    dimType: 'General',
    dimValues: [],
    dim2Type: null,
    dim2Values: []
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
        state.dimValues = [];
        if (state.dim2Type === d || d === 'General') { state.dim2Type = null; state.dim2Values = []; }
        onFilterChange();
      });
      box.appendChild(chip);
    });
  }

  // ---- Selector múltiple (checkboxes con buscador) ----
  var openMultiSelect = null;
  document.addEventListener('click', function (e) {
    if (openMultiSelect && !openMultiSelect.root.contains(e.target)) openMultiSelect.close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openMultiSelect) openMultiSelect.close();
  });

  function createMultiSelect(root, onChange) {
    var items = [];
    var selected = [];
    root.innerHTML = '';
    var toggle = el('button', { class: 'ms-toggle', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    var summary = el('span', { class: 'ms-summary' });
    toggle.appendChild(summary);
    toggle.appendChild(el('span', { class: 'ms-caret', text: '▾', 'aria-hidden': 'true' }));
    var panel = el('div', { class: 'ms-panel', hidden: 'hidden' });
    var search = el('input', { type: 'text', class: 'value-search ms-search', placeholder: 'Buscar...', autocomplete: 'off' });
    var btnAll = el('button', { class: 'ms-action', type: 'button', text: 'Seleccionar todos' });
    var btnNone = el('button', { class: 'ms-action', type: 'button', text: 'Limpiar' });
    var list = el('div', { class: 'ms-list', role: 'listbox', 'aria-multiselectable': 'true' });
    panel.appendChild(search);
    panel.appendChild(el('div', { class: 'ms-actions' }, [btnAll, btnNone]));
    panel.appendChild(list);
    root.appendChild(toggle);
    root.appendChild(panel);

    var api = {
      root: root,
      setItems: function (newItems, newSelected) { items = newItems; selected = (newSelected || []).slice(); search.value = ''; renderList(); renderSummary(); },
      setSelected: function (newSelected) { selected = (newSelected || []).slice(); renderList(); renderSummary(); },
      close: function () { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (openMultiSelect === api) openMultiSelect = null; }
    };

    function renderSummary() {
      if (!selected.length) summary.textContent = '— Seleccionar (' + items.length + ') —';
      else if (selected.length === 1) summary.textContent = selected[0];
      else summary.textContent = selected.length + ' seleccionados';
      toggle.title = selected.join(', ');
      root.classList.toggle('has-value', selected.length > 0);
    }

    function visibleItems() {
      var ft = search.value.toLowerCase();
      return items.filter(function (it) { return !ft || it.value.toLowerCase().indexOf(ft) !== -1; });
    }

    function renderList() {
      list.innerHTML = '';
      var vis = visibleItems();
      if (!vis.length) { list.appendChild(el('div', { class: 'ms-empty', text: 'Sin resultados' })); return; }
      vis.forEach(function (it) {
        var cb = el('input', { type: 'checkbox' });
        cb.checked = selected.indexOf(it.value) !== -1;
        cb.addEventListener('change', function () {
          if (cb.checked) { if (selected.indexOf(it.value) === -1) selected.push(it.value); }
          else selected = selected.filter(function (v) { return v !== it.value; });
          renderSummary();
          onChange(selected.slice());
        });
        var opt = el('label', { class: 'ms-option' }, [cb, el('span', { class: 'ms-option-text', text: it.value })]);
        if (it.meta) opt.appendChild(el('span', { class: 'ms-option-meta', text: it.meta }));
        list.appendChild(opt);
      });
    }

    toggle.addEventListener('click', function () {
      var willOpen = panel.hidden;
      if (openMultiSelect && openMultiSelect !== api) openMultiSelect.close();
      panel.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      openMultiSelect = willOpen ? api : null;
      if (willOpen) search.focus();
    });
    search.addEventListener('input', renderList);
    btnAll.addEventListener('click', function () {
      visibleItems().forEach(function (it) { if (selected.indexOf(it.value) === -1) selected.push(it.value); });
      renderList(); renderSummary(); onChange(selected.slice());
    });
    btnNone.addEventListener('click', function () {
      selected = [];
      renderList(); renderSummary(); onChange([]);
    });
    return api;
  }

  // Combina varios grupos disjuntos de una misma segmentación en uno solo.
  // Favorabilidad/negativo/neutral se promedian ponderando por cantidad de respuestas
  // (sumando todos los grupos de una segmentación se reproduce exactamente el total general).
  // Los grupos bajo el mínimo de anonimato no tienen favorabilidad: cuentan en participación pero no en el promedio.
  function round1(n) { return Math.round(n * 10) / 10; }

  function weightedCell(cells, favKey, negKey, neuKey) {
    var ok = cells.filter(function (c) { return c && c[favKey] !== null && c[favKey] !== undefined && c.n_users; });
    if (!ok.length) return null;
    var n = 0, fav = 0, neg = 0, neu = 0;
    ok.forEach(function (c) {
      n += c.n_users;
      fav += c[favKey] * c.n_users;
      neg += (c[negKey] || 0) * c.n_users;
      neu += (c[neuKey] || 0) * c.n_users;
    });
    return { favorabilidad: round1(fav / n), negativo: round1(neg / n), neutral: round1(neu / n), n_users: n, groups: ok.length };
  }

  function aggregateEntries(entries, label) {
    if (!entries.length) return null;
    if (entries.length === 1) {
      var only = entries[0];
      return Object.assign({}, only, { excludedGroups: only.favorabilidad_total === null ? 1 : 0 });
    }
    var asignados = 0, respondieron = 0, nUsers = 0;
    entries.forEach(function (e) {
      var p = e.participacion || {};
      asignados += p.asignados || 0;
      respondieron += p.respondieron || 0;
      nUsers += e.n_users || 0;
    });
    var total = weightedCell(entries, 'favorabilidad_total', 'negativo_total', 'neutral_total');
    var topicKeys = {};
    entries.forEach(function (e) { Object.keys(e.byTopic || {}).forEach(function (k) { topicKeys[k] = true; }); });
    var byTopic = {};
    Object.keys(topicKeys).forEach(function (t) {
      var cell = weightedCell(entries.map(function (e) { return (e.byTopic || {})[t]; }), 'favorabilidad', 'negativo', 'neutral');
      if (cell) byTopic[t] = cell;
    });
    return {
      value: label,
      members: entries.map(function (e) { return e.value; }),
      favorabilidad_total: total ? total.favorabilidad : null,
      negativo_total: total ? total.negativo : null,
      neutral_total: total ? total.neutral : null,
      n_users: nUsers,
      excludedGroups: entries.length - (total ? total.groups : 0),
      participacion: { asignados: asignados, respondieron: respondieron, tasa: asignados ? round1(respondieron / asignados * 100) : null },
      byTopic: byTopic
    };
  }

  function entriesFor(dimType, values) {
    return (DATA.dimensions[dimType] || []).filter(function (it) { return values.indexOf(it.value) !== -1; });
  }

  function valuesLabel(values) { return values.join(', '); }

  var valuePicker = null;
  var valuePickerDim = null;

  function renderValuePicker() {
    var row = document.getElementById('valueRow');
    var label = document.getElementById('valueLabel');

    if (state.dimType === 'General') {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    label.textContent = dimLabel(state.dimType) + ':';
    if (!valuePicker) {
      valuePicker = createMultiSelect(document.getElementById('valueMulti'), function (values) {
        state.dimValues = values;
        onFilterChange();
      });
    }
    if (valuePickerDim !== state.dimType) {
      valuePickerDim = state.dimType;
      valuePicker.setItems((DATA.dimensions[state.dimType] || []).map(function (it) {
        return { value: it.value, meta: fmtPct(it.favorabilidad_total) };
      }), state.dimValues);
    } else {
      valuePicker.setSelected(state.dimValues);
    }
  }

  // ---- Segundo filtro ("Y además por"): cruza dos segmentaciones en todo el reporte ----
  var value2Picker = null;
  var value2PickerDim = null;

  function hasDim2() { return state.dimType !== 'General' && !!state.dim2Type && state.dim2Values.length > 0; }

  function renderValue2Picker() {
    var row = document.getElementById('value2Row');
    var select = document.getElementById('dim2Select');
    var clearBtn = document.getElementById('btnClearFilter2');
    if (state.dimType === 'General') { row.hidden = true; return; }
    row.hidden = false;

    select.innerHTML = '';
    select.appendChild(el('option', { value: '' }, [document.createTextNode('— Elegir —')]));
    dimList().filter(function (d) { return d !== 'General' && d !== state.dimType; }).forEach(function (d) {
      select.appendChild(el('option', { value: d }, [document.createTextNode(dimLabel(d))]));
    });
    select.value = state.dim2Type || '';
    select.onchange = function () {
      state.dim2Type = select.value || null;
      state.dim2Values = [];
      onFilterChange();
    };

    var box = document.getElementById('value2Multi');
    box.hidden = !state.dim2Type;
    clearBtn.hidden = !state.dim2Type;
    if (!state.dim2Type) return;
    if (!value2Picker) {
      value2Picker = createMultiSelect(box, function (values) {
        state.dim2Values = values;
        onFilterChange();
      });
    }
    if (value2PickerDim !== state.dim2Type) {
      value2PickerDim = state.dim2Type;
      value2Picker.setItems((DATA.dimensions[state.dim2Type] || []).map(function (it) {
        return { value: it.value, meta: fmtPct(it.favorabilidad_total) };
      }), state.dim2Values);
    } else {
      value2Picker.setSelected(state.dim2Values);
    }
  }

  var comboIndex = null;
  function comboKey(dimA, valA, dimB, valB) { return [dimA, valA, dimB, valB].join('\u0001'); }

  function findCombo(dimA, valA, dimB, valB) {
    if (!comboIndex) {
      comboIndex = {};
      (DATA.combinations || []).forEach(function (c) {
        comboIndex[comboKey(c.dimA, c.valA, c.dimB, c.valB)] = c;
        comboIndex[comboKey(c.dimB, c.valB, c.dimA, c.valA)] = c;
      });
    }
    return comboIndex[comboKey(dimA, valA, dimB, valB)] || null;
  }

  // Cruces entre los valores de dimA y los de dimB (los cruces sin personas no existen en los datos).
  function crossEntry(dimA, valsA, dimB, valsB, label) {
    var combos = [];
    valsA.forEach(function (va) {
      valsB.forEach(function (vb) {
        var c = findCombo(dimA, va, dimB, vb);
        if (c) combos.push(Object.assign({ value: va + ' × ' + vb }, c));
      });
    });
    return aggregateEntries(combos, label);
  }

  function selectionLabel() {
    if (state.dimType === 'General') return 'General';
    var parts = [];
    if (state.dimValues.length) parts.push(dimLabel(state.dimType) + ': ' + valuesLabel(state.dimValues));
    if (hasDim2()) parts.push(dimLabel(state.dim2Type) + ': ' + valuesLabel(state.dim2Values));
    return parts.join(' · ');
  }

  function currentEntry() {
    if (state.dimType === 'General') return { value: 'Todos', byTopic: DATA.general.byTopic, favorabilidad_total: DATA.general.favorabilidad_total, n_users: DATA.general.n_users, participacion: DATA.general.participacion };
    var label = selectionLabel();
    if (state.dimValues.length && hasDim2()) return crossEntry(state.dimType, state.dimValues, state.dim2Type, state.dim2Values, label);
    if (state.dimValues.length) return aggregateEntries(entriesFor(state.dimType, state.dimValues), label);
    if (hasDim2()) return aggregateEntries(entriesFor(state.dim2Type, state.dim2Values), label);
    return null;
  }

  function noSelectionText() {
    if (state.dimValues.length && hasDim2()) return 'No hay personas que cumplan los dos filtros a la vez.';
    return 'Elegí un valor de ' + dimLabel(state.dimType) + ' para ver el detalle por dimensión.';
  }

  function excludedNote(entry) {
    if (!entry || !entry.excludedGroups) return '';
    if (entry.excludedGroups === 1 && !entry.members) {
      return 'Este grupo tiene menos de ' + (DATA.meta.anonimato_minimo || 5) + ' respuestas: por anonimato no se muestran favorabilidad ni eNPS.';
    }
    return entry.excludedGroups + (entry.excludedGroups === 1 ? ' de los grupos seleccionados tiene' : ' de los grupos seleccionados tienen') +
      ' menos de ' + (DATA.meta.anonimato_minimo || 5) + ' respuestas: se cuenta' + (entry.excludedGroups === 1 ? '' : 'n') + ' en participación pero no en favorabilidad ni eNPS.';
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
    title.textContent = selectionLabel();
    var b = band(entry.favorabilidad_total);
    badgeEl.className = 'badge ' + b.cls;
    badgeEl.textContent = b.label;

    kpis.innerHTML = '';
    var p = entry.participacion || {};
    var enps = enpsFor(entry);
    kpis.appendChild(el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: 'Favorabilidad' }),
      el('div', { class: 'kpi-value', text: fmtPct(entry.favorabilidad_total) }),
      entry.members ? el('div', { class: 'kpi-sub', text: entry.members.length + ' grupos combinados' }) : null
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
      el('div', { class: 'kpi-value', text: entry.favorabilidad_total !== null ? (entry.favorabilidad_total - DATA.general.favorabilidad_total >= 0 ? '+' : '') + (entry.favorabilidad_total - DATA.general.favorabilidad_total).toFixed(1).replace('.', ',') + ' pp' : '—' })
    ]));
    var note = excludedNote(entry);
    if (note) kpis.appendChild(el('div', { class: 'selection-note', text: note }));

    var dlBtn = document.getElementById('btnDownloadPdf');
    dlBtn.onclick = function () { downloadPdfFor(entry); };
  }

  function sanitizeFileName(s) {
    return String(s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
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

  function downloadPdfFor(entry) {
    var label = selectionLabel();
    var btn = document.getElementById('btnDownloadPdf');
    var b = band(entry.favorabilidad_total);
    var vsGeneral = entry.favorabilidad_total !== null
      ? (entry.favorabilidad_total - DATA.general.favorabilidad_total >= 0 ? '+' : '') + (entry.favorabilidad_total - DATA.general.favorabilidad_total).toFixed(1).replace('.', ',') + ' pp vs. general'
      : '';

    var root = el('div', { class: 'pdf-export-root' });
    root.appendChild(pdfHeader(label));
    root.appendChild(el('h1', { text: label }));
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
    root.appendChild(pdfFooter(excludedNote(entry)));

    runPdfExport(root, btn, 'Reporte_Clima_' + sanitizeFileName(label));
  }

  function downloadTopicsPdf() {
    var btn = document.getElementById('btnDownloadTopics');
    var entry = currentEntry();
    if (!entry) { alert('Elegí un valor de segmentación para poder descargar este cuadro, o volvé a General.'); return; }
    var label = selectionLabel();
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
    root.appendChild(pdfFooter(excludedNote(entry)));
    runPdfExport(root, btn, 'Reporte_Clima_Dimensiones_' + sanitizeFileName(label));
  }

  function downloadRankingPdf() {
    var btn = document.getElementById('btnDownloadRanking');
    var dt = rankDimType();
    var list = sortByFav(rankList());
    var root = el('div', { class: 'pdf-export-root' });
    root.appendChild(pdfHeader(rankTitle()));
    root.appendChild(el('h1', { text: rankTitle() }));
    root.appendChild(el('span', { class: 'badge', text: 'Ordenado por favorabilidad', style: 'background:var(--humand-50);color:var(--humand-700);' }));
    if (state.dimType !== 'General' && (state.dimValues.length || hasDim2())) {
      var selEntry = currentEntry();
      if (selEntry) {
        root.appendChild(el('div', { class: 'hint', style: 'margin-top:10px;', text: 'Selección actual: ' + selectionLabel() }));
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
    hint.textContent = entry ? selectionLabel() : 'Seleccioná un valor arriba';
    if (!entry) {
      box.appendChild(el('div', { class: 'empty-note', text: noSelectionText() }));
      return;
    }
    box.appendChild(buildBarRows(entry, true));
    var note = excludedNote(entry);
    if (note) box.appendChild(el('div', { class: 'selection-note', text: note }));
  }

  function rankDimType() { return state.dimType === 'General' ? 'Departamento' : state.dimType; }

  function rankTitle() {
    var t = 'Ranking · ' + dimLabel(rankDimType());
    if (hasDim2()) t += ' · dentro de ' + dimLabel(state.dim2Type) + ': ' + valuesLabel(state.dim2Values);
    return t;
  }

  // Con segundo filtro, cada fila es el cruce de ese valor con los valores del segundo filtro.
  function rankList() {
    var dt = rankDimType();
    var list = DATA.dimensions[dt] || [];
    if (!hasDim2()) return list;
    return list.map(function (it) {
      var e = crossEntry(dt, [it.value], state.dim2Type, state.dim2Values, it.value);
      return e ? Object.assign(e, { value: it.value }) : null;
    }).filter(function (e) { return e; });
  }

  function sortByFav(list) {
    return list.slice().sort(function (a, b) {
      if (a.favorabilidad_total === null) return 1;
      if (b.favorabilidad_total === null) return -1;
      return b.favorabilidad_total - a.favorabilidad_total;
    });
  }

  function renderRankTable() {
    var title = document.getElementById('rankingTitle');
    var tbody = document.getElementById('rankTableBody');
    tbody.innerHTML = '';
    title.textContent = rankTitle();
    renderRankRows(rankList(), tbody, rankDimType());
  }

  function buildMiniTrack(negativo, neutral, favorabilidad) {
    var mtrack = el('div', { class: 'mini-track' });
    if (favorabilidad === null || favorabilidad === undefined) return mtrack;
    if (negativo) mtrack.appendChild(el('div', { class: 'mini-seg-neg', style: 'width:' + negativo + '%' }));
    if (neutral) mtrack.appendChild(el('div', { class: 'mini-seg-neu', style: 'width:' + neutral + '%' }));
    if (favorabilidad) mtrack.appendChild(el('div', { class: 'mini-seg-fav', style: 'width:' + favorabilidad + '%' }));
    return mtrack;
  }

  function renderRankRows(list, tbody, dimTypeOfList) {
    sortByFav(list).forEach(function (it) {
      var p = it.participacion || {};
      var isSelected = state.dimValues.indexOf(it.value) !== -1;
      var tr = el('tr', { class: isSelected ? 'is-selected' : '', title: isSelected ? 'Clic para quitar de la selección' : 'Clic para sumar a la selección' });
      tr.appendChild(el('td', { text: it.value }));
      tr.appendChild(el('td', { text: fmtPct(p.tasa) + ' (' + fmtInt(p.respondieron) + '/' + fmtInt(p.asignados) + ')' }));
      var favTd = el('td');
      var favCell = el('div', { class: 'cell-fav' });
      favCell.appendChild(buildMiniTrack(it.negativo_total, it.neutral_total, it.favorabilidad_total));
      favCell.appendChild(el('span', { text: fmtPct(it.favorabilidad_total) }));
      favTd.appendChild(favCell);
      tr.appendChild(favTd);
      tr.addEventListener('click', function () {
        if (state.dimType === 'General') { state.dimType = dimTypeOfList; state.dimValues = []; }
        if (state.dimValues.indexOf(it.value) === -1) state.dimValues = state.dimValues.concat([it.value]);
        else state.dimValues = state.dimValues.filter(function (v) { return v !== it.value; });
        onFilterChange();
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
    renderValue2Picker();
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
      state.dimType = 'General'; state.dimValues = []; state.dim2Type = null; state.dim2Values = []; onFilterChange();
    });
    document.getElementById('btnClearFilter2').addEventListener('click', function () {
      state.dim2Type = null; state.dim2Values = []; onFilterChange();
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
