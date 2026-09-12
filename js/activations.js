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
