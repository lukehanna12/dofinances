/* Browser-adapted, locally vendored Turndown + GFM plugin.
 * Upstreams: mixmark-io/turndown & mixmark-io/turndown-plugin-gfm
 * MIT licensed (see readme-rich-markdown.LICENSE).
 * Each upstream file is isolated to avoid collisions while maintaining its
 * original functions/rules; no third-party scripts are loaded at runtime. */

// upstream: utils
const utils=(()=>{

function extend (destination) {
  for (let i = 1; i < arguments.length; i++) {
    const source = arguments[i]
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) destination[key] = source[key]
    }
  }
  return destination
}

function repeat (character, count) {
  return Array(count + 1).join(character)
}

function trimLeadingNewlines (string) {
  return string.replace(/^\n*/, '')
}

function trimTrailingNewlines (string) {
  // avoid match-at-end regexp bottleneck, see #370
  let indexEnd = string.length
  while (indexEnd > 0 && string[indexEnd - 1] === '\n') indexEnd--
  return string.substring(0, indexEnd)
}

function trimNewlines (string) {
  return trimTrailingNewlines(trimLeadingNewlines(string))
}

var blockElements = [
  'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY', 'CANVAS',
  'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'FORM', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
  'HGROUP', 'HR', 'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
  'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
  'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
]

function isBlock (node) {
  return is(node, blockElements)
}

var voidElements = [
  'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT',
  'KEYGEN', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
]

function isVoid (node) {
  return is(node, voidElements)
}

function hasVoid (node) {
  return has(node, voidElements)
}

const meaningfulWhenBlankElements = [
  'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TH', 'TD', 'IFRAME', 'SCRIPT',
  'AUDIO', 'VIDEO'
]

function isMeaningfulWhenBlank (node) {
  return is(node, meaningfulWhenBlankElements)
}

function hasMeaningfulWhenBlank (node) {
  return has(node, meaningfulWhenBlankElements)
}

function is (node, tagNames) {
  return tagNames.indexOf(node.nodeName) >= 0
}

function has (node, tagNames) {
  return (
    node.getElementsByTagName &&
    tagNames.some(function (tagName) {
      return node.getElementsByTagName(tagName).length
    })
  )
}

