// Utilise l'API Resend (https://resend.com) — simple appel HTTP, pas de librairie SMTP à gérer.
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    // Pas bloquant : permet de continuer à développer en local sans compte Resend configuré
    console.warn(`[email] RESEND_API_KEY manquant — email non envoyé à ${to}. Lien : ${resetLink}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Réinitialise ton mot de passe",
      html: `
        <p>Tu as demandé à réinitialiser ton mot de passe.</p>
        <p><a href="${resetLink}">Clique ici pour choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] Échec d'envoi via Resend (${res.status}): ${body}`);
  }
}
