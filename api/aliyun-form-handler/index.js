"use strict";

const crypto = require("crypto");

const DEFAULT_ALLOWED_ORIGINS = "https://magsnap.me,https://www.magsnap.me,https://cn.magsnap.me";
const DEFAULT_MAX_JSON_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const SOURCE_FOLDERS = {
  homepage_founder_apply: "founder",
  panda_masters_checkin: "panda-masters",
  club_database: "clubs",
  panda_masters_newsletter: "newsletter",
  most_wanted_solution: "most-wanted"
};

const FILE_LINK_KEYS = [
  "file_link",
  "fileUrl",
  "file_url",
  "file_or_link",
  "asset_link",
  "video_link",
  "pov_clip_link"
];

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const cleanText = (value) => String(value == null ? "" : value).trim();

const envFlag = (name, defaultValue = false) => {
  const value = cleanText(process.env[name]).toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
};

const numberEnv = (name, fallback) => {
  const parsed = Number.parseInt(cleanText(process.env[name]), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const jsonResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  },
  body: JSON.stringify(body)
});

const allowedOrigins = () => cleanText(process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsHeaders = (origin) => {
  const origins = allowedOrigins();
  const allowAny = origins.includes("*");
  const allowedOrigin = allowAny ? "*" : origins.includes(origin) ? origin : "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    "Access-Control-Allow-Headers": "Content-Type,X-MagSnap-Form-Secret",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
};

const safeObjectKeyPart = (value, fallback = "record") => {
  const text = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || fallback;
};

const nowParts = (date = new Date()) => ({
  iso: date.toISOString(),
  yyyy: String(date.getUTCFullYear()),
  mm: String(date.getUTCMonth() + 1).padStart(2, "0"),
  dd: String(date.getUTCDate()).padStart(2, "0")
});

const normalizePayload = (input) => {
  const payload = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (key === "photo_file") return;
    if (Array.isArray(value)) {
      payload[key] = value.map(cleanText).filter(Boolean).join(", ");
      return;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      payload[key] = value;
      return;
    }
    payload[key] = cleanText(value);
  });

  FILE_LINK_KEYS.forEach((key) => {
    if (!(key in payload)) payload[key] = "";
  });

  payload.source_form = cleanText(payload.source_form);
  if (!SOURCE_FOLDERS[payload.source_form]) {
    throw Object.assign(new Error("Unsupported or missing source_form."), { statusCode: 400 });
  }

  return payload;
};

const pandaRegistryFields = (payload) => ({
  panda_master_number: cleanText(payload.panda_master_number || payload.founder_number || payload.registry_number),
  photo_url: cleanText(payload.photo_url || payload.photo_link),
  preferred_language: cleanText(payload.preferred_language),
  nickname: cleanText(payload.public_nickname || payload.nickname || payload.name),
  country: cleanText(payload.country),
  city: cleanText(payload.city),
  club: cleanText(payload.club),
  role: cleanText(payload.role),
  sport: cleanText(payload.sports || payload.sport_or_industry || payload.sport),
  equipment: cleanText(payload.equipment || payload.device || payload.device_used),
  content_creator: cleanText(payload.content_creator_status || payload.content_creator),
  follower_range: cleanText(payload.follower_range),
  video_creator: cleanText(payload.video_link || payload.pov_clip_link || payload.video_creator),
  ideas: cleanText(payload.module_ideas || payload.product_requests || payload.crazy_concepts || payload.ideas),
  feedback: cleanText(payload.feedback),
  solution: cleanText(payload.solution || payload.solution_description),
  registration_date: cleanText(payload.submitted_at || payload.received_date || new Date().toISOString()),
  source: cleanText(payload.source_form || payload.source_url)
});

const parseJsonBody = (rawBody) => {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : cleanText(rawBody);
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > numberEnv("MAX_JSON_BYTES", DEFAULT_MAX_JSON_BYTES)) {
    throw Object.assign(new Error("Payload is too large."), { statusCode: 413 });
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch (_error) {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
};

const extractDataUrl = (payload) => {
  const candidates = [payload.photo_url, payload.photo_link].map(cleanText);
  const dataUrl = candidates.find((value) => value.startsWith("data:image/"));
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    throw Object.assign(new Error("Photo data URL is not valid."), { statusCode: 400 });
  }
  const mimeType = match[1].toLowerCase();
  if (!MIME_EXTENSIONS[mimeType]) {
    throw Object.assign(new Error("Photo type is not supported."), { statusCode: 400 });
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw Object.assign(new Error("Photo data is empty."), { statusCode: 400 });
  }
  if (buffer.length > numberEnv("MAX_PHOTO_BYTES", DEFAULT_MAX_PHOTO_BYTES)) {
    throw Object.assign(new Error("Photo is too large after compression."), { statusCode: 413 });
  }
  return { buffer, mimeType, ext: MIME_EXTENSIONS[mimeType] };
};