const markdownEscapes = [
  [/\\/g, '\\\\'],
  [/\*/g, '\\*'],
  [/^-/g, '\\-'],
  [/^\+ /g, '\\+ '],
  [/^(=+)/g, '\\$1'],
  [/^(#{1,6}) /g, '\\$1 '],
  [/`/g, '\\`'],
  [/^~~~/g, '\\~~~'],
  [/\[/g, '\\['],
  [/\]/g, '\\]'],
  [/^>/g, '\\>'],
  [/_/g, '\\_'],
  [/^(\d+)\. /g, '$1\\. ']
]

function escapeMarkdown (string) {
  return markdownEscapes.reduce(function (accumulator, escape) {
    return accumulator.replace(escape[0], escape[1])
  }, string)
}

return {extend,repeat,trimLeadingNewlines,trimTrailingNewlines,trimNewlines,blockElements,isBlock,voidElements,isVoid,hasVoid,isMeaningfulWhenBlank,hasMeaningfulWhenBlank,escapeMarkdown};
})();

// upstream: ws
const ws=(()=>{

/**
 * The collapseWhitespace function is adapted from collapse-whitespace
 * by Luc Thevenard.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Luc Thevenard <lucthevenard@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * collapseWhitespace(options) removes extraneous whitespace from an the given element.
 *
 * @param {Object} options
 */
function collapseWhitespace (options) {
  const element = options.element
  const isBlock = options.isBlock
  const isVoid = options.isVoid
  const isPre = options.isPre || function (node) {
    return node.nodeName === 'PRE'
  }

  if (!element.firstChild || isPre(element)) return

  let prevText = null
  let keepLeadingWs = false

  let prev = null
  let node = next(prev, element, isPre)

  while (node !== element) {
    if (node.nodeType === 3 || node.nodeType === 4) { // Node.TEXT_NODE or Node.CDATA_SECTION_NODE
      let text = node.data.replace(/[ \r\n\t]+/g, ' ')

      if ((!prevText || / $/.test(prevText.data)) &&
          !keepLeadingWs && text[0] === ' ') {
        text = text.substr(1)
      }

      // `text` might be empty at this point.
      if (!text) {
        node = remove(node)
        continue
      }

      node.data = text

      prevText = node
    } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
      if (isBlock(node) || node.nodeName === 'BR') {
        if (prevText) {
          prevText.data = prevText.data.replace(/ $/, '')
        }

        prevText = null
        keepLeadingWs = false
      } else if (isVoid(node) || isPre(node)) {
        // Avoid trimming space around non-block, non-BR void elements and inline PRE.
        prevText = null
        keepLeadingWs = true
      } else if (prevText) {
        // Drop protection if set previously.
        keepLeadingWs = false
      }
    } else {
      node = remove(node)
      continue
    }

    const nextNode = next(prev, node, isPre)
    prev = node
    node = nextNode
  }

  if (prevText) {
    prevText.data = prevText.data.replace(/ $/, '')
    if (!prevText.data) {
      remove(prevText)
    }
  }
}

/**
 * remove(node) removes the given node from the DOM and returns the
 * next node in the sequence.
 *
 * @param {Node} node
 * @return {Node} node
 */
function remove (node) {
  const next = node.nextSibling || node.parentNode

  node.parentNode.removeChild(node)

  return next
}

/**
 * next(prev, current, isPre) returns the next node in the sequence, given the
 * current and previous nodes.
 *
 * @param {Node} prev
 * @param {Node} current
 * @param {Function} isPre
 * @return {Node}
 */
function next (prev, current, isPre) {
  if ((prev && prev.parentNode === current) || isPre(current)) {
    return current.nextSibling || current.parentNode
  }

  return current.firstChild || current.nextSibling || current.parentNode
}

collapseWhitespace

return collapseWhitespace;
})();

const collapseWhitespace=ws;

// upstream: parser
const parser=(()=>{

/*
 * Set up window for Node.js
 */

const root = (typeof window !== 'undefined' ? window : {})

/*
 * Parsing HTML strings
 */

function canParseHTMLNatively () {
  const Parser = root.DOMParser
  let canParse = false

  // Adapted from https://gist.github.com/1129031
  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if (new Parser().parseFromString('', 'text/html')) {
      canParse = true
    }
  } catch (e) {}

  return canParse
}

function createHTMLParser () {
  const Parser = function () {}

  if (process.browser) {
    if (shouldUseActiveX()) {
      Parser.prototype.parseFromString = function (string) {
        const doc = new window.ActiveXObject('htmlfile')
        doc.designMode = 'on' // disable on-page scripts
        doc.open()
        doc.write(string)
        doc.close()
        return doc
      }
    } else {
      Parser.prototype.parseFromString = function (string) {
        const doc = document.implementation.createHTMLDocument('')
        doc.open()
        doc.write(string)
        doc.close()
        return doc
      }
    }
  } else {
    const domino = require('@mixmark-io/domino')
    Parser.prototype.parseFromString = function (string) {
      return domino.createDocument(string)
    }
  }
  return Parser
}

function shouldUseActiveX () {
  let useActiveX = false
  try {
    document.implementation.createHTMLDocument('').open()
  } catch (e) {
    if (root.ActiveXObject) useActiveX = true
  }
  return useActiveX
}

canParseHTMLNatively() ? root.DOMParser : createHTMLParser()

return canParseHTMLNatively() ? root.DOMParser : createHTMLParser();
})();

const HTMLParser=parser;

