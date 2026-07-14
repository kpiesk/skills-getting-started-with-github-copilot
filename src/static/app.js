document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const emailInput = document.getElementById("email");
  const signupButton = document.getElementById("signup-button");
  const signupHint = document.getElementById("signup-hint");
  const messageDiv = document.getElementById("message");
  let isSubmitting = false;
  let activitiesByName = {};

  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateSignupState() {
    const selectedActivityName = activitySelect.value;
    const selectedActivity = activitiesByName[selectedActivityName];
    const hasValidEmail =
      emailInput.validity.valid && emailInput.value.trim().length > 0;
    const hasSelection = Boolean(selectedActivityName && selectedActivity);

    if (!hasSelection) {
      signupHint.textContent =
        "Pick an activity to see schedule and open spots.";
      signupHint.className = "signup-hint";
    } else {
      const spotsLeft =
        selectedActivity.max_participants -
        selectedActivity.participants.length;
      signupHint.textContent = `${selectedActivity.schedule} - ${spotsLeft} spots left`;
      signupHint.className =
        spotsLeft > 0 ? "signup-hint ready" : "signup-hint warning";
    }

    const selectedActivityFull =
      hasSelection &&
      selectedActivity.max_participants -
        selectedActivity.participants.length <=
        0;

    signupButton.disabled =
      isSubmitting || !hasValidEmail || !hasSelection || selectedActivityFull;
    signupButton.textContent = isSubmitting ? "Signing Up..." : "Sign Up";
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();
      activitiesByName = activities;

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;
        const participants = details.participants || [];
        const participantsListMarkup = participants.length
          ? participants
              .map(
                (participant) => `
                  <li class="participant-item">
                    <span class="participant-email">${participant}</span>
                    <button
                      type="button"
                      class="delete-participant-btn"
                      data-activity="${name}"
                      data-email="${participant}"
                      aria-label="Unregister ${participant} from ${name}"
                      title="Unregister participant"
                    >
                      <svg viewBox="0 0 24 24" class="delete-icon" aria-hidden="true" focusable="false">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z" />
                      </svg>
                    </button>
                  </li>
                `,
              )
              .join("")
          : '<li class="empty-participants">No participants yet. Be the first to sign up!</li>';

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <p class="participants-title">Participants</p>
            <ul class="participants-list">
              ${participantsListMarkup}
            </ul>
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = spotsLeft > 0 ? name : `${name} (Full)`;
        option.disabled = spotsLeft <= 0;
        activitySelect.appendChild(option);
      });

      updateSignupState();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      signupHint.textContent = "Could not load activities right now.";
      signupHint.className = "signup-hint error";
      signupButton.disabled = true;
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const activity = document.getElementById("activity").value;

    if (!activity || !activitiesByName[activity]) {
      showMessage("Please choose an activity first.", "error");
      return;
    }

    const selectedActivity = activitiesByName[activity];
    const spotsLeft =
      selectedActivity.max_participants - selectedActivity.participants.length;
    if (spotsLeft <= 0) {
      showMessage("This activity is full. Please choose another one.", "error");
      updateSignupState();
      return;
    }

    isSubmitting = true;
    updateSignupState();

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    } finally {
      isSubmitting = false;
      updateSignupState();
    }
  });

  activitiesList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-participant-btn");
    if (!deleteButton) {
      return;
    }

    const email = deleteButton.dataset.email;
    const activity = deleteButton.dataset.activity;

    if (!email || !activity) {
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        await fetchActivities();
      } else {
        showMessage(
          result.detail || "Could not unregister participant.",
          "error",
        );
      }
    } catch (error) {
      showMessage(
        "Failed to unregister participant. Please try again.",
        "error",
      );
      console.error("Error unregistering participant:", error);
    }
  });

  activitySelect.addEventListener("change", updateSignupState);
  emailInput.addEventListener("input", updateSignupState);
  updateSignupState();

  // Initialize app
  fetchActivities();
});
