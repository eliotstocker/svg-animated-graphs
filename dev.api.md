## Classes

<dl>
<dt><a href="#svgAnimatedGraphs">svgAnimatedGraphs</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Extents">Extents</a> : <code>Object</code></dt>
<dd><p>Extents object</p>
</dd>
<dt><a href="#Extent">Extent</a> : <code>Object</code></dt>
<dd><p>Extent Object</p>
</dd>
<dt><a href="#Options">Options</a> : <code>Object</code></dt>
<dd><p>Options object</p>
</dd>
<dt><a href="#Point">Point</a> : <code>Array.&lt;number&gt;</code></dt>
<dd><p>Spatial Point</p>
</dd>
<dt><a href="#LinePath">LinePath</a> : <code>object</code></dt>
<dd><p>Line Path Object</p>
</dd>
<dt><a href="#Segment">Segment</a></dt>
<dd><p>Segment spec</p>
</dd>
<dt><a href="#Bar">Bar</a></dt>
<dd><p>Bar Spec</p>
</dd>
<dt><a href="#BarGroup">BarGroup</a></dt>
<dd><p>Bar Group Spec</p>
</dd>
</dl>

<a name="svgAnimatedGraphs"></a>

## svgAnimatedGraphs
**Kind**: global class  

* [svgAnimatedGraphs](#svgAnimatedGraphs)
    * [new svgAnimatedGraphs(options)](#new_svgAnimatedGraphs_new)
    * [._createCanvas()](#svgAnimatedGraphs+_createCanvas) ℗
    * [._setViewableHeight(height)](#svgAnimatedGraphs+_setViewableHeight) ℗
    * [._setAspectRatio(ratio, height)](#svgAnimatedGraphs+_setAspectRatio) ℗
    * [._getReserved()](#svgAnimatedGraphs+_getReserved) ⇒ <code>Array.&lt;string&gt;</code> ℗
    * [._getUnreservedFields()](#svgAnimatedGraphs+_getUnreservedFields) ⇒ <code>Array.&lt;string&gt;</code> ℗
    * [._createInitial(init)](#svgAnimatedGraphs+_createInitial) ℗
    * [._clearCanvas()](#svgAnimatedGraphs+_clearCanvas) ℗
    * [._getStyle(color, key)](#svgAnimatedGraphs+_getStyle) ℗
    * [._createEmpty(color, [size], [className])](#svgAnimatedGraphs+_createEmpty) ℗
    * [._validateData(data)](#svgAnimatedGraphs+_validateData) ℗
    * [._getFields(data)](#svgAnimatedGraphs+_getFields) ℗
    * [._getExtents(data)](#svgAnimatedGraphs+_getExtents) ℗
    * [.setOptions(options, [duration])](#svgAnimatedGraphs+setOptions)
    * [.setData(data, [duration])](#svgAnimatedGraphs+setData)
    * [._render(duration, animate)](#svgAnimatedGraphs+_render) ℗
    * [._createLine(xKey, yKey)](#svgAnimatedGraphs+_createLine) ⇒ [<code>LinePath</code>](#LinePath) ℗
    * [._createSegment(xKey, yKey)](#svgAnimatedGraphs+_createSegment) ⇒ [<code>Segment</code>](#Segment) ℗
    * [._createBarGroup(xKey, data)](#svgAnimatedGraphs+_createBarGroup) ⇒ [<code>BarGroup</code>](#BarGroup) ℗
    * [._getPoint(prefix, point)](#svgAnimatedGraphs+_getPoint) ⇒ <code>string</code> ℗
    * [._drawLinePath(data)](#svgAnimatedGraphs+_drawLinePath) ⇒ <code>Shape</code> ℗
    * [._drawRoundPath(data, total, rotation)](#svgAnimatedGraphs+_drawRoundPath) ⇒ <code>Object</code> ℗
    * [._drawBarGroup(group, groupCount, groupIndex, max)](#svgAnimatedGraphs+_drawBarGroup) ⇒ <code>Array.&lt;object&gt;</code> ℗
    * [.getLegendData()](#svgAnimatedGraphs+getLegendData) ⇒ <code>array</code>
    * [._renderText()](#svgAnimatedGraphs+_renderText) ℗

<a name="new_svgAnimatedGraphs_new"></a>

### new svgAnimatedGraphs(options)
create a graph object


| Param | Type |
| --- | --- |
| options | [<code>Options</code>](#Options) | 

<a name="svgAnimatedGraphs+_createCanvas"></a>

### svgAnimatedGraphs.\_createCanvas() ℗
Create SVG Canvas inter

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  
<a name="svgAnimatedGraphs+_setViewableHeight"></a>

### svgAnimatedGraphs.\_setViewableHeight(height) ℗
set view height (mostly to enabled/disable top extent)

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| height | <code>number</code> | canvas render height |

<a name="svgAnimatedGraphs+_setAspectRatio"></a>

### svgAnimatedGraphs.\_setAspectRatio(ratio, height) ℗
set aspect ratio of the canvas

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| ratio | <code>number</code> | width/height ratio |
| height | <code>number</code> | canvas render height |

<a name="svgAnimatedGraphs+_getReserved"></a>

### svgAnimatedGraphs.\_getReserved() ⇒ <code>Array.&lt;string&gt;</code> ℗
get known reserved fields

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  
<a name="svgAnimatedGraphs+_getUnreservedFields"></a>

### svgAnimatedGraphs.\_getUnreservedFields() ⇒ <code>Array.&lt;string&gt;</code> ℗
get unreserved fields for series

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  
<a name="svgAnimatedGraphs+_createInitial"></a>

### svgAnimatedGraphs.\_createInitial(init) ℗
Create initial line elements (if passed data, will create one for each dataset)

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| init | <code>array</code> | data set |

<a name="svgAnimatedGraphs+_clearCanvas"></a>

### svgAnimatedGraphs.\_clearCanvas() ℗
clear off the canvas

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  
<a name="svgAnimatedGraphs+_getStyle"></a>

### svgAnimatedGraphs.\_getStyle(color, key) ℗
get the style attributes for a series

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| color | <code>array</code> |  | rgb vector 3 color array |
| key | <code>string</code> \| <code>null</code> | <code>null</code> | series key |

<a name="svgAnimatedGraphs+_createEmpty"></a>

### svgAnimatedGraphs.\_createEmpty(color, [size], [className]) ℗
create an empty line

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| color | <code>array</code> |  | array of rgb values |
| [size] | <code>number</code> | <code>10</code> | number of points to add to the initial line (makes for smoother tweening) |
| [className] | <code>string</code> |  | class name for the line |

<a name="svgAnimatedGraphs+_validateData"></a>

### svgAnimatedGraphs.\_validateData(data) ℗
create an empty line

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>array</code> | data set to validate |

<a name="svgAnimatedGraphs+_getFields"></a>

### svgAnimatedGraphs.\_getFields(data) ℗
list fields available

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>array</code> | data set |

<a name="svgAnimatedGraphs+_getExtents"></a>

### svgAnimatedGraphs.\_getExtents(data) ℗
get x and y axis extents

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>array</code> | data set |

<a name="svgAnimatedGraphs+setOptions"></a>

### svgAnimatedGraphs.setOptions(options, [duration])
update the options to change the rendering style etc

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | [<code>Options</code>](#Options) |  | partial options block to update options |
| [duration] | <code>number</code> | <code>1000</code> | duration (in milliseconds) for animation if rerender is required |

<a name="svgAnimatedGraphs+setData"></a>

### svgAnimatedGraphs.setData(data, [duration])
update the dataset (pass full dataset)

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>array</code> |  | new graph data |
| [duration] | <code>number</code> | <code>1000</code> | duration (in milliseconds) for animation to the new data |

<a name="svgAnimatedGraphs+_render"></a>

### svgAnimatedGraphs.\_render(duration, animate) ℗
render the data to the canvas

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| duration | <code>number</code> | <code>1000</code> | duration of animation |
| animate | <code>boolean</code> | <code>true</code> | weather or not to animate the transition |

<a name="svgAnimatedGraphs+_createLine"></a>

### svgAnimatedGraphs.\_createLine(xKey, yKey) ⇒ [<code>LinePath</code>](#LinePath) ℗
create a vector 2 point output for a single line dataset

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| xKey | <code>string</code> | the value to use for the x axis |
| yKey | <code>string</code> | the value to use for the y axis for this line |

<a name="svgAnimatedGraphs+_createSegment"></a>

### svgAnimatedGraphs.\_createSegment(xKey, yKey) ⇒ [<code>Segment</code>](#Segment) ℗
create a spec for a pie/donut segment

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| xKey | <code>string</code> | the value to use for the x axis |
| yKey | <code>string</code> | the value to use for the y axis for this segment |

<a name="svgAnimatedGraphs+_createBarGroup"></a>

### svgAnimatedGraphs.\_createBarGroup(xKey, data) ⇒ [<code>BarGroup</code>](#BarGroup) ℗
create a spec for a bar group

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| xKey | <code>string</code> | the value to use for the x axis |
| data | <code>object</code> | single data entry point object (key value) |

<a name="svgAnimatedGraphs+_getPoint"></a>

### svgAnimatedGraphs.\_getPoint(prefix, point) ⇒ <code>string</code> ℗
return the point as an SVG operation

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Returns**: <code>string</code> - operation  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| prefix | <code>string</code> | operation marker |
| point | [<code>Point</code>](#Point) | vector 2 point map |

<a name="svgAnimatedGraphs+_drawLinePath"></a>

### svgAnimatedGraphs.\_drawLinePath(data) ⇒ <code>Shape</code> ℗
create a shape output for a single series

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| data | [<code>LinePath</code>](#LinePath) | Line path data |

<a name="svgAnimatedGraphs+_drawRoundPath"></a>

### svgAnimatedGraphs.\_drawRoundPath(data, total, rotation) ⇒ <code>Object</code> ℗
create a shape output for a pie/donut segment

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Returns**: <code>Object</code> - Shape Definition  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| data | [<code>Segment</code>](#Segment) | new graph data |
| total | <code>number</code> | total of all values for pie |
| rotation | <code>number</code> | start rotation for segment |

<a name="svgAnimatedGraphs+_drawBarGroup"></a>

### svgAnimatedGraphs.\_drawBarGroup(group, groupCount, groupIndex, max) ⇒ <code>Array.&lt;object&gt;</code> ℗
draw a single data point group as bars

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Returns**: <code>Array.&lt;object&gt;</code> - Shape Definition  
**Access**: private  

| Param | Type | Description |
| --- | --- | --- |
| group | <code>object</code> | group defination object |
| groupCount |  |  |
| groupIndex |  |  |
| max |  |  |

<a name="svgAnimatedGraphs+getLegendData"></a>

### svgAnimatedGraphs.getLegendData() ⇒ <code>array</code>
get an array of keys from data to use as a legend

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Returns**: <code>array</code> - array of legend items  
<a name="svgAnimatedGraphs+_renderText"></a>

### svgAnimatedGraphs.\_renderText() ℗
render extent text

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Access**: private  
<a name="Extents"></a>

## Extents : <code>Object</code>
Extents object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| x | [<code>Extent</code>](#Extent) | extents for the x axis |
| y | [<code>Extent</code>](#Extent) | extents for the x axis |

<a name="Extent"></a>

## Extent : <code>Object</code>
Extent Object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| min | <code>Number</code> | minimum value on axis |
| max | <code>Number</code> | maximum value on axis |

<a name="Options"></a>

## Options : <code>Object</code>
Options object

**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| options.xAxisField | <code>string</code> |  | the key from each data object to use as the X Axis value |
| options.el | <code>HTMLElement</code> |  | the parent element to add teh graph into |
| [options.units] | <code>string</code> |  | units to set on the y axis label |
| [options.seriesProperties] | <code>string</code> |  | object to extract render properties from, general properties in the top level or per series properties in named keys |
| [options.width] | <code>string</code> | <code>&quot;100%&quot;</code> | a valid size string to set to the width for the graph relative to the parent element |
| [options.height] | <code>string</code> | <code>&quot;100%&quot;</code> | a valid size string to set to the height for the graph relative to the parent element |
| [options.animateIn] | <code>boolean</code> | <code>true</code> | animate initial data from nothing |
| [options.interpolate] | <code>boolean</code> | <code>true</code> | interpolate points to make the graph rounded |
| [options.type] | <code>string</code> | <code>&quot;area&quot;</code> | graph type (line, area, more coming soon...) |
| [options.offsetAnimate] | <code>boolean</code> | <code>true</code> | animate each dataset one at a time |
| [options.showExtent] | <code>boolean</code> | <code>true</code> | show max y value extent line on graph |
| [options.opacity] | <code>number</code> | <code>0.7</code> | opacity value for data set rendering |
| [options.lineWidth] | <code>number</code> | <code>0.4</code> | width of lines when rendering without fill |
| [options.colors] | <code>array</code> |  | an array of vector 3 values for graph dataset rendering |
| [options.rounding] | <code>number</code> | <code>0.25</code> | amount of rounding to apply if interpolation is enabled |
| [options.extents] | [<code>Extents</code>](#Extents) |  | absolute values for graph extents (by default these will be calculated from the data sets |
| [options.ignoreFields] | <code>Array.&lt;string&gt;</code> |  | fields to ignore in the data objects array |
| [options.groupMode] | <code>string</code> | <code>&quot;stacked&quot;</code> | how to group bars etc |

<a name="Point"></a>

## Point : <code>Array.&lt;number&gt;</code>
Spatial Point

**Kind**: global typedef  
<a name="LinePath"></a>

## LinePath : <code>object</code>
Line Path Object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | line legend key |
| color | <code>Array.&lt;number&gt;</code> | color array (vector 3 r,g,b (0 - 256)) |
| path | [<code>Array.&lt;Point&gt;</code>](#Point) | array of points to plot the line |

<a name="Segment"></a>

## Segment
Segment spec

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Segment legend key |
| color | <code>Array.&lt;number&gt;</code> | color array (vector 3 r,g,b (0 - 256)) |
| value | <code>number</code> | total value assigned to the segment |

<a name="Bar"></a>

## Bar
Bar Spec

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | field key |
| value | <code>number</code> | bar representation value |
| color | <code>array</code> | rgb vector 3 color array |

<a name="BarGroup"></a>

## BarGroup
Bar Group Spec

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| group | <code>string</code> \| <code>number</code> | xAxis label for the group |
| group | <code>string</code> | type (stacked or grouped) |
| max | <code>number</code> | group maximum extent (max value when not stacked, combined values when stacked) |
| quadrants | [<code>Bar</code>](#Bar) | spec for the bars in the group |