// upstream: root
const root=(()=>{
const {isBlock,isVoid}=utils;




function RootNode (input, options) {
  let root
  if (typeof input === 'string') {
    const doc = htmlParser().parseFromString(
      // DOM parsers arrange elements in the <head> and <body>.
      // Wrapping in a custom element ensures elements are reliably arranged in
      // a single element.
      '<x-turndown id="turndown-root">' + input + '</x-turndown>',
      'text/html'
    )
    root = doc.getElementById('turndown-root')
  } else {
    root = input.cloneNode(true)
  }
  collapseWhitespace({
    element: root,
    isBlock,
    isVoid,
    isPre: options.preformattedCode ? isPreOrCode : null
  })

  return root
}

let _htmlParser
function htmlParser () {
  _htmlParser = _htmlParser || new HTMLParser()
  return _htmlParser
}

function isPreOrCode (node) {
  return node.nodeName === 'PRE' || node.nodeName === 'CODE'
}

return RootNode;
})();

const RootNode=root;

// upstream: node
const node=(()=>{
const {isBlock,isVoid,hasVoid,isMeaningfulWhenBlank,hasMeaningfulWhenBlank}=utils;


function Node (node, options) {
  node.isBlock = isBlock(node)
  node.isCode = node.nodeName === 'CODE' || node.parentNode.isCode
  node.isBlank = isBlank(node)
  node.flankingWhitespace = flankingWhitespace(node, options)
  return node
}

function isBlank (node) {
  return (
    !isVoid(node) &&
    !isMeaningfulWhenBlank(node) &&
    /^\s*$/i.test(node.textContent) &&
    !hasVoid(node) &&
    !hasMeaningfulWhenBlank(node)
  )
}

function flankingWhitespace (node, options) {
  if (node.isBlock || (options.preformattedCode && node.isCode)) {
    return { leading: '', trailing: '' }
  }

  const edges = edgeWhitespace(node.textContent)

  // abandon leading ASCII WS if left-flanked by ASCII WS
  if (edges.leadingAscii && isFlankedByWhitespace('left', node, options)) {
    edges.leading = edges.leadingNonAscii
  }

  // abandon trailing ASCII WS if right-flanked by ASCII WS
  if (edges.trailingAscii && isFlankedByWhitespace('right', node, options)) {
    edges.trailing = edges.trailingNonAscii
  }

  return { leading: edges.leading, trailing: edges.trailing }
}

function edgeWhitespace (string) {
  const m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/)
  return {
    leading: m[1], // whole string for whitespace-only strings
    leadingAscii: m[2],
    leadingNonAscii: m[3],
    trailing: m[4], // empty for whitespace-only strings
    trailingNonAscii: m[5],
    trailingAscii: m[6]
  }
}

function isFlankedByWhitespace (side, node, options) {
  let sibling
  let regExp
  let isFlanked

  if (side === 'left') {
    sibling = node.previousSibling
    regExp = / $/
  } else {
    sibling = node.nextSibling
    regExp = /^ /
  }

  if (sibling) {
    if (sibling.nodeType === 3) {
      isFlanked = regExp.test(sibling.nodeValue)
    } else if (options.preformattedCode && sibling.nodeName === 'CODE') {
      isFlanked = false
    } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
      isFlanked = regExp.test(sibling.textContent)
    }
  }
  return isFlanked
}

return Node;
})();

const Node=node;

