let token = localStorage.getItem('adminToken') || '';

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  return res;
}

async function doLogin() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('err');
  errEl.textContent = '';

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { errEl.textContent = 'Identifiants incorrects.'; return; }

  const data = await res.json();
  token = data.accessToken;

  // Vérifie que ce compte est bien admin en tentant d'appeler une route admin
  const check = await api('/api/admin/stats');
  if (check.status === 403) { errEl.textContent = "Ce compte n'est pas administrateur."; token = ''; return; }

  localStorage.setItem('adminToken', token);
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadStats();
  loadUsers();
}

async function loadStats() {
  const res = await api('/api/admin/stats');
  if (!res.ok) return;
  const s = await res.json();
  document.getElementById('cards').innerHTML = `
    <div class="card"><div class="value">${s.totalUsers}</div><div class="label">Utilisateurs total</div></div>
    <div class="card"><div class="value">${s.activeUsers}</div><div class="label">Comptes actifs</div></div>
    <div class="card"><div class="value">${s.activeSubscriptions}</div><div class="label">Abonnements actifs</div></div>
    <div class="card"><div class="value">${s.canceledSubscriptions}</div><div class="label">Abonnements annulés</div></div>
    <div class="card"><div class="value">${s.pastDueSubscriptions}</div><div class="label">Paiements échoués</div></div>
  `;
}

async function loadUsers() {
  const search = document.getElementById('searchBox').value;
  const res = await api(`/api/admin/users?search=${encodeURIComponent(search)}`);
  if (!res.ok) return;
  const users = await res.json();
  document.getElementById('usersBody').innerHTML = users.map(u => `
    <tr>
      <td>${u.email}</td>
      <td>${new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
      <td><span class="status ${u.subscriptionStatus}">${u.subscriptionStatus}</span></td>
      <td>${u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString('fr-FR') : '-'}</td>
      <td>${u.isActive ? 'Actif' : 'Désactivé'}</td>
      <td>
        ${u.isActive
          ? `<button class="btn-deactivate" onclick="deactivate('${u.id}')">Désactiver</button>`
          : `<button class="btn-reactivate" onclick="reactivate('${u.id}')">Réactiver</button>`}
        <button class="btn-delete" onclick="del('${u.id}')">Supprimer</button>
      </td>
    </tr>
  `).join('');
}

async function deactivate(id) { await api(`/api/admin/users/${id}/deactivate`, { method: 'POST' }); loadUsers(); }
async function reactivate(id) { await api(`/api/admin/users/${id}/reactivate`, { method: 'POST' }); loadUsers(); }
async function del(id) {
  if (!confirm('Supprimer définitivement ce compte ?')) return;
  await api(`/api/admin/users/${id}`, { method: 'DELETE' });
  loadUsers();
}

// Reprise de session si déjà connecté
if (token) {
  api('/api/admin/stats').then(res => {
    if (res.ok) {
      document.getElementById('loginBox').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      loadStats();
      loadUsers();
    } else {
      token = '';
      localStorage.removeItem('adminToken');
    }
  });
}
