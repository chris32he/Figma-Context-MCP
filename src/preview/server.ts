import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import type { SimplifiedDesign } from '../extractors/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PreviewServerOptions {
  port?: number;
  designData: SimplifiedDesign;
  figmaUrl?: string;
  assetsDir?: string;
}

export class PreviewServer {
  private app: express.Application;
  private port: number;
  private designData: SimplifiedDesign;
  private figmaUrl?: string;
  private assetsDir?: string;
  private server: any;

  constructor(options: PreviewServerOptions) {
    this.app = express();
    this.port = options.port || 3334;
    this.designData = options.designData;
    this.figmaUrl = options.figmaUrl;
    this.assetsDir = options.assetsDir;

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static files from preview directory
    const previewDir = path.join(__dirname, '../../preview');
    this.app.use(express.static(previewDir));

    // Serve assets directory if provided
    if (this.assetsDir) {
      this.app.use('/assets', express.static(this.assetsDir));
    }

    // API endpoint to get design data
    this.app.get('/api/design', (req, res) => {
      res.json({
        design: this.designData,
        figmaUrl: this.figmaUrl,
      });
    });

    // Serve the renderer module
    this.app.get('/api/renderer.js', async (req, res) => {
      try {
        // Read the compiled renderer
        const rendererPath = path.join(__dirname, 'renderer.js');
        let rendererCode = await fs.readFile(rendererPath, 'utf-8');

        // Make it ES module compatible for browser
        res.setHeader('Content-Type', 'application/javascript');
        res.send(rendererCode);
      } catch (error) {
        console.error('Failed to load renderer:', error);
        res.status(500).json({ error: 'Failed to load renderer module' });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', design: this.designData.name });
    });

    // Serve the main HTML
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(previewDir, 'index.html'));
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`\n🎨 Figma Preview Server running at: http://localhost:${this.port}`);
          console.log(`📊 Design: ${this.designData.name}`);
          console.log(`📦 Nodes: ${this.countNodes(this.designData.nodes)}`);
          if (this.figmaUrl) {
            console.log(`🔗 Figma URL: ${this.figmaUrl}\n`);
          }
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`\n❌ Port ${this.port} is already in use. Please try a different port.\n`);
          } else {
            console.error('\n❌ Server error:', error.message, '\n');
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('\n✅ Preview server stopped\n');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private countNodes(nodes: any[]): number {
    let count = nodes.length;
    nodes.forEach(node => {
      if (node.children) {
        count += this.countNodes(node.children);
      }
    });
    return count;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

/**
 * Create and start a preview server
 */
export async function startPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const server = new PreviewServer(options);
  await server.start();
  return server;
}
