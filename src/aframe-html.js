/* jshint esversion: 9, -W097 */
/* For dealing with spline curves */
/* global THREE, AFRAME, setTimeout, console */
'use strict';

import { HTMLMesh } from './HTMLMesh.js';

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

documentation:
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
    if( this.data.xrlayer ) this.initXRLayer()
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
		this.data.html.addEventListener('size-changed', this.sizeChanged)
	},
	pause() {
		this.el.removeEventListener('click', this.onClick);
		this.el.removeEventListener('mouseleave', this.onMouseLeave);
		this.el.removeEventListener('mouseenter', this.onMouseEnter);
		this.el.removeEventListener('mouseup', this.onMouseUp);
		this.el.removeEventListener('mousedown', this.onMouseDown);
		this.data.html.removeEventListener('size-changed', this.sizeChanged)
	},
	update() {
		this.remove();
		if (!this.data.html) return;
		const mesh = new HTMLMesh(this.data.html);
		this.el.setObject3D('html', mesh);
		this.data.html.addEventListener('input', this.rerender);
		this.data.html.addEventListener('change', this.rerender);
		this.cursor = this.data.cursor ? this.data.cursor.object3D : null;
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
        console.log("rerender!")
        mesh.material.map.update()
        this.el.emit('rerender',{},true)
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
    var sceneEl = this.el.sceneEl;

    sceneEl.addEventListener('loaded', () => {
      if( !this.el.components.layer ){
        this.el.setAttribute('layer','')

        this.el.addEventListener('rerender', () => {

          let mesh = this.el.getObject3D('html')
          let layer = this.el.components.layer
          if( !mesh || !layer ) return // too early

          // setup layer if needed
          if( !layer.layer ){
            var gl = sceneEl.renderer.getContext();
            var xrGLFactory = this.xrGLFactory = new XRWebGLBinding(sceneEl.xrSession, gl);
            layer.layer = xrGLFactory.createQuadLayer({
              space: layer.referenceSpace,
              viewPixelHeight: 2048,
              viewPixelWidth: 2048,
              height: mesh.material.map.image.height / 1000,
              width: mesh.material.map.image.width / 1000
            });
            layer.initLoadingScreenImages();
            sceneEl.renderer.xr.addLayer(layer.layer);
            console.log("setting up layer")
          }
          console.log("updating XRLayer")
          if( mesh ) this.el.components.layer.data.src = mesh.material.map
        })
      }
    })
  }
});
