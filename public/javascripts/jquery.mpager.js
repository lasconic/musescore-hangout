(function( $ ) {
	var C = "mpager";
	$.fn.mpager = function(options){
		var el = this.eq(0).data(C);
		var opts = $.extend({}, $.fn.mpager.defaults, options);
		this.each(function(){
            el = new $mpager(this, opts);
        });
        return opts.api ? el : null;
	};
	$.mpager = function(e, opts){
		this.e = $(e);
		this.pages = opts.pages;
		this.scoreId = opts.scoreId;
		this.scoreSecret = opts.scoreSecret;
		this.apiServer = opts.apiServer;
		this.staticBucket = opts.staticBucket;
		this.pageWidth = opts.pageWidth;
		this.scrollTopMargin = opts.scrollTopMargin;
		this.measureClickCallback = opts.measureClickCallback;
		this.measureChangeCallback = opts.measureChangeCallback;
		this.bottomPadding = opts.bottomPadding;
		
		this.cMeasure = opts.defaultMeasure;
		this.consumerKey = opts.consumerKey;
		
		this.factor = 12; 
		this._init();
	};
	
	$.fn.mpager.defaults = {
			api: false,
			pages: 1,
			scoreId : null,
			scoreSecret : null,
			apiServer : "http://api.musescore.com",
			staticBucket : "static.musescore.com",
			measureClickCallback : null,
			measureChangeCallback: null,
			pageWidth: 0,
			scrollTopMargin : 50,
			defaultMeasure : -1,
			bottomPadding: 0,
			consumerKey: "your-oauth-consumer-key"
			};
	
	var $mpager = $.mpager;
    $mpager.fn = $mpager.prototype = {
    		mpager: '1.2'
    };
    $mpager.fn.extend = $mpager.extend = $.extend;
    $mpager.fn.extend({
        _init: function(){
            var self = this;
            
            this.maxPageWidth = this.e.width();
            var scaling = this.pageWidth / this.maxPageWidth;
            
            for ( var i = 0; i < this.pages; i++) {
    			this.e.append('<div id="page_' + i + '" class="page"><img id="pageimg_' + i + '" class="pageimg" src="http://' + this.staticBucket + '/' + this.scoreId + '/' + this.scoreSecret + '/score_' + i + '.png" title="Page ' + (i+1) + ' "/></div>');
    		}
    		
    		$(".pageimg").width(this.maxPageWidth);
    		
    		$.getJSON(this.apiServer + "/services/rest/score/" + this.scoreId + "/space.jsonp?secret=" + this.scoreSecret + "&oauth_consumer_key="+ this.consumerKey +"&callback=?", function(data) {
    			self.elements = data;
    			self.measureCount = data.length;
    			self.pageArray = new Array();
    			for ( var i = 0; i < self.measureCount; i++) {
    				var page = data[i].page;
    				if(!self.pageArray[page])
    					self.pageArray[page] = new Array();
    				self.pageArray[page].push(data[i]);
    				
    				var x = Math.floor(parseInt(self.elements[i].x) / (self.factor*scaling));
    				var y = Math.floor(parseInt(self.elements[i].y) / (self.factor*scaling));
    				var width = Math.round(parseInt(self.elements[i].sx) / (self.factor*scaling));
    				var height = Math.ceil(parseInt(self.elements[i].sy) / (self.factor*scaling));
    				$("#page_" + page).append('<div id="measure_' + i + '" class="measure" style="left: ' + x + 'px; top: ' + y + 'px; width: ' + width + 'px; height: ' + height + 'px;" />');
    				if(i == self.cMeasure)
    					$('#measure_' + i).addClass("measure-visible");
    				$('#measure_' + i).bind('click', {
    					id : i
    				}, function(event) {
    					if(self.measureClickCallback)
    						self.measureClickCallback($(this), event.data.id);
    					return false;
    				});
    			}
    		});
        },
        
        refreshPages: function() {
        	this.maxPageWidth = this.e.width();
        	var scaling = this.pageWidth / this.maxPageWidth;
        	$(".pageimg").width(this.maxPageWidth);
        	for ( var i = 0; i < this.measureCount; i++) {
        		var x = Math.floor(parseInt(this.elements[i].x) / (this.factor*scaling));
        		var y = Math.floor(parseInt(this.elements[i].y) / (this.factor*scaling));
        		var width = Math.round(parseInt(this.elements[i].sx) / (this.factor*scaling));
        		var height = Math.ceil(parseInt(this.elements[i].sy) / (this.factor*scaling));
        		$('#measure_'+i).css({'left' : x, 'top' : y, 'width' : width, 'height' : height})
        	}
        },

        goTo: function(measureId) {
        	if (measureId >= 0 && this.elements && measureId < this.elements.length) {
        		this.highlightMeasure($('#measure_' + measureId), measureId);
        	}
        },

        goToPage: function(pageNumber) {
        	if (pageNumber >= 0 && pageNumber < this.pages) {
        		var measureId = parseInt(this.pageArray[pageNumber][0].id);
        		this.highlightMeasure($('#measure_' + measureId), measureId);
        	}
        },
        
        nextMeasure: function(){
        	var m = this.cMeasure + 1; 
        	this.goTo(m);
        },

        highlightMeasure: function(element, id) {
        	if (this.cMeasure != id) {
        		$('.measure').removeClass("measure-visible");
        		element.addClass("measure-visible");
        		this.cMeasure = id;
        		// Scroll to view the measure
        		if (!this._isScrolledIntoView(".measure-visible")) {
        			$('html, body').animate( {
        				scrollTop : $(".measure-visible").offset().top - this.scrollTopMargin
        			}, 0);
        		}
        		if (this.measureChangeCallback)
        			this.measureChangeCallback(element, id);
        	}
        },
        
        _isScrolledIntoView:function(elem){
        	var docViewTop = $(window).scrollTop();
        	var docViewBottom = docViewTop + $(window).height() - this.bottomPadding;

        	var elemTop = document.getElementById($(elem).attr('id')).offsetTop;//$(elem).offset().top;
        	var elemBottom = elemTop + $(elem).height();

        	return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom) && (elemBottom <= docViewBottom) && (elemTop >= docViewTop));
        }
    });
}(jQuery));