/* ===== MAGSNAP Founder Program JS ===== */

const APP_KEY = 'magsnap_founder_applications';
const FB_KEY = 'magsnap_founder_feedback';

// ===== Application Form =====
const form = document.getElementById('founder-form');
const statusEl = document.getElementById('form-status');

if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.className = 'form-status';
    statusEl.style.display = 'none';

    const data = {
      id: 'FP' + String(Date.now()).slice(-6),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      country: form.country.value.trim(),
      address: form.address.value.trim(),
      profession: form.profession.value.trim(),
      sports: form.sports.value.trim(),
      reason: form.reason.value.trim(),
      submitted: new Date().toISOString()
    };

    if (!data.name || !data.phone || !data.country || !data.address || !data.profession) {
      showStatus('Please fill in all required fields (*).', 'error', statusEl);
      return;
    }

    const applyConsent = document.getElementById('apply-consent');
    if (!applyConsent || !applyConsent.checked) {
      showStatus('Please confirm consent to submit. / 请勾选同意以提交。', 'error', statusEl);
      return;
    }

    const existing = JSON.parse(localStorage.getItem(APP_KEY) || '[]');
    existing.push(data);
    localStorage.setItem(APP_KEY, JSON.stringify(existing));

    showStatus('Application submitted. We\'ll review and get back to you. / 已提交，我们会审核并联系你。', 'success', statusEl);
    form.reset();
  });
}

function showStatus(msg, type, el) {
  el.textContent = msg;
  el.className = 'form-status ' + type;
  el.style.display = 'block';
}

// ===== File Preview =====
function setupFilePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', function () {
    preview.innerHTML = '';
    for (const file of this.files) {
      const p = document.createElement('p');
      p.className = 'fb-name';
      p.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + 'KB)';
      preview.appendChild(p);

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.file = file;
        preview.appendChild(img);
        const reader = new FileReader();
        reader.onload = function (e) { img.src = e.target.result; };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.file = file;
        vid.controls = true;
        preview.appendChild(vid);
        const reader = new FileReader();
        reader.onload = function (e) { vid.src = e.target.result; };
        reader.readAsDataURL(file);
      }
    }
  });
}

setupFilePreview('fb-image', 'fb-image-preview');
setupFilePreview('fb-video', 'fb-video-preview');

// ===== Feedback Form =====
const fbForm = document.getElementById('feedback-form');
const fbStatus = document.getElementById('fb-status');

if (fbForm) {
  fbForm.addEventListener('submit', function (e) {
    e.preventDefault();
    fbStatus.className = 'form-status';
    fbStatus.style.display = 'none';

    const name = fbForm.fb_name.value.trim();
    const msg = fbForm.fb_message.value.trim();
    if (!name || !msg) {
      showStatus('Name and message are required. / 姓名和内容为必填。', 'error', fbStatus);
      return;
    }

    const fbConsent = document.getElementById('fb-consent');
    if (!fbConsent || !fbConsent.checked) {
      showStatus('Please consent to upload. / 请勾选同意以提交。', 'error', fbStatus);
      return;
    }

    // Read files as base64
    const imgFile = document.getElementById('fb-image').files[0];
    const vidFile = document.getElementById('fb-video').files[0];

    const collect = function (imgData, vidData) {
      const entry = {
        id: 'FB' + String(Date.now()).slice(-6),
        name: name,
        message: msg,
        image: imgData || null,
        video: vidData || null,
        submitted: new Date().toISOString()
      };
      const all = JSON.parse(localStorage.getItem(FB_KEY) || '[]');
      all.push(entry);
      localStorage.setItem(FB_KEY, JSON.stringify(all));
      showStatus('Feedback submitted. Thank you! / 反馈已提交，感谢！', 'success', fbStatus);
      fbForm.reset();
      document.getElementById('fb-image-preview').innerHTML = '';
      document.getElementById('fb-video-preview').innerHTML = '';
    };

    // Read files if present
    const promises = [];
    if (imgFile) {
      promises.push(new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(imgFile); }));
    } else { promises.push(Promise.resolve(null)); }
    if (vidFile) {
      promises.push(new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(vidFile); }));
    } else { promises.push(Promise.resolve(null)); }

    Promise.all(promises).then(([img, vid]) => collect(img, vid));
  });
}

// ===== Directory =====
const dirBody = document.getElementById('dir-body');
const dirEmpty = document.getElementById('dir-empty');

function renderDirectory(records) {
  if (!dirBody || !dirEmpty) return;
  if (!records || records.length === 0) {
    dirBody.innerHTML = '';
    dirEmpty.style.display = 'block';
    return;
  }
  dirEmpty.style.display = 'none';
  dirBody.innerHTML = records.map(r => `
    <tr>
      <td class="num-cell">#${String(r.number).padStart(4, '0')}</td>
      <td class="name-cell">${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.country)}</td>
      <td>${escapeHtml(r.profession)}</td>
      <td>${escapeHtml(r.sports)}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '-';
  return d.innerHTML;
}

fetch('./founders.json')
  .then(r => r.json())
  .then(data => renderDirectory(data))
  .catch(() => renderDirectory([]));
