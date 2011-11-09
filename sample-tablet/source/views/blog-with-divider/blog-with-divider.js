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
 * @return A new blogWithDividerView
 *
 * @requires jquery-1.5.min.js
 * @requires iscroll-min.js 
 * @requires brightcove.mobile.core.js 
 * @requires brightcove.mobile.utils.js    
 * @requires brightcove.mobile.events.js   
 * @requires brightcove.mobile.ui.js   
 * @requires brightcove.mobile.device.js  
 */
var blogWithDividerView = ( function( $, undefined) {
  var _defaults,
      _currentArticleIndex,
      _endArticleViewingEventCallbac,
      _settings,
      _self;
  
  _defaults = {
    "contentFeed": "4dc300477414b322c5000429",
    "element": "body"
  };
  
  /**
   * @private
   */
  function blogWithDividerView( options ) {
    var html;
    
    _self = this;
    
    _settings = $.extend( {}, _defaults, options );
    
    _self.element = $( _settings.element );
    
    if( bc.context.initialized ) {
      _self.initialize();
    } else {
      $( bc ).one( "init", _self.initialize );
    }
    
  }
  
  /**
   * The initialize function is called if the bc.core has already been initialized or after the init function fires.
   */
  blogWithDividerView.prototype.initialize = function() {
    _self.settings = bc.core.getSettings();
    
    _self.element.append( getPageContainer() );
    
    bc.ui.init();
    
    _self.render( bc.core.cache( bc.viewID + "_blog_data" ) );
    
    /** Requests the data for this view. */
    bc.core.getData( "news", _self.render, handleNoData );
      
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
  blogWithDividerView.prototype.render = function( data ) {
    var html;
    if( data === undefined || data === null || data === _self.data || ( data === undefined && bc.utils.numberOfProperties( _self.data ) === 0 ) ) {
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
  blogWithDividerView.prototype.listItemsHTML = function() {
    var html,
        newDividerText,
        lastDividerText;

     html = "<ul>";    
     for( var i=0, len=_self.data.length; i < len; i++ ) {
       newDividerText = this.listDividerText( i );
       if ( this.requireNewDivider( i, newDividerText, lastDividerText ) ) {
         lastDividerText = newDividerText;
         html += this.listDividerHTML( i, lastDividerText );
       }
       
       html += this.listItemHTML( i, _self.data[i] );
     }

     html += "</ul>";
     return html;
  };
  
  
  /**
   * This function determines whether or not a new divider is required.  Returning true from this function
   * will result in the view creating and inserting a new divider into the HTML for the page.  The default
   * behavior is to check the passed listDividerText against the member variable _lastDividerText
   *
   * @param index the index of the blog entry that we are determining if we need a new blog entry for
   * @param listDividerText the text for the divider that was determined via the {@link BlogWithDivider#listDividerText}
   * function
   */
  blogWithDividerView.prototype.requireNewDivider = function( index, listDividerText, lastDividerText ) {
    return listDividerText !== lastDividerText;
  };
  
  /**
   * This function generates the text that will appear in the list divider for a blog entry that exists at the specified
   * index.  The pubDate property is obtained from the blog entry at the specified index and then formatted via
   * formatDate function.
   *
   * @param index the index of the blog entry that the divider text will be generated for
   * @returns the text for the list divider
   */
  blogWithDividerView.prototype.listDividerText = function( index ) {
    return this.formatDate( this.data[index].pubDate );
  };
  
  /**
   * Generate the actual HTML that will be used to create a divider.  By default, this is an li element
   * with the listDividerText populated as its text.  Override this function to generate a new type of list divider.
   *
    * @param index the index of the blog entry that we are generating a list divider for
    * @param listDividerText the text for this list divider as determined by the listDividerText function
    * @returns HTML for the list divider that will be populated into the list view.
   */
  blogWithDividerView.prototype.listDividerHTML = function( index, listDividerText ) {
    return "<li class='list-divider background-b header-a'>" + listDividerText + "</li>";     
  };

  /**
   * This function will generate the HTML for a single list item entry in the list view.  Note: If this function
   * is overridden or extended it is important that the root element returned by this function contains an attribute
   * named 'data-bc-entry-id' whose value is the index of the blog entry that is being rendered.  This attribute value
   * is used by {@link blogWithDividerView#handleListEntryTap} function to determine the detail page to build and transition to.
   * 
   * @param item the item that the html is being generated for
   * @returns HTML for a single list item that will be inserted into the list
   */
  blogWithDividerView.prototype.listItemHTML = function( index, item ) {
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
  blogWithDividerView.prototype.buildDetailPage = function( index ) {
   var html = this.resizeBrightcovePlayers( this.detailPageHTML( index ) );
   bc.ui.forwardPage( html );
   this.currentArticleIndex = index;
   if( bc.metrics !== undefined ) {
     this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].title } );
   }
  };

  /**
   * Generate the full HTML for the detail page view.  This will call out to the {@link blogWithDividerView#detailHeaderHTML}
   * function to create the header for the detail page view.
   *
   * @param index the index of the list item that the detail page HTML is being built for.
   */
  blogWithDividerView.prototype.detailPageHTML = function( index ) {
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
  
  /** Currently not being used but it should be */
  blogWithDividerView.prototype.resizeBrightcovePlayers= function( html ) {
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
  blogWithDividerView.prototype.detailHeaderHTML = function( listEntry ) {
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
   * Register all event listeners for the blogWithDividerView.  The following events are
   * registered for with the associated handler.
   */
  blogWithDividerView.prototype.registerEventListeners = function() {         
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
  blogWithDividerView.prototype.handleBackButtonTap = function( evt ) {
     bc.ui.backPage();
     this.currentArticleIndex = undefined;
     this.endArticleViewingEventCallback && this.endArticleViewingEventCallback();
  };
  
  /**
   * Function to handle when a user 'taps' on a list item in the list view.
   * Currently, this will call the {@link blogWithDividerView#buildDetailPage} to transition
   * and render the detail page.
   */
  blogWithDividerView.prototype.handleListEntryTap = function( evt ) {
    this.buildDetailPage( $(evt.currentTarget).data( "bc-entry-id" ) );    
  };
  
  /**
   * Function to handle new data becoming available to the view.  When new data comes in
   * the view will go through and render itself again with the new data.
   */
  blogWithDividerView.prototype.handleNewConfigurationInfo = function( info ) {
    if ( info.status !== "error" && info.styles.isNew ) {
       bc.core.applyStyles( info.styles.values );
    }    
  };
  
  /**
   * Called when the "view" gains focus.  (a view being defined in the manifest.xml file.)
   * @param evt The event object that was fired with this event.
   */
  blogWithDividerView.prototype.handleViewFocus = function( evt ) {
    if( this.currentArticleIndex !== undefined && bc.metrics !== undefined ) {
      this.endArticleViewingEventCallback = bc.metrics.live( "article-view", { "name": this.data[this.currentArticleIndex].title } );
    }
  };
  
  /**
   * Called when this "view" loses focus.  This occurs when the user switches to a different "view".  (a view being defined in the manifest.xml file.)
   * @param evt The event object that was fired with this event.
   */
  blogWithDividerView.prototype.handleViewBlur = function( evt ) {
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
  blogWithDividerView.prototype.formatDate = function( aDate ) {
    var date = new Date( aDate );
    if( date.toString() === "Invalid Date" ) {
      bc.utils.warn( "Invalid Date passed to blogWithDividerView" );
      return "";
    } else {
      return date.toLocaleDateString();
    }
  };
  
  blogWithDividerView.prototype.listHeaderHTML = function() {
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
  
 
  
  return blogWithDividerView;  
})( bc.lib.jQuery );