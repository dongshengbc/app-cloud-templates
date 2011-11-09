/**
* Brightcove Metrics provides functions to measure interactions with applications.
*/
bc.metrics = {};

( function( bc, undefined ) {

  var _settings = undefined,
      _transit = undefined,
      _poll_interval = undefined,
      _loader = undefined,
      _events = [],
      _liveEvents = [],
      _errors = 0;

  function Event(data) {
    this.getData = function() {
      return data;
    }
    
    this.isReady = function() {
      return true;
    }
    
    this.complete = function() {}
    
    this.error = function() {
      _events.push(this);
    }
  }
  
  function LiveEvent(data) {
    var last = new Date().getTime(),
        transit;

    this.getData = function() {
      transit = new Date().getTime();
      data.units = transit - last;
      return data;
    }
    
    this.isReady = function() {
      var d = new Date().getTime();
      var ready = transit === undefined &&      // only one at a time
        ( _settings.interval > 0 &&   // only if it hasn't been tracked recently
          d - last > _settings.interval )
      return ready;
    }
    
    this.complete = function() {
      last = transit
      transit = undefined
    }
    
    this.error = function() {
      transit = undefined
    }
  }
  
  function getEventData( event, eventData ) {
    return $.extend({
      event: event, 
      time:( new Date() ).getTime()
    }, eventData );
  }

  function flush( force ) {
    if( bc.metrics.isInitialized() ) {
      if( force || _settings.interval <= 0 ) {
        send();
      } else if( _poll_interval === undefined ) {
        _poll_interval = setInterval( function() {
          send();
        }, _settings.interval );
      }
    }
  }
  
  function send() {
    var url, data;
    if( !bc.metrics.isInitialized() || _transit !== undefined ){
      // not ready, event already in _transit or nothing to send
      return;
    }
    while( !_transit ) {
      if( _events.length != 0 ) {
        _transit = _events.shift();
      } else {
        for( var i=0, len=_liveEvents.length; i < len; i++ ) {
          if( _liveEvents[i].isReady() ) {
            _transit = _liveEvents[i];
            break;
          }
        }
        if( !_transit ) {
          return;
        }
      }
    }
    
    data = $.extend( _transit.getData(), _settings.data );
    url = _settings["uri"] + "?" + $.param( data );
    _loader.attr( "src",url );
  }

  function bind_loader() {
    _loader.bind( "load", function() {
      _errors = 0;
      _transit.complete();
      _transit = undefined;
      send();
    });
    
    _loader.bind( "error", function() {
      console.log( "ERROR: unable to send metrics to", _settings.uri );
      setTimeout( function(){
        if( _transit !== undefined ) {
          _transit.error();
          _transit=undefined;
        }
        send();
      }, _settings.interval * Math.log( ++_errors ) );
    });
  }
  
  /*
   * Initialize and bind the metrics runtime
   * 
   * @param options - an object containing the metrics options
   *    - uri - the url used to send metric events
   *    - interval - the millisecond interval between event polling 
   *        (zero or negative will cause all tracking events to fire immediately, 
   *        but will also mean that live tracking must be explicitly dispatched )
   * @param data - session wide metadata that will be included with each event
   */
  bc.metrics.init = function( options, data ) {
    $( function(){
      _settings = $.extend({}, bc.metrics.defaults, options );
      _settings.data = data || {};
      _settings.data.domain = _settings.domain;
      _settings.uri = ( _settings.uri.indexOf( "tracker" ) > -1 ) ? _settings.uri : _settings.uri + "/tracker";
      if( _settings.pendingMetrics ) {
        for( var i = 0, len = _settings.pendingMetrics.length; i < len; i++ ) {
          _events.push( new Event( _settings.pendingMetrics[i] ) )
        }
      }
      _loader = _settings.loader || $( "<img />" ).appendTo( $( "head" ) );
      bind_loader();
      flush();
    });
  }
  
  /*
   * Unloads the metrics context and returns any undelivered events
   */
  bc.metrics.unload = function() {
    var result = [];
    console.log("unload", _transit, _events, _liveEvents)
    _settings = undefined;

    if( _transit !== undefined ) {
      _transit.error();
      _transit = undefined;
    }

    if( _poll_interval !== undefined ){
      clearInterval( _poll_interval );
      _poll_interval = undefined;
    }

    for( var i = 0, len = _events.length; i < len; i++ ) {
      result.push( _events[i].getData() );
    }
    _events = [];

    for( var i = 0, len = _liveEvents.length; i < len; i++ ) {
      result.push( _liveEvents[i].getData() );
    }
    _liveEvents = [];

    if( _loader !== undefined ) {
      _loader.unbind();
      _loader = undefined;
    }

    return result;
  }

  /*
   * Send a tacking event
   *
   * @param event - the name of the event
   * @param properties - metadata specific to this event
   */
  bc.metrics.track = function( event, properties ) {
    _events.push( new Event( getEventData( event, properties ) ) );
    flush();
  }

  /*
   * Create a live tracking event which sends time delta information for each poll interval.
   *
   * @param event - the name of the event
   * @param properties - metadata specific to this event
   * @returnValue - a closure which can be used to cancel the tracking and flush the last time delta
   */
  bc.metrics.live = function( event, properties ) {
    var liveEvent = new LiveEvent( getEventData( event + "_usage", properties ) )

    bc.metrics.track( event + "_view" , properties);
    _liveEvents.push(liveEvent);
    
    liveEvent.die = function(){
      for( var i = 0, len = _liveEvents.length; i < len; i++ ) {
        if( _liveEvents[i] == liveEvent ) {
          _events.push( new Event( liveEvent.getData() ) );
          _liveEvents.splice( i, 1 );
          flush();
          return;
        }
      }
    }
    
    flush();
    return function() { liveEvent.die() }; 
  }
  
  bc.metrics.isInitialized = function() {
    return _settings !== undefined;
  }
  
  bc.metrics.defaults =  {
    uri:"http://localhost:44080/tracker", // the url of the event tracking service
    interval:5000 // the default poll interval
  };

})( bc );
