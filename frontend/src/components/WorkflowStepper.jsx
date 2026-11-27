const STEPS = [
  { number: 1, label: "Configure & Upload" },
  { number: 2, label: "Select Concepts" },
  { number: 3, label: "Review & Retry" },
  { number: 4, label: "Publish" },
];

export default function WorkflowStepper({ currentStep = 1, published = false }) {
  return (
    <nav className="workflow-stepper" aria-label="Exam creation progress">
      {STEPS.map((step) => {
        const isCompleted =
          step.number < currentStep || (published && step.number === 4);
        const isActive = !isCompleted && step.number === currentStep;
        const statusClass = isCompleted
          ? "done"
          : isActive
            ? "active"
            : "";

        return (
          <div
            key={step.number}
            className={`stepper-item ${statusClass}`.trim()}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="stepper-indicator" aria-hidden="true">
              {isCompleted ? (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isActive ? (
                <span className="stepper-dot" />
              ) : (
                step.number
              )}
            </span>
            <span className="stepper-label">
              {step.number}. {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
