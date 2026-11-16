// Общие мелочи: экранирование, цвета, тема
window.OG = window.OG || {};

OG.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

OG.PALETTE = ["#5b8cff", "#2fbf8f", "#f2a93b", "#ef6b7b", "#a77bf3", "#4cc3e6", "#9bcf54", "#f0844f",
  "#d46fd0", "#8ea3c2", "#e3c84e", "#47d1a0", "#ff9eb5", "#6f7cff", "#c99a6b"];

OG.css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

OG.fmtDate = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d)) ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : (d || "");

OG.plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

OG.store = {
  get(k, d) { try { const v = localStorage.getItem("og." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("og." + k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
};

OG.theme = {
  init() {
    this.apply(OG.store.get("theme", "dark"));
    document.getElementById("themeBtn").onclick = () => {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      this.apply(t);
      OG.store.set("theme", t);
      OG.graph && OG.graph.restyle && OG.graph.restyle();
    };
  },
  apply(t) { document.documentElement.dataset.theme = t; },
};
