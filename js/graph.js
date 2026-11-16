// Экран графа: граф знаний и онтология (Cytoscape + fcose)
OG.graph = {
  cy: null, G: null, id: null, tab: "knowledge", hidden: new Set(), labelTop: 30,

  async render(view, id, tab, params) {
    this.id = id; this.tab = tab; this.hidden = new Set();
    const G = this.G = await OG.data.graph(id);
    const nNodes = Object.keys(G.nodes).length;
    const nCls = Object.keys(G.classes).length;
    const sub = tab === "knowledge"
      ? `${nNodes} ${OG.plural(nNodes, "сущность", "сущности", "сущностей")} · ${G.edges.length} ${OG.plural(G.edges.length, "связь", "связи", "связей")}`
      : `${nCls} ${OG.plural(nCls, "класс", "класса", "классов")} · ${G.relations.length} ${OG.plural(G.relations.length, "тип связи", "типа связей", "типов связей")}`;

    view.innerHTML = `
      <section class="gv">
        <div class="gv-bar">
          <div class="gv-title"><h1>${OG.esc(G.meta.name)}</h1><div class="sub">${sub}</div></div>
          <div class="tabs">
            <a href="#/g/${id}/knowledge" class="${tab === "knowledge" ? "on" : ""}">Граф знаний</a>
            <a href="#/g/${id}/ontology" class="${tab === "ontology" ? "on" : ""}">Онтология</a>
          </div>
          <div class="gv-find"><input class="search" id="find" placeholder="${tab === "knowledge" ? "Найти узел" : "Найти класс"}" autocomplete="off"><div class="sugg" id="sugg"></div></div>
          <div class="gv-acts">
            ${tab === "ontology" ? `<button class="btn" id="passBtn">Паспорт онтологии</button>` : ""}
            <button class="btn amber" data-panel="impact">Импакт-анализ</button>
            <button class="btn green" data-panel="decision">Решения</button>
          </div>
        </div>
        <div class="gv-body">
          <div id="cy"></div>
          <div class="float hint" id="hint">${tab === "knowledge"
            ? "Клик по узлу: его связи. Колесо мыши: масштаб. Подписи мелких узлов появляются при приближении."
            : "Клик по классу: описание, атрибуты и экземпляры."}</div>
          <div class="float hl-bar" id="hlBar"><span id="hlText"></span><button id="hlOff">Сбросить</button></div>
          <div class="float legend" id="legend"></div>
          <div class="float zoom">
            <button id="zIn" title="Приблизить"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg></button>
            <button id="zOut" title="Отдалить"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14"/></svg></button>
            <button id="zFit" title="Показать весь граф"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
          </div>
          <aside class="float ask" id="ask"></aside>
          <aside class="float ncard" id="ncard"></aside>
        </div>
      </section>`;

    this.buildCy(tab);
    this.legend();
    this.search();
    view.querySelector("#zIn").onclick = () => this.zoomBy(1.3);
    view.querySelector("#zOut").onclick = () => this.zoomBy(1 / 1.3);
    view.querySelector("#zFit").onclick = () => this.cy.animate({ fit: { padding: 40 }, duration: 300 });
    view.querySelector("#hlOff").onclick = () => this.clearHighlight();
    const pb = view.querySelector("#passBtn");
    if (pb) pb.onclick = () => this.passport();
    view.querySelectorAll("[data-panel]").forEach(b => b.onclick = () => OG.ask.toggle(b.dataset.panel));
    setTimeout(() => { const h = document.getElementById("hint"); if (h) h.style.opacity = 0; }, 7000);

    OG.ask.attach(id, document.getElementById("ask"));
    if (params.panel) OG.ask.open(params.panel);
    if (params.focus) setTimeout(() => this.focus(params.focus), 50);
  },

  // ---------- построение ----------
  buildCy(tab) {
    const G = this.G;
    const els = [];
    if (tab === "knowledge") {
      Object.values(G.nodes).forEach(n => els.push({ data: { id: n.id, label: n.label, color: n.color, deg: n.deg, group: n.group }, classes: n.rank < this.labelTop ? "major" : "minor" }));
      G.edges.forEach(e => els.push({ data: { id: "e" + e.id, source: e.s, target: e.o, label: e.p } }));
    } else {
      Object.values(G.classes).forEach(c => {
        const gk = G.byClass ? c.code : (c.areas[0] || "_other");
        const g = G.gIndex[gk] || { color: "#8a93a8" };
        els.push({ data: { id: c.code, label: c.name, color: g.color, deg: c.count, group: gk }, classes: "major cls" });
      });
      const seen = {};
      G.relations.forEach((r, i) => {
        if (!G.classes[r.from] || !G.classes[r.to]) return;
        els.push({ data: { id: "r" + i, source: r.from, target: r.to, label: r.name } });
        seen[r.from + ">" + r.to] = 1;
      });
      Object.values(G.classes).forEach(c => c.subclasses.forEach((s, i) => {
        const sc = typeof s === "string" ? s : s.code;
        if (G.classes[sc]) els.push({ data: { id: "s" + c.code + i, source: sc, target: c.code, label: "подкласс" }, classes: "sub" });
      }));
    }

    if (this.cy) this.cy.destroy();
    const many = tab === "knowledge" && els.length > 700;
    this.cy = cytoscape({
      container: document.getElementById("cy"),
      elements: els,
      style: this.style(),
      minZoom: 0.08, maxZoom: 3.5,
      layout: {
        name: "fcose", quality: many ? "default" : "proof", animate: false, randomize: true,
        nodeRepulsion: () => tab === "knowledge" ? 26000 : 30000,
        idealEdgeLength: () => tab === "knowledge" ? 140 : 190,
        edgeElasticity: () => 0.3, nodeSeparation: 90, gravity: 0.2, gravityRangeCompound: 1.5,
        numIter: 2500, packComponents: true, tile: true, tilingPaddingVertical: 30, tilingPaddingHorizontal: 30,
      },
    });
    const cy = this.cy;
    cy.ready(() => {
      cy.fit(undefined, 40);
      // граф знаний открываем не «клубком»: стартовый масштаб, при котором подписи хабов читаемы
      if (tab === "knowledge" && cy.zoom() < 0.45) {
        cy.zoom(0.45);
        cy.center(cy.nodes(".major"));
      }
      this.updateLabels();
    });
    cy.on("zoom", () => this.updateLabels());
    cy.on("tap", "node", ev => this.select(ev.target.id()));
    cy.on("tap", ev => { if (ev.target === cy) this.unselect(); });
    cy.on("mouseover", "node", ev => ev.target.addClass("hover"));
    cy.on("mouseout", "node", ev => ev.target.removeClass("hover"));
  },

  style() {
    const text = OG.css("--text"), text2 = OG.css("--text2"), bg = OG.css("--cy-label-bg"), edge = OG.css("--cy-edge"), amber = OG.css("--amber");
    const isOnto = this.tab === "ontology";
    return [
      { selector: "node", style: {
        "background-color": "data(color)", "border-width": 2, "border-color": bg,
        width: `mapData(deg, 0, ${isOnto ? 40 : 30}, ${isOnto ? 26 : 12}, ${isOnto ? 64 : 46})`,
        height: `mapData(deg, 0, ${isOnto ? 40 : 30}, ${isOnto ? 26 : 12}, ${isOnto ? 64 : 46})`,
        label: "data(label)", color: text, "font-size": isOnto ? 14 : 12, "font-weight": 500,
        "font-family": "Inter, Segoe UI, sans-serif",
        "text-valign": "bottom", "text-margin-y": 5, "text-wrap": "wrap", "text-max-width": isOnto ? 150 : 120,
        "text-background-color": bg, "text-background-opacity": 0.92, "text-background-padding": 3, "text-background-shape": "roundrectangle",
        "min-zoomed-font-size": 6, "z-index": 10,
      } },
      { selector: "node.major", style: { "font-weight": 600 } },
      { selector: "node.nolabel", style: { label: "", "z-index": 1 } },
      { selector: "node.hover", style: { label: "data(label)", "z-index": 99, "border-color": text } },
      { selector: "edge", style: {
        width: 1.2, "line-color": edge, "target-arrow-color": edge, "target-arrow-shape": "triangle", "arrow-scale": 0.7,
        "curve-style": "bezier", opacity: isOnto ? 0.55 : 0.32,
      } },
      { selector: "edge.sub", style: { "line-style": "dashed", width: 2, opacity: 0.8, "target-arrow-shape": "triangle-backcurve" } },
      { selector: ".faded", style: { opacity: 0.1, label: "" } },
      { selector: "edge.faded", style: { opacity: 0.04 } },
      { selector: "node.hl", style: { opacity: 1, label: "data(label)" } },
      { selector: "edge.hl", style: {
        opacity: 0.95, width: 2, "line-color": text2, "target-arrow-color": text2, label: "data(label)",
        "font-size": 11, color: text2, "text-rotation": "autorotate", "text-background-color": bg, "text-background-opacity": 0.9, "text-background-padding": 2,
      } },
      { selector: "edge.nolab", style: { label: "" } },
      { selector: "node.sel", style: { "border-color": text, "border-width": 3, "z-index": 100, "font-size": isOnto ? 15 : 14 } },
      { selector: "node.ref", style: { "border-color": amber, "border-width": 3, opacity: 1, label: "data(label)", "z-index": 90 } },
      { selector: "node.gone", style: { display: "none" } },
    ];
  },

  restyle() { if (this.cy) this.cy.style(this.style()); },

  updateLabels() {
    if (!this.cy) return;
    const z = this.cy.zoom();
    if (this.tab !== "knowledge") {
      const k = 1 / Math.min(1, z);
      this.cy.style().selector("node").style({ "font-size": 14 * k, "text-max-width": 150 * k }).update();
      this.cy.style().selector("edge.hl").style({ "font-size": 12 * k }).update();
      return;
    }
    // чем ближе, тем больше подписей: при общем виде только главные узлы
    const n = this.cy.nodes().length;
    const share = Math.min(1, Math.max(0, (z - 0.35) / 0.95));
    const limit = z >= 1.3 ? Infinity : Math.max(12, Math.round(n * share * share));
    // подписи держим примерно 13 px на экране при любом масштабе
    const k = 1 / Math.min(1, z);
    this.cy.batch(() => {
      this.cy.style().selector("node").style({ "font-size": 13 * k, "text-max-width": 120 * k, "text-margin-y": 5 * k }).update();
      // подписи без наложений: идём от главных узлов к мелким, пропускаем те, что перекрыли бы уже показанные
      const boxes = [];
      const hit = b => boxes.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
      this.cy.nodes().sort((x, y) => this.G.nodes[x.id()].rank - this.G.nodes[y.id()].rank).forEach(n => {
        if (this.G.nodes[n.id()].rank >= limit) { n.addClass("nolabel"); return; }
        const p = n.renderedPosition(), r = n.renderedHeight() / 2 + 3;
        const len = n.data("label").length * 7.4, w = Math.min(122, len), h = Math.ceil(len / 122) * 16;
        const b = { x1: p.x - w / 2 - 3, x2: p.x + w / 2 + 3, y1: p.y + r, y2: p.y + r + h + 2 };
        if (hit(b)) { n.addClass("nolabel"); return; }
        boxes.push(b);
        n.removeClass("nolabel");
      });
    });
  },

  zoomBy(k) {
    const cy = this.cy;
    cy.animate({ zoom: { level: cy.zoom() * k, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }, duration: 200 });
  },

  // ---------- легенда и фильтры ----------
  legend() {
    const G = this.G, box = document.getElementById("legend");
    const groups = this.tab === "knowledge" ? G.groups.filter(g => g.count > 0) : G.groups;
    const title = G.byClass ? "Классы" : "Области";
    const collapsed = OG.store.get("legendCollapsed", false);
    box.className = "float legend" + (collapsed ? " collapsed" : "");
    box.innerHTML = `<h4><span>${title}</span><span><button id="lgAll">все</button> · <button id="lgFold">${collapsed ? "показать" : "скрыть"}</button></span></h4>
      <div class="items">${groups.map(g => `<label data-k="${OG.esc(g.key)}"><input type="checkbox" checked><span class="dot" style="background:${g.color}"></span><span>${OG.esc(g.name)}</span>${this.tab === "knowledge" ? `<span class="n">${g.count}</span>` : ""}</label>`).join("")}</div>`;
    box.querySelectorAll("label").forEach(l => l.onclick = ev => {
      ev.preventDefault();
      const k = l.dataset.k;
      this.hidden.has(k) ? this.hidden.delete(k) : this.hidden.add(k);
      l.classList.toggle("off", this.hidden.has(k));
      this.applyFilter();
    });
    box.querySelector("#lgAll").onclick = () => { this.hidden.clear(); box.querySelectorAll("label").forEach(l => l.classList.remove("off")); this.applyFilter(); };
    box.querySelector("#lgFold").onclick = ev => {
      const c = !box.classList.contains("collapsed");
      box.classList.toggle("collapsed", c); ev.target.textContent = c ? "показать" : "скрыть";
      OG.store.set("legendCollapsed", c);
    };
  },

  applyFilter() {
    this.cy.batch(() => this.cy.nodes().forEach(n => n.toggleClass("gone", this.hidden.has(n.data("group")))));
  },

  // ---------- поиск ----------
  search() {
    const inp = document.getElementById("find"), box = document.getElementById("sugg");
    const items = this.tab === "knowledge"
      ? Object.values(this.G.nodes).map(n => ({ id: n.id, label: n.label, sub: n.clsName, color: n.color }))
      : Object.values(this.G.classes).map(c => ({ id: c.code, label: c.name, sub: c.count + " экз.", color: this.cy.getElementById(c.code).data("color") }));
    let act = 0, list = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { box.classList.remove("open"); return; }
      list = items.filter(i => i.label.toLowerCase().includes(q)).sort((a, b) => a.label.toLowerCase().indexOf(q) - b.label.toLowerCase().indexOf(q)).slice(0, 12);
      act = 0;
      box.innerHTML = list.length ? list.map((i, k) => `<button data-id="${OG.esc(i.id)}" class="${k === 0 ? "act" : ""}"><span class="dot" style="background:${i.color}"></span>${OG.esc(i.label)}<small>${OG.esc(i.sub)}</small></button>`).join("")
        : `<button disabled>Ничего не нашлось</button>`;
      box.classList.add("open");
      box.querySelectorAll("button[data-id]").forEach(b => b.onmousedown = ev => { ev.preventDefault(); pick(b.dataset.id); });
    };
    const pick = id => { box.classList.remove("open"); inp.value = ""; inp.blur(); this.focus(id); };
    inp.oninput = draw;
    inp.onblur = () => setTimeout(() => box.classList.remove("open"), 150);
    inp.onkeydown = ev => {
      const bs = box.querySelectorAll("button[data-id]");
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        act = (act + (ev.key === "ArrowDown" ? 1 : -1) + bs.length) % Math.max(1, bs.length);
        bs.forEach((b, k) => b.classList.toggle("act", k === act));
      } else if (ev.key === "Enter" && bs[act]) pick(bs[act].dataset.id);
      else if (ev.key === "Escape") { inp.value = ""; box.classList.remove("open"); }
    };
  },

  // ---------- выбор узла ----------
  focus(id) {
    const n = this.cy.getElementById(id);
    if (!n.length) return;
    if (n.hasClass("gone")) { this.hidden.delete(n.data("group")); this.legend(); this.applyFilter(); }
    this.select(id);
    this.cy.animate({ center: { eles: n.closedNeighborhood() }, zoom: Math.max(this.cy.zoom(), 1.1), duration: 350 });
  },

  select(id) {
    const cy = this.cy, n = cy.getElementById(id);
    cy.batch(() => {
      cy.elements().removeClass("hl sel faded");
      const nb = n.closedNeighborhood();
      cy.elements().not(nb).addClass("faded");
      nb.addClass("hl");
      n.addClass("sel");
      // подписи на линиях только когда их немного, иначе они слипаются
      cy.edges().removeClass("nolab");
      if (n.connectedEdges().length > 10) n.connectedEdges().addClass("nolab");
    });
    this.tab === "knowledge" ? this.nodeCard(id) : this.classCard(id);
  },

  unselect() {
    this.cy.elements().removeClass("hl sel faded");
    if (this.refIds) this.highlight(this.refIds, this.refText);
    document.getElementById("ncard").classList.remove("open");
  },

  cardShell(color, cls, title, body, acts) {
    const box = document.getElementById("ncard");
    box.innerHTML = `<div class="nc-head"><span class="dot" style="background:${color}"></span>
        <div><div class="nc-cls">${OG.esc(cls)}</div><h3>${OG.esc(title)}</h3></div>
        <button class="nc-x" title="Закрыть" aria-label="Закрыть">✕</button></div>
      <div class="nc-body">${body}</div>${acts ? `<div class="nc-acts">${acts}</div>` : ""}`;
    box.classList.add("open");
    box.querySelector(".nc-x").onclick = () => this.unselect();
    box.querySelectorAll("[data-node]").forEach(b => b.onclick = () => this.focus(b.dataset.node));
    box.querySelectorAll("[data-know]").forEach(b => b.onclick = () => { location.hash = `#/g/${this.id}/knowledge?focus=${encodeURIComponent(b.dataset.know)}`; });
    return box;
  },

  nodeCard(id) {
    const G = this.G, n = G.nodes[id];
    const grp = (list, key) => {
      const by = {};
      list.forEach(e => (by[e.p] = by[e.p] || []).push(e));
      return Object.entries(by).map(([p, es]) => `<div class="rel"><span class="pred">${OG.esc(p)}</span>${es.map(e => {
        const m = G.nodes[e[key]];
        return `<button class="nlink" data-node="${OG.esc(m.id)}">${OG.esc(m.label)}</button>`;
      }).join(", ")}</div>`).join("");
    };
    const srcs = [...new Set([...n.out, ...n.inc].map(e => e.src).filter(Boolean))];
    const cls = G.classes[n.cls];
    const body = `
      ${cls?.comment ? `<p class="nc-comment">${OG.esc(cls.comment)}</p>` : ""}
      ${n.out.length ? `<h4>Связи от узла · ${n.out.length}</h4>${grp(n.out, "o")}` : ""}
      ${n.inc.length ? `<h4>Связи к узлу · ${n.inc.length}</h4>${grp(n.inc, "s")}` : ""}
      ${!n.out.length && !n.inc.length ? `<p class="nc-comment">У этого узла нет связей в графе.</p>` : ""}
      ${srcs.length ? `<h4>Источники фактов</h4><div class="src">${srcs.map(OG.esc).join(" · ")}</div>` : ""}`;
    const acts = `<button class="btn" id="askImp">Что будет, если с «${OG.esc(n.label)}» возникнет проблема?</button>
      <button class="btn" id="askDec">Какие решения есть для «${OG.esc(n.label)}»?</button>`;
    const box = this.cardShell(n.color, `${n.clsName}${G.byClass ? "" : " · " + (G.gIndex[n.group]?.name || "")}`, n.label, body, acts);
    box.querySelector("#askImp").onclick = () => OG.ask.ask("impact", `Что будет, если с «${n.label}» возникнет проблема или он станет недоступен? Что это затронет?`);
    box.querySelector("#askDec").onclick = () => OG.ask.ask("decision", `Какие меры и решения в графе есть для «${n.label}», и что выбрать в первую очередь?`);
  },

  classCard(code) {
    const G = this.G, c = G.classes[code];
    const color = this.cy.getElementById(code).data("color");
    const outs = G.relations.filter(r => r.from === code), ins = G.relations.filter(r => r.to === code);
    const rel = (list, key) => list.map(r => `<div class="rel"><span class="pred">${OG.esc(r.name)}</span><button class="nlink" data-node="${OG.esc(r[key])}">${OG.esc(G.classes[r[key]]?.name || r[key])}</button></div>`).join("");
    const parents = Object.values(G.classes).filter(p => p.subclasses.some(s => (s.code || s) === code));
    const inst = Object.values(G.nodes).filter(n => n.cls === code);
    const body = `
      ${c.comment ? `<p class="nc-comment">${OG.esc(c.comment)}</p>` : ""}
      ${parents.length ? `<h4>Входит в класс</h4>${parents.map(p => `<button class="nlink" data-node="${p.code}">${OG.esc(p.name)}</button>`).join(", ")}` : ""}
      ${c.subclasses.length ? `<h4>Подклассы</h4>${c.subclasses.map(s => `<button class="nlink" data-node="${OG.esc(s.code || s)}">${OG.esc(s.name || s)}</button>`).join(", ")}` : ""}
      ${c.attributes.length ? `<h4>Атрибуты · ${c.attributes.length}</h4>${c.attributes.map(a => `<div class="attr">${OG.esc(a.name)}${a.comment ? `<small>${OG.esc(a.comment)}</small>` : ""}</div>`).join("")}` : ""}
      ${outs.length ? `<h4>Связи от класса · ${outs.length}</h4>${rel(outs, "to")}` : ""}
      ${ins.length ? `<h4>Связи к классу · ${ins.length}</h4>${rel(ins, "from")}` : ""}
      <h4>Экземпляры в графе · ${inst.length}</h4>
      ${inst.length ? `<div class="chips">${inst.slice(0, 60).map(n => `<span class="chip" data-know="${OG.esc(n.id)}">${OG.esc(n.label)}</span>`).join("")}</div>` : `<p class="nc-comment">Экземпляров пока нет.</p>`}`;
    const area = c.areas.length ? c.areas.join(", ") : "Класс онтологии";
    this.cardShell(color, area, c.name, body, "");
  },

  passport() {
    const G = this.G, i = G.info || {};
    this.cy.elements().removeClass("hl sel faded");
    const body = `
      <p class="nc-comment">${OG.esc(i.description || G.meta.description || "Описание не задано.")}</p>
      ${(i.scope || []).length ? `<h4>Что покрывает</h4><ul class="passport">${i.scope.map(s => `<li>${OG.esc(s)}</li>`).join("")}</ul>` : ""}
      ${(i.competencyQuestions || []).length ? `<h4>На какие вопросы отвечает</h4><ul class="passport">${i.competencyQuestions.map(s => `<li>${OG.esc(s)}</li>`).join("")}</ul>` : ""}
      <h4>Состав</h4><div class="src">Версия ${OG.esc(G.meta.version)} · обновлено ${OG.fmtDate(G.meta.updatedAt)} · ${Object.keys(G.classes).length} классов · ${G.relations.length} типов связей</div>`;
    this.cardShell("var(--accent)", "Паспорт онтологии", G.meta.name, body, "");
  },

  // ---------- подсветка узлов из ответа ----------
  highlight(ids, text) {
    if (!this.cy) return;
    if (this.tab !== "knowledge") {
      this.refIds = ids; this.refText = text;
      return;
    }
    const cy = this.cy;
    const set = cy.collection(ids.map(i => cy.getElementById(i)).filter(n => n.length));
    if (!set.length) return;
    this.refIds = ids; this.refText = text;
    cy.batch(() => {
      cy.elements().removeClass("ref faded hl sel");
      cy.elements().addClass("faded");
      set.removeClass("faded").addClass("ref");
      const es = set.edgesWith(set);
      es.removeClass("faded").addClass("hl");
      cy.edges().removeClass("nolab");
      if (es.length > 12) es.addClass("nolab");
    });
    const bar = document.getElementById("hlBar");
    document.getElementById("hlText").textContent = text || `На графе подсвечено ${set.length} узлов из ответа`;
    bar.classList.add("on");
    document.getElementById("hint").style.display = "none";
    const ask = document.getElementById("ask");
    const pad = ask.classList.contains("open") && innerWidth > 760 ? ask.offsetWidth + 40 : 40;
    cy.animate({ fit: { eles: set, padding: 60 }, duration: 400, complete: () => {
      if (pad > 40) cy.panBy({ x: pad / 2, y: 0 });
    } });
  },

  clearHighlight() {
    this.refIds = null; this.refText = null;
    this.cy.elements().removeClass("ref faded hl sel");
    document.getElementById("hlBar").classList.remove("on");
  },
};
