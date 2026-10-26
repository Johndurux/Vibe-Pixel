'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import {
  MAX_LOGO_BYTES,
  SLOT_COLORS,
  SLOT_SIZES,
  isAllowedLogoType,
  isContractAddress,
  isHttpsUrl,
  type ClaimState,
} from '@/lib/claim';

const COLOR_NAMES: Record<string, string> = {
  '#FFD23F': 'Yellow',
  '#FF5A36': 'Orange',
  '#C9A876': 'Cork',
  '#A68B5E': 'Dark cork',
  '#F2EADF': 'Cream',
  '#16140F': 'Ink',
};

interface ClaimSheetProps {
  claim: ClaimState;
  setClaim: Dispatch<SetStateAction<ClaimState>>;
  positionBlocked: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

export default function ClaimSheet({
  claim,
  setClaim,
  positionBlocked,
  onClose,
  onSubmit,
}: ClaimSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const size = claim.size ?? 10;
  const linkInlineError =
    claim.fieldErrors.link ||
    (claim.link.length > 0 && !isHttpsUrl(claim.link)
      ? 'Project link must start with https://.'
      : '');
  const contractInlineError =
    claim.fieldErrors.contractAddress ||
    (claim.contractAddress.length > 0 && !isContractAddress(claim.contractAddress)
      ? 'Use 0x followed by 40 hex characters.'
      : '');
  const sheetTitle =
    claim.step === 'size'
      ? 'Pick your size'
      : claim.step === 'details'
        ? 'Project details'
        : claim.step === 'success'
          ? 'Submitted'
          : 'Place your slot';

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      sheetRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (claim.step === 'details') {
      const input = document.getElementById('claim-project-name');
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    if (claim.step === 'success') {
      const close = document.querySelector<HTMLButtonElement>('[data-claim-success-close]');
      close?.focus();
      return;
    }
    sheetRef.current?.focus();
  }, [claim.step]);