// upstream: rules
const rules=(()=>{

/**
 * Manages a collection of rules used to convert HTML to Markdown
 */

function Rules (options) {
  this.options = options
  this._keep = []
  this._remove = []

  this.blankRule = {
    replacement: options.blankReplacement
  }

  this.keepReplacement = options.keepReplacement

  this.defaultRule = {
    replacement: options.defaultReplacement
  }

  this.array = []
  for (const key in options.rules) this.array.push(options.rules[key])
}

Rules.prototype = {
  add: function (key, rule) {
    this.array.unshift(rule)
  },

  keep: function (filter) {
    this._keep.unshift({
      filter,
      replacement: this.keepReplacement
    })
  },

  remove: function (filter) {
    this._remove.unshift({
      filter,
      replacement: function () {
        return ''
      }
    })
  },

  forNode: function (node) {
    if (node.isBlank) return this.blankRule
    let rule

    if ((rule = findRule(this.array, node, this.options))) return rule
    if ((rule = findRule(this._keep, node, this.options))) return rule
    if ((rule = findRule(this._remove, node, this.options))) return rule

    return this.defaultRule
  },

  forEach: function (fn) {
    for (let i = 0; i < this.array.length; i++) fn(this.array[i], i)
  }
}

function findRule (rules, node, options) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    if (filterValue(rule, node, options)) return rule
  }
  return undefined
}

function filterValue (rule, node, options) {
  const filter = rule.filter
  if (typeof filter === 'string') {
    if (filter === node.nodeName.toLowerCase()) return true
  } else if (Array.isArray(filter)) {
    if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true
  } else if (typeof filter === 'function') {
    if (filter.call(rule, node, options)) return true
  } else {
    throw new TypeError('`filter` needs to be a string, array, or function')
  }
}

return Rules;
})();

const Rules=rules;

// upstream: common
const common=(()=>{
const {escapeMarkdown,repeat,trimNewlines}=utils;


const rules = {}

rules.paragraph = {
  filter: 'p',

  replacement: function (content) {
    return '\n\n' + content + '\n\n'
  }
}

rules.lineBreak = {
  filter: 'br',

  replacement: function (content, node, options) {
    return options.br + '\n'
  }
}

rules.heading = {
  filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

  replacement: function (content, node, options) {
    const hLevel = Number(node.nodeName.charAt(1))

    if (options.headingStyle === 'setext' && hLevel < 3) {
      const underline = repeat((hLevel === 1 ? '=' : '-'), content.length)
      return (
        '\n\n' + content + '\n' + underline + '\n\n'
      )
    } else {
      return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n'
    }
  }
}

rules.blockquote = {
  filter: 'blockquote',

  replacement: function (content) {
    content = trimNewlines(content).replace(/^/gm, '> ')
    return '\n\n' + content + '\n\n'
  }
}

rules.list = {
  filter: ['ul', 'ol'],

  replacement: function (content, node) {
    const parent = node.parentNode
    if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
      return '\n' + content
    } else {
      return '\n\n' + content + '\n\n'
    }
  }
}

rules.listItem = {
  filter: 'li',

  replacement: function (content, node, options) {
    let prefix = options.bulletListMarker + '   '
    const parent = node.parentNode
    if (parent.nodeName === 'OL') {
      const start = parent.getAttribute('start')
      const index = Array.prototype.indexOf.call(parent.children, node)
      prefix = (start ? Number(start) + index : index + 1) + '.  '
    }
    const isParagraph = /\n$/.test(content)
    content = trimNewlines(content) + (isParagraph ? '\n' : '')
    content = content.replace(/\n/gm, '\n' + ' '.repeat(prefix.length)) // indent
    return (
      prefix + content + (node.nextSibling ? '\n' : '')
    )
  }
}

rules.indentedCodeBlock = {
  filter: function (node, options) {
    return (
      options.codeBlockStyle === 'indented' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    return (
      '\n\n    ' +
      node.firstChild.textContent.replace(/\n/g, '\n    ') +
      '\n\n'
    )
  }
}

rules.fencedCodeBlock = {
  filter: function (node, options) {
    return (
      options.codeBlockStyle === 'fenced' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    const className = node.firstChild.getAttribute('class') || ''
    const language = (className.match(/language-(\S+)/) || [null, ''])[1]
    const code = node.firstChild.textContent

    const fenceChar = options.fence.charAt(0)
    let fenceSize = 3
    const fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm')

    let match
    while ((match = fenceInCodeRegex.exec(code))) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1
      }
    }

    const fence = repeat(fenceChar, fenceSize)

    return (
      '\n\n' + fence + language + '\n' +
      code.replace(/\n$/, '') +
      '\n' + fence + '\n\n'
    )
  }
}

rules.horizontalRule = {
  filter: 'hr',

  replacement: function (content, node, options) {
    return '\n\n' + options.hr + '\n\n'
  }
}

rules.inlineLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'inlined' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    )
  },

  replacement: function (content, node) {
    const href = escapeLinkDestination(node.getAttribute('href'))
    const title = escapeLinkTitle(cleanAttribute(node.getAttribute('title')))
    const titlePart = title ? ' "' + title + '"' : ''
    return '[' + content + '](' + href + titlePart + ')'
  }
}

