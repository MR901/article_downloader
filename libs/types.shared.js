// Shared data model types (JSDoc typedefs for JS projects)

/**
 * @typedef {Object} Reference
 * @property {string} id
 * @property {string} label
 * @property {string} url
 * @property {string=} context
 */

/**
 * @typedef {Object} RelatedMention
 * @property {string} title
 * @property {string} url
 * @property {string=} source
 */

/**
 * @typedef {{ type: 'paragraph', text: string } |
 *            { type: 'image', src: string, alt?: string, width?: number, height?: number } |
 *            { type: 'code', lang?: string, text: string } |
 *            { type: 'list', ordered: boolean, items: string[] } |
 *            { type: 'quote', text: string, cite?: string }} Block
 */

/**
 * @typedef {Object} Section
 * @property {string} id
 * @property {number} level
 * @property {string} heading
 * @property {Block[]} blocks
 */

/**
 * @typedef {Object} Article
 * @property {string} title
 * @property {string=} author
 * @property {string=} publishedAt
 * @property {Section[]} sections
 * @property {Reference[]=} references
 * @property {RelatedMention[]=} related
 */

// This file contains JSDoc typedefs only; it does not execute at runtime.


