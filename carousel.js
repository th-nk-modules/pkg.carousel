import {events} from '../js.events/events';
import * as dom from '../js.dom/dom';
/**
* @class Carousel
* @classdesc JS carousel panels
* @global
*/

class Carousel {
    /**
     * @constructor
     */
    constructor(elem) {
		this.pageWidth = 0;
		this.use_transform = dom.hasClass(document.documentElement,'csstransforms3d');
		this.css_prefix_transform = (typeof Modernizr !== 'undefined') ? Modernizr.prefixed('transform') : 'transform';

		let that = this;
		events.on(window,'resize',function() {
			that.resized();
		});
		this.init(elem);
	}

	init(elem) {
		this.elem = elem;

		this.animate = this.elem.getAttribute('data-autoscroll') !== null || false;
		this.infinate = this.elem.getAttribute('data-infinate') !== null || false;
		this.pagination = this.elem.getAttribute('data-pagination') !== null || false;
		this.direction = this.elem.getAttribute('data-direction') || 'ltr';
		this.time_interval = this.elem.getAttribute('data-time') || 5000;
		this.inview = this.elem.getAttribute('data-inview') || 1;

		this.container = elem.querySelector('.carousel__container');
		this.panels = [].slice.call(elem.querySelectorAll('.carousel__panel'));
		this.panels_len = this.panels.length;
		this.horizontal = this.direction === 'rtl' || this.direction === 'ltr';
		this.opposite = this.direction === 'rtl' || this.direction === 'btt';

		if (this.infinate){
			this.appendClones();
		};

		if (this.opposite){
			this.position = this.infinate ? this.panels_len -this.inview*2 : this.panels_len -1;
		}
		else {
			this.position = this.infinate ? this.inview : 0;
		}

		this.panels_percent = 100 / this.panels_len;

		this.setPosition = this.horizontal ? this.setPositionX : this.setPositionY;

		this.setSize();

		if (this.animate){
			this.animatePosition = this.opposite ? this.movePrevious : this.moveNext;
			this.startAnim();
		}

		if (this.pagination){
			this.addPagination().bindPaginationEvents();
		}

		this.bindTouchEvents();
	}

	resized() {
		this.setSize();
	}

	getTransformString(x,y) {
		var str;
		if (isNaN(x)){
			str = (this.is_ie) ? 'auto' : 'initial';
		}
		else {
			str = (this.is_ie) ? x+'px' : 'translate3d('+x+'px, '+y+'px, 0)';
		}
		return str;
	};

	addPagination() {
		let list = document.createElement('ul');
		this.elem.appendChild(list);
		dom.addClass(list,'carousel__pagination list--inline');

		var len;
		if (this.infinate){
			len = this.panels_len - (this.inview*2) + 2;
		}
		else {
			len = this.panels_len + 2;
		}

		for (var i = 0; i < len; i++){
			let label;
			let callback;
			if (i == 0) {
				label = '<';
				callback = this.previousPanel;
			}
			else if (i == len-1){
				label = '>';
				callback = this.nextPanel;
			}
			else {
				label = i;
				callback = this.goTo;
			}
			let li = document.createElement('li'); 
			let anchor = document.createElement('a');
			let txt = document.createTextNode(label);

			list.appendChild(li);
			li.appendChild(anchor);
			anchor.appendChild(txt);

			let that = this;

			var clickEvent = function(n,cb) {
				return function() {
					that.stopAnim();
					that.elem.setAttribute('data-autoscroll','animating');

					var page;
					if (!that.opposite || that.direction === 'btt'){ //cant reorder stacking
						page = parseInt(n)-1;
						if (that.infinate){
							page += parseInt(that.inview)
						}
					}
					else {
						page = that.panels_len - parseInt(n);
						if (that.infinate){
							page -= parseInt(that.inview);
						}
					}
					
					cb.call(that,page);
				}
			}(i,callback);

			events.on(anchor,'click', clickEvent);
		}

		return this;
	}

	bindPaginationEvents() {
		return this;
	}

	setSize() {
		if (this.horizontal){
			this.setContainerWidth().setPanelWidth();
		}
		else {
			this.setContainerHeight().setPanelHeight()
		}

		this.setPosition(this.position);
	}

