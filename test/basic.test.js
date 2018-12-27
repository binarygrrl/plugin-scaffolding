
/* globals describe, beforeEach, it */
const assert = require('chai').assert;
const Plugins = require('../src');

describe('basic.test.js', () => {
  let plugins;
  let pluginsContext;
  let setup, setupPluginsContextOptions, setupPluginContext;
  let run, runData, runPluginsContextOptions, runPluginContext;
  let teardown, teardownPluginsContextOptions, teardownPluginContext;

  beforeEach(async () => {
    pluginsContext = { options: { init: 'init1' } };
    plugins = new Plugins(pluginsContext);

    plugins.register([{
      trigger: 'test',
      setup: (pluginsContext, pluginContext) => {
        setup = 1;
        setupPluginsContextOptions = Object.assign({}, pluginsContext.options);
        setupPluginContext = Object.assign({}, pluginContext);

        pluginsContext.options.setups = 'setups1';
        pluginContext.faz1 = 'baz1';
      },
      run: (accumulator, data, pluginsContext, pluginContext) => {
        run = 2;
        runData = Object.assign({}, data);
        runPluginsContextOptions = Object.assign({}, pluginsContext.options);
        runPluginContext = Object.assign({}, pluginContext);

        pluginsContext.options.runs = 'runs1';
        pluginContext.faz2 = 'baz2';
      },
      teardown: (pluginsContext, pluginContext) => {
        teardown = 3;
        teardownPluginsContextOptions = Object.assign({}, pluginsContext.options);
        teardownPluginContext = Object.assign({}, pluginContext);

        pluginsContext.options.teardowns = 'teardowns1';
        pluginContext.faz3 = 'baz3';
      }
    }]);

    await plugins.setup();
  });

  it('setup initializes', async () => {
    assert.strictEqual(setup, 1);
    assert.strictEqual(run, undefined);
    assert.strictEqual(teardown, undefined);

    assert.deepEqual(setupPluginsContextOptions, { init: 'init1' });
    assert.deepEqual(setupPluginContext, {});

    assert.instanceOf(plugins._pluginsContext.plugins, Plugins);
    assert.deepEqual(pluginsContext, { options: { init: 'init1', setups: 'setups1' } });
  });

  it('run executes plugin', async () => {
    await plugins.run('test', { mydata: 'myData1' });

    assert.strictEqual(setup, 1);
    assert.strictEqual(run, 2);
    assert.strictEqual(teardown, undefined);

    assert.deepEqual(runData, { mydata: 'myData1' });
    assert.deepEqual(runPluginsContextOptions, { init: 'init1', setups: 'setups1' });
    assert.deepEqual(runPluginContext, {});

    assert.instanceOf(plugins._pluginsContext.plugins, Plugins);
    assert.deepEqual(pluginsContext, { options: { init: 'init1', setups: 'setups1', runs: 'runs1' } });
  });

  it('teardown runs', async () => {
    await plugins.run('test', { mydata: 'myData1' });
    await plugins.teardown();

    assert.strictEqual(setup, 1);
    assert.strictEqual(run, 2);
    assert.strictEqual(teardown, 3);

    assert.deepEqual(teardownPluginsContextOptions, { init: 'init1', setups: 'setups1', runs: 'runs1' });
    assert.deepEqual(teardownPluginContext, {});

    assert.instanceOf(plugins._pluginsContext.plugins, Plugins);
    assert.deepEqual(pluginsContext, { options: { init: 'init1', setups: 'setups1', runs: 'runs1', teardowns: 'teardowns1' } });
  });
});
