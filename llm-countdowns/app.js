// LLM Release Radar - Purely Static Client Engine

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[radar.js] Initializing LLM Release Radar...");
  setupEventListeners();
  await initRadar();
});

function setupEventListeners() {
  // Header Add Custom Countdown Button
  const headerAddBtn = document.getElementById("btn-add-countdown-header");
  if (headerAddBtn) {
    headerAddBtn.addEventListener("click", () => {
      const modal = document.getElementById("add-countdown-modal");
      if (modal) modal.classList.add("open");
    });
  }

  // Modal Closers
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModals();
      }
    });
  });

  document.querySelectorAll(".drawer-close").forEach(btn => {
    btn.addEventListener("click", closeModals);
  });

  // Escape key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });

  // Listen for browser hashtag changes (e.g. #xai-grok-4-7)
  window.addEventListener("hashchange", () => {
    if (window.countdownsEngine) {
      window.countdownsEngine.handleUrlHash();
    }
  });

  // Add Custom Countdown Form Submit
  const addCountdownForm = document.getElementById("form-add-countdown");
  if (addCountdownForm) {
    addCountdownForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("custom-countdown-name");
      const creatorInput = document.getElementById("custom-countdown-creator");
      const confidenceInput = document.getElementById("custom-countdown-confidence");
      const dateInput = document.getElementById("custom-countdown-date");
      const labelInput = document.getElementById("custom-countdown-label");
      const featuresInput = document.getElementById("custom-countdown-features");
      const sourceInput = document.getElementById("custom-countdown-source");

      if (!nameInput || !dateInput) return;

      const features = featuresInput && featuresInput.value
        ? featuresInput.value.split(",").map(f => f.trim()).filter(Boolean)
        : [];

      if (window.countdownsEngine) {
        window.countdownsEngine.addCustomCountdown({
          name: nameInput.value.trim(),
          creator: creatorInput ? creatorInput.value.trim() : "Custom",
          confidence: confidenceInput ? confidenceInput.value : "Medium",
          targetDate: dateInput.value,
          targetWindowLabel: labelInput && labelInput.value ? labelInput.value.trim() : null,
          features: features,
          source: sourceInput && sourceInput.value ? sourceInput.value.trim() : "User Custom Estimate"
        });

        addCountdownForm.reset();
        closeModals();
        showToast(`Added countdown for ${nameInput.value.trim()}`);
      }
    });
  }
}

async function initRadar() {
  const container = document.getElementById("tab-countdowns");
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <div class="empty-icon" style="font-size: 36px; margin-bottom: 12px;">⏳</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Loading Release Predictions…</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Reading lab cadence cycles and frontier forecasts</div>
      </div>
    `;
  }

  window.countdownsEngine = new CountdownsEngine();
  await window.countdownsEngine.loadPredictions();

  // Update header last-updated badge from predictions data
  const updatedEl = document.getElementById("header-last-updated");
  if (updatedEl && window.countdownsEngine?.lastUpdated) {
    updatedEl.textContent = `Forecasts: ${window.countdownsEngine.lastUpdated}`;
  }

  window.countdownsEngine.render();

  // Handle deep-link hashtag on initial load
  window.countdownsEngine.handleUrlHash();
}

function closeModals() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.classList.remove("open");
  });
}

function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    const container = document.createElement("div");
    container.className = "toast-container";
    container.innerHTML = `<div class="toast"></div>`;
    document.body.appendChild(container);
    toast = container.querySelector(".toast");
  }

  toast.textContent = msg;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

window.showToast = showToast;
