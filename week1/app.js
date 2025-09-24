// app.js (fixed)
 // Hugging Face Inference API call
(() => {
  const MODEL_URL = "https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english";

  const els = {
    status: document.getElementById("status"),
    statusText: document.querySelector("#status .text"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    token: document.getElementById("hfToken"),
    review: document.getElementById("review"),
    resultIcon: document.getElementById("resultIcon"),
    resultText: document.getElementById("resultText"),
    scoreText: document.getElementById("scoreText"),
    errorBox: document.getElementById("errorBox"),
  };

  let reviews = [];

  function setStatus(state, text) {
    els.status.classList.remove("loading", "ready");
    if (state) els.status.classList.add(state);
    els.statusText.textContent = text || "";
  }

  function showError(msg) {
    els.errorBox.style.display = "block";
    els.errorBox.textContent = msg;
  }

  function clearError() {
    els.errorBox.style.display = "none";
    els.errorBox.textContent = "";
  }

  // --- TSV loading helpers (robust against 404s on GitHub Pages) ---
  function getTSVPathCandidates() {
    const urlParamOverride = new URLSearchParams(location.search).get("tsv");
    if (urlParamOverride) {
      return [urlParamOverride];
    }

    // Compute current directory (works on GitHub Pages project sites like /user/repo/)
    const path = location.pathname;
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    // Try the most common relative locations
    const candidates = [
      "reviews_test.tsv",
      "./reviews_test.tsv",
      "data/reviews_test.tsv",
      "./data/reviews_test.tsv",
      // Explicitly anchored to current directory (important on GH Pages)
      dir + "reviews_test.tsv",
      dir + "data/reviews_test.tsv",
    ];

    // Deduplicate while preserving order
    const seen = new Set();
    return candidates.filter(p => (seen.has(p) ? false : (seen.add(p), true)));
  }
// failure - handling 
  async function tryFetchFirstAvailable(paths) {
    const attempts = [];
    for (const p of paths) {
      try {
        setStatus("loading", `Loading ${p}…`);
        const res = await fetch(p, { cache: "no-store" });
        if (!res.ok) {
          attempts.push(`${p} → HTTP ${res.status}`);
          continue;
        }
        const text = await res.text();
        return { text, path: p, attempts };
      } catch (e) {
        attempts.push(`${p} → ${e.message || "network error"}`);
      }
    }
    const err = attempts.length ? `All TSV fetch attempts failed:\n• ${attempts.join("\n• ")}` : "Could not fetch TSV.";
    throw new Error(err);
  }
  // --- end TSV helpers ---

  async function loadTSV() {
    setStatus("loading", "Loading reviews_test.tsv…");
    try {
      const candidates = getTSVPathCandidates();
      const { text: tsvText, path: usedPath, attempts } = await tryFetchFirstAvailable(candidates);
      
// Data handling via Papa Parse and TSV file
      const parsed = Papa.parse(tsvText, {
        header: true,
        delimiter: "\t",
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
      });

      if (parsed.errors && parsed.errors.length) {
        const firstErr = parsed.errors[0];
        console.warn("Papa Parse errors:", parsed.errors);
        showError(`Parsing warning: ${firstErr.message} at row ${firstErr.row}`);
      }
// extract reviews
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      reviews = rows.map(r => (r && typeof r.text === "string" ? r.text.trim() : "")).filter(Boolean);

      if (!reviews.length) {
        const extra = attempts && attempts.length ? `\nTried:\n- ${attempts.join("\n- ")}` : "";
        throw new Error("No reviews found. Ensure the TSV has a 'text' column with content." + extra);
      }

      const msg = `Loaded ${reviews.length} reviews from “${usedPath}”. Click “Analyze Random Review”.`;
      setStatus("ready", msg);
      els.analyzeBtn.disabled = false;
      clearError();
    } catch (e) {
      setStatus("", "Failed to load TSV.");
      els.analyzeBtn.disabled = true;
      showError(e.message || String(e));
    }
  }
// picking random review and displaying it
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setIcon(state) {
    els.resultIcon.className = "icon";
    let cls = "neu";
    let icon = "fa-question";
    if (state === "positive") { cls = "pos"; icon = "fa-thumbs-up"; }
    else if (state === "negative") { cls = "neg"; icon = "fa-thumbs-down"; }
    els.resultIcon.classList.add(cls);
    els.resultIcon.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  }
// parsing of API response 
  function classifyFromHFOutput(payload) {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return { state: "neutral", label: "NEUTRAL", score: 0 };
    const arr = payload[0].filter(x => x && typeof x.label === "string" && typeof x.score === "number");
    if (!arr.length) return { state: "neutral", label: "NEUTRAL", score: 0 };
    arr.sort((a, b) => b.score - a.score);
    const top = arr[0];
// Classification of review via icon
    if (top.score > 0.5 && top.label.toUpperCase().includes("POSITIVE")) return { state: "positive", label: "POSITIVE", score: top.score };
    if (top.score > 0.5 && top.label.toUpperCase().includes("NEGATIVE")) return { state: "negative", label: "NEGATIVE", score: top.score };
    return { state: "neutral", label: "NEUTRAL", score: top.score };
  }

  async function analyze(reviewText, token) {
    const headers = { "Content-Type": "application/json" };
    if (token && token.trim()) headers["Authorization"] = `Bearer ${token.trim()}`;

    const res = await fetch(MODEL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: reviewText }),
    });

    if (res.status === 503) {
      throw new Error("Model is loading on Hugging Face. Please retry.");
    }
    if (res.status === 429) {
      throw new Error("Rate limit reached. Add a valid API token or wait and try again.");
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.error || ""; } catch {}
      throw new Error(`API error (HTTP ${res.status}) ${detail ? "— " + detail : ""}`);
    }

    const data = await res.json();
    return classifyFromHFOutput(data);
  }
//validation of reviews
  async function onAnalyzeClick() {
    clearError();
    if (!reviews.length) {
      showError("Reviews not loaded. Please ensure reviews_test.tsv is present.");
      return;
    }
    const reviewText = pickRandom(reviews);
    els.review.textContent = reviewText || "—";
    els.resultText.textContent = "Analyzing…";
    els.scoreText.textContent = "";
    setIcon("neutral");
    els.analyzeBtn.disabled = true;
    setStatus("loading", "Calling Hugging Face Inference API…");
    
// User input (Hugging face API token)
    try {
      const result = await analyze(reviewText, els.token.value);
      setIcon(result.state);
      els.resultText.textContent = result.label;
      els.scoreText.textContent = result.score ? `Score: ${result.score.toFixed(4)}` : "";
      setStatus("ready", "Analysis complete.");
    } catch (e) {
      showError(e.message || String(e));
      setIcon("neutral");
      els.resultText.textContent = "Error";
      els.scoreText.textContent = "";
      setStatus("", "Error during analysis.");
    } finally {
      els.analyzeBtn.disabled = false;
    }
  }

  els.analyzeBtn.addEventListener("click", onAnalyzeClick);
  els.analyzeBtn.disabled = true;

  loadTSV();
})();
