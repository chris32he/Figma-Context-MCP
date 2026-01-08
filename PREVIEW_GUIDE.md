# 🎨 Figma Preview Tool - Usage Guide

## What This Tool Does

The Figma Preview Tool creates a **local, fast, repeatable preview environment** that lets you:

1. ✅ Pull raw Figma data via your personal API key
2. ✅ Convert it into the project's simplified intermediary schema
3. ✅ Inspect and validate the output visually in a browser-based preview UI
4. ✅ Verify image assets are downloading correctly
5. ✅ Iterate on transformer quality by modifying the simplification logic

## Quick Start

### 1. Set Your Figma API Key

Add your Figma Personal Access Token to `.env`:

```bash
FIGMA_API_KEY=your_figma_api_key_here
```

Or export it:

```bash
export FIGMA_API_KEY=your_figma_api_key_here
```

### 2. Run the Preview Tool

**Option A: Using Figma URL** (Easiest)
```bash
pnpm preview --url="https://www.figma.com/file/ABC123/MyDesign?node-id=1-2"
```

**Option B: Using File Key + Node ID**
```bash
pnpm preview --file-key=ABC123 --node-id=1:2
```

**Option C: Preview Entire File**
```bash
pnpm preview --file-key=ABC123
```

### 3. View the Preview

The tool will:
- ✅ Fetch Figma data via API
- ✅ Transform to intermediary schema
- ✅ Download images/SVGs
- ✅ Start preview server on `http://localhost:3334`
- ✅ Automatically open your browser

## Preview UI Features

### Side-by-Side Comparison
- **Left Panel**: Original Figma design (embedded iframe)
- **Right Panel**: Your rendered output from intermediary schema
- **Right Panel - Inspector**: Click any node to see its simplified JSON

### What You Can Inspect
- Layout properties (flexbox, sizing, positioning)
- Visual styles (fills, strokes, borders, opacity)
- Text styles (fonts, sizes, line-height)
- Effects (shadows, blurs)
- Component metadata
- Image assets

### Stats Bar
Shows:
- Total node count
- Deduplicated style count
- Component count

## Advanced Options

### Custom Port
```bash
pnpm preview --url="..." --port=8080
```

### Skip Image Downloads
```bash
pnpm preview --url="..." --skip-images
```

### Don't Auto-Open Browser
```bash
pnpm preview --url="..." --no-open
```

## Output Files

The tool creates:
- `logs/figma-simplified.json` - Full intermediary schema (for debugging)
- `preview/assets/` - Downloaded images and SVGs

## Iteration Workflow

1. **Run preview** to see current output
2. **Identify issues** (e.g., gradient not rendering, layout incorrect)
3. **Modify transformer** (e.g., `src/transformers/style.ts`)
4. **Rebuild**: `pnpm build`
5. **Re-run preview** to see improvements
6. **Repeat** until fidelity is perfect

## Troubleshooting

### "FIGMA_API_KEY is required"
- Make sure your `.env` file exists with `FIGMA_API_KEY=...`
- Or export it: `export FIGMA_API_KEY=your_key`

### "Port 3334 is already in use"
- Use a different port: `pnpm preview --url="..." --port=3335`

### "Failed to load design"
- Check that your file key is correct
- Verify your API key has access to the file
- Check browser console for errors

### Images not showing
- Make sure `--skip-images` is NOT set
- Check `preview/assets/` directory for downloaded files
- Some image fills may require proper imageRef handling

## Getting Figma Credentials

### Personal Access Token (API Key)
1. Go to https://www.figma.com/settings
2. Scroll to "Personal access tokens"
3. Click "Generate new token"
4. Copy and save it (you won't see it again!)
5. Add to `.env` as `FIGMA_API_KEY=...`

### Finding File Key and Node ID

From a Figma URL like:
```
https://www.figma.com/file/ABC123XYZ/MyDesign?node-id=123-456
```

- **File Key**: `ABC123XYZ`
- **Node ID**: `123:456` (replace `-` with `:`)

## Next Steps

Once you've validated the intermediary schema output:
- Use it to generate HTML/CSS/Tailwind
- Feed it into your AI animator
- Upload assets to cloud storage
- Generate animation logic

The preview tool gives you confidence that the data pipeline is working correctly before you ship to production!