rules.referenceLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'referenced' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    )
  },

  replacement: function (content, node, options) {
    const href = escapeLinkDestination(node.getAttribute('href'))
    let title = cleanAttribute(node.getAttribute('title'))
    if (title) title = ' "' + escapeLinkTitle(title) + '"'
    let replacement
    let reference

    switch (options.linkReferenceStyle) {
      case 'collapsed':
        replacement = '[' + content + '][]'
        reference = '[' + content + ']: ' + href + title
        break
      case 'shortcut':
        replacement = '[' + content + ']'
        reference = '[' + content + ']: ' + href + title
        break
      default:
        var id = this.references.length + 1
        replacement = '[' + content + '][' + id + ']'
        reference = '[' + id + ']: ' + href + title
    }

    this.references.push(reference)
    return replacement
  },

  references: [],

  append: function (options) {
    let references = ''
    if (this.references.length) {
      references = '\n\n' + this.references.join('\n') + '\n\n'
      this.references = [] // Reset references
    }
    return references
  }
}

rules.emphasis = {
  filter: ['em', 'i'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.emDelimiter + content + options.emDelimiter
  }
}

rules.strong = {
  filter: ['strong', 'b'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.strongDelimiter + content + options.strongDelimiter
  }
}

rules.code = {
  filter: function (node) {
    const hasSiblings = node.previousSibling || node.nextSibling
    const isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings

    return node.nodeName === 'CODE' && !isCodeBlock
  },

  replacement: function (content) {
    if (!content) return ''
    content = content.replace(/\r?\n|\r/g, ' ')

    const extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? ' ' : ''
    let delimiter = '`'
    const matches = content.match(/`+/gm) || []
    while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`'

    return delimiter + extraSpace + content + extraSpace + delimiter
  }
}

rules.image = {
  filter: 'img',

  replacement: function (content, node) {
    const alt = escapeMarkdown(cleanAttribute(node.getAttribute('alt')))
    const src = escapeLinkDestination(node.getAttribute('src') || '')
    const title = cleanAttribute(node.getAttribute('title'))
    const titlePart = title ? ' "' + escapeLinkTitle(title) + '"' : ''
    return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
  }
}

function cleanAttribute (attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : ''
}

function escapeLinkDestination (destination) {
  const escaped = destination.replace(/([<>()])/g, '\\$1')
  return escaped.indexOf(' ') >= 0 ? '<' + escaped + '>' : escaped
}

function escapeLinkTitle (title) {
  return title.replace(/"/g, '\\"')
}

rules

return rules;
})();

const COMMONMARK_RULES=common;

// upstream: core
const core=(()=>{
const {escapeMarkdown,extend,trimLeadingNewlines,trimTrailingNewlines}=utils;





const reduce = Array.prototype.reduce

function TurndownService (options) {
  if (!(this instanceof TurndownService)) return new TurndownService(options)

  const defaults = {
    rules: COMMONMARK_RULES,
    headingStyle: 'setext',
    hr: '* * *',
    bulletListMarker: '*',
    codeBlockStyle: 'indented',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    br: '  ',
    preformattedCode: false,
    blankReplacement: function (content, node) {
      return node.isBlock ? '\n\n' : ''
    },
    keepReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML
    },
    defaultReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + content + '\n\n' : content
    }
  }
  this.options = extend({}, defaults, options)
  this.rules = new Rules(this.options)
}

