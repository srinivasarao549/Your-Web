define(
//Module dependencies
[
	'libs/jquery-1.6.4.min',
	'libs/backbone-0.5.3.min',
	'libs/underscore.min',
	'libs/handlebars',
	'core',
	'questions',
	'answers',
	'tilemap',
	'stringtester',
	'imagetester'
],
function(){
	var app = window.APP,
	instance = this,
	map,
	mapConfig,
	sizeKeys,
	clientWidth,
	_placedObjects = [],
	AnswerView,
	AnswerDetailView,
	AnswerListView,
	QuestionView,
	QuestionListView,
	AppView,
	//templates
	questionTemplate = '<li class="question"><a href="#current-question" id="question-{{id}}">{{content}}</a></li>',
	activeQuestionTemplate = '{{content}}',
	answerTemplate = '<a href="#" title="{{content}}" class="block"><article class="tile {{color}}"><h1 class="main-title">{{#if image}}<img src="{{image.url}}" />{{else}}{{{layout}}}{{/if}}</h1></article></a>',
	answerDetailTemplate = $('#tile-detail-template').text();
	
	app.namespace('views');
	
	
	function init() {
		mapConfig = app.config.tilemap['default'];
		
		// Generate the tilemap
		sizeKeys = _.keys(app.config.tilemap);
		clientWidth = document.getElementsByTagName('html')[0].clientWidth;
		
		sizeKeys.sort();
		
		_.each(sizeKeys, function(key) {
			if (clientWidth <= parseInt(key)) {
				mapConfig = app.config.tilemap[key];
			}
		});
		
		app.tilemap.pixelsInTile = mapConfig.pixelsInTile;
		
		app.tilemap.buildMap(mapConfig.lines, Math.floor($('#main').width() / app.tilemap.pixelsInTile), mapConfig.preoccupied, mapConfig.addPadding);
		
		$('.tiles-list').css({ height: app.tilemap.tilesToPixels(mapConfig.lines) });
		
	}
	
	// Set up a simple view
	AnswerView = Backbone.View.extend({
		
		tagName: 'li',
		
		events: {
			'click': 'handleClick'
		},
		
		template: Handlebars.compile(answerTemplate),
		
		initialize: function() {
			this.model.bind('destroy', this.remove, this);
		},
		
		render: function(layout) {
			var modelData = this.model.toJSON(),
			created = new Date(modelData.created),
			classes = {
				'web-beginner'		: 'orange',
				'web-intermediate'	: 'yellow',
				'web-expert'		: 'green',
				'web-creator'		: 'blue'
			},
			animationClasses = ['animation-a', 'animation-b', 'animation-c', 'animation-d'],
			ids = [];
			color = classes[modelData.usertype];
			
			modelData.layout = layout;
			
			modelData.color = color;
			
			//If its in the createdByUser array, treat it specially
			if (app.answers.createdByUser().length) {
				ids = _.pluck(app.answers.createdByUser(), 'id');
				if (_.include(ids, modelData.id)) {					
					this.model.set({createdByUser: true}, {silent: true});
					
					if (modelData.statistics.total <= 1) {
						modelData.statistics.total = 0;
						
						this.model.set({statistics: modelData.statistics}, {silent: true});
					}
				}
			}
			
			$(this.el).attr('data-tile', modelData.id || this.model.cid).html( this.template( modelData ) );
			
			/*
			if (Math.round(Math.random())) {
				$(this.el).find('article').addClass(animationClasses[Math.round(Math.random() * 3)]);
			}
			*/
			
			if (modelData.important) {
				$(this.el).addClass('important');
			}
			
			return this;
		},
		
		handleClick: function() {
			app.events.publish('tile/select', [this.model, this.el]);
			return false;
		},
		
		remove: function() {
			$(this.el).remove();
		},
		
		clear: function() {
			this.model.destroy();
		}
	});
	
	AnswerDetailView = Backbone.View.extend({
		tagName: 'article',
		
		className: 'tooltip',
		
		events: {
			'click .translation-bttn': 'showTranslate'
		},
		
		template: Handlebars.compile(answerDetailTemplate),
		
		initialize: function() {
			this.model.bind('change', this.render, this);
			this.model.bind('destroy', this.remove, this);
		},
		
		render: function() {
			var modelData = this.model.toJSON(),
				usertypeStrings = app.config.strings.usertypes,
				total = 0;
			
			delete modelData.statistics.total;
			modelData.usertypes = {};
			
			_.each(modelData.statistics, function(part, key) {
				modelData.usertypes[key] = (part > 1) ? usertypeStrings[key].plural : usertypeStrings[key].singular;
				total += parseInt(part, 10);
			});
			
			modelData.statistics.total = total;
			
			modelData.moreThanOne = (total > 1) ? true : false;
			$(this.el).attr('id', 'tile-details').html( this.template( modelData ) );
			
			return this;
		},
		
		showTranslate: function() {
			$(this.el).find('#tile-detail-main').addClass('hidden');
			$(this.el).find('#translation-step-1').removeClass('hidden');
			
			return false;
		},
		
		remove: function() {
			$(this.el).remove();
		}
	});
	
	app.views.AnswerDetailView = AnswerDetailView;
	
	QuestionView = Backbone.View.extend({			
		template: Handlebars.compile(questionTemplate),
		
		initialize: function() {
			this.model.bind('change', this.render, this);
			this.model.bind('destroy', this.remove, this);
		},
		
		render: function(type) {
			var modelData = this.model.toJSON(),
			created = new Date(modelData.created);
			
			if (type == 'header') {
				this.template = Handlebars.compile(activeQuestionTemplate);
			} else {
				this.template = Handlebars.compile(questionTemplate);
			}
			
			return this.template( modelData );
		},
		
		remove: function() {
			$(this.el).remove();
		},
		
		clear: function() {
			this.model.destroy();
		}
	});
	
	// Set up the Answer List view
	AnswerListView = Backbone.View.extend({
		el: $('body'),
		
		initialize: function() {
			var that = this;
			
			app.events.subscribe('app/reset', that.empty);

			this.collection.bind('reset', function(collection) {
				if (collection.length) {
					app.events.publish('tiles/reset', [collection]);
					that.render(collection);
				}
			});
		},
		
		render: function(answers) {
			renderTilesOnMap(answers, true);
		},
		
		empty: function() {
			$('.tiles-list').empty();
		}
	});
	
	// Set up the Question List view
	QuestionListView = Backbone.View.extend({
		el: '#primary-nav',
		
		initialize: function() {			
			app.questions.collection.bind('reset', this.clear, this);
			app.questions.collection.bind('reset', this.addAll, this);
			app.questions.collection.trigger('reset');
		},
		
		addOne: function(question) {
			var view,
				el;
			if (question) {
				view = new QuestionView( { model: question } );
				el = view.render(),
				$el = $(el);

				if (question.get('active')) {
					$('#current-question .current-question-btn').html(view.render('header'));
					$el.addClass('selected');
				}
				
				$(this.el).append($el);
			}
		},
		
		addAll: function() {
			this.clear();
			app.questions.collection.each(this.addOne, this);
		},
		
		addActive: function() {
			this.addOne(app.questions.getActive());
		},
		
		clear: function() {
			$('#primary-nav').html('');
		}
	}),
	
	_placeObject = function(obj, location) {
		var tilemap = app.tilemap,
			xPos = tilemap.tilesToPixels(location.x),
			yPos = tilemap.tilesToPixels(location.y),
			width = tilemap.tilesToPixels(obj.maxHTiles),
			height = tilemap.tilesToPixels(obj.maxVTiles),
			$el,
			view,
			grids = obj.grid,
			lineHeight,
			paddingAdjust,
			content = '',
			weightClass = (!_.isUndefined(app.config.weights[obj.model.get('weight')])) ? app.config.weights[obj.model.get('weight')] : app.config.weights['default'];
			
		_.each(grids, function(line) {
			_.each(line, function(word) {
				content += word.text + ' ';
			});
			content += '<br />';
		});		
		
		view = new AnswerView( { model: obj.model } );
		$el = $(view.render(content).el).hide();
		
		$el.find('.tile').addClass(weightClass);
					
		$('.tiles-list').append($el);
		
		lineHeight = parseInt($el.find('.main-title').css('lineHeight'), 10);
		
		paddingAdjust = (Math.round( (tilemap.pixelsInTile - lineHeight) /2)) * obj.maxVTiles;
		
		$el
		.css({position: 'absolute', top: xPos + 'px', left: yPos+ 'px', width: width - 4, height: height - 4, padding: 2})
		.find('.tile').css({width: width - 4, height: (height - 4 - paddingAdjust*2), paddingTop: paddingAdjust, paddingBottom: paddingAdjust});
		
		$el.fadeIn('fast', function() {
			if ($el.hasClass('important')) {
				$el.trigger('click');
			}
		});
		
		_placedObjects.push({object: obj, location: location, element: $el.get(0)});
	},
	
	_placeImageObject = function(obj, container) {
		var view = new AnswerView( { model: obj.model } ),
		el = view.render(obj.model.get('content')).el;
		
		$(container).append(el);
		
		$(el).hide();
	},
	
	fillMap = function() {
		var tilemap = app.tilemap,
			map = tilemap.map(),
			freeHTiles,
			tasks = [],
			mapWasFull = true;
		
		function recursive(line, col) {
			
			freeHTiles = tilemap.freeHorizontal( { x:line, y:col } );
			
			_.each(freeHTiles, function(free) {
				var	freeVTiles = tilemap.freeVertical( free.tile, {x:free.tile.x, y:free.tile.y + free.count } ),
					object = app.stringtester.stringThatFits(free.count, freeVTiles);
				
				if (object) {
					if (tilemap.isTileFree(free.tile)) {
						tasks.push(function() {
							_placeObject(object, free.tile)
						});
						
						mapWasFull = false;

						for (var l=free.tile.x, len=free.tile.x + object.maxVTiles-1; l<=len; l++) {
							for (var c=free.tile.y; c <= free.tile.y + object.maxHTiles-1; c++) {
								tilemap.occupyTile({x:l, y:c});
							}
						}
					}
					recursive(line, free.tile.y + object.maxHTiles);
				}
			});
		}
				
		for (var l=0, len=map.length; l<len; l++) {
			recursive(l, 0);
		}
		
		// If the map was already full and our objects didn't make it, substitute older tiles
		if (mapWasFull) {
			_.each(_placedObjects, function(old) {
				// See if there's an unused tile that would fit in here.
				var newObject = app.stringtester.stringThatFits(old.object.maxHTiles, old.object.maxVTiles);
				
				//Substitute old for new
				if (newObject) {
					$(old.element).fadeOut('fast', function() {
						$(this).remove();
						
						_placeObject(newObject, old.location);
					});
				}
			});
		}
		
		// Add images to their slots
		_.each(app.tilemap.imageSlots, function(slot) {
			var slotWidth = slot.lines.stop - slot.lines.start,
				slotHeight = slot.columns.stop - slot.columns.start,
				objects = app.imagetester.imagesThatFit( slotWidth, slotHeight);
			
			_.each(objects, function(object) {
				tasks.push(function() {
					_placeImageObject(object, $('[data-imageratio="' + object.ratio + '"][data-hTiles="' + slotHeight +'"][data-vTiles="'+ slotWidth +'"]').find('.image-list'));
				});
			});
		});
				
		app.multistep(_.shuffle(tasks), null, function() {
			app.ui.makeSlideShow('.tiles-list .image-list');
		}, 125);
	},
	
	renderTilesOnMap = function(collection) {
		var imageCollection = collection.filter(function(answer) { return answer.has('image') }),
			ratios = [],
			allowedSlots = [];
		
		$('.tiles-list').empty();
		
		_.each(imageCollection, function(answer) {
			ratios.push(
				Math.max(answer.get('image').width, answer.get('image').height) /
				Math.min(answer.get('image').width, answer.get('image').height)
			)
		});
			
		_.each(mapConfig.imageSlots, function(slot) {
			var width = slot.lines.stop - slot.lines.start,
				height = slot.columns.stop - slot.columns.start,
				ratio = Math.max(width, height) / Math.min(width, height),
				$container;
				
			if (_.include(ratios, ratio) && !$('[data-imageratio="'+ ratio +'"][data-hTiles="'+ height +'"][data-vTiles="'+ width +'"]').length) {
				allowedSlots.push(slot);
				
				//render the container
				$container = $('<li><ul class="image-list"></ul></li>');
				
				$container
				.css({
					width: app.tilemap.tilesToPixels(height),
					height: app.tilemap.tilesToPixels(width),
					position: 'absolute',
					top: app.tilemap.tilesToPixels(slot.lines.start),
					left: app.tilemap.tilesToPixels(slot.columns.start)
				})
				.addClass('image')
				.attr('data-imageratio', ratio)
				.attr('data-hTiles', height)
				.attr('data-vTiles', width);
				
				$('.tiles-list').append($container);
			}
		});
		
		app.tilemap.imageSlots = allowedSlots;
		
		app.tilemap.addImageSlots(allowedSlots);
			
		fillMap();
	};
	
	app.answers.collection.bind('reset', function(collection) {
		app.events.publish('tiles/reset', [collection]);
	});
	
	app.events.subscribe('questions/active', function() {
		if (app.questions.getActive()) {
			// Rebuild the map
			app.tilemap.buildMap(mapConfig.lines, Math.floor($('#main').width() / app.tilemap.pixelsInTile), mapConfig.preoccupied, mapConfig.addPadding);
			
			app.views.answerListView.empty();
			app.answers.refresh();
		}
	});
	
	app.events.subscribe('filters/change', function(filters) {
		app.answers.refresh();
	});
	
	// Subscribe to interesting events
	app.events.subscribe('questions/refresh', function() {
		if (app.questions.getActive()) {
			app.views.answerListView = new AnswerListView({collection: app.answers.collection});
			
			// Bootstrap answer list from config, else fetch it
			if (app.config.answers) {
				app.answers.collection.reset(app.config.answers);
			} else {
				app.answers.collection.fetch();
			}
		}
	});	
	
	app.events.subscribe('string/test', fillMap);
	
	app.events.subscribe('image/test', fillMap);
	
	app.events.subscribe('app/reset', function() {
		// clear the answer collection and reinit
		app.answers.collection.reset();
		init();
		app.answers.refresh();
	});
	
	// Instantiate the Question List View
	app.events.subscribe('app/ready', function() {	
		setTimeout(function() {
			init();
			app.views.QuestionListView = new QuestionListView;
		}, 500);
	});
});