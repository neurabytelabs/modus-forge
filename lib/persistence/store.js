/**
 * Store — Persistent key-value storage for MODUS Forge.
 * 
 * Uses JSON files in ~/.modus-forge/ for zero-dependency persistence.
 * Each "collection" is a separate JSON file.
 * 
 * Philosophy: "Nothing in nature is contingent, but all things are
 * determined by the necessity of divine nature." — Spinoza, Ethics I, P29
 * 
 * Storage is deterministic: same key always maps to same location.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STORE_DIR = join(homedir(), '.modus-forge', 'store');

/** Ensure store directory exists */
function ensureDir() {
  mkdirSync(STORE_DIR, { recursive: true });
}

/** Get path for a collection file */
function collectionPath(collection) {
  return join(STORE_DIR, `${collection}.json`);
}

/** Read a collection from disk */
function readCollection(collection) {
  const path = collectionPath(collection);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

/** Write a collection to disk */
function writeCollection(collection, data) {
  ensureDir();
  writeFileSync(collectionPath(collection), JSON.stringify(data, null, 2));
}

/**
 * Get a value from a collection.
 * @param {string} collection - Collection name
 * @param {string} key - Item key
 * @returns {*} The stored value, or undefined
 */
export function get(collection, key) {
  const data = readCollection(collection);
  return data[key];
}

/**
 * Set a value in a collection.
 * @param {string} collection - Collection name
 * @param {string} key - Item key
 * @param {*} value - Value to store (must be JSON-serializable)
 */
export function set(collection, key, value) {
  const data = readCollection(collection);
  data[key] = value;
  writeCollection(collection, data);
}

/**
 * Delete a key from a collection.
 * @param {string} collection - Collection name
 * @param {string} key - Item key
 * @returns {boolean} Whether the key existed
 */
export function del(collection, key) {
  const data = readCollection(collection);
  if (!(key in data)) return false;
  delete data[key];
  writeCollection(collection, data);
  return true;
}

/**
 * List all keys in a collection.
 * @param {string} collection - Collection name
 * @returns {string[]}
 */
export function keys(collection) {
  return Object.keys(readCollection(collection));
}

/**
 * Get all entries in a collection.
 * @param {string} collection - Collection name
 * @returns {Object}
 */
export function all(collection) {
  return readCollection(collection);
}

/**
 * List all collections.
 * @returns {string[]}
 */
export function collections() {
  ensureDir();
  return readdirSync(STORE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Drop an entire collection.
 * @param {string} collection
 * @returns {boolean}
 */
export function drop(collection) {
  const path = collectionPath(collection);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

/**
 * Query a collection with a filter function.
 * @param {string} collection
 * @param {(key: string, value: *) => boolean} filterFn
 * @returns {Object} Matching entries
 */
export function query(collection, filterFn) {
  const data = readCollection(collection);
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    if (filterFn(k, v)) result[k] = v;
  }
  return result;
}