TurndownService.prototype = {
  /**
   * The entry point for converting a string or DOM node to Markdown
   * @public
   * @param {String|HTMLElement} input The string or DOM node to convert
   * @returns A Markdown representation of the input
   * @type String
   */

  turndown: function (input) {
    if (!canConvert(input)) {
      throw new TypeError(
        input + ' is not a string, or an element/document/fragment node.'
      )
    }

    if (input === '') return ''

    const output = process.call(this, new RootNode(input, this.options))
    return postProcess.call(this, output)
  },

  /**
   * Add one or more plugins
   * @public
   * @param {Function|Array} plugin The plugin or array of plugins to add
   * @returns The Turndown instance for chaining
   * @type Object
   */

  use: function (plugin) {
    if (Array.isArray(plugin)) {
      for (let i = 0; i < plugin.length; i++) this.use(plugin[i])
    } else if (typeof plugin === 'function') {
      plugin(this)
    } else {
      throw new TypeError('plugin must be a Function or an Array of Functions')
    }
    return this
  },

  /**
   * Adds a rule
   * @public
   * @param {String} key The unique key of the rule
   * @param {Object} rule The rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  addRule: function (key, rule) {
    this.rules.add(key, rule)
    return this
  },

  /**
   * Keep a node (as HTML) that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  keep: function (filter) {
    this.rules.keep(filter)
    return this
  },

  /**
   * Remove a node that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  remove: function (filter) {
    this.rules.remove(filter)
    return this
  },

  /**
   * Escapes Markdown syntax
   * @public
   * @param {String} string The string to escape
   * @returns A string with Markdown syntax escaped
   * @type String
   */

  escape: function (string) {
    return escapeMarkdown(string)
  }
}

/**
 * Reduces a DOM node down to its Markdown string equivalent
 * @private
 * @param {HTMLElement} parentNode The node to convert
 * @returns Accumulator with Markdown representation parts of the node
 * @type Array
 */

function process (parentNode) {
  const self = this
  return reduce.call(parentNode.childNodes, function (output, node) {
    node = new Node(node, self.options)

    let replacement = ''
    if (node.nodeType === 3) {
      replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue)
    } else if (node.nodeType === 1) {
      replacement = replacementForNode.call(self, node)
    }

    join(output, replacement)
    return output
  }, [])
}

/**
 * Appends strings as each rule requires and trims the output
 * @private
 * @param {Array} output The conversion output accumulator
 * @returns A trimmed version of the ouput
 * @type String
 */

function postProcess (output) {
  const self = this
  this.rules.forEach(function (rule) {
    if (typeof rule.append === 'function') {
      join(output, rule.append(self.options))
    }
  })

  return output.join('').replace(/^[\t\r\n]+/, '').replace(/[\t\r\n\s]+$/, '')
}

/**
 * Converts an element node to its Markdown equivalent
 * @private
 * @param {HTMLElement} node The node to convert
 * @returns A Markdown representation of the node
 * @type String
 */

function replacementForNode (node) {
  const rule = this.rules.forNode(node)
  let content = process.call(this, node).join('')
  const whitespace = node.flankingWhitespace
  if (whitespace.leading || whitespace.trailing) content = content.trim()
  return (
    whitespace.leading +
    rule.replacement(content, node, this.options) +
    whitespace.trailing
  )
}

/**
 * Joins replacement with the current output accumulator using the appropriate number of new lines
 * (makes sure the only trailing whitespace will be in the last array element)
 * @private
 * @param {String} output The current conversion output accumulator
 * @param {String} replacement The string to append to the output
 */

