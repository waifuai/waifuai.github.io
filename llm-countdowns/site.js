// LLM Countdowns: upcoming releases, live relative dates, copy link and calendar export.
(function () {
  const DAY = 86400000;

  // Day counts compare calendar dates: the date printed on the page against the viewer's local today.
  function calendarDay(isoString) {
    const [y, m, d] = isoString.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function today() {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function untilText(isoString) {
    const days = Math.round((calendarDay(isoString) - today()) / DAY);
    if (days < 0) return "date passed";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return "in " + days + " days";
  }

  function sinceText(isoString) {
    const days = Math.round((today() - calendarDay(isoString)) / DAY);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + " days ago";
  }

  function renderRelative() {
    document.querySelectorAll("[data-until]").forEach((el) => {
      if (el.dataset.until) el.textContent = untilText(el.dataset.until);
    });
    document.querySelectorAll("[data-since]").forEach((el) => {
      if (el.dataset.since) el.textContent = sinceText(el.dataset.since);
    });
  }

  const releases = Array.from(document.querySelectorAll(".release"));
  const featured = document.querySelector(".next");
  const nextExpected = document.querySelector("[data-next-expected]");
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const empty = document.createElement("p");
  empty.textContent = "No upcoming release dates currently scheduled.";
  empty.hidden = true;
  const firstList = document.querySelector(".releases");
  if (firstList) {
    const heading = firstList.previousElementSibling;
    (heading && heading.matches(".month") ? heading : firstList).before(empty);
  }

  function targetOf(row) {
    const target = row.querySelector("[data-until]").dataset.until;
    return target ? calendarDay(target) : NaN;
  }

  function refresh() {
    const currentDay = today();
    releases.forEach((row) => {
      row.hidden = targetOf(row) < currentDay;
    });
    document.querySelectorAll(".releases").forEach((list) => {
      list.hidden = !Array.from(list.children).some((row) => !row.hidden);
      const heading = list.previousElementSibling;
      if (heading && heading.matches(".month")) heading.hidden = list.hidden;
    });
    // Lists are already sorted; use the first future date for both summaries.
    const next = releases.find((row) => !row.hidden && targetOf(row) >= currentDay);
    empty.hidden = releases.some((row) => !row.hidden);
    if (featured) {
      featured.hidden = !next;
      if (next) {
        const link = next.querySelector(".release-name a");
        const lab = next.querySelector(".release-lab");
        featured.href = link.href;
        featured.querySelector(".next-name").textContent = link.textContent;
        const label = featured.querySelector(".next-label");
        label.replaceChildren(lab.querySelector(".dot").cloneNode(true),
          "Next up · " + lab.textContent.trim());
        featured.querySelector(".next-when strong").textContent = dateFormat.format(targetOf(next));
        featured.querySelector("[data-until]").dataset.until = next.querySelector("[data-until]").dataset.until;
      }
    }
    if (nextExpected) {
      nextExpected.hidden = !next;
      if (next) {
        nextExpected.replaceChildren("Next expected: ", next.querySelector(".release-name a").cloneNode(true),
          ", around " + dateFormat.format(targetOf(next)) + ".");
      }
    }
    const countdown = document.querySelector(".when [data-until]");
    if (countdown) {
      const expired = calendarDay(countdown.dataset.until) < currentDay;
      countdown.closest(".when").hidden = expired;
      const calendar = document.querySelector("[data-calendar]");
      if (calendar) calendar.hidden = expired;
    }
    renderRelative();
  }

  refresh();
  setInterval(refresh, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  const toastEl = document.querySelector(".toast");
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("visible");
    setTimeout(() => toastEl.classList.remove("visible"), 2200);
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  const pageUrl = canonical ? canonical.href : location.href;

  const copyBtn = document.querySelector("[data-copy-link]");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(pageUrl).then(
        () => toast("Link copied"),
        () => toast(pageUrl)
      );
    });
  }

  const calBtn = document.querySelector("[data-calendar]");
  if (calBtn) {
    calBtn.addEventListener("click", () => {
      const start = Date.parse(calBtn.dataset.calendar);
      const stamp = (t) => new Date(t).toISOString().replace(/[-:]|\.\d+/g, "");
      const ics = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WaifuAI//LLM Countdowns//EN",
        "BEGIN:VEVENT",
        "UID:" + calBtn.dataset.id + "@waifuai.github.io",
        "DTSTAMP:" + stamp(Date.now()),
        "DTSTART:" + stamp(start),
        "DTEND:" + stamp(start + 3600000),
        "SUMMARY:" + calBtn.dataset.name + " estimated release",
        "DESCRIPTION:" + pageUrl,
        "END:VEVENT", "END:VCALENDAR",
      ].join("\r\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      link.download = calBtn.dataset.id + ".ics";
      link.click();
      toast("Calendar file downloaded");
    });
  }
})();
