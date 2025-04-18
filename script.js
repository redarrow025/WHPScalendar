// script.js

document.addEventListener('DOMContentLoaded', async () => {

  document.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const circle = document.createElement("span");
      circle.classList.add("ripple");
      const d = Math.max(btn.clientWidth, btn.clientHeight);
      circle.style.width = circle.style.height = d + "px";
      circle.style.left = e.clientX - btn.getBoundingClientRect().left - d/2 + "px";
      circle.style.top  = e.clientY - btn.getBoundingClientRect().top - d/2 + "px";
      btn.appendChild(circle);
      setTimeout(()=> circle.remove(), 600);
    });
  });
  
  // ─── Firebase Setup ─────────────────────────────────────────────
  const EVENT_KEY = "whps_events";
  const ACT_KEY   = "whps_activities";
  const PEER_KEY  = "whps_peers";
  const LOC_KEY   = "whps_locations";

  const db = firebase.firestore();

  const load = async (key) => {
    const snapshot = await db.collection(key).get();
    return snapshot.docs.map(doc => doc.data().name);
  };

  const save = async (key, arr) => {
    const colRef = db.collection(key);
    const batch = db.batch();
    const docs = await colRef.get();
    docs.forEach(doc => batch.delete(doc.ref));
    arr.forEach(item => {
      const docRef = colRef.doc();
      batch.set(docRef, { name: item });
    });
    await batch.commit();
  };

  // ─── Load Data from Firestore ───────────────────────────────────
  let activities = await load(ACT_KEY);
  let peers = await load(PEER_KEY);
  let locations = await load(LOC_KEY);

  // ─── UI Utilities ───────────────────────────────────────────────
  function populateSelect(id, items, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    if (!sel.multiple) {
      const ph = document.createElement("option");
      ph.textContent = `-- ${placeholder} --`;
      ph.disabled = true;
      ph.selected = true;
      sel.appendChild(ph);
    }
    items.forEach(item => {
      const o = document.createElement("option");
      o.value = o.textContent = item;
      sel.appendChild(o);
    });
  }

  function renderList(id, items, onRemove) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = "";
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.textContent = it;
      const btn = document.createElement("button");
      btn.textContent = "×";
      btn.className   = "remove-btn";
      btn.onclick     = () => onRemove(i);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function refreshOptionsUI() {
    populateSelect("activitySelect", activities, "Activity");
    renderPeerToggles(peers);
    populateSelect("locationSelect",  locations,  "Location");

    renderList("listActivities", activities, async (idx) => {
      activities.splice(idx, 1);
      await save(ACT_KEY, activities);
      refreshOptionsUI();
    });
    renderList("listPeers", peers, async (idx) => {
      peers.splice(idx, 1);
      await save(PEER_KEY, peers);
      refreshOptionsUI();
    });
    renderList("listLocations", locations, async (idx) => {
      locations.splice(idx, 1);
      await save(LOC_KEY, locations);
      refreshOptionsUI();
    });
  }

  refreshOptionsUI();

  // ─── Manage Option Buttons ──────────────────────────────────────
  const addActivityBtn = document.getElementById("addActivityBtn");
  if (addActivityBtn) {
    addActivityBtn.onclick = async () => {
      const v = document.getElementById("newActivity").value.trim();
      if (!v) return alert("Enter an activity");
      activities.push(v);
      await save(ACT_KEY, activities);
      document.getElementById("newActivity").value = "";
      refreshOptionsUI();
    };
  }

  const addPeerBtn = document.getElementById("addPeerBtn");
  if (addPeerBtn) {
    addPeerBtn.onclick = async () => {
      const v = document.getElementById("newPeer").value.trim();
      if (!v) return alert("Enter a peer");
      peers.push(v);
      await save(PEER_KEY, peers);
      document.getElementById("newPeer").value = "";
      refreshOptionsUI();
    };
  }

  function renderPeerToggles(peers) {
    const container = document.getElementById("peerContainer");
    if (!container) return;
    container.innerHTML = "";
    peers.forEach(name => {
      // build: <label class="peer-item">
      //          <input type="checkbox" class="peer-checkbox" value="name">
      //          <span class="peer-circle"></span>
      //          <span class="peer-name">name</span>
      //        </label>
      const label = document.createElement("label");
      label.className = "peer-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "peer-checkbox";
      cb.value = name;
      const circle = document.createElement("span");
      circle.className = "peer-circle";
      const txt = document.createElement("span");
      txt.className = "peer-name";
      txt.textContent = name;
      label.append(cb, circle, txt);
      container.appendChild(label);
    });
  }
  

  const addLocationBtn = document.getElementById("addLocationBtn");
  if (addLocationBtn) {
    addLocationBtn.onclick = async () => {
      const v = document.getElementById("newLocation").value.trim();
      if (!v) return alert("Enter a location");
      locations.push(v);
      await save(LOC_KEY, locations);
      document.getElementById("newLocation").value = "";
      refreshOptionsUI();
    };
  }

  // ─── Event Form Logic ───────────────────────────────────────────
  const addEventBtn = document.getElementById("addEventBtn");
  if (addEventBtn) {
    addEventBtn.onclick = async () => {
      const get = id => document.getElementById(id);
      const activity = get("activitySelect").value;
      const who = Array.from(
        document.querySelectorAll(".peer-checkbox:checked")
      ).map(cb => cb.value);      
      const location = get("locationSelect").value;
      const date     = get("date").value;
      const start    = get("start").value;
      const end      = get("end").value;

      if (!activity || !who.length || !location || !date || !start || !end) {
        return alert("Please complete all fields");
      }
      if (end <= start) {
        return alert("End must be after start");
      }

      const evts = await load(EVENT_KEY);
      evts.push({ id: Date.now().toString(), activity, who, location, date, start, end });
      await save(EVENT_KEY, evts);

      get("activitySelect").selectedIndex = 0;
      get("peerSelect").selectedIndex = -1;
      get("locationSelect").selectedIndex = 0;
      ["date","start","end"].forEach(id => get(id).value = "");

      alert("Event added ✔️");
    };
  }

  // ─── Calendar Logic ─────────────────────────────────────────────
  const calendarEl = document.getElementById("calendar");
  let calendar;

  const padNum = n => n.toString().padStart(2, "0");
  const to12 = t => {
    let [h,m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    h = ((h + 11) % 12) + 1;
    return `${h}:${padNum(m)} ${ap}`;
  };

  async function initCalendar(viewType, useResources = false) {
    if (!calendarEl) return;
    calendarEl.classList.remove("hidden");
    if (calendar) calendar.destroy();

    const formDate = document.getElementById("date")?.value;
    const initialDate = formDate || new Date().toISOString().slice(0,10);

    const stored = await load(EVENT_KEY);
    const fcEvents = stored.map(ev => {
      const whoList = Array.isArray(ev.who) ? ev.who : [ev.who];
      return {
        id: ev.id,
        title: `${ev.activity} – ${whoList.join(", ")}`,
        start: `${ev.date}T${ev.start}`,
        end: `${ev.date}T${ev.end}`,
        resourceIds: useResources ? whoList : undefined,
        extendedProps: { ...ev, who: whoList }
      };
    });

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: useResources ? "resourceTimelineDay" : viewType,
      initialDate,
      headerToolbar: {
        left: "prev",
        center: "title",
        right: "next"
      },
      slotMinTime: "07:00:00",
      slotMaxTime: "18:00:00",
      slotDuration: "00:30:00",
      navLinks: true,
      editable: true,
      resources: useResources ? peers.map(p => ({ id: p, title: p })) : undefined,
      events: fcEvents,

      eventClick: async info => {
        const ep = info.event.extendedProps;
        const whoList = ep.who;
        const msg =
          `Activity: ${ep.activity}\n` +
          `Who:      ${whoList.join(", ")}\n` +
          `Location: ${ep.location}\n` +
          `Date:     ${ep.date}\n` +
          `Time:     ${to12(ep.start)} – ${to12(ep.end)}\n\n` +
          `OK to delete, Cancel to keep.`;
        if (confirm(msg)) {
          const allEvents = await load(EVENT_KEY);
          const updated = allEvents.filter(e => e.id !== info.event.id);
          await save(EVENT_KEY, updated);
          info.event.remove();
        }
      },

      eventDidMount: info => {
        const loc = info.event.extendedProps.location;
        info.el.querySelector(".fc-event-title")
                .insertAdjacentHTML("beforeend",
                  `<div style="font-size:.8em;color:#555">${loc}</div>`);
      }
    });

    calendar.render();
  }

  // ─── Calendar Controls ──────────────────────────────────────────
  const showDayBtn   = document.getElementById("showDayBtn");
  const showWeekBtn  = document.getElementById("showWeekBtn");
  const showPeerBtn  = document.getElementById("showPeerBtn");

  if (showDayBtn)  showDayBtn.onclick  = () => initCalendar("timeGridDay", false);
  if (showWeekBtn) showWeekBtn.onclick = () => initCalendar("timeGridWeek", false);
  if (showPeerBtn) showPeerBtn.onclick = () => initCalendar("resourceTimelineDay", true);
});
