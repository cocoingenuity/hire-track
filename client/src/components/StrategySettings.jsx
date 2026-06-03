import { useState, useEffect } from 'react';

const DEFAULTS = {
  visaStatus: 'PGWP',
  languages: ['English'],
  hasDriversLicense: false,
  securityClearanceEligible: false,
  targetRoles: 'IT Support, Help Desk, NOC Analyst',
  experienceLevel: 'Entry-level',
  blacklistedKeywords: 'Manager, Sales, Software Developer',
};

const VISA_OPTIONS = ['PR', 'Citizen', 'PGWP', 'Student Visa', 'Other'];
const LANGUAGE_OPTIONS = ['English', 'French', 'Mandarin', 'Other'];
const EXPERIENCE_OPTIONS = ['Entry-level', 'Mid-level', 'Senior'];

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--ht-text-3)' }}>
        {label}
      </label>
      {hint && <p className="text-xs" style={{ color: 'var(--ht-text-3)', marginTop: -4 }}>{hint}</p>}
      {children}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="rounded-xl p-6 flex flex-col gap-5" style={{ background: 'var(--ht-bg)', border: '0.5px solid var(--ht-border)' }}>
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '0.5px solid var(--ht-border)' }}>
        <i className={`ti ${icon}`} style={{ color: 'var(--ht-green)', fontSize: 15 }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ht-text)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm font-sans transition-colors outline-none';
const inputStyle = {
  background: 'var(--ht-bg-2)',
  border: '0.5px solid var(--ht-border-2)',
  color: 'var(--ht-text)',
  fontFamily: 'var(--ht-font-sans)',
};

// Map backend snake_case keys to frontend camelCase form state
function apiToForm(data) {
  return {
    visaStatus:               data.visa_status          ?? DEFAULTS.visaStatus,
    languages:                data.languages             ?? DEFAULTS.languages,
    hasDriversLicense:        data.has_vehicle           ?? DEFAULTS.hasDriversLicense,
    securityClearanceEligible:data.security_clearance    ?? DEFAULTS.securityClearanceEligible,
    targetRoles:              data.target_roles          ?? DEFAULTS.targetRoles,
    experienceLevel:          data.experience_level      ?? DEFAULTS.experienceLevel,
    blacklistedKeywords:      data.blacklisted_keywords  ?? DEFAULTS.blacklistedKeywords,
  };
}

export default function StrategySettings({ onClose }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/strategy')
      .then(r => r.json())
      .then(data => { setForm(apiToForm(data)); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleLanguage(lang) {
    setForm(f => {
      const next = f.languages.includes(lang)
        ? f.languages.filter(l => l !== lang)
        : [...f.languages, lang];
      return { ...f, languages: next };
    });
    setSaved(false);
  }

  function handleSave(e) {
    e.preventDefault();
    setError('');
    fetch('/api/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visa_status:          form.visaStatus,
        languages:            form.languages,
        has_vehicle:          form.hasDriversLicense,
        security_clearance:   form.securityClearanceEligible,
        target_roles:         form.targetRoles,
        experience_level:     form.experienceLevel,
        blacklisted_keywords: form.blacklistedKeywords,
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(() => setSaved(true))
      .catch(() => setError('Failed to save. Check server connection.'));
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--ht-bg-2)' }}>
      {/* Page header */}
      <div
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: 'var(--ht-bg)', borderBottom: '0.5px solid var(--ht-border)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--ht-text)', fontFamily: 'var(--ht-font-serif)', fontWeight: 'normal', fontSize: 20 }}>
            Strategy Settings
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ht-text-3)' }}>
            Define your candidate profile and job preferences to guide AI analysis
          </p>
        </div>
        <button onClick={onClose} className="ht-btn" style={{ padding: '6px 12px' }}>
          <i className="ti ti-arrow-left" />
          Back to Jobs
        </button>
      </div>

      {/* Scrollable body */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

          {/* ── Candidate Profile ── */}
          <Section title="Candidate Profile" icon="ti-user">

            <Field label="Visa Status">
              <select
                value={form.visaStatus}
                onChange={e => set('visaStatus', e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                {VISA_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Languages">
              <div className="flex flex-wrap gap-3 mt-0.5">
                {LANGUAGE_OPTIONS.map(lang => {
                  const checked = form.languages.includes(lang);
                  return (
                    <label
                      key={lang}
                      className="flex items-center gap-2 cursor-pointer text-sm select-none"
                      style={{ color: checked ? 'var(--ht-text)' : 'var(--ht-text-2)' }}
                    >
                      <span
                        className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-colors"
                        style={{
                          background: checked ? 'var(--ht-green)' : 'var(--ht-bg-3)',
                          border: `0.5px solid ${checked ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
                        }}
                        onClick={() => toggleLanguage(lang)}
                      >
                        {checked && <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />}
                      </span>
                      {lang}
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="Mobility">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm select-none" style={{ color: 'var(--ht-text-2)' }}>
                <span
                  className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-colors"
                  style={{
                    background: form.hasDriversLicense ? 'var(--ht-green)' : 'var(--ht-bg-3)',
                    border: `0.5px solid ${form.hasDriversLicense ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
                  }}
                  onClick={() => set('hasDriversLicense', !form.hasDriversLicense)}
                >
                  {form.hasDriversLicense && <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />}
                </span>
                Has G Driver's License / Personal Vehicle
              </label>
            </Field>

            <Field label="Security Clearance">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm select-none" style={{ color: 'var(--ht-text-2)' }}>
                <span
                  className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-colors"
                  style={{
                    background: form.securityClearanceEligible ? 'var(--ht-green)' : 'var(--ht-bg-3)',
                    border: `0.5px solid ${form.securityClearanceEligible ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
                  }}
                  onClick={() => set('securityClearanceEligible', !form.securityClearanceEligible)}
                >
                  {form.securityClearanceEligible && <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />}
                </span>
                Security Clearance Eligible
              </label>
            </Field>
          </Section>

          {/* ── Job Preferences ── */}
          <Section title="Job Preferences" icon="ti-target">

            <Field label="Target Roles" hint="Comma-separated list of job titles to target">
              <input
                type="text"
                value={form.targetRoles}
                onChange={e => set('targetRoles', e.target.value)}
                placeholder="IT Support, Help Desk, NOC Analyst"
                className={inputCls}
                style={inputStyle}
              />
            </Field>

            <Field label="Experience Level">
              <select
                value={form.experienceLevel}
                onChange={e => set('experienceLevel', e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                {EXPERIENCE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Blacklisted Keywords" hint="Jobs containing these terms will be deprioritised">
              <input
                type="text"
                value={form.blacklistedKeywords}
                onChange={e => set('blacklistedKeywords', e.target.value)}
                placeholder="Manager, Sales, Software Developer"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
          </Section>

          {/* Save */}
          <div className="flex items-center gap-3 pb-8">
            <button type="submit" className="ht-btn ht-btn-dark" style={{ padding: '9px 20px' }}>
              <i className="ti ti-device-floppy" />
              Save Strategy
            </button>
            {saved && (
              <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--ht-green)' }}>
                <i className="ti ti-circle-check" />
                Saved
              </span>
            )}
            {error && (
              <span className="text-sm flex items-center gap-1.5" style={{ color: '#e05' }}>
                <i className="ti ti-alert-circle" />
                {error}
              </span>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}
