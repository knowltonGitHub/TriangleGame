World vs container
Q:  When the inverted-T rotates around the fixed center, does the light-blue triangle field rotate with it, or does only the black outline (and pieces) move while the grid stays “screen upright”?

A:  The field rotates with it.  But the container only rotates in 60 degree  increments.  I am undecided on whether or now you can go all the way around.  I'm leaning toward YES .... and it is too much chaos....we can limit to 90 degrees CW before a hard stop ...  then you must rotate back to VERTICAL before rotating CCW the other direction and stopping vertically.  BOTH options might be fun to explore..we should be prepared for the rotation to go the full 360 degrees.  As long as we adhere to consistent rules and tie breakers ... it should work.  I think the only thing I might prevent is having triangles fall OUT OF the top.

Q:  Is gravity always toward the bottom of the screen (device tilt), or does “down” spin with the container as if the cup is turning in a fixed world?

A:  There is a "slight" magnetic attraction to surfaces and other triangles...so they "slide" along survaces in "segment" increments.

For example...if 2 pieces have fallen into the container and you rotate the container CW 60 degrees... the second piece to fall will be closest to the bottom right corner and will slide twice then rotate CW once.  The first piece will follow behind it by sliding twice then "rest" against the "left" side of the triangle that just rotated.


What a “piece” is
Q:  Is each falling object exactly one grid triangle, or can you have multi-triangle polyomino-style shapes (like your numbered stack)?

One triangle falls at a time (intersting idea though)

Q:  If a piece has ** markings / numbers / asymmetric art**, does “rotate right” need to be visible (60°/120° steps), or is it mostly logic state (even if the filled triangle looks symmetric)?  

A:  If one edge has markings of some sort, that information must "rotate" along with that edge as if it were "painted" on.


Movement grammar (one step)
Q:  Between ticks, can a triangle only slide across a full shared edge to a neighbor cell, or can it hop through vertex-only contacts?

Hop through?  I need this asked with more detail.

Q:  Should diagonal-in-grid motion ever happen in one tick, or only as a sequence of edge moves?

Container cannot rotate while a triangle is falling.  Once a fallen triangle has "settled" (stopped moving) the the entire container can rotate CW or CCW and triangles all move one TICK at a time...the leading triangle moves first, then the next, then the next, then the next.


Splits and your rule (“on a split … rotates right”)
Q:  Define split the way you feel it: is it (A) two or more equally “downhill” moves, (B) a literal fork in the chute shape, or (C) something else (describe in one sentence)?

A:  default to slide or rotate right when there is a TIE ... keeps sliding or rotating as it makes sense.  60 degree container rotate is enough to get pieces sliding, but not always enough to make them rotate.  It depends on what they are next to.

Q:  On a split, should rotation happen instead of a slide that tick, before choosing the slide, or after trying slides?

Slides are the usual motion.  Rotation happens when a piece can no longer slide and there is enough tilt to justify a rotation.  Usually a piece will not rotate THEN slide again.

Q:  “Rotates right”: do you mean clockwise, cycle among the downhill options, flip △↔▽, or something visible you’d point to in one of your mockups?

Order and fairness (many triangles)
Q:  If several triangles can move on the same frame, is the order fixed (e.g. lowest potential first, then piece id), or simultaneous (can cause conflicts unless disallowed)?

A:  I would think that if a triangle is "stacked" on top of another triangle .... if moves WITH what is moving under it ... then "slides" off if the triangles underneath it stop moving and there is still a TILT.

Q:   When two pieces contend for the same cell, who wins — higher “pressure” (more downhill), older piece, lower id, or no move that frame?

A:  It moves to the first legitimate cell along that vector that can be lit.  They stay where they are if they tie.


Resting / support
Q:   At rest, is edge-to-edge contact with wall or neighbor required, or is vertex-only support allowed (corners “balancing”)?

Corners can rest against each other.  Let me know if you want me to show this happening.

Q:  Can triangles slide sideways along a floor when tilt changes slightly, or must they only move when there’s strictly lower potential (true “downhill”) with no cruising?  

A:  Degree of tilt must be 60 degrees before movement.  TILT happens in 60 degree increments.


Tilt continuity
Q:  Is tilt discrete (snap to 30°, 45°, 60°, etc.) or continuous? If continuous, do you re-settle on every small change, or only when the player releases the control?

A:  TILT is set first, THEN the slide / rotate happens

Rotation-of-container special case
Q:  While the container angle is changing (animating), are pieces frozen, or do they continuously recompute target cells (could look like pouring sand)?

A:  That would be nice to have.  For first vesion of the game.  TILT completes and only then do you see the triangles slide or rotate.



I realize these are not complete answers.   I cannot speak to EVERY situation.  But I would like to have a FEW RULES as possilble to cover 99% of the cases, with perhaps a few special conditions.   Each puzzle needs to be solvable.



Will it be possible for the AI to run tests?  To try and solve each puzzle via simlation?