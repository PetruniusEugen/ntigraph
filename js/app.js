// Переключение экранов по адресу: #/ (реестр), #/g/<id>/knowledge|ontology?panel=..&focus=..
OG.app = {
  async route() {
    const view = document.getElementById("view");
    const [path, qs] = location.hash.replace(/^#/, "").split("?");
    const params = Object.fromEntries(new URLSearchParams(qs || ""));
    const m = path.match(/^\/g\/([\w-]+)(?:\/(knowledge|ontology))?/);
    const crumbs = document.getElementById("crumbs");
    try {
      if (m) {
        const reg = await OG.data.registry();
        const g = reg.find(x => x.id === m[1]);
        crumbs.innerHTML = `<a href="#/">Реестр</a> / ${OG.esc(g ? g.name : m[1])}`;
        document.title = (g ? g.name : "Граф") + " · НТИграф";
        await OG.graph.render(view, m[1], m[2] || "knowledge", params);
        // подсветка, оставшаяся с вкладки онтологии
        if (OG.graph.refIds && (m[2] || "knowledge") === "knowledge") {
          const ids = OG.graph.refIds;
          setTimeout(() => OG.graph.highlight(ids, `На графе ${ids.length} узлов из ответа`), 100);
        }
      } else {
        crumbs.innerHTML = "";
        document.title = "Реестр графов · НТИграф";
        if (OG.graph.cy) { OG.graph.cy.destroy(); OG.graph.cy = null; }
        OG.graph.refIds = null;
        await OG.registry.render(view);
      }
    } catch (e) {
      view.innerHTML = `<div class="empty">Не получилось открыть: ${OG.esc(e.message)}.${OG.static ? "" : "<br>Страницу нужно открывать через run.bat."}</div>`;
      console.error(e);
    }
  },

  async health() {
    const el = document.getElementById("srv");
    // опубликованная версия без сервера: только готовые ответы
    try {
      const st = await fetch("data/static.json");
      if (st.ok) {
        OG.static = true; OG.ask.serverOk = false;
        el.className = "srv"; el.innerHTML = `<span>Демо: готовые ответы</span>`;
        el.title = "В этой версии работают готовые вопросы. Свои вопросы доступны в полной версии с Claude.";
        return;
      }
    } catch (e) { /* нет файла, значит локальная версия */ }
    try {
      const r = await fetch("api/health");
      const d = await r.json();
      el.className = "srv ok"; el.innerHTML = `<span>Claude на связи</span>`;
      el.title = "Локальный сервер работает, модель: " + d.model;
      OG.ask.serverOk = true;
    } catch (e) {
      el.className = "srv bad"; el.innerHTML = `<span>Сервер не запущен</span>`;
      el.title = "Запусти run.bat";
      OG.ask.serverOk = false;
    }
  },
};

OG.theme.init();
window.addEventListener("hashchange", () => OG.app.route());
OG.app.health().then(() => OG.app.route());
