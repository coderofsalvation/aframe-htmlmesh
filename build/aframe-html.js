(function (three) {
	'use strict';

	// This is a copy of https://github.com/mrdoob/three.js/blob/0403020848c26a9605eb91c99a949111ad4a532e/examples/jsm/interactive/HTMLMesh.js

	class HTMLMesh extends three.Mesh {

		constructor( dom ) {

			const texture = new HTMLTexture( dom );

			const geometry = new three.PlaneGeometry( texture.image.width * 0.001, texture.image.height * 0.001 );
			const material = new three.MeshBasicMaterial( { map: texture, toneMapped: false, transparent: true } );

			super( geometry, material );

			function onEvent( event ) {

				material.map.dispatchDOMEvent( event );

			}

			this.addEventListener( 'mouseleave', onEvent );
			this.addEventListener( 'mousedown', onEvent );
			this.addEventListener( 'mousemove', onEvent );
			this.addEventListener( 'mouseup', onEvent );
			this.addEventListener( 'click', onEvent );

			this.dispose = function () {

				geometry.dispose();
				material.dispose();

				material.map.dispose();

				canvases.delete( dom );

				this.removeEventListener( 'mouseleave', onEvent );
				this.removeEventListener( 'mousedown', onEvent );
				this.removeEventListener( 'mousemove', onEvent );
				this.removeEventListener( 'mouseup', onEvent );
				this.removeEventListener( 'click', onEvent );

			};

		}

	}

	class HTMLTexture extends three.CanvasTexture {

		constructor( dom ) {

			super( html2canvas( dom ) );
			this.prevCanvasSize = { width: this.image.width, height: this.image.height };

			this.dom = dom;

			this.anisotropy = 16;
			if ( THREE.REVISION === '147' ) { // Keep compatibility with aframe 1.4.2

				this.encoding = three.sRGBEncoding;

			} else {

				this.colorSpace = three.SRGBColorSpace;

			}

			this.minFilter = three.LinearFilter;
			this.magFilter = three.LinearFilter;

			// Create an observer on the DOM, and run html2canvas update in the next loop
			const observer = new MutationObserver( () => {

				if ( ! this.scheduleUpdate ) {

					// ideally should use xr.requestAnimationFrame, here setTimeout to avoid passing the renderer
					this.scheduleUpdate = setTimeout( () => this.update(), 100 );

				}

			} );

			const config = { attributes: true, childList: true, subtree: true, characterData: true };
			observer.observe( dom, config );

			this.observer = observer;

		}

		dispatchDOMEvent( event ) {

			if ( event.data ) {

				htmlevent( this.dom, event.type, event.data.x, event.data.y );

			}

		}

		update() {

			this.image = html2canvas( this.dom );
			this.needsUpdate = true;

			this.scheduleUpdate = null;

			if ( this.image.width !== this.prevCanvasSize.width || this.image.height !== this.prevCanvasSize.height ) {
				this.prevCanvasSize.width = this.image.width;
				this.prevCanvasSize.height = this.image.height;
				this.dom.dispatchEvent(new CustomEvent('size-changed'));
			}

		}

		dispose() {

			if ( this.observer ) {

				this.observer.disconnect();

			}

			this.scheduleUpdate = clearTimeout( this.scheduleUpdate );

			super.dispose();

		}

	}

	// Those are all css properties we use in this file:
	const USED_CSS_PROPERTIES = [
		'backgroundColor', 'color',
		'borderRadius',
		'borderTopWidth', 'borderTopColor', 'borderTopStyle',
		'borderLeftWidth', 'borderLeftColor', 'borderLeftStyle',
		'borderBottomWidth', 'borderBottomColor', 'borderBottomStyle',
		'borderRightWidth', 'borderRightColor', 'borderRightStyle',
		'accentColor', 'fontFamily', 'fontWeight', 'fontSize', 'textTransform',
		'paddingLeft', 'paddingTop', 'paddingBottom', 'paddingRight',
		'overflow'
	];

	//

	const canvases = new WeakMap();

	function html2canvas( element ) {

		const range = document.createRange();
		const color = new three.Color();

		function Clipper( context ) {

			const clips = [];
			let isClipping = false;

			function doClip() {

				if ( isClipping ) {

					isClipping = false;
					context.restore();

				}

				if ( clips.length === 0 ) return;

				let minX = - Infinity, minY = - Infinity;
				let maxX = Infinity, maxY = Infinity;

				for ( let i = 0; i < clips.length; i ++ ) {

					const clip = clips[ i ];

					minX = Math.max( minX, clip.x );
					minY = Math.max( minY, clip.y );
					maxX = Math.min( maxX, clip.x + clip.width );
					maxY = Math.min( maxY, clip.y + clip.height );

				}

				context.save();
				context.beginPath();
				context.rect( minX, minY, maxX - minX, maxY - minY );
				context.clip();

				isClipping = true;

			}

			return {

				add: function ( clip ) {

					clips.push( clip );
					doClip();

				},

				remove: function () {

					clips.pop();
					doClip();

				}

			};

		}

		function getLines( ctx, text, maxWidth ) {
			const words = text.split( " " );
			const lines = [];
			let currentLine = words[0];

			for (let i = 1; i < words.length; i++) {

				const word = words[i];
				const width = ctx.measureText( currentLine + " " + word ).width;
				if ( width < maxWidth ) {
					currentLine += " " + word;
				} else {
					lines.push( currentLine );
					currentLine = word;
				}
			}
			lines.push(currentLine);
			return lines;
		}

		function drawText( style, x, y, string, maxWidth ) {

			if ( string !== '' ) {

				if ( style.textTransform === 'uppercase' ) {

					string = string.toUpperCase();

				}

				context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
				context.textBaseline = 'top';
				context.fillStyle = style.color;
				if ( !maxWidth ) {
					context.fillText( string, x, y + parseFloat( style.fontSize ) * 0.1 );
				} else {
					const lines = getLines(context, string, maxWidth);
					lines.forEach(function(line, i) {
						context.fillText( line, x, y + parseFloat( style.fontSize ) * 0.1 + i * parseFloat( style.fontSize ) * 1.3 );
					});
				}

			}

		}

		function buildRectPath( x, y, w, h, r ) {

			if ( w < 2 * r ) r = w / 2;
			if ( h < 2 * r ) r = h / 2;

			context.beginPath();
			context.moveTo( x + r, y );
			context.arcTo( x + w, y, x + w, y + h, r );
			context.arcTo( x + w, y + h, x, y + h, r );
			context.arcTo( x, y + h, x, y, r );
			context.arcTo( x, y, x + w, y, r );
			context.closePath();

		}

		function drawBorder( style, which, x, y, width, height ) {

			const borderWidth = style[ which + 'Width' ];
			const borderStyle = style[ which + 'Style' ];
			const borderColor = style[ which + 'Color' ];

			if ( borderWidth !== '0px' && borderStyle !== 'none' && borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)' ) {

				context.strokeStyle = borderColor;
				context.lineWidth = parseFloat( borderWidth );
				context.beginPath();
				context.moveTo( x, y );
				context.lineTo( x + width, y + height );
				context.stroke();

			}

		}

		function getStyleForElement( element ) {
			const style = window.getComputedStyle( element );
			if ( element instanceof HTMLButtonElement ) {
				if ( element.dataset.hoverStyleStored !== 'true' ) {
					// The first time we render, store hover style in data attributes to make
					// hover style work in VR because style aren't recomputed when we add the
					// hover class.
					if ( element.dataset.hoverStyleStored !== 'pending' ) {
						// The mutation observer won't trigger rerender if we add the class now because we're currently rendering (scheduleUpdate is defined)
						// Wait end of render before we modify the DOM.
						element.dataset.hoverStyleStored = 'pending';
						queueMicrotask( () => {
							// Disable any css transition to avoir having a
							// background color in between states when rerender is triggered.
							element.style.transitionDuration = '0s';
							element.classList.add( 'hover' );
						} );
					} else if ( element.classList.contains( 'hover' ) ){
						// rerender was called, now store the updated computed style for hover
						for ( const prop of USED_CSS_PROPERTIES ) {
							element.dataset[prop] = style[prop];
						}
						element.dataset.hoverStyleStored = 'true';
						queueMicrotask( () => {
							element.classList.remove( 'hover' );
						} );
					}
				}
			}
			return element.classList.contains( 'hover' ) && element.dataset.hoverStyleStored === 'true' ? element.dataset : style;
		}

		function drawElement( element, style ) {

			let x = 0, y = 0, width = 0, height = 0;

			if ( element.nodeType === Node.TEXT_NODE ) {

				// text

				range.selectNode( element );

				const rect = range.getBoundingClientRect();

				x = rect.left - offset.left - 0.5;
				y = rect.top - offset.top - 0.5;
				width = rect.width;
				height = rect.height;
				// On Quest the font used to draw on canvas is bigger than on
				// the desktop, compensate for this.
				const maxWidth = width * 1.01; // 1.005 is good, but use 1.01 to be sure

				drawText( style, x, y, element.nodeValue.trim(), maxWidth );

			} else if ( element.nodeType === Node.COMMENT_NODE ) {

				return;

			} else if ( element instanceof HTMLCanvasElement ) {

				// Canvas element
				if ( element.style.display === 'none' ) return;

				const rect = element.getBoundingClientRect();

				x = rect.left - offset.left - 0.5;
				y = rect.top - offset.top - 0.5;

			        context.save();
				const dpr = window.devicePixelRatio;
				context.scale( 1 / dpr, 1 / dpr );
				context.drawImage( element, x, y );
				context.restore();

			} else if ( element instanceof HTMLImageElement ) {

				if ( element.style.display === 'none' ) return;

				const rect = element.getBoundingClientRect();

				x = rect.left - offset.left - 0.5;
				y = rect.top - offset.top - 0.5;
				width = rect.width;
				height = rect.height;

				context.drawImage( element, x, y, width, height );

			} else {

				if ( element.style.display === 'none' ) return;

				const rect = element.getBoundingClientRect();

				x = rect.left - offset.left - 0.5;
				y = rect.top - offset.top - 0.5;
				width = rect.width;
				height = rect.height;

				style = getStyleForElement( element );

				// Get the border of the element used for fill and border

				buildRectPath( x, y, width, height, parseFloat( style.borderRadius ) );

				const backgroundColor = style.backgroundColor;

				if ( backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)' ) {

					context.fillStyle = backgroundColor;
					context.fill();

				}

				// If all the borders match then stroke the round rectangle

				const borders = [ 'borderTop', 'borderLeft', 'borderBottom', 'borderRight' ];

				let match = true;
				let prevBorder = null;

				for ( const border of borders ) {

					if ( prevBorder !== null ) {

						match = ( style[ border + 'Width' ] === style[ prevBorder + 'Width' ] ) &&
						( style[ border + 'Color' ] === style[ prevBorder + 'Color' ] ) &&
						( style[ border + 'Style' ] === style[ prevBorder + 'Style' ] );

					}

					if ( match === false ) break;

					prevBorder = border;

				}

				if ( match === true ) {

					// They all match so stroke the rectangle from before allows for border-radius

					const width = parseFloat( style.borderTopWidth );

					if ( style.borderTopWidth !== '0px' && style.borderTopStyle !== 'none' && style.borderTopColor !== 'transparent' && style.borderTopColor !== 'rgba(0, 0, 0, 0)' ) {

						context.strokeStyle = style.borderTopColor;
						context.lineWidth = width;
						context.stroke();

					}

				} else {

					// Otherwise draw individual borders

					drawBorder( style, 'borderTop', x, y, width, 0 );
					drawBorder( style, 'borderLeft', x, y, 0, height );
					drawBorder( style, 'borderBottom', x, y + height, width, 0 );
					drawBorder( style, 'borderRight', x + width, y, 0, height );

				}

				if ( element instanceof HTMLInputElement ) {

					let accentColor = style.accentColor;

					if ( accentColor === undefined || accentColor === 'auto' ) accentColor = style.color;

					color.set( accentColor );

					const luminance = Math.sqrt( 0.299 * ( color.r ** 2 ) + 0.587 * ( color.g ** 2 ) + 0.114 * ( color.b ** 2 ) );
					const accentTextColor = luminance < 0.5 ? 'white' : '#111111';

					if ( element.type === 'radio' ) {

						buildRectPath( x, y, width, height, height );

						context.fillStyle = 'white';
						context.strokeStyle = accentColor;
						context.lineWidth = 1;
						context.fill();
						context.stroke();

						if ( element.checked ) {

							buildRectPath( x + 2, y + 2, width - 4, height - 4, height );

							context.fillStyle = accentColor;
							context.strokeStyle = accentTextColor;
							context.lineWidth = 2;
							context.fill();
							context.stroke();

						}

					}

					if ( element.type === 'checkbox' ) {

						buildRectPath( x, y, width, height, 2 );

						context.fillStyle = element.checked ? accentColor : 'white';
						context.strokeStyle = element.checked ? accentTextColor : accentColor;
						context.lineWidth = 1;
						context.stroke();
						context.fill();

						if ( element.checked ) {

							const currentTextAlign = context.textAlign;

							context.textAlign = 'center';

							const properties = {
								color: accentTextColor,
								fontFamily: style.fontFamily,
								fontSize: height + 'px',
								fontWeight: 'bold'
							};

							drawText( properties, x + ( width / 2 ), y, '✔' );

							context.textAlign = currentTextAlign;

						}

					}

					if ( element.type === 'range' ) {

						const [ min, max, value ] = [ 'min', 'max', 'value' ].map( property => parseFloat( element[ property ] ) );
						const position = ( ( value - min ) / ( max - min ) ) * ( width - height );

						buildRectPath( x, y + ( height / 4 ), width, height / 2, height / 4 );
						context.fillStyle = accentTextColor;
						context.strokeStyle = accentColor;
						context.lineWidth = 1;
						context.fill();
						context.stroke();

						buildRectPath( x, y + ( height / 4 ), position + ( height / 2 ), height / 2, height / 4 );
						context.fillStyle = accentColor;
						context.fill();

						buildRectPath( x + position, y, height, height, height / 2 );
						context.fillStyle = accentColor;
						context.fill();

					}

					if ( element.type === 'color' || element.type === 'text' || element.type === 'number' ) {

						clipper.add( { x: x, y: y, width: width, height: height } );

						drawText( style, x + parseInt( style.paddingLeft ), y + parseInt( style.paddingTop ), element.value );

						clipper.remove();

					}

				}

			}

			/*
			// debug
			context.strokeStyle = '#' + Math.random().toString( 16 ).slice( - 3 );
			context.strokeRect( x - 0.5, y - 0.5, width + 1, height + 1 );
			*/

			const isClipping = style.overflow === 'auto' || style.overflow === 'hidden';

			if ( isClipping ) clipper.add( { x: x, y: y, width: width, height: height } );

			for ( let i = 0; i < element.childNodes.length; i ++ ) {

				drawElement( element.childNodes[ i ], style );

			}

			if ( isClipping ) clipper.remove();

		}

		const offset = element.getBoundingClientRect();

		let canvas = canvases.get( element );

		if ( canvas === undefined ) {

			canvas = document.createElement( 'canvas' );
			canvases.set( element, canvas );

		}

		canvas.width = offset.width;
		canvas.height = offset.height;

		const context = canvas.getContext( '2d'/*, { alpha: false }*/ );

		const clipper = new Clipper( context );

		// console.time( 'drawElement' );

		context.clearRect(0, 0, canvas.width, canvas.height);

		drawElement( element );

		// console.timeEnd( 'drawElement' );

		return canvas;

	}

	function htmlevent( element, event, x, y ) {

		const mouseEventInit = {
			clientX: ( x * element.offsetWidth ) + element.offsetLeft,
			clientY: ( y * element.offsetHeight ) + element.offsetTop,
			view: element.ownerDocument.defaultView
		};

		// TODO: Find out why this is added. Keep commented out when this file is updated
		// window.dispatchEvent( new MouseEvent( event, mouseEventInit ) );

		const rect = element.getBoundingClientRect();

		x = x * rect.width + rect.left;
		y = y * rect.height + rect.top;

		function traverse( element ) {

			if ( element.nodeType !== Node.TEXT_NODE && element.nodeType !== Node.COMMENT_NODE ) {

				const rect = element.getBoundingClientRect();

				if ( x > rect.left && x < rect.right && y > rect.top && y < rect.bottom ) {

					element.dispatchEvent( new MouseEvent( event, mouseEventInit ) );

					if ( element instanceof HTMLButtonElement ) {
						switch ( event ) {
							case 'mousemove':
								if ( !element.classList.contains( 'hover' ) ) {
									element.classList.add('hover');
								}
								break;
						}
					}

					if ( element instanceof HTMLInputElement && element.type === 'range' && ( event === 'mousedown' || event === 'click' ) ) {

						const [ min, max ] = [ 'min', 'max' ].map( property => parseFloat( element[ property ] ) );

						const width = rect.width;
						const offsetX = x - rect.x;
						const proportion = offsetX / width;
						element.value = min + ( max - min ) * proportion;
						element.dispatchEvent( new InputEvent( 'input', { bubbles: true } ) );

					}

				} else {
					if ( element instanceof HTMLButtonElement ) {
						if ( element.classList.contains( 'hover' ) ) element.classList.remove( 'hover' );
					}
				}

				for ( let i = 0; i < element.childNodes.length; i ++ ) {

					traverse( element.childNodes[ i ] );

				}

			}

		}

		traverse( element );

	}

	/* jshint esversion: 9, -W097 */

	const schemaHTML = {
		html: {
			type: 'selector',
		},
		cursor: {
			type: 'selector',
		},
	  xrlayer:{
	    type:'bool',
	    default: true
	  }
	};

	{
		schemaHTML.html.description = `HTML element to use.`;
		schemaHTML.cursor.description = `Visual indicator for where the user is currently pointing`;
		schemaHTML.xrlayer.description = `Render via XR Layer for better performance and readability`;
	}

	const _pointer = new THREE.Vector2();
	const _event = { type: '', data: _pointer };
	AFRAME.registerComponent('html', {
		schema: schemaHTML,
		init() {
			this.rerender = this.rerender.bind(this);
			this.handle = this.handle.bind(this);
			this.onClick = e => this.handle('click', e);
			this.onMouseLeave = e => this.handle('mouseleave', e);
			this.onMouseEnter = e => this.handle('mouseenter', e);
			this.onMouseUp = e => this.handle('mouseup', e);
			this.onMouseDown = e => this.handle('mousedown', e);
			this.mouseMoveDetail = {
				detail: {
					cursorEl: null,
					intersection: null
				}
			};
			this.sizeChanged = this.sizeChanged.bind(this);
		},
		sizeChanged() {
			this.update();
		},
		play() {
			this.el.addEventListener('click', this.onClick);
			this.el.addEventListener('mouseleave', this.onMouseLeave);
			this.el.addEventListener('mouseenter', this.onMouseEnter);
			this.el.addEventListener('mouseup', this.onMouseUp);
			this.el.addEventListener('mousedown', this.onMouseDown);
			this.data.html.addEventListener('size-changed', this.sizeChanged);
		},
		pause() {
			this.el.removeEventListener('click', this.onClick);
			this.el.removeEventListener('mouseleave', this.onMouseLeave);
			this.el.removeEventListener('mouseenter', this.onMouseEnter);
			this.el.removeEventListener('mouseup', this.onMouseUp);
			this.el.removeEventListener('mousedown', this.onMouseDown);
			this.data.html.removeEventListener('size-changed', this.sizeChanged);
		},
		update() {
			this.remove();
			if (!this.data.html) return;
			const mesh = new HTMLMesh(this.data.html);
			this.el.setObject3D('html', mesh);
			this.data.html.addEventListener('input', this.rerender);
			this.data.html.addEventListener('change', this.rerender);
			this.cursor = this.data.cursor ? this.data.cursor.object3D : null;
	    if( this.data.xrlayer ) this.initXRLayer();
		},
		tick() {
			if (this.activeRaycaster) {
				const intersection = this.activeRaycaster.components.raycaster.getIntersection(this.el);
				this.mouseMoveDetail.detail.cursorEl = this.activeRaycaster;
				this.mouseMoveDetail.detail.intersection = intersection;
				this.handle('mousemove', this.mouseMoveDetail);
			}
		},
		handle(type, evt) {
			const intersection = evt.detail.intersection;
			const raycaster = evt.detail.cursorEl;
			if (type === 'mouseenter') {
				this.activeRaycaster = raycaster;
			}
			if (type === 'mouseleave' && this.activeRaycaster === raycaster) {
				this.activeRaycaster = null;
				_event.type = type;
				_event.data.set( -1, -1 );
				const mesh = this.el.getObject3D('html');
				mesh.dispatchEvent( _event );
			}
			if (this.cursor) this.cursor.visible = false;
			if (intersection) {
				const mesh = this.el.getObject3D('html');
				const uv = intersection.uv;
				_event.type = type;
				_event.data.set( uv.x, 1 - uv.y );
				mesh.dispatchEvent( _event );

				if (this.cursor) {
					this.cursor.visible = true;
					this.cursor.parent.worldToLocal(this.cursor.position.copy(intersection.point));
				}
			}
		},
		rerender() {
			const mesh = this.el.getObject3D('html');
			if (mesh && !mesh.material.map.scheduleUpdate) {
				mesh.material.map.scheduleUpdate = setTimeout( () => {
	        mesh.material.map.update();
	        this.el.emit('render',{},true);
	      }, 16 );
			}
		},
		remove() {
			const mesh = this.el.getObject3D('html');
			if (mesh) {
				this.el.removeObject3D('html');
				this.data.html.removeEventListener('input', this.rerender);
				this.data.html.removeEventListener('change', this.rerender);
				mesh.dispose();
			}
			this.activeRaycaster = null;
			this.mouseMoveDetail.detail.cursorEl = null;
			this.mouseMoveDetail.detail.intersection = null;
			this.cursor = null;
		},
	  initXRLayer() {
	    let sceneEl  = this.el.sceneEl;
	    sceneEl.renderer.xr;
	    let mesh     = this.el.getObject3D('html');
	    if( !mesh ) return 

	    if( !this.el.getAttribute('layer') ){
	      this.el.setAttribute('layer',{
	        src:    mesh.material.map.image, 
	        width:  mesh.material.map.image.width/1000,
	        height: mesh.material.map.image.height/1000
	      });
	      mesh.position.z -= 0.05;
	    }

	    this.el.addEventListener('render', () => {
	      let layer = this.el.components.layer;
	      if(!layer) return
	      layer.loadQuadImage();
	      layer.needsRedraw = true;
	    });
	  }
	});

})(THREE);
//# sourceMappingURL=aframe-html.js.map