function join (output, replacement) {
  const tail = output.pop() || ''
  const s1 = trimTrailingNewlines(tail)
  const s2 = trimLeadingNewlines(replacement)
  const nls = Math.max(tail.length - s1.length, replacement.length - s2.length)
  const separator = '\n\n'.substring(0, nls)

  if (s1) output.push(s1)
  if (separator) output.push(separator)
  if (s2) output.push(s2)
}

/**
 * Determines whether an input can be converted
 * @private
 * @param {String|HTMLElement} input Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */

function canConvert (input) {
  return (
    input != null && (
      typeof input === 'string' ||
      (input.nodeType && (
        input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11
      ))
    )
  )
}

return TurndownService;
})();

const TurndownService=core;

// upstream: strike
const strike=(()=>{

function strikethrough (turndownService) {
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
      return '~' + content + '~'
    }
  })
}

return strikethrough;
})();

const strikethrough=strike;

// upstream: tables
const tables=(()=>{

var indexOf = Array.prototype.indexOf
var every = Array.prototype.every
var rules = {}

rules.tableCell = {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    return cell(content, node)
  }
}

rules.tableRow = {
  filter: 'tr',
  replacement: function (content, node) {
    var borderCells = ''
    var alignMap = { left: ':--', right: '--:', center: ':-:' }

    if (isHeadingRow(node)) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var border = '---'
        var align = (
          node.childNodes[i].getAttribute('align') || ''
        ).toLowerCase()

        if (align) border = alignMap[align] || border

        borderCells += cell(border, node.childNodes[i])
      }
    }
    return '\n' + content + (borderCells ? '\n' + borderCells : '')
  }
}

rules.table = {
  // Only convert tables with a heading row.
  // Tables with no heading row are kept using `keep` (see below).
  filter: function (node) {
    return node.nodeName === 'TABLE' && isHeadingRow(node.rows[0])
  },

  replacement: function (content) {
    // Ensure there are no blank lines
    content = content.replace('\n\n', '\n')
    return '\n\n' + content + '\n\n'
  }
}

rules.tableSection = {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: function (content) {
    return content
  }
}

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow (tr) {
  var parentNode = tr.parentNode
  return (
    parentNode.nodeName === 'THEAD' ||
    (
      parentNode.firstChild === tr &&
      (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode)) &&
      every.call(tr.childNodes, function (n) { return n.nodeName === 'TH' })
    )
  )
}

function isFirstTbody (element) {
  var previousSibling = element.previousSibling
  return (
    element.nodeName === 'TBODY' && (
      !previousSibling ||
      (
        previousSibling.nodeName === 'THEAD' &&
        /^\s*$/i.test(previousSibling.textContent)
      )
    )
  )
}

function cell (content, node) {
  var index = indexOf.call(node.parentNode.childNodes, node)
  var prefix = ' '
  if (index === 0) prefix = '| '
  return prefix + content + ' |'
}

function tables (turndownService) {
  turndownService.keep(function (node) {
    return node.nodeName === 'TABLE' && !isHeadingRow(node.rows[0])
  })
  for (var key in rules) turndownService.addRule(key, rules[key])
}

return tables;
})();

const tablesPlugin=tables;

// upstream: task
const task=(()=>{

function taskListItems (turndownService) {
  turndownService.addRule('taskListItems', {
    filter: function (node) {
      return node.type === 'checkbox' && node.parentNode.nodeName === 'LI'
    },
    replacement: function (content, node) {
      return (node.checked ? '[x]' : '[ ]') + ' '
    }
  })
}

return taskListItems;
})();

const taskListItems=task;

// upstream: code
const code=(()=>{

var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/

function highlightedCodeBlock (turndownService) {
  turndownService.addRule('highlightedCodeBlock', {
    filter: function (node) {
      var firstChild = node.firstChild
      return (
        node.nodeName === 'DIV' &&
        highlightRegExp.test(node.className) &&
        firstChild &&
        firstChild.nodeName === 'PRE'
      )
    },
    replacement: function (content, node, options) {
      var className = node.className || ''
      var language = (className.match(highlightRegExp) || [null, ''])[1]

      return (
        '\n\n' + options.fence + language + '\n' +
        node.firstChild.textContent +
        '\n' + options.fence + '\n\n'
      )
    }
  })
}

return highlightedCodeBlock;
})();

