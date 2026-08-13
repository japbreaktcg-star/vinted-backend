async function submitReset() {
  const msg = document.getElementById('msg');
  const token = new URLSearchParams(window.location.search).get('token');
  const newPassword = document.getElementById('newPassword').value;

  if (!token) { msg.style.color = '#c0392b'; msg.textContent = "Lien invalide (token manquant)."; return; }
  if (newPassword.length < 8) { msg.style.color = '#c0392b'; msg.textContent = "8 caractères minimum."; return; }

  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (res.ok) {
    msg.style.color = '#098e3a';
    msg.textContent = 'Mot de passe changé ! Tu peux fermer cette page et te reconnecter dans l\'extension.';
  } else {
    const body = await res.json().catch(() => ({}));
    msg.style.color = '#c0392b';
    msg.textContent = body.error || 'Lien invalide ou expiré.';
  }
}
