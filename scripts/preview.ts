#!/usr/bin/env node

/**
 * Figma Preview CLI
 *
 * Fetches Figma design data and launches a local preview server
 * to visualize the intermediary schema output.
 *
 * Usage:
 *   tsx scripts/preview.ts --file-key=ABC123 [--node-id=1:2] [--port=3334]
 *   tsx scripts/preview.ts --url="https://www.figma.com/file/ABC123/Name?node-id=1-2"
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { FigmaService } from '../src/services/figma.js';
import { simplifyRawFigmaObject } from '../src/extractors/design-extractor.js';
import { extractFromDesign } from '../src/extractors/node-walker.js';
import { collapseSvgContainers } from '../src/extractors/built-in.js';
import { startPreviewServer } from '../src/preview/server.js';
import type { SimplifiedDesign } from '../src/extractors/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

interface PreviewArgs {
  fileKey?: string;
  nodeId?: string;
  url?: string;
  port?: number;
  skipImages?: boolean;
  open?: boolean;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('file-key', {
      alias: 'f',
      type: 'string',
      description: 'Figma file key',
    })
    .option('node-id', {
      alias: 'n',
      type: 'string',
      description: 'Specific node ID to preview (optional)',
    })
    .option('url', {
      alias: 'u',
      type: 'string',
      description: 'Full Figma URL (alternative to file-key)',
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      default: 3334,
      description: 'Port for preview server',
    })
    .option('skip-images', {
      type: 'boolean',
      default: false,
      description: 'Skip downloading images',
    })
    .option('open', {
      alias: 'o',
      type: 'boolean',
      default: true,
      description: 'Automatically open browser',
    })
    .example('$0 --file-key=ABC123', 'Preview entire file')
    .example('$0 --file-key=ABC123 --node-id=1:2', 'Preview specific node')
    .example('$0 --url="https://www.figma.com/file/ABC/Name?node-id=1-2"', 'Preview from URL')
    .help()
    .argv as PreviewArgs;

  try {
    // Parse file key and node ID from URL if provided
    let fileKey = argv.fileKey;
    let nodeId = argv.nodeId;
    let figmaUrl = argv.url;

    if (argv.url) {
      const parsed = parseFigmaUrl(argv.url);
      fileKey = parsed.fileKey;
      nodeId = parsed.nodeId || nodeId;
      figmaUrl = argv.url;
    }

    if (!fileKey) {
      console.error('\n❌ Error: --file-key or --url is required\n');
      process.exit(1);
    }

    // Check for API credentials
    const apiKey = process.env.FIGMA_API_KEY;
    const oauthToken = process.env.FIGMA_OAUTH_TOKEN;

    if (!apiKey && !oauthToken) {
      console.error('\n❌ Error: FIGMA_API_KEY or FIGMA_OAUTH_TOKEN environment variable is required\n');
      console.error('Set it in your .env file or export it:\n');
      console.error('  export FIGMA_API_KEY=your_key_here\n');
      process.exit(1);
    }

    console.log('\n🎨 Figma Preview Tool\n');
    console.log(`📄 File Key: ${fileKey}`);
    if (nodeId) {
      console.log(`🎯 Node ID: ${nodeId}`);
    }
    console.log('');

    // Initialize Figma service
    const figmaService = new FigmaService({
      figmaApiKey: apiKey || '',
      figmaOAuthToken: oauthToken || '',
      useOAuth: !!oauthToken,
    });

    // Fetch raw Figma data
    console.log('📥 Fetching Figma data...');
    const rawData = nodeId
      ? await figmaService.getRawNode(fileKey, nodeId)
      : await figmaService.getRawFile(fileKey);

    // Simplify the design
    console.log('🔄 Simplifying design data...');
    const simplifiedData = simplifyRawFigmaObject(rawData);

    // Extract data using node walker
    console.log('🏗️  Extracting layout, styles, and components...');
    const extractedDesign = extractFromDesign(simplifiedData);

    // Collapse SVG containers
    console.log('🖼️  Optimizing SVG containers...');
    const finalDesign = collapseSvgContainers(extractedDesign) as SimplifiedDesign;

    // Save to logs directory for debugging
    const logsDir = path.join(__dirname, '../logs');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(
      path.join(logsDir, 'figma-simplified.json'),
      JSON.stringify(finalDesign, null, 2)
    );
    console.log('💾 Saved to logs/figma-simplified.json');

    // Download images if not skipped
    let assetsDir: string | undefined;
    if (!argv.skipImages) {
      console.log('🖼️  Downloading images...');
      assetsDir = path.join(__dirname, '../preview/assets');
      await fs.mkdir(assetsDir, { recursive: true });

      try {
        await downloadImages(figmaService, fileKey, finalDesign, assetsDir);
        console.log(`✅ Images downloaded to preview/assets/`);
      } catch (error) {
        console.warn('⚠️  Some images failed to download:', (error as Error).message);
      }
    }

    // Construct Figma URL if not provided
    if (!figmaUrl) {
      figmaUrl = `https://www.figma.com/file/${fileKey}/${encodeURIComponent(finalDesign.name)}`;
      if (nodeId) {
        figmaUrl += `?node-id=${nodeId.replace(':', '-')}`;
      }
    }

    // Start preview server
    console.log(`\n🚀 Starting preview server on port ${argv.port}...\n`);
    const server = await startPreviewServer({
      port: argv.port,
      designData: finalDesign,
      figmaUrl,
      assetsDir,
    });

    // Open browser
    if (argv.open) {
      console.log('🌐 Opening browser...\n');
      await open(server.getUrl());
    }

    // Keep server running
    console.log('Press Ctrl+C to stop the server\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

/**
 * Parse Figma URL to extract file key and node ID
 */
