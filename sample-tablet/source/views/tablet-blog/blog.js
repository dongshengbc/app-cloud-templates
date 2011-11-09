/*global bc:true */
/*jshint indent:2, browser: true, white: false, undef:false*/

/**
 * @class A Tablet Blog view is capable of taking a list of articles that it then displays a grid like layout.
   The user can then swipe through the pages to view a synposis of the different articles.  If a user taps on an article it will open in a
   module window in which the user can then scroll through it.
 *
 * @constructor
 * @param options An object of the possible options for this view.  Currently the only option available is the element that this view should load into.  By default this will be the body tag.
 * @param ignore
 * @return A new tabletBlogView
 *
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js  
 */
var tabletBlogView = ( function( $, undefined) {
  //The number of "zones" articles per page.
  var ARTICLES_PER_PAGE = 5,
      ARTICLE_PADDING = 30,
      _defaults = { "element": "body" },
      _setting;
  /**
   * @private
   */
  function tabletBlogView( options ) { 
    _settings = $.extend( {}, _defaults, options );

    this.element = $( _settings.element );
    
    /** The index of the current article that is being viewed by the user */
    this.currentArticleIndex = undefined;
    
    /** The index of the current 'page' we are on for the view that shows the synopsis of each article */
    this.currentPageIndex = 0;

    /** The iScroll object for the article that is being viewed */
    this.articleScroller = undefined;

    /* The iScroll object that allows the user to swipe horizontally through the "pages". */
    this.pageScroller = undefined;
    
    /** The callback function to call when an article is stopped being viewed. */
    this.endArticleViewingEventCallback = undefined;
    
    /** Keeps track of the users font size preference. */
    this.fontSizePreference = bc.core.cache( "font-size-preference" ) || "medium";
    
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
  tabletBlogView.prototype.initialize = function() {
    bc.core.applyStyles();
    
    /** Tell the container that this view will support rotating in all directions */
    bc.device.setAutoRotateDirections( ["all"] );
    
    this.registerEventListeners();
    
    this.buildLayout( bc.core.cache( bc.viewID + "_blog_data" ) );
    
    bc.core.getData( "blog"
      , $.proxy( function( data ) {
          this.buildLayout( data );
          }, this )
      , $.proxy( function() {
          this.handleNoData();
          }, this ) 
    );
    
  };

  /**
   * buildLayout is responsible for building the HTML of the page that shows the synopsis of each article and allows the user to swipe
   * between the different pages.  If there is not data available yet then we show the spinner.
   */
  tabletBlogView.prototype.buildLayout = function( data ) {
    var html,
        numberOfPages,
        currentView,
        $viewHTML,
        currentZone = 0,
        $html,
        $wrapper;
        
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
    
    bc.core.cache( bc.viewID + "_blog_data", data );
    
    $viewHTML = $( "<section class='tablet-screen layout-style-" + this.getLayoutStyle( this.data[0] ) + "' style='width: " + bc.ui.width() + "px'></section>" );
    
    $html = this.layoutHTML();
    $wrapper = $html.find( ".wrapper" );
    
    for( var i = 0, len = this.data.length; i < len; i++ ) {
      if( currentZone === ARTICLES_PER_PAGE ) {
        currentZone = 1;
        $wrapper.append( $viewHTML );
        $viewHTML = $( "<section class='tablet-screen layout-style-" + this.getLayoutStyle( this.data[i] ) + "' style='width: " + bc.ui.width() + "px'></section>" );
      } else if( currentZone < ARTICLES_PER_PAGE ) {
        currentZone++;
      }
      $viewHTML.append( this.getZoneHTMLForArticle( this.data[i], $( "<div class='zone border-a zone" + currentZone + "' data-bc-index='" + i + "'></div>" ) ) );
    }
    
    //If we do not have an even number of articles we need append the current page of articles.
    if( 0 < currentZone < ARTICLES_PER_PAGE ) {
      $wrapper.append( $viewHTML );
    }
    
    this.element.html( $html );

    $( ".tablet-screen" ).height( bc.ui.height() - $( ".header" ).height() - $( ".pagination-container" ).height() );
    
    this.positionElementsWithinZones();
    
    this.enableScrolling();
  };
  
  /**
   * If there is an error getting data handleNoData is called.  If we are in the studio then we want to show the spinner again.
   */
  tabletBlogView.prototype.handleNoData = function() {
    //If we are in preview mode then show the spinner, otherwise do nothing
    if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
      this.element.html( bc.ui.spinner() );
    }
  };
  
  /**
   * Enables scrolling / paging for the layout view of the view.  This is what allows the user to swipe through the various "pages".  A page consisting of
   * a collection of 5 articles.
   */
  tabletBlogView.prototype.enableScrolling = function() {
    //If this is not an iOS device, IE iPAD, then we can should not use scrolling as the device not perform well enough for this to look good.
    if( bc.context.os !== "ios" ) {
      return;
    }
    
    if( $( ".page-scroller" ).length === 0 ) {
      return;
    }
    
    this.pageScroller = new iScroll( $( ".page-scroller" )[0], {
      snap: true, 
      momentum: false,
      hScrollbar: false,
      vScrollbar: false,
      vScroll: false,
      onScrollEnd: $.proxy( function( e ) {
        this.updateActivePageIndicator( this.pageScroller.currPageX );
      }, this ) 
    } );
  };
  
  /**
   * Responsible for handling the page indicator for which page we are on.
   * @param activePageIndex The active page index.
   */
  tabletBlogView.prototype.updateActivePageIndicator = function( activePageIndex ) {
    $( ".pagination-container .active" ).removeClass( "active background-b border-b" )
                                        .addClass( "border-a background-a" );

    $( ".page-indicator:eq(" + activePageIndex + ")" ).removeClass( "background-a border-a" )
                                                     .addClass( "background-b border-b active" );
  
    if( bc.context.os === "android" ) {
      ( this.currentPageIndex === 0 ) ? $( ".pagination-container .prev" ).addClass( "hide" ) : $( ".pagination-container .prev" ).removeClass( "hide" );
      ( this.currentPageIndex === Math.ceil( this.data.length / ARTICLES_PER_PAGE ) - 1 ) ? $( ".pagination-container .next" ).addClass( "hide" ) : $( ".pagination-container .next" ).removeClass( "hide" );
    }
  };
  
  /**
   * The layoutHTML function builds the wrapper for the entire layout for the view.  This includes the header and the area that will be 
   * swipable by the user.
   */
  tabletBlogView.prototype.layoutHTML = function() {
    var html = "<header class='header'>" +
                 "<h1 class='header-a'>" + bc.core.getSetting( "title" ) + "</h1>" +
               "</header>" +
               "<section class='page-scroller backgroundColor'>" +
                  "<div class='wrapper' style='width: " + ( bc.ui.width() * Math.ceil( this.data.length / ARTICLES_PER_PAGE ) ) + "px'></div>" +
                "</section>" +
                this.paginationHTML();
              
    return $( html );
  };
  
  /**
   * getLayoutStyle determines the type of layout we want to use for this particular "page".  Currently, there are three different styles that could be applied.
   * @param article The article that should be inspected to determine the layout style.
   */
  tabletBlogView.prototype.getLayoutStyle = function( article ) {
    if( article === undefined || article.description === undefined ) {
      return;
    }
    //We do not want dead space, so if the first article is short we should use a layout that doesn't give a lot of space to the first article.
    if( article.description.length < 300 ) {
      return 1;
    }
    return Math.floor( 3 * Math.random() ) + 1;
  };
  
  /** 
   * Build the HTML snippet that contains the paging indicators.
   */
  tabletBlogView.prototype.paginationHTML = function() {
    var numberOfPages = Math.ceil( this.data.length / ARTICLES_PER_PAGE ),
                        html = "";
        
        if( bc.context.os === "ios") {
          html =  "<div class='pagination-container'>" + 
                    "<ul style='width:" + ( numberOfPages * 30 ) + "px' >";
                      for( var i=0; i < numberOfPages; i++ ) {
                        html += "<li class='page-indicator " + ( ( i === 0 ) ? 'background-b border-b active' : 'background-a border-a' ) + "'></li>";
                      }          
          html +=   "</ul>" +
                  "</div>";
        } else {
          html =  "<div class='pagination-container'>" + 
                    "<div class='prev button-a border-b hide'>Previous</div>" +
                    "<ul style='width:" + ( numberOfPages * 30 ) + "px' >";
                      for( var i=0; i < numberOfPages; i++ ) {
                        html += "<li class='page-indicator " + ( ( i === 0 ) ? 'background-b border-b active' : 'background-a border-a' ) + "'></li>";
                      }          
          html +=   "</ul>" +
                    "<div class='next button-a border-b'>Next</div>" +
                  "</div>";
        }

    
    return html;
  };
  
  /**
   * resizeImage is responsible for resizing the image that appears in the synopsis of the article.  The reason for this is that we have limited space
   * within each section of the "zone", and we want to make sure that the text can appear correctly.
   * @param The HTML snippet of the zone of which we are going to position the images within.  Note that this is a jQuery object.
   */
  tabletBlogView.prototype.resizeImage = function( $zone ) {
    var $img = $zone.find( "img" ),
        zoneWidth = $zone.width(),
        zoneHeight = ( $zone.height() - $zone.find( "h1" ).height() ),
        imgHeight = $img.height(),
        imgWidth = $img.width(),
        newHeight,
        newWidth;
    
    //If the image is taking up more then 70% of the real estate shrink it.
    if( ( imgWidth * imgHeight ) / (zoneWidth * zoneHeight ) > 0.7 ) {
      if( ( imgWidth / zoneWidth ) > ( imgHeight / zoneHeight ) ) {
        newWidth = Math.floor( zoneWidth * 0.5 );
        $img.width( newWidth);
        $img.height( Math.floor( ( newWidth * imgHeight ) / imgWidth ) );
      } else {
        newHeight = Math.floor( zoneHeight * 0.5 );
        $img.height( newHeight );
        $img.width( Math.floor( ( newHeight * imgWidth ) / imgHeight ) );
      }
      return;
    }
    
    //if the image takes up more then 80% of the width of the zone then we want to make it equal to the width of the zone
    if( imgWidth > ( zoneWidth * 0.8 ) ) {
      $img.width( zoneWidth );
      return;
    }
    
    //if the image takes up more then the height of the available area we want to make equal to the available height.
    if( imgHeight > zoneHeight ) {
      $img.height( zoneHeight );
      return;
    }
  };
  
  /**
   * positionElementsWithinZones iterates through each zone and calles positionElementWithinZone for each one.
   */
  tabletBlogView.prototype.positionElementsWithinZones = function() {
    var $zones = $( ".zone ");
    for( var i = 0, len = $zones.length; i < len; i++ ) {
      this.positionElementsWithinZone( $zones[i] );
    }
  };
  
  /**
   * positionElementsWithinZone is responsible for making sure that text does not get cut off half way between showing text,
   * and positioning the images.
   * @param The HTML snippet that represents the zone we are working with.
   */
  tabletBlogView.prototype.positionElementsWithinZone = function( zone ) {
    var $zone = $( zone ),
        $img = $zone.find( "img" ),
        zoneHeight,
        lineHeight = bc.utils.getNum( $zone.find( "p" ).css( "line-height" ) ),
        titleHeight = $zone.find( "h1" ).height() + 20,        // no magic numbers, this aint proserv
        imgHeight,
        imgWidth,
        heightAvailableToParagraph;
    
    //remove any previous heights set
    $zone.removeAttr( "style" );
    zoneHeight = $zone.height();
    
    this.resizeImage( $zone );

    imgHeight = $img.height();
    imgWidth = $img.width();
    
    //If the image is the width of the zone then the text is not going to wrap around and we need to take it into account.
    if( imgWidth === $zone.width() ) {
      heightAvailableToParagraph = Math.floor( ( zoneHeight - ( imgHeight + titleHeight ) ) / lineHeight ) * lineHeight;
      $zone.height( titleHeight + imgHeight + heightAvailableToParagraph );
    } else {
      heightAvailableToParagraph = Math.floor( ( zoneHeight - titleHeight ) / lineHeight ) * lineHeight;
      $zone.height( titleHeight + heightAvailableToParagraph );
    }
  };
  
  /**
   * Creates the HTML that represents the zone for this article.  A "zone" being a HTML snippet that consists of a title, description and 
   * an image if one exists.
   * @param The article data object.
   * @param The jQuery object that is the HTML element for this zone.
   */
  tabletBlogView.prototype.getZoneHTMLForArticle = function( article, $zone ) {
    var $content = $( "<div>" + article.description + "</div>" ),
        $title = $( "<h1 class='header-b headerTextColor'>" + article.title + "</h1>" );  
        
    //remove unwanted cruff
    this.contentCleanup( $content );
        
    $zone.append( $title)
         .append( this.getImage( $content ) )
         .append( "<p class='desc-a articleTextColor'>" + $content.text() + "</p>" );
             
    return $zone;
  };
  
  /**
   * In the article themselves there are often items that you may not render.  This maybe some tracking scripts, ads or other cruft.
   * This functions serves a way to remove any wanted elements before the article is injected into the page.
   * @param The article as a jQuery object.
   */
  tabletBlogView.prototype.contentCleanup = function( $article, options ) {
    var settings = { "removeScripts": true };
    $.extend( settings, options );
    $article.find( ".feedflare" ).remove();
    $article.find( "img[src*='feed.feedburner.com']" ).remove();
    
    if( settings.removeScripts ) {
      $article.find( "noscript" ).remove();
      $article.find( "script" ).remove();
      $article.find( "object" ).remove();
    }
  };
  
  /**
   * Searches through the images in the article finding a suitable one to provide in the synopsis.
   * @param The HTML element that represents this article as a jQuery object.
   */
  tabletBlogView.prototype.getImage = function( $content ) {
    var $images = $content.find( "img" ),
        $image;
        
    for( var i = 0, len = $images.length; i < len; i++ ) {
      if( $images[i].width > 1 && $images[i].height > 1 && $images[i].src.indexOf( "doubleclick" ) === -1 ) {
        return $images.eq( i ).attr( "align", "" );
      }
    }
    
    //If we did not find an image with a width and height greater then 1 then we can assume that they were not cached nor
    //do they have a width and height specified in the img tag so we need to load it offscreen in order to get its dimensions.
    for( i = 0; i < len; i++ ) {
      if( $images[i].width === 0 ) {        
        return $images.eq( i )
                      .one( "load", $.proxy( function( evt ) {
                        this.positionElementsWithinZone( $( evt.currentTarget).parent() );    
                      }, this ) );                        
      }
    }
  };

  /**
   * The event listeners for this particular view.
   */ 
  tabletBlogView.prototype.registerEventListeners = function() {         

    $( bc ).bind( "newconfigurations", $.proxy( function( evt, info ) {
        this.handleNewConfigurationInfo( info );
      }, this ) 
    );
       
    $( "body" ).delegate( ".zone", "tap", $.proxy( function( evt ) {
        this.loadStoryBoard( evt );
      }, this ) 
    );
    
    $( "body" ).delegate( ".close", "tap", $.proxy( function() {
      this.closeStoryBoard();
      }, this )
    );
    
    $( "body" ).delegate( ".font-size", "tap", $.proxy( function( evt ) {
        this.toggleFontOverlay( evt );
      }, this )
    );
    
    $( bc ).bind( "vieworientationchange", $.proxy( function( evt, data ) {
        this.handleViewOrientaitonChange( evt, data );
      }, this )
    );
    
    $( "body" ).delegate( ".page-up", "tap", $.proxy( function( evt ) {
        this.handlePageUp( evt );
      }, this ) 
    );
    
    $( "body" ).delegate( ".page-down", "tap", $.proxy( function( evt ) {
        this.handlePageDown( evt );
      }, this ) 
    );

    $( "body" ).delegate( ".text-overlay li", "tap", $.proxy( function( evt ) {
        this.handleFontSelection( evt );
      }, this ) 
    );
    
    $( bc ).bind( "viewfocus", $.proxy( function( evt ) {
      this.handleViewFocus( evt );
    }, this ) );
    
    $( bc ).bind( "viewblur", $.proxy( function( evt ) {
      this.handleViewBlur( evt );
    }, this ) );
    
    //If we are on an android tablet we need to register a swipe event as we are not using iscroll to page through the pages.
    if( bc.context.os === "android" ) {
      $( "body" ).delegate( ".wrapper", "swipe", $.proxy( function( evt, direction ) {
          this.handlePageSwipe( evt, direction );
        }, this )
      );
      
      $( "body" ).delegate( ".pagination-container .prev", "tap", $.proxy( function( evt ) {
          this.handlePrevButton( evt );
        }, this )
      );
      
      $( "body" ).delegate( ".pagination-container .next", "tap", $.proxy( function( evt ) {
          this.handleNextButton( evt );
        }, this )
      );
    }
    
  };
  
  /**
    * Function to handle new setting/styles becoming available to the view.  When new styles become available the view will call
    * applyStyles which will update the UI with the new styles.
    * @param evt The event object.
    * @param info The info object has the new settings and styles.
    */
   tabletBlogView.prototype.handleNewConfigurations = function( info ) {
     if ( info.status !== "error" && info.styles.isNew ) {
       bc.core.applyStyles( info.styles.values );
     }
   };
   
   /**
    * Updates the UI when a the device changes its orientation.
    * @param evt The event object.
    * @param data The data object for the view orientation change event.  This has the new width and height properties of the screen.
    */
   tabletBlogView.prototype.handleViewOrientaitonChange = function( evt, data ) {
     $( ".wrapper" ).width( data.width * Math.ceil( this.data.length / ARTICLES_PER_PAGE ) );
     $( ".tablet-screen" ).width( data.width )
                          .height( data.height - $( ".header" ).height() - $( ".pagination-container" ).height() );
                          
     $( ".storyboard .container" ).width( data.width - ARTICLE_PADDING )
                                  .height( data.height - ARTICLE_PADDING );

     setTimeout( $.proxy( function() {
       if( this.pageScroller ) {
          this.pageScroller.refresh();
          this.pageScroller.scrollToPage( this.pageScroller.currPageX, 0, 10 ); 
       }
       if( this.articleScroller ) {
         this.articleScroller.refresh();
       }
       
       if( bc.context.os === "android" ) {
         document.querySelector( ".wrapper" ).style["-webkit-transform"] = "translateX(-" + ( this.currentPageIndex * data.width ) + "px)";
       }
     }, this) , 0 );
     this.positionElementsWithinZones();
   };
   
   /**
    * Called when the "view" gains focus.  (a view being defined in the manifest.xml file.)
    * @param evt The event object that was fired with this event.
    */
   tabletBlogView.prototype.handleViewFocus = function( evt ) {
     if( this.currentArticleIndex !== undefined ) {
       this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].name } );
     }
   };
   
   /**
    * Called when this "view" loses focus.  This occurs when the user switches to a different "view".  (a view being defined in the manifest.xml file.)
    * @param evt The event object that was fired with this event.
    */
   tabletBlogView.prototype.handleViewBlur = function( evt ) {
     //If we have a article viewing event then we need to kill it.
     if( this.endArticleViewingEventCallback !== undefined ) {
       this.endArticleViewingEventCallback();
     }
   };
  
  /************************************************************************
   * STORY BOARD FUNCTIONS
   ***********************************************************************/
  
  /**
   * loadStoryBoard creates the area that the article will load into and animates into view.  It is also responsible for calling loadArticle once the
   * 'storyboard' has animated into view.
   * @param evt The event object fired from the tap event.
   */
  tabletBlogView.prototype.loadStoryBoard = function( evt ) {
    var $storyboard;
    this.currentArticleIndex = $( evt.currentTarget ).data( "bc-index" );
    $storyboard = $( this.storyBoardHTML() ).appendTo( "body" );
    
    $storyboard[0].style.webkitTransformOrigin = evt.pageX + "px " + evt.pageY + "px";
    
    //This needs to be in a setTimeout so that the element first renders scaled down and then gets the CSS change so that the animation is applied.
    setTimeout( function() {
      $storyboard.addClass( "storyboard-grow" );
    }, 0 );
    
    $storyboard.one( "webkitTransitionEnd", $.proxy( function() {
      this.loadArticle();
    }, this ) );
  };
  
  /**
   * The HTML for the story board page.
   */
   tabletBlogView.prototype.storyBoardHTML = function() {
     var html;
     
     if( bc.context.os === "ios" ) {
       html = "<div class='storyboard'>" + 
                 "<div class='container fullArticleBackgroundColor' style='width: " + ( bc.ui.width() - ARTICLE_PADDING )+ "px; height: " + ( bc.ui.height() - ARTICLE_PADDING ) + "px'>" +
                   "<header>" +
                     "<div class='button close button-a'>Close</div>" +
                     "<div class='button font-size button-a'><span class='large'>A</span><span class='small'>A</span></div>" +
                     "<a class='button web button-a' href='" + this.data[this.currentArticleIndex].link + "'>web</a>" +
                     "<div class='button page-up button-a'><div class='arrow'></div></div>" +
                     "<div class='button page-down button-a'><div class='arrow'></div></div>" +
                   "</header>" +
                   "<div class='overlay'></div>" +
                 "</div>" +
               "</div>";
     } else {
       html = "<div class='storyboard android'>" + 
                 "<div class='container fullArticleBackgroundColor'>" +
                   "<header>" +
                     "<div class='button close button-a'>Close</div>" +
                     "<div class='button font-size button-a'><span class='large'>A</span><span class='small'>A</span></div>" +
                     "<a class='button web button-a' href='" + this.data[this.currentArticleIndex].link + "'>web</a>" +
                     "<div class='button page-up button-a'><div class='arrow'></div></div>" +
                     "<div class='button page-down button-a'><div class='arrow'></div></div>" +
                   "</header>" +
                   "<div class='overlay'></div>" +
                 "</div>" +
               "</div>";
     }
     return html;
   };
   
  /**
   * loadArticle prepares and loads the article into the storyBoard.  The preparition includes instantiating the iScroll object, fading in the article and
   * tweaking the article so that appears correct.  (See prepareArticleForInjection for more information about how we "tweak" the article.)
   */
  tabletBlogView.prototype.loadArticle = function() {
    $( ".storyboard .container" ).append( this.articleHTML() );
    
    $( ".storyboard .web" ).attr( "href", this.data[this.currentArticleIndex].link );
        
    setTimeout( $.proxy( function() {
      this.prepareArticleForInjection( $( ".article" ) );
    }, this ), 0 );
    
    setTimeout( $.proxy( function() {
      var $overlay = $( ".storyboard .overlay" );
      
      if( bc.context.os === "ios" ) {
        this.articleScroller = new iScroll( $( ".article-scroller" )[0], { "hideScrollbar": true } );
      }
      
      //I hide and then show the article because I need to force a redraw for the text to appear correctly.  Without this the first two lines
      //are indented for no apparent reason.
      $( ".storyboard article" ).css( "display", "none" );
      setTimeout( function() {
        $( ".storyboard article" ).css( "display", "block" );
      }, 10 );
      
      $overlay.one( "webkitTransitionEnd", function() {
        $overlay.remove();
      } );
      $overlay.addClass( "fade-away" );
    }, this ), 100 );
    
    //Trigger a tracking event for the viewing of this article.
    this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].name } );
  };
  
  /**
   * Generates the HTML for the article section.
   */
  tabletBlogView.prototype.articleHTML = function() {
    var html;
    if( bc.context.os === "ios" ) {
      html = "<div class='article-container article-scroller'>" +
                "<article class='desc-a fullArticleTextColor'>" + 
                  "<h1 class='header-c fullArticleHeaderTextColor'>" + this.data[this.currentArticleIndex].title + "</h1>" +
                  "<h4 class='header-b fullArticleAuthorTextColor' ><span class='desc-b'>Author: </span>" + this.data[this.currentArticleIndex].dc_creator + "</h4>" +
                  "<h5 class='fullArticleDateTextColor'>" + bc.utils.hoursAgoInWords( new Date( this.data[this.currentArticleIndex].pubDate ) ) + "</h5>" +
                  "<div class='article " + this.fontSizePreference + "'>" + this.data[this.currentArticleIndex].description + "</div>" +
                "</article>" +
             "</div>";
    } else {
      html = "<div class='article-container android-article-container'>" +
                "<article class='desc-a fullArticleTextColor'>" + 
                  "<h1 class='header-c fullArticleHeaderTextColor'>" + this.data[this.currentArticleIndex].title + "</h1>" +
                  "<h4 class='header-b fullArticleAuthorTextColor' ><span class='desc-b'>Author: </span>" + this.data[this.currentArticleIndex].dc_creator + "</h4>" +
                  "<h5 class='fullArticleDateTextColor'>" + bc.utils.hoursAgoInWords( new Date( this.data[this.currentArticleIndex].pubDate ) ) + "</h5>" +
                  "<div class='article " + this.fontSizePreference + "'>" + this.data[this.currentArticleIndex].description + "</div>" +
                "</article>" +
             "</div>";
    }
    return html;
  };
  
  /**
   * prepareArticleForInjection performs some minor adjustments to the article in order to improve its appearance.  The includes centering the
   * the images, styling links, removing ads and adding a small graphic to denote the end of the article.
   */
  tabletBlogView.prototype.prepareArticleForInjection = function( $article ) {
    this.contentCleanup( $article, { "removeScripts": false } );
    $article.find( "img" ).each( function() {
      var $img = $( this );
      if( $img.width() > bc.ui.width() ) {
        $img.width( "100%" );
      }
    });
    $article.find( "img" ).wrap( "<div class='image-wrapper'></div>" );
    $article.find( "a" ).addClass( "header-b fullArticleLinkTextColor" + this.id );
    $article.append( "<div class='end-symbol'></div>" );
  };
  
  /**
   * Shows the Overlay window of the different size fonts available to the user.
   * @param evt The event that was triggered with this tap event.
   */
  tabletBlogView.prototype.toggleFontOverlay = function( evt ) {
    if( $( ".text-overlay" ).length > 0 ) {
      $( ".text-overlay" ).one( "webkitTransitionEnd", function() { $( this ).remove(); } )
                          .addClass( "fade-away" );
    } else {
      this.showFontOverlay( evt );
    }
  };
  
  /**
   * Fades in the font choice Overlay.
   * @param evt The event object that was fired when the user tapped the font size button.
   */
  tabletBlogView.prototype.showFontOverlay = function( evt ) {
    var html,
        $fontButton = $( ".font-size" ),
        offset = $fontButton.offset(),
        x = offset.left + $fontButton.width() / 2 - 20, //20 is the offset to align the button under the arrow
        y = offset.top + $fontButton.height() + 20; //20 is the padding between the button and the overlay
        
        
    html = "<div class='text-overlay' style='left: " + x + "px; top: " + y + "px' >" +
              "<ul>" +
                "<li class='small " + ( ( this.fontSizePreference === "small" ) ? 'selected' : '' ) + "' data-bc-font-size='small'>Small</li>" + 
                "<li class='medium " + ( ( this.fontSizePreference === "medium" ) ? 'selected' : '' ) + "' data-bc-font-size='medium'>Medium</li>" +
                "<li class='large " + ( ( this.fontSizePreference === "large" ) ? 'selected' : '' ) + "' data-bc-font-size='large'>Large</li>"+
              "</ul>" +
            "</div>";
    $( "body" ).append( html );
    
    setTimeout( function() {
      $( ".text-overlay" ).addClass( "fade-in" );
    }, 0 );
  };
  
  /**
   * handleFontSelection changes is responsible for changing the font size of the article, persisting the users preference and hiding/removing the
   * font-size selection overlay.
   * @param evt The event object that was fired from the tap event.
   */
  tabletBlogView.prototype.handleFontSelection = function( evt ) { 
    var $elem = $( evt.currentTarget ),
        fontSize;
        
    if( $elem.hasClass( "selected" ) ) {
      this.toggleFontOverlay();
      return;
    }
    
    $elem.siblings( ".selected" )
         .removeClass( "selected" );
    
    $elem.addClass( "selected" );
    
    fontSize = $elem.data( "bc-font-size" );
    $( ".article" ).removeClass( this.fontSizePreference )
                   .addClass( fontSize );
                   
    this.fontSizePreference = fontSize;
    bc.core.cache( "font-size-preference", fontSize );
    
    this.toggleFontOverlay();
    
    setTimeout( $.proxy( function() {
        this.articleScroller.refresh();
    }, this ), 0 );
  };
 
  /**
   * Handles the destruction and loading of the next article when the user taps page up.
   * @param evt The event that is associated with the tap event.
   */
  tabletBlogView.prototype.handlePageUp = function( evt ) {
    if( this.articleScroller !== undefined ) {
      this.articleScroller.destroy();
    }
    ( this.currentArticleIndex === 0 ) ? this.currentArticleIndex = ( this.data.length - 1 ) : this.currentArticleIndex--;
    $( "<div class='overlay fade-away'></div>" ).one( "webkitTransitionEnd", $.proxy( function() {
                                                     $( ".article-container" ).remove();
                                                     this.loadArticle();
                                                   }, this ) 
                                                  )
                                                .appendTo( ".container" );
    setTimeout( function() {
      $( ".overlay" ).removeClass( "fade-away" );
    }, 0 );
  };
  
  /**
   * Handles the destruction and loading of the next article when the taps the page down button.
   * @param evt The event that is associated with the tap event.
   */
  tabletBlogView.prototype.handlePageDown = function( evt ) {
    if( this.articleScroller !== undefined ) {
      this.articleScroller.destroy();
    }
    
    ( this.currentArticleIndex === ( this.data.length - 1 ) ) ? this.currentArticleIndex = 0 : this.currentArticleIndex++;
    $( "<div class='overlay fade-away'></div>" ).one( "webkitTransitionEnd", $.proxy( function() {
                                                    $( ".article-container" ).remove();
                                                     this.loadArticle();
                                                   }, this ) 
                                                  )
                                                .appendTo( ".container" );
    setTimeout( function() {
      $( ".overlay" ).removeClass( "fade-away" );
    }, 0 );
  };
  
  /**
   * closeStoryBoard removes the story board and returns the user back to the view in which they can view all of the articles.
   */
  tabletBlogView.prototype.closeStoryBoard = function() {
    var $storyboard = $( ".storyboard" );
    
    if( this.articleScroller !== undefined ) {
      this.articleScroller.destroy();
    }
    
    $storyboard.find( "article" ).remove();
    $( ".text-overlay" ).remove();
    $storyboard.removeClass( "storyboard-grow" );
    $storyboard.one( "webkitTransitionEnd", $.proxy( function() {
      $storyboard.remove();
    }, this ) );
    if( this.endArticleViewingEventCallback !== undefined ) {
      this.endArticleViewingEventCallback();
    }
    this.endArticleViewingEventCallback = undefined;
    this.currentArticleIndex = undefined;
  };
  
  /************************************************************************
   * ANDROID SPECIFIC FUNCTIONS
   ***********************************************************************/
  
  /**
   * Handles the logic of a page swipe on the initial page.  This is only called for android tablet devices.
   * @param evt The Event object that was fired from the swipe event.
   * @param direction The direction of the swipe, either 'swipeLeft' or 'swipeRight'.
   */
  tabletBlogView.prototype.handlePageSwipe = function( evt, direction ) {
    if( direction === "swipeRight" && this.currentPageIndex === 0 ) {
      return;
    }
    
    if( direction === "swipeLeft" && this.currentPageIndex === Math.ceil( this.data.length / ARTICLES_PER_PAGE ) - 1 ) {
      return;
    }
    
    $( "<div class='android-overlay'></div>" ).appendTo( ".page-scroller" );
    
    setTimeout( $.proxy( function() { 
      $( ".android-overlay" ).fadeIn( 'fast', $.proxy( function() {
        ( direction === "swipeRight" ) ? this.handleSwipeRight() : this.handleSwipeLeft();
      }, this ) );
    }, this ) , 0 );
  };
  
  /**
   * Moves the new article into view and fades the overlay away.  Additionally udpates the page indicator to show the new page that is showing.
   */
  tabletBlogView.prototype.handleSwipeRight = function() {
    var elem = document.querySelector( ".wrapper" );
    this.currentPageIndex--;
    elem.style["-webkit-transform"] = "translateX(-" + ( this.currentPageIndex * bc.ui.width() ) + "px)";
    $( ".android-overlay" ).fadeOut( "fast", function() {
      $( this ).remove();
    });
    
    this.updateActivePageIndicator( this.currentPageIndex );
  };
  
  /**
   * Moves the new article into view and fades the overlay away.  Additionally udpates the page indicator to show the new page that is showing.
   */
  tabletBlogView.prototype.handleSwipeLeft = function() {
    var elem = document.querySelector( ".wrapper" );
    this.currentPageIndex++;
    elem.style["-webkit-transform"] = "translateX(-" + ( this.currentPageIndex * bc.ui.width() ) + "px)";
    $( ".android-overlay" ).fadeOut( "slow", function() {
      $( this ).remove();
    });
    
    this.updateActivePageIndicator( this.currentPageIndex );    
  };
  
  /**
   * Handles the previous button tap event on Android tablets.
   */
  tabletBlogView.prototype.handlePrevButton = function( evt ) {
    this.handlePageSwipe( evt, "swipeRight" );
  };
  
  /**
   * Handles the previous button tap event on Android tablets.
   */
  tabletBlogView.prototype.handleNextButton = function( evt ) {
    this.handlePageSwipe( evt, "swipeLeft" );
  };
  
  return tabletBlogView;  
})( bc.lib.jQuery );