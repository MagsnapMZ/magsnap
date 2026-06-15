/* ===== MAGSNAP Founder Program JS ===== */

const STORAGE_KEY = 'magsnap_founder_applications';

// --- Form ---
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
      country: form.country.value.trim(),
      profession: form.profession.value.trim(),
      sports: form.sports.value.trim(),
      reason: form.reason.value.trim(),
      submitted: new Date().toISOString()
    };

    if (!data.name || !data.country || !data.profession) {
      showStatus('Please fill in all required fields (*).', 'error');
      return;
    }

    // Load existing
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    showStatus('Application submitted. We\'ll review and get back to you.', 'success');
    form.reset();
  });
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'form-status ' + type;
  statusEl.style.display = 'block';
}

// --- Directory ---
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

// Load directory
fetch('./founders.json')
  .then(r => r.json())
  .then(data => renderDirectory(data))
  .catch(() => renderDirectory([]));
