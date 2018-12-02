
const {
  debug, flatten1Level, isArray, isFunction, isNullsy, isObject, isString, throwError
} = require('@feathers-plus/commons');

module.exports = class Plugins {
  constructor (options) {
    this._options = Object.assign({}, options.options);
    this._registry = new Map();
    this._pluginsContext = {};
  }

  /*
   Add a plugin.

   plugin = {
     name: 'foo',
     version: '1.0.0', // optional
     setup: [async (this._options, this._pluginsContext, pluginContext) => {}, ...], // optional
     run: [async (context, data) => {}, ...],
     teardown: [async (args, this._options, this._pluginsContext, pluginContext) => {}, ...], // optional
   };
   */

  register (plugin) {
    if (!isObject(plugin)) {
      throwError(`Plugin is ${typeof plugin} not object. (plugins)`);
    }
    const { name, version, setup, run, teardown } = plugin;

    if (!isString(name)) {
      throwError(`Plugin.name is ${typeof plugin} not string. (plugins)`);
    }
    if (!isString(version) && !isNullsy(version)) {
      throwError(`Plugin.version is ${typeof version} not string. (plugins)`);
    }

    if (setup) {
      (isArray(setup) ? setup : [setup]).forEach((func, i) => {
        if (!isFunction(func)) {
          throwError(`Plugin.setup[${i}] is ${typeof func} not function. (plugins)`);
        }
      });
    }

    (isArray(run) ? run : [run]).forEach((func, i) => {
      if (!isFunction(func)) {
        throwError(`Plugin.run[${i}] is ${typeof func} not function. (plugins)`);
      }
    });

    if (teardown) {
      (isArray(teardown) ? teardown : [teardown]).forEach((func, i) => {
        if (!isFunction(func)) {
          throwError(`Plugin.teardown[${i}] is ${typeof func} not function. (plugins)`);
        }
      });
    }

    let handlers = this._registry.get(name);

    if (!handlers) {
      handlers = { setup: [], exec: [], teardown: [] };
      this._registry.set(name, handlers);
    }

    handlers.setup.push(plugin.setup);
    handlers.exec.push(plugin.run);
    handlers.teardown.push(plugin.teardown);

    debug('register plugin name', name, plugin);
  }

  setup () {
    debug('setup handlers');

    // Flatten handlers
    this._registry.forEach((plugin, name) => {
      const handlers = this._registry.get(name);

      this._registry.set(name, {
        setup: flatten1Level(handlers.setup),
        exec: flatten1Level(handlers.exec),
        teardown: flatten1Level(handlers.teardown)
      });
    });

    debug('Flattened handlers', this._registry);

    // setup plugins
    this._registry.forEach((plugin, name) => {
      const pluginContext = {};
      const setups = this._registry.get(name).setup;

      setups.forEach(func => {
        func(this._options, this._pluginsContext, pluginContext);
      });
    });
  }

  run (name, args) {
    const pluginContext = {};
    const runs = this._registry.get(name).exec;
    debug('Run plugin named', name, this._registry);

    runs.forEach(func => {
      func(args, this._options, this._pluginsContext, pluginContext);
    });
  }

  teardown (name) {
    const pluginContext = {};
    const runs = this._registry.get(name).teardown;
    debug('teardown plugin named', name, this._registry);

    runs.forEach(func => {
      func(this._options, this._pluginsContext, pluginContext);
    });
  }
};
