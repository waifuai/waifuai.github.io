// LLM Countdowns: live relative dates, copy link and calendar export.
// Pages are complete without this script; it only turns absolute dates into "in N days".
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

  renderRelative();

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
