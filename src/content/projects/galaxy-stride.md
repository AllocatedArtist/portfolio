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

A 3D platformer game written in `C++` from scratch. 
I prefer to write games from scratch as opposed to using game engines because 
I like working with internal systems usually kept hidden from the user. 
As an example, most game engine users take level editors for granted, 
but I experienced first-hand the difficulty of designing ergonomic controls, 
and the math behind properly transforming objects with a gizmo. 
Another interesting feature I worked on was asset packing, which I 
usually don't think about as much as other topics like graphics, or 
physics. I used a library to compress assets into a single file for 
cleaner distribution to end users, and a virtual file system to more 
cleanly express asset locations after decompression.
