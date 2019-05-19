'use strict';

const { shape, render, play, timeline } = require('wilderness');
const rounding = require('./rounding');
const svgParth = require('svgpath');

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
        this.options = Object.assign({}, defaultOptions, options);
        this._listeners = {};

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

        this._listeners.canvasSizer && window.removeEventListener('resize', this._listeners.canvasSizer);
        window.addEventListener('resize', this._listeners.canvasSizer = () => {
            this._render(0, false);
        });
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

        this._animate(fields, combinedShapes, duration);
    }

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

            const animation = timeline(...tl, {
                duration
            });
            render(this._canvas, animation);
            play(animation);
        } else {
            const animation = timeline(...combinedShapes.map((path, index) => {
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
            render(this._canvas, animation);
            play(animation);
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

        const x = aCalc <= 90 ? l * Math.sin(aRad) : l*Math.sin((180 - aCalc) * Math.PI / 180);

        const Y = Math.sqrt(z * z - x * x);
        const X = a <= 180 ? l + x : l - x;

        let pathString = `M ${l},0 A ${l},${l} 1 0,1 ${X},${Y}`;
        if(fillTypes.includes(this.options.type)) {
            pathString = `M ${l},${l} ${pathString.replace('M', 'L')} z`;
        }

        const transformed = svgParth(pathString)
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

        const line = shape({
            type: 'line',
            x1: 0,
            x2: this._width,
            y1: 10,
            y2: 10,
            stroke: `rgba(0,0,0,${this.options.opacity})`,
            'stroke-width': 0.1
        });

        this._container.appendChild(text);
        render(this._canvas, line);
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