const highlightedCodeBlock=code;

// upstream: gfm
const gfm=(()=>{
const tables=tablesPlugin;





function gfm (turndownService) {
  turndownService.use([
    highlightedCodeBlock,
    strikethrough,
    tables,
    taskListItems
  ])
}



return gfm;
})();

export function createReadmeMarkdownConverter(){
 const converter=new TurndownService({
  headingStyle:"atx",bulletListMarker:"-",codeBlockStyle:"fenced",
  fence:"```",emDelimiter:"*",strongDelimiter:"**",linkStyle:"inlined",br:"  "
 });
 converter.use(gfm);
 // Rendered HTML has safe navigable URLs, but roundtripping must preserve
 // original relative links and image paths in the README source.
 converter.addRule("readme-original-image",{
  filter:node=>node.nodeName==="IMG"&&node.hasAttribute("data-readme-original-src"),
  replacement:(content,node)=>{
   const alt=(node.getAttribute("alt")||"").replace(/\]/g,"\\]");
   const source=node.getAttribute("data-readme-original-src");
   const title=node.getAttribute("title");
   return "!["+alt+"]("+source+(title?' "'+title.replace(/"/g,'\\"')+'"':"")+")";
  }
 });
 converter.addRule("readme-original-link",{
  filter:node=>node.nodeName==="A"&&node.hasAttribute("data-readme-original-href"),
  replacement:(content,node)=>{
   const href=node.getAttribute("data-readme-original-href");
   const title=node.getAttribute("title");
   return "["+content+"]("+href+(title?' "'+title.replace(/"/g,'\\"')+'"':"")+")";
  }
 });
 // Keep otherwise unhandled GitHub details or HTML as HTML rather than
 // removing it. Saving still uses a source-preserving patch where possible.
 converter.keep(["details","summary","video","picture","figure"]);
 return converter;
}

export function preserveReadmeSource(original,baseline,candidate){
 if(candidate===baseline)return original;
 // A single localized rich-text edit often has a verbatim corresponding
 // substring in the original Markdown. Preserve all other source bytes,
 // including comments, frontmatter, and original GFM formatting.
 let p=0;
 const len=Math.min(baseline.length,candidate.length);
 while(p<len&&baseline[p]===candidate[p])p++;
 let s=0;
 while(s<baseline.length-p&&s<candidate.length-p&&
  baseline[baseline.length-1-s]===candidate[candidate.length-1-s])s++;
 const prior=baseline.slice(p,baseline.length-s);
 const next=candidate.slice(p,candidate.length-s);
 // For nonempty edits, require an unambiguous, literal source range and
 // enough matching nearby context to avoid altering the wrong occurrence.
 if(prior.length&&original.indexOf(prior)>=0&&original.indexOf(prior)===original.lastIndexOf(prior)){
  const index=original.indexOf(prior);
  const left=baseline.slice(Math.max(0,p-12),p);
  const right=baseline.slice(baseline.length-s,baseline.length-s+12);
  const leftOK=!left||original.slice(Math.max(0,index-left.length),index)===left;
  const rightOK=!right||original.slice(index+prior.length,index+prior.length+right.length)===right;
  if(leftOK||rightOK)return original.slice(0,index)+next+original.slice(index+prior.length);
 }
 // Insertion at a unique boundary with a shared anchor.
 if(!prior){
  const anchor=baseline.slice(Math.max(0,p-20),p);
  if(anchor.length>=8&&original.indexOf(anchor)>=0&&original.indexOf(anchor)===original.lastIndexOf(anchor)){
   const at=original.indexOf(anchor)+anchor.length;
   return original.slice(0,at)+next+original.slice(at);
  }
 }
 return candidate;
}

