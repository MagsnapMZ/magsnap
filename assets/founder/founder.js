(function () {
  const config = window.MAGSNAP_SUPABASE || {};
  const seedRecords = window.MAGSNAP_REGISTRY_SEED || [];
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
    if (!node || !message) return;
    node.textContent = message;
    node.classList.add("show");
    node.classList.toggle("error", Boolean(isError));
  }

  function selectedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function normalizeRegistryNumber(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    const number = Number.parseInt(digits, 10);
    if (!Number.isInteger(number) || number < 1 || number > 9999) {
      return null;
    }
    return String(number).padStart(4, "0");
  }

  async function initRegistryForm() {
    const form = document.querySelector("[data-registry-form]");
    if (!form) return;
    const status = document.querySelector("[data-status]");
    const submit = form.querySelector("[type='submit']");

    if (!isConfigured) {
      setStatus(status, "Registry Activation page is live. Database connection is not configured yet; add the Supabase URL and anon key in assets/founder/supabase-config.js before collecting submissions.", true);
      submit.disabled = true;
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const registryNumber = normalizeRegistryNumber(formData.get("registry_number"));
      const sportTags = selectedValues(form, "sport_tags");
      const deviceTags = selectedValues(form, "device_tags");

      if (!registryNumber) {
        setStatus(status, "Registry Number must be a valid four-digit QC/Test Card number.", true);
        return;
      }

      submit.disabled = true;
      setStatus(status, "Submitting Registry Activation...", false);

      const payload = {
        registry_number: registryNumber,
        display_name: String(formData.get("display_name") || "").trim(),
        country: String(formData.get("country") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        role: String(formData.get("role") || "").trim(),
        configuration: String(formData.get("configuration") || "").trim(),
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
        const result = await supabaseRequest("rpc/activate_registry_record", {
          method: "POST",
          body: JSON.stringify({ registration: payload })
        });
        const number = result && result.registry_number ? result.registry_number : registryNumber;
        setStatus(status, `${number} activated. Registry record is now active.`, false);
        form.reset();
      } catch (error) {
        const duplicate = /duplicate|already|unique/i.test(error.message);
        setStatus(status, duplicate ? "This Registry Number has already been activated. Contact info@magsnap.me if this is an error." : error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function renderRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return '<tr><td colspan="6">No public registry records yet.</td></tr>';
    }
    return rows.map((row) => `
      <tr>
        <td><span class="registry-number">${escapeHtml(row.registry_number || "")}</span></td>
        <td>${escapeHtml(row.display_name || "")}</td>
        <td>${escapeHtml(row.country || "")}</td>
        <td>${escapeHtml(row.role || "")}</td>
        <td>${escapeHtml(row.configuration || "")}</td>
        <td>${escapeHtml(row.status || "")}</td>
      </tr>
    `).join("");
  }

  function renderResult(node, row, query) {
    if (!node) return;
    if (!row) {
      node.innerHTML = `<div class="empty-state">No public record found for ${escapeHtml(query)}.</div>`;
      return;
    }
    node.innerHTML = `
      <article class="registry-card">
        <span class="registry-number">${escapeHtml(row.registry_number || "")}</span>
        <dl>
          <div><dt>Display Name</dt><dd>${escapeHtml(row.display_name || "")}</dd></div>
          <div><dt>Country</dt><dd>${escapeHtml(row.country || "")}</dd></div>
          <div><dt>Role</dt><dd>${escapeHtml(row.role || "")}</dd></div>
          <div><dt>Configuration</dt><dd>${escapeHtml(row.configuration || "")}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(row.status || "")}</dd></div>
        </dl>
      </article>
    `;
  }

  async function fetchPublicRecords() {
    if (!isConfigured) return seedRecords;
    return supabaseRequest("public_registry_records?select=registry_number,display_name,country,role,configuration,status&order=registry_number.asc", {
      method: "GET"
    });
  }

  async function searchRecord(registryNumber) {
    if (!isConfigured) {
      return seedRecords.find((row) => row.registry_number === registryNumber) || null;
    }
    const rows = await supabaseRequest(`public_registry_records?select=registry_number,display_name,country,role,configuration,status&registry_number=eq.${encodeURIComponent(registryNumber)}&limit=1`, {
      method: "GET"
    });
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function initRegistry() {
    const tableBody = document.querySelector("[data-registry-body]");
    if (!tableBody) return;
    const status = document.querySelector("[data-status]");
    const resultNode = document.querySelector("[data-registry-result]");
    const searchForm = document.querySelector("[data-registry-search]");

    try {
      const rows = await fetchPublicRecords();
      if (!isConfigured) {
        setStatus(status, "Static Registry seed data is shown. Connect Supabase to load live records.", false);
      }
      tableBody.innerHTML = renderRows(rows);
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="6">Unable to load public registry.</td></tr>';
      setStatus(status, error.message, true);
    }

    if (!searchForm) return;
    searchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(searchForm);
      const registryNumber = normalizeRegistryNumber(formData.get("registry_query"));
      if (!registryNumber) {
        renderResult(resultNode, null, "that number");
        return;
      }
      try {
        const row = await searchRecord(registryNumber);
        renderResult(resultNode, row, registryNumber);
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
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
    initRegistryForm();
    initRegistry();
  });
})();
