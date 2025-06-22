# Markdown Cheatsheet for Remark.js

This cheatsheet provides a quick reference for markdown syntax as processed by **Remark.js**, the markdown processor used in this application. Remark.js is a powerful tool for parsing and transforming markdown content, supporting standard markdown syntax and extensions through plugins like GitHub Flavored Markdown (GFM).

Whether you're writing content or formatting text within this app, use this guide to understand the supported markdown syntax and see examples of how it renders.

## Basic Markdown Syntax

These are the core markdown elements supported by Remark.js for formatting text and structuring content.

### Headings
Headings are created using `#` symbols. The number of `#` symbols corresponds to the heading level.

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

### Paragraphs
Paragraphs are simply plain text separated by an empty line.

```markdown
This is a paragraph. It can span multiple lines as long as there are no empty lines within it.

This is another paragraph, separated by an empty line.
```

### Text Formatting
You can emphasize text using asterisks `*` or underscores `_`.

```markdown
*Italic text* or _Italic text_
**Bold text** or __Bold text__
***Bold and italic*** or ___Bold and italic___
```

### Lists
Lists can be unordered (bullets) or ordered (numbers).

#### Unordered List
Use `-`, `*`, or `+` for unordered lists.

```markdown
- Item 1
- Item 2
  - Nested Item 2.1
  - Nested Item 2.2
- Item 3
```

#### Ordered List
Use numbers followed by a period for ordered lists.

```markdown
1. First item
2. Second item
   1. Nested item 2.1
   2. Nested item 2.2
3. Third item
```

### Links
Create hyperlinks using `[text](URL)`.

```markdown
[Visit Remark.js](https://remark.js.org/)
```

### Images
Embed images using `![alt text](image URL)`.

```markdown
![Remark.js Logo](https://remark.js.org/img/logo.svg)
```

### Code
Inline code is wrapped in single backticks, while code blocks use triple backticks.

#### Inline Code
```markdown
Use `console.log()` for debugging.
```

#### Code Block
```markdown
\`\`\`javascript
function example() {
  console.log("Hello, Remark.js!");
}
\`\`\`
```

## Extended Syntax with GitHub Flavored Markdown (GFM)

Remark.js often uses the `remark-gfm` plugin to support GitHub Flavored Markdown, which extends standard markdown with additional features.

### Tables
Create tables using pipes `|` to separate columns and hyphens `-` for headers.

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |
| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |
```

### Strikethrough
Strike through text using double tildes `~~`.

```markdown
~~This text is struck through.~~
```

### Task Lists
Create task lists with checkboxes using `- [ ]` for unchecked and `- [x]` for checked.

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

## Additional Notes

- Remark.js processes markdown content in this app, ensuring consistent rendering across different views.
- If you encounter rendering issues or need support for additional syntax, consult the app documentation or contact support.

This cheatsheet covers the most commonly used markdown syntax for creating content in this application. Use these formatting options to enhance readability and structure of your text!
