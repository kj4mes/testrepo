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