function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');

    // URL format: /file/{fileKey}/{name}
    // or: /design/{fileKey}/{name}
    const fileKeyIndex = pathParts.indexOf('file') + 1 || pathParts.indexOf('design') + 1;
    const fileKey = pathParts[fileKeyIndex];

    // Extract node-id from query params
    const nodeIdParam = parsed.searchParams.get('node-id');
    const nodeId = nodeIdParam?.replace('-', ':'); // Convert 1-2 to 1:2

    return { fileKey, nodeId };
  } catch (error) {
    throw new Error(`Invalid Figma URL: ${url}`);
  }
}

/**
 * Download images for the design
 */
async function downloadImages(
  figmaService: FigmaService,
  fileKey: string,
  design: SimplifiedDesign,
  assetsDir: string
): Promise<void> {
  const imagesToDownload: Array<{
    nodeId: string;
    fileName: string;
    imageRef?: string;
  }> = [];

  // Collect all nodes that need images
  function collectImageNodes(nodes: any[]) {
    for (const node of nodes) {
      // SVG exports
      if (node.type === 'IMAGE-SVG') {
        imagesToDownload.push({
          nodeId: node.id,
          fileName: `${sanitizeFileName(node.name)}.svg`,
        });
      }

      // Image fills
      if (node.fills) {
        const fills = design.globalVars.styles[node.fills];
        if (fills && typeof fills === 'object' && 'url' in fills) {
          imagesToDownload.push({
            nodeId: node.id,
            fileName: `${sanitizeFileName(node.name)}.png`,
            imageRef: (fills as any).imageRef,
          });
        }
      }

      if (node.children) {
        collectImageNodes(node.children);
      }
    }
  }

  collectImageNodes(design.nodes);

  if (imagesToDownload.length === 0) {
    console.log('  No images to download');
    return;
  }

  console.log(`  Found ${imagesToDownload.length} images to download`);

  // Download images in batches
  const batchSize = 10;
  for (let i = 0; i < imagesToDownload.length; i += batchSize) {
    const batch = imagesToDownload.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const filePath = path.join(assetsDir, item.fileName);

          // Get image URL
          let imageUrl: string;
          if (item.imageRef) {
            // Image fill
            const urls = await figmaService.getImageFillUrls(fileKey, [item.imageRef]);
            imageUrl = urls[item.imageRef];
          } else {
            // SVG render
            const urls = await figmaService.getNodeRenderUrls(fileKey, [item.nodeId], {
              format: 'svg',
            });
            imageUrl = urls[item.nodeId];
          }

          if (!imageUrl) {
            console.warn(`  ⚠️  No URL for ${item.fileName}`);
            return;
          }

          // Download
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const buffer = await response.arrayBuffer();
          await fs.writeFile(filePath, Buffer.from(buffer));

        } catch (error) {
          console.warn(`  ⚠️  Failed to download ${item.fileName}:`, (error as Error).message);
        }
      })
    );
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

main();
