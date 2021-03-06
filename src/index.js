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

const {
  chunkifyShort, flat, pipe, map, filter, count,
} = require('ferrum');
const { wrap } = require('@adobe/helix-status');
const request = require('request-promise-native');
const minimatch = require('minimatch');
const openwhisk = require('openwhisk');
const packjson = require('../package.json');

function ua() {
  const name = packjson.name.replace(/.*\//, '');
  const { version } = packjson;
  return `${name}/${version}`;
}

/**
 * This is the main function
 * @param {string} name name of the person to greet
 * @returns {object} a greeting
 */
function main({
  owner, repo, ref, branch, pattern = '**/*.{md,jpg}', token, batchsize = 100,
} = {}) {
  if (!(owner && repo && ref && branch)) {
    throw new Error('Required arguments missing');
  }
  return request(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, {
    json: true,
    headers: {
      'user-agent': ua(),
      authorization: token ? `token ${token}` : undefined,
    },
  }).then((response) => {
    const ow = openwhisk();
    if (response.truncated) {
      ow.actions.invoke({
        name: 'index-big-tree',
        blocking: false,
        result: false,
        params: {
          owner, repo, ref, branch, pattern, token,
        },
      });
      return {
        delegated: 'index-big-tree',
        jobs: 1,
        statusCode: 201,
      };
    }

    const jobs = pipe(
      response.tree,
      filter(({ type }) => type === 'blob'),
      filter(({ path }) => minimatch(path, pattern)),
      map(({ path }) => path),
      chunkifyShort(batchsize),
      map((paths) => {
        ow.actions.invoke({
          name: 'helix-index/index-file@1.2.1',
          blocking: false,
          result: false,
          params: {
            owner, repo, ref, paths, branch, sha: 'initial', token,
          },
        });
        return paths;
      }),
    );

    /*
    const jobs = chunkify(response.tree
      .filter(({ type }) => type === 'blob')
      .filter(({ path }) => minimatch(path, pattern))
      .map(({path}) => path), batchsize)
      .map(paths => {
        ow.actions.invoke({
          name: 'helix-index/index-file@1.2.1',
          blocking: false,
          result: false,
          params: {
            owner, repo, ref, paths, branch, sha, token,
          },
        });
        return paths;
      });
      */
    return {
      statusCode: 201,
      delegated: 'update-index',
      jobs: count(flat(jobs)),
    };
  });
}

module.exports = { main: wrap(main) };
