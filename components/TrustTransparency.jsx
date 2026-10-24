import './meditrace-sections.css';

const defaultTrustPoints = [
  {
    title: 'Bounded by the available dataset',
    description:
      'Results are limited to the medicines, sources, and clinical rules that have been documented for this prototype.',
  },
  {
    title: 'Evidence stays visible',
    description:
      'A clinical warning should be traceable to supporting evidence so reviewers can understand where it came from.',
  },
  {
    title: 'Uncertainty is a result',
    description:
      'Unknown medicines, ambiguous matches, and insufficient evidence are flagged for review instead of being guessed.',
  },
  {
    title: 'No warning is not a guarantee',
    description:
      'If an interaction is not shown, that only means it was not identified in the supported rules—it does not mean the combination is safe.',
  },
];

/**
 * Sets transparent expectations around evidence, uncertainty, and prototype scope.
 * Pass a custom `points` array when the product needs a different presentation.
 */
export default function TrustTransparency({
  eyebrow = 'Trust & transparency',
  title = 'Know what the result means—and what it does not.',
  intro = 'MediTrace is designed to make the limits of an automated review visible, not to hide them behind a single safety score.',
  points = defaultTrustPoints,
  sectionId = 'meditrace-trust-transparency',
}) {
  return (
    <section
      className="meditrace-section meditrace-trust"
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
    >
      <div className="meditrace-section__container meditrace-trust__layout">
        <header className="meditrace-section__header meditrace-trust__header">
          <p className="meditrace-eyebrow">{eyebrow}</p>
          <h2 className="meditrace-section__title" id={`${sectionId}-title`}>
            {title}
          </h2>
          <p className="meditrace-section__intro">{intro}</p>
        </header>

        <ul className="meditrace-trust-list">
          {points.map((point) => (
            <li className="meditrace-trust-card" key={point.title}>
              <span className="meditrace-trust-card__mark" aria-hidden="true">
                ✓
              </span>
              <div>
                <h3 className="meditrace-trust-card__title">{point.title}</h3>
                <p className="meditrace-trust-card__description">{point.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
