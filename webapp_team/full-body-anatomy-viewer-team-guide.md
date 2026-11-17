# Full-Body 3D Anatomy Viewer --- Team Integration Guide

**Project purpose:** Add an interactive full-body anatomy model to the
web app so users can explore anatomical structures directly from the
interface.

**Selected model:** [Open Anatomy
3D](https://github.com/MervinR07/open-anatomy-3d)\
**Live demo:** https://mervinr07.github.io/open-anatomy-3d/\
**React viewer documentation:**
https://github.com/MervinR07/open-anatomy-3d/tree/main/packages/open-anatomy-3d-react

------------------------------------------------------------------------

## 1. What we are building

The full-body model will be a visual entry point for anatomy
exploration. Users should be able to:

-   Rotate the model by dragging.
-   Zoom in and out.
-   Pan around the model where supported by the viewer controls.
-   Hover over a structure to identify/highlight it.
-   Click a structure to select it and show its information.
-   Turn anatomical system layers on or off using the viewer's layer
    controls.
-   Switch between the available male and female body models if that
    option is enabled.

The model is an educational exploration tool. It must not be presented
as a diagnostic tool or as a substitute for professional medical advice.

## 2. Why this model was selected

The Open Anatomy 3D project provides full-body male and female GLB
models and a React viewer designed for interactive anatomy exploration.
Its documented features include structure hover and selection, layer
controls, orbit/zoom interaction, and anatomical structure metadata.

The repository describes approximately 147 anatomical structures across
body systems. The model assets are reported at roughly 7.6 MB and 8.1 MB
before any additional delivery optimisation. Treat these figures as
indicative; verify the actual files and network transfer size in the
version we install.

**Important:** The viewer and its model assets have separate
licensing/attribution requirements. The project code is MIT licensed,
while the model/catalog assets are described as CC BY 4.0. Confirm the
current licence files in the exact version being used before shipping.
Preserve the required attribution in the app.

## 3. Recommended application stack

Use the existing application stack wherever possible. The intended
integration is:

-   React + Vite
-   TypeScript
-   Tailwind CSS
-   shadcn/ui for surrounding interface components
-   Three.js
-   React Three Fiber
-   Drei
-   Open Anatomy 3D React viewer

Do not replace or upgrade the app's React or React Three Fiber versions
just to make the viewer install. The viewer README reports testing with
React 18, React Three Fiber 8, and Drei 9. Check the current app's
`package.json` and the package's latest compatibility notes first. Avoid
`--force` and `--legacy-peer-deps` as a first response to dependency
conflicts.

## 4. Installation

From the project root, inspect the current dependencies:

``` bash
cat package.json
```

If the project versions are compatible with the viewer package, install
the documented packages:

``` bash
npm install open-anatomy-3d open-anatomy-3d-react three @react-three/fiber @react-three/drei
```

If Three.js, React Three Fiber, or Drei are already installed, do not
blindly add duplicate or conflicting versions. Resolve compatibility
against the viewer's current README and the project's lockfile.

After installation, run the app's normal checks:

``` bash
npm run build
npm run dev
```

If the package API or stylesheet path has changed in the installed
release, follow that release's README rather than copying an outdated
example.

## 5. Suggested file organisation

Keep the 3D viewer isolated from page layout and business logic:

``` text
src/
  components/
    anatomy/
      BodyAnatomy.tsx
      AnatomyLoading.tsx
      AnatomyDetailsPanel.tsx
  pages/
    Anatomy.tsx
```

Responsibilities:

-   `BodyAnatomy.tsx`: wrapper around the third-party anatomy viewer and
    its event handlers.
-   `AnatomyLoading.tsx`: lightweight loading state shown while the
    viewer/model is being loaded.
-   `AnatomyDetailsPanel.tsx`: app-owned panel for the selected
    structure. Keep content and styling separate from the 3D canvas.
-   `Anatomy.tsx`: page composition, routing, and responsive layout.

The component names are recommendations; adapt them to the repository's
existing conventions.

## 6. Basic React integration

Create `src/components/anatomy/BodyAnatomy.tsx`:

``` tsx
import { useState } from "react";
import { AnatomyViewer } from "open-anatomy-3d-react";
import "open-anatomy-3d-react/styles.css";

type BodyAnatomyProps = {
  onStructureSelect?: (key: string, structure: unknown) => void;
};

export function BodyAnatomy({ onStructureSelect }: BodyAnatomyProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <section className="relative h-[620px] w-full overflow-hidden rounded-xl bg-white">
      <AnatomyViewer
        defaultSex="male"
        showSexToggle
        showLayerToggles
        showZoomControls
        showRotateControl
        hoverHint="Click to explore"
        onStructureHover={(key) => setHoveredKey(key)}
        onStructureClick={(key, structure) => {
          setSelectedKey(key);
          onStructureSelect?.(key, structure);
        }}
      />

      <div className="sr-only" aria-live="polite">
        {hoveredKey ? `Highlighted structure: ${hoveredKey}` : ""}
        {selectedKey ? `Selected structure: ${selectedKey}` : ""}
      </div>
    </section>
  );
}
```

Notes:

-   This is a starting integration example. Confirm the exact prop types
    and callback signatures against the installed package version.
-   The viewer already provides its own hover hint/label behaviour. The
    app can use `onStructureHover` to synchronise other UI, such as a
    details panel or accessible status text.
-   `onStructureClick` should update app state and open the app's own
    details panel.
-   `structure` is typed as `unknown` in this minimal example
    intentionally. Replace it with the package's exported structure type
    if one is available; otherwise validate/normalise the data before
    reading properties.
-   `defaultSex="male"` is only the initial display choice. Keep the
    toggle visible if users should be able to switch models.
-   The fixed height is only an example. Use responsive sizing
    appropriate to the page and test on small screens.

## 7. Page layout and interaction design

Recommended desktop layout:

-   Main area: large anatomy viewer.
-   Side panel: selected structure name, description, and related
    information.
-   Viewer controls: retain the package's built-in controls unless the
    product design calls for a carefully tested replacement.

Recommended mobile layout:

-   Viewer takes the available width and a controlled height.
-   Details appear below the viewer or in a collapsible sheet.
-   Do not force a desktop-width side panel onto a narrow screen.
-   Keep touch targets large enough to use comfortably.

Interaction rules:

  -----------------------------------------------------------------------
  User action                         Expected behaviour
  ----------------------------------- -----------------------------------
  Hover over a structure              Highlight it and show its
                                      anatomical label where supported

  Click/tap a structure               Select it and update the details
                                      panel

  Drag                                Rotate the model

  Zoom control / pinch                Zoom in or out

  Pan gesture/control                 Move the camera view where
                                      supported

  Toggle a body-system layer          Show or hide that system

  Switch sex model                    Load/display the corresponding
                                      model
  -----------------------------------------------------------------------

Do not make the model rotate merely because the pointer happens to pass
over it. Rotation should be deliberate (drag or an explicit rotate
control). Hover should be reserved for highlighting and identification.
`
## 8. Loading and performance requirements

The model is a relatively substantial 3D asset. Treat loading and
rendering as a performance-sensitive feature.

### Required practices

1.  **Lazy-load the viewer.** Do not make the 3D viewer part of the
    initial JavaScript bundle for pages that do not need it. Use
    `React.lazy()` and `Suspense`, or the app's existing route-level
    lazy-loading approach.
2.  **Show a loading state.** Display a clean placeholder/skeleton while
    the viewer code and model are loading.
3.  **Avoid loading both body models unnecessarily.** Load the selected
    model first; load the alternate model only when the user switches,
    if the package permits this behaviour.
4.  **Cache model assets.** If self-hosting, configure suitable
    long-lived caching for versioned/static GLB assets.
5.  **Use the supplied optimised assets.** The project documents
    Meshopt-compressed geometry. Do not re-export or recompress the
    model without checking that the viewer's decoder/configuration still
    supports it.
6.  **Avoid duplicate canvases.** Mount one viewer for the active
    anatomy page instead of rendering hidden copies in tabs or modals.
7.  **Unmount when no longer needed.** Release the WebGL viewer when
    leaving the page if the app's routing/lifecycle design allows it.
8.  **Keep surrounding UI lightweight.** Do not add large animation
    libraries or unnecessary state dependencies for simple selection and
    panel updates.
9.  **Measure on real devices.** Test first load, model load,
    interaction smoothness, memory use, and route transitions on
    mid-range mobile hardware as well as desktop.

### Loading strategy

-   Load the React viewer only when the anatomy route or component is
    opened.
-   Keep the loading placeholder visible until the viewer is ready.
-   Avoid blocking the rest of the page while the 3D assets download.
-   If the package supports custom model URLs, decide whether to use its
    default CDN URLs or self-host the exact licensed assets. For
    production reliability and control, self-hosting may be preferable,
    but confirm package configuration and attribution requirements
    first.

### Performance acceptance checks

-   The rest of the app remains usable while the model loads.
-   The page does not download the anatomy models before the user needs
    the viewer.
-   Hover, selection, rotation, and zoom remain responsive after
    loading.
-   No repeated model downloads occur during ordinary navigation when
    caching should apply.
-   No console errors, WebGL context errors, or unhandled promise
    rejections occur.
-   The viewer behaves acceptably on a mid-range mobile device.

## 9. Selection data and details panel

Keep the selected structure key in React state. When a user selects a
structure:

1.  Save the structure key.
2.  Retrieve the corresponding metadata from the package/catalog or the
    app's own anatomy content source.
3.  Render the structure name and approved educational description in
    the details panel.
4.  Optionally provide related structures or links to deeper learning
    content.

Do not assume every structure has a complete description in the model
catalogue. The 3D model's structure identifiers are not, by themselves,
a complete medical content database.

Keep content separate from rendering. This makes it possible to improve
or localise descriptions without changing the 3D model.

## 10. Full-body model versus ENT models

The full-body model is the general anatomy entry point. The separately
sourced ENT GLB files are intended for more detailed ear, nose, and
throat exploration.

Do not merge the ENT models into the full-body asset automatically.
Treat them as separate focused experiences unless the product team later
approves a combined scene. This keeps the initial full-body experience
simpler and avoids loading detailed ENT assets on every anatomy visit.

When integrating the ENT models, inspect each GLB's mesh names, origin,
scale, orientation, materials, file size, and licence. Build a mapping
from mesh identifiers to human-readable labels before implementing
selection and information panels.

## 11. Attribution and licensing

Before release:

-   Review the licence files in the exact Open Anatomy 3D version being
    used.
-   Include the required model attribution in an accessible
    Credits/About area of the application.
-   Preserve any required notices when copying model files into the
    app's own public assets.
-   Keep code licensing separate from model/data licensing.
-   Do not remove upstream credits or imply that the app created the
    anatomy models.
-   Re-check licence terms if the model package or assets are updated.

The repository documents the code as MIT and model/catalog assets as CC
BY 4.0. Verify this against the actual release and included licence
files before production distribution.

## 12. Medical and content safeguards

-   Label the experience as educational anatomy exploration.
-   Do not describe the model as clinically validated unless that
    validation has been independently established.
-   Do not use the model alone to support diagnosis, treatment, or
    clinical decisions.
-   Have anatomy labels and explanatory text reviewed by a suitably
    qualified subject-matter expert before publication.
-   If a structure is missing, simplified, or incorrectly labelled, do
    not silently present it as authoritative. Record the issue and
    correct the content or hide the affected label.

## 13. Team implementation checklist

### Before installation

-   [ ] Inspect `package.json` and lockfile.
-   [ ] Confirm React / React Three Fiber / Drei compatibility.
-   [ ] Read the current viewer README and package release notes.
-   [ ] Review code and model licences.

### During implementation

-   [ ] Install only compatible dependencies.
-   [ ] Add the viewer as an isolated anatomy component.
-   [ ] Add a loading fallback.
-   [ ] Lazy-load the viewer at route/component level.
-   [ ] Wire hover and selection callbacks.
-   [ ] Add the app-owned structure details panel.
-   [ ] Make the page responsive.
-   [ ] Add attribution/credits.

### Before release

-   [ ] Test male/female model switching.
-   [ ] Test hover, click, drag rotation, zoom, and layer toggles.
-   [ ] Test keyboard and touch usability where supported.
-   [ ] Test on desktop and mid-range mobile.
-   [ ] Inspect network requests and caching.
-   [ ] Check browser console and WebGL errors.
-   [ ] Verify anatomy labels and educational content.
-   [ ] Confirm attribution and licence notices are present.

## 14. Official references

-   Open Anatomy 3D repository:
    https://github.com/MervinR07/open-anatomy-3d
-   React viewer package documentation:
    https://github.com/MervinR07/open-anatomy-3d/tree/main/packages/open-anatomy-3d-react
-   NPM package: https://www.npmjs.com/package/open-anatomy-3d
-   Live demo: https://mervinr07.github.io/open-anatomy-3d/

**Team rule:** Treat the upstream README and licence files for the exact
installed release as the source of truth for package APIs,
compatibility, asset URLs, and attribution. This document describes our
intended integration approach; verify implementation details against the
version actually installed.
