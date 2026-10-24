import './meditrace-sections.css';

const defaultSteps = [
  {
    number: '01',
    title: 'Enter medicines',
    description:
      'Add the medicines from a prescription so MediTrace can compare each entry with the available documented dataset.',
  },
  {
    number: '02',
    title: 'Check documented rules',
    description:
      'Recognised medicines are checked only against supported duplicate-ingredient and interaction rules available to the prototype.',
  },
  {
    number: '03',
    title: 'Review findings',
    description:
      'Review each finding alongside its evidence and any ambiguity that needs a person to verify it.',
  },
];

/**
 * Explains the MediTrace workflow without coupling it to a particular page layout.
 * The steps can be overridden for future product variations while retaining the
 * accessible structure and visual treatment.
 */
export default function HowItWorks({
  eyebrow = 'How MediTrace works',
  title = 'A clearer path from prescription to review.',
  intro = 'MediTrace helps organise a safety review by separating what is recognised, what is supported by evidence, and what still needs human attention.',
  steps = defaultSteps,
  sectionId = 'meditrace-how-it-works',
}) {
  return (
    <section
      className="meditrace-section meditrace-how-it-works"
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
    >
      <div className="meditrace-section__container">
        <header className="meditrace-section__header">
          <p className="meditrace-eyebrow">{eyebrow}</p>
          <h2 className="meditrace-section__title" id={`${sectionId}-title`}>
            {title}
          </h2>
          <p className="meditrace-section__intro">{intro}</p>
        </header>

        <ol className="meditrace-step-list" aria-label="MediTrace workflow steps">
          {steps.map((step) => (
            <li className="meditrace-step-card" key={`${step.number}-${step.title}`}>
              <article>
                <div className="meditrace-step-card__number" aria-hidden="true">
                  {step.number}
                </div>
                <div>
                  <h3 className="meditrace-step-card__title">{step.title}</h3>
                  <p className="meditrace-step-card__description">{step.description}</p>
                </div>
              </article>
            </li>
          ))}
        </ol>

        <p className="meditrace-disclaimer">
          <span className="meditrace-disclaimer__label">Important:</span>{' '}
          MediTrace is a prototype that supports review; it cannot guarantee that a prescription is safe.
        </p>
      </div>
    </section>
  );
}
