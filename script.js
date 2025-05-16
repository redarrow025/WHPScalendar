document.addEventListener("DOMContentLoaded", () => {
  const EVENT_KEY = "whps_events";
  const ACT_KEY = "whps_activities";
  const LOC_KEY = "whps_locations";
  const db = firebase.firestore();
  const auth = firebase.auth();

  let calendar;

  // ─── Firestore Helpers ──────────────────────
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

  // ─── UI Utilities ───────────────────────────
  const populateSelect = (id, items, placeholder) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    if (!sel.multiple) {
      const opt = document.createElement("option");
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = `-- ${placeholder} --`;
      sel.appendChild(opt);
    }
    items.forEach(item => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = item;
      sel.appendChild(opt);
    });
  };

  const renderList = (id, items, onRemove) => {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = "";
    items.forEach((item, idx) => {
      const li = document.createElement("li");
      li.textContent = item;
      const btn = document.createElement("button");
      btn.textContent = "×";
      btn.className = "remove-btn";
      btn.onclick = () => onRemove(idx);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  };

  const renderPeerToggles = (peers) => {
    const container = document.getElementById("peerContainer");
    if (!container) return;
    container.innerHTML = "";
    peers.forEach(name => {
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
  };

  // ─── Refresh Options UI (Options Page) ─────
  window.refreshOptionsUI = async () => {
    const activities = await load(ACT_KEY);
    const locations = await load(LOC_KEY);

    populateSelect("activitySelect", activities, "Activity");
    populateSelect("locationSelect", locations, "Location");

    renderList("listActivities", activities, async (idx) => {
      activities.splice(idx, 1);
      await save(ACT_KEY, activities);
      refreshOptionsUI();
    });

    renderList("listLocations", locations, async (idx) => {
      locations.splice(idx, 1);
      await save(LOC_KEY, locations);
      refreshOptionsUI();
    });

    const addActivityBtn = document.getElementById("addActivityBtn");
    if (addActivityBtn) {
      addActivityBtn.onclick = async () => {
        const val = document.getElementById("newActivity").value.trim();
        if (!val) return alert("Enter a valid activity.");
        activities.push(val);
        await save(ACT_KEY, activities);
        document.getElementById("newActivity").value = "";
        refreshOptionsUI();
      };
    }

    const addLocationBtn = document.getElementById("addLocationBtn");
    if (addLocationBtn) {
      addLocationBtn.onclick = async () => {
        const val = document.getElementById("newLocation").value.trim();
        if (!val) return alert("Enter a valid location.");
        locations.push(val);
        await save(LOC_KEY, locations);
        document.getElementById("newLocation").value = "";
        refreshOptionsUI();
      };
    }
  };

  // ─── Ripple Effect for Buttons ─────────────
  document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", e => {
      const circle = document.createElement("span");
      circle.classList.add("ripple");
      const d = Math.max(btn.clientWidth, btn.clientHeight);
      circle.style.width = circle.style.height = d + "px";
      circle.style.left = e.clientX - btn.getBoundingClientRect().left - d / 2 + "px";
      circle.style.top = e.clientY - btn.getBoundingClientRect().top - d / 2 + "px";
      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    });
  });

  // ─── Calendar Logic (All Pages) ────────────
  const calendarEl = document.getElementById("calendar");

  const to12 = (t) => {
    let [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    h = ((h + 11) % 12) + 1;
    return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
  };

  const renderCalendar = async (viewType, useResources = false) => {
    const stored = await load(EVENT_KEY);
    const role = window.currentUser?.role || "peer";
    const name = window.currentUser?.name || "";

    const visible = role === "peer"
      ? stored.filter(ev => (ev.who || []).includes(name))
      : stored;

    const fcEvents = visible.map(ev => ({
      id: ev.id,
      title: `${ev.activity} – ${ev.who.join(", ")}`,
      start: `${ev.date}T${ev.start}`,
      end: `${ev.date}T${ev.end}`,
      resourceIds: useResources ? ev.who : undefined,
      extendedProps: ev
    }));

    if (calendar) calendar.destroy();
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: useResources ? "resourceTimelineDay" : viewType,
      initialDate: new Date().toISOString().slice(0, 10),
      headerToolbar: { left: "prev", center: "title", right: "next" },
      slotMinTime: "07:00:00",
      slotMaxTime: "18:00:00",
      slotDuration: "00:30:00",
      editable: role === "manager",
      navLinks: true,
      resources: useResources
        ? Array.from(new Set(visible.flatMap(ev => ev.who))).map(p => ({ id: p, title: p }))
        : undefined,
      events: fcEvents,
      eventClick: async info => {
        if (role !== "manager") return;
        const ep = info.event.extendedProps;
        const confirmDelete = confirm(
          `Activity: ${ep.activity}\nWho: ${ep.who.join(", ")}\nLocation: ${ep.location}\n` +
          `Time: ${to12(ep.start)} – ${to12(ep.end)}\nDelete this event?`
        );
        if (confirmDelete) {
          const updated = stored.filter(e => e.id !== ep.id);
          await save(EVENT_KEY, updated);
          info.event.remove();
        }
      },
      eventDidMount: info => {
        const loc = info.event.extendedProps.location;
        info.el.querySelector(".fc-event-title")
          .insertAdjacentHTML("beforeend", `<div style="font-size:.8em;color:#555">${loc}</div>`);
      }
    });

    calendar.render();
    calendarEl?.classList.remove("hidden");
  };

  const showDayBtn = document.getElementById("showDayBtn");
  const showWeekBtn = document.getElementById("showWeekBtn");
  const showPeerBtn = document.getElementById("showPeerBtn");

  if (showDayBtn) showDayBtn.onclick = () => renderCalendar("timeGridDay", false);
  if (showWeekBtn) showWeekBtn.onclick = () => renderCalendar("timeGridWeek", false);
  if (showPeerBtn) showPeerBtn.onclick = () => renderCalendar("resourceTimelineDay", true);

  // ─── Schedule Page: Add Event ──────────────
  if (document.getElementById("addEventBtn")) {
    auth.onAuthStateChanged(async user => {
      if (!user) return;

      const userDoc = await db.collection("users").doc(user.uid).get();
      const userData = userDoc.data();
      window.currentUser = {
        uid: user.uid,
        email: user.email,
        name: userData.name || user.email.split("@")[0],
        role: userData.role
      };

      const snapshot = await db.collection("users").where("role", "==", "peer").get();
      const peers = snapshot.docs.map(doc => doc.data().name || doc.data().email);
      const activities = await load(ACT_KEY);
      const locations = await load(LOC_KEY);

      populateSelect("activitySelect", activities, "Activity");
      populateSelect("locationSelect", locations, "Location");
      renderPeerToggles(peers);

      document.getElementById("formContainer").onsubmit = async (e) => {
        e.preventDefault();
        try {
          if (mode === "login") {
            const result = await auth.signInWithEmailAndPassword(emailField.value, passwordField.value);
            const uid = result.user.uid;
            const doc = await db.collection("users").doc(uid).get();
            if (!doc.exists) {
              await db.collection("users").doc(uid).set({
                uid,
                email: emailField.value,
                role: "peer",
                name: emailField.value.split("@")[0]
              });
            }
          } else {
            if (!nameField.value.trim()) {
              errorMsg.textContent = "Please enter your name.";
              return;
            }
            const result = await auth.createUserWithEmailAndPassword(emailField.value, passwordField.value);
            const uid = result.user.uid;
            await db.collection("users").doc(uid).set({
              uid,
              email: emailField.value,
              role: "peer",
              name: nameField.value.trim()
            });
          }
          window.location.href = "index.html";
        } catch (err) {
          errorMsg.textContent = err.message;
        }
      };
      

      document.getElementById("addEventBtn").onclick = async () => {
        const get = id => document.getElementById(id);
        const activity = get("activitySelect").value;
        const location = get("locationSelect").value;
        const date = get("date").value;
        const start = get("start").value;
        const end = get("end").value;
        const who = Array.from(document.querySelectorAll(".peer-checkbox:checked")).map(cb => cb.value);

        if (!activity || !location || !date || !start || !end || who.length === 0) {
          return alert("Please complete all fields");
        }

        if (end <= start) {
          return alert("End time must be after start time");
        }

        const events = await load(EVENT_KEY);
        events.push({ id: Date.now().toString(), activity, location, date, start, end, who });
        await save(EVENT_KEY, events);

        ["date", "start", "end"].forEach(id => get(id).value = "");
        get("activitySelect").selectedIndex = 0;
        get("locationSelect").selectedIndex = 0;
        document.querySelectorAll(".peer-checkbox").forEach(cb => cb.checked = false);
        alert("Event added ✔️");
      };
    });
  }
});
