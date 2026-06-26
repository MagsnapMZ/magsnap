"use strict";

const assert = require("assert");
const path = require("path");

process.env.FORM_BACKEND_DRY_RUN = "true";
process.env.FORM_DATA_BUCKET = "magsnap-form-data-sg";
process.env.PHOTO_BUCKET = "magsnap-public-media-sg";
process.env.PUBLIC_PHOTO_BASE_URL = "https://media.magsnap.me";
process.env.ALLOWED_ORIGINS = "https://magsnap.me,https://www.magsnap.me,https://cn.magsnap.me";

const { handler } = require(path.resolve(__dirname, "../../api/aliyun-form-handler/index.js"));

const tinyJpeg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

const call = async (body) => handler({
  httpMethod: "POST",
  path: "/forms",
  headers: {
    origin: "https://magsnap.me",
    "content-type": "application/json"
  },
  body: JSON.stringify(body)
}, {});

(async () => {
  const result = await call({
    source_form: "panda_masters_checkin",
    panda_master_number: "0004",
    public_nickname: "QA Panda",
    country: "China",
    city: "Shanghai",
    club: "MagSnap",
    role: "Creator",
    sports: "Kitesurf",
    equipment: "Insta360 GO3S",
    content_creator_status: "Regularly",
    follower_range: "10,000+",
    feedback: "China API test",
    photo_url: `data:image/jpeg;base64,${tinyJpeg}`,
    photo_link: `data:image/jpeg;base64,${tinyJpeg}`
  });

  assert.strictEqual(result.statusCode, 200, result.body);
  const body = JSON.parse(result.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.source_form, "panda_masters_checkin");
  assert.match(body.photo_url, /^https:\/\/media\.magsnap\.me\/panda-masters\/photos\/incoming\//);

  const missingSource = await call({ name: "No Source" });
  assert.strictEqual(missingSource.statusCode, 400);

  const health = await handler({
    httpMethod: "GET",
    path: "/forms",
    headers: { origin: "https://magsnap.me" },
    body: ""
  }, {});
  assert.strictEqual(health.statusCode, 200);

  console.log("aliyun form handler tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
