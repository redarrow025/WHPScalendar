// script.js

document.addEventListener('DOMContentLoaded', () => {
  // ─── Shared storage helpers ────────────────────────────────────────
  const EVENT_KEY = "whps_events";
  const ACT_KEY   = "whps_activities";
  const PEER_KEY  = "whps_peers";
  const LOC_KEY   = "whps_locations";

  const load = key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  };
  const save = (key, arr) => {
    localStorage.setItem(key, JSON.stringify(arr));
  };


// Activities

let  activities = load(ACT_KEY);
let  peers = load(PEER_KEY);
let locations = load(LOC_KEY)


  // ─── UI helper functions ─────────────────────────────────────────────
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
    populateSelect("peerSelect",      peers,      "Who");
    populateSelect("locationSelect",  locations,  "Location");

    renderList("listActivities", activities, idx => {
      activities.splice(idx, 1);
      save(ACT_KEY, activities);
      refreshOptionsUI();
    });
    renderList("listPeers", peers, idx => {
      peers.splice(idx, 1);
      save(PEER_KEY, peers);
      refreshOptionsUI();
    });
    renderList("listLocations", locations, idx => {
      locations.splice(idx, 1);
      save(LOC_KEY, locations);
      refreshOptionsUI();
    });
  }

  // run once on load
  refreshOptionsUI();

  // ─── Manage‑options page handlers ────────────────────────────────────
  const addActivityBtn = document.getElementById("addActivityBtn");
  if (addActivityBtn) {
    addActivityBtn.onclick = () => {
      const v = document.getElementById("newActivity").value.trim();
      if (!v) return alert("Enter an activity");
      activities.push(v);
      save(ACT_KEY, activities);
      document.getElementById("newActivity").value = "";
      refreshOptionsUI();
    };
  }

  const addPeerBtn = document.getElementById("addPeerBtn");
  if (addPeerBtn) {
    addPeerBtn.onclick = () => {
      const v = document.getElementById("newPeer").value.trim();
      if (!v) return alert("Enter a peer");
      peers.push(v);
      save(PEER_KEY, peers);
      document.getElementById("newPeer").value = "";
      refreshOptionsUI();
    };
  }

  const addLocationBtn = document.getElementById("addLocationBtn");
  if (addLocationBtn) {
    addLocationBtn.onclick = () => {
      const v = document.getElementById("newLocation").value.trim();
      if (!v) return alert("Enter a location");
      locations.push(v);
      save(LOC_KEY, locations);
      document.getElementById("newLocation").value = "";
      refreshOptionsUI();
    };
  }

  // ─── Event‑form page handler ────────────────────────────────────────
  const addEventBtn = document.getElementById("addEventBtn");
  if (addEventBtn) {
    addEventBtn.onclick = () => {
      const get = id => document.getElementById(id);
      const activity = get("activitySelect").value;
      const who      = Array.from(get("peerSelect").selectedOptions).map(o => o.value);
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
      const evts = load(EVENT_KEY);
      evts.push({ id: Date.now().toString(), activity, who, location, date, start, end });
      save(EVENT_KEY, evts);

      // reset form
      get("activitySelect").selectedIndex = 0;
      get("peerSelect").selectedIndex      = -1;
      get("locationSelect").selectedIndex = 0;
      ["date","start","end"].forEach(id => get(id).value = "");
      alert("Event added ✔️");
    };
  }

  // ─── Calendar setup (Home & schedule pages) ─────────────────────────
  const calendarEl = document.getElementById("calendar");
  let calendar;

  const padNum = n => n.toString().padStart(2, "0");
  const to12    = t => {
    let [h,m] = t.split(":").map(Number);
    const ap  = h >= 12 ? "PM" : "AM";
    h = ((h + 11) % 12) + 1;
    return `${h}:${padNum(m)} ${ap}`;
  };

  function initCalendar(viewType, useResources = false) {
    if (!calendarEl) return;
    calendarEl.classList.remove("hidden");
    if (calendar) calendar.destroy();

    const formDate    = document.getElementById("date")?.value;
    const initialDate = formDate || new Date().toISOString().slice(0,10);

    const stored = load(EVENT_KEY);
    const fcEvents = stored.map(ev => {
      const whoList = Array.isArray(ev.who) ? ev.who : [ev.who];
      return {
        id:          ev.id,
        title:       `${ev.activity} – ${whoList.join(", ")}`,
        start:       `${ev.date}T${ev.start}`,
        end:         `${ev.date}T${ev.end}`,
        resourceIds: useResources ? whoList : undefined,
        extendedProps: { ...ev, who: whoList }
      };
    });

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView:  useResources ? "resourceTimelineDay" : viewType,
      initialDate,
      headerToolbar: {
        left:  "prev",
        center:"title",
        right: "next"
      },
      slotMinTime:  "07:00:00",
      slotMaxTime:  "18:00:00",
      slotDuration: "00:30:00",
      navLinks:     true,
      editable:     true,
      resources:    useResources ? peers.map(p=>({id:p,title:p})) : undefined,
      events:       fcEvents,

      eventClick: info => {
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
          const updated = load(EVENT_KEY).filter(e=>e.id!==info.event.id);
          save(EVENT_KEY, updated);
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

  const showDayBtn   = document.getElementById("showDayBtn");
  const showWeekBtn  = document.getElementById("showWeekBtn");
  const showPeerBtn  = document.getElementById("showPeerBtn");
  if (showDayBtn  ) showDayBtn.onclick  = () => initCalendar("timeGridDay",   false);
  if (showWeekBtn ) showWeekBtn.onclick = () => initCalendar("timeGridWeek",  false);
  if (showPeerBtn ) showPeerBtn.onclick = () => initCalendar("",             true);
});
