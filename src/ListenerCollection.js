'use strict';

window.MetisoftSolutions = window.MetisoftSolutions || {};
window.MetisoftSolutions.clientDataDaemonManager = window.MetisoftSolutions.clientDataDaemonManager || {};

(function() {

  /**
   * @class
   * @classdesc
   *    Manages a list of listeners that can be removed by ID.
   *
   * @public
   * @memberof module:metisoftClientDataDaemonManager
   */
  function ListenerCollection() {
    this.__listeners = {};
    this.__nextId = 0;
  }



  /**
   * @public
   * @param {Function} fnListener
   *
   * @returns {String}
   *    An ID that can be used with `ListenerCollection.removeListener()` later.
   */
  ListenerCollection.prototype.addListener = function addListener(fnListener) {
    var strId;

    this.__nextId++;
    strId = this.__nextId;

    this.__listeners[strId] = fnListener;
    return strId;
  };



  /**
   * @public
   *
   * @param {String} id
   *    An ID returned by `ListenerCollection.addListener()`.
   */
  ListenerCollection.prototype.removeListener = function removeListener(id) {
    delete this.__listeners[id];
  };



  /**
   * @public
   *
   * @returns {Function[]}
   *    A reference to the internal list of listener functions.
   */
  ListenerCollection.prototype.getListeners = function getListeners() {
    return this.__listeners;
  };



  window.MetisoftSolutions.clientDataDaemonManager.ListenerCollection = ListenerCollection;

})();