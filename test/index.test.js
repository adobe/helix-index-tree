/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('Index Tests', () => {
  let index;
  let invoke;
  before(() => {
    invoke = sinon.fake();

    index = proxyquire('../src/index.js', {
      openwhisk: () => ({
        actions: {
          invoke,
        },
      }),
    }).main;
  });

  it('index function makes HTTP requests', async () => {
    const result = await index({
      owner: 'trieloff',
      repo: 'helix-demo',
      ref: 'ca8959afbb2668c761e47a4563f054da2444ab30',
      branch: 'master',
    });
    assert.equal(typeof result, 'object');
    assert.deepEqual(result, {
      delegated: 'update-index',
      jobs: 13,
    });

    sinon.assert.callCount(invoke, result.jobs);
  });

  it.only('index filters by pattern', async () => {
    const result = await index({
      owner: 'trieloff',
      repo: 'helix-demo',
      ref: 'ca8959afbb2668c761e47a4563f054da2444ab30',
      branch: 'master',
      pattern: '**/*.{md,html}',
    });
    assert.equal(typeof result, 'object');
    assert.deepEqual(result, {
      delegated: 'update-index',
      jobs: 7,
    });
    sinon.assert.callCount(invoke, result.jobs);
  });
});
