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
const { AssertionError } = require('assert');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const NodeHttpAdapter = require('@pollyjs/adapter-node-http');
const FSPersister = require('@pollyjs/persister-fs');
const setupPolly = require('@pollyjs/core').setupMocha;

describe('Index Tests', () => {
  setupPolly({
    logging: false,
    recordFailedRequests: true,
    recordIfMissing: false,
    adapters: [NodeHttpAdapter],
    persister: FSPersister,
    persisterOptions: {
      fs: {
        recordingsDir: 'test/fixtures',
      },
    },
    matchRequestsBy: {
      headers: {
        exclude: ['authorization', 'user-agent'],
      },
    },
  });

  let index;
  let invoke;
  beforeEach(() => {
    invoke = sinon.fake();
    index = proxyquire('../src/index.js', {
      openwhisk: () => ({
        actions: {
          invoke,
        },
      }),
    }).main;
  });

  it('index function bails if neccessary arguments are missing', async () => {
    try {
      await index();
      assert.fail('this should not happen');
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      assert.ok(e);
    }
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
      jobs: 6,
      statusCode: 201,
    });

    sinon.assert.callCount(invoke, 1);
  });

  it('index delegates for truncated responses', async () => {
    const result = await index({
      owner: 'MicrosoftDocs',
      repo: 'azure-docs',
      ref: '0fab4c4f2940e4c7b2ac5a93fcc52d2d5f7ff367',
      branch: 'master',
    });
    assert.equal(typeof result, 'object');
    assert.deepEqual(result, {
      delegated: 'index-big-tree',
      jobs: 1,
      statusCode: 201,
    });
  }).timeout(10000);

  it('index function makes authenticated HTTP requests', async () => {
    const result = await index({
      owner: 'trieloff',
      repo: 'excelsior-ui',
      ref: 'c1e15f0fc0edf7e504e4c55b60df996c03e64b48',
      branch: 'master',
      pattern: '*.html',
      token: 'fake-and-revoked',
    });
    assert.equal(typeof result, 'object');
    assert.deepEqual(result, {
      delegated: 'update-index',
      jobs: 2,
      statusCode: 201,
    });

    sinon.assert.callCount(invoke, 1);
  });

  it('index filters by pattern', async () => {
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
      statusCode: 201,
    });
    sinon.assert.callCount(invoke, 1);
  });
});
