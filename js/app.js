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

  const initialParkReference = new URLSearchParams(window.location.search).get("park");

  if (initialParkReference) {
    openParkDetails(initialParkReference);
  } else {
    showPanel(window.location.hash.slice(1) || "home", false);
  }

  loadHomeStats();
  loadPublicActivity();
  loadLeaderboard("all");

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

  function ensureNearbyMap(lat, lon) {
    if (nearbyMap) {
      nearbyMap.remove();
      nearbyMap = null;
      nearbyLayer = null;
    }

    nearbyMap = L.map("nearbyMap", {
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([lat, lon], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(nearbyMap);

    nearbyLayer = L.layerGroup().addTo(nearbyMap);

    L.marker([lat, lon])
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

          L.marker([plat, plon])
            .bindPopup(
              `<strong>${escapeHTML(park.name)}</strong><br>` +
              `${Number(park.distance_miles).toFixed(1)} mi away`
            )
            .addTo(nearbyLayer);
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

  refreshParkDetailSuggestionsButton.addEventListener("click", loadParkDetailSuggestions);
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
    const parts = text.split(/<EOR>/i);

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

    const text = await file.text();
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
            ${escapeHTML(activation.station_callsign)} activated
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
          <div class="leaderboard-call">${escapeHTML(operator.callsign)}</div>
          <div class="leaderboard-number">${Number(operator.unique_parks || 0).toLocaleString()}</div>
          <div class="leaderboard-number">${Number(operator.activations || 0).toLocaleString()}</div>
          <div class="leaderboard-number">${Number(operator.qsos || 0).toLocaleString()}</div>
        `;

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
      .select("callsign,callsign_verified,license_class,license_expiration,is_admin")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    updateActivationRequirementDisplay(operator);
    currentUserIsAdmin = Boolean(operator?.is_admin);
    document.body.classList.toggle("admin-user", currentUserIsAdmin);

    if (operator?.is_admin) {
      loadPendingParkSubmissions();
      loadQualityReviewParks();
    }

    if (operator?.callsign) {
      accountStatus.textContent =
        `Signed in as ${session.user.email}. Verified callsign: ${operator.callsign}${operator.license_class ? ` • ${operator.license_class} class` : ""}.`;
    } else {
      accountStatus.textContent =
        `Signed in as ${session.user.email}. Verify your callsign below.`;
    }
  }

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
  });

  refreshAccountStatus();
  loadMyActivations();
