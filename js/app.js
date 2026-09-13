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

      const suggestButton = document.getElementById("suggestParkDetailsButton");
      if (suggestButton) {
        suggestButton.addEventListener("click", async () => {
          const status = document.getElementById("suggestParkDetailsStatus");
          const { data: sessionData } = await supabaseClient.auth.getSession();
          const session = sessionData?.session;
          if (!session?.user) { status.textContent = "Sign in before suggesting park details."; return; }
          const website = document.getElementById("suggestParkWebsite").value.trim();
          const photo = document.getElementById("suggestParkPhoto").value.trim();
          const address = document.getElementById("suggestParkAddress").value.trim();
          const description = document.getElementById("suggestParkDescription").value.trim();
          if (!website && !photo && !address && !description) { status.textContent = "Add at least one park detail before submitting."; return; }
          status.textContent = "Submitting suggestion...";
          const { error: suggestionError } = await supabaseClient.from("park_detail_submissions").insert({ park_id: park.id, submitted_by: session.user.id, website_url: website || null, photo_url: photo || null, address: address || null, description: description || null, status: "pending" });
          if (suggestionError) { console.error(suggestionError); status.textContent = "Unable to submit suggestion: " + suggestionError.message; return; }
          status.textContent = "✓ Park detail suggestion submitted for admin review.";
          suggestButton.disabled = true;
        });
      }
    } catch (error) {
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
  const feedbackCategory = document.getElementById("feedbackCategory");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const submitFeedbackButton = document.getElementById("submitFeedbackButton");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const refreshFeedbackButton = document.getElementById("refreshFeedbackButton");
  const adminFeedbackStatus = document.getElementById("adminFeedbackStatus");
  const adminFeedbackResults = document.getElementById("adminFeedbackResults");
  const operatorProfileStatus = document.getElementById("operatorProfileStatus");
  const operatorProfileContent = document.getElementById("operatorProfileContent");
  const operatorProfileBackButton = document.getElementById("operatorProfileBackButton");
  const profileEditor = document.getElementById("profileEditor");
  const profileState = document.getElementById("profileState");
  const profileGrid = document.getElementById("profileGrid");
  const profileAvatarUrl = document.getElementById("profileAvatarUrl");
  const profileQrzUrl = document.getElementById("profileQrzUrl");
  const profileBio = document.getElementById("profileBio");
  const profilePublic = document.getElementById("profilePublic");
  const saveProfileButton = document.getElementById("saveProfileButton");
  const profileSaveStatus = document.getElementById("profileSaveStatus");
  const activationParkSearch = document.getElementById("activationParkSearch");
  const activationParkSearchButton = document.getElementById("activationParkSearchButton");
  const activationParkStatus = document.getElementById("activationParkStatus");
  const activationParkResults = document.getElementById("activationParkResults");
  const adifFile = document.getElementById("adifFile");
  const adifPreview = document.getElementById("adifPreview");
  const submitActivationButton = document.getElementById("submitActivationButton");
  const activationSubmitStatus = document.getElementById("activationSubmitStatus");
  const activationRequirement = document.getElementById("activationRequirement");
  const quickLoggerOperatorStatus = document.getElementById("quickLoggerOperatorStatus");
  const quickLoggerParkSearch = document.getElementById("quickLoggerParkSearch");
  const quickLoggerParkSearchButton = document.getElementById("quickLoggerParkSearchButton");
  const quickLoggerParkSearchStatus = document.getElementById("quickLoggerParkSearchStatus");
  const quickLoggerParkResults = document.getElementById("quickLoggerParkResults");
  const quickLoggerSelectedPark = document.getElementById("quickLoggerSelectedPark");
  const quickLoggerCall = document.getElementById("quickLoggerCall");
  const quickLoggerBand = document.getElementById("quickLoggerBand");
  const quickLoggerMode = document.getElementById("quickLoggerMode");
  const quickLoggerRstSent = document.getElementById("quickLoggerRstSent");
  const quickLoggerRstReceived = document.getElementById("quickLoggerRstReceived");
  const quickLoggerGrid = document.getElementById("quickLoggerGrid");
  const quickLoggerAddQsoButton = document.getElementById("quickLoggerAddQsoButton");
  const quickLoggerEntryStatus = document.getElementById("quickLoggerEntryStatus");
  const quickLoggerProgressText = document.getElementById("quickLoggerProgressText");
  const quickLoggerProgressCount = document.getElementById("quickLoggerProgressCount");
  const quickLoggerProgressBar = document.getElementById("quickLoggerProgressBar");
  const quickLoggerQsoList = document.getElementById("quickLoggerQsoList");
  const quickLoggerClearButton = document.getElementById("quickLoggerClearButton");
  const quickLoggerExportButton = document.getElementById("quickLoggerExportButton");
  const quickLoggerSubmitButton = document.getElementById("quickLoggerSubmitButton");
  const quickLoggerSubmitStatus = document.getElementById("quickLoggerSubmitStatus");
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
  const refreshQualityReviewButton = document.getElementById("refreshQualityReviewButton");
  const refreshParkDetailSuggestionsButton = document.getElementById("refreshParkDetailSuggestionsButton");
  const parkDetailSuggestionsStatus = document.getElementById("parkDetailSuggestionsStatus");
  const parkDetailSuggestionsResults = document.getElementById("parkDetailSuggestionsResults");
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

  const QUICK_LOGGER_STORAGE_KEY = "cpwQuickLoggerDraftV1";
  let quickLoggerDraft = {
    park: null,
    qsos: []
  };
  let quickLoggerOperator = null;

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

  function activationMarkerLevel(count) {
    const value = Math.max(0, Number(count || 0));

    if (value === 0) return { key: "none", label: "0", range: "0 activations" };
    if (value <= 4) return { key: "low", label: "1–4", range: "1–4 activations" };
    if (value <= 9) return { key: "moderate", label: "5–9", range: "5–9 activations" };
    if (value <= 24) return { key: "active", label: "10–24", range: "10–24 activations" };
    if (value <= 49) return { key: "busy", label: "25–49", range: "25–49 activations" };
    if (value <= 99) return { key: "hot", label: "50–99", range: "50–99 activations" };

    return { key: "century", label: "100+", range: "100+ activations" };
  }

  function parkActivationIcon(park) {
    const count = Math.max(0, Number(park?.activation_count || 0));
    const level = activationMarkerLevel(count);
    const reference = String(park?.reference_code || "CPW PARK").trim();
    const name = String(park?.name || "Park").trim();
    const markerTitle = `${name} • ${reference} • ${count} activation${count === 1 ? "" : "s"}`;

    return L.divIcon({
      className: "park-activation-marker-wrap",
      html:
        `<div class="park-identity-marker" title="${escapeHTML(markerTitle)}">` +
          `<span class="park-activation-marker park-activation-${level.key}" aria-hidden="true"></span>` +
          `<span class="park-identity-label">${escapeHTML(reference)}</span>` +
        `</div>`,
      iconSize: [150, 30],
      iconAnchor: [11, 15],
      popupAnchor: [0, -16]
    });
  }

  function addActivationLegend(map) {
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function() {
      const div = L.DomUtil.create("div", "activation-map-legend");
      const levels = [
        ["none", "0"],
        ["low", "1–4"],
        ["moderate", "5–9"],
        ["active", "10–24"],
        ["busy", "25–49"],
        ["hot", "50–99"],
        ["century", "100+"]
      ];

      div.innerHTML =
        '<div class="activation-map-legend-title">Activations</div>' +
        levels.map(([key, label]) =>
          `<div class="activation-map-legend-row"><span class="activation-map-legend-dot park-activation-${key}"></span><span>${label}</span></div>`
        ).join("");

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };

    legend.addTo(map);
  }

  function ensureNearbyMap(lat, lon) {
    if (nearbyMap) {
      nearbyMap.remove();
      nearbyMap = null;
      nearbyLayer = null;
    }

    nearbyMap = L.map("nearbyMap", {
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      touchZoom: true
    }).setView([lat, lon], 11);

    nearbyMap.on("click", () => {
      document
        .querySelectorAll(".park-identity-marker.show-identity")
        .forEach((item) => item.classList.remove("show-identity"));
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(nearbyMap);

    nearbyLayer = L.layerGroup().addTo(nearbyMap);
    addActivationLegend(nearbyMap);

    const userLocationIcon = L.divIcon({
      className: "user-location-star-icon",
      html: '<div class="user-location-star" aria-hidden="true">★</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18]
    });

    L.marker([lat, lon], { icon: userLocationIcon, zIndexOffset: 1000 })
      .bindPopup("<strong>Your location</strong>")
      .addTo(nearbyLayer);

    setTimeout(() => nearbyMap.invalidateSize(), 100);
  }

  async function findNearbyParks() {
    statusBox.textContent = "";
    resultsBox.innerHTML = "";

    if (!navigator.geolocation) {
      statusBox.textContent =
        "Location services are not supported by this browser.";
      return;
    }

    nearMeButton.disabled = true;
    statusBox.textContent = "Getting your location...";

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await renderNearbyParks(
            position.coords.latitude,
            position.coords.longitude,
            "your current location"
          );
        } finally {
          nearMeButton.disabled = false;
        }
      },
      (error) => {
        console.error(error);
        statusBox.textContent =
          "Location permission was not granted or your location could not be determined.";
        nearMeButton.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  nearMeButton.addEventListener("click", findNearbyParks);

  parkQualityFilter.addEventListener("change", () => {
    if (lastNearbySearch) {
      renderNearbyParks(
        lastNearbySearch.lat,
        lastNearbySearch.lon,
        lastNearbySearch.label
      );
    }
  });

  async function renderNearbyParks(lat, lon, label) {
    lastNearbySearch = { lat, lon, label };
    ensureNearbyMap(lat, lon);
    statusBox.textContent = label ? `Finding parks near ${label}...` : "Finding nearby parks...";
    resultsBox.innerHTML = "";

    try {
      const response = await fetch(
        `/api/nearby-parks?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=25&quality=${encodeURIComponent(parkQualityFilter.value)}`
      );

      const parks = await response.json();

      if (!response.ok) {
        statusBox.textContent =
          parks.error || "Unable to search nearby parks.";
        return;
      }

      if (!parks.length) {
        statusBox.textContent =
          "No mapped parks were found nearby yet.";
        return;
      }

      statusBox.textContent =
        `Showing the ${parks.length} nearest mapped park${parks.length === 1 ? "" : "s"}` +
        (label ? ` near ${label}.` : ".");

      const bounds = [[lat, lon]];

      parks.forEach((park) => {
        const plat = Number(park.latitude);
        const plon = Number(park.longitude);

        if (Number.isFinite(plat) && Number.isFinite(plon)) {
          bounds.push([plat, plon]);

          const activationCount = Math.max(0, Number(park.activation_count || 0));

          const parkMarker = L.marker([plat, plon], {
            icon: parkActivationIcon(park)
          })
            .bindPopup(
              `<strong>${escapeHTML(park.name)}</strong><br>` +
              (park.reference_code ? `${escapeHTML(park.reference_code)}<br>` : "") +
              `${Number(park.distance_miles).toFixed(1)} mi away<br>` +
              `<strong>${activationCount.toLocaleString()}</strong> activation${activationCount === 1 ? "" : "s"}`
            )
            .addTo(nearbyLayer);

          parkMarker.on("click", () => {
            document
              .querySelectorAll(".park-identity-marker.show-identity")
              .forEach((item) => item.classList.remove("show-identity"));

            const element = parkMarker.getElement();
            const identity = element?.querySelector(".park-identity-marker");
            if (identity) {
              identity.classList.add("show-identity");
            }
          });
        }

        const card = document.createElement("div");
        card.className = "park-result";

        card.innerHTML = `
          <h3>${escapeHTML(park.name)}</h3>
          <p><strong>Location:</strong> ${escapeHTML([park.city, park.state, park.zip_code].filter(Boolean).join(", "))}</p>
          <p><strong>Distance:</strong> ${Number(park.distance_miles).toFixed(1)} miles</p>
          ${park.reference_code ? `<p><strong>CPW:</strong> ${escapeHTML(park.reference_code)}</p>` : ""}
          ${Number(park.activation_count || 0) > 0 ? `<p><strong>📡 Activity:</strong> ${Number(park.activation_count).toLocaleString()} activation${Number(park.activation_count) === 1 ? "" : "s"}</p>` : ""}
          ${park.photo_url ? `<img src="${escapeHTML(park.photo_url)}" alt="${escapeHTML(park.name)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-top:10px;">` : ""}
          ${park.website_url ? `<a class="map-link" href="${escapeHTML(park.website_url)}" target="_blank" rel="noopener noreferrer">Park Website</a>` : ""}
          <a
            class="map-link"
            href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${park.latitude},${park.longitude}`)}"
            target="_blank"
            rel="noopener noreferrer"
          >View on Google Maps</a>
          ${park.reference_code ? `<button class="park-detail-button" data-park-ref="${escapeHTML(park.reference_code)}">Park Details</button>` : ""}
        `;

        const detailsButton = card.querySelector("[data-park-ref]");
        if (detailsButton) {
          detailsButton.addEventListener("click", () => {
            openParkDetails(detailsButton.dataset.parkRef);
          });
        }

        resultsBox.appendChild(card);
      });

      if (bounds.length > 1) {
        nearbyMap.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 12
        });
        setTimeout(() => nearbyMap.invalidateSize(), 100);
      }

    } catch (error) {
      console.error(error);
      statusBox.textContent = "Unable to search nearby parks.";
    }
  }

  async function geocodeArea(searchTerm) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Location lookup failed.");
    }

    const results = await response.json();

    if (!results.length) {
      return null;
    }

    return {
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
      label: results[0].display_name || searchTerm
    };
  }

  async function searchParks() {
    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
      statusBox.textContent = "Enter a ZIP code, city, or county.";
      resultsBox.innerHTML = "";
      return;
    }

    statusBox.textContent = "Finding that area...";
    resultsBox.innerHTML = "";

    try {
      const location = await geocodeArea(searchTerm);

      if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        statusBox.textContent = "That location could not be found.";
        return;
      }

      await renderNearbyParks(location.lat, location.lon, searchTerm);

    } catch (error) {
      console.error(error);
      statusBox.textContent = "Unable to look up that location.";
    }
  }

  function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  searchButton.addEventListener("click", searchParks);

  searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      searchParks();
    }
  });

  async function verifyCallsign() {
    const callsign = callsignInput.value.trim().toUpperCase();

    callsignInput.value = callsign;
    callsignResult.innerHTML = "";

    if (!callsign) {
      callsignStatus.textContent = "Enter a callsign.";
      return;
    }

    callsignStatus.textContent = "Checking FCC records...";

    try {
      const response = await fetch(
        `/api/verify-callsign?callsign=${encodeURIComponent(callsign)}`
      );

      const data = await response.json();

      if (!response.ok) {
        callsignStatus.textContent =
          data.error || "Unable to verify callsign.";
        return;
      }

      if (!data.found) {
        callsignStatus.textContent =
          `${callsign} was not found in the FCC license search.`;
        return;
      }

      if (!data.amateur) {
        callsignStatus.textContent =
          `${callsign} was found, but it is not an amateur radio license.`;
        return;
      }

      if (!data.active) {
        callsignStatus.textContent =
          `${callsign} is not currently active.`;
      } else {
        callsignStatus.textContent =
          `✓ ${callsign} is an active amateur radio callsign.`;
      }

      const card = document.createElement("div");
      card.className = "park-result";

      card.innerHTML = `
        <h3>${escapeHTML(data.callsign)}</h3>
        <p><strong>Status:</strong> ${escapeHTML(data.status || "Unknown")}</p>
        ${data.service ? `<p><strong>Service:</strong> ${escapeHTML(data.service)}</p>` : ""}
        ${data.expiration ? `<p><strong>Expiration:</strong> ${escapeHTML(data.expiration)}</p>` : ""}
        ${data.licensee_name ? `<p><strong>Licensee:</strong> ${escapeHTML(data.licensee_name)}</p>` : ""}
        <p><strong>Verified:</strong> ${data.verified ? "Yes" : "No"}</p>
      `;

      callsignResult.appendChild(card);

      if (data.verified) {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData?.session;

        if (session?.user) {
          let expirationDate = null;

          if (data.expiration) {
            const mmddyyyy = String(data.expiration).match(
              /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
            );

            if (mmddyyyy) {
              const [, month, day, year] = mmddyyyy;
              expirationDate =
                `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(data.expiration))) {
              expirationDate = String(data.expiration);
            }
          }

          const profileValues = {
            auth_user_id: session.user.id,
            callsign: data.callsign,
            callsign_status: "active",
            license_class: data.service || null,
            license_expiration: expirationDate,
            callsign_verified: true,
            callsign_verified_at: new Date().toISOString(),
            verification_source: data.source || "HamDB / FCC ULS",
            updated_at: new Date().toISOString()
          };

          const { data: existingProfile, error: profileLookupError } =
            await supabaseClient
              .from("operators")
              .select("id")
              .eq("auth_user_id", session.user.id)
              .maybeSingle();

          let saveError = profileLookupError;

          if (!saveError) {
            if (existingProfile?.id) {
              const result = await supabaseClient
                .from("operators")
                .update(profileValues)
                .eq("id", existingProfile.id);

              saveError = result.error;
            } else {
              const result = await supabaseClient
                .from("operators")
                .insert(profileValues);

              saveError = result.error;
            }
          }

          if (!saveError) {
            const { data: confirmedProfile, error: confirmError } =
              await supabaseClient
                .from("operators")
                .select("callsign,callsign_verified")
                .eq("auth_user_id", session.user.id)
                .maybeSingle();

            if (confirmError || !confirmedProfile?.callsign_verified) {
              saveError = confirmError || new Error("Profile verification could not be confirmed.");
            }
          }

          if (saveError) {
            console.error(saveError);
            callsignStatus.textContent +=
              " Verification worked, but the callsign could not be saved to your account: " +
              (saveError.message || "unknown error");
          } else {
            callsignStatus.textContent +=
              " Saved to your operator account.";
            await refreshAccountStatus();
          }
        } else {
          callsignStatus.textContent +=
            " Sign in above to save this verified callsign to your account.";
        }
      }

    } catch (error) {
      console.error(error);
      callsignStatus.textContent =
        "Unable to reach the callsign verification service.";
    }
  }

  callsignButton.addEventListener("click", verifyCallsign);

  callsignInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      verifyCallsign();
    }
  });


  async function submitMissingPark() {
    submitParkStatus.textContent = "";

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      submitParkStatus.textContent = "Sign in before submitting a park.";
      return;
    }

    const name = submitParkName.value.trim();
    const city = submitParkCity.value.trim();
    const state = submitParkState.value.trim().toUpperCase();
    const zip = submitParkZip.value.trim();

    if (!name || !city || state.length !== 2) {
      submitParkStatus.textContent =
        "Park name, city, and a 2-letter state code are required.";
      return;
    }

    submitParkStatus.textContent = "Checking for possible duplicates...";

    try {
      const response = await fetch(
        `/api/parks?q=${encodeURIComponent(name + " " + city + " " + state)}`
      );

      if (response.ok) {
        const parks = await response.json();

        const likelyDuplicate = parks.find((park) => {
          const sameName =
            String(park.name || "").trim().toLowerCase() === name.toLowerCase();
          const sameCity =
            String(park.city || "").trim().toLowerCase() === city.toLowerCase();
          const sameState =
            String(park.state || "").trim().toUpperCase() === state;

          return sameName && sameCity && sameState;
        });

        if (likelyDuplicate) {
          submitParkStatus.textContent =
            "That park appears to already be in the database.";
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }

    submitParkStatus.textContent = "Submitting park for review...";

    const { error } = await supabaseClient
      .from("park_submissions")
      .insert({
        submitted_by: session.user.id,
        name,
        city,
        state,
        zip_code: zip || null,
        county: submitParkCounty.value.trim() || null,
        address: submitParkAddress.value.trim() || null,
        park_type: submitParkType.value.trim() || null,
        website_url: submitParkWebsite.value.trim() || null,
        description: submitParkDescription.value.trim() || null,
        status: "pending"
      });

    if (error) {
      console.error(error);
      submitParkStatus.textContent =
        "Unable to submit the park: " + error.message;
      return;
    }

    submitParkStatus.textContent =
      "✓ Park submitted for review. Thank you for helping grow City Park Waves.";

    submitParkName.value = "";
    submitParkCity.value = "";
    submitParkState.value = "";
    submitParkZip.value = "";
    submitParkCounty.value = "";
    submitParkAddress.value = "";
    submitParkType.value = "";
    submitParkWebsite.value = "";
    submitParkDescription.value = "";
  }

  submitParkButton.addEventListener("click", submitMissingPark);

  function fillParkEditor(data) {
    editParkId.value = data.id;
    editParkName.value = data.name || "";
    editParkCity.value = data.city || "";
    editParkState.value = data.state || "";
    editParkCounty.value = data.county || "";
    editParkZip.value = data.zip_code || "";
    editParkAddress.value = data.address || "";
    editParkWebsite.value = data.website_url || "";
    editParkPhotoUrl.value = data.photo_url || "";
    editParkDescription.value = data.description || "";
    editParkActive.checked = Boolean(data.is_active);
    adminParkEditor.style.display = "block";
    adminParkEditStatus.textContent = "";
    adminParkEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadParkDetailSuggestions() {
    parkDetailSuggestionsResults.innerHTML = "";
    parkDetailSuggestionsStatus.textContent = "Loading pending detail suggestions...";

    const { data, error } = await supabaseClient
      .from("park_detail_submissions")
      .select("id,park_id,website_url,photo_url,address,description,created_at,parks(reference_code,name,city,state)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      parkDetailSuggestionsStatus.textContent = "Unable to load detail suggestions: " + error.message;
      return;
    }

    if (!data?.length) {
      parkDetailSuggestionsStatus.textContent = "No pending park detail suggestions.";
      return;
    }

    parkDetailSuggestionsStatus.textContent = `${data.length} pending suggestion${data.length === 1 ? "" : "s"}.`;

    data.forEach((submission) => {
      const park = submission.parks || {};
      const card = document.createElement("div");
      card.className = "park-result";
      card.innerHTML = `
        <h3>${escapeHTML(park.name || "Park")}</h3>
        <p><strong>CPW:</strong> ${escapeHTML(park.reference_code || "")}</p>
        <p><strong>Location:</strong> ${escapeHTML([park.city, park.state].filter(Boolean).join(", "))}</p>
        ${submission.website_url ? `<p><strong>Website:</strong> ${escapeHTML(submission.website_url)}</p>` : ""}
        ${submission.photo_url ? `<p><strong>Photo:</strong> ${escapeHTML(submission.photo_url)}</p>` : ""}
        ${submission.address ? `<p><strong>Address:</strong> ${escapeHTML(submission.address)}</p>` : ""}
        ${submission.description ? `<p><strong>Description:</strong> ${escapeHTML(submission.description)}</p>` : ""}
      `;

      const actions = document.createElement("div");
      actions.style.marginTop = "12px";

      ["approved", "rejected"].forEach((action) => {
        const button = document.createElement("button");
        button.textContent = action === "approved" ? "Approve Details" : "Reject";
        button.style.marginRight = "8px";
        button.addEventListener("click", async () => {
          button.disabled = true;
          const { error: reviewError } = await supabaseClient.rpc("admin_review_park_detail_submission", {
            p_submission_id: submission.id,
            p_action: action,
            p_review_notes: null
          });
          if (reviewError) {
            alert("Review failed: " + reviewError.message);
            button.disabled = false;
            return;
          }
          await loadParkDetailSuggestions();
        });
        actions.appendChild(button);
      });

      card.appendChild(actions);
      parkDetailSuggestionsResults.appendChild(card);
    });
  }

  if (refreshParkDetailSuggestionsButton) {
    refreshParkDetailSuggestionsButton.addEventListener("click", loadParkDetailSuggestions);
  }
  async function loadQualityReviewParks() {
    qualityReviewResults.innerHTML = "";
    qualityReviewStatus.textContent = "Loading flagged parks...";

    const { data, error } = await supabaseClient
      .from("parks")
      .select("id,reference_code,name,city,state,county,zip_code,address,website_url,description,is_active,needs_review,data_quality_notes,source_name")
      .eq("needs_review", true)
      .order("state", { ascending: true })
      .order("name", { ascending: true })
      .limit(100);

    if (error) {
      console.error(error);
      qualityReviewStatus.textContent =
        "Unable to load flagged parks: " + error.message;
      return;
    }

    if (!data?.length) {
      qualityReviewStatus.textContent = "No parks are currently flagged for review.";
      return;
    }

    qualityReviewStatus.textContent =
      `Showing ${data.length} flagged park${data.length === 1 ? "" : "s"}.`;

    data.forEach((park) => {
      const card = document.createElement("div");
      card.className = "park-result";

      card.innerHTML = `
        <h3>${escapeHTML(park.name)}</h3>
        <p><strong>CPW:</strong> ${escapeHTML(park.reference_code || "Not assigned")}</p>
        <p><strong>Location:</strong> ${escapeHTML([park.city, park.state, park.zip_code].filter(Boolean).join(", "))}</p>
        ${park.data_quality_notes ? `<p><strong>Flag:</strong> ${escapeHTML(park.data_quality_notes)}</p>` : ""}
        ${park.source_name ? `<p><strong>Source:</strong> ${escapeHTML(park.source_name)}</p>` : ""}
      `;

      const actions = document.createElement("div");
      actions.style.marginTop = "12px";

      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.style.marginRight = "8px";
      editButton.addEventListener("click", () => fillParkEditor(park));

      const resolveButton = document.createElement("button");
      resolveButton.textContent = "Mark Resolved";
      resolveButton.style.marginRight = "8px";
      resolveButton.addEventListener("click", async () => {
        const { error } = await supabaseClient
          .from("parks")
          .update({
            needs_review: false,
            data_quality_notes: null
          })
          .eq("id", park.id);

        if (error) {
          alert("Could not resolve park: " + error.message);
          return;
        }

        await loadQualityReviewParks();
      });

      const deactivateButton = document.createElement("button");
      deactivateButton.textContent = "Deactivate";
      deactivateButton.addEventListener("click", async () => {
        if (!confirm(`Deactivate ${park.name}?`)) return;

        const { error } = await supabaseClient
          .from("parks")
          .update({
            is_active: false,
            needs_review: false,
            data_quality_notes: "Deactivated during admin data-quality review."
          })
          .eq("id", park.id);

        if (error) {
          alert("Could not deactivate park: " + error.message);
          return;
        }

        await loadQualityReviewParks();
      });

      actions.appendChild(editButton);
      actions.appendChild(resolveButton);
      actions.appendChild(deactivateButton);
      card.appendChild(actions);
      qualityReviewResults.appendChild(card);
    });
  }


  async function getRepairAccessToken() {
    const { data: refreshed, error: refreshError } =
      await supabaseClient.auth.refreshSession();

    if (!refreshError && refreshed?.session?.access_token) {
      return refreshed.session.access_token;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    return sessionData?.session?.access_token || null;
  }

  async function repairMissingMunicipalities() {
    if (!confirm("Use U.S. Census coordinate lookup to auto-fill missing municipalities?")) {
      return;
    }

    repairMunicipalitiesButton.disabled = true;

    let totalProcessed = 0;
    let totalRepaired = 0;
    let unchangedBatches = 0;

    try {
      while (true) {
        const accessToken = await getRepairAccessToken();

        if (!accessToken) {
          throw new Error("Your sign-in session expired. Please sign in again.");
        }

        qualityReviewStatus.textContent =
          `Repairing missing municipalities... ${totalRepaired} updated so far.`;

        const response = await fetch("/api/repair-municipalities", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          const details = data.details ? ` Details: ${data.details}` : "";
          throw new Error((data.error || "Municipality cleanup failed.") + details);
        }

        totalProcessed += Number(data.processed || 0);
        totalRepaired += Number(data.repaired || 0);

        if (Number(data.processed || 0) === 0) {
          break;
        }

        if (Number(data.repaired || 0) === 0) {
          unchangedBatches += 1;
        } else {
          unchangedBatches = 0;
        }

        if (unchangedBatches >= 3) {
          break;
        }
      }

      qualityReviewStatus.textContent =
        `✓ Municipality cleanup pass finished. ${totalRepaired} park record${totalRepaired === 1 ? "" : "s"} updated from U.S. Census geography data.`;

      await loadQualityReviewParks();

    } catch (error) {
      console.error(error);
      qualityReviewStatus.textContent =
        "Municipality cleanup stopped: " + error.message;
    } finally {
      repairMunicipalitiesButton.disabled = false;
    }
  }

  repairMunicipalitiesButton.addEventListener("click", repairMissingMunicipalities);

  refreshQualityReviewButton.addEventListener("click", loadQualityReviewParks);


  async function submitFeedback() {
    const message = feedbackMessage.value.trim();

    if (message.length < 3) {
      feedbackStatus.textContent = "Please enter a little more detail.";
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData?.session?.user) {
      feedbackStatus.textContent = "Please sign in before submitting feedback.";
      showPanel("account");
      return;
    }

    submitFeedbackButton.disabled = true;
    feedbackStatus.textContent = "Sending feedback...";

    try {
      const { error } = await supabaseClient.rpc("submit_cpw_feedback", {
        p_category: feedbackCategory.value,
        p_message: message,
        p_page_context: window.location.pathname + window.location.search + window.location.hash
      });

      if (error) throw error;

      feedbackMessage.value = "";
      feedbackCategory.value = "bug";
      feedbackStatus.textContent = "✓ Thank you — your feedback was sent.";
    } catch (error) {
      console.error(error);
      feedbackStatus.textContent = "Unable to send feedback: " + error.message;
    } finally {
      submitFeedbackButton.disabled = false;
    }
  }

  submitFeedbackButton.addEventListener("click", submitFeedback);

  function feedbackCategoryLabel(category) {
    const labels = {
      bug: "🐛 Bug",
      idea: "💡 Idea",
      park_data: "🌳 Park Data",
      usability: "🧭 Usability",
      other: "💬 Other"
    };
    return labels[category] || category;
  }

  async function loadAdminFeedback() {
    if (!currentUserIsAdmin) return;

    adminFeedbackResults.innerHTML = "";
    adminFeedbackStatus.textContent = "Loading feedback...";

    const { data, error } = await supabaseClient
      .from("feedback_submissions")
      .select("id,callsign,category,message,page_context,status,admin_notes,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      adminFeedbackStatus.textContent = "Unable to load feedback: " + error.message;
      return;
    }

    if (!data?.length) {
      adminFeedbackStatus.textContent = "No feedback has been submitted yet.";
      return;
    }

    const openCount = data.filter((item) => item.status === "new" || item.status === "reviewing").length;
    adminFeedbackStatus.textContent =
      `${data.length} feedback item${data.length === 1 ? "" : "s"} • ${openCount} open`;

    data.forEach((item) => {
      const card = document.createElement("div");
      card.className = "feedback-admin-card";
      card.innerHTML = `
        <div class="feedback-admin-head">
          <span class="feedback-category-chip">${escapeHTML(feedbackCategoryLabel(item.category))}</span>
          <span class="feedback-status-chip feedback-status-${escapeHTML(item.status)}">${escapeHTML(item.status)}</span>
        </div>
        <p class="feedback-admin-message">${escapeHTML(item.message)}</p>
        <div class="feedback-admin-meta">
          ${item.callsign ? `<strong>${escapeHTML(item.callsign)}</strong> • ` : ""}
          ${escapeHTML(new Date(item.created_at).toLocaleString())}
          ${item.page_context ? `<br><span>From: ${escapeHTML(item.page_context)}</span>` : ""}
        </div>
        <div class="feedback-admin-actions">
          <button data-feedback-status="reviewing">Reviewing</button>
          <button data-feedback-status="resolved">Resolve</button>
          <button data-feedback-status="declined">Decline</button>
        </div>
      `;

      card.querySelectorAll("[data-feedback-status]").forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          const { error } = await supabaseClient.rpc("admin_review_cpw_feedback", {
            p_feedback_id: item.id,
            p_status: button.dataset.feedbackStatus,
            p_admin_notes: null
          });

          if (error) {
            alert("Unable to update feedback: " + error.message);
            button.disabled = false;
            return;
          }

          await loadAdminFeedback();
        });
      });

      adminFeedbackResults.appendChild(card);
    });
  }

  refreshFeedbackButton.addEventListener("click", loadAdminFeedback);

  async function loadPendingParkSubmissions() {
    pendingParksResults.innerHTML = "";
    pendingParksStatus.textContent = "Loading pending submissions...";

    const { data, error } = await supabaseClient
      .from("park_submissions")
      .select("id,name,city,state,county,zip_code,address,park_type,website_url,description,notes,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      pendingParksStatus.textContent =
        "Unable to load pending submissions: " + error.message;
      return;
    }

    if (!data?.length) {
      pendingParksStatus.textContent = "No pending park submissions.";
      return;
    }

    pendingParksStatus.textContent =
      `${data.length} pending submission${data.length === 1 ? "" : "s"}.`;

    data.forEach((submission) => {
      const card = document.createElement("div");
      card.className = "park-result";

      const location = [
        submission.city,
        submission.state,
        submission.zip_code
      ].filter(Boolean).join(", ");

      card.innerHTML = `
        <h3>${escapeHTML(submission.name)}</h3>
        <p><strong>Location:</strong> ${escapeHTML(location)}</p>
        ${submission.county ? `<p><strong>County:</strong> ${escapeHTML(submission.county)}</p>` : ""}
        ${submission.address ? `<p><strong>Address:</strong> ${escapeHTML(submission.address)}</p>` : ""}
        ${submission.park_type ? `<p><strong>Type:</strong> ${escapeHTML(submission.park_type)}</p>` : ""}
        ${submission.website_url ? `<p><strong>Website:</strong> ${escapeHTML(submission.website_url)}</p>` : ""}
        ${submission.description ? `<p>${escapeHTML(submission.description)}</p>` : ""}
      `;

      const actions = document.createElement("div");
      actions.style.marginTop = "12px";

      ["approved", "rejected", "duplicate"].forEach((action) => {
        const button = document.createElement("button");
        button.textContent =
          action === "approved" ? "Approve" :
          action === "rejected" ? "Reject" :
          "Mark Duplicate";
        button.style.marginRight = "8px";

        button.addEventListener("click", async () => {
          button.disabled = true;

          const { error } = await supabaseClient.rpc(
            "admin_review_park_submission",
            {
              p_submission_id: submission.id,
              p_action: action,
              p_review_notes: null
            }
          );

          if (error) {
            alert("Review failed: " + error.message);
            button.disabled = false;
            return;
          }

          await loadPendingParkSubmissions();
        });

        actions.appendChild(button);
      });

      card.appendChild(actions);
      pendingParksResults.appendChild(card);
    });
  }

  async function adminFindParks() {
    const term = adminParkSearch.value.trim();

    if (!term) {
      adminParkSearchStatus.textContent = "Enter a park search term.";
      adminParkSearchResults.innerHTML = "";
      return;
    }

    adminParkSearchStatus.textContent = "Searching...";
    adminParkSearchResults.innerHTML = "";
    adminParkEditor.style.display = "none";

    const response = await fetch(
      `/api/parks?q=${encodeURIComponent(term)}`
    );

    if (!response.ok) {
      adminParkSearchStatus.textContent = "Unable to search parks.";
      return;
    }

    const parks = await response.json();

    if (!parks.length) {
      adminParkSearchStatus.textContent = "No matching active parks found.";
      return;
    }

    adminParkSearchStatus.textContent =
      `${parks.length} result${parks.length === 1 ? "" : "s"}.`;

    parks.forEach((park) => {
      const card = document.createElement("div");
      card.className = "park-result";

      card.innerHTML = `
        <h3>${escapeHTML(park.name)}</h3>
        <p>${escapeHTML([park.city, park.state, park.zip_code].filter(Boolean).join(", "))}</p>
      `;

      const button = document.createElement("button");
      button.textContent = "Edit This Park";
      button.className = "park-choice";

      button.addEventListener("click", async () => {
        const { data, error } = await supabaseClient
          .from("parks")
          .select("id,name,city,state,county,zip_code,address,website_url,photo_url,description,is_active")
          .eq("id", park.id)
          .single();

        if (error) {
          adminParkSearchStatus.textContent =
            "Unable to load park for editing: " + error.message;
          return;
        }

        fillParkEditor(data);
      });

      card.appendChild(button);
      adminParkSearchResults.appendChild(card);
    });
  }

  async function saveAdminParkChanges() {
    const id = Number(editParkId.value);

    if (!id) return;

    adminParkEditStatus.textContent = "Saving...";

    const { error } = await supabaseClient
      .from("parks")
      .update({
        name: editParkName.value.trim(),
        city: editParkCity.value.trim(),
        state: editParkState.value.trim().toUpperCase(),
        county: editParkCounty.value.trim() || null,
        zip_code: editParkZip.value.trim() || null,
        address: editParkAddress.value.trim() || null,
        website_url: editParkWebsite.value.trim() || null,
        photo_url: editParkPhotoUrl.value.trim() || null,
        description: editParkDescription.value.trim() || null,
        is_active: editParkActive.checked,
        needs_review: editParkCity.value.trim().toLowerCase() === "unknown" || !editParkCity.value.trim(),
        data_quality_notes:
          editParkCity.value.trim().toLowerCase() === "unknown" || !editParkCity.value.trim()
            ? "Imported record still needs a usable municipality."
            : null
      })
      .eq("id", id);

    if (error) {
      adminParkEditStatus.textContent =
        "Unable to save park: " + error.message;
      return;
    }

    adminParkEditStatus.textContent = "✓ Park changes saved.";
    await loadQualityReviewParks();
  }

  refreshPendingParksButton.addEventListener("click", loadPendingParkSubmissions);
  adminParkSearchButton.addEventListener("click", adminFindParks);
  adminParkSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") adminFindParks();
  });
  saveParkChangesButton.addEventListener("click", saveAdminParkChanges);

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC"
  ];

  async function getFreshAccessToken() {
    const { data: refreshed, error: refreshError } =
      await supabaseClient.auth.refreshSession();

    if (!refreshError && refreshed?.session?.access_token) {
      return refreshed.session.access_token;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    return sessionData?.session?.access_token || null;
  }

  async function importPadusState(state) {
    let offset = 0;
    let total = 0;

    while (true) {
      let accessToken = await getFreshAccessToken();

      if (!accessToken) {
        throw new Error("Your sign-in session expired. Please sign in again.");
      }

      let response = await fetch("/api/import-padus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ state, offset })
      });

      // If the token expired between refresh and request, refresh once and retry.
      if (response.status === 401) {
        accessToken = await getFreshAccessToken();

        if (!accessToken) {
          throw new Error("Your sign-in session expired. Please sign in again.");
        }

        response = await fetch("/api/import-padus", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ state, offset })
        });
      }

      const data = await response.json();

      if (!response.ok) {
        const detail = data.details ? ` Details: ${data.details}` : "";
        throw new Error((data.error || `Import failed for ${state}.`) + detail);
      }

      total += Number(data.imported || 0);

      if (data.complete || data.next_offset === null) {
        break;
      }

      offset = data.next_offset;
    }

    return total;
  }

  async function startNationwideImport() {
    if (!confirm("Start importing the nationwide PAD-US city park seed database?")) {
      return;
    }

    startNationwideImportButton.disabled = true;

    let grandTotal = 0;
    let completedStates = 0;

    try {
      for (const state of US_STATES) {
        nationwideImportStatus.textContent =
          `Importing ${state}... ${completedStates}/${US_STATES.length} states complete. ${grandTotal} park records processed.`;

        const count = await importPadusState(state);
        grandTotal += count;
        completedStates += 1;
      }

      nationwideImportStatus.textContent =
        `✓ Nationwide seed import finished. ${completedStates} states/jurisdictions processed and ${grandTotal} park records handled.`;

    } catch (error) {
      console.error(error);
      nationwideImportStatus.textContent =
        `Import stopped after ${completedStates} states: ${error.message}`;
    } finally {
      startNationwideImportButton.disabled = false;
    }
  }

  startNationwideImportButton.addEventListener("click", startNationwideImport);

  async function searchActivationParks() {
    const term = activationParkSearch.value.trim();

    if (!term) {
      activationParkStatus.textContent = "Enter a park name, city, state, or ZIP code.";
      activationParkResults.innerHTML = "";
      return;
    }

    activationParkStatus.textContent = "Searching parks...";
    activationParkResults.innerHTML = "";

    try {
      const response = await fetch(`/api/parks?q=${encodeURIComponent(term)}`);

      if (!response.ok) {
        activationParkStatus.textContent = "Unable to search parks.";
        return;
      }

      const parks = await response.json();

      if (!parks.length) {
        activationParkStatus.textContent = "No matching parks found.";
        return;
      }

      activationParkStatus.textContent = "Choose the park you activated.";

      parks.forEach((park) => {
        const card = document.createElement("div");
        card.className = "park-result";

        const location = [park.city, park.state, park.zip_code]
          .filter(Boolean)
          .join(", ");

        card.innerHTML = `
          <h3>${escapeHTML(park.name)}</h3>
          <p>${escapeHTML(location)}</p>
          <a
            class="map-link"
            href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              park.latitude != null && park.longitude != null
                ? `${park.latitude},${park.longitude}`
                : [park.name, park.city, park.state].filter(Boolean).join(", ")
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >View on Google Maps</a>
        `;

        const button = document.createElement("button");
        button.className = "park-choice";
        button.textContent = "Use This Park";

        button.addEventListener("click", () => {
          selectedActivationPark = park;
          activationParkResults.innerHTML = "";
          activationParkStatus.innerHTML =
            `<div class="selected-park">Selected: ${escapeHTML(park.name)} — ${escapeHTML(location)}</div>`;
        });

        card.appendChild(button);
        activationParkResults.appendChild(card);
      });

    } catch (error) {
      console.error(error);
      activationParkStatus.textContent = "Unable to search parks.";
    }
  }

  function parseAdif(text) {
    const records = [];
    const normalizedText = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");
    const body = normalizedText.replace(/^.*?<EOH>/is, "");
    const parts = body.split(/<EOR\s*>/i);

    for (const part of parts) {
      if (!part.trim()) continue;

      const record = {};
      const regex = /<([A-Z0-9_]+):(\d+)(?::[^>]*)?>([^<]*)/gi;
      let match;

      while ((match = regex.exec(part)) !== null) {
        const field = match[1].toUpperCase();
        const length = Number(match[2]);
        record[field] = match[3].slice(0, length).trim();
      }

      if (record.CALL) {
        records.push(record);
      }
    }

    return records;
  }

  function adifDateTime(record) {
    const date = String(record.QSO_DATE || "").trim();
    const rawTime = String(record.TIME_ON || "").trim();

    if (!/^\d{8}$/.test(date)) return null;
    if (!/^\d{4}(\d{2})?$/.test(rawTime)) return null;

    const time = rawTime.padEnd(6, "0").slice(0, 6);
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(4, 6));
    const day = Number(date.slice(6, 8));
    const hour = Number(time.slice(0, 2));
    const minute = Number(time.slice(2, 4));
    const second = Number(time.slice(4, 6));

    if (
      year < 1900 ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return null;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }

    if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
      return null;
    }

    return parsed.toISOString();
  }

  function validContactCallsign(value) {
    const call = String(value || "").trim().toUpperCase();

    return (
      /^[A-Z0-9]{3,12}(\/[A-Z0-9]{1,6}){0,2}$/.test(call) &&
      /[A-Z]/.test(call) &&
      /[0-9]/.test(call)
    );
  }

  function qsoDuplicateKey(record) {
    return [
      String(record.CALL || "").trim().toUpperCase(),
      adifDateTime(record) || "",
      String(record.BAND || "").trim().toUpperCase(),
      String(record.FREQ || "").trim(),
      String(record.SUBMODE || record.MODE || "").trim().toUpperCase()
    ].join("|");
  }

  function validateAndDedupeAdif(records) {
    const valid = [];
    const invalid = [];
    const seen = new Set();
    let duplicates = 0;

    records.forEach((record, index) => {
      const problems = [];
      const callsign = String(record.CALL || "").trim().toUpperCase();
      const dateTime = adifDateTime(record);
      const frequency =
        record.FREQ === undefined || record.FREQ === ""
          ? null
          : Number(record.FREQ);

      if (!validContactCallsign(callsign)) {
        problems.push("invalid contacted callsign");
      }

      if (!dateTime) {
        problems.push("missing/invalid date or time");
      }

      if (frequency !== null && (!Number.isFinite(frequency) || frequency <= 0)) {
        problems.push("invalid frequency");
      }

      if (problems.length) {
        invalid.push({
          row: index + 1,
          callsign: callsign || "(missing)",
          problems
        });
        return;
      }

      const key = qsoDuplicateKey(record);

      if (seen.has(key)) {
        duplicates += 1;
        return;
      }

      seen.add(key);
      valid.push(record);
    });

    return { valid, invalid, duplicates };
  }

  adifFile.addEventListener("change", async () => {
    parsedAdifRecords = [];
    adifPreview.textContent = "";

    const file = adifFile.files?.[0];
    if (!file) return;

    const fileName = String(file.name || "");
    const extension = fileName.includes(".")
      ? fileName.split(".").pop().toLowerCase()
      : "";

    if (!["adi", "adif"].includes(extension)) {
      adifFile.value = "";
      adifPreview.textContent =
        "Please choose an ADIF log file ending in .adi or .adif.";
      return;
    }

    if (file.size === 0) {
      adifFile.value = "";
      adifPreview.textContent = "That ADIF file is empty.";
      return;
    }

    let text;

    try {
      text = await file.text();
    } catch (error) {
      console.error("Unable to read ADIF file:", error);
      adifFile.value = "";
      adifPreview.textContent =
        "The browser could not read that ADIF file. Try selecting it again from Files.";
      return;
    }

    if (!/<EOR\s*>/i.test(text)) {
      parsedAdifRecords = [];
      adifPreview.textContent =
        "This file does not appear to contain ADIF QSO records (<EOR> markers were not found).";
      return;
    }

    const rawRecords = parseAdif(text);
    const validation = validateAndDedupeAdif(rawRecords);

    parsedAdifRecords = validation.valid;

    if (!rawRecords.length) {
      adifPreview.textContent = "No QSO records were found in that ADIF file.";
      return;
    }

    const first = rawRecords[0];
    const stationCall =
      (first.STATION_CALLSIGN || first.OPERATOR || "").toUpperCase();

    const validCount = validation.valid.length;
    const enoughQsos = validCount >= currentActivationRequirement;

    const parts = [
      `Found ${rawRecords.length} QSO record${rawRecords.length === 1 ? "" : "s"}.`,
      `${validCount} unique valid QSO${validCount === 1 ? "" : "s"} remain after validation.`
    ];

    if (stationCall) {
      parts.push(`Station: ${stationCall}.`);
    }

    if (validation.duplicates) {
      parts.push(
        `${validation.duplicates} duplicate QSO${validation.duplicates === 1 ? "" : "s"} will not count.`
      );
    }

    if (validation.invalid.length) {
      const sample = validation.invalid
        .slice(0, 3)
        .map((item) => `row ${item.row} (${item.callsign}): ${item.problems.join(", ")}`)
        .join("; ");

      parts.push(
        `${validation.invalid.length} invalid record${validation.invalid.length === 1 ? "" : "s"} cannot be submitted. ${sample}${validation.invalid.length > 3 ? "…" : ""}`
      );
    }

    parts.push(
      `Your account requires ${currentActivationRequirement} unique valid QSOs. ` +
      (enoughQsos
        ? "✓ Requirement met."
        : `${currentActivationRequirement - validCount} more needed.`)
    );

    adifPreview.textContent = parts.join(" ");
  });

  async function activationFingerprint(records, operatorCallsign, parkId) {
    const normalized = records
      .map((record) => ({
        call: String(record.CALL || "").trim().toUpperCase(),
        date: String(record.QSO_DATE || "").trim(),
        time: String(record.TIME_ON || "").trim(),
        band: String(record.BAND || "").trim().toUpperCase(),
        freq: String(record.FREQ || "").trim(),
        mode: String(record.SUBMODE || record.MODE || "").trim().toUpperCase()
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    const canonical = JSON.stringify({
      operator: String(operatorCallsign || "").trim().toUpperCase(),
      park_id: Number(parkId),
      qsos: normalized
    });

    const bytes = new TextEncoder().encode(canonical);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function normalizeOperatorCallsign(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .split("/")[0];
  }

  async function submitActivationLog() {
    activationSubmitStatus.textContent = "";

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      activationSubmitStatus.textContent =
        "Sign in to your operator account before submitting a log.";
      return;
    }

    const { data: operator, error: operatorError } = await supabaseClient
      .from("operators")
      .select("id,callsign,callsign_verified,callsign_status,license_class,license_expiration")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (
      operatorError ||
      !operator?.callsign_verified ||
      String(operator?.callsign_status || "").toLowerCase() !== "active"
    ) {
      activationSubmitStatus.textContent =
        "A verified, active amateur radio callsign is required before submitting an activation.";
      return;
    }

    updateActivationRequirementDisplay(operator);

    if (!selectedActivationPark) {
      activationSubmitStatus.textContent = "Choose the park you activated.";
      return;
    }

    if (!parsedAdifRecords.length) {
      activationSubmitStatus.textContent = "Choose a valid ADIF file.";
      return;
    }

    const stationCalls = new Set(
      parsedAdifRecords
        .map((record) =>
          String(record.STATION_CALLSIGN || record.OPERATOR || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    );

    if (stationCalls.size > 1) {
      const normalizedCalls = new Set(
        [...stationCalls].map(normalizeOperatorCallsign)
      );

      if (normalizedCalls.size > 1) {
        activationSubmitStatus.textContent =
          "This ADIF file contains more than one station/operator callsign.";
        return;
      }
    }

    const logStationCall = [...stationCalls][0] || operator.callsign;

    if (
      normalizeOperatorCallsign(logStationCall) !==
      normalizeOperatorCallsign(operator.callsign)
    ) {
      activationSubmitStatus.textContent =
        `The ADIF station callsign (${logStationCall}) does not match your verified callsign (${operator.callsign}). Portable suffixes such as /P are allowed.`;
      return;
    }

    const qsoPayload = parsedAdifRecords.map((record) => ({
      qso_datetime: adifDateTime(record),
      contacted_callsign: String(record.CALL || "").trim().toUpperCase(),
      band: record.BAND || null,
      frequency_mhz: record.FREQ ? Number(record.FREQ) || null : null,
      mode: record.SUBMODE || record.MODE || null,
      rst_sent: record.RST_SENT || null,
      rst_received: record.RST_RCVD || null,
      grid_square: record.GRIDSQUARE || null,
      raw_adif: record
    }));

    activationSubmitStatus.textContent =
      "Validating and submitting activation securely...";

    const file = adifFile.files?.[0];

    const { data: result, error: submitError } = await supabaseClient.rpc(
      "submit_cpw_activation",
      {
        p_park_id: selectedActivationPark.id,
        p_source_filename: file?.name || null,
        p_log_station_callsign: logStationCall,
        p_qsos: qsoPayload
      }
    );

    if (submitError) {
      console.error(submitError);

      const message = String(submitError.message || "");

      if (message.toLowerCase().includes("already been submitted")) {
        activationSubmitStatus.textContent =
          "This activation log has already been submitted for this park.";
      } else if (message.toLowerCase().includes("requires at least")) {
        activationSubmitStatus.textContent = message;
      } else if (message.toLowerCase().includes("date/time")) {
        activationSubmitStatus.textContent =
          "The log contains at least one QSO with a missing, invalid, or future date/time.";
      } else if (message.toLowerCase().includes("callsign")) {
        activationSubmitStatus.textContent = message;
      } else {
        activationSubmitStatus.textContent =
          "The activation could not be submitted: " + message;
      }

      return;
    }

    const qsoCount = Number(result?.qso_count || parsedAdifRecords.length);
    const requiredQsos = Number(
      result?.required_qsos ||
      requiredQsosForLicenseClass(operator.license_class)
    );

    const duplicatesRemoved = Number(result?.duplicates_removed || 0);

    activationSubmitStatus.textContent =
      `✓ Activation submitted for ${result?.park_name || selectedActivationPark.name}: ${qsoCount} unique valid QSO${qsoCount === 1 ? "" : "s"} logged under ${result?.callsign || operator.callsign} (${result?.license_class || operator.license_class} class; ${requiredQsos} required).` +
      (duplicatesRemoved
        ? ` ${duplicatesRemoved} duplicate QSO${duplicatesRemoved === 1 ? "" : "s"} removed.`
        : "");

    adifFile.value = "";
    parsedAdifRecords = [];
    adifPreview.textContent = "";

    await loadMyActivations();
    await loadPublicActivity();
    await loadLeaderboard("all");
    await loadHomeStats();
  }

  activationParkSearchButton.addEventListener("click", searchActivationParks);
  activationParkSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchActivationParks();
  });
  submitActivationButton.addEventListener("click", submitActivationLog);


  function quickLoggerSaveDraft() {
    try {
      localStorage.setItem(QUICK_LOGGER_STORAGE_KEY, JSON.stringify(quickLoggerDraft));
    } catch (error) {
      console.warn("Unable to save quick logger draft.", error);
    }
  }

  function quickLoggerLoadDraft() {
    try {
      const stored = JSON.parse(localStorage.getItem(QUICK_LOGGER_STORAGE_KEY) || "null");
      if (stored && typeof stored === "object") {
        quickLoggerDraft = {
          park: stored.park || null,
          qsos: Array.isArray(stored.qsos) ? stored.qsos : []
        };
      }
    } catch (error) {
      console.warn("Unable to load quick logger draft.", error);
    }

    quickLoggerRender();
  }

  function quickLoggerRequirement() {
    return requiredQsosForLicenseClass(quickLoggerOperator?.license_class);
  }

  function quickLoggerRender() {
    const required = quickLoggerRequirement();
    const count = quickLoggerDraft.qsos.length;
    const percent = Math.min(100, required > 0 ? (count / required) * 100 : 0);

    quickLoggerProgressCount.textContent = `${count} / ${required}`;
    quickLoggerProgressBar.style.width = `${percent}%`;
    quickLoggerProgressText.textContent =
      count >= required
        ? `✓ Activation requirement met with ${count} QSO${count === 1 ? "" : "s"}.`
        : `${count} contact${count === 1 ? "" : "s"} logged • ${Math.max(0, required - count)} more needed`;

    if (quickLoggerDraft.park) {
      const park = quickLoggerDraft.park;
      quickLoggerSelectedPark.innerHTML =
        `<strong>🌳 ${escapeHTML(park.name)}</strong><br>` +
        `${escapeHTML(park.reference_code || "")}` +
        (park.city || park.state ? ` • ${escapeHTML([park.city, park.state].filter(Boolean).join(", "))}` : "");
      quickLoggerSelectedPark.classList.add("selected");
    } else {
      quickLoggerSelectedPark.textContent = "No park selected.";
      quickLoggerSelectedPark.classList.remove("selected");
    }

    if (!count) {
      quickLoggerQsoList.innerHTML = '<div class="quick-logger-empty">No QSOs logged yet.</div>';
      return;
    }

    quickLoggerQsoList.innerHTML = "";

    [...quickLoggerDraft.qsos].reverse().forEach((qso, reverseIndex) => {
      const index = quickLoggerDraft.qsos.length - 1 - reverseIndex;
      const row = document.createElement("div");
      row.className = "quick-logger-qso-row";
      row.innerHTML =
        `<div class="quick-logger-qso-main"><strong>${escapeHTML(qso.contacted_callsign)}</strong><span>${escapeHTML(qso.band || "")} • ${escapeHTML(qso.mode || "")}</span></div>` +
        `<div class="quick-logger-qso-time">${escapeHTML(new Date(qso.qso_datetime).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}))}</div>` +
        `<button type="button" class="quick-logger-delete-qso" data-qso-index="${index}" aria-label="Delete QSO">×</button>`;

      row.querySelector("[data-qso-index]").addEventListener("click", () => {
        quickLoggerDraft.qsos.splice(index, 1);
        quickLoggerSaveDraft();
        quickLoggerRender();
      });

      quickLoggerQsoList.appendChild(row);
    });
  }

  async function quickLoggerRefreshOperator() {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      quickLoggerOperator = null;
      quickLoggerOperatorStatus.textContent = "Sign in with a verified callsign to use the logger.";
      quickLoggerRender();
      return;
    }

    const { data: operator, error } = await supabaseClient
      .from("operators")
      .select("callsign,callsign_verified,callsign_status,license_class,license_expiration")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (
      error ||
      !operator?.callsign_verified ||
      String(operator?.callsign_status || "").toLowerCase() !== "active"
    ) {
      quickLoggerOperator = null;
      quickLoggerOperatorStatus.textContent =
        "Verify an active amateur callsign before using the Quick Logger.";
      quickLoggerRender();
      return;
    }

    quickLoggerOperator = operator;
    const required = quickLoggerRequirement();
    quickLoggerOperatorStatus.innerHTML =
      `<strong>${escapeHTML(operator.callsign)}</strong> • ${escapeHTML(operator.license_class || "Unknown")} class • ${required} valid QSOs required`;
    quickLoggerRender();
  }

  async function quickLoggerSearchParks() {
    const term = quickLoggerParkSearch.value.trim();

    if (!term) {
      quickLoggerParkSearchStatus.textContent = "Enter a park name, city, ZIP, or CPW reference.";
      quickLoggerParkResults.innerHTML = "";
      return;
    }

    quickLoggerParkSearchButton.disabled = true;
    quickLoggerParkSearchStatus.textContent = "Searching...";
    quickLoggerParkResults.innerHTML = "";

    try {
      const response = await fetch(`/api/parks?q=${encodeURIComponent(term)}`);
      const parks = await response.json();

      if (!response.ok) throw new Error(parks.error || "Park search failed.");

      if (!parks.length) {
        quickLoggerParkSearchStatus.textContent = "No matching parks found.";
        return;
      }

      quickLoggerParkSearchStatus.textContent =
        `${parks.length} park${parks.length === 1 ? "" : "s"} found.`;

      parks.slice(0, 12).forEach((park) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-logger-park-choice";
        button.innerHTML =
          `<strong>${escapeHTML(park.name)}</strong>` +
          `<span>${escapeHTML(park.reference_code || "")}${park.city || park.state ? " • " + escapeHTML([park.city, park.state].filter(Boolean).join(", ")) : ""}</span>`;

        button.addEventListener("click", () => {
          quickLoggerDraft.park = {
            id: park.id,
            name: park.name,
            reference_code: park.reference_code,
            city: park.city,
            state: park.state
          };
          quickLoggerParkResults.innerHTML = "";
          quickLoggerParkSearchStatus.textContent = "Park selected.";
          quickLoggerSaveDraft();
          quickLoggerRender();
          quickLoggerCall.focus();
        });

        quickLoggerParkResults.appendChild(button);
      });
    } catch (error) {
      console.error(error);
      quickLoggerParkSearchStatus.textContent = "Unable to search parks: " + error.message;
    } finally {
      quickLoggerParkSearchButton.disabled = false;
    }
  }

  function quickLoggerAddQso() {
    quickLoggerEntryStatus.textContent = "";

    if (!quickLoggerOperator) {
      quickLoggerEntryStatus.textContent = "Sign in with a verified callsign first.";
      return;
    }

    if (!quickLoggerDraft.park) {
      quickLoggerEntryStatus.textContent = "Choose the park before logging contacts.";
      return;
    }

    const call = quickLoggerCall.value.trim().toUpperCase();

    if (!validContactCallsign(call)) {
      quickLoggerEntryStatus.textContent = "Enter a valid amateur callsign.";
      return;
    }

    const now = new Date();
    const qso = {
      qso_datetime: now.toISOString(),
      contacted_callsign: call,
      band: quickLoggerBand.value || null,
      frequency_mhz: null,
      mode: quickLoggerMode.value || null,
      rst_sent: quickLoggerRstSent.value.trim() || null,
      rst_received: quickLoggerRstReceived.value.trim() || null,
      grid_square: quickLoggerGrid.value.trim() || null,
      raw_adif: {
        CALL: call,
        BAND: quickLoggerBand.value || "",
        MODE: quickLoggerMode.value || "",
        QSO_DATE: now.toISOString().slice(0, 10).replaceAll("-", ""),
        TIME_ON: now.toISOString().slice(11, 19).replaceAll(":", ""),
        STATION_CALLSIGN: quickLoggerOperator.callsign,
        RST_SENT: quickLoggerRstSent.value.trim(),
        RST_RCVD: quickLoggerRstReceived.value.trim(),
        GRIDSQUARE: quickLoggerGrid.value.trim()
      }
    };

    const duplicate = quickLoggerDraft.qsos.some((existing) =>
      existing.contacted_callsign === qso.contacted_callsign &&
      existing.band === qso.band &&
      existing.mode === qso.mode &&
      Math.abs(new Date(existing.qso_datetime) - now) < 60000
    );

    if (duplicate) {
      quickLoggerEntryStatus.textContent = "That looks like a duplicate of the last contact. It was not added.";
      return;
    }

    quickLoggerDraft.qsos.push(qso);
    quickLoggerSaveDraft();
    quickLoggerRender();

    quickLoggerCall.value = "";
    quickLoggerGrid.value = "";
    quickLoggerEntryStatus.textContent = `✓ ${call} logged at ${now.toISOString().slice(11, 16)} UTC.`;
    quickLoggerCall.focus();
  }

  function quickLoggerAdifText() {
    if (!quickLoggerOperator || !quickLoggerDraft.park) return "";

    const header =
      "<ADIF_VER:5>3.1.4 <PROGRAMID:15>City Park Waves <EOH>\n";

    const records = quickLoggerDraft.qsos.map((qso) => {
      const date = new Date(qso.qso_datetime);
      const fields = {
        CALL: qso.contacted_callsign,
        QSO_DATE: date.toISOString().slice(0,10).replaceAll("-",""),
        TIME_ON: date.toISOString().slice(11,19).replaceAll(":",""),
        BAND: qso.band || "",
        MODE: qso.mode || "",
        RST_SENT: qso.rst_sent || "",
        RST_RCVD: qso.rst_received || "",
        GRIDSQUARE: qso.grid_square || "",
        STATION_CALLSIGN: quickLoggerOperator.callsign
      };

      return Object.entries(fields)
        .filter(([, value]) => value)
        .map(([key, value]) => `<${key}:${String(value).length}>${value}`)
        .join(" ") + " <EOR>";
    });

    return header + records.join("\n") + "\n";
  }

  function quickLoggerExportAdif() {
    if (!quickLoggerDraft.qsos.length) {
      quickLoggerSubmitStatus.textContent = "Log at least one QSO before exporting.";
      return;
    }

    const text = quickLoggerAdifText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
    anchor.href = url;
    anchor.download = `cpw_${quickLoggerOperator?.callsign || "activation"}_${stamp}.adi`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    quickLoggerSubmitStatus.textContent = "✓ ADIF file exported.";
  }

  async function quickLoggerSubmitActivation() {
    quickLoggerSubmitStatus.textContent = "";

    await quickLoggerRefreshOperator();

    if (!quickLoggerOperator) {
      quickLoggerSubmitStatus.textContent = "A verified active callsign is required.";
      return;
    }

    if (!quickLoggerDraft.park) {
      quickLoggerSubmitStatus.textContent = "Choose the park you activated.";
      return;
    }

    const required = quickLoggerRequirement();

    if (quickLoggerDraft.qsos.length < required) {
      quickLoggerSubmitStatus.textContent =
        `You need at least ${required} valid QSOs. ${quickLoggerDraft.qsos.length} are currently logged.`;
      return;
    }

    quickLoggerSubmitButton.disabled = true;
    quickLoggerSubmitStatus.textContent = "Submitting activation securely...";

    try {
      const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "");
      const { data: result, error } = await supabaseClient.rpc("submit_cpw_activation", {
        p_park_id: quickLoggerDraft.park.id,
        p_source_filename: `cpw_quick_logger_${stamp}.adi`,
        p_log_station_callsign: quickLoggerOperator.callsign,
        p_qsos: quickLoggerDraft.qsos
      });

      if (error) throw error;

      const parkName = result?.park_name || quickLoggerDraft.park.name;
      const count = Number(result?.qso_count || quickLoggerDraft.qsos.length);

      quickLoggerSubmitStatus.textContent =
        `✓ Activation submitted for ${parkName}: ${count} valid QSO${count === 1 ? "" : "s"} logged.`;

      quickLoggerDraft = { park: null, qsos: [] };
      quickLoggerSaveDraft();
      quickLoggerRender();

      await loadMyActivations();
      await loadPublicActivity();
      await loadLeaderboard("all");
      await loadHomeStats();
    } catch (error) {
      console.error(error);
      const message = String(error.message || "Submission failed.");
      quickLoggerSubmitStatus.textContent = message.toLowerCase().includes("already been submitted")
        ? "This activation has already been submitted."
        : "The activation could not be submitted: " + message;
    } finally {
      quickLoggerSubmitButton.disabled = false;
    }
  }

  quickLoggerParkSearchButton.addEventListener("click", quickLoggerSearchParks);
  quickLoggerParkSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") quickLoggerSearchParks();
  });
  quickLoggerAddQsoButton.addEventListener("click", quickLoggerAddQso);
  quickLoggerCall.addEventListener("keydown", (event) => {
    if (event.key === "Enter") quickLoggerAddQso();
  });
  quickLoggerExportButton.addEventListener("click", quickLoggerExportAdif);
  quickLoggerSubmitButton.addEventListener("click", quickLoggerSubmitActivation);
  quickLoggerClearButton.addEventListener("click", () => {
    if (!quickLoggerDraft.park && !quickLoggerDraft.qsos.length) return;

    const confirmed = window.confirm("Clear the current Quick Logger draft?");
    if (!confirmed) return;

    quickLoggerDraft = { park: null, qsos: [] };
    quickLoggerSaveDraft();
    quickLoggerRender();
    quickLoggerEntryStatus.textContent = "Draft cleared.";
  });

  function activityDate(value) {
    if (!value) return "Date unavailable";

    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  async function openOperatorProfile(callsign) {
    const call = String(callsign || "").trim().toUpperCase();
    if (!call) return;

    operatorProfileStatus.textContent = "Loading operator profile...";
    operatorProfileContent.innerHTML = "";
    showPanel("operator-profile", false);

    const url = new URL(window.location.href);
    url.searchParams.set("operator", call);
    url.hash = "operator-profile";
    history.replaceState(null, "", url);

    try {
      const { data, error } = await supabaseClient.rpc("cpw_operator_profile", { p_callsign: call });
      if (error) throw error;
      if (!data?.operator) {
        operatorProfileStatus.textContent = "That operator profile is not public or could not be found.";
        return;
      }

      const op = data.operator;
      const stats = data.stats || {};
      const bands = Array.isArray(data.top_bands) ? data.top_bands : [];
      const modes = Array.isArray(data.top_modes) ? data.top_modes : [];
      const recent = Array.isArray(data.recent_activations) ? data.recent_activations : [];
      const achievements = Array.isArray(data.achievements) ? data.achievements : [];

      operatorProfileStatus.textContent = "";
      const avatarHtml = op.avatar_url
        ? '<img class="operator-profile-avatar" src="' + escapeHTML(op.avatar_url) + '" alt="' + escapeHTML(op.callsign) + '">'
        : '<div class="operator-profile-avatar operator-profile-avatar-fallback">📡</div>';
      const locationHtml = escapeHTML([op.state, op.grid].filter(Boolean).join(" • "));
      const licenseHtml = op.license_class ? '<span class="operator-profile-chip">' + escapeHTML(op.license_class) + ' class</span>' : "";
      const stateHtml = op.state ? '<span class="operator-profile-chip">📍 ' + escapeHTML(op.state) + '</span>' : "";
      const gridHtml = op.grid ? '<span class="operator-profile-chip">🧭 ' + escapeHTML(op.grid) + '</span>' : "";
      const bioHtml = op.bio ? '<p class="operator-profile-bio">' + escapeHTML(op.bio) + '</p>' : '<p class="operator-profile-bio operator-profile-bio-empty">No operator bio has been added yet.</p>';
      const linkHtml = op.qrz_url ? '<a class="operator-profile-external-link" href="' + escapeHTML(op.qrz_url) + '" target="_blank" rel="noopener noreferrer">View operator page ↗</a>' : "";

      const bandsHtml = bands.length ? bands.map((item) => '<div class="operator-stat-row"><span>' + escapeHTML(item.band) + '</span><strong>' + Number(item.qsos || 0).toLocaleString() + '</strong></div>').join("") : "<p>No band data yet.</p>";
      const modesHtml = modes.length ? modes.map((item) => '<div class="operator-stat-row"><span>' + escapeHTML(item.mode) + '</span><strong>' + Number(item.qsos || 0).toLocaleString() + '</strong></div>').join("") : "<p>No mode data yet.</p>";
      const achievementsHtml = achievements.length ? achievements.map((badge) => '<div class="operator-badge" title="' + escapeHTML(badge.description || "") + '"><span class="operator-badge-icon">' + escapeHTML(badge.icon || "🏅") + '</span><span><strong>' + escapeHTML(badge.name || "Achievement") + '</strong><small>' + escapeHTML(badge.description || "") + '</small></span></div>').join("") : "<p>No achievements yet — time to put a park on the air.</p>";
      const recentHtml = recent.length ? recent.map((item) => {
        const ref = item.reference_code ? " • " + escapeHTML(item.reference_code) : "";
        const pioneer = item.was_first_activation ? ' <span class="first-activation-badge" title="First recorded activation at this park">🚩 First</span>' : "";
        return '<div class="recent-activation-row"><div><strong>' + escapeHTML(item.park_name) + '</strong>' + ref + pioneer + '</div><div>' + escapeHTML([item.city, item.state].filter(Boolean).join(", ")) + " • " + Number(item.qso_count || 0).toLocaleString() + " QSOs • " + escapeHTML(activityDate(item.activation_at)) + '</div></div>';
      }).join("") : "<p>No activations yet.</p>";

      operatorProfileContent.innerHTML =
        '<div class="operator-profile-hero">' +
          '<div class="operator-profile-hero-wave" aria-hidden="true">)))</div>' +
          '<div class="operator-profile-head">' + avatarHtml +
            '<div class="operator-profile-identity">' +
              '<div class="operator-profile-kicker">City Park Waves Operator</div>' +
              '<h2>' + escapeHTML(op.callsign) + '</h2>' +
              '<div class="operator-profile-chips">' + licenseHtml + stateHtml + gridHtml + '</div>' +
            '</div>' +
          '</div>' +
          bioHtml +
          linkHtml +
        '</div>' +
        '<div class="operator-profile-stats">' +
          '<div class="operator-profile-stat"><span class="operator-stat-icon">🌳</span><strong>' + Number(stats.unique_parks || 0).toLocaleString() + '</strong><span>Unique Parks</span></div>' +
          '<div class="operator-profile-stat"><span class="operator-stat-icon">📡</span><strong>' + Number(stats.activations || 0).toLocaleString() + '</strong><span>Activations</span></div>' +
          '<div class="operator-profile-stat"><span class="operator-stat-icon">💬</span><strong>' + Number(stats.qsos || 0).toLocaleString() + '</strong><span>QSOs</span></div>' +
          '<div class="operator-profile-stat"><span class="operator-stat-icon">🚩</span><strong>' + Number(stats.first_activations || 0).toLocaleString() + '</strong><span>First Activations</span></div>' +
        '</div>' +
        '<div class="operator-profile-section"><div class="operator-profile-section-title"><div><span>🏅</span><h3>Achievements</h3></div><a href="#achievements" data-panel-link="achievements">See all badges</a></div><div class="operator-badges">' + achievementsHtml + '</div></div>' +
        '<div class="operator-profile-grid"><div class="operator-profile-section"><div class="operator-profile-section-title"><div><span>📻</span><h3>Top Bands</h3></div></div>' + bandsHtml + '</div><div class="operator-profile-section"><div class="operator-profile-section-title"><div><span>🎙️</span><h3>Top Modes</h3></div></div>' + modesHtml + '</div></div>' +
        '<div class="operator-profile-section"><div class="operator-profile-section-title"><div><span>🗺️</span><h3>Recent Activations</h3></div></div>' + recentHtml + '</div>';

      operatorProfileContent.querySelectorAll("[data-panel-link]").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          showPanel(link.dataset.panelLink);
        });
      });
    } catch (error) {
      console.error(error);
      operatorProfileStatus.textContent = "Unable to load operator profile.";
    }
  }

  operatorProfileBackButton.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("operator");
    url.hash = "activity";
    history.replaceState(null, "", url);
    showPanel("activity", false);
  });
  async function loadPublicActivity() {
    publicActivityStatus.textContent = "Loading recent activity...";
    publicActivityFeed.innerHTML = "";

    try {
      const { data, error } = await supabaseClient.rpc("cpw_recent_activations", {
        p_limit: 25
      });

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];

      if (!rows.length) {
        publicActivityStatus.textContent = "No public activations yet.";
        return;
      }

      publicActivityStatus.textContent =
        `${rows.length} recent activation${rows.length === 1 ? "" : "s"}.`;

      rows.forEach((activation) => {
        const park = activation.park || {};
        const item = document.createElement("div");
        item.className = "activity-feed-item";

        const bands = Array.isArray(activation.bands) ? activation.bands.filter(Boolean) : [];
        const modes = Array.isArray(activation.modes) ? activation.modes.filter(Boolean) : [];

        item.innerHTML = `
          <div class="activity-feed-title">
            <button class="operator-profile-link" data-operator-call="${escapeHTML(activation.station_callsign)}">${escapeHTML(activation.station_callsign)}</button> activated
            ${escapeHTML(park.name || "a park")}
          </div>

          <div class="activity-feed-meta">
            ${park.reference_code ? escapeHTML(park.reference_code) + " • " : ""}
            ${escapeHTML([park.city, park.state].filter(Boolean).join(", "))}<br>
            ${Number(activation.qso_count || 0).toLocaleString()} QSOs •
            ${escapeHTML(activityDate(activation.activation_at))}
          </div>

          <div class="activity-badges">
            ${bands.slice(0, 5).map((band) => `<span class="activity-badge">${escapeHTML(band)}</span>`).join("")}
            ${modes.slice(0, 5).map((mode) => `<span class="activity-badge">${escapeHTML(mode)}</span>`).join("")}
          </div>

          ${park.reference_code ? `<button class="park-detail-button" data-public-park-ref="${escapeHTML(park.reference_code)}">Park Details</button>` : ""}
        `;

        const button = item.querySelector("[data-public-park-ref]");
        if (button) {
          button.addEventListener("click", () => openParkDetails(button.dataset.publicParkRef));
        }

        const operatorButton = item.querySelector("[data-operator-call]");
        if (operatorButton) {
          operatorButton.addEventListener("click", () => openOperatorProfile(operatorButton.dataset.operatorCall));
        }

        publicActivityFeed.appendChild(item);
      });

    } catch (error) {
      console.error(error);
      publicActivityStatus.textContent = "Unable to load recent activity.";
    }
  }

  async function loadLeaderboard(period = "all") {
    leaderboardStatus.textContent = "Loading leaderboard...";
    leaderboardResults.innerHTML = "";

    leaderboardMonthButton.classList.toggle("active", period === "month");
    leaderboardAllButton.classList.toggle("active", period === "all");

    try {
      const { data, error } = await supabaseClient.rpc("cpw_leaderboard", {
        p_period: period,
        p_limit: 20
      });

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];

      if (!rows.length) {
        leaderboardStatus.textContent =
          period === "month" ? "No activations yet this month." : "No leaderboard activity yet.";
        return;
      }

      leaderboardStatus.textContent = "";

      rows.forEach((operator, index) => {
        const row = document.createElement("div");
        row.className = "leaderboard-row";

        row.innerHTML = `
          <div class="leaderboard-rank">${index + 1}</div>
          <div class="leaderboard-call"><button class="operator-profile-link" data-leaderboard-call="${escapeHTML(operator.callsign)}">${escapeHTML(operator.callsign)}</button></div>
          <div class="leaderboard-number">${Number(operator.unique_parks || 0).toLocaleString()}</div>
          <div class="leaderboard-number">${Number(operator.activations || 0).toLocaleString()}</div>
          <div class="leaderboard-number">${Number(operator.qsos || 0).toLocaleString()}</div>
        `;

        const profileButton = row.querySelector("[data-leaderboard-call]");
        if (profileButton) {
          profileButton.addEventListener("click", () => openOperatorProfile(profileButton.dataset.leaderboardCall));
        }

        leaderboardResults.appendChild(row);
      });

    } catch (error) {
      console.error(error);
      leaderboardStatus.textContent = "Unable to load leaderboard.";
    }
  }

  leaderboardMonthButton.addEventListener("click", () => loadLeaderboard("month"));
  leaderboardAllButton.addEventListener("click", () => loadLeaderboard("all"));

  async function loadMyActivations() {
    myActivationsResults.innerHTML = "";

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      myActivationsStatus.textContent =
        "Sign in to see your submitted activations.";
      return;
    }

    myActivationsStatus.textContent = "Loading activations...";

    const { data: activations, error } = await supabaseClient
      .from("activations")
      .select("id,station_callsign,qso_count,license_class_at_activation,required_qso_count,first_qso_at,last_qso_at,created_at,parks(name,city,state)")
      .eq("auth_user_id", session.user.id)
      .order("first_qso_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error(error);
      myActivationsStatus.textContent =
        "Unable to load your activations: " + error.message;
      return;
    }

    if (!activations?.length) {
      myActivationsStatus.textContent =
        "You have not submitted any activations yet.";
      return;
    }

    myActivationsStatus.textContent =
      `${activations.length} activation${activations.length === 1 ? "" : "s"} submitted.`;

    activations.forEach((activation) => {
      const card = document.createElement("div");
      card.className = "park-result";

      const park = activation.parks || {};
      const location = [park.city, park.state].filter(Boolean).join(", ");

      let dateText = "Date unavailable";

      if (activation.first_qso_at) {
        dateText = new Date(activation.first_qso_at).toLocaleString();
      } else if (activation.created_at) {
        dateText = new Date(activation.created_at).toLocaleString();
      }

      card.innerHTML = `
        <h3>${escapeHTML(park.name || "Park")}</h3>
        ${location ? `<p><strong>Location:</strong> ${escapeHTML(location)}</p>` : ""}
        <p><strong>Callsign:</strong> ${escapeHTML(activation.station_callsign)}</p>
        <p><strong>QSOs:</strong> ${escapeHTML(activation.qso_count)}</p>
        ${activation.license_class_at_activation ? `<p><strong>License class:</strong> ${escapeHTML(activation.license_class_at_activation)}</p>` : ""}
        ${activation.required_qso_count ? `<p><strong>Requirement:</strong> ${escapeHTML(activation.required_qso_count)} QSOs</p>` : ""}
        <p><strong>Activation:</strong> ${escapeHTML(dateText)}</p>
      `;

      myActivationsResults.appendChild(card);
    });
  }

  refreshActivationsButton.addEventListener("click", loadMyActivations);

  async function refreshAccountStatus() {
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      updateActivationRequirementDisplay(null);
      accountStatus.textContent = "Not signed in.";
      signUpButton.style.display = "inline-block";
      signInButton.style.display = "inline-block";
      signOutButton.style.display = "none";
      profileEditor.style.display = "none";
      currentUserIsAdmin = false;
      document.body.classList.remove("admin-user");

      if (window.location.hash === "#admin-import" || window.location.hash === "#admin-review") {
        showPanel("account");
      }
      return;
    }

    signUpButton.style.display = "none";
    signInButton.style.display = "none";
    signOutButton.style.display = "inline-block";

    const { data: operator } = await supabaseClient
      .from("operators")
      .select("callsign,callsign_verified,license_class,license_expiration,is_admin,profile_bio,profile_state,profile_grid,profile_avatar_url,profile_qrz_url,profile_public")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    updateActivationRequirementDisplay(operator);
    currentUserIsAdmin = Boolean(operator?.is_admin);
    document.body.classList.toggle("admin-user", currentUserIsAdmin);

    if (operator?.is_admin) {
      loadPendingParkSubmissions();
      loadAdminFeedback();
      if (parkDetailSuggestionsStatus && parkDetailSuggestionsResults) {
        loadParkDetailSuggestions();
      }
      loadQualityReviewParks();
    }

    if (operator?.callsign) {
      profileEditor.style.display = "block";
      profileState.value = operator.profile_state || "";
      profileGrid.value = operator.profile_grid || "";
      profileAvatarUrl.value = operator.profile_avatar_url || "";
      profileQrzUrl.value = operator.profile_qrz_url || "";
      profileBio.value = operator.profile_bio || "";
      profilePublic.checked = operator.profile_public !== false;

      accountStatus.textContent =
        `Signed in as ${session.user.email}. Verified callsign: ${operator.callsign}${operator.license_class ? ` • ${operator.license_class} class` : ""}.`;
    } else {
      profileEditor.style.display = "none";
      accountStatus.textContent =
        `Signed in as ${session.user.email}. Verify your callsign below.`;
    }
  }

  async function saveOperatorProfile() {
    profileSaveStatus.textContent = "";
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      profileSaveStatus.textContent = "Sign in before saving your profile.";
      return;
    }

    profileSaveStatus.textContent = "Saving profile...";

    const { error } = await supabaseClient
      .from("operators")
      .update({
        profile_state: profileState.value.trim().toUpperCase() || null,
        profile_grid: profileGrid.value.trim() || null,
        profile_avatar_url: profileAvatarUrl.value.trim() || null,
        profile_qrz_url: profileQrzUrl.value.trim() || null,
        profile_bio: profileBio.value.trim() || null,
        profile_public: profilePublic.checked
      })
      .eq("auth_user_id", session.user.id);

    if (error) {
      console.error(error);
      profileSaveStatus.textContent = "Unable to save profile: " + error.message;
      return;
    }

    profileSaveStatus.textContent = "✓ Profile saved.";
    await refreshAccountStatus();
  }

  saveProfileButton.addEventListener("click", saveOperatorProfile);

  async function createAccount() {
    const email = accountEmail.value.trim();
    const password = accountPassword.value;

    if (!email || password.length < 6) {
      accountStatus.textContent =
        "Enter a valid email and a password of at least 6 characters.";
      return;
    }

    accountStatus.textContent = "Creating account...";

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      accountStatus.textContent = error.message;
      return;
    }

    if (data.session) {
      accountStatus.textContent = "Account created and signed in.";
    } else {
      accountStatus.textContent =
        "Account created. Check your email for the confirmation link, then return here and sign in.";
    }

    await refreshAccountStatus();
  }

  async function signIn() {
    const email = accountEmail.value.trim();
    const password = accountPassword.value;

    accountStatus.textContent = "Signing in...";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      accountStatus.textContent = error.message;
      return;
    }

    accountPassword.value = "";
    await refreshAccountStatus();
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    accountPassword.value = "";
    await refreshAccountStatus();
  }

  signUpButton.addEventListener("click", createAccount);
  signInButton.addEventListener("click", signIn);
  signOutButton.addEventListener("click", signOut);

  supabaseClient.auth.onAuthStateChange(() => {
    refreshAccountStatus();
    loadMyActivations();
    quickLoggerRefreshOperator();
  });

  const initialParams = new URLSearchParams(window.location.search);
  const initialParkReference = initialParams.get("park");
  const initialOperatorCall = initialParams.get("operator");

  if (initialOperatorCall) {
    openOperatorProfile(initialOperatorCall);
  } else if (initialParkReference) {
    openParkDetails(initialParkReference);
  } else {
    showPanel(window.location.hash.slice(1) || "home", false);
  }

  loadHomeStats();
  loadPublicActivity();
  loadLeaderboard("all");
  refreshAccountStatus();
  loadMyActivations();
  quickLoggerLoadDraft();
  quickLoggerRefreshOperator();
