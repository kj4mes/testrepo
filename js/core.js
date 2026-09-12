const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const homeStatParks = document.getElementById("homeStatParks");
  const homeStatOperators = document.getElementById("homeStatOperators");
  const homeStatActivations = document.getElementById("homeStatActivations");
  const homeStatQsos = document.getElementById("homeStatQsos");

  function formatHomeStat(value) {
    return Number(value || 0).toLocaleString();
  }

  async function loadHomeStats() {
    try {
      const { data, error } = await supabaseClient.rpc("cpw_public_stats");

      if (error) throw error;

      homeStatParks.textContent = formatHomeStat(data?.parks);
      homeStatOperators.textContent = formatHomeStat(data?.operators);
      homeStatActivations.textContent = formatHomeStat(data?.activations);
      homeStatQsos.textContent = formatHomeStat(data?.qsos);
    } catch (error) {
      console.error("Could not load home statistics:", error);
    }
  }

  const parkDetailStatus = document.getElementById("parkDetailStatus");
  const parkDetailContent = document.getElementById("parkDetailContent");
  const parkDetailBackButton = document.getElementById("parkDetailBackButton");

  function parkDetailDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  async function openParkDetails(referenceCode) {
    if (!referenceCode) return;

    parkDetailStatus.textContent = "Loading park details...";
    parkDetailContent.innerHTML = "";
    showPanel("park-detail", false);

    const url = new URL(window.location.href);
    url.searchParams.set("park", referenceCode);
    url.hash = "park-detail";
    history.replaceState(null, "", url);

    try {
      const { data, error } = await supabaseClient.rpc("cpw_park_details", {
        p_reference_code: referenceCode
      });

      if (error) throw error;

      if (!data?.park) {
        parkDetailStatus.textContent = "That park could not be found.";
        return;
      }

      const park = data.park;
      const stats = data.stats || {};
      const recent = data.recent_activations || [];
      const location = [park.city, park.state, park.zip_code].filter(Boolean).join(", ");
      const mapQuery =
        park.latitude != null && park.longitude != null
          ? `${park.latitude},${park.longitude}`
          : [park.name, park.city, park.state].filter(Boolean).join(", ");

      parkDetailStatus.textContent = "";

      parkDetailContent.innerHTML = `
        <div class="park-detail-hero">
          <div class="park-detail-ref">${escapeHTML(park.reference_code)}</div>
          <h2 class="park-detail-title">${escapeHTML(park.name)}</h2>
          <div class="park-detail-location">📍 ${escapeHTML(location)}</div>

          <div class="park-detail-actions">
            <a class="primary"
              href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}"
              target="_blank"
              rel="noopener noreferrer">Open in Google Maps</a>
            ${park.website_url ? `
              <a class="secondary"
                href="${escapeHTML(park.website_url)}"
                target="_blank"
                rel="noopener noreferrer">Park Website</a>` : ""}
          </div>
        </div>

        <div class="park-detail-stats">
          <div class="park-detail-stat">
            <strong>${Number(stats.activations || 0).toLocaleString()}</strong>
            Activations
          </div>
          <div class="park-detail-stat">
            <strong>${Number(stats.qsos || 0).toLocaleString()}</strong>
            Logged QSOs
          </div>
          <div class="park-detail-stat">
            <strong>${parkDetailDate(stats.first_activation_at)}</strong>
            First Activation
          </div>
        </div>

        <div class="park-detail-card">
          <h3>Park Information</h3>
          ${park.park_type ? `<p><strong>Type:</strong> ${escapeHTML(park.park_type)}</p>` : ""}
          ${park.county ? `<p><strong>County:</strong> ${escapeHTML(park.county)}</p>` : ""}
          ${park.address ? `<p><strong>Address:</strong> ${escapeHTML(park.address)}</p>` : ""}
          ${park.description ? `<p>${escapeHTML(park.description)}</p>` : ""}
          ${park.source_name ? `<p><strong>Data source:</strong> ${escapeHTML(park.source_name)}</p>` : ""}
        </div>

        <div class="park-detail-card">
          <h3>Recent Activations</h3>
          ${recent.length ? recent.map((activation) => `
            <div class="recent-activation-row">
              <div><strong>${escapeHTML(activation.station_callsign)}</strong></div>
              <div>${Number(activation.qso_count || 0).toLocaleString()} QSOs • ${parkDetailDate(activation.activation_at)}</div>
            </div>
          `).join("") : "<p>No activations have been submitted for this park yet.</p>"}
        </div>
      `;
\n      const suggestButton = document.getElementById("suggestParkDetailsButton");\n      if (suggestButton) {\n        suggestButton.addEventListener("click", async () => {\n          const status = document.getElementById("suggestParkDetailsStatus");\n          const { data: sessionData } = await supabaseClient.auth.getSession();\n          const session = sessionData?.session;\n          if (!session?.user) { status.textContent = "Sign in before suggesting park details."; return; }\n          const website = document.getElementById("suggestParkWebsite").value.trim();\n          const photo = document.getElementById("suggestParkPhoto").value.trim();\n          const address = document.getElementById("suggestParkAddress").value.trim();\n          const description = document.getElementById("suggestParkDescription").value.trim();\n          if (!website && !photo && !address && !description) { status.textContent = "Add at least one park detail before submitting."; return; }\n          status.textContent = "Submitting suggestion...";\n          const { error: suggestionError } = await supabaseClient.from("park_detail_submissions").insert({ park_id: park.id, submitted_by: session.user.id, website_url: website || null, photo_url: photo || null, address: address || null, description: description || null, status: "pending" });\n          if (suggestionError) { console.error(suggestionError); status.textContent = "Unable to submit suggestion: " + suggestionError.message; return; }\n          status.textContent = "✓ Park detail suggestion submitted for admin review.";\n          suggestButton.disabled = true;\n        });\n      }\n    } catch (error) {
      console.error(error);
      parkDetailStatus.textContent = "Unable to load park details.";
    }
  }

  parkDetailBackButton.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("park");
    url.hash = "parks";
    history.replaceState(null, "", url);
    showPanel("parks", false);
  });

  const menuButton = document.getElementById("menuButton");
  const menuPanel = document.getElementById("menuPanel");
  const panelLinks = Array.from(document.querySelectorAll("[data-panel-link]"));
  const appPanels = Array.from(document.querySelectorAll(".app-panel"));
  let currentUserIsAdmin = false;

  function showPanel(panelId, updateHash = true) {
    const adminPanel = panelId === "admin-review" || panelId === "admin-import";

    if (adminPanel && !currentUserIsAdmin) {
      panelId = "account";
    }

    const target = document.getElementById(panelId) || document.getElementById("home");

    appPanels.forEach((panel) => {
      panel.classList.toggle("active-panel", panel === target);
    });

    panelLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.panelLink === target.id);
    });

    menuPanel.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");

    if (updateHash && window.location.hash !== "#" + target.id) {
      history.replaceState(null, "", "#" + target.id);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (target.id === "parks" && nearbyMap) {
      setTimeout(() => nearbyMap.invalidateSize(), 100);
    }
  }

  panelLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPanel(link.dataset.panelLink);
    });
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = menuPanel.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!menuPanel.contains(event.target) && event.target !== menuButton) {
      menuPanel.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menuPanel.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("hashchange", () => {
    showPanel(window.location.hash.slice(1) || "home", false);
  });

  const initialParkReference = new URLSearchParams(window.location.search).get("park");

  if (initialParkReference) {
    openParkDetails(initialParkReference);
  } else {
    showPanel(window.location.hash.slice(1) || "home", false);
  }

  const searchInput = document.getElementById("parkSearch");
  const callsignInput = document.getElementById("callsignInput");
  const callsignButton = document.getElementById("callsignButton");
  const callsignStatus = document.getElementById("callsignStatus");
  const callsignResult = document.getElementById("callsignResult");
  const accountEmail = document.getElementById("accountEmail");
  const accountPassword = document.getElementById("accountPassword");
  const signUpButton = document.getElementById("signUpButton");
  const signInButton = document.getElementById("signInButton");
  const signOutButton = document.getElementById("signOutButton");
  const accountStatus = document.getElementById("accountStatus");
  const activationParkSearch = document.getElementById("activationParkSearch");
  const activationParkSearchButton = document.getElementById("activationParkSearchButton");
  const activationParkStatus = document.getElementById("activationParkStatus");
  const activationParkResults = document.getElementById("activationParkResults");
  const adifFile = document.getElementById("adifFile");
  const adifPreview = document.getElementById("adifPreview");
  const submitActivationButton = document.getElementById("submitActivationButton");
  const activationSubmitStatus = document.getElementById("activationSubmitStatus");
  const activationRequirement = document.getElementById("activationRequirement");
  const submitParkName = document.getElementById("submitParkName");
  const submitParkCity = document.getElementById("submitParkCity");
  const submitParkState = document.getElementById("submitParkState");
  const submitParkZip = document.getElementById("submitParkZip");
  const submitParkCounty = document.getElementById("submitParkCounty");
  const submitParkAddress = document.getElementById("submitParkAddress");
  const submitParkType = document.getElementById("submitParkType");
  const submitParkWebsite = document.getElementById("submitParkWebsite");
  const submitParkDescription = document.getElementById("submitParkDescription");
  const submitParkButton = document.getElementById("submitParkButton");
  const submitParkStatus = document.getElementById("submitParkStatus");
  const adminImportSection = document.getElementById("admin-import");
  const startNationwideImportButton = document.getElementById("startNationwideImportButton");
  const nationwideImportStatus = document.getElementById("nationwideImportStatus");
  const adminReviewSection = document.getElementById("admin-review");
  const refreshPendingParksButton = document.getElementById("refreshPendingParksButton");
  const pendingParksStatus = document.getElementById("pendingParksStatus");
  const pendingParksResults = document.getElementById("pendingParksResults");
  const adminParkSearch = document.getElementById("adminParkSearch");
  const adminParkSearchButton = document.getElementById("adminParkSearchButton");
  const adminParkSearchStatus = document.getElementById("adminParkSearchStatus");
  const adminParkSearchResults = document.getElementById("adminParkSearchResults");
  const adminParkEditor = document.getElementById("adminParkEditor");
  const editParkId = document.getElementById("editParkId");
  const editParkName = document.getElementById("editParkName");
  const editParkCity = document.getElementById("editParkCity");
  const editParkState = document.getElementById("editParkState");
  const editParkCounty = document.getElementById("editParkCounty");
  const editParkZip = document.getElementById("editParkZip");
  const editParkAddress = document.getElementById("editParkAddress");
  const editParkWebsite = document.getElementById("editParkWebsite");
  const editParkDescription = document.getElementById("editParkDescription");
  const editParkPhotoUrl = document.getElementById("editParkPhotoUrl");
  const editParkActive = document.getElementById("editParkActive");
  const saveParkChangesButton = document.getElementById("saveParkChangesButton");
  const adminParkEditStatus = document.getElementById("adminParkEditStatus");
  const refreshQualityReviewButton = document.getElementById("refreshQualityReviewButton");\n  const refreshParkDetailSuggestionsButton = document.getElementById("refreshParkDetailSuggestionsButton");\n  const parkDetailSuggestionsStatus = document.getElementById("parkDetailSuggestionsStatus");\n  const parkDetailSuggestionsResults = document.getElementById("parkDetailSuggestionsResults");
  const qualityReviewStatus = document.getElementById("qualityReviewStatus");
  const qualityReviewResults = document.getElementById("qualityReviewResults");
  const repairMunicipalitiesButton = document.getElementById("repairMunicipalitiesButton");
  const refreshActivationsButton = document.getElementById("refreshActivationsButton");
  const myActivationsStatus = document.getElementById("myActivationsStatus");
  const myActivationsResults = document.getElementById("myActivationsResults");
  const publicActivityStatus = document.getElementById("publicActivityStatus");
  const publicActivityFeed = document.getElementById("publicActivityFeed");
  const leaderboardStatus = document.getElementById("leaderboardStatus");
  const leaderboardResults = document.getElementById("leaderboardResults");
  const leaderboardMonthButton = document.getElementById("leaderboardMonthButton");
  const leaderboardAllButton = document.getElementById("leaderboardAllButton");

  let selectedActivationPark = null;
  let parsedAdifRecords = [];
  let currentActivationRequirement = 10;
  let currentActivationLicenseClass = null;

  function requiredQsosForLicenseClass(licenseClass) {
    const value = String(licenseClass || "").trim().toUpperCase();

    if (["T", "TECH", "TECHNICIAN"].includes(value)) return 5;
    if (["G", "GENERAL"].includes(value)) return 10;
    if (["E", "EXTRA", "AMATEUR EXTRA", "AMATEUR EXTRA CLASS"].includes(value)) return 10;

    return 10;
  }

  function updateActivationRequirementDisplay(operator) {
    if (!operator?.callsign_verified) {
      currentActivationRequirement = 10;
      currentActivationLicenseClass = null;
      activationRequirement.textContent =
        "Sign in with a verified callsign to see your QSO requirement.";
      return;
    }

    currentActivationLicenseClass = operator.license_class || "Unknown";
    currentActivationRequirement =
      requiredQsosForLicenseClass(currentActivationLicenseClass);

    activationRequirement.textContent =
      `Verified callsign: ${operator.callsign} • License class: ${currentActivationLicenseClass} • ${currentActivationRequirement} valid QSOs required`;
  }
  const searchButton = document.getElementById("searchButton");
  const statusBox = document.getElementById("status");
  const resultsBox = document.getElementById("results");
  const nearMeButton = document.getElementById("nearMeButton");
  const parkQualityFilter = document.getElementById("parkQualityFilter");
  const nearbyStatus = statusBox;
  const nearbyResults = resultsBox;
  let nearbyMap = null;
  let nearbyLayer = null;
  let lastNearbySearch = null;
