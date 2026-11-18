import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  }
  next();
});

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/maps-config', (_req, res) => {
  const mapsApiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';
  res.json({ mapsApiKey });
});

app.post('/api/parking/nearby', async (req, res) => {
  const body = req.body as {
    latitude?: unknown;
    longitude?: unknown;
    query?: unknown;
  };

  const latitude = typeof body.latitude === 'number' ? body.latitude : NaN;
  const longitude = typeof body.longitude === 'number' ? body.longitude : NaN;
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({
      error: 'Valid latitude and longitude coordinates are required.',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Gemini API key is not configured. Check your API key in Settings > Secrets.',
    });
    return;
  }

  try {
    const prompt = query
      ? `Find available public parking garages, parking lots, or street parking near (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) matching "${query}". List the best nearby parking options clearly with names and practical details.`
      : `Find the closest public parking garages, parking lots, and parking areas near (${latitude.toFixed(5)}, ${longitude.toFixed(5)}). List the top nearby options clearly so a driver can pick one to park at.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude,
            },
          },
        },
      },
    });

    const summary = (response.text ?? '').trim();
    const rawChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    const places: Array<{
      title: string;
      uri: string;
      placeId?: string;
      reviewSnippets?: string[];
    }> = [];

    for (const chunk of rawChunks) {
      const mapsChunk = (
        chunk as {
          maps?: {
            title?: string;
            uri?: string;
            placeId?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ reviewText?: string }>;
            };
          };
        }
      ).maps;

      if (mapsChunk?.uri) {
        const snippets =
          mapsChunk.placeAnswerSources?.reviewSnippets
            ?.map((s) => s.reviewText)
            .filter((t): t is string => Boolean(t)) ?? [];

        places.push({
          title: mapsChunk.title || 'Nearby Parking Spot',
          uri: mapsChunk.uri,
          placeId: mapsChunk.placeId,
          reviewSnippets: snippets.length > 0 ? snippets : undefined,
        });
      }
    }

    res.json({
      summary,
      places,
    });
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : 'Failed to look up nearby parking.';
    const isQuota =
      rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED');
    res.status(isQuota ? 429 : 500).json({
      error: isQuota
        ? 'AI parking search quota reached. You can still pick any nearby green P pin on the map.'
        : rawMessage,
      quotaExceeded: isQuota,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // Prevent Vite 8's default /@vite/client from opening a wss://...:24678 WebSocket
    // when HMR is disabled behind Cloud Run's HTTPS reverse proxy.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const data = {};
  return {
    data,
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
