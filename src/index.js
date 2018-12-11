
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
   // Your name for the plugin. Not used. Optional.
   name: 'foo',
   // Description of the trigger. Not used. Optional.
   desc: 'Default plugin used by repo',
   // Not used. Optional.
   version: '1.0.0',
   // Multiple plugins using the same trigger are run sequentially.
   trigger: 'foo',
   // Place plugin 'before' existing plugins, 'clear' existing plugins and add this one,
   // 'after' existing plugins, Optional, default is 'after'.
   position: 'after',
   // Setup funcs for all plugins are run together on plugins.setup(). Optional.
   setup: [async (this._options, this._pluginsContext, pluginContext) => {}, ...],
   // Plugins having the same trigger value are run sequentially on plugins.run(trigger, data).
   // The initial accumulator is null. The new accumulator is returned by the plugin.
   // The value of the last accumulator is returned as the result of the plugins.
   run: [async (accumulator, data, options, pluginsContext, pluginContext) => {}, ...],
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

const makeDebug = require('debug');
const {
  flatten1Level, isArray, isBoolean, isFunction, isNullsy, isObject, isString, throwError
} = require('@feathers-plus/commons');

const debug = makeDebug('plugin-scaffolding');

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

      const { name, desc, version, trigger, position, setup, run, teardown } = plugin;

      if (!isString(name) && !isNullsy(name)) {
        throwError(`Plugin.name is ${typeof name} not string. (plugins)`);
      }

      if (!isString(desc) && !isNullsy(desc)) {
        throwError(`Plugin.desc is ${typeof desc} not string. (plugins)`);
      }

      if (!isString(version) && !isNullsy(version)) {
        throwError(`Plugin.version is ${typeof version} not string. (plugins)`);
      }

      if (!isString(trigger)) {
        throwError(`Plugin.trigger is ${typeof name} not string. (plugins)`);
      }

      if (!isNullsy(position) && !['before', 'clear', 'after'].contains(position)) {
        throwError(`Plugin.position is ${position} not before/clear/after. (plugins)`);
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

      let handlers = this._registry.get(trigger);

      if (!handlers) {
        handlers = { setup: [], run: [], teardown: [] };
        this._registry.set(trigger, handlers);
      }

      switch (position) {
        case 'before':
          handlers.setup.unshift(plugin.setup);
          handlers.run.unshift(plugin.run);
          handlers.teardown.unshift(plugin.teardown);
          break;
        case 'clear':
          handlers = { setup: [], run: [], teardown: [] };
          this._registry.set(trigger, handlers);
          break;
        default:
          handlers.setup.push(plugin.setup);
          handlers.run.push(plugin.run);
          handlers.teardown.push(plugin.teardown);
      }

      debug('register plugin name', name, trigger);
    });
  }

  async setup () {
    debug('setup handlers', this._registry);

    // Flatten handlers
    this._registry.forEach((plugin, trigger) => {
      const handlers = this._registry.get(trigger);

      this._registry.set(trigger, {
        setup: flatten1Level(handlers.setup),
        run: flatten1Level(handlers.run),
        teardown: flatten1Level(handlers.teardown)
      });
    });

    debug('setup handlers flattened', this._registry);

    // setup plugins
    for (let [trigger, plugin] of this._registry) {
      const pluginContext = {};
      const setups = this._registry.get(trigger).setup;
      const length = setups.length;

      if (length) {
        for (let i = 0; i < length; i++) {
          debug('Setup plugin', trigger, i + 1, 'of', length);
          await (setups[i](this._options, this._pluginsContext, pluginContext));
        }
      }
    }
  }

  async run (trigger, args) {
    if (!this._registry.has(trigger)) {
      throwError(`Plugins do not contain trigger ${trigger}. (plugins)`);
    }

    const pluginContext = {};
    const runs = this._registry.get(trigger).run;
    const length = runs.length;
    let accumulator = null;

    if (length) {
      for (let i = 0; i < length; i++) {
        debug('plugin', trigger, i + 1, 'of', length, 'accumulator', accumulator);
        accumulator = await (runs[i](accumulator, args, this._options, this._pluginsContext, pluginContext));
      }
    }

    debug('plugin', trigger, accumulator);
    return accumulator;
  }

  async teardown (trigger) {
    for (let [trigger, plugin] of this._registry) {
      const pluginContext = {};
      const teardowns = this._registry.get(trigger).teardown;
      const length = teardowns.length;

      if (length) {
        for (let i = 0; i < length; i++) {
          debug('Teardown plugin', trigger, i + 1, 'of', length);
          await (teardowns[i](this._options, this._pluginsContext, pluginContext));
        }
      }
    }
  }
};
