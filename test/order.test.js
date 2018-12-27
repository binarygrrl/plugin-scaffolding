
/* globals describe, beforeEach, it */
const assert = require('chai').assert;
const Plugins = require('../src');

let setup;
let run;
let teardown;

const pluginsLibr = {
  default: {
    trigger: 'test',
    setup: () => setup.push('default'),
    run: () => run.push('default'),
  },
  before: {
    trigger: 'test',
    position: 'before',
    setup: () => setup.push('before'),
    run: () => run.push('before'),
  },
  clear: {
    trigger: 'test',
    position: 'clear',
    setup: () => setup.push('clear'),
    run: () => run.push('clear'),
  },
  after: {
    trigger: 'test',
    position: 'after',
    setup: () => setup.push('after'),
    run: () => run.push('after'),
  },
};

describe('order.test.js', () => {
  let plugins;
  let pluginsContext;

  beforeEach(async () => {
    pluginsContext = { options: { init: 'init1' } };
    plugins = new Plugins(pluginsContext);

    setup = [];
    run = [];
    teardown = [];
  });

  it('default runs', async () => {
    plugins.register(pluginsLibr.default);
    await plugins.setup();

    await plugins.run('test');

    assert.deepEqual(setup, ['default']);
    assert.deepEqual(run, ['default']);
  });

  it('before & after work', async () => {
    plugins.register(pluginsLibr.default);
    plugins.register(pluginsLibr.before);
    plugins.register(pluginsLibr.after);
    await plugins.setup();

    await plugins.run('test');

    assert.deepEqual(setup, ['before', 'default', 'after']);
    assert.deepEqual(run, ['before', 'default', 'after']);
  });

  it('clear works', async () => {
    plugins.register(pluginsLibr.default);
    plugins.register(pluginsLibr.before);
    plugins.register(pluginsLibr.clear);
    plugins.register(pluginsLibr.after);
    await plugins.setup();

    await plugins.run('test');

    assert.deepEqual(setup, ['clear', 'after']);
    assert.deepEqual(run, ['clear', 'after']);
  });
});