# LittleNest Real UI Promo Posters

Generated from real local app screens at `http://127.0.0.1:5173` with fictional demo data.

## Output

- `output/littlenest-instagram-real-ui.png` (1080x1350)
- `output/littlenest-facebook-real-ui.png` (1200x1500)
- `output/littlenest-threads-real-ui.png` (1080x1920)
- `output/littlenest-app-store-real-ui.png` (1290x2796)
- `output/poster-proof-sheet.png`
- `output/captures/*.png` real app screenshots used inside the posters

## Regenerate

```powershell
node marketing/real-ui-promo-posters/generate-real-ui-posters.mjs
```

Set `LITTLENEST_BASE_URL` if the local app runs on a different port.
If Playwright is not installed in the project, run with `NODE_PATH` pointing to a node_modules folder that contains Playwright.
