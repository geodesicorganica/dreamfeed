'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  isMarkdownPath,
  isSafeMarkdownHref,
  renderMarkdown,
} = require('../public/app');

test('markdown renderer: renders governance-document blocks and inline formatting', () => {
  const html = renderMarkdown(`---
title: Markdown Preview
---
# Heading

Paragraph with **bold**, *italic*, \`inline code\`, and [safe link](https://example.com/a?b=1).

- first
- second

1. ordered
2. list

> quoted evidence

| column a | column b |
| --- | --- |
| one | two |

\`\`\`js
const tag = "<script>alert(1)</script>";
\`\`\`
`);

  assert.match(html, /<pre class="markdown-frontmatter"><code>---\ntitle: Markdown Preview\n---<\/code><\/pre>/);
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>inline code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1" rel="noopener noreferrer">safe link<\/a>/);
  assert.match(html, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
  assert.match(html, /<ol><li>ordered<\/li><li>list<\/li><\/ol>/);
  assert.match(html, /<blockquote>quoted evidence<\/blockquote>/);
  assert.match(html, /<table><thead><tr><th>column a<\/th><th>column b<\/th><\/tr><\/thead><tbody><tr><td>one<\/td><td>two<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<pre><code class="language-js">const tag = &quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;;<\/code><\/pre>/);
});

test('markdown renderer: raw HTML and event attributes stay escaped text', () => {
  const html = renderMarkdown(`<script>alert(1)</script>
<iframe src="https://example.com"></iframe>
<img src=x onerror=alert(1)>`);

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;iframe src=&quot;https:\/\/example\.com&quot;&gt;&lt;\/iframe&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('markdown renderer: links allow safe hrefs and reject executable schemes', () => {
  const html = renderMarkdown('[relative](docs/file.md) [anchor](#section) [mail](mailto:ops@example.com) [bad](javascript:alert(1)) [file](file:///C:/secret.md)');

  assert.equal(isMarkdownPath('agents/founder/outputs/weekly_priorities.md'), true);
  assert.equal(isMarkdownPath('tools/command-center/public/app.js'), false);
  assert.equal(isSafeMarkdownHref('https://example.com'), true);
  assert.equal(isSafeMarkdownHref('mailto:ops@example.com'), true);
  assert.equal(isSafeMarkdownHref('docs/file.md'), true);
  assert.equal(isSafeMarkdownHref('javascript:alert(1)'), false);
  assert.equal(isSafeMarkdownHref('file:///C:/secret.md'), false);

  assert.match(html, /<a href="docs\/file\.md" rel="noopener noreferrer">relative<\/a>/);
  assert.match(html, /<a href="#section" rel="noopener noreferrer">anchor<\/a>/);
  assert.match(html, /<a href="mailto:ops@example\.com" rel="noopener noreferrer">mail<\/a>/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /href="file:/i);
});
