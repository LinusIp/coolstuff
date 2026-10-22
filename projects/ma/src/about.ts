import about from '../content/about.md?raw';
import guide from '../USE-THIS-THEME.md?raw';
import { initChrome } from './chrome';
import { renderPlain } from './markdown';

initChrome();

// Both texts are markdown so the theme's owner edits prose, not HTML.
document.querySelector('#about')!.innerHTML = renderPlain(about);
document.querySelector('#guide')!.innerHTML = renderPlain(guide);

if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
