'use strict';

const { shape, plainShapeObject, render, play, timeline } = require('wilderness');
const rounding = require('./rounding');

const defaultOptions = {
    animateIn: true,
    interpolate: true,
    opacity: 0.7,
    fill: true,
    offsetAnimate: false,
    lineWidth: 0.4,
    rounding: 0.25,
    width: '100%',
    height: '100%',
    colors: [
        [255, 0, 0],
        [255, 255, 0],
        [0, 0, 255],
        [0, 255, 0]
    ],
    showExtent: true,
};

const optionsAffectingRender = ['fill', 'colors', 'opacity', 'interpolate', 'line-width', 'extents', 'showExtent'];

const svgNS = 'http://www.w3.org/2000/svg';

const renderHeight = 110;
const renderWidth = 100;

class svgAnimatedGraphs {
    /**
     * Extents object
     * @typedef {Object} Extents
     * @property {Object} x - extents for the x axis
     * @property {Number} x.min - minimum value on the x axis
     * @property {Number} x.max - maximum value on the x axis
     * @property {Object} y - extents for the x axis
     * @property {Number} y.min - minimum value on the y axis
     * @property {Number} y.max - maximum value on the y axis
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
     * @property {boolean} [options.fill=true] - fill the graph splines (if false a line graph is rendered)
     * @property {boolean} [options.offsetAnimate=true] - animate each dataset one at a time
     * @property {boolean} [options.showExtent=true] - show max y value extent line on graph
     * @property {number} [options.opacity=0.7] - opacity value for data set rendering
     * @property {number} [options.lineWidth=0.4] - width of lines when rendering without fill
     * @property {array} [options.colors] - an array of vector 3 values for graph dataset rendering
     * @property {number} [options.rounding=0.25] - amount of rounding to apply if interpolation is enabled
     * @property {Extents} [options.extents} - absolute values for graph extents (by default these will be calculated from the data sets
     */

    /**
     * create a graph object
     * @param options {Options}
     */
    constructor(options) {
        this.options = Object.assign({}, defaultOptions, options);
        this._listeners = {};
        if(!this.options.el) {
            throw new Error('you must provide a parent element | options.el');
        }
        this.el = this.options.el;
        if(this.options.data) {
            this._validateData(this.options.data);
            this.data = this.options.data;
        }
        this._paths = [];
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
        this._canvas.setAttribute('preserveAspectRatio', 'none');
        this._canvas.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this._canvas.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        this._container.appendChild(this._canvas);
        this.el.appendChild(this._container);
    }

    _setViewableHeight(height) {
        this._canvas.setAttribute('viewBox', `0 ${renderHeight - height} ${renderWidth} ${height}`);
    }

