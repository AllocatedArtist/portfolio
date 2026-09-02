---
title: Painting App
date: 2024-03-09
blurb: Painting app with built-in music player.
cover: ../../assets/projects/example/cover.png
video: kAXOEn1XAn8
links:
  source: https://github.com/Fotohh/GUIProject
  release: https://github.com/Fotohh/GUIProject/releases/tag/windows
tags:
  - odin
  - painting
  - multithreaded
featured: false
order: 1
---

## About

My AP Computer Science Principles submission made with a classmate. 
One of my favorite features of the project was supporting undo/redo 
commands, as these are essential actions for any digital software program. I 
implemented a basic design pattern, the Command Pattern, to support 
this feature. It was also necessary to encode commands with as 
little data as possible, as they would have to be stored with every 
action, and eventually replayed (or reversed). Another interesting feature 
was the Bresenham Line drawing algorithm to connect user mouse strokes to prevent 
gaps between pixels. This usually occured if the user moved their 
mouse rapidly. 
