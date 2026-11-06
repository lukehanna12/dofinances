// The reconstructed Auth-3 has no authentication backend.
// This adapter preserves the display without collecting, logging or transmitting credentials.
(() => {
  "use strict";
  const email = document.getElementById("auth-email");
  const continueButton = document.getElementById("auth-continue");
  const status = document.querySelector("[data-login-status]");
  if (!email || !continueButton || !status) return;

  function notice(message) {
    status.textContent = message;
    status.hidden = false;
  }

  function continueWithEmail() {
    if (!email.reportValidity()) return;
    email.value = "";
    notice("Sign-in is not available yet. Your email was not sent or stored.");
  }

  continueButton.addEventListener("click", continueWithEmail);
  email.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      continueWithEmail();
    }
  });

  document.querySelectorAll("[data-preview-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.previewAction;
      if (action === "create" || action === "help" || action === "more") {
        notice("This is a design preview. Account features are not connected yet.");
      } else {
        notice(action + " sign-in is not connected yet. No authentication request was sent.");
      }
    });
  });
})();
