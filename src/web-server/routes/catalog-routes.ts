import { Router, Request, Response } from 'express';
import { getResolvedCatalogSnapshot } from '../../cliproxy/catalog-cache';

const router = Router();

/**
 * GET /api/cliproxy/catalog - Get merged model catalogs
 * Returns resolved catalogs with live -> cache -> static fallback ordering.
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await getResolvedCatalogSnapshot();
    res.json({
      catalogs: snapshot.catalogs,
      source: snapshot.source,
      cache: {
        synced: snapshot.source !== 'static' || snapshot.cacheAge !== null,
        age: snapshot.cacheAge,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
