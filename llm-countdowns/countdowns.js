// LLM Future Releases & Data-Driven Prediction Radar Engine
// Dynamically analyzes live benchmark models to forecast next-generation flagship releases,
// lab cadence cycles, and extrapolated intelligence trajectories.
//
// Prediction data is loaded from predictions.json — edit that file to update forecasts.

class CountdownsEngine {
  constructor() {
    this.timerInterval = null;
    this.activeFilter = "ALL";
    this.activeHorizon = "ALL";
    this.activeTier = "ALL";
    this.activeSort = "date_asc";
    this.customStorageKey = "llm_rank_custom_countdowns";
    this.starredStorageKey = "llm_rank_starred_hero_id";
    const storedHero = localStorage.getItem(this.starredStorageKey);
    const heroMigrationMap = {
      "anthropic-mythos-5-5": "anthropic-claude-6",
      "openai-gpt-6-5-orion": "openai-gpt-7",
      "meta-muse-spark-1-4": "meta-muse-spark-avocado",
      "deepseek-v4-flash": "deepseek-v4-1-pro",
      "xai-grok-4-8": "xai-grok-4-7"
    };
    this.starredHeroId = heroMigrationMap[storedHero] || storedHero || "xai-grok-4-7";

    // Populated by loadPredictions() from predictions.json
    this.labDefinitions = [];
    this.researchBaselines = {};
    this.defaultCadences = {};
    this.defaultIntel = {};
    this.predictionsLoaded = false;
  }

