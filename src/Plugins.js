
/*
 Purpose
 =======

 You can roughly think of plugins as replacing switch/case syntax. Instead of
   switch (name) {
     case 'name1':
      // ...
      break;
    case 'name2':
      // ...
      break;
   }
 
 You can use:
   plugins.register(plugin1);
   plugins.register(plugin1);
   // ...
   plugins.run(name);

 This allows the equivalent of a variable switch/case into which conditions may be injected.


 Add a plugin
 ============

 const Plugins = require('plugin-scaffolding');
 const plugins = new Plugins({ options: _options });
 plugins.register(plugin1);
 plugins.register([plugin2, ...]);

 plugin = {
   // Multiple plugins using the same name are run sequentially.
   name: 'foo',
   // Not used. Optional.
   version: '1.0.0',
   // Drop previous plugins using this name. Default is false.
   replacePrevious: false,
   // Setup funcs for all plugins are run together on plugins.setup(). Optional.
   setup: [async (this._options, this._pluginsContext, pluginContext) => {}, ...],
   // Plugins using the same name are run sequentially on plugins.run(name, data).
   run: [async (context, data) => {}, ...],
   // Teardown funcs for all plugins are run together on plugins.teardown(). Optional.
   teardown: [async (args, this._options, this._pluginsContext, pluginContext) => {}, ...],
 };

 this._options = _options in new Plugins({ options: _options }). Usually _options would be default
   options which the setup funcs can modify with additional default props. These could then be
   merged with options provided by the user, thus mutating _options.
 this._pluginsContext = A new this._pluginsContext is initialized when the Plugins class is
   instantiated. It is shared by all the setup, run and teardown funcs of all plugins
   for communication.
 pluginContext = A new pluginContext is initialized at the start of setup, of run and of
   teardown. This shared by the multiple setup funcs, run funcs or teardown funcs.
 */

const {
  debug, flatten1Level, isArray, isBoolean, isFunction, isNullsy, isObject, isString, throwError
} = require('@feathers-plus/commons');

module.exports = class Plugins {
  constructor (options) {
    this._options = options.options;
    this._registry = new Map();
    this._pluginsContext = {};
  }

  register (plugins) {
    plugins = Array.isArray(plugins) ? plugins : [plugins];

    plugins.forEach(plugin => {
      if (!isObject(plugin)) {
        throwError(`Plugin is ${typeof plugin} not object. (plugins)`);
      }
      const { name, version, replacePrevious, setup, run, teardown } = plugin;

      if (!isString(name)) {
        throwError(`Plugin.name is ${typeof plugin} not string. (plugins)`);
      }

      if (!isString(version) && !isNullsy(version)) {
        throwError(`Plugin.version is ${typeof version} not string. (plugins)`);
      }

      if (!isBoolean(replacePrevious) && !isNullsy(replacePrevious)) {
        throwError(`Plugin.replacePrevious is ${typeof replacePrevious} not boolean. (plugins)`);
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

      if (!handlers || replacePrevious) {
        handlers = { setup: [], exec: [], teardown: [] };
        this._registry.set(name, handlers);
      }

      handlers.setup.push(plugin.setup);
      handlers.exec.push(plugin.run);
      handlers.teardown.push(plugin.teardown);

      debug('register plugin name', name, plugin);
    });
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
