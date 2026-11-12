---
name: making-data-art
description: Use when starting a new data-art piece, choosing a dataset or subject for a generative or data-driven visual, or when someone says they can't decide what to visualize. Also use when reworking a piece's look after feedback like "too static" or "not flowing enough".
---

# Making Data Art

## Overview

A piece works when the data already holds a motion or colour, and the person who chose it feels it. So the subject comes from them, the data is proven before anyone designs, and the look is picked from sketches they can see.

## The Loop

1. **Start from them, not the topic.** Ask for a feeling, place, question or memory they care about, in one open question. If they're stuck, offer a guess they can correct.
2. **Scout three subjects.** Read `subject-bank.md` first. For each candidate:
   - **Probe the source for real.** Fetch a byte range, a `HEAD`, or one row, and record the size, format, auth and licence. A source you haven't fetched this session is "unverified" and must be called that.
   - **Name its native channel:** the thing in the data that's already colour, motion, rhythm or spread (redshift is colour, currents are flow, years are a clock).
   - **Name its contrast:** what changes or differs that a viewer will feel.

   Bring back three, each with one plain sentence on what it would look like. Recommend one and say why.
3. **Once they've picked a subject, settle the two honesty forks** (see the Quick Reference). Phrase each one in that subject's own terms, explain the trade-off plainly, and let them choose.
4. **Sketch before building.** Make one throwaway preview page with 2–3 versions that look genuinely different, switchable, and using a small sample of the real data. They pick. "Too static" or "not flowing" means move the sketches toward motion trails, not tune the colours.
5. **Build to the repo pattern** (`build-notes.md`). Data is fetched once and bundled, the build runs offline, and pure mapping code is tested.
6. **Add what you learned to `subject-bank.md`:** new sources, their status, and any gotchas.

## Quick Reference

| Fork | Option A | Option B | Ask when |
|---|---|---|---|
| Colour truth | Each item keeps its own measured colour | Colour shows the journey or position (e.g. distance = time) | Items move across the canvas |
| Density truth | Real distribution (bands, gaps, tails) | Rebalanced for smooth beauty (About panel must say so) | Data is lumpy |

| Signal | Means |
|---|---|
| "Feels static", "more flowing", "fluent" | Particles need visible travel plus a fading trail buffer |
| Bright centre or orb "disturbing" | Let light dissolve into darkness; don't add a glow |
| Most points are the same colour | Normalise colour by a better-spread variable (rank, lookback time), keeping it monotonic |
| "The other piece is so much sicker" | Sketch the new subject on the engine they love; change what the light means, not how it moves |
| A print palette looks grey or dim as light | Dark ends vanish on black. Use a luminous ramp (heat: violet → red → amber → white) that brightens toward the extreme |

## Common Mistakes

- Recommending a source because it is "free" or "easy" without fetching it.
- Picking the subject for them, then asking only about style.
- Building straight from a description. People choose looks by seeing them.
- Silently swapping honest colour for pretty colour. That's their call, and it belongs in the About text.
