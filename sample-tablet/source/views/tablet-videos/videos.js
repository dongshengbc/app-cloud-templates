/*global bc:true */
/*jshint indent:2, browser: true, white: false, undef:false*/


/**
 * A tabletVideosView is a view that presents a collection of playlists.  The view will show an initial screen of the list of playlists and then
 * allow the user to drill down into the a page that has the player and list of videos on it.  If there is only one playlist it will go straight to the page with the list of videos.
 * To see your videos appear from your account while in development mode, before the template has been ingested into the App Cloud studio, the contentFeed and DEFAULT_PLAYER_EMBED_CODE 
 * must be updated with values from your account.  To update the content feed replace the token with a read API from your account and update the playlists IDs to playlists from your account.
 * <b>Note this view is not yet supported on android do to performance concerns</b>
 *
 * @class A tabletVideosView is a view that presents a collection of playlists.  The view will show an initial screen of the list of playlists and then
 * allow the user to drill down into the a page that has the player and list of videos on it.  If there is only one playlist it will go straight to the page with the list of videos.
 * To see your videos appear from your account while in development mode, before the template has been ingested into the App Cloud studio, the contentFeed and DEFAULT_PLAYER_EMBED_CODE 
 * must be updated with values from your account.  To update the content feed replace the token with a read API from your account and update the playlists IDs to playlists from your account.
 * <b>Note this view is not yet supported on android do to performance concerns</b>
 *
 * @constructor 
 * @param options An object of the possible options for this view.  Currently the only option available is the element that this view should load into.  By default this will be the body tag.
 * @param ignore
 * @return  A new videosView instance.
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js  
 */
