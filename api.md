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
<dt><a href="#Options">Options</a> : <code>Object</code></dt>
<dd><p>Options object</p>
</dd>
</dl>

<a name="svgAnimatedGraphs"></a>

## svgAnimatedGraphs
**Kind**: global class  

* [svgAnimatedGraphs](#svgAnimatedGraphs)
    * [new svgAnimatedGraphs(options)](#new_svgAnimatedGraphs_new)
    * [.setOptions(options, duration)](#svgAnimatedGraphs+setOptions)
    * [.setData(data, duration)](#svgAnimatedGraphs+setData)
    * [.getLegendData()](#svgAnimatedGraphs+getLegendData) ⇒ <code>array</code>

<a name="new_svgAnimatedGraphs_new"></a>

### new svgAnimatedGraphs(options)
create a graph object


| Param | Type |
| --- | --- |
| options | [<code>Options</code>](#Options) | 

<a name="svgAnimatedGraphs+setOptions"></a>

### svgAnimatedGraphs.setOptions(options, duration)
update the options to change the rendering style etc

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | [<code>Options</code>](#Options) |  | partial options block to update options |
| duration | <code>number</code> | <code>1000}</code> | duration (in milliseconds) for animation if rerender is required |

<a name="svgAnimatedGraphs+setData"></a>

### svgAnimatedGraphs.setData(data, duration)
update the dataset (pass full dataset)

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>array</code> |  | new graph data |
| duration | <code>number</code> | <code>1000}</code> | duration (in milliseconds) for animation to the new data |

<a name="svgAnimatedGraphs+getLegendData"></a>

### svgAnimatedGraphs.getLegendData() ⇒ <code>array</code>
get an array of keys from data to use as a legend

**Kind**: instance method of [<code>svgAnimatedGraphs</code>](#svgAnimatedGraphs)  
**Returns**: <code>array</code> - array of legend items  
<a name="Extents"></a>

## Extents : <code>Object</code>
Extents object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| x | <code>Object</code> | extents for the x axis |
| x.min | <code>Number</code> | minimum value on the x axis |
| x.max | <code>Number</code> | maximum value on the x axis |
| y | <code>Object</code> | extents for the x axis |
| y.min | <code>Number</code> | minimum value on the y axis |
| y.max | <code>Number</code> | maximum value on the y axis |

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

