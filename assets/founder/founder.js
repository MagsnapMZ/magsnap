(function () {
  const config = window.MAGSNAP_SUPABASE || {};
  const isConfigured = Boolean(config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_"));

  function apiUrl(path) {
    return `${config.url.replace(/\/$/, "")}/rest/v1/${path}`;
  }

  async function supabaseRequest(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_error) {
      data = text;
    }
    if (!response.ok) {
      const message = data && data.message ? data.message : "Request failed.";
      throw new Error(message);
    }
    return data;
  }

  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    node.classList.toggle("error", Boolean(isError));
  }

  function selectedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function normalizeFounderNumber(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    const number = Number.parseInt(digits, 10);
    if (!Number.isInteger(number) || number < 1 || number > 1000) {
      return null;
    }
    return String(number).padStart(4, "0");
  }

  async function initFounderForm() {
    const form = document.querySelector("[data-founder-form]");
    if (!form) return;
    const status = document.querySelector("[data-status]");
    const submit = form.querySelector("[type='submit']");

    if (!isConfigured) {
      setStatus(status, "Founder Activation page is live. Database connection is not configured yet; add the Supabase URL and anon key in assets/founder/supabase-config.js before collecting submissions.", true);
      submit.disabled = true;
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const founderNumber = normalizeFounderNumber(formData.get("founder_number"));
      const sportTags = selectedValues(form, "sport_tags");
      const deviceTags = selectedValues(form, "device_tags");

      if (!founderNumber) {
        setStatus(status, "Founder Number must be between 0001 and 1000.", true);
        return;
      }
      if (sportTags.length === 0) {
        setStatus(status, "Select at least one primary sport or activity.", true);
        return;
      }

      submit.disabled = true;
      setStatus(status, "Submitting Founder Activation...", false);

      const payload = {
        founder_number: founderNumber,
        display_name: String(formData.get("display_name") || "").trim(),
        country: String(formData.get("country") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        sport_tags: sportTags,
        industry: String(formData.get("industry") || "").trim(),
        device_tags: deviceTags,
        contact_method: String(formData.get("contact_method") || "").trim(),
        contact_detail: String(formData.get("contact_detail") || "").trim(),
        social_media: String(formData.get("social_media") || "").trim(),
        profile_photo_url: String(formData.get("profile_photo_url") || "").trim(),
        short_intro: String(formData.get("short_intro") || "").trim()
      };

      try {
        const result = await supabaseRequest("rpc/activate_founder", {
          method: "POST",
          body: JSON.stringify({ registration: payload })
        });
        const number = result && result.founder_number ? result.founder_number : `#${founderNumber}`;
        setStatus(status, `${number} activated. Welcome to the first 1,000.`, false);
        form.reset();
      } catch (error) {
        const duplicate = /duplicate|already|unique/i.test(error.message);
        setStatus(status, duplicate ? "This Founder Number has already been activated. Contact info@magsnap.me if this is an error." : error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function tagsToText(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return "";
    return tags.join(" / ");
  }

  async function initRegistry() {
    const tableBody = document.querySelector("[data-registry-body]");
    if (!tableBody) return;
    const status = document.querySelector("[data-status]");

    if (!isConfigured) {
      setStatus(status, "Founder Registry page is live. Database connection is not configured yet.", true);
      tableBody.innerHTML = "";
      return;
    }

    try {
      const rows = await supabaseRequest("public_founder_registry?select=founder_number,display_name,country,sport_tags&order=founder_number.asc", {
        method: "GET"
      });
      if (!Array.isArray(rows) || rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No Founders activated yet.</td></tr>';
        return;
      }
      tableBody.innerHTML = rows.map((row) => `
        <tr>
          <td><span class="registry-number">#${String(row.founder_number).padStart(4, "0")}</span></td>
          <td>${escapeHtml(row.display_name || "")}</td>
          <td>${escapeHtml(row.country || "")}</td>
          <td>${escapeHtml(tagsToText(row.sport_tags))}</td>
        </tr>
      `).join("");
    } catch (error) {
      setStatus(status, error.message, true);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initFounderForm();
    initRegistry();
  });
})();
