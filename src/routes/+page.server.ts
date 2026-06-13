import { error } from '@sveltejs/kit';

import { loadF8Page } from '$lib/sveltekit/index.js';

import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = ({ url }) => {
  const page = loadF8Page({ slug: '', origin: url.origin });

  if (page === undefined) {
    error(404, 'Page not found');
  }

  return { page };
};
