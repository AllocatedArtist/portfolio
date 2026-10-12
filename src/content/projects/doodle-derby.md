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

## Syncing the drawing canvas

### Problem
In the game, there are two artists drawing at the same time. I needed
a reliable way to show their drawing in real-time to the rest of the 
players in the game. For the initial prototype, I merely turned the 
raw canvas into a data url and sent that out to every viewer on a 
set delay (something small like *`100 ms`*). This is a
problem for 2 main reasons: performance drops for larger images,
and a visible refresh every time the client updates their canvas
using the data url they received from an artist. Most drawing games
like [skribbl.io](https://skribbl.io/) allow you to see the movement
of the artist's pencil as it happens. So, my new solution would need
to encode the artist's canvas (or actions) in a more compact format
because I wanted to send as much detail about the artist's movements as
possible. By compact, I mean the data is something I can afford
to send frequently.

### Solution

#### Send actions!
I decided to send artist actions as opposed to the artist output. This way,
the client can recreate the drawing on their end using the exact actions from
the artist. Actions would include drawing, undo/redo, fill, etc. For drawing 
specifically, it's split into `onStrokeBegin`, `onStrokeMove`, and `onStrokeEnd`.
The payload for these callbacks would be a list of the artist stroke points (essentially
their cursor positions over time, but mapped to a spline for a smoother continuous line),
and their active brush. This is all you need to start drawing a line on the receiver's canvas.
By sending the artist stroke points frequently (something we could afford to do), we could finally
see the artist draw in real-time. 

#### Out-of-order packets
The only problem at this point was accounting for the bane of every multiplayer game:
the network. I needed to account for those moments when packets are delayed, or an artist receives
data out of order. For example, every `onStrokeMove` should be preceded by an `onStrokeBegin` which
sets up information about where to start drawing, clears the redo buffer, and saves the previous frame's
image data (for undoing). So, it's important that `onStrokeMove` comes first before we start making changes
to the canvas, but the network won't guarantee that.

One defense I set up was storing pending actions in a list in order. I would just store state that verifies
whether or not `onStrokeBegin` was called, and if it wasn't (out of order `onStrokeMove`), then I'd store
that network payload in a list to execute later. If we get an `onStrokeBegin` within 5 seconds then we 
execute the "stroke queue" and continue with the next set of `onStrokeMove`'s like nothing happened.
If we don't get a following `onStrokeBegin`, then we cut our losses and clear the pending queue. We account
for this with periodic full snapshots.

#### Periodic full snapshots
The final defensive measure was doing what I did at the start. After a certain amount of time (much
longer than previously), depending on the round duration, I send the entire canvas and clear whatever's
on the viewer's screen (which might not have matched the artist's canvas if there was desync). It's not
noticeable if you stayed in sync the entire time, and gets you up to date if there were any network issues.
