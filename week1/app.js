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

  async function loadTSV() {
    setStatus("loading", "Loading reviews_test.tsv…");
    try {
      const res = await fetch("reviews_test.tsv", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch reviews_test.tsv (HTTP ${res.status})`);
      const tsvText = await res.text();

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

      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      reviews = rows.map(r => (r && typeof r.text === "string" ? r.text.trim() : ""))
                    .filter(Boolean);

      if (!reviews.length) throw new Error("No reviews found. Ensure the TSV has a 'text' column with content.");

      setStatus("ready", `Loaded ${reviews.length} reviews. Click “Analyze Random Review”.`);
      els.analyzeBtn.disabled = false;
    } catch (e) {
      setStatus("", "Failed to load TSV.");
      els.analyzeBtn.disabled = true;
      showError(e.message || String(e));
    }
  }

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

  function classifyFromHFOutput(payload) {
    // Expected: [[{label:'POSITIVE', score: number}, {label:'NEGATIVE', score:number}]]
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return { state: "neutral", label: "NEUTRAL", score: 0 };
    const arr = payload[0].filter(x => x && typeof x.label === "string" && typeof x.score === "number");
    if (!arr.length) return { state: "neutral", label: "NEUTRAL", score: 0 };
    arr.sort((a, b) => b.score - a.score);
    const top = arr[0];
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

    // Handle common transient statuses (e.g., model loading or rate limiting)
    if (res.status === 503) {
      throw new Error("Model is loading on Hugging Face. Please retry in a moment.");
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

  async function onAnalyzeClick() {
    clearError();
    if (!reviews.length) {
      showError("Reviews not loaded. Please check reviews_test.tsv.");
      return;
    }
    const reviewText = pickRandom(reviews);
    els.review.textContent = reviewText || "—";
    els.resultText.textContent = "Analyzing…";
    els.scoreText.textContent = "";
    setIcon("neutral");
    els.analyzeBtn.disabled = true;
    setStatus("loading", "Calling Hugging Face Inference API…");

    try {
      const result = await analyze(reviewText, els.token.value);
      setIcon(result.state);
      const pretty = result.score ? `Score: ${result.score.toFixed(4)}` : "";
      els.resultText.textContent = result.label;
      els.scoreText.textContent = pretty;
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