  // Load prediction data from external JSON file
  async loadPredictions() {
    try {
      const response = await fetch("predictions.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      this.lastUpdated = data.lastUpdated || "Sept 2026";
      this.researchBaselines = data.researchBaselines || {};
      this.defaultCadences = data.defaultCadences || {};
      this.defaultIntel = data.defaultIntel || {};

      // Flatten labs → models into a flat labDefinitions array
      this.labDefinitions = [];
      const labs = data.labs || {};
      for (const [labSlug, lab] of Object.entries(labs)) {
        const models = lab.models || {};
        for (const [tier, model] of Object.entries(models)) {
          this.labDefinitions.push({
            id: model.id,
            creator: lab.name,
            creatorSlug: labSlug,
            matchSlugs: lab.matchSlugs || [labSlug],
            predictedName: model.predictedName,
            category: model.category || tier,
            icon: model.icon || "🔬",
            stageColor: model.stageColor || "#00f2fe",
            status: model.status || "",
            confidence: model.confidence || "Medium",
            confidenceScore: model.confidenceScore || 70,
            hypeScore: model.hypeScore || 80,
            expectedGain: model.expectedGain || 2.0,
            explicitTargetDate: model.explicitTargetDate || null,
            explicitWindowLabel: model.explicitWindowLabel || null,
            cadenceDays: model.cadenceDays || null,
            baselineInfo: model.baseline || null,
            rumoredFeatures: model.features || [],
            source: model.source || ""
          });
        }
      }

      this.predictionsLoaded = true;
      console.log(`[countdowns.js] Loaded ${this.labDefinitions.length} predictions from predictions.json (updated: ${data.lastUpdated || 'unknown'})`);
    } catch (err) {
      console.error("[countdowns.js] Failed to load predictions.json:", err);
      // Engine will work with empty predictions — custom countdowns still function
    }
  }

  // Analyze live benchmark models and dynamically generate data-driven predictions
  generateDataDrivenPredictions(liveModels) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const modelsList = Array.isArray(liveModels) ? liveModels : [];

    // Research baselines loaded from predictions.json
    const researchBaselines = this.researchBaselines;

    return this.labDefinitions.map(def => {
      // Find all models for this creator
      const labModels = modelsList.filter(m => {
        const cName = (m.creator?.name || m.model_creator?.name || "").toLowerCase();
        const cSlug = (m.creator?.slug || m.model_creator?.slug || "").toLowerCase();
        return def.matchSlugs.some(s => cName.includes(s) || cSlug.includes(s));
      }).filter(m => m.releaseDate || m.release_date);

      // Group models by unique release dates to identify distinct deployment waves
      const dateMap = {};
      labModels.forEach(m => {
        const dateStr = m.releaseDate || m.release_date;
        if (!dateMap[dateStr]) dateMap[dateStr] = [];
        dateMap[dateStr].push(m);
      });

      const uniqueDates = Object.keys(dateMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      let latestModel = null;
      let latestDateStr = null;
      let daysSinceLast = 999;
      let currentIntel = null;
      let currentSpeed = null;

      if (uniqueDates.length > 0) {
        latestDateStr = uniqueDates[0];
        const latestWave = dateMap[latestDateStr];
        // Pick the top flagship in this wave (highest intelligence score)
        latestModel = [...latestWave].sort((a, b) => {
          const scoreA = (a.scores?.intelligence ?? a.evaluations?.artificial_analysis_intelligence_index) || 0;
          const scoreB = (b.scores?.intelligence ?? b.evaluations?.artificial_analysis_intelligence_index) || 0;
          return scoreB - scoreA;
        })[0];

        if (latestModel) {
          currentIntel = latestModel.scores?.intelligence ?? latestModel.evaluations?.artificial_analysis_intelligence_index ?? null;
          currentSpeed = latestModel.performance?.tps ?? latestModel.median_output_tokens_per_second ?? null;
          const dt = new Date(latestDateStr).getTime();
          if (!isNaN(dt)) {
            daysSinceLast = Math.max(0, Math.floor((now - dt) / dayMs));
          }
        }
      }

      // Merge with September 2026 research baseline if definition specifies one or live dataset is empty/stale
      const baselineInfo = def.baselineInfo || researchBaselines[def.creatorSlug];
      let finalLatestName = def.baselineInfo ? def.baselineInfo.name : (latestModel ? latestModel.name : (baselineInfo ? baselineInfo.name : "Latest Flagship"));
      let finalDaysSince = def.baselineInfo ? def.baselineInfo.daysSince : (daysSinceLast !== 999 ? daysSinceLast : (baselineInfo ? baselineInfo.daysSince : 25));
      let finalIntel = def.baselineInfo ? def.baselineInfo.intel : ((currentIntel !== null && currentIntel > 0) ? currentIntel : (baselineInfo ? baselineInfo.intel : null));
      let finalSpeed = def.baselineInfo && def.baselineInfo.speed ? def.baselineInfo.speed : (currentSpeed || null);

      if (baselineInfo && !def.baselineInfo && (daysSinceLast === 999 || (latestDateStr && new Date(latestDateStr).getFullYear() < 2026))) {
        finalLatestName = baselineInfo.name;
        finalDaysSince = baselineInfo.daysSince;
        if (!finalIntel) finalIntel = baselineInfo.intel;
      }

      // Calculate historical cadence from intervals between release waves
      const intervals = [];
      for (let i = 0; i < Math.min(uniqueDates.length - 1, 6); i++) {
        const d1 = new Date(uniqueDates[i]).getTime();
        const d2 = new Date(uniqueDates[i + 1]).getTime();
        const days = Math.round((d1 - d2) / dayMs);
        if (days >= 7 && days <= 250) {
          intervals.push(days);
        }
      }

      // Default baseline cadences loaded from predictions.json
      const defaultCadences = this.defaultCadences;

      const avgCadenceDays = def.cadenceDays || (intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : (defaultCadences[def.creatorSlug] || 30));

      // Determine Target Release Date & Window:
      let daysUntilTarget;
      let isOverdue = false;
      let targetTimestamp;
      let targetDateObj;
      let targetDateIso;
      let targetWindowLabel;

      if (def.explicitTargetDate) {
        // High-fidelity target from lab official announcement or research consensus
        targetTimestamp = new Date(def.explicitTargetDate).getTime();
        targetDateObj = new Date(targetTimestamp);
        targetDateIso = targetDateObj.toISOString();
        daysUntilTarget = Math.max(0, Math.ceil((targetTimestamp - now) / dayMs));
        targetWindowLabel = def.explicitWindowLabel || targetDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        if (daysUntilTarget <= 5) {
          isOverdue = true;
        }
      } else {
        // Cadence-based projection
        daysUntilTarget = avgCadenceDays - finalDaysSince;
        if (daysUntilTarget <= 3) {
          isOverdue = finalDaysSince >= avgCadenceDays;
          daysUntilTarget = Math.max(6, Math.round(avgCadenceDays * 0.25));
        }

        targetTimestamp = now + (daysUntilTarget * dayMs);
        targetDateObj = new Date(targetTimestamp);
        targetDateObj.setHours(17, 0, 0, 0);
        targetDateIso = targetDateObj.toISOString();

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthStr = monthNames[targetDateObj.getMonth()];
        const yearStr = targetDateObj.getFullYear();
        let windowPrefix = "Mid";
        if (targetDateObj.getDate() <= 10) windowPrefix = "Early";
        else if (targetDateObj.getDate() >= 20) windowPrefix = "Late";
        targetWindowLabel = isOverdue
          ? `Imminent • ~${daysUntilTarget}d (${windowPrefix} ${monthStr} ${yearStr})`
          : `${windowPrefix} ${monthStr} ${yearStr}`;
      }

      // Project Intelligence Index
      let projIntel = null;
      if (finalIntel !== null && finalIntel > 0) {
        projIntel = Math.round((finalIntel + def.expectedGain) * 10) / 10;
      } else {
        projIntel = (this.defaultIntel[def.creatorSlug]) || 50.0;
      }

      return {
        id: def.id,
        name: def.predictedName,
        creator: def.creator,
        creatorSlug: def.creatorSlug,
        category: def.category,
        icon: def.icon,
        targetDate: targetDateIso,
        targetWindowLabel: targetWindowLabel,
        confidence: isOverdue ? "High" : def.confidence,
        confidenceScore: isOverdue ? 98 : def.confidenceScore,
        status: def.status,
        stageColor: isOverdue ? "#ff007a" : def.stageColor,
        rumoredFeatures: def.rumoredFeatures,
        hypeScore: def.hypeScore,
        source: def.source,
        isPreset: true,
        isDataDriven: true,
        analysis: {
          totalModelsAnalyzed: labModels.length,
          latestModelName: finalLatestName,
          latestDateStr: latestDateStr || "Sept 2026",
          daysSinceLast: finalDaysSince,
          avgCadenceDays: avgCadenceDays,
          currentIntel: finalIntel,
          currentSpeed: finalSpeed,
          projectedIntel: projIntel,
          intelGain: def.expectedGain,
          isOverdue: isOverdue
        }
      };
    });
  }

  // Preset fallback if data is still loading
  getPresetModels() {
    return this.generateDataDrivenPredictions(window.allModels || []);
  }

  getCustomModels() {
    try {
      const raw = localStorage.getItem(this.customStorageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("[countdowns.js] Failed to parse custom countdowns", e);
    }
    return [];
  }

  saveCustomModels(list) {
    try {
      localStorage.setItem(this.customStorageKey, JSON.stringify(list));
    } catch (e) {
      console.warn("[countdowns.js] Failed to save custom countdowns", e);
    }
  }

  addCustomModel(model) {
    const customList = this.getCustomModels();
    const newModel = {
      id: "custom-" + Date.now(),
      name: model.name.trim(),
      creator: model.creator.trim() || "Custom / Independent",
      creatorSlug: "custom",
      category: "custom",
      icon: "⭐",
      targetDate: new Date(model.targetDate).toISOString(),
      targetWindowLabel: model.targetWindowLabel || new Date(model.targetDate).toLocaleDateString(),
      confidence: model.confidence || "Medium",
      confidenceScore: model.confidence === "High" ? 85 : model.confidence === "Speculative" ? 45 : 65,
      status: model.status || "Community Tracked",
      stageColor: "#00f2fe",
      rumoredFeatures: model.features && model.features.length > 0 ? model.features : ["Community tracked model release estimate"],
      hypeScore: 80,
      source: model.source || "User Defined",
      isPreset: false,
      isDataDriven: false
    };
    customList.unshift(newModel);
    this.saveCustomModels(customList);
    this.render();
    return newModel;
  }

  deleteCustomModel(id) {
    let customList = this.getCustomModels();
    customList = customList.filter(m => m.id !== id);
    this.saveCustomModels(customList);
    this.render();
  }

  getAllModels() {
    const custom = this.getCustomModels();
    const dataDriven = this.generateDataDrivenPredictions(window.allModels || []);
    return [...custom, ...dataDriven];
  }

  // Calculate remaining time
  getTimeRemaining(targetIso) {
    const target = new Date(targetIso).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    return {
      total: diff,
      days,
      hours,
      minutes,
      seconds,
      isPast: false
    };
  }

  // Get highlighted model for hero spotlight (user-starred or default Gemini)
  getHeroModel(models) {
    if (!models || models.length === 0) return null;

    // 1. User explicitly starred hero model
    if (this.starredHeroId) {
      const found = models.find(m => m.id === this.starredHeroId);
      if (found) return found;
    }

    // 2. Default to Gemini if available
    const gemini = models.find(m => m.creatorSlug === "google" || (m.id && m.id.includes("gemini")));
    if (gemini) return gemini;

    // 3. Fallback to closest upcoming model
    const sorted = [...models].sort((a, b) => {
      const diffA = new Date(a.targetDate).getTime() - Date.now();
      const diffB = new Date(b.targetDate).getTime() - Date.now();
      if (diffA > 0 && diffB > 0) return diffA - diffB;
      if (diffA > 0) return -1;
      if (diffB > 0) return 1;
      return diffB - diffA;
    });
    return sorted[0];
  }

  // Set starred model as main highlighted hero
  setStarredHero(modelId) {
    if (!modelId) return;
    this.starredHeroId = modelId;
    try {
      localStorage.setItem(this.starredStorageKey, modelId);
    } catch (e) {
      console.warn("Could not persist starred hero", e);
    }

    const all = this.getAllModels();
    const model = all.find(m => m.id === modelId);
    if (window.showToast && model) {
      window.showToast(`★ ${model.name} set as Main Spotlight`);
    }

    this.render();

    // Scroll to hero spotlight and pulse
    const heroCard = document.querySelector(".countdown-hero-card");
    if (heroCard) {
      heroCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      heroCard.classList.add("hero-pulse-highlight");
      setTimeout(() => heroCard.classList.remove("hero-pulse-highlight"), 1300);
    }
  }

  // Calculate Lab Cadence Stats from live benchmark models with fun, motivating countdowns
  computeLabCadence(liveModels) {
    const predictions = this.generateDataDrivenPredictions(liveModels);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    return predictions.map(p => {
      const a = p.analysis || {};
      const daysSince = a.daysSinceLast || 0;
      const avgCadence = a.avgCadenceDays || 35;
      const cyclePercent = Math.min(100, Math.round((daysSince / avgCadence) * 100));
      const isDue = daysSince >= Math.round(avgCadence * 0.85);

      const targetTime = new Date(p.targetDate).getTime();
      const diffMs = targetTime - now;
      let daysLeft = Math.max(1, Math.ceil(diffMs / dayMs));
      
      const targetDateObj = new Date(p.targetDate);
      const dateFormatted = targetDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      let countdownLabel = `⏳ ${daysLeft} DAYS LEFT`;
      let motivateLabel = "⚡ Cooking in cluster";

      if (daysLeft <= 7) {
        countdownLabel = `🔥 ${daysLeft} DAYS LEFT (DROP SOON!)`;
        motivateLabel = "🚀 Ready to drop!";
      } else if (daysLeft <= 14) {
        countdownLabel = `⚡ ~${daysLeft} DAYS TO GO`;
        motivateLabel = isDue ? "🔥 Overdue cycle" : "🧪 Final red-teaming";
      } else if (daysLeft <= 28) {
        countdownLabel = `🗓️ ${daysLeft} DAYS TO GO`;
        motivateLabel = isDue ? "🔥 Overdue cycle" : "💻 Scaling cluster";
      } else {
        countdownLabel = `⏳ ~${daysLeft} DAYS TO GO`;
        motivateLabel = isDue ? "🔥 Overdue cycle" : "🔬 Pre-training phase";
      }

      return {
        id: p.id,
        category: p.category,
        name: p.creator,
        slug: p.creatorSlug,
        icon: p.icon || "🔬",
        latestModelName: a.latestModelName || "Latest Drop",
        latestDateStr: a.latestDateStr || "",
        daysSinceLast: daysSince,
        avgCadenceDays: avgCadence,
        cyclePercent,
        isDue,
        nextPredictedName: p.name,
        targetDate: p.targetDate,
        targetDateFormatted: dateFormatted,
        targetWindowLabel: p.targetWindowLabel,
        daysLeft,
        countdownLabel,
        motivateLabel
      };
    }).sort((a, b) => a.daysLeft - b.daysLeft); // Fun & motivating: closest upcoming drops at the top!
  }

  // Filter and Sort models
  getFilteredModels() {
    let list = this.getAllModels();

    // Filter by Tier (Category)
    if (this.activeTier && this.activeTier !== "ALL") {
      if (this.activeTier === "LIGHT") {
        list = list.filter(m => m.category === "light");
      } else if (this.activeTier === "FRONTIER") {
        list = list.filter(m => m.category === "frontier");
      } else if (this.activeTier === "REASONING") {
        list = list.filter(m => m.category === "reasoning");
      }
    }

    // Filter by Creator
    if (this.activeFilter !== "ALL") {
      list = list.filter(m => {
        if (this.activeFilter === "CUSTOM") return !m.isPreset;
        return m.creatorSlug === this.activeFilter.toLowerCase();
      });
    }

    // Filter by Horizon
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (this.activeHorizon === "15_DAYS") {
      list = list.filter(m => {
        const diff = new Date(m.targetDate).getTime() - now;
        return diff > 0 && diff <= (15 * dayMs);
      });
    } else if (this.activeHorizon === "30_DAYS") {
      list = list.filter(m => {
        const diff = new Date(m.targetDate).getTime() - now;
        return diff > 0 && diff <= (30 * dayMs);
      });
    } else if (this.activeHorizon === "60_DAYS") {
      list = list.filter(m => {
        const diff = new Date(m.targetDate).getTime() - now;
        return diff > 0 && diff <= (60 * dayMs);
      });
    } else if (this.activeHorizon === "CONFIRMED") {
      list = list.filter(m => m.confidence === "High");
    }

    // Sort
    if (this.activeSort === "date_asc") {
      list.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
    } else if (this.activeSort === "intelligence") {
      list.sort((a, b) => {
        const scoreA = a.analysis?.projectedIntel || 0;
        const scoreB = b.analysis?.projectedIntel || 0;
        return scoreB - scoreA;
      });
    } else if (this.activeSort === "confidence") {
      list.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));
    } else if (this.activeSort === "hype") {
      list.sort((a, b) => (b.hypeScore || 0) - (a.hypeScore || 0));
    }

    return list;
  }