	bindTouchEvents() {
		var that = this;

		delete Hammer.defaults.cssProps.userSelect;
		var hammer = new Hammer(this.elem, { drag_lock_to_axis: true });

		if (this.horizontal){
			this.dragEnd = this.dragEndX;
			hammer.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 0 });
		}
		else {
			this.dragEnd = this.dragEndY;
			hammer.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL, threshold: 0 });
		}

		hammer.on('pan', function(e) {
			switch (e.direction) {
				case 2:
				case 4:
					if (that.horizontal){
						that.dragX(e);
					}
					break;
				case 8:
				case 16:
					if (!that.horizontal){
						that.dragY(e);
					}
					break;
			};
		})
		.on('panstart', function(e) {
			that.stopAnim();
		})
		.on('panend', function(e) {
			that.dragEnd(e);
		});
	};

	drag(distance,size) {
		if (distance > 0 && distance > size){
			distance = size;
		}
		if (distance < 0 && distance < -size){
			distance = -size;
		}
		this.setPosition(this.position,distance);
	}

	dragX(e) {
		this.drag(e.deltaX,this.getCarouselWidth()/this.inview);
	}

	dragY(e) {
		this.drag(e.deltaY,this.getCarouselHeight()/this.inview);
	}

	dragFin(distance,size) {
		let abDistance = Math.abs(distance);

		if (abDistance >= size/2){
			if (distance < 0){
				this.moveNext(distance);
			}
			else {
				this.movePrevious(distance);
			}
		}
		this.elem.setAttribute('data-autoscroll','animating');
		this.setPosition(this.position);
	}

	dragEndX(e) {
		this.dragFin(e.deltaX,this.getCarouselWidth()/this.inview);
	}

	dragEndY(e) {
		this.dragFin(e.deltaY,this.getCarouselHeight()/this.inview);
	}

	startAnim() {
		this.setAnimInterval(this.time_interval);
	}

	stopAnim() {
		this.elem.setAttribute('data-autoscroll','stop');
		this.interval = null;
		this.animate = false;
	}

	nextPanel(e) {
		this.moveNext();
	}

	goTo(n) {
		this.position = n;
		this.setPosition(this.position);
	}
	
	previousPanel(e) {
		this.movePrevious();
	}

	setAnimInterval(time) {
		var that = this;
		this.interval = setTimeout(function() {
			if (that.animate) {
				that.animatePosition();
			}
		},time);
	}

	moveNext(drag) {
		this.position ++;

		if (this.infinate && this.position%this.panels_len == this.panels_len-this.inview){
			this.elem.setAttribute('data-autoscroll','true');
			this.position = this.inview -1;
			this.setPosition(this.position,drag);
			this.position ++;
		};

		this.setPosition(this.position,drag);
		this.elem.setAttribute('data-autoscroll','animating');

		if (this.animate){
			this.setAnimInterval(this.time_interval);
		}
	}

	movePrevious(drag) {
		this.position --;

		if (this.infinate && this.position < this.inview-1){
			if (this.infinate){
				this.elem.setAttribute('data-autoscroll','true');
				this.position = this.panels_len -this.inview-1;

				this.setPosition(this.position,drag);
				this.position --;
			}
			else {
				this.position = this.panels_len -1;
			}
		}
		else if (this.position < 0){
			this.position = this.panels_len -1;
		}

		this.setPosition(this.position,drag);
		this.elem.setAttribute('data-autoscroll','animating');

		if (this.animate){
			this.setAnimInterval(this.time_interval);
		}
	}

	appendClones() {
		var clones_last = [];
		var clones_first = [];
		for (var i = 0, il = this.inview; i<il; i++){
			clones_last.push(this.panels[this.panels_len-(1+i)].cloneNode(true));
			clones_first.push(this.panels[i].cloneNode(true));
		}

		for (var i = 0, il = this.inview; i<il; i++){
			let clone_last = clones_last[i];
			let clone_first = clones_first[i];

			this.container.appendChild(clone_first);
			this.container.insertBefore(clone_last, this.container.firstChild);
			
			this.panels_len += 2;

			this.panels.unshift(clone_first);
			this.panels.push(clone_last);
		}
	}

	setPositionX(n,drag) {
		let pixels = n%this.panels_len * -(this.getCarouselWidth()/this.inview);
		if (drag) {
			pixels += drag;
		}
		this.setTransform(pixels,0)
		return this;
	}

	setPositionY(n,drag) {
		let pixels = n%this.panels_len * -(this.getCarouselHeight()/this.inview);
		if (drag) {
			pixels += drag;
		}
		this.setTransform(0,pixels);
		return this;
	}
	
	setTransform(x,y) {
		if (this.use_transform){
			this.container.style[this.css_prefix_transform] = 'translate3d('+x+'px, '+y+'px, 0)';
		}
		else {
			this.container.style['left'] = x+'px';
			this.container.style['top'] = y+'px';
		}
	}

	setContainerWidth() {
		let w = (100 / this.inview) * this.panels_len;
		this.container.style.width = w + '%';

		return this;
	}

	setContainerHeight() {
		let h = (100 / this.inview) * this.panels_len;
		this.container.style.height = h + '%';

		return this;
	}

	getCarouselWidth() {
		return this.elem.clientWidth;
	}

	getCarouselHeight() {
		return this.elem.clientHeight;
	}

	setPanelWidth() {
		for (var i =0, il = this.panels_len; i <il; i++) {
			this.panels[i].style.width = this.panels_percent + '%';
		};

		return this;
	}

	setPanelHeight() {
		for (var i =0, il = this.panels_len; i <il; i++) {
			this.panels[i].style.height = this.panels_percent + '%';
		};

		return this;
	}
}

export { Carousel };
