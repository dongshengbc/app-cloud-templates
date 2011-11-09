/*global bc:true atob:false*/
/*jshint indent:2, browser: true, white: false devel:true undef:false*/
/**
 * A photoGalleryView is a view that presents a collection of photos.  The view will show an initial screen of a grid thumbnails.
 * When the user taps a thumbnail they will transition to a new screen that shows the fullsize image that then allows the user to swipe through the
 * images.  Tapping this screen will hide/show the details for this image.
 *
 * @class A photoGalleryView is a view that presents a collection of photos.  The view will show an initial screen of a grid thumbnails.
 * When the user taps a thumbnail they will transition to a new screen that shows the fullsize image that then allows the user to swipe through the
 * images.  Tapping this screen will hide/show the details for this image.
 * @constructor
 * @param options An object of the possible options for this view.  Currently the only option available is the element that this view should load into.  By default this will be the body tag.
 * @param ignore
 * { @list Styles: gridBackgroundColor, sliderBackgroundColor, descriptionTextColor }
 * @example new photoGalleryView( document.getElementById( "photoGallery" ) );
 * @return  A new photoGalleryView instance.
 *
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js    
 */
var photoGalleryView = ( function( $, undefined ) {
  var _albumData = [],
      _isSliding,
      _orientation,
      _overlayShowing = true,
      _width,
      _height,
      _defaults = { "element": "body" },
      PADDING_BETWEEN_THUMBNAILS = 6,
      DEFAULT_NUMBER_OF_THUMBS_PER_ROW = 2,
      _emptyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NzM5MUE4Q0JFMzhCMTFFMEE2MkNCNzAzMDM3NjE0M0UiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NzM5MUE4Q0NFMzhCMTFFMEE2MkNCNzAzMDM3NjE0M0UiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo3MzkxQThDOUUzOEIxMUUwQTYyQ0I3MDMwMzc2MTQzRSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo3MzkxQThDQUUzOEIxMUUwQTYyQ0I3MDMwMzc2MTQzRSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Phf80ecAAAAQSURBVHjaYvj//z8DQIABAAj8Av7bok0WAAAAAElFTkSuQmCC";
      
  /**
   * @private
   */
  function photoGalleryView( options ) {    
    
    _settings = $.extend( {}, _defaults, options );
    
    this.element = $( _settings.element ).addClass( "photo-gallery-thumbnail-grid" );
    
    this.handlePageContainer();
    
    //The index of the current photo
    this.indexOfCurrentImag = undefined;
    
    //The callback to stop tracking photo viewing events.
    this.endPhotoViewingEventCallback = undefined;

    //Do not allow the page to scroll
    document.addEventListener( "touchmove", function( evt ) { evt.preventDefault(); } );
    
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
  photoGalleryView.prototype.initialize = function() {
    //The width of the viewport
    _width = bc.ui.width();
    
    //The height of the viewport
    _height = bc.ui.height();
    
    // The current view orientation
    _orientation = bc.context.viewOrientation;
    
    //register our event listeners for this view.
    this.registerEventListeners();
    
    bc.core.applyStyles();
    
    //Allow this view to rotate in all directions.
    bc.device.setAutoRotateDirections( ['all'] );
    
    this.render( bc.core.cache( bc.viewID + "_photogallery_data" ) );
    
    bc.core.getData( "photos"
      , $.proxy( function( data ) {
        this.render( data );
        }, this )
      , $.proxy( function() {
        this.handleNoData();
        }, this )
    );
  };
  
  /**
   * Creates the default page container for this view.
   * @param element The element to render the view inside.
   */
  photoGalleryView.prototype.handlePageContainer = function( element ) {
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
   * Responsible for building out the initial page the user is shown, in this example it is the grid of thumbnails.
   */
  photoGalleryView.prototype.render = function( data ) {
    var html;
    
    //If the data is not new we should just return
    if( data !== undefined && data === this.data ) {
      //No need to the draw the UI if we have no new data.
      return;
    }
    
    if( !data && !this.data ) {
     this.element.html( bc.ui.spinner() );
     return;
    }
    
    this.data = data;
    bc.core.cache( bc.viewID + "_photogallery_data", data );
    html = this.headerHTML( { "title": "Photos" } );
    html += this.thumbnailGridHTML();
    this.element.html( html );
    
    bc.ui.enableScrollers();
  };
  
  /**
   * If there is an error getting data handleNoData is called.  If we are in the studio then we want to show the spinner again.
   */
  photoGalleryView.prototype.handleNoData = function( data ) {
    //If we are in preview mode then show the spinner, otherwise do nothing
    if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
      this.element.html( bc.ui.spinner() );
    }
  };
  
  /**
   * Builds the new page for the slide show and transitions to it.  Note that the actual images are populated when the
   * device has gone full screen, this is for positioning purposes.
   */
  photoGalleryView.prototype.buildSlideShow = function() {
    var html = this.slideShowHTML( this.indexOfCurrentImage );
    bc.ui.forwardPage( html );
    if( bc.metrics !== undefined ) {
      this.endPhotoViewingEventCallback = bc.metrics.live( "photo-view", { "name": this.data[this.indexOfCurrentImage].media_title } );
    }
    $( bc ).one( "pageshow", $.proxy( this.createCarousel, this ) );
  };
  
  /**
   * Enables scrolling for this view and sets the current image to the correct site.
   */
  photoGalleryView.prototype.createCarousel = function() {
    var currentImageIndex = this.indexOfCurrentImage;
    this.slider = new iScroll( $( ".slider" )[0], {
      snap: true, 
      momentum: false,
      hScrollbar: false,
      vScrollbar: false,
      vScroll: false,
      onScrollEnd: $.proxy( function( e ) {
       this.handleScrollTo( this.slider.currPageX );
      }, this ) 
    } );
    this.slider.scrollToPage( currentImageIndex, 0, 0 );
  };
  
  /**
   * Registers all of the event listeners for this view.  Note that these are registered as delegates so that the DOM can change without
   * having to rebind all of our event listeners.
   */
  photoGalleryView.prototype.registerEventListeners = function() {

    //register event listener for when new data is fetched
    $( bc ).bind( "newconfigurations", $.proxy( function( evt, info ) {
        this.handleNewConfigurationInfo( info );
      }, this ) 
    );

    //Listen for when a thumbnail is clicked
    $( "body" ).delegate( ".thumbnail", "tap", $.proxy( function( evt ) {
      this.thumbnailTap( evt );
    }, this) );
    
    //Bind to the back button.
    $( "body" ).delegate( ".back-button", "tap", $.proxy( function( evt ) {
      this.handleBackButtonTap( evt );
    }, this ) );
    
    //Register for tap events on the slideshow
    $( "body" ).delegate( ".slideshow-page", "tap", $.proxy( function( evt ) {
      this.toggleOverlay( evt );
    }, this ) );
    
    //Register event listeners for when the user rotates the device and update our scrollers when they do.
    $( bc ).bind( "vieworientationchange", $.proxy( function( evt, data ) {
      this.handleOrientationChange( data );
    }, this ) );
    
    $( bc ).bind( "viewfocus", $.proxy( function( evt ) {
      this.handleViewFocus( evt );
    }, this ) );
    
    $( bc ).bind( "viewblur", $.proxy( function( evt ) {
      this.handleViewBlur( evt );
    }, this ) );
    
  };
  
  /**
   * The function that is called when there are new styles, settings or data available for this view.
   * @param info An object that has the current styles, settings and data for this view.  For example
   * info object.
   <pre> 
   { 
    "data": { ... },
    "styles": { ... },
    "settings": { ... }
   }
   </pre>
   */
   /**
    * Function to handle new data becoming available to the view.  When new data comes in
    * the view will go through and render itself again with the new data.
    */
   photoGalleryView.prototype.handleNewConfigurationInfo = function( info ) {
     if ( info.status !== "error" && info.styles.isNew ) {
        bc.core.applyStyles( info.styles.values );
     }    
   };
  
  /**
   * When a back button is clicked within this view the handleBackButtonTap function is called.
   * @param evt The event object for this tap event handler.  This is a typical event object.
   */
  photoGalleryView.prototype.handleBackButtonTap = function( evt ) {
    if( bc.ui.currentPage.hasClass( "slideshow-page" ) ) {
      bc.device.exitFullScreen();
    }
    
    bc.ui.backPage();
    
    if( this.endPhotoViewingEventCallback !== undefined ) {
      this.endPhotoViewingEventCallback();
    }
    this.indexOfCurrentImage = undefined;
  };
  
  /**
   * Handles updating the UI when the orientation of the device changes.
   * @param direction The direction of the new orientation.
   */
  photoGalleryView.prototype.handleOrientationChange = function( data ) {
    var direction = data.orientation;
    if( direction === _orientation ) {
      return;
    }

    _orientation = direction;
    this.handleViewPortChange();
    this.updateUIOnOrientationChange();
  };
  
  /**
    * Called when the "view" gains focus.  (a view being defined in the manifest.xml file.)
    * @param evt The event object that was fired with this event.
    */
   photoGalleryView.prototype.handleViewFocus = function( evt ) {
     if( this.indexOfCurrentImage !== undefined && bc.metrics !== undefined ) {
       this.endPhotoViewingEventCallback = bc.metrics.live( "photo-view", { "name": this.data[this.indexOfCurrentImage].media_title } );
     }
   };

   /**
    * Called when this "view" loses focus.  This occurs when the user switches to a different "view".  (a view being defined in the manifest.xml file.)
    * @param evt The event object that was fired with this event.
    */
   photoGalleryView.prototype.handleViewBlur = function( evt ) {
     //If we have a article viewing event then we need to kill it.
     if( this.endPhotoViewingEventCallback !== undefined ) {
       this.endPhotoViewingEventCallback();
     }
   };
  
  photoGalleryView.prototype.handleScrollTo = function( newIndex ) {
    var $elem;
    if( newIndex === this.indexOfCurrentImage ) {
      $elem = $( "#" + newIndex + "_wrapper" ).removeClass( "hidden" );
      $elem.next().removeClass( "hidden" );
      $elem.prev().removeClass( "hidden" );
      return;
    }
    
    //If we have moved more then one "page" then we should reload all of the images.
    if( Math.abs( this.indexOfCurrentImage - newIndex ) > 1 || $( "#" + newIndex + "_wrapper" ).hasClass( "hidden" ) ) {
      this.resetScroller( newIndex );
      return;
    }
    
    if( newIndex < this.indexOfCurrentImage ) {
      this.unloadImage( $( "#" + ( this.indexOfCurrentImage + 1) + "_wrapper" ).addClass( "hidden" ) );
      if( newIndex !== 0) {
        $( "#" + ( newIndex - 1) + "_wrapper" ).removeClass( "hidden" );
        this.loadImage( $( "#" + ( newIndex - 1) + "_wrapper" ) );
      }
    } else {
      this.unloadImage( $( "#" + ( this.indexOfCurrentImage - 1) + "_wrapper" ).addClass( "hidden" ) );
      if( newIndex < this.data.length ) {
        $( "#" + ( newIndex + 1) + "_wrapper" ).removeClass( "hidden" );
        this.loadImage( $( "#" + ( newIndex + 1 ) + "_wrapper" ) );
      }
    }
    this.indexOfCurrentImage = newIndex;
    this.updateOverlayMetaData();
  };
  
  photoGalleryView.prototype.resetScroller = function( newIndex ) {
    var $elem = $( "#" + newIndex + "_wrapper" );
    $( ".image-wrapper:not(.hidden)" ).each( $.proxy ( function( index, element ) {
        this.unloadImage( $( element ).addClass( "hidden" ) );
        }, this )
      );
    
    
    $elem.removeClass( "hidden" );
    this.loadImage( $( "#" + newIndex + "_wrapper" ) );
    
    if( newIndex < this.data.length ) {
      $elem.next().removeClass( "hidden" );
      this.loadImage( $( "#" + ( newIndex + 1 ) + "_wrapper" ) );
    }
    
    if( newIndex !== 0 ) {
      $elem.prev().removeClass( "hidden" );
      this.loadImage( $( "#" + ( newIndex - 1 ) + "_wrapper" ) );
    }
    
    this.indexOfCurrentImage = newIndex;
    this.updateOverlayMetaData();
  };
  
  /**
   * Updates the header and description to reflect the current image.  Occurs after the image has finished its animation.
   */
  photoGalleryView.prototype.updateOverlayMetaData = function() {
    $( ".overlay-header h1" ).html( ( this.indexOfCurrentImage + 1) + " of " + this.data.length );
    $( ".overlay-description p" ).html( bc.utils.stripTags( this.data[this.indexOfCurrentImage].media_description ) );
  };
  
  /**
   * Toggles the display of the overlay.
   * @param evt The event that was triggered from this event.  This is a typical event object.
   */
  photoGalleryView.prototype.toggleOverlay = function( evt ) {
    //TODO - perhaps I should put a blocker in to check if we are fading an if we are not do anything?  
    if( _overlayShowing ) {
      _overlayShowing = false;
      $( ".overlay-header" ).addClass( "hide" );
      $( ".overlay-description" ).addClass( "hide" );
    } else {
      _overlayShowing = true;
      $( ".overlay-header" ).removeClass( "hide" );
      $( ".overlay-description" ).removeClass( "hide" );
    }
  };
  
  /**
   * When a user taps a thumbnail we insert and transition to the slide show page.  
   * @param evt The event that was triggered from this event.  This is a typical event object.
   */
  photoGalleryView.prototype.thumbnailTap = function( evt ) {
    this.indexOfCurrentImage = $( evt.currentTarget ).data( "bc-index" );
    this.buildSlideShow();
    bc.device.enterFullScreen( $.proxy( function() {
      this.handleViewPortChange();
      this.loadImagesIntoSlideShow();
    }, this ), 
    $.proxy( function() {
      this.loadImagesIntoSlideShow();
    }, this ) );
  };
  
  /**
   * Updates the width and height.
   */
  photoGalleryView.prototype.handleViewPortChange = function() {
    _width = bc.ui.width();
    _height = bc.ui.height();
  };
  
  /**
   * When the orientation of the device changes we need resize the images appropriately.
   */
  photoGalleryView.prototype.updateUIOnOrientationChange = function() {
    var thumbnailWidth = this.calculateWidthOfThumbnail();
    _width = bc.ui.width();
    _height = bc.ui.height();
    $( ".photo-gallery-thumbnail-grid .thumbnail" ).width( thumbnailWidth );
    $( ".photo-gallery-thumbnail-grid .thumbnail" ).height( this.calculateHeightOfThumbnail( thumbnailWidth ) );
    //If we are on the 
    if( bc.ui.currentPage.hasClass( "slideshow-page" ) ) {
      $( ".image-wrapper" ).width( _width );
      $( ".slider > div" ).width( _width * this.data.length );
      if( this.slider ) {
        this.slider.refresh();
        this.slider.scrollToPage( this.indexOfCurrentImage, 0, 0 );
      }
      this.resetScroller( this.indexOfCurrentImage );
    }
    
    //TODO - remove this line once https://www.pivotaltracker.com/story/show/12947617 is fixed.
    bc.ui.refreshScrollers();
  };
  
  /**
   * Load the images into the slide show.
   */
  photoGalleryView.prototype.loadImagesIntoSlideShow = function() {
    this.loadImage( $( "#" + this.indexOfCurrentImage + "_wrapper" ) );
    
    if( this.indexOfCurrentImage !== 0 ) {
      this.loadImage( $( "#" + ( this.indexOfCurrentImage - 1 ) + "_wrapper" ) );
    }
    
    if( this.indexOfCurrentImage !== (this.data.length - 1)) {
      this.loadImage( $( "#" + ( this.indexOfCurrentImage + 1 ) + "_wrapper" ) );
    }
  };
  
  /**
   * Loads the image off screen to get the dimensions and then inserts into the slide show.
   * @param image An object that has an ID and a URL to the image.  For example { "id": "37", "url": "http://picture.to.honeybadger" }
   */
  photoGalleryView.prototype.loadImage = function( $elem ) {
    var $img = $elem.find( "img" )
      , index = $img.data( "index" )
      , $imageLoader = $( "<img id='#" + index + "_loader' data-bc-index='" + index + "' src='" + $img.data( "still" ) + "' class='offscreen' />" );
    
    $imageLoader.appendTo('body')
                .one('load', $.proxy( function( evt ) {
                  this.insertImageIntoSlideShow( evt.currentTarget );
                } , this ) );
  };
  
  photoGalleryView.prototype.unloadImage = function( $elem ) {
    var $img = $elem.find( "img" );
    //$img.attr( "src", "" );
    $img.attr( "src", _emptyImage );
  };
  
  /**
   * Responsible for positioning and sizing the image correctly within the slide show.
   * @param elem The image that is to be inserted into the slide show.
   */
  photoGalleryView.prototype.insertImageIntoSlideShow = function( imageLoadedOffScreen ) {
    var $imageLoadedOffScreen = $( imageLoadedOffScreen ),
        index = $imageLoadedOffScreen.data( "bc-index" ),
        imageType = this.landscapeOrPortrait( $imageLoadedOffScreen.height(), $imageLoadedOffScreen.width() ),
        $image = $( "#" + index + "_wrapper > img" ),
        top;
    if( $image.length > 0 ) {
      if( imageType === "landscape" ) {
        top = ( _width * $imageLoadedOffScreen.height() / $imageLoadedOffScreen.width() );
        $image.css( "margin-top", ( -top/2 ) + "px" );
        $image.removeClass( "portrait" )
              .addClass( "landscape" );
      } else {
        $image.css( "margin-top", "0px" );
        $image.removeClass( "landscape")
              .addClass( "portrait" );
      }
      $image.attr( "src", $image.data( "still" ) );
    }
    
    $imageLoadedOffScreen.attr( 'src', '' )
                         .delay(100)
                         .remove();
  };
  
  /**
   * Determines if the image should be displayed as portrait or landscape.
   * @param height The height of the image that we are determining should be shown as portrait or landscape.
   * @param width The width of the image that we are determining should be shown as portrait or landscape.
   */
  photoGalleryView.prototype.landscapeOrPortrait = function( height, width ) {
    return ( ( height / width ) > _height / _width ) ? "portrait" : "landscape";
  };
  
  /**
   * Generates the HTML snippet for the header. 
   * @param options An object that represents the settings that can be overridden for this HTML snippet.  Below are the default values.
   <pre>
   {
     "backButton": false, //A boolean for whether or not to show a back button.
     "shareButton": false, //A boolean for whether or not to show a share button.
     "refreshButton": false, //A boolean for whether or not to show a refreshButton.
     "title": ""
   }
   </pre>
   @return A string that is the HTML snippet for the header.
   */
  photoGalleryView.prototype.headerHTML = function( options ) {
    var html = "",
        settings = {
          "backButton": false,
          "shareButton": false,
          "refreshButton": false,
          "title": "",
          "className": "header"
        };
    
    $.extend( settings, options );
    
    html = "<header class='" + settings.className + "'>";
    
    if( settings.backButton ) {
      html += "<div class='back-button'></div>";
    }
    
    html += "<h1 class='header-a'>" + settings.title + "</h1>";
    
    if( settings.shareButton ) {
      html += "<div class='share-button'></div>";
    }
    
    if( settings.refreshButton ) {
      html += "<div class='refresh-button'></div>";
    }
    
    return ( html += "</header>" );        
  };
  
  /**
   * Build out the HTML string for the thumbnailGrid page.
   */
  photoGalleryView.prototype.thumbnailGridHTML = function() {
    var html = "",
        imageWidth = this.calculateWidthOfThumbnail(),
        imageHeight = this.calculateHeightOfThumbnail( imageWidth );
    
    html = "<section class='scroller gridBackgroundColor'>" +
             "<div class='thumbnail-container'>";
        
    for( var i = 0, len = this.data.length; i < len; i++ ) {
      html += "<img src='" + this.data[i].media_thumbnail_url + "' alt='thumb' class='thumbnail' data-bc-index='" + i + "' style='width: " + imageWidth + "px; height: " + imageHeight + "px' />";
    }
    
    html +=  "</div>" +
            "</section>";
            
    return html;
  };
  
  /**
   * Generates the HTML snippet for the slide show.
   */
  photoGalleryView.prototype.slideShowHTML = function( index ) {
    var html = "",
        headerText = ( index + 1 ) + " of " + this.data.length,
        width = this.data.length * _width;
    
    html = "<section class='page slideshow-page'>" +
            "<div class='slideshow-container slider'>" +
              "<div style='width: " + width +"px'>";
    
    for( var i=0, len=this.data.length; i < len; i++ ) {
      html += this.imageWrapperHTML( { "index": i } );
    }
              
    html +=   "</div>" +
            "</div>" +
            "<div class='overlay-header'>" +
              this.headerHTML( { "title": headerText, "class": "", "backButton": true } ) +
            "</div>" +
            "<div class='overlay-description'>" +
              "<p class='descriptionTextColor'>" + bc.utils.stripTags( this.data[index].media_description ) + "</p>" +
            "</div>" +
            "</section>";

    return html;
  };
  
  /**
   * Generates the HTML snippet for the image wrapper.
   */
  photoGalleryView.prototype.imageWrapperHTML = function( options ) {
    var settings = { "index": 0 }
      , html
      , imageType
      , top
      , aspectRatioOfThumbnails;
    
    aspectRatioOfThumbnails = bc.core.getSetting( "aspectRatioOfThumbnails" );
    imageType = ( aspectRatioOfThumbnails > ( _height / _width ) ) ? "portrait" : "landscape";
    if( imageType === "landscape" ) { 
      top = ( _width * aspectRatioOfThumbnails ) / -2;
    }
    
    $.extend( settings, options );
    html = "<div id='" + ( settings.index ) + "_wrapper' data-bc-index='" + settings.index + "' style='width:" + _width + "px' class='hidden image-wrapper sliderBackgroundColor'>" +
              "<p>Loading...</p>" +
              "<img src='" + _emptyImage + "' class='" + imageType + "' style='margin-top: " + top + "px' data-index='" + settings.index + "' data-thumb='" + this.data[settings.index].media_thumbnail_url + "' data-still='" + this.data[settings.index].media_content_url + "'/>" +
            "</div>";
    return html;
  };
  
  /**
   * Calculates the width of thumbnail to fit within the width of the device.
   * @param width The width of the viewport.
   */
  photoGalleryView.prototype.calculateWidthOfThumbnail = function( width ) {
    var thumbsPerRow = ( bc.core.getSetting( "thumbnailsPerRow" ) !== undefined ) ? bc.core.getSetting( "thumbnailsPerRow" ) : DEFAULT_NUMBER_OF_THUMBS_PER_ROW;
    width = width || bc.ui.width();
    
    return Math.floor(( width - ( thumbsPerRow * 2 * PADDING_BETWEEN_THUMBNAILS) ) / thumbsPerRow);
  };
  
  /**
   * Calculates the height of the thumbnail.
   * @param width The width of the thumbnail.
   */
   photoGalleryView.prototype.calculateHeightOfThumbnail = function( width ) {
     //Defaulting to one for the aspect ratio.
     return ( bc.core.getSetting( "aspectRatioOfThumbnails" ) !== undefined ) ? width * bc.core.getSetting( "aspectRatioOfThumbnails" ) : width;
   };
  
  /**
   * @private
   */
  photoGalleryView.prototype.setPrivateVariables = function( options ) {
    for( var prop in options ) {
      if( typeof options[prop] === "string" ) {
        eval( prop + " = '" + options[prop] + "'");
      } else {
        eval( prop + " = " + options[prop] );
      }
    }
  };
  
  return photoGalleryView; 

})( bc.lib.jQuery );