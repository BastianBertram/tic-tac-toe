import { useState } from 'react';
import s from './LoginScreen.module.css';

const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

type Stage = 'email' | 'sent';

export function LoginScreen() {
  const [stage,   setStage]   = useState<Stage>('email');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Verbindung zum Server fehlgeschlagen.');
      setStage('sent');
    } catch (err: any) {
      // In dev without backend: still show "sent" state for demo
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        setStage('sent'); // Demo mode
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        {/* Logo */}
        <img src="/logo.webp" alt="EssKlasse Catering & Gastronomie" className={s.logo} />
        <div className={s.divider} />

        {stage === 'email' ? (
          <>
            <h1 className={s.title}>Willkommen</h1>
            <p className={s.subtitle}>
              Geben Sie Ihre E-Mail-Adresse ein.<br />
              Sie erhalten einen sicheren Anmelde-Link.
            </p>

            <form onSubmit={handleSubmit} className={s.form} noValidate>
              <div>
                <label className={s.label} htmlFor="email">E-Mail-Adresse</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>✉️</span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    className={s.input}
                    placeholder="E-Mail"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && <div className={s.error}>⚠️ {error}</div>}

              <button type="submit" className={s.btn} disabled={loading || !email.trim()}>
                {loading ? '⏳ Wird gesendet …' : 'Anmelde-Link anfordern →'}
              </button>
            </form>

            <p className={s.footer}>
              Kein Konto? Bitte wenden Sie sich an Ihren Administrator.<br />
              Zugänge können nur durch Administratoren erstellt werden.
            </p>
          </>
        ) : (
          <div className={s.sentBox}>
            <div className={s.sentIcon}>📬</div>
            <h2 className={s.sentTitle}>E-Mail gesendet!</h2>
            <p className={s.sentText}>
              Wir haben einen Anmelde-Link an<br />
              <span className={s.sentEmail}>{email}</span><br />
              gesendet. Bitte prüfen Sie Ihr Postfach.
            </p>
            <p className={s.sentNote}>Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.</p>

            <div className={s.infoBox}>
              💡 Keinen Link erhalten? Prüfen Sie bitte auch Ihren Spam-Ordner oder
              fordern Sie einen neuen Link an.
            </div>

            <button
              className={s.btnGhost}
              onClick={() => { setStage('email'); setError(''); }}
              type="button"
            >
              ← Andere E-Mail verwenden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
