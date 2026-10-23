/**
 * Render a `Rich` string (types.ts): prose with $TeX$, **bold**, *italic*,
 * `code`, [links](…), [concept terms]{concept} and [[glossary terms]].
 *
 *   <RichText text={problem.prompt} class="lead" />          block (paragraphs, lists, display maths)
 *   <RichText text={option.text} inline />                   inline (a <span>, no paragraphs)
 */
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { useMacros } from './context';
import { richToHtml } from './richtext';
import type { Rich } from '../types';

export interface RichTextProps {
  text: Rich;
  /** Inline content in a <span>: no paragraphs, lists or display blocks. */
  inline?: boolean;
  /** Wrapper element. Default 'div' (block) / 'span' (inline). Use 'p' only with `inline`. */
  as?: 'div' | 'span' | 'p' | 'li' | 'dd' | 'figcaption' | 'legend' | 'label';
  class?: string;
  id?: string;
  macros?: Readonly<Record<string, string>>;
}

export function RichText({ text, inline = false, as, class: cls, id, macros }: RichTextProps) {
  const m = useMacros(macros);
  const html = useMemo(() => richToHtml(text, { macros: m, inline }), [text, m, inline]);
  const className = ['rich', cls].filter(Boolean).join(' ');
  return h(as ?? (inline ? 'span' : 'div'), { id, class: className, dangerouslySetInnerHTML: { __html: html } });
}
