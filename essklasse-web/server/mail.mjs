/**
 * Mailversand-Adapter (zero-dependency).
 *
 * Strategie:
 *   - Ist EK_MAIL_WEBHOOK_URL gesetzt, wird die Mail als JSON per HTTP-POST an
 *     diesen Endpunkt geschickt (built-in fetch). So lässt sich jeder
 *     transaktionale Anbieter (Resend, Postmark, SendGrid …) bzw. ein eigener
 *     Relay anbinden, ohne ein npm-Paket hinzuzufügen.
 *   - Optional: EK_MAIL_WEBHOOK_AUTH → Authorization-Header, EK_MAIL_FROM → Absender.
 *   - Ohne konfigurierten Provider: in Dev wird der Link geloggt (bequemes
 *     Testen); in Produktion wird NICHT geloggt (kein Token-Leak) und ein
 *     Zustellfehler signalisiert.
 *
 * Rückgabe: true bei (vermutlich) erfolgreicher Zustellung, sonst false.
 */
const IS_PROD = process.env.NODE_ENV === 'production';

export async function sendMagicLink({ to, link }) {
  const url     = process.env.EK_MAIL_WEBHOOK_URL;
  const from    = process.env.EK_MAIL_FROM ?? 'no-reply@essklasse.local';
  const subject = 'Ihr Anmeldelink für EssKlasse';
  const text =
    `Hallo,\n\nhier ist Ihr Anmeldelink für EssKlasse (15 Minuten gültig):\n\n${link}\n\n` +
    `Wenn Sie diese Anmeldung nicht angefordert haben, ignorieren Sie diese E-Mail.`;

  if (url) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.EK_MAIL_WEBHOOK_AUTH) headers['Authorization'] = process.env.EK_MAIL_WEBHOOK_AUTH;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to, from, subject, text, link }),
      });
      if (!res.ok) {
        console.error(`[mail] Webhook-Zustellung fehlgeschlagen: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[mail] Webhook-Fehler:', e?.message);
      return false;
    }
  }

  // Kein Provider konfiguriert.
  if (IS_PROD) {
    console.error('[mail] KEIN Mailprovider konfiguriert (EK_MAIL_WEBHOOK_URL fehlt) — ' +
      `Anmeldelink an ${to} wurde NICHT zugestellt.`);
    return false;
  }
  console.log(`[mail] (dev) Anmeldelink für ${to}:\n  ${link}`);
  return true;
}

/**
 * Versendet ein Angebot an den Kunden (Portal-Link + optional PDF-Anhang).
 * Gleiche Webhook-Strategie wie sendMagicLink.
 */
export async function sendAngebot({ to, kundeFirma, nummer, portalLink, pdfDataUrl }) {
  const url     = process.env.EK_MAIL_WEBHOOK_URL;
  const from    = process.env.EK_MAIL_FROM ?? 'no-reply@essklasse.local';
  const subject = `Ihr Angebot ${nummer}`;
  const text =
    `Guten Tag,\n\nanbei erhalten Sie unser Angebot ${nummer}` +
    `${kundeFirma ? ` für ${kundeFirma}` : ''}.\n\n` +
    `Sie können das Angebot hier ansehen und annehmen:\n${portalLink}\n\n` +
    `Mit freundlichen Grüßen`;

  if (url) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.EK_MAIL_WEBHOOK_AUTH) headers['Authorization'] = process.env.EK_MAIL_WEBHOOK_AUTH;
      const body = { to, from, subject, text, link: portalLink };
      if (pdfDataUrl) body.attachments = [{ filename: `Angebot_${nummer}.pdf`, dataUrl: pdfDataUrl }];
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) { console.error(`[mail] Angebot-Zustellung fehlgeschlagen: HTTP ${res.status}`); return false; }
      return true;
    } catch (e) {
      console.error('[mail] Angebot-Webhook-Fehler:', e?.message);
      return false;
    }
  }

  if (IS_PROD) {
    console.error(`[mail] KEIN Mailprovider konfiguriert — Angebot ${nummer} an ${to} NICHT zugestellt.`);
    return false;
  }
  console.log(`[mail] (dev) Angebot ${nummer} für ${to}:\n  ${portalLink}`);
  return true;
}
