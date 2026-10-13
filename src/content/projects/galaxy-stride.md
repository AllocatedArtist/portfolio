---
title: Galaxy Stride
date: 2024-01-25
blurb: A no frills no gills platformer. (Checkpoints not included)
cover: ../../assets/projects/example/cover.png
video: wZ-tX0Djhv8
links:
  source: https://github.com/AllocatedArtist/Galaxy_Stride
  game: https://allocatedartist.itch.io/galaxy-stride
tags:
  - c++
  - opengl
  - 3d
featured: true
order: 1
---

## About

A 3D platformer game written in `C++` from scratch. The game features 5 levels. For each level,
the objective is to reach the flag at the end to progress to the next level. As a bonus, players
can collect coins scattered throughout the map, but with higher risk as missing a jump restarts the level.

Players have a stamina bar they have to manage as they jump platform to platform. Stamina is consumed by
actions like sprinting, and slide jumping. Slide jumping is a combination of sprinting, crouching, and jumping
to gain extra distance that you normally wouldn't be able to reach with a simple sprint and jump.

I wrote the project using `raylib`, `bulletphysics/bullet3`, `nlohmann/json`, `physfs`, and `tinygltf`. 

## The Level Editor

<figure>
<video controls playsinline preload="metadata" width="100%">
  <source src="../../portfolio/videos/galaxy-stride-level-editor-demo.mp4"
   type="video/mp4"/>
   Your browser does not support video playback.
</video>
<figcaption>Designing/playtesting a level in Galaxy Stride</figcaption> 
</figure>

### Why make a level editor?
I needed a streamlined way to design levels for my platformer game. I didn't want to use another engine's
level editor with a custom export script, blender, or any other external tool because I figured
I would have a nicer time developing the game if the level editor worked in tandem with the game (i.e.
I could play the game directly from the level editor).

### Requirements
The core requirements of the level editor are as follows:
- Saving/Loading levels
- Viewing available assets (models)
- Placing assets around the scene
  - Click to spawn
  - Rotation (only around y-axis)
  - Translation
    - Snapping to X/Y/Z axes
    - Follow screen space mouse position (free-hand)
    - Dragging translation gizmos 
  - No scaling (never needed to scale an asset)

### Saving/Loading
For serialization, I formatted level content in `JSON` because it's easy to parse, understand, and
there's a pretty amazing library for it in C++. The format for a level is pretty simple: it's a list
of objects. An entity/object looks something like:
```json
{
  "mesh": 0,
  "position": [0, 0, 0],
  "rotation": [0, 0, 0, 1],
  "type": 0
}
```
where `mesh` is optional (the player entity doesn't have a mesh). Mesh is an index rather than a filepath
because I expected to load all assets in the same order everytime. In retrospect, I should've just done a filepath,
because if even one asset is out of order then we'd have problems. 

There are 4 types of entities in the game: player, static mesh, flag, and coin. The flag is special because it ends a level and triggers the start of the next one. The coin is a 
collectable object that increments your score. The player just needed to have a start position, and 
orientation in the level. And, finally, a static mesh is something you stand on, and can collide with.

Collisions for objects were generated using bullet physics. I just used a mesh's bounding box as the
collider for a physics object, and passed the transforms to bullet so the box was accurately fitted to the
object's actual transformation. Collision objects didn't need to be serialized because they are created
when parsing through the entities of the loaded level.

One last cool thing with regards to serialization was being able to drag and drop a file into the application
and see the level load automatically.

### Problems
While I was proud of the level editor, it wasn't exactly something you wanted to use outside of this
little game. For one, there was no undo/redo, object grouping, multiselect, etc. None of these were
necessary to making the game, though, so it's acceptable. That said, the features that *were* implemented
could've used some polish. As an example, dragging the translation gizmos was finnicky at best. I had 
never implemented such a feature before, so I did a direct raycast onto a thin line (meaning it was
easy to miss), dragging only remained active so long as the mouse stayed on the gizmo (really annoying),
and you could not pick the gizmo through an object. As a result of this pain, I skipped scaling entirely
(not too big of a deal since I didn't want to contort the source assets anyways), and I definitely skipped
free rotations which is why you can only rotate around the y-axis. I suppose instead of encoding a quaternion,
I could've just encoded a single float representing the angle around the y-axis.

One last thing that remains a funny little inside joke is how bad the controls are. I used 1 and 3 to rotate
an object, you had to Ctrl+Click a selected object to deselect instead of just clicking it again (I don't
remember why I made that decision), etc.

### Conclusion
Despite the lack of ergonomic controls, and undo/redo, I was very proud of my first 3D level editor.
Especially because I hadn't really attempted another 3D editor since then. This will change, though,
and I'm certain my next level editor can ONLY get better!

---
P.S. The creator of raylib, when I posted the project on [Reddit](https://www.reddit.com/r/raylib/s/4n6a0KcRap),
commented:
> "Probably the first platformer 3d game made with raylib released!"

which is forever a complement living rent-free in my head!
