// Загрузка и разбор данных графов
OG.data = {
  _graphs: {},

  async json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Не загрузилось: " + url);
    return r.json();
  },

  async registry() { return this._reg || (this._reg = await this.json("data/registry.json")); },
  async scenarios() { return this._sc || (this._sc = await this.json("data/scenarios.json")); },

  async graph(id) {
    if (this._graphs[id]) return this._graphs[id];
    const [meta, ents, tri, onto] = await Promise.all(
      ["meta", "entities", "triples", "ontology"].map(p => this.json(`data/${id}/${p}.json`)));
    return (this._graphs[id] = this.build(meta.graph, ents.entities, tri.triples, onto));
  },

  build(meta, entities, triples, onto) {
    // классы и области
    const classes = {};
    const areas = {};
    (onto.classes || []).forEach(c => {
      const ar = (c.subjectAreas || []).map(a => a.name);
      classes[c.code] = { code: c.code, name: c.name, comment: c.comment || "", attributes: c.attributes || [],
        areas: ar, subclasses: c.subclasses || [], count: 0 };
      ar.forEach(a => { areas[a] = areas[a] || { name: a, classes: [] }; areas[a].classes.push(c.code); });
    });
    // если областей нет, красим по классам
    const byClass = Object.keys(areas).length === 0;
    const groups = byClass
      ? Object.values(classes).map(c => ({ key: c.code, name: c.name }))
      : Object.keys(areas).map(a => ({ key: a, name: a }));
    groups.forEach((g, i) => { g.color = OG.PALETTE[i % OG.PALETTE.length]; g.count = 0; });
    const groupOf = code => {
      const c = classes[code];
      if (!c) return null;
      return byClass ? c.code : (c.areas[0] || null);
    };
    const gIndex = Object.fromEntries(groups.map(g => [g.key, g]));
    const other = { key: "_other", name: "Прочее", color: "#8a93a8", count: 0 };

    // сущности
    const nodes = {};
    entities.forEach(e => {
      if (e.isClass) return;
      const gk = groupOf(e.classCode);
      const g = gIndex[gk] || other;
      g.count++;
      if (classes[e.classCode]) classes[e.classCode].count++;
      nodes[e.id] = { id: e.id, label: e.label, cls: e.classCode, clsName: classes[e.classCode]?.name || e.classCode || "",
        group: g.key, color: g.color, out: [], inc: [], deg: 0 };
    });
    if (other.count) groups.push(other), gIndex._other = other;

    // связи (без «имеет тип»: тип показан цветом и в карточке)
    const edges = [];
    triples.forEach(t => {
      if (t.predicate === "имеет тип") return;
      const s = nodes[t.subject], o = nodes[t.object];
      if (!s || !o) return;
      const e = { id: t.id, s: t.subject, o: t.object, p: t.predicate, src: t.sourceName || "" };
      edges.push(e);
      s.out.push(e); o.inc.push(e); s.deg++; o.deg++;
    });
    // ранги для подписей: крупные узлы подписаны всегда
    Object.values(nodes).sort((a, b) => b.deg - a.deg).forEach((n, i) => { n.rank = i; });

    // онтология: связи между классами
    const relations = (onto.relations || []).map(r => ({ code: r.code, name: r.name, comment: r.comment || "", from: r.fromClass, to: r.toClass }));

    return { meta, classes, groups, gIndex, byClass, nodes, edges, relations, info: onto.info || {} };
  },
};