  // Generate .ics calendar file for user download
  downloadIcs(model) {
    const startDate = new Date(model.targetDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour event

    const formatIcsDate = (d) => {
      return d.toISOString().replace(/-|:|\.\d+/g, "");
    };

    const intelLine = model.analysis?.projectedIntel ? `\\nProjected Intel Index: ~${model.analysis.projectedIntel}` : "";
    const baselineLine = model.analysis?.latestModelName ? `\\nBaseline: ${model.analysis.latestModelName}` : "";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LLM Rank//Future Release Tracker//EN",
      "BEGIN:VEVENT",
      `UID:llm-rank-${model.id}@waifuai.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:🚀 LLM Drop Alert: ${model.name} (${model.creator})`,
      `DESCRIPTION:Data-driven estimated release date for ${model.name} by ${model.creator}.${intelLine}${baselineLine}\\nTarget Window: ${model.targetWindowLabel}\\nConfidence: ${model.confidence} (${model.confidenceScore}%)\\nSource: ${model.source}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.id}-release-estimate.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.showToast) {
      window.showToast(`Calendar reminder (.ics) downloaded for ${model.name}`);
    }
  }

  // Share or copy countdown info
  async shareCountdown(model) {
    const rem = this.getTimeRemaining(model.targetDate);
    const intelSnippet = model.analysis?.projectedIntel ? ` (Proj. Intel: ~${model.analysis.projectedIntel})` : "";
    const text = `⏳ ${model.name}${intelSnippet} by ${model.creator} is estimated to drop in ~${rem.days}d ${rem.hours}h! Track live on LLM Rank.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Countdown: ${model.name}`,
          text: text,
          url: window.location.href
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to copy
      }
    }

    // Fallback: clipboard copy
    try {
      await navigator.clipboard.writeText(text);
      if (window.showToast) {
        window.showToast("Countdown copied to clipboard!");
      }
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  }

  // Render main countdowns tab
  render() {
    const container = document.getElementById("tab-countdowns");
    if (!container) return;

    const liveModels = window.allModels || [];
    const allModels = this.getAllModels();
    const filtered = this.getFilteredModels();
    const heroModel = this.getHeroModel(allModels);

    const lightCount = allModels.filter(m => m.category === "light").length;
    const frontierCount = allModels.filter(m => m.category === "frontier").length;
    const reasoningCount = allModels.filter(m => m.category === "reasoning").length;

    // Update tab badge count
    const badge = document.getElementById("countdown-upcoming-badge");
    if (badge) {
      badge.textContent = allModels.length;
    }

    // Find current top intelligence model in live dataset
    let topLiveModel = null;
    if (liveModels.length > 0) {
      topLiveModel = [...liveModels].sort((a, b) => (b.scores?.intelligence || 0) - (a.scores?.intelligence || 0))[0];
    }

    // Static Analysis Overview Banner
    const bannerHtml = `
      <div class="radar-analytics-banner">
        <div class="radar-banner-header">
          <div class="radar-banner-title">
            <span>📡 Frontier AI Release Radar</span>
          </div>
          <span class="radar-banner-pill">RESEARCH CADENCE FORECAST</span>
        </div>
        <div class="radar-insights-grid">
          <div class="radar-insight-box">
            <div class="radar-insight-num">${allModels.length} Models</div>
            <div class="radar-insight-lbl">Tracked Launches</div>
          </div>
          <div class="radar-insight-box">
            <div class="radar-insight-num" style="color: var(--accent-green);">57.0 (Claude 5.1)</div>
            <div class="radar-insight-lbl">Current Benchmark Frontier</div>
          </div>
          <div class="radar-insight-box">
            <div class="radar-insight-num" style="color: var(--accent-cyan);">${lightCount} Flash • ${frontierCount} Frontier</div>
            <div class="radar-insight-lbl">Pipeline Breakdown</div>
          </div>
          <div class="radar-insight-box">
            <div class="radar-insight-num" style="color: #ffb300;">~21 Days</div>
            <div class="radar-insight-lbl">Fastest Lab Cycle (Google Flash)</div>
          </div>
        </div>
      </div>
    `;

    // Render Hero Spotlight Card
    let heroHtml = "";
    if (heroModel) {
      const heroTime = this.getTimeRemaining(heroModel.targetDate);
      const a = heroModel.analysis || {};
      const projBadge = a.projectedIntel ? `• <span class="proj-intel-badge">🎯 Proj. Intel: ~${a.projectedIntel}</span>` : "";

      heroHtml = `
        <div class="countdown-hero-card" data-hero-id="${heroModel.id}" data-target-date="${heroModel.targetDate}">
          <div class="hero-badge-row">
            <div class="hero-left-tags">
              <span class="spotlight-pill">🔥 NEXT EXPECTED DROP</span>
              <span class="model-tier-badge hero-tier-badge ${heroModel.category || 'frontier'}">
                ${heroModel.category === 'light' ? '⚡ LIGHT / FLASH' : heroModel.category === 'reasoning' ? '🧠 REASONING' : '👑 FRONTIER'}
              </span>
              <span class="hero-star-indicator">★ MAIN SPOTLIGHT</span>
              <span class="confidence-pill ${heroModel.confidence.toLowerCase()}">${heroModel.confidence} (${heroModel.confidenceScore}%)</span>
            </div>

            <div class="hero-switch-dropdown-wrap">
              <span class="hero-switch-label">Switch:</span>
              <select id="hero-model-select" class="hero-model-select" title="Switch Main Spotlight Model">
                ${allModels.map(m => `
                  <option value="${m.id}" ${m.id === heroModel.id ? 'selected' : ''}>
                    ${m.id === heroModel.id ? '★ ' : ''}${m.creator}: ${m.name.length > 25 ? m.name.slice(0, 25) + '…' : m.name}
                  </option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="hero-title-group">
            <h2 class="hero-model-name">${heroModel.name}</h2>
            <div class="hero-creator-name">${heroModel.creator} • <span style="color: var(--accent-cyan); font-weight: 600;">${heroModel.targetWindowLabel}</span> ${projBadge}</div>
          </div>

          <!-- Digital Countdown Clock -->
          <div class="hero-clock-display" id="hero-clock-container">
            <div class="clock-unit-card">
              <div class="clock-digit" id="hero-days">${String(heroTime.days).padStart(2, '0')}</div>
              <div class="clock-label">DAYS</div>
            </div>
            <div class="clock-colon">:</div>
            <div class="clock-unit-card">
              <div class="clock-digit" id="hero-hours">${String(heroTime.hours).padStart(2, '0')}</div>
              <div class="clock-label">HOURS</div>
            </div>
            <div class="clock-colon">:</div>
            <div class="clock-unit-card">
              <div class="clock-digit" id="hero-minutes">${String(heroTime.minutes).padStart(2, '0')}</div>
              <div class="clock-label">MINS</div>
            </div>
            <div class="clock-colon">:</div>
            <div class="clock-unit-card accent">
              <div class="clock-digit" id="hero-seconds">${String(heroTime.seconds).padStart(2, '0')}</div>
              <div class="clock-label">SECS</div>
            </div>
          </div>

          ${heroModel.isDataDriven && a.latestModelName ? `
            <div class="card-data-dossier" style="margin-bottom: 14px;">
              <div class="dossier-row">
                <span class="dossier-label">📊 ACTUAL DATA BASELINE:</span>
                <span class="dossier-val">${a.latestModelName} (${a.currentIntel ? a.currentIntel + ' Intel' : ''})</span>
              </div>
              <div class="dossier-row">
                <span class="dossier-label">⏱️ CADENCE TRAJECTORY:</span>
                <span class="dossier-val dossier-highlight">Last drop: ${a.daysSinceLast}d ago • Avg Lab Cycle: ~${a.avgCadenceDays} days</span>
              </div>
            </div>
          ` : ''}

          <div class="hero-status-row">
            <div class="status-pulse-wrap">
              <span class="status-indicator-dot" style="background-color: ${heroModel.stageColor || 'var(--accent-cyan)'};"></span>
              <span class="hero-status-text">${heroModel.status}</span>
            </div>
            <div class="hero-actions">
              <button class="action-pill-btn btn-cal-export" data-model-id="${heroModel.id}" title="Add to Calendar">
                📅 Add Reminder
              </button>
              <button class="action-pill-btn btn-share-countdown" data-model-id="${heroModel.id}" title="Share Countdown">
                🔗 Share
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Filter Chips
    const creators = [
      { id: "ALL", label: "🌐 All Labs" },
      { id: "ANTHROPIC", label: "🟣 Anthropic" },
      { id: "OPENAI", label: "🟢 OpenAI" },
      { id: "GOOGLE", label: "🔵 Google" },
      { id: "META", label: "🟦 Meta" },
      { id: "SPACEXAI", label: "🟠 xAI" },
      { id: "DEEPSEEK", label: "⚡ DeepSeek" },
      { id: "ALIBABA", label: "🌐 Alibaba" },
      { id: "MISTRAL", label: "🔴 Mistral" },
      { id: "XIAOMI", label: "🧡 Xiaomi" },
      { id: "KIMI", label: "🌙 Kimi" },
      { id: "MINIMAX", label: "🪐 MiniMax" },
      { id: "CUSTOM", label: "⭐ Custom" }
    ];

    const filterChipsHtml = `
      <div class="countdown-controls-wrap">
        <!-- Lab Filter Chips -->
        <div class="chips-carousel" id="countdown-creator-chips">
          ${creators.map(c => `
            <button class="filter-chip ${this.activeFilter === c.id ? 'active' : ''}" data-countdown-filter="${c.id}">
              ${c.label}
            </button>
          `).join("")}
        </div>

        <!-- Model Tier Filter Pills -->
        <div class="tier-filter-row">
          <span class="subcontrol-label">Tier:</span>
          <div class="tier-pills">
            <button class="sub-pill tier-pill ${this.activeTier === 'ALL' ? 'active' : ''}" data-tier="ALL">All Tiers (${allModels.length})</button>
            <button class="sub-pill tier-pill ${this.activeTier === 'LIGHT' ? 'active' : ''}" data-tier="LIGHT">⚡ Light &amp; Flash (${lightCount})</button>
            <button class="sub-pill tier-pill ${this.activeTier === 'FRONTIER' ? 'active' : ''}" data-tier="FRONTIER">👑 Frontier Giants (${frontierCount})</button>
            <button class="sub-pill tier-pill ${this.activeTier === 'REASONING' ? 'active' : ''}" data-tier="REASONING">🧠 Reasoning (${reasoningCount})</button>
          </div>
        </div>

        <div class="countdown-subcontrols">
          <div class="horizon-pills">
            <button class="sub-pill ${this.activeHorizon === 'ALL' ? 'active' : ''}" data-horizon="ALL">All Horizons</button>
            <button class="sub-pill ${this.activeHorizon === '15_DAYS' ? 'active' : ''}" data-horizon="15_DAYS">⚡ &lt; 15 Days</button>
            <button class="sub-pill ${this.activeHorizon === '30_DAYS' ? 'active' : ''}" data-horizon="30_DAYS">🗓️ &lt; 30 Days</button>
            <button class="sub-pill ${this.activeHorizon === '60_DAYS' ? 'active' : ''}" data-horizon="60_DAYS">🎯 &lt; 60 Days</button>
            <button class="sub-pill ${this.activeHorizon === 'CONFIRMED' ? 'active' : ''}" data-horizon="CONFIRMED">✅ Confirmed</button>
          </div>

          <div class="sort-action-row">
            <select id="countdown-sort-select" class="sort-select" style="max-width: 170px; font-size: 11px;">
              <option value="date_asc" ${this.activeSort === 'date_asc' ? 'selected' : ''}>Target Date (Nearest)</option>
              <option value="intelligence" ${this.activeSort === 'intelligence' ? 'selected' : ''}>Projected Intel (Highest)</option>
              <option value="confidence" ${this.activeSort === 'confidence' ? 'selected' : ''}>Highest Confidence</option>
              <option value="hype" ${this.activeSort === 'hype' ? 'selected' : ''}>Community Hype</option>
            </select>
            <button id="btn-open-add-countdown" class="filter-chip active" style="font-size: 11px; padding: 6px 10px;">
              + Add Estimate
            </button>
          </div>
        </div>
      </div>
    `;

    // Cards Grid
    let cardsHtml = "";
    if (filtered.length === 0) {
      cardsHtml = `
        <div class="empty-state-card">
          <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">No predictions match your filter</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Try selecting "All Tiers" or "All Labs".</div>
        </div>
      `;
    } else {
      cardsHtml = `<div class="countdown-cards-grid">` + filtered.map(model => {
        const rem = this.getTimeRemaining(model.targetDate);
        const a = model.analysis || {};
        const isStarred = Boolean(heroModel && heroModel.id === model.id);

        return `
          <div class="countdown-card ${isStarred ? 'is-main-spotlight' : ''}" data-card-id="${model.id}" data-target-date="${model.targetDate}">
            <div class="card-top-row">
              <div>
                <div class="card-creator-line">
                  <span class="card-creator-tag">${model.creator}</span>
                  <span class="model-tier-badge ${model.category || 'frontier'}">
                    ${model.category === 'light' ? '⚡ LIGHT / FLASH' : model.category === 'reasoning' ? '🧠 REASONING' : '👑 FRONTIER'}
                  </span>
                </div>
                <h3 class="card-model-title">${model.name}</h3>
              </div>
              <div class="card-badges-col">
                <button class="btn-star-spotlight ${isStarred ? 'starred' : ''}" data-star-id="${model.id}" title="${isStarred ? 'Current Main Spotlight at top' : 'Star to set as Main Spotlight at top'}">
                  <span class="star-icon">${isStarred ? '★' : '☆'}</span>
                  <span class="star-text">${isStarred ? 'Main' : 'Star'}</span>
                </button>
                <span class="confidence-pill ${model.confidence.toLowerCase()}">${model.confidence}</span>
                ${!model.isPreset ? `<button class="btn-del-custom" data-delete-id="${model.id}" title="Delete Custom Estimate">✕</button>` : ''}
              </div>
            </div>

            <!-- Live Clock Counter -->
            <div class="card-timer-row">
              <div class="timer-box">
                <span class="timer-num card-days">${rem.days}</span>
                <span class="timer-lbl">DAYS</span>
              </div>
              <span class="timer-sep">:</span>
              <div class="timer-box">
                <span class="timer-num card-hours">${String(rem.hours).padStart(2, '0')}</span>
                <span class="timer-lbl">HRS</span>
              </div>
              <span class="timer-sep">:</span>
              <div class="timer-box">
                <span class="timer-num card-mins">${String(rem.minutes).padStart(2, '0')}</span>
                <span class="timer-lbl">MIN</span>
              </div>
              <span class="timer-sep">:</span>
              <div class="timer-box highlight">
                <span class="timer-num card-secs">${String(rem.seconds).padStart(2, '0')}</span>
                <span class="timer-lbl">SEC</span>
              </div>
            </div>

            <div class="card-target-window">
              <span class="target-icon">🎯</span> Target: <strong>${model.targetWindowLabel}</strong>
            </div>

            <!-- Data Evidence Dossier Box -->
            ${model.isDataDriven && a.latestModelName ? `
              <div class="card-data-dossier">
                <div class="dossier-row">
                  <span class="dossier-label">📊 ACTUAL BASELINE</span>
                  <span class="dossier-val" title="${a.latestModelName}">${a.latestModelName.length > 24 ? a.latestModelName.slice(0, 24) + '…' : a.latestModelName}</span>
                </div>
                <div class="dossier-row">
                  <span class="dossier-label">🎯 PROJ. INTEL</span>
                  <span class="dossier-val dossier-highlight">~${a.projectedIntel} <span style="font-size: 9px; color: var(--accent-green);">(+${a.intelGain})</span></span>
                </div>
                <div class="dossier-row">
                  <span class="dossier-label">⏱️ LAB CADENCE</span>
                  <span class="dossier-val">${a.daysSinceLast}d ago / ~${a.avgCadenceDays}d cycle</span>
                </div>
              </div>
            ` : ''}

            <!-- Rumored / Extrapolated Breakthroughs -->
            <ul class="card-rumor-list">
              ${model.rumoredFeatures.slice(0, 3).map(feat => `<li>${feat}</li>`).join("")}
            </ul>

            <!-- Source & Actions Footer -->
            <div class="card-footer-row">
              <div class="card-source-snippet" title="${model.source}">
                📡 ${model.source}
              </div>
              <div class="card-btn-actions">
                <button class="card-icon-action btn-cal-export" data-model-id="${model.id}" title="Add to Calendar">
                  📅
                </button>
                <button class="card-icon-action btn-share-countdown" data-model-id="${model.id}" title="Share">
                  🔗
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("") + `</div>`;
    }

    // Dynamic Lab Release Cycle Radar Section
    const cadenceList = this.computeLabCadence(liveModels);
    const cadenceHtml = `
      <div class="cadence-tracker-card">
        <div class="cadence-header">
          <div>
            <div class="chart-title">🔥 Lab Release Cycle Radar</div>
            <div class="chart-subtitle">Estimated next model drops, target dates & days to release</div>
          </div>
          <span class="cadence-radar-pill">⚡ NEXT DROPS</span>
        </div>

        <div class="cadence-items-list">
          ${cadenceList.map(lab => {
            const labModel = allModels.find(m => m.id === lab.id || m.creatorSlug === lab.slug);
            const isLabStarred = Boolean(heroModel && labModel && heroModel.id === labModel.id);
            const starTargetId = labModel ? labModel.id : lab.id;

            return `
            <div class="cadence-item" data-cadence-filter="${lab.slug}" title="Click to filter for ${lab.name}">
              <div class="cadence-item-top">
                <div class="cadence-lab-identity">
                  ${starTargetId ? `
                    <button class="btn-cadence-star ${isLabStarred ? 'starred' : ''}" data-star-id="${starTargetId}" title="${isLabStarred ? 'Current Main Spotlight at top' : 'Star to set as Main Spotlight at top'}">
                      ${isLabStarred ? '★' : '☆'}
                    </button>
                  ` : ''}
                  <span class="cadence-lab-icon">${lab.icon}</span>
                  <span class="cadence-lab-name">${lab.name}</span>
                  <span class="model-tier-badge ${lab.category || 'frontier'}" style="font-size: 8px; padding: 1px 5px; margin-left: 3px;">
                    ${lab.category === 'light' ? '⚡ LIGHT' : lab.category === 'reasoning' ? '🧠 REASONING' : '👑 FRONTIER'}
                  </span>
                </div>
                <span class="cadence-countdown-pill ${lab.isDue ? 'due' : ''}">
                  ${lab.countdownLabel}
                </span>
              </div>

              <!-- Estimated Next Model & Estimated Drop Date -->
              <div class="cadence-model-forecast-box">
                <div class="cadence-forecast-row">
                  <span class="forecast-label">🚀 NEXT MODEL:</span>
                  <strong class="forecast-model-name">${lab.nextPredictedName}</strong>
                </div>
                <div class="cadence-forecast-row">
                  <span class="forecast-label">🎯 EST. DATE:</span>
                  <span class="forecast-date-val">${lab.targetDateFormatted} <span class="forecast-window-tag">(${lab.targetWindowLabel})</span></span>
                </div>
              </div>

              <!-- Motivating Cycle Progress Track -->
              <div class="cadence-progress-track">
                <div class="cadence-progress-fill ${lab.isDue ? 'due' : ''}" style="width: ${Math.min(100, lab.cyclePercent)}%;"></div>
              </div>

              <div class="cadence-item-bottom">
                <span>Last: ${lab.latestModelName.length > 20 ? lab.latestModelName.slice(0, 20) + '…' : lab.latestModelName} (${lab.daysSinceLast}d ago)</span>
                <span class="cadence-motivate-tag ${lab.isDue ? 'due' : ''}">${lab.motivateLabel}</span>
              </div>
            </div>
          `;
          }).join("")}
        </div>
      </div>
    `;

    // Inject everything into container: Hero Spotlight is placed back at the TOP!
    container.innerHTML = `
      ${bannerHtml}
      ${heroHtml}
      ${cadenceHtml}
      ${filterChipsHtml}
      ${cardsHtml}
    `;

    this.attachEventListeners(container);
    this.startLiveTimer();
  }

  // Attach event handlers inside rendered tab
  attachEventListeners(container) {
    // Hero model dropdown switcher
    const heroSelect = container.querySelector("#hero-model-select");
    if (heroSelect) {
      heroSelect.addEventListener("change", (e) => {
        this.setStarredHero(e.target.value);
      });
    }

    // Star buttons on grid cards
    container.querySelectorAll(".btn-star-spotlight[data-star-id]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-star-id");
        if (id) this.setStarredHero(id);
      });
    });

    // Star buttons in cadence items
    container.querySelectorAll(".btn-cadence-star[data-star-id]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-star-id");
        if (id) this.setStarredHero(id);
      });
    });

    // Cadence item click to quick-filter
    container.querySelectorAll(".cadence-item[data-cadence-filter]").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".btn-cadence-star")) return;
        const slug = item.getAttribute("data-cadence-filter");
        if (slug) {
          this.activeFilter = slug.toUpperCase();
          this.render();
        }
      });
    });

    // Tier pills
    container.querySelectorAll(".tier-pills .tier-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        this.activeTier = pill.getAttribute("data-tier") || "ALL";
        this.render();
      });
    });

    // Filter chips
    container.querySelectorAll("#countdown-creator-chips .filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this.activeFilter = chip.getAttribute("data-countdown-filter") || "ALL";
        this.render();
      });
    });

    // Horizon pills
    container.querySelectorAll(".horizon-pills .sub-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        this.activeHorizon = pill.getAttribute("data-horizon") || "ALL";
        this.render();
      });
    });

    // Sort selector
    const sortSelect = container.querySelector("#countdown-sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.activeSort = e.target.value;
        this.render();
      });
    }

    // Add Estimate Button
    const addBtn = container.querySelector("#btn-open-add-countdown");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.openAddCustomModal();
      });
    }

    // Calendar export buttons
    container.querySelectorAll(".btn-cal-export").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-model-id");
        const model = this.getAllModels().find(m => m.id === id);
        if (model) this.downloadIcs(model);
      });
    });

    // Share buttons
    container.querySelectorAll(".btn-share-countdown").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-model-id");
        const model = this.getAllModels().find(m => m.id === id);
        if (model) this.shareCountdown(model);
      });
    });

    // Delete custom countdown buttons
    container.querySelectorAll(".btn-del-custom").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-delete-id");
        if (confirm("Delete this custom release estimate?")) {
          this.deleteCustomModel(id);
          if (window.showToast) window.showToast("Custom estimate deleted");
        }
      });
    });
  }

  // 1-second live clock update for DOM elements without full re-render
  startLiveTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      // 1. Update Hero clock if present
      const heroCard = document.querySelector(".countdown-hero-card");
      if (heroCard) {
        const targetDate = heroCard.getAttribute("data-target-date");
        if (targetDate) {
          const t = this.getTimeRemaining(targetDate);
          const elDays = document.getElementById("hero-days");
          const elHours = document.getElementById("hero-hours");
          const elMins = document.getElementById("hero-minutes");
          const elSecs = document.getElementById("hero-seconds");
          if (elDays) elDays.textContent = String(t.days).padStart(2, '0');
          if (elHours) elHours.textContent = String(t.hours).padStart(2, '0');
          if (elMins) elMins.textContent = String(t.minutes).padStart(2, '0');
          if (elSecs) elSecs.textContent = String(t.seconds).padStart(2, '0');
        }
      }

      // 2. Update all grid cards
      document.querySelectorAll(".countdown-card").forEach(card => {
        const targetDate = card.getAttribute("data-target-date");
        if (targetDate) {
          const t = this.getTimeRemaining(targetDate);
          const cDays = card.querySelector(".card-days");
          const cHours = card.querySelector(".card-hours");
          const cMins = card.querySelector(".card-mins");
          const cSecs = card.querySelector(".card-secs");
          if (cDays) cDays.textContent = t.days;
          if (cHours) cHours.textContent = String(t.hours).padStart(2, '0');
          if (cMins) cMins.textContent = String(t.minutes).padStart(2, '0');
          if (cSecs) cSecs.textContent = String(t.seconds).padStart(2, '0');
        }
      });
    }, 1000);
  }

  stopLiveTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  openAddCustomModal() {
    const modal = document.getElementById("add-countdown-modal");
    if (modal) {
      const targetInput = document.getElementById("custom-countdown-date");
      if (targetInput && !targetInput.value) {
        const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        targetInput.value = defaultDate.toISOString().split("T")[0];
      }
      modal.classList.add("open");
    }
  }
}

window.countdownsEngine = new CountdownsEngine();
