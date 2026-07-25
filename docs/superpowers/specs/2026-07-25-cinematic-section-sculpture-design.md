# Cinematic Section Sculpture

## Goal

Upgrade the existing WebGL chrome sculpture so it feels cinematic and premium
while remaining medium-sized. The stormcloud and lightning field must stay
clearly visible and retain equal visual importance.

## Visual Direction

- Keep the current approximate on-screen scale rather than turning the
  sculpture into an oversized hero object.
- Improve perceived value through material, lighting, silhouette detail, and
  motion: layered liquid chrome, deep reflections, controlled iridescence,
  crisp specular highlights, soft rim bloom, and slow weighted rotation.
- Preserve the dark storm backdrop and the unfinished cloud/lightning changes
  already present in `lib/latent/shader.ts`.
- Avoid noisy micro-detail, excessive glow, fast spinning, or shapes that read
  as generic SDF demos.

## Section-to-Shape Narrative

The sculpture is a single object that evolves with the page story:

1. **Hero / AI studio:** an organic liquid intelligence core with satellite
   lobes, representing generative potential.
2. **Brojevi:** four connected data nodes with a central core, representing
   measurable growth rather than a generic crystal.
3. **Rezultati:** a dimensional signal/reach portal with a broken, fluid rim,
   replacing the plain torus.
4. **Paketi:** interlocked premium modules with softened seams, representing
   packaged deliverables rather than stacked cubes.
5. **Edukacija:** a connected neural/knowledge form with branching nodes,
   replacing the generic spiky star.
6. **Booking:** a resolved pearl-like sphere with a subtle equatorial fold,
   communicating completion and focus.

## Motion and Choreography

- Keep section-based scroll choreography, but use the page's clear upper-right
  corridor instead of crossing dense copy and pricing cards. The booking form
  resolves to center.
- Bind each semantic form to the measured DOM position of its actual section
  so sticky content, CMS changes, and responsive heights cannot desynchronize
  the narrative.
- Morph continuously between neighboring section shapes using eased progress;
  no hard swaps or visible collapse through a flat intermediate state.
- Use slow multi-axis rotation with small shape-specific secondary motion.
- Scroll velocity may stretch highlights and slightly energize the form, but
  must not distort the silhouette enough to look unstable.
- Preserve pointer attraction, click pulse, and touch dragging.

## Rendering Changes

- Replace the generic shape SDFs with the semantic forms above while retaining
  one shared raymarch pipeline.
- Add shape-aware surface displacement and layered material response.
- Strengthen depth using a controlled key light, cool storm rim, warm late-page
  rim, contact/near-miss glow, and restrained filmic bloom.
- Keep the sculpture medium-sized in desktop and portrait choreography; tune
  per-section scale only enough to normalize different silhouettes.
- Retain the existing mobile performance tier and reduced-motion behavior.

## Verification

- Compile the production build and confirm shader compilation in WebGL2.
- Inspect hero, numbers, results, packages, education, and booking states in a
  real browser at desktop and mobile widths.
- Confirm the storm and lightning remain clearly visible around the sculpture.
- Confirm every section has a recognizable, relevant silhouette and morphs
  smoothly into the next.
- Verify pointer interaction, click pulse, scroll response, reduced motion, and
  touch positioning remain functional.

## Scope

Only the sculpture shader/choreography and directly related rendering controls
are in scope. Page copy, section layout, pricing data, admin functionality, and
the existing storm changes are not to be redesigned.