    /**
     * get known reserved fields
     * @returns {string[]}
     * @private
     */
    _getReserved() {
        const reserved = [this.options.xAxisField];

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

            render(this._canvas, placeholder);
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
     * @param {string} key - series key
     * @private
     */
    _getStyle(color, key) {
        let style = {};

        if(this.options.fill) {
            style.fill = `rgba(${color[0]},${color[1]},${color[2]}, ${this.options.opacity})`;
            style.stroke = `rgba(${color[0]},${color[1]},${color[2]}, 0)`
        } else {
            style.fill = `rgba(${color[0]},${color[1]},${color[2]}, 0)`;
            style.stroke = `rgba(${color[0]},${color[1]},${color[2]}, ${this.options.opacity})`;
        }

        style['stroke-width'] = this.options.lineWidth;

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

        if(this.options.fill) {
            points += `L ${renderHeight},${renderHeight} L 0,${renderHeight} Z`;
        }

        const spec = {
            type: 'path',
            d: points,
        };

        if(className) {
            spec.class = className;
        }

        return shape(Object.assign({}, this._getStyle(color), spec));
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
            }
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
        }
    }

    /**
     * update the options to change the rendering style etc
     * @param {Options} options - partial options block to update options
     * @param {number} [duration=1000} - duration (in milliseconds) for animation if rerendering is required
     */
    setOptions(options, duration = 1000) {
        Object.assign(this.options, options);

        const rerender = Object.keys(options).reduce((render, key) => {
            if (optionsAffectingRender.includes(key)) {
                return true;
            }
            return render;
        }, false);

        if(rerender) {
            this.setData(this.data, duration);
        }
    }

    /**
     * update the dataset (pass full dataset)
     * @param {array} data - new graph data
     * @param {number} [duration=1000} - duration (in milliseconds) for animation to the new data
     */
    setData(data, duration = 1000) {
        this._validateData(data);

        this.data = data;
        this.extents = this._getExtents(this.data);
        const fields = this._getFields(this.data);

        const xKey = this.options.xAxisField;
        const paths = fields.filter(field => field !== xKey).map(field => this._createLine(xKey, field));

        const oldPaths = this._paths;
        this._paths = paths.map(path => this._drawPath(path));

        if(!oldPaths || oldPaths.length < 1) {
            return render(this._canvas, ...this._paths);
        }

        const combinedPaths = paths.map((item, index) => shape(plainShapeObject(oldPaths[index] || oldPaths[0]), plainShapeObject(this._paths[index])));

        this._clearCanvas();

        if (this.options.offsetAnimate) {
            const animation = timeline(...combinedPaths, {
                duration
            });
            render(this._canvas, animation);
            play(animation);
        } else {
            combinedPaths.forEach(path => {
                const animation = timeline(path, {
                    duration
                });
                render(this._canvas, animation);
                play(animation);
            });
        }

        if(this.options.showExtent) {
            this._setViewableHeight(110);
            this._renderText();
        } else {
            this._setViewableHeight(100);
        }
    }

    /**
     * create a vector 2 point output for a single line dataset
     * @param {string} xKey - the value to use for the x axis
     * @param {string} yKey - the value to use for the y axis
     * @private
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
        }
    }

    /**
     * return the point as an SVG operation
     * @param {string} prefix - operation marker
     * @param {string} point - vector 2 point map
     * @returns {string} operation
     * @private
     */
    _getPoint(prefix, point) {
        return `${prefix} ${point[0]},${renderHeight - point[1]}`
    }

    /**
     * create a shape output for a single series
     * @param {array} data - new graph data
     * @private
     */
    _drawPath(data) {
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

        if(this.options.fill) {
            const last = data.path[data.path.length - 1];
            const first = data.path[0];
            pathString += ` L ${last[0]}, ${renderHeight} L ${first[0]},${renderHeight} Z`;
        }


        const pathEl = shape(Object.assign({}, this._getStyle(data.color, data.key), {
            type: 'path',
            d: pathString,
            class: `plot-${data.key}-values`,
        }));

        return pathEl;
    }

    getLegendData() {
        return this._getUnreservedFields(this.data).map((key, index) => {
            const color = this.options.colors[index];
            return {
                index,
                label: key,
                color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.options.opacity})`
            }
        });
    }

    _renderText() {
        const text = document.createElement('span');
        text.style.position = 'absolute';
        text.style.top = (this._container.offsetHeight / 110) * 1.5;
        text.style.left = (this._container.offsetHeight / 110) * 1.5;
        text.style.fontSize = (this._container.offsetHeight / 110) * 6;
        text.style.textTransform = 'uppercase';
        text.style.opacity = this.options.opacity;

        this._listeners.textResize && window.removeEventListener(this._listeners.textResize);
        this._listeners.textResize = window.addEventListener('resize', () => {
            text.style.top = (this._container.offsetHeight / 110) * 1.5;
            text.style.left = (this._container.offsetHeight / 110) * 1.5;
            text.style.fontSize = (this._container.offsetHeight / 110) * 6;
        });

        text.textContent = this.extents.y[1];
        if(this.options.units) {
            text.textContent += this.options.units;
        }

        const line = shape({
            type: 'line',
            x1: 0,
            x2: 100,
            y1: 10,
            y2: 10,
            stroke: `rgba(0,0,0,${this.options.opacity})`,
            'stroke-width': 0.1
        });

        this._container.appendChild(text);
        render(this._canvas, line);
    }
}

module.exports = svgAnimatedGraphs;