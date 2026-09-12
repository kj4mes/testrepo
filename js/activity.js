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