let ossModule;
const getOssModule = () => {
  if (!ossModule) {
    // Lazy import keeps local dry-run validation dependency-free.
    ossModule = require("ali-oss");
  }
  return ossModule;
};

const ossClient = (bucket, context) => {
  const OSS = getOssModule();
  const credentials = context?.credentials || {};
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || credentials.accessKeyId || credentials.accessKeyID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || credentials.accessKeySecret;
  const stsToken = process.env.ALIYUN_SECURITY_TOKEN || credentials.securityToken;
  const region = process.env.OSS_REGION || "oss-ap-southeast-1";
  const endpoint = cleanText(process.env.OSS_ENDPOINT);
  const config = { region, bucket, accessKeyId, accessKeySecret, stsToken };
  if (endpoint) config.endpoint = endpoint;
  return new OSS(config);
};

const writeObject = async ({ bucket, key, body, contentType, cacheControl, context }) => {
  if (envFlag("FORM_BACKEND_DRY_RUN")) {
    return { name: key, dryRun: true };
  }
  const client = ossClient(bucket, context);
  return client.put(key, body, {
    headers: {
      "Content-Type": contentType,
      ...(cacheControl ? { "Cache-Control": cacheControl } : {})
    }
  });
};

const storePhoto = async ({ payload, submissionId, dateParts, context }) => {
  const photo = extractDataUrl(payload);
  if (!photo) {
    payload.photo_url = cleanText(payload.photo_url);
    payload.photo_link = cleanText(payload.photo_link || payload.photo_url);
    return null;
  }

  const photoBucket = cleanText(process.env.PHOTO_BUCKET);
  if (!photoBucket) {
    throw Object.assign(new Error("PHOTO_BUCKET is not configured."), { statusCode: 500 });
  }

  const number = safeObjectKeyPart(payload.panda_master_number || payload.panda_master_id || submissionId, submissionId);
  const key = `panda-masters/photos/incoming/${dateParts.yyyy}/${dateParts.mm}/${dateParts.dd}/${number}-${submissionId}.${photo.ext}`;
  await writeObject({
    bucket: photoBucket,
    key,
    body: photo.buffer,
    contentType: photo.mimeType,
    cacheControl: "public, max-age=31536000, immutable",
    context
  });

  const publicBase = cleanText(process.env.PUBLIC_PHOTO_BASE_URL || process.env.PUBLIC_BASE_URL || "https://media.magsnap.me").replace(/\/+$/, "");
  const photoUrl = `${publicBase}/${key}`;
  payload.photo_url = photoUrl;
  payload.photo_link = photoUrl;
  payload.photo_oss_bucket = photoBucket;
  payload.photo_oss_key = key;
  payload.photo_upload_status = "oss_saved";
  return { bucket: photoBucket, key, url: photoUrl };
};

const storeSubmission = async ({ payload, submissionId, dateParts, origin, clientIp, context }) => {
  const formDataBucket = cleanText(process.env.FORM_DATA_BUCKET);
  if (!formDataBucket) {
    throw Object.assign(new Error("FORM_DATA_BUCKET is not configured."), { statusCode: 500 });
  }

  const folder = SOURCE_FOLDERS[payload.source_form];
  const key = `submissions/${folder}/${dateParts.yyyy}/${dateParts.mm}/${dateParts.dd}/${submissionId}.json`;
  const pandaFields = payload.source_form === "panda_masters_checkin" ? pandaRegistryFields(payload) : {};
  const record = {
    submission_id: submissionId,
    server_received_at: dateParts.iso,
    origin: cleanText(origin),
    client_ip: cleanText(clientIp),
    ...pandaFields,
    ...payload
  };

  await writeObject({
    bucket: formDataBucket,
    key,
    body: Buffer.from(JSON.stringify(record, null, 2) + "\n", "utf8"),
    contentType: "application/json; charset=utf-8",
    cacheControl: "no-store",
    context
  });

  return { bucket: formDataBucket, key, record };
};

