import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSISTANT_SUGGESTIONS,
  ASSISTANT_WELCOME,
  localReply,
} from './assistantBrain.js'

test('welcome copy and suggestions are defined', () => {
  assert.match(ASSISTANT_WELCOME, /help you choose/i)
  assert.equal(ASSISTANT_SUGGESTIONS.length, 4)
})

test('localReply covers core shopping intents', () => {
  assert.match(localReply('Best iPhone under $900?'), /iPhone/i)
  assert.match(localReply('Compare MacBook Air and Pro'), /MacBook/i)
  assert.match(localReply('What AirPods should I get?'), /AirPods/i)
  assert.match(localReply('Gift ideas for a student'), /gift|AirPods|iPad|Watch/i)
  assert.match(localReply('Help me compare options'), /Compare/i)
  assert.match(localReply('Tell me about iPad Pro'), /iPad/i)
})

test('localReply falls back for unknown prompts', () => {
  assert.match(localReply('hello world'), /shopping assistant/i)
})
