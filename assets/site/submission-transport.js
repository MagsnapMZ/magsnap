(function () {
  const DEFAULT_EMAIL = "info@magsnap.me";
  const DEFAULT_WECHAT_QR = "/assets/site/wechat-qr.jpg";
  const STORAGE_PREFIX = "magsnap-submission-backup-";

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const cleanText = (value) => String(value ?? "").trim();

  const normalizeEndpoint = (endpoint) => {
    if (!endpoint) return null;
    if (typeof endpoint === "string") {
      return { name: endpoint, url: endpoint, mode: "no-cors" };
    }
    if (!endpoint.url) return null;
    return {
      name: endpoint.name || endpoint.url,
      url: endpoint.url,
      mode: endpoint.mode || "no-cors",
      headers: endpoint.headers || {},
      timeoutMs: endpoint.timeoutMs
    };
  };

  const configuredEndpoints = (context) => {
    const config = window.MAGSNAP_SUBMISSION_ENDPOINTS;
    if (!config) return [];
    if (Array.isArray(config)) return config.map(normalizeEndpoint).filter(Boolean);
    const contextEndpoints = context && Array.isArray(config[context]) ? config[context] : [];
    const defaultEndpoints = Array.isArray(config.default) ? config.default : [];
    return [...contextEndpoints, ...defaultEndpoints].map(normalizeEndpoint).filter(Boolean);
  };

  const endpointList = (options = {}) => {
    const pageEndpoints = Array.isArray(options.endpoints) ? options.endpoints : [];
    const merged = [
      ...configuredEndpoints(options.context),
      ...pageEndpoints.map(normalizeEndpoint).filter(Boolean)
    ];
    const seen = new Set();
    return merged.filter((endpoint) => {
      if (seen.has(endpoint.url)) return false;
      seen.add(endpoint.url);
      return true;
    });
  };

  const bodyFromPayload = (payload) => {
    const body = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
      body.append(key, value == null ? "" : String(value));
    });
    return body;
  };

  const postEndpoint = async (endpoint, payload, timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), endpoint.timeoutMs || timeoutMs);
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        mode: endpoint.mode || "no-cors",
        cache: "no-store",
        headers: endpoint.mode === "cors" ? endpoint.headers : undefined,
        body: bodyFromPayload(payload),
        signal: controller.signal
      });
      if (endpoint.mode === "cors" && !response.ok) {
        throw new Error(`${endpoint.name} returned ${response.status}`);
      }
      return { ok: true, endpoint: endpoint.name };
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const submit = async (payload, options = {}) => {
    const endpoints = endpointList(options);
    if (!endpoints.length) {
      throw new Error("Submission backend is not configured.");
    }
    const timeoutMs = options.timeoutMs || 18000;
    const failures = [];
    for (const endpoint of endpoints) {
      try {
        return await postEndpoint(endpoint, payload, timeoutMs);
      } catch (error) {
        failures.push(`${endpoint.name}: ${error && error.name === "AbortError" ? "timeout" : cleanText(error && error.message) || "failed"}`);
      }
    }
    const message = failures.length ? failures.join(" / ") : "network failed";
    throw new Error(`Submission network request failed. ${message}`);
  };

  const sanitizePayload = (payload) => {
    const output = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      const text = String(value ?? "");
      if (/^data:image\//i.test(text)) {
        output[key] = "[image prepared in browser; send the image separately if needed]";
      } else if (key === "user_agent" && text.length > 180) {
        output[key] = `${text.slice(0, 180)}...`;
      } else {
        output[key] = value;
      }
    });
    return output;
  };

  const preferredKeys = [
    "source_form",
    "panda_master_id",
    "panda_master_number",
    "name",
    "public_nickname",
    "email",
    "country",
    "city",
    "club",
    "role",
    "sport_or_industry",
    "device",
    "whatsapp",
    "social_link",
    "instagram",
    "wechat_or_social",
    "reason",
    "problem_report",
    "problem_tags",
    "module_ideas",
    "product_requests",
    "feedback",
    "contribution_text",
    "submitted_at",
    "source_url"
  ];

  const buildFallbackText = (payload, options = {}) => {
    const cleanPayload = sanitizePayload(payload);
    const keys = [
      ...preferredKeys,
      ...Object.keys(cleanPayload).filter((key) => !preferredKeys.includes(key)).sort()
    ];
    const lines = [
      options.title || "MAGSNAP submission backup",
      "",
      "Key fields:"
    ];
    keys.forEach((key) => {
      const value = cleanPayload[key];
      if (value == null || value === "") return;
      lines.push(`${key}: ${String(value)}`);
    });
    lines.push("", "JSON:", JSON.stringify(cleanPayload, null, 2));
    return lines.join("\n");
  };

  const shortMailBody = (payload, options = {}) => {
    const text = buildFallbackText(payload, options);
    return text.length > 1800
      ? `${text.slice(0, 1750)}\n\n[Full payload is longer. Please paste the copied backup text here.]`
      : text;
  };

  const fallbackHtml = (payload, options = {}) => {
    const email = options.email || DEFAULT_EMAIL;
    const wechatQr = options.wechatQr || DEFAULT_WECHAT_QR;
    const subject = options.subject || "MAGSNAP Submission Backup";
    const title = options.title || "MAGSNAP submission backup";
    const storageKey = `${STORAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const backupText = buildFallbackText(payload, { ...options, title });
    try {
      window.sessionStorage.setItem(storageKey, backupText);
    } catch (_error) {
      // Copy fallback is best-effort. Email and WeChat links still work.
    }
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shortMailBody(payload, { ...options, title }))}`;
    return `
      <div class="submission-fallback" role="group" aria-label="Backup submission options">
        <strong>备用提交方式 / Backup submission</strong><br>
        ${escapeHtml(options.intro || "当前网络没有完成后台提交。你的资料已经保存在本机，请用下面任一方式发送给 MAGSNAP。")}
        <div class="submission-fallback-actions">
          <button type="button" data-magsnap-copy-submission="${escapeHtml(storageKey)}">复制申请资料 / Copy</button>
          <a href="${escapeHtml(mailto)}">邮件发送 / Email</a>
          <a href="${escapeHtml(wechatQr)}" target="_blank" rel="noopener">微信二维码 / WeChat</a>
        </div>
        <div class="submission-fallback-note">中国大陆网络可能无法访问当前后台域名。复制资料后可通过邮件或微信发送。<br>Some mainland China networks cannot reach the current backend domain. Copy the backup and send it by email or WeChat.</div>
      </div>
    `;
  };

  document.addEventListener("click", async (event) => {
    const button = event.target && event.target.closest("[data-magsnap-copy-submission]");
    if (!button) return;
    const key = button.getAttribute("data-magsnap-copy-submission");
    const text = key ? window.sessionStorage.getItem(key) : "";
    if (!text) {
      button.textContent = "请使用邮件 / Use Email";
      return;
    }
    try {
      await window.navigator.clipboard.writeText(text);
      button.textContent = "已复制 / Copied";
    } catch (_error) {
      button.textContent = "复制失败 / Copy Failed";
    }
  });

  window.MAGSNAP_FORM_TRANSPORT = {
    submit,
    fallbackHtml,
    buildFallbackText,
    sanitizePayload
  };
})();
