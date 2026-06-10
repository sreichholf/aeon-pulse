# ADR 0019 — Standard Enemy Model Preparation

**Status:** Accepted
**Date:** 2026-06-10

Standard enemy GLB assets are treated as immutable source presentation assets, not as per-entity mutable scene graphs. As standard enemies move toward GLB-based presentation, their models should be prepared into runtime render buckets that preserve gameplay readability while reducing draw impact; authored GLB material names may be collapsed when the resulting body, glass, and glow buckets preserve the intended look.

Hit flash is not applied by mutating Standard Enemy Model materials. Damage feedback is a layered runtime presentation effect, such as an overlay shell, so multiple active enemies can share prepared model geometry and materials without cross-instance material contamination.

The first preparation path targets static mesh models. Transparent surfaces remain separate from opaque body buckets, emissive lights and thrusters may collapse into a shared glow bucket, and full runtime atlas generation is not required for the first pass if a smaller number of body buckets preserves important texture detail.
