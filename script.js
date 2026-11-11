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
      renderList(loadEntries());
    });

    li.append(dateSpan, noteSpan, amountSpan, deleteBtn);
    listEl.appendChild(li);
  }
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

  renderList(entries);
  form.reset();
  dateInput.value = todayISO();
});

// ---------- Start ----------
dateInput.value = todayISO();
renderList(loadEntries());
