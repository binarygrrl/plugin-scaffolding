
const Plugins = require('../src');

const plugins = new Plugins({ options: { option1: 'bar' } });

plugins.register([{
  name: 'sendResetPwd',
  version: '1.0.0',
  setup: [
    (options, pluginsContext, pluginContext) => {
      console.log('sendResetPwd setup1', options, pluginsContext, pluginContext);
      pluginsContext.fromSetup1 = 1;
      pluginContext.fromSetup1 = 2;
    },
    (...args) => console.log('sendResetPwd setup2', args)
  ],
  run: [
    (data, options, pluginsContext, pluginContext) => {
      console.log('sendResetPwd run1', data, options, pluginsContext, pluginContext);
      pluginsContext.fromRun1 = 1;
      pluginContext.fromRun1 = 2;
    },
    (...args) => console.log('sendResetPwd run2', args)
  ],
  teardown: [
    (options, pluginsContext, pluginContext) => {
      console.log('sendResetPwd teardown1', options, pluginsContext, pluginContext);
      pluginsContext.fromTeardown1 = 1;
      pluginContext.fromTeardown1 = 2;
    },
    (...args) => console.log('sendResetPwd teardown2', args)
  ]
}]);

(async function () {
  await plugins.setup();
  console.log();
  await plugins.run('sendResetPwd', { data1: 1 });
  console.log();
  await plugins.teardown('sendResetPwd');
}());
