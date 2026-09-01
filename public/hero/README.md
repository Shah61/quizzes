# The character

Drop a **transparent PNG** here named exactly:

    character.png

It becomes the figure standing in the middle of every screen — the menu, the
setup form, the arena, the Japanese duel, the clip studio. Nothing else has to
change; the slot picks it up on its own.

Until the file exists the slot stays empty and the screens read as clean glass.
There is no broken image and no gap.

## What works best

* **A cut-out, not a crop.** The background has to be transparent. A square
  face-crop pasted over the layout reads as a photograph stuck on top; a
  cut-out reads as a character standing in the scene.
* **Dark enough to read on white.** The ground behind it is a soft off-white
  with a colour bloom, not a dark photograph. A pale, low-contrast character
  will disappear into it — pick art with definite outlines or dark clothing,
  or add a subtle dark rim before exporting.
* **Standing on the bottom edge.** The slot is bottom-anchored, exactly the way
  every reference board stands its character on the floor of the layout. Crop
  the PNG so the figure's feet (or the bottom of the bust) sit on the very
  bottom edge of the image with no transparent padding under them.
* **Portrait, roughly 3:4 or taller.** Around 1200 x 1800 is plenty. The slot
  scales to `min(92vh, 1080px)` tall.
* **Room at the top.** Nothing important in the top ~15%: the top bar and the
  headline sit over that band.

A drop shadow is added for you — export without one.

## More than one figure

`HERO_SRC` in `src/game/art.ts` names the path. Point it at a different file,
or give each screen its own by passing a `hero` path through `<Screen>`.
