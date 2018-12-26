
/*
 Purpose
 =======

 You can roughly think of plugins as replacing switch/case syntax. Instead of
   switch (name) {
     case 'name1':
      await name1(data);
      break;
    case 'name2':
      await name2a(data);
      await name2b(data);
      break;
   }

 You can use:
   plugins.register('name1', plugin1); // async plugin1(accum, data, pluginsContext, pluginContext)
   plugins.register('name2', [plugin2a, plugin2b]);
   // ...
   plugins.run(name);

 This allows the equivalent of a variable switch/case into which conditions may be injected.


 Plugins can also be used to replace other statements, e.g.
   const users = await plugins.run('resendVerifySignup.find', {
     usersService,
     params: { query: identifyUser },
   });


 Add a plugin
 ============

 const Plugins = require('plugin-scaffolding');

 // Note that new Plugins(options) should not used as the param gets shallow cloned and mutated.
 const plugins = new Plugins({ options });

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
   // Place plugin 'before' existing plugins,
   // 'clear' existing plugins and add this one,
   // 'after' existing plugins, Optional, default is 'after'.
   position: 'after',
   // Setup funcs for all plugins are run together on plugins.setup(). Optional.
   setup: [async (this._pluginsContext, pluginContext) => {}, ...],
   // Plugins having the same trigger value are run sequentially on plugins.run(trigger, data).
   // The initial accumulator is null. The new accumulator is returned by the plugin.
   // The value of the last accumulator is returned as the result of the plugins.
   run: [async (accumulator, data, pluginsContext, pluginContext) => {}, ...],
   // Teardown funcs for all plugins are run together on plugins.teardown(). Optional.
   teardown: [async (args, this._pluginsContext, pluginContext) => {}, ...],
 };

 this._pluginsContext = A shallow clone of the constructor param. The prop 'plugins' is added
   containing the new instantiated class, as this allows plugins to call other plugins with
   `pluginsContext.plugins.run(trigger, data)'. this._pluginsContext is shared by all the setup,
   run and teardown funcs of all plugins for communication.
 this.pluginContext = A new pluginContext is initialized at the start of setup, of run(triggerName)
   and of teardown. This is shared by the multiple setup funcs, the run(triggerName) funcs or
   teardown funcs, so they do not have to populate this._pluginsContext.
 */

const makeDebug = require('debug');
const {
  flatten1Level, isArray, isBoolean, isFunction, isNullsy, isObject, isString, throwError
} = require('@feathers-plus/commons');

const debug = makeDebug('plugin-scaffolding');

module.exports = class Plugins {
  constructor (pluginsContext) {
    this._registry = new Map();
    this._pluginsContext = Object.assign({}, pluginsContext);
    this._pluginsContext.plugins = this;
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

      if (!isNullsy(position) && !['before', 'clear', 'after'].includes(position)) {
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
          handlers = { setup: [plugin.setup], run: [plugin.run], teardown: [plugin.teardown] };
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
          await (setups[i](this._pluginsContext, pluginContext));
        }
      }
    }
  }

  has(trigger) {
    return this._registry.has(trigger);
  }

  async run (trigger, args) {
    if (!this._registry.has(trigger)) {
      throwError(`Plugins do not contain trigger ${trigger}. (plugins)`);
    }

    const pluginContext = {};
    const runs = this._registry.get(trigger).run;
    const length = runs.length;
    let accumulator = undefined; // Allows 'null' as a valid return value.

    if (length) {
      for (let i = 0; i < length; i++) {
        debug('plugin', trigger, i + 1, 'of', length, 'accumulator', accumulator);
        accumulator = await (runs[i](accumulator, args, this._pluginsContext, pluginContext));
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
          await (teardowns[i](this._pluginsContext, pluginContext));
        }
      }
    }
  }
};
