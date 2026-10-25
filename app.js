const $ = (s) => document.querySelector(s);

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem("settle-up"));
    if (s && Array.isArray(s.people)) return s;
  } catch (e) {}
  return { people: [], expenses: [] };
}
function save() {
  try { localStorage.setItem("settle-up", JSON.stringify(state)); } catch (e) {}
}

const money = (c) => (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// work in whole cents so nothing drifts
function balances() {
  const net = {};
  state.people.forEach((p) => (net[p] = 0));
  state.expenses.forEach((e) => {
    const n = e.split.length;
    if (!n) return;
    const base = Math.floor(e.cents / n);
    let extra = e.cents - base * n;
    net[e.payer] += e.cents;
    e.split.forEach((p) => {
      net[p] -= base + (extra-- > 0 ? 1 : 0);
    });
  });
  return net;
}

// repeatedly match the biggest debtor with the biggest creditor
function transfers(net) {
  const debt = [], credit = [];
  Object.entries(net).forEach(([p, v]) => {
    if (v < 0) debt.push([p, -v]);
    else if (v > 0) credit.push([p, v]);
  });
  const out = [];
  while (debt.length && credit.length) {
    debt.sort((a, b) => b[1] - a[1]);
    credit.sort((a, b) => b[1] - a[1]);
    const amt = Math.min(debt[0][1], credit[0][1]);
    out.push({ from: debt[0][0], to: credit[0][0], cents: amt });
    debt[0][1] -= amt;
    credit[0][1] -= amt;
    if (!debt[0][1]) debt.shift();
    if (!credit[0][1]) credit.shift();
  }
  return out;
}

function render() {
  const used = new Set();
  state.expenses.forEach((e) => { used.add(e.payer); e.split.forEach((p) => used.add(p)); });

  $("#people").innerHTML = state.people.map((p) =>
    `<span class="chip">${esc(p)}<button data-del-person="${esc(p)}" ${used.has(p) ? "disabled title='used in an expense'" : ""}>×</button></span>`
  ).join("") || `<span class="empty">Nobody yet.</span>`;

  $("#payer").innerHTML = state.people.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#split").innerHTML = state.people.map((p) =>
    `<label><input type="checkbox" value="${esc(p)}" checked style="width:auto;margin:0"> ${esc(p)}</label>`).join("");

  const net = balances();
  const list = transfers(net);
  $("#transfers").innerHTML = list.length
    ? list.map((t) => `<div class="transfer"><b>${esc(t.from)}</b><span class="arrow">pays</span><b>${esc(t.to)}</b><b class="amt">${money(t.cents)}</b></div>`).join("")
    : `<p class="empty">${state.expenses.length ? "Everyone is square." : "Add some expenses to see who pays whom."}</p>`;

  const max = Math.max(1, ...Object.values(net).map(Math.abs));
  $("#balances").innerHTML = state.people.map((p) => {
    const v = net[p] || 0;
    const w = (Math.abs(v) / max) * 50;
    const bar = v >= 0 ? `left:50%;width:${w}%;background:var(--get)` : `right:50%;width:${w}%;background:var(--owe)`;
    return `<div class="bal"><span>${esc(p)}</span><div class="bar"><i style="${bar}"></i></div><span class="v ${v >= 0 ? "pos" : "neg"}">${v > 0 ? "+" : ""}${money(v)}</span></div>`;
  }).join("") || `<p class="empty">—</p>`;

  $("#expenses").innerHTML = state.expenses.map((e, i) =>
    `<li><span>${esc(e.what)}<small>${esc(e.payer)} paid · split ${e.split.length === state.people.length ? "equally" : "between " + e.split.map(esc).join(", ")}</small></span><b>${money(e.cents)}</b><button data-del-exp="${i}" title="remove">×</button></li>`
  ).join("") || `<li class="empty">Nothing yet.</li>`;
}

$("#person-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#person").value.trim();
  if (name && !state.people.includes(name)) { state.people.push(name); save(); }
  $("#person").value = "";
  render();
});

$("#exp-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const cents = Math.round(parseFloat($("#amount").value) * 100);
  const split = [...document.querySelectorAll("#split input:checked")].map((c) => c.value);
  if (!cents || !split.length || !$("#payer").value) return;
  state.expenses.push({ what: $("#what").value.trim(), cents, payer: $("#payer").value, split });
  save();
  $("#what").value = ""; $("#amount").value = "";
  render();
});

document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-del-person]");
  if (p && !p.disabled) { state.people = state.people.filter((x) => x !== p.dataset.delPerson); save(); render(); }
  const x = e.target.closest("[data-del-exp]");
  if (x) { state.expenses.splice(Number(x.dataset.delExp), 1); save(); render(); }
});

$("#example").addEventListener("click", () => {
  const all = ["Amina", "Brian", "Chao", "Dee"];
  state = {
    people: all,
    expenses: [
      { what: "Cabin, 3 nights", cents: 48000, payer: "Amina", split: all },
      { what: "Groceries", cents: 13650, payer: "Brian", split: all },
      { what: "Fuel", cents: 8200, payer: "Chao", split: ["Chao", "Amina", "Brian"] },
      { what: "Boat trip", cents: 9600, payer: "Dee", split: ["Dee", "Chao"] },
      { what: "Dinner out", cents: 15430, payer: "Amina", split: all },
    ],
  };
  save(); render();
});

render();
