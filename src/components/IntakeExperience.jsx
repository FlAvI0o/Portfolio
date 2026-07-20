import { useEffect, useId, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  BUDGET_OPTIONS,
  BUDGET_SOFT_GATE,
  TIMELINE_OPTIONS,
} from '../systems/intake.js';
import { submitProspect } from '../lib/submitProspect.js';
import { CornerButton } from './CornerButton';

const STEPS = {
  PROJECT: 'project',
  TIMELINE: 'timeline',
  BUDGET: 'budget',
  BUDGET_NOTE: 'budget-note',
  EMAIL: 'email',
  MESSAGE: 'message',
  SUCCESS: 'success',
};

const STEP_ORDER_BASE = [
  STEPS.PROJECT,
  STEPS.TIMELINE,
  STEPS.BUDGET,
  STEPS.EMAIL,
  STEPS.MESSAGE,
];

function nextStep(step, answers) {
  if (step === STEPS.PROJECT) return STEPS.TIMELINE;
  if (step === STEPS.TIMELINE) return STEPS.BUDGET;
  if (step === STEPS.BUDGET) {
    return answers.budget === BUDGET_SOFT_GATE ? STEPS.BUDGET_NOTE : STEPS.EMAIL;
  }
  if (step === STEPS.BUDGET_NOTE) return STEPS.EMAIL;
  if (step === STEPS.EMAIL) return STEPS.MESSAGE;
  return null;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Full-viewport project intake — an application state, not a modal.
 * One question at a time; each answer transforms into the next.
 */
export default function IntakeExperience({
  active,
  reducedMotion,
  onClose,
  onSuccess,
  reconstructProgressRef,
}) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const headingId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [step, setStep] = useState(STEPS.PROJECT);
  const [answers, setAnswers] = useState({
    project: '',
    timeline: '',
    budget: '',
    email: '',
    message: '',
  });
  const [optionIndex, setOptionIndex] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [estimatedResponse, setEstimatedResponse] = useState('Within 48 hours');

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const stepRef = useRef(step);
  stepRef.current = step;
  const optionIndexRef = useRef(optionIndex);
  optionIndexRef.current = optionIndex;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;

  useEffect(() => {
    if (!active) return;
    setStep(STEPS.PROJECT);
    setAnswers({
      project: '',
      timeline: '',
      budget: '',
      email: '',
      message: '',
    });
    setOptionIndex(0);
    setError('');
    setSubmitting(false);
    if (reconstructProgressRef) reconstructProgressRef.current = 0;
  }, [active, reconstructProgressRef]);

  // Focus the primary control whenever the step changes.
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const focusable =
      root.querySelector('[data-intake-focus]') ||
      root.querySelector('textarea, input');
    focusable?.focus({ preventScroll: true });
  }, [active, step]);

  // Success: gently reconstruct the world behind the confirmation.
  useGSAP(
    () => {
      if (step !== STEPS.SUCCESS || !reconstructProgressRef) return;

      if (reducedMotion) {
        reconstructProgressRef.current = 1;
        return;
      }

      const state = { r: 0 };
      const tween = gsap.to(state, {
        r: 1,
        duration: 2.4,
        ease: 'power2.inOut',
        onUpdate: () => {
          reconstructProgressRef.current = state.r;
        },
      });

      return () => tween.kill();
    },
    { dependencies: [step, reducedMotion] },
  );

  const goToStep = (next) => {
    const stage = stageRef.current;
    if (!stage || reducedMotionRef.current) {
      setStep(next);
      setError('');
      setOptionIndex(0);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setStep(next);
        setError('');
        setOptionIndex(0);
        gsap.fromTo(
          stage,
          { y: 18, clipPath: 'inset(0% 0% 100% 0%)' },
          {
            y: 0,
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 0.55,
            ease: 'power3.out',
          },
        );
      },
    });

    tl.to(stage, {
      y: -14,
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: 0.4,
      ease: 'power2.in',
    });
  };

  const selectOption = (field, value, index) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setOptionIndex(index);
    setError('');
  };

  const continueFrom = async () => {
    const current = stepRef.current;
    const data = answersRef.current;

    if (current === STEPS.SUCCESS) return;

    if (current === STEPS.PROJECT) {
      if (data.project.trim().length < 2) {
        setError('A short description helps me understand the build.');
        return;
      }
      goToStep(STEPS.TIMELINE);
      return;
    }

    if (current === STEPS.TIMELINE) {
      if (!data.timeline) {
        setError('Choose a timeline to continue.');
        return;
      }
      goToStep(STEPS.BUDGET);
      return;
    }

    if (current === STEPS.BUDGET) {
      if (!data.budget) {
        setError('Choose a budget range to continue.');
        return;
      }
      goToStep(nextStep(STEPS.BUDGET, data));
      return;
    }

    if (current === STEPS.BUDGET_NOTE) {
      goToStep(STEPS.EMAIL);
      return;
    }

    if (current === STEPS.EMAIL) {
      if (!isEmail(data.email)) {
        setError('A valid email is required.');
        return;
      }
      goToStep(STEPS.MESSAGE);
      return;
    }

    if (current === STEPS.MESSAGE) {
      if (submittingRef.current) return;
      setSubmitting(true);
      setError('');
      try {
        const result = await submitProspect({
          project: data.project.trim(),
          timeline: data.timeline,
          budget: data.budget,
          email: data.email.trim(),
          message: data.message.trim() || null,
        });
        if (result?.estimatedResponse) {
          setEstimatedResponse(result.estimatedResponse);
        }
        goToStep(STEPS.SUCCESS);
        onSuccessRef.current?.(result);
      } catch (err) {
        setError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Keyboard UX for the whole intake surface.
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      const current = stepRef.current;
      const options =
        current === STEPS.TIMELINE
          ? TIMELINE_OPTIONS
          : current === STEPS.BUDGET
            ? BUDGET_OPTIONS
            : null;

      if (options) {
        const idx = optionIndexRef.current;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          const next = (idx + 1) % options.length;
          selectOption(
            current === STEPS.TIMELINE ? 'timeline' : 'budget',
            options[next].value,
            next,
          );
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const next = (idx - 1 + options.length) % options.length;
          selectOption(
            current === STEPS.TIMELINE ? 'timeline' : 'budget',
            options[next].value,
            next,
          );
          return;
        }
        const num = Number(event.key);
        if (num >= 1 && num <= options.length) {
          event.preventDefault();
          const opt = options[num - 1];
          selectOption(
            current === STEPS.TIMELINE ? 'timeline' : 'budget',
            opt.value,
            num - 1,
          );
          return;
        }
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        const tag = event.target?.tagName;
        const role = event.target?.getAttribute?.('role');
        // Let native activation fire for chrome/CTA buttons; option
        // buttons should advance the flow instead of only re-selecting.
        if (tag === 'BUTTON' && role !== 'option') return;
        event.preventDefault();
        void continueFrom();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  // Focus trap within the intake root.
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const onFocusIn = (event) => {
      if (!root.contains(event.target)) {
        const first = root.querySelector(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus({ preventScroll: true });
      }
    };

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [active]);

  const progressSteps = STEP_ORDER_BASE;
  const visualStep =
    step === STEPS.BUDGET_NOTE
      ? STEPS.BUDGET
      : step === STEPS.SUCCESS
        ? STEPS.MESSAGE
        : step;
  const progressIndex = Math.max(0, progressSteps.indexOf(visualStep));

  return (
    <div
      ref={rootRef}
      className="intake"
      role="region"
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="intake__chrome">
        <p className="intake__eyebrow label">Project intake</p>
        <button
          type="button"
          className="intake__close label"
          onClick={() => onCloseRef.current?.()}
          aria-label="Close intake and return to portfolio"
        >
          Esc — Close
        </button>
      </div>

      <div
        className="intake__progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={progressSteps.length}
        aria-valuenow={Math.min(progressIndex + 1, progressSteps.length)}
        aria-label="Intake progress"
      >
        {progressSteps.map((id, i) => (
          <span
            key={id}
            className={`intake__progress-seg${i <= progressIndex ? ' is-active' : ''}`}
          />
        ))}
      </div>

      <div ref={stageRef} className="intake__stage">
        {step === STEPS.PROJECT && (
          <StepShell
            headingId={headingId}
            title="What are we building?"
            hint="One sentence is enough. Specificity helps."
          >
            <textarea
              data-intake-focus
              className="intake__field"
              rows={3}
              value={answers.project}
              onChange={(e) => {
                setAnswers((prev) => ({ ...prev, project: e.target.value }));
                setError('');
              }}
              placeholder="e.g. A real-time dashboard for portfolio risk"
              aria-required="true"
              maxLength={500}
            />
            <StepActions onContinue={() => void continueFrom()} continueLabel="Continue" />
          </StepShell>
        )}

        {step === STEPS.TIMELINE && (
          <StepShell
            headingId={headingId}
            title="Timeline?"
            hint="Arrow keys or 1–3 to choose. Enter to continue."
          >
            <OptionList
              options={TIMELINE_OPTIONS}
              value={answers.timeline}
              selectedIndex={optionIndex}
              onSelect={(opt, i) => selectOption('timeline', opt.value, i)}
              name="timeline"
            />
            <StepActions onContinue={() => void continueFrom()} continueLabel="Continue" />
          </StepShell>
        )}

        {step === STEPS.BUDGET && (
          <StepShell
            headingId={headingId}
            title="Budget?"
            hint="Arrow keys or 1–3 to choose. Enter to continue."
          >
            <OptionList
              options={BUDGET_OPTIONS}
              value={answers.budget}
              selectedIndex={optionIndex}
              onSelect={(opt, i) => selectOption('budget', opt.value, i)}
              name="budget"
            />
            <StepActions onContinue={() => void continueFrom()} continueLabel="Continue" />
          </StepShell>
        )}

        {step === STEPS.BUDGET_NOTE && (
          <StepShell
            headingId={headingId}
            title="A note on scope"
            hint="You can still send the request."
          >
            <p className="intake__copy">
              I generally work on larger engagements — typically from €2k and up —
              so I can give the work the depth it needs.
            </p>
            <p className="intake__copy intake__copy--muted">
              If you believe this project is exceptional, you&apos;re still welcome
              to send it. I read every request personally.
            </p>
            <StepActions
              onContinue={() => void continueFrom()}
              continueLabel="Continue anyway"
            />
          </StepShell>
        )}

        {step === STEPS.EMAIL && (
          <StepShell
            headingId={headingId}
            title="Where should I reply?"
            hint="Enter to continue."
          >
            <input
              data-intake-focus
              className="intake__field intake__field--single"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={answers.email}
              onChange={(e) => {
                setAnswers((prev) => ({ ...prev, email: e.target.value }));
                setError('');
              }}
              placeholder="you@company.com"
              aria-required="true"
            />
            <StepActions onContinue={() => void continueFrom()} continueLabel="Continue" />
          </StepShell>
        )}

        {step === STEPS.MESSAGE && (
          <StepShell
            headingId={headingId}
            title="Anything else?"
            hint="Optional. Enter to send."
          >
            <textarea
              data-intake-focus
              data-intake-multiline="true"
              className="intake__field"
              rows={4}
              value={answers.message}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, message: e.target.value }))
              }
              placeholder="Context, constraints, links — whatever helps."
              maxLength={2000}
            />
            <StepActions
              onContinue={() => void continueFrom()}
              continueLabel={submitting ? 'Sending…' : 'Send request'}
              disabled={submitting}
            />
          </StepShell>
        )}

        {step === STEPS.SUCCESS && (
          <StepShell headingId={headingId} title="Project received." hint="">
            <p className="intake__copy">I&apos;ll review it personally.</p>
            <p className="intake__copy intake__copy--muted">
              Estimated response: {estimatedResponse}
            </p>
            <StepActions
              onContinue={() => onCloseRef.current?.()}
              continueLabel="Back to portfolio"
            />
          </StepShell>
        )}

        {error ? (
          <p className="intake__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StepShell({ headingId, title, hint, children }) {
  return (
    <div className="intake__step">
      <h2 id={headingId} className="intake__title">
        {title}
      </h2>
      {hint ? <p className="intake__hint label">{hint}</p> : null}
      <div className="intake__body">{children}</div>
    </div>
  );
}

function OptionList({ options, value, selectedIndex, onSelect, name }) {
  return (
    <div
      className="intake__options"
      role="listbox"
      aria-label={name}
      aria-activedescendant={`${name}-opt-${selectedIndex}`}
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        const active = i === selectedIndex;
        return (
          <button
            key={opt.value}
            id={`${name}-opt-${i}`}
            type="button"
            role="option"
            aria-selected={selected}
            data-intake-focus={i === 0 ? true : undefined}
            className={`intake__option${selected || active ? ' is-active' : ''}`}
            onClick={() => onSelect(opt, i)}
            onFocus={() => onSelect(opt, i)}
          >
            <span className="intake__option-key" aria-hidden="true">
              {i + 1}
            </span>
            <span className="intake__option-text">
              <span className="intake__option-label">{opt.label}</span>
              <span className="intake__option-hint">{opt.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepActions({ onContinue, continueLabel, disabled = false }) {
  return (
    <div className="intake__actions">
      <CornerButton
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="intake__cta"
      >
        {continueLabel}
      </CornerButton>
      <span className="intake__kbd label" aria-hidden="true">
        Enter
      </span>
    </div>
  );
}
