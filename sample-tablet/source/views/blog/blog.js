/*global bc:true */
/*jshint indent:2, browser: true, white: false, undef:false*/

/**
 * @class A blog view is capable of rendering a 'list' of items in a table like view which the user can scroll through.
 * Upon 'tapping' on a blog item the screen will transition to a detail view for the selected item.
 *
 * @constructor
 * @requires blog.js
 * @param options An object of the possible options for this view.  Currently the only option available is the element that this view should load into.  By default this will be the body tag.
 * @param ignore
 * @return A new blogview
 *
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js  
 */
var blogview = ( function( $, undefined) {
  var _defaults,
      _currentArticleIndex,
      _endArticleViewingEventCallbac,
      _settings,
      _self;
  
  _defaults = {
    "element": "body"
  };
  
  /**
   * @private
   */
  function blogview( options ) {

    _self = this;
    
    _settings = $.extend( {}, _defaults, options );
    
    _self.element = $( _settings.element );
    
    if( bc.context.initialized ) {
      _self.initialize();
    } else {
      $( bc ).one( "init", function() {
        _self.initialize();
      });
    }
    
  }
  
  /**
   * The initialize function is called if the bc.core has already been initialized or after the init function fires.
   */
  blogview.prototype.initialize = function() {
    _self.element.append( getPageContainer() );
    
    bc.ui.init();
    
    /*Note that this should be unique to your app, which is why we prefix with viewID.*/
    _self.render( bc.core.cache( bc.viewID + "_blog_data" ) );
    
    /** The current data available for this view.*/
    bc.core.getData( "blog", _self.render, handleNoData );
      
    /** Tell the container that this view will support rotating in all directions */
    bc.device.setAutoRotateDirections( ['all'] );   
    
    bc.core.applyStyles();
    
    /** 
     * Finally, add in our event listeners so that we can react to user input.  Done after the call to render to ensure our
     * HTML elements exist.
     */      
    _self.registerEventListeners();
  }
  
  /**
   * If there is an error getting data handleNoData is called.  If we are in the studio then we want to show the spinner again.
   */
  function handleNoData() {
    //If we are in preview mode then show the spinner, otherwise do nothing
    if( bc.core.current_mode === bc.core.mode.PREVIEW ) {
      $( ".scroller .list-container" ).html( "" );
      $( ".scroller" ).append( bc.ui.spinner() );
    }
  }

  /**
   * Responsible for the initial rendering of the page.  The loading page is show immediately
   * so that the user has some feedback that something is happening.
   */
  blogview.prototype.render = function( data ) {
    var html;
    if( !data || data === _self.data || ( !data && bc.utils.numberOfProperties( _self.data ) === 0 ) ) {
     //no need to redraw the UI, so we should simply return
     return;
    }
    $( ".scroller .spinner" ).remove();
    _self.data = data;
    bc.core.cache( bc.viewID + "_blog_data", data );
    $( ".list-container" ).html( _self.listItemsHTML() );
    bc.ui.refreshScrollers();
  };

 /**
  * Generate the HTML for a given list item index.  This function can be override/modified to affect the HTML that appears
  * in each entry for the table.  For each item that is being rendered in the list the
  * <i>listItemHTML</i> function will be called to generate the HTML for an individual list entry.
  *
  * @param items This list of blog entries
  * @returns HTML for the entire list view.
  */
  blogview.prototype.listItemsHTML = function() {
    var html = "<ul>";    
    for( var i = 0, len = _self.data.length; i < len; i++ ) {
      html += this.listItemHTML( i, _self.data[i] );
    }

    html += "</ul>";
    return html;
  };

  /**
   * This function will generate the HTML for a single list item entry in the list view.  Note: If this function
   * is overridden or extended it is important that the root element returned by this function contains an attribute
   * named 'data-bc-entry-id' whose value is the index of the blog entry that is being rendered.  This attribute value
   * is used by {@link blogview#handleListEntryTap} function to determine the detail page to build and transition to.
   * 
   * @param item the item that the html is being generated for
   * @returns HTML for a single list item that will be inserted into the list
   */
  blogview.prototype.listItemHTML = function( index, item ) {
    return "<li data-bc-entry-id='" + index + "' class='blog-entry background-a border-a'>" +
              "<div class='details'>" +
               "<h2 class='header-b ellipsis listItemTitleTextColor'>" + item.title + "</h2>" +
               "<p class='desc-a listItemDateTextColor'>" + this.formatDate( item.pubDate ) + "</p>" +
              "</div>" +
              "<div class='arrow'></div>" +
            "</li>";
  };
  
  /**
   * This function is called when the user 'taps' on a list item and navigates to the detail page
   * to see full information about a particular list entry.
   *
   * @param index the index of the list item that detail page is being built for
   */
  blogview.prototype.buildDetailPage = function( index ) {
   var html = this.resizeBrightcovePlayers( this.detailPageHTML( index ) );
   bc.ui.forwardPage( html );
   this.currentArticleIndex = index;
   if( bc.metrics !== undefined ) {
     this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].title } );
   }
  };

  /**
   * Generate the full HTML for the detail page view.  This will call out to the {@link blogview#detailHeaderHTML}
   * function to create the header for the detail page view.
   *
   * @param index the index of the list item that the detail page HTML is being built for.
   */
  blogview.prototype.detailPageHTML = function( index ) {
    var listEntry = this.data[index];
    var html= "<div id='blogentry_" + index + "' class='page blog-entry-detail'>";
 
    html += this.detailHeaderHTML( listEntry );
    html += "<div class='scroller'><div class='page-content listDetailBackgroundImage'>" +
              "<h1 class='header-b listDetailTitleTextColor'>" + listEntry.title + "</h1>" +
              "<p class='desc-b'>Posted on " + this.formatDate( listEntry.pubDate ) + "</p>" +
              "<div class='post desc-a listDetailPostTextColor'>" + listEntry.description + "</div>" +
            "</div></div></div>";
    
    return html;
  };
  
  /**
   * Resizes the Brightcove players, while maintaining the aspect ratio.
   * @param html The HTML snippet that contains the Brightcove Player.
   */
  blogview.prototype.resizeBrightcovePlayers= function( html ) {
    var $html = $( html ),
        $BrightcovePlayer = $html.find( ".BrightcoveExperience" ),
        width = $BrightcovePlayer.find( "[name='width']" ).attr( "value" ),
        height = $BrightcovePlayer.find( "[name='height']" ).attr( "value" ),
        newWidth,
        newHeight;
      
    newWidth = bc.ui.width() * 0.9;
    newHeight = ( newWidth * height ) / width;
    $BrightcovePlayer.find( "[name='width']" ).attr( "value", newWidth );
    $BrightcovePlayer.find( "[name='height']" ).attr( "value", newHeight );
    
    return $html;
  };

  /**
   * The header HTMl for the detail page.  This will default the to the title
   * property of the listEntry or will fall back to the title 'Blog Feed'.  A back
   * button navigation control is also added to the header so the user can navigate
   * back to the list view.
   *
   * @param listEntry the list entry to generate a header for
   */
  blogview.prototype.detailHeaderHTML = function( listEntry ) {
    var html;
    html = "<div class='header'>" +
          "<div class='back-button'></div>";
          
    if ( listEntry && listEntry.title ) {
      html += "<h1 class='header-a ellipsis'>" + listEntry.title + "</h1>" +
              "</div>";      
    } else {
      html += "<h1 class='header-a ellipsis'>Blog Entry</h1>" +
              "</div>";      
    }
    
    return html;
  };

  /**
   * Register all event listeners for the blogview.  The following events are
   * registered for with the associated handler.
   */
  blogview.prototype.registerEventListeners = function() {         
    $( bc ).bind( "newconfigurations", function( evt, info ) {
      _self.handleNewConfigurationInfo( info );
      } 
    );

    $( "body" ).delegate( ".blog-entry", "tap", function(evt) {
     _self.handleListEntryTap( evt );
    });

    $( "body" ).delegate( ".back-button", "tap", function() {
      _self.handleBackButtonTap();
    });
    
    $( bc ).bind( "viewfocus", function( evt ) {
      _self.handleViewFocus( evt );
    });
    
    $( bc ).bind( "viewblur", function( evt ) {
      _self.handleViewBlur( evt );
    });
  };
  
  /** Event handlers **/
  
  
  /** 
   * Handle the user 'tapping' on the back button when in the detail page.  This calls
   * into the {@link bc.ui#backPage} function to pop the detail view off the stack and
   * transition back to the list view.
   *
   * @param evt the event associated with the user tapping
   */
  blogview.prototype.handleBackButtonTap = function( evt ) {
     bc.ui.backPage();
     this.currentArticleIndex = undefined;
     this.endArticleViewingEventCallback && this.endArticleViewingEventCallback();
  };
  
  /**
   * Function to handle when a user 'taps' on a list item in the list view.
   * Currently, this will call the {@link blogview#buildDetailPage} to transition
   * and render the detail page.
   */
  blogview.prototype.handleListEntryTap = function( evt ) {
    this.buildDetailPage( $(evt.currentTarget).data( "bc-entry-id" ) );    
  };
  
  /**
   * Function to handle new data becoming available to the view.  When new data comes in
   * the view will go through and render itself again with the new data.
   */
  blogview.prototype.handleNewConfigurationInfo = function( info ) {
    if ( info.status !== "error" && info.styles.isNew ) {
       bc.core.applyStyles( info.styles.values );
    }    
  };
  
  /**
   * Called when the "view" gains focus.  (a view being defined in the manifest.xml file.)
   * @param evt The event object that was fired with this event.
   */
  blogview.prototype.handleViewFocus = function( evt ) {
    if( this.currentArticleIndex !== undefined && bc.metrics !== undefined ) {
      this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].title } );
    }
  };
  
  /**
   * Called when this "view" loses focus.  This occurs when the user switches to a different "view".  (a view being defined in the manifest.xml file.)
   * @param evt The event object that was fired with this event.
   */
  blogview.prototype.handleViewBlur = function( evt ) {
    //If we have a article viewing event then we need to kill it.
    if( this.endArticleViewingEventCallback !== undefined ) {
      this.endArticleViewingEventCallback();
    }
  };

  /**
   * This function is called to format a date object so that it can be displayed visually on the screen.
   * This means that this function should take the date object and turn it into a string that can be returned
   * to a calling function and inserted into HTML.  
   *
   * @returns Date as a string that can be displayed in an HTML view.
   */
  blogview.prototype.formatDate = function( aDate ) {
    var date = new Date( aDate );
    if( date.toString() === "Invalid Date" ) {
      bc.utils.warn( "Invalid Date passed to blogview" );
      return "";
    } else {
      return date.toLocaleDateString();
    }
  };
  
  blogview.prototype.listHeaderHTML = function() {
     var title = bc.core.getSetting( "titleOfPage" );
     title = ( title ) ? title : "Blog Feed";

     return "<div class='header'>" +
            "<h1 class='header-a ellipsis'>" + title + "</h1>" +
            "</div>";
   };
    
 /*************************************
  * Functions ripe for html templates
  ************************************/
  /**
   * @private
   */
  function getPageContainer() {
    return "<div class='page page-active blog'>" +
              _self.listHeaderHTML() +
              "<div class='scroller'>" +
                "<div class='list-container'></div>" +
                bc.ui.spinner() +
              "</div>" +
            "</div>";
  }
  
 
  
  return blogview;  
})( bc.lib.jQuery );