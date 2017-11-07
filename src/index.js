'use strict';

window.MetisoftSolutions = window.MetisoftSolutions || {};
window.MetisoftSolutions.clientDataDaemonManager = window.MetisoftSolutions.clientDataDaemonManager || {};



(function() {

  /** @module metisoftClientDataDaemonManager */



  /**
   * Interface for setting an interval, which calls the given function `fn` every
   * `delayMs` milliseconds. `window.setInterval()` and AngularJS' `$interval()`
   * each satisify this contract.
   *
   * @callback startInterval
   *
   * @param {Function} fn
   *
   * @param {Number} delayMs
   *    The delay, in milliseconds.
   *
   * @returns {Any}
   *    The return value must be able to be passed into `stopInterval()`.
   */

  /**
   * @callback stopInterval
   *
   * @param {Any} targetInterval
   */

  /**
   * @callback subscribeToEvent
   *
   * @param {String} eventName
   * @param {Function} handler
   *
   * @returns {Function}
   *    A function that will unsubscribe from the event when called.
   */

  /**
   * @class
   * @classdesc
   *    Manages a set of data retrieval daemons.
   *
   * @public
   * @memberof module:metisoftClientDataDaemonManager
   *
   * @oaram {module:metisoftClientDataDaemonManager~startInterval} fnStartInterval
   * @oaram {module:metisoftClientDataDaemonManager~stopInterval} fnStopInterval
   * @param {module:metisoftClientDataDaemonManager~subscribeToEvent} fnSubscribeToEvent
   */
  function DataDaemonManager(fnStartInterval, fnStopInterval, fnSubscribeToEvent) {
    this.__daemonConfigs = {};
    this.__fnStartInterval = fnStartInterval;
    this.__fnStopInterval = fnStopInterval;
    this.__fnSubscribeToEvent = fnSubscribeToEvent;
  }



  /**
   * @typedef DaemonConfig
   * @type Object
   * 
   * @property {String} name
   *    Must be unique among all daemons under management.
   *
   * @property {String} type
   *    `'timer'` for a timer-based daemon.
   *    `'event'` for an event-based daemon.
   *
   * @property {String} status
   *    User-defined. Allows for state-based daemons.
   *
   * @property {ListenerCollection} listeners
   *
   * @property {Function} fnGetData
   *    (For timer-based daemons.) Calls the web service. Data returned will be
   *    broadcast to `listeners`.
   *
   * @property {Function} fnGetArgs
   *    (For timer-based daemons.) Optional. Retrieves the arguments object to
   *    pass in to when calling `fnGetData`. Can be left unspecified if no arguments
   *    are necessary.
   *
   * @property {Object} intervalsMs
   *    (For timer-based daemons.) Keys are possible values of `status`. Values
   *    are for how long, in milliseconds, the daemon's interval should be for
   *    the given status.
   *
   * @property {Object.<String, module:metisoftClientDataDaemonManager~EventHandlerConfig>} eventTriggers
   *    (For event-based daemons.) Keys are event names.
   */

  /**
   * @typedef EventHandlerConfig
   * @type Object
   *
   * @property {Function} fnGetData
   *    Function to retrieve data from the server.
   *
   * @property {Function?} fnGetArgs
   *    Function to retrieve an arguments object to pass into `fnGetData`,
   *    if arguments are necessary.
   *
   * @property {Number?} throttleTimeMs
   *    The minimum number of milliseconds between calls to `fnGetData`.
   */

  /**
   * Adds a daemon to be managed. This will not start the daemon.
   *
   * @public
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.addDaemon = function addDaemon(config) {
    var configCopy = _.cloneDeep(config);

    if (configCopy.fnGetData) {
      configCopy.fnGetData = this.__makeDataHandler(configCopy.fnGetData);
    }

    if (configCopy.eventTriggers) {
      this.__setUpEventTriggers(configCopy);
    }

    this.__daemonConfigs[config.name] = _.cloneDeep(configCopy);
  };



  /**
   * If `config` provides `eventTriggers`, this function goes through each handler function
   * and adds layers to it to:
   *   1. Store and broadcast returned data.
   *   2. Add a throttler, if specified.
   *
   * @private
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.__setUpEventTriggers = function __setUpEventTriggers(config) {
    var self = this;

    _.forEach(config.eventTriggers, function(eventHandlerConfig, eventName) {
      var throttleTimeMs = eventHandlerConfig.throttleTimeMs,
          fnGetDataHandler = self.__makeDataHandler(eventHandlerConfig.fnGetData);
      
      if (_.isNumber(throttleTimeMs) && throttleTimeMs > 0) {
        eventHandlerConfig.__lastUpdateTimestamp = null;
        eventHandlerConfig.fnGetData = (function(config, event, args) {

            var now = new Date();

            // use of 'this' rather than 'self' is intentional here, because we want to refer
            // to the `eventHandlerConfig` object and not the `DataDaemonManager` instance
            if (this.__lastUpdateTimestamp === null ||
                now.getTime() - this.__lastUpdateTimestamp.getTime() > this.throttleTimeMs) {
              this.__lastUpdateTimestamp = new Date();
              return fnGetDataHandler(config, args);
            }

          }).bind(eventHandlerConfig);
      
      } else {
        eventHandlerConfig.fnGetData = fnGetDataHandler; 
      }
    });
  };



  /**
   * Stops the given daemon and removes it from management.
   *
   * @public
   * @param {String} daemonName
   *
   * @throws {Error} If the named daemon doesn't exist.
   */
  DataDaemonManager.prototype.removeDaemon = function removeDaemon(daemonName) {
    var daemonConfig = this.__getDaemonConfig(daemonName);

    this.stopDaemon(daemonConfig);
    delete this.__daemonConfigs[daemonName];
  }



  /**
   * @private
   * @param {String} daemonName
   * @returns {module:metisoftClientDataDaemonManager~DaemonConfig}
   *
   * @throws {Error} If the named daemon doesn't exist.
   */
  DataDaemonManager.prototype.__getDaemonConfig = function __getDaemonConfig(daemonName) {
    var daemonConfig = this.__daemonConfigs[daemonName];

    if (!daemonConfig) {
      throw new Error("No such daemon " + daemonName + ".");
    }

    return daemonConfig;
  };



  /**
   * @public
   * @param {String} daemonName
   * @param {String} newStatus
   *
   * @throws {Error} If the named service doesn't exist.
   */
  DataDaemonManager.prototype.changeStatus = function changeStatus(daemonName, newStatus) {
    var daemonConfig = this.__getDaemonConfig(daemonName);

    this.stopDaemon(daemonConfig);
    daemonConfig.status = newStatus;
    this.startDaemon(daemonConfig);
  };



  /**
   * @public
   * @param {String} daemonName
   * @param {Function} fnListener
   *
   * @returns {String}
   *    An ID that can be used to remove the listener later.
   *
   * @throws {Error} If the named service doesn't exist.
   */
  DataDaemonManager.prototype.addListener = function addListener(daemonName, fnListener) {
    var daemonConfig = this.__getDaemonConfig(daemonName);

    return daemonConfig.listeners.addListener(fnListener);
  };



  /**
   * @public
   * @param {String} daemonName
   * @param {String} listenerId
   *
   * @throws If the named service doesn't exist.
   */
  DataDaemonManager.prototype.removeListener = function removeListener(daemonName, listenerId) {
    var daemonConfig = this.__getDaemonConfig(daemonName);

    daemonConfig.listeners.removeListener(listenerId);
  };



  /**
   * Returns a copy of whatever data was last received from the web service.
   * Calling this function will not initiate a new call to the web service.
   *
   * @public
   * @param {String} daemonName
   * @returns {Any}
   *
   * @throws {Error} If the named service doesn't exist.
   */
  DataDaemonManager.prototype.getData = function getData(daemonName) {
    var daemonConfig = this.__getDaemonConfig(daemonName);

    return _.cloneDeep(daemonConfig.__data);
  };



  /**
   * Unlike `getData()`, this function will hit the web service for a fresh
   * piece of data before returning.
   *
   * @public
   * @param {String} daemonName
   * @returns {Promise<Any>}
   *
   * @throws {Error} If the named service doesn't exist.
   */
  DataDaemonManager.prototype.forceGetData = function forceGetData(daemonName) {
    var daemonConfig = this.__getDaemonConfig(daemonName),
        args;

    if (daemonConfig.fnGetArgs && _.isFunction(daemonConfig.fnGetArgs)) {
      args = daemonConfig.fnGetArgs();
    }

    return daemonConfig.fnGetData(daemonConfig, args);
  };



  /**
   * @public
   */
  DataDaemonManager.prototype.startAllDaemons = function startAllDaemons() {
    var self = this;

    _.forEach(self.__daemonConfigs, function(config) {
      self.startDaemon(config);
    });
  };



  /**
   * @public
   */
  DataDaemonManager.prototype.stopAllDaemons = function stopAllDaemons() {
    var self = this;

    _.forEach(self.__daemonConfigs, function(config) {
      self.stopDaemon(config);
    });
  };



  /** 
   * @public
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   * @returns {module:metisoftClientDataDaemonManager~DaemonConfig?}
   */
  DataDaemonManager.prototype.startDaemon = function startDaemon(config) {
    if (config.type === 'timer') {
      return this.__startTimerDaemon(config);
    } else if (config.type == 'event') {
      return this.__startEventDaemon(config);
    }
  };



  /**
   * @public
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.stopDaemon = function stopDaemon(config) {
    if (config.type === 'timer') {
      return this.__stopTimerDaemon(config);
    } else if (config.type === 'event') {
      return this.__stopEventDaemon(config);
    }
  };



  /**
   * @private
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   *
   * @returns {module:metisoftClientDataDaemonManager~DaemonConfig}
   *    A reference to `config`.
   *
   * @throws {Error} If no interval is set for the daemon.
   */
  DataDaemonManager.prototype.__startTimerDaemon = function __startTimerDaemon(config) {
    this.__stopTimerDaemon(config);
    
    if (!config.intervalsMs[config.status]) {
      throw new Error("No interval set for " + config.name);
    }

    config.__daemon = this.__fnStartInterval(function() {
        var args;

        if (config.fnGetArgs && _.isFunction(config.fnGetArgs)) {
          args = config.fnGetArgs();
        }

        config.fnGetData(config, args);
      }, config.intervalsMs[config.status]);

    return config;
  };



  /**
   * @private
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.__stopTimerDaemon = function __stopTimerDaemon(config) {
    if (!!config.__daemon) {
      this.__fnStopInterval(config.__daemon);
      config.__daemon = null;
    }
  };



  /**
   * @private
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.__startEventDaemon = function __startEventDaemon(config) {
    var self = this;

    config.__deregistrationFunctions = config.__deregistrationFunctions || [];

    _.forEach(config.eventTriggers, function(eventHandlerConfig, eventName) {
      config.__deregistrationFunctions.push(
        self.__fnSubscribeToEvent(eventName, _.partial(eventHandlerConfig.fnGetData, config))
      );
    });
  };



  /**
   * @private
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   */
  DataDaemonManager.prototype.__stopEventDaemon = function __stopEventDaemon(config) {
    _.forEach(config.__deregistrationFunctions, function(fnDeregister) {
      fnDeregister();
    });

    config.__deregistrationFunctions = [];
  };



  /**
   * @private
   * @param {Function[]} listeners
   * @param {Any} data
   */
  DataDaemonManager.prototype.__broadcastData = function __broadcastData(listeners, data) {
    _.forEach(listeners, function(fnListener) {
      var clonedData = _.cloneDeep(data);
      fnListener(clonedData);
    });
  };



  /**
   * @callback __dataHandler
   * @param {module:metisoftClientDataDaemonManager~DaemonConfig} config
   *
   * @param {Object} args
   *    Arguments to pass to the service endpoint.
   *
   * @returns {Promise<Any>}
   *    The data returned from the service call.
   */

  /**
   * This function creates as function that will call `fnGetData` and act on its returned
   * `Promise`. With the data returned, it will cache the data, broadcast it to all listeners,
   * and return it.
   *
   * @private
   * @param {Function} fnGetData
   * @returns {module:metisoftClientDataDaemonManager~__dataHandler}
   */
  DataDaemonManager.prototype.__makeDataHandler = function __makeDataHandler(fnGetData) {
    var self = this;

    return function __dataHandler(config, args) {
      return fnGetData(args)

        .then(function(dbData) {
          config.__data = dbData;
          self.__broadcastData(config.listeners.getListeners(), config.__data);
          return config.__data;
        });
    };
  };



  window.MetisoftSolutions.clientDataDaemonManager.DataDaemonManager = DataDaemonManager;

})();