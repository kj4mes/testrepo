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

  loadHomeStats();
  loadPublicActivity();
  loadLeaderboard("all");
  refreshAccountStatus();
  loadMyActivations();
