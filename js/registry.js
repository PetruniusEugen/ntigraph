// Реестр графов: поиск, фильтры, сортировка, карточки
OG.registry = {
  state: { q: "", origin: "all", sort: "date" },

  async render(view) {
    const items = await OG.data.registry();
    this.state = Object.assign(this.state, OG.store.get("reg", {}));
    const s = this.state;
    view.innerHTML = `
      <section class="reg"><div class="reg-in">
        <h1>Реестр графов знаний</h1>
        <p class="reg-lead">${items.length} графов: онтологии, связи между сущностями, импакт-анализ и поддержка решений. На вопросы отвечает Claude, только по фактам выбранного графа.</p>
        <div class="reg-tools">
          <input class="search" id="regQ" placeholder="Поиск по названию, описанию и области" value="${OG.esc(s.q)}">
          <div class="seg" id="regO">
            <button data-v="all">Все</button><button data-v="Встроенный">Встроенные</button><button data-v="Пользовательский">Пользовательские</button>
          </div>
          <select class="sel" id="regS" aria-label="Сортировка">
            <option value="date">Сначала новые</option><option value="size">Сначала крупные</option>
            <option value="dense">Сначала самые связные</option><option value="name">По названию</option>
          </select>
        </div>
        <div class="count" id="regN"></div>
        <div class="grid" id="regG"></div>
      </div></section>`;
    const q = view.querySelector("#regQ"), seg = view.querySelector("#regO"), sel = view.querySelector("#regS");
    sel.value = s.sort;
    const sync = () => {
      seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === s.origin));
      OG.store.set("reg", s);
      this.draw(items);
    };
    q.oninput = () => { s.q = q.value; sync(); };
    seg.querySelectorAll("button").forEach(b => b.onclick = () => { s.origin = b.dataset.v; sync(); });
    sel.onchange = () => { s.sort = sel.value; sync(); };
    sync();
  },

  draw(items) {
    const s = this.state, q = s.q.trim().toLowerCase();
    let list = items.filter(g => (s.origin === "all" || g.origin === s.origin)
      && (!q || (g.name + " " + g.description + " " + g.domain).toLowerCase().includes(q)));
    const by = {
      date: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      size: (a, b) => b.entities - a.entities,
      dense: (a, b) => b.avgDegree - a.avgDegree,
      name: (a, b) => a.name.localeCompare(b.name, "ru"),
    };
    list.sort(by[s.sort] || by.date);
    document.getElementById("regN").textContent = list.length === items.length ? "" : `Найдено: ${list.length} из ${items.length}`;
    const grid = document.getElementById("regG");
    grid.innerHTML = list.length ? list.map(g => this.card(g)).join("") : `<div class="empty">Ничего не нашлось. Попробуй другое слово.</div>`;
    grid.querySelectorAll(".card").forEach(c => {
      const d = c.querySelector(".desc"), m = c.querySelector(".more");
      if (d.scrollHeight > d.clientHeight + 2) {
        m.hidden = false;
        m.onclick = () => { const o = d.classList.toggle("clamp"); m.textContent = o ? "подробнее" : "свернуть"; };
      }
    });
  },

  card(g) {
    const st = { "Демо": "s-demo", "Черновик": "s-draft", "Проект": "s-proj" }[g.status] || "";
    const href = `#/g/${g.id}`;
    return `<article class="card">
      <div class="card-tags">${g.status ? `<span class="tag ${st}">${g.status}</span>` : ""}<span class="tag">${g.origin}</span>
        <span class="tag">версия ${OG.esc(g.version)}</span><span class="date">${OG.fmtDate(g.updatedAt)}</span></div>
      <h2><a href="${href}/knowledge">${OG.esc(g.name)}</a></h2>
      <p class="desc clamp">${OG.esc(g.description)}</p><button class="more" hidden>подробнее</button>
      <p class="domain">${OG.esc(g.domain)}</p>
      <div class="stats">
        <div class="stat"><b>${g.entities}</b><span>${OG.plural(g.entities, "сущность", "сущности", "сущностей")}</span></div>
        <div class="stat"><b>${g.links}</b><span>${OG.plural(g.links, "связь", "связи", "связей")}</span></div>
        <div class="stat"><b>${g.classes}</b><span>${OG.plural(g.classes, "класс", "класса", "классов")}</span></div>
        <div class="stat" title="Сколько связей в среднем у одной сущности. Чем больше, тем плотнее граф и тем длиннее цепочки последствий он может показать."><b>${String(g.avgDegree).replace(".", ",")}</b><span>связей на узел</span></div>
      </div>
      ${g.isolated ? `<div class="note">⚠ ${g.isolated} ${OG.plural(g.isolated, "сущность", "сущности", "сущностей")} без связей</div>` : ""}
      <div class="actions">
        <a class="btn primary" href="${href}/knowledge">Граф знаний</a>
        <a class="btn" href="${href}/ontology">Онтология</a>
        <a class="btn" href="${href}/knowledge?panel=impact">Импакт-анализ</a>
        <a class="btn" href="${href}/knowledge?panel=decision">Решения</a>
      </div>
    </article>`;
  },
};
