// Панель «Импакт-анализ» и «Решения»: вопросы к Claude через локальный сервер
OG.ask = {
  gid: null, box: null, mode: null, threads: {}, busy: false, serverOk: null,
  MODES: {
    impact: { title: "Импакт-анализ", sub: "Что будет, если...", intro: "Спроси, что произойдёт при сбое, событии или изменении. Отвечает Claude, только по фактам этого графа: он пройдёт по связям графа и покажет цепочку последствий. Узлы из ответа подсветятся на графе." },
    decision: { title: "Принятие решений", sub: "Что выбрать и почему", intro: "Спроси, какой вариант выбрать или что делать в первую очередь. Отвечает Claude: он сравнит варианты только по фактам графа и скажет, чего в графе не хватает." },
  },

  attach(gid, box) {
    this.gid = gid; this.box = box; this.mode = null;
    box.classList.remove("open");
  },

  key(mode) { return this.gid + "|" + (mode || this.mode); },

  toggle(mode) {
    if (this.mode === mode && this.box.classList.contains("open")) this.close();
    else this.open(mode);
  },

  open(mode) {
    this.mode = mode;
    this.box.className = "float ask open " + mode;
    document.querySelectorAll("[data-panel]").forEach(b => b.classList.toggle("on", b.dataset.panel === mode));
    if (innerWidth <= 760) document.getElementById("ncard").classList.remove("open");
    this.render();
  },

  close() {
    this.box.classList.remove("open");
    this.mode = null;
    document.querySelectorAll("[data-panel]").forEach(b => b.classList.remove("on"));
  },

  async render() {
    const m = this.MODES[this.mode], th = this.threads[this.key()] || [];
    const sc = await OG.data.scenarios();
    const list = (sc[this.gid] || sc._default)[this.mode] || [];
    const asked = new Set(th.map(t => t.q));
    const closed = th.length > 0;
    this.box.innerHTML = `
      <div class="ask-head"><span class="mark"></span><div><b>${m.title}</b><small>${m.sub}</small></div>
        <span class="sp"></span>${th.length ? `<button class="lnk" id="askClear">Очистить</button>` : ""}
        <button class="nc-x" id="askX" title="Закрыть" aria-label="Закрыть">✕</button></div>
      ${list.length ? `<div class="scen ${closed ? "closed" : ""}" id="scen">
        <button class="scen-t" id="scenT">Готовые вопросы · ${list.length} <span>${closed ? "▸" : "▾"}</span></button>
        <div class="scen-list">${list.map(q => `<button class="${asked.has(q) ? "done" : ""}">${OG.esc(q)}</button>`).join("")}</div></div>` : ""}
      <div class="thread" id="thread">${th.length ? "" : `<div class="ask-intro">${OG.static ? "Выбери готовый вопрос выше. Ответы Claude получены заранее, только по фактам этого графа. Узлы из ответа подсветятся на графе." : m.intro}</div>`}</div>
      ${OG.static ? `<div class="ask-off ask-demo">Это демо-версия: ответы на готовые вопросы получены заранее. Свои вопросы Claude разбирает в полной версии.</div>`
        : this.serverOk === false ? `<div class="ask-off">Сервер с Claude не запущен. Открой страницу через run.bat, тогда вопросы заработают.</div>` : ""}
      ${OG.static ? "" : `<form class="ask-in" id="askForm"><textarea id="askQ" rows="1" placeholder="Свой вопрос по этому графу"></textarea>
        <button type="submit" title="Спросить (Enter)" aria-label="Спросить"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>`}`;

    const thread = this.box.querySelector("#thread");
    th.forEach(t => this.drawItem(thread, t));
    // показываем начало последнего ответа, а не его конец
    const qs = thread.querySelectorAll(".msg-q");
    thread.scrollTop = qs.length ? qs[qs.length - 1].offsetTop - 8 : 0;

    this.box.querySelector("#askX").onclick = () => this.close();
    const clr = this.box.querySelector("#askClear");
    if (clr) clr.onclick = () => { delete this.threads[this.key()]; OG.graph.clearHighlight(); this.render(); };
    const st = this.box.querySelector("#scenT");
    if (st) st.onclick = () => {
      const s = this.box.querySelector("#scen"); s.classList.toggle("closed");
      st.querySelector("span").textContent = s.classList.contains("closed") ? "▸" : "▾";
    };
    this.box.querySelectorAll(".scen-list button").forEach((b, i) => b.onclick = () => this.ask(this.mode, list[i]));
    const ta = this.box.querySelector("#askQ"), form = this.box.querySelector("#askForm");
    if (!form) { this.syncBusy(); return; }
    ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
    ta.onkeydown = ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = ev => { ev.preventDefault(); const q = ta.value.trim(); if (q) { ta.value = ""; this.ask(this.mode, q); } };
    this.syncBusy();
  },

  syncBusy() {
    if (!this.box) return;
    this.box.querySelectorAll(".scen-list button, .ask-in button").forEach(b => b.disabled = this.busy);
  },

  drawItem(thread, t) {
    const q = document.createElement("div");
    q.className = "msg-q"; q.textContent = t.q;
    thread.appendChild(q);
    const a = document.createElement("div");
    if (t.wait) {
      a.className = "msg-wait";
      a.innerHTML = `<span class="dots"><span></span><span></span><span></span></span><span>Claude читает граф и думает · <b class="sec">${Math.round((Date.now() - t.wait) / 1000)}</b> с</span>`;
      a.dataset.wait = t.wait;
    } else if (t.err) {
      a.className = "msg-err";
      a.innerHTML = `${OG.esc(t.err)} <button class="btn" style="margin-left:8px">Повторить</button>`;
      a.querySelector("button").onclick = () => this.retry(t);
    } else {
      a.className = "msg-a";
      const { html, ids } = this.md(t.a);
      a.innerHTML = html + `<div class="msg-foot"><span>${t.cached ? "Готовый ответ, получен заранее" : `Ответ за ${t.seconds} с`}</span>
        ${ids.length ? `<button class="btn" data-show>Показать на графе · ${ids.length}</button>` : ""}
        ${OG.static ? "" : `<button class="btn" data-fresh title="Спросить Claude ещё раз">Спросить заново</button>`}</div>`;
      a.querySelectorAll(".ref[data-node]").forEach(r => r.onclick = () => this.goNode(r.dataset.node));
      const sh = a.querySelector("[data-show]");
      if (sh) sh.onclick = () => this.showOnGraph(ids);
      const fr = a.querySelector("[data-fresh]");
      if (fr) fr.onclick = () => this.ask(this.mode, t.q, true);
    }
    thread.appendChild(a);
  },

  goNode(id) {
    if (OG.graph.tab === "knowledge") OG.graph.focus(id);
    else location.hash = `#/g/${this.gid}/knowledge?focus=${encodeURIComponent(id)}`;
  },

  showOnGraph(ids) {
    if (OG.graph.tab !== "knowledge") {
      OG.graph.refIds = ids;
      location.hash = `#/g/${this.gid}/knowledge?panel=${this.mode}`;
      return;
    }
    OG.graph.highlight(ids, `На графе ${ids.length} ${OG.plural(ids.length, "узел", "узла", "узлов")} из ответа`);
  },

  async ask(mode, q, fresh) {
    if (this.busy) return;
    if (this.mode !== mode || !this.box.classList.contains("open")) this.open(mode);
    const key = this.key(mode);
    const th = this.threads[key] = this.threads[key] || [];
    const history = fresh ? [] : th.filter(t => t.a).map(t => ({ q: t.q, a: t.a }));
    const item = { q, wait: Date.now(), fresh };
    th.push(item);
    this.busy = true;
    await this.render();
    const tick = setInterval(() => {
      const s = this.box.querySelector(".msg-wait .sec");
      if (s) s.textContent = Math.round((Date.now() - item.wait) / 1000);
    }, 1000);
    try {
      if (OG.static) {
        // демо-версия: ответ берём из файла с готовыми ответами
        const all = await this.staticAnswers();
        const a = (all[mode] || {})[q];
        if (!a) throw new Error("Ответ на этот вопрос ещё готовится. Загляни чуть позже.");
        await new Promise(r => setTimeout(r, 350));
        Object.assign(item, { a, cached: true, seconds: 0, wait: null });
      } else {
        const r = await fetch("api/ask", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph: this.gid, mode, question: q, history, fresh: !!fresh }) });
        const d = await r.json().catch(() => ({ error: "Сервер ответил непонятно" }));
        if (!r.ok || d.error) throw new Error(d.error || "Ошибка сервера");
        Object.assign(item, { a: d.answer, cached: d.cached, seconds: d.seconds, wait: null });
        this.serverOk = true;
      }
    } catch (e) {
      const offline = !OG.static && e instanceof TypeError;
      if (offline) this.serverOk = false;
      Object.assign(item, { err: offline ? "Нет связи с сервером. Запусти run.bat и обнови страницу." : e.message, wait: null });
    }
    clearInterval(tick);
    this.busy = false;
    if (this.key(mode) === key && this.box.isConnected) {
      await this.render();
      if (item.a) {
        const ids = this.md(item.a).ids;
        if (ids.length && OG.graph.tab === "knowledge") OG.graph.highlight(ids, `На графе ${ids.length} ${OG.plural(ids.length, "узел", "узла", "узлов")} из ответа`);
      }
    }
  },

  async staticAnswers() {
    this._static = this._static || {};
    if (!this._static[this.gid]) {
      try { this._static[this.gid] = await OG.data.json(`data/${this.gid}/answers.json`); }
      catch (e) { this._static[this.gid] = {}; }
    }
    return this._static[this.gid];
  },

  retry(t) {
    const th = this.threads[this.key()];
    th.splice(th.indexOf(t), 1);
    this.ask(this.mode, t.q, t.fresh);
  },

  // markdown ответа: заголовки ###, списки, **жирный**, ссылки на узлы [[id]] / [[id|метка]]
  md(text) {
    const G = OG.graph.G, ids = [];
    const inline = s => OG.esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\[\[([\w\-]+)(?:\|([^\]]*?))?\]\]/g, (m, id, lab) => {
        const n = G && G.nodes[id];
        if (!n) return `<span class="ref unk">${lab || id}</span>`;
        if (!ids.includes(id)) ids.push(id);
        return `<button class="ref" data-node="${id}">${OG.esc(n.label)}</button>`;
      });
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    (text || "").split(/\r?\n/).forEach(line => {
      const l = line.trim();
      let m;
      if (!l) { close(); return; }
      if ((m = l.match(/^#{1,4}\s+(.*)$/))) {
        close();
        const h = m[1].replace(/\*\*/g, "");
        out.push(`<h3 class="${/огранич/i.test(h) ? "lim" : ""}">${OG.esc(h)}</h3>`);
      } else if ((m = l.match(/^\d+[.)]\s+(.*)$/))) {
        if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = l.match(/^[-*•]\s+(.*)$/))) {
        if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else { close(); out.push(`<p>${inline(l)}</p>`); }
    });
    close();
    return { html: out.join(""), ids };
  },
};
