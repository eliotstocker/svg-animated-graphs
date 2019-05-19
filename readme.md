# SVG Animated Graphs

A simple library for (not super accurate, but beautiful) graphin in Javascript and SVG

## Feature List:
- [x] General Rendering (using Widerness JS)
- [x] Area Charts
- [x] Line Charts
- [x] Pie Charts
- [x] Donut Charts
- [x] Bar Charts
- [x] Column Charts
- [x] Animate on settings change
- [x] Animate on data updated
- [x] Animate on series added
- [x] Manual Extents
- [x] Top Extent marking
- [ ] Other Extent Markings
- [ ] Tick Markings
- [x] Legend Data Export
- [ ] Legend Rendering
- [ ] Axis Labels
- [x] Animation queueing
 
## Input Data Spec:

data should be passed into the library as an array of objects where each object fits the same schema,
the key names etc will be used as the series labels

## API:
[API Docs here](api.md)

## Dependencies:
 * [Wilderness](https://wilderness.now.sh/)
 * [SVGPath](https://github.com/fontello/svgpath)
