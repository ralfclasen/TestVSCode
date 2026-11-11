"use strict";


const STORAGE_KEY = "coffeeExpenses.v1";

// ---------- Persistenz (localStorage) ----------
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // kaputte Daten → leer starten statt Crash
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------- Formatierung ----------
const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatCents(cents) {
  return euroFormat.format(cents / 100);
}

function formatDate(isoDate) {
  // T00:00:00 anhängen, damit das Datum nicht eine Zeitzone verschoben wird
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// ---------- UI ----------
const form = document.getElementById("expense-form");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const noteInput = document.getElementById("note");
const listEl = document.getElementById("expense-list");
const emptyStateEl = document.getElementById("empty-state");
const statTotalEl = document.getElementById("stat-total");
const statMonthEl = document.getElementById("stat-month");
const statCountEl = document.getElementById("stat-count");
const statAvgEl = document.getElementById("stat-avg");
const chartCanvas = document.getElementById("cost-chart");
const chartTypeBtn = document.getElementById("chart-type-btn");

let costChart = null;
let chartType = "bar"; // "bar" | "line"

// Datum-Default: heute (lokale Zeit, nicht UTC!)
function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderList(entries) {
  listEl.innerHTML = "";
  emptyStateEl.hidden = entries.length > 0;

  // Neueste zuerst (bei gleichem Datum: zuletzt angelegte oben)
  const sorted = [...entries].sort((a, b) =>
    a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
  );

  for (const entry of sorted) {
    const li = document.createElement("li");
    li.className = "entry";

    const dateSpan = document.createElement("span");
    dateSpan.className = "entry-date";
    dateSpan.textContent = formatDate(entry.date);

    const noteSpan = document.createElement("span");
    noteSpan.className = "entry-note";
    noteSpan.textContent = entry.note || "";

    const amountSpan = document.createElement("span");
    amountSpan.className = "entry-amount";
    amountSpan.textContent = formatCents(entry.amountCents);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete";
    deleteBtn.title = "Eintrag löschen";
    deleteBtn.setAttribute("aria-label", `Eintrag vom ${formatDate(entry.date)} löschen`);
    deleteBtn.textContent = "\u00d7";
    deleteBtn.addEventListener("click", () => {
      saveEntries(loadEntries().filter((e) => e.id !== entry.id));
      renderAll(); // Liste, Statistik und Chart aktualisieren
    });

    li.append(dateSpan, noteSpan, amountSpan, deleteBtn);
    listEl.appendChild(li);
  }
}

// ---------- Statistiken & Chart ----------
const ACCENT = "#6f4e37";

function renderStats(entries) {
  const totalCents = entries.reduce((sum, e) => sum + e.amountCents, 0);

  // Kosten des laufenden Monats (Datum beginnt mit "JJJJ-MM")
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthCents = entries
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amountCents, 0);

  // Ø pro Tag: Gesamtsumme / Tage vom ältesten Eintrag bis heute (inklusive)
  let avgPerDay = null;
  if (entries.length > 0) {
    const oldest = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
    const days = Math.max(1, Math.round((Date.now() - new Date(oldest + "T00:00:00")) / 86400000) + 1);
    avgPerDay = totalCents / days;
  }

  statTotalEl.textContent = formatCents(totalCents);
  statMonthEl.textContent = formatCents(monthCents);
  statCountEl.textContent = String(entries.length);
  statAvgEl.textContent = avgPerDay === null ? "–" : euroFormat.format(avgPerDay / 100) + "/Tag";
}

function renderChart(entries) {
  // Tageskosten der letzten 14 Tage (ältester Tag links, heute rechts)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push({ iso: `${y}-${m}-${day}`, label: `${d.getDate()}.${d.getMonth() + 1}.` });
  }

  // Summen pro Tag aufaddieren (Tage ohne Eintrag bleiben 0)
  const totals = new Map(days.map((d) => [d.iso, 0]));
  for (const e of entries) {
    if (totals.has(e.date)) totals.set(e.date, totals.get(e.date) + e.amountCents);
  }

  costChart.data.labels = days.map((d) => d.label);
  costChart.data.datasets[0].data = days.map((d) => totals.get(d.iso) / 100);
  costChart.update();
}

function initChart() {
  const ctx = chartCanvas.getContext("2d");
  costChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Kosten (€)",
          data: [],
          backgroundColor: ACCENT + "cc", // Kaffee-Braun, 80 % Deckkraft
          borderColor: ACCENT,
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 26,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Höhe kommt aus .chart-wrapper
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => " " + euroFormat.format(item.parsed.y),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => v + " €" },
          grid: { color: "#eee5da" },
        },
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkipPadding: 8 },
        },
      },
    },
  });

  // Umschalten zwischen Balken- und Liniendiagramm
  chartTypeBtn.addEventListener("click", () => {
    chartType = chartType === "bar" ? "line" : "bar";
    costChart.config.type = chartType;

    const ds = costChart.data.datasets[0];
    if (chartType === "line") {
      ds.backgroundColor = ACCENT + "33"; // weiche Fläche unter der Linie
      ds.fill = true;
      ds.tension = 0.35;
      ds.pointRadius = 3;
      ds.borderRadius = undefined;
    } else {
      ds.backgroundColor = ACCENT + "cc";
      ds.fill = false;
      ds.tension = undefined;
      ds.pointRadius = undefined;
      ds.borderRadius = 4;
    }

    chartTypeBtn.textContent =
      chartType === "bar" ? "\u{1F4C8} Linie anzeigen" : "\u25AE Balken anzeigen";
    costChart.update();
  });
}

function renderAll() {
  const entries = loadEntries();
  renderList(entries);
  renderStats(entries);
  renderChart(entries);
}

// ---------- Formular-Submit ----------
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const amountValue = parseFloat(amountInput.value.replace(",", "."));
  const note = noteInput.value.trim();

  if (!date) {
    alert("Bitte ein Datum wählen.");
    return;
  }
  if (Number.isNaN(amountValue) || amountValue <= 0) {
    alert("Bitte einen Betrag größer als 0 eingeben.");
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    date,                 // "2026-01-15"
    amountCents: Math.round(amountValue * 100), // Cent → keine Float-Fehler
    note,
  };

  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);

  renderAll(); // Liste, Statistik und Chart aktualisieren
  form.reset();
  dateInput.value = todayISO();
});

// ---------- Start ----------
dateInput.value = todayISO();
initChart();
renderAll();
