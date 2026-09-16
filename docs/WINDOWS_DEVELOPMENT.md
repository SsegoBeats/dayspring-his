# Windows development notes

If you're developing on Windows and see errors like:

```
failed to create junction point to ../../../node_modules/pg
os error 80
```

This is caused by pnpm creating junctions/symlinks in `node_modules`. Recommended remedies:

- Preferred: Add `node-linker=hoisted` to `.npmrc` (already added) and run:

```powershell
pnpm install
pnpm dev
```

- Alternative (quick): run `pnpm install --shamefully-hoist` then `pnpm dev`.
- Run your terminal as Administrator or enable Windows Developer Mode (Settings → For developers).
- Use WSL2 (Windows Subsystem for Linux) and run the dev server inside WSL to avoid Windows junction behavior.

Notes
- The `.npmrc` added at project root instructs pnpm to create a hoisted `node_modules` layout, avoiding many junctions.
- If you prefer not to change the linker globally, you can set an environment-specific workaround per-machine.

If you want, I can commit these changes and open a PR with an accompanying CI note. 
