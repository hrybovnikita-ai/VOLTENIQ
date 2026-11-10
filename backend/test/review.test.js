import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedPhoto } from '../src/services/reviewService.js';

test('isAllowedPhoto accepts https and compact image data URLs only', () => {
  assert.equal(isAllowedPhoto('https://cdn.example.com/review.jpg'), true);
  assert.equal(isAllowedPhoto('data:image/png;base64,aaaa'), true);
  assert.equal(isAllowedPhoto('http://insecure.example.com/x.jpg'), false);
  assert.equal(isAllowedPhoto('data:text/plain;base64,aaaa'), false);
  assert.equal(isAllowedPhoto(''), false);
});
