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
