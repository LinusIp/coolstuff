/**
 * A tiny portal for the stage's HTML overlay and canvas hosts. Not
 * `preact/compat`'s createPortal: importing compat installs global option
 * hooks (it rewrites `onChange` to `onInput` on text inputs, among others)
 * that would silently change every other component on the page. This one
 * renders its children into `into` with a separate `render()` root and
 * re-provides the contexts the overlay needs (kit, stage, layer).
 */
import { render, type ComponentChildren } from 'preact';
import { useContext, useLayoutEffect, useRef } from 'preact/hooks';
import { KitContext } from '../core/context';
import { LayerContext, StageContext } from './context';

export function Portal({ into, children }: { into: Element | null; children: ComponentChildren }) {
  const kit = useContext(KitContext);
  const stage = useContext(StageContext);
  const layer = useContext(LayerContext);
  const box = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (!into) return;
    // Inside an <svg> the box is a <g> (Preact then renders SVG children).
    const el = into instanceof SVGElement ? document.createElementNS('http://www.w3.org/2000/svg', 'g') : document.createElement('div');
    el.setAttribute('class', 'stage2d__portal');
    into.appendChild(el);
    box.current = el;
    return () => {
      render(null, el);
      el.remove();
      box.current = null;
    };
  }, [into]);
  useLayoutEffect(() => {
    if (!box.current) return;
    render(
      <KitContext.Provider value={kit}>
        <StageContext.Provider value={stage}>
          <LayerContext.Provider value={layer}>{children}</LayerContext.Provider>
        </StageContext.Provider>
      </KitContext.Provider>,
      box.current,
    );
  });
  return null;
}
