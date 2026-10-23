/**
 * Entry for the dev pages: kit/_dev/<group>.html is just
 *   <div id="app" data-group="text"></div>
 *   <script type="module" src="../../src/kit/gallery/dev.tsx"></script>
 * (data-group="all" renders every group, like /kit will.)
 */
import { mountGallery } from './host';
import type { GalleryGroup, GalleryGroupId } from './types';

const LOADERS: Record<GalleryGroupId, () => Promise<{ gallery: GalleryGroup }>> = {
  core: () => import('./core'),
  text: () => import('./text'),
  visual: () => import('./visual'),
  practice: () => import('./practice'),
  controls: () => import('./controls'),
  structures: () => import('./structures'),
};

const app = document.getElementById('app');
const want = app?.dataset.group ?? 'all';
const ids = want === 'all' ? (Object.keys(LOADERS) as GalleryGroupId[]) : want.split(',').filter((g): g is GalleryGroupId => g in LOADERS);
const groups = await Promise.all(ids.map((id) => LOADERS[id]().then((m) => m.gallery)));
mountGallery(groups);
