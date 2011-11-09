  /*global bc:true atob:false*/
/*jshint indent:2, browser: true, white: false devel:true undef:false*/


/**
 * bc is the namespace for all of the functions, properties and events available through the Brightcove App Cloud SDK.
 * @namespace
 */
var bc = {};

/**
 * Brightcove core is responsible for communicating with the Brightcove App Cloud server, storing the responses from the server
 * and messaging the appropriate events.
 * @namespace
 * @requires jquery-1.5.min.js
 * @requires brightcove.mobile.utils.js  
 */
bc.core = {};

/**
 * Import required 3rd party libraries and namespace so as not to conflict with other versions
 */
bc.lib = {};

// namespace our version of jQuery and reset the global vars of $,jQuery back to what they were
( function() {
  bc.lib.jQuery = jQuery.noConflict(true);    
  if ( jQuery === undefined ) {
    jQuery = bc.lib.jQuery;
    $ = jQuery;    
  }
})();

( function( $, undefined ) {
  //tracks whether or not we have set ads yet.
  var _adsSet;
  
  /** The URL of the server that will supply the data.  This is the Brightcove URL */
  bc.SERVER_URL = ( "http://read.appcloud.brightcove.com".indexOf( "%" ) > -1 ) ? "http://read.appcloud.brightcove.com" : "http://read.appcloud.brightcove.com";
  
  /** The URL of the server we will send metrics to. */
  bc.METRICS_SERVER_URL = ( "%METRICS_SERVER_URL%".indexOf( "%" ) > -1 ) ? "http://192.168.242.60" : "%METRICS_SERVER_URL%";
  
  /** The ID of the current application.  This is a unique ID that was assigned at time of application creation inside the Brightcove App Cloud Studio. */
  bc.appID = null;
  
  /** The ID of the current view.  This is a unique ID that was assigned at time of application creation inside the Brightcove App Cloud Studio. */
  bc.viewID = null;
  
  /** @private The SQLite database that we use to track our localStorage usage.  See bc.core.cache and pruneCache to see how this is used. */
  bc.db = null;
  
    /**
   * Context object that exposes information related to the current state of the application.  The following properties exist
   * on the context object:
   * <ul>
   *   <li>viewOrientation: A string that will match either 'portrait' or 'landscape'.  Represents the orientation of the view on the phone.  NOTE:
   *       this is different from device orientation.  For example, the phone might actually be held in landscape mode but the view does not autorotate,
   *       in which case the view would still be in 'portrait' mode.</li>
   *   <li>os: A string that will match either "ios" or "android". </li>
   *   <li>isNative: A boolean value indicating whether or not we are running inside a native container on a device.</li>
   * </ul>
   * @namespace
   */
  bc.context = {}; 

  /** 
   * The different types of mode our application can be running in.
   * @namespace
   */
  bc.core.mode = {};

  /** An application is in development mode if it has not been ingested into the Brightcove App Cloud Studio. */
  bc.core.mode.DEVELOPMENT = "development";
  /** An application is in production mode once it has been ingested and published by the Brightcove App Cloud Studio. */
  bc.core.mode.PRODUCTION = "production";
  /** An application is in preview mode if it is either being previewed inside the Brightcove App Cloud Studio or inside the Brightcove extension toolkit.*/
  bc.core.mode.PREVIEW = "preview";
  /** The current mode that our application is running in. */
  bc.core.current_mode = bc.core.mode.DEVELOPMENT;
  
  /**
   * Depending on whether or not two values are passed into the cache function, it will either read values from or write 
   * values to the localStorage.  Note that there is a limit of 5MB that can be stored in this cache 
   * at any given time.  If this cache fills up then we will remove half the items from the cache.  We use a 
   * LRU (least recently used) cache algorithm to select what should be removed.
   *
   * @param key The key for where the value is stored.
   * @param value The value that should be stored in the localStorage.
   * @return If only a key is passed in then the value is returned or null if no value is found.
   * @example 
   //Note that the cache is persisted across startups.
   bc.core.cache( "whales" ); //returns null because it has never been set.  
   bc.core.cache( "whales", "a pod of whales" );
   bc.core.cache( "whales" ); //returns "a pod of whales"
   */
  bc.core.cache = function( key, value ) {
    var ret,
        parsedValue;
    try {
      if( value ){
        try {
          value = JSON.stringify( value );
          window.localStorage.setItem( key, value );
          updateDB( key );
        } catch( e ) {
          bc.utils.warn( "ERROR: we are assuming that our local storage is full and will now remove half of the existing cache:" + e.toString() );
          pruneCache();
        }        
      } else {
        ret = JSON.parse( window.localStorage.getItem( key ) );
        if( ret !== null ) {
          try {
            updateDB( key );
          } catch ( e ) {
            bc.utils.warn( 'ERROR: we were unable to updated the DB with this cache hit' );
          }
        }
        return ret;
      }
    } catch( e ) {
      bc.utils.warn( "Error storing and/or receiving values in local storage: " + e.toString() );
      return null;
    } 
  };

  /**
   * Fetches the data for this contentFeed.  This can take in a contentFeed ID or the name of a feed defined in the manifest.json file for this view.
   *
   * @param contentFeed The ID of the contentFeed or the name of the feed if configurations are defined in the manifest.json file.  The contentFeed ID can be found in the content section of the App Cloud studio.
   * @param successCallback The function to call once the data has been retrieved.
   * @param errorCallback The function to call if there is an error retrieving data.
   * @param options An object defining the options for this request.  Possible values are:
        <ul>
          <li> parameterizedFeedValues: The query params to pass to the contentFeed as parameters.  See contentFeeds for how parameterized feeds work.  Defaults to "".<li>
          <li> requestTimeout:  Number milliseconds before the request is timedout and the error callback is called.  By default it is 30000 ms.
        </ul>
   * @example 

    bc.core.getData( "xxxxxxxxxx", 
      successHandler, 
      errorHandler, 
      { "parameterizedFeedValues": 
        { "loc": "01950" } 
      }
    );
    
    function successHandler( data ) {
      //Do something with the data.
    }
    
    function errorHandler() {
      //Handle the error gracefully.
    }
   */
  bc.core.getData = function( contentFeed, successCallback, errorCallback, options ) {
    var data,
        url,
        settings,
        defaults = { 
          "parameterizedFeedValues": "",
          "requestTimeout": 30000
        };
    settings = $.extend( {}, defaults, options );
    $.ajax( 
      { 
        url: getContentFeedURL( contentFeed ),
        timeout: settings.requestTimeout,
        dataType: "jsonp",
        data: ( options && options.parameterizedFeedValues ) ? { "query_params": options.parameterizedFeedValues } : "",
        success: success,
        error: error
      }
    );
    
    function success( results ) {
      if( results.status !== undefined ) {
        
        if( results.status === "ok" && results.data !== undefined ) {
          successCallback && successCallback( results.data );
        } else {
          errorCallback && errorCallback();
        }
        
      } else {
        //The /content/{id}/fetch does not return a status.
        successCallback && successCallback( results );
      }
    }

    function error() {
      console.warn( "There was an error fetching content for contentFeed: " + contentFeed );
      errorCallback && errorCallback();
    }
  };

  /**
   * Gets a configuration from the configurations defined in the manifest.js file.  All of the configurations for this view are 
   * available on the bc.configurations property.  Additionally, the entire manifest.js is available at the global variable of manifest.
   * @param options An object that specifies the configuration type to get and the property to find.  Possible values are:
     <ul>
      <li> type: The configuration type, which can be a data, style or setting. </li>
      <li> name: The name of the value to get for the configuration.</li>
    </ul>
    @return The corresponding value for the key inside the type that was passed in or null if no value was found.
    @private
   */
  bc.core.getManifestConfiguration = function( options ) {
    var data;
    if( bc.configurations && options !== undefined && bc.configurations[options.type] !== undefined ) {
      data = bc.configurations[options.type];

      for( var i = 0, len = data.length; i < len; i++ ) {
        if( data[i].name === options.name ) {
          return ( data[i].value !== undefined ? data[i].value : getFeedValue( data[i] ) );
        }
      }
    }
    return null;
    
    function getFeedValue( obj ) {
      return ( obj.contentFeed ) ? obj.contentFeed : obj.contentConnector;
    }
  };

  /**
   * Retrieves the styles from the cache for the current view.
   * 
   * @return It is expected that most developers will call applyStyles which both gets the styles and also renders them to the page.
   * This function will return an object that contains the styles for this particular view or an empty object if no styles are found.
   * @example 
   // Styles is an object.
   var styles = bc.core.getStyles();
   */
  bc.core.getStyles = function() {
    var styles = bc.core.cache( bc.viewID + "_styles" );
    
    if( styles === null && bc.configurations && bc.configurations.styles !== undefined ) {
      styles = bc.configurations.styles;
    }
    
    return ( styles === null ) ? {} : styles;
  };
  
  /**
   * Applies the styles that are set in the Brightcove App Cloud studio to the elements.
   *
   * @param styles A JSON object that are the styles for this view.  This object is passed as a data
   * parameter to the bc:newconfiguration event fired on the bc object.
   *
   @example 
   $( bc ).bind( "bc:newconfiguration", function( evt, data ) {
     bc.applyStyles( data.styles ); //The new styles, such as background colors are now applied.
   });
   */
  bc.core.applyStyles = function( styles ) {
    var $styleElement,
        cssString = "";
        
    styles = styles || bc.core.getStyles();

    for( var i = 0, len = styles.length; i < len; i++ ) {
      //We are setting the !important tag in order to override any specificity issues since we know this is the style we want.
      cssString += "." + styles[i].name + " { " + styles[i].attribute + ":" + styles[i].value + " !important; } \n";
    }

    //Remove any existing stylesheets we have injected
    $( ".injected-style" ).remove();

    $styleElement = $( "<style>" ).attr( "type", "text/css" )
                                  .addClass("injected-style" )
                                  .html( cssString )
                                  .appendTo( "head" );      
  };
  
  /**
   * Retrieves a specific style.  First looks to the cache to get the value, then the manifest and if not found in either of
   * places will return an empty object.
   *
   *@param nameOfStyle The name of the style to retrieved.  (name should correspond to the name in the manifest file.)
   *@return An object that has the css class name and the value.
   *@example
   var backgroundStyle = bc.core.getStyle( "background-page-color" ); //background-page-color is the name of the style defined in the manifest file.
   alert( backgroundStyle.cssClass ); //alerts "background-color"
   alert( backgroundStyle.value ); //alerts the value set by the server, for example "#FF00000" 
   */
  bc.core.getStyle = function( nameOfStyle) {
    return findValueInObject( bc.core.getStyles(), nameOfStyle );
  };

  /**
   * Retrieves the settings from the cache for the current view.
   * 
   * @return An object that contains the settings for this particular view or an empty object if no settings are found.
   * @example 
   // Settings is an object.
   var setting = bc.core.getSettings();
   if( bc.core.getSetting( "numberOfColumns" ) > 2 ) {
     //render grid layout.
   }
   */
  bc.core.getSettings = function() {
    var settings = bc.core.cache( bc.viewID + "_settings" );
    
    if( settings === null && bc.configurations && bc.configurations.settings ) {
      settings = bc.configurations.settings;
    }
    
    return ( settings === null ) ? {} : settings;
  };
  
  /**
   * bc.core.getSetting is a helper function to get the value of a particular setting.  The reason this is
   * helpful is that the settings for a view are stored as an Array.
   * @param nameOfSetting The name of the setting you would like the value for.  This should correspond to the name provided in
   * the manifest.json file.
   * @example
   var title = bc.core.getSetting( "titlOfPage" );
   alert( "The title of the page that was defined in the manifest.json and set in the studio: " + title );
   */
  bc.core.getSetting = function( nameOfSetting ) {
    return findValueInObject( bc.core.getSettings(), nameOfSetting ).value;
  };
  
  /**
   * <b>Deprecated: use getData</b>fetchContentFeed makes a request to the app cloud studio to get the data for a given content feed.
   * @param id The ID of the content feed that was setup in the app cloud studio.
   * @param successCallback The function to be called once the data has been retrieved.  This callback will be passed a data object containing the results of the request.
   * @param errorCallback The function to be called if an error occurs retrieving the data.  (Timeout is set to 30 seconds.)
   * @param options If the content feed has dynamic values they can be passed in via the options object.  
   */
  bc.core.fetchContentFeed = function( id, successCallback, errorCallback, options ) {
    var url = bc.SERVER_URL + "/content/" + id + "/fetch";
  
    $.ajax( { url: url,
              timeout: 30000,
              dataType: "jsonp",
              data: ( options ) ? { "query_params": options } : ""
            }
          ).success( successCallback )
           .error( errorCallback );
  }; 
  
  /** @private */
  bc.core.refreshConfigurationsForView = function() {
    var url = bc.SERVER_URL + "/apps/" + bc.appID + "/views/" + bc.viewID + "/configurations.json";
    
    $.ajax( 
      { 
        url: url,
        dataType: "jsonp"
      }
    ).success( bc.core.configurationsForViewSuccessHandler );
  };
  
  /**
   * @private
   */
  bc.core.configurationsForViewSuccessHandler = function( data ) {
    var newSettings,
        newStyles,
        newConfigurations;
    
    newSettings = storeSettings( data.settings );
    newStyles = storeStyles( data.styles );
    
    if( newSettings || newStyles ) {
      newConfigurations = {
        "settings": {
          "isNew": newSettings,
          "values": data.settings
        },
        "styles": {
          "isNew": newStyles,
          "values": data.styles
        }
      };

      $( bc ).trigger( "newconfigurations", newConfigurations );
      
      //If we are in preview mode then we want to refresh the page.
      if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
        bc.core.forceUpdate( newConfigurations );
      }
    }
    storeAdConfigurations( data.ads );
  };
  
  /**
   * @private
   */
  bc.core.forceUpdate = function( configs ) {
    if( configs.styles.isNew && !configs.settings.isNew ) {
      bc.core.applyStyles();
    } else {
      window.location.reload();
    }
  };
  
  /**
   * Checks to see whether or not we are in preview mode. (In the App Cloud Studio).
   *
   * @private
   * @return A boolean indicating whether or not we are in preview mode.    
   */
  bc.core.isPreview = function() {
    return ( window.location !== window.parent.location ) ? true : false;
  };

  /***************************************************************************************
   * Private helper functions
   ***************************************************************************************/
  
  function findValueInObject( object, name ) {
    if( $.isPlainObject( object ) ) {
      return object;
    }
    
    for( var i = 0, len = object.length; i < len; i++ ) {
      if( object[i].name === name ) {
        return object[i];
      }
    }
    return {};
  }
  
  /* Calculates the URL to be used to make the request to the appcloud server.*/
  function getContentFeedURL( contentFeed ) {
    var url,
       feedValueFromManifest = bc.core.getManifestConfiguration( { "type": "data", "name": contentFeed } );

    if( bc.core.current_mode === bc.core.mode.DEVELOPMENT ) {
     contentFeed = ( feedValueFromManifest === null ) ? contentFeed : feedValueFromManifest;
     url = bc.SERVER_URL + "/content/" + contentFeed + "/fetch";
    } else {
     if( feedValueFromManifest === null ) {
       url = bc.SERVER_URL + "/content/" + contentFeed + "/fetch";
     } else {
       url = bc.SERVER_URL + "/apps/" + bc.appID + "/views/" + bc.viewID + "/data.json?content_feed_name=" + contentFeed;
     }
    }

    return url;
  }

  function storeSettings( settings ) {
    //TODO - If the order isn't consistent this will return true.
    if( JSON.stringify( settings ) !== JSON.stringify( bc.core.cache( bc.viewID + "_settings" ) ) ) {
      bc.core.cache( bc.viewID + "_settings", settings );
      return true;
    }
    return false;
  }

  function storeStyles( styles ) {
    //TODO -f this order isn't consistent this will return true.
    if( JSON.stringify( styles ) !== JSON.stringify( bc.core.cache( bc.viewID + "_styles" ) ) ){
      bc.core.cache( bc.viewID + "_styles", styles );
      return true;
    }
    return false;
  }

  function storeAdConfigurations( adConfigsFromServer ) {
    var adConfigs,
        defaults = {
          "ad_code": undefined,
          "ad_position": "none",
          "ad_network": "admob"
        };
    
    adConfigs = $.extend( {}, defaults, adConfigsFromServer );
    
    adConfigs.should_show_ad = ( adConfigs.ad_code && adConfigs.ad_position !== "none" );
    
    bc.core.cache( bc.viewID + "_ad_settings", adConfigs );
    setAdPolicy( adConfigs );
  }

  function setGlobalIDValues() {
    bc.viewID = $( "body" ).data( "bc-view-id" ) || location.href;
    bc.appID = $( "body" ).data( "bc-app-id" );
    bc.accountID = $( "body" ).data( "bc-account-id" );
    
    if( bc.appID !== undefined) {
      if( bc.core.isPreview() ) {
        bc.core.current_mode = bc.core.mode.PREVIEW;
      } else {
        bc.core.current_mode = bc.core.mode.PRODUCTION;
      }
    }
    bcAppDB();
  }

  function bcAppDB() {
    if( typeof( window.openDatabase ) !== "function") {
      return null;
    }
    
    try {
      bc.db = window.openDatabase(bc.appID, "1.0", "BC_" + bc.appID, 1024*1024);  
      createTables();
    } catch(e) {
      bc.utils.warn("THERE WAS AN ERROR OPENING THE DB");
      bc.db = null;
    }
  }
  
  function createTables() {
    if( !bc.db ) {
      return;
    }
      
    bc.db.transaction(  
      function (transaction) {  
        transaction.executeSql( "CREATE TABLE IF NOT EXISTS components(id INTEGER NOT NULL PRIMARY KEY, component_id TEXT NOT NULL, modified TIMESTAMP NOT NULL);" );         
      }  
    );  
  }
  
  function pruneCache() {
    if( bc.db !== null ) {
      var ids_to_remove = "";
      bc.db.transaction(  
        function (transaction) {  
          transaction.executeSql( "SELECT component_id from components ORDER BY modified;", [], function( tx, results ) {
            //TODO - do we want a more robust decision maker for, perhaps sorting by payload?
            for ( var i = 0, len = results.rows.length; i < len/2; i++ ) {
              var item = results.rows.item( i ).component_id;
              window.localStorage.removeItem( item );
              ids_to_remove += "component_id = '" + item + "' OR ";
            }
            
            //Once we have cleaned up the local storage we should now clean up the DB.
            ids_to_remove = ids_to_remove.substring( 0, ( ids_to_remove.length - 4 ) );
            bc.db.transaction(
              function (transaction) { 
                transaction.executeSql( "DELETE FROM components WHERE " + ids_to_remove + ";", [] );          
              }
            );
          });         
        }  
      );
    }else {
      //If there is no DB then we do not have a more intelligent way to prune other then to remove 
      window.localStorage.clear();
    }
  }
  
  function updateDB(component_id) {
    if(bc.db === null) {
      return;
    }
    
    bc.db.transaction(  
      function (transaction) {
        transaction.executeSql( "SELECT component_id FROM components WHERE component_id ='" + component_id +"';", [], function( tx, results ) {
          if(results.rows.length === 0) {
            bc.db.transaction(  
              function ( transaction ) {  
                transaction.executeSql( "INSERT INTO components (component_id, modified) VALUES ('" + component_id + "', '" + Date() + "');" );         
              }  
            );
          } else {
            bc.db.transaction(
              function ( transaction ) { 
                transaction.executeSql( "UPDATE components SET modified = '" + Date() + "' WHERE component_id ='" + component_id + "';" );          
              }
            );
            
          }
        });                  
      }  
    );
  }
  
  function setAdPolicy( adConfigs ) {
    adConfigs = adConfigs || bc.core.cache( bc.viewID + "_ad_settings");
    //If we have already set an ad policy we do not want to do again.
    if ( _adsSet !== undefined ) {
      return;
    }
      
    if( adConfigs && bc.device !== undefined && bc.device.setAdPolicy !== undefined ) {
      bc.device.setAdPolicy( adConfigs );
      _adsSet = true;
    }
  }

/**
 * Public Events
 */
/**
 * The vieworientationchange event is fired anytime that the view itself rotates on the device.  The
 * event will contain three properties: orientation, width, and height. The orientation corresponds to [ landscape | portrait ]
 * and the width and height are the dimensions of the view in the new orientation.  This event is fired on the bc
 * object.
 *
 * @example
 * $( bc ).bind( "vieworientationchange", function( evt, rslt ) {
 *   alert("I'm " + rslt.orientation); 
 * });
 *
 * @name vieworientationchange
 * @event
 * @memberOf bc
 * @param event (type of vieworientationchange)
 * @param result object contains three properties; orientation, width, and height.  The
 * orientation will be the new orientation of the view ['portrait' | 'landscape'].  The width and
 * height will be the width and height of the view (window) in pixels.
 */
  $( window ).bind( "resize", function( evt, result ) {
    var newWidth = window.innerWidth,
        newHeight = window.innerHeight,
        orientation = ( newWidth > newHeight ) ? "landscape" : "portrait";

    if ( orientation !== bc.context.viewOrientation ) {
      bc.context.viewOrientation = orientation;
      $( bc ).trigger( "vieworientationchange", {
        "orientation": orientation,
        "width": newWidth,
        "height": newHeight
      });
    }
  });

  /**
   * The init event is triggered at the end of the initialization process.  At this point the bc.context object has been initialized,
   * views have been initialized and application logic can begin executing.
   * 
   * @example
   * $( bc ).bind( "init", function(evt) {
   *    alert("BC SDK is initialized.  Can access bc.context such as: "  + bc.context.vieworientation);
   * });
   * @name init
   * @event
   * @memberOf bc
   * @param event (type of init)
   */
  function triggerInitEvent() {
    bc.context.initialized = true;
    $( bc ).trigger( "init" );  
  }
  
  /**
   * The viewfocus event is triggered when a view gains focus.
   * 
   * @example
   * $( bc ).bind( "viewfocus", function( evt ) {
   *    alert( "I am the view that is current in focus.")
   * });
   * @name viewfocus
   * @event
   * @memberOf bc
   * @param event (type of viewfocus )
   */ 

   /**
    * The viewblur event is triggered when a view loses focus.
    * 
    * @example
    * $( bc ).bind( "viewblur", function( evt ) {
    *    alert( "I am the view that is current in focus.")
    * });
    * @name viewblur
    * @event
    * @memberOf bc
    * @param event (type of viewblur)
    */
    
  /**
   * The newconfigurations event is triggered when a configurations, styles or settings, are retrieved from the server.
   * The app cloud SDK checks the server for new configurations whenever the view gains focus.  If newconfigurations are found then the
   * then the event is triggered on the bc object and passed configurations as an object that has the values and a property indicating
   * whether or not those values are new.
   *
   * @example
   $( bc ).bind( "newconfigurations ", handleNewConfigurations );

   //Possible values for data are:  {
   //   "settings": {
   //     "isNew": newSettings,
   //     "values": data.settings
   //   },
   //   "styles": {
   //     "isNew": newStyles,
   //     "values": data.styles
   //   }
   function handleNewConfigurations( data ) {
      if( data.styles.isNew ) {
        bc.core.applyStyles();
      }
   }

   {
     "settings": {
       "isNew": newSettings,
       "values": data.settings
     },
     "styles": {
       "isNew": newStyles,
       "values": data.styles
     }
   */
   
  /**
   * End Events
   */
  
  /*
   * Initialize the metrics object and triggers events for install and session start where appropriate.
   */
  $( bc ).bind( "init", function() { 
    //TODO - deal with pendingMetrics.
    
    //Initialize the metrics object
    if( bc.metrics !== undefined ) {
      // bc.metrics.init( {
      //           "domain": "appcloud",
      //           "uri": bc.METRICS_SERVER_URL,
      //           "interval": "5000"
      //         },
      //         {
      //           "account": bc.accountID,
      //           "appplication": bc.appID,
      //           "view": bc.viewID
      //         }
      //       );
    }
    
    //Check for flag to send install event.
    if( window.bc_firstRun && bc.metrics ) {
      bc.metrics.track( "installation" );
    }
    
    //Check for flag to send session events.
    if( window.bc_sessionStart && bc.metrics ) {
      bc.metrics.live( "session" );
    }
    
    //If the viewfocus event has already fired we need to now start tracking.
    if( window.bc_viewFocus && bc.metrics ) {
      bc.sessionEndCallback = bc.metrics.live( "view" );
    }
  });
  
  $( bc ).bind( "viewfocus", function() {
    //Should get the most recent settings and styles for this view.
    bc.core.refreshConfigurationsForView();
    
    if( bc.metrics && bc.metrics.isInitialized() ) {
      bc.sessionEndCallback = bc.metrics.live( "view" );
    } else {
      window.bc_viewFocus = true;
    }
  });
  
  $( bc ).bind( "viewblur", function() {
    if( typeof( bc.sessionEndCallback ) === "function" ) {
      bc.sessionEndCallback();
    }
  });

  /**
   * Set up our context object with any values that can be bootstrapped.
   */
  function initContextObject() {
    bc.context.viewOrientation = ( window.innerWidth > window.innerHeight ) ? "landscape" : "portrait";
    bc.context.os = ( navigator.userAgent.indexOf( "Mac OS X" ) > -1 ) ? "ios" : "android";
    bc.context.onLine = navigator.onLine;
    if( bc.device !== undefined ) {
      bc.device.setIsNative();
    }
  }
  
  /**
   * @private
   */
  bc.core.loadConfigurationsFromManifest = function() {
    var views,
        $manifest;

    if( window.bc_configurations !== undefined && window.bc_configurations.views !== undefined) {
      bc.core.setConfiguration( window.bc_configurations, true );
    } else {
     //check the cache to see if we have existing configurations.
     bc.configurations = bc.core.cache( bc.viewID + "_configurations" );
     if( bc.configurations === null ) {
       $manifest = $( '[type="text/manifest"]' );
       if( $manifest.length > 0 ) {
         bc.core.loadManifestFromScriptElement( $manifest );
       } else {
         bc.core.loadManifestViaAjax( 0 );
       }
     }
    }
  };
  
  /**
   * @private
   */
  bc.core.loadManifestFromScriptElement = function( $elem ) {
    var uri = $( '[type="text/manifest"]' ).attr( "src" );
    $.ajax( 
      {
        "url": uri,
        "async": false
      }
    )
    .success( bc.core.setConfiguration )
    .error( function() 
      {
        console.error( "ERROR: Loading manifest.json.  Did you inlude in the a script tag on the page?" );
      }
    );
  };
  
  /**
   * @private
   */
  bc.core.loadManifestViaAjax = function( index ) {
    var directories,
        uri;
    
    index++;
    directories = location.href.split( "/" );
    
    if( index === ( directories.length - 1 ) ) {
      console.error( "ERROR: Did not find a manifest.json file." );
      return;
    }

    uri = directories.slice( 0, directories.length - index )
                      .join( "/" )
                      .concat( "/manifest.json" );
    $.ajax( 
      {
        "url": uri,
        "async": false
      }
    )
    .success( bc.core.setConfiguration )
    .error( function() 
      {
        bc.core.loadManifestViaAjax( index );
      }
    );
  };
  
  /**
   * @private
   */
  bc.core.setConfiguration = function( manifest, cache ) {
    var views;
    manifest = ( typeof manifest === "string" ) ? JSON.parse( manifest ) : manifest;
    cache = ( typeof cache === "boolean") ? cache : false;
    
    views = manifest.views;
    for( var i = 0, len = views.length; i < len; i++ ) {
      if( location.href.indexOf( views[i].uri )  > -1 ) {
        bc.configurations = {
          "data":     views[i].data
        , "styles":   views[i].styles
        , "settings": views[i].settings
        };
        
        if( cache ) {
          bc.core.cache( bc.viewID + "_configurations", bc.configurations );
        }
        return;
      }
    }
  };

  $( document ).ready( function() {
    setGlobalIDValues();
    initContextObject();
    bc.core.loadConfigurationsFromManifest();
    setAdPolicy();    
    triggerInitEvent();    
  });
  
} )( bc.lib.jQuery );