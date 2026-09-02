---
title: Raycasting Engine
date: 2024-07-19
blurb: Old-school renderer with simple level-editor.
cover: ../../assets/projects/example/cover.png
video: TgDCYEJ___U
links:
  source: https://github.com/AllocatedArtist/Simple-Raycaster
tags:
  - c++
  - wasm
  - raycaster
featured: false
order: 1
---

## About

A raycasting engine written in `C++` with support for the web 
through `WebAssembly`. I had a lot of fun learning about the 
math that paved the way for more complex 3D graphics. The more 
complicated part of the raycasting algorithm wasn't so much 
calculating ray intersections, but projecting image data onto walls. 
Everything displayed to the user is a pixel buffer being 
repopulated every frame after the necessary projection calculations have been 
made.
