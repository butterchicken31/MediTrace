# MediTrace

## Current repository state

The repository currently contains the initial project skeleton. The reusable explanatory sections are implemented independently of the eventual app scaffold so they can be integrated into the team frontend without replacing anyone's work.

### Frontend components

- `components/HowItWorks.jsx` — three-stage workflow: enter medicines, check supported documented rules, and review findings with evidence and uncertainty.
- `components/TrustTransparency.jsx` — explains dataset boundaries, traceability, uncertainty handling, and why an absent warning is not a guarantee of safety.
- `components/meditrace-sections.css` — shared responsive styling for both sections using plain CSS; no additional dependency is required.

### Integration

Once the team frontend has a React entry point, import the components into the relevant page or landing-screen composition:

```jsx
import HowItWorks from './components/HowItWorks';
import TrustTransparency from './components/TrustTransparency';

export default function LandingPage() {
  return (
    <main>
      {/* Mitisha's existing hero and prescription workflow */}
      <HowItWorks />
      <TrustTransparency />
    </main>
  );
}
```

Both components accept optional text and data props, including `sectionId`, so the page can customise copy or render each section once without coupling them to the prescription form or backend contract. The CSS is imported by each component and should be bundled by the app's normal CSS pipeline.

### Important product boundary

MediTrace is a hackathon prototype for supported, source-backed checks. It must not claim to guarantee prescription safety. Unknown or ambiguous medicines should remain visible for review, and the frontend should display evidence supplied by the backend rather than inventing clinical explanations.
