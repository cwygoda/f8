import { error } from '@sveltejs/kit';

import { getF8PageEntries, loadF8Page } from '$lib/sveltekit/index.js';

import type { EntryGenerator, PageServerLoad } from './$types.js';

export const entries: EntryGenerator = () => getF8PageEntries();

export const load: PageServerLoad = ({ params, url }) => {
  const page = loadF8Page({ slug: params.slug, origin: url.origin });

  if (page === undefined) {
    error(404, 'Page not found');
  }

  return { page };
};
