---
title: Quiz Game
date: 2025-09-22
blurb: Kahoot Clone
cover: ../../assets/projects/quiz-game/cover.png
links:
  source: https://github.com/kaiyoig/quiz-game-app
  game: https://quiz-game-app-host.vercel.app/
tags:
  - javascript
  - multiplayer
  - react
featured: false
order: 1
---

## About

A multiplayer quiz game written in `JS + React + Next`.
I had little experience with Javascript compared to my main language, 
`C++`, but I picked it up fairly quickly to work on the game. 
Along the way, I learned how to develop a React app with `Tailwind CSS`. 
Multiplayer functionality was provided by `PlayroomKit`, a wrapper 
around `WebSocket`. One particular challenge my partner and I encountered 
was syncing state across multiple devices. We addressed this by ensuring 
state was only updated on the host's device, as this was what 
PlayroomKit expected.
