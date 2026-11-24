## What changed

<!-- Plain language: what the owner will see or be able to do now. -->

Closes #

## How to try it

1. `python3 server.py --port 8090 --data .data-dev`
2. *More* > *New sample plan*
3. <!-- steps -->

## Screenshots

<!-- Required for anything visual. Light mode at least; dark mode if colors changed. -->

## Checklist

- [ ] `python3 -m unittest discover -s tests` passes
- [ ] `cd tests/ui && npm test` passes (and covers the new behavior)
- [ ] Checked Map, Grid and Gantt, light and dark, and a narrow window
- [ ] No new runtime dependencies, CDN links or outside network calls
- [ ] Old plans still load (any new field is optional and defaulted in `norm()`)
- [ ] Nothing in `data/` was touched or committed
- [ ] Docs updated if behavior or structure changed (AGENTS.md, docs/)