var tabletVideosView = ( function( $, undefined) {  
  var PLAYLIST_ITEMS_PER_ROW = 3,
      PLAYLIST_ITEM_CLASS = "playlist-list-item",
      DEFAULT_PLAYER_EMBED_CODE = "<!-- Start of Brightcove Player --><div style='display:none'></div><!--By use of this code snippet, I agree to the Brightcove Publisher T and C found at https://accounts.brightcove.com/en/terms-and-conditions/. --><script language='JavaScript' type='text/javascript' src='http://admin.brightcove.com/js/BrightcoveExperiences.js'></script><object id='myExperience' class='BrightcoveExperience'><param name='bgcolor' value='#000000' /><param name='width' value='480' /><param name='height' value='270' /><param name='playerID' value='835199013001' /><param name='playerKey' value='AQ~~,AAAAwnfEsvk~,KAoXD_LRPPB5swx0MfLg05G8agjxyQ1V' /><param name='isVid' value='true' /><param name='isUI' value='true' /><param name='dynamicStreaming' value='true' /></object><!-- This script tag will cause the Brightcove Players defined above it to be created as soonas the line is read by the browser. If you wish to have the player instantiated only after the rest of the HTML is processed and the page load is complete, remove the line. --><script type='text/javascript'>brightcove.createExperiences();</script><!-- End of Brightcove Player -->",
      MESSAGE_TO_SHOW_USER_FOR_PLAYER_INPUT_FIELD = "Paste your Brightcove player embed code here.",
      _defaults = { "element": "body" },
      _settings;
  /**
   * @private
   */
  function tabletVideosView( options ) { 

    _settings = $.extend( {}, _defaults, options );
    
    /** The index of the current playlist in view. */
    this.indexOfCurrentPlaylist = "";

    /** The iScroll object for the list of thumbnails */
    this.thumbnailScroller = undefined;

    this.scrolling = undefined;
    
    this.element = $( _settings.element );
    
    this.handlePageContainer();

    if( bc.context.initialized ) {
      this.initialize();
    } else {
      $( bc ).bind( "init", $.proxy( function() {
        this.initialize();
      }, this ) );
    }
  }

  /**
   * The initialize function is called if the bc.core has already been initialized or after the init function fires.
   */
  tabletVideosView.prototype.initialize = function() {
    bc.core.applyStyles( this.styles );
    
    //register our event listeners for this component.
    this.registerEventListeners();

    this.loadBrightcoveExperienceFile();
    
    this.element.addClass( bc.context.os );
    
    /** Tell the container that this view will support rotating in all directions */
    bc.device.setAutoRotateDirections( ['all'] );
    
    this.render( bc.core.cache( bc.viewID + "_videos_data" ) );
    
    bc.core.getData( "videos"
      , $.proxy( function( data ) {
          this.render( data );
        }, this )
      , $.proxy( function() {
          this.handleNoData();
        }, this ) 
    );
  };
  
   /**
    * Draw the UI to the current page.  Determines if it should either show a spinner, list of playlists or a single playlist view.
    */
   tabletVideosView.prototype.render = function( data ) {
     //If the data is not new we should just return
     if( data !== undefined && data === this.data ) {
       //No need to the draw the UI if we have no new data.
       return;
     }

     if( ( !data && !this.data ) || ( data && data.items && data.items.length === 0 ) ) {
      this.element.html( bc.ui.spinner() );
      return;
     }
     
     this.data = data.items;

     bc.core.cache( bc.viewID + "_videos_data", data );

     if ( this.data.length > 1 ) {
       this.buildListOfPlaylists();
     } else {
       this.indexOfCurrentPlaylist = 0;
       this.buildListOfVideos( this.data[ this.indexOfCurrentPlaylist ], true );
     }  

     if( bc.context.os !== "android" ) {
       bc.ui.enableScrollers();
     }

   };
  
 /**
  * If there is an error getting data handleNoData is called.  If we are in the studio then we want to show the spinner again.
  */
  tabletVideosView.prototype.handleNoData = function() {
    //If we are in preview mode then show the spinner, otherwise do nothing
    if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
      this.element.html( bc.ui.spinner() );
    }
  };

  /**
   * Populates the element with the default page container information.
   * @param element The element associated with this 
   */
  tabletVideosView.prototype.handlePageContainer = function( element ) {
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
   * Calculates what the player width should be depending on whether or not we are in landscape or portrait mode.
   * @return The new width of the player.
   */
  tabletVideosView.prototype.calculatePlayerWidth = function() {
    return bc.context.viewOrientation === "landscape" ? bc.ui.height() : bc.ui.width();
  };

  /**
   * Return the correct height of the player depending upon the overall aspect ratio from the
   * player as originally determined.
   * @param width The expected with of the player.
   * @param originalWidth The width of the player specified in the Brightcove embed code of the player.
   * @param originalHeight The height of the player specified in the Brightcove embed code of the player.
   * @return the new height of the player that maintains the aspect ratio of the original player.
   */ 
  tabletVideosView.prototype.calculatePlayerHeight = function( width, originalWidth, originalHeight ) {
    var aspectRatio = 0.5625;
    
    width = width || this.calculatePlayerWidth();
    
    if ( originalWidth && originalHeight ) {
      aspectRatio = parseInt( originalHeight, 10 ) / parseInt( originalWidth, 10 );
    }
    return width * aspectRatio;  
  };

  /**
   * Generates the HTML string for the Brightcove Player.
   * @param id The id of the video to playback.
   * @return The HTML string that represents the Brightcove Player.
   */
  tabletVideosView.prototype.brightcovePlayerHTML = function( id ) {
    var playerHTML = ( bc.core.getSetting( "embedCode" ) === MESSAGE_TO_SHOW_USER_FOR_PLAYER_INPUT_FIELD ) ? DEFAULT_PLAYER_EMBED_CODE : bc.core.getSetting( "embedCode" ),
        $playerHTML = $( playerHTML ),
        $widthParam = $playerHTML.find( "param[name='width']" ),
        $heightParam = $playerHTML.find( "param[name='height']" ),        
        width = 640,
        height = 360;

    // update size
    $widthParam.attr( "value", width );
    $heightParam.attr( "value", height );

    if ( $playerHTML.find( "param[name='@videoPlayer']" ).length > 0 ) {
      $playerHTML.find( "param[name='@videoPlayer']" ).attr( "value", id );        
    } else {
      $playerHTML.append( "<param name='@videoPlayer' value='" + id + "'/>");
    }

    playerHTML = $( "<div></div>" ).append( $playerHTML ).html();
    playerHTML += "<script type='text/javascript'>brightcove.createExperiences();</script>";
    return playerHTML;
  };
  
  /**
   * Generats and append the HTML snippet for the page that lists the playlists associated with this view.
   */
  tabletVideosView.prototype.buildListOfPlaylists = function() {
    var title = bc.core.getSetting( "titleOfPage" ),
        html = bc.ui.headerHTML( { "title": title } );

    html += this.listOfPlaylistsHTML( this.data );
    $( this.element ).addClass( "page playlist-page")
                     .html( html );     
  };

  /**
   * Generates the HTML snippet for the list of playlists.
   * @param - playlists A data object that represents the playlists to display.
   * @return An HTML string that is the list of playlists.
   */
  tabletVideosView.prototype.listOfPlaylistsHTML = function( playlists ) {
    var itemWidthInfo = this.calculatePlaylistItemWidthInfo(),
        marginRightAdjustment = itemWidthInfo.containerMarginAdjustment + "px",
        playlistHTML = "<section class='" + ( bc.context.os === 'android' ? 'android-scroller' : 'radial-background scroller' ) + "'>" +
                          "<ul class='playlist-list' style='margin-right:" + marginRightAdjustment + "'>";

    playlists.forEach( function( elem, idx, arr ) {
      playlistHTML += this.playlistHTML( elem, idx, itemWidthInfo );
    }, this );

    playlistHTML += "</ul></section>";
    return playlistHTML;
  };

  /**
   * calculatePlaylistItemNonContentSpace determines the margin, padding and border for a playlist-list-item.  This is used when calculating the widths and positions of
   * the playlist items.
   * @return An object that has the margin, padding and border properties.  
   */
  tabletVideosView.prototype.calculatePlaylistItemNonContentSpace = function() {
    var measureItem = $( "<div class='border-b " + PLAYLIST_ITEM_CLASS + "' style='position:absolute;left:-10000px'></div>" ).appendTo( "body" ),
        margin = measureItem.css( "margin-left" ).replace( "px", "" ),
        padding = measureItem.css( "padding-left" ).replace( "px", "" ),
        border = measureItem.css( "border-left-width" ).replace( "px", "" );

    margin = margin ? margin : 0;
    padding = padding ? padding : 0;
    border = border ? border : 0;        

    measureItem.remove();

    return {
      "margin": parseInt( margin, 10 ),
      "padding": parseInt( padding, 10 ),
      "border": parseInt( border, 10 )
      };
  };

  /**
   * Determines the correct width of a playlist item and any adjustments that need to made to the container.
   * @return An object that has properties of "itemWidth" and "containerMarginAdjustment".
   */
  tabletVideosView.prototype.calculatePlaylistItemWidthInfo = function() {  
    // get total available space
    // TODO: handle case where screenWidth / ITEMS_PER_ROW is not completely divisible
    var screenWidth = bc.ui.width(),
        itemSpacing = this.calculatePlaylistItemNonContentSpace(),
        totalItemSpacing = ( itemSpacing.border + itemSpacing.padding + itemSpacing.margin ) * 2 * PLAYLIST_ITEMS_PER_ROW,
        itemContentAvailSpace = screenWidth - totalItemSpacing,
        extraPixels = itemContentAvailSpace % PLAYLIST_ITEMS_PER_ROW,
        containerMarginAdjustment = Math.floor( extraPixels / 2 ),
        itemWidth = itemContentAvailSpace / PLAYLIST_ITEMS_PER_ROW;
    
    // allocate any 'extra' pixels to the left and right margin of the container
    return {
      "itemWidth": itemWidth,
      "containerMarginAdjustment": containerMarginAdjustment
    };
  };

  /**
   * Determines the height of a playlist item using the passed in width and the specified aspect ratio exposed as a setting.
   * @param itemWidth The width of the playlist item.
   * @return The height to be used for the playlist item.
   */
  tabletVideosView.prototype.calculatePlaylistItemHeight = function( itemWidth ) {
    var itemHeight = ( bc.core.getSetting( "aspectRatioOfPlaylistThumbnail" ) ) * itemWidth;
    return ( itemHeight + 35 );
  };

  /**
   * Determines the height of an image within the playlist.
   * @param itemWidth The width of the image to placed inside the playlist item.
   * @return The new height of the image.
   */
  tabletVideosView.prototype.calculatePlaylistImgHeight = function( imageWidth ) {    
    return ( bc.core.getSetting( "aspectRatioOfPlaylistThumbnail" ) ) * imageWidth;
  };

  /**
   * Gets the images to use for the playlist.  It first looks to see if there is a thumbnail on the playlist.  If there is not then it uses the first video still image.
   * If there are no video still images, then it will fallback to using the first video thumbnail it finds.
   * @param playlist The playlist object that is inspected in order to find the correct thumbnail to use.
   * @return The URL of the image to use.
   */
  tabletVideosView.prototype.imgForPlaylist = function( playlist ) {
    var imgURL;

    if ( playlist.thumbnailURL ) {
      imgURL = playlist.thumbnailURL;
    } else {
      // try to find a videoStill
      playlist.videos.forEach( function( video, idx, arr ) {
        if ( video.videoStillURL ) {
          imgURL = video.videoStillURL;
        }
      });
      
      if ( ! imgURL ) {
        playlist.videos.forEach( function( video, idx, arr ) {
          if ( video.thumbnailURL ) {
            imgURL = video.thumbnailURL;
          }
        });
      }
    }

    return imgURL;
  };

  /**
   * Gets the HTML snippet for this particular playlist list item.
   * @param playlist The playlist object whose data is used to build the HTML snippet.
   * @param idx The index of the playlist that is being used.
   * @param itemWidthInfo The object that contains the width, the margin and padding.  This value is determined by: calculatePlaylistItemWidthInfo()
   */
  tabletVideosView.prototype.playlistHTML = function( playlist, idx, itemWidthInfo ) {
    var itemWidth = itemWidthInfo.itemWidth,
        itemHeight = this.calculatePlaylistItemHeight( itemWidth ),
        imgHeight = this.calculatePlaylistImgHeight( itemWidth ),        
        playlistHTML = "<li class='background-b set-width-and-height-js " + PLAYLIST_ITEM_CLASS + "' style='width:" + itemWidth + "px; height:" + itemHeight + "px' data-bc-playlist-idx='" + idx + "'>",
        imgURL = this.imgForPlaylist( playlist );

    playlistHTML += "<img class='set-width-and-height-js' src='" + imgURL + "' style='width:" + itemWidth + "px;height:" + imgHeight + "px'/>";
    playlistHTML += "<div class='summary'><p class='desc-a playlistThumbTitleColor'>" + playlist.name + "</p><p class='desc-b playlistThumbNumberOfVideosColor'>" + playlist.videos.length + " Videos</p><div class='play-icon'></div></div>";
    playlistHTML += "</li>";
    return playlistHTML;
  };

  /**
   * If the device support the Brightcove HTML5 players then we inject the BrightcoveExperience file into the DOM.
   */
  tabletVideosView.prototype.loadBrightcoveExperienceFile = function() {
    var bc;
    if( $( "[src='http://admin.brightcove.com/js/BrightcoveExperiences.js']" ).length === 0 ) {
      bc = document.createElement( "script" );
      bc.type = "text/javascript";
      bc.src = "http://admin.brightcove.com/js/BrightcoveExperiences.js";
      document.getElementsByTagName("head")[0].appendChild( bc );
    }
  };

  /**
    * Function to handle new setting/styles becoming available to the view.  When new styles become available the view will call
    * applyStyles which will update the UI with the new styles.
    * @param evt The event object.
    * @param info The info object has the new settings and styles.
    */
  tabletVideosView.prototype.handleNewConfigurationInfo = function( info ) {
    if ( info.status !== "error" && info.styles.isNew ) {
       bc.core.applyStyles( info.styles.values );
    }    
  };

  /**
   * Register all of the event listeners for the tabletVideosView.  These should be registered as delegates where ever possible.  The reason for this is 
   * that because many of these elements are built dynamically in JavaScript they may not exist at the time that registerEventListeners is called.  Additionally, we
   * recommend 'delegate' over 'live' since some events are not bubbled all the way up to the document.  (which is what .live listens on)
   */
  tabletVideosView.prototype.registerEventListeners = function() {
    var self = this;
    //register event listener for when new data is fetched
    $( bc ).bind( "newconfigurations", function( evt, info ) {
      self.handleNewConfigurationInfo( info );
    }); 

    $( "body" ).delegate( ".playlist-list-item", "tap", function( evt ) {
      self.handlePlaylistTap( evt );
    });

    $( "body" ).delegate( ".back-button", "tap", function( evt ) {
      self.handleBackButtonTap( evt );
    });   

    //This is a click instead of a tap, because the swapping of the video player via tap happened so fast that it could cause the browser to crash.
    $( "body" ).delegate( "#thumb-strip li", "click", function( evt ) {
      self.handleVideoThumbClick( evt );      
    });
    
    $( bc ).bind( "vieworientationchange", function( data ) {
      self.handleOrientationChange( data );
    });
    
  };

  /**
   * Handles the orientation change of the view.  The function is responsible for refreshing the scroller of the thumbnails.
   * @param data The data that was fired with this event.
   */
  tabletVideosView.prototype.handleOrientationChange = function( data ) {
    var itemWidth = this.calculatePlaylistItemWidthInfo().itemWidth,
        itemHeight = this.calculatePlaylistItemHeight( itemWidth ),
        imgHeight = this.calculatePlaylistImgHeight( itemWidth );
    
    $( "li.set-width-and-height-js" ).width( itemWidth )
                                      .height( itemHeight );
                                      
    $( "img.set-width-and-height-js" ).width( itemWidth )
                                      .height( imgHeight );
                                   
    
    
    if( this.thumbnailScroller !== undefined ) {
      this.thumbnailScroller.refresh();
    }
  };
  
  /**
   * Called when the user taps the back button.  Responsible for transition back to the home page and destroying the scroller.
   * @param evt 
   */
  tabletVideosView.prototype.handleBackButtonTap = function( evt ) {
    if( bc.context.os === "android" ) {
      this.androidHandleBackButtonTap();
      return;
    }
    
    bc.ui.backPage();
    if( this.thumbnailScroller !== undefined ) {
      this.thumbnailScroller.destroy();
      this.thumbnailScroller = undefined;
    }

  };
  
  /**
   * Handles the transition back to the first page on Android Tablets.  Our default transitions are not smooth
   * so on android tablets we provide a fade.
   */
  tabletVideosView.prototype.androidHandleBackButtonTap = function() {
    $( "<div class='android-overlay'></div>" ).appendTo( "body" );
    setTimeout( function() { 
      $( ".android-overlay" ).fadeIn( 1000, function() {
        $( ".playlist-page" ).css( "display", "block" );
        $( ".list-of-videos" ).remove();
        $( ".android-overlay" ).fadeOut( 1000, function() {
          $( this ).remove();
        });
      });
    }, 0 );
  };
  
  /**
   * Handles the tapping of a video thumbnail but updating the details and playing the video.
   * @param evt The event object associated with this tap event.
   */
  tabletVideosView.prototype.handleVideoThumbClick = function( evt ) {
    var $elem = $( evt.currentTarget ),
        videoIDX =  $( evt.currentTarget ).data("bc-video-idx"),
        video = this.videoAtIndex( videoIDX );
    
    $elem.siblings( ".active" )
         .removeClass( "active selectedVideoBorderColor" );
         
    $elem.addClass( "active selectedVideoBorderColor" );
    this.updateVideoPlayer( video );
  };

  /**
   * Stops the current video from playing and replaces it with the new video.
   * @param video The new video that should be played.
   */
  tabletVideosView.prototype.updateVideoPlayer = function( video ) {
    $( ".player-container" ).find( 'video' ).each( function() {
      this.pause();
      $( this ).remove();
    });
    
    $( ".player-container" ).html( this.videoPlayerHTML( video ) );
  };

  /**
   * Handles the building of the list of videos and adding the approriate CSS classes to the elements.
   * @param evt The event object that was triggered from a tap event.
   */
  tabletVideosView.prototype.handlePlaylistTap = function( evt ) {
    var $elem = $( evt.currentTarget );
    if( bc.context.os !== "android" ) {
      $elem.addClass( "bc-active" );    
      $elem.find( ".header-b" ).addClass( "bc-active" );
      $elem.find( ".desc-a" ).addClass( "bc-active" );
    }
    this.indexOfCurrentPlaylist = $elem.attr( "data-bc-playlist-idx" );     
    this.buildListOfVideos( this.data[ this.indexOfCurrentPlaylist ], false );
  };

  /**
   * Returns the HTML snippet for the player embed code.
   * @param video An object that represents the video data.
   * @return The HTML snippet representing the video player.
   */
  tabletVideosView.prototype.videoPlayerHTML = function( video ) {
    var playerHTML = "<div class='player-container vertical-center'>";
    playerHTML += "<div class='player-frame'>";
    playerHTML += this.brightcovePlayerHTML( video.id );
    playerHTML += "<h3 class='header-a ellipsis'>" + video.name + "</h3>";
    playerHTML += "</div>";
    playerHTML += "</div>";
    return playerHTML;
  };

  /**
   * Generates the HTML snippet for the video thumbnail strip.
   * @param videos An array of video objects that contain the data for each video.
   * @return The HTML snippet that represents the video thumb strip.
   */
  tabletVideosView.prototype.videosThumbStripHTML = function( videos ) {
    
    return ( bc.context.os === "android" ) ? this.androidVideoThumbStripHTML( videos ) : this.iosVideoThumbStripHTML( videos );
    
  };

  /**
   * The HTML snippet for android tablets.
   * @param videos An array of video objects.
   */
  tabletVideosView.prototype.androidVideoThumbStripHTML = function( videos ) {
     var widthOfEachVideo = 222,
          width = videos.length * widthOfEachVideo,
          html = "<div id='thumb-strip' class='android-thumb-strip' ><ul>";    

                videos.forEach( function( video, idx, arr ) {
                  html +=  "<li data-bc-video-idx='" + idx + "' data-video-url='" + video.FLVURL + "' class='" + ( ( idx === 0 ) ? 'active selectedVideoBorderColor' : '' ) + "'>" +
                              "<img src='" + video.thumbnailURL + "' class='thumbnail'/>" +
                              "<h4 class='header-a ellipsis videoNameColor'>" + video.name + "</h4>" +
                            "</li>";
                });

      html += "</ul></div>";
      return html;
  };
  
  /**
   * The HTML snippets for the iOS video thumb strip.
   * @param videos An array of video objects.
   */
  tabletVideosView.prototype.iosVideoThumbStripHTML  = function( videos ) {
    var widthOfEachVideo = 222,
        width = videos.length * widthOfEachVideo,
        html = "<div class='thumb-strip-container vertical-center'><div id='thumb-strip'><ul style='width:" + width + "px'>";    

    for( var i = 0, len = videos.length; i < len; i++ ) {
      html +=  "<li data-bc-video-idx='" + i + "' data-video-url='" + videos[i].FLVURL + "' class='" + ( ( i === 0 ) ? 'active selectedVideoBorderColor' : '' ) + "'>" +
                  "<img src='" + videos[i].thumbnailURL + "' class='thumbnail'/>" +
                  "<h4 class='header-a ellipsis videoNameColor'>" + videos[i].name + "</h4>" +
               "</li>";
    }

    html += "</ul></div></div>";
    return html;
  };

  /**
   * Generates the HTML snippet for the list of videos HTML.
   * @param videos An array of video objects that contain the data for each video.
   * @return The HTML snippet that represents the videos page.
   */
  tabletVideosView.prototype.listOfVideosHTML = function( videos ) {
    // TODO: what is the best way to capture width of img from CSS + padding.  What if people change CSS?
    var width = videos.length * 102,
                html = "<div class='radial-background videos-page'>";

    html += this.videoPlayerHTML( videos[0] );
    html += this.videosThumbStripHTML( videos );

    html += "</div>";
    return html;
  };

  /**
   * Generates and injects the HTML for the list of videos page.  If there is only one playlist associated with this view then
   * this will be the first page, otherwise it will be transitioned to and a back button will be drawn in the upper left hand corner.
   * @param playlist The playlist object that contains the data needed to build this HTML.
   * @param firstPage A boolean indicating if this is the first page being shown to the user.
   */
  tabletVideosView.prototype.buildListOfVideos = function( playlist, firstPage ) {
    var html = "";

    if( !firstPage ) {
      html = "<section id='playlist_" + this.indexOfCurrentPlaylist + "' class='list-of-videos page " + ( bc.context.os === 'android' ? 'page-android' : "" ) + "'>";
    }

    html += bc.ui.headerHTML( { "title": playlist.name, "backButton": !firstPage } );
    html += this.listOfVideosHTML( playlist.videos );

    if( !firstPage ) {
      html += "</section>";
      if( bc.context.os === "android" ) {
        this.androidShowNextPage( html );
      } else {
        bc.ui.forwardPage( html );
      }
      
    } else if( bc.ui.currentPage ) {
      bc.ui.currentPage.addClass( "playlist-page" );
      this.element.html( html );
    } 

    if( bc.context.os !== "android" && $( "#thumb-strip" ).length > 0 ) {
      this.thumbnailScroller = new iScroll( "thumb-strip", { hScroll: true, vScroll: false, hScrollbar: false, vScrollbar: false } );
    }
    
  };
  
  /**
   * On android tablets the default animations are not smooth, so instead a fade is used to mask
   * any rendering oddities while the new HTML is injected into the DOM.
   * @param html The HTML that represents the new "page" that is going to appear.
   */
  tabletVideosView.prototype.androidShowNextPage = function( html ) {
    $( "<div class='android-overlay'></div>" ).appendTo( "body" );
    
    //Wrap this in a setTimeout so that the android-overlay is drawn to screen
    setTimeout( function() {
      $( ".android-overlay" ).fadeIn( 1000, function() {
        $( "body" ).append( html );
        $( ".playlist-page" ).css( "display", "none" );
        $( ".android-overlay" ).fadeOut( 1000, function() {
          $( this ).remove();
        });
      });
    }, 0 );
  };

  /**
   * Gets the video object from the currentPlaylist.
   * @param videoIDX The index of the video that appears in the playlist.
   * @return The video object that corresponds to the index passed in.
   */
  tabletVideosView.prototype.videoAtIndex = function( videoIDX ) {
    var playlist = this.currentPlaylist(),
        video;

    if ( playlist ) {
      video = playlist.videos[ videoIDX ];
    }
    return video;    
  };

  /**
   * Gets the current playlist for the view.
   * @return The playlist object for the current playlist.
   */
  tabletVideosView.prototype.currentPlaylist = function() {
    var currentPlaylist;
    if ( this.data ) {
      currentPlaylist = this.data[ this.indexOfCurrentPlaylist ];
    }

    return currentPlaylist;
  };

  return tabletVideosView;  

})( bc.lib.jQuery );