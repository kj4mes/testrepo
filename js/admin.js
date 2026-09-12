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

  async function loadParkDetailSuggestions() {\n    parkDetailSuggestionsResults.innerHTML = "";\n    parkDetailSuggestionsStatus.textContent = "Loading pending detail suggestions...";\n\n    const { data, error } = await supabaseClient\n      .from("park_detail_submissions")\n      .select("id,park_id,website_url,photo_url,address,description,created_at,parks(reference_code,name,city,state)")\n      .eq("status", "pending")\n      .order("created_at", { ascending: true });\n\n    if (error) {\n      console.error(error);\n      parkDetailSuggestionsStatus.textContent = "Unable to load detail suggestions: " + error.message;\n      return;\n    }\n\n    if (!data?.length) {\n      parkDetailSuggestionsStatus.textContent = "No pending park detail suggestions.";\n      return;\n    }\n\n    parkDetailSuggestionsStatus.textContent = `${data.length} pending suggestion${data.length === 1 ? "" : "s"}.`;\n\n    data.forEach((submission) => {\n      const park = submission.parks || {};\n      const card = document.createElement("div");\n      card.className = "park-result";\n      card.innerHTML = `\n        <h3>${escapeHTML(park.name || "Park")}</h3>\n        <p><strong>CPW:</strong> ${escapeHTML(park.reference_code || "")}</p>\n        <p><strong>Location:</strong> ${escapeHTML([park.city, park.state].filter(Boolean).join(", "))}</p>\n        ${submission.website_url ? `<p><strong>Website:</strong> ${escapeHTML(submission.website_url)}</p>` : ""}\n        ${submission.photo_url ? `<p><strong>Photo:</strong> ${escapeHTML(submission.photo_url)}</p>` : ""}\n        ${submission.address ? `<p><strong>Address:</strong> ${escapeHTML(submission.address)}</p>` : ""}\n        ${submission.description ? `<p><strong>Description:</strong> ${escapeHTML(submission.description)}</p>` : ""}\n      `;\n\n      const actions = document.createElement("div");\n      actions.style.marginTop = "12px";\n\n      ["approved", "rejected"].forEach((action) => {\n        const button = document.createElement("button");\n        button.textContent = action === "approved" ? "Approve Details" : "Reject";\n        button.style.marginRight = "8px";\n        button.addEventListener("click", async () => {\n          button.disabled = true;\n          const { error: reviewError } = await supabaseClient.rpc("admin_review_park_detail_submission", {\n            p_submission_id: submission.id,\n            p_action: action,\n            p_review_notes: null\n          });\n          if (reviewError) {\n            alert("Review failed: " + reviewError.message);\n            button.disabled = false;\n            return;\n          }\n          await loadParkDetailSuggestions();\n        });\n        actions.appendChild(button);\n      });\n\n      card.appendChild(actions);\n      parkDetailSuggestionsResults.appendChild(card);\n    });\n  }\n\n  refreshParkDetailSuggestionsButton.addEventListener("click", loadParkDetailSuggestions);\n  async function loadQualityReviewParks() {
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
