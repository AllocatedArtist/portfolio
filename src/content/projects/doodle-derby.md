---
title: Doodle Derby
date: 2026-02-23
blurb: Multiplayer web-based drawing game.
cover: ../../assets/projects/doodle-derby/cover.png
links:
  source: https://github.com/alliemw/Doodle-Derby
  game: https://www.doodlederby.com/
tags:
  - typescript
  - solidjs
  - multiplayer
featured: true
order: 1
---

## Summary

A multiplayer drawing game where friends guess each others' drawings. 
Everyone creates their own word pool (prompts). 
Two artists are selected at the beginning of each round and a 
random word from their own respective word pools is selected and given 
to the other to draw as a prompt. The remaining players must guess the 
drawings of both players. Artists get more points if their drawing is 
guessed first, and guessers get more points the faster they can guess 
an artist's drawing. 

The project was written in `Typescript + Solid`, 
and utilized `Playroom-Kit` for the multiplayer. I focused on the drawing 
tools, as well as syncing multiplayer states. I also managed the 
overall codebase and led a rewrite to clean up previous code and 
ensure project progress.  
