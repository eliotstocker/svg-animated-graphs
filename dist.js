(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.svgAnimatedGraphs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

const { shape, render, play, timeline } = require('wilderness');
const rounding = require('./rounding');
const svgPath = require('svgpath');
const merge = require('deepmerge');

const defaultOptions = {
    animateIn: true,
    interpolate: true,
    opacity: 0.7,
    type: 'area',
    offsetAnimate: false,
    lineWidth: 0.6,
    rounding: 0.25,
    width: '100%',
    height: '100%',
    groupMode: 'stacked',
    groupGap: 5,
    grid: {
        enabled: false,
        x: {
            enabled: true,
            every: 'auto',
            start: 0,
            ends: {
                left: true,
                right: true
            }
        },
        y: {
            enabled: true,
            every: 'auto',
            start: 0,
            ends: {
                top: true,
                bottom: true
            }
        }
    },
    colors: [
        [255, 0, 0],
        [255, 255, 0],
        [0, 0, 255],
        [0, 255, 0]
    ],
    showExtent: true,
};

const optionsRerender = ['showExtent'];
const optionsRedraw = ['type', 'colors', 'opacity', 'interpolate', 'lineWidth', 'extents', 'groupMode'];
const lineTypes = ['line', 'area'];
const roundTypes = ['donut', 'pie'];
const barTypes = ['bar', 'column'];
const fillTypes = ['area', 'pie'].concat(barTypes);
const extentTypes = [].concat(lineTypes, barTypes);
const allowedTypes = [].concat(lineTypes, roundTypes, barTypes);
const lineWeightMultiplier = {donut: 10};

const svgNS = 'http://www.w3.org/2000/svg';

const renderHeight = 110;
const renderWidth = 100;

class svgAnimatedGraphs {
    /**
     * Extents object
     * @typedef {Object} Extents
     * @property {Extent} x - extents for the x axis
     * @property {Extent} y - extents for the x axis
     */

    /** Extent Object
     * @typedef {Object} Extent
     * @property {Number} min - minimum value on axis
     * @property {Number} max - maximum value on axis
     */

    /**
     * Options object
     * @typedef {Object} Options
     * @property {string} options.xAxisField - the key from each data object to use as the X Axis value
     * @property {HTMLElement} options.el - the parent element to add teh graph into
     * @property {string} [options.units] - units to set on the y axis label
     * @property {string} [options.seriesProperties] - object to extract render properties from, general properties in the top level or per series properties in named keys
     * @property {string} [options.width=100%] - a valid size string to set to the width for the graph relative to the parent element
     * @property {string} [options.height=100%] - a valid size string to set to the height for the graph relative to the parent element
     * @property {boolean} [options.animateIn=true] - animate initial data from nothing
     * @property {boolean} [options.interpolate=true] - interpolate points to make the graph rounded
     * @property {string} [options.type=area] - graph type (line, area, more coming soon...)
     * @property {boolean} [options.offsetAnimate=true] - animate each dataset one at a time
     * @property {boolean} [options.showExtent=true] - show max y value extent line on graph
     * @property {number} [options.opacity=0.7] - opacity value for data set rendering
     * @property {number} [options.lineWidth=0.4] - width of lines when rendering without fill
     * @property {array} [options.colors] - an array of vector 3 values for graph dataset rendering
     * @property {number} [options.rounding=0.25] - amount of rounding to apply if interpolation is enabled
     * @property {Extents} [options.extents] - absolute values for graph extents (by default these will be calculated from the data sets
     * @property {string[]} [options.ignoreFields] - fields to ignore in the data objects array
     * @property {string} [options.groupMode=stacked] - how to group bars etc
     */

    /**
     * create a graph object
     * @param options {Options}
     */
    constructor(options) {
        this.options = merge.all([defaultOptions, options], {clone: false});
        this._listeners = {};

        console.log(this.options);

        if(!this.options.el) {
            throw new Error('you must provide a parent element | options.el');
        }

        if(!allowedTypes.includes(this.options.type)) {
            throw new Error(`type '${this.options.type}' not allowed.`);
        }

        this.el = this.options.el;

        if(this.options.data) {
            this._validateData(this.options.data);
            this.data = this.options.data;
        }

        this._paths = [];
        this._preRenderData = [];
        this._animation = null;
        this._animateTimeout = 0;

        this._createCanvas();
        this.extents = this._getExtents(this.data);

        if(this.options.animateIn || !this.data) {
            this._createInitial(this.data);
        } else {
            this.setData(this.data);
        }
    }

    /**
     * Create SVG Canvas inter
     * @private
     */
    _createCanvas() {
        this._container = document.createElement('div');
        this._container.style.position = 'relative';

        this._canvas = document.createElementNS(svgNS, 'svg');
        this._canvas.setAttribute('viewBox', `0 0 ${renderWidth} ${renderHeight}`);
        this._canvas.setAttribute('width', this.options.width);
        this._canvas.setAttribute('height', this.options.height);
        this._canvas.setAttribute('overflow', 'visible');
        this._canvas.setAttribute('preserveAspectRatio', 'none');
        this._canvas.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this._canvas.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        this._container.appendChild(this._canvas);
        this.el.appendChild(this._container);

        //this._createGradientReference('#334488', '#ff9988');

        this._listeners.canvasSizer && window.removeEventListener('resize', this._listeners.canvasSizer);
        window.addEventListener('resize', this._listeners.canvasSizer = () => {
            this._render(0, false);
        });
    }

    _createGradientReference(from, to) {
        let def = this._canvas.getElementsByTagNameNS(svgNS, 'defs');
        if(!def) {
            def = document.createElementNS(svgNS, 'defs');
            this._canvas.appendChild(def);
        }

        const grad = document.createElementNS(svgNS, 'linearGradient');

        const stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttributeNS(svgNS, 'offset', '0%');
        stop1.setAttributeNS(svgNS, 'stop-color', from);

        const stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttributeNS(svgNS, 'offset', '100%');
        stop2.setAttributeNS(svgNS, 'stop-color', to);

        grad.appendChild(stop1);
        grad.appendChild(stop2);

        def.appendChild(grad);
    }

    /**
     * set view height (mostly to enabled/disable top extent)
     * @param {number} height - canvas render height
     * @private
     */
    _setViewableHeight(height) {
        const ratio = this._container.offsetWidth / this._container.offsetHeight;
        this._setAspectRatio(ratio, height);
    }

    /**
     * set aspect ratio of the canvas
     * @param {number} ratio - width/height ratio
     * @param {number} height - canvas render height
     * @private
     */
    _setAspectRatio(ratio, height) {
        if (height * ratio !== this._width) {
            this._width = height * ratio;
        }
        this._ratio = ratio / 100 * height;
        this._canvas.setAttribute('viewBox', `0 ${renderHeight - height} ${this._width} ${height}`);
    }

    /**
     * get known reserved fields
     * @returns {string[]}
     * @private
     */
    _getReserved() {
        const reserved = [this.options.xAxisField];
        if(this.options.ignoreFields) {
            return reserved.concat(this.options.ignoreFields);
        }
        return reserved;
    }

    /**
     * get unreserved fields for series
     * @returns {string[]}
     * @private
     */
    _getUnreservedFields(data) {
        return this._getFields(data).filter(field => !this._getReserved().includes(field));
    }

    /**
     * Create initial line elements (if passed data, will create one for each dataset)
     * @private
     * @param {array} init - data set
     */
    _createInitial(init) {
        if (init) {
            const fields = this._getUnreservedFields(this.data);
            this._paths = fields.map((field, index) => this._createEmpty(this.options.colors[index], this.data.length, `plot-${field}-values`));

            this.setData(init);
        } else {
            const placeholder = this._createEmpty(this.options.colors[0]);
            this._paths = [placeholder];

            render(this._canvas, shape(placeholder));
        }
    }

    /**
     * clear off the canvas
     * @private
     */
    _clearCanvas() {
        if (this._canvas.children) {
            Array.from(this._canvas.children).forEach(item => {
                this._canvas.removeChild(item);
            });
        }
        if (this._container.children) {
            Array.from(this._container.children).forEach(item => {
                if(item.tagName !== 'svg') {
                    this._container.removeChild(item);
                }
            });
        }
    }

    /**
     * get the style attributes for a series
     * @param {array} color - rgb vector 3 color array
     * @param {string|null} key - series key
     * @private
     */
    _getStyle(color, key = null) {
        let style = {};

        if(fillTypes.includes(this.options.type)) {
            style.fill = `rgba(${color[0]},${color[1]},${color[2]}, ${this.options.opacity})`;
            style.stroke = `rgba(${color[0]},${color[1]},${color[2]}, 0)`;
        } else {
            style.fill = `rgba(${color[0]},${color[1]},${color[2]}, 0)`;
            style.stroke = `rgba(${color[0]},${color[1]},${color[2]}, ${this.options.opacity})`;
        }

        const multiplier = lineWeightMultiplier[this.options.type] || 1;

        style['stroke-width'] = this.options.lineWidth * multiplier;

        if(this.options.seriesProperties) {
            const globalProps = Object.entries(this.options.seriesProperties).reduce((acc, [k, v]) => {
                if (typeof v !== 'object') {
                    acc[k] = v;
                }
                return acc;
            }, {});

            Object.assign(style, globalProps, this.options.seriesProperties[key]);
        }

        return style;
    }

    /**
     * create an empty line
     * @private
     * @param {array} color - array of rgb values
     * @param {number} [size=10] - number of points to add to the initial line (makes for smoother tweening)
     * @param {string} [className] - class name for the line
     */
    _createEmpty(color, size = 10, className) {
        let points = `M 0,${renderHeight - 0.1}`;
        for(let i = 0; i < size; i++) {
            const loc = (100 / size) * (i + 1);
            points += ` L ${loc},${renderHeight - 0.1}`;
        }

        if(fillTypes.includes(this.options.type)) {
            points += `L ${renderHeight},${renderHeight} L 0,${renderHeight} Z`;
        }

        const spec = {
            type: 'path',
            d: points,
        };

        if(className) {
            spec.class = className;
        }

        return Object.assign({}, this._getStyle(color), spec);
    }

    /**
     * create an empty line
     * @private
     * @param {array} data - data set to validate
     */
    _validateData(data) {
        if(data.constructor !== Array) {
            throw new Error('data must be an array');
        }

        data.forEach(item => {
            if(item.constructor !== Object) {
                throw new Error('all elements in the data array must be Objects');
            }
        });

        const pointCount = data.reduce((acc, item) => {
            Object.keys(item).forEach(key => {
                if(!acc[key]) {
                    acc[key] = 0;
                }
                acc[key] ++;
            });
            return acc;
        }, {});

        Object.entries(pointCount).forEach(({field, count}) => {
            if(count < 2) {
                throw new Error(`all fields must have more than one data point field: '${field}' only contains a single point`);
            }
        });
    }

    /**
     * list fields available
     * @private
     * @param {array} data - data set
     */
    _getFields(data) {
        return Object.keys(data.reduce((acc, item) => {
            return Object.assign(acc, item);
        }, {}));
    }

    /**
     * get x and y axis extents
     * @private
     * @param {array} data - data set
     */
    _getExtents(data) {
        if(!data) {
            return {
                x: [0, 1],
                y: [0, 1]
            };
        }

        const fields = this._getUnreservedFields(data);

        const xKey = this.options.xAxisField;
        const x = data.reduce((extent, item) => {
            extent[0] = Math.min(item[xKey], extent[0]);
            extent[1] = Math.max(item[xKey], extent[1]);

            return extent;
        }, [Infinity,0]);

        if (this.options.extents && this.options.extents.x) {
            if(this.options.extents.x.min) {
                x[0] = this.options.extents.x.min;
            }
            if(this.options.extents.x.max) {
                x[1] = this.options.extents.x.max;
            }
        }

        const y = data.reduce((extent, item) => {
            extent[0] = Math.min(extent[0], ...fields.map(field => item[field]));
            extent[1] = Math.max(extent[1], ...fields.map(field => item[field]));

            return extent;
        }, [Infinity,0]);

        if (this.options.extents && this.options.extents.y) {
            if(this.options.extents.y.min) {
                y[0] = this.options.extents.y.min;
            }
            if(this.options.extents.y.max) {
                y[1] = this.options.extents.y.max;
            }
        }

        return {
            x,
            y
        };
    }

    /**
     * update the options to change the rendering style etc
     * @param {Options} options - partial options block to update options
     * @param {number} [duration=1000] - duration (in milliseconds) for animation if rerender is required
     */
    setOptions(options, duration = 1000) {
        if(options.type && !allowedTypes.includes(options.type)) {
            throw new Error(`type '${options.type}' not allowed.`);
        }

        Object.assign(this.options, options);

        const redraw = Object.keys(options).reduce((render, key) => optionsRedraw.includes(key) || render, false);
        const rerender = Object.keys(options).reduce((render, key) => optionsRerender.includes(key) || render, false);

        if(redraw) {
            this.setData(this.data, duration);
        }

        if(rerender) {
            this._render(0, false);
        }
    }

    /**
     * update the dataset (pass full dataset)
     * @param {array} data - new graph data
     * @param {number} [duration=1000] - duration (in milliseconds) for animation to the new data
     */
    setData(data, duration = 1000) {
        this._validateData(data);

        this.data = data;
        this.extents = this._getExtents(this.data);
        const fields = this._getUnreservedFields(this.data);

        const xKey = this.options.xAxisField;

        if (lineTypes.includes(this.options.type)) {
            this._preRenderData = fields.map(field => this._createLine(xKey, field));
        }
        else if (roundTypes.includes(this.options.type)) {
            this._preRenderData = fields.map(field => this._createSegment(xKey, field));
        } 
        else if (barTypes.includes(this.options.type)) {
            this._preRenderData = this.data.map(obj => this._createBarGroup(xKey, obj));
        }

        this._render(duration);
    }

    /**
     * render the data to the canvas
     * @param {number} duration - duration of animation
     * @param {boolean} animate - weather or not to animate the transition
     * @private
     */
    _render(duration = 1000, animate = true) {
        if(this._animation && !this._animation.state.finished) {
            clearTimeout(this._animateTimeout);
            this._animateTimeout = setTimeout(this._render.bind(this, duration, animate), 50);
            return;
        }

        const oldPaths = this._paths;
        const fields = this._getUnreservedFields(this.data);

        this._clearCanvas();

        if(this.options.showExtent && extentTypes.includes(this.options.type)) {
            this._setViewableHeight(110);
            this._renderText();
        } else {
            this._setViewableHeight(100);
        }

        if (lineTypes.includes(this.options.type)) {
            // render line or area
            this._paths = this._preRenderData.map(this._drawLinePath.bind(this));
        } else if (roundTypes.includes(this.options.type)) {
            // render pie or donut
            const total = this._preRenderData.reduce((acc, seg) => acc + seg.value, 0);
            let rotationAcc = 0;
            this._paths = this._preRenderData.map(segment => {
                const path = this._drawRoundPath(segment, total, rotationAcc);
                rotationAcc += segment.value;
                return path;
            });
        } else if(barTypes.includes(this.options.type)) {
            //render bar or column
            const total = this._preRenderData.reduce((acc, group) => Math.max(acc, group.max), 0);
            this._paths = [].concat(...this._preRenderData
                .map((data, index) => this._drawBarGroup(data, this._preRenderData.length, index, total)));
        } else {
            throw new Error('not yet implemented');
        }

        if(!oldPaths || oldPaths.length < 1 || !animate || duration < 1) {
            return render(this._canvas, ...this._paths.map(path => shape(path)));
        }

        let combinedShapes;
        if(this._paths.length > fields.length && this._paths.length !== oldPaths.length) {
            const remaining = this._paths.slice(oldPaths.length, this._paths.length);
            combinedShapes = oldPaths
                .map((value, index) => shape(value, this._paths[index]))
                .concat(remaining.map(def => shape(this._drawMinimisedShape(def), def)));
        } else {
            combinedShapes = this._paths.map((item, index) => shape(oldPaths[index] || oldPaths[0], item));
        }

        const gridShapes = this._drawGrid();
        render(this._canvas, ...gridShapes);

        this._animate(fields, combinedShapes, duration);
    }

    /**
     * build animation timeline and run it
     * @param {string[]} fields - list of fields being rendered in the graph
     * @param {Shape[]} combinedShapes - add shapes to be rendered (with start and end animation frames)
     * @param {number} duration - duration to render for
     * @private
     */
    _animate(fields, combinedShapes, duration) {
        if (this.options.offsetAnimate) {
            const chunks = combinedShapes.chunk(fields.length);
            const tl = [].concat(...chunks.map((chunk, cIndex) => {
                return chunk.map((item, iIndex) => {
                    const queue = {};
                    if(iIndex > 0) {
                        queue.after = `${cIndex}-${iIndex - 1}`;
                    } else if(cIndex > 0 || iIndex > 0) {
                        queue.offset = cIndex * 100;
                        queue.at = '0-0';
                    }
                    return [
                        item,
                        {
                            name: `${cIndex}-${iIndex}`,
                            queue
                        }
                    ];
                });
            }));

            this._animation = timeline(...tl, {
                duration
            });
            render(this._canvas, this._animation);
            play(this._animation);
        } else {
            this._animation = timeline(...combinedShapes.map((path, index) => {
                const queue = {};
                if (index) {
                    queue.at = 0;
                }
                return [path, {
                    name: index,
                    queue
                }];
            }), {
                duration
            });
            render(this._canvas, this._animation);
            play(this._animation);
        }
    }

    /**
     * Spatial Point
     * @typedef {number[]} Point
     */

    /**
     * Line Path Object
     * @typedef {object} LinePath
     * @property {string} key - line legend key
     * @property {number[]} color - color array (vector 3 r,g,b (0 - 256))
     * @property {Point[]} path - array of points to plot the line
     */

    /**
     * create a vector 2 point output for a single line dataset
     * @param {string} xKey - the value to use for the x axis
     * @param {string} yKey - the value to use for the y axis for this line
     * @private
     * @returns {LinePath}
     */
    _createLine(xKey, yKey) {
        const index = this._getUnreservedFields(this.data).indexOf(yKey);
        return {
            key: yKey,
            color: this.options.colors[index],
            path: this.data.reduce((path, item) => {
                const x = item[xKey];
                const y = item[yKey];
                if(typeof x === 'undefined' || typeof y === 'undefined') {
                    return path;
                }
                return path.concat([[
                    ((x - this.extents.x[0]) / (this.extents.x[1] - this.extents.x[0])) * 100,
                    ((y - this.extents.y[0]) / (this.extents.y[1] - this.extents.y[0])) * 100,
                ]]);
            }, [])
        };
    }

    /**
     * Segment spec
     * @typedef Segment
     * @property {string} key - Segment legend key
     * @property {number[]} color - color array (vector 3 r,g,b (0 - 256))
     * @property {number} value - total value assigned to the segment
     */

    /**
     * create a spec for a pie/donut segment
     * @param {string} xKey - the value to use for the x axis
     * @param {string} yKey - the value to use for the y axis for this segment
     * @returns {Segment}
     * @private
     */
    _createSegment(xKey, yKey) {
        const index = this._getUnreservedFields(this.data).indexOf(yKey);
        return {
            key: yKey,
            color: this.options.colors[index],
            value: this.data.reduce((val, item) => {
                const x = item[xKey];
                const y = item[yKey];
                if (typeof x === 'undefined' || typeof y === 'undefined') {
                    return val;
                }
                return val + y;
            }, 0)
        };
    }

    /**
     * Bar Spec
     * @typedef Bar
     * @property {string} key - field key
     * @property {number} value - bar representation value
     * @property {array} color - rgb vector 3 color array
     */

    /**
     * Bar Group Spec
     * @typedef BarGroup
     * @property {string|number} group - xAxis label for the group
     * @property {string} group - type (stacked or grouped)
     * @property {number} max - group maximum extent (max value when not stacked, combined values when stacked)
     * @property {Bar} quadrants - spec for the bars in the group
     */

    /**
     * create a spec for a bar group
     * @param {string} xKey - the value to use for the x axis
     * @param {object} data - single data entry point object (key value)
     * @returns {BarGroup}
     * @private
     */
    _createBarGroup(xKey, data) {
        const stacked = this.options.groupMode === 'stacked';
        const fields = this._getUnreservedFields(this.data);
        return {
            group: xKey,
            type: stacked ? 'stacked' : 'group',
            max: fields.reduce((acc, field) => {
                const val = data[field];
                if (stacked) {
                    return acc + val;
                }
                return Math.max(acc, val);
            }, 0),
            quadrants: fields.map(field => ({
                key: field,
                value: data[field],
                color: this.options.colors[fields.indexOf(field)]
            }))
        };
    }

    /**
     * return the point as an SVG operation
     * @param {string} prefix - operation marker
     * @param {Point} point - vector 2 point map
     * @returns {string} operation
     * @private
     */
    _getPoint(prefix, point) {
        return `${prefix} ${point[0] * this._ratio},${renderHeight - point[1]}`;
    }

    /**
     * create a shape output for a single series
     * @param {LinePath} data - Line path data
     * @private
     * @returns {Shape}
     */
    _drawLinePath(data) {
        let pathString = data.path.reduce((string, point) => {
            if(string === '') {
                string = this._getPoint('M', point);
            } else {
                string += this._getPoint(' L', point);
            }
            return string;
        }, '');

        if(this.options.interpolate) {
            pathString = rounding(pathString, 0.25, true);
        }

        if(fillTypes.includes(this.options.type)) {
            const last = data.path[data.path.length - 1];
            const first = data.path[0];
            pathString += `${this._getPoint(' L', [last[0], 0])}${this._getPoint(' L', [first[0], 0])} Z`;
        }


       return Object.assign({}, this._getStyle(data.color, data.key), {
            type: 'path',
            d: pathString,
            class: `plot-${data.key}-values`,
        });
    }

    /**
     * create a shape output for a pie/donut segment
     * @param {Segment} data - new graph data
     * @param {number} total - total of all values for pie
     * @param {number} rotation - start rotation for segment
     * @private
     * @returns {Object} Shape Definition
     */
    _drawRoundPath(data, total, rotation) {
        const l = 50 - ((this.options.lineWidth * (lineWeightMultiplier[this.options.type] || 1)) / 2);
        const xOffset = (50 * this._ratio) - l;
        const yOffset = 10 + (50 - l);

        const a = 360 * (data.value / total);
        const R = 360 * (rotation / total);
        const aCalc = (a > 180) ? 360 - a : a;
        const aRad = aCalc * Math.PI / 180;
        const z = Math.sqrt(2 * l * l - (2 * l * l * Math.cos(aRad)));

        const x = aCalc <= 90 ? l * Math.sin(aRad) : l * Math.sin((180 - aCalc) * Math.PI / 180);

        const Y = Math.sqrt(z * z - x * x);
        const X = a <= 180 ? l + x : l - x;

        let pathString = `M ${l},0 A ${l},${l} 1 0,1 ${X},${Y}`;
        if(fillTypes.includes(this.options.type)) {
            pathString = `M ${l},${l} ${pathString.replace('M', 'L')} z`;
        }

        const transformed = svgPath(pathString)
            .rotate(R, l, l)
            .translate(xOffset, yOffset)
            .round(4)
            .toString();

        return Object.assign(
            {},
            this._getStyle(data.color, data.key),
            {
                type: 'path',
                d: transformed,
                class: `plot-${data.key}-values`,
            }
        );
    }

    /**
     * draw a single data point group as bars
     * @param {object} group - group defination object
     * @param groupCount
     * @param groupIndex
     * @param max
     * @returns {object[]} Shape Definition
     * @private
     */
    _drawBarGroup(group, groupCount, groupIndex, max) {
        const gap = this.options.groupGap / 10;
        const groupWidth = (100 / groupCount) - gap;
        const groupStart = (groupWidth + gap) * groupIndex;

        const barWidth = group.type === 'stacked' ? groupWidth :
            groupWidth / Object.keys(group.quadrants).length;

        let stackHeight = 0;
        const direction = this.options.type === 'bar' ? 'vertical' : 'horizontal';

        return group.quadrants.map(({key, value, color}, index) => {
            const barStart = (group.type === 'stacked' ? 0 : barWidth * index) + groupStart;
            const height = (value / max) * 100;
            const barPart = Object.assign(
                {},
                this._getStyle(color, key),
                {
                    type: 'rect',
                    class: `plot-${key}-values`
                },
                this._barRotation(direction, height, barStart, barWidth, stackHeight)
            );

            stackHeight += group.type === 'stacked' ? height : 0;

            return barPart;
        });
    }

    /**
     * calculate horizonatl or vertical position for a bar based on the chart direction
     * @param {string} direction - horizontal or vertical
     * @param {number} value - percentage value for the bar
     * @param {number} barStart - percentage of where the bar should start along the X Axis
     * @param {number} barWidth - the width to render the bar
     * @param {number} stackHeight - percentage height to start the bar render from (for stack bars)
     * @returns {object} defines x, y, width and height
     * @private
     */
    _barRotation(direction, value, barStart, barWidth, stackHeight) {
        if(direction === 'horizontal') {
            return {
                x: stackHeight * this._ratio,
                y: barStart + 10,
                width: value * this._ratio,
                height: barWidth
            };
        } else {
            return {
                x: barStart * this._ratio,
                y: 110 - stackHeight,
                width: barWidth * this._ratio,
                height: - value
            };
        }
    }

    /**
     * draw bars minimised so that they can be scaled up from 0
     * @param {object} shape - bar spec
     * @returns {object} new minimised bar spec
     * @private
     */
    _drawMinimisedShape(shape) {
        if (!barTypes.includes(this.options.type)) {
            return shape;
        }

        if(this.options.type === 'bar') {
            return Object.assign({}, shape, {y: 110, height: 0});
        } else {
            return Object.assign({}, shape, {x: 0, width: 0});
        }
    }

    /**
     * get an array of keys from data to use as a legend
     * @returns {array} array of legend items
     */
    getLegendData() {
        return this._getUnreservedFields(this.data).map((key, index) => {
            const color = this.options.colors[index];
            return {
                index,
                label: key,
                color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.options.opacity})`
            };
        });
    }

    /**
     * render extent text
     * @private
     */
    _renderText() {
        const text = document.createElement('span');
        text.style.position = 'absolute';
        text.style.top = `${(this._container.offsetHeight / 110) * 1.5}px`;
        text.style.left = `${(this._container.offsetHeight / 110) * 1.5}px`;
        text.style.fontSize = `${(this._container.offsetHeight / 110) * 6}px`;
        text.style.textTransform = 'uppercase';
        text.style.opacity = this.options.opacity.toString(10);

        text.textContent = this.extents.y[1];
        if(this.options.units) {
            text.textContent += this.options.units;
        }

        if(!this.options.grid.enabled) {
            render(this._canvas, shape({
                type: 'line',
                x1: 0,
                x2: this._width,
                y1: 10,
                y2: 10,
                stroke: `rgba(0,0,0,${this.options.opacity})`,
                'stroke-width': 0.1
            }));
        }


        this._container.appendChild(text);
    }

    _drawGrid() {
        const {grid} = this.options;
        if(!grid.enabled) {
            return [];
        }

        const dist = {
            x: this.extents.x[1] - this.extents.x[0],
            y: this.extents.y[1] - this.extents.y[0]
        };

        const lines = {
            vertical: [],
            horizontal: []
        };

        if(grid.x.enabled) {
            //draw vertical lines
            let everyX = grid.x.every;
            if (everyX === 'auto') {
                everyX = Math.floor(dist.x / 6);
            }

            const startX = grid.x.start !== 0 ? grid.x.start : everyX;

            for (let i = startX; i <= dist.x; i += everyX) {
                const percent = i / dist.x;
                lines.vertical.push(this._createGridLineSpec('vertical', percent));
            }

            grid.x.ends.left && lines.vertical.push(this._createGridLineSpec('vertical', 0));
            grid.x.ends.right && lines.vertical.push(this._createGridLineSpec('vertical', 1));
        }

        if(grid.y.enabled) {
            //draw horizontal lines
            let everyY = grid.y.every;
            if (everyY === 'auto') {
                everyY = Math.floor(dist.y / 6);
            }

            const startY = grid.y.start !== 0 ? grid.y.start : everyY;

            for (let i = startY; i <= dist.y; i += everyY) {
                const percent = 1 - (i / dist.y);
                lines.horizontal.push(this._createGridLineSpec('horizontal', percent));
            }

            grid.y.ends.top && lines.horizontal.push(this._createGridLineSpec('horizontal', 0));
            grid.y.ends.bottom && lines.horizontal.push(this._createGridLineSpec('horizontal', 1));
        }

        const shapes = [];
        if(lines.vertical.length > 0) {
            shapes.push(shape({
                type: 'g',
                shapes: lines.vertical,
                class: 'grid-lines-vertical'
            }));
        }
        if(lines.horizontal.length > 0) {
            shapes.push(shape({
                type: 'g',
                shapes: lines.horizontal,
                class: 'grid-lines-horizontal'
            }));
        }
        return shapes;
    }

    _createGridLineSpec(direction, position) {
        let points = {};
        switch (direction) {
            case 'horizontal':
                points = {
                    x1: 0,
                    x2: this._width,
                    y1: (100 * position) + 10,
                    y2: (100 * position) + 10
                };
                break;
            case 'vertical':
                points = {
                    x1: this._width * position,
                    x2: this._width * position,
                    y1: 10,
                    y2: 110
                };
                break;
        }

        return  Object.assign({
            type: 'line',
            stroke: `rgba(0,0,0,${this.options.opacity})`,
            'stroke-width': 0.1
        }, points);
    }
}

Object.defineProperty(Array.prototype, 'chunk', {
    value: function(chunkSize) {
        const R = [];
        for (let i = 0; i < this.length; i += chunkSize)
            R.push(this.slice(i, i + chunkSize));
        return R;
    }
});

module.exports = svgAnimatedGraphs;
},{"./rounding":51,"deepmerge":2,"svgpath":23,"wilderness":47}],2:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.deepmerge = factory());
}(this, (function () { 'use strict';

var isMergeableObject = function isMergeableObject(value) {
	return isNonNullObject(value)
		&& !isSpecial(value)
};

function isNonNullObject(value) {
	return !!value && typeof value === 'object'
}

function isSpecial(value) {
	var stringValue = Object.prototype.toString.call(value);

	return stringValue === '[object RegExp]'
		|| stringValue === '[object Date]'
		|| isReactElement(value)
}

// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

function isReactElement(value) {
	return value.$$typeof === REACT_ELEMENT_TYPE
}

function emptyTarget(val) {
	return Array.isArray(val) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
	return (options.clone !== false && options.isMergeableObject(value))
		? deepmerge(emptyTarget(value), value, options)
		: value
}

function defaultArrayMerge(target, source, options) {
	return target.concat(source).map(function(element) {
		return cloneUnlessOtherwiseSpecified(element, options)
	})
}

function getMergeFunction(key, options) {
	if (!options.customMerge) {
		return deepmerge
	}
	var customMerge = options.customMerge(key);
	return typeof customMerge === 'function' ? customMerge : deepmerge
}

function mergeObject(target, source, options) {
	var destination = {};
	if (options.isMergeableObject(target)) {
		Object.keys(target).forEach(function(key) {
			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
		});
	}
	Object.keys(source).forEach(function(key) {
		if (!options.isMergeableObject(source[key]) || !target[key]) {
			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
		} else {
			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
		}
	});
	return destination
}

function deepmerge(target, source, options) {
	options = options || {};
	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
	options.isMergeableObject = options.isMergeableObject || isMergeableObject;

	var sourceIsArray = Array.isArray(source);
	var targetIsArray = Array.isArray(target);
	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

	if (!sourceAndTargetTypesMatch) {
		return cloneUnlessOtherwiseSpecified(source, options)
	} else if (sourceIsArray) {
		return options.arrayMerge(target, source, options)
	} else {
		return mergeObject(target, source, options)
	}
}

deepmerge.all = function deepmergeAll(array, options) {
	if (!Array.isArray(array)) {
		throw new Error('first argument should be an array')
	}

	return array.reduce(function(prev, next) {
		return deepmerge(prev, next, options)
	}, {})
};

var deepmerge_1 = deepmerge;

return deepmerge_1;

})));

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.curvedPoints = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _cubify = require('./cubify');

var _cubify2 = _interopRequireDefault(_cubify);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var linearPoints = function linearPoints(from, to) {
  return [{
    x: (0, _helpers.numberAtInterval)(from.x, to.x, 0.5),
    y: (0, _helpers.numberAtInterval)(from.y, to.y, 0.5)
  }, to];
};

var curvedPoints = function curvedPoints(from, to) {
  var _to$curve = to.curve,
      x1 = _to$curve.x1,
      y1 = _to$curve.y1,
      x2 = _to$curve.x2,
      y2 = _to$curve.y2;


  var A = { x: from.x, y: from.y };
  var B = { x: x1, y: y1 };
  var C = { x: x2, y: y2 };
  var D = { x: to.x, y: to.y };
  var E = { x: (0, _helpers.numberAtInterval)(A.x, B.x, 0.5), y: (0, _helpers.numberAtInterval)(A.y, B.y, 0.5) };
  var F = { x: (0, _helpers.numberAtInterval)(B.x, C.x, 0.5), y: (0, _helpers.numberAtInterval)(B.y, C.y, 0.5) };
  var G = { x: (0, _helpers.numberAtInterval)(C.x, D.x, 0.5), y: (0, _helpers.numberAtInterval)(C.y, D.y, 0.5) };
  var H = { x: (0, _helpers.numberAtInterval)(E.x, F.x, 0.5), y: (0, _helpers.numberAtInterval)(E.y, F.y, 0.5) };
  var J = { x: (0, _helpers.numberAtInterval)(F.x, G.x, 0.5), y: (0, _helpers.numberAtInterval)(F.y, G.y, 0.5) };
  var K = { x: (0, _helpers.numberAtInterval)(H.x, J.x, 0.5), y: (0, _helpers.numberAtInterval)(H.y, J.y, 0.5) };

  return [{ x: K.x, y: K.y, curve: { type: 'cubic', x1: E.x, y1: E.y, x2: H.x, y2: H.y } }, { x: D.x, y: D.y, curve: { type: 'cubic', x1: J.x, y1: J.y, x2: G.x, y2: G.y } }];
};

var points = function points(from, to) {
  return to.curve ? curvedPoints(from, to) : linearPoints(from, to);
};

var addPoints = function addPoints(shape, pointsRequired) {
  if (isNaN(pointsRequired)) {
    throw Error('`add` function must be passed a number as the second argument');
  }

  var nextShape = [].concat(_toConsumableArray(shape));

  for (var i = 1; i < nextShape.length;) {
    if (nextShape.length >= pointsRequired) {
      return nextShape;
    }

    var to = nextShape[i];

    if (to.moveTo) {
      i++;
    } else {
      var from = nextShape[i - 1];

      var _points = points(from, to),
          _points2 = _slicedToArray(_points, 2),
          midPoint = _points2[0],
          replacementPoint = _points2[1];

      nextShape.splice(i, 1, midPoint, replacementPoint);

      i += 2;
    }
  }

  return addPoints(nextShape, pointsRequired);
};

var add = function add(shape, pointsRequired) {
  return addPoints((0, _cubify2.default)(shape), pointsRequired);
};

exports.curvedPoints = curvedPoints;
exports.default = add;
},{"./cubify":6,"./helpers":8}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

// I extracted this from the a2c function from
// SVG path – https://github.com/fontello/svgpath
//
// All credit goes to:
//
// Sergey Batishchev – https://github.com/snb2013
// Vitaly Puzrin – https://github.com/puzrin
// Alex Kocharin – https://github.com/rlidwka

var TAU = Math.PI * 2;

var mapToEllipse = function mapToEllipse(_ref, rx, ry, cosphi, sinphi, centerx, centery) {
  var x = _ref.x,
      y = _ref.y;

  x *= rx;
  y *= ry;

  var xp = cosphi * x - sinphi * y;
  var yp = sinphi * x + cosphi * y;

  return {
    x: xp + centerx,
    y: yp + centery
  };
};

var approxUnitArc = function approxUnitArc(ang1, ang2) {
  var a = 4 / 3 * Math.tan(ang2 / 4);

  var x1 = Math.cos(ang1);
  var y1 = Math.sin(ang1);
  var x2 = Math.cos(ang1 + ang2);
  var y2 = Math.sin(ang1 + ang2);

  return [{
    x: x1 - y1 * a,
    y: y1 + x1 * a
  }, {
    x: x2 + y2 * a,
    y: y2 - x2 * a
  }, {
    x: x2,
    y: y2
  }];
};

var vectorAngle = function vectorAngle(ux, uy, vx, vy) {
  var sign = ux * vy - uy * vx < 0 ? -1 : 1;
  var umag = Math.sqrt(ux * ux + uy * uy);
  var vmag = Math.sqrt(ux * ux + uy * uy);
  var dot = ux * vx + uy * vy;

  var div = dot / (umag * vmag);

  if (div > 1) {
    div = 1;
  }

  if (div < -1) {
    div = -1;
  }

  return sign * Math.acos(div);
};

var getArcCenter = function getArcCenter(px, py, cx, cy, rx, ry, largeArcFlag, sweepFlag, sinphi, cosphi, pxp, pyp) {
  var rxsq = Math.pow(rx, 2);
  var rysq = Math.pow(ry, 2);
  var pxpsq = Math.pow(pxp, 2);
  var pypsq = Math.pow(pyp, 2);

  var radicant = rxsq * rysq - rxsq * pypsq - rysq * pxpsq;

  if (radicant < 0) {
    radicant = 0;
  }

  radicant /= rxsq * pypsq + rysq * pxpsq;
  radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1);

  var centerxp = radicant * rx / ry * pyp;
  var centeryp = radicant * -ry / rx * pxp;

  var centerx = cosphi * centerxp - sinphi * centeryp + (px + cx) / 2;
  var centery = sinphi * centerxp + cosphi * centeryp + (py + cy) / 2;

  var vx1 = (pxp - centerxp) / rx;
  var vy1 = (pyp - centeryp) / ry;
  var vx2 = (-pxp - centerxp) / rx;
  var vy2 = (-pyp - centeryp) / ry;

  var ang1 = vectorAngle(1, 0, vx1, vy1);
  var ang2 = vectorAngle(vx1, vy1, vx2, vy2);

  if (sweepFlag === 0 && ang2 > 0) {
    ang2 -= TAU;
  }

  if (sweepFlag === 1 && ang2 < 0) {
    ang2 += TAU;
  }

  return [centerx, centery, ang1, ang2];
};

var arcToBezier = function arcToBezier(_ref2) {
  var px = _ref2.px,
      py = _ref2.py,
      cx = _ref2.cx,
      cy = _ref2.cy,
      rx = _ref2.rx,
      ry = _ref2.ry,
      _ref2$xAxisRotation = _ref2.xAxisRotation,
      xAxisRotation = _ref2$xAxisRotation === undefined ? 0 : _ref2$xAxisRotation,
      _ref2$largeArcFlag = _ref2.largeArcFlag,
      largeArcFlag = _ref2$largeArcFlag === undefined ? 0 : _ref2$largeArcFlag,
      _ref2$sweepFlag = _ref2.sweepFlag,
      sweepFlag = _ref2$sweepFlag === undefined ? 0 : _ref2$sweepFlag;

  var curves = [];

  if (rx === 0 || ry === 0) {
    return [];
  }

  var sinphi = Math.sin(xAxisRotation * TAU / 360);
  var cosphi = Math.cos(xAxisRotation * TAU / 360);

  var pxp = cosphi * (px - cx) / 2 + sinphi * (py - cy) / 2;
  var pyp = -sinphi * (px - cx) / 2 + cosphi * (py - cy) / 2;

  if (pxp === 0 && pyp === 0) {
    return [];
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  var lambda = Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);

  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  var _getArcCenter = getArcCenter(px, py, cx, cy, rx, ry, largeArcFlag, sweepFlag, sinphi, cosphi, pxp, pyp),
      _getArcCenter2 = _slicedToArray(_getArcCenter, 4),
      centerx = _getArcCenter2[0],
      centery = _getArcCenter2[1],
      ang1 = _getArcCenter2[2],
      ang2 = _getArcCenter2[3];

  var segments = Math.max(Math.ceil(Math.abs(ang2) / (TAU / 4)), 1);

  ang2 /= segments;

  for (var i = 0; i < segments; i++) {
    curves.push(approxUnitArc(ang1, ang2));
    ang1 += ang2;
  }

  return curves.map(function (curve) {
    var _mapToEllipse = mapToEllipse(curve[0], rx, ry, cosphi, sinphi, centerx, centery),
        x1 = _mapToEllipse.x,
        y1 = _mapToEllipse.y;

    var _mapToEllipse2 = mapToEllipse(curve[1], rx, ry, cosphi, sinphi, centerx, centery),
        x2 = _mapToEllipse2.x,
        y2 = _mapToEllipse2.y;

    var _mapToEllipse3 = mapToEllipse(curve[2], rx, ry, cosphi, sinphi, centerx, centery),
        x = _mapToEllipse3.x,
        y = _mapToEllipse3.y;

    return { x1: x1, y1: y1, x2: x2, y2: y2, x: x, y: y };
  });
};

exports.default = arcToBezier;
},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _decurve = require('./decurve');

var _decurve2 = _interopRequireDefault(_decurve);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var boundingBox = function boundingBox(s) {
  var bottom = void 0;
  var left = void 0;
  var right = void 0;
  var top = void 0;

  var shapes = (0, _helpers.getShapeArray)(s);

  shapes.map(function (shape) {
    return (0, _decurve2.default)(shape).map(function (_ref) {
      var x = _ref.x,
          y = _ref.y;

      if (typeof bottom !== 'number' || y > bottom) {
        bottom = y;
      }

      if (typeof left !== 'number' || x < left) {
        left = x;
      }

      if (typeof right !== 'number' || x > right) {
        right = x;
      }

      if (typeof top !== 'number' || y < top) {
        top = y;
      }
    });
  });

  return {
    bottom: bottom,
    center: {
      x: left + (right - left) / 2,
      y: top + (bottom - top) / 2
    },
    left: left,
    right: right,
    top: top
  };
};

exports.default = boundingBox;
},{"./decurve":7,"./helpers":8}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _arcToBezier = require('./arcToBezier');

var _arcToBezier2 = _interopRequireDefault(_arcToBezier);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var cubifyShape = function cubifyShape(shape) {
  var s = [];

  for (var i = 0, l = shape.length; i < l; i++) {
    var point = shape[i];

    if (point.curve && point.curve.type !== 'cubic') {
      var _shape = shape[i - 1],
          px = _shape.x,
          py = _shape.y;
      var cx = point.x,
          cy = point.y;


      if (point.curve.type === 'arc') {
        var curves = (0, _arcToBezier2.default)({
          px: px,
          py: py,
          cx: cx,
          cy: cy,
          rx: point.curve.rx,
          ry: point.curve.ry,
          xAxisRotation: point.curve.xAxisRotation,
          largeArcFlag: point.curve.largeArcFlag,
          sweepFlag: point.curve.sweepFlag
        });

        curves.forEach(function (_ref) {
          var x1 = _ref.x1,
              y1 = _ref.y1,
              x2 = _ref.x2,
              y2 = _ref.y2,
              x = _ref.x,
              y = _ref.y;

          s.push({ x: x, y: y, curve: { type: 'cubic', x1: x1, y1: y1, x2: x2, y2: y2 } });
        });
      } else if (point.curve.type === 'quadratic') {
        var x1 = px + 2 / 3 * (point.curve.x1 - px);
        var y1 = py + 2 / 3 * (point.curve.y1 - py);
        var x2 = cx + 2 / 3 * (point.curve.x1 - cx);
        var y2 = cy + 2 / 3 * (point.curve.y1 - cy);

        s.push({ x: cx, y: cy, curve: { type: 'cubic', x1: x1, y1: y1, x2: x2, y2: y2 } });
      }
    } else {
      s.push(point);
    }
  }

  return s;
};

var cubify = function cubify(s) {
  return (0, _helpers.applyFuncToShapes)(cubifyShape, s);
};

exports.default = cubify;
},{"./arcToBezier":4,"./helpers":8}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _helpers = require('./helpers');

var _cubify = require('./cubify');

var _cubify2 = _interopRequireDefault(_cubify);

var _add = require('./add');

var _length = require('./length');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var angle = function angle(triangle) {
  var _triangle$ = _slicedToArray(triangle[0], 2),
      ax = _triangle$[0],
      ay = _triangle$[1];

  var _triangle$2 = _slicedToArray(triangle[1], 2),
      bx = _triangle$2[0],
      by = _triangle$2[1];

  var _triangle$3 = _slicedToArray(triangle[2], 2),
      cx = _triangle$3[0],
      cy = _triangle$3[1];

  var a = (0, _length.linearLength)(ax, ay, bx, by);
  var b = (0, _length.linearLength)(bx, by, cx, cy);
  var c = (0, _length.linearLength)(cx, cy, ax, ay);

  return (0, _helpers.angleFromSides)(a, b, c);
};

var curved = function curved(shape) {
  return shape.reduce(function (c, _ref) {
    var curve = _ref.curve;
    return curve ? true : c;
  }, false);
};

var decurve = function decurve(shape) {
  var accuracy = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

  if (!curved(shape)) {
    return shape;
  }

  var s = (0, _cubify2.default)(shape);
  var d = [];

  s.map(function (point, i) {
    if (point.curve) {
      var prevPoint = s[i - 1];
      straighten(prevPoint, point, accuracy).map(function (p) {
        return d.push(p);
      });
    } else {
      d.push(point);
    }
  });

  return d;
};

var straight = function straight(x1, y1, cx1, cy1, x2, y2, cx2, cy2, accuracy) {
  var t1 = [[cx1, cy1], [x2, y2], [x1, y1]];
  var t2 = [[cx2, cy2], [x1, y1], [x2, y2]];
  return angle(t1) < accuracy && angle(t2) < accuracy;
};

var straighten = function straighten(prevPoint, point, accuracy) {
  var x1 = prevPoint.x,
      y1 = prevPoint.y;
  var x2 = point.x,
      y2 = point.y,
      curve = point.curve;
  var cx1 = curve.x1,
      cy1 = curve.y1,
      cx2 = curve.x2,
      cy2 = curve.y2;


  if (straight(x1, y1, cx1, cy1, x2, y2, cx2, cy2, accuracy)) {
    return [point];
  }

  var _curvedPoints = (0, _add.curvedPoints)(prevPoint, point),
      _curvedPoints2 = _slicedToArray(_curvedPoints, 2),
      midPoint = _curvedPoints2[0],
      lastPoint = _curvedPoints2[1];

  return [].concat(_toConsumableArray(straighten(prevPoint, midPoint, accuracy)), _toConsumableArray(straighten(midPoint, lastPoint, accuracy)));
};

exports.default = decurve;
},{"./add":3,"./cubify":6,"./helpers":8,"./length":10}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var angleFromSides = function angleFromSides(a, b, c) {
  var r = Math.acos((Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b));

  return r * (180 / Math.PI);
};

var applyFuncToShapes = function applyFuncToShapes(f, s) {
  for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  if (isShapeArray(s)) {
    return s.map(function (shape) {
      return f.apply(undefined, [shape].concat(args));
    });
  }

  return f.apply(undefined, [s].concat(args));
};

var getShapeArray = function getShapeArray(s) {
  return isShapeArray(s) ? s : [s];
};

var isShapeArray = function isShapeArray(s) {
  return Array.isArray(s[0]);
};

var numberAtInterval = function numberAtInterval(a, b, interval) {
  var c = a === b ? 0 : Math.abs(b - a);
  return c === 0 ? a : a < b ? a + c * interval : a - c * interval;
};

exports.angleFromSides = angleFromSides;
exports.applyFuncToShapes = applyFuncToShapes;
exports.getShapeArray = getShapeArray;
exports.isShapeArray = isShapeArray;
exports.numberAtInterval = numberAtInterval;
},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.scale = exports.rotate = exports.reverse = exports.remove = exports.position = exports.offset = exports.moveIndex = exports.length = exports.cubify = exports.boundingBox = exports.add = undefined;

var _add = require('./add');

var _add2 = _interopRequireDefault(_add);

var _boundingBox = require('./boundingBox');

var _boundingBox2 = _interopRequireDefault(_boundingBox);

var _cubify = require('./cubify');

var _cubify2 = _interopRequireDefault(_cubify);

var _length = require('./length');

var _length2 = _interopRequireDefault(_length);

var _moveIndex = require('./moveIndex');

var _moveIndex2 = _interopRequireDefault(_moveIndex);

var _offset = require('./offset');

var _offset2 = _interopRequireDefault(_offset);

var _position = require('./position');

var _position2 = _interopRequireDefault(_position);

var _remove = require('./remove');

var _remove2 = _interopRequireDefault(_remove);

var _reverse = require('./reverse');

var _reverse2 = _interopRequireDefault(_reverse);

var _rotate = require('./rotate');

var _rotate2 = _interopRequireDefault(_rotate);

var _scale = require('./scale');

var _scale2 = _interopRequireDefault(_scale);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.add = _add2.default;
exports.boundingBox = _boundingBox2.default;
exports.cubify = _cubify2.default;
exports.length = _length2.default;
exports.moveIndex = _moveIndex2.default;
exports.offset = _offset2.default;
exports.position = _position2.default;
exports.remove = _remove2.default;
exports.reverse = _reverse2.default;
exports.rotate = _rotate2.default;
exports.scale = _scale2.default;
},{"./add":3,"./boundingBox":5,"./cubify":6,"./length":10,"./moveIndex":11,"./offset":12,"./position":13,"./remove":14,"./reverse":15,"./rotate":16,"./scale":17}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.linearLength = undefined;

var _decurve = require('./decurve');

var _decurve2 = _interopRequireDefault(_decurve);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var length = function length(shape, accuracy) {
  var s = (0, _decurve2.default)(shape, accuracy);

  return s.reduce(function (currentLength, _ref, i) {
    var x2 = _ref.x,
        y2 = _ref.y,
        moveTo = _ref.moveTo;

    if (!moveTo) {
      var _s = s[i - 1],
          x1 = _s.x,
          y1 = _s.y;

      currentLength += linearLength(x1, y1, x2, y2);
    }

    return currentLength;
  }, 0);
};

var linearLength = function linearLength(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
};

exports.linearLength = linearLength;
exports.default = length;
},{"./decurve":7}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _helpers = require('./helpers');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var countLinePoints = function countLinePoints(lines) {
  return lines.reduce(function (count, points) {
    return count + countPoints(points);
  }, 0);
};

var countPoints = function countPoints(points) {
  return points.length - (isJoined(points) ? 1 : 0);
};

var isJoined = function isJoined(points) {
  var firstPoint = points[0];
  var lastPoint = points[points.length - 1];
  return firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y;
};

var joinLines = function joinLines(lines) {
  return lines.reduce(function (shape, line) {
    return [].concat(_toConsumableArray(shape), _toConsumableArray(line));
  }, []);
};

var moveIndex = function moveIndex(s, offset) {
  return (0, _helpers.applyFuncToShapes)(movePointsIndex, s, offset);
};

var movePointsIndex = function movePointsIndex(shape, offset) {
  var lines = splitLines(shape);
  var count = countLinePoints(lines);
  var normalisedOffset = (offset % count + count) % count;

  if (!normalisedOffset) {
    return shape;
  }

  var _nextIndex = nextIndex(lines, normalisedOffset),
      lineIndex = _nextIndex.lineIndex,
      pointIndex = _nextIndex.pointIndex;

  var reorderedLines = reorderLines(lines, lineIndex);
  var firstLine = reorderPoints(reorderedLines[0], pointIndex);
  var restOfLines = [].concat(_toConsumableArray(reorderedLines)).splice(1);

  return joinLines([firstLine].concat(_toConsumableArray(restOfLines)));
};

var nextIndex = function nextIndex(lines, offset) {
  for (var i = 0, l = lines.length; i < l; i++) {
    var count = countPoints(lines[i]);

    if (offset <= count - 1) {
      return {
        lineIndex: i,
        pointIndex: offset
      };
    }

    offset -= count;
  }
};

var reorderLines = function reorderLines(lines, offset) {
  return [].concat(_toConsumableArray(lines)).splice(offset).concat([].concat(_toConsumableArray(lines)).splice(0, offset));
};

var reorderPoints = function reorderPoints(points, offset) {
  if (!offset) {
    return points;
  }

  var nextPoints = [{ x: points[offset].x, y: points[offset].y, moveTo: true }].concat(_toConsumableArray([].concat(_toConsumableArray(points)).splice(offset + 1)));

  if (isJoined(points)) {
    return [].concat(_toConsumableArray(nextPoints), _toConsumableArray([].concat(_toConsumableArray(points)).splice(1, offset)));
  }

  return [].concat(_toConsumableArray(nextPoints), _toConsumableArray([].concat(_toConsumableArray(points)).splice(0, offset + 1)));
};

var splitLines = function splitLines(shape) {
  return shape.reduce(function (lines, point) {
    if (point.moveTo) {
      lines.push([]);
    }

    lines[lines.length - 1].push(point);

    return lines;
  }, []);
};

exports.default = moveIndex;
},{"./helpers":8}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _helpers = require('./helpers');

var offsetPoints = function offsetPoints(shape, x, y) {
  return shape.map(function (point) {
    var p = _extends({}, point);

    p.x += x;
    p.y += y;

    if (p.curve) {
      p.curve = _extends({}, p.curve);

      if (p.curve.type === 'quadratic' || p.curve.type === 'cubic') {
        p.curve.x1 += x;
        p.curve.y1 += y;
      }

      if (p.curve.type === 'cubic') {
        p.curve.x2 += x;
        p.curve.y2 += y;
      }
    }

    return p;
  });
};

var offset = function offset(s) {
  var x = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var y = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  return (0, _helpers.applyFuncToShapes)(offsetPoints, s, x, y);
};

exports.default = offset;
},{"./helpers":8}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _decurve = require('./decurve');

var _decurve2 = _interopRequireDefault(_decurve);

var _length = require('./length');

var _length2 = _interopRequireDefault(_length);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var angle = function angle(x1, y1, x2, y2, a) {
  if (x1 === x2) {
    return y1 >= y2 ? 0 : 180;
  }

  var b = 100;
  var c = (0, _length.linearLength)(x2, y2, x1, y1 - b);
  var ang = (0, _helpers.angleFromSides)(a, b, c);

  return x1 < x2 ? ang : 360 - ang;
};

var over = function over(shape, length, totalLength, desiredLength) {
  var _shape = shape[length - 2],
      x1 = _shape.x,
      y1 = _shape.y;
  var _shape2 = shape[length - 1],
      x2 = _shape2.x,
      y2 = _shape2.y;

  var segmentLength = (0, _length.linearLength)(x1, y1, x2, y2);
  var segmentInterval = (desiredLength - totalLength) / segmentLength + 1;
  return { x1: x1, y1: y1, x2: x2, y2: y2, segmentInterval: segmentInterval, segmentLength: segmentLength };
};

var position = function position(shape, interval, accuracy) {
  var s = (0, _decurve2.default)(shape, accuracy);
  var l = s.length;
  var t = (0, _length2.default)(s);
  var d = t * interval;

  var _ref = interval > 1 ? over(s, l, t, d) : interval < 0 ? under(s, d) : within(s, l, d),
      x1 = _ref.x1,
      y1 = _ref.y1,
      x2 = _ref.x2,
      y2 = _ref.y2,
      segmentInterval = _ref.segmentInterval,
      segmentLength = _ref.segmentLength;

  return {
    angle: angle(x1, y1, x2, y2, segmentLength),
    x: (0, _helpers.numberAtInterval)(x1, x2, segmentInterval),
    y: (0, _helpers.numberAtInterval)(y1, y2, segmentInterval)
  };
};

var under = function under(shape, desiredLength) {
  var _shape$ = shape[0],
      x1 = _shape$.x,
      y1 = _shape$.y;
  var _shape$2 = shape[1],
      x2 = _shape$2.x,
      y2 = _shape$2.y;

  var segmentLength = (0, _length.linearLength)(x1, y1, x2, y2);
  var segmentInterval = desiredLength / segmentLength;
  return { x1: x1, y1: y1, x2: x2, y2: y2, segmentInterval: segmentInterval, segmentLength: segmentLength };
};

var within = function within(shape, length, desiredLength) {
  var currentLength = 0;

  for (var i = 0; i < length; i++) {
    var moveTo = shape[i].moveTo;


    if (!moveTo) {
      var _shape3 = shape[i - 1],
          x1 = _shape3.x,
          y1 = _shape3.y;
      var _shape$i = shape[i],
          x2 = _shape$i.x,
          y2 = _shape$i.y;


      var segmentLength = (0, _length.linearLength)(x1, y1, x2, y2);

      if (currentLength + segmentLength >= desiredLength) {
        var segmentInterval = (desiredLength - currentLength) / segmentLength;
        return { x1: x1, y1: y1, x2: x2, y2: y2, segmentInterval: segmentInterval, segmentLength: segmentLength };
      }

      currentLength += segmentLength;
    }
  }
};

exports.default = position;
},{"./decurve":7,"./helpers":8,"./length":10}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _helpers = require('./helpers');

var isBetween = function isBetween(a, b, c) {
  if (b.curve || c.curve) {
    return false;
  }

  var crossProduct = (c.y - a.y) * (b.x - a.x) - (c.x - a.x) * (b.y - a.y);

  if (Math.abs(crossProduct) > Number.EPSILON) {
    return false;
  }

  var dotProduct = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y);

  if (dotProduct < 0) {
    return false;
  }

  var squaredLengthBA = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);

  if (dotProduct > squaredLengthBA) {
    return false;
  }

  return true;
};

var removePoints = function removePoints(shape) {
  var s = [];

  for (var i = 0, l = shape.length; i < l; i++) {
    var a = s[s.length - 1];
    var b = shape[i + 1];
    var c = shape[i];

    if (!(a && b && c) || !isBetween(a, b, c)) {
      s.push(c);
    }
  }

  return s;
};

var remove = function remove(s) {
  return (0, _helpers.applyFuncToShapes)(removePoints, s);
};

exports.default = remove;
},{"./helpers":8}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _cubify = require('./cubify');

var _cubify2 = _interopRequireDefault(_cubify);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var reversePoints = function reversePoints(shape) {
  var m = void 0;
  var c = void 0;

  return shape.reverse().map(function (_ref, i) {
    var x = _ref.x,
        y = _ref.y,
        moveTo = _ref.moveTo,
        curve = _ref.curve;

    var point = { x: x, y: y };

    if (c) {
      var _c = c,
          x2 = _c.x1,
          y2 = _c.y1,
          x1 = _c.x2,
          y1 = _c.y2;

      point.curve = { type: 'cubic', x1: x1, y1: y1, x2: x2, y2: y2 };
    }

    if (i === 0 || m) {
      point.moveTo = true;
    }

    m = moveTo;
    c = curve || null;

    return point;
  });
};

var reverse = function reverse(s) {
  return (0, _helpers.applyFuncToShapes)(reversePoints, (0, _cubify2.default)(s));
};

exports.default = reverse;
},{"./cubify":6,"./helpers":8}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _helpers = require('./helpers');

var _boundingBox2 = require('./boundingBox');

var _boundingBox3 = _interopRequireDefault(_boundingBox2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rotatePoint = function rotatePoint(x, y, c, s, about) {
  var offsetX = about.x,
      offsetY = about.y;

  var relativeX = x - offsetX;
  var relativeY = y - offsetY;

  return [relativeX * c - relativeY * s + offsetX, relativeX * s + relativeY * c + offsetY];
};

var rotatePoints = function rotatePoints(shape, angle, about) {
  return shape.map(function (point) {
    var r = angle * Math.PI / 180;
    var c = Math.cos(r);
    var s = Math.sin(r);

    var _rotatePoint = rotatePoint(point.x, point.y, c, s, about),
        _rotatePoint2 = _slicedToArray(_rotatePoint, 2),
        x = _rotatePoint2[0],
        y = _rotatePoint2[1];

    var p = _extends({}, point, { x: x, y: y });

    if (p.curve) {
      if (p.curve.type === 'quadratic' || p.curve.type === 'cubic') {
        var _rotatePoint3 = rotatePoint(p.curve.x1, p.curve.y1, c, s, about),
            _rotatePoint4 = _slicedToArray(_rotatePoint3, 2),
            x1 = _rotatePoint4[0],
            y1 = _rotatePoint4[1];

        p.curve = _extends({}, p.curve, { x1: x1, y1: y1 });
      }

      if (p.curve.type === 'cubic') {
        var _rotatePoint5 = rotatePoint(p.curve.x2, p.curve.y2, c, s, about),
            _rotatePoint6 = _slicedToArray(_rotatePoint5, 2),
            x2 = _rotatePoint6[0],
            y2 = _rotatePoint6[1];

        p.curve = _extends({}, p.curve, { x2: x2, y2: y2 });
      }
    }

    return p;
  });
};

var rotate = function rotate(s, angle) {
  var _boundingBox = (0, _boundingBox3.default)(s),
      about = _boundingBox.center;

  return (0, _helpers.applyFuncToShapes)(rotatePoints, s, angle, about);
};

exports.default = rotate;
},{"./boundingBox":5,"./helpers":8}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _boundingBox2 = require('./boundingBox');

var _boundingBox3 = _interopRequireDefault(_boundingBox2);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var scalePoint = function scalePoint(point, scaleFactor, anchorX, anchorY) {
  var p = _extends({}, point);

  p.x = anchorX - (anchorX - p.x) * scaleFactor;
  p.y = anchorY - (anchorY - p.y) * scaleFactor;

  if (point.curve) {
    p.curve = _extends({}, p.curve);

    if (p.curve.type === 'arc') {
      if (p.curve.rx) {
        p.curve.rx = p.curve.rx * scaleFactor;
      }

      if (p.curve.ry) {
        p.curve.ry = p.curve.ry * scaleFactor;
      }
    } else {
      p.curve.x1 = anchorX - (anchorX - p.curve.x1) * scaleFactor;
      p.curve.y1 = anchorY - (anchorY - p.curve.y1) * scaleFactor;

      if (p.curve.type === 'cubic') {
        p.curve.x2 = anchorX - (anchorX - p.curve.x2) * scaleFactor;
        p.curve.y2 = anchorY - (anchorY - p.curve.y2) * scaleFactor;
      }
    }
  }

  return p;
};

var scale = function scale(s, scaleFactor) {
  var anchor = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'center';

  var _boundingBox = (0, _boundingBox3.default)(s),
      bottom = _boundingBox.bottom,
      center = _boundingBox.center,
      left = _boundingBox.left,
      right = _boundingBox.right,
      top = _boundingBox.top;

  var anchorX = center.x;
  var anchorY = center.y;

  switch (anchor) {
    case 'topLeft':
      anchorX = left;
      anchorY = top;
      break;
    case 'topRight':
      anchorX = right;
      anchorY = top;
      break;
    case 'bottomRight':
      anchorX = right;
      anchorY = bottom;
      break;
    case 'bottomLeft':
      anchorX = left;
      anchorY = bottom;
      break;
  }

  return (0, _helpers.applyFuncToShapes)(function (shape) {
    return shape.map(function (point) {
      return scalePoint(point, scaleFactor, anchorX, anchorY);
    });
  }, s);
};

exports.default = scale;
},{"./boundingBox":5,"./helpers":8}],18:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.valid = exports.toPoints = exports.toPath = undefined;

var _toPath = require('./toPath');

var _toPath2 = _interopRequireDefault(_toPath);

var _toPoints = require('./toPoints');

var _toPoints2 = _interopRequireDefault(_toPoints);

var _valid = require('./valid');

var _valid2 = _interopRequireDefault(_valid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.toPath = _toPath2.default;
exports.toPoints = _toPoints2.default;
exports.valid = _valid2.default;
},{"./toPath":20,"./toPoints":21,"./valid":22}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toPoints = require('./toPoints');

var _toPoints2 = _interopRequireDefault(_toPoints);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pointsToD = function pointsToD(p) {
  var d = '';
  var i = 0;
  var firstPoint = void 0;

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = p[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var point = _step.value;
      var _point$curve = point.curve,
          curve = _point$curve === undefined ? false : _point$curve,
          moveTo = point.moveTo,
          x = point.x,
          y = point.y;

      var isFirstPoint = i === 0 || moveTo;
      var isLastPoint = i === p.length - 1 || p[i + 1].moveTo;
      var prevPoint = i === 0 ? null : p[i - 1];

      if (isFirstPoint) {
        firstPoint = point;

        if (!isLastPoint) {
          d += 'M' + x + ',' + y;
        }
      } else if (curve) {
        switch (curve.type) {
          case 'arc':
            var _point$curve2 = point.curve,
                _point$curve2$largeAr = _point$curve2.largeArcFlag,
                largeArcFlag = _point$curve2$largeAr === undefined ? 0 : _point$curve2$largeAr,
                rx = _point$curve2.rx,
                ry = _point$curve2.ry,
                _point$curve2$sweepFl = _point$curve2.sweepFlag,
                sweepFlag = _point$curve2$sweepFl === undefined ? 0 : _point$curve2$sweepFl,
                _point$curve2$xAxisRo = _point$curve2.xAxisRotation,
                xAxisRotation = _point$curve2$xAxisRo === undefined ? 0 : _point$curve2$xAxisRo;

            d += 'A' + rx + ',' + ry + ',' + xAxisRotation + ',' + largeArcFlag + ',' + sweepFlag + ',' + x + ',' + y;
            break;
          case 'cubic':
            var _point$curve3 = point.curve,
                cx1 = _point$curve3.x1,
                cy1 = _point$curve3.y1,
                cx2 = _point$curve3.x2,
                cy2 = _point$curve3.y2;

            d += 'C' + cx1 + ',' + cy1 + ',' + cx2 + ',' + cy2 + ',' + x + ',' + y;
            break;
          case 'quadratic':
            var _point$curve4 = point.curve,
                qx1 = _point$curve4.x1,
                qy1 = _point$curve4.y1;

            d += 'Q' + qx1 + ',' + qy1 + ',' + x + ',' + y;
            break;
        }

        if (isLastPoint && x === firstPoint.x && y === firstPoint.y) {
          d += 'Z';
        }
      } else if (isLastPoint && x === firstPoint.x && y === firstPoint.y) {
        d += 'Z';
      } else if (x !== prevPoint.x && y !== prevPoint.y) {
        d += 'L' + x + ',' + y;
      } else if (x !== prevPoint.x) {
        d += 'H' + x;
      } else if (y !== prevPoint.y) {
        d += 'V' + y;
      }

      i++;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return d;
};

var toPath = function toPath(s) {
  var isPoints = Array.isArray(s);
  var isGroup = isPoints ? Array.isArray(s[0]) : s.type === 'g';
  var points = isPoints ? s : isGroup ? s.shapes.map(function (shp) {
    return (0, _toPoints2.default)(shp);
  }) : (0, _toPoints2.default)(s);

  if (isGroup) {
    return points.map(function (p) {
      return pointsToD(p);
    });
  }

  return pointsToD(points);
};

exports.default = toPath;
},{"./toPoints":21}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var toPoints = function toPoints(_ref) {
  var type = _ref.type,
      props = _objectWithoutProperties(_ref, ['type']);

  switch (type) {
    case 'circle':
      return getPointsFromCircle(props);
    case 'ellipse':
      return getPointsFromEllipse(props);
    case 'line':
      return getPointsFromLine(props);
    case 'path':
      return getPointsFromPath(props);
    case 'polygon':
      return getPointsFromPolygon(props);
    case 'polyline':
      return getPointsFromPolyline(props);
    case 'rect':
      return getPointsFromRect(props);
    case 'g':
      return getPointsFromG(props);
    default:
      throw new Error('Not a valid shape type');
  }
};

var getPointsFromCircle = function getPointsFromCircle(_ref2) {
  var cx = _ref2.cx,
      cy = _ref2.cy,
      r = _ref2.r;

  return [{ x: cx, y: cy - r, moveTo: true }, { x: cx, y: cy + r, curve: { type: 'arc', rx: r, ry: r, sweepFlag: 1 } }, { x: cx, y: cy - r, curve: { type: 'arc', rx: r, ry: r, sweepFlag: 1 } }];
};

var getPointsFromEllipse = function getPointsFromEllipse(_ref3) {
  var cx = _ref3.cx,
      cy = _ref3.cy,
      rx = _ref3.rx,
      ry = _ref3.ry;

  return [{ x: cx, y: cy - ry, moveTo: true }, { x: cx, y: cy + ry, curve: { type: 'arc', rx: rx, ry: ry, sweepFlag: 1 } }, { x: cx, y: cy - ry, curve: { type: 'arc', rx: rx, ry: ry, sweepFlag: 1 } }];
};

var getPointsFromLine = function getPointsFromLine(_ref4) {
  var x1 = _ref4.x1,
      x2 = _ref4.x2,
      y1 = _ref4.y1,
      y2 = _ref4.y2;

  return [{ x: x1, y: y1, moveTo: true }, { x: x2, y: y2 }];
};

var validCommands = /[MmLlHhVvCcSsQqTtAaZz]/g;

var commandLengths = {
  A: 7,
  C: 6,
  H: 1,
  L: 2,
  M: 2,
  Q: 4,
  S: 4,
  T: 2,
  V: 1,
  Z: 0
};

var relativeCommands = ['a', 'c', 'h', 'l', 'm', 'q', 's', 't', 'v'];

var isRelative = function isRelative(command) {
  return relativeCommands.indexOf(command) !== -1;
};

var optionalArcKeys = ['xAxisRotation', 'largeArcFlag', 'sweepFlag'];

var getCommands = function getCommands(d) {
  return d.match(validCommands);
};

var getParams = function getParams(d) {
  return d.split(validCommands).map(function (v) {
    return v.replace(/[0-9]+-/g, function (m) {
      return m.slice(0, -1) + ' -';
    });
  }).map(function (v) {
    return v.replace(/\.[0-9]+/g, function (m) {
      return m + ' ';
    });
  }).map(function (v) {
    return v.trim();
  }).filter(function (v) {
    return v.length > 0;
  }).map(function (v) {
    return v.split(/[ ,]+/).map(parseFloat).filter(function (n) {
      return !isNaN(n);
    });
  });
};

var getPointsFromPath = function getPointsFromPath(_ref5) {
  var d = _ref5.d;

  var commands = getCommands(d);
  var params = getParams(d);

  var points = [];

  var moveTo = void 0;

  for (var i = 0, l = commands.length; i < l; i++) {
    var command = commands[i];
    var upperCaseCommand = command.toUpperCase();
    var commandLength = commandLengths[upperCaseCommand];
    var relative = isRelative(command);

    if (commandLength > 0) {
      var commandParams = params.shift();
      var iterations = commandParams.length / commandLength;

      for (var j = 0; j < iterations; j++) {
        var prevPoint = points[points.length - 1] || { x: 0, y: 0 };

        switch (upperCaseCommand) {
          case 'M':
            var x = (relative ? prevPoint.x : 0) + commandParams.shift();
            var y = (relative ? prevPoint.y : 0) + commandParams.shift();

            if (j === 0) {
              moveTo = { x: x, y: y };
              points.push({ x: x, y: y, moveTo: true });
            } else {
              points.push({ x: x, y: y });
            }

            break;

          case 'L':
            points.push({
              x: (relative ? prevPoint.x : 0) + commandParams.shift(),
              y: (relative ? prevPoint.y : 0) + commandParams.shift()
            });

            break;

          case 'H':
            points.push({
              x: (relative ? prevPoint.x : 0) + commandParams.shift(),
              y: prevPoint.y
            });

            break;

          case 'V':
            points.push({
              x: prevPoint.x,
              y: (relative ? prevPoint.y : 0) + commandParams.shift()
            });

            break;

          case 'A':
            points.push({
              curve: {
                type: 'arc',
                rx: commandParams.shift(),
                ry: commandParams.shift(),
                xAxisRotation: commandParams.shift(),
                largeArcFlag: commandParams.shift(),
                sweepFlag: commandParams.shift()
              },
              x: (relative ? prevPoint.x : 0) + commandParams.shift(),
              y: (relative ? prevPoint.y : 0) + commandParams.shift()
            });

            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = optionalArcKeys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var k = _step.value;

                if (points[points.length - 1]['curve'][k] === 0) {
                  delete points[points.length - 1]['curve'][k];
                }
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }

            break;

          case 'C':
            points.push({
              curve: {
                type: 'cubic',
                x1: (relative ? prevPoint.x : 0) + commandParams.shift(),
                y1: (relative ? prevPoint.y : 0) + commandParams.shift(),
                x2: (relative ? prevPoint.x : 0) + commandParams.shift(),
                y2: (relative ? prevPoint.y : 0) + commandParams.shift()
              },
              x: (relative ? prevPoint.x : 0) + commandParams.shift(),
              y: (relative ? prevPoint.y : 0) + commandParams.shift()
            });

            break;

          case 'S':
            var sx2 = (relative ? prevPoint.x : 0) + commandParams.shift();
            var sy2 = (relative ? prevPoint.y : 0) + commandParams.shift();
            var sx = (relative ? prevPoint.x : 0) + commandParams.shift();
            var sy = (relative ? prevPoint.y : 0) + commandParams.shift();

            var diff = {};

            var sx1 = void 0;
            var sy1 = void 0;

            if (prevPoint.curve && prevPoint.curve.type === 'cubic') {
              diff.x = Math.abs(prevPoint.x - prevPoint.curve.x2);
              diff.y = Math.abs(prevPoint.y - prevPoint.curve.y2);
              sx1 = prevPoint.x < prevPoint.curve.x2 ? prevPoint.x - diff.x : prevPoint.x + diff.x;
              sy1 = prevPoint.y < prevPoint.curve.y2 ? prevPoint.y - diff.y : prevPoint.y + diff.y;
            } else {
              diff.x = Math.abs(sx - sx2);
              diff.y = Math.abs(sy - sy2);
              sx1 = prevPoint.x;
              sy1 = prevPoint.y;
            }

            points.push({ curve: { type: 'cubic', x1: sx1, y1: sy1, x2: sx2, y2: sy2 }, x: sx, y: sy });

            break;

          case 'Q':
            points.push({
              curve: {
                type: 'quadratic',
                x1: (relative ? prevPoint.x : 0) + commandParams.shift(),
                y1: (relative ? prevPoint.y : 0) + commandParams.shift()
              },
              x: (relative ? prevPoint.x : 0) + commandParams.shift(),
              y: (relative ? prevPoint.y : 0) + commandParams.shift()
            });

            break;

          case 'T':
            var tx = (relative ? prevPoint.x : 0) + commandParams.shift();
            var ty = (relative ? prevPoint.y : 0) + commandParams.shift();

            var tx1 = void 0;
            var ty1 = void 0;

            if (prevPoint.curve && prevPoint.curve.type === 'quadratic') {
              var _diff = {
                x: Math.abs(prevPoint.x - prevPoint.curve.x1),
                y: Math.abs(prevPoint.y - prevPoint.curve.y1)
              };

              tx1 = prevPoint.x < prevPoint.curve.x1 ? prevPoint.x - _diff.x : prevPoint.x + _diff.x;
              ty1 = prevPoint.y < prevPoint.curve.y1 ? prevPoint.y - _diff.y : prevPoint.y + _diff.y;
            } else {
              tx1 = prevPoint.x;
              ty1 = prevPoint.y;
            }

            points.push({ curve: { type: 'quadratic', x1: tx1, y1: ty1 }, x: tx, y: ty });

            break;
        }
      }
    } else {
      var _prevPoint = points[points.length - 1] || { x: 0, y: 0 };

      if (_prevPoint.x !== moveTo.x || _prevPoint.y !== moveTo.y) {
        points.push({ x: moveTo.x, y: moveTo.y });
      }
    }
  }

  return points;
};

var getPointsFromPolygon = function getPointsFromPolygon(_ref6) {
  var points = _ref6.points;

  return getPointsFromPoints({ closed: true, points: points });
};

var getPointsFromPolyline = function getPointsFromPolyline(_ref7) {
  var points = _ref7.points;

  return getPointsFromPoints({ closed: false, points: points });
};

var getPointsFromPoints = function getPointsFromPoints(_ref8) {
  var closed = _ref8.closed,
      points = _ref8.points;

  var numbers = points.split(/[\s,]+/).map(function (n) {
    return parseFloat(n);
  });

  var p = numbers.reduce(function (arr, point, i) {
    if (i % 2 === 0) {
      arr.push({ x: point });
    } else {
      arr[(i - 1) / 2].y = point;
    }

    return arr;
  }, []);

  if (closed) {
    p.push(_extends({}, p[0]));
  }

  p[0].moveTo = true;

  return p;
};

var getPointsFromRect = function getPointsFromRect(_ref9) {
  var height = _ref9.height,
      rx = _ref9.rx,
      ry = _ref9.ry,
      width = _ref9.width,
      x = _ref9.x,
      y = _ref9.y;

  if (rx || ry) {
    return getPointsFromRectWithCornerRadius({
      height: height,
      rx: rx || ry,
      ry: ry || rx,
      width: width,
      x: x,
      y: y
    });
  }

  return getPointsFromBasicRect({ height: height, width: width, x: x, y: y });
};

var getPointsFromBasicRect = function getPointsFromBasicRect(_ref10) {
  var height = _ref10.height,
      width = _ref10.width,
      x = _ref10.x,
      y = _ref10.y;

  return [{ x: x, y: y, moveTo: true }, { x: x + width, y: y }, { x: x + width, y: y + height }, { x: x, y: y + height }, { x: x, y: y }];
};

var getPointsFromRectWithCornerRadius = function getPointsFromRectWithCornerRadius(_ref11) {
  var height = _ref11.height,
      rx = _ref11.rx,
      ry = _ref11.ry,
      width = _ref11.width,
      x = _ref11.x,
      y = _ref11.y;

  var curve = { type: 'arc', rx: rx, ry: ry, sweepFlag: 1 };

  return [{ x: x + rx, y: y, moveTo: true }, { x: x + width - rx, y: y }, { x: x + width, y: y + ry, curve: curve }, { x: x + width, y: y + height - ry }, { x: x + width - rx, y: y + height, curve: curve }, { x: x + rx, y: y + height }, { x: x, y: y + height - ry, curve: curve }, { x: x, y: y + ry }, { x: x + rx, y: y, curve: curve }];
};

var getPointsFromG = function getPointsFromG(_ref12) {
  var shapes = _ref12.shapes;
  return shapes.map(function (s) {
    return toPoints(s);
  });
};

exports.default = toPoints;
},{}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var getErrors = function getErrors(shape) {
  var rules = getRules(shape);
  var errors = [];

  rules.map(function (_ref) {
    var match = _ref.match,
        prop = _ref.prop,
        required = _ref.required,
        type = _ref.type;

    if (typeof shape[prop] === 'undefined') {
      if (required) {
        errors.push(prop + ' prop is required' + (prop === 'type' ? '' : ' on a ' + shape.type));
      }
    } else {
      if (typeof type !== 'undefined') {
        if (type === 'array') {
          if (!Array.isArray(shape[prop])) {
            errors.push(prop + ' prop must be of type array');
          }
        } else if (_typeof(shape[prop]) !== type) {
          // eslint-disable-line valid-typeof
          errors.push(prop + ' prop must be of type ' + type);
        }
      }

      if (Array.isArray(match)) {
        if (match.indexOf(shape[prop]) === -1) {
          errors.push(prop + ' prop must be one of ' + match.join(', '));
        }
      }
    }
  });

  if (shape.type === 'g' && Array.isArray(shape.shapes)) {
    var childErrors = shape.shapes.map(function (s) {
      return getErrors(s);
    });
    return [].concat.apply(errors, childErrors);
  }

  return errors;
};

var getRules = function getRules(shape) {
  var rules = [{
    match: ['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect', 'g'],
    prop: 'type',
    required: true,
    type: 'string'
  }];

  switch (shape.type) {
    case 'circle':
      rules.push({ prop: 'cx', required: true, type: 'number' });
      rules.push({ prop: 'cy', required: true, type: 'number' });
      rules.push({ prop: 'r', required: true, type: 'number' });
      break;

    case 'ellipse':
      rules.push({ prop: 'cx', required: true, type: 'number' });
      rules.push({ prop: 'cy', required: true, type: 'number' });
      rules.push({ prop: 'rx', required: true, type: 'number' });
      rules.push({ prop: 'ry', required: true, type: 'number' });
      break;

    case 'line':
      rules.push({ prop: 'x1', required: true, type: 'number' });
      rules.push({ prop: 'x2', required: true, type: 'number' });
      rules.push({ prop: 'y1', required: true, type: 'number' });
      rules.push({ prop: 'y2', required: true, type: 'number' });
      break;

    case 'path':
      rules.push({ prop: 'd', required: true, type: 'string' });
      break;

    case 'polygon':
    case 'polyline':
      rules.push({ prop: 'points', required: true, type: 'string' });
      break;

    case 'rect':
      rules.push({ prop: 'height', required: true, type: 'number' });
      rules.push({ prop: 'rx', type: 'number' });
      rules.push({ prop: 'ry', type: 'number' });
      rules.push({ prop: 'width', required: true, type: 'number' });
      rules.push({ prop: 'x', required: true, type: 'number' });
      rules.push({ prop: 'y', required: true, type: 'number' });
      break;

    case 'g':
      rules.push({ prop: 'shapes', required: true, type: 'array' });
      break;
  }

  return rules;
};

var valid = function valid(shape) {
  var errors = getErrors(shape);

  return {
    errors: errors,
    valid: errors.length === 0
  };
};

exports.default = valid;
},{}],23:[function(require,module,exports){
'use strict';

module.exports = require('./lib/svgpath');

},{"./lib/svgpath":28}],24:[function(require,module,exports){
// Convert an arc to a sequence of cubic bézier curves
//
'use strict';


var TAU = Math.PI * 2;


/* eslint-disable space-infix-ops */

// Calculate an angle between two unit vectors
//
// Since we measure angle between radii of circular arcs,
// we can use simplified math (without length normalization)
//
function unit_vector_angle(ux, uy, vx, vy) {
  var sign = (ux * vy - uy * vx < 0) ? -1 : 1;
  var dot  = ux * vx + uy * vy;

  // Add this to work with arbitrary vectors:
  // dot /= Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);

  // rounding errors, e.g. -1.0000000000000002 can screw up this
  if (dot >  1.0) { dot =  1.0; }
  if (dot < -1.0) { dot = -1.0; }

  return sign * Math.acos(dot);
}


// Convert from endpoint to center parameterization,
// see http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
//
// Return [cx, cy, theta1, delta_theta]
//
function get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi) {
  // Step 1.
  //
  // Moving an ellipse so origin will be the middlepoint between our two
  // points. After that, rotate it to line up ellipse axes with coordinate
  // axes.
  //
  var x1p =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
  var y1p = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;

  var rx_sq  =  rx * rx;
  var ry_sq  =  ry * ry;
  var x1p_sq = x1p * x1p;
  var y1p_sq = y1p * y1p;

  // Step 2.
  //
  // Compute coordinates of the centre of this ellipse (cx', cy')
  // in the new coordinate system.
  //
  var radicant = (rx_sq * ry_sq) - (rx_sq * y1p_sq) - (ry_sq * x1p_sq);

  if (radicant < 0) {
    // due to rounding errors it might be e.g. -1.3877787807814457e-17
    radicant = 0;
  }

  radicant /=   (rx_sq * y1p_sq) + (ry_sq * x1p_sq);
  radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);

  var cxp = radicant *  rx/ry * y1p;
  var cyp = radicant * -ry/rx * x1p;

  // Step 3.
  //
  // Transform back to get centre coordinates (cx, cy) in the original
  // coordinate system.
  //
  var cx = cos_phi*cxp - sin_phi*cyp + (x1+x2)/2;
  var cy = sin_phi*cxp + cos_phi*cyp + (y1+y2)/2;

  // Step 4.
  //
  // Compute angles (theta1, delta_theta).
  //
  var v1x =  (x1p - cxp) / rx;
  var v1y =  (y1p - cyp) / ry;
  var v2x = (-x1p - cxp) / rx;
  var v2y = (-y1p - cyp) / ry;

  var theta1 = unit_vector_angle(1, 0, v1x, v1y);
  var delta_theta = unit_vector_angle(v1x, v1y, v2x, v2y);

  if (fs === 0 && delta_theta > 0) {
    delta_theta -= TAU;
  }
  if (fs === 1 && delta_theta < 0) {
    delta_theta += TAU;
  }

  return [ cx, cy, theta1, delta_theta ];
}

//
// Approximate one unit arc segment with bézier curves,
// see http://math.stackexchange.com/questions/873224
//
function approximate_unit_arc(theta1, delta_theta) {
  var alpha = 4/3 * Math.tan(delta_theta/4);

  var x1 = Math.cos(theta1);
  var y1 = Math.sin(theta1);
  var x2 = Math.cos(theta1 + delta_theta);
  var y2 = Math.sin(theta1 + delta_theta);

  return [ x1, y1, x1 - y1*alpha, y1 + x1*alpha, x2 + y2*alpha, y2 - x2*alpha, x2, y2 ];
}

module.exports = function a2c(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
  var sin_phi = Math.sin(phi * TAU / 360);
  var cos_phi = Math.cos(phi * TAU / 360);

  // Make sure radii are valid
  //
  var x1p =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
  var y1p = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;

  if (x1p === 0 && y1p === 0) {
    // we're asked to draw line to itself
    return [];
  }

  if (rx === 0 || ry === 0) {
    // one of the radii is zero
    return [];
  }


  // Compensate out-of-range radii
  //
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  var lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }


  // Get center parameters (cx, cy, theta1, delta_theta)
  //
  var cc = get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi);

  var result = [];
  var theta1 = cc[2];
  var delta_theta = cc[3];

  // Split an arc to multiple segments, so each segment
  // will be less than τ/4 (= 90°)
  //
  var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);
  delta_theta /= segments;

  for (var i = 0; i < segments; i++) {
    result.push(approximate_unit_arc(theta1, delta_theta));
    theta1 += delta_theta;
  }

  // We have a bezier approximation of a unit circle,
  // now need to transform back to the original ellipse
  //
  return result.map(function (curve) {
    for (var i = 0; i < curve.length; i += 2) {
      var x = curve[i + 0];
      var y = curve[i + 1];

      // scale
      x *= rx;
      y *= ry;

      // rotate
      var xp = cos_phi*x - sin_phi*y;
      var yp = sin_phi*x + cos_phi*y;

      // translate
      curve[i + 0] = xp + cc[0];
      curve[i + 1] = yp + cc[1];
    }

    return curve;
  });
};

},{}],25:[function(require,module,exports){
'use strict';

/* eslint-disable space-infix-ops */

// The precision used to consider an ellipse as a circle
//
var epsilon = 0.0000000001;

// To convert degree in radians
//
var torad = Math.PI / 180;

// Class constructor :
//  an ellipse centred at 0 with radii rx,ry and x - axis - angle ax.
//
function Ellipse(rx, ry, ax) {
  if (!(this instanceof Ellipse)) { return new Ellipse(rx, ry, ax); }
  this.rx = rx;
  this.ry = ry;
  this.ax = ax;
}

// Apply a linear transform m to the ellipse
// m is an array representing a matrix :
//    -         -
//   | m[0] m[2] |
//   | m[1] m[3] |
//    -         -
//
Ellipse.prototype.transform = function (m) {
  // We consider the current ellipse as image of the unit circle
  // by first scale(rx,ry) and then rotate(ax) ...
  // So we apply ma =  m x rotate(ax) x scale(rx,ry) to the unit circle.
  var c = Math.cos(this.ax * torad), s = Math.sin(this.ax * torad);
  var ma = [
    this.rx * (m[0]*c + m[2]*s),
    this.rx * (m[1]*c + m[3]*s),
    this.ry * (-m[0]*s + m[2]*c),
    this.ry * (-m[1]*s + m[3]*c)
  ];

  // ma * transpose(ma) = [ J L ]
  //                      [ L K ]
  // L is calculated later (if the image is not a circle)
  var J = ma[0]*ma[0] + ma[2]*ma[2],
      K = ma[1]*ma[1] + ma[3]*ma[3];

  // the discriminant of the characteristic polynomial of ma * transpose(ma)
  var D = ((ma[0]-ma[3])*(ma[0]-ma[3]) + (ma[2]+ma[1])*(ma[2]+ma[1])) *
          ((ma[0]+ma[3])*(ma[0]+ma[3]) + (ma[2]-ma[1])*(ma[2]-ma[1]));

  // the "mean eigenvalue"
  var JK = (J + K) / 2;

  // check if the image is (almost) a circle
  if (D < epsilon * JK) {
    // if it is
    this.rx = this.ry = Math.sqrt(JK);
    this.ax = 0;
    return this;
  }

  // if it is not a circle
  var L = ma[0]*ma[1] + ma[2]*ma[3];

  D = Math.sqrt(D);

  // {l1,l2} = the two eigen values of ma * transpose(ma)
  var l1 = JK + D/2,
      l2 = JK - D/2;
  // the x - axis - rotation angle is the argument of the l1 - eigenvector
  /*eslint-disable indent*/
  this.ax = (Math.abs(L) < epsilon && Math.abs(l1 - K) < epsilon) ?
    90
  :
    Math.atan(Math.abs(L) > Math.abs(l1 - K) ?
      (l1 - J) / L
    :
      L / (l1 - K)
    ) * 180 / Math.PI;
  /*eslint-enable indent*/

  // if ax > 0 => rx = sqrt(l1), ry = sqrt(l2), else exchange axes and ax += 90
  if (this.ax >= 0) {
    // if ax in [0,90]
    this.rx = Math.sqrt(l1);
    this.ry = Math.sqrt(l2);
  } else {
    // if ax in ]-90,0[ => exchange axes
    this.ax += 90;
    this.rx = Math.sqrt(l2);
    this.ry = Math.sqrt(l1);
  }

  return this;
};

// Check if the ellipse is (almost) degenerate, i.e. rx = 0 or ry = 0
//
Ellipse.prototype.isDegenerate = function () {
  return (this.rx < epsilon * this.ry || this.ry < epsilon * this.rx);
};

module.exports = Ellipse;

},{}],26:[function(require,module,exports){
'use strict';

// combine 2 matrixes
// m1, m2 - [a, b, c, d, e, g]
//
function combine(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}


function Matrix() {
  if (!(this instanceof Matrix)) { return new Matrix(); }
  this.queue = [];   // list of matrixes to apply
  this.cache = null; // combined matrix cache
}


Matrix.prototype.matrix = function (m) {
  if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) {
    return this;
  }
  this.cache = null;
  this.queue.push(m);
  return this;
};


Matrix.prototype.translate = function (tx, ty) {
  if (tx !== 0 || ty !== 0) {
    this.cache = null;
    this.queue.push([ 1, 0, 0, 1, tx, ty ]);
  }
  return this;
};


Matrix.prototype.scale = function (sx, sy) {
  if (sx !== 1 || sy !== 1) {
    this.cache = null;
    this.queue.push([ sx, 0, 0, sy, 0, 0 ]);
  }
  return this;
};


Matrix.prototype.rotate = function (angle, rx, ry) {
  var rad, cos, sin;

  if (angle !== 0) {
    this.translate(rx, ry);

    rad = angle * Math.PI / 180;
    cos = Math.cos(rad);
    sin = Math.sin(rad);

    this.queue.push([ cos, sin, -sin, cos, 0, 0 ]);
    this.cache = null;

    this.translate(-rx, -ry);
  }
  return this;
};


Matrix.prototype.skewX = function (angle) {
  if (angle !== 0) {
    this.cache = null;
    this.queue.push([ 1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0 ]);
  }
  return this;
};


Matrix.prototype.skewY = function (angle) {
  if (angle !== 0) {
    this.cache = null;
    this.queue.push([ 1, Math.tan(angle * Math.PI / 180), 0, 1, 0, 0 ]);
  }
  return this;
};


// Flatten queue
//
Matrix.prototype.toArray = function () {
  if (this.cache) {
    return this.cache;
  }

  if (!this.queue.length) {
    this.cache = [ 1, 0, 0, 1, 0, 0 ];
    return this.cache;
  }

  this.cache = this.queue[0];

  if (this.queue.length === 1) {
    return this.cache;
  }

  for (var i = 1; i < this.queue.length; i++) {
    this.cache = combine(this.cache, this.queue[i]);
  }

  return this.cache;
};


// Apply list of matrixes to (x,y) point.
// If `isRelative` set, `translate` component of matrix will be skipped
//
Matrix.prototype.calc = function (x, y, isRelative) {
  var m;

  // Don't change point on empty transforms queue
  if (!this.queue.length) { return [ x, y ]; }

  // Calculate final matrix, if not exists
  //
  // NB. if you deside to apply transforms to point one-by-one,
  // they should be taken in reverse order

  if (!this.cache) {
    this.cache = this.toArray();
  }

  m = this.cache;

  // Apply matrix to point
  return [
    x * m[0] + y * m[2] + (isRelative ? 0 : m[4]),
    x * m[1] + y * m[3] + (isRelative ? 0 : m[5])
  ];
};


module.exports = Matrix;

},{}],27:[function(require,module,exports){
'use strict';


var paramCounts = { a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0 };

var SPECIAL_SPACES = [
  0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
  0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF
];

function isSpace(ch) {
  return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029) || // Line terminators
    // White spaces
    (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
    (ch >= 0x1680 && SPECIAL_SPACES.indexOf(ch) >= 0);
}

function isCommand(code) {
  /*eslint-disable no-bitwise*/
  switch (code | 0x20) {
    case 0x6D/* m */:
    case 0x7A/* z */:
    case 0x6C/* l */:
    case 0x68/* h */:
    case 0x76/* v */:
    case 0x63/* c */:
    case 0x73/* s */:
    case 0x71/* q */:
    case 0x74/* t */:
    case 0x61/* a */:
    case 0x72/* r */:
      return true;
  }
  return false;
}

function isDigit(code) {
  return (code >= 48 && code <= 57);   // 0..9
}

function isDigitStart(code) {
  return (code >= 48 && code <= 57) || /* 0..9 */
          code === 0x2B || /* + */
          code === 0x2D || /* - */
          code === 0x2E;   /* . */
}


function State(path) {
  this.index  = 0;
  this.path   = path;
  this.max    = path.length;
  this.result = [];
  this.param  = 0.0;
  this.err    = '';
  this.segmentStart = 0;
  this.data   = [];
}

function skipSpaces(state) {
  while (state.index < state.max && isSpace(state.path.charCodeAt(state.index))) {
    state.index++;
  }
}


function scanParam(state) {
  var start = state.index,
      index = start,
      max = state.max,
      zeroFirst = false,
      hasCeiling = false,
      hasDecimal = false,
      hasDot = false,
      ch;

  if (index >= max) {
    state.err = 'SvgPath: missed param (at pos ' + index + ')';
    return;
  }
  ch = state.path.charCodeAt(index);

  if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
    index++;
    ch = (index < max) ? state.path.charCodeAt(index) : 0;
  }

  // This logic is shamelessly borrowed from Esprima
  // https://github.com/ariya/esprimas
  //
  if (!isDigit(ch) && ch !== 0x2E/* . */) {
    state.err = 'SvgPath: param should start with 0..9 or `.` (at pos ' + index + ')';
    return;
  }

  if (ch !== 0x2E/* . */) {
    zeroFirst = (ch === 0x30/* 0 */);
    index++;

    ch = (index < max) ? state.path.charCodeAt(index) : 0;

    if (zeroFirst && index < max) {
      // decimal number starts with '0' such as '09' is illegal.
      if (ch && isDigit(ch)) {
        state.err = 'SvgPath: numbers started with `0` such as `09` are ilegal (at pos ' + start + ')';
        return;
      }
    }

    while (index < max && isDigit(state.path.charCodeAt(index))) {
      index++;
      hasCeiling = true;
    }
    ch = (index < max) ? state.path.charCodeAt(index) : 0;
  }

  if (ch === 0x2E/* . */) {
    hasDot = true;
    index++;
    while (isDigit(state.path.charCodeAt(index))) {
      index++;
      hasDecimal = true;
    }
    ch = (index < max) ? state.path.charCodeAt(index) : 0;
  }

  if (ch === 0x65/* e */ || ch === 0x45/* E */) {
    if (hasDot && !hasCeiling && !hasDecimal) {
      state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
      return;
    }

    index++;

    ch = (index < max) ? state.path.charCodeAt(index) : 0;
    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      index++;
    }
    if (index < max && isDigit(state.path.charCodeAt(index))) {
      while (index < max && isDigit(state.path.charCodeAt(index))) {
        index++;
      }
    } else {
      state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
      return;
    }
  }

  state.index = index;
  state.param = parseFloat(state.path.slice(start, index)) + 0.0;
}


function finalizeSegment(state) {
  var cmd, cmdLC;

  // Process duplicated commands (without comand name)

  // This logic is shamelessly borrowed from Raphael
  // https://github.com/DmitryBaranovskiy/raphael/
  //
  cmd   = state.path[state.segmentStart];
  cmdLC = cmd.toLowerCase();

  var params = state.data;

  if (cmdLC === 'm' && params.length > 2) {
    state.result.push([ cmd, params[0], params[1] ]);
    params = params.slice(2);
    cmdLC = 'l';
    cmd = (cmd === 'm') ? 'l' : 'L';
  }

  if (cmdLC === 'r') {
    state.result.push([ cmd ].concat(params));
  } else {

    while (params.length >= paramCounts[cmdLC]) {
      state.result.push([ cmd ].concat(params.splice(0, paramCounts[cmdLC])));
      if (!paramCounts[cmdLC]) {
        break;
      }
    }
  }
}


function scanSegment(state) {
  var max = state.max,
      cmdCode, comma_found, need_params, i;

  state.segmentStart = state.index;
  cmdCode = state.path.charCodeAt(state.index);

  if (!isCommand(cmdCode)) {
    state.err = 'SvgPath: bad command ' + state.path[state.index] + ' (at pos ' + state.index + ')';
    return;
  }

  need_params = paramCounts[state.path[state.index].toLowerCase()];

  state.index++;
  skipSpaces(state);

  state.data = [];

  if (!need_params) {
    // Z
    finalizeSegment(state);
    return;
  }

  comma_found = false;

  for (;;) {
    for (i = need_params; i > 0; i--) {
      scanParam(state);
      if (state.err.length) {
        return;
      }
      state.data.push(state.param);

      skipSpaces(state);
      comma_found = false;

      if (state.index < max && state.path.charCodeAt(state.index) === 0x2C/* , */) {
        state.index++;
        skipSpaces(state);
        comma_found = true;
      }
    }

    // after ',' param is mandatory
    if (comma_found) {
      continue;
    }

    if (state.index >= state.max) {
      break;
    }

    // Stop on next segment
    if (!isDigitStart(state.path.charCodeAt(state.index))) {
      break;
    }
  }

  finalizeSegment(state);
}


/* Returns array of segments:
 *
 * [
 *   [ command, coord1, coord2, ... ]
 * ]
 */
module.exports = function pathParse(svgPath) {
  var state = new State(svgPath);
  var max = state.max;

  skipSpaces(state);

  while (state.index < max && !state.err.length) {
    scanSegment(state);
  }

  if (state.err.length) {
    state.result = [];

  } else if (state.result.length) {

    if ('mM'.indexOf(state.result[0][0]) < 0) {
      state.err = 'SvgPath: string should start with `M` or `m`';
      state.result = [];
    } else {
      state.result[0][0] = 'M';
    }
  }

  return {
    err: state.err,
    segments: state.result
  };
};

},{}],28:[function(require,module,exports){
// SVG Path transformations library
//
// Usage:
//
//    SvgPath('...')
//      .translate(-150, -100)
//      .scale(0.5)
//      .translate(-150, -100)
//      .toFixed(1)
//      .toString()
//

'use strict';


var pathParse      = require('./path_parse');
var transformParse = require('./transform_parse');
var matrix         = require('./matrix');
var a2c            = require('./a2c');
var ellipse        = require('./ellipse');


// Class constructor
//
function SvgPath(path) {
  if (!(this instanceof SvgPath)) { return new SvgPath(path); }

  var pstate = pathParse(path);

  // Array of path segments.
  // Each segment is array [command, param1, param2, ...]
  this.segments = pstate.segments;

  // Error message on parse error.
  this.err      = pstate.err;

  // Transforms stack for lazy evaluation
  this.__stack    = [];
}


SvgPath.prototype.__matrix = function (m) {
  var self = this, i;

  // Quick leave for empty matrix
  if (!m.queue.length) { return; }

  this.iterate(function (s, index, x, y) {
    var p, result, name, isRelative;

    switch (s[0]) {

      // Process 'assymetric' commands separately
      case 'v':
        p      = m.calc(0, s[1], true);
        result = (p[0] === 0) ? [ 'v', p[1] ] : [ 'l', p[0], p[1] ];
        break;

      case 'V':
        p      = m.calc(x, s[1], false);
        result = (p[0] === m.calc(x, y, false)[0]) ? [ 'V', p[1] ] : [ 'L', p[0], p[1] ];
        break;

      case 'h':
        p      = m.calc(s[1], 0, true);
        result = (p[1] === 0) ? [ 'h', p[0] ] : [ 'l', p[0], p[1] ];
        break;

      case 'H':
        p      = m.calc(s[1], y, false);
        result = (p[1] === m.calc(x, y, false)[1]) ? [ 'H', p[0] ] : [ 'L', p[0], p[1] ];
        break;

      case 'a':
      case 'A':
        // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]

        // Drop segment if arc is empty (end point === start point)
        /*if ((s[0] === 'A' && s[6] === x && s[7] === y) ||
            (s[0] === 'a' && s[6] === 0 && s[7] === 0)) {
          return [];
        }*/

        // Transform rx, ry and the x-axis-rotation
        var ma = m.toArray();
        var e = ellipse(s[1], s[2], s[3]).transform(ma);

        // flip sweep-flag if matrix is not orientation-preserving
        if (ma[0] * ma[3] - ma[1] * ma[2] < 0) {
          s[5] = s[5] ? '0' : '1';
        }

        // Transform end point as usual (without translation for relative notation)
        p = m.calc(s[6], s[7], s[0] === 'a');

        // Empty arcs can be ignored by renderer, but should not be dropped
        // to avoid collisions with `S A S` and so on. Replace with empty line.
        if ((s[0] === 'A' && s[6] === x && s[7] === y) ||
            (s[0] === 'a' && s[6] === 0 && s[7] === 0)) {
          result = [ s[0] === 'a' ? 'l' : 'L', p[0], p[1] ];
          break;
        }

        // if the resulting ellipse is (almost) a segment ...
        if (e.isDegenerate()) {
          // replace the arc by a line
          result = [ s[0] === 'a' ? 'l' : 'L', p[0], p[1] ];
        } else {
          // if it is a real ellipse
          // s[0], s[4] and s[5] are not modified
          result = [ s[0], e.rx, e.ry, e.ax, s[4], s[5], p[0], p[1] ];
        }

        break;

      case 'm':
        // Edge case. The very first `m` should be processed as absolute, if happens.
        // Make sense for coord shift transforms.
        isRelative = index > 0;

        p = m.calc(s[1], s[2], isRelative);
        result = [ 'm', p[0], p[1] ];
        break;

      default:
        name       = s[0];
        result     = [ name ];
        isRelative = (name.toLowerCase() === name);

        // Apply transformations to the segment
        for (i = 1; i < s.length; i += 2) {
          p = m.calc(s[i], s[i + 1], isRelative);
          result.push(p[0], p[1]);
        }
    }

    self.segments[index] = result;
  }, true);
};


// Apply stacked commands
//
SvgPath.prototype.__evaluateStack = function () {
  var m, i;

  if (!this.__stack.length) { return; }

  if (this.__stack.length === 1) {
    this.__matrix(this.__stack[0]);
    this.__stack = [];
    return;
  }

  m = matrix();
  i = this.__stack.length;

  while (--i >= 0) {
    m.matrix(this.__stack[i].toArray());
  }

  this.__matrix(m);
  this.__stack = [];
};


// Convert processed SVG Path back to string
//
SvgPath.prototype.toString = function () {
  var elements = [], skipCmd, cmd;

  this.__evaluateStack();

  for (var i = 0; i < this.segments.length; i++) {
    // remove repeating commands names
    cmd = this.segments[i][0];
    skipCmd = i > 0 && cmd !== 'm' && cmd !== 'M' && cmd === this.segments[i - 1][0];
    elements = elements.concat(skipCmd ? this.segments[i].slice(1) : this.segments[i]);
  }

  return elements.join(' ')
    // Optimizations: remove spaces around commands & before `-`
    //
    // We could also remove leading zeros for `0.5`-like values,
    // but their count is too small to spend time for.
    .replace(/ ?([achlmqrstvz]) ?/gi, '$1')
    .replace(/ \-/g, '-')
    // workaround for FontForge SVG importing bug
    .replace(/zm/g, 'z m');
};


// Translate path to (x [, y])
//
SvgPath.prototype.translate = function (x, y) {
  this.__stack.push(matrix().translate(x, y || 0));
  return this;
};


// Scale path to (sx [, sy])
// sy = sx if not defined
//
SvgPath.prototype.scale = function (sx, sy) {
  this.__stack.push(matrix().scale(sx, (!sy && (sy !== 0)) ? sx : sy));
  return this;
};


// Rotate path around point (sx [, sy])
// sy = sx if not defined
//
SvgPath.prototype.rotate = function (angle, rx, ry) {
  this.__stack.push(matrix().rotate(angle, rx || 0, ry || 0));
  return this;
};


// Skew path along the X axis by `degrees` angle
//
SvgPath.prototype.skewX = function (degrees) {
  this.__stack.push(matrix().skewX(degrees));
  return this;
};


// Skew path along the Y axis by `degrees` angle
//
SvgPath.prototype.skewY = function (degrees) {
  this.__stack.push(matrix().skewY(degrees));
  return this;
};


// Apply matrix transform (array of 6 elements)
//
SvgPath.prototype.matrix = function (m) {
  this.__stack.push(matrix().matrix(m));
  return this;
};


// Transform path according to "transform" attr of SVG spec
//
SvgPath.prototype.transform = function (transformString) {
  if (!transformString.trim()) {
    return this;
  }
  this.__stack.push(transformParse(transformString));
  return this;
};


// Round coords with given decimal precition.
// 0 by default (to integers)
//
SvgPath.prototype.round = function (d) {
  var contourStartDeltaX = 0, contourStartDeltaY = 0, deltaX = 0, deltaY = 0, l;

  d = d || 0;

  this.__evaluateStack();

  this.segments.forEach(function (s) {
    var isRelative = (s[0].toLowerCase() === s[0]);

    switch (s[0]) {
      case 'H':
      case 'h':
        if (isRelative) { s[1] += deltaX; }
        deltaX = s[1] - s[1].toFixed(d);
        s[1] = +s[1].toFixed(d);
        return;

      case 'V':
      case 'v':
        if (isRelative) { s[1] += deltaY; }
        deltaY = s[1] - s[1].toFixed(d);
        s[1] = +s[1].toFixed(d);
        return;

      case 'Z':
      case 'z':
        deltaX = contourStartDeltaX;
        deltaY = contourStartDeltaY;
        return;

      case 'M':
      case 'm':
        if (isRelative) {
          s[1] += deltaX;
          s[2] += deltaY;
        }

        deltaX = s[1] - s[1].toFixed(d);
        deltaY = s[2] - s[2].toFixed(d);

        contourStartDeltaX = deltaX;
        contourStartDeltaY = deltaY;

        s[1] = +s[1].toFixed(d);
        s[2] = +s[2].toFixed(d);
        return;

      case 'A':
      case 'a':
        // [cmd, rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
        if (isRelative) {
          s[6] += deltaX;
          s[7] += deltaY;
        }

        deltaX = s[6] - s[6].toFixed(d);
        deltaY = s[7] - s[7].toFixed(d);

        s[1] = +s[1].toFixed(d);
        s[2] = +s[2].toFixed(d);
        s[3] = +s[3].toFixed(d + 2); // better precision for rotation
        s[6] = +s[6].toFixed(d);
        s[7] = +s[7].toFixed(d);
        return;

      default:
        // a c l q s t
        l = s.length;

        if (isRelative) {
          s[l - 2] += deltaX;
          s[l - 1] += deltaY;
        }

        deltaX = s[l - 2] - s[l - 2].toFixed(d);
        deltaY = s[l - 1] - s[l - 1].toFixed(d);

        s.forEach(function (val, i) {
          if (!i) { return; }
          s[i] = +s[i].toFixed(d);
        });
        return;
    }
  });

  return this;
};


// Apply iterator function to all segments. If function returns result,
// current segment will be replaced to array of returned segments.
// If empty array is returned, current regment will be deleted.
//
SvgPath.prototype.iterate = function (iterator, keepLazyStack) {
  var segments = this.segments,
      replacements = {},
      needReplace = false,
      lastX = 0,
      lastY = 0,
      countourStartX = 0,
      countourStartY = 0;
  var i, j, newSegments;

  if (!keepLazyStack) {
    this.__evaluateStack();
  }

  segments.forEach(function (s, index) {

    var res = iterator(s, index, lastX, lastY);

    if (Array.isArray(res)) {
      replacements[index] = res;
      needReplace = true;
    }

    var isRelative = (s[0] === s[0].toLowerCase());

    // calculate absolute X and Y
    switch (s[0]) {
      case 'm':
      case 'M':
        lastX = s[1] + (isRelative ? lastX : 0);
        lastY = s[2] + (isRelative ? lastY : 0);
        countourStartX = lastX;
        countourStartY = lastY;
        return;

      case 'h':
      case 'H':
        lastX = s[1] + (isRelative ? lastX : 0);
        return;

      case 'v':
      case 'V':
        lastY = s[1] + (isRelative ? lastY : 0);
        return;

      case 'z':
      case 'Z':
        // That make sence for multiple contours
        lastX = countourStartX;
        lastY = countourStartY;
        return;

      default:
        lastX = s[s.length - 2] + (isRelative ? lastX : 0);
        lastY = s[s.length - 1] + (isRelative ? lastY : 0);
    }
  });

  // Replace segments if iterator return results

  if (!needReplace) { return this; }

  newSegments = [];

  for (i = 0; i < segments.length; i++) {
    if (typeof replacements[i] !== 'undefined') {
      for (j = 0; j < replacements[i].length; j++) {
        newSegments.push(replacements[i][j]);
      }
    } else {
      newSegments.push(segments[i]);
    }
  }

  this.segments = newSegments;

  return this;
};


// Converts segments from relative to absolute
//
SvgPath.prototype.abs = function () {

  this.iterate(function (s, index, x, y) {
    var name = s[0],
        nameUC = name.toUpperCase(),
        i;

    // Skip absolute commands
    if (name === nameUC) { return; }

    s[0] = nameUC;

    switch (name) {
      case 'v':
        // v has shifted coords parity
        s[1] += y;
        return;

      case 'a':
        // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
        // touch x, y only
        s[6] += x;
        s[7] += y;
        return;

      default:
        for (i = 1; i < s.length; i++) {
          s[i] += i % 2 ? x : y; // odd values are X, even - Y
        }
    }
  }, true);

  return this;
};


// Converts segments from absolute to relative
//
SvgPath.prototype.rel = function () {

  this.iterate(function (s, index, x, y) {
    var name = s[0],
        nameLC = name.toLowerCase(),
        i;

    // Skip relative commands
    if (name === nameLC) { return; }

    // Don't touch the first M to avoid potential confusions.
    if (index === 0 && name === 'M') { return; }

    s[0] = nameLC;

    switch (name) {
      case 'V':
        // V has shifted coords parity
        s[1] -= y;
        return;

      case 'A':
        // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
        // touch x, y only
        s[6] -= x;
        s[7] -= y;
        return;

      default:
        for (i = 1; i < s.length; i++) {
          s[i] -= i % 2 ? x : y; // odd values are X, even - Y
        }
    }
  }, true);

  return this;
};


// Converts arcs to cubic bézier curves
//
SvgPath.prototype.unarc = function () {
  this.iterate(function (s, index, x, y) {
    var new_segments, nextX, nextY, result = [], name = s[0];

    // Skip anything except arcs
    if (name !== 'A' && name !== 'a') { return null; }

    if (name === 'a') {
      // convert relative arc coordinates to absolute
      nextX = x + s[6];
      nextY = y + s[7];
    } else {
      nextX = s[6];
      nextY = s[7];
    }

    new_segments = a2c(x, y, nextX, nextY, s[4], s[5], s[1], s[2], s[3]);

    // Degenerated arcs can be ignored by renderer, but should not be dropped
    // to avoid collisions with `S A S` and so on. Replace with empty line.
    if (new_segments.length === 0) {
      return [ [ s[0] === 'a' ? 'l' : 'L', s[6], s[7] ] ];
    }

    new_segments.forEach(function (s) {
      result.push([ 'C', s[2], s[3], s[4], s[5], s[6], s[7] ]);
    });

    return result;
  });

  return this;
};


// Converts smooth curves (with missed control point) to generic curves
//
SvgPath.prototype.unshort = function () {
  var segments = this.segments;
  var prevControlX, prevControlY, prevSegment;
  var curControlX, curControlY;

  // TODO: add lazy evaluation flag when relative commands supported

  this.iterate(function (s, idx, x, y) {
    var name = s[0], nameUC = name.toUpperCase(), isRelative;

    // First command MUST be M|m, it's safe to skip.
    // Protect from access to [-1] for sure.
    if (!idx) { return; }

    if (nameUC === 'T') { // quadratic curve
      isRelative = (name === 't');

      prevSegment = segments[idx - 1];

      if (prevSegment[0] === 'Q') {
        prevControlX = prevSegment[1] - x;
        prevControlY = prevSegment[2] - y;
      } else if (prevSegment[0] === 'q') {
        prevControlX = prevSegment[1] - prevSegment[3];
        prevControlY = prevSegment[2] - prevSegment[4];
      } else {
        prevControlX = 0;
        prevControlY = 0;
      }

      curControlX = -prevControlX;
      curControlY = -prevControlY;

      if (!isRelative) {
        curControlX += x;
        curControlY += y;
      }

      segments[idx] = [
        isRelative ? 'q' : 'Q',
        curControlX, curControlY,
        s[1], s[2]
      ];

    } else if (nameUC === 'S') { // cubic curve
      isRelative = (name === 's');

      prevSegment = segments[idx - 1];

      if (prevSegment[0] === 'C') {
        prevControlX = prevSegment[3] - x;
        prevControlY = prevSegment[4] - y;
      } else if (prevSegment[0] === 'c') {
        prevControlX = prevSegment[3] - prevSegment[5];
        prevControlY = prevSegment[4] - prevSegment[6];
      } else {
        prevControlX = 0;
        prevControlY = 0;
      }

      curControlX = -prevControlX;
      curControlY = -prevControlY;

      if (!isRelative) {
        curControlX += x;
        curControlY += y;
      }

      segments[idx] = [
        isRelative ? 'c' : 'C',
        curControlX, curControlY,
        s[1], s[2], s[3], s[4]
      ];
    }
  });

  return this;
};


module.exports = SvgPath;

},{"./a2c":24,"./ellipse":25,"./matrix":26,"./path_parse":27,"./transform_parse":29}],29:[function(require,module,exports){
'use strict';


var Matrix = require('./matrix');

var operations = {
  matrix: true,
  scale: true,
  rotate: true,
  translate: true,
  skewX: true,
  skewY: true
};

var CMD_SPLIT_RE    = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
var PARAMS_SPLIT_RE = /[\s,]+/;


module.exports = function transformParse(transformString) {
  var matrix = new Matrix();
  var cmd, params;

  // Split value into ['', 'translate', '10 50', '', 'scale', '2', '', 'rotate',  '-45', '']
  transformString.split(CMD_SPLIT_RE).forEach(function (item) {

    // Skip empty elements
    if (!item.length) { return; }

    // remember operation
    if (typeof operations[item] !== 'undefined') {
      cmd = item;
      return;
    }

    // extract params & att operation to matrix
    params = item.split(PARAMS_SPLIT_RE).map(function (i) {
      return +i || 0;
    });

    // If params count is not correct - ignore command
    switch (cmd) {
      case 'matrix':
        if (params.length === 6) {
          matrix.matrix(params);
        }
        return;

      case 'scale':
        if (params.length === 1) {
          matrix.scale(params[0], params[0]);
        } else if (params.length === 2) {
          matrix.scale(params[0], params[1]);
        }
        return;

      case 'rotate':
        if (params.length === 1) {
          matrix.rotate(params[0], 0, 0);
        } else if (params.length === 3) {
          matrix.rotate(params[0], params[1], params[2]);
        }
        return;

      case 'translate':
        if (params.length === 1) {
          matrix.translate(params[0], 0);
        } else if (params.length === 2) {
          matrix.translate(params[0], params[1]);
        }
        return;

      case 'skewX':
        if (params.length === 1) {
          matrix.skewX(params[0]);
        }
        return;

      case 'skewY':
        if (params.length === 1) {
          matrix.skewY(params[0]);
        }
        return;
    }
  });

  return matrix;
};

},{"./matrix":26}],30:[function(require,module,exports){
'use strict';

// t: current time, b: beginning value, _c: final value, d: total duration
var tweenFunctions = {
  linear: function(t, b, _c, d) {
    var c = _c - b;
    return c * t / d + b;
  },
  easeInQuad: function(t, b, _c, d) {
    var c = _c - b;
    return c * (t /= d) * t + b;
  },
  easeOutQuad: function(t, b, _c, d) {
    var c = _c - b;
    return -c * (t /= d) * (t - 2) + b;
  },
  easeInOutQuad: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d / 2) < 1) {
      return c / 2 * t * t + b;
    } else {
      return -c / 2 * ((--t) * (t - 2) - 1) + b;
    }
  },
  easeInCubic: function(t, b, _c, d) {
    var c = _c - b;
    return c * (t /= d) * t * t + b;
  },
  easeOutCubic: function(t, b, _c, d) {
    var c = _c - b;
    return c * ((t = t / d - 1) * t * t + 1) + b;
  },
  easeInOutCubic: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d / 2) < 1) {
      return c / 2 * t * t * t + b;
    } else {
      return c / 2 * ((t -= 2) * t * t + 2) + b;
    }
  },
  easeInQuart: function(t, b, _c, d) {
    var c = _c - b;
    return c * (t /= d) * t * t * t + b;
  },
  easeOutQuart: function(t, b, _c, d) {
    var c = _c - b;
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  },
  easeInOutQuart: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d / 2) < 1) {
      return c / 2 * t * t * t * t + b;
    } else {
      return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
    }
  },
  easeInQuint: function(t, b, _c, d) {
    var c = _c - b;
    return c * (t /= d) * t * t * t * t + b;
  },
  easeOutQuint: function(t, b, _c, d) {
    var c = _c - b;
    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
  },
  easeInOutQuint: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d / 2) < 1) {
      return c / 2 * t * t * t * t * t + b;
    } else {
      return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
    }
  },
  easeInSine: function(t, b, _c, d) {
    var c = _c - b;
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  },
  easeOutSine: function(t, b, _c, d) {
    var c = _c - b;
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  },
  easeInOutSine: function(t, b, _c, d) {
    var c = _c - b;
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  },
  easeInExpo: function(t, b, _c, d) {
    var c = _c - b;
    return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
  },
  easeOutExpo: function(t, b, _c, d) {
    var c = _c - b;
    return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
  },
  easeInOutExpo: function(t, b, _c, d) {
    var c = _c - b;
    if (t === 0) {
      return b;
    }
    if (t === d) {
      return b + c;
    }
    if ((t /= d / 2) < 1) {
      return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    } else {
      return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
    }
  },
  easeInCirc: function(t, b, _c, d) {
    var c = _c - b;
    return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
  },
  easeOutCirc: function(t, b, _c, d) {
    var c = _c - b;
    return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
  },
  easeInOutCirc: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d / 2) < 1) {
      return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    } else {
      return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
    }
  },
  easeInElastic: function(t, b, _c, d) {
    var c = _c - b;
    var a, p, s;
    s = 1.70158;
    p = 0;
    a = c;
    if (t === 0) {
      return b;
    } else if ((t /= d) === 1) {
      return b + c;
    }
    if (!p) {
      p = d * 0.3;
    }
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
  },
  easeOutElastic: function(t, b, _c, d) {
    var c = _c - b;
    var a, p, s;
    s = 1.70158;
    p = 0;
    a = c;
    if (t === 0) {
      return b;
    } else if ((t /= d) === 1) {
      return b + c;
    }
    if (!p) {
      p = d * 0.3;
    }
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
  },
  easeInOutElastic: function(t, b, _c, d) {
    var c = _c - b;
    var a, p, s;
    s = 1.70158;
    p = 0;
    a = c;
    if (t === 0) {
      return b;
    } else if ((t /= d / 2) === 2) {
      return b + c;
    }
    if (!p) {
      p = d * (0.3 * 1.5);
    }
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    if (t < 1) {
      return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    } else {
      return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * 0.5 + c + b;
    }
  },
  easeInBack: function(t, b, _c, d, s) {
    var c = _c - b;
    if (s === void 0) {
      s = 1.70158;
    }
    return c * (t /= d) * t * ((s + 1) * t - s) + b;
  },
  easeOutBack: function(t, b, _c, d, s) {
    var c = _c - b;
    if (s === void 0) {
      s = 1.70158;
    }
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },
  easeInOutBack: function(t, b, _c, d, s) {
    var c = _c - b;
    if (s === void 0) {
      s = 1.70158;
    }
    if ((t /= d / 2) < 1) {
      return c / 2 * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
    } else {
      return c / 2 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
    }
  },
  easeInBounce: function(t, b, _c, d) {
    var c = _c - b;
    var v;
    v = tweenFunctions.easeOutBounce(d - t, 0, c, d);
    return c - v + b;
  },
  easeOutBounce: function(t, b, _c, d) {
    var c = _c - b;
    if ((t /= d) < 1 / 2.75) {
      return c * (7.5625 * t * t) + b;
    } else if (t < 2 / 2.75) {
      return c * (7.5625 * (t -= 1.5 / 2.75) * t + 0.75) + b;
    } else if (t < 2.5 / 2.75) {
      return c * (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375) + b;
    } else {
      return c * (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375) + b;
    }
  },
  easeInOutBounce: function(t, b, _c, d) {
    var c = _c - b;
    var v;
    if (t < d / 2) {
      v = tweenFunctions.easeInBounce(t * 2, 0, c, d);
      return v * 0.5 + b;
    } else {
      v = tweenFunctions.easeOutBounce(t * 2 - d, 0, c, d);
      return v * 0.5 + c * 0.5 + b;
    }
  }
};

module.exports = tweenFunctions;

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * A naive, but small, clone function.
 *
 * @param {*} value
 *
 * @returns {*}
 *
 * @example
 * clone('hello world')
 */
var clone = function clone(value) {
  if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object') {
    return value;
  } else if (Array.isArray(value)) {
    var arr = [];

    for (var i = 0, l = value.length; i < l; i++) {
      arr.push(clone(value[i]));
    }

    return arr;
  } else if (value !== null) {
    var obj = {};

    for (var key in value) {
      obj[key] = clone(value[key]);
    }

    return obj;
  }

  return value;
};

exports.default = clone;
},{}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * A tweenable color.
 *
 * @typedef {Object} Color
 *
 * @property {string} middleware - The name of this middleware.
 * @property {number} r - The hexadecimal red value.
 * @property {number} g - The hexadecimal green value.
 * @property {number} b - The hexadecimal blue value.
 * @property {number} a - The alpha value.
 */

var name = 'color';

var htmlColors = {
  'aliceblue': '#F0F8FF',
  'antiquewhite': '#FAEBD7',
  'aqua': '#00FFFF',
  'aquamarine': '#7FFFD4',
  'azure': '#F0FFFF',
  'beige': '#F5F5DC',
  'bisque': '#FFE4C4',
  'black': '#000000',
  'blanchedalmond': '#FFEBCD',
  'blue': '#0000FF',
  'blueviolet': '#8A2BE2',
  'brown': '#A52A2A',
  'burlywood': '#DEB887',
  'cadetblue': '#5F9EA0',
  'chartreuse': '#7FFF00',
  'chocolate': '#D2691E',
  'coral': '#FF7F50',
  'cornflowerblue': '#6495ED',
  'cornsilk': '#FFF8DC',
  'crimson': '#DC143C',
  'cyan': '#00FFFF',
  'darkblue': '#00008B',
  'darkcyan': '#008B8B',
  'darkgoldenrod': '#B8860B',
  'darkgray': '#A9A9A9',
  'darkgreen': '#006400',
  'darkgrey': '#A9A9A9',
  'darkkhaki': '#BDB76B',
  'darkmagenta': '#8B008B',
  'darkolivegreen': '#556B2F',
  'darkorange': '#FF8C00',
  'darkorchid': '#9932CC',
  'darkred': '#8B0000',
  'darksalmon': '#E9967A',
  'darkseagreen': '#8FBC8F',
  'darkslateblue': '#483D8B',
  'darkslategray': '#2F4F4F',
  'darkslategrey': '#2F4F4F',
  'darkturquoise': '#00CED1',
  'darkviolet': '#9400D3',
  'deeppink': '#FF1493',
  'deepskyblue': '#00BFFF',
  'dimgray': '#696969',
  'dimgrey': '#696969',
  'dodgerblue': '#1E90FF',
  'firebrick': '#B22222',
  'floralwhite': '#FFFAF0',
  'forestgreen': '#228B22',
  'fuchsia': '#FF00FF',
  'gainsboro': '#DCDCDC',
  'ghostwhite': '#F8F8FF',
  'gold': '#FFD700',
  'goldenrod': '#DAA520',
  'gray': '#808080',
  'green': '#008000',
  'greenyellow': '#ADFF2F',
  'grey': '#808080',
  'honeydew': '#F0FFF0',
  'hotpink': '#FF69B4',
  'indianred': '#CD5C5C',
  'indigo': '#4B0082',
  'ivory': '#FFFFF0',
  'khaki': '#F0E68C',
  'lavender': '#E6E6FA',
  'lavenderblush': '#FFF0F5',
  'lawngreen': '#7CFC00',
  'lemonchiffon': '#FFFACD',
  'lightblue': '#ADD8E6',
  'lightcoral': '#F08080',
  'lightcyan': '#E0FFFF',
  'lightgoldenrodyellow': '#FAFAD2',
  'lightgray': '#D3D3D3',
  'lightgreen': '#90EE90',
  'lightgrey': '#D3D3D3',
  'lightpink': '#FFB6C1',
  'lightsalmon': '#FFA07A',
  'lightseagreen': '#20B2AA',
  'lightskyblue': '#87CEFA',
  'lightslategray': '#778899',
  'lightslategrey': '#778899',
  'lightsteelblue': '#B0C4DE',
  'lightyellow': '#FFFFE0',
  'lime': '#00FF00',
  'limegreen': '#32CD32',
  'linen': '#FAF0E6',
  'magenta': '#FF00FF',
  'maroon': '#800000',
  'mediumaquamarine': '#66CDAA',
  'mediumblue': '#0000CD',
  'mediumorchid': '#BA55D3',
  'mediumpurple': '#9370DB',
  'mediumseagreen': '#3CB371',
  'mediumslateblue': '#7B68EE',
  'mediumspringgreen': '#00FA9A',
  'mediumturquoise': '#48D1CC',
  'mediumvioletred': '#C71585',
  'midnightblue': '#191970',
  'mintcream': '#F5FFFA',
  'mistyrose': '#FFE4E1',
  'moccasin': '#FFE4B5',
  'navajowhite': '#FFDEAD',
  'navy': '#000080',
  'oldlace': '#FDF5E6',
  'olive': '#808000',
  'olivedrab': '#6B8E23',
  'orange': '#FFA500',
  'orangered': '#FF4500',
  'orchid': '#DA70D6',
  'palegoldenrod': '#EEE8AA',
  'palegreen': '#98FB98',
  'paleturquoise': '#AFEEEE',
  'palevioletred': '#DB7093',
  'papayawhip': '#FFEFD5',
  'peachpuff': '#FFDAB9',
  'peru': '#CD853F',
  'pink': '#FFC0CB',
  'plum': '#DDA0DD',
  'powderblue': '#B0E0E6',
  'purple': '#800080',
  'rebeccapurple': '#663399',
  'red': '#FF0000',
  'rosybrown': '#BC8F8F',
  'royalblue': '#4169E1',
  'saddlebrown': '#8B4513',
  'salmon': '#FA8072',
  'sandybrown': '#F4A460',
  'seagreen': '#2E8B57',
  'seashell': '#FFF5EE',
  'sienna': '#A0522D',
  'silver': '#C0C0C0',
  'skyblue': '#87CEEB',
  'slateblue': '#6A5ACD',
  'slategray': '#708090',
  'slategrey': '#708090',
  'snow': '#FFFAFA',
  'springgreen': '#00FF7F',
  'steelblue': '#4682B4',
  'tan': '#D2B48C',
  'teal': '#008080',
  'thistle': '#D8BFD8',
  'tomato': '#FF6347',
  'turquoise': '#40E0D0',
  'violet': '#EE82EE',
  'wheat': '#F5DEB3',
  'white': '#FFFFFF',
  'whitesmoke': '#F5F5F5',
  'yellow': '#FFFF00',
  'yellowgreen': '#9ACD32'
};

var htmlColorKeys = Object.keys(htmlColors);

/**
 * Converts a color string to a Color.
 *
 * @param {*} x - A potential color string.
 *
 * @returns {*}
 *
 * @example
 * input('#FFFFFF')
 */
var input = function input(x) {
  if (typeof x === 'string') {
    if (hex(x)) {
      return hexToColor(x);
    } else if (rgb(x)) {
      return rgbToColor(x);
    } else if (rgba(x)) {
      return rgbaToColor(x);
    } else if (html(x)) {
      return htmlToColor(x);
    }
  }

  return x;
};

/**
 * Converts a Color to a rgba color string.
 *
 * @param {*} x - A potential Color.
 *
 * @returns {*}
 *
 * @example
 * output(color)
 */
var output = function output(x) {
  if ((typeof x === 'undefined' ? 'undefined' : _typeof(x)) === 'object' && x.middleware === name) {
    return colorToRgba(x);
  }

  return x;
};

/**
 * Is string a hex color?
 *
 * @param {string} str - A potential hex color.
 *
 * @returns {boolean}
 *
 * @example
 * hex('#FFFFFF')
 */
var hex = function hex(str) {
  return str.match(/^#(?:[0-9a-f]{3}){1,2}$/i) !== null;
};

/**
 * Is string a rgba color?
 *
 * @param {string} str - A potential rgba color.
 *
 * @returns {boolean}
 *
 * @example
 * rgba('rgba(255,255,255,1)')
 */
var rgba = function rgba(str) {
  return str.startsWith('rgba(');
};

/**
 * Is string a rgb color?
 *
 * @param {string} str - A potential rgb color.
 *
 * @returns {boolean}
 *
 * @example
 * rgb('rgb(255,255,255)')
 */
var rgb = function rgb(str) {
  return str.startsWith('rgb(');
};

/**
 * Is string a html color?
 *
 * @param {string} str - A potential html color.
 *
 * @returns {boolean}
 *
 * @example
 * html('limegreen')
 */
var html = function html(str) {
  return htmlColorKeys.indexOf(str) !== -1;
};

/**
 * Converts a hex string to a Color.
 *
 * @param {string} hex - A hex color.
 *
 * @returns {Color}
 *
 * @example
 * hexToColor('#FFFFFF')
 */
var hexToColor = function hexToColor(hex) {
  var x = hex.replace('#', '');

  if (x.length === 3) {
    var y = '';

    for (var i = 0; i < 3; i++) {
      var v = x.charAt(i);
      y += '' + v + v;
    }

    x = y;
  }

  return {
    middleware: name,
    r: parseInt(x.slice(0, 2), 16),
    g: parseInt(x.slice(2, 4), 16),
    b: parseInt(x.slice(4, 6), 16),
    a: 1
  };
};

/**
 * Converts a rgb string to a Color.
 *
 * @param {string} rgb - A rgb color.
 *
 * @returns {Color}
 *
 * @example
 * rgbToColor('rgb(255,255,255)')
 */
var rgbToColor = function rgbToColor(rgb) {
  var x = rgb.replace(/\s/g, '');

  var _x$substring$split = x.substring(4, x.length - 1).split(','),
      _x$substring$split2 = _slicedToArray(_x$substring$split, 3),
      r = _x$substring$split2[0],
      g = _x$substring$split2[1],
      b = _x$substring$split2[2];

  return {
    middleware: name,
    r: parseFloat(r),
    g: parseFloat(g),
    b: parseFloat(b),
    a: 1
  };
};

/**
 * Converts a rgba string to a Color.
 *
 * @param {string} rgba - A rgba color.
 *
 * @returns {Color}
 *
 * @example
 * rgbaToColor('rgba(255,255,255,1)')
 */
var rgbaToColor = function rgbaToColor(rgba) {
  var x = rgba.replace(/\s/g, '');

  var _x$substring$split3 = x.substring(5, x.length - 1).split(','),
      _x$substring$split4 = _slicedToArray(_x$substring$split3, 4),
      r = _x$substring$split4[0],
      g = _x$substring$split4[1],
      b = _x$substring$split4[2],
      a = _x$substring$split4[3];

  return {
    middleware: 'color',
    r: parseFloat(r),
    g: parseFloat(g),
    b: parseFloat(b),
    a: parseFloat(a)
  };
};

/**
 * Converts a html string to a Color.
 *
 * @param {string} html - An html color.
 *
 * @returns {Color}
 *
 * @example
 * htmlToColor('limegreen')
 */
var htmlToColor = function htmlToColor(html) {
  return hexToColor(htmlColors[html]);
};

/**
 * Converts a Color to a rgba color string.
 *
 * @param {Color} color
 *
 * @returns {string}
 *
 * @example
 * colorToRgba(color)
 */
var colorToRgba = function colorToRgba(_ref) {
  var r = _ref.r,
      g = _ref.g,
      b = _ref.b,
      a = _ref.a;
  return 'rgba(' + parseInt(limit(r, 0, 255), 10) + ',' + parseInt(limit(g, 0, 255), 10) + ',' + parseInt(limit(b, 0, 255), 10) + ',' + limit(a, 0, 1) + ')';
};

/**
 * Find the closest number within limits.
 *
 * @param {number} num - The desired number.
 * @param {number} min - The minimum returned number.
 * @param {number} max - the maximum returned number.
 *
 * @returns {number}
 *
 * @example
 * limit(-1, 2, 5)
 */
var limit = function limit(num, min, max) {
  return Math.max(min, Math.min(max, num));
};

exports.default = { name: name, input: input, output: output };
},{}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _colorMiddleware = require('./color-middleware');

var _colorMiddleware2 = _interopRequireDefault(_colorMiddleware);

var _unitMiddleware = require('./unit-middleware');

var _unitMiddleware2 = _interopRequireDefault(_unitMiddleware);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = {
  defaults: {
    keyframe: {
      duration: 250,
      easing: 'easeInOutQuad'
    },
    motionPath: {
      easing: 'easeInOutQuad'
    },
    timeline: {
      alternate: false,
      initialIterations: 0,
      iterations: 1,
      middleware: [_colorMiddleware2.default, _unitMiddleware2.default],
      queue: 0,
      reverse: false
    }
  }
};

exports.default = config;
},{"./color-middleware":32,"./unit-middleware":45}],34:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /* globals __DEV__ */

var _tweenFunctions = require('tween-functions');

var _tweenFunctions2 = _interopRequireDefault(_tweenFunctions);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * An easing function.
 *
 * @param {(function|string)} easing - An easing function or the name of an easing function from https://github.com/chenglou/tween-functions.
 *
 * @returns {function}
 *
 * @example
 * easingFunc('easeInOutQuad')
 */
var easingFunction = function easingFunction(easing) {
  switch (typeof easing === 'undefined' ? 'undefined' : _typeof(easing)) {
    case 'string':
      if (_tweenFunctions2.default[easing]) {
        return _tweenFunctions2.default[easing];
      }

      if (process.env.NODE_ENV !== 'production') {
        throw new TypeError('Easing must match one of the options defined by https://github.com/chenglou/tween-functions');
      }

      /* istanbul ignore next */
      break;

    case 'function':
      return easing;

    default:
      if (process.env.NODE_ENV !== 'production') {
        throw new TypeError('Easing must be of type function or string');
      }

      /* istanbul ignore next */
      break;
  }
};

exports.default = easingFunction;
}).call(this,require('_process'))
},{"_process":18,"tween-functions":30}],35:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validEventName = exports.unsubscribe = exports.timeToSamePosition = exports.timeToPosition = exports.subscribe = exports.positionTimestamps = exports.playbackOptionsChanged = exports.oldest = exports.eventQueue = exports.event = exports.activeEventNames = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* globals __DEV__ */

var _timeline = require('./timeline');

/**
 * An event.
 *
 * @typedef {Object} Event
 *
 * @property {number} at - The time the event occured.
 * @property {string} name - The event name.
 * @property {Object} options - Any additional event data.
 */

/**
 * A Timeline event subscription.
 *
 * @typedef {Object} EventSubscription
 *
 * @property {function} callback
 * @property {string} name
 * @property {number} token
 */

/**
 * An object to hold Timeline EventSubscriptions, and subscribe/unsubscribe functions.
 *
 * @typedef {Object} EventObject
 *
 * @property {Object} previousPlaybackOptions
 * @property {Object} previousState
 * @property {function} subscribe - A function to subscribe to Timeline events.
 * @property {EventSubscription[]} subscriptions
 * @property {function} unsubscribe - A function to unsubscribe to Timeline events.
 */

/**
 * Token incrementor.
 */
var t = 0;

/**
 * Accepted event names.
 */
var acceptedEventNames = ['timeline.start', 'timeline.finish', 'shape.start', 'shape.finish', 'keyframe', 'frame'];

/**
 * An EventObject creator.
 *
 * @param {Timeline} timeline
 *
 * @returns {EventObject}
 *
 * @example
 * event(timeline)
 */
var event = function event(timeline) {
  return {
    previousPlaybackOptions: {},
    previousState: {},
    subscribe: subscribe(timeline),
    subscriptions: [],
    unsubscribe: unsubscribe(timeline)
  };
};

/**
 * Is a Timeline active?
 *
 * @param {Timeline} timeline
 *
 * @returns {boolean}
 *
 * @example
 * active(timeline)
 */
var active = function active(_ref) {
  var event = _ref.event,
      state = _ref.state;
  return state.started && (!state.finished || typeof event.previousState === 'undefined' || !event.previousState.finished);
};

/**
 * A unique list of Timeline EventSubscription names.
 *
 * @param {Timeline} timeline
 *
 * @returns {string[]}
 *
 * @example
 * activeEventNames(timeline)
 */
var activeEventNames = function activeEventNames(_ref2) {
  var subscriptions = _ref2.event.subscriptions;

  var s = [];

  for (var i = 0, l = subscriptions.length; i < l; i++) {
    var name = subscriptions[i].name;

    if (s.indexOf(name) === -1) {
      s.push(name);
    }
  }

  return s;
};

/**
 * Run EventSubscription callbacks for every event that has occured since last check.
 *
 * @param {Timeline} timeline
 *
 * @example
 * events(timeline)
 */
var events = function events(timeline) {
  if (playbackOptionsChanged(timeline)) {
    timeline.event.previousPlaybackOptions = {};
    timeline.event.previousState = {};
  }

  var subscriptions = timeline.event.subscriptions;

  if (subscriptions.length && active(timeline)) {
    var eventNames = activeEventNames(timeline);
    var queue = eventQueue(timeline, eventNames);

    for (var i = 0, l = queue.length; i < l; i++) {
      var _event = queue[i];
      var eventName = _event.name;
      var options = _event.options || {};

      for (var _i = 0, _l = subscriptions.length; _i < _l; _i++) {
        var subscription = subscriptions[_i];

        if (eventName === subscription.name) {
          subscription.callback(options);
        }
      }
    }
  }

  timeline.event.previousPlaybackOptions = _extends({}, timeline.playbackOptions);
  timeline.event.previousState = _extends({}, timeline.state);
};

/**
 * An array of Events that have occured since last checked.
 *
 * @param {Timeline} timeline
 * @param {string[]} eventNames
 *
 * @returns {Event[]}
 *
 * @example
 * eventQueue(timeline, eventNames)
 */
var eventQueue = function eventQueue(_ref3, eventNames) {
  var previousState = _ref3.event.previousState,
      playbackOptions = _ref3.playbackOptions,
      state = _ref3.state,
      timelineShapes = _ref3.timelineShapes;

  var queue = [];
  var alternate = playbackOptions.alternate,
      duration = playbackOptions.duration,
      initialIterations = playbackOptions.initialIterations,
      iterations = playbackOptions.iterations,
      reverse = playbackOptions.reverse,
      started = playbackOptions.started;

  var max = started + duration * state.iterationsComplete;
  var min = typeof previousState.iterationsComplete !== 'undefined' ? started + duration * previousState.iterationsComplete + 1 : 0;

  var getTimestamps = function getTimestamps(pos) {
    return positionTimestamps({
      alternate: alternate,
      duration: duration,
      initialIterations: initialIterations,
      iterations: iterations,
      max: max,
      min: min,
      position: pos,
      reverse: reverse,
      started: started
    });
  };

  if (eventNames.indexOf('timeline.start') !== -1) {
    var timestamps = getTimestamps(0);

    for (var i = 0, l = timestamps.length; i < l; i++) {
      queue.push({ name: 'timeline.start', at: timestamps[i] });
    }
  }

  if (eventNames.indexOf('timeline.finish') !== -1) {
    var _timestamps = getTimestamps(1);

    for (var _i2 = 0, _l2 = _timestamps.length; _i2 < _l2; _i2++) {
      queue.push({ name: 'timeline.finish', at: _timestamps[_i2] });
    }
  }

  if (eventNames.indexOf('shape.start') !== -1) {
    for (var _i3 = 0, _l3 = timelineShapes.length; _i3 < _l3; _i3++) {
      var _timelineShapes$_i = timelineShapes[_i3],
          shapeName = _timelineShapes$_i.shape.name,
          start = _timelineShapes$_i.timelinePosition.start;

      var _timestamps2 = getTimestamps(start);

      for (var _i = 0, _l = _timestamps2.length; _i < _l; _i++) {
        queue.push({ name: 'shape.start', at: _timestamps2[_i], options: { shapeName: shapeName } });
      }
    }
  }

  if (eventNames.indexOf('shape.finish') !== -1) {
    for (var _i4 = 0, _l4 = timelineShapes.length; _i4 < _l4; _i4++) {
      var _timelineShapes$_i2 = timelineShapes[_i4],
          shapeName = _timelineShapes$_i2.shape.name,
          finish = _timelineShapes$_i2.timelinePosition.finish;

      var _timestamps3 = getTimestamps(finish);

      for (var _i5 = 0, _l5 = _timestamps3.length; _i5 < _l5; _i5++) {
        queue.push({ name: 'shape.finish', at: _timestamps3[_i5], options: { shapeName: shapeName } });
      }
    }
  }

  if (eventNames.indexOf('keyframe') !== -1) {
    for (var _i6 = 0, _l6 = timelineShapes.length; _i6 < _l6; _i6++) {
      var _timelineShapes$_i3 = timelineShapes[_i6],
          _timelineShapes$_i3$s = _timelineShapes$_i3.shape,
          shapeName = _timelineShapes$_i3$s.name,
          keyframes = _timelineShapes$_i3$s.keyframes,
          _timelineShapes$_i3$t = _timelineShapes$_i3.timelinePosition,
          start = _timelineShapes$_i3$t.start,
          finish = _timelineShapes$_i3$t.finish;


      for (var _i7 = 0, _l7 = keyframes.length; _i7 < _l7; _i7++) {
        var _keyframes$_i = keyframes[_i7],
            keyframeName = _keyframes$_i.name,
            position = _keyframes$_i.position;


        var keyframePosition = start + (finish - start) * position;
        var _timestamps4 = getTimestamps(keyframePosition);

        for (var __i = 0, __l = _timestamps4.length; __i < __l; __i++) {
          queue.push({ name: 'keyframe', at: _timestamps4[__i], options: { keyframeName: keyframeName, shapeName: shapeName } });
        }
      }
    }
  }

  if (eventNames.indexOf('frame') !== -1) {
    queue.push({ name: 'frame', at: max });
  }

  return queue.sort(oldest);
};

/**
 * A sort function for Events.
 *
 * @param {Event} a
 * @param {Event} b
 *
 * @returns {number}
 *
 * @example
 * oldest(event1, event2)
 */
var oldest = function oldest(a, b) {
  return a.at === b.at ? 0 : a.at < b.at ? -1 : 1;
};

/**
 * Have playbackOptions changed since last check?
 *
 * @param {Timeline} timeline
 *
 * @return {boolean}
 *
 * @example
 * playbackOptionsChanged(timeline)
 */
var playbackOptionsChanged = function playbackOptionsChanged(timeline) {
  return JSON.stringify(timeline.playbackOptions) !== JSON.stringify(timeline.event.previousPlaybackOptions);
};

/**
 * Timestamps at which a Timeline was at a Position.
 *
 * @param {Object} opts
 * @param {boolean} opts.alternate
 * @param {number} opts.duration
 * @param {number} initialIterations
 * @param {number} iterations
 * @param {number} opts.max - The maximum bound within which to look for timestamps.
 * @param {number} opts.min - The minimum bound within which to look for timestamps.
 * @param {Position} opts.position - The Position in question.
 * @param {boolean} opts.reverse
 * @param {number} opts.started
 *
 * @returns {number[]}
 *
 * @example
 * positionTimestamps(opts)
 */
var positionTimestamps = function positionTimestamps(_ref4) {
  var alternate = _ref4.alternate,
      duration = _ref4.duration,
      initialIterations = _ref4.initialIterations,
      iterations = _ref4.iterations,
      max = _ref4.max,
      min = _ref4.min,
      position = _ref4.position,
      reverse = _ref4.reverse,
      started = _ref4.started;

  var startedPosition = (0, _timeline.position)(initialIterations, reverse);
  var finishedTimestamp = started + duration * iterations;

  var timestamps = function timestamps(timestamp) {
    if (timestamp <= max) {
      var timestampReverse = (0, _timeline.currentReverse)({
        alternate: alternate,
        initialIterations: initialIterations,
        iterations: iterations,
        reverse: reverse
      }, (0, _timeline.iterationsComplete)({ duration: duration, iterations: iterations, started: started }, timestamp));

      var positionAtEnd = position === 0 || position === 1;
      var timelineFinished = timestamp === finishedTimestamp;
      var finishedAtPosition = position === 0 && timestampReverse || position === 1 && !timestampReverse;

      if (timestamp <= finishedTimestamp && (!positionAtEnd || !timelineFinished || finishedAtPosition)) {
        var _t = timestamp >= min ? [timestamp] : [];

        return _t.concat(timestamps(timestamp + timeToSamePosition({
          alternate: alternate,
          duration: duration,
          position: position,
          reverse: timestampReverse
        })));
      }
    }

    return [];
  };

  return timestamps(started + timeToPosition({
    alternate: alternate,
    duration: duration,
    from: startedPosition,
    reverse: reverse,
    to: position
  }));
};

/**
 * The number of milliseconds between two Positions during Timeline playback.
 *
 * @param {Object} opts
 * @param {boolean} opts.alternate
 * @param {number} opts.duration
 * @param {Position} opts.from - The from Position.
 * @param {boolean} opts.reverse - Is Timeline in reverse at the from Position?
 * @param {Position} opts.to - The to Position.
 *
 * @returns {number}
 *
 * @example
 * timeToPosition(opts)
 */
var timeToPosition = function timeToPosition(_ref5) {
  var alternate = _ref5.alternate,
      duration = _ref5.duration,
      from = _ref5.from,
      reverse = _ref5.reverse,
      to = _ref5.to;
  return duration * (alternate ? reverse ? from < to ? to + from : from - to : from > to ? 2 - (to + from) : to - from : reverse ? from === 1 && to === 0 ? 1 : (1 - to + from) % 1 : from === 0 && to === 1 ? 1 : (1 - from + to) % 1);
};

/**
 * The number of milliseconds between the same Position during Timeline playback.
 *
 * @param {Object} opts
 * @param {boolean} opts.alternate
 * @param {number} opts.duration
 * @param {Position} opts.position
 * @param {boolean} opts.reverse - Is Timeline in reverse at the Position?
 *
 * @returns {number}
 *
 * @example
 * timeToSamePosition(opts)
 */
var timeToSamePosition = function timeToSamePosition(_ref6) {
  var alternate = _ref6.alternate,
      duration = _ref6.duration,
      position = _ref6.position,
      reverse = _ref6.reverse;
  return duration * (alternate ? reverse ? (position === 0 ? 1 : position) * 2 : 2 - (position === 1 ? 0 : position) * 2 : 1);
};

/**
 * Creates a subscribe function.
 * The created function adds an EventSubscription to the subscriptions
 * property of an EventObject.
 *
 * @param {Timeline} timeline
 *
 * @returns {function}
 *
 * @example
 * subscribe(timeline)('timeline.start', () => console.log('timeline.start'))
 */
var subscribe = function subscribe(timeline) {
  return function (name, callback) {
    if (validEventName(name)) {
      if (process.env.NODE_ENV !== 'production' && typeof callback !== 'function') {
        throw new TypeError('The subscribe functions second argument must be of type function');
      }

      var token = ++t;

      timeline.event.subscriptions.push({ name: name, callback: callback, token: token });

      return token;
    }
  };
};

/**
 * Is an event name valid?
 *
 * @param {string} name
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * validEventName('timeline.start')
 */
var validEventName = function validEventName(name) {
  if (process.env.NODE_ENV !== 'production') {
    if (typeof name !== 'string') {
      throw new TypeError('The subscribe functions first argument must be of type string');
    }

    if (acceptedEventNames.indexOf(name) === -1) {
      throw new TypeError('The subscribe functions first argument was not a valid event name');
    }
  }

  return true;
};

/**
 * Creates an unsubscribe function.
 * Created function removes an EventSubscription from the subscriptions
 * property of an EventObject, given the Event token.
 *
 * @param {Timeline} timeline
 *
 * @returns {function}
 *
 * @example
 * unsubscribe(timeline)(token)
 */
var unsubscribe = function unsubscribe(timeline) {
  return function (token) {
    var subscriptions = timeline.event.subscriptions;

    var matchIndex = void 0;

    for (var i = 0, l = subscriptions.length; i < l; i++) {
      if (subscriptions[i].token === token) {
        matchIndex = i;
      }
    }

    if (typeof matchIndex !== 'undefined') {
      timeline.event.subscriptions.splice(matchIndex, 1);
      return true;
    }

    return false;
  };
};

exports.activeEventNames = activeEventNames;
exports.event = event;
exports.eventQueue = eventQueue;
exports.oldest = oldest;
exports.playbackOptionsChanged = playbackOptionsChanged;
exports.positionTimestamps = positionTimestamps;
exports.subscribe = subscribe;
exports.timeToPosition = timeToPosition;
exports.timeToSamePosition = timeToSamePosition;
exports.unsubscribe = unsubscribe;
exports.validEventName = validEventName;
exports.default = events;
}).call(this,require('_process'))
},{"./timeline":43,"_process":18}],36:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tween = exports.splitLines = exports.pointStructure = exports.joinLines = exports.frameShapeFromPlainShapeObject = exports.curveStructure = exports.commonPointStructure = exports.commonCurveStructure = exports.applyPointStructure = exports.applyCurveStructure = exports.addToPointStructure = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* globals __DEV__ */

var _points = require('points');

var _clone = require('./clone');

var _clone2 = _interopRequireDefault(_clone);

var _middleware = require('./middleware');

var _svgPoints = require('svg-points');

var _timeline = require('./timeline');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

/**
 * Shape data as specified by the
 * {@link https://github.com/colinmeinke/points Points spec}.
 *
 * @typedef {Object[]} Points
 */

/**
 * The data required to render a shape.
 *
 * @typedef {Object} FrameShape
 *
 * @property {Points} points
 * @property {Object} attributes
 * @property {FrameShape[]} childFrameShapes
 */

/**
 * A FrameShape array.
 *
 * @typedef {FrameShape[]} Frame
 */

/**
 * A number between 0 and 1 (inclusive).
 *
 * @typedef {number} Position
 */

/**
 * The structure of FrameShape Points.
 * An array represents a shape. A number represents a line.
 * An array that has nested arrays represents a group of shapes.
 *
 * @typedef {(number|number[])[]} PointStructure
 */

/**
 * The curve structure of FrameShape Points.
 * A boolean represents a point, and designates if the point is a curve.
 *
 * @typedef {(boolean|boolean[])[]} CurveStructure
 */

/**
 * Converts FrameShape Points to curves based on a CurveStructure.
 *
 * @param {FrameShape} frameShape
 * @param {CurveStructure} structure
 *
 * @returns {FrameShape}
 *
 * @example
 * applyCurveStructure(frameShape, stucture)
 */
var applyCurveStructure = function applyCurveStructure(frameShape, structure) {
  var points = frameShape.points;
  var childFrameShapes = frameShape.childFrameShapes;

  if (childFrameShapes) {
    var nextChildFrameShapes = [];

    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      nextChildFrameShapes.push(applyCurveStructure(childFrameShapes[i], structure[i]));
    }

    frameShape.childFrameShapes = nextChildFrameShapes;
  } else {
    var curves = false;

    for (var _i2 = 0, _l2 = structure.length; _i2 < _l2; _i2++) {
      if (structure[_i2]) {
        curves = true;
        break;
      }
    }

    if (curves) {
      var nextPoints = [];
      var cubifiedPoints = (0, _points.cubify)(points);

      for (var _i3 = 0, _l3 = cubifiedPoints.length; _i3 < _l3; _i3++) {
        var point = cubifiedPoints[_i3];

        if (structure[_i3] && !point.curve) {
          nextPoints.push(_extends({}, point, {
            curve: {
              type: 'cubic',
              x1: points[_i3 - 1].x,
              y1: points[_i3 - 1].y,
              x2: points[_i3].x,
              y2: points[_i3].y
            }
          }));
        } else {
          nextPoints.push(point);
        }
      }

      frameShape.points = nextPoints;
    }
  }

  return frameShape;
};

/**
 * Restructures a FrameShape's Points based on a PointStructure.
 *
 * @param {FrameShape} frameShape
 * @param {PointStructure} structure
 *
 * @returns {FrameShape}
 *
 * @example
 * applyPointStructure(frameShape, stucture)
 */
var applyPointStructure = function applyPointStructure(frameShape, structure) {
  if (Array.isArray(structure[0])) {
    if (!frameShape.childFrameShapes) {
      frameShape.childFrameShapes = [(0, _clone2.default)(frameShape)];
      delete frameShape.points;
    }

    if (frameShape.childFrameShapes.length !== structure.length) {
      for (var i = 0, l = structure.length; i < l; i++) {
        if (i >= frameShape.childFrameShapes.length) {
          var previous = frameShape.childFrameShapes[i - 1].points;

          frameShape.childFrameShapes.push({
            attributes: (0, _clone2.default)(frameShape.attributes),
            points: [_extends({}, (0, _clone2.default)(previous[previous.length - 1]), { moveTo: true }), (0, _clone2.default)(previous[previous.length - 1])]
          });
        }
      }
    }

    var nextChildFrameShapes = [];

    for (var _i4 = 0, _l4 = frameShape.childFrameShapes.length; _i4 < _l4; _i4++) {
      nextChildFrameShapes.push(applyPointStructure(frameShape.childFrameShapes[_i4], structure[_i4]));
    }

    frameShape.childFrameShapes = nextChildFrameShapes;
  } else {
    var lines = splitLines(frameShape.points);

    for (var _i5 = 0, _l5 = structure.length; _i5 < _l5; _i5++) {
      var desiredPoints = structure[_i5];

      if (!lines[_i5]) {
        var previousLine = lines[_i5 - 1];

        lines[_i5] = [_extends({}, (0, _clone2.default)(previousLine[previousLine.length - 1]), { moveTo: true }), (0, _clone2.default)(previousLine[previousLine.length - 1])];
      }

      if (desiredPoints > lines[_i5].length) {
        lines[_i5] = (0, _points.add)(lines[_i5], desiredPoints);
      }
    }

    frameShape.points = joinLines(lines);
  }

  return frameShape;
};

/**
 * Add a value to a PointStucture at a defined position.
 *
 * @param {PointStructure} structure
 * @param {(number|number[])} value - Value to add to PointStructure.
 * @param {number} i - Position to add value at.
 *
 * @example
 * addToPointStructure([], 9, 0)
 */
var addToPointStructure = function addToPointStructure(structure, value, i) {
  if (Array.isArray(value)) {
    if (!Array.isArray(structure[i])) {
      structure[i] = [structure[i]];
    }

    for (var _i = 0, l = value.length; _i < l; _i++) {
      structure[i] = addToPointStructure(structure[i], value[_i], _i);
    }
  } else {
    if (Array.isArray(structure[i])) {
      addToPointStructure(structure[i], value, 0);
    } else {
      structure[i] = Math.max(structure[i] || 0, value);
    }
  }

  return structure;
};

/**
 * Creates a common CurveStructure from an array of CurveStructures.
 *
 * @param {CurveStructure[]} structures
 *
 * @returns {CurveStructure}
 *
 * @example
 * commonCurveStructure(structures)
 */
var commonCurveStructure = function commonCurveStructure(structures) {
  var structure = structures[0];

  for (var i = 1, l = structures.length; i < l; i++) {
    var s = structures[i];
    var c = [];

    for (var _i = 0, _l = structure.length; _i < _l; _i++) {
      var x = structure[_i];

      if (Array.isArray(x)) {
        c.push(commonCurveStructure([x, s[_i]]));
      } else {
        c.push(x || s[_i]);
      }
    }

    structure = c;
  }

  return structure;
};

/**
 * Creates a common PointStructure from an array of PointStructures.
 *
 * @param {PointStructure[]} structures
 *
 * @returns {PointStructure}
 *
 * @example
 * commonPointStructure(structures)
 */
var commonPointStructure = function commonPointStructure(structures) {
  var structure = [];

  for (var i = 0, l = structures.length; i < l; i++) {
    var s = structures[i];

    for (var _i = 0, _l = s.length; _i < _l; _i++) {
      structure = addToPointStructure(structure, s[_i], _i);
    }
  }

  return structure;
};

/**
 * The current Frame of a Timeline.
 *
 * @param {Timeline} timeline
 * @param {number} [at]
 *
 * @returns {Frame}
 *
 * @example
 * frame(timeline)
 */
var frame = function frame(timeline, at) {
  if (process.env.NODE_ENV !== 'production' && ((typeof timeline === 'undefined' ? 'undefined' : _typeof(timeline)) !== 'object' || !timeline.timelineShapes || !timeline.playbackOptions)) {
    throw new TypeError('The frame function\'s first argument must be a Timeline');
  }

  if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof at !== 'number') {
    throw new TypeError('The frame function\'s second argument must be of type number');
  }

  (0, _timeline.updateState)(timeline, typeof at !== 'undefined' ? at : Date.now());

  var frameShapes = [];
  var timelineShapes = timeline.timelineShapes;

  for (var i = 0, l = timelineShapes.length; i < l; i++) {
    var timelineShape = timelineShapes[i];
    var shape = timelineShape.shape;
    var keyframes = shape.keyframes;
    var timelinePosition = timelineShape.timelinePosition;
    var start = timelinePosition.start;
    var finish = timelinePosition.finish;
    var position = timeline.state.position;

    if (position <= start) {
      frameShapes.push((0, _middleware.output)(keyframes[0].frameShape, timeline.middleware));
    } else if (position >= finish) {
      frameShapes.push((0, _middleware.output)(keyframes[keyframes.length - 1].frameShape, timeline.middleware));
    } else {
      var shapePosition = (position - start) / (finish - start);
      frameShapes.push(frameShapeFromShape(shape, shapePosition, timeline.middleware));
    }
  }

  return frameShapes;
};

/**
 * Creates a FrameShape from a PlainShapeObject.
 *
 * @param {PlainShapeObject} plainShapeObject
 *
 * @returns {FrameShape}
 *
 * @example
 * frameShapeFromPlainShapeObject(circle)
 */
var frameShapeFromPlainShapeObject = function frameShapeFromPlainShapeObject(_ref) {
  var childPlainShapeObjects = _ref.shapes,
      plainShapeObject = _objectWithoutProperties(_ref, ['shapes']);

  var type = plainShapeObject.type,
      height = plainShapeObject.height,
      width = plainShapeObject.width,
      x = plainShapeObject.x,
      y = plainShapeObject.y,
      cx = plainShapeObject.cx,
      cy = plainShapeObject.cy,
      r = plainShapeObject.r,
      rx = plainShapeObject.rx,
      ry = plainShapeObject.ry,
      x1 = plainShapeObject.x1,
      x2 = plainShapeObject.x2,
      y1 = plainShapeObject.y1,
      y2 = plainShapeObject.y2,
      d = plainShapeObject.d,
      points = plainShapeObject.points,
      shapes = plainShapeObject.shapes,
      attributes = _objectWithoutProperties(plainShapeObject, ['type', 'height', 'width', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'd', 'points', 'shapes']);

  if (plainShapeObject.type === 'g' && childPlainShapeObjects) {
    var childFrameShapes = [];

    for (var i = 0, l = childPlainShapeObjects.length; i < l; i++) {
      childFrameShapes.push(frameShapeFromPlainShapeObject(childPlainShapeObjects[i]));
    }

    return { attributes: attributes, childFrameShapes: childFrameShapes };
  }

  return {
    attributes: attributes,
    points: (0, _svgPoints.toPoints)(plainShapeObject)
  };
};

/**
 * Creates a FrameShape from a Shape given the Position.
 *
 * @param {Shape} shape
 * @param {Position} position
 * @param {Middleware[]} middleware
 *
 * @returns {FrameShape}
 *
 * @example
 * frameShapeFromShape(shape, 0.75, [])
 */
var frameShapeFromShape = function frameShapeFromShape(shape, position, middleware) {
  var keyframes = shape.keyframes;


  var fromIndex = 0;

  for (var i = 0, l = keyframes.length; i < l; i++) {
    if (position > keyframes[i].position) {
      fromIndex = i;
    }
  }

  var toIndex = fromIndex + 1;

  var from = keyframes[fromIndex];
  var to = keyframes[toIndex];
  var keyframePosition = (position - from.position) / (to.position - from.position);
  var forces = to.tween.forces;

  var frameShape = tween(from.frameShape, to.frameShape, to.tween.easing, keyframePosition);

  for (var _i6 = 0, _l6 = forces.length; _i6 < _l6; _i6++) {
    frameShape = forces[_i6](frameShape, keyframePosition);
  }

  return (0, _middleware.output)(frameShape, middleware);
};

/**
 * Joins an array of Points into Points.
 *
 * @param {Points[]} lines
 *
 * @returns {Points}
 *
 * @example
 * joinLines([ shape1, shape2 ])
 */
var joinLines = function joinLines(lines) {
  var _ref2;

  return (_ref2 = []).concat.apply(_ref2, _toConsumableArray(lines));
};

/**
 * Creates a CurveStructure from a FrameShape.
 *
 * @param {FrameShape} frameShape
 *
 * @returns {CurveStructure}
 *
 * @example
 * curveStructure(frameShape)
 */
var curveStructure = function curveStructure(_ref3) {
  var points = _ref3.points,
      childFrameShapes = _ref3.childFrameShapes;

  var s = [];

  if (childFrameShapes) {
    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      s.push(curveStructure(childFrameShapes[i]));
    }
  } else {
    for (var _i7 = 0, _l7 = points.length; _i7 < _l7; _i7++) {
      s.push(typeof points[_i7].curve !== 'undefined');
    }
  }

  return s;
};

/**
 * Creates a PointStructure from a FrameShape.
 *
 * @param {FrameShape} frameShape
 *
 * @returns {PointStructure}
 *
 * @example
 * pointStructure(frameShape)
 */
var pointStructure = function pointStructure(_ref4) {
  var points = _ref4.points,
      childFrameShapes = _ref4.childFrameShapes;

  if (childFrameShapes) {
    var s = [];

    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      s.push(pointStructure(childFrameShapes[i]));
    }

    return s;
  }

  var structure = [];

  for (var _i8 = 0, _l8 = points.length; _i8 < _l8; _i8++) {
    if (points[_i8].moveTo) {
      structure.push(1);
    } else {
      structure[structure.length - 1]++;
    }
  }

  return structure;
};

/**
 * Splits Points at moveTo commands.
 *
 * @param {Points} points
 *
 * @return {Points[]}
 *
 * @example
 * splitLines(points)
 */
var splitLines = function splitLines(points) {
  var lines = [];

  for (var i = 0, l = points.length; i < l; i++) {
    var point = points[i];

    if (point.moveTo) {
      lines.push([point]);
    } else {
      lines[lines.length - 1].push(point);
    }
  }

  return lines;
};

/**
 * Tween between any two values.
 *
 * @param {*} from
 * @param {*} to - An identicle structure to the from param
 * @param {function} easing - The easing function to apply
 * @param {Position} position
 *
 * @returns {*}
 *
 * @example
 * tween(0, 100, easeOut, 0.75)
 */
var tween = function tween(from, to, easing, position) {
  if (typeof from === 'number') {
    if (process.env.NODE_ENV !== 'production' && typeof to !== 'number') {
      throw new TypeError('The tween function\'s from and to arguments must be of an identicle structure');
    }

    if (from === to) {
      return from;
    }

    return easing(position, from, to, 1);
  } else if (Array.isArray(from)) {
    if (process.env.NODE_ENV !== 'production' && !Array.isArray(to)) {
      throw new TypeError('The tween function\'s from and to arguments must be of an identicle structure');
    }

    var arr = [];

    for (var i = 0, l = from.length; i < l; i++) {
      arr.push(tween(from[i], to[i], easing, position));
    }

    return arr;
  } else if (from !== null && (typeof from === 'undefined' ? 'undefined' : _typeof(from)) === 'object') {
    if (process.env.NODE_ENV !== 'production' && to !== null && (typeof to === 'undefined' ? 'undefined' : _typeof(to)) !== 'object') {
      throw new TypeError('The tween function\'s from and to arguments must be of an identicle structure');
    }

    var obj = {};

    for (var k in from) {
      obj[k] = tween(from[k], to[k], easing, position);
    }

    return obj;
  }

  return from;
};

exports.addToPointStructure = addToPointStructure;
exports.applyCurveStructure = applyCurveStructure;
exports.applyPointStructure = applyPointStructure;
exports.commonCurveStructure = commonCurveStructure;
exports.commonPointStructure = commonPointStructure;
exports.curveStructure = curveStructure;
exports.frameShapeFromPlainShapeObject = frameShapeFromPlainShapeObject;
exports.joinLines = joinLines;
exports.pointStructure = pointStructure;
exports.splitLines = splitLines;
exports.tween = tween;
exports.default = frame;
}).call(this,require('_process'))
},{"./clone":31,"./middleware":39,"./timeline":43,"_process":18,"points":9,"svg-points":19}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unitMiddleware = exports.timeline = exports.shape = exports.play = exports.plainShapeObject = exports.pause = exports.motionPath = exports.frame = exports.events = exports.colorMiddleware = undefined;

var _colorMiddleware = require('./color-middleware');

var _colorMiddleware2 = _interopRequireDefault(_colorMiddleware);

var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _frame = require('./frame');

var _frame2 = _interopRequireDefault(_frame);

var _motionPathForce = require('./motion-path-force');

var _motionPathForce2 = _interopRequireDefault(_motionPathForce);

var _plainShapeObject = require('./plain-shape-object');

var _plainShapeObject2 = _interopRequireDefault(_plainShapeObject);

var _shape = require('./shape');

var _shape2 = _interopRequireDefault(_shape);

var _timeline = require('./timeline');

var _timeline2 = _interopRequireDefault(_timeline);

var _unitMiddleware = require('./unit-middleware');

var _unitMiddleware2 = _interopRequireDefault(_unitMiddleware);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.colorMiddleware = _colorMiddleware2.default;
exports.events = _events2.default;
exports.frame = _frame2.default;
exports.motionPath = _motionPathForce2.default;
exports.pause = _timeline.pause;
exports.plainShapeObject = _plainShapeObject2.default;
exports.play = _timeline.play;
exports.shape = _shape2.default;
exports.timeline = _timeline2.default;
exports.unitMiddleware = _unitMiddleware2.default;
},{"./color-middleware":32,"./events":35,"./frame":36,"./motion-path-force":40,"./plain-shape-object":41,"./shape":42,"./timeline":43,"./unit-middleware":45}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _frame = require('./frame');

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _easingFunction = require('./easing-function');

var _easingFunction2 = _interopRequireDefault(_easingFunction);

var _transform = require('./transform');

var _transform2 = _interopRequireDefault(_transform);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

/**
 * The data required to render and tween to a shape.
 *
 * @typedef {Object} Keyframe
 *
 * @property {(string|number)} name - A unique reference.
 * @property {Position} position
 * @property {FrameShape} frameShape
 * @property {Object} tween
 */

/**
 * A Keyframe array and their total duration.
 *
 * @typedef {Object} KeyframesAndDuration
 *
 * @property {Keyframe[]} keyframes
 * @property {number} duration
 */

/**
 * Converts Keyframes so each has the same
 * PointStructure and CurveStructure.
 *
 * @param {Keyframe[]} keyframes
 *
 * @returns {Keyframe[]}
 *
 * @example
 * equaliseKeyframes(keyframes)
 */
var equaliseKeyframes = function equaliseKeyframes(keyframes) {
  var pointStrucs = [];
  var k = [];
  var curveStrucs = [];
  var result = [];

  for (var i = 0, l = keyframes.length; i < l; i++) {
    pointStrucs.push((0, _frame.pointStructure)(keyframes[i].frameShape));
  }

  var pointStruc = (0, _frame.commonPointStructure)(pointStrucs);

  for (var _i = 0, _l = keyframes.length; _i < _l; _i++) {
    var keyframe = keyframes[_i];
    keyframe.frameShape = (0, _frame.applyPointStructure)(keyframe.frameShape, pointStruc);
    k.push(keyframe);
  }

  for (var _i2 = 0, _l2 = k.length; _i2 < _l2; _i2++) {
    curveStrucs.push((0, _frame.curveStructure)(k[_i2].frameShape));
  }

  var curveStruc = (0, _frame.commonCurveStructure)(curveStrucs);

  for (var _i3 = 0, _l3 = k.length; _i3 < _l3; _i3++) {
    var _keyframe = k[_i3];
    _keyframe.frameShape = (0, _frame.applyCurveStructure)(_keyframe.frameShape, curveStruc);
    result.push(_keyframe);
  }

  return result;
};

/**
 * Creates a Keyframe array from a PlainShapeObject array.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @returns {KeyframesAndDuration}
 *
 * @example
 * keyframes([ circle, square ])
 */
var keyframesAndDuration = function keyframesAndDuration(plainShapeObjects) {
  var keyframes = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var _plainShapeObjects$i = plainShapeObjects[i],
        delay = _plainShapeObjects$i.delay,
        duration = _plainShapeObjects$i.duration,
        easing = _plainShapeObjects$i.easing,
        _plainShapeObjects$i$ = _plainShapeObjects$i.forces,
        forces = _plainShapeObjects$i$ === undefined ? [] : _plainShapeObjects$i$,
        name = _plainShapeObjects$i.name,
        _plainShapeObjects$i$2 = _plainShapeObjects$i.transforms,
        transforms = _plainShapeObjects$i$2 === undefined ? [] : _plainShapeObjects$i$2,
        plainShapeObject = _objectWithoutProperties(_plainShapeObjects$i, ['delay', 'duration', 'easing', 'forces', 'name', 'transforms']);

    var frameShape = (0, _frame.frameShapeFromPlainShapeObject)(plainShapeObject);

    var keyframe = {
      name: typeof name !== 'undefined' ? name : i,
      frameShape: (0, _transform2.default)(frameShape, transforms)
    };

    if (i > 0) {
      keyframe.tween = {
        duration: typeof duration !== 'undefined' ? duration : _config2.default.defaults.keyframe.duration,
        easing: (0, _easingFunction2.default)(easing || _config2.default.defaults.keyframe.easing),
        forces: forces
      };

      if (delay) {
        var previousKeyframe = keyframes[keyframes.length - 1];

        var delayKeyframe = _extends({}, previousKeyframe, {
          name: previousKeyframe.name + '.delay',
          tween: { duration: delay }
        });

        keyframes.push(delayKeyframe);
      }
    }

    keyframes.push(keyframe);
  }

  var equalisedKeyframes = equaliseKeyframes(keyframes);
  var totalDuration = keyframesTotalDuration(keyframes);

  return {
    duration: totalDuration,
    keyframes: positionKeyframes(equalisedKeyframes, totalDuration)
  };
};

/**
 * Adds the position prop to each Keyframe in a Keyframe array.
 *
 * @param {Keyframe[]} keyframes
 * @param {number} totalDuration
 *
 * @returns {Keyframe[]}
 *
 * @example
 * positionKeyframes(keyframes)
 */
var positionKeyframes = function positionKeyframes(keyframes, totalDuration) {
  var k = [];

  var durationAtKeyframe = 0;

  for (var i = 0, l = keyframes.length; i < l; i++) {
    var keyframe = keyframes[i];
    var _keyframe$tween = keyframe.tween;
    _keyframe$tween = _keyframe$tween === undefined ? {} : _keyframe$tween;
    var _keyframe$tween$durat = _keyframe$tween.duration,
        duration = _keyframe$tween$durat === undefined ? 0 : _keyframe$tween$durat;


    durationAtKeyframe += duration;

    k.push(_extends({}, keyframe, {
      position: durationAtKeyframe === 0 ? 0 : durationAtKeyframe / totalDuration
    }));
  }

  return k;
};

/**
 * Adds the tween duration of a Keyframe array.
 *
 * @param {Keyframe[]} k
 *
 * @returns {number}
 *
 * @example
 * keyframesTotalDuration(keyframes)
 */
var keyframesTotalDuration = function keyframesTotalDuration(k) {
  var currentDuration = 0;

  for (var i = 0, l = k.length; i < l; i++) {
    var _k$i$tween = k[i].tween;
    _k$i$tween = _k$i$tween === undefined ? {} : _k$i$tween;
    var _k$i$tween$duration = _k$i$tween.duration,
        duration = _k$i$tween$duration === undefined ? 0 : _k$i$tween$duration;

    currentDuration += duration;
  }

  return currentDuration;
};

exports.default = keyframesAndDuration;
},{"./config":33,"./easing-function":34,"./frame":36,"./transform":44}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * A group of functions to transform/untransform a value.
 *
 * @typedef {Object} Middleware
 *
 * @property {string} name - The name of the middleware.
 * @property {function} input - Transform.
 * @property {function} output - Untransform.
 */

/**
 * Run every part of a value through a function.
 *
 * @param {*} value
 * @param {function} func
 *
 * @returns {*}
 *
 * @example
 * apply(2, n => n * 2)
 */
var apply = function apply(value, func) {
  var v = func(value);

  if ((typeof v === 'undefined' ? 'undefined' : _typeof(v)) !== 'object') {
    return v;
  } else if (Array.isArray(v)) {
    var arr = [];

    for (var i = 0, l = v.length; i < l; i++) {
      arr.push(apply(v[i], func));
    }

    return arr;
  } else if (v !== null) {
    var obj = {};

    for (var k in v) {
      obj[k] = apply(v[k], func);
    }

    return obj;
  }

  return v;
};

/**
 * Runs each Middleware input function in turn on a value.
 *
 * @param {*} value
 * @param {Middleware[]} middleware
 *
 * @returns {*}
 *
 * @example
 * input({ foo: 1, bar: [ 2, 3 ] }, middleware)
 */
var input = function input(value, middleware) {
  var v = value;

  for (var i = 0, l = middleware.length; i < l; i++) {
    v = apply(v, middleware[i].input);
  }

  return v;
};

/**
 * Runs each Middleware output function in reverse on a value.
 *
 * @param {*} value
 * @param {Middleware[]} middleware
 *
 * @returns {*}
 *
 * @example
 * output({ foo: 1, bar: [ 2, 3 ] }, middleware)
 */
var output = function output(value, middleware) {
  var v = value;

  for (var i = middleware.length - 1; i >= 0; i--) {
    v = apply(v, middleware[i].output);
  }

  return v;
};

exports.input = input;
exports.output = output;
},{}],40:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _easingFunction = require('./easing-function');

var _easingFunction2 = _interopRequireDefault(_easingFunction);

var _points = require('points');

var _svgPoints = require('svg-points');

var _transform = require('./transform');

var _plainShapeObject = require('./plain-shape-object');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /* globals __DEV__ */

/**
 * Applies a motion path's offset and rotation to a FrameShape.
 *
 * @param {Object} opts
 * @param {number} opts.angle - The angle to rotate the FrameShape
 * @param {FrameShape} opts.frameShape
 * @param {number} opts.x - The value to offset the FrameShape on the x axis
 * @param {number} opts.x - The value to offset the FrameShape on the x axis
 *
 * @returns {FrameShape}
 *
 * @example
 * applyMotionPath({ angle, frameShape, x, y })
 */
var applyMotionPath = function applyMotionPath(_ref) {
  var angle = _ref.angle,
      frameShape = _ref.frameShape,
      x = _ref.x,
      y = _ref.y;

  var _flattenPoints = (0, _transform.flattenPoints)(frameShape),
      points = _flattenPoints.points,
      pointsMap = _flattenPoints.pointsMap;

  var offsetPoints = (0, _points.offset)(points, x, y);
  var rotatedPoints = angle ? (0, _points.rotate)(offsetPoints, angle) : offsetPoints;

  return (0, _transform.pointsToFrameShape)({
    frameShape: frameShape,
    points: rotatedPoints,
    pointsMap: pointsMap
  });
};

/**
 * Creates a motion path force function from a PlainShapeObject.
 *
 * @param {PlainShapeObject} plainShapeObject
 *
 * @returns {function}
 *
 * @example
 * motionPath({ ...plainShapeObject, accuracy: 0.1, rotate: true })
 */
var motionPath = function motionPath(plainShapeObject) {
  if (process.env.NODE_ENV !== 'production' && (0, _plainShapeObject.valid)(plainShapeObject)) {
    if (plainShapeObject.type === 'g') {
      throw new TypeError('A motion path cannot be a group shape');
    }
  }

  var _plainShapeObject$acc = plainShapeObject.accuracy,
      accuracy = _plainShapeObject$acc === undefined ? 1 : _plainShapeObject$acc,
      _plainShapeObject$eas = plainShapeObject.easing,
      motionPathEasing = _plainShapeObject$eas === undefined ? _config2.default.defaults.motionPath.easing : _plainShapeObject$eas,
      _plainShapeObject$rot = plainShapeObject.rotate,
      r = _plainShapeObject$rot === undefined ? false : _plainShapeObject$rot,
      _plainShapeObject$tra = plainShapeObject.transforms,
      transforms = _plainShapeObject$tra === undefined ? [] : _plainShapeObject$tra,
      coreProps = _objectWithoutProperties(plainShapeObject, ['accuracy', 'easing', 'rotate', 'transforms']);

  var motionPathPoints = (0, _transform.transformPoints)((0, _svgPoints.toPoints)(coreProps), transforms);
  var easing = (0, _easingFunction2.default)(motionPathEasing);

  return function (frameShape, framePosition) {
    var motionPathPosition = easing(framePosition, 0, 1, 1);

    var _position = (0, _points.position)(motionPathPoints, motionPathPosition, accuracy),
        angle = _position.angle,
        x = _position.x,
        y = _position.y;

    if (!x && !y) {
      return frameShape;
    }

    return applyMotionPath({
      angle: typeof r === 'number' ? (angle + r) % 360 : r === true ? angle : 0,
      frameShape: frameShape,
      x: x,
      y: y
    });
  };
};

exports.default = motionPath;
}).call(this,require('_process'))
},{"./config":33,"./easing-function":34,"./plain-shape-object":41,"./transform":44,"_process":18,"points":9,"svg-points":19}],41:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.valid = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /* globals __DEV__ */

var _frame = require('./frame');

var _frame2 = _interopRequireDefault(_frame);

var _svgPoints = require('svg-points');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

/**
 * An SVG shape as defined by https://github.com/colinmeinke/svg-points.
 *
 * @typedef {Object} PlainShapeObjectCoreProps
 */

/**
 * Additional options specifically for a motion path.
 *
 * @typedef {Object} PlainShapeObjectMotionPathProps
 *
 * @property {number} accuracy - .
 * @property {boolean|number} rotate - .
 */

/**
 * The tween options to use when transitioning from a previous shape.
 *
 * @typedef {Object} PlainShapeObjectTweenProps
 *
 * @property {number} delay - Milliseconds before the tween starts.
 * @property {number} duration - Milliseconds until tween finishes.
 * @property {string|function} easing - The name of an easing function, or an easing function.
 */

/**
 * A static shape.
 *
 * @typedef {Object} PlainShapeObject
 *
 * @extends PlainShapeObjectCoreProps
 * @extends PlainShapeObjectMotionPathProps
 * @extends PlainShapeObjectTweenProps
 * @property {string|number} name
 */

/**
 * Validates PlainShapeObjectCoreProps.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (corePropsValid([ circle ])) {
 *   console.log('circle has valid Plain Shape Object Core Props')
 * }
 */
var corePropsValid = function corePropsValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var result = (0, _svgPoints.valid)(plainShapeObjects[i]);

    if (!result.valid) {
      var errs = result.errors;

      for (var _i = 0, _l = errs.length; _i < _l; _i++) {
        errors.push(errs[_i]);
      }
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Joins an array of error messages into one error message.
 *
 * @param {string[]} errors
 *
 * @returns {string}
 *
 * @example
 * errorMsg([
 *   'cx prop is required on a ellipse',
 *   'cy prop must be of type number'
 * ])
 */
var errorMsg = function errorMsg(errors) {
  return 'Plain Shape Object props not valid: ' + errors.join('. ');
};

/**
 * Validates forces prop.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (forcesPropValid([ circle ])) {
 *   console.log('circle has valid forces prop')
 * }
 */
var forcesPropValid = function forcesPropValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var forces = plainShapeObjects[i].forces;

    if (typeof forces !== 'undefined') {
      if (Array.isArray(forces)) {
        for (var _i = 0, _l = forces.length; _i < _l; _i++) {
          if (typeof forces[_i] !== 'function') {
            errors.push('each force item should be of type function');
          }
        }
      } else {
        errors.push('the forces prop must be of type array');
      }
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Validates PlainShapeObjectMotionPathProps.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (motionPathPropsValid([ circle ])) {
 *   console.log('circle has valid motion path props')
 * }
 */
var motionPathPropsValid = function motionPathPropsValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var _plainShapeObject = plainShapeObjects[i];
    var accuracy = _plainShapeObject.accuracy;
    var rotate = _plainShapeObject.rotate;

    if (typeof accuracy !== 'undefined' && !(typeof accuracy === 'number' && accuracy > 0)) {
      errors.push('the accuracy prop must be a number greater than 0');
    }

    if (typeof rotate !== 'undefined' && !(typeof rotate === 'boolean' || typeof rotate === 'number')) {
      errors.push('the rotate prop must be a of type boolean or number');
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Validates name prop.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (namePropValid([ circle ])) {
 *   console.log('circle has a valid name prop')
 * }
 */
var namePropValid = function namePropValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var name = plainShapeObjects[i].name;

    if (typeof name !== 'undefined' && !(typeof name === 'string' || typeof name === 'number')) {
      errors.push('the name prop must be of type string or number');
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Creates a PlainShapeObject from a Shape.
 *
 * @param {Shape} shape
 * @param {number} [at]
 *
 * @returns {PlainShapeObject}
 *
 * @example
 * plainShapeObject(circle)
 */
var plainShapeObject = function plainShapeObject(shape, at) {
  if (process.env.NODE_ENV !== 'production' && ((typeof shape === 'undefined' ? 'undefined' : _typeof(shape)) !== 'object' || !shape.keyframes)) {
    throw new Error('The plainShapeObject function\'s first argument must be a Shape');
  }

  if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof at !== 'number') {
    throw new TypeError('The plainShapeObject function\'s second argument must be of type number');
  }

  var frameShape = typeof shape.timeline === 'undefined' ? shape.keyframes[0].frameShape : (0, _frame2.default)(shape.timeline, at)[shape.timelineIndex];

  return plainShapeObjectFromFrameShape(frameShape);
};

/**
 * Creates a PlainShapeObject from a FrameShape.
 *
 * @param {FrameShape} frameShape
 *
 * @returns {PlainShapeObject}
 *
 * @example
 * plainShapeObjectFromFrameShape(frameShape)
 */
var plainShapeObjectFromFrameShape = function plainShapeObjectFromFrameShape(_ref) {
  var attributes = _ref.attributes,
      points = _ref.points,
      childFrameShapes = _ref.childFrameShapes;

  if (childFrameShapes) {
    var shapes = [];

    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      shapes.push(plainShapeObjectFromFrameShape(childFrameShapes[i]));
    }

    return _extends({}, attributes, {
      type: 'g',
      shapes: shapes
    });
  }

  return _extends({}, attributes, {
    type: 'path',
    d: (0, _svgPoints.toPath)(points)
  });
};

/**
 * Validates transforms prop.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (transformsPropValid([ circle ])) {
 *   console.log('circle has valid transforms prop')
 * }
 */
var transformsPropValid = function transformsPropValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var transforms = plainShapeObjects[i].transforms;

    if (typeof transforms !== 'undefined') {
      if (Array.isArray(transforms)) {
        for (var _i = 0, _l = transforms.length; _i < _l; _i++) {
          var _transforms$i = _toArray(transforms[i]),
              key = _transforms$i[0],
              args = _transforms$i.slice(1);

          switch (key) {
            case 'moveIndex':
            case 'rotate':
              if (args.length === 1) {
                if (typeof args[0] !== 'number') {
                  errors.push('moveIndex transform argument should be of type number');
                }
              } else {
                errors.push('moveIndex transform takes 1 argument');
              }

              break;

            case 'offset':
              if (args.length === 2) {
                if (typeof args[0] !== 'number' || typeof args[1] !== 'number') {
                  errors.push('both offset transform arguments should be of type number');
                }
              } else {
                errors.push('offset transform takes 2 arguments (x and y)');
              }

              break;

            case 'reverse':
              if (args.length > 0) {
                errors.push('reverse transform takes no arguments');
              }

              break;

            case 'scale':
              if (args.length > 0 && args.length < 3) {
                if (typeof args[0] !== 'number') {
                  errors.push('scale transform scaleFactor argument should be of type number');
                }

                if (typeof args[1] !== 'undefined' && typeof args[1] !== 'string') {
                  errors.push('scale transform anchor argument should be of type string');
                }
              } else {
                errors.push('scale transform takes 1 or 2 arguments');
              }

              break;

            default:
              errors.push(key + ' is not a valid transform');
          }
        }
      } else {
        errors.push('the transforms prop must be of type array');
      }
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Validates PlainShapeObjectTweenProps.
 *
 * @param {PlainShapeObject[]} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (tweenPropsValid([ circle, square ])) {
 *   console.log('circle and square have valid tween props')
 * }
 */
var tweenPropsValid = function tweenPropsValid(plainShapeObjects) {
  var errors = [];

  for (var i = 0, l = plainShapeObjects.length; i < l; i++) {
    var _plainShapeObjects$i = plainShapeObjects[i],
        delay = _plainShapeObjects$i.delay,
        duration = _plainShapeObjects$i.duration,
        easing = _plainShapeObjects$i.easing;


    if (typeof delay !== 'undefined' && !(typeof delay === 'number' && delay > 0)) {
      errors.push('the delay prop must be a number greater than 0');
    }

    if (typeof duration !== 'undefined' && !(typeof duration === 'number' && duration >= 0)) {
      errors.push('the duration prop must be a number greater than or equal to 0');
    }

    if (typeof easing !== 'undefined' && !(typeof easing === 'function' || typeof easing === 'string')) {
      errors.push('the easing prop must be a of type function or string');
    }
  }

  if (errors.length) {
    throw new TypeError(errorMsg(errors));
  }

  return true;
};

/**
 * Validates one or more PlainShapeObject.
 *
 * @param {...PlainShapeObject} plainShapeObjects
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * if (valid(circle)) {
 *   console.log('circle is a valid Plain Shape Object')
 * }
 */
var valid = function valid() {
  for (var _len = arguments.length, plainShapeObjects = Array(_len), _key = 0; _key < _len; _key++) {
    plainShapeObjects[_key] = arguments[_key];
  }

  return namePropValid(plainShapeObjects) && corePropsValid(plainShapeObjects) && forcesPropValid(plainShapeObjects) && transformsPropValid(plainShapeObjects) && tweenPropsValid(plainShapeObjects) && motionPathPropsValid(plainShapeObjects);
};

exports.valid = valid;
exports.default = plainShapeObject;
}).call(this,require('_process'))
},{"./frame":36,"_process":18,"svg-points":19}],42:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /* globals __DEV__ */

var _keyframe = require('./keyframe');

var _keyframe2 = _interopRequireDefault(_keyframe);

var _plainShapeObject = require('./plain-shape-object');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * A sequence of static shapes.
 *
 * @typedef {Object} Shape
 *
 * @property {Keyframe[]} keyframes
 */

/**
 * An object containing PlainShapeObjects and shape options.
 *
 * @typedef {Object} SortedShapeProps
 *
 * @property {PlainShapeObject[]} plainShapeObjects
 * @property {Object} options
 * @property {(string|number)} options.name
 */

/**
 * Creates a Shape from one or more PlainShapeObject.
 * Optionally can take an options object as the last argument.
 *
 * @param {(PlainShapeObject|Object)[]} props
 *
 * @returns {Shape}
 *
 * @example
 * shape(circle, square)
 */
var shape = function shape() {
  for (var _len = arguments.length, props = Array(_len), _key = 0; _key < _len; _key++) {
    props[_key] = arguments[_key];
  }

  var _sort = sort(props),
      plainShapeObjects = _sort.plainShapeObjects,
      name = _sort.options.name;

  var _keyframesAndDuration = (0, _keyframe2.default)(plainShapeObjects),
      duration = _keyframesAndDuration.duration,
      keyframes = _keyframesAndDuration.keyframes;

  var s = { duration: duration, keyframes: keyframes };

  if (typeof name !== 'undefined') {
    s.name = name;
  }

  return s;
};

/**
 * Sorts an array of props into a PlainShapeObject array and options.
 *
 * @param {(PlainShapeObject|Object)[]} props
 *
 * @returns {SortedShapeProps}
 *
 * @example
 * sort(props)
 */
var sort = function sort(props) {
  var plainShapeObjects = props.filter(function (prop) {
    if (process.env.NODE_ENV !== 'production' && (typeof prop === 'undefined' ? 'undefined' : _typeof(prop)) !== 'object') {
      throw new TypeError('The shape function must only be passed objects');
    }

    return prop.type;
  });

  var options = props.length > 1 && typeof props[props.length - 1].type === 'undefined' ? props[props.length - 1] : {};

  var sortedProps = { plainShapeObjects: plainShapeObjects, options: options };

  if (validProps(sortedProps)) {
    return sortedProps;
  }
};

/**
 * Validates a PlainShapeObject array and shape options.
 *
 * @param {SortedShapeProps}
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * validProps({ plainShapeObjects, options })
 */
var validProps = function validProps(_ref) {
  var plainShapeObjects = _ref.plainShapeObjects,
      name = _ref.options.name;

  if (process.env.NODE_ENV !== 'production' && plainShapeObjects.length === 0) {
    throw new TypeError('The shape function must be passed at least one Plain Shape Object');
  }

  if (process.env.NODE_ENV !== 'production' && _plainShapeObject.valid.apply(undefined, _toConsumableArray(plainShapeObjects))) {
    if (typeof name !== 'undefined' && typeof name !== 'string' && typeof name !== 'number') {
      throw new TypeError('The name option passed to the shape function must be of type string or number');
    }
  }

  return true;
};

exports.default = shape;
}).call(this,require('_process'))
},{"./keyframe":38,"./plain-shape-object":41,"_process":18}],43:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateState = exports.sameDirection = exports.position = exports.play = exports.pause = exports.iterationsComplete = exports.currentReverse = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); /* globals __DEV__ */

var _clone = require('./clone');

var _clone2 = _interopRequireDefault(_clone);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _middleware = require('./middleware');

var _events = require('./events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The position of an object on a Timeline
 * where 0 is Timeline start and 1 is Timeline finish.
 *
 * @typedef {Object} TimelinePosition
 *
 * @property {Position} start
 * @property {Position} finish
 */

/**
 * A Shape positioned on a Timeline.
 *
 * @typedef {Object} TimelineShape
 *
 * @property {Shape} shape
 * @property {TimelinePosition} timelinePosition
 */

/**
 * The position of an object on a Timeline in milliseconds.
 *
 * @typedef {Object} MsTimelinePosition
 *
 * @property {number} start.
 * @property {number} finish.
 */

/**
 * A Shape positioned on a Timeline (position set in milliseconds).
 *
 * @typedef {Object} MsTimelineShape
 *
 * @property {Shape} shape
 * @property {MsTimelinePosition} timelinePosition
 */

/**
 * A TimelineShape array and their total duration.
 *
 * @typedef {Object} TimelineShapesAndDuration
 *
 * @property {TimelineShape[]} timelineShapes
 * @property {number} duration
 */

/**
 * The options required to calculate the current playback Position.
 *
 * @typedef {Object} PlaybackOptions
 *
 * @property {boolean} alternate - Should the next iteration reverse current direction?
 * @property {number} duration - Milliseconds that each iteration lasts.
 * @property {number} initialIterations - The starting number of iterations.
 * @property {number} iterations - The number of playback interations (additional to initialIterations).
 * @property {boolean} reverse - Should the first iteration start in a reverse direction?
 * @property {number} [started] - The UNIX timestamp of playback start.
 */

/**
 * PlaybackOptions and tween middleware.
 *
 * @typedef {Object} TimelineOptions
 *
 * @extends PlaybackOptions
 * @property {Middleware[]} middleware
 */

/**
 * A Shape and timeline related options.
 *
 * @typedef {Object} ShapeWithOptions
 *
 * @property {(string|number)} [after] - The name of the Shape to queue after (in sequence).
 * @property {(string|number)} [at] - The name of the Shape to queue at (in parallel).
 * @property {(string|number)} name - A unique reference.
 * @property {number} offset - The offset in milliseconds to adjust the queuing of this shape.
 * @property {Shape} shape
 */

/**
 * An object containing Middlware, PlaybackOptions and ShapesWithOptions.
 *
 * @typedef {Object} SortedTimelineProps
 *
 * @property {Middleware[]} middleware
 * @property {PlaybackOptions} playbackOptions
 * @property {ShapeWithOptions[]} shapesWithOptions
 */

/**
 * A sequence of Shapes.
 *
 * @typedef {Object} Timeline
 *
 * @property {Middleware[]} middleware
 * @property {PlaybackOptions} playbackOptions
 * @property {Object} state - Holds the last known state of the timeline.
 * @property {TimelineShape[]} timelineShapes
 */

/**
 * Runs each Middleware input function on every Keyframe's FrameShape.
 *
 * @param {Shape} shape
 * @param {Middleware[]} middleware
 *
 * @example
 * apply(shape, middleware)
 */
var apply = function apply(_ref, middleware) {
  var keyframes = _ref.keyframes;

  for (var i = 0, l = keyframes.length; i < l; i++) {
    var keyframe = keyframes[i];
    keyframe.frameShape = (0, _middleware.input)(keyframe.frameShape, middleware);
  }
};

/**
 * Is playback currently in reverse?
 *
 * @param {PlaybackOptions} playbackOptions
 * @param {number} complete - The number of iterations complete.
 *
 * @example
 * currentReverse(playbackOptions, complete)
 */
var currentReverse = function currentReverse(playbackOptions, complete) {
  var reverse = playbackOptions.reverse;

  if (complete === 0) {
    return reverse;
  }

  var alternate = playbackOptions.alternate;
  var initialIterations = playbackOptions.initialIterations;

  var initialReverse = sameDirection(alternate, initialIterations) ? reverse : !reverse;

  return sameDirection(alternate, initialIterations + complete) ? initialReverse : !initialReverse;
};

/**
 * The number of iterations a Timeline has completed.
 *
 * @param {PlaybackOptions} playbackOptions
 * @param {number} opts.at
 *
 * @returns {number}
 *
 * @example
 * iterationsComplete(playbackOptions, 1000)
 */
var iterationsComplete = function iterationsComplete(playbackOptions, at) {
  var duration = playbackOptions.duration;
  var iterations = playbackOptions.iterations;
  var started = playbackOptions.started;

  if (typeof started === 'undefined' || at <= started) {
    return 0;
  }

  var ms = at - started;
  var maxDuration = duration * iterations;

  if (ms >= maxDuration) {
    return iterations;
  }

  return ms / duration;
};

/**
 * Stops playback of a Timeline.
 *
 * @param {Timeline} timeline
 * @param {PlaybackOptions} playbackOptions
 * @param {number} [at]
 *
 * @example
 * pause(timeline)
 */
var pause = function pause(timeline) {
  var playbackOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var at = arguments[2];

  timeline.playbackOptions = updatePlaybackOptions({ at: at, timeline: timeline, pause: true, playbackOptions: playbackOptions });
  updateState(timeline, at);
};

/**
 * Starts playback of a Timeline.
 *
 * @param {Timeline} timeline
 * @param {PlaybackOptions} playbackOptions
 * @param {number} [at]
 *
 * @example
 * play(timeline, { initialIterations: 0 })
 */
var play = function play(timeline) {
  var playbackOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var at = arguments[2];

  timeline.playbackOptions = updatePlaybackOptions({ at: at, timeline: timeline, playbackOptions: playbackOptions });
  updateState(timeline, at);
};

/**
 * Calculate the Timeline Position.
 *
 * @param {number} totalIterations - initialIterations + iterationsComplete.
 * @param {boolean} reverse - Is the Timeline currently in reverse?
 *
 * @returns {Position}
 *
 * @example
 * position(5.43, true)
 */
var position = function position(totalIterations, reverse) {
  var i = totalIterations >= 1 && totalIterations % 1 === 0 ? 1 : totalIterations % 1;

  return reverse ? 1 - i : i;
};

/**
 * Is the direction same as initial direction?
 *
 * @param {boolean} alternate - Is iteration direction alternating?
 * @param {number} iterations - The number of iterations complete.
 *
 * @return {boolean}
 *
 * @example
 * sameDirection(true, 3.25)
 */
var sameDirection = function sameDirection(alternate, iterations) {
  var x = iterations % 2;
  return !alternate || iterations === 0 || x <= 1 && x % 2 > 0;
};

/**
 * Calculate the start position of a Shape on the Timeline.
 *
 * @param {Object} props
 * @param {(string|number)} [props.after]
 * @param {(string|number)} [props.at]
 * @param {MsTimelineShape[]} props.msTimelineShapes
 * @param {number} props.offset
 * @param {number} props.timelineFinish - The current finish of the timeline.
 *
 * @returns {number}
 *
 * @example
 * shapeStart({ 'foo', msTimelineShapes, 200, 2000 })
 */
var shapeStart = function shapeStart(_ref2) {
  var after = _ref2.after,
      at = _ref2.at,
      msTimelineShapes = _ref2.msTimelineShapes,
      offset = _ref2.offset,
      timelineFinish = _ref2.timelineFinish;

  if (typeof after !== 'undefined' || typeof at !== 'undefined') {
    var reference = typeof after !== 'undefined' ? after : at;

    for (var i = 0; i < msTimelineShapes.length; i++) {
      var s = msTimelineShapes[i];

      if (reference === s.shape.name) {
        return (typeof at !== 'undefined' ? s.timelinePosition.start : s.timelinePosition.finish) + offset;
      }
    }

    for (var _i = 0; _i < msTimelineShapes.length; _i++) {
      var _s = msTimelineShapes[_i];

      for (var j = 0; j < _s.shape.keyframes.length; j++) {
        var keyframe = _s.shape.keyframes[j];

        if (reference === keyframe.name) {
          return _s.timelinePosition.start + _s.shape.duration * keyframe.position + offset;
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      throw new Error('No Shape or Keyframe matching name \'' + reference + '\'');
    }
  }

  return timelineFinish + offset;
};

/**
 * Create a ShapeWithOptions from an array.
 *
 * @param {Object[]} arr
 * @param {Shape} arr.0
 * @param {Object} arr.1
 *
 * @returns {ShapeWithOptions}
 *
 * @example
 * shapeWithOptionsFromArray(arr, i)
 */
var shapeWithOptionsFromArray = function shapeWithOptionsFromArray(_ref3, i) {
  var _ref4 = _slicedToArray(_ref3, 2),
      shape = _ref4[0],
      options = _ref4[1];

  if (process.env.NODE_ENV !== 'production' && ((typeof shape === 'undefined' ? 'undefined' : _typeof(shape)) !== 'object' || !shape.keyframes)) {
    throw new TypeError('When an array is passed to the timeline function the first item must be a Shape');
  }

  if (process.env.NODE_ENV !== 'production' && (typeof options === 'undefined' ? 'undefined' : _typeof(options)) !== 'object') {
    throw new TypeError('When an array is passed to the timeline function the second item must be an object');
  }

  var _options$name = options.name,
      name = _options$name === undefined ? i : _options$name,
      _options$queue = options.queue,
      queue = _options$queue === undefined ? _config2.default.defaults.timeline.queue : _options$queue;


  if (process.env.NODE_ENV !== 'production' && typeof name !== 'string' && typeof name !== 'number') {
    throw new TypeError('The name prop must be of type string or number');
  }

  if ((typeof queue === 'undefined' ? 'undefined' : _typeof(queue)) === 'object' && !Array.isArray(queue) && queue !== null) {
    var after = queue.after,
        at = queue.at,
        _queue$offset = queue.offset,
        offset = _queue$offset === undefined ? 0 : _queue$offset;


    if (process.env.NODE_ENV !== 'production' && typeof offset !== 'undefined' && typeof offset !== 'number') {
      throw new TypeError('The queue.offset prop must be of type number');
    }

    if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof after !== 'undefined') {
      throw new TypeError('You cannot pass both queue.at and queue.after props');
    }

    if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof at !== 'string' && typeof at !== 'number') {
      throw new TypeError('The queue.at prop must be of type string or number');
    }

    if (process.env.NODE_ENV !== 'production' && typeof after !== 'undefined' && typeof after !== 'string' && typeof after !== 'number') {
      throw new TypeError('The queue.after prop must be of type string or number');
    }

    if (typeof at !== 'undefined') {
      return { at: at, name: name, offset: offset, shape: shape };
    }

    if (typeof after !== 'undefined') {
      return { after: after, name: name, offset: offset, shape: shape };
    }

    return { name: name, offset: offset, shape: shape };
  } else if (typeof queue === 'number') {
    return { name: name, offset: queue, shape: shape };
  } else if (typeof queue === 'string') {
    return { after: queue, name: name, offset: 0, shape: shape };
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new TypeError('The queue prop must be of type number, string or object');
  }

  return { name: name, offset: 0, shape: shape };
};

/**
 * Sorts an array of Shapes, ShapesWithOptions and TimelineOptions.
 *
 * @param {(Shape|Object[]|TimelineOptions)[]} props
 *
 * @returns {SortedTimelineProps}
 *
 * @example
 * sort(props)
 */
var sort = function sort(props) {
  if (process.env.NODE_ENV !== 'production' && props.length === 0) {
    throw new TypeError('The timeline function must be passed at least one Shape');
  }

  var options = {};

  var shapesWithOptions = [];

  for (var i = 0, l = props.length; i < l; i++) {
    var prop = props[i];

    if (Array.isArray(prop)) {
      shapesWithOptions.push(shapeWithOptionsFromArray(prop, i));
    } else {
      if (process.env.NODE_ENV !== 'production' && (typeof prop === 'undefined' ? 'undefined' : _typeof(prop)) !== 'object') {
        throw new TypeError('The timeline function must only be passed objects and arrays');
      }

      if (prop.keyframes) {
        shapesWithOptions.push({
          name: i,
          offset: _config2.default.defaults.timeline.queue,
          shape: prop
        });
      } else {
        if (process.env.NODE_ENV !== 'production') {
          if (i === 0) {
            throw new TypeError('The timeline function must receive a Shape as the first argument');
          } else if (i !== props.length - 1) {
            throw new TypeError('The timeline function must receive options as the final argument');
          }
        }

        options = (0, _clone2.default)(prop);
      }
    }
  }

  return {
    middleware: validMiddleware(options),
    playbackOptions: validPlaybackOptions(options),
    shapesWithOptions: shapesWithOptions
  };
};

/**
 * Creates a Timeline from one or more Shape.
 * Optionally can take an options object as the last argument,
 * as well as options for each Shape if passed in as an array.
 *
 * @param {...(Shape|Object[]|TimelineOptions)} props
 *
 * @returns {Timeline}
 *
 * @example
 * timeline(circle, [ square, { queue: -200 } ], { duration: 5000 })
 */
var timeline = function timeline() {
  for (var _len = arguments.length, props = Array(_len), _key = 0; _key < _len; _key++) {
    props[_key] = arguments[_key];
  }

  var _sort = sort(props),
      middleware = _sort.middleware,
      playbackOptions = _sort.playbackOptions,
      shapesWithOptions = _sort.shapesWithOptions;

  var _timelineShapesAndDur = timelineShapesAndDuration(shapesWithOptions, middleware),
      duration = _timelineShapesAndDur.duration,
      timelineShapes = _timelineShapesAndDur.timelineShapes;

  if (typeof playbackOptions.duration === 'undefined') {
    playbackOptions.duration = duration;
  }

  var t = { middleware: middleware, playbackOptions: playbackOptions, state: {}, timelineShapes: timelineShapes };

  for (var i = 0, l = timelineShapes.length; i < l; i++) {
    var shape = timelineShapes[i].shape;

    shape.timeline = t;
    shape.timelineIndex = i;
  }

  updateState(t);

  t.event = (0, _events.event)(t);

  return t;
};

/**
 * Converts a set of MsTimelineShapes to a set of TimelineShapes
 * given the Timeline start and total duration values.
 *
 * @param {Object} props
 * @param {number} props.duration
 * @param {msTimelineShape[]} props.msTimelineShapes
 * @param {number} props.start
 *
 * @returns {TimelineShape[]}
 *
 * @example
 * timelineShapes()
 */
var timelineShapes = function timelineShapes(_ref5) {
  var duration = _ref5.duration,
      msTimelineShapes = _ref5.msTimelineShapes,
      start = _ref5.start;

  var s = [];

  for (var i = 0, l = msTimelineShapes.length; i < l; i++) {
    var msTimelineShape = msTimelineShapes[i];
    var timelinePosition = msTimelineShape.timelinePosition;

    s.push({
      shape: msTimelineShape.shape,
      timelinePosition: {
        start: (timelinePosition.start - start) / duration,
        finish: (timelinePosition.finish - start) / duration
      }
    });
  }

  return s;
};

/**
 * Converts an array of ShapesWithOptions into TimelineShapes
 * and their total duration.
 *
 * @param {ShapeWithOptions[]} shapesWithOptions
 * @param {Middleware[]} middleware
 *
 * @returns {TimelineShapesAndDuration}
 *
 * @example
 * timelineShapes(shapesWithOptions)
 */
var timelineShapesAndDuration = function timelineShapesAndDuration(shapesWithOptions, middleware) {
  var timelineStart = 0;
  var timelineFinish = 0;

  var msTimelineShapes = [];

  for (var i = 0, l = shapesWithOptions.length; i < l; i++) {
    var _shapesWithOptions$i = shapesWithOptions[i],
        after = _shapesWithOptions$i.after,
        at = _shapesWithOptions$i.at,
        name = _shapesWithOptions$i.name,
        offset = _shapesWithOptions$i.offset,
        shape = _shapesWithOptions$i.shape;


    if (process.env.NODE_ENV !== 'production' && typeof shape.timeline !== 'undefined') {
      throw new Error('A Shape can only be added to one timeline');
    }

    shape.name = name;

    apply(shape, middleware);

    var start = shapeStart({
      after: after,
      at: at,
      msTimelineShapes: msTimelineShapes,
      offset: offset,
      timelineFinish: timelineFinish
    });

    var finish = start + shape.duration;

    timelineStart = Math.min(timelineStart, start);
    timelineFinish = Math.max(timelineFinish, finish);

    msTimelineShapes.push({ shape: shape, timelinePosition: { start: start, finish: finish } });
  }

  var timelineDuration = Math.abs(timelineStart - timelineFinish);

  return {
    duration: timelineDuration,
    timelineShapes: timelineShapes({
      duration: timelineDuration,
      msTimelineShapes: msTimelineShapes,
      start: timelineStart
    })
  };
};

/**
 * Updates the PlaybackOptions of a Timeline.
 *
 * @param {Object} opts
 * @param {number} [opts.at]
 * @param {PlaybackOptions} opts.playbackOptions
 * @param {Timeline} opts.timeline
 *
 * @example
 * updatePlaybackOptions({ timeline, playbackOptions })
 */
var updatePlaybackOptions = function updatePlaybackOptions(_ref6) {
  var at = _ref6.at,
      _ref6$pause = _ref6.pause,
      pause = _ref6$pause === undefined ? false : _ref6$pause,
      playbackOptions = _ref6.playbackOptions,
      timeline = _ref6.timeline;

  if (process.env.NODE_ENV !== 'production' && ((typeof timeline === 'undefined' ? 'undefined' : _typeof(timeline)) !== 'object' || !timeline.timelineShapes || !timeline.playbackOptions)) {
    throw new TypeError('The updatePlaybackOptions function must be passed a Timeline');
  }

  if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof at !== 'number') {
    throw new TypeError('The updatePlaybackOptions function at property must be of type number');
  }

  var previous = timeline.playbackOptions;

  var next = validPlaybackOptions(_extends({}, previous, playbackOptions, {
    started: typeof at !== 'undefined' ? at : Date.now()
  }));

  if (typeof playbackOptions.initialIterations !== 'undefined') {
    if (typeof playbackOptions.reverse === 'undefined') {
      next.reverse = currentReverse(previous, next.initialIterations - previous.initialIterations);
    }

    if (typeof playbackOptions.iterations === 'undefined' && previous.iterations !== Infinity) {
      next.iterations = Math.max(0, previous.initialIterations + previous.iterations - next.initialIterations);
    }
  } else {
    var complete = iterationsComplete(previous, next.started);
    var reverse = currentReverse(previous, complete);

    next.initialIterations = previous.initialIterations + complete;

    if (typeof playbackOptions.iterations === 'undefined') {
      next.iterations = previous.iterations - complete;

      if (typeof playbackOptions.reverse !== 'undefined' && next.reverse !== previous.reverse && next.iterations !== Infinity) {
        var nextIterations = next.initialIterations;
        next.initialIterations = next.iterations;
        next.iterations = nextIterations;
      }
    } else {
      if (typeof playbackOptions.reverse !== 'undefined' && playbackOptions.reverse !== reverse && next.iterations !== Infinity) {
        next.initialIterations = previous.iterations - complete;
      }
    }

    if (typeof playbackOptions.reverse === 'undefined') {
      next.reverse = reverse;
    } else if (next.iterations === Infinity) {
      next.initialIterations = playbackOptions.reverse === reverse ? next.initialIterations % 1 : 1 - next.initialIterations % 1;
    }
  }

  if (pause) {
    delete next.started;
  }

  return next;
};

/**
 * Updates the Timeline state.
 *
 * @param {Timeline} timeline
 * @param {number} at
 *
 * @example
 * updateState(timeline, Date.now())
 */
var updateState = function updateState(t, at) {
  var playbackOptions = t.playbackOptions;
  var state = t.state;

  state.started = typeof playbackOptions.started !== 'undefined';
  state.iterationsComplete = iterationsComplete(playbackOptions, at);
  state.totalIterations = playbackOptions.initialIterations + state.iterationsComplete;
  state.reverse = currentReverse(playbackOptions, state.iterationsComplete);
  state.finished = playbackOptions.iterations - state.iterationsComplete === 0;
  state.position = position(state.totalIterations, state.reverse);
};

/**
 * Extracts and validates Middlware from an object.
 *
 * @param {Object} opts
 *
 * @returns {Middleware[]}
 *
 * @example
 * validMiddleware(opts)
 */
var validMiddleware = function validMiddleware(_ref7) {
  var _ref7$middleware = _ref7.middleware,
      middleware = _ref7$middleware === undefined ? _config2.default.defaults.timeline.middleware : _ref7$middleware;

  if (!Array.isArray(middleware)) {
    throw new TypeError('The timeline function middleware option must be of type array');
  }

  for (var i = 0, l = middleware.length; i < l; i++) {
    var _middleware$i = middleware[i],
        name = _middleware$i.name,
        _input = _middleware$i.input,
        output = _middleware$i.output;


    if (typeof name !== 'string') {
      throw new TypeError('A middleware must have a name prop');
    }

    if (typeof _input !== 'function') {
      throw new TypeError('The ' + name + ' middleware must have an input method');
    }

    if (typeof output !== 'function') {
      throw new TypeError('The ' + name + ' middleware must have an output method');
    }
  }

  return middleware;
};

/**
 * Extracts and validates PlaybackOptions from an object.
 *
 * @param {Object} opts
 *
 * @returns {PlaybackOptions}
 *
 * @example
 * validPlaybackOptions(opts)
 */
var validPlaybackOptions = function validPlaybackOptions(_ref8) {
  var _ref8$alternate = _ref8.alternate,
      alternate = _ref8$alternate === undefined ? _config2.default.defaults.timeline.alternate : _ref8$alternate,
      duration = _ref8.duration,
      _ref8$initialIteratio = _ref8.initialIterations,
      initialIterations = _ref8$initialIteratio === undefined ? _config2.default.defaults.timeline.initialIterations : _ref8$initialIteratio,
      _ref8$iterations = _ref8.iterations,
      iterations = _ref8$iterations === undefined ? _config2.default.defaults.timeline.iterations : _ref8$iterations,
      _ref8$reverse = _ref8.reverse,
      reverse = _ref8$reverse === undefined ? _config2.default.defaults.timeline.reverse : _ref8$reverse,
      started = _ref8.started;

  var playbackOptions = {};

  if (typeof duration !== 'undefined') {
    if (process.env.NODE_ENV !== 'production' && (typeof duration !== 'number' || duration < 0)) {
      throw new TypeError('The timeline function duration option must be a positive number or zero');
    }

    playbackOptions.duration = duration;
  }

  if (process.env.NODE_ENV !== 'production') {
    if (typeof alternate !== 'boolean') {
      throw new TypeError('The timeline function alternate option must be true or false');
    }

    if (typeof initialIterations !== 'number' || initialIterations < 0) {
      throw new TypeError('The timeline function initialIterations option must be a positive number or zero');
    }

    if (typeof iterations !== 'number' || iterations < 0) {
      throw new TypeError('The timeline function iterations option must be a positive number or zero');
    }

    if (typeof reverse !== 'boolean') {
      throw new TypeError('The timeline function reverse option must be true or false');
    }
  }

  if (typeof started !== 'undefined') {
    if (process.env.NODE_ENV !== 'production' && (typeof started !== 'number' || started < 0)) {
      throw new TypeError('The timeline function started option must be a positive number or zero');
    }

    playbackOptions.started = started;
  }

  return _extends({}, playbackOptions, {
    alternate: alternate,
    initialIterations: initialIterations,
    iterations: iterations,
    reverse: reverse
  });
};

exports.currentReverse = currentReverse;
exports.iterationsComplete = iterationsComplete;
exports.pause = pause;
exports.play = play;
exports.position = position;
exports.sameDirection = sameDirection;
exports.updateState = updateState;
exports.default = timeline;
}).call(this,require('_process'))
},{"./clone":31,"./config":33,"./events":35,"./middleware":39,"_process":18}],44:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transformPoints = exports.pointsToFrameShape = exports.flattenPoints = undefined;

var _points = require('points');

var transformFunctions = _interopRequireWildcard(_points);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

/**
 * A WeakMap where the key is a FrameShape and the value is
 * the index of the associated points within an array of Points.
 *
 * @typedef {weakmap} PointsMap
 */

/**
 * Applies a transform to a FrameShape.
 *
 * @param {FrameShape} frameShape
 * @param {(string|number)[]} transform
 *
 * @return {FrameShape}
 *
 * @example
 * transform(frameShape, [ 'rotate', 45 ])
 */
var apply = function apply(frameShape, _ref) {
  var _ref2 = _toArray(_ref),
      name = _ref2[0],
      args = _ref2.slice(1);

  var _flattenPoints = flattenPoints(frameShape),
      points = _flattenPoints.points,
      pointsMap = _flattenPoints.pointsMap;

  var transformedPoints = transformFunctions[name].apply(transformFunctions, [points].concat(_toConsumableArray(args)));

  return pointsToFrameShape({
    frameShape: frameShape,
    points: transformedPoints,
    pointsMap: pointsMap
  });
};

/**
 * Creates an array of Points from a FrameShape.
 *
 * @param {FrameShape} frameShape
 * @param {Points[]} [points=[]]
 * @param {PointsMap} [pointsMap=new WeakMap()]
 *
 * @return {Object}
 *
 * @example
 * flattenPoints(frameShape)
 */
var flattenPoints = function flattenPoints(frameShape) {
  var points = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var pointsMap = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new WeakMap();

  var childFrameShapes = frameShape.childFrameShapes;

  if (childFrameShapes) {
    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      flattenPoints(childFrameShapes[i], points, pointsMap);
    }
  } else {
    pointsMap.set(frameShape, points.length);
    points.push(frameShape.points);
  }

  return { points: points, pointsMap: pointsMap };
};

/**
 * Applies an array of Points to a FrameShape using a PointsMap
 *
 * @param {Object} opts
 * @param {FrameShape} opts.frameShape
 * @param {Points[]} opts.points
 * @param {PointsMap} pointsMap
 *
 */
var pointsToFrameShape = function pointsToFrameShape(_ref3) {
  var frameShape = _ref3.frameShape,
      points = _ref3.points,
      pointsMap = _ref3.pointsMap;

  var childFrameShapes = frameShape.childFrameShapes;

  if (frameShape.points) {
    frameShape.points = points[pointsMap.get(frameShape)];
  }

  if (childFrameShapes) {
    for (var i = 0, l = childFrameShapes.length; i < l; i++) {
      pointsToFrameShape({
        frameShape: childFrameShapes[i],
        points: points,
        pointsMap: pointsMap
      });
    }
  }

  return frameShape;
};

/**
 * Applies an array of transforms to a FrameShape.
 *
 * @param {FrameShape} frameShape
 * @param {(string|number)[][]} transforms
 *
 * @return {FrameShape}
 *
 * @example
 * transform(frameShape, [[ 'rotate', 45 ]])
 */
var transform = function transform(frameShape, transforms) {
  for (var i = 0, l = transforms.length; i < l; i++) {
    frameShape = apply(frameShape, transforms[i]);
  }

  return frameShape;
};

/**
 * Applies an array of transforms to Points.
 *
 * @param {Points} points
 * @param {(string|number)[][]} transforms
 *
 * @return {Points}
 *
 * @example
 * transform(points, [[ 'rotate', 45 ]])
 */
var transformPoints = function transformPoints(points, transforms) {
  for (var i = 0, l = transforms.length; i < l; i++) {
    var _transforms$i = _toArray(transforms[i]),
        name = _transforms$i[0],
        args = _transforms$i.slice(1);

    points = transformFunctions[name].apply(transformFunctions, [points].concat(_toConsumableArray(args)));
  }

  return points;
};

exports.flattenPoints = flattenPoints;
exports.pointsToFrameShape = pointsToFrameShape;
exports.transformPoints = transformPoints;
exports.default = transform;
},{"points":9}],45:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * A tweenable unit.
 *
 * @typedef {Object} Unit
 *
 * @property {string} middleware - The name of this middleware.
 * @property {string} values - The type of color string to output.
 */

var name = 'unit';

var units = ['ch', 'cm', 'em', 'ex', 'in', 'mm', 'pc', 'pt', 'px', 'rem', 'vh', 'vmax', 'vmin', 'vw', '%'];

/**
 * Converts a unit string to a Unit.
 *
 * @param {*} x - A potential unit string.
 *
 * @returns {*}
 *
 * @example
 * input('20px')
 */
var input = function input(x) {
  if (typeof x === 'string') {
    var parts = x.split(' ');
    var values = [];

    for (var i = 0, l = parts.length; i < l; i++) {
      var part = parts[i];
      var number = parseFloat(part);
      var unit = part.replace(number, '');

      if (!isNaN(number) && (unit === '' || units.indexOf(unit) !== -1)) {
        values.push([number, unit]);
      } else {
        values.push(part);
      }
    }

    if (values.toString() !== parts.toString()) {
      return { middleware: name, values: values };
    }
  }

  return x;
};

/**
 * Converts a Unit to a unit string.
 *
 * @param {*} x - A potential Unit.
 *
 * @returns {*}
 *
 * @example
 * output(unit)
 */
var output = function output(x) {
  if ((typeof x === 'undefined' ? 'undefined' : _typeof(x)) === 'object' && x.middleware === name) {
    var values = x.values;
    var result = [];

    for (var i = 0, l = values.length; i < l; i++) {
      result.push(values[i].join(''));
    }

    return result.join(' ');
  }

  return x;
};

exports.default = { name: name, input: input, output: output };
},{}],46:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateNode = exports.plainShapeObject = exports.node = exports.frameShape = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _svgPoints = require('svg-points');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /* globals __DEV__ */

/**
 * A DOM node.
 *
 * @typedef {Object} Node
 */

/**
 * The data from a Node that is useful in FrameShape and PlainShapeObject creation.
 *
 * @typedef {Object} NodeData
 *
 * @property {Object} attributes - All HTML attributes of the Node (excluding blacklist).
 * @property {Object[]} childNodes
 * @property {string} type - The nodeName of the Node.
 */

/**
 * Attributes to ignore.
 */
var attributeBlacklist = ['data-jsx-ext', 'data-reactid'];

/**
 * Wilderness' accepted node types core props.
 */
var nodeCoreProps = [{
  type: 'circle',
  coreProps: ['cx', 'cy', 'r']
}, {
  type: 'ellipse',
  coreProps: ['cx', 'cy', 'rx', 'ry']
}, {
  type: 'g',
  coreProps: []
}, {
  type: 'line',
  coreProps: ['x1', 'x2', 'y1', 'y2']
}, {
  type: 'path',
  coreProps: ['d']
}, {
  type: 'polygon',
  coreProps: ['points']
}, {
  type: 'polyline',
  coreProps: ['points']
}, {
  type: 'rect',
  coreProps: ['height', 'rx', 'ry', 'width', 'x', 'y']
}];

/**
 * Generates Wilderness' accepted node types from core props object.
 *
 * @returns {string[]}
 *
 * @example
 * getNodeTypes()
 */
var getNodeTypes = function getNodeTypes() {
  var types = [];

  for (var i = 0, l = nodeCoreProps.length; i < l; i++) {
    types.push(nodeCoreProps[i].type);
  }

  return types;
};

/**
 * Wilderness' accepted node types.
 */
var nodeTypes = getNodeTypes();

/**
 * Core props for the defined node type.
 *
 * @param {string} type
 *
 * @returns {Object}
 *
 * @example
 * coreProps('rect')
 */
var coreProps = function coreProps(type) {
  for (var i = 0, l = nodeCoreProps.length; i < l; i++) {
    if (nodeCoreProps[i].type === type) {
      return nodeCoreProps[i].coreProps;
    }
  }

  return [];
};

/**
 * Creates a FrameShape from a Node.
 *
 * @param {Node} node
 *
 * @returns {FrameShape}
 *
 * @example
 * frameShapeFromNode(node)
 */
var frameShape = function frameShape(el) {
  if (validNode(el)) {
    var data = nodeData(el);
    var attributes = data.attributes;
    var type = data.type;

    if (type === 'g') {
      var childNodes = data.childNodes;
      var childFrameShapes = [];

      for (var i = 0, l = childNodes.length; i < l; i++) {
        var n = childNodes[i];

        if (validNodeType(childNodes[i].nodeName)) {
          childFrameShapes.push(frameShape(n));
        }
      }

      return { attributes: attributes, childFrameShapes: childFrameShapes };
    }

    return {
      attributes: removeCoreProps(type, attributes),
      points: (0, _svgPoints.toPoints)(plainShapeObjectFromAttrs(type, attributes))
    };
  }
};

/**
 * Creates a group Node from a FrameShape array.
 *
 * @param {FrameShape[]} childFrameShapes
 *
 * @returns {Node}
 *
 * @example
 * groupNode(childFrameShapes)
 */
var groupNode = function groupNode(childFrameShapes) {
  var nodes = [];

  for (var i = 0, l = childFrameShapes.length; i < l; i++) {
    nodes.push(node(childFrameShapes[i]));
  }

  var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  for (var _i2 = 0, _l2 = nodes.length; _i2 < _l2; _i2++) {
    group.appendChild(nodes[_i2]);
  }

  return group;
};

/**
 * Creates a Node from a FrameShape.
 *
 * @param {FrameShape} frameShape
 *
 * @returns {Node}
 *
 * @example
 * node(frameShape)
 */
var node = function node(frameShp) {
  if (validFrameShape(frameShp)) {
    var attributes = frameShp.attributes;

    var el = frameShp.childFrameShapes ? groupNode(frameShp.childFrameShapes) : pathNode(frameShp.points);

    for (var attr in attributes) {
      el.setAttribute(attr, attributes[attr]);
    }

    return el;
  }
};

/**
 * Creates NodeData given a Node.
 *
 * @param {Node} el
 *
 * @returns {NodeData}
 *
 * @example
 * nodeData(el)
 */
var nodeData = function nodeData(el) {
  var attributes = {};

  if (el.hasAttributes()) {
    var attrs = [].concat(_toConsumableArray(el.attributes));

    for (var i = 0, l = attrs.length; i < l; i++) {
      var attr = attrs[i];
      var name = attr.name;

      if (attributeBlacklist.indexOf(name) === -1) {
        attributes[name] = attr.value;
      }
    }
  }

  return { attributes: attributes, childNodes: [].concat(_toConsumableArray(el.childNodes)), type: el.nodeName };
};

/**
 * Creates a path Node from Points.
 *
 * @param {Points} points
 *
 * @returns {Node}
 *
 * @example
 * pathNode(points)
 */
var pathNode = function pathNode(points) {
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  path.setAttribute('d', (0, _svgPoints.toPath)(points));

  return path;
};

/**
 * Creates a PlainShapeObject from a Node.
 *
 * @param {Node} el
 *
 * @returns {PlainShapeObject}
 *
 * @example
 * plainShapeObject(el)
 */
var plainShapeObject = function plainShapeObject(el) {
  if (validNode(el)) {
    var data = nodeData(el);
    var attributes = data.attributes;
    var type = data.type;

    if (type === 'g') {
      var childNodes = data.childNodes;
      var shapes = [];

      for (var i = 0, l = childNodes.length; i < l; i++) {
        var n = childNodes[i];

        if (validNodeType(n.nodeName)) {
          shapes.push(plainShapeObject(n));
        }
      }

      return _extends({}, attributes, { type: type, shapes: shapes });
    }

    return _extends({}, attributes, plainShapeObjectFromAttrs(type, attributes));
  }
};

/**
 * Creates a PlainShapeObject from type and an attribute object.
 *
 * @param {string} type
 * @param {Object} attributes
 *
 * @returns {PlainShapeObject}
 *
 * @example
 * plainShapeObjectFromAttrs('rect', attributes)
 */
var plainShapeObjectFromAttrs = function plainShapeObjectFromAttrs(type, attributes) {
  var props = coreProps(type);
  var result = { type: type };

  for (var k in attributes) {
    if (props.indexOf(k) !== -1) {
      var v = attributes[k];
      var n = Number(v);
      result[k] = Number.isNaN(n) ? v : n;
    }
  }

  return result;
};

/**
 * Removes type's core props from attributes object.
 *
 * @param {string} type
 * @param {Object} attributes
 *
 * @returns {Object}
 *
 * @example
 * removeCoreProps('rect', attributes)
 */
var removeCoreProps = function removeCoreProps(type, attributes) {
  var props = coreProps(type);
  var result = {};

  for (var k in attributes) {
    if (props.indexOf(k) === -1) {
      result[k] = attributes[k];
    }
  }

  return result;
};

/**
 * Updates a Node from a FrameShape.
 *
 * @param {Node} el
 * @param {FrameShape} frameShape
 *
 * @returns {Node}
 *
 * @example
 * updateNode(el, frameShape)
 */
var updateNode = function updateNode(el, frameShp) {
  var changes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  if (process.env.NODE_ENV !== 'production') {
    if (!validNode(el)) {
      throw new TypeError('The first argument of the updateNode function must be a valid DOM node');
    }

    if (!validFrameShape(frameShp)) {
      throw new TypeError('The second argument of the updateNode function must be a valid frameShape');
    }
  }

  var shouldApplyChanges = changes.length === 0;
  var currentAttributes = el.attributes;
  var nextAttributes = frameShp.attributes;
  var childFrameShapes = frameShp.childFrameShapes;
  var changesKey = changes.push({ el: el, remove: [], update: {} }) - 1;

  for (var k in currentAttributes) {
    if (typeof nextAttributes[k] === 'undefined') {
      changes[changesKey].remove.push(k);
    }
  }

  for (var _k in nextAttributes) {
    var c = currentAttributes[_k];
    var n = nextAttributes[_k];

    if (typeof c === 'undefined' || c !== n) {
      changes[changesKey].update[_k] = n;
    }
  }

  if (!childFrameShapes) {
    var nextPath = (0, _svgPoints.toPath)(frameShp.points);

    if (nextPath !== el.getAttribute('d')) {
      changes[changesKey].update.d = nextPath;
    }
  } else {
    var allChildNodes = [].concat(_toConsumableArray(el.childNodes));
    var childNodes = [];

    for (var i = 0, l = allChildNodes.length; i < l; i++) {
      var _n = allChildNodes[i];

      if (validNodeType(_n.nodeName)) {
        childNodes.push(_n);
      }
    }

    for (var _i3 = 0, _l3 = childFrameShapes.length; _i3 < _l3; _i3++) {
      updateNode(childNodes[_i3], childFrameShapes[_i3], changes);
    }
  }

  if (shouldApplyChanges) {
    for (var _i4 = 0, _l4 = changes.length; _i4 < _l4; _i4++) {
      var change = changes[_i4];
      var _el = change.el;
      var remove = change.remove;
      var update = change.update;

      for (var _i = 0, _l = remove.length; _i < _l; _i++) {
        _el.removeAttribute(remove[_i]);
      }

      for (var _k2 in update) {
        _el.setAttribute(_k2, update[_k2]);
      }
    }
  }

  return el;
};

/**
 * Is a FrameShape valid?
 *
 * @param {FrameShape} frameShp
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * validFrameShape(frameShape)
 */
var validFrameShape = function validFrameShape(frameShp) {
  if (process.env.NODE_ENV !== 'production') {
    if ((typeof frameShp === 'undefined' ? 'undefined' : _typeof(frameShp)) !== 'object' || Array.isArray(frameShp)) {
      throw new TypeError('frameShape must be of type object');
    }

    var attributes = frameShp.attributes;
    var childFrameShapes = frameShp.childFrameShapes;
    var points = frameShp.points;

    if (typeof attributes === 'undefined') {
      throw new TypeError('frameShape must include an attributes property');
    }

    if ((typeof attributes === 'undefined' ? 'undefined' : _typeof(attributes)) !== 'object' || Array.isArray(attributes)) {
      throw new TypeError('frameShape attributes property must be of type object');
    }

    if (typeof childFrameShapes === 'undefined' && typeof points === 'undefined') {
      throw new TypeError('frameShape must have either a points or childFrameShapes property');
    }

    if (points && !Array.isArray(points)) {
      throw new TypeError('frameShape points property must be of type array');
    }

    if (childFrameShapes) {
      if (!Array.isArray(childFrameShapes)) {
        throw new TypeError('frameShape childFrameShapes property must be of type array');
      }

      for (var i = 0, l = childFrameShapes.length; i < l; i++) {
        var childFrameShape = childFrameShapes[i];

        if ((typeof childFrameShape === 'undefined' ? 'undefined' : _typeof(childFrameShape)) !== 'object' || _typeof(childFrameShape.attributes) !== 'object') {
          throw new TypeError('frameShape childFrameShapes property must be array of frameShapes');
        }
      }
    }
  }

  return true;
};

/**
 * Is a Node valid?
 *
 * @param {Node} el
 *
 * @throws {TypeError} Throws if not valid
 *
 * @returns {true}
 *
 * @example
 * validNode(el)
 */
var validNode = function validNode(el) {
  if (process.env.NODE_ENV !== 'production') {
    if ((typeof el === 'undefined' ? 'undefined' : _typeof(el)) !== 'object' || !el.nodeName) {
      throw new TypeError('el must be a DOM node');
    }

    if (!validNodeType(el.nodeName)) {
      throw new TypeError('el must be an SVG basic shape or group element');
    }
  }

  return true;
};

/**
 * Is a node name one of the accepted node types?
 *
 * @param {string} nodeName
 *
 * @returns {boolean}
 *
 * @example
 * validNodeType(nodeName)
 */
var validNodeType = function validNodeType(nodeName) {
  return nodeTypes.indexOf(nodeName) !== -1;
};

exports.frameShape = frameShape;
exports.node = node;
exports.plainShapeObject = plainShapeObject;
exports.updateNode = updateNode;
}).call(this,require('_process'))
},{"_process":18,"svg-points":19}],47:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unitMiddleware = exports.timeline = exports.shape = exports.render = exports.play = exports.plainShapeObject = exports.pause = exports.motionPath = exports.colorMiddleware = undefined;

var _render = require('./render');

var _render2 = _interopRequireDefault(_render);

var _shape = require('./shape');

var _shape2 = _interopRequireDefault(_shape);

var _timeline = require('./timeline');

var _timeline2 = _interopRequireDefault(_timeline);

var _wildernessCore = require('wilderness-core');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.colorMiddleware = _wildernessCore.colorMiddleware;
exports.motionPath = _wildernessCore.motionPath;
exports.pause = _wildernessCore.pause;
exports.plainShapeObject = _wildernessCore.plainShapeObject;
exports.play = _timeline.play;
exports.render = _render2.default;
exports.shape = _shape2.default;
exports.timeline = _timeline2.default;
exports.unitMiddleware = _wildernessCore.unitMiddleware;
},{"./render":48,"./shape":49,"./timeline":50,"wilderness-core":37}],48:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /* globals __DEV__ */

var _wildernessCore = require('wilderness-core');

var _wildernessDomNode = require('wilderness-dom-node');

var _timeline = require('./timeline');

/**
 * An object holding both Shapes and Timelines.
 *
 * @typedef {Object} ShapesAndTimelines
 *
 * @property {Shape[]} shapes
 * @property {Timeline[]} timelines
 */

/**
 * Renders Shapes or Timelines to a container Node.
 *
 * @param {Node} container
 * @param {...(Shape|Timeline)} shapesAndTimelines
 *
 * @example
 * render(svg, shape, timeline)
 */
var render = function render(container) {
  for (var _len = arguments.length, shapesAndTimelines = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    shapesAndTimelines[_key - 1] = arguments[_key];
  }

  if (process.env.NODE_ENV !== 'production') {
    if ((typeof container === 'undefined' ? 'undefined' : _typeof(container)) !== 'object' || !container.nodeName) {
      throw new TypeError('The render function must be a DOM node as first argument');
    }
  }

  var shapesToRender = [];
  var result = split(shapesAndTimelines);
  var shapes = result.shapes;
  var timelines = result.timelines;

  for (var i = 0, l = shapes.length; i < l; i++) {
    var shape = shapes[i];
    shape.node = (0, _wildernessDomNode.node)(shape.keyframes[0].frameShape);
    shapesToRender.push(shape);
    shape.rendered = true;
  }

  for (var _i2 = 0, _l2 = timelines.length; _i2 < _l2; _i2++) {
    var timeline = timelines[_i2];
    var timelineShapes = timeline.timelineShapes;
    var frameShapes = (0, _wildernessCore.frame)(timeline);

    for (var _i = 0, _l = timelineShapes.length; _i < _l; _i++) {
      var _shape = timelineShapes[_i].shape;
      _shape.node = (0, _wildernessDomNode.node)(frameShapes[_i]);
      shapesToRender.push(_shape);
    }

    timeline.state.rendered = true;
  }

  for (var _i3 = 0, _l3 = shapesToRender.length; _i3 < _l3; _i3++) {
    var _shape2 = shapesToRender[_i3];

    if (_shape2.replace) {
      _shape2.replace.parentNode.replaceChild(_shape2.node, _shape2.replace);
      delete _shape2.replace;
    } else {
      container.appendChild(_shape2.node);
    }
  }

  (0, _timeline.tick)();
};

/**
 * Splits a Shape and Timeline array into ShapesAndTimelines.
 *
 * @param {(Shape|Timeline)[]} shapesAndTimelines
 *
 * @returns {ShapesAndTimelines}
 *
 * @example
 * split([ shape, timeline ])
 */
var split = function split(shapesAndTimelines) {
  var result = { shapes: [], timelines: [] };

  for (var i = 0, l = shapesAndTimelines.length; i < l; i++) {
    var x = shapesAndTimelines[i];

    if ((typeof x === 'undefined' ? 'undefined' : _typeof(x)) === 'object' && x.keyframes) {
      if (process.env.NODE_ENV !== 'production') {
        if (x.timeline) {
          throw new Error('You cannot render a shape that has been placed on a timeline, instead render the timeline');
        }

        if (x.rendered) {
          throw new Error('You cannot render the same shape twice');
        }
      }

      result.shapes.push(x);
    } else if ((typeof x === 'undefined' ? 'undefined' : _typeof(x)) === 'object' && x.middleware && x.playbackOptions && x.state && x.timelineShapes) {
      if (process.env.NODE_ENV !== 'production' && x.state.rendered) {
        throw new Error('You cannot render the same timeline twice');
      }

      result.timelines.push(x);
    } else if (process.env.NODE_ENV !== 'production') {
      throw new Error('The render function only takes shapes and timelines from the second argument onwards');
    }
  }

  return result;
};

exports.default = render;
}).call(this,require('_process'))
},{"./timeline":50,"_process":18,"wilderness-core":37,"wilderness-dom-node":46}],49:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* globals __DEV__ */

var _wildernessDomNode = require('wilderness-dom-node');

var _wildernessCore = require('wilderness-core');

/**
 * Extends the Wilderness core shape function.
 * Adds the ability to pull keyframe attributes and points from a SVG DOM node.
 * Adds an optional replace property to a Shape, which is used during render.
 *
 * @param {(PlainShapeObject|Object)[]} props
 *
 * @returns {Shape}
 *
 * @example
 * shape({ el, style: '' }, { replace: el })
 */
var shape = function shape() {
  for (var _len = arguments.length, props = Array(_len), _key = 0; _key < _len; _key++) {
    props[_key] = arguments[_key];
  }

  var args = [];

  for (var i = 0, l = props.length; i < l; i++) {
    var prop = props[i];

    if (prop.el) {
      var p = _extends({}, (0, _wildernessDomNode.plainShapeObject)(prop.el), prop);

      delete p.el;

      args.push(p);
    }

    args.push(prop);
  }

  var s = _wildernessCore.shape.apply(undefined, args);

  var options = props.length > 1 && typeof props[props.length - 1].type === 'undefined' ? props[props.length - 1] : {};

  var replace = options.replace;

  if (replace) {
    if (process.env.NODE_ENV !== 'production' && ((typeof replace === 'undefined' ? 'undefined' : _typeof(replace)) !== 'object' || !replace.nodeName)) {
      throw new TypeError('The replace option must be a DOM node');
    }

    s.replace = replace;
  }

  return s;
};

exports.default = shape;
}).call(this,require('_process'))
},{"_process":18,"wilderness-core":37,"wilderness-dom-node":46}],50:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tick = exports.play = undefined;

var _wildernessCore = require('wilderness-core');

var _wildernessDomNode = require('wilderness-dom-node');

/**
 * Is the tick function running?
 */
/* globals __DEV__ */

var ticks = 0;

/**
 * Extends the Wilderness core play function.
 * Adds a call to the tick function.
 *
 * @param {Timeline} t
 * @param {PlaybackOptions} playbackOptions
 * @param {number} [at]
 */
var play = function play(t, playbackOptions, at) {
  (0, _wildernessCore.play)(t, playbackOptions, at);
  tick();
};

/**
 * Calculate the active Timeline Shapes and update the corresponding Nodes.
 * Call recursively until there are no longer any active Timelines.
 *
 * @param {number} [at]
 *
 * @example
 * tick()
 */
var tick = function tick(at) {
  if (!ticks) {
    if (process.env.NODE_ENV !== 'production' && typeof at !== 'undefined' && typeof at !== 'number') {
      throw new TypeError('The tick functions at option must be of type number');
    }

    window.requestAnimationFrame(function () {
      var a = typeof at !== 'undefined' ? at : Date.now();

      var retick = false;

      ticks++;

      for (var i = 0, l = timelines.length; i < l; i++) {
        var t = timelines[i];
        var state = t.state;

        if (state.started && !state.finished && state.rendered) {
          var timelineShapes = t.timelineShapes;
          var frameShapes = (0, _wildernessCore.frame)(t, a);

          for (var _i = 0, _l = timelineShapes.length; _i < _l; _i++) {
            (0, _wildernessDomNode.updateNode)(timelineShapes[_i].shape.node, frameShapes[_i]);
          }

          (0, _wildernessCore.events)(t);

          retick = true;
        }
      }

      ticks--;

      if (retick) {
        tick();
      }
    });
  }
};

/**
 * Extends the Wilderness core timeline function.
 * Pushes each timeline into the timelines array.
 *
 * @param {...(Shape|Object[]|TimelineOptions)[]} props
 *
 * @returns {Timeline}
 *
 * @example
 * timeline(circle, [ square, { queue: -200 } ], { duration: 5000 })
 */
var timeline = function timeline() {
  var t = _wildernessCore.timeline.apply(undefined, arguments);
  timelines.push(t);
  return t;
};

/**
 * An array of every Timeline created.
 */
var timelines = [];

exports.play = play;
exports.tick = tick;
exports.default = timeline;
}).call(this,require('_process'))
},{"_process":18,"wilderness-core":37,"wilderness-dom-node":46}],51:[function(require,module,exports){
/*****************************************************************************
 *                                                                            *
 *  SVG Path Rounding Function                                                *
 *  Copyright (C) 2014 Yona Appletree                                         *
 *                                                                            *
 *  Licensed under the Apache License, Version 2.0 (the "License");           *
 *  you may not use this file except in compliance with the License.          *
 *  You may obtain a copy of the License at                                   *
 *                                                                            *
 *      http://www.apache.org/licenses/LICENSE-2.0                            *
 *                                                                            *
 *  Unless required by applicable law or agreed to in writing, software       *
 *  distributed under the License is distributed on an "AS IS" BASIS,         *
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  *
 *  See the License for the specific language governing permissions and       *
 *  limitations under the License.                                            *
 *                                                                            *
 *****************************************************************************/

/**
 * SVG Path rounding function. Takes an input path string and outputs a path
 * string where all line-line corners have been rounded. Only supports absolute
 * commands at the moment.
 *
 * @param pathString The SVG input path
 * @param radius The amount to round the corners, either a value in the SVG
 *               coordinate space, or, if useFractionalRadius is true, a value
 *               from 0 to 1.
 * @param useFractionalRadius If true, the curve radius is expressed as a
 *               fraction of the distance between the point being curved and
 *               the previous and next points.
 * @returns A new SVG path string with the rounding
 */
function roundPathCorners(pathString, radius, useFractionalRadius) {
    function moveTowardsLength(movingPoint, targetPoint, amount) {
        var width = (targetPoint.x - movingPoint.x);
        var height = (targetPoint.y - movingPoint.y);

        var distance = Math.sqrt(width*width + height*height);

        return moveTowardsFractional(movingPoint, targetPoint, Math.min(1, amount / distance));
    }
    function moveTowardsFractional(movingPoint, targetPoint, fraction) {
        return {
            x: movingPoint.x + (targetPoint.x - movingPoint.x)*fraction,
            y: movingPoint.y + (targetPoint.y - movingPoint.y)*fraction
        };
    }

    // Adjusts the ending position of a command
    function adjustCommand(cmd, newPoint) {
        if (cmd.length > 2) {
            cmd[cmd.length - 2] = newPoint.x;
            cmd[cmd.length - 1] = newPoint.y;
        }
    }

    // Gives an {x, y} object for a command's ending position
    function pointForCommand(cmd) {
        return {
            x: parseFloat(cmd[cmd.length - 2]),
            y: parseFloat(cmd[cmd.length - 1]),
        };
    }

    // Split apart the path, handing concatonated letters and numbers
    var pathParts = pathString
        .split(/[,\s]/)
        .reduce(function(parts, part){
            var match = part.match("([a-zA-Z])(.+)");
            if (match) {
                parts.push(match[1]);
                parts.push(match[2]);
            } else {
                parts.push(part);
            }

            return parts;
        }, []);

    // Group the commands with their arguments for easier handling
    var commands = pathParts.reduce(function(commands, part) {
        if (parseFloat(part) == part && commands.length) {
            commands[commands.length - 1].push(part);
        } else {
            commands.push([part]);
        }

        return commands;
    }, []);

    // The resulting commands, also grouped
    var resultCommands = [];

    if (commands.length > 1) {
        var startPoint = pointForCommand(commands[0]);

        // Handle the close path case with a "virtual" closing line
        var virtualCloseLine = null;
        if (commands[commands.length - 1][0] == "Z" && commands[0].length > 2) {
            virtualCloseLine = ["L", startPoint.x, startPoint.y];
            commands[commands.length - 1] = virtualCloseLine;
        }

        // We always use the first command (but it may be mutated)
        resultCommands.push(commands[0]);

        for (var cmdIndex=1; cmdIndex < commands.length; cmdIndex++) {
            var prevCmd = resultCommands[resultCommands.length - 1];

            var curCmd = commands[cmdIndex];

            // Handle closing case
            var nextCmd = (curCmd == virtualCloseLine)
                ? commands[1]
                : commands[cmdIndex + 1];

            // Nasty logic to decide if this path is a candidite.
            if (nextCmd && prevCmd && (prevCmd.length > 2) && curCmd[0] == "L" && nextCmd.length > 2 && nextCmd[0] == "L") {
                // Calc the points we're dealing with
                var prevPoint = pointForCommand(prevCmd);
                var curPoint = pointForCommand(curCmd);
                var nextPoint = pointForCommand(nextCmd);

                // The start and end of the cuve are just our point moved towards the previous and next points, respectivly
                var curveStart, curveEnd;

                if (useFractionalRadius) {
                    curveStart = moveTowardsFractional(curPoint, prevCmd.origPoint || prevPoint, radius);
                    curveEnd = moveTowardsFractional(curPoint, nextCmd.origPoint || nextPoint, radius);
                } else {
                    curveStart = moveTowardsLength(curPoint, prevPoint, radius);
                    curveEnd = moveTowardsLength(curPoint, nextPoint, radius);
                }

                // Adjust the current command and add it
                adjustCommand(curCmd, curveStart);
                curCmd.origPoint = curPoint;
                resultCommands.push(curCmd);

                // The curve control points are halfway between the start/end of the curve and
                // the original point
                var startControl = moveTowardsFractional(curveStart, curPoint, .5);
                var endControl = moveTowardsFractional(curPoint, curveEnd, .5);

                // Create the curve
                var curveCmd = ["C", startControl.x, startControl.y, endControl.x, endControl.y, curveEnd.x, curveEnd.y];
                // Save the original point for fractional calculations
                curveCmd.origPoint = curPoint;
                resultCommands.push(curveCmd);
            } else {
                // Pass through commands that don't qualify
                resultCommands.push(curCmd);
            }
        }

        // Fix up the starting point and restore the close path if the path was orignally closed
        if (virtualCloseLine) {
            var newStartPoint = pointForCommand(resultCommands[resultCommands.length-1]);
            resultCommands.push(["Z"]);
            adjustCommand(resultCommands[0], newStartPoint);
        }
    } else {
        resultCommands = commands;
    }

    return resultCommands.reduce(function(str, c){ return str + c.join(" ") + " "; }, "");
}

module.exports = roundPathCorners;
},{}]},{},[1])(1)
});