const verifyOrigin = (origin) => {
  if (!envFlag("REQUIRE_ALLOWED_ORIGIN", true)) return;
  if (!origin) return;
  const origins = allowedOrigins();
  if (origins.includes("*") || origins.includes(origin)) return;
  throw Object.assign(new Error("Origin is not allowed."), { statusCode: 403 });
};

const verifySharedSecret = (headers) => {
  const expected = cleanText(process.env.FORM_SHARED_SECRET);
  if (!expected) return;
  const provided = cleanText(headers["x-magsnap-form-secret"] || headers["X-MagSnap-Form-Secret"]);
  if (provided !== expected) {
    throw Object.assign(new Error("Form secret is invalid."), { statusCode: 401 });
  }
};

const normalizeHeaders = (headers = {}) => {
  const normalized = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    normalized[String(key).toLowerCase()] = Array.isArray(value) ? value.join(",") : cleanText(value);
  });
  return normalized;
};

const handleRequest = async ({ method, path, headers, body, clientIp }, context) => {
  const normalizedHeaders = normalizeHeaders(headers);
  const origin = normalizedHeaders.origin || "";
  const baseHeaders = corsHeaders(origin);

  try {
    if (method === "OPTIONS") {
      return jsonResponse(204, {}, baseHeaders);
    }

    if (method === "GET") {
      return jsonResponse(200, {
        ok: true,
        service: "magsnap-aliyun-form-handler",
        path,
        dry_run: envFlag("FORM_BACKEND_DRY_RUN")
      }, baseHeaders);
    }

    if (method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed." }, baseHeaders);
    }

    verifyOrigin(origin);
    verifySharedSecret(normalizedHeaders);

    const parsed = parseJsonBody(body);
    const payload = normalizePayload(parsed);
    const dateParts = nowParts();
    const submissionId = crypto.randomUUID();

    const photo = await storePhoto({ payload, submissionId, dateParts, context });
    const submission = await storeSubmission({ payload, submissionId, dateParts, origin, clientIp, context });

    return jsonResponse(200, {
      ok: true,
      submission_id: submissionId,
      source_form: payload.source_form,
      submission_key: submission.key,
      photo_url: cleanText(payload.photo_url),
      photo_key: photo?.key || ""
    }, baseHeaders);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return jsonResponse(statusCode, {
      ok: false,
      error: error.message || "Submission failed."
    }, baseHeaders);
  }
};

const eventToRequest = (event) => {
  const raw = Buffer.isBuffer(event) ? event.toString("utf8") : typeof event === "string" ? event : "";
  const parsed = raw ? JSON.parse(raw) : event || {};
  const headers = parsed.headers || {};
  const method = cleanText(parsed.httpMethod || parsed.method || "GET").toUpperCase();
  const body = parsed.isBase64Encoded ? Buffer.from(parsed.body || "", "base64").toString("utf8") : parsed.body || "";
  return {
    method,
    path: cleanText(parsed.path || parsed.rawPath || "/"),
    headers,
    body,
    clientIp: cleanText(parsed.clientIP || parsed.clientIp || parsed.requestContext?.identity?.sourceIp || parsed.requestContext?.http?.sourceIp)
  };
};

const fcRequestToRequest = (request) => ({
  method: cleanText(request.method || request.methodName || "GET").toUpperCase(),
  path: cleanText(request.path || request.url || "/"),
  headers: request.headers || {},
  body: request.body || "",
  clientIp: cleanText(request.clientIP || request.clientIp)
});

const sendFcResponse = (response, result) => {
  Object.entries(result.headers || {}).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.setStatusCode(result.statusCode);
  response.send(result.body || "");
};

exports.handler = async function handler(requestOrEvent, responseOrContext, contextOrCallback) {
  if (responseOrContext && typeof responseOrContext.setStatusCode === "function") {
    const result = await handleRequest(fcRequestToRequest(requestOrEvent), contextOrCallback || {});
    return sendFcResponse(responseOrContext, result);
  }

  const callback = typeof contextOrCallback === "function" ? contextOrCallback : null;
  const result = await handleRequest(eventToRequest(requestOrEvent), responseOrContext || {});
  if (callback) {
    callback(null, result);
    return undefined;
  }
  return result;
};

exports._internals = {
  normalizePayload,
  pandaRegistryFields,
  parseJsonBody,
  extractDataUrl,
  eventToRequest,
  handleRequest
};