  useEffect(() => {
    if (!claim.logoFile) {
      setLogoPreview(null);
      return;
    }

    const url = URL.createObjectURL(claim.logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [claim.logoFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || claim.step === 'position') return;

      const root = sheetRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusables.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [claim.step, onClose]);

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleSizeNext = () => {
    if (!claim.size) return;
    setClaim((current) => ({
      ...current,
      step: 'position',
      position: null,
      generalError: null,
      retryable: false,
      fieldErrors: { ...current.fieldErrors, position: undefined },
    }));
  };

  const handleConfirmPosition = () => {
    if (!claim.position || positionBlocked) return;
    setClaim((current) => ({
      ...current,
      step: 'details',
      generalError: null,
      retryable: false,
      fieldErrors: { ...current.fieldErrors, position: undefined },
    }));
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setClaim((current) => ({
        ...current,
        logoFile: null,
        fieldErrors: { ...current.fieldErrors, logo: undefined },
      }));
      return;
    }

    if (!isAllowedLogoType(file.type)) {
      event.target.value = '';
      setClaim((current) => ({
        ...current,
        logoFile: null,
        fieldErrors: { ...current.fieldErrors, logo: 'Logo must be PNG, JPG, or WEBP.' },
      }));
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      event.target.value = '';
      setClaim((current) => ({
        ...current,
        logoFile: null,
        fieldErrors: { ...current.fieldErrors, logo: 'Logo must be 200KB or smaller.' },
      }));
      return;
    }

    setClaim((current) => ({
      ...current,
      logoFile: file,
      fieldErrors: { ...current.fieldErrors, logo: undefined },
    }));
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (claim.submitting) return;
    void onSubmit();
  };

  if (claim.step === 'position') {
    return (
      <div className="claim-position-wrap">
        <section
          ref={sheetRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="claim-position-title"
          data-testid="claim-position-bar"
          className="claim-position-bar"
        >
          <div className="claim-position-head">
            <div>
              <h2 id="claim-position-title">Tap the board to place your {size}x{size} slot.</h2>
              <p className="claim-position-meta">
                {claim.position
                  ? `Position: ${claim.position.x}, ${claim.position.y}`
                  : 'Position: not set'}
              </p>
              {positionBlocked ? (
                <p className="claim-error">That spot is taken. Pick another.</p>
              ) : null}
              {claim.fieldErrors.position ? (
                <p className="claim-error">{claim.fieldErrors.position}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close claim form"
              className="claim-close"
            >
              ×
            </button>
          </div>
          <div className="claim-position-actions">
            <button
              type="button"
              onClick={() =>
                setClaim((current) => ({
                  ...current,
                  step: 'size',
                  generalError: null,
                  retryable: false,
                }))
              }
              className="btn-paper claim-secondary"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmPosition}
              disabled={!claim.position || positionBlocked}
              className="btn-sticker claim-action"
            >
              Confirm position
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="claim-backdrop" onClick={handleBackdropClick}>
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-sheet-title"
        data-testid="claim-sheet"
        className="claim-sheet"
      >
        <header className="claim-sheet-header">
          <div>
            <p className="claim-eyebrow">Claim a slot</p>
            <h2 id="claim-sheet-title">{sheetTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close claim form"
            className="claim-close"
          >
            ×
          </button>
        </header>

        {claim.step === 'size' ? (
          <div className="claim-sheet-body">
            <p className="claim-helper">Choose a size for your block.</p>
            <div className="claim-size-grid">
              {SLOT_SIZES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setClaim((current) => ({
                      ...current,
                      size: option.value,
                      position: null,
                      fieldErrors: { ...current.fieldErrors, position: undefined },
                    }))
                  }
                  aria-label={`${option.label} ${option.cells} (${option.pixels})`}
                  aria-pressed={claim.size === option.value}
                  data-selected={claim.size === option.value}
                  className="claim-size-card"
                >
                  <span className="claim-size-preview">
                    <span className="claim-size-square" style={{ width: option.preview }} />
                  </span>
                  <span className="claim-size-label">
                    <span>{option.label}</span>
                    <small>{option.cells}</small>
                    <small>{option.pixels}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="claim-sheet-actions">
              <button
                type="button"
                onClick={handleSizeNext}
                disabled={!claim.size}
                className="btn-sticker claim-action"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {claim.step === 'details' ? (
          <div className="claim-sheet-body">
            <div className="claim-position-summary">
              <span>
                {size}x{size} at{' '}
                {claim.position ? `${claim.position.x}, ${claim.position.y}` : 'no position'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setClaim((current) => ({
                    ...current,
                    step: 'position',
                    generalError: null,
                    retryable: false,
                  }))
                }
                className="claim-text-button"
              >
                Change
              </button>
            </div>
            {claim.fieldErrors.position ? (
              <p className="claim-error">{claim.fieldErrors.position}</p>
            ) : null}

            <form noValidate onSubmit={handleFormSubmit} className="claim-form">
              <div className="claim-field">
                <div className="claim-label-row">
                  <label htmlFor="claim-project-name">Project name</label>
                  <span id="claim-project-name-count" className="claim-counter">
                    {claim.projectName.length}/40
                  </span>
                </div>
                <input
                  id="claim-project-name"
                  name="project_name"
                  type="text"
                  maxLength={40}
                  required
                  value={claim.projectName}
                  onChange={(event) =>
                    setClaim((current) => ({
                      ...current,
                      projectName: event.target.value,
                      fieldErrors: { ...current.fieldErrors, projectName: undefined },
                    }))
                  }
                  aria-invalid={Boolean(claim.fieldErrors.projectName)}
                  aria-describedby={`claim-project-name-count${
                    claim.fieldErrors.projectName ? ' claim-project-name-error' : ''
                  }`}
                  className="claim-input"
                />
                {claim.fieldErrors.projectName ? (
                  <p id="claim-project-name-error" className="claim-error">
                    {claim.fieldErrors.projectName}
                  </p>
                ) : null}
              </div>

              <div className="claim-field">
                <div className="claim-label-row">
                  <label htmlFor="claim-description">
                    Description <span className="claim-optional">(optional)</span>
                  </label>
                  <span id="claim-description-count" className="claim-counter">
                    {claim.description.length}/140
                  </span>
                </div>
                <textarea
                  id="claim-description"
                  name="description"
                  maxLength={140}
                  rows={3}
                  value={claim.description}
                  onChange={(event) =>
                    setClaim((current) => ({
                      ...current,
                      description: event.target.value,
                      fieldErrors: { ...current.fieldErrors, description: undefined },
                    }))
                  }
                  aria-invalid={Boolean(claim.fieldErrors.description)}
                  aria-describedby={`claim-description-count${
                    claim.fieldErrors.description ? ' claim-description-error' : ''
                  }`}
                  className="claim-input claim-textarea"
                />
                {claim.fieldErrors.description ? (
                  <p id="claim-description-error" className="claim-error">
                    {claim.fieldErrors.description}
                  </p>
                ) : null}
              </div>

              <div className="claim-field">
                <label htmlFor="claim-link">Project link</label>
                <input
                  id="claim-link"
                  name="link"
                  type="url"
                  inputMode="url"
                  placeholder="https://..."
                  required
                  value={claim.link}
                  onChange={(event) =>
                    setClaim((current) => ({
                      ...current,
                      link: event.target.value,
                      fieldErrors: { ...current.fieldErrors, link: undefined },
                    }))
                  }
                  aria-invalid={Boolean(linkInlineError)}
                  aria-describedby={linkInlineError ? 'claim-link-error' : undefined}
                  className="claim-input"
                />
                {linkInlineError ? (
                  <p id="claim-link-error" className="claim-error">
                    {linkInlineError}
                  </p>
                ) : null}
              </div>

              <div className="claim-field">
                <label htmlFor="claim-logo">Logo</label>
                <div className="claim-file-row">
                  <label htmlFor="claim-logo" className="btn-paper claim-file-button">
                    Choose logo
                  </label>
                  <input
                    id="claim-logo"
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                    aria-label="Upload project logo"
                    aria-describedby={`claim-logo-help${
                      claim.fieldErrors.logo ? ' claim-logo-error' : ''
                    }`}
                    className="claim-file-input"
                  />
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Selected logo preview"
                      className="claim-logo-preview"
                    />
                  ) : null}
                </div>
                <p id="claim-logo-help" className="claim-helper">
                  PNG, JPG, or WEBP. Max 200KB.
                </p>
                {claim.logoFile ? <p className="claim-file-name">{claim.logoFile.name}</p> : null}
                {claim.fieldErrors.logo ? (
                  <p id="claim-logo-error" className="claim-error">
                    {claim.fieldErrors.logo}
                  </p>
                ) : null}
              </div>

              <fieldset className="claim-field">
                <legend className="claim-label">Slot color</legend>
                <div className="claim-swatches">
                  {SLOT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setClaim((current) => ({
                          ...current,
                          color,
                          fieldErrors: { ...current.fieldErrors, color: undefined },
                        }))
                      }
                      aria-label={`Use ${COLOR_NAMES[color] ?? color} (${color}) for the slot`}
                      aria-pressed={claim.color === color}
                      data-selected={claim.color === color}
                      className="claim-swatch"
                      style={{ backgroundColor: color }}
                    >
                      {claim.color === color ? (
                        <span aria-hidden="true" className="claim-swatch-check">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                {claim.fieldErrors.color ? (
                  <p className="claim-error">{claim.fieldErrors.color}</p>
                ) : null}
              </fieldset>

              <div className="claim-field">
                <label htmlFor="claim-contract">
                  Contract address <span className="claim-optional">(optional)</span>
                </label>
                <input
                  id="claim-contract"
                  name="contract_address"
                  type="text"
                  placeholder="0x..."
                  value={claim.contractAddress}
                  onChange={(event) =>
                    setClaim((current) => ({
                      ...current,
                      contractAddress: event.target.value,
                      fieldErrors: { ...current.fieldErrors, contractAddress: undefined },
                    }))
                  }
                  aria-invalid={Boolean(contractInlineError)}
                  aria-describedby={contractInlineError ? 'claim-contract-error' : undefined}
                  className="claim-input"
                />
                {contractInlineError ? (
                  <p id="claim-contract-error" className="claim-error">
                    {contractInlineError}
                  </p>
                ) : null}
              </div>

              <div className="claim-honeypot" aria-hidden="true">
                <label htmlFor="claim-website">Website</label>
                <input
                  id="claim-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  value={claim.honeypot}
                  onChange={(event) =>
                    setClaim((current) => ({ ...current, honeypot: event.target.value }))
                  }
                />
              </div>

              {claim.generalError ? (
                <div className="claim-error-box" role="alert">
                  <p>{claim.generalError}</p>
                  {claim.retryable ? (
                    <button
                      type="button"
                      onClick={() => void onSubmit()}
                      className="btn-paper claim-secondary"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="claim-sheet-actions">
                <button
                  type="button"
                  onClick={() =>
                    setClaim((current) => ({
                      ...current,
                      step: 'position',
                      generalError: null,
                      retryable: false,
                    }))
                  }
                  className="btn-paper claim-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={claim.submitting}
                  className="btn-sticker claim-action"
                >
                  {claim.submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {claim.step === 'success' ? (
          <div className="claim-sheet-body">
            <p className="claim-success">Submitted! Your slot is pending review.</p>
            <div className="claim-sheet-actions">
              <button
                type="button"
                onClick={onClose}
                data-claim-success-close
                className="btn-sticker claim-action"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
