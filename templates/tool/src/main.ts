import { safeStorage } from '../../../src/shared/capabilities';

const KEY = 'coolstuff:{{slug}}:state';
const input = document.querySelector<HTMLTextAreaElement>('#input')!;
const output = document.querySelector<HTMLOutputElement>('#output')!;

function render(): void {
  output.textContent = `${input.value.length} characters`;
  safeStorage.set(KEY, JSON.stringify({ text: input.value }));
}

function exportState(): void {
  const blob = new Blob([JSON.stringify({ text: input.value }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: '{{slug}}.json' });
  a.click();
  URL.revokeObjectURL(a.href);
}

input.value = (JSON.parse(safeStorage.get(KEY) ?? '{}') as { text?: string }).text ?? '';
input.addEventListener('input', render);
document.querySelector('#export')!.addEventListener('click', exportState);
document.querySelector<HTMLInputElement>('#import')!.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  input.value = (JSON.parse(await file.text()) as { text?: string }).text ?? '';
  render();
});
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    exportState();
  }
});
render();
