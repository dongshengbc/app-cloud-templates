/**
 * Created by IntelliJ IDEA.
 * User: jstreb
 * Date: Jun 22, 2010
 * Time: 2:33:33 PM
 * To change this template use File | Settings | File Templates.
 */
(function($, undefined){
  /**
   * Determine if this device supports touch events and set the events name appropriately.__defineGetter__
   */
  var hasTouchSupport = (function() {
    if("createTouch" in document){ // True on the iPhone
      return true;
    }
    try{
      var event = document.createEvent("TouchEvent"); // Should throw an error if not supported

      /**
       * TODO - find a better way.
       * Gettting dirty since Chrome has support for touch events but we need to know if they are actually on a phone
       * so we are looking for chrome and for windows less then 700.
       */
      if(navigator.userAgent.toLowerCase().indexOf('chrome') > -1 && $(window).width() > 700)
        return false;

      return !!event.initTouchEvent; // Check for existance of initialization method
    }catch(error){
      return false;
    }
  }());

  var events;
  if(hasTouchSupport){
    events = {
      start: "touchstart",
      move: "touchmove",
      end: "touchend",
      cancel: "touchcancel"
    };
  }else{
    events = {
      start: "mousedown",
      move: "mousemove",
      end: "mouseup",
      cancel: "touchcancel" // unnecessary here
    };
  }

  var threshold = 5;

  function getMatrixFromNode(node) {
		return new WebKitCSSMatrix(window.getComputedStyle(node).webkitTransform);
  }

  function getMatrixFromEvent(event){ /*WebKitCSSMatrix*/
		if(event.touches && event.touches.length){
			event = event.touches[0];
		}

		var matrix = new WebKitCSSMatrix;
		matrix.e = event.pageX;

		return matrix;
	}

	function applyMatrixToNode(node, matrix, duration){
		var s = node.style;
		if(duration != null){
			s.webkitTransitionDuration = duration + "";
		}

		node.style.webkitTransform = "translate(" + matrix.e + "px, " + matrix.f + "px)";
	}



  /**
   * Handles the sliding of the element passed in by the width passed.
   * @param options
   */
  $.fn.slideX = function(options) {
		var defaults = {
      width: $(window).width()
		};

		var options = $.extend(defaults, options);

    if (!this) return false;

		return this.each(function() {
      /**
       * I am not using proxy because I need a reference to the element when I unbind from within the body
       * event listener.
       */
      var me = $(this);
      var startPosX;
      var trackedEvents = [];
      var currentOffset = new WebKitCSSMatrix();
      var isSliding = false;

      //Track the current event and previous so that we can calculate the offset.
	    function trackEvent(event){
		    trackedEvents[0] = trackedEvents[1];
		    trackedEvents[1] = {
			    matrix: getMatrixFromEvent(event),
			    timeStamp: event.timeStamp
		    }
	    }

      function slide(node, matrix) {
        var newOffset = currentOffset.multiply(matrix);
        newOffset.f = currentOffset.f; //Keep the y axis the same.
        var offsetX = newOffset.translate(0, 0, 0);
        currentOffset = newOffset;
        applyMatrixToNode(node[0], offsetX, 250);
      }

      function reset(node) {
        trackedEvents = [];
        currentOffset = getMatrixFromNode(node)
      }

      //Check to see if we are trying to slide none image areas.
      function inBounds(startPos, finalPos) {
        if(startPos == 0 && finalPos > 0) {
          return false;
        } else if(Math.abs(finalPos) >= (me.width() - options.width)) {
          return false;
        }
        return true;
      }

			//clean up any event listeners when we are done with this interaction
			function cleanUp(elem) {
				elem.css('-webkit-transition', null);
				elem.unbind('webkitTransitionEnd');
        isSliding = false;
				$('body').unbind(events.end);
				elem.unbind(events.move);
			}

      me.bind(events.start, function(event) {
        //Even if we are sliding I need to swallow move events otherwise we get foobar.
        if(isSliding) {
					//event.preventDefault();
          //event.stopPropagation();
					return;
				}

        reset(me[0]);
        if(event.originalEvent.touches && event.originalEvent.touches.length){
			    event = event.originalEvent.touches[0];
		    }

        trackEvent(event);
        me[0].style.webkitTransformStyle = "preserve-3d";
		    me[0].style.webkitTransitionProperty = "-webkit-transform";
				
        startPosX = getMatrixFromNode(me[0]).e;
				
				if(startPosX % options.width != 0) {
					startPosX = startPosX - (startPosX % options.width);
				}
				
        me.bind(events.move, function(event) {
					isSliding = true;
          //event.preventDefault();
          //event.stopPropagation();

          if(event.originalEvent.touches && event.originalEvent.touches.length){
			      event = event.originalEvent.touches[0];
		      }

  	      var lastEventOffset = trackedEvents[1].matrix,
			        scrollOffset = getMatrixFromEvent(event).translate(-lastEventOffset.e, 0,0);

          if(Math.abs(scrollOffset.e) >= threshold) {
            slide(me, scrollOffset);
			      trackEvent(event);
          }

        });

        //Bind the move event now that we have a click
        $('body').bind(events.end, function(event) {					
					isSliding = true;
          me.bind('webkitTransitionEnd', $.proxy(function() {
            cleanUp(me);
          }), this);


          var finalX = getMatrixFromNode(me[0]).e;

          //determine if we are more then a quarter of the way and if we are then move to the end or to starting spot.
          if(Math.abs(startPosX - finalX) > options.width/7 && inBounds(startPosX, finalX))  {
            var x = (startPosX < finalX) ? startPosX + options.width : startPosX - options.width;
            var eventToFire = (startPosX < x) ? "swipeRight" : "swipeLeft";

            me.css('webkit-transition', 'all .10s ease-out');
            me.bind('webkitTransitionEnd', function() {
							me.unbind('webkitTransitionEnd');
              me.trigger('swipeComplete'); 
              
              if(eventToFire === 'swipeLeft') {
              	me.trigger('swipeLeftComplete');
              }
              else {
              	me.trigger('swipeRightComplete');
              }         
            });
            me[0].style.webkitTransform = "translate(" + x + "px)";
          } else if (startPosX == finalX) {
						cleanUp(me);
						me.trigger('slide:tap'); 
          } else {
            me.css('webkit-transition', 'all .25s ease-out')
            me[0].style.webkitTransform = "translate(" + startPosX + "px)";
          }

        });
      });
    });
  };
})(jQuery)