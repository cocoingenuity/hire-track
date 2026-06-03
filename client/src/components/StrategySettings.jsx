import { useState, useEffect, useRef } from 'react';

const PROFILE_DEFAULTS = {
  visaStatus: 'PGWP',
  languages: ['English'],
  hasDriversLicense: false,
  securityClearanceEligible: false,
};

const STRATEGY_DEFAULTS = {
  targetRoles: '',
  experienceLevel: ['Entry-level'],
  blacklistedKeywords: '',
  employmentType: 'any',
  workModel: [],
};

const VISA_OPTIONS = ['PR', 'Citizen', 'PGWP', 'Student Visa', 'Other'];
const LANGUAGE_OPTIONS = ['English', 'French', 'Mandarin', 'Other'];
const EXPERIENCE_OPTIONS = ['Entry-level', 'Mid-level', 'Senior'];
const WORK_MODEL_OPTIONS = ['Remote', 'Hybrid', 'On-site'];

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

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm select-none" style={{ color: checked ? 'var(--ht-text)' : 'var(--ht-text-2)' }}>
      <span
        className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-colors"
        style={{
          background: checked ? 'var(--ht-green)' : 'var(--ht-bg-3)',
          border: `0.5px solid ${checked ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
        }}
        onClick={onChange}
      >
        {checked && <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />}
      </span>
      {label}
    </label>
  );
}

function Radio({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm select-none" style={{ color: checked ? 'var(--ht-text)' : 'var(--ht-text-2)' }}>
      <span
        className="flex items-center justify-center w-4 h-4 flex-shrink-0 transition-colors"
        style={{
          borderRadius: '50%',
          background: checked ? 'var(--ht-green)' : 'var(--ht-bg-3)',
          border: `0.5px solid ${checked ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
        }}
        onClick={onChange}
      >
        {checked && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />}
      </span>
      {label}
    </label>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm font-sans transition-colors outline-none';
const inputStyle = {
  background: 'var(--ht-bg-2)',
  border: '0.5px solid var(--ht-border-2)',
  color: 'var(--ht-text)',
  fontFamily: 'var(--ht-font-sans)',
};

function apiToProfile(data) {
  return {
    visaStatus:                data.visa_status         ?? PROFILE_DEFAULTS.visaStatus,
    languages:                 data.languages            ?? PROFILE_DEFAULTS.languages,
    hasDriversLicense:         data.has_vehicle          ?? PROFILE_DEFAULTS.hasDriversLicense,
    securityClearanceEligible: data.security_clearance   ?? PROFILE_DEFAULTS.securityClearanceEligible,
  };
}

function apiToStrategy(data) {
  const expLevel = data.experience_level;
  return {
    targetRoles:       data.target_roles         ?? STRATEGY_DEFAULTS.targetRoles,
    experienceLevel:   Array.isArray(expLevel) ? expLevel : (expLevel ? [expLevel] : STRATEGY_DEFAULTS.experienceLevel),
    blacklistedKeywords: data.blacklisted_keywords ?? STRATEGY_DEFAULTS.blacklistedKeywords,
    employmentType:    data.employment_type       ?? STRATEGY_DEFAULTS.employmentType,
    workModel:         data.work_model            ?? STRATEGY_DEFAULTS.workModel,
  };
}

export default function StrategySettings({ trackId, track, onClose }) {
  const [profile, setProfile]   = useState(PROFILE_DEFAULTS);
  const [strategy, setStrategy] = useState(STRATEGY_DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // Resume upload state
  const fileInputRef = useRef(null);
  const [resumeFilename, setResumeFilename] = useState(track?.resume_file_path || null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    setResumeFilename(track?.resume_file_path || null);
  }, [track]);

  useEffect(() => {
    if (!trackId) return;
    setLoading(true);
    setSaved(false);
    Promise.all([
      fetch('/api/profile').then(r => r.json()),
      fetch(`/api/strategy?track_id=${encodeURIComponent(trackId)}`).then(r => r.json()),
    ]).then(([profileData, strategyData]) => {
      setProfile(apiToProfile(profileData));
      setStrategy(apiToStrategy(strategyData));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [trackId]);

  function setP(key, value) { setProfile(p => ({ ...p, [key]: value })); setSaved(false); }
  function setS(key, value) { setStrategy(s => ({ ...s, [key]: value })); setSaved(false); }

  function toggleLanguage(lang) {
    setProfile(p => {
      const next = p.languages.includes(lang) ? p.languages.filter(l => l !== lang) : [...p.languages, lang];
      return { ...p, languages: next };
    });
    setSaved(false);
  }

  function toggleExperienceLevel(level) {
    setStrategy(s => {
      const next = s.experienceLevel.includes(level) ? s.experienceLevel.filter(l => l !== level) : [...s.experienceLevel, level];
      return { ...s, experienceLevel: next };
    });
    setSaved(false);
  }

  function toggleWorkModel(model) {
    setStrategy(s => {
      const next = s.workModel.includes(model) ? s.workModel.filter(m => m !== model) : [...s.workModel, model];
      return { ...s, workModel: next };
    });
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      await Promise.all([
        fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visa_status:        profile.visaStatus,
            languages:          profile.languages,
            has_vehicle:        profile.hasDriversLicense,
            security_clearance: profile.securityClearanceEligible,
          }),
        }).then(r => { if (!r.ok) throw new Error(); }),
        fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track_id:             trackId,
            target_roles:         strategy.targetRoles,
            experience_level:     strategy.experienceLevel,
            blacklisted_keywords: strategy.blacklistedKeywords,
            employment_type:      strategy.employmentType,
            work_model:           strategy.workModel,
          }),
        }).then(r => { if (!r.ok) throw new Error(); }),
      ]);
      setSaved(true);
    } catch {
      setError('Failed to save. Check server connection.');
    }
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const r = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/resume`, { method: 'POST', body: formData });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setResumeFilename(data.filename);
      setUploadMsg('Resume updated.');
    } catch {
      setUploadMsg('Upload failed — server error.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center" style={{ background: 'var(--ht-bg-2)', color: 'var(--ht-text-3)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--ht-bg-2)' }}>
      {/* Page header */}
      <div
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: 'var(--ht-bg)', borderBottom: '0.5px solid var(--ht-border)' }}
      >
        <div>
          <h1 style={{ color: 'var(--ht-text)', fontFamily: 'var(--ht-font-serif)', fontWeight: 'normal', fontSize: 20, margin: 0 }}>
            Strategy Settings
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ht-text-3)' }}>
            {track ? `${track.emoji ? track.emoji + ' ' : ''}${track.name}` : trackId} · AI candidate profile and job preferences
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

          {/* ── Resume ── */}
          <Section title="Resume" icon="ti-file-text">
            <Field label="Current Resume">
              {resumeFilename ? (
                <div className="flex items-center gap-3">
                  <a
                    href={`/resumes/${resumeFilename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ht-btn"
                    style={{ padding: '6px 12px', textDecoration: 'none' }}
                  >
                    <i className="ti ti-eye" />
                    View PDF
                  </a>
                  <span className="text-xs" style={{ color: 'var(--ht-text-3)' }}>{resumeFilename}</span>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--ht-text-3)' }}>No resume uploaded for this track.</p>
              )}
            </Field>
            <Field label={resumeFilename ? 'Replace Resume' : 'Upload Resume'}>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleResumeUpload} style={{ display: 'none' }} id="resume-upload" />
                <label htmlFor="resume-upload" className="ht-btn" style={{ padding: '6px 12px', cursor: 'pointer' }}>
                  <i className={`ti ${uploading ? 'ti-loader' : 'ti-upload'}`} />
                  {uploading ? 'Uploading…' : 'Choose PDF'}
                </label>
                {uploadMsg && (
                  <span className="text-xs" style={{ color: uploadMsg.includes('failed') ? '#e05' : 'var(--ht-green)' }}>{uploadMsg}</span>
                )}
              </div>
            </Field>
          </Section>

          {/* ── Candidate Profile (global) ── */}
          <Section title="Candidate Profile" icon="ti-user">
            <p className="text-xs" style={{ color: 'var(--ht-text-3)', marginTop: -8 }}>
              These apply globally across all tracks — set once, used everywhere.
            </p>

            <Field label="Visa Status">
              <select value={profile.visaStatus} onChange={e => setP('visaStatus', e.target.value)} className={inputCls} style={inputStyle}>
                {VISA_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Languages">
              <div className="flex flex-wrap gap-3 mt-0.5">
                {LANGUAGE_OPTIONS.map(lang => (
                  <Checkbox key={lang} checked={profile.languages.includes(lang)} onChange={() => toggleLanguage(lang)} label={lang} />
                ))}
              </div>
            </Field>

            <Field label="Mobility">
              <Checkbox
                checked={profile.hasDriversLicense}
                onChange={() => setP('hasDriversLicense', !profile.hasDriversLicense)}
                label="Has G Driver's License / Personal Vehicle"
              />
            </Field>

            <Field label="Security Clearance">
              <Checkbox
                checked={profile.securityClearanceEligible}
                onChange={() => setP('securityClearanceEligible', !profile.securityClearanceEligible)}
                label="Security Clearance Eligible"
              />
            </Field>
          </Section>

          {/* ── Job Preferences (per-track) ── */}
          <Section title="Job Preferences" icon="ti-target">
            <p className="text-xs" style={{ color: 'var(--ht-text-3)', marginTop: -8 }}>
              These are specific to this track — each track has its own settings.
            </p>

            <Field label="Target Roles" hint="Comma-separated list of job titles to target">
              <input
                type="text"
                value={strategy.targetRoles}
                onChange={e => setS('targetRoles', e.target.value)}
                placeholder="IT Support, Help Desk, NOC Analyst"
                className={inputCls}
                style={inputStyle}
              />
            </Field>

            <Field label="Experience Level" hint="Select all levels you're open to">
              <div className="flex flex-wrap gap-3 mt-0.5">
                {EXPERIENCE_OPTIONS.map(level => (
                  <Checkbox key={level} checked={strategy.experienceLevel.includes(level)} onChange={() => toggleExperienceLevel(level)} label={level} />
                ))}
              </div>
            </Field>

            <Field label="Employment Type">
              <div className="flex flex-col gap-2.5 mt-0.5">
                <Radio checked={strategy.employmentType === 'any'} onChange={() => setS('employmentType', 'any')} label="Open to Contracts" />
                <Radio checked={strategy.employmentType === 'permanent'} onChange={() => setS('employmentType', 'permanent')} label="Permanent / Full-time Only" />
                {strategy.employmentType === 'permanent' && (
                  <p className="text-xs" style={{ color: '#F59E0B', marginLeft: 22 }}>
                    <i className="ti ti-alert-triangle" style={{ fontSize: 11, marginRight: 4 }} />
                    AI will hard-block short-term contract and temporary roles
                  </p>
                )}
              </div>
            </Field>

            <Field label="Work Model" hint="Select all you're open to — leave blank for no preference">
              <div className="flex flex-wrap gap-3 mt-0.5">
                {WORK_MODEL_OPTIONS.map(model => (
                  <Checkbox key={model} checked={strategy.workModel.includes(model)} onChange={() => toggleWorkModel(model)} label={model} />
                ))}
              </div>
            </Field>

            <Field label="Blacklisted Keywords" hint="Jobs containing these terms will be deprioritised">
              <input
                type="text"
                value={strategy.blacklistedKeywords}
                onChange={e => setS('blacklistedKeywords', e.target.value)}
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
