/*global bc:true atob:false*/
/*jshint indent:2, browser: true, white: false devel:true undef:false*/
/**
 * A videosView is a view that presents a collection of playlists.  The view will show an initial screen of the list of playlists and then
 * allow the user to drill down into the list of videos and finally the details for a particular video.  Once on the video detail page the user can then 
 * play the video.
 *
 * @class A videosView is a view that presents a collection of playlists.  The view will show an initial screen of the list of playlists and then
  * allow the user to drill down into the list of videos and finally the details for a particular video.  Once on the video detail page the user can then 
  * play the video.
 * @constructor
 * @param {HTMLElement} element The containing element on the page that the view should be displayed in.
 * @param ignore
 * { @list Styles: playlistTitleColor, videoTitleColor, detailDescriptionColor, videoDescriptionColor, cellBackgroundColor }
 * @return  A new videosView instance.
 *
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js   
 */
var videosView = ( function( $, undefined) {
  var _waitingToRefresh = false,
      _transitioningToDetailPage = false,
      _indexOfCurrentPlaylist,
      _settings,
      _brightcovePlayerCompatible,
      _defaults = { "element": "body" },
      DEFAULT_PLAYER_EMBED_CODE = "<!-- Start of Brightcove Player --><div style='display:none'></div><!--By use of this code snippet, I agree to the Brightcove Publisher T and C found at https://accounts.brightcove.com/en/terms-and-conditions/. --><script language='JavaScript' type='text/javascript' src='http://admin.brightcove.com/js/BrightcoveExperiences.js'></script><object id='myExperience' class='BrightcoveExperience'><param name='bgcolor' value='#FFFFFF' /><param name='width' value='480' /><param name='height' value='270' /><param name='playerID' value='835199013001' /><param name='playerKey' value='AQ~~,AAAAwnfEsvk~,KAoXD_LRPPB5swx0MfLg05G8agjxyQ1V' /><param name='isVid' value='true' /><param name='isUI' value='true' /><param name='dynamicStreaming' value='true' /></object><!-- This script tag will cause the Brightcove Players defined above it to be created as soonas the line is read by the browser. If you wish to have the player instantiated only after the rest of the HTML is processed and the page load is complete, remove the line. --><script type='text/javascript'>brightcove.createExperiences();</script><!-- End of Brightcove Player -->",
      MESSAGE_TO_SHOW_USER_FOR_PLAYER_INPUT_FIELD = "Paste your Brightcove player embed code here.";
      
  /**
   * @private
   */
  function videosView( options ) { 

    _settings = $.extend( {}, _defaults, options );

    this.element = $( _settings.element );
    
    this.handlePageContainer();
    
    //The callback function to stop sending metric events for video viewing.
    this.videoViewingEventCallback = undefined;
    
    //The index of the current video being viewed.  Undefined, if the user is not on a video detail page.
    this.currentVideo = undefined;
 
    if( bc.context.initialized ) {
      this.initialize();
    } else {
      $( bc ).one( "init", $.proxy( function() {
        this.initialize();
      }, this ) );
    }
  }

  /**
   * The initialize function is called if the bc.core has already been initialized or after the init function fires.
   */
  videosView.prototype.initialize = function() {
    //Load the BrightcoveExperience.js file if it is not already loaded and we support the BC HTML5 players.
    if( this.brightcovePlayerCompatible() ) {
      this.loadBrightcoveExperienceFile();
    }

    //Allow this view to rotate in all directions
    bc.device.setAutoRotateDirections( ['all'] );
    
    //Add our css
    this.element.addClass( "playlist-container" );
    
    //Apply the CSS styles that our currently in the cache.
    bc.core.applyStyles();
    
    //register our event listeners for this view.
    this.registerEventListeners();
    
    //Builds the page as soon as this view is instantiated.
    this.render( bc.core.cache( bc.viewID + "_videos_data" ) );
    
    //Retrieve the data from the server.
    bc.core.getData( "videos", $.proxy( function( data ) {
        this.render( data );
          }, this )
      , $.proxy( function() {
        this.handleNoData();
      }, this ) 
    );
    
  };
  
  /**
   * Responsible for building out the HTML for the first page the user is shown.  If there is only one playlist assigned to this
   * view then the view will not build the playlist view but rather go directly to the list of videos. 
   */
  videosView.prototype.render = function( data ) {
    //If the data is not new we should just return
    if( data !== undefined && data === this.data ) {
      //No need to the draw the UI if we have no new data.
      return;
    }
    
    if( ( !data && !this.data ) || ( data && data.items && data.items.length === 0 ) ) {
     this.element.html( bc.ui.spinner() );
     return;
    }
    
    bc.core.cache( bc.viewID + "_videos_data", data );
    this.data = data.items;
    if ( this.data.length > 1 ) {
      this.buildListOfPlaylists();
    } else {
      _indexOfCurrentPlaylist = 0;
      this.buildListOfVideos( this.data[_indexOfCurrentPlaylist], true );
    }  
     
    bc.ui.enableScrollers();
  };
  
  /**
   * If there is an error getting data handleNoData is called.  If we are in the studio then we want to show the spinner again.
   */
  videosView.prototype.handleNoData = function() {
   //If we are in preview mode then show the spinner, otherwise do nothing
    if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
      this.element.html( bc.ui.spinner() );
    }
  };
  
  videosView.prototype.handlePageContainer = function( element ) {
    var $elem;
    //If there was no element passed in we want to inject a page wrapper into the page.
    if( _settings.element === "body" ) {
      $elem = $( "<div class='page'></div>" );
      this.element.html( $elem );
      this.element = $elem;
      bc.ui.init();
      return;
    }
    
    if( !this.element.hasClass( "page" ) ) {
      this.element.addClass( "page" );
      bc.ui.init();
    }
  };
  
  /**
    * Function to handle new setting/styles becoming available to the view.  When new styles become available the view will call
    * applyStyles which will update the UI with the new styles.
    * @param evt The event object.
    * @param info The info object has the new settings and styles.
    */
  videosView.prototype.handleNewConfigurationInfo = function( info ) {
    if ( info.status !== "error" && info.styles.isNew ) {
       bc.core.applyStyles( info.styles.values );
    }    
  };

   
  /**
   * Builds the HTML for the list of Playlists page and injects it into the DOM.  See listOfPlaylistHTML for the
   * actual HTML snippet that gets created.
   */
  videosView.prototype.buildListOfPlaylists = function() {
    var html = this.headerHTML( { "title": "Playlists" } );
    html += this.listOfPlaylistHTML( this.data );
    $( this.element ).addClass( "playlist-page")
                     .html( html );     
  };
   
  /**
   * The construction of the HTML string for the list of playlists page.
   * @param items The object that contains all of the playlist items that are to be rendered on the page.
   * TODO - Show the contents of the items object?
   */
  videosView.prototype.listOfPlaylistHTML = function( items ) {
    var html = "<div class='scroller'><ul class='ul-listview'>";
    
    for( var i = 0, len = items.length; i < len; i++ ) {
      html += "<li id='" + items[i].name + "' data-index='" + i + "' class='background-a border-a playlist cellBackgroundColor'>" +
                "<div class='flex'>" +
                  "<h2 class='header-b ellipsis playlistTitleColor'>" + items[i].name + "</h2>" +
                  "<p class='number-of-videos desc-a'>" + items[i].videos.length + " Videos</p>" +
                "</div>" +
                "<div class='arrow'></div>" +
              "</li>";
    }
    html += "</ul></div>";
    return html;
  };

  /**
   * Builds, injects and transitions to the list of videos page.  Depending on whether or not this is the first page of this view it will either add a new
   * header and transition to the new page once it has been added to the view or simply build the HTML and inject into the element.
   * @param playlist The data for the playlist that is to be rendered on this page.  TODO - show the object of the playlist.
   * @param firstPage A boolean indicating if this is the first page in the view.  True if there is only playlist data bound to this view.
   */
  videosView.prototype.buildListOfVideos = function( playlist, firstPage ) {
    var html = "";

    //If this is not the first page then we need to add in a new page and header to transition to.
    if( !firstPage ) {
      html = "<section id='playlist_" + _indexOfCurrentPlaylist + "' class='page playlist-page list-of-videos'>";
    }
    
    html += this.headerHTML( { "title": "Videos", "backButton": !firstPage } );
    html += this.listOfVideosHTML( playlist.videos );

    if( !firstPage ) {
     html += "</section>";
     bc.ui.forwardPage( html );
    } else if( bc.ui.currentPage ) {
     bc.ui.currentPage.addClass( "playlist-page" );
     this.element.html( html );
    }
  };

  /**
   * The construction of the HTML string for the list of videos page.
   * @param videos An of video data objects that is used to generate the HTML string.  The video object is expected to have the
   * following values.
   * <pre> 
   { 
    "id": "unique_id",
    "FLVURL": "url to the video file.  (can be a m3u8 index file)",
    "name": "The name of the video",
    "thumbnailURL": "The url to the thumbnail",
    "shortDescription": "The short description",
    "videoStillURL": "The url to the video still"
   }
   </pre>
   */
  videosView.prototype.listOfVideosHTML = function( videos ) {
    var video,
        html = "<div class='scroller'><ul class='ul-listview'>";

    for( var i = 0, len = videos.length; i < len; i++ ) {
      video = videos[i];
      html +=  "<li class='video background-a border-a cellBackgroundColor' data-bc-video-id='" + video.id + "' data-video-url='" + video.FLVURL + "'>" +
                  "<img src='" + video.thumbnailURL + "' class='thumbnail border-a'/>" +
                  "<div class='details'>" +
                    "<h2 class='header-b ellipsis videoTitleColor'>" + video.name + "</h2>" +
                    "<p class='desc-a ellipsis videoDescriptionColor'>" + video.shortDescription + "</p>" +
                  "</div>" +
                  "<div class='arrow'></div>" +
               "</li>";
    }

    html += "</ul></div>";
    return html;
  };  
  
  /**
   * Builds the video detail page and transitions to it.
   * @param video The video object used to build the HTML for the detail page.  This object expects the following values:
   <pre>
   { 
    "id": "unique_id",
    "FLVURL": "url to the video file.  (can be a m3u8 index file)",
    "name": "The name of the video",
    "thumbnailURL": "The url to the thumbnail",
    "shortDescription": "The short description",
    "videoStillURL": "The url to the video still"
   }
   </pre>
   */
  videosView.prototype.buildVideoDetail = function( video ) {
    var $html = $( this.videoDetailHTML( video ) );
    this.currentVideo = video;
    if( !this.brightcovePlayerCompatible() ) {
      $html.find( ".offscreen" )
           .appendTo( "body" )
           .one( "load", $.proxy( function( evt ) {
             this.positionVideoStill( evt.currentTarget );
           }, this ) );
    }
    bc.ui.forwardPage( $html );

    if( bc.metrics !== undefined ) {
      this.videoViewingEventCallback = bc.metrics.live( "video-view", { "name": this.currentVideo.name } );
    }

  };
  
  /**
   * Creates the HTML string for the video detail page.  
   * @param video The video object used to build the HTML for the detail page.  This object expects the following values:
    <pre>
    { 
     "id": "unique_id",
     "FLVURL": "url to the video file.  (can be a m3u8 index file)",
     "name": "The name of the video",
     "thumbnailURL": "The url to the thumbnail",
     "shortDescription": "The short description",
     "videoStillURL": "The url to the video still"
    }
    </pre>
   */
  videosView.prototype.videoDetailHTML = function( video ) {
    var html;

    html = "<section id='" + video.id + "_page' class='video-details page' data-bc-video-id='" + video.id + "'>" +
              this.headerHTML( { "backButton": true, "title": video.name } ) +
              "<section class='scroller'>" +
                "<div>" +
                  this.playerContainerHTML( video ) +
                  "<div class='details-container'>" +
                    "<h2 class='header-b detailTitleColor'>" + video.name + "</h2>" +
                    "<p class='desc-a detailDescriptionColor'>" + video.shortDescription + "</p>" +
                  "</div>" +
                "</div>" +
              "</section>" +
            "</section>";
    return html;
  };
  
  /**
   * Creates the HTML snippet for the player container.  If this is iOS 4.1 or below then we also load the video into the video tag directly,
   * otherwise we show a spinner until the page has finished transitioning so that we can then load the player in.
   * @param video The video object that is used to render this HTML.
   */
  videosView.prototype.playerContainerHTML = function( video ) {
    var html;
    if( this.brightcovePlayerCompatible() ) {
      html ="<div class='player-container' style='background-color: #ffffff'>" +
              bc.ui.spinner() + 
            "</div>";
    } else {
      html = "<div class='player-container' style='height: " + ( bc.ui.width() * 0.75 ) + "px'>" +
               "<img src='" + video.videoStillURL + "' alt='still' class='offscreen' />" +
               "<div class='play-icon'></div>" +
               "<video class='video-offscreen' x-webkit-airplay='allow' controls='controls' src='" + video.FLVURL + "' poster='" + video.videoStillURL + "'></video>" +
             "</div>";
    }
    return html;
  };
  
  /**
   * The HTML snippet for the Brightcove embed code.  This HTML comes from the settings so that a user can set the embed code via the app studio.
   * @param id The id of the video to play.
   */
  videosView.prototype.brightcovePlayerHTML = function( id ) {
    var playerHTML = ( bc.core.getSetting( "embedCode" ) === undefined || bc.core.getSetting( "embedCode" ) === MESSAGE_TO_SHOW_USER_FOR_PLAYER_INPUT_FIELD ) ? DEFAULT_PLAYER_EMBED_CODE : bc.core.getSetting( "embedCode" ),
        $playerHTML = $( playerHTML ),
        $widthParam = $playerHTML.find( "param[name='width']" ),
        $heightParam = $playerHTML.find( "param[name='height']" ),        
        width = 320,
        height = 180;
    
    // update size
    $widthParam.attr( "value", width );
    $heightParam.attr( "value", height );

    if ( $playerHTML.find( "param[name='@videoPlayer']" ).length > 0 ) {
      $playerHTML.find( "param[name='@videoPlayer']" ).attr( "value", id );        
    } else {
      $playerHTML.append( "<param name='@videoPlayer' value='" + id + "'/>");
    }

    playerHTML = $( "<div></div>" ).append( $playerHTML ).html();
    setTimeout( function() {
      $( "head" ).append( "<script type='text/javascript'>brightcove.createExperiences();</script>" );
    }, 0 );
    return playerHTML;
  };

  /**
   * Register all of the event listeners for the videosView.  These should be registered as delegates where ever possible.  The reason for this is 
   * that because many of these elements are built dynamically in JavaScript they may not exist at the time that registerEventListeners is called.  Additionally, we
   * recommend 'delegate' over 'live' since some events are not bubbled all the way up to the document.  (which is what .live listens on)
   */
  videosView.prototype.registerEventListeners = function() {
    
    //register event listener for when new data is fetched
    $( bc ).bind( "newconfigurations", $.proxy( function( evt, info ) {
          this.handleNewConfigurationInfo( info );
        }, this ) 
    );

    //Bind the playlist to a tap event.
    $( "body" ).delegate( ".playlist", "tap", $.proxy( function( evt ) {
      this.playlistTap( evt );
    }, this ) );
    
    //Bind the playlist to a tap event.
    $( "body" ).delegate( ".video", "tap", $.proxy( function( evt ) {
      this.videoTap( evt );
    }, this ) );
    
    //Bind to the back button.
    $( "body" ).delegate( ".back-button", "tap", $.proxy( function( evt ) {
      this.handleBackButtonTap( evt );
    }, this ) );
    
    //Bind to the player-contianer tap event.
    $( "body" ).delegate( ".player-container", "tap", $.proxy( function( evt ) {
      this.playVideo();
    }, this ) );
    
    $( bc ).bind( "pageshow", $.proxy( function( evt, page ) {
      this.hideSpinnerAfterVideoLoads();
      this.loadPlayer( page );
    }, this) );
    
    $( bc ).bind( "viewfocus", $.proxy( function( evt ) {
      this.handleViewFocus( evt );
    }, this ) );
    
    $( bc ).bind( "viewblur", $.proxy( function( evt ) {
      this.handleViewBlur( evt );
    }, this ) );
  };
  
  /**
   * Called when the user taps on the video still.  We load the video player off the screen in order to work around issues of
   * putting HTML elements over the video player.
   */
  videosView.prototype.playVideo = function() {
    bc.ui.currentPage.find( "video" ).get(0).play();
  };
  
  /**
   * playlistTap is called when the user taps the li that represents the playlist.  This function is responsible for providing the wiring to build the list of videos page.
   * @param evt The event object that was triggered when from this tap event.
   */
  videosView.prototype.playlistTap = function( evt ) {
    var $elem = $( evt.currentTarget );
    $elem.addClass( "bc-active" );
    $elem.find( ".header-b" ).addClass( "bc-active" );
    $elem.find( ".desc-a" ).addClass( "bc-active" );
    _indexOfCurrentPlaylist = $elem.attr( "data-index" );
    this.buildListOfVideos( this.data[_indexOfCurrentPlaylist], false );
  };
  
  /**
   * Called whenever the user taps on the back button.  This function is responsible for transition the page back to previous page and stopping the video viewing events if we are on the 
   * video detail page.
   * @param evt The event that was fired with this tap event.
   */
  videosView.prototype.handleBackButtonTap = function( evt ) {
    if( bc.ui.currentPage.hasClass( "video-details" ) && this.videoViewingEventCallback) {
      this.videoViewingEventCallback();
      this.currentVideo = undefined;
    }
    bc.ui.backPage();
  };
  
  /**
   * videoTap is called when the user taps the li that represents the video.  This function is responsible for providing the wiring to build the video detail page.
   * @param evt The event object that was triggered when from this tap event.
   */
  videosView.prototype.videoTap = function( evt ) {
    var $elem,
        video;
        
    if ( _transitioningToDetailPage ) {
      return;
    }
    
    _transitioningToDetailPage = true;
    $( bc ).one( "pageshow", function( evt, page ) {  
      _transitioningToDetailPage = false;    
    });
    $elem = $( evt.currentTarget );
    $elem.addClass( "bc-active" );
    $elem.find( ".header-b" ).addClass( "bc-active" );
    $elem.find( ".desc-a" ).addClass( "bc-active" );
    video = this.findVideoByID( $elem.data( "bc-video-id" ) );
    if( video ) {
      this.buildVideoDetail( video );
    }
  };
  
  /**
   * Called when the "view" gains focus.  (a view being defined in the manifest.xml file.)
   * @param evt The event object that was fired with this event.
   */
  videosView.prototype.handleViewFocus = function( evt ) {
    if( this.currentVideo !== undefined && bc.metrics !== undefined ) {
      this.videoViewingEventCallback = bc.metrics.live( "video-view", { "name": this.currentVideo.name } );
    }
  };

 /**
  * Called when this "view" loses focus.  This occurs when the user switches to a different "view".  (a view being defined in the manifest.xml file.)
  * @param evt The event object that was fired with this event.
  */
 videosView.prototype.handleViewBlur = function( evt ) {
   //If we have an article viewing event then we need to kill it.
   if( this.videoViewingEventCallback !== undefined ) {
     this.videoViewingEventCallback();
   }
 };
  
  /**
   * Helper function to find a video object by its ID.
   * @param id The ID for the video we are want to look up.
   * @return A video object or null if there is not video object with that ID.
   */
  videosView.prototype.findVideoByID = function( id ) {
    for( var i = 0, len = this.data.length; i < len; i++ ) {
      for(var j = 0, max = this.data[i].videos.length; j < max; j++ ) {
        if( id === this.data[i].videos[j].id ) {
          return this.data[i].videos[j];
        }
      }
    }
    return null;
  };
  
  /**
   * Generates the HTML snippet for the header. 
   * @param options An object that represents the settings that can be overridden for this HTML snippet.  Below are the default values.
   <pre>
   {
     "backButton": false, //A boolean for whether or not to show a back button.
     "refreshButton": false, //A boolean for whehter or not to show a refreshButton.
     "title": ""
   }
   </pre>
   @return A string that is the HTML snippet for the header.
   */
  videosView.prototype.headerHTML = function( options ) {
    var html = "",
        settings = {
          "backButton": false,
          "refreshButton": false,
          "title": ""
        };
    
    $.extend( settings, options );
    
    html = "<header class='header'>";
    
    if( settings.backButton ) {
      html += "<div class='back-button'></div>";
    }
    
    html += "<h1 class='header-a ellipsis'>" + settings.title + "</h1>";
    
    if( settings.refreshButton ) {
      html += "<div class='refresh-button'></div>";
    }
    
    return ( html += "</header>" );        
  };
  
  /**
   * The function that is called once the video still has finished loading off screen.  The function
   * is responsible for positioning the video still vertically inside the container.
   */
  videosView.prototype.positionVideoStill = function( elem ) {
    var $elem = $(elem ),
         newTop = "0px",
         containerHeight = $( ".player-container" ).height();
         
    if( $elem.height() < containerHeight ) {
      newTop = ( containerHeight - $elem.height() ) / 2;
    }
    $elem.css( { "top": newTop } )
         .removeClass( "offscreen" )
         .addClass( "video-still" )
         .insertBefore( ".play-icon" );
  };
  
  /**
   * If the device support the Brightcove HTML5 players then we inject the BrightcoveExperience file into the DOM.
   */
  videosView.prototype.loadBrightcoveExperienceFile = function() {
    var bc;
    if( $( "[src='http://admin.brightcove.com/js/BrightcoveExperiences.js']" ).length === 0 ) {
      bc = document.createElement( "script" );
      bc.type = "text/javascript";
      bc.src = "http://admin.brightcove.com/js/BrightcoveExperiences.js";
      document.getElementsByTagName("head")[0].appendChild( bc );
    }
  };
  
  /**
   * The Brightcove HTML5 players are not support on iOS 4.1 and below.  This function inspects the user agent to see if this device will support
   * the Brightcove HTML5 players.
   * return Boolean indicating whether or not Brightcove HTML5 players are supported.
   */
  videosView.prototype.brightcovePlayerCompatible = function() {
    var useragent;
    if( _brightcovePlayerCompatible !== undefined ) {
      return _brightcovePlayerCompatible;
    }
    
    useragent = navigator.userAgent;
    if( useragent.indexOf( "iPhone OS 3") > -1 || useragent.indexOf( "iPhone OS 4_0") > -1 || useragent.indexOf( "iPhone OS 4_1" ) > -1 ) {
      return ( _brightcovePlayerCompatible = false );
    }
    return (_brightcovePlayerCompatible = true );
  };
  
  /**
   * While the Brightcove HTML5 players are loading we want to show a spinner to let the user know that something is happening.  This function will remove the spinner
   * once the player has loaded.
   */
  videosView.prototype.hideSpinnerAfterVideoLoads = function() {
    
    if( bc.ui.currentPage.find( "iFrame" ).length > 0 ) {
      bc.ui.currentPage.find( ".spinner" ).remove();
      return;
    }
    setTimeout( $.proxy( function() { this.hideSpinnerAfterVideoLoads(); }, this ), 100 );
  };
  
  /**
   * Injects the Brightcove HTML5 player into the DOM.  We do this once the page has finished transitioning in order to ensure that the transition is smooth across
   * devices.
   */
  videosView.prototype.loadPlayer = function( page ) {
    var $page = ( page !== undefined ) ? $( page ) : bc.ui.currentPage;
    if( $page.hasClass( "video-details" ) && this.brightcovePlayerCompatible() ) {
      $( this.brightcovePlayerHTML( $page.data( "bc-video-id" ) ) ).appendTo( ".player-container" );
    }
  };
  
return videosView;
  
})( bc.lib.jQuery );
