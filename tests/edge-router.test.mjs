import test from 'node:test';
import assert from 'node:assert/strict';
import { pages } from '../edge/pages.mjs';
test('route registry includes nested page', () => assert.ok(pages['ci-probe.dofinances.com/nested/hello']));
