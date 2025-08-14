/* Dynamic Quote Generator — Sync & Conflict Resolution
 * -----------------------------------------------
 * Features:
 * - Local storage persistence
 * - Import / Export JSON
 * - Filter by category
 * - Simulated server via JSONPlaceholder (GET/POST) + local "server shadow"
 * - Periodic syncing (pull + push)
 * - Conflict detection & resolution (server wins by default, manual override UI)
 */

(() => {
  // ----- Constants & Keys -----
  const LS_QUOTES = "dqg:quotes";
  const LS_PENDING = "dqg:pending";
  const LS_SERVER_SHADOW = "dqg:serverShadow";
  const LS_LAST_SYNC = "dqg:lastSync";

  const AUTO_SYNC_MS = 30_000; // 30s

  // JSONPlaceholder endpoints (mock server)
  const API_BASE = "https://jsonplaceholder.typicode.com";
  const API_LIST = `${API_BASE}/posts?_limit=6`;
  const API_CREATE = `${API_BASE}/posts`; // accepts POST; returns new id (fake)

  // ----- State -----
  let autoSyncTimer = null;
  let inFlight = false;
  let conflictsQueue = []; // array of { id, local, server }

  // ----- Utilities -----
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(c));
    return n;
  };
  const nowIso = () => new Date().toISOString();
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
  const uid = () => `loc-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  const readLS = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const writeLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  // ----- Data Shapes -----
  // Quote: { id, text, author, category, updatedAt, version, source: 'local'|'server' }

  const getQuotes = () => readLS(LS_QUOTES, []);
  const setQuotes = (arr) => writeLS(LS_QUOTES, arr);
  const getPending = () => readLS(LS_PENDING, []); // array of { op:'create'|'update'|'delete', quote }
  const setPending = (arr) => writeLS(LS_PENDING, arr);
  const getShadow = () => readLS(LS_SERVER_SHADOW, []); // last seen server list
  const setShadow = (arr) => writeLS(LS_SERVER_SHADOW, arr);
  const setLastSync = (iso) => localStorage.setItem(LS_LAST_SYNC, iso);
  const getLastSync = () => localStorage.getItem(LS_LAST_SYNC);

  // ----- UI: Notifications -----
  const notify = (msg) => {
    const bar = $("#notifier");
    $("#notify-text").textContent = msg;
    bar.classList.remove("hidden");
  };
  $("#notify-close").addEventListener("click", () => $("#notifier").classList.add("hidden"));

  // ----- UI: Render -----
  function render() {
    const list = $("#quote-list");
    const filter = $("#filter-category").value.trim().toLowerCase();
    const quotes = getQuotes().filter(q => !filter || (q.category || "").toLowerCase().includes(filter));

    list.innerHTML = "";
    if (quotes.length === 0) $("#empty-state").style.display = "block";
    else $("#empty-state").style.display = "none";

    quotes
      .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach(q => {
        const li = el("li", { class: "quote-item" });

        const left = el("div", {}, [
          el("div", { class: "text" }, [document.createTextNode(q.text)]),
          el("div", { class: "meta" }, [
            document.createTextNode(`— ${q.author || "Unknown"} · ${q.category || "Uncategorized"} · Updated ${fmt(q.updatedAt)}`),
          ]),
          el("div", {}, [
            el("span", { class: `tag ${q.source === 'server' ? 'server' : 'local'}` , text: q.source }),
            ...(q._conflict ? [el("span", { class: "tag conflict", text: "conflict" })] : []),
          ])
        ]);

        const actions = el("div", { class: "actions" }, [
          el("button", { class: "secondary", text: "Edit", onClick: () => loadForEdit(q.id) }),
          el("button", { class: "secondary", text: "Delete", onClick: () => deleteQuote(q.id) }),
          ...(q._conflict ? [el("button", { text: "Resolve", onClick: () => openConflictModal(q.id) })] : [])
        ]);

        li.appendChild(left);
        li.appendChild(actions);
        list.appendChild(li);
      });

    $("#last-sync").textContent = `Last sync: ${fmt(getLastSync())}`;
  }

  function loadForEdit(id) {
    const q = getQuotes().find(x => x.id === id);
    if (!q) return;
    $("#quote-id").value = q.id;
    $("#quote-text").value = q.text;
    $("#quote-author").value = q.author;
    $("#quote-category").value = q.category || "";
    $("#quote-text").focus();
  }

  function clearForm() {
    $("#quote-id").value = "";
    $("#quote-text").value = "";
    $("#quote-author").value = "";
    $("#quote-category").value = "";
  }

  // ----- CRUD (Local) -----
  function upsertLocal(quote, markPending = true) {
    const list = getQuotes();
    const idx = list.findIndex(x => x.id === quote.id);
    const newQuote = {
      ...quote,
      updatedAt: nowIso(),
      version: (quote.version ?? 0) + 1,
      source: quote.source || (quote.id.startsWith("srv-") ? "server" : "local"),
    };
    if (idx >= 0) list[idx] = newQuote;
    else list.push(newQuote);
    setQuotes(list);

    if (markPending) {
      const p = getPending();
      const op = idx >= 0 ? "update" : "create";
      p.push({ op, quote: newQuote });
      setPending(p);
    }
    render();
    return newQuote;
  }

  function deleteQuote(id, markPending = true) {
    const list = getQuotes();
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return;
    const [removed] = list.splice(idx, 1);
    setQuotes(list);

    if (markPending) {
      const p = getPending();
      p.push({ op: "delete", quote: removed });
      setPending(p);
    }
    render();
    notify("Quote deleted locally. Will be reconciled on next sync.");
  }

  // ----- Form handlers -----
  $("#quote-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#quote-id").value || uid();
    const text = $("#quote-text").value.trim();
    const author = $("#quote-author").value.trim();
    const category = $("#quote-category").value.trim();

    if (!text || !author) return;

    upsertLocal({ id, text, author, category, source: id.startsWith("srv-") ? "server" : "local" });
    clearForm();
    notify("Saved locally. Auto-sync will push your change shortly.");
  });

  $("#btn-cancel").addEventListener("click", clearForm);

  // Filter
  $("#filter-category").addEventListener("input", render);

  // Export
  $("#btn-export").addEventListener("click", () => {
    const data = {
      quotes: getQuotes(),
      exportedAt: nowIso(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `quotes-export-${Date.now()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Import
  $("#input-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json.quotes)) throw new Error("Invalid export format.");
      setQuotes(json.quotes);
      notify("Imported quotes. They’ll be reconciled with the server on next sync.");
      render();
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  // Clickable import label
  document.querySelector(".import-btn").addEventListener("click", () => $("#input-import").click());

  // ----- Server Simulation (Pull) -----
  async function fetchServerQuotes() {
    // We map JSONPlaceholder posts -> quotes
    const res = await fetch(API_LIST);
    const posts = await res.json();
    // Map to our quote shape; prefix IDs to avoid collision with local ids
    const serverQuotes = posts.map(p => ({
      id: `srv-${p.id}`,
      text: capitalize(p.title || "untitled"),
      author: (`User ${p.userId}`),
      category: "Server",
      updatedAt: nowIso(),  // JSONPlaceholder lacks timestamps; we assign fetch time
      version: 1,
      source: "server",
    }));
    return serverQuotes;
  }

  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ----- Sync Engine -----
  async function syncNow({ silent = false } = {}) {
    if (inFlight) return; // avoid overlapping syncs
    inFlight = true;
    try {
      // 1) Pull server
      const server = await fetchServerQuotes();
      const shadow = getShadow();
      const local = getQuotes();
      const pending = getPending();

      // Index helpers
      const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
      const sIdx = byId(server);
      const shIdx = byId(shadow);
      const lIdx = byId(local);

      // 2) Detect server changes vs shadow
      const newLocal = [...local];
      conflictsQueue = [];

      for (const srv of server) {
        const inShadow = shIdx[srv.id];
        const inLocal = lIdx[srv.id];

        if (!inShadow && !inLocal) {
          // brand-new from server
          newLocal.push(srv);
          if (!silent) notify("New quote fetched from server.");
        } else if (!inShadow && inLocal) {
          // Server has item we also have locally (first time seeing on server)
          // Compare updatedAt if exists; treat as conflict if local has pending edits
          const hasPending = pending.some(p => p.quote.id === srv.id);
          if (hasPending) {
            markConflict(newLocal, srv.id);
          } else {
            // Server wins by default
            replaceLocal(newLocal, srv);
            if (!silent) notify("Server updated a quote; applied (server-wins).");
          }
        } else if (inShadow && !inLocal) {
          // Previously known from server but locally deleted — treat as server-wins (re-add)
          newLocal.push(srv);
          if (!silent) notify("Re-added server quote that was missing locally (server-wins).");
        } else {
          // Exists in both local and shadow; check if changed on server vs shadow
          const serverChanged = JSON.stringify(srv) !== JSON.stringify(inShadow);
          if (serverChanged) {
            const hasLocalPending = pending.some(p => p.quote.id === srv.id);
            if (hasLocalPending) {
              // Conflict: both changed since last sync
              markConflict(newLocal, srv.id);
              conflictsQueue.push({ id: srv.id, local: inLocal, server: srv });
              if (!silent) notify("Conflict detected. Server wins automatically; you can review.");
              // Apply server-wins immediately (auto) but mark conflict for user to review/revert
              replaceLocal(newLocal, srv, { markConflict: true });
            } else {
              // No local edits; accept server
              replaceLocal(newLocal, srv);
              if (!silent) notify("Server changes applied.");
            }
          }
        }
      }

      // 3) Optionally (simulation) — if local has items not on server (with srv- prefix),
      // keep them; for non-srv (pure local), we will POST them.
      setQuotes(newLocal);
      setShadow(server);
      setLastSync(nowIso());
      render();

      // 4) Push local pending changes (create/update/delete)
      await pushPending();

    } catch (err) {
      console.error(err);
      notify("Sync failed. Check your connection and try again.");
    } finally {
      inFlight = false;
    }
  }

  function replaceLocal(list, srv, { markConflict = false } = {}) {
    const idx = list.findIndex(x => x.id === srv.id);
    if (idx >= 0) list[idx] = { ...srv, _conflict: markConflict || false };
    else list.push({ ...srv, _conflict: markConflict || false });
  }

  function markConflict(list, id) {
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx]._conflict = true;
  }

  async function pushPending() {
    const pending = getPending();
    if (pending.length === 0) return;

    // We’ll simulate server by POSTing creates and ignoring updates/deletes (JSONPlaceholder doesn’t persist),
    // then updating our local "server shadow" to match so the UI stays consistent.
    const shadow = getShadow();
    const newShadow = [...shadow];

    for (const item of pending) {
      const { op, quote } = item;
      if (op === "create") {
        // If it's a local-only quote, pretend we create it on server and assign a "server id"
        if (!quote.id.startsWith("srv-")) {
          const res = await fetch(API_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: quote.text, body: quote.text, userId: 1 }),
          });
          const json = await res.json();
          // Assign a fake server id to "promote" this local quote to server-managed
          const newId = `srv-${json.id ?? Math.floor(Math.random()*1000)+200}`;
          // Update local & shadow with server identity
          promoteLocalToServer(quote.id, newId);
          const promoted = getQuotes().find(q => q.id === newId);
          newShadow.push({ ...promoted, source: "server" });
        } else {
          // Already server-sourced; shadow should include it
          const idx = newShadow.findIndex(s => s.id === quote.id);
          if (idx >= 0) newShadow[idx] = quote;
          else newShadow.push(quote);
        }
      } else if (op === "update") {
        // For simulation: POST a no-op to mimic activity; then mirror to shadow
        await fetch(API_CREATE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: quote.text, body: quote.text, userId: 1 }),
        });
        const idx = newShadow.findIndex(s => s.id === quote.id);
        if (idx >= 0) newShadow[idx] = quote;
        else newShadow.push(quote);
      } else if (op === "delete") {
        // For simulation: shadow removes it if present
        const idx = newShadow.findIndex(s => s.id === quote.id);
        if (idx >= 0) newShadow.splice(idx, 1);
      }
    }

    setShadow(newShadow);
    setPending([]); // clear the queue
    setLastSync(nowIso());
    render();
  }

  function promoteLocalToServer(oldId, newId) {
    // Update quotes list
    const list = getQuotes();
    const idx = list.findIndex(x => x.id === oldId);
    if (idx < 0) return;
    list[idx] = {
      ...list[idx],
      id: newId,
      source: "server",
      updatedAt: nowIso(),
      version: (list[idx].version ?? 0) + 1
    };
    setQuotes(list);

    // Update pending queue to refer to new id
    const pending = getPending().map(p => {
      if (p.quote.id === oldId) {
        return { ...p, quote: { ...p.quote, id: newId, source: "server" } };
      }
      return p;
    });
    setPending(pending);
  }

  // ----- Conflict Modal (Manual Resolution) -----
  function openConflictModal(id) {
    const local = getQuotes().find(q => q.id === id);
    const server = getShadow().find(s => s.id === id) || local; // fallback
    if (!local || !server) return;

    $("#conflict-quote-id").value = id;
    $("#local-text").textContent = local.text || "";
    $("#local-author").textContent = local.author || "";
    $("#local-category").textContent = local.category || "";
    $("#local-updated").textContent = fmt(local.updatedAt);

    $("#server-text").textContent = server.text || "";
    $("#server-author").textContent = server.author || "";
    $("#server-category").textContent = server.category || "";
    $("#server-updated").textContent = fmt(server.updatedAt);

    $("#conflict-modal").showModal();
  }

  // Keep Server (default)
  $("#btn-keep-server").addEventListener("click", (e) => {
    e.preventDefault();
    const id = $("#conflict-quote-id").value;
    const server = getShadow().find(s => s.id === id);
    if (!server) return $("#conflict-modal").close();
    // Apply server version locally
    const list = getQuotes();
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = { ...server, _conflict: false };
    else list.push({ ...server, _conflict: false });
    setQuotes(list);
    // Remove any pending changes for this id (server-wins)
    const pending = getPending().filter(p => p.quote.id !== id);
    setPending(pending);
    render();
    $("#conflict-modal").close();
    notify("Conflict resolved: kept server version.");
  });

  // Keep Local (override)
  $("#btn-keep-local").addEventListener("click", async (e) => {
    e.preventDefault();
    const id = $("#conflict-quote-id").value;
    const local = getQuotes().find(q => q.id === id);
    if (!local) return $("#conflict-modal").close();

    // Queue an update so pushPending mirrors shadow to our local version
    const p = getPending();
    p.push({ op: "update", quote: { ...local, _conflict: false } });
    setPending(p);

    // Also clear conflict tag locally
    const list = getQuotes();
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx]._conflict = false;
    setQuotes(list);

    render();
    $("#conflict-modal").close();
    notify("Conflict resolved: kept local version. Will be pushed on next sync.");
  });

  $("#btn-conflict-cancel").addEventListener("click", (e) => {
    e.preventDefault();
    $("#conflict-modal").close();
  });

  // ----- Buttons: Sync & Simulate Server Update -----
  $("#btn-sync-now").addEventListener("click", () => syncNow());

  $("#toggle-auto-sync").addEventListener("change", (e) => {
    if (e.target.checked) startAutoSync();
    else stopAutoSync();
  });

  $("#btn-sim-server").addEventListener("click", () => {
    // Create artificial server-side edits to a random server quote to provoke conflicts
    const serverish = getQuotes().filter(q => q.id.startsWith("srv-"));
    if (serverish.length === 0) {
      notify("No server quotes yet. Click “Sync now” first.");
      return;
    }
    const target = serverish[Math.floor(Math.random() * serverish.length)];
    // mutate shadow to simulate remote change
    const shadow = getShadow();
    const idx = shadow.findIndex(s => s.id === target.id);
    const mutated = {
      ...(idx >= 0 ? shadow[idx] : target),
      text: mutateText((idx >= 0 ? shadow[idx].text : target.text)),
      updatedAt: nowIso(),
      version: ((idx >= 0 ? shadow[idx].version : target.version) ?? 1) + 1,
    };
    if (idx >= 0) shadow[idx] = mutated; else shadow.push(mutated);
    setShadow(shadow);
    notify("Simulated a server-side edit. Run sync to reconcile.");
  });

  function mutateText(s) {
    const extras = ["(edited on server)", "— remote update", " [srv*]", " (v2)"];
    return `${s} ${extras[Math.floor(Math.random() * extras.length)]}`;
  }

  // ----- Auto Sync -----
  function startAutoSync() {
    stopAutoSync();
    autoSyncTimer = setInterval(() => syncNow({ silent: true }), AUTO_SYNC_MS);
  }
  function stopAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  // ----- Bootstrap -----
  function seedIfEmpty() {
    if (getQuotes().length === 0) {
      const sample = [
        { id: uid(), text: "Stay hungry, stay foolish.", author: "Steve Jobs", category: "Inspiration", updatedAt: nowIso(), version: 1, source: "local" },
        { id: uid(), text: "What you do today can improve all your tomorrows.", author: "Ralph Marston", category: "Motivation", updatedAt: nowIso(), version: 1, source: "local" }
      ];
      setQuotes(sample);
    }
    // Initialize server shadow if none
    if (!getShadow().length) setShadow([]);
  }

  function init() {
    seedIfEmpty();
    render();
    startAutoSync();
  }

  document.addEventListener("DOMContentLoaded", init);
})